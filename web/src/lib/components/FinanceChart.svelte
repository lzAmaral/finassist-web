<script lang="ts">
  import { AreaChart, BarChart, PieChart } from 'layerchart';
  import { scaleBand, scalePoint } from 'd3-scale';
  import * as Chart from '#lib/components/ui/chart/index.js';
  import { money } from '#lib/finance.js';
  let {
    kind = 'bars',
    rows,
    series,
    hidden = false,
    label = 'Gráfico financeiro'
  }: {
    kind?: 'bars' | 'area' | 'donut';
    rows: Record<string, string | number>[];
    series: { key: string; label: string; color: string }[];
    hidden?: boolean;
    label?: string;
  } = $props();
  let config = $derived(
    Object.fromEntries(
      series.map((s) => [s.key, { label: s.label, color: s.color }])
    )
  );
  const colors = [
    '#32785a',
    '#88b6a1',
    '#e0ae69',
    '#759bc2',
    '#ab94be',
    '#d28b82',
    '#a9b875'
  ];
</script>

<div class="w-full min-w-0" role="group" aria-label={label}>
  {#if rows.length === 0}<div
      class="flex h-[260px] items-center justify-center text-sm text-muted-foreground"
    >
      Sem dados neste período.
    </div>
  {:else}
    <Chart.Container {config} class="h-[270px] w-full aspect-auto">
      {#if kind === 'donut'}
        <PieChart
          data={rows}
          key="label"
          value="value"
          label="label"
          c="label"
          cRange={colors}
          innerRadius={0.72}
          padAngle={0.02}
          cornerRadius={3}
          pointerEvents={!hidden}
        >
          {#snippet tooltip()}<Chart.Tooltip hideLabel
              >{#snippet formatter({ value, name })}<div
                  class="flex min-w-36 justify-between gap-5"
                >
                  <span>{name}</span><strong
                    >{hidden ? '••••' : money(Number(value))}</strong
                  >
                </div>{/snippet}</Chart.Tooltip
            >{/snippet}
        </PieChart>
      {:else if kind === 'area'}
        <AreaChart
          data={rows}
          x="label"
          xScale={scalePoint()}
          {series}
          seriesLayout="overlap"
          axis="x"
          legend
          pointerEvents={!hidden}
          props={{
            xAxis: { format: (v) => String(v), ticks: 6 },
            area: { opacity: 0.15 },
            spline: { strokeWidth: 2.5 }
          }}
        >
          {#snippet tooltip()}<Chart.Tooltip
              >{#snippet formatter({ value, name })}<div
                  class="flex min-w-36 justify-between gap-5"
                >
                  <span>{name}</span><strong
                    >{hidden ? '••••' : money(Number(value))}</strong
                  >
                </div>{/snippet}</Chart.Tooltip
            >{/snippet}
        </AreaChart>
      {:else}
        <BarChart
          data={rows}
          x="label"
          xScale={scaleBand().padding(0.35)}
          {series}
          seriesLayout="group"
          axis="x"
          legend
          pointerEvents={!hidden}
          props={{ bars: { radius: 5 }, xAxis: { format: (v) => String(v) } }}
        >
          {#snippet tooltip()}<Chart.Tooltip
              >{#snippet formatter({ value, name })}<div
                  class="flex min-w-36 justify-between gap-5"
                >
                  <span>{name}</span><strong
                    >{hidden ? '••••' : money(Number(value))}</strong
                  >
                </div>{/snippet}</Chart.Tooltip
            >{/snippet}
        </BarChart>
      {/if}
    </Chart.Container>
  {/if}
</div>
