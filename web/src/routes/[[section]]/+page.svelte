<script lang="ts">
  import type { PageProps } from './$types';
  import Icon from '#lib/Icon.svelte';
  import SpendingCharts from '#lib/components/SpendingCharts.svelte';
  import InvestmentPortfolio from '#lib/components/InvestmentPortfolio.svelte';
  import SpendingAnalysis from '#lib/components/SpendingAnalysis.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { money, monthLabel, shiftMonth, percent } from '#lib/finance.js';
  let { data }: PageProps = $props();
  let d = $derived(data.dashboard);
  let hidden = $state(false);
  let search = $state('');
  let category = $state('');
  let syncing = $state(false);
  let syncMessage = $state('');
  async function synchronize() {
    syncing = true;
    syncMessage = '';
    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Não foi possível atualizar.');
      location.reload();
    } catch (error) {
      syncMessage =
        error instanceof Error ? error.message : 'Falha de conexão.';
      syncing = false;
    }
  }
  const colors = [
    '#56866d',
    '#a6bb8c',
    '#dabd7d',
    '#93b7bc',
    '#c29eab',
    '#a9a5bf'
  ];
  const nav = [
    ['', 'Visão geral', 'grid'],
    ['transacoes', 'Transações', 'arrows'],
    ['analise', 'Análise de gastos', 'chart'],
    ['investimentos', 'Investimentos', 'wallet'],
    ['orcamento', 'Orçamento', 'chart'],
    ['metas', 'Metas', 'target'],
    ['conexoes', 'Contas e conexões', 'bank']
  ];
  let title = $derived(
    nav.find((n) => n[0] === data.section)?.[1] ?? 'Visão geral'
  );
  let filtered = $derived(
    d.transactions.items.filter(
      (t) =>
        (!category || t.categoryLabel === category) &&
        `${t.description} ${t.categoryLabel}`
          .toLocaleLowerCase('pt-BR')
          .includes(search.toLocaleLowerCase('pt-BR'))
    )
  );
  let categories = $derived([
    ...new Set(d.transactions.items.map((t) => t.categoryLabel))
  ]);
  let available = $derived(
    d.summary.current.income - d.summary.current.expense
  );
  const display = (n: number) =>
    d.mode === 'unconfigured' ? '—' : hidden ? '••••••' : money(n);
  function exportCSV() {
    const cell = (v: unknown) => {
      const s = String(v);
      return '"' + s.replace(/^[=+@-]/, "'").replaceAll('"', '""') + '"';
    };
    const content =
      '\uFEFF' +
      [
        ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor'],
        ...filtered.map((t) => [
          t.date,
          t.description,
          t.categoryLabel,
          t.kind,
          t.amount.toFixed(2)
        ])
      ]
        .map((row) => row.map(cell).join(';'))
        .join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob([content], { type: 'text/csv;charset=utf-8' })
    );
    a.download = `finassist-${d.month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function logout() {
    await fetch('/api/logout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    location.href = '/login';
  }
</script>

<svelte:head
  ><title>{title} · FinAssist</title><meta
    name="description"
    content="Seu dinheiro com mais clareza. Acompanhe contas, despesas e metas em um só lugar."
  /></svelte:head
>

<div class="app-shell">
  <aside class="sidebar">
    <a class="brand" href="/"
      ><span class="brand-symbol">f<span>↗</span></span>finassist<span
        class="brand-dot">.</span
      ></a
    >
    <div class="workspace-label">SEU ESPAÇO FINANCEIRO</div>
    <nav aria-label="Menu principal">
      {#each nav as [path, label, icon]}<a
          href={`/${path}?month=${d.month}`}
          class:active={data.section === path}
          ><Icon name={icon} /><span>{label}</span
          >{#if path === data.section}<span class="nav-dot"></span>{/if}</a
        >{/each}
    </nav>
    <div class="sidebar-bottom">
      <div class="privacy-icon"><Icon name="check" size={16} /></div>
      <strong>Mais controle. Mais tranquilidade.</strong>
      <p>Um espaço para entender seu dinheiro e planejar o que vem a seguir.</p>
      <a
        class="source-link"
        href="https://github.com/lzAmaral/finassist-web"
        target="_blank"
        rel="noreferrer">Código aberto, feito para evoluir ↗</a
      >
    </div>
    <div class="profile">
      <span class="avatar">{d.mode === 'unconfigured' ? 'F' : 'L'}</span>
      <div>
        <strong>Meu espaço</strong><small
          >{d.mode === 'unconfigured'
            ? 'Conexão pendente'
            : 'Sessão autenticada'}</small
        >
      </div>
      {#if d.mode === 'live'}<button
          class="icon-button"
          onclick={logout}
          aria-label="Sair"><Icon name="logout" size={17} /></button
        >{/if}
    </div>
  </aside>

  <main>
    <header class="topbar">
      <div>
        <span class="breadcrumb">Meu espaço <span>/</span> {title}</span>
      </div>
      <div class="topbar-right">
        {#if d.mode === 'live'}<Button
            variant="ghost"
            size="icon"
            onclick={() => (hidden = !hidden)}
            aria-label={hidden ? 'Mostrar valores' : 'Ocultar valores'}
            ><Icon name="eye" size={18} /></Button
          >{/if}
        <span class="status-pill"
          ><span></span>{d.mode === 'unconfigured'
            ? 'Aguardando conexão'
            : 'Contas conectadas'}</span
        ><span class="avatar small"
          >{d.mode === 'unconfigured' ? 'F' : 'L'}</span
        >
      </div>
    </header>
    <div class="main-content">
      <div class="page-heading">
        <div>
          <span class="eyebrow">UM OLHAR PARA O SEU DINHEIRO</span>
          <h1>{title}</h1>
          <p>
            {data.section === 'investimentos'
              ? 'Seu patrimônio, com uma visão de conjunto.'
              : data.section === 'analise'
                ? 'Transforme movimentações em decisões mais conscientes.'
                : data.section === 'transacoes'
                  ? 'Cada movimento, no seu lugar.'
                  : data.section === 'metas'
                    ? 'Pequenos passos para os seus próximos planos.'
                    : data.section === 'conexoes'
                      ? 'Suas contas, reunidas em um só lugar.'
                      : data.section === 'orcamento'
                        ? 'Entenda o que é fixo e o que varia no seu mês.'
                        : 'Seu mês com mais clareza, do saldo aos próximos planos.'}
          </p>
        </div>
        <div class="month-picker">
          <a
            aria-label="Mês anterior"
            href={`/${data.section}?month=${shiftMonth(d.month, -1)}`}>‹</a
          ><span>{monthLabel(d.month)}</span><a
            aria-label="Próximo mês"
            href={`/${data.section}?month=${shiftMonth(d.month, 1)}`}>›</a
          >
        </div>
      </div>
      {#if d.mode === 'unconfigured'}<div class="connection-banner">
          <span
            ><strong>Seu painel está pronto para receber seus dados.</strong> Conecte
            sua instalação e seus bancos para acompanhar saldos e gastos.</span
          ><a href="/conexoes">Como conectar meus bancos <span>↗</span></a>
        </div>{/if}
      {#if d.source === 'pluggy'}
        <div class="connection-banner">
          <span
            ><strong>Suas contas estão conectadas.</strong> Dados consultados em {new Date(
              d.syncedAt!
            ).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. A
            atualização bancária depende da Pluggy.</span
          >
          <Button variant="outline" onclick={synchronize} disabled={syncing}
            >{syncing ? 'Atualizando…' : 'Atualizar dados'}</Button
          >
        </div>
        {#if data.section !== 'investimentos'}<p class="fine-print">
          Resumo de movimentações confirmadas. Transferências entre suas contas,
          aplicações e pagamentos de fatura ficam fora das entradas e saídas.
          Pendências aparecem na lista.
        </p>{/if}
        {#if syncMessage}<p class="error" role="alert">{syncMessage}</p>{/if}
      {/if}

      {#if data.section === ''}
        <section class="metrics" aria-label="Resumo financeiro">
          <article class="metric balance-metric">
            <div class="metric-label">
              Saldo nas contas <Icon name="wallet" size={18} />
            </div>
            <div class="metric-value">
              {d.summary.bankBalance === null
                ? 'Sem contas'
                : display(d.summary.bankBalance)}
            </div>
            <div class="metric-foot">
              <span class="tiny-dot"></span>{d.mode === 'unconfigured'
                ? 'Aguardando suas contas'
                : `${d.balances.institutions.length} contas conectadas`}
            </div>
            <span class="balance-decoration" aria-hidden="true">↗</span>
          </article>
          <article class="metric">
            <div class="metric-label">
              Entradas do mês <span class="metric-icon green"
                ><Icon name="down" size={17} /></span
              >
            </div>
            <div class="metric-value">{display(d.summary.current.income)}</div>
            <div class="metric-foot">Tudo o que entrou neste mês</div>
          </article>
          <article class="metric">
            <div class="metric-label">
              Saídas do mês <span class="metric-icon peach"
                ><Icon name="up" size={17} /></span
              >
            </div>
            <div class="metric-value">{display(d.summary.current.expense)}</div>
            <div class="metric-foot">Despesas registradas no período</div>
          </article>
          <article class="metric">
            <div class="metric-label">
              Sobra do mês <span class="metric-icon pale"
                ><Icon name="wallet" size={17} /></span
              >
            </div>
            <div class="metric-value">{display(available)}</div>
            <div class="metric-foot">Entradas menos saídas</div>
          </article>
        </section>
        {#if d.mode === 'live'}<SpendingCharts
            dashboard={d}
            {hidden}
          />{:else}<section
            class="panel empty-state"
            style="margin-bottom:23px"
          >
            <h2>Ainda não há dados financeiros</h2>
            <p style="margin:12px 0 20px">
              Seus gráficos aparecerão após conectar suas contas e sincronizar
              as primeiras movimentações.
            </p>
            <a class="primary-button" href="/conexoes"
              >Como conectar meus bancos →</a
            >
          </section>{/if}
      {/if}

      {#if data.section === 'investimentos'}
        {#if data.portfolio}<InvestmentPortfolio
            portfolio={data.portfolio}
            {hidden}
            month={d.month}
          />
        {:else}<section class="panel empty-state">
            Conecte a versão cloud para cadastrar e acompanhar seus
            investimentos.
          </section>{/if}
      {/if}
      {#if data.section === 'analise'}
        {#if d.mode === 'live'}<SpendingAnalysis
            dashboard={d}
            ai={data.ai ?? null}
            {hidden}
          />
        {:else}<section class="panel empty-state">
            Conecte suas contas para analisar seus gastos.
          </section>{/if}
      {/if}
      {#if data.section === '' || data.section === 'transacoes'}
        <section class="panel transactions-panel">
          <div class="panel-heading">
            <div>
              <h2>
                {data.section === ''
                  ? 'Últimas movimentações'
                  : 'Suas transações'}
              </h2>
              <p>
                {d.transactions.total} lançamentos no período{d.transactions
                  .total > d.transactions.items.length
                  ? ` · exibindo os ${d.transactions.items.length} mais recentes`
                  : ''}
              </p>
            </div>
            {#if data.section === ''}<a
                class="text-link"
                href={`/transacoes?month=${d.month}`}
                >Ver todas <span>↗</span></a
              >{:else}<button
                class="secondary-button"
                onclick={exportCSV}
                disabled={filtered.length === 0}
                ><Icon name="download" size={16} />Exportar CSV</button
              >{/if}
          </div>
          {#if data.section === 'transacoes'}<div class="filters">
              <label class="search-field"
                ><Icon name="search" size={18} /><input
                  aria-label="Buscar transações"
                  bind:value={search}
                  placeholder="Buscar uma movimentação..."
                /></label
              ><select aria-label="Filtrar por categoria" bind:value={category}
                ><option value="">Todas as categorias</option
                >{#each categories as c}<option>{c}</option>{/each}</select
              ><span class="filter-count"
                >{filtered.length}
                {filtered.length === 1 ? 'resultado' : 'resultados'}</span
              >
            </div>{/if}
          <div class="table-scroll">
            <table>
              <thead
                ><tr
                  ><th>Movimentação</th><th>Categoria</th><th>Conta</th><th
                    >Data</th
                  ><th class="align-right">Valor</th></tr
                ></thead
              ><tbody
                >{#each data.section === '' ? filtered.slice(0, 5) : filtered as t}<tr
                    ><td
                      ><span
                        class:income-tx={t.kind === 'INCOME'}
                        class="transaction-icon"
                        ><Icon
                          name={t.kind === 'INCOME' ? 'down' : 'up'}
                          size={17}
                        /></span
                      ><span class="transaction-description"
                        >{t.description}<small
                          >{t.kind === 'TRANSFER'
                            ? 'Transferência'
                            : t.kind === 'INCOME'
                              ? 'Receita'
                              : t.paymentMethodLabel}{t.status === 'PENDING'
                            ? ' · Pendente'
                            : ''}</small
                        ></span
                      ></td
                    ><td
                      ><span class="category-chip">{t.categoryLabel}</span></td
                    ><td class="muted">{t.accountName || 'Manual'}</td><td
                      class="muted"
                      >{t.date.slice(8, 10)}/{t.date.slice(5, 7)}</td
                    ><td
                      class:green-text={t.kind === 'INCOME'}
                      class="align-right amount"
                      >{t.kind === 'INCOME'
                        ? '+'
                        : t.kind === 'EXPENSE'
                          ? '−'
                          : ''}
                      {display(t.amount)}</td
                    ></tr
                  >{:else}<tr
                    ><td colspan="5" class="empty-state"
                      >Nenhuma movimentação encontrada neste período.</td
                    ></tr
                  >{/each}</tbody
              >
            </table>
          </div>
        </section>
      {/if}

      {#if data.section === 'orcamento'}<section class="panel">
          <div class="panel-heading">
            <div>
              <h2>Compromissos do mês</h2>
              <p>Classificação calculada pelo backend na conexão real</p>
            </div>
            <span class="subtle-tag">{d.budget.items.length} despesas</span>
          </div>
          <div class="budget-list">
            {#each d.budget.items as item}<div class="budget-row">
                <span class="transaction-icon"
                  ><Icon name="wallet" size={18} /></span
                >
                <div>
                  <strong>{item.label}</strong><small
                    >{item.categoryLabel}</small
                  >
                </div>
                <span class="category-chip"
                  >{item.class === 'FIXED'
                    ? 'Fixa'
                    : item.class === 'INSTALLMENT'
                      ? 'Parcelada'
                      : 'Variável'}</span
                ><span class="paid-status"
                  >{item.paid ? 'Pago' : 'Pendente'}</span
                ><strong>{display(item.total)}</strong>
              </div>{:else}<p class="empty-state">
                As despesas aparecerão aqui após registrar ou sincronizar
                transações.
              </p>{/each}
          </div>
        </section>{/if}
      {#if data.section === 'metas'}<div class="goals-grid">
          {#each d.goals.goals as goal}<article class="panel goal-card">
              <span class="goal-icon"><Icon name="target" size={26} /></span
              ><span class="subtle-tag"
                >{goal.done ? 'Concluída' : 'Em andamento'}</span
              >
              <h2>{goal.name}</h2>
              <p>Cada passo conta para chegar lá.</p>
              <div class="goal-amount">
                {display(goal.current)} <small>de {display(goal.target)}</small>
              </div>
              <div class="progress-track">
                <div
                  style={`width:${percent(goal.current, goal.target)}%`}
                ></div>
              </div>
              <div class="goal-bottom">
                <span
                  >{percent(goal.current, goal.target).toFixed(0)}% do objetivo</span
                ><Icon name="target" size={17} />
              </div>
            </article>{:else}<div class="panel empty-state">
              Você ainda não tem metas cadastradas. Crie sua primeira meta no
              painel original.
            </div>{/each}
        </div>{/if}
      {#if data.section === 'conexoes'}<div class="connections-grid">
          <section class="panel">
            <div class="panel-heading">
              <div>
                <h2>Minhas contas</h2>
                <p>
                  {d.mode === 'unconfigured'
                    ? 'Nenhuma conexão configurada'
                    : d.source === 'pluggy'
                      ? 'Saldos bancários em reais · cartões fora do saldo disponível'
                      : 'Dados recebidos da sua API'}
                </p>
              </div>
              <Icon name="bank" />
            </div>
            {#if d.source === 'pluggy'}
              {#each d.balances.institutions as bank}<div class="bank-row">
                  <span class="bank-logo"><Icon name="bank" size={25} /></span>
                  <div>
                    <strong>{bank.name}</strong><small
                      >{bank.stale
                        ? 'Banco com atualização pendente'
                        : 'Conectada à Pluggy'}</small
                    >
                  </div>
                  <strong
                    >{bank.accounts[0]
                      ? display(bank.accounts[0].balance)
                      : '—'}</strong
                  >
                </div>{/each}
              <p class="fine-print">
                O valor de um cartão representa sua fatura, não dinheiro
                disponível. Investimentos não estão incluídos no saldo das
                contas.
              </p>
            {:else}
              {#each d.balances.institutions as bank, i}<div class="bank-row">
                  <span
                    class="bank-logo"
                    style={`background:${i % 2 ? '#ece7f2' : '#e3eee5'};color:${i % 2 ? '#79638d' : '#56866d'}`}
                    ><Icon name="bank" size={25} /></span
                  >
                  <div>
                    <strong>{bank.name}</strong><small
                      >{bank.accounts.length} conta(s) · {bank.stale
                        ? 'Atualização pendente'
                        : 'Sincronizada'}</small
                    >
                  </div>
                  <strong
                    >{bank.total === null ? '—' : display(bank.total)}</strong
                  >
                </div>{:else}<div class="empty-state">
                  Nenhuma conta conectada.
                </div>{/each}
            {/if}
          </section>
          <section class="panel connect-guide">
            <span class="goal-icon"><Icon name="link" size={26} /></span>
            <h2>Seus bancos, mais perto.</h2>
            <p>
              O FinAssist lê seus dados pelo Meu Pluggy. A autorização acontece
              no banco e as credenciais de integração ficam no backend.
            </p>
            {#if d.source === 'pluggy'}
              <p>
                Suas contas autorizadas já estão sendo consultadas. Use
                “Atualizar dados” para buscar a versão mais recente disponível
                na Pluggy.
              </p>
            {:else}<ol>
                <li>Conecte suas contas no Meu Pluggy.</li>
                <li>Configure a integração na instalação original.</li>
                <li>Aponte esta interface para a API do FinAssist.</li>
              </ol>{/if}
            <a
              class="primary-button"
              href="https://meu.pluggy.ai"
              target="_blank"
              rel="noreferrer">Abrir Meu Pluggy <span>↗</span></a
            ><a
              class="text-link"
              href="https://github.com/lzAmaral/finassist-web/tree/main/web"
              target="_blank"
              rel="noreferrer">Ver instruções de conexão ↗</a
            >
            <p class="fine-print">
              {d.mode === 'unconfigured'
                ? 'Suas contas ainda não estão conectadas.'
                : d.source === 'pluggy'
                  ? 'Conexões existentes são atualizadas automaticamente todos os dias.'
                  : 'Novas conexões são configuradas no painel original.'}
            </p>
          </section>
        </div>{/if}
      <footer>
        <span
          >finassist. <span class="footer-divider">/</span> Mais clareza para o que
          importa.</span
        ><span
          >Feito para evoluir com você <span class="green-text">✳</span></span
        >
      </footer>
    </div>
  </main>
</div>
