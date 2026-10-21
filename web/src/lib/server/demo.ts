import type { Dashboard, Transaction } from '#lib/finance.js';
import { shiftMonth } from '#lib/finance.js';

const rows: [string, string, string, number, string][] = [
  ['20', 'Mercado da esquina', 'Alimentação', 186.42, 'Conta Verde'],
  ['19', 'Café e companhia', 'Alimentação', 28.5, 'Conta Verde'],
  ['18', 'Spotify', 'Assinaturas', 21.9, 'Conta Roxa'],
  ['17', 'Uber', 'Transporte', 32.8, 'Conta Roxa'],
  ['16', 'Farmácia Central', 'Saúde', 89.9, 'Conta Verde'],
  ['15', 'Projeto freelance', 'Receitas', 1800, 'Conta Verde'],
  ['14', 'Restaurante Quintal', 'Alimentação', 74, 'Conta Roxa'],
  ['12', 'Cinema do bairro', 'Lazer', 58, 'Conta Roxa'],
  ['10', 'Internet', 'Moradia', 119.9, 'Conta Verde'],
  ['09', 'Academia', 'Saúde', 149.9, 'Conta Verde'],
  ['08', 'Supermercado', 'Alimentação', 487.65, 'Conta Verde'],
  ['07', 'Combustível', 'Transporte', 220, 'Conta Verde'],
  ['06', 'Energia elétrica', 'Moradia', 168.42, 'Conta Verde'],
  ['05', 'Salário', 'Receitas', 6500, 'Conta Verde'],
  ['03', 'Aluguel', 'Moradia', 1850, 'Conta Verde'],
  ['02', 'Livraria', 'Educação', 79.9, 'Conta Roxa']
];
function transactions(month: string): Transaction[] {
  const factor = 1 + (Number(month.slice(5)) - 10) * 0.025;
  return rows.map(
    ([day, description, categoryLabel, amount, accountName], i) => ({
      id: `demo-${month}-${i}`,
      date: `${month}-${day}`,
      description,
      category: categoryLabel,
      categoryLabel,
      paymentMethodLabel: 'Débito',
      kind: categoryLabel === 'Receitas' ? 'INCOME' : 'EXPENSE',
      amount:
        Math.round(amount * (categoryLabel === 'Receitas' ? 1 : factor) * 100) /
        100,
      accountName,
      status: 'PAID'
    })
  );
}
function totals(month: string) {
  const tx = transactions(month);
  return {
    month,
    income: tx
      .filter((t) => t.kind === 'INCOME')
      .reduce((n, t) => n + t.amount, 0),
    expense: tx
      .filter((t) => t.kind === 'EXPENSE')
      .reduce((n, t) => n + t.amount, 0)
  };
}
export function demoDashboard(month: string): Dashboard {
  const tx = transactions(month);
  const categories = new Map<string, number>();
  for (const t of tx.filter((t) => t.kind === 'EXPENSE'))
    categories.set(
      t.categoryLabel,
      (categories.get(t.categoryLabel) ?? 0) + t.amount
    );
  return {
    mode: 'demo',
    month,
    summary: {
      current: totals(month),
      previous: totals(shiftMonth(month, -1)),
      bankBalance: 12485.6
    },
    transactions: { items: tx, total: tx.length },
    breakdown: [...categories]
      .map(([label, total]) => ({ key: label, label, total }))
      .sort((a, b) => b.total - a.total),
    series: Array.from({ length: 6 }, (_, i) =>
      totals(shiftMonth(month, i - 5))
    ),
    balances: {
      totalInAccount: 12485.6,
      institutions: [
        {
          id: 'verde',
          name: 'Conta Verde · demonstração',
          total: 9235.6,
          stale: false,
          accounts: [{ id: '1', name: 'Conta corrente', balance: 9235.6 }]
        },
        {
          id: 'roxa',
          name: 'Conta Roxa · demonstração',
          total: 3250,
          stale: false,
          accounts: [{ id: '2', name: 'Conta corrente', balance: 3250 }]
        }
      ]
    },
    budget: {
      items: tx
        .filter((t) => t.kind === 'EXPENSE')
        .map((t) => ({
          key: t.id,
          label: t.description,
          categoryLabel: t.categoryLabel,
          class: [
            'Aluguel',
            'Internet',
            'Energia elétrica',
            'Academia',
            'Spotify'
          ].includes(t.description)
            ? 'FIXED'
            : 'VARIABLE',
          total: t.amount,
          paid: true
        }))
    },
    goals: {
      goals: [
        {
          id: 'reserva',
          name: 'Reserva de emergência',
          current: 12485.6,
          target: 25000,
          done: false
        },
        {
          id: 'viagem',
          name: 'Próxima viagem',
          current: 4200,
          target: 8000,
          done: false
        }
      ]
    }
  };
}
