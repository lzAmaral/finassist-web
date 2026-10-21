<script lang="ts">
  import type { Portfolio } from '#lib/investments.js';
  import {
    assetColors,
    assetGroups,
    dividendHistory,
    positionSummary
  } from '#lib/portfolio-presentation.js';
  import { money } from '#lib/finance.js';
  import {
    Wallet,
    TrendingUp,
    Coins,
    ChartNoAxesCombined,
    ArrowUpRight,
    ArrowDownRight,
    CalendarDays
  } from '@lucide/svelte';
  import FinanceChart from './FinanceChart.svelte';

  let {
    portfolio: p,
    hidden = false,
    month
  }: { portfolio: Portfolio; hidden?: boolean; month: string } = $props();
  let months = $state(12);
  let assetFilter = $state('all');
  let summary = $derived(positionSummary(p.positions));
  let groups = $derived(
    assetGroups(p.positions)
      .filter((group) => group.total > 0)
      .sort((a, b) => b.total - a.total)
  );
  let dividends = $derived(
    p.dividends.filter(
      (dividend) =>
        assetFilter === 'all' ||
        [...p.positions, ...p.archived].some(
          (position) =>
            position.id === dividend.positionId &&
            position.assetClass === assetFilter
        )
    )
  );
  let history = $derived(dividendHistory(dividends, month, months));
  let trailingDividends = $derived(
    dividendHistory(p.dividends, month, 12).reduce(
      (total, item) => total + item.total,
      0
    )
  );
  let totalDividends = $derived(
    p.dividends
      .filter((item) => !item.archived && item.date.slice(0, 7) <= month)
      .reduce((total, item) => total + item.amount, 0)
  );
  const display = (value: number | null) =>
    hidden ? '••••••' : value === null ? '—' : money(value);
  const percentage = (value: number | null) =>
    hidden
      ? '••••'
      : value === null
        ? '—'
        : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
</script>

