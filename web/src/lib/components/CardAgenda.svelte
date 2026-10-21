<script lang="ts">
  import { money } from '#lib/finance.js';
  import {
    agendaDate,
    agendaWindows,
    inAgendaWindow,
    type AgendaWindow,
    type CardAgendaData
  } from '#lib/card-agenda.js';
  import * as Card from '#lib/components/ui/card/index.js';
  import { Button } from '#lib/components/ui/button/index.js';
  import { Badge } from '#lib/components/ui/badge/index.js';

  let {
    data,
    unavailableReason = '',
    hidden = false,
    onretry
  }: {
    data: CardAgendaData | null;
    unavailableReason?: string;
    hidden?: boolean;
    onretry?: () => void;
  } = $props();
  let window = $state<AgendaWindow>('next30');
  const display = (value: number | null) =>
    value === null ? 'Não informado' : hidden ? '••••••' : money(value);
  let commitments = $derived(
    data?.commitments.filter((c) => inAgendaWindow(c, window, data.today)) ?? []
  );
  let total = $derived(data?.totals[window]);
  const updated = (value: string | null) =>
    value && Number.isFinite(Date.parse(value))
      ? new Date(value).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo'
        })
      : 'Não informada';
</script>

<div class="space-y-5">
  {#if !data}
    <Card.Root class="shadow-none"
      ><Card.Header><Card.Title>Cartões e agenda</Card.Title></Card.Header
      ><Card.Content class="space-y-3">
        <p role="status" class="text-sm text-muted-foreground">
          {unavailableReason ||
            'Não foi possível carregar cartões e compromissos.'}
        </p>
        {#if onretry}<Button variant="outline" onclick={onretry}
            >Tentar novamente</Button
          >{/if}
      </Card.Content></Card.Root
    >
  {:else}
    {#if data.excludedCurrencies}<p class="text-sm text-muted-foreground">
        {data.excludedCurrencies} cartão(ões) em moeda diferente ou não informada
        foram excluídos dos valores em reais.
      </p>{/if}
    <section aria-label="Seus cartões" class="space-y-3">
      <div>
        <h2 class="text-lg font-semibold">Seus cartões</h2>
        <p class="text-sm text-muted-foreground">
          Saldo devedor informado pela instituição. Em Open Finance pode incluir
          parcelas futuras no limite usado.
        </p>
      </div>
      {#if data.cards.length === 0}
        <p class="rounded-lg border p-5 text-sm text-muted-foreground">
          Nenhum cartão disponível nesta fonte de dados.
        </p>
      {:else}
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {#each data.cards as card (card.id)}
            <Card.Root class="min-w-0 gap-4 shadow-none"
              ><Card.Header>
                <Card.Title class="break-words"
                  >{card.name}{card.last4 ? ` · ${card.last4}` : ''}</Card.Title
                >
                {#if card.brand}<Card.Description>{card.brand}</Card.Description
                  >{/if}
              </Card.Header><Card.Content class="space-y-4">
                <div>
                  <p class="text-xs text-muted-foreground">
                    Saldo devedor / limite usado
                  </p>
                  <p class="text-2xl font-semibold">
                    {display(card.debtBalance)}
                  </p>
                </div>
                <dl class="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt class="text-muted-foreground">Limite</dt>
                    <dd>{display(card.creditLimit)}</dd>
                  </div>
                  <div>
                    <dt class="text-muted-foreground">Disponível</dt>
                    <dd>{display(card.availableCreditLimit)}</dd>
                  </div>
                  <div>
                    <dt class="text-muted-foreground">Fechamento informado</dt>
                    <dd>{agendaDate(card.closeDate)}</dd>
                  </div>
                  <div>
                    <dt class="text-muted-foreground">Vencimento informado</dt>
                    <dd>{agendaDate(card.dueDate)}</dd>
                  </div>
                </dl>
                <div class="rounded-md bg-muted/50 p-3 text-xs">
                  <strong>Fatura e quitação: não informadas</strong>
                  <p class="mt-1 text-muted-foreground">
                    {data.invoiceUnavailableReason}
                  </p>
                </div>
                {#if card.installments.length > 0}
                  <details class="text-sm">
                    <summary class="cursor-pointer font-medium"
                      >Parcelas registradas ({card.installments
                        .length})</summary
                    >
                    <p class="my-2 text-xs text-muted-foreground">
                      Datas de referência das compras em até 30 dias. A postagem
                      da compra não confirma o pagamento da fatura. Estes
                      valores ficam fora da soma da agenda.
                    </p>
                    <ul class="space-y-2">
                      {#each card.installments as installment (installment.id)}
                        <li
                          class="flex items-start justify-between gap-2 border-t pt-2"
                        >
                          <div class="min-w-0">
                            <span class="break-words"
                              >{installment.description}</span
                            ><span class="block text-xs text-muted-foreground"
                              >Referência: {agendaDate(
                                installment.referenceDate
                              )}</span
                            >
                          </div>
                          <span class="whitespace-nowrap"
                            >{display(installment.amount)}</span
                          >
                        </li>
                      {/each}
                    </ul>
                  </details>
                {/if}
                <p class="text-xs text-muted-foreground">
                  Origem: {data.source === 'go-postgres'
                    ? 'Open Finance · backend Go'
                    : 'Open Finance · snapshot cloud'}<br />Atualização da
                  fonte: {updated(card.sourceUpdatedAt)}<br />Cópia no app: {updated(
                    card.copiedAt
                  )}
                </p>
              </Card.Content></Card.Root
            >
          {/each}
        </div>
      {/if}
    </section>
    <Card.Root class="gap-4 shadow-none"
      ><Card.Header
        ><Card.Title>Agenda de compromissos</Card.Title><Card.Description
          >Hoje: {agendaDate(data.today)} · horário de São Paulo. Valores em conta
          e saldos de cartão ficam fora desta soma.</Card.Description
        ></Card.Header
      ><Card.Content class="space-y-4">
        {#if !data.agendaAvailable}
          <p role="status" class="text-sm text-muted-foreground">
            {data.unavailableReason}
          </p>
        {:else}
          <div
            class="flex flex-wrap gap-2"
            aria-label="Período dos compromissos"
          >
            {#each agendaWindows as option}<Button
                variant={window === option.key ? 'default' : 'outline'}
                size="sm"
                aria-pressed={window === option.key}
                onclick={() => (window = option.key)}>{option.label}</Button
              >{/each}
          </div>
          {#if total}<div
              class="flex flex-wrap gap-x-8 gap-y-2 rounded-lg border p-4"
              aria-live="polite"
            >
              <div>
                <p class="text-xs text-muted-foreground">
                  Registrado, sem estimativas
                </p>
                <p class="text-xl font-semibold">{display(total.confirmed)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">
                  Estimativas separadas
                </p>
                <p class="text-xl font-semibold">{display(total.estimated)}</p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Compromissos</p>
                <p class="text-xl font-semibold">{total.count}</p>
              </div>
            </div>{/if}
          <p class="text-xs text-muted-foreground">
            Próximos 7 e 30 dias são janelas alternativas, sem incluir hoje. A
            agenda reúne pendências manuais e estimativas de recorrências
            cadastradas; movimentações bancárias não viram contas a pagar. Datas
            de parcelas manuais são previsões do cadastro.
          </p>
          {#if commitments.length === 0}<p
              class="py-5 text-sm text-muted-foreground"
            >
              Nenhum compromisso registrado neste período. Isso não confirma
              ausência de contas a pagar.
            </p>
          {:else}<ul class="divide-y">
              {#each commitments as commitment (commitment.id)}
                <li
                  class="flex flex-wrap items-start justify-between gap-3 py-4"
                >
                  <div class="min-w-0 flex-1">
                    <p class="break-words text-sm font-medium">
                      {commitment.description}
                    </p>
                    <p class="mt-1 text-xs text-muted-foreground">
                      Vencimento: {agendaDate(commitment.dueDate)} · {commitment.source ===
                      'manual-recurring-estimate'
                        ? 'Recorrência cadastrada'
                        : commitment.source === 'manual-installment-schedule'
                          ? 'Parcelamento cadastrado'
                          : 'Pagamento cadastrado'}
                    </p>
                    <div class="mt-2 flex flex-wrap gap-2">
                      <Badge
                        variant={commitment.status === 'OVERDUE'
                          ? 'destructive'
                          : 'outline'}
                        >{commitment.status === 'OVERDUE'
                          ? 'Vencido · sem confirmação'
                          : 'Pendente'}</Badge
                      >{#if commitment.estimated}<Badge variant="secondary"
                          >Estimativa</Badge
                        >{/if}
                    </div>
                  </div>
                  <strong class="whitespace-nowrap text-sm"
                    >{display(commitment.amount)}</strong
                  >
                </li>
              {/each}
            </ul>{/if}
          <p class="text-xs text-muted-foreground">
            A passagem da data não confirma pagamento. A confirmação depende do
            registro de pagamento e da conciliação no backend Go; esta tela é de
            consulta.
          </p>
        {/if}
      </Card.Content></Card.Root
    >
  {/if}
</div>
