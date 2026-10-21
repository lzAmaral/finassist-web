import type { Dashboard } from '../finance.js';
import type { Snapshot } from './finance-data.js';

const paths = new Set([
  'portfolio',
  'portfolio/position',
  'portfolio/archive',
  'portfolio/dividend',
  'portfolio/archive-dividend',
  'analysis',
  'analysis/generate',
  'analysis/key'
]);
export const isCompanionPath = (path: string) => paths.has(path);

type Services = {
  authorize: () => Promise<Response>;
  configured: boolean;
  snapshot: () => Promise<Snapshot | undefined>;
  portfolio: (snapshot: Snapshot, month: string) => Promise<unknown>;
  updatePortfolio: (
    action: string,
    input: unknown,
    snapshot: Snapshot
  ) => Promise<unknown>;
  aiStatus: (month: string) => Promise<unknown>;
  saveAIKey: (key: unknown) => Promise<unknown>;
  generateAnalysis: (dashboard: Dashboard) => Promise<unknown>;
  dashboard: (month: string) => Promise<Dashboard>;
  classifyError: (error: unknown) => { status: number; message: string };
};
const reply = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff'
    }
  });

// Autorização Go obrigatória antes de qualquer leitura Blob: a sessão cloud não é aceita aqui.
export async function companionAPI(
  request: Request,
  url: URL,
  path: string,
  services: Services
) {
  if (
    !['GET', 'HEAD'].includes(request.method) &&
    request.headers.get('origin') !== url.origin
  )
    return reply({ error: 'Origem não permitida.' }, 403);
  const session = await services.authorize();
  if (!session.ok) {
    if ([401, 409].includes(session.status)) return session;
    return reply(
      { error: 'Não foi possível verificar sua sessão no backend.' },
      502
    );
  }
  if (!services.configured)
    return reply(
      {
        error:
          'Configure o armazenamento privado para acessar a carteira manual e a análise.'
      },
      503
    );
  try {
    let body: Record<string, unknown> = {};
    if (request.method === 'POST') {
      const text = await request.text();
      if (text.length > 8192)
        return reply({ error: 'Requisição muito grande.' }, 413);
      try {
        body = JSON.parse(text);
        if (!body || typeof body !== 'object' || Array.isArray(body))
          throw new Error();
      } catch {
        return reply({ error: 'Dados inválidos.' }, 400);
      }
    }
    const month = String(
      body.month ??
        url.searchParams.get('month') ??
        new Date().toISOString().slice(0, 7)
    );
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))
      return reply({ error: 'Mês inválido.' }, 400);
    if (request.method === 'GET' && path === 'analysis')
      return reply(await services.aiStatus(month));
    if (request.method === 'POST' && path === 'analysis/key') {
      await services.saveAIKey(body.key);
      return reply({ ok: true });
    }
    if (request.method === 'POST' && path === 'analysis/generate')
      return reply(
        await services.generateAnalysis(await services.dashboard(month))
      );
    if (
      (request.method === 'GET' && path === 'portfolio') ||
      (request.method === 'POST' && path.startsWith('portfolio/'))
    ) {
      const snapshot = await services.snapshot();
      // A carteira manual não depende de uma sincronização bancária cloud anterior.
      const value: Snapshot = snapshot ?? {
        version: 1,
        syncedAt: '',
        items: [],
        accounts: [],
        transactions: []
      };
      if (request.method === 'GET')
        return reply({
          ...((await services.portfolio(value, month)) as object),
          importedSource: 'cloud-snapshot',
          importedSyncedAt: snapshot?.investmentsSyncedAt ?? null
        });
      await services.updatePortfolio(
        path.slice('portfolio/'.length),
        body,
        value
      );
      return reply({ ok: true });
    }
    return reply({ error: 'Operação indisponível.' }, 405);
  } catch (error) {
    const failure = services.classifyError(error);
    return reply({ error: failure.message }, failure.status);
  }
}
