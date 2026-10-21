<script lang="ts">
  import type { Dashboard } from '#lib/finance.js';
  import { money } from '#lib/finance.js';
  import * as Card from '#lib/components/ui/card/index.js';
  import * as Tabs from '#lib/components/ui/tabs/index.js';
  import { Badge } from '#lib/components/ui/badge/index.js';
  import FinanceChart from './FinanceChart.svelte';
  let {
    dashboard: d,
    hidden = false
  }: { dashboard: Dashboard; hidden?: boolean } = $props();
  let period = $state('monthly');
  let monthly = $derived(
    d.series.map((p) => ({
      label: new Date(`${p.month}-15T12:00:00Z`)
        .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
        .replace('.', ''),
      income: p.income,
      expense: p.expense
    }))
  );
  let daily = $derived(
    (d.daily ?? []).map((p) => ({
      label: p.day.slice(8, 10),
      income: p.income,
      expense: p.expense
    }))
  );
  const series = [
    { key: 'income', label: 'Entradas', color: '#32785a' },
    { key: 'expense', label: 'Saídas', color: '#d69b72' }
  ];
  const colors = [
    '#32785a',
    '#88b6a1',
    '#e0ae69',
    '#759bc2',
    '#ab94be',
    '#d28b82'
  ];
  const display = (value: number) => (hidden ? '••••••' : money(value));
</script>

<div class="grid min-w-0 gap-5 xl:grid-cols-[1.6fr_1fr] mb-5">
  <Card.Root class="min-w-0 shadow-none">
    <Card.Header class="flex flex-row items-start justify-between gap-3">
      <div>
        <Card.Title>Fluxo do seu dinheiro</Card.Title><Card.Description
          class="mt-1.5"
          >Compare entradas e saídas confirmadas.</Card.Description
        >
      </div>
      <Badge variant="secondary"
        >{period === 'monthly' ? '6 meses' : 'Acumulado'}</Badge
      >
    </Card.Header>
    <Card.Content>
      <Tabs.Root bind:value={period}>
        <Tabs.List class="mb-5"
          ><Tabs.Trigger value="monthly">Mês a mês</Tabs.Trigger><Tabs.Trigger
            value="daily">Neste mês</Tabs.Trigger
          ></Tabs.List
        >
        <Tabs.Content value="monthly"
          ><FinanceChart
            rows={monthly}
            {series}
            {hidden}
            label="Entradas e saídas nos últimos seis meses"
          /></Tabs.Content
        >
        <Tabs.Content value="daily"
          ><FinanceChart
            rows={daily}
            {series}
            {hidden}
            kind="area"
            label="Entradas e saídas acumuladas ao longo do mês"
          /></Tabs.Content
        >
      </Tabs.Root>
      <p class="mt-4 text-xs text-muted-foreground">
        Passe sobre o gráfico para ver valores. Clique na legenda para comparar
        as séries.
      </p>
    </Card.Content>
  </Card.Root>
  <Card.Root class="min-w-0 shadow-none">
    <Card.Header
      ><Card.Title>Onde você gastou</Card.Title><Card.Description
        >Categorias das despesas neste mês.</Card.Description
      ></Card.Header
    >
    <Card.Content>
      <div class="relative">
        <FinanceChart
          rows={d.breakdown.map((p) => ({ label: p.label, value: p.total }))}
          series={[{ key: 'value', label: 'Despesas', color: '#32785a' }]}
          kind="donut"
          {hidden}
          label="Distribuição das despesas por categoria"
        />
        {#if d.breakdown.length}<div
            class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
          >
            <span class="text-xs text-muted-foreground">Despesas</span><strong
              class="mt-1 text-lg tracking-tight"
              >{display(d.summary.current.expense)}</strong
            >
          </div>{/if}
      </div>
      <div class="mt-3 space-y-2.5">
        {#each d.breakdown.slice(0, 5) as item, i}<div
            class="flex items-center justify-between gap-3 text-xs"
          >
            <span class="flex min-w-0 items-center gap-2"
              ><i
                class="size-2 shrink-0 rounded-full"
                style={`background:${colors[i % colors.length]}`}
              ></i><span class="truncate">{item.label}</span></span
            ><strong class="shrink-0 font-medium">{display(item.total)}</strong>
          </div>{/each}
      </div>
    </Card.Content>
  </Card.Root>
</div>
