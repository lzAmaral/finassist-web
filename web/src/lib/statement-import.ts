export type ImportCandidate = {
  id: string;
  date: string;
  description: string;
  external: boolean;
};
export type ImportRow = {
  number: number;
  date: string;
  description: string;
  cents: number;
  error?: string;
  duplicate: boolean;
  candidates: ImportCandidate[];
  action?: string;
  paymentId?: string;
};
export type ImportBatch = {
  id: string;
  accountId: string;
  filename: string;
  hash: string;
  status: 'PREVIEW' | 'CONFIRMED' | 'REVERTED';
  createdAt: string;
  rows: ImportRow[];
  created: number;
  preserved: number;
};
export type ImportList = {
  accounts: { id: string; name: string }[];
  batches: ImportBatch[];
};
export async function importRequest<T>(
  path: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }
  );
  const value = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(value.error || 'Não foi possível concluir a importação.');
  return value as T;
}
export function defaultImportChoice(row: ImportRow) {
  return row.error || row.duplicate || row.candidates.length
    ? 'skip'
    : 'create';
}
