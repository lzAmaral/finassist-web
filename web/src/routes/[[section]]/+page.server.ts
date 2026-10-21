import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadDashboardPage } from '#lib/server/dashboard-page.js';
import { backendURL } from '#lib/server/backend.js';
import {
  cloudConfigured,
  privateStorageConfigured
} from '#lib/server/cloud-config.js';

export const load: PageServerLoad = async ({
  url,
  params,
  fetch,
  setHeaders
}) => {
  const section = params.section ?? '';
  if (
    ![
      '',
      'transacoes',
      'orcamento',
      'metas',
      'conexoes',
      'investimentos',
      'analise',
      'cartoes',
      'classificar',
      'revisao',
      'notificacoes',
      'importar',
      'perguntas'
    ].includes(section)
  )
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
  const mode = backendURL()
    ? 'go'
    : cloudConfigured()
      ? 'cloud'
      : 'unconfigured';
  const result = await loadDashboardPage({
    mode,
    month,
    section,
    privateStorage: privateStorageConfigured(),
    fetchAPI: (path) => fetch(`/api/${path}`)
  });
  if (result.redirectTo) redirect(303, result.redirectTo);
  return result;
};
