export interface CategoryBudget {
  category: string;
  label: string;
  limitCents: number | null;
  version: number;
  paidCents: number;
  pendingCents: number;
  spentCents: number;
  count: number;
  remainingCents: number | null;
  usagePercent: number | null;
  status: 'no-limit' | 'no-records' | 'within-limit' | 'at-limit' | 'exceeded';
}

export interface CategoryBudgetsData {
  month: string;
  items: CategoryBudget[];
}

export const budgetStatusLabels: Record<CategoryBudget['status'], string> = {
  'no-limit': 'Sem limite definido',
  'no-records': 'Sem despesas registradas',
  'within-limit': 'Dentro do limite registrado',
  'at-limit': 'Limite atingido',
  exceeded: 'Limite ultrapassado'
};

// Conversão exata de entrada decimal; agrupamento e notação científica são ambíguos.
export function parseBudgetCents(raw: string): number | null {
  const match = /^(\d{1,10})(?:[,.](\d{1,2}))?$/.exec(raw.trim());
  if (!match) return null;
  const cents =
    Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return cents <= 100_000_000_000 ? cents : null;
}

export function budgetInputValue(cents: number | null): string {
  return cents === null
    ? ''
    : `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
}
