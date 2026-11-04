import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBudgetCents,
  budgetInputValue
} from '../src/lib/category-budgets.ts';

test('entrada monetária preserva centavos e distingue vazio de zero', () => {
  for (const [raw, expected] of [
    ['0', 0],
    ['0,00', 0],
    ['0.01', 1],
    ['12,34', 1234],
    [' 5,5 ', 550],
    ['1000000000', 100000000000]
  ]) {
    assert.equal(parseBudgetCents(raw), expected);
    assert.equal(parseBudgetCents(budgetInputValue(expected)), expected);
  }
  assert.equal(budgetInputValue(null), '');
  for (const raw of [
    '',
    ' ',
    '-1',
    'NaN',
    'Infinity',
    '1e3',
    '1.234,56',
    '1,234',
    '1.234',
    '1,',
    '.5',
    '1000000000,01'
  ])
    assert.equal(parseBudgetCents(raw), null, raw);
});
