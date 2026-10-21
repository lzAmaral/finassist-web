import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anonymousIndicators } from '../src/lib/analysis.ts';

test('Go and cloud confirmed expenses produce the same anonymous indicators', () => {
  const dashboard = (status) => ({
    summary: {
      current: { income: 100, expense: 40 },
      previous: { income: 100, expense: 50 }
    },
    breakdown: [],
    series: [{ income: 100, expense: 40 }],
    transactions: {
      items: [
        { kind: 'EXPENSE', category: 'FOOD', amount: 40, status },
        {
          kind: 'EXPENSE',
          category: 'SHOPPING',
          amount: 1000,
          status: 'PENDING'
        },
        {
          kind: 'EXPENSE',
          category: 'SHOPPING',
          amount: 2000,
          status: 'CANCELLED'
        }
      ]
    }
  });
  assert.deepEqual(
    anonymousIndicators(dashboard('PAID')),
    anonymousIndicators(dashboard('POSTED'))
  );
  assert.deepEqual(anonymousIndicators(dashboard('PAID')).categoryShares, [
    { category: 'FOOD', percent: 100 }
  ]);
});
