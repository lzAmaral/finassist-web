import type { Transaction } from './finance.ts';

export type CashFlow = 'all' | 'INCOME' | 'EXPENSE';

export function cashFlowTransactions(
  transactions: Transaction[],
  {
    flow = 'all',
    search = '',
    category = '',
    account = ''
  }: {
    flow?: CashFlow;
    search?: string;
    category?: string;
    account?: string;
  } = {}
) {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');
  const query = normalize(search.trim());
  return transactions
    .filter(
      (transaction) =>
        transaction.kind !== 'TRANSFER' &&
        (flow === 'all' || transaction.kind === flow) &&
        (!category || transaction.categoryLabel === category) &&
        (!account || transactionAccount(transaction) === account) &&
        normalize(
          `${transaction.description} ${transaction.categoryLabel} ${transaction.accountName ?? ''}`
        ).includes(query)
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

// A card refund reduces expenses; it must not move into income or show two minus signs.
export function cashFlowSign(transaction: Transaction) {
  return (transaction.kind === 'INCOME'
    ? transaction.amount
    : -transaction.amount) < 0
    ? '−'
    : '+';
}

export function transactionAccount(transaction: Transaction) {
  return transaction.accountId ?? transaction.accountName ?? 'manual';
}

export const TRANSACTION_PAGE_SIZE = 50;

export function transactionPage(items: Transaction[], requested: number) {
  const pages = Math.max(1, Math.ceil(items.length / TRANSACTION_PAGE_SIZE));
  const page = Number.isSafeInteger(requested)
    ? Math.min(pages, Math.max(1, requested))
    : 1;
  return {
    page,
    pages,
    items: items.slice(
      (page - 1) * TRANSACTION_PAGE_SIZE,
      page * TRANSACTION_PAGE_SIZE
    )
  };
}

export function transactionURL(
  current: string | { href: string },
  changes: Record<string, string | number>
) {
  const next = new URL(typeof current === 'string' ? current : current.href);
  for (const [key, value] of Object.entries(changes)) {
    if (String(value)) next.searchParams.set(key, String(value));
    else next.searchParams.delete(key);
  }
  return next;
}

export function transactionsCSV(transactions: Transaction[]) {
  const cell = (value: unknown) =>
    `"${String(value)
      .replace(/^\s*[=+@-]/, "'$&")
      .replaceAll('"', '""')}"`;
  return (
    '\uFEFF' +
    [
      ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Conta', 'ID'],
      ...transactions.map((transaction) => [
        transaction.date,
        transaction.description,
        transaction.categoryLabel,
        transaction.kind,
        transaction.amount.toFixed(2),
        transaction.accountName ?? 'Manual',
        transaction.id
      ])
    ]
      .map((row) => row.map(cell).join(';'))
      .join('\r\n')
  );
}
