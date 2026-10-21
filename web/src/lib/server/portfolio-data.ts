import type {
  PortfolioState,
  ImportedInvestment,
  AssetClass,
  Position,
  Portfolio
} from '#lib/investments.js';

export class ValidationError extends Error {}
const cent = (n: number) => Math.round(n * 100);
const assetClasses = {
  EQUITY: 'Ações',
  FII: 'Fundos imobiliários',
  ETF: 'ETFs',
  FIXED_INCOME: 'Renda fixa',
  MUTUAL_FUND: 'Fundos de investimento',
  CRYPTO: 'Criptoativos',
  OTHER: 'Outros'
};
export function positionInput(input: unknown) {
  if (!input || typeof input !== 'object')
    throw new ValidationError('Informe os dados do investimento.');
  const p = input as Record<string, unknown>;
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  const ticker =
    typeof p.ticker === 'string' ? p.ticker.trim().toUpperCase() : '';
  if (
    !name ||
    name.length > 100 ||
    ticker.length > 20 ||
    !/^[A-Z0-9.\-]*$/.test(ticker)
  )
    throw new ValidationError('Nome ou código do ativo inválido.');
  if (
    typeof p.assetClass !== 'string' ||
    !Object.hasOwn(assetClasses, p.assetClass)
  )
    throw new ValidationError('Escolha uma classe de investimento.');
  const numeric = (value: unknown) =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1e9;
  if (
    !numeric(p.quantity) ||
    p.quantity === 0 ||
    !numeric(p.averagePrice) ||
    !numeric(p.currentPrice)
  )
    throw new ValidationError('Use quantidades e preços válidos e positivos.');
  const quantity = p.quantity as number,
    averagePrice = p.averagePrice as number,
    currentPrice = p.currentPrice as number;
  if (quantity * Math.max(averagePrice, currentPrice) > 1e12)
    throw new ValidationError('Valor da posição excede o limite.');
  return {
    name,
    ticker,
    assetClass: p.assetClass as AssetClass,
    quantity,
    averagePrice,
    currentPrice,
    cost: cent(quantity * averagePrice) / 100,
    balance: cent(quantity * currentPrice) / 100,
    currency: 'BRL'
  };
}
export function importedPosition(
  i: ImportedInvestment,
  syncedAt: string
): Position {
  const assetClass: AssetClass = /REAL_ESTATE|FII/i.test(i.subtype ?? '')
    ? 'FII'
    : Object.hasOwn(assetClasses, i.type)
      ? (i.type as AssetClass)
      : 'OTHER';
  return {
    id: `pluggy:${i.id}`,
    source: 'pluggy',
    name: i.name,
    assetClass,
    quantity: Number.isFinite(i.quantity) ? i.quantity! : null,
    // Pluggy 'amount' is gross value, NOT acquisition cost. Only amountOriginal
    // can be used as initial capital, when the institution actually provides it.
    cost:
      Number.isFinite(i.amountOriginal) && i.amountOriginal! > 0
        ? i.amountOriginal!
        : null,
    balance: i.balance,
    currency: i.currencyCode || 'BRL',
    updatedAt: i.date || syncedAt
  };
}
export function portfolioView(
  state: PortfolioState,
  imported: ImportedInvestment[],
  importedAt: string | null,
  month: string
): Portfolio {
  const all = [
    ...imported
      .filter((i) => i.status !== 'TOTAL_WITHDRAWAL')
      .map((i) => importedPosition(i, importedAt!)),
    ...state.positions
  ];
  const active = all.filter((p) => !p.archived);
  const positions = active
    .filter((p) => p.currency === 'BRL')
    .sort((a, b) => b.balance - a.balance);
  const sum = (values: number[]) =>
    values.reduce((n, v) => n + cent(v), 0) / 100;
  const total = sum(positions.map((p) => p.balance));
  const withCost = positions.filter((p) => p.cost !== null);
  const knownCost = sum(withCost.map((p) => p.cost!));
  const coveredBalance = sum(withCost.map((p) => p.balance));
  const allocation = Object.entries(assetClasses)
    .map(([key, label]) => {
      const value = sum(
        positions.filter((p) => p.assetClass === key).map((p) => p.balance)
      );
      return {
        key,
        label,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0
      };
    })
    .filter((a) => a.value > 0);
  const dividends = state.dividends
    .filter((d) => !d.archived)
    .sort((a, b) => b.date.localeCompare(a.date));
  const year = month.slice(0, 4);
  return {
    positions,
    archived: state.positions.filter((p) => p.archived),
    dividends,
    archivedDividends: state.dividends.filter((d) => d.archived),
    total,
    knownCost,
    coveredBalance,
    variation: withCost.length ? sum([coveredBalance, -knownCost]) : null,
    allocation,
    dividendsYear: sum(
      dividends.filter((d) => d.date.startsWith(year)).map((d) => d.amount)
    ),
    dividendSeries: Array.from({ length: 12 }, (_, index) => {
      const m = `${year}-${String(index + 1).padStart(2, '0')}`;
      return {
        month: m,
        total: sum(
          dividends.filter((d) => d.date.startsWith(m)).map((d) => d.amount)
        )
      };
    }),
    importedAt,
    excludedCurrencies: active.length - positions.length
  };
}