<section class="investment-stats" aria-label="Resumo da carteira">
  <article class="investment-stat">
    <div class="investment-stat-label">
      <span class="investment-stat-icon"><Wallet size={20} /></span>
      <h2>Patrimônio total</h2>
    </div>
    <strong class="investment-stat-value">{display(summary.total)}</strong>
    <div class="investment-stat-footer">
      <span>Valor investido conhecido</span><b
        >{summary.covered ? display(summary.cost) : '—'}</b
      >
    </div>
  </article>
  <article class="investment-stat">
    <div class="investment-stat-label">
      <span class="investment-stat-icon"><TrendingUp size={20} /></span>
      <h2>Ganho de capital</h2>
    </div>
    <strong
      class="investment-stat-value"
      class:investment-positive={summary.gain !== null && summary.gain >= 0}
      class:investment-negative={summary.gain !== null && summary.gain < 0}
      >{display(summary.gain)}</strong
    >
    <div class="investment-stat-footer">
      <span>Saldo atual − custo informado</span><small
        >{summary.covered} de {summary.count} ativos com custo conhecido</small
      >
    </div>
  </article>
  <article class="investment-stat">
    <div class="investment-stat-label">
      <span class="investment-stat-icon"><Coins size={20} /></span>
      <h2>Proventos recebidos (12M)</h2>
    </div>
    <strong class="investment-stat-value">{display(trailingDividends)}</strong>
    <div class="investment-stat-footer">
      <span>Total registrado até {month.slice(5)}/{month.slice(0, 4)}</span><b
        >{display(totalDividends)}</b
      >
    </div>
  </article>
  <article class="investment-stat">
    <div class="investment-stat-label">
      <span class="investment-stat-icon"><ChartNoAxesCombined size={20} /></span
      >
      <h2>Variação sobre o custo</h2>
    </div>
    <div class="investment-stat-value">
      <span
        class="investment-return"
        class:negative={summary.change !== null && summary.change < 0}
        class:unavailable={summary.change === null}
        >{percentage(
          summary.change
        )}{#if summary.change !== null && !hidden}{#if summary.change < 0}<ArrowDownRight
              size={19}
            />{:else}<ArrowUpRight size={19} />{/if}{/if}</span
      >
    </div>
    <div class="investment-stat-footer">
      <span>Posições com custo conhecido</span><small
        >Não inclui proventos ou efeito do tempo</small
      >
    </div>
  </article>
</section>

<div class="investment-charts">
  <section class="investment-panel" aria-labelledby="dividend-chart-title">
    <div class="investment-panel-heading">
      <h2 id="dividend-chart-title">Evolução dos proventos</h2>
      <div class="investment-chart-filters">
        <label class="investment-select"
          ><CalendarDays size={16} /><select
            aria-label="Período dos proventos"
            bind:value={months}
            ><option value={6}>Últimos 6 meses</option><option value={12}
              >Últimos 12 meses</option
            ><option value={24}>Últimos 24 meses</option></select
          ></label
        >
        <select
          class="field-select"
          aria-label="Classe dos proventos"
          bind:value={assetFilter}
          ><option value="all">Todos os tipos</option
          >{#each assetGroups( [...p.positions, ...p.archived] ).filter((group) => group.count) as group}<option
              value={group.key}>{group.label}</option
            >{/each}</select
        >
      </div>
    </div>
    <div class="investment-chart-body">
      {#if history.some((item) => item.total > 0)}
        <FinanceChart
          rows={history}
          series={[
            { key: 'total', label: 'Proventos recebidos', color: '#2cba7c' }
          ]}
          {hidden}
          label="Proventos recebidos por mês"
        />
      {:else}
        <div class="investment-chart-empty">
          <div class="investment-empty-bars" aria-hidden="true">
            {#each [28, 44, 35, 62, 49, 80, 65, 96] as height}<span
                style={`height:${height}px`}
              ></span>{/each}
          </div>
          <strong>Seus rendimentos, mês a mês</strong>
          <p>Nenhum provento registrado neste período.</p>
        </div>
      {/if}
      <p class="investment-chart-note">
        Pagamentos registrados até {month.slice(5)}/{month.slice(0, 4)}. O
        histórico de patrimônio ainda não está disponível.
      </p>
      {#if history.some((item) => item.total > 0)}<details
          class="investment-chart-data"
        >
          <summary>Ver valores por mês</summary>
          <table class="portfolio-table">
            <thead><tr><th>Mês</th><th>Proventos</th></tr></thead><tbody
              >{#each history as row}<tr
                  ><td>{row.label}</td><td>{display(row.total)}</td></tr
                >{/each}</tbody
            >
          </table>
        </details>{/if}
    </div>
  </section>
  <section class="investment-panel" aria-labelledby="allocation-chart-title">
    <div class="investment-panel-heading">
      <h2 id="allocation-chart-title">Ativos na carteira</h2>
      <span class="investment-panel-meta">Valor atual</span>
    </div>
    <div class="investment-allocation">
      {#if groups.length}
        <div class="investment-donut">
          <FinanceChart
            rows={groups.map((group) => ({
              label: group.label,
              value: group.total
            }))}
            series={[{ key: 'value', label: 'Patrimônio', color: '#35a1d3' }]}
            palette={groups.map((group) => assetColors[group.key])}
            kind="donut"
            {hidden}
            label="Distribuição atual da carteira por classe"
          />
          <div class="investment-donut-center" aria-hidden="true">
            <strong>{summary.count}</strong><span>ativos</span>
          </div>
        </div>
        <ul class="investment-allocation-legend">
          {#each groups as group}<li>
              <span
                ><i style={`background:${assetColors[group.key]}`}
                ></i>{group.label}</span
              ><strong>{percentage(group.percentage)}</strong>
            </li>{/each}
        </ul>
      {:else}
        <div class="investment-chart-empty">
          <div class="investment-empty-donut" aria-hidden="true"></div>
          <strong>Sua carteira começa aqui</strong>
          <p>Adicione um investimento para ver a distribuição.</p>
        </div>
      {/if}
    </div>
  </section>
</div>
