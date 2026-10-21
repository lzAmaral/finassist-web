import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cashFlowTransactions, cashFlowSign } from '../src/lib/transactions.ts';
import { dashboardFromSnapshot } from '../src/lib/server/finance-data.ts';
import { ownTransfer } from '../src/lib/server/own-transfer.ts';

const account = (id, type = 'BANK') => ({
  id,
  itemId: 'item',
  name: id,
  type,
  currencyCode: 'BRL',
  balance: 100
});
const movement = (id, accountId, amount, type, overrides = {}) => ({
  id,
  accountId,
  amount,
  type,
  category: 'Transfer - PIX',
  description: id,
  status: 'POSTED',
  date: '2026-10-05T12:00:00Z',
  currencyCode: 'BRL',
  ...overrides
});

test('salary moved between own banks and back to pay a card counts income and purchases only once', () => {
  const result = dashboardFromSnapshot(
    {
      version: 1,
      syncedAt: '2026-10-21T12:00:00Z',
      items: [],
      accounts: [
        account('Itaú'),
        account('Mercado Pago'),
        account('Cartão', 'CREDIT')
      ],
      transactions: [
        movement('salary', 'Itaú', 5000, 'CREDIT', { category: 'Salary' }),
        movement('to-mp', 'Itaú', -5000, 'DEBIT', { ownTransfer: true }),
        movement('from-itau', 'Mercado Pago', 5000, 'CREDIT', {
          ownTransfer: true
        }),
        movement('back-to-itau', 'Mercado Pago', -1000, 'DEBIT', {
          ownTransfer: true
        }),
        movement('from-mp', 'Itaú', 1000, 'CREDIT', { ownTransfer: true }),
        movement('bank-bill', 'Itaú', -1000, 'DEBIT', {
          category: 'Credit card payment',
          description: 'Pagamento de fatura cartão'
        }),
        movement('card-bill', 'Cartão', -1000, 'CREDIT', {
          description: 'Pagamento recebido'
        }),
        movement('purchase', 'Cartão', 1000, 'DEBIT', { category: 'Shopping' }),
        movement('friend-pix', 'Mercado Pago', -7, 'DEBIT'),
        movement('received-pix', 'Mercado Pago', 400, 'CREDIT'),
        movement('refund', 'Cartão', -50, 'CREDIT', {
          category: 'Shopping',
          description: 'Estorno'
        }),
        movement('pending', 'Mercado Pago', -200, 'DEBIT', {
          status: 'PENDING'
        })
      ]
    },
    '2026-10'
  );
  assert.equal(result.summary.current.income, 5400);
  assert.equal(result.summary.current.expense, 957);
  const visible = cashFlowTransactions(result.transactions.items);
  assert.deepEqual(visible.map((t) => t.id).sort(), [
    'friend-pix',
    'pending',
    'purchase',
    'received-pix',
    'refund',
    'salary'
  ]);
  assert.equal(
    cashFlowTransactions(result.transactions.items, { flow: 'INCOME' }).length,
    2
  );
  assert.equal(
    cashFlowTransactions(result.transactions.items, { flow: 'EXPENSE' }).length,
    4
  );
  assert.equal(
    result.transactions.items.length,
    12,
    'raw records remain available for reconciliation'
  );
  assert.equal(result.daily.at(-1).expense, 957);
});

test('own-transfer identity is checked on the receiving party for debits and paying party for credits', () => {
  const owner = { documentNumber: { value: '11111111111' } };
  const other = { documentNumber: { value: '22222222222' } };
  const documents = new Set(['11111111111']);
  for (const type of ['DEBIT', 'CREDIT']) {
    const party = type === 'DEBIT' ? 'receiver' : 'payer';
    assert.equal(
      ownTransfer(
        { type, category: 'Transfer - PIX', paymentData: { [party]: owner } },
        documents,
        new Set()
      ),
      true
    );
    assert.equal(
      ownTransfer(
        { type, category: 'Transfer - PIX', paymentData: { [party]: other } },
        documents,
        new Set()
      ),
      false
    );
  }
});

test('search, category and direction never reintroduce internal transfers, even when they are the newest records', () => {
  const transactions = [
    {
      id: 'own',
      date: '2026-10-21',
      kind: 'TRANSFER',
      description: 'Pix próprio',
      accountName: 'Itaú',
      categoryLabel: 'Transferência'
    },
    {
      id: 'b',
      date: '2026-10-19',
      kind: 'EXPENSE',
      description: 'Almoço',
      accountName: 'Itaú',
      categoryLabel: 'Alimentação'
    },
    {
      id: 'a',
      date: '2026-10-20',
      kind: 'INCOME',
      description: 'Salário',
      accountName: 'Itaú',
      categoryLabel: 'Salário'
    }
  ];
  assert.deepEqual(
    cashFlowTransactions(transactions).map((t) => t.id),
    ['a', 'b']
  );
  assert.deepEqual(
    cashFlowTransactions(transactions, {
      flow: 'EXPENSE',
      search: 'ITAU',
      category: 'Alimentação'
    }).map((t) => t.id),
    ['b']
  );
  assert.equal(
    cashFlowTransactions(transactions, { search: 'próprio' }).length,
    0
  );
  assert.deepEqual(
    transactions.map((t) => t.id),
    ['own', 'b', 'a']
  );
});

test('refunds stay in expenses and display a credit sign without duplicating minus signs', () => {
  assert.equal(cashFlowSign({ kind: 'EXPENSE', amount: 7 }), '−');
  assert.equal(cashFlowSign({ kind: 'EXPENSE', amount: -50 }), '+');
  assert.equal(cashFlowSign({ kind: 'INCOME', amount: 400 }), '+');
});
