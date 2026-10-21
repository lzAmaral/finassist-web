<script lang="ts">
  import { money, monthLabel } from '#lib/finance.js';
  import {
    expenseClassLabels,
    planningRequest,
    projectedRemainder,
    type BudgetData,
    type BudgetItem,
    type ExpenseClass,
    type ExpenseRule,
    type ProjectionData
  } from '#lib/planning.js';
  import * as Card from '#lib/components/ui/card/index.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Badge } from '#lib/components/ui/badge/index.js';

  let {
    enabled,
    month,
    currentBalance = null,
    hidden = false
  }: {
    enabled: boolean;
    month: string;
    currentBalance?: number | null;
    hidden?: boolean;
  } = $props();
  let budget = $state<BudgetData | null>(null),
    projection = $state<ProjectionData | null>(null);
  let loading = $state(false),
    saving = $state(''),
    error = $state(''),
    projectionError = $state(''),
    message = $state('');
  let editing = $state(''),
    selectedClass = $state<ExpenseRule>('AUTO');
  let generation = 0;
  const classes: ExpenseClass[] = ['FIXED', 'INSTALLMENT', 'VARIABLE'];
  const display = (value: number | null) =>
    value === null ? 'Não informado' : hidden ? '••••••' : money(value);
  let totals = $derived(budget?.series.find((entry) => entry.month === month));
  async function load(selectedMonth: string, clear = false) {
    const version = ++generation;
    loading = true;
    error = '';
    projectionError = '';
    if (clear) {
      budget = null;
      projection = null;
      editing = '';
      message = '';
    }
    const [budgetResult, projectionResult] = await Promise.allSettled([
      planningRequest<BudgetData>(
        `/api/budget?month=${encodeURIComponent(selectedMonth)}`
      ),
      planningRequest<ProjectionData>('/api/projection?months=6')
    ]);
    if (version !== generation) return;
    if (budgetResult.status === 'fulfilled') budget = budgetResult.value;
    else
      error =
        budgetResult.reason instanceof Error
          ? budgetResult.reason.message
          : 'Não foi possível carregar o orçamento.';
    if (projectionResult.status === 'fulfilled')
      projection = projectionResult.value;
    else {
      projection = null;
      projectionError =
        projectionResult.reason instanceof Error
          ? projectionResult.reason.message
          : 'Projeção indisponível.';
    }
    loading = false;
  }
  $effect(() => {
    if (enabled) {
      void load(month, true);
    } else {
      generation++;
      budget = null;
      projection = null;
      loading = false;
    }
  });
  function edit(item: BudgetItem) {
    editing = item.key;
    selectedClass =
      item.manual && item.class !== 'INSTALLMENT' ? item.class : 'AUTO';
  }
  async function saveRule(item: BudgetItem) {
    const selectedMonth = month;
    saving = item.key;
    error = '';
    message = '';
    try {
      await planningRequest('/api/expense-rules', 'PUT', {
        key: item.key,
        class: selectedClass
      });
      if (month === selectedMonth) {
        editing = '';
        message = 'Classificação salva. Orçamento e projeção recalculados.';
        await load(selectedMonth);
      }
    } catch (e) {
      error =
        e instanceof Error
          ? e.message
          : 'Não foi possível salvar a classificação.';
    } finally {
      saving = '';
    }
  }
</script>

