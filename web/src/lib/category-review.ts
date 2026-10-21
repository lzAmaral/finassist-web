export const categoryOptions = [
  ['FOOD', 'Alimentação'],
  ['MARKET', 'Mercado'],
  ['TRANSPORT', 'Transporte'],
  ['HEALTH', 'Saúde'],
  ['ENTERTAINMENT', 'Lazer'],
  ['SHOPPING', 'Compras'],
  ['HOUSING', 'Moradia'],
  ['BILLS', 'Contas'],
  ['EDUCATION', 'Educação'],
  ['PEOPLE', 'Pessoas'],
  ['OTHER', 'Outros']
] as const;
export interface CategoryReviewItem {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  status: string;
  key: string;
  ruleAllowed: boolean;
}
export interface CategoryRule {
  key: string;
  category: string;
}
export interface CategoryReviewData {
  items: CategoryReviewItem[];
  total: number;
  offset: number;
  limit: number;
  rules: CategoryRule[];
  categories: { value: string; label: string }[];
}
export interface CategoryPreview {
  key: string;
  category: string;
  hash: string;
  count: number;
  items: CategoryReviewItem[];
}
export type CategoryScope = 'transaction' | 'future' | 'existing';
export function ruleLabel(key: string) {
  return key.startsWith('exact:') ? key.slice(6) : key;
}
export function categoryName(category: string) {
  return categoryOptions.find(([value]) => value === category)?.[1] ?? category;
}
export function previewStillApplies(
  preview: CategoryPreview | null,
  key: string,
  category: string
) {
  return (
    preview?.key === key &&
    preview.category === category &&
    Boolean(preview.hash)
  );
}
export async function categoryRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers:
      body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      data?.error || 'Não foi possível salvar a classificação. Tente novamente.'
    );
  return data as T;
}
