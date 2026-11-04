import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDashboardPage } from '../src/lib/server/dashboard-page.ts';
import { emptyDashboard } from '../src/lib/server/empty.ts';

const month = '2026-10';
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status });
const dashboard = {
  ...emptyDashboard(month),
  mode: 'live',
  source: 'pluggy',
  syncedAt: '2026-10-21T12:00:00Z'
};
const load = (options) =>
  loadDashboardPage({ month, section: '', mode: 'cloud', ...options });

test('sem configuração não consulta API nem apresenta dados como zero real', async () => {
  const result = await load({
    mode: 'unconfigured',
    fetchAPI: () => assert.fail('não deve consultar')
  });
  assert.equal(result.app.status, 'unconfigured');
  assert.equal(result.app.authenticated, false);
  assert.equal(result.dashboard.mode, 'unconfigured');
  assert.equal(result.dashboard.summary.bankBalance, null);
  assert.equal(result.app.capabilities.budget, false);
});

test('primeiro snapshot pendente mantém sessão e permite primeira sincronização cloud', async () => {
  const calls = [];
  const result = await load({
    fetchAPI: async (path) => {
      calls.push(path);
      return path === 'me'
        ? json({ authenticated: true })
        : json({ code: 'snapshot_pending' }, 503);
    }
  });
  assert.deepEqual(calls, ['me', `dashboard?month=${month}`]);
  assert.equal(result.app.status, 'first-sync');
  assert.equal(result.app.authenticated, true);
  assert.equal(result.app.capabilities.sync, true);
  assert.equal(result.dashboard.mode, 'unconfigured');
  assert.equal(result.redirectTo, '');
});

test('falha de armazenamento e indisponibilidade sem código não simulam primeiro uso', async () => {
  for (const status of [502, 503]) {
    const result = await load({
      fetchAPI: async (path) =>
        path === 'me' ? json({}) : json({ error: 'indisponível' }, status)
    });
    assert.equal(result.app.status, 'error');
    assert.equal(result.app.authenticated, true);
    assert.equal(result.dashboard.mode, 'unconfigured');
  }
});

test('sessão expirada e instalação sem setup preservam redirecionamentos', async () => {
  for (const [status, destination] of [
    [401, '/login'],
    [409, '/setup']
  ]) {
    const result = await load({ fetchAPI: async () => json({}, status) });
    assert.equal(result.redirectTo, destination);
    assert.equal(result.app.authenticated, false);
  }
});

test('falha de rede mantém a página recuperável e sem recursos financeiros falsos', async () => {
  const result = await load({
    fetchAPI: async () => {
      throw new Error('offline');
    }
  });
  assert.equal(result.app.status, 'error');
  assert.equal(result.dashboard.mode, 'unconfigured');
  assert.equal(result.app.authenticated, false);
});

test('snapshot existente fica pronto mesmo quando não há movimentos; planejamento cloud continua indisponível', async () => {
  const result = await load({
    fetchAPI: async (path) => json(path === 'me' ? {} : dashboard)
  });
  assert.equal(result.app.status, 'ready');
  assert.equal(result.dashboard.mode, 'live');
  assert.equal(result.dashboard.transactions.total, 0);
  assert.equal(result.app.capabilities.budget, false);
  assert.equal(result.app.capabilities.goals, false);
});

test('falha opcional de carteira preserva resumo e oferece erro específico', async () => {
  const result = await load({
    section: 'investimentos',
    fetchAPI: async (path) => {
      if (path === 'me') return json({});
      if (path.startsWith('dashboard')) return json(dashboard);
      return json({}, 502);
    }
  });
  assert.equal(result.app.status, 'ready');
  assert.equal(result.dashboard.mode, 'live');
  assert.ok(result.featureError);
  assert.equal(result.portfolio, null);
});

test('modo Go usa dados completos e não promove ausência de integração bancária a primeira sincronização', async () => {
  const result = await load({
    mode: 'go',
    fetchAPI: async (path) => {
      const resource = path.split('?')[0];
      const values = {
        me: {},
        summary: dashboard.summary,
        transactions: { items: [], total: 0, page: 1, limit: 100 },
        breakdown: [],
        timeseries: [],
        balances: dashboard.balances,
        budget: dashboard.budget,
        goals: dashboard.goals
      };
      return json(values[resource]);
    }
  });
  assert.equal(result.app.status, 'ready');
  assert.equal(result.app.capabilities.budget, true);
  assert.equal(result.app.capabilities.goals, true);
  assert.equal(result.app.capabilities.investments, false);
  const failed = await load({
    mode: 'go',
    fetchAPI: async (path) => (path === 'me' ? json({}) : json({}, 503))
  });
  assert.equal(failed.app.status, 'error');
});

