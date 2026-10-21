export const assetClasses = {
  EQUITY: 'Ações',
  FII: 'Fundos imobiliários',
  ETF: 'ETFs',
  FIXED_INCOME: 'Renda fixa',
  MUTUAL_FUND: 'Fundos de investimento',
  CRYPTO: 'Criptoativos',
  OTHER: 'Outros'
} as const;
export type AssetClass = keyof typeof assetClasses;
export interface Position {
  id: string;
  source: 'pluggy' | 'manual';
  name: string;
  ticker?: string;
  assetClass: AssetClass;
  quantity: number | null;
  cost: number | null;
  balance: number;
  currency: string;
  updatedAt: string;
  archived?: boolean;
  averagePrice?: number;
  currentPrice?: number;
}
export interface Dividend {
  id: string;
  positionId: string;
  name: string;
  date: string;
  amount: number;
  type: 'DIVIDEND' | 'JCP' | 'YIELD';
  archived?: boolean;
}
export interface PortfolioState {
  version: 1;
  positions: Position[];
  dividends: Dividend[];
}
export interface Portfolio {
  positions: Position[];
  archived: Position[];
  dividends: Dividend[];
  archivedDividends: Dividend[];
  total: number;
  knownCost: number;
  coveredBalance: number;
  variation: number | null;
  allocation: {
    key: string;
    label: string;
    value: number;
    percentage: number;
  }[];
  dividendsYear: number;
  dividendSeries: { month: string; total: number }[];
  importedAt: string | null;
  excludedCurrencies: number;
  importError?: string;
}
export interface ImportedInvestment {
  id: string;
  itemId: string;
  name: string;
  type: string;
  subtype?: string;
  balance: number;
  amount: number;
  amountOriginal?: number;
  quantity?: number;
  value?: number;
  currencyCode?: string;
  date?: string;
  status?: string;
}
