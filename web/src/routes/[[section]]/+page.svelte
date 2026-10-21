<script lang="ts">
  import { goto } from '$app/navigation';
  import type { PageProps } from './$types';
  import Icon from '#lib/Icon.svelte';
  import SpendingCharts from '#lib/components/SpendingCharts.svelte';
  import InvestmentPortfolio from '#lib/components/InvestmentPortfolio.svelte';
  import TransactionActivity from '#lib/components/TransactionActivity.svelte';
  import SpendingAnalysis from '#lib/components/SpendingAnalysis.svelte';
  import SpendingReview from '#lib/components/SpendingReview.svelte';
  import ImportStatements from '#lib/components/ImportStatements.svelte';
  import NotificationCenter from '#lib/components/NotificationCenter.svelte';
  import FinanceQuestions from '#lib/components/FinanceQuestions.svelte';
  import GoalsManager from '#lib/components/GoalsManager.svelte';
  import BudgetPlanner from '#lib/components/BudgetPlanner.svelte';
  import CategoryReview from '#lib/components/CategoryReview.svelte';
  import CardAgenda from '#lib/components/CardAgenda.svelte';
  import DashboardOnboarding from '#lib/components/DashboardOnboarding.svelte';
  import { Button } from '#lib/components/ui/button/index.js';
  import { money, monthLabel, shiftMonth } from '#lib/finance.js';
  let { data }: PageProps = $props();
  let d = $derived(data.dashboard);
  let ready = $derived(data.app.status === 'ready');
  let hidden = $state(false);
  let syncing = $state(false);
  let syncMessage = $state('');
  async function synchronize() {
    syncing = true;
    syncMessage = '';
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      });
      if (response.status === 401) {
        location.href = '/login';
        return;
      }
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
    ['cartoes', 'Cartões e agenda', 'wallet'],
    ['classificar', 'Classificar gastos', 'arrows'],
    ['revisao', 'Revisão de gastos', 'check'],
    ['notificacoes', 'Notificações', 'check'],
    ['importar', 'Importar extrato', 'arrows'],
    ['perguntas', 'Perguntas', 'chart'],
    ['conexoes', 'Contas e conexões', 'bank']
  ];
  let title = $derived(
    nav.find((n) => n[0] === data.section)?.[1] ?? 'Visão geral'
  );
  let available = $derived(
    d.summary.current.income - d.summary.current.expense
  );
  const display = (n: number) =>
    d.mode === 'unconfigured' ? '—' : hidden ? '••••••' : money(n);
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

