import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultImportChoice,
  importRequest
} from '../src/lib/statement-import.ts';

test('import preview requires review for candidates, errors and duplicates', () => {
  const row = { error: '', duplicate: false, candidates: [] };
  assert.equal(defaultImportChoice(row), 'create');
  assert.equal(defaultImportChoice({ ...row, error: 'data inválida' }), 'skip');
  assert.equal(defaultImportChoice({ ...row, duplicate: true }), 'skip');
  assert.equal(
    defaultImportChoice({ ...row, candidates: [{ id: 'canonical' }] }),
    'skip'
  );
});
test('import client sends JSON and exposes failed confirmation instead of success', async (t) => {
  const previous = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = previous;
  });
  globalThis.fetch = async (path, options) => {
    assert.equal(path, '/api/imports/batch/confirm');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), { decisions: [] });
    return new Response(JSON.stringify({ error: 'lote mudou; recarregue' }), {
      status: 409
    });
  };
  await assert.rejects(
    importRequest('/api/imports/batch/confirm', { decisions: [] }),
    /lote mudou; recarregue/
  );
});
