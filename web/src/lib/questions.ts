import type { CardAgendaData } from './card-agenda.ts';
export type QuestionKind =
  'category_total' | 'month_comparison' | 'commitments';
export const questionChoices: { kind: QuestionKind; label: string }[] = [
  { kind: 'month_comparison', label: 'Como meus gastos mudaram?' },
  { kind: 'category_total', label: 'Quanto gastei nesta categoria?' },
  { kind: 'commitments', label: 'Quais compromissos são conhecidos?' }
];
export type QuestionAnswer = {
  kind: QuestionKind;
  category: string;
  status: 'ok' | 'no_data' | 'no_matches' | 'insufficient_data';
  source: string;
  generatedAt: string;
  sourceUpdatedAt: string | null;
  freshness: 'unknown' | 'recent' | 'stale';
  periods: {
    month: string;
    total: number;
    count: number;
    href: string;
    evidence: {
      id: string;
      description: string;
      date: string;
      amount: number;
      href: string;
    }[];
  }[];
  difference: number | null;
  percent: number | null;
  agenda: CardAgendaData | null;
  commitmentLinks: Record<string, string>;
};
export const questionStatus: Record<QuestionAnswer['status'], string> = {
  ok: '',
  no_data:
    'Nenhum dado encontrado no período. Isso não confirma ausência de gastos ou contas a pagar.',
  no_matches:
    'Nenhuma despesa nesta categoria; existem outros lançamentos no mês. Total registrado da categoria: zero.',
  insufficient_data:
    'Há mês sem despesas registradas. A comparação precisa de dados nos dois meses; ausência de registros não equivale a gasto zero.'
};
export async function questionRequest<T>(
  path: string,
  fetcher: typeof fetch = fetch
): Promise<T> {
  const response = await fetcher(path, { cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? 'Sua sessão expirou. Entre novamente para consultar seus dados.'
        : data?.error || 'Não foi possível consultar os dados. Tente novamente.'
    );
  return data as T;
}
export function loadQuestion(
  kind: QuestionKind,
  month: string,
  category: string,
  fetcher: typeof fetch = fetch
) {
  const query = new URLSearchParams({ kind, month });
  if (kind === 'category_total') query.set('category', category);
  return questionRequest<QuestionAnswer>(`/api/questions?${query}`, fetcher);
}