<a class="skip-to-content" href="#main-content">Ir para o conteúdo</a>
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
          aria-label={label}
          title={label}
          aria-current={data.section === path ? 'page' : undefined}
          class:active={data.section === path}
          ><Icon name={icon} /><span>{label}</span
          >{#if path === data.section}<span class="nav-dot"></span>{/if}</a
        >{/each}
    </nav>
    <div class="mobile-navigation">
      <label for="mobile-section">Ir para</label>
      <select
        id="mobile-section"
        aria-label="Navegar entre páginas"
        value={data.section}
        onchange={(event) =>
          goto(`/${event.currentTarget.value}?month=${d.month}`)}
      >
        {#each nav as [path, label]}<option value={path}>{label}</option>{/each}
      </select>
      {#if data.app.authenticated}<button
          class="icon-button"
          onclick={logout}
          aria-label="Sair"><Icon name="logout" size={18} /></button
        >{/if}
    </div>
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
          >{data.app.authenticated
            ? 'Sessão autenticada'
            : 'Conexão pendente'}</small
        >
      </div>
      {#if data.app.authenticated}<button
          class="icon-button"
          onclick={logout}
          aria-label="Sair"><Icon name="logout" size={17} /></button
        >{/if}
    </div>
  </aside>

  <main class:investment-page={data.section === 'investimentos'}>
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
          ><span></span>{data.app.status === 'unconfigured'
            ? 'Configuração pendente'
            : data.app.status === 'first-sync'
              ? 'Primeira consulta pendente'
              : data.app.status === 'error'
                ? 'Falha ao carregar'
                : 'Dados disponíveis'}</span
        ><span class="avatar small"
          >{d.mode === 'unconfigured' ? 'F' : 'L'}</span
        >
      </div>
    </header>
    <div class="main-content" id="main-content" tabindex="-1">
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
      {#if !ready || data.section === ''}
        <DashboardOnboarding
          app={data.app}
          dashboard={d}
          section={data.section}
          {syncing}
          syncMessage={ready ? '' : syncMessage}
          {synchronize}
        />
      {/if}
      {#if ready && d.source === 'pluggy'}
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
            Resumo de movimentações confirmadas. Transferências entre suas
            contas, aplicações e pagamentos de fatura ficam fora das entradas e
            saídas. Pendências aparecem na lista.
          </p>{/if}
        {#if syncMessage}<p class="error" role="alert">{syncMessage}</p>{/if}
      {/if}

      {#if ready && data.section === ''}
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
        <SpendingCharts dashboard={d} {hidden} />
        <SpendingReview
          available={data.app.mode === 'go'}
          month={d.month}
          {hidden}
          overview
        />
      {/if}

      {#if ready && data.section === 'revisao'}<SpendingReview
          available={data.app.mode === 'go'}
          month={d.month}
          {hidden}
        />{/if}
      {#if ready && data.section === 'notificacoes'}<NotificationCenter
          available={data.app.mode === 'go'}
          {hidden}
        />{/if}
      {#if ready && data.section === 'importar'}<ImportStatements
          available={data.app.mode === 'go'}
          {hidden}
        />{/if}
      {#if ready && data.section === 'perguntas'}<FinanceQuestions
          available={data.app.mode === 'go'}
          month={d.month}
          {hidden}
        />{/if}
      {#if ready && data.section === 'classificar'}<CategoryReview
          available={data.app.mode === 'go'}
          {hidden}
        />{/if}
      {#if ready && data.section === 'cartoes'}
        <CardAgenda
          data={data.agenda}
          unavailableReason={data.featureError}
          {hidden}
          onretry={() => location.reload()}
        />
      {/if}
      {#if ready && data.section === 'investimentos'}
        {#if data.portfolio}
          {#if data.app.mode === 'go'}<p class="fine-print">
              As posições bancárias desta carteira vêm da última consulta cloud,
              cuja data aparece abaixo. Elas não são somadas à carteira
              importada pela instalação; as posições manuais e os proventos
              permanecem disponíveis.
            </p>{/if}
          <InvestmentPortfolio
            portfolio={data.portfolio}
            {hidden}
            month={d.month}
          />
        {:else}<section class="panel empty-state">
            {data.featureError ||
              'O cadastro de investimentos precisa do armazenamento privado configurado nesta instalação.'}
            {#if data.featureError}<a href={`/investimentos?month=${d.month}`}
                >Tentar novamente</a
              >{/if}
          </section>{/if}
      {/if}
      {#if ready && data.section === 'analise'}
        {#if data.featureError}<p class="error" role="alert">
            {data.featureError}
            <a href={`/analise?month=${d.month}`}>Tentar novamente</a>
          </p>{/if}
        {#if d.mode === 'live'}<SpendingAnalysis
            dashboard={d}
            ai={data.ai ?? null}
            {hidden}
          />
        {:else}<section class="panel empty-state">
            Conecte suas contas para analisar seus gastos.
          </section>{/if}
      {/if}
      {#if ready && (data.section === '' || data.section === 'transacoes')}
        <TransactionActivity
          dashboard={d}
          overview={data.section === ''}
          editableCategories={data.app.mode === 'go'}
          {hidden}
        />
      {/if}

      {#if ready && data.section === 'orcamento'}
        <BudgetPlanner
          enabled={data.app.mode === 'go'}
          month={d.month}
          currentBalance={d.balances.totalInAccount}
          {hidden}
        />
      {/if}
      {#if ready && data.section === 'metas'}
        <GoalsManager enabled={data.app.mode === 'go'} {hidden} />
      {/if}
      {#if data.section === 'conexoes'}<div class="connections-grid">
          <section class="panel">
            <div class="panel-heading">
              <div>
                <h2>Minhas contas</h2>
                <p>
                  {!ready
                    ? 'Aguardando a consulta das contas'
                    : d.source === 'pluggy'
                      ? 'Saldos bancários em reais · cartões fora do saldo disponível'
                      : 'Dados recebidos da sua API'}
                </p>
              </div>
              <Icon name="bank" />
            </div>
            {#if !ready}<p class="empty-state">
                As contas serão apresentadas quando a consulta for concluída.
              </p>
            {:else if d.source === 'pluggy'}
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
          <section class="panel connect-guide" id="connection-guide">
            <span class="goal-icon"><Icon name="link" size={26} /></span>
            <h2>Seus bancos, mais perto.</h2>
            <p>
              O FinAssist lê seus dados pelo Meu Pluggy. A autorização acontece
              no banco e as credenciais de integração ficam no backend.
            </p>
            {#if data.app.mode === 'cloud'}
              <p>
                {ready
                  ? 'Use “Atualizar dados” para consultar a versão mais recente disponível na Pluggy.'
                  : 'Após autorizar as contas e configurar a instalação, use “Buscar meus dados” acima para concluir a primeira consulta.'}
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
              {data.app.status === 'unconfigured'
                ? 'A conexão com a instalação precisa ser configurada.'
                : d.source === 'pluggy'
                  ? 'Conexões existentes são atualizadas automaticamente todos os dias.'
                  : 'Novas conexões são configuradas no painel original.'}
            </p>
          </section>
          <section class="panel empty-state">
            <h2>O que você pode fazer aqui</h2>
            <p>
              {data.app.mode === 'unconfigured'
                ? 'Configure a conexão para consultar seus dados.'
                : 'Consulte o resumo do mês, busque movimentações e exporte o resultado em CSV.'}
            </p>
            {#if data.app.mode === 'cloud'}<p>
                Atualize suas contas por esta página. Orçamento e metas precisam
                da instalação completa do FinAssist.
              </p>
            {:else if data.app.mode === 'go'}<p>
                Orçamento e metas usam os dados da sua instalação. A conexão e a
                atualização dos bancos dependem da integração configurada nela.
              </p>{/if}
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

<style>
  .skip-to-content {
    position: fixed;
    top: 8px;
    left: 8px;
    z-index: 100;
    transform: translateY(-160%);
    padding: 12px;
    background: white;
    color: #243e30;
    border: 2px solid #56866d;
  }
  .skip-to-content:focus {
    transform: translateY(0);
  }
  :global(a:focus-visible),
  :global(button:focus-visible) {
    outline: 3px solid #56866d;
    outline-offset: 3px;
  }
</style>
