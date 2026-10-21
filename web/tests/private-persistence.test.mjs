import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const blobs = new Map();
let revision = 0;
globalThis.__fa02Storage = {
  config: {
    blobToken: 'synthetic-only',
    dataKey: '1'.repeat(64),
    privateNamespace: 'fa02-synthetic'
  },
  get: async (path) => {
    const stored = blobs.get(path);
    if (!stored) return undefined;
    return {
      statusCode: 200,
      blob: { etag: stored.etag },
      stream: new Response(stored.bytes).body
    };
  },
  put: async (path, bytes, options) => {
    const existing = blobs.get(path);
    if (
      existing &&
      (!options.allowOverwrite || options.ifMatch !== existing.etag)
    )
      throw new Error('conflito de versão');
    if (!existing && options.ifMatch) throw new Error('conflito de versão');
    const etag = String(++revision);
    blobs.set(path, { bytes: Buffer.from(bytes), etag });
    return { etag };
  }
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '$app/env/private')
      return { url: 'fa02:env', shortCircuit: true };
    if (specifier === '@vercel/blob')
      return { url: 'fa02:blob', shortCircuit: true };
    if (specifier === './cloud-config.js')
      return { url: 'fa02:config', shortCircuit: true };
    if (specifier.startsWith('.') && specifier.endsWith('.js')) {
      const ts = new URL(specifier.slice(0, -3) + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(ts)))
        return { url: ts.href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === 'fa02:env')
      return {
        format: 'module',
        source:
          'export const GEMINI_API_KEY = undefined; export const GEMINI_MODEL = undefined;',
        shortCircuit: true
      };
    if (url === 'fa02:blob')
      return {
        format: 'module',
        source:
          'export const get = (...a) => globalThis.__fa02Storage.get(...a); export const put = (...a) => globalThis.__fa02Storage.put(...a);',
        shortCircuit: true
      };
    if (url === 'fa02:config')
      return {
        format: 'module',
        source:
          'export const cloudConfig = () => globalThis.__fa02Storage.config;',
        shortCircuit: true
      };
    return next(url, context);
  }
});
const { aiStatus, saveAIKey } =
  await import('../src/lib/server/gemini-analysis.ts');
const { readSnapshot, writeSnapshot } =
  await import('../src/lib/server/cloud-store.ts');
const { readPrivate, writePrivate } =
  await import('../src/lib/server/private-store.ts');
const { getPortfolio, updatePortfolio } =
  await import('../src/lib/server/portfolio-store.ts');
const snapshot = {
  version: 1,
  syncedAt: '',
  items: [],
  accounts: [],
  transactions: []
};
const input = {
  name: 'Posição sintética',
  assetClass: 'EQUITY',
  ticker: 'TEST3',
  quantity: 2,
  averagePrice: 10,
  currentPrice: 11
};

test('store real cifra, relê e recusa versão concorrente; carteira e proventos sobrevivem recarga', async () => {
  await updatePortfolio('position', input, snapshot);
  const first = await getPortfolio(snapshot, '2026-10');
  assert.equal(first.positions.length, 1);
  assert.equal(first.total, 22);
  const bytes = [...blobs.values()][0].bytes;
  assert.equal(bytes.includes(Buffer.from('Posição sintética')), false);
  await updatePortfolio(
    'dividend',
    {
      positionId: first.positions[0].id,
      amount: 1.23,
      type: 'DIVIDEND',
      date: '2026-01-01'
    },
    snapshot
  );
  assert.equal((await getPortfolio(snapshot, '2026-10')).dividends.length, 1);
  const path = 'finance/portfolio-v1.enc';
  const [a, b] = await Promise.all([readPrivate(path), readPrivate(path)]);
  a.value.positions[0].balance = 30;
  b.value.positions[0].balance = 40;
  const attempts = await Promise.allSettled([
    writePrivate(path, a.value, a.etag),
    writePrivate(path, b.value, b.etag)
  ]);
  assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter((r) => r.status === 'rejected').length, 1);
  assert.equal((await getPortfolio(snapshot, '2026-10')).total, 30);
  await assert.rejects(writePrivate(path, b.value), /conflito/);
});

test('snapshot sincronizado pode ser atualizado com ETag e preserva versão em conflito', async () => {
  const first = { ...snapshot, syncedAt: '2026-10-21T12:00:00Z' };
  await writeSnapshot(first);
  const saved = await readSnapshot(true);
  assert.equal(saved.value.syncedAt, first.syncedAt);
  const next = { ...first, syncedAt: '2026-10-21T13:00:00Z' };
  await writeSnapshot(next, saved.etag);
  assert.equal((await readSnapshot(true)).value.syncedAt, next.syncedAt);
  await assert.rejects(writeSnapshot(first, saved.etag), /conflito/);
  assert.equal((await readSnapshot(true)).value.syncedAt, next.syncedAt);
});

test('configuração IA sobrevive, mas análise cloud antiga não se apresenta como Go', async () => {
  const path = 'finance/analysis-v1.enc';
  const analysis = {
    summary: 'Síntese cloud sintética',
    observations: [],
    actions: [],
    generatedAt: '2026-10-21T12:00:00Z',
    model: 'synthetic'
  };
  await writePrivate(path, { version: 1, analysisMonth: '2026-10', analysis });
  await saveAIKey('AIza' + 'x'.repeat(25));
  assert.deepEqual((await aiStatus('2026-10', 'cloud')).analysis, analysis);
  const go = await aiStatus('2026-10', 'go');
  assert.equal(go.configured, true);
  assert.equal(go.analysis, null);
  assert.equal(JSON.stringify(go).includes('AIza'), false);
});
