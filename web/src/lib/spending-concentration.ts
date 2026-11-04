import type { Dashboard, Transaction } from './finance.ts';
import { transactionAccount } from './transactions.ts';

export const CONCENTRATION_GROUP_LIMIT = 5;
export const CONCENTRATION_EVIDENCE_PAGE_SIZE = 20;

export interface ConcentrationGroup {
  key: string;
  accountKey: string;
  accountLabel: string;
  description: string;
  purchasesCents: number;
  refundsCents: number;
  netCents: number;
  purchaseCount: number;
  refundCount: number;
  zeroCount: number;
  sharePercent: number | null;
  evidence: Transaction[];
}

export type SpendingConcentration =
  | {
      available: false;
      reason:
        'unconfigured' | 'invalid-month' | 'incomplete' | 'invalid-content';
    }
  | {
      available: true;
      groups: ConcentrationGroup[];
      purchasesCents: number;
      refundsCents: number;
      netCents: number;
    };

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const validMonth = (month: unknown): month is string =>
  typeof month === 'string' &&
  /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(month) &&
  !month.startsWith('0000');

function validTransaction(t: Transaction): boolean {
  return (
    !!t &&
    typeof t === 'object' &&
    typeof t.id === 'string' &&
    t.id.trim().length > 0 &&
    typeof t.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
    Number.isFinite(Date.parse(`${t.date}T12:00:00Z`)) &&
    new Date(`${t.date}T12:00:00Z`).toISOString().slice(0, 10) === t.date &&
    typeof t.description === 'string' &&
    ['EXPENSE', 'INCOME', 'TRANSFER'].includes(t.kind) &&
    typeof t.status === 'string' &&
    t.status.trim().length > 0 &&
    typeof t.amount === 'number' &&
    Number.isFinite(t.amount) &&
    Number.isSafeInteger(Math.round(t.amount * 100)) &&
    (t.accountId === undefined || typeof t.accountId === 'string') &&
    (t.accountName === undefined || typeof t.accountName === 'string')
  );
}

export function concentrationAccountLabel(transaction: Transaction): string {
  return transaction.accountName || transaction.accountId || 'Manual';
}

export function spendingConcentration(
  dashboard: Dashboard
): SpendingConcentration {
  if (dashboard.mode !== 'live')
    return { available: false, reason: 'unconfigured' };
  if (!validMonth(dashboard.month))
    return { available: false, reason: 'invalid-month' };
  const transactions = dashboard.transactions;
  if (
    !transactions ||
    !Array.isArray(transactions.items) ||
    !Number.isSafeInteger(transactions.total) ||
    transactions.total < 0
  ) {
    return { available: false, reason: 'invalid-content' };
  }
  if (transactions.total !== transactions.items.length) {
    return { available: false, reason: 'incomplete' };
  }
  const ids = new Set<string>();
  for (const transaction of transactions.items) {
    if (!validTransaction(transaction) || ids.has(transaction.id)) {
      return { available: false, reason: 'invalid-content' };
    }
    ids.add(transaction.id);
  }

  const byKey = new Map<string, ConcentrationGroup>();
  const namedGroups = new Set<string>();
  let purchasesCents = 0,
    refundsCents = 0;
  for (const transaction of transactions.items) {
    if (
      transaction.date.slice(0, 7) !== dashboard.month ||
      transaction.kind !== 'EXPENSE' ||
      !['POSTED', 'PAID'].includes(transaction.status)
    )
      continue;
    const accountKey = transactionAccount(transaction);
    const key = JSON.stringify([accountKey, transaction.description]);
    let group = byKey.get(key);
    if (!group) {
      group = {
        key,
        accountKey,
        accountLabel: concentrationAccountLabel(transaction),
        description: transaction.description,
        purchasesCents: 0,
        refundsCents: 0,
        netCents: 0,
        purchaseCount: 0,
        refundCount: 0,
        zeroCount: 0,
        sharePercent: null,
        evidence: []
      };
      byKey.set(key, group);
    }
    const cents = Math.round(transaction.amount * 100);
    if (cents > 0) {
      group.purchasesCents += cents;
      purchasesCents += cents;
      group.purchaseCount++;
    } else if (cents < 0) {
      group.refundsCents -= cents;
      refundsCents -= cents;
      group.refundCount++;
    } else group.zeroCount++;
    if (
      !Number.isSafeInteger(purchasesCents) ||
      !Number.isSafeInteger(refundsCents)
    ) {
      return { available: false, reason: 'invalid-content' };
    }
    group.evidence.push(transaction);
    // Prefere nomes disponíveis; divergências de rótulo não tornam o resultado dependente da ordem da fonte.
    const label = concentrationAccountLabel(transaction);
    if (transaction.accountName) {
      if (!namedGroups.has(key) || compare(label, group.accountLabel) < 0) {
        group.accountLabel = label;
      }
      namedGroups.add(key);
    } else if (
      !namedGroups.has(key) &&
      compare(label, group.accountLabel) < 0
    ) {
      group.accountLabel = label;
    }
  }
  const groups = [...byKey.values()];
  for (const group of groups) {
    group.netCents = group.purchasesCents - group.refundsCents;
    group.sharePercent =
      purchasesCents > 0 ? (group.purchasesCents / purchasesCents) * 100 : null;
    group.evidence.sort(
      (a, b) => compare(b.date, a.date) || compare(a.id, b.id)
    );
  }
  groups.sort(
    (a, b) =>
      b.purchasesCents - a.purchasesCents ||
      compare(a.description, b.description) ||
      compare(a.accountKey, b.accountKey)
  );
  return {
    available: true,
    groups,
    purchasesCents,
    refundsCents,
    netCents: purchasesCents - refundsCents
  };
}

export function concentrationGroups(
  groups: ConcentrationGroup[],
  showAll = false
) {
  return showAll ? groups : groups.slice(0, CONCENTRATION_GROUP_LIMIT);
}

export function concentrationEvidencePage(items: Transaction[], requested = 1) {
  const pages = Math.max(
    1,
    Math.ceil(items.length / CONCENTRATION_EVIDENCE_PAGE_SIZE)
  );
  const page = Number.isSafeInteger(requested)
    ? Math.min(pages, Math.max(1, requested))
    : 1;
  return {
    page,
    pages,
    items: items.slice(
      (page - 1) * CONCENTRATION_EVIDENCE_PAGE_SIZE,
      page * CONCENTRATION_EVIDENCE_PAGE_SIZE
    )
  };
}
