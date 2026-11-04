import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditEvidencePage,
  buildSpendingAudit
} from '../src/lib/spending-audit.ts';

const transaction = (overrides = {}) => ({
  id: 'purchase',
  date: '2026-11-04',
  description: 'Compra sintética',
  category: 'FOOD',
  categoryLabel: 'Alimentação',
  paymentMethodLabel: 'Débito',
  kind: 'EXPENSE',
  amount: 10,
  accountName: 'Conta sintética',
  status: 'PAID',
  ...overrides
});
const dashboard = (items = [], overrides = {}) => ({
  mode: 'live',
  month: '2026-11',
  transactions: { items, total: items.length },
  ...overrides
});
const auditOf = (items, overrides) => {
  const audit = buildSpendingAudit(dashboard(items, overrides));
  assert.equal(audit.available, true);
  return audit;
};
const groupOf = (audit, key) => audit.groups.find((group) => group.key === key);

test('pendências positivas e negativas não se anulam e ficam fora de confirmado', () => {
  const audit = auditOf([
    transaction({
      id: 'pending-purchase',
      status: 'PENDING',
      amount: 100.01,
      category: 'OTHER'
    }),
    transaction({
      id: 'pending-refund',
      status: 'PENDING',
      amount: -100.01,
      category: 'OTHER'
    }),
    transaction({ id: 'pending-zero', status: 'PENDING', amount: 0 })
  ]);
  const pending = groupOf(audit, 'pending');
  assert.equal(pending.count, 3);
  assert.equal(pending.purchasesCents, 10001);
  assert.equal(pending.refundsCents, 10001);
  assert.equal(groupOf(audit, 'categories').count, 0);
  assert.equal(groupOf(audit, 'refunds').count, 0);
});

test('estornos PAID e POSTED reduzem despesas; OTHER pertence a dois grupos sem total global', () => {
  const audit = auditOf([
    transaction({ id: 'broad-purchase', category: 'OTHER', amount: 80.15 }),
    transaction({ id: 'paid-refund', category: 'OTHER', amount: -20.05 }),
    transaction({ id: 'posted-refund', status: 'POSTED', amount: -5.01 })
  ]);
  const categories = groupOf(audit, 'categories');
  assert.equal(categories.count, 2);
  assert.equal(categories.purchasesCents, 8015);
  assert.equal(categories.refundsCents, 2005);
  assert.equal(categories.netCents, 6010);
  const refunds = groupOf(audit, 'refunds');
  assert.equal(refunds.count, 2);
  assert.equal(refunds.refundsCents, 2506);
  assert.equal(refunds.netCents, -2506);
  assert.ok(refunds.items.some((item) => categories.items.includes(item)));
  assert.equal('total' in audit, false);
  assert.equal('problemTotal' in audit, false);
});

test('categoria ampla usa código ou marcador explícito; descrição não reclassifica', () => {
  const audit = auditOf([
    transaction({ id: 'other', category: 'OTHER', categoryLabel: 'Outros' }),
    transaction({ id: 'empty-category', category: '  ' }),
    transaction({ id: 'empty-label', categoryLabel: '  ' }),
    transaction({ id: 'marker', categoryLabel: '  sEM CATEGORIA  ' }),
    transaction({
      id: 'specific',
      description: 'Outros sem categoria',
      category: 'FOOD',
      categoryLabel: 'Alimentação'
    }),
    transaction({
      id: 'similar-label',
      category: 'FOOD',
      categoryLabel: 'Sem categoria adicional'
    }),
    transaction({
      id: 'specific-label',
      category: 'FOOD',
      categoryLabel: 'Outros'
    })
  ]);
  assert.deepEqual(
    groupOf(audit, 'categories').items.map((item) => item.id),
    ['empty-category', 'empty-label', 'marker', 'other']
  );
});

test('status desconhecido, cancelados, renda, transferência e meses externos não contaminam grupos', () => {
  const audit = auditOf([
    transaction({
      id: 'unknown',
      status: 'FUTURE',
      category: 'OTHER',
      amount: -100
    }),
    transaction({ id: 'wrong-case', status: 'paid', category: 'OTHER' }),
    transaction({
      id: 'cancelled',
      status: 'CANCELLED',
      category: 'OTHER',
      amount: -100
    }),
    transaction({ id: 'canceled', status: 'CANCELED', category: 'OTHER' }),
    transaction({
      id: 'income',
      kind: 'INCOME',
      category: 'OTHER',
      amount: -100
    }),
    transaction({
      id: 'transfer',
      kind: 'TRANSFER',
      status: 'PENDING',
      amount: 100
    }),
    transaction({ id: 'last-month', date: '2026-10-31', category: 'OTHER' }),
    transaction({ id: 'next-month', date: '2026-12-01', status: 'FUTURE' }),
    transaction({
      id: 'valid',
      date: '2026-11-30',
      category: 'OTHER',
      amount: 0.01
    })
  ]);
  assert.equal(audit.unknownStatusCount, 2);
  assert.equal(audit.cancelledCount, 2);
  assert.equal(groupOf(audit, 'pending').count, 0);
  assert.equal(groupOf(audit, 'refunds').count, 0);
  assert.equal(groupOf(audit, 'categories').count, 1);
  assert.equal(groupOf(audit, 'categories').netCents, 1);
});

