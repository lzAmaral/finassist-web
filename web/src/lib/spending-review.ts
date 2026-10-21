export type ReviewKind = 'INCREASE' | 'FIXED' | 'ANT' | 'DUPLICATE' | 'NEW';
export interface ReviewEvidence {
  id: string;
  date: string;
  label: string;
  amount: number;
}
export interface ReviewCandidate {
  kind: ReviewKind;
  key: string;
  label: string;
  category: string;
  categoryLabel: string;
  monthly: number;
  annual: number | null;
  amount: number;
  baseline: number;
  count: number;
  months: number;
  dismissed: boolean;
  evidence: ReviewEvidence[] | null;
  history: { month: string; amount: number }[] | null;
}
export interface SpendingReviewData {
  month: string;
  historyMonths: number;
  candidates: ReviewCandidate[];
}
export interface SavingDecision {
  kind: ReviewKind;
  key: string;
  label: string;
  month: string;
  monthly: number;
  status: 'PENDING' | 'CONFIRMED' | 'RETURNED';
  monthsConfirmed: number;
  realized: number;
  returned: number;
}
export interface ReviewSavings {
  realized: number;
  perMonth: number;
  perYear: number;
  decisions: SavingDecision[];
}
export const reviewKindLabel: Record<ReviewKind, string> = {
  DUPLICATE: 'Possível duplicidade',
  INCREASE: 'Aumento na categoria',
  FIXED: 'Cobrança fixa a revisar',
  ANT: 'Pequenos gastos frequentes',
  NEW: 'Nova cobrança no histórico'
};
const priority: Record<ReviewKind, number> = {
  DUPLICATE: 0,
  INCREASE: 1,
  FIXED: 2,
  ANT: 3,
  NEW: 4
};
export function reviewPriorities(
  candidates: ReviewCandidate[],
  overview = false
): ReviewCandidate[] {
  const active = candidates.filter(
    (candidate) =>
      !candidate.dismissed && (!overview || priority[candidate.kind] <= 2)
  );
  active.sort(
    (a, b) =>
      priority[a.kind] - priority[b.kind] ||
      b.monthly - a.monthly ||
      a.key.localeCompare(b.key)
  );
  return overview ? active.slice(0, 3) : active;
}
export function reviewReason(candidate: ReviewCandidate): string {
  switch (candidate.kind) {
    case 'DUPLICATE':
      return `${candidate.count} lançamentos de mesmo valor e descrição normalizada em intervalos de até 3 dias. Compras repetidas podem ser legítimas; confira antes de agir.`;
    case 'INCREASE':
      return 'O gasto da categoria subiu ao menos R$ 50 e 20% sobre a média de até três meses anteriores com dados. Isso pode refletir compras diferentes, sem comprovar reajuste de uma assinatura.';
    case 'FIXED':
      return `Cobrança classificada como fixa, presente em ${candidate.months} mês(es). A classificação pode vir do histórico, de recorrência cadastrada ou de correção manual; confirme se ainda precisa dela.`;
    case 'ANT':
      return `${candidate.count} pequenas compras não Pix da mesma descrição. A hipótese de economia considera reduzir esse hábito pela metade.`;
    case 'NEW':
      return 'A descrição só aparece neste mês, comparada a pelo menos dois meses anteriores com dados. Pode ser uma compra avulsa legítima.';
  }
}
export function canRecordCancellation(candidate: ReviewCandidate): boolean {
  return candidate.kind === 'FIXED' || candidate.kind === 'ANT';
}
export function savingsStatus(decision: SavingDecision): string {
  if (decision.status === 'RETURNED') return 'Cobrança voltou após a decisão';
  if (decision.status === 'CONFIRMED')
    return 'Sem cobrança nos meses observados';
  return 'Aguardando histórico após a decisão';
}
