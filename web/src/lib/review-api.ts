import type {
  ReviewCandidate,
  SavingDecision,
  SpendingReviewData,
  ReviewSavings
} from './spending-review.js';
export async function reviewRequest<T>(
  path: string,
  body?: unknown,
  fetcher: typeof fetch = fetch
): Promise<T> {
  const response = await fetcher(path, {
    method: body === undefined ? 'GET' : 'PUT',
    headers:
      body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : 'Não foi possível carregar ou salvar a revisão. Tente novamente.'
    );
  if (data === null)
    throw new Error('Resposta de revisão inválida. Recarregue os dados.');
  return data as T;
}
export async function loadSpendingReview(month: string) {
  const [review, savings] = await Promise.all([
    reviewRequest<SpendingReviewData>(
      `/api/review?month=${encodeURIComponent(month)}`
    ),
    reviewRequest<ReviewSavings>('/api/savings')
  ]);
  return { review, savings };
}
export function setReviewDismissal(
  candidate: ReviewCandidate,
  dismissed: boolean
) {
  return reviewRequest('/api/review-dismissals', {
    kind: candidate.kind,
    key: candidate.key,
    dismissed
  });
}
export function setReviewDecision(
  candidate: ReviewCandidate | SavingDecision,
  month: string,
  decided: boolean
) {
  return reviewRequest('/api/savings/decisions', {
    kind: candidate.kind,
    key: candidate.key,
    month,
    decided
  });
}
