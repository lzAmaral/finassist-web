import type { Dashboard, Transaction } from './finance.ts';

export type AuditGroupKey = 'pending' | 'categories' | 'refunds';

export interface AuditGroup {
  key: AuditGroupKey;
  title: string;
  count: number;
  purchasesCents: number;
  refundsCents: number;
  netCents: number;
  items: Transaction[];
}

export type SpendingAudit =
  | { available: false; reason: string }
  | {
      available: true;
      groups: AuditGroup[];
      unknownStatusCount: number;
      cancelledCount: number;
      transactionsHref: string;
      classificationHref: string | null;
      cloud: boolean;
      syncedAt: string | null;
    };

export const AUDIT_PAGE_SIZE = 20;

export function auditEvidencePage(items: Transaction[], requested: number) {
  const pages = Math.max(1, Math.ceil(items.length / AUDIT_PAGE_SIZE));
  const page = Number.isSafeInteger(requested)
    ? Math.min(pages, Math.max(1, requested))
    : 1;
  return {
    page,
    pages,
    items: items.slice((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE)
  };
}

function validMonth(month: string) {
  return /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
}

function broadCategory(transaction: Transaction) {
  const label = transaction.categoryLabel.trim().toLocaleLowerCase('pt-BR');
  return (
    transaction.category === 'OTHER' ||
    transaction.category.trim() === '' ||
    label === '' ||
    label === 'sem categoria'
  );
}

function makeGroup(
  key: AuditGroupKey,
  title: string,
  items: Transaction[]
): AuditGroup {
  let purchasesCents = 0;
  let refundsCents = 0;
  for (const transaction of items) {
    const cents = Math.round(transaction.amount * 100);
    if (cents > 0) purchasesCents += cents;
    else refundsCents -= cents;
  }
  return {
    key,
    title,
    count: items.length,
    purchasesCents,
    refundsCents,
    netCents: purchasesCents - refundsCents,
    items: [...items].sort(
      (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
    )
  };
}

export function buildSpendingAudit(dashboard: Dashboard): SpendingAudit {
  if (dashboard.mode !== 'live')
    return {
      available: false,
      reason: 'A auditoria precisa de uma fonte de dados conectada.'
    };
  if (typeof dashboard.month !== 'string' || !validMonth(dashboard.month))
    return {
      available: false,
      reason:
        'O mês selecionado é inválido. Selecione um mês para conferir a base.'
    };
  const list = dashboard.transactions;
  if (
    !list ||
    !Array.isArray(list.items) ||
    !Number.isSafeInteger(list.total) ||
    list.total !== list.items.length
  )
    return {
      available: false,
      reason:
        'A lista de lançamentos está ausente ou parcial. Recarregue os dados para conferir a base completa disponível.'
    };
  const ids = new Set<string>();
  for (const transaction of list.items) {
    if (
      !transaction ||
      typeof transaction.id !== 'string' ||
      !transaction.id.trim() ||
      ids.has(transaction.id)
    )
      return {
        available: false,
        reason:
          'Há identificadores ausentes ou repetidos nos lançamentos. Recarregue os dados para conferir a base.'
      };
    ids.add(transaction.id);
    if (
      !Number.isFinite(transaction.amount) ||
      !Number.isSafeInteger(Math.round(transaction.amount * 100))
    )
      return {
        available: false,
        reason:
          'Há valores inválidos nos lançamentos. A auditoria não pode calcular esta base.'
      };
    if (typeof transaction.date !== 'string' || !validDate(transaction.date))
      return {
        available: false,
        reason:
          'Há datas inválidas nos lançamentos. A auditoria não pode delimitar esta base.'
      };
    if (
      !['EXPENSE', 'INCOME', 'TRANSFER'].includes(transaction.kind) ||
      typeof transaction.status !== 'string' ||
      typeof transaction.category !== 'string' ||
      typeof transaction.categoryLabel !== 'string' ||
      typeof transaction.description !== 'string' ||
      (transaction.accountId !== undefined &&
        typeof transaction.accountId !== 'string') ||
      (transaction.accountName !== undefined &&
        typeof transaction.accountName !== 'string')
    )
      return {
        available: false,
        reason:
          'Há campos inválidos nos lançamentos. Recarregue os dados para conferir a base.'
      };
  }
  const expenses = list.items.filter(
    (t) => t.kind === 'EXPENSE' && t.date.slice(0, 7) === dashboard.month
  );
  const confirmed = expenses.filter(
    (t) => t.status === 'POSTED' || t.status === 'PAID'
  );
  const groups = [
    makeGroup(
      'pending',
      'Pendentes, fora dos gastos confirmados',
      expenses.filter((t) => t.status === 'PENDING')
    ),
    makeGroup(
      'categories',
      'Outros ou sem categoria',
      confirmed.filter(broadCategory)
    ),
    makeGroup(
      'refunds',
      'Estornos confirmados',
      confirmed.filter((t) => t.amount < 0)
    )
  ];
  if (
    groups.some(
      (group) =>
        ![group.purchasesCents, group.refundsCents, group.netCents].every(
          Number.isSafeInteger
        )
    )
  )
    return {
      available: false,
      reason:
        'Os valores ultrapassam a precisão disponível para esta auditoria.'
    };
  const cloud = dashboard.source === 'pluggy';
  return {
    available: true,
    groups,
    unknownStatusCount: expenses.filter(
      (t) =>
        !['POSTED', 'PAID', 'PENDING', 'CANCELLED', 'CANCELED'].includes(
          t.status
        )
    ).length,
    cancelledCount: expenses.filter(
      (t) => t.status === 'CANCELLED' || t.status === 'CANCELED'
    ).length,
    transactionsHref: `/transacoes?month=${encodeURIComponent(dashboard.month)}&flow=EXPENSE`,
    classificationHref: cloud
      ? null
      : `/classificar?month=${encodeURIComponent(dashboard.month)}`,
    cloud,
    syncedAt:
      cloud &&
      typeof dashboard.syncedAt === 'string' &&
      Number.isFinite(Date.parse(dashboard.syncedAt))
        ? dashboard.syncedAt
        : null
  };
}
