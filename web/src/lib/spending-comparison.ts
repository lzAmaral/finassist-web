import type { Dashboard, Transaction } from './finance.js';

export interface PreviousSpendingPeriod {
  month: string;
  transactions: Dashboard['transactions'];
}

type UnavailableReason =
  | 'configuration'
  | 'invalid-month'
  | 'invalid-reference-date'
  | 'previous-unavailable'
  | 'previous-month'
  | 'missing-list'
  | 'partial-list'
  | 'duplicate-id'
  | 'invalid-transaction'
  | 'unsafe-total'
  | 'missing-sync'
  | 'stale-sync';

export interface SpendingWindow {
  start: string;
  end: string;
  amount: number;
  expenseCount: number;
}

export type SpendingComparison =
  | { status: 'unavailable'; reason: UnavailableReason }
  | { status: 'future' }
  | {
      status: 'available' | 'empty';
      period: 'equivalent-days' | 'complete-months';
      current: SpendingWindow;
      previous: SpendingWindow;
      delta: number;
      percentage: number | null;
      consultedOn: string | null;
      syncLimited: boolean;
    };

function validMonth(value: unknown): value is string {
  return (
    typeof value === 'string' && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value)
  );
}

function daysInMonth(month: string): number {
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5));
  if (number === 2)
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(number) ? 30 : 31;
}

function validDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    validMonth(value.slice(0, 7)) &&
    Number(value.slice(8)) >= 1 &&
    Number(value.slice(8)) <= daysInMonth(value.slice(0, 7))
  );
}

function previousMonth(month: string): string {
  const year = Number(month.slice(0, 4));
  const number = Number(month.slice(5));
  return number === 1
    ? `${String(year - 1).padStart(4, '0')}-12`
    : `${month.slice(0, 4)}-${String(number - 1).padStart(2, '0')}`;
}

function localSyncDate(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value
    ) ||
    !validDate(value.slice(0, 10))
  )
    return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const part = (name: string) =>
    parts.find((entry) => entry.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function validateList(
  list: Dashboard['transactions']
): UnavailableReason | null {
  if (!list || !Array.isArray(list.items)) return 'missing-list';
  if (
    !Number.isSafeInteger(list.total) ||
    list.total < 0 ||
    list.total !== list.items.length
  )
    return 'partial-list';
  const ids = new Set<string>();
  for (const transaction of list.items) {
    if (
      !transaction ||
      typeof transaction.id !== 'string' ||
      !transaction.id.trim() ||
      !validDate(transaction.date) ||
      !['EXPENSE', 'INCOME', 'TRANSFER'].includes(transaction.kind) ||
      typeof transaction.status !== 'string' ||
      !transaction.status ||
      typeof transaction.amount !== 'number' ||
      !Number.isFinite(transaction.amount) ||
      !Number.isSafeInteger(Math.round(transaction.amount * 100))
    )
      return 'invalid-transaction';
    if (ids.has(transaction.id)) return 'duplicate-id';
    ids.add(transaction.id);
  }
  return null;
}

function aggregate(items: Transaction[], month: string, lastDay: number) {
  const end = `${month}-${String(lastDay).padStart(2, '0')}`;
  let cents = 0;
  let expenseCount = 0;
  for (const transaction of items) {
    if (
      transaction.date.slice(0, 7) !== month ||
      transaction.date > end ||
      transaction.kind !== 'EXPENSE' ||
      !['POSTED', 'PAID'].includes(transaction.status)
    )
      continue;
    cents += Math.round(transaction.amount * 100);
    if (!Number.isSafeInteger(cents)) return null;
    expenseCount++;
  }
  return {
    cents,
    window: {
      start: `${month}-01`,
      end,
      expenseCount,
      amount: cents === 0 ? 0 : cents / 100
    }
  };
}

export function compareSpendingPeriods(
  dashboard: Dashboard,
  previous: PreviousSpendingPeriod | null,
  referenceDate: string
): SpendingComparison {
  const unavailable = (reason: UnavailableReason): SpendingComparison => ({
    status: 'unavailable',
    reason
  });
  if (dashboard.mode !== 'live') return unavailable('configuration');
  if (!validMonth(dashboard.month)) return unavailable('invalid-month');
  if (!validDate(referenceDate)) return unavailable('invalid-reference-date');
  const currentMonth = referenceDate.slice(0, 7);
  if (dashboard.month > currentMonth) return { status: 'future' };
  if (!previous) return unavailable('previous-unavailable');
  if (
    !validMonth(previous.month) ||
    previous.month !== previousMonth(dashboard.month)
  )
    return unavailable('previous-month');
  const listError =
    validateList(dashboard.transactions) ?? validateList(previous.transactions);
  if (listError) return unavailable(listError);

  const isCurrent = dashboard.month === currentMonth;
  const consultedOn =
    dashboard.source === 'pluggy' ? localSyncDate(dashboard.syncedAt) : null;
  let cutoff = Number(referenceDate.slice(8));
  let syncLimited = false;
  if (isCurrent && dashboard.source === 'pluggy') {
    if (!consultedOn) return unavailable('missing-sync');
    if (consultedOn < `${dashboard.month}-01`) return unavailable('stale-sync');
    if (consultedOn < referenceDate) {
      cutoff = Number(consultedOn.slice(8));
      syncLimited = true;
    }
  }
  const equivalentDays = Math.min(cutoff, daysInMonth(previous.month));
  const current = aggregate(
    dashboard.transactions.items,
    dashboard.month,
    isCurrent ? equivalentDays : daysInMonth(dashboard.month)
  );
  const prior = aggregate(
    previous.transactions.items,
    previous.month,
    isCurrent ? equivalentDays : daysInMonth(previous.month)
  );
  if (!current || !prior || !Number.isSafeInteger(current.cents - prior.cents))
    return unavailable('unsafe-total');
  const hasBase =
    current.window.expenseCount > 0 && prior.window.expenseCount > 0;
  const deltaCents = current.cents - prior.cents;
  return {
    status: hasBase ? 'available' : 'empty',
    period: isCurrent ? 'equivalent-days' : 'complete-months',
    current: current.window,
    previous: prior.window,
    delta: deltaCents === 0 ? 0 : deltaCents / 100,
    percentage:
      hasBase && prior.cents > 0 ? (deltaCents / prior.cents) * 100 : null,
    consultedOn,
    syncLimited
  };
}
