<script lang="ts">
  import type { Dashboard } from '#lib/finance.js';
  import { money } from '#lib/finance.js';
  import {
    compareSpendingPeriods,
    type PreviousSpendingPeriod
  } from '#lib/spending-comparison.js';
  import * as Card from '#lib/components/ui/card/index.js';

  let {
    dashboard,
    previous,
    referenceDate,
    hidden = false
  }: {
    dashboard: Dashboard;
    previous: PreviousSpendingPeriod | null;
    referenceDate: string;
    hidden?: boolean;
  } = $props();

  const comparison = $derived(
    compareSpendingPeriods(dashboard, previous, referenceDate)
  );
  const display = (amount: number) => (hidden ? '••••••' : money(amount));
  const signedMoney = (amount: number) =>
    hidden ? '••••••' : `${amount > 0 ? '+' : ''}${money(amount)}`;
  const dateLabel = (date: string) => date.split('-').reverse().join('/');
  const unavailableMessages = {
    configuration: 'Conecte os dados financeiros para comparar os períodos.',
    'invalid-month': 'O mês selecionado é inválido. Escolha outro período.',
    'invalid-reference-date':
      'A data de referência não está disponível. Recarregue a página.',
    'previous-unavailable':
      'Não foi possível carregar os lançamentos do mês anterior.',
    'previous-month':
      'A base anterior não corresponde ao mês selecionado. Recarregue a página.',
    'missing-list':
      'Uma das listas de lançamentos está ausente. Recarregue a página.',
    'partial-list':
      'Uma das listas de lançamentos está incompleta. Recarregue a página para tentar novamente.',
    'duplicate-id':
      'Uma das listas contém lançamentos duplicados. Recarregue a página para conferir a base.',
    'invalid-transaction':
      'Há dados de lançamentos inválidos na base. Recarregue a página para tentar novamente.',
    'unsafe-total':
      'Os valores disponíveis não permitem calcular uma comparação precisa.',
    'missing-sync':
      'A data da última consulta dos dados das contas está ausente ou inválida. Sincronize as contas e recarregue a página.',
    'stale-sync':
      'A última consulta dos dados das contas é anterior ao início deste mês. Sincronize as contas e recarregue a página.'
  };
</script>

<Card.Root class="mb-5 min-w-0 shadow-none">
  <Card.Header>
    <Card.Title>Gastos em comparação</Card.Title>
    <Card.Description
      >Despesas confirmadas nos lançamentos disponíveis.</Card.Description
    >
  </Card.Header>
  <Card.Content class="space-y-4">
    {#if comparison.status === 'unavailable'}
      <p role="status" class="text-sm text-muted-foreground">
        {unavailableMessages[comparison.reason]}
      </p>
    {:else if comparison.status === 'future'}
      <p role="status" class="text-sm text-muted-foreground">
        O período selecionado ainda não começou. Escolha o mês atual ou um mês
        passado para comparar.
      </p>
    {:else}
      <p class="text-sm text-muted-foreground">
        {comparison.period === 'equivalent-days'
          ? 'Mesmo número de dias nos dois meses.'
          : 'Dois meses completos, que podem ter durações diferentes.'}
        {#if comparison.syncLimited}O corte foi reduzido à data da última
          consulta dos dados das contas.{/if}
      </p>
      <dl class="grid min-w-0 gap-4 sm:grid-cols-2">
        {#each [{ label: 'Mês selecionado', window: comparison.current }, { label: 'Mês anterior', window: comparison.previous }] as period}
          <div class="min-w-0 rounded-lg border p-3">
            <dt class="text-sm font-medium">{period.label}</dt>
            <dd class="mt-1 text-xs text-muted-foreground">
              {dateLabel(period.window.start)} a {dateLabel(period.window.end)}
            </dd>
            <dd class="mt-3 break-words text-xl font-semibold tracking-tight">
              {display(period.window.amount)}
            </dd>
          </div>
        {/each}
      </dl>
      <div class="space-y-1 text-sm">
        <p>
          Diferença: <strong class="break-words"
            >{signedMoney(comparison.delta)}</strong
          >
        </p>
        {#if comparison.status === 'empty'}
          <p class="text-muted-foreground">
            Sem base de despesas confirmadas para comparar. Uma das janelas não
            possui despesas confirmadas disponíveis; isso não comprova ausência
            de gastos.
          </p>
        {:else if comparison.percentage === null}
          <p class="text-muted-foreground">
            Sem base positiva para percentual.
          </p>
        {:else}
          <p>
            Variação: <strong
              >{hidden
                ? '••••'
                : `${comparison.percentage > 0 ? '+' : ''}${comparison.percentage.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}</strong
            >
          </p>
        {/if}
      </div>
      {#if dashboard.source === 'pluggy'}
        <p class="text-xs text-muted-foreground">
          Última consulta dos dados das contas: {comparison.consultedOn
            ? dateLabel(comparison.consultedOn)
            : 'data indisponível'}.
        </p>
      {/if}
    {/if}
    <p class="text-xs leading-relaxed text-muted-foreground">
      Comparação dos lançamentos disponíveis; sincronização não comprova
      cobertura completa. Entram apenas despesas confirmadas, incluindo estornos
      que reduzem seu total.
    </p>
    <a
      href={`/analise?month=${encodeURIComponent(dashboard.month)}`}
      data-sveltekit-reload
      class="inline-block text-sm font-medium underline underline-offset-4"
      >Recarregar comparação</a
    >
  </Card.Content>
</Card.Root>
