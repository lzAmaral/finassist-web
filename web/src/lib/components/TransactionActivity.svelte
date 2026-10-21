<script lang="ts">
  import type { Dashboard, Transaction } from '#lib/finance.js';
  import { money } from '#lib/finance.js';
  import {
    cashFlowTransactions,
    cashFlowSign,
    type CashFlow
  } from '#lib/transactions.js';
  import Icon from '#lib/Icon.svelte';
  import '#lib/transactions.css';

  let {
    dashboard: d,
    overview = false,
    hidden = false
  }: { dashboard: Dashboard; overview?: boolean; hidden?: boolean } = $props();
  let search = $state('');
  let category = $state('');
  let flow = $state<CashFlow>('all');
  let cashFlow = $derived(cashFlowTransactions(d.transactions.items));
  let incoming = $derived(
    cashFlow.filter((transaction) => transaction.kind === 'INCOME')
  );
  let outgoing = $derived(
    cashFlow.filter((transaction) => transaction.kind === 'EXPENSE')
  );
  let filtered = $derived(
    cashFlowTransactions(d.transactions.items, { search, category, flow })
  );
  let categories = $derived(
    [...new Set(cashFlow.map((transaction) => transaction.categoryLabel))].sort(
      (a, b) => a.localeCompare(b, 'pt-BR')
    )
  );
  const display = (value: number) =>
    d.mode === 'unconfigured' ? '—' : hidden ? '••••••' : money(value);
  const directions = [
    { value: 'all', label: 'Todas' },
    { value: 'INCOME', label: 'Entradas' },
    { value: 'EXPENSE', label: 'Saídas' }
  ] as const;

  function exportCSV() {
    const cell = (value: unknown) =>
      `"${String(value)
        .replace(/^[=+@-]/, "'")
        .replaceAll('"', '""')}"`;
    const content =
      '\uFEFF' +
      [
        ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor'],
        ...filtered.map((transaction) => [
          transaction.date,
          transaction.description,
          transaction.categoryLabel,
          transaction.kind,
          transaction.amount.toFixed(2)
        ])
      ]
        .map((row) => row.map(cell).join(';'))
        .join('\r\n');
    const url = URL.createObjectURL(
      new Blob([content], { type: 'text/csv;charset=utf-8' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `finassist-${d.month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

{#snippet amount(transaction: Transaction)}
  <span
    class="activity-amount"
    class:activity-positive={cashFlowSign(transaction) === '+'}
  >
    {#if !hidden && d.mode !== 'unconfigured'}{cashFlowSign(transaction)}
    {/if}{display(Math.abs(transaction.amount))}
  </span>
{/snippet}

{#snippet recent(items: Transaction[], direction: 'INCOME' | 'EXPENSE')}
  <ul
    class="activity-recent-list"
    aria-label={direction === 'INCOME' ? 'Últimas entradas' : 'Últimas saídas'}
  >
    {#each items.slice(0, 5) as transaction (transaction.id)}
      <li>
        <span class="activity-direction" class:incoming={direction === 'INCOME'}
          ><Icon
            name={direction === 'INCOME' || transaction.amount < 0
              ? 'down'
              : 'up'}
            size={18}
          /></span
        >
        <div class="activity-description">
          <strong>{transaction.description}</strong><small
            >{transaction.accountName || 'Manual'} · {transaction.date.slice(
              8,
              10
            )}/{transaction.date.slice(5, 7)}</small
          ><span class="activity-category"
            >{transaction.amount < 0 && direction === 'EXPENSE'
              ? 'Estorno · '
              : ''}{transaction.categoryLabel}{transaction.status === 'PENDING'
              ? ' · Pendente'
              : ''}</span
          >
        </div>
        {@render amount(transaction)}
      </li>
    {:else}<li class="activity-empty">
        {direction === 'INCOME'
          ? 'Nenhuma entrada neste período.'
          : 'Nenhuma saída neste período.'}
      </li>{/each}
  </ul>
{/snippet}

<section class="transaction-activity" aria-labelledby="activity-title">
  <div class="activity-heading">
    <div>
      <h2 id="activity-title">
        {overview ? 'Entradas e saídas' : 'Suas transações'}
      </h2>
      <p>
        {overview
          ? 'Acompanhe o que você recebeu e gastou no mês.'
          : `${cashFlow.length} entradas e saídas no período.`}
      </p>
    </div>
    {#if overview}<a class="text-link" href={`/transacoes?month=${d.month}`}
        >Ver todas <span>↗</span></a
      >{:else}<button
        class="secondary-button"
        onclick={exportCSV}
        disabled={!filtered.length}
        ><Icon name="download" size={16} />Exportar CSV</button
      >{/if}
  </div>
  <p class="activity-note">
    <Icon name="arrows" size={15} /><span
      >Transferências identificadas entre suas contas, aplicações e pagamentos
      de fatura ficam fora desta lista e dos totais de entradas e saídas. As
      compras do cartão entram nas saídas.</span
    >
  </p>
  {#if d.transactions.total > d.transactions.items.length}<p
      class="activity-partial"
      role="note"
    >
      Lista baseada nos {d.transactions.items.length} lançamentos mais recentes de
      {d.transactions.total} disponíveis no período. Os totais consideram o mês completo.
    </p>{/if}

  {#if overview}
    <div class="activity-columns">
      <section class="activity-card" aria-labelledby="incoming-title">
        <div class="activity-card-heading">
          <div>
            <span class="activity-section-label incoming"
              ><Icon name="down" size={17} />
              <h3 id="incoming-title">Entradas</h3></span
            ><strong class="activity-total incoming"
              >{display(d.summary.current.income)}</strong
            ><small>Receitas confirmadas no mês</small>
          </div>
          <span class="activity-count"
            >{incoming.length}
            {incoming.length === 1 ? 'entrada' : 'entradas'}</span
          >
        </div>
        {@render recent(incoming, 'INCOME')}
      </section>
      <section class="activity-card" aria-labelledby="outgoing-title">
        <div class="activity-card-heading">
          <div>
            <span class="activity-section-label"
              ><Icon name="up" size={17} />
              <h3 id="outgoing-title">Saídas</h3></span
            ><strong class="activity-total"
              >{display(d.summary.current.expense)}</strong
            ><small>Despesas confirmadas, descontando estornos</small>
          </div>
          <span class="activity-count"
            >{outgoing.length}
            {outgoing.length === 1 ? 'saída' : 'saídas'}</span
          >
        </div>
        {@render recent(outgoing, 'EXPENSE')}
      </section>
    </div>
  {:else}
    <div class="activity-card activity-full">
      <div class="activity-controls">
        <div
          class="activity-flow-filter"
          role="group"
          aria-label="Tipo de movimentação"
        >
          {#each directions as direction}<button
              type="button"
              aria-pressed={flow === direction.value}
              onclick={() => {
                flow = direction.value;
              }}>{direction.label}</button
            >{/each}
        </div>
        <div class="activity-search-filters">
          <label class="search-field"
            ><Icon name="search" size={18} /><input
              aria-label="Buscar transações"
              bind:value={search}
              placeholder="Buscar descrição ou conta…"
            /></label
          ><select
            aria-label="Filtrar por categoria"
            class="field-select"
            bind:value={category}
            ><option value="">Todas as categorias</option
            >{#each categories as item}<option>{item}</option>{/each}</select
          >
        </div>
        <p class="activity-result-count" aria-live="polite">
          {filtered.length}
          {filtered.length === 1 ? 'resultado' : 'resultados'}
        </p>
      </div>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (The scrolling table needs keyboard access.) -->
      <div
        class="table-scroll"
        role="region"
        aria-label="Entradas e saídas filtradas"
        tabindex="0"
      >
        <table class="activity-table">
          <thead
            ><tr
              ><th>Movimentação</th><th>Categoria</th><th>Conta</th><th>Data</th
              ><th class="align-right">Valor</th></tr
            ></thead
          ><tbody>
            {#each filtered as transaction (transaction.id)}<tr
                ><td
                  ><span
                    class="transaction-icon"
                    class:income-tx={transaction.kind === 'INCOME'}
                    ><Icon
                      name={cashFlowSign(transaction) === '+' ? 'down' : 'up'}
                      size={17}
                    /></span
                  ><span class="transaction-description"
                    >{transaction.description}<small
                      >{transaction.kind === 'INCOME'
                        ? 'Entrada'
                        : transaction.amount < 0
                          ? 'Estorno de despesa'
                          : 'Saída'} · {transaction.paymentMethodLabel}{transaction.status ===
                      'PENDING'
                        ? ' · Pendente'
                        : ''}</small
                    ></span
                  ></td
                ><td
                  ><span class="category-chip">{transaction.categoryLabel}</span
                  ></td
                ><td class="muted">{transaction.accountName || 'Manual'}</td><td
                  class="muted"
                  >{transaction.date.slice(8, 10)}/{transaction.date.slice(
                    5,
                    7
                  )}</td
                ><td class="align-right">{@render amount(transaction)}</td></tr
              >
            {:else}<tr
                ><td colspan="5" class="empty-state"
                  >Nenhuma movimentação encontrada para estes filtros.</td
                ></tr
              >{/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</section>
