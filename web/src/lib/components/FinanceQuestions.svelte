<script lang="ts">
  import { money, monthLabel } from '#lib/finance.js';
  import {
    loadQuestion,
    questionChoices,
    questionRequest,
    questionStatus,
    type QuestionAnswer,
    type QuestionKind
  } from '#lib/questions.js';
  import { agendaDate } from '#lib/card-agenda.js';
  import * as Card from '#lib/components/ui/card/index.js';
  import { Button } from '#lib/components/ui/button/index.js';
  let {
    available,
    month,
    hidden = false
  }: { available: boolean; month: string; hidden?: boolean } = $props();
  let kind = $state<QuestionKind>('month_comparison');
  let category = $state('FOOD');
  let categories = $state<{ value: string; label: string }[]>([]);
  let answer = $state<QuestionAnswer | null>(null),
    error = $state(''),
    loading = $state(false);
  let version = 0;
  const display = (amount: number) => (hidden ? '••••••' : money(amount));
  const updated = (value: string | null) =>
    value
      ? new Date(value).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo'
        })
      : 'Não informada';
  async function load(
    selectedKind = kind,
    selectedMonth = month,
    selectedCategory = category
  ) {
    const request = ++version;
    answer = null;
    error = '';
    loading = true;
    try {
      const [result, options] = await Promise.all([
        loadQuestion(selectedKind, selectedMonth, selectedCategory),
        questionRequest<{ value: string; label: string }[]>(
          '/api/questions/options'
        )
      ]);
      if (request === version) {
        answer = result;
        categories = options;
      }
    } catch (e) {
      if (request === version)
        error =
          e instanceof Error
            ? e.message
            : 'Não foi possível consultar os dados.';
    } finally {
      if (request === version) loading = false;
    }
  }
  $effect(() => {
    if (available) void load(kind, month, category);
    else {
      version++;
      answer = null;
      loading = false;
    }
  });
</script>

