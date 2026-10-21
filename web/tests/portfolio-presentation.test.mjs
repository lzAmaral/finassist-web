import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assetGroups,
  dividendHistory,
  positionSummary
} from '../src/lib/portfolio-presentation.ts';

const positions = [
  { id: 'stock', assetClass: 'EQUITY', balance: 120, cost: 100 },
  { id: 'unknown', assetClass: 'EQUITY', balance: 900, cost: null },
  { id: 'crypto', assetClass: 'CRYPTO', balance: 80, cost: 100 }
];

test('class metrics include all balances but only known costs in gains and percentages', () => {
  const groups = assetGroups(positions);
  const stocks = groups.find((group) => group.key === 'EQUITY');
  assert.equal(stocks.total, 1020);
  assert.equal(stocks.gain, 20);
  assert.equal(stocks.change, 20);
  assert.equal(stocks.covered, 1);
  assert.equal(stocks.count, 2);
  assert.equal(stocks.percentage, (1020 / 1100) * 100);
  assert.equal(groups.find((group) => group.key === 'CRYPTO').change, -20);
  assert.equal(groups.find((group) => group.key === 'ETF').change, null);
  assert.equal(
    groups.reduce((sum, group) => sum + group.total, 0),
    1100
  );
});

test('unknown and zero costs never produce fabricated percentages or divide by zero', () => {
  assert.equal(positionSummary([positions[1]]).gain, null);
  assert.equal(positionSummary([{ balance: 50, cost: 0 }]).gain, 50);
  assert.equal(positionSummary([{ balance: 50, cost: 0 }]).change, null);
  assert.equal(positionSummary([]).change, null);
  assert.equal(
    positionSummary([
      { balance: 0.3, cost: 0.1 },
      { balance: 0.2, cost: 0.1 }
    ]).gain,
    0.3
  );
});

test('rolling dividend history crosses years, fills gaps, and excludes archived and out-of-range records', () => {
  const history = dividendHistory(
    [
      { date: '2025-11-01', amount: 20 },
      { date: '2026-10-01', amount: 0.1 },
      { date: '2026-10-02', amount: 0.2 },
      { date: '2026-10-03', amount: 50, archived: true },
      { date: '2025-10-31', amount: 100 },
      { date: '2026-11-01', amount: 100 }
    ],
    '2026-10',
    12
  );
  assert.equal(history.length, 12);
  assert.deepEqual(history[0], { month: '2025-11', label: '11/25', total: 20 });
  assert.equal(history[1].total, 0);
  assert.equal(history[11].total, 0.3);
  assert.equal(dividendHistory([], '2026-01', 24)[0].month, '2024-02');
});
