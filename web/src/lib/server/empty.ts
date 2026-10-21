import type { Dashboard } from '#lib/finance.js';
import { shiftMonth } from '../finance.ts';

// Ausência de conexão não representa saldo zero nem autoriza gerar movimentos.
export function emptyDashboard(month: string): Dashboard {
  return {
    mode: 'unconfigured',
    month,
    summary: {
      current: { month, income: 0, expense: 0 },
      previous: { month: shiftMonth(month, -1), income: 0, expense: 0 },
      bankBalance: null
    },
    transactions: { items: [], total: 0 },
    breakdown: [],
    series: [],
    balances: { totalInAccount: null, institutions: [] },
    budget: { items: [] },
    goals: { goals: [] }
  };
}
