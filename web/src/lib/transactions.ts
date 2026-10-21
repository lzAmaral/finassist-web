import type { Transaction } from './finance.ts';

export type CashFlow = 'all' | 'INCOME' | 'EXPENSE';

export function cashFlowTransactions(
  transactions: Transaction[],
  {
    flow = 'all',
    search = '',
    category = ''
  }: { flow?: CashFlow; search?: string; category?: string } = {}
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
