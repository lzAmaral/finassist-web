import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  positionInput,
  importedPosition,
  portfolioView
} from '../src/lib/server/portfolio-data.ts';
import { anonymousIndicators, localAnalysis } from '../src/lib/analysis.ts';
const input = {
  name: 'Ativo de teste',
  ticker: 'TEST3',
  assetClass: 'EQUITY',
  quantity: 10,
  averagePrice: 12.3,
  currentPrice: 15.2
};
test('manual portfolio validates values and computes position value without using market guesses', () => {
  const p = positionInput(input);
  assert.equal(p.cost, 123);
  assert.equal(p.balance, 152);
  for (const quantity of [NaN, Infinity, -1, 0, '10'])
    assert.throws(() => positionInput({ ...input, quantity }));
  assert.throws(() => positionInput({ ...input, assetClass: '__proto__' }));
});
test('Pluggy gross value is never treated as acquisition cost', () => {
  const p = importedPosition(
    { id: 'i', name: 'Fundo', type: 'MUTUAL_FUND', balance: 950, amount: 1000 },
    '2026-10-21'
  );
  assert.equal(p.cost, null);
  assert.equal(p.balance, 950);
});
test('portfolio totals exclude archived and foreign positions, and return unknown result honestly', () => {
  const p = {
    ...positionInput(input),
    id: 'p',
    source: 'manual',
    updatedAt: '2026-10-21'
  };
  const state = {
    version: 1,
    positions: [
      p,
      { ...p, id: 'archived', archived: true },
      { ...p, id: 'foreign', currency: 'USD' }
    ],
    dividends: []
  };
  const view = portfolioView(
    state,
    [
      {
        id: 'i',
        type: 'FIXED_INCOME',
        name: 'CDB teste',
        balance: 1000,
        amount: 1100,
        currencyCode: 'BRL'
      }
    ],
    '2026-10-21',
    '2026-10'
  );
  assert.equal(view.total, 1152);
  assert.equal(view.knownCost, 123);
  assert.equal(view.variation, 29);
  assert.equal(view.positions.length, 2);
  assert.equal(view.excludedCurrencies, 1);
  assert.equal(
    view.allocation.reduce((n, a) => n + a.value, 0),
    view.total
  );
  assert.equal(
    portfolioView(
      { version: 1, positions: [], dividends: [] },
      [{ id: 'i', type: 'EQUITY', name: 'Teste', balance: 10, amount: 11 }],
      '2026-10-21',
      '2026-10'
    ).variation,
    null
  );
});
test('dividend series uses calendar months and ignores archived records', () => {
  const view = portfolioView(
    {
      version: 1,
      positions: [],
      dividends: [
        { id: 'a', date: '2026-02-01', amount: 10 },
        { id: 'b', date: '2025-02-01', amount: 20 },
        { id: 'c', date: '2026-02-01', amount: 30, archived: true }
      ]
    },
    [],
    null,
    '2026-10'
  );
  assert.equal(view.dividendsYear, 10);
  assert.equal(view.dividendSeries[1].total, 10);
  assert.equal(view.dividendSeries.length, 12);
});
test('Google payload excludes monetary amounts, dates, names, descriptions and free-form categories', () => {
  const d = {
    month: '2026-10',
    summary: {
      current: { income: 9876.54, expense: 1234.56 },
      previous: { expense: 1000 }
    },
    transactions: {
      items: [
        {
          kind: 'EXPENSE',
          status: 'POSTED',
          amount: 1234.56,
          category: 'PRIVATE PERSON ABC',
          categoryLabel: 'PRIVATE PERSON ABC',
          description: 'Sensitive bank description',
          accountName: 'PRIVATE BANK'
        }
      ]
    },
    series: [{ month: '2026-10', income: 9876.54, expense: 1234.56 }],
    breakdown: []
  };
  const payload = anonymousIndicators(d);
  const serialized = JSON.stringify(payload);
  for (const privateValue of [
    '9876',
    '1234',
    '2026',
    'PRIVATE',
    'Sensitive',
    'BANK'
  ])
    assert.equal(serialized.includes(privateValue), false);
  assert.equal(payload.categoryShares[0].category, 'OTHER');
  assert.equal(payload.categoryShares[0].percent, 100);
  assert.equal(payload.trend[0].incomeIndex, 100);
  assert.equal(
    localAnalysis({
      ...d,
      summary: { current: { income: 0, expense: 0 }, previous: { expense: 0 } }
    }).savingsRate,
    null
  );
});
