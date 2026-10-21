import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Dashboard } from '#lib/finance.js';
import { loadAllTransactions } from '#lib/server/transaction-pages.js';
import { shiftMonth } from '#lib/finance.js';
import { backendURL } from '#lib/server/backend.js';
import {
  cloudConfigured,
  privateStorageConfigured
} from '#lib/server/cloud-config.js';
import { cloudAPI } from '#lib/server/cloud-api.js';
import { proxyBackend } from '#lib/server/backend-proxy.js';
import { companionAPI, isCompanionPath } from '#lib/server/companion-api.js';
import { readSnapshot } from '#lib/server/cloud-store.js';
import { getPortfolio, updatePortfolio } from '#lib/server/portfolio-store.js';
import {
  aiStatus,
  generateAnalysis,
  saveAIKey
} from '#lib/server/gemini-analysis.js';
import { ValidationError } from '#lib/server/portfolio-data.js';
import { BlobError, BlobPreconditionFailedError } from '@vercel/blob';

export const config = { maxDuration: 120 };
const proxy: RequestHandler = async (event) => {
  const { request, url, params } = event;
  const base = backendURL();
  if (!base && cloudConfigured()) return cloudAPI(event);
  if (!base)
    return json(
      { error: 'A conexão com seus dados ainda não foi configurada.' },
      { status: 503 }
    );
  const path = params.path ?? '';
  if (isCompanionPath(path))
    return companionAPI(request, url, path, {
      configured: privateStorageConfigured(),
      authorize: () =>
        proxyBackend(
          new Request(request.url, { headers: request.headers }),
          new URL('/api/me', url),
          base,
          'me'
        ),
      snapshot: async () => (await readSnapshot())?.value,
      portfolio: getPortfolio,
      updatePortfolio,
      aiStatus: (month) => aiStatus(month, 'go'),
      saveAIKey,
      generateAnalysis: (dashboard) => generateAnalysis(dashboard, 'go'),
      dashboard: async (month) => {
        const get = async (path: string, query = '') => {
          const [route, search] = path.split('?');
          const response = await proxyBackend(
            new Request(request.url, { headers: request.headers }),
            new URL(
              `/api/${route}${query || (search ? `?${search}` : '')}`,
              url
            ),
            base,
            route
          );
          if (!response.ok)
            throw new Error(
              'Não foi possível carregar os indicadores do backend.'
            );
          return response.json();
        };
        const [
          summary,
          transactions,
          breakdown,
          series,
          balances,
          budget,
          goals
        ] = await Promise.all([
          get('summary', `?month=${month}`),
          loadAllTransactions(get, month),
          get('breakdown', `?month=${month}&by=category`),
          get('timeseries', `?from=${shiftMonth(month, -5)}&to=${month}`),
          get('balances'),
          get('budget', `?month=${month}`),
          get('goals')
        ]);
        return {
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
      },
      classifyError: (error) => {
        if (error instanceof ValidationError)
          return { status: 400, message: error.message };
        if (
          error instanceof BlobPreconditionFailedError ||
          (error instanceof BlobError && /already exists/i.test(error.message))
        )
          return {
            status: 409,
            message:
              'Outra alteração foi salva ao mesmo tempo. Recarregue a página e tente novamente.'
          };
        return {
          status: 502,
          message:
            'Não foi possível concluir a operação. Seus dados anteriores foram preservados.'
        };
      }
    });
  return proxyBackend(request, url, base, path);
};
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