test('Go consulta recursos companion somente com armazenamento privado configurado', async () => {
  const calls = [];
  const result = await load({
    mode: 'go',
    privateStorage: true,
    section: 'analise',
    fetchAPI: async (path) => {
      calls.push(path);
      const resource = path.split('?')[0];
      const values = {
        me: {},
        summary: dashboard.summary,
        transactions: { items: [], total: 0, page: 1, limit: 100 },
        breakdown: [],
        timeseries: [],
        balances: dashboard.balances,
        budget: dashboard.budget,
        goals: dashboard.goals,
        analysis: { configured: false, analysis: null, model: 'modelo' }
      };
      return json(values[resource]);
    }
  });
  assert.equal(result.app.status, 'ready');
  assert.equal(result.app.capabilities.analysis, true);
  assert.ok(calls.includes(`analysis?month=${month}`));
  assert.equal(result.ai.configured, false);
});

test('análise cloud carrega o mês anterior e usa uma data de referência estável', async () => {
  const calls = [];
  const previous = { ...dashboard, month: '2026-09' };
  const result = await load({
    section: 'analise',
    referenceDate: '2026-10-21',
    fetchAPI: async (path) => {
      calls.push(path);
      if (path === 'me') return json({});
      if (path === 'dashboard?month=2026-09') return json(previous);
      if (path.startsWith('dashboard')) return json(dashboard);
      return json({ configured: false, analysis: null });
    }
  });
  assert.equal(result.referenceDate, '2026-10-21');
  assert.equal(result.previousSpending.month, '2026-09');
  assert.deepEqual(result.previousSpending.transactions, previous.transactions);
  assert.equal(result.comparisonError, '');
  assert.ok(calls.includes('analysis?month=2026-10'));
});

test('falha do histórico não impede a análise opcional nem apaga o mês atual', async () => {
  const result = await load({
    section: 'analise',
    referenceDate: '2026-10-21',
    fetchAPI: async (path) => {
      if (path === 'me') return json({});
      if (path === 'dashboard?month=2026-09') return json({}, 502);
      if (path.startsWith('dashboard')) return json(dashboard);
      return json({ configured: false, analysis: null });
    }
  });
  assert.equal(result.app.status, 'ready');
  assert.equal(result.dashboard.month, month);
  assert.equal(result.previousSpending, null);
  assert.ok(result.comparisonError);
  assert.equal(result.featureError, '');
  assert.equal(result.ai.configured, false);
});

test('histórico só é consultado na análise de meses que já começaram', async () => {
  for (const [section, selected] of [
    ['', month],
    ['transacoes', month],
    ['analise', '2026-11']
  ]) {
    const calls = [];
    await load({
      section,
      month: selected,
      referenceDate: '2026-10-21',
      fetchAPI: async (path) => {
        calls.push(path);
        return json(path === 'me' ? {} : { ...dashboard, month: selected });
      }
    });
    assert.equal(
      calls.filter((path) => path.startsWith('dashboard?')).length,
      1
    );
  }
});

test('sessão expirada ao ler histórico redireciona e não consulta recursos seguintes', async () => {
  const calls = [];
  const result = await load({
    section: 'analise',
    referenceDate: '2026-10-21',
    fetchAPI: async (path) => {
      calls.push(path);
      if (path === 'me') return json({});
      return path.endsWith('2026-09') ? json({}, 401) : json(dashboard);
    }
  });
  assert.equal(result.redirectTo, '/login');
  assert.equal(
    calls.some((path) => path.startsWith('analysis?')),
    false
  );
});

test('histórico Go percorre todas as páginas e rejeita resultado parcial', async () => {
  const entries = Array.from({ length: 101 }, (_, i) => ({
    id: `anterior-${i}`
  }));
  for (const failSecond of [false, true]) {
    const result = await load({
      mode: 'go',
      section: 'analise',
      referenceDate: '2026-10-21',
      fetchAPI: async (path) => {
        const resource = path.split('?')[0];
        if (resource === 'transactions' && path.includes('2026-09')) {
          const page = Number(
            new URLSearchParams(path.split('?')[1]).get('page')
          );
          if (failSecond && page === 2) return json({}, 502);
          return json({
            items: entries.slice((page - 1) * 100, page * 100),
            total: 101,
            limit: 100,
            page
          });
        }
        const values = {
          me: {},
          summary: dashboard.summary,
          transactions: { items: [], total: 0, page: 1, limit: 100 },
          breakdown: [],
          timeseries: [],
          balances: dashboard.balances,
          budget: dashboard.budget,
          goals: dashboard.goals
        };
        return json(values[resource]);
      }
    });
    assert.equal(result.app.status, 'ready');
    if (failSecond) {
      assert.equal(result.previousSpending, null);
      assert.ok(result.comparisonError);
    } else {
      assert.equal(result.previousSpending.transactions.items.length, 101);
      assert.equal(result.previousSpending.month, '2026-09');
    }
  }
});
