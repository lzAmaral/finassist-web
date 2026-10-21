<script lang="ts">
  import type { Dashboard } from '#lib/finance.js';
  import type { dashboardState } from '#lib/dashboard-state.js';
  import { Button } from '#lib/components/ui/button/index.js';

  let {
    app,
    dashboard,
    section,
    syncing,
    syncMessage,
    synchronize
  }: {
    app: ReturnType<typeof dashboardState>;
    dashboard: Dashboard;
    section: string;
    syncing: boolean;
    syncMessage: string;
    synchronize: () => Promise<void>;
  } = $props();
  let ready = $derived(app.status === 'ready');
  let connected = $derived(ready && dashboard.balances.institutions.length > 0);
  let hasMovements = $derived(ready && dashboard.transactions.total > 0);
</script>

<section
  class="onboarding panel"
  aria-labelledby="onboarding-title"
  aria-busy={syncing}
>
  <div>
    <h2 id="onboarding-title">
      {app.status === 'unconfigured'
        ? 'Conecte seu espaço financeiro'
        : app.status === 'first-sync'
          ? 'Vamos buscar seu primeiro resumo'
          : app.status === 'error'
            ? 'Seus dados estão temporariamente indisponíveis'
            : hasMovements
              ? 'Seu resumo está pronto para revisar'
              : connected
                ? 'Suas contas já estão no resumo'
                : 'Comece conectando suas contas'}
    </h2>
    <p>
      {app.status === 'unconfigured'
        ? 'A conexão com sua instalação ainda precisa ser configurada. Os valores aparecerão quando houver dados reais.'
        : app.status === 'first-sync'
          ? 'Você já entrou com segurança. A primeira consulta às contas autorizadas ainda não foi concluída.'
          : app.status === 'error'
            ? 'Não conseguimos ler os dados agora. Recarregue para tentar novamente; valores indisponíveis não representam saldo zero.'
            : hasMovements
              ? 'Veja as movimentações do mês e escolha um gasto para conferir.'
              : connected
                ? 'Não há movimentações neste mês. Você pode consultar outro mês pelo seletor acima.'
                : 'A instalação respondeu, mas ainda não há contas no resumo. Confira a autorização e a integração dos seus bancos.'}
    </p>
    <ol aria-label="Caminho até seu primeiro resumo">
      <li>
        <span aria-hidden="true">{connected ? '✓' : '1'}</span>Conectar contas{connected
          ? ' — concluído'
          : ''}
      </li>
      <li>
        <span aria-hidden="true">{ready ? '✓' : '2'}</span>Ver primeiro resumo{ready
          ? ' — disponível'
          : ''}
      </li>
      <li>
        <span aria-hidden="true">3</span>Revisar um gasto{hasMovements
          ? ' — disponível'
          : ''}
      </li>
    </ol>
  </div>
  <div class="onboarding-action">
    {#if app.status === 'first-sync'}
      <Button onclick={synchronize} disabled={syncing}
        >{syncing
          ? 'Buscando seus dados…'
          : syncMessage
            ? 'Tentar sincronizar novamente'
            : 'Buscar meus dados'}</Button
      >
    {:else if app.status === 'error'}
      <a class="primary-button" href={`/${section}?month=${dashboard.month}`}
        >Tentar carregar novamente</a
      >
    {:else if hasMovements}
      <a class="primary-button" href={`/transacoes?month=${dashboard.month}`}
        >Revisar um gasto →</a
      >
    {:else}
      <a
        class="primary-button"
        href={section === 'conexoes'
          ? '#connection-guide'
          : '/conexoes#connection-guide'}>Ver como conectar →</a
      >
    {/if}
    {#if syncing}<p role="status">
        A consulta pode levar alguns minutos. Aguarde nesta página.
      </p>{/if}
    {#if syncMessage}<p class="error" role="alert">{syncMessage}</p>{/if}
  </div>
</section>

<style>
  .onboarding {
    padding: 24px;
    margin-bottom: 24px;
    display: flex;
    gap: 24px;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    font-size: 20px;
    margin: 0 0 10px;
  }
  p {
    line-height: 1.6;
    max-width: 65ch;
    margin: 0 0 16px;
  }
  ol {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 12px 20px;
    padding: 0;
    margin: 0;
    font-size: 12px;
  }
  li {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  li span {
    border: 1px solid currentColor;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: inline-grid;
    place-items: center;
    flex-shrink: 0;
  }
  .onboarding-action {
    flex-shrink: 0;
    max-width: 280px;
  }
  .onboarding-action p {
    margin: 12px 0 0;
    font-size: 13px;
  }
  a:focus-visible {
    outline: 3px solid #56866d;
    outline-offset: 4px;
  }
  @media (max-width: 800px) {
    .onboarding {
      align-items: stretch;
      flex-direction: column;
      padding: 20px;
    }
    ol {
      flex-direction: column;
    }
    .onboarding-action {
      max-width: none;
    }
    .primary-button {
      display: block;
      text-align: center;
    }
  }
</style>
