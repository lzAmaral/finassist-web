import { assetClasses } from './investments.ts';
import type { AssetClass, Dividend, Position } from './investments.ts';

export const assetColors: Record<AssetClass, string> = {
  EQUITY: '#28bddd',
  FII: '#94dfb5',
  ETF: '#63d9de',
  FIXED_INCOME: '#35a1d3',
  MUTUAL_FUND: '#aa9bdd',
  CRYPTO: '#ff9d83',
  OTHER: '#e9c368'
};

const sum = (values: number[]) =>
  values.reduce((total, value) => total + Math.round(value * 100), 0) / 100;

export function positionSummary(positions: Position[]) {
  const covered = positions.filter((position) => position.cost !== null);
  const cost = sum(covered.map((position) => position.cost!));
  const gain = covered.length
    ? sum(covered.map((position) => position.balance - position.cost!))
    : null;
  return {
    total: sum(positions.map((position) => position.balance)),
    cost,
    gain,
    change: gain !== null && cost > 0 ? (gain / cost) * 100 : null,
    covered: covered.length,
    count: positions.length
  };
}

export function assetGroups(positions: Position[]) {
  const total = positionSummary(positions).total;
  return Object.entries(assetClasses).map(([key, label]) => {
    const items = positions.filter((position) => position.assetClass === key);
    const summary = positionSummary(items);
    return {
      key: key as AssetClass,
      label,
      positions: items,
      ...summary,
      percentage: total > 0 ? (summary.total / total) * 100 : 0
    };
  });
}

export function dividendHistory(
  dividends: Dividend[],
  month: string,
  months: number
) {
  const end = new Date(`${month}-15T12:00:00Z`);
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(end);
    date.setUTCMonth(date.getUTCMonth() - (months - 1 - index));
    const key = date.toISOString().slice(0, 7);
    return {
      month: key,
      label: `${key.slice(5)}/${key.slice(2, 4)}`,
      total: sum(
        dividends
          .filter((d) => !d.archived && d.date.slice(0, 7) === key)
          .map((d) => d.amount)
      )
    };
  });
}