test('somas usam centavos inteiros por lançamento e estornos podem superar compras', () => {
  const audit = auditOf([
    transaction({ id: 'a', category: 'OTHER', amount: 0.1 }),
    transaction({ id: 'b', category: 'OTHER', amount: 0.2 }),
    transaction({ id: 'c', category: 'OTHER', amount: -0.31 })
  ]);
  assert.equal(groupOf(audit, 'categories').purchasesCents, 30);
  assert.equal(groupOf(audit, 'categories').refundsCents, 31);
  assert.equal(groupOf(audit, 'categories').netCents, -1);
});

test('base vazia é válida; base indisponível, parcial, duplicada ou inválida não fornece zeros', () => {
  assert.ok(auditOf([]).groups.every((group) => group.count === 0));
  const malformed = [
    dashboard([], { mode: 'unconfigured' }),
    dashboard([], { month: '2026-13' }),
    dashboard([], { month: '2026-1' }),
    dashboard([], { month: '0000-11' }),
    dashboard([], { month: '2026-11-extra' }),
    dashboard([], { transactions: undefined }),
    dashboard([], { transactions: { items: [], total: 1 } }),
    dashboard([], { transactions: { items: [transaction()], total: 0 } }),
    dashboard([], { transactions: { items: [], total: NaN } }),
    dashboard([transaction(), transaction()]),
    dashboard([transaction({ id: ' ' })]),
    dashboard([transaction({ amount: NaN })]),
    dashboard([transaction({ amount: Infinity })]),
    dashboard([transaction({ amount: -Infinity })]),
    dashboard([transaction({ amount: 1e20 })]),
    dashboard([transaction({ date: '2026-11-31' })]),
    dashboard([transaction({ date: '2026-11-04-bad' })]),
    dashboard([
      transaction({ id: 'a', category: 'OTHER', amount: 50_000_000_000_000 }),
      transaction({ id: 'b', category: 'OTHER', amount: 50_000_000_000_000 })
    ])
  ];
  for (const input of malformed) {
    const audit = buildSpendingAudit(input);
    assert.equal(audit.available, false);
    assert.ok(audit.reason);
    assert.equal('groups' in audit, false);
  }
});

test('payload com campos ausentes ou tipos inválidos retorna indisponível sem derrubar a página', () => {
  for (const field of [
    'kind',
    'status',
    'category',
    'categoryLabel',
    'description'
  ]) {
    for (const value of [undefined, null, 7, {}]) {
      const audit = buildSpendingAudit(
        dashboard([transaction({ [field]: value })])
      );
      assert.equal(audit.available, false, `${field}: ${String(value)}`);
      assert.equal('groups' in audit, false);
    }
  }
  for (const field of ['accountId', 'accountName']) {
    for (const value of [null, 7, {}]) {
      assert.equal(
        buildSpendingAudit(dashboard([transaction({ [field]: value })]))
          .available,
        false
      );
    }
    assert.equal(
      auditOf([transaction({ [field]: undefined })]).available,
      true
    );
  }
  assert.equal(
    buildSpendingAudit(dashboard([transaction({ kind: 'UNKNOWN' })])).available,
    false
  );
  assert.equal(auditOf([], { source: 'pluggy', syncedAt: 123 }).syncedAt, null);
});

test('evidências são estáveis por data desc/ID e paginação 20 alcança todos os registros sem mutar a entrada', () => {
  const items = Array.from({ length: 45 }, (_, index) =>
    transaction({
      id: `item-${String(index).padStart(2, '0')}`,
      date: index < 25 ? '2026-11-02' : '2026-11-03',
      category: 'OTHER'
    })
  ).reverse();
  const original = [...items];
  const group = groupOf(auditOf(items), 'categories');
  assert.equal(group.items[0].id, 'item-25');
  assert.equal(group.items[20].id, 'item-00');
  const first = auditEvidencePage(group.items, 1);
  const second = auditEvidencePage(group.items, 2);
  const third = auditEvidencePage(group.items, 3);
  assert.equal(first.items.length, 20);
  assert.equal(second.items.length, 20);
  assert.equal(third.items.length, 5);
  assert.equal(first.pages, 3);
  assert.deepEqual(
    [...first.items, ...second.items, ...third.items],
    group.items
  );
  assert.equal(auditEvidencePage(group.items, 999).page, 3);
  for (const requested of [-1, 0, 1.5, NaN, Infinity])
    assert.equal(auditEvidencePage(group.items, requested).page, 1);
  assert.deepEqual(auditEvidencePage([], 9), { page: 1, pages: 1, items: [] });
  assert.deepEqual(items, original);
});

test('links são reais para Go/cloud e consulta cloud não inventa disponibilidade ou frescor', () => {
  const go = auditOf([]);
  assert.equal(go.transactionsHref, '/transacoes?month=2026-11&flow=EXPENSE');
  assert.equal(go.classificationHref, '/classificar?month=2026-11');
  assert.equal(go.cloud, false);
  assert.equal(go.syncedAt, null);
  const cloud = auditOf([], {
    source: 'pluggy',
    syncedAt: '2020-01-01T12:00:00Z'
  });
  assert.equal(cloud.transactionsHref, go.transactionsHref);
  assert.equal(cloud.classificationHref, null);
  assert.equal(cloud.cloud, true);
  assert.equal(cloud.syncedAt, '2020-01-01T12:00:00Z');
  assert.equal(
    auditOf([], { source: 'pluggy', syncedAt: 'invalid' }).syncedAt,
    null
  );
  assert.equal(auditOf([], { source: 'pluggy' }).syncedAt, null);
});
