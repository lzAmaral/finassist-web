import type { Dashboard, Transaction, Totals } from '#lib/finance.js';

export interface Account {
  id: string;
  itemId: string;
  name: string;
  type: string;
  balance: number;
  currencyCode: string;
  bankData?: { automaticallyInvestedBalance?: number };
}
export interface Movement {
  id: string;
  accountId: string;
  date: string;
  description: string;
  descriptionRaw?: string;
  category?: string;
  amount: number;
  type: string;
  status: string;
  currencyCode: string;
  amountInAccountCurrency?: number;
  providerId?: string;
  ownTransfer?: boolean;
  paymentData?: { paymentMethod?: string };
  creditCardMetadata?: {
    installmentNumber?: number;
    totalInstallments?: number;
    billForecastDate?: string;
  };
}
export interface Snapshot {
  version: 1;
  syncedAt: string;
  items: { id: string; status: string; updatedAt: string | null }[];
  accounts: Account[];
  transactions: Movement[];
}

const categories: [RegExp, string, string][] = [
  [/grocer|supermarket/, 'MARKET', 'Mercado'],
  [/food|restaurant|eating|delivery|bakery/, 'FOOD', 'Alimentação'],
  [
    /transport|automotive|fuel|taxi|ride|parking|vehicle/,
    'TRANSPORT',
    'Transporte'
  ],
  [/health|pharmacy|medical|dental/, 'HEALTH', 'Saúde'],
  [
    /leisure|entertainment|digital services|travel|streaming|gaming/,
    'ENTERTAINMENT',
    'Lazer e serviços'
  ],
  [/shopping|clothing|electronics/, 'SHOPPING', 'Compras'],
  [/education|school|university/, 'EDUCATION', 'Educação'],
  [
    /housing|rent|utilities|electricity|water|internet|telephone/,
    'HOME',
    'Casa e contas'
  ],
  [/taxes|bank fees|interest/, 'FEES', 'Taxas e juros'],
  [/salary/, 'SALARY', 'Salário']
];
const cents = (n: number) => Math.round(n * 100);
const reais = (n: number) => n / 100;
function monthOffset(month: string, offset: number) {
  const date = new Date(`${month}-15T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

// The direction is authoritative: credit cards invert the amount sign.
// Transfers stay visible for reconciliation, but do not inflate income/expenses.
export function movement(t: Movement, account: Account): Transaction | null {
  const rawAmount = t.amountInAccountCurrency ?? t.amount;
  if (
    !t.id ||
    !Number.isFinite(rawAmount) ||
    !Number.isFinite(Date.parse(t.date))
  )
    throw new Error('Movimentação inválida recebida da Pluggy.');
  const card = account.type === 'CREDIT';
  const inflow = t.type === 'CREDIT';
  if (!['DEBIT', 'CREDIT'].includes(t.type))
    throw new Error('Direção de movimentação desconhecida.');
  const category = (t.category ?? '').toLowerCase();
  const description =
    t.description || t.descriptionRaw || 'Movimentação bancária';
  const full = ` ${description} ${t.descriptionRaw ?? ''} `.toLowerCase();
  const billPayment =
    /credit card payment/.test(category) &&
    !/pix/.test(full) &&
    /fatura|cart[aã]o|pagamento recebido|pagamento com saldo| mc|visa|mastercard|elo |amex|hipercard/.test(
      full
    );
  const transfer =
    t.ownTransfer === true ||
    /same person transfer|investment|fixed income|variable income|mutual fund/.test(
      category
    ) ||
    /aplic aut mais/.test(full) ||
    billPayment ||
    (card && inflow && /pagamento|payment|fatura/.test(full));
  const [, key, label] = categories.find(([pattern]) =>
    pattern.test(category)
  ) ?? [null, 'OTHER', t.category || 'Sem categoria'];
  const translatedLabel = /transfer/i.test(label)
    ? 'Transferências'
    : /entrepreneurial/i.test(label)
      ? 'Atividades profissionais'
      : label;
  let date = t.date.slice(0, 10);
  const meta = t.creditCardMetadata;
  let text = description;
  if ((meta?.totalInstallments ?? 0) > 1) {
    text += ` (${meta!.installmentNumber}/${meta!.totalInstallments})`;
    const forecast = meta?.billForecastDate;
    if (forecast && /^\d{4}-(0[1-9]|1[0-2])$/.test(forecast)) {
      const last = new Date(`${forecast}-01T12:00:00Z`);
      last.setUTCMonth(last.getUTCMonth() + 1, 0);
      date = `${forecast}-${String(Math.min(Number(date.slice(8)), last.getUTCDate())).padStart(2, '0')}`;
    }
  }
  // A credit-card refund offsets spending; it is never salary/income.
  const kind = transfer
    ? 'TRANSFER'
    : card
      ? 'EXPENSE'
      : inflow
        ? 'INCOME'
        : 'EXPENSE';
  const amount =
    reais(cents(Math.abs(rawAmount))) * (card && inflow && !transfer ? -1 : 1);
  return {
    id: t.id,
    date,
    description: text,
    category: transfer ? 'TRANSFER' : key,
    categoryLabel: transfer
      ? 'Transferência'
      : inflow && /interest|investment earnings/.test(category)
        ? 'Rendimentos'
        : translatedLabel,
    paymentMethodLabel: card
      ? 'Cartão de crédito'
      : t.paymentData?.paymentMethod || 'Conta bancária',
    kind,
    amount,
    accountName: account.name,
    status: t.status
  };
}

export function dashboardFromSnapshot(
  snapshot: Snapshot,
  month: string
): Dashboard {
  const accounts = new Map(
    snapshot.accounts
      .filter((a) => a.currencyCode === 'BRL')
      .map((a) => [a.id, a])
  );
  const seen = new Set<string>();
  const transactions: Transaction[] = [];
  for (const raw of snapshot.transactions) {
    const account = accounts.get(raw.accountId);
    if (!account) continue;
    // providerId identifies the same bank entry across reconnections; include
    // account name/type to avoid merging the two sides of an own transfer.
    const identity = raw.providerId
      ? `${account.name}:${account.type}:${raw.providerId}:${raw.date}:${raw.amount}`
      : raw.id;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const t = movement(raw, account);
    if (t) transactions.push(t);
  }
  const settled = transactions.filter((t) => t.status === 'POSTED');
  function totals(m: string): Totals {
    const sum = (kind: string) =>
      reais(
        settled
          .filter((t) => t.date.startsWith(m) && t.kind === kind)
          .reduce((n, t) => n + cents(t.amount), 0)
      );
    return { month: m, income: sum('INCOME'), expense: sum('EXPENSE') };
  }
  const groups = new Map<string, number>();
  for (const t of settled.filter(
    (t) => t.date.startsWith(month) && t.kind === 'EXPENSE'
  ))
    groups.set(
      t.categoryLabel,
      (groups.get(t.categoryLabel) ?? 0) + cents(t.amount)
    );
  const institutions = [...accounts.values()].map((a) => ({
    id: a.id,
    name: a.name + (a.type === 'CREDIT' ? ' · Cartão' : ''),
    total: a.type === 'BANK' ? a.balance : null,
    stale: snapshot.items.find((i) => i.id === a.itemId)?.status !== 'UPDATED',
    accounts: [{ id: a.id, name: a.name, balance: a.balance }]
  }));
  const banks = [...accounts.values()].filter((a) => a.type === 'BANK');
  const bankBalance = banks.length
    ? reais(banks.reduce((n, a) => n + cents(a.balance), 0))
    : null;
  const items = transactions
    .filter((t) => t.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  return {
    mode: 'live',
    source: 'pluggy',
    syncedAt: snapshot.syncedAt,
    month,
    summary: {
      current: totals(month),
      previous: totals(monthOffset(month, -1)),
      bankBalance
    },
    transactions: { items, total: items.length },
    breakdown: [...groups]
      .map(([label, total]) => ({ key: label, label, total: reais(total) }))
      .filter((g) => g.total > 0)
      .sort((a, b) => b.total - a.total),
    series: Array.from({ length: 6 }, (_, i) =>
      totals(monthOffset(month, i - 5))
    ),
    balances: { totalInAccount: bankBalance, institutions },
    budget: { items: [] },
    goals: { goals: [] }
  };
}
