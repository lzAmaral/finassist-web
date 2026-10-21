export interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  categoryLabel: string;
  paymentMethodLabel: string;
  kind: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  amount: number;
  accountName?: string;
  status: string;
}
export interface Totals {
  month: string;
  income: number;
  expense: number;
}
export interface Dashboard {
  mode: 'unconfigured' | 'live';
  source?: 'pluggy';
  syncedAt?: string;
  daily?: { day: string; income: number; expense: number }[];
  accountSpending?: { label: string; total: number }[];
  month: string;
  summary: { current: Totals; previous: Totals; bankBalance: number | null };
  transactions: { items: Transaction[]; total: number };
  breakdown: { key: string; label: string; total: number }[];
  series: Totals[];
  balances: {
    totalInAccount: number | null;
    institutions: {
      id: string;
      name: string;
      total: number | null;
      stale: boolean;
      accounts: { id: string; name: string; balance: number }[];
    }[];
  };
  budget: {
    items: {
      key: string;
      label: string;
      categoryLabel: string;
      class: string;
      total: number;
      paid: boolean;
    }[];
  };
  goals: {
    goals: {
      id: string;
      name: string;
      current: number;
      target: number;
      done: boolean;
    }[];
  };
}
export const money = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    value
  );
export const monthLabel = (month: string) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
export function shiftMonth(month: string, offset: number) {
  const d = new Date(`${month}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
}
export const percent = (part: number, total: number) =>
  total > 0 ? Math.min(100, Math.max(0, (part / total) * 100)) : 0;
