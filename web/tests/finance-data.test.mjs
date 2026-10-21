import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ownTransfer,
  completeDocument
} from '../src/lib/server/own-transfer.ts';
import {
  dashboardFromSnapshot,
  movement
} from '../src/lib/server/finance-data.ts';

const bank = {
  id: 'bank',
  itemId: 'item',
  name: 'Banco teste',
  type: 'BANK',
  balance: 100,
  currencyCode: 'BRL'
};
const card = {
  ...bank,
  id: 'card',
  name: 'Cartão teste',
  type: 'CREDIT',
  balance: 900
};
const tx = (overrides = {}) => ({
  id: 'tx',
  accountId: 'bank',
  date: '2026-10-05T12:00:00Z',
  description: 'Compra',
  amount: -10,
  category: 'Groceries',
  type: 'DEBIT',
  status: 'POSTED',
  currencyCode: 'BRL',
  ...overrides
});
const snapshot = (transactions, accounts = [bank, card]) => ({
  version: 1,
  syncedAt: '2026-10-21T12:00:00Z',
  items: [{ id: 'item', status: 'UPDATED' }],
  accounts,
  transactions
});

test('card purchases use direction, and refunds reduce expense rather than create income', () => {
  const result = dashboardFromSnapshot(
    snapshot([
      tx({ id: 'buy', accountId: 'card', amount: 100 }),
      tx({
        id: 'refund',
        accountId: 'card',
        amount: -20,
        type: 'CREDIT',
        description: 'Estorno'
      })
    ]),
    '2026-10'
  );
  assert.equal(result.summary.current.expense, 80);
  assert.equal(result.summary.current.income, 0);
  assert.equal(result.summary.bankBalance, 100);
});
test('own transfers, investments and bill settlements stay visible without double counting', () => {
  const result = dashboardFromSnapshot(
    snapshot([
      tx({ id: 'own', category: 'Same person transfer - PIX' }),
      tx({ id: 'invest', category: 'Fixed Income Investment' }),
      tx({
        id: 'bill',
        description: 'Pagamento de fatura cartão',
        category: 'Credit card payment'
      }),
      tx({
        id: 'cardbill',
        accountId: 'card',
        amount: -10,
        type: 'CREDIT',
        description: 'Pagamento recebido'
      }),
      tx({
        id: 'realbill',
        description: 'Pagamento de boleto financiamento',
        category: 'Credit card payment'
      })
    ]),
    '2026-10'
  );
  assert.equal(result.transactions.total, 5);
  assert.equal(result.summary.current.expense, 10);
  assert.equal(result.summary.current.income, 0);
});
test('pending transactions remain visible but only posted entries enter the monthly totals', () => {
  const result = dashboardFromSnapshot(
    snapshot([
      tx({ id: 'posted' }),
      tx({ id: 'pending', amount: -100, status: 'PENDING' }),
      tx({
        id: 'previous',
        date: '2026-09-30T00:00:00Z',
        type: 'CREDIT',
        amount: 50
      })
    ]),
    '2026-10'
  );
  assert.equal(result.transactions.total, 2);
  assert.equal(result.summary.current.expense, 10);
  assert.equal(result.summary.previous.income, 50);
  assert.equal(result.series.length, 6);
});
test('installments are assigned to their invoice month, clamping the day at month end', () => {
  const result = movement(
    tx({
      date: '2026-01-31T00:00:00Z',
      creditCardMetadata: {
        installmentNumber: 2,
        totalInstallments: 3,
        billForecastDate: '2026-02'
      }
    }),
    card
  );
  assert.equal(result.date, '2026-02-28');
  assert.match(result.description, /2\/3/);
});
test('duplicate pages do not duplicate transactions; sums use cents', () => {
  const a = tx({ amount: -0.1 });
  const result = dashboardFromSnapshot(
    snapshot([a, a, tx({ id: 'b', amount: -0.2 })]),
    '2026-10'
  );
  assert.equal(result.transactions.total, 2);
  assert.equal(result.summary.current.expense, 0.3);
});
test('currency amounts are not combined into a misleading BRL balance', () => {
  const usd = { ...bank, id: 'usd', currencyCode: 'USD', balance: 10000 };
  const result = dashboardFromSnapshot(
    snapshot([tx({ accountId: 'usd' })], [usd, card]),
    '2026-10'
  );
  assert.equal(result.summary.bankBalance, null);
  assert.equal(result.transactions.total, 0);
});
test('invalid movement direction is rejected instead of fabricated as an expense', () => {
  assert.throws(() => movement(tx({ type: 'UNKNOWN' }), bank));
});

test('generic transfer categories use counterparty identity, never amount/date matching', () => {
  const documents = new Set(['11111111111']);
  const names = new Set(['pessoa teste proprietaria']);
  const debit = {
    type: 'DEBIT',
    category: 'Transfer - Internal',
    paymentData: { receiver: { documentNumber: { value: '111.111.111-11' } } }
  };
  assert.equal(ownTransfer(debit, documents, names), true);
  assert.equal(
    ownTransfer(
      { ...debit, paymentData: { payer: debit.paymentData.receiver } },
      documents,
      names
    ),
    false
  );
  assert.equal(
    ownTransfer(
      {
        ...debit,
        paymentData: { receiver: { name: 'Pessoa Teste Proprietária' } }
      },
      documents,
      names
    ),
    true
  );
  assert.equal(
    ownTransfer(
      {
        ...debit,
        paymentData: {
          receiver: {
            name: 'Pessoa Teste Proprietária',
            documentNumber: { value: '22222222222' }
          }
        }
      },
      documents,
      names
    ),
    false
  );
  assert.equal(completeDocument('***.111.111-**'), '');
  assert.equal(movement(tx({ ownTransfer: true }), bank).kind, 'TRANSFER');
});
