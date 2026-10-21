import type { Dashboard } from './finance.js';
export interface GeminiAnalysis {
  summary: string;
  observations: string[];
  actions: string[];
  generatedAt: string;
  model: string;
}
export function localAnalysis(dashboard: Dashboard) {
  const { current, previous } = dashboard.summary;
  const surplus = Math.round((current.income - current.expense) * 100) / 100;
  const savingsRate =
    current.income > 0 ? (surplus / current.income) * 100 : null;
  const expenseChange =
    previous.expense > 0
      ? (current.expense / previous.expense - 1) * 100
      : null;
  const top = dashboard.breakdown[0];
  const pending = dashboard.transactions.items.filter(
    (t) => t.status === 'PENDING'
  ).length;
  const transfers = dashboard.transactions.items.filter(
    (t) => t.kind === 'TRANSFER'
  ).length;
  return { surplus, savingsRate, expenseChange, top, pending, transfers };
}
// Only fixed categories and normalized ratios leave the server. No dates, BRL
// amounts, descriptions, names, account identifiers or free-form labels.
export function anonymousIndicators(dashboard: Dashboard) {
  const allowed = new Set([
    'MARKET',
    'FOOD',
    'TRANSPORT',
    'HEALTH',
    'ENTERTAINMENT',
    'SHOPPING',
    'EDUCATION',
    'HOME',
    'FEES'
  ]);
  const buckets = new Map<string, number>();
  for (const t of dashboard.transactions.items) {
    if (t.kind !== 'EXPENSE' || t.status !== 'POSTED') continue;
    const key = allowed.has(t.category) ? t.category : 'OTHER';
    buckets.set(key, (buckets.get(key) ?? 0) + t.amount);
  }
  const stats = localAnalysis(dashboard);
  const ratio = (n: number | null) =>
    n === null ? null : Math.max(-1000, Math.min(1000, Math.round(n)));
  const base = Math.max(
    1,
    ...dashboard.series.map((s) => Math.max(s.income, s.expense))
  );
  return {
    savingsRatePercent: ratio(stats.savingsRate),
    expenseChangePercent: ratio(stats.expenseChange),
    categoryShares: [...buckets]
      .filter(([, n]) => n > 0)
      .map(([category, n]) => ({
        category,
        percent: Math.round(
          (n / Math.max(1, dashboard.summary.current.expense)) * 100
        )
      })),
    trend: dashboard.series.map((s, index) => ({
      period: index + 1,
      incomeIndex: Math.round((s.income / base) * 100),
      expenseIndex: Math.round((s.expense / base) * 100)
    }))
  };
}
