import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reviewPriorities,
  reviewReason,
  canRecordCancellation,
  savingsStatus
} from '../src/lib/spending-review.ts';
import {
  reviewRequest,
  setReviewDismissal,
  setReviewDecision,
  loadSpendingReview
} from '../src/lib/review-api.ts';
const candidate = (kind, key, monthly = 50, dismissed = false) => ({
  kind,
  key,
  monthly,
  dismissed,
  count: 2,
  months: 3
});
test('inicial limita três prioridades, oculta dispensas e mantém revisão completa', () => {
  const candidates = [
    candidate('ANT', 'a', 500),
    candidate('FIXED', 'f'),
    candidate('DUPLICATE', 'd'),
    candidate('INCREASE', 'i', 100),
    candidate('FIXED', 'g', 80),
    candidate('NEW', 'n'),
    candidate('DUPLICATE', 'x', 100, true)
  ];
  assert.deepEqual(
    reviewPriorities(candidates, true).map((c) => c.key),
    ['d', 'i', 'g']
  );
  assert.equal(reviewPriorities(candidates).length, 6);
  assert.equal(candidates[0].key, 'a');
});
test('compras repetidas são hipótese legítima; aumento de categoria não comprova reajuste', () => {
  assert.match(
    reviewReason(candidate('DUPLICATE', 'd')),
    /podem ser legítimas/
  );
  assert.match(
    reviewReason(candidate('INCREASE', 'i')),
    /sem comprovar reajuste/
  );
  assert.equal(canRecordCancellation(candidate('DUPLICATE', 'd')), false);
  assert.equal(canRecordCancellation(candidate('FIXED', 'f')), true);
  assert.match(savingsStatus({ status: 'RETURNED' }), /voltou/);
  assert.match(savingsStatus({ status: 'PENDING' }), /Aguardando histórico/);
});
test('cliente preserva erro do Go e recusa sucesso sem JSON', async () => {
  await assert.rejects(
    reviewRequest(
      '/api/review',
      undefined,
      async () =>
        new Response(JSON.stringify({ error: 'sessão expirada' }), {
          status: 401
        })
    ),
    /sessão expirada/
  );
  await assert.rejects(
    reviewRequest(
      '/api/review',
      undefined,
      async () => new Response('inválido')
    ),
    /Resposta de revisão inválida/
  );
});
test('dispensa e decisão persistem via APIs oficiais e leitura renovada', async () => {
  const original = globalThis.fetch,
    writes = [];
  let dismissed = false,
    decided = false;
  globalThis.fetch = async (path, init) => {
    if (init.method === 'PUT') {
      const body = JSON.parse(init.body);
      writes.push({ path, body });
      assert.equal(init.headers['content-type'], 'application/json');
      if (path === '/api/review-dismissals') dismissed = body.dismissed;
      else {
        decided = body.decided;
        dismissed = decided;
      }
      return Response.json({ ok: true });
    }
    return Response.json(
      path.startsWith('/api/review?')
        ? {
            month: '2026-10',
            historyMonths: 3,
            candidates: [candidate('FIXED', 'streaming', 50, dismissed)]
          }
        : { realized: 0, decisions: decided ? [{ status: 'PENDING' }] : [] }
    );
  };
  try {
    const c = candidate('FIXED', 'streaming');
    await setReviewDismissal(c, true);
    assert.equal(
      (await loadSpendingReview('2026-10')).review.candidates[0].dismissed,
      true
    );
    await setReviewDismissal(c, false);
    await setReviewDecision(c, '2026-10', true);
    assert.equal(
      (await loadSpendingReview('2026-10')).savings.decisions[0].status,
      'PENDING'
    );
    assert.deepEqual(writes.at(-1).body, {
      kind: 'FIXED',
      key: 'streaming',
      month: '2026-10',
      decided: true
    });
    assert.equal('monthly' in writes.at(-1).body, false);
    await setReviewDecision(c, '2026-10', false);
    assert.equal(
      (await loadSpendingReview('2026-10')).review.candidates[0].dismissed,
      false
    );
  } finally {
    globalThis.fetch = original;
  }
});
