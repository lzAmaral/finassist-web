import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Dashboard } from '#lib/finance.js';
import { shiftMonth } from '#lib/finance.js';
import { emptyDashboard } from '#lib/server/empty.js';
import { backendURL } from '#lib/server/backend.js';

export const load: PageServerLoad = async ({
  url,
  params,
  fetch,
  setHeaders
}) => {
  const section = params.section ?? '';
  if (!['', 'transacoes', 'orcamento', 'metas', 'conexoes'].includes(section))
    error(404, 'Página não encontrada.');
  const current = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo'
  }).format(new Date());
  const candidate = url.searchParams.get('month') ?? current;
  const month = /^20\d{2}-(0[1-9]|1[0-2])$/.test(candidate)
    ? candidate
    : current;
  setHeaders({ 'cache-control': 'private, no-store' });
  if (!backendURL()) return { section, dashboard: emptyDashboard(month) };
  const get = async (path: string) => {
    const res = await fetch(`/api/${path}`);
    if (res.status === 401) redirect(303, '/login');
    if (res.status === 409) redirect(303, '/setup');
    if (!res.ok)
      error(502, 'A API não respondeu. Confira a conexão com o backend.');
    return res.json();
  };
  await get('me');
  const [summary, transactions, breakdown, series, balances, budget, goals] =
    await Promise.all([
      get(`summary?month=${month}`),
      get(`transactions?month=${month}&limit=100`),
      get(`breakdown?month=${month}&by=category`),
      get(`timeseries?from=${shiftMonth(month, -5)}&to=${month}`),
      get('balances'),
      get(`budget?month=${month}`),
      get('goals')
    ]);
  return {
    section,
    dashboard: {
      mode: 'live',
      month,
      summary,
      transactions,
      breakdown,
      series,
      balances,
      budget,
      goals
    } as Dashboard
  };
};
