import type { CardAgendaData } from '../card-agenda.js';
import type { Dashboard } from '../finance.js';
import { shiftMonth } from '../finance.ts';
import type { Portfolio } from '../investments.js';
import type { GeminiAnalysis } from '../analysis.js';
import { dashboardState, type DataMode } from '../dashboard-state.ts';
import { emptyDashboard } from './empty.ts';
import { loadAllTransactions } from './transaction-pages.ts';

class ReadFailure extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, code?: string) {
    super('não foi possível carregar os dados');
    this.status = status;
    this.code = code;
  }
}

// Dependências explícitas permitem exercitar primeiro uso e falhas sem contas reais.
export async function loadDashboardPage({
  mode,
  month,
  section,
  fetchAPI,
  privateStorage = false
}: {
  mode: DataMode;
  month: string;
  section: string;
  fetchAPI: (path: string) => Promise<Response>;
  privateStorage?: boolean;
}) {
  let authenticated = false;
  const result = {
    section,
    dashboard: emptyDashboard(month),
    app: dashboardState(
      mode,
      mode === 'unconfigured' ? 'unconfigured' : 'error',
      false,
      privateStorage
    ),
    portfolio: null as Portfolio | null,
    ai: null as {
      configured: boolean;
      analysis: GeminiAnalysis | null;
      model: string;
    } | null,
    agenda: null as CardAgendaData | null,
    featureError: '',
    redirectTo: ''
  };
  if (mode === 'unconfigured') return result;
  const get = async (path: string) => {
    const response = await fetchAPI(path);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new ReadFailure(response.status, body.code);
    }
    return response.json();
  };
  try {
    await get('me');
    authenticated = true;
    if (mode === 'cloud') {
      result.dashboard = await get(`dashboard?month=${month}`);
    } else {
      const [
        summary,
        transactions,
        breakdown,
        series,
        balances,
        budget,
        goals
      ] = await Promise.all([
        get(`summary?month=${month}`),
        loadAllTransactions(get, month),
        get(`breakdown?month=${month}&by=category`),
        get(`timeseries?from=${shiftMonth(month, -5)}&to=${month}`),
        get('balances'),
        get(`budget?month=${month}`),
        get('goals')
      ]);
      result.dashboard = {
        mode: 'live',
        month,
        summary,
        transactions,
        breakdown,
        series,
        balances,
        budget,
        goals
      } as Dashboard;
    }
    result.app = dashboardState(mode, 'ready', true, privateStorage);
  } catch (failure) {
    if (failure instanceof ReadFailure && [401, 409].includes(failure.status)) {
      result.redirectTo = failure.status === 401 ? '/login' : '/setup';
    } else {
      result.app = dashboardState(
        mode,
        mode === 'cloud' &&
          failure instanceof ReadFailure &&
          failure.status === 503 &&
          failure.code === 'snapshot_pending'
          ? 'first-sync'
          : 'error',
        authenticated,
        privateStorage
      );
    }
    return result;
  }
  // Falhas de um recurso opcional não apagam o resumo que já foi carregado.
  try {
    if (section === 'cartoes') result.agenda = await get('agenda');
    if (section === 'investimentos' && result.app.capabilities.investments)
      result.portfolio = await get(`portfolio?month=${month}`);
    if (section === 'analise' && result.app.capabilities.analysis)
      result.ai = await get(`analysis?month=${month}`);
  } catch (failure) {
    if (failure instanceof ReadFailure && failure.status === 401)
      result.redirectTo = '/login';
    else
      result.featureError =
        'Não foi possível carregar este recurso. Tente novamente.';
  }
  return result;
}