<Card.Root class="min-w-0 shadow-none">
  <Card.Header
    ><Card.Title>Perguntas sobre seus dados</Card.Title><Card.Description
      >Escolha uma pergunta. As respostas usam consultas prontas no servidor,
      sem IA e sem envio ao Gemini.</Card.Description
    ></Card.Header
  >
  <Card.Content class="space-y-5">
    {#if !available}<p class="text-sm text-muted-foreground">
        As perguntas precisam do backend Go conectado. Este recurso está
        indisponível no modo cloud.
      </p>
    {:else}
      <div class="flex flex-wrap gap-2" aria-label="Perguntas sugeridas">
        {#each questionChoices as choice}<Button
            variant={kind === choice.kind ? 'default' : 'outline'}
            aria-pressed={kind === choice.kind}
            onclick={() => (kind = choice.kind)}>{choice.label}</Button
          >{/each}
      </div>
      {#if kind === 'category_total'}<label class="block space-y-2 text-sm"
          ><span>Categoria de despesa</span><select
            class="block w-full rounded-md border bg-background px-3 py-2 sm:max-w-xs"
            bind:value={category}
            >{#each categories as option}<option value={option.value}
                >{option.label}</option
              >{/each}</select
          ></label
        >{/if}
      {#if loading}<p role="status" class="text-sm text-muted-foreground">
          Consultando dados e evidências…
        </p>{/if}
      {#if error}<div
          role="alert"
          class="space-y-3 rounded-md border border-destructive/40 p-4 text-sm"
        >
          <p>{error}</p>
          <Button variant="outline" onclick={() => load()}
            >Tentar novamente</Button
          >
        </div>{/if}
      {#if answer}
        <div class="space-y-4" aria-live="polite">
          {#if answer.status !== 'ok'}<p
              class="rounded-md bg-muted p-3 text-sm"
            >
              {questionStatus[answer.status]}
            </p>{/if}
          {#if answer.freshness === 'stale'}<p
              class="rounded-md border border-amber-500/40 p-3 text-sm"
            >
              Uma fonte bancária está desatualizada há mais de 48 horas ou
              informa data inconsistente. Atualize os dados antes de decidir.
            </p>{:else if answer.freshness === 'unknown'}<p
              class="text-sm text-muted-foreground"
            >
              Atualização completa da fonte não confirmada. Os valores refletem
              somente os registros disponíveis.
            </p>{/if}
          {#if answer.kind === 'month_comparison'}
            {#if answer.difference !== null}<p class="text-lg font-semibold">
                Diferença de despesas: {display(
                  answer.difference
                )}{#if answer.percent !== null}
                  <span class="text-sm font-normal"
                    >({hidden ? '•••' : `${answer.percent}%`})</span
                  >{/if}
              </p>
              <p class="text-xs text-muted-foreground">
                Mês selecionado menos mês anterior. Valor positivo indica
                aumento. {answer.percent === null
                  ? 'Percentual indisponível porque a base anterior é zero ou negativa.'
                  : ''}
              </p>{/if}
          {/if}
          {#each answer.periods as period}<section
              class="space-y-3 rounded-lg border p-4"
            >
              <h3 class="font-semibold">{monthLabel(period.month)}</h3>
              <p class="text-lg">
                {period.count
                  ? display(period.total)
                  : answer.status === 'no_matches'
                    ? display(0)
                    : 'Sem despesas registradas'}
              </p>
              <p class="text-xs text-muted-foreground">
                {period.count} lançamento(s). Critério do relatório: mês de referência
                e despesas, excluindo cancelamentos, receitas e transferências. Meses
                em aberto podem estar incompletos.
              </p>
              <a class="text-sm underline underline-offset-4" href={period.href}
                >Ver todos os movimentos usados</a
              >
              {#if period.evidence.length}<details>
                  <summary class="cursor-pointer text-sm"
                    >Conferir evidências ({period.evidence.length} de {period.count})</summary
                  >
                  <ul class="mt-2 divide-y">
                    {#each period.evidence as evidence}<li
                        class="flex flex-wrap justify-between gap-2 py-2 text-sm"
                      >
                        <a
                          class="min-w-0 break-words underline"
                          href={evidence.href}
                          >{agendaDate(evidence.date)} · {evidence.description ||
                            'Sem descrição'}</a
                        ><span>{display(evidence.amount)}</span>
                      </li>{/each}
                  </ul>
                  <p class="text-xs text-muted-foreground">
                    Até 20 registros exibidos; o total inclui todos os
                    movimentos do filtro. Descrições são texto do lançamento.
                  </p>
                </details>{/if}
            </section>{/each}
          {#if answer.agenda}<section class="space-y-3 rounded-lg border p-4">
              <h3 class="font-semibold">
                Pendências conhecidas: {agendaDate(answer.agenda.today)} e próximos
                30 dias
              </h3>
              <p class="text-xs text-muted-foreground">
                Esta pergunta usa a data atual em São Paulo, incluindo vencidos
                e sem data. O mês selecionado no topo não limita a agenda.
                Recorrências e parcelas são estimativas; compras importadas não
                viram contas a pagar nem confirmam quitação de faturas.
              </p>
              <ul class="divide-y">
                {#each answer.agenda.commitments as commitment}<li
                    class="flex flex-wrap justify-between gap-2 py-3 text-sm"
                  >
                    <div class="min-w-0">
                      <p class="break-words">{commitment.description}</p>
                      <a
                        class="text-xs underline underline-offset-4"
                        href={answer.commitmentLinks[commitment.id] ??
                          '/cartoes'}
                        >{answer.commitmentLinks[commitment.id]
                          ? 'Ver movimento registrado'
                          : 'Conferir recorrência na agenda'}</a
                      >
                      <p class="text-xs text-muted-foreground">
                        {agendaDate(commitment.dueDate)} · {commitment.estimated
                          ? 'Estimativa cadastrada'
                          : 'Pagamento cadastrado'} · {commitment.status ===
                        'OVERDUE'
                          ? 'Vencido sem confirmação'
                          : 'Pendente'}
                      </p>
                    </div>
                    <strong>{display(commitment.amount)}</strong>
                  </li>{/each}
              </ul>
              <a href="/cartoes" class="text-sm underline underline-offset-4"
                >Conferir origem e compromissos na agenda</a
              >
            </section>{/if}
          <p class="text-xs leading-relaxed text-muted-foreground">
            Origem: Go / PostgreSQL. Consulta: {updated(answer.generatedAt)}.
            Atualização bancária mais antiga conhecida: {updated(
              answer.sourceUpdatedAt
            )}. Essa data não certifica cobertura dos lançamentos manuais nem
            importação completa.
          </p>
          <Button variant="outline" size="sm" onclick={() => load()}
            >Atualizar resposta</Button
          >
        </div>
      {/if}
      <p class="text-xs text-muted-foreground">
        Perguntas livres, alterações por conversa e comprovantes ficam fora
        desta entrega. As consultas continuam funcionando sem chave, cota ou
        disponibilidade de IA.
      </p>
    {/if}
  </Card.Content>
</Card.Root>
