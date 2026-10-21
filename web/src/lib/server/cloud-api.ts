import { json, type RequestEvent } from '@sveltejs/kit';
import {
  authenticated,
  checkPassword,
  issue,
  logout,
  loginAllowed,
  isCron
} from './cloud-auth.js';
import { readSnapshot } from './cloud-store.js';
import { dashboardFromSnapshot } from './finance-data.js';
import { syncPluggy } from './pluggy-sync.js';
import { cloudAgenda } from './card-agenda-data.js';
import { getPortfolio, updatePortfolio } from './portfolio-store.js';
import { aiStatus, generateAnalysis, saveAIKey } from './gemini-analysis.js';
import { ValidationError } from './portfolio-data.js';
import { BlobError, BlobPreconditionFailedError } from '@vercel/blob';

const reply = (body: unknown, status = 200) =>
  json(body, {
    status,
    headers: {
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff'
    }
  });
export async function cloudAPI(event: RequestEvent) {
  const { request, url, cookies, params } = event;
  const path = params.path ?? '';
  if (
    !['GET', 'HEAD'].includes(request.method) &&
    request.headers.get('origin') !== url.origin
  )
    return reply({ error: 'Origem não permitida.' }, 403);
  if (path === 'login' && request.method === 'POST') {
    if (!loginAllowed(event.getClientAddress()))
      return reply({ error: 'Muitas tentativas. Aguarde 15 minutos.' }, 429);
    if (Number(request.headers.get('content-length') ?? 0) > 4096)
      return reply({ error: 'Requisição muito grande.' }, 413);
    const text = await request.text();
    if (text.length > 4096)
      return reply({ error: 'Requisição muito grande.' }, 413);
    let password: unknown;
    try {
      password = JSON.parse(text).password;
    } catch {
      return reply({ error: 'Requisição inválida.' }, 400);
    }
    if (!(await checkPassword(password)))
      return reply({ error: 'Senha incorreta.' }, 401);
    issue(cookies, url.protocol === 'https:');
    return reply({ ok: true });
  }
  if (path === 'sync') {
    if (
      !(request.method === 'GET' && isCron(request)) &&
      !(request.method === 'POST' && authenticated(cookies))
    )
      return reply({ error: 'Não autenticado.' }, 401);
    try {
      const snapshot = await syncPluggy();
      return reply({
        ok: true,
        accounts: snapshot.accounts.length,
        transactions: snapshot.transactions.length,
        syncedAt: snapshot.syncedAt
      });
    } catch (error) {
      console.error(
        'finassist_sync_failed',
        error instanceof Error ? error.name : 'UnknownError'
      );
      return reply(
        {
          error:
            'Não foi possível atualizar a Pluggy. Os últimos dados sincronizados foram preservados. Tente novamente em alguns minutos.'
        },
        502
      );
    }
  }
  if (!authenticated(cookies)) return reply({ error: 'Não autenticado.' }, 401);
  if (path === 'logout' && request.method === 'POST') {
    logout(cookies);
    return reply({ ok: true });
  }
  if (
    request.method === 'POST' &&
    [
      'portfolio/position',
      'portfolio/archive',
      'portfolio/dividend',
      'portfolio/archive-dividend',
      'analysis/generate',
      'analysis/key'
    ].includes(path)
  ) {
    try {
      const text = await request.text();
      if (text.length > 8192)
        return reply({ error: 'Requisição muito grande.' }, 413);
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        return reply({ error: 'Dados inválidos.' }, 400);
      }
      if (path === 'analysis/key') {
        await saveAIKey((body as { key?: unknown })?.key);
        return reply({ ok: true });
      }
      const snapshot = await readSnapshot();
      if (!snapshot)
        return reply({ error: 'Sincronize suas contas primeiro.' }, 503);
      if (path === 'analysis/generate') {
        const month = (body as { month?: unknown })?.month;
        if (
          typeof month !== 'string' ||
          !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)
        )
          return reply({ error: 'Mês inválido.' }, 400);
        return reply(
          await generateAnalysis(dashboardFromSnapshot(snapshot.value, month))
        );
      }
      await updatePortfolio(
        path.slice('portfolio/'.length),
        body,
        snapshot.value
      );
      return reply({ ok: true });
    } catch (error) {
      if (error instanceof ValidationError)
        return reply({ error: error.message }, 400);
      if (
        error instanceof BlobPreconditionFailedError ||
        (error instanceof BlobError && /already exists/i.test(error.message))
      )
        return reply(
          {
            error:
              'Outra alteração foi salva ao mesmo tempo. Recarregue a página e tente novamente.'
          },
          409
        );
      return reply(
        {
          error:
            'Não foi possível concluir a operação. Seus dados anteriores foram preservados.'
        },
        502
      );
    }
  }
  if (!['GET', 'HEAD'].includes(request.method))
    return reply(
      { error: 'Operação indisponível neste modo de consulta.' },
      405
    );
  if (path === 'me') return reply({ authenticated: true });
  const month =
    url.searchParams.get('month') ?? new Date().toISOString().slice(0, 7);
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))
    return reply({ error: 'Mês inválido.' }, 400);
  try {
    const snapshot = await readSnapshot();
    if (!snapshot)
      return reply(
        {
          error: 'A primeira sincronização ainda não foi concluída.',
          code: 'snapshot_pending'
        },
        503
      );
    const dashboard = dashboardFromSnapshot(snapshot.value, month);
    if (path === 'agenda') return reply(cloudAgenda(snapshot.value));
    if (path === 'portfolio')
      return reply(await getPortfolio(snapshot.value, month));
    if (path === 'analysis') return reply(await aiStatus(month));
    const views: Record<string, unknown> = {
      dashboard,
      summary: dashboard.summary,
      transactions: dashboard.transactions,
      breakdown: dashboard.breakdown,
      timeseries: dashboard.series,
      balances: dashboard.balances,
      budget: dashboard.budget,
      goals: dashboard.goals
    };
    return Object.hasOwn(views, path)
      ? reply(views[path])
      : reply({ error: 'Rota não encontrada.' }, 404);
  } catch {
    return reply(
      { error: 'Não foi possível carregar seus dados. Tente novamente.' },
      502
    );
  }
}
