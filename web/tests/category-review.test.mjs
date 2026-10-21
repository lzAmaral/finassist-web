import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  categoryName,
  ruleLabel,
  previewStillApplies,
  categoryRequest
} from '../src/lib/category-review.ts';

test('labels preserve full merchant description and identify legacy rules', () => {
  assert.equal(ruleLabel('exact:loja 101 - centro'), 'loja 101 - centro');
  assert.equal(ruleLabel('loja centro'), 'loja centro');
  assert.equal(categoryName('HEALTH'), 'Saúde');
});
test('a preview is invalid after either description or category changes', () => {
  const preview = { key: 'exact:loja 101', category: 'FOOD', hash: 'snapshot' };
  assert.equal(previewStillApplies(preview, 'exact:loja 101', 'FOOD'), true);
  assert.equal(previewStillApplies(preview, 'exact:loja 102', 'FOOD'), false);
  assert.equal(previewStillApplies(preview, 'exact:loja 101', 'HEALTH'), false);
  assert.equal(
    Boolean(previewStillApplies(null, 'exact:loja 101', 'FOOD')),
    false
  );
  assert.equal(
    previewStillApplies({ ...preview, hash: '' }, 'exact:loja 101', 'FOOD'),
    false
  );
});
test('request sends scope and preview hash, and surfaces stale-preview errors', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (path, init) => {
    calls.push({ path, init });
    return Response.json(
      { error: 'os lançamentos mudaram: confira a prévia novamente' },
      { status: 409 }
    );
  });
  const body = {
    key: 'exact:loja 101',
    category: 'FOOD',
    applyExisting: false,
    previewHash: 'snapshot'
  };
  await assert.rejects(
    categoryRequest('/api/categorize/rules', 'PUT', body),
    /confira a prévia/
  );
  assert.deepEqual(JSON.parse(calls[0].init.body), body);
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
});
test('unexpected non-JSON backend error is recoverable', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('gateway unavailable', { status: 502 })
  );
  await assert.rejects(
    categoryRequest('/api/categorize/review'),
    /Tente novamente/
  );
});