<div class="space-y-5">
  {#if !enabled}
    <Card.Root class="shadow-none"
      ><Card.Header><Card.Title>Orçamento com contexto</Card.Title></Card.Header
      ><Card.Content
        ><p class="text-sm text-muted-foreground">
          A classificação de despesas e a projeção requerem o backend Go
          conectado e pronto. O modo cloud mantém consulta e sincronização;
          planejamento não está disponível nessa fonte.
        </p></Card.Content
      ></Card.Root
    >
  {:else}
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold">Seu mês em perspectiva</h2>
        <p class="text-sm text-muted-foreground">
          Despesas de {monthLabel(month)}. As projeções partem do mês atual, com
          as premissas do Go.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onclick={() => load(month)}
        disabled={loading || !!saving}>Atualizar orçamento</Button
      >
    </div>
    {#if message}<p role="status" class="text-sm">{message}</p>{/if}
    {#if error}<div
        role="alert"
        class="rounded-lg border border-destructive/40 p-4 text-sm"
      >
        <p>{error}</p>
        <Button
          variant="outline"
          class="mt-2"
          onclick={() => load(month)}
          disabled={loading || !!saving}>Tentar novamente</Button
        >
      </div>{/if}
    {#if loading}<p role="status" class="text-sm text-muted-foreground">
        Atualizando orçamento e premissas…
      </p>{/if}
    {#if budget}
      <div class="grid gap-4 sm:grid-cols-3">
        {#each classes as expenseClass}<Card.Root class="gap-3 shadow-none"
            ><Card.Header
              ><Card.Description
                >{expenseClassLabels[expenseClass]}</Card.Description
              ><Card.Title
                >{display(
                  totals
                    ? expenseClass === 'FIXED'
                      ? totals.fixed
                      : expenseClass === 'INSTALLMENT'
                        ? totals.installment
                        : totals.variable
                    : null
                )}</Card.Title
              ></Card.Header
            ></Card.Root
          >{/each}
      </div>
      <p class="text-xs leading-relaxed text-muted-foreground">
        A classe identifica o comportamento da despesa pela descrição
        normalizada. Você pode corrigir uma conta como fixa ou variável, ou
        voltar à detecção automática. A correção alcança a mesma descrição no
        histórico e nas projeções. A soma do mês não confirma o pagamento de
        faturas.
      </p>
      {#if budget.items.length === 0}<p
          class="rounded-lg border p-6 text-sm text-muted-foreground"
        >
          Nenhuma despesa registrada neste mês para classificar. Isso não
          confirma ausência de contas futuras.
        </p>{/if}
      {#each classes as expenseClass}
        {@const items = budget.items.filter(
          (entry) => entry.class === expenseClass
        )}
        {#if items.length > 0}<Card.Root class="gap-4 shadow-none"
            ><Card.Header
              ><Card.Title>{expenseClassLabels[expenseClass]}</Card.Title
              ></Card.Header
            ><Card.Content
              ><ul class="divide-y">
                {#each items as item (item.key)}
                  <li class="space-y-3 py-4 first:pt-0 last:pb-0">
                    <div
                      class="flex flex-wrap items-start justify-between gap-3"
                    >
                      <div class="min-w-0 flex-1">
                        <p class="break-words text-sm font-medium">
                          {item.label}
                        </p>
                        <p class="mt-1 text-xs text-muted-foreground">
                          {item.categoryLabel} · {item.count} lançamento(s) · presente
                          em {item.months} mês(es) da janela
                        </p>
                        <Badge class="mt-2" variant="outline"
                          >{item.manual
                            ? 'Correção manual'
                            : 'Detecção automática'}</Badge
                        >
                      </div>
                      <div class="text-right">
                        <p class="text-sm font-semibold">
                          {display(item.total)}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          class="mt-2"
                          disabled={!!saving || loading}
                          onclick={() => edit(item)}
                          >Corrigir classe<span class="sr-only">
                            de {item.label}</span
                          ></Button
                        >
                      </div>
                    </div>
                    {#if editing === item.key}<form
                        class="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-[1fr_auto]"
                        onsubmit={(event) => {
                          event.preventDefault();
                          void saveRule(item);
                        }}
                        aria-label={`Classificação de ${item.label}`}
                      >
                        <label class="grid gap-1.5 text-sm"
                          >Classificação<select
                            bind:value={selectedClass}
                            disabled={!!saving}
                            ><option value="AUTO"
                              >Automática (inclui parcelas detectadas)</option
                            ><option value="FIXED">Fixa</option><option
                              value="VARIABLE">Variável</option
                            ></select
                          ></label
                        >
                        <div class="flex flex-wrap items-end gap-2">
                          <Button size="sm" type="submit" disabled={!!saving}
                            >{saving === item.key
                              ? 'Salvando…'
                              : 'Salvar classe'}</Button
                          ><Button
                            size="sm"
                            variant="outline"
                            disabled={!!saving}
                            onclick={() => (editing = '')}>Cancelar</Button
                          >
                        </div>
                        <p class="sm:col-span-2 text-xs text-muted-foreground">
                          “Automática” remove a correção manual e permite
                          detectar parcelas e recorrências novamente. A
                          categoria dos lançamentos permanece independente da
                          classe.
                        </p>
                      </form>{/if}
                  </li>
                {/each}
              </ul></Card.Content
            ></Card.Root
          >{/if}
      {/each}
    {/if}
    <Card.Root class="shadow-none"
      ><Card.Header
        ><Card.Title>Sobra estimada, mês a mês</Card.Title><Card.Description
          >Uma referência para planejar aportes. A projeção não é dinheiro
          garantidamente disponível para gastar.</Card.Description
        ></Card.Header
      ><Card.Content class="space-y-4">
        <div class="rounded-lg border p-4">
          <p class="text-xs text-muted-foreground">
            Saldo atual em contas · separado da projeção
          </p>
          <p class="text-xl font-semibold">{display(currentBalance)}</p>
        </div>
        {#if projectionError}<div role="alert" class="space-y-2 text-sm">
            <p>{projectionError}</p>
            <Button
              size="sm"
              variant="outline"
              onclick={() => load(month)}
              disabled={loading || !!saving}>Recarregar projeção</Button
            >
          </div>
        {:else if projection}
          {#if projection.assumptions.basedOn === 0}<p
              role="status"
              class="rounded-lg bg-muted/50 p-4 text-sm"
            >
              Histórico insuficiente: não há meses completos com despesas para
              estimar renda e gastos. Sobra projetada não calculada; zero não
              seria uma estimativa confiável.
            </p>
          {:else}
            {#if projection.assumptions.basedOn < 3}<p
                role="status"
                class="rounded-lg bg-muted/50 p-3 text-sm"
              >
                Histórico parcial: {projection.assumptions.basedOn} mês(es) com despesas
                sustentam as médias. A projeção pode mudar bastante com novos dados.
              </p>{/if}
            {#if projection.assumptions.income === 0}<p
                class="text-sm text-muted-foreground"
              >
                A renda estimada é zero. Isso pode ocorrer em meses sem receita
                ou com poucas fontes identificadas; confira o histórico antes de
                assumir um aporte.
              </p>{/if}
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <caption class="sr-only"
                  >Projeção dos próximos seis meses calculada pelo Go</caption
                ><thead
                  ><tr class="border-b text-xs text-muted-foreground"
                    ><th class="p-2 font-medium">Mês</th><th
                      class="p-2 text-right font-medium">Gastos estimados</th
                    ><th class="p-2 text-right font-medium">Sobra estimada</th
                    ></tr
                  ></thead
                ><tbody
                  >{#each projection.months as entry}<tr
                      class="border-b last:border-0"
                      ><th scope="row" class="p-2 font-normal"
                        >{monthLabel(entry.month)}</th
                      ><td class="whitespace-nowrap p-2 text-right"
                        >{display(
                          entry.fixed + entry.variable + entry.installment
                        )}</td
                      ><td class="whitespace-nowrap p-2 text-right font-medium"
                        >{display(projectedRemainder(projection, entry))}</td
                      ></tr
                    >{/each}</tbody
                >
              </table>
            </div>
          {/if}
          <details class="rounded-lg border p-4" open>
            <summary class="cursor-pointer text-sm font-medium"
              >Premissas usadas pelo Go</summary
            >
            <div
              class="mt-3 space-y-3 text-xs leading-relaxed text-muted-foreground"
            >
              <dl class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <dt>Renda mensal estimada</dt>
                  <dd class="text-sm text-foreground">
                    {projection.assumptions.basedOn > 0
                      ? display(projection.assumptions.income)
                      : 'Sem histórico'}
                  </dd>
                </div>
                <div>
                  <dt>Média de fixas</dt>
                  <dd class="text-sm text-foreground">
                    {projection.assumptions.basedOn > 0
                      ? display(projection.assumptions.fixed)
                      : 'Sem histórico'}
                  </dd>
                </div>
                <div>
                  <dt>Média de variáveis</dt>
                  <dd class="text-sm text-foreground">
                    {projection.assumptions.basedOn > 0
                      ? display(projection.assumptions.variable)
                      : 'Sem histórico'}
                  </dd>
                </div>
              </dl>
              <p>
                Fixas e variáveis usam os últimos até três meses completos com
                despesas. A renda usa a mediana de até seis meses com despesas
                (meses sem receita contam como zero), com as fontes recorrentes
                identificadas como piso. Essa regra reduz o efeito de entradas
                atípicas, mas renda irregular continua incerta.
              </p>
              <p>
                As parcelas conhecidas variam por mês. Outras compras, mudanças
                de renda e compromissos ainda não registrados podem alterar a
                sobra. Os saldos atuais não são somados à renda projetada.
              </p>
              {#if projection.assumptions.incomeSources.length > 0}<ul
                  class="space-y-1"
                >
                  {#each projection.assumptions.incomeSources as source}<li
                      class="flex justify-between gap-3"
                    >
                      <span class="break-words">{source.label}</span><span
                        class="whitespace-nowrap"
                        >{display(source.monthly)}</span
                      >
                    </li>{/each}
                </ul>{/if}
            </div>
          </details>
        {:else if !loading}<p class="text-sm text-muted-foreground">
            Projeção indisponível. Atualize os dados para tentar novamente.
          </p>{/if}
      </Card.Content></Card.Root
    >
    <p class="text-xs text-muted-foreground">
      Este orçamento organiza classes e estima a sobra. Limites de gasto por
      categoria ainda não estão disponíveis. Consulte a agenda para compromissos
      registrados e confira o que não entrou no histórico.
    </p>
  {/if}
</div>

<style>
  select {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--background);
    padding: 0.6rem 0.75rem;
    color: inherit;
  }
  select:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
</style>
