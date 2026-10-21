import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companionAPI } from '../src/lib/server/companion-api.ts';
import {
  exportCompanion,
  importCompanion
} from '../src/lib/server/companion-migration.ts';

const url = new URL('https://web.synthetic/api/portfolio?month=2026-10');
function services(overrides = {}) {
  return {
    configured: true,
    authorize: async () => Response.json({ authenticated: true }),
    snapshot: async () => undefined,
    portfolio: async () => ({ positions: [], importedAt: null }),
    updatePortfolio: async () => {},
    aiStatus: async () => ({ configured: true }),
    saveAIKey: async () => {},
    generateAnalysis: async (d) => ({ month: d.month }),
    dashboard: async (month) => ({ month, mode: 'live' }),
    classifyError: () => ({ status: 502, message: 'falha de persistência' }),
    ...overrides
  };
}
test('sessão Go e origem são obrigatórias antes de ler armazenamento auxiliar', async () => {
  let reads = 0;
  const denied = await companionAPI(
    new Request(url),
    url,
    'portfolio',
    services({
      authorize: async () => new Response(null, { status: 401 }),
      snapshot: async () => {
        reads++;
      }
    })
  );
  assert.equal(denied.status, 401);
  const csrf = await companionAPI(
    new Request(url, {
      method: 'POST',
      headers: { origin: 'https://evil.synthetic' }
    }),
    url,
    'portfolio/position',
    services()
  );
  assert.equal(csrf.status, 403);
  assert.equal(reads, 0);
});
test('carteira manual funciona sem snapshot cloud e fonte importada é explícita', async () => {
  const response = await companionAPI(
    new Request(url),
    url,
    'portfolio',
    services()
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    positions: [],
    importedAt: null,
    importedSource: 'cloud-snapshot',
    importedSyncedAt: null
  });
  const unavailable = await companionAPI(
    new Request(url),
    url,
    'portfolio',
    services({ configured: false })
  );
  assert.equal(unavailable.status, 503);
});
test('falha de escrita não retorna sucesso; análise usa somente dashboard Go', async () => {
  const request = (body) =>
    new Request(url, {
      method: 'POST',
      headers: { origin: url.origin },
      body: JSON.stringify(body)
    });
  const failed = await companionAPI(
    request({}),
    url,
    'portfolio/position',
    services({
      updatePortfolio: async () => {
        throw new Error('synthetic');
      }
    })
  );
  assert.equal(failed.status, 502);
  const analysis = await companionAPI(
    request({ month: '2026-10' }),
    url,
    'analysis/generate',
    services({
      snapshot: async () => {
        throw new Error('não pode usar snapshot bancário');
      }
    })
  );
  assert.equal(analysis.status, 200);
  assert.deepEqual(await analysis.json(), { month: '2026-10' });
});
function store(initial = []) {
  const values = new Map(
    initial.map(([path, value]) => [
      path,
      { value: structuredClone(value), etag: '1' }
    ])
  );
  return {
    values,
    read: async (path) => structuredClone(values.get(path)),
    create: async (path, value) => {
      if (values.has(path)) throw new Error('conflito concorrente');
      values.set(path, { value: structuredClone(value), etag: '1' });
    }
  };
}
const fixtures = [
  [
    'finance/portfolio-v1.enc',
    {
      version: 1,
      positions: [
        { id: 'manual-1', balance: 100 },
        { id: 'manual-2', archived: true }
      ],
      dividends: [{ id: 'dividend-1', amount: 12.34 }]
    }
  ],
  [
    'finance/analysis-v1.enc',
    { version: 1, key: 'synthetic-key', usage: { day: '2026-10-21', count: 2 } }
  ]
];
test('migração e reversão preservam carteira/provento/configuração, reexecução não duplica', async () => {
  const source = store(fixtures),
    target = store();
  const bundle = await exportCompanion(source);
  assert.deepEqual(bundle.counts, { positions: 2, dividends: 1, ai: 1 });
  assert.equal((await importCompanion(bundle, source, target)).created, 2);
  assert.equal((await importCompanion(bundle, source, target)).unchanged, 2);
  assert.deepEqual(
    (await exportCompanion(target)).documents.map((d) => d.hash),
    bundle.documents.map((d) => d.hash)
  );
  // Reversão de configuração aponta à origem preservada, sem apagar o destino.
  assert.deepEqual((await exportCompanion(source)).documents, bundle.documents);
});
test('migração aborta origem concorrente e recusa sobrescrever destino divergente', async () => {
  const source = store(fixtures),
    bundle = await exportCompanion(source);
  source.values.get(fixtures[0][0]).etag = '2';
  await assert.rejects(
    importCompanion(bundle, source, store()),
    /origem alterada/
  );
  const fresh = store(fixtures),
    conflict = store([
      [fixtures[0][0], { version: 1, positions: [], dividends: [] }]
    ]);
  await assert.rejects(
    importCompanion(await exportCompanion(fresh), fresh, conflict),
    /divergentes/
  );
  const target = store();
  target.create = async () => {
    throw new Error('conflito concorrente');
  };
  await assert.rejects(
    importCompanion(await exportCompanion(fresh), fresh, target),
    /concorrente/
  );
});
