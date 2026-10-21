import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAllTransactions } from '../src/lib/server/transaction-pages.ts';
import {
  cashFlowTransactions,
  transactionPage,
  transactionURL,
  transactionsCSV
} from '../src/lib/transactions.ts';
import { dashboardFromSnapshot } from '../src/lib/server/finance-data.ts';

const transactions = Array.from({ length: 237 }, (_, i) => ({
  id: `transaction-${String(i).padStart(3, '0')}`,
  date: '2026-10-15',
  description: i === 236 ? 'Almoço especial' : 'Almoço',
  category: 'FOOD',
  categoryLabel: 'Alimentação',
  paymentMethodLabel: 'Débito',
  accountId: i % 2 ? 'bank-b' : 'bank-a',
  accountName: 'Banco',
  kind: i % 3 ? 'EXPENSE' : 'INCOME',
  amount: i + 0.25,
  status: 'POSTED'
}));
const response = (page, items = transactions, overrides = {}) => ({
  items: items.slice((page - 1) * 100, page * 100),
  total: items.length,
  page,
  limit: 100,
  ...overrides
});

test('Go reads every page and combines search, category, account and flow beyond item 100', async () => {
  const paths = [];
  const result = await loadAllTransactions(async (path) => {
    paths.push(path);
    return response(
      Number(new URL(`http://localhost/${path}`).searchParams.get('page'))
    );
  }, '2026-10');
  assert.equal(result.total, 237);
  assert.equal(new Set(result.items.map((t) => t.id)).size, 237);
  assert.equal(
    result.items.reduce((sum, t) => sum + t.amount, 0),
    28025.25
  );
  assert.deepEqual(
    paths.map((path) =>
      new URL(`http://localhost/${path}`).searchParams.get('month')
    ),
    ['2026-10', '2026-10', '2026-10']
  );
  const filtered = cashFlowTransactions(result.items, {
    search: 'ALMOCO ESPECIAL',
    category: 'Alimentação',
    account: 'bank-a',
    flow: 'EXPENSE'
  });
  assert.deepEqual(
    filtered.map((t) => t.id),
    ['transaction-236']
  );
  assert.equal(
    cashFlowTransactions(result.items, { search: 'inexistente' }).length,
    0
  );
  assert.equal(
    cashFlowTransactions(result.items, {
      account: 'bank-b',
      search: 'especial'
    }).length,
    0
  );
});

test('CSV covers every filtered result while the table renders 50 per page in stable order', () => {
  const filtered = cashFlowTransactions([...transactions].reverse(), {
    flow: 'EXPENSE'
  });
  const second = transactionPage(filtered, 2);
  assert.equal(second.items.length, 50);
  assert.equal(filtered.length, 158);
  assert.equal(second.items[0].id, filtered[50].id);
  const csv = transactionsCSV(filtered);
  const rows = csv.split('\r\n');
  assert.equal(rows.length, 159);
  assert.equal(
    new Set(rows.slice(1).map((row) => row.split(';').at(-1))).size,
    158
  );
  for (const t of filtered) assert.ok(csv.includes(`"${t.id}"`));
  assert.equal(transactionPage(filtered, 999).page, 4);
  assert.equal(transactionPage(filtered, NaN).page, 1);
  assert.equal(transactionPage([], 3).page, 1);
});

test('navigation keeps month and all filters, and filter changes can reset the visible page', () => {
  const current = new URL(
    'http://localhost/transacoes?month=2026-10&q=almoco&category=Alimenta%C3%A7%C3%A3o&account=bank-a&flow=EXPENSE&page=1'
  );
  const next = transactionURL(current, { page: 2 });
  assert.equal(next.searchParams.get('page'), '2');
  for (const key of ['month', 'q', 'category', 'account', 'flow'])
    assert.equal(next.searchParams.get(key), current.searchParams.get(key));
  const changed = transactionURL(next, { q: 'café', page: '' });
  assert.equal(changed.searchParams.has('page'), false);
  assert.equal(changed.searchParams.get('month'), '2026-10');
  assert.equal(current.searchParams.get('page'), '1');
});

test('additional page failures, duplicates, total changes and short pages reject the whole result', async () => {
  const failed = [
    async () => {
      throw new Error('rede indisponível');
    },
    async () =>
      response(2, transactions, {
        items: [transactions[0], ...transactions.slice(101, 200)]
      }),
    async () => response(2, transactions, { total: 236 }),
    async () =>
      response(2, transactions, { items: transactions.slice(100, 180) }),
    async () => response(1),
    async () => ({ items: [], total: -1, page: 2, limit: 100 })
  ];
  for (const second of failed) {
    let calls = 0;
    await assert.rejects(
      loadAllTransactions(
        async () => (++calls === 1 ? response(1) : second()),
        '2026-10'
      )
    );
    assert.equal(calls, 2);
  }
  assert.deepEqual(
    await loadAllTransactions(async () => response(1, []), '2026-10'),
    { items: [], total: 0 }
  );
});

test('cloud snapshot remains complete beyond 100 and retains distinct account identities', () => {
  const result = dashboardFromSnapshot(
    {
      version: 1,
      syncedAt: '2026-10-21T12:00:00Z',
      items: [],
      accounts: ['bank-a', 'bank-b'].map((id) => ({
        id,
        itemId: 'item',
        name: 'Banco',
        type: 'BANK',
        currencyCode: 'BRL',
        balance: 0
      })),
      transactions: transactions.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        amount: -t.amount,
        type: 'DEBIT',
        description: t.description,
        category: 'Food',
        status: 'POSTED',
        date: t.date,
        currencyCode: 'BRL'
      }))
    },
    '2026-10'
  );
  assert.equal(result.transactions.total, 237);
  assert.equal(
    cashFlowTransactions(result.transactions.items, { account: 'bank-a' })
      .length,
    119
  );
  assert.equal(
    transactionsCSV(cashFlowTransactions(result.transactions.items)).split(
      '\r\n'
    ).length,
    238
  );
});

test('CSV escapes quotes, semicolons, newlines and formula prefixes without losing characters', () => {
  const csv = transactionsCSV([
    { ...transactions[0], description: ' =SUM(1;2)\n"texto"' }
  ]);
  assert.ok(csv.includes('"\' =SUM(1;2)\n""texto"""'));
});
