export type GoalKind = 'SAVE' | 'CUT' | 'RESERVE';
export interface Goal {
  id: string;
  kind: GoalKind;
  name: string;
  targetDate: string | null;
  category: string;
  categoryLabel: string;
  cutPercent: number;
  baseline: number;
  reserveMonths: number;
  current: number;
  target: number;
  done: boolean;
  monthsLeft: number;
  perMonth: number;
  surplus: number | null;
  fits: boolean | null;
  coverage: number;
  history: { month: string; total: number; hit: boolean }[];
  projected: number | null;
  dayOfMonth: number;
  daysInMonth: number;
}
export interface GoalsData {
  wealth: number;
  goals: Goal[];
}
export interface GoalDraft {
  kind: GoalKind;
  name: string;
  targetAmount?: number;
  targetDate?: string;
  category?: string;
  cutPercent?: number;
  reserveMonths?: number;
}
export type ExpenseClass = 'FIXED' | 'VARIABLE' | 'INSTALLMENT';
export type ExpenseRule = 'FIXED' | 'VARIABLE' | 'AUTO';
export interface BudgetMonth {
  month: string;
  fixed: number;
  installment: number;
  variable: number;
}
export interface BudgetItem {
  key: string;
  label: string;
  category: string;
  categoryLabel: string;
  class: ExpenseClass;
  manual: boolean;
  total: number;
  count: number;
  day: number;
  paid: boolean;
  months: number;
}
export interface BudgetData {
  month: string;
  series: BudgetMonth[];
  items: BudgetItem[];
}
export interface ProjectionData {
  assumptions: {
    income: number;
    incomeSources: { label: string; monthly: number }[];
    fixed: number;
    variable: number;
    basedOn: number;
  };
  months: BudgetMonth[];
}
export const goalKindLabels: Record<GoalKind, string> = {
  SAVE: 'Juntar',
  CUT: 'Reduzir gastos',
  RESERVE: 'Reserva'
};
export const expenseClassLabels: Record<ExpenseClass, string> = {
  FIXED: 'Fixas',
  VARIABLE: 'Variáveis',
  INSTALLMENT: 'Parcelas'
};
export function currentPlanningMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}
export function validateGoal(draft: GoalDraft, now = new Date()): string {
  if (
    !draft.name.trim() ||
    [...draft.name.trim()].length > 60 ||
    /[\u0000-\u001f\u007f]/u.test(draft.name)
  )
    return 'Informe um nome de 1 a 60 caracteres, sem caracteres de controle.';
  if (draft.kind === 'SAVE') {
    if (
      !Number.isFinite(draft.targetAmount) ||
      !(draft.targetAmount! > 0 && draft.targetAmount! <= 1e9)
    )
      return 'Informe um valor maior que zero e até R$ 1 bilhão.';
    const month = draft.targetDate ?? '';
    const limit = new Date(now);
    limit.setUTCFullYear(limit.getUTCFullYear() + 10);
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) ||
      month <= currentPlanningMonth(now) ||
      month > currentPlanningMonth(limit)
    )
      return 'Escolha um mês futuro, em até 10 anos.';
  } else if (draft.kind === 'CUT') {
    if (
      !draft.category ||
      !Number.isInteger(draft.cutPercent) ||
      !(draft.cutPercent! >= 1 && draft.cutPercent! <= 90)
    )
      return 'Escolha a categoria e uma redução inteira de 1 a 90%.';
  } else if (draft.kind === 'RESERVE') {
    if (
      !Number.isInteger(draft.reserveMonths) ||
      !(draft.reserveMonths! >= 1 && draft.reserveMonths! <= 36)
    )
      return 'Escolha de 1 a 36 meses de reserva.';
  } else return 'Escolha um tipo de meta.';
  return '';
}
export function goalStatus(goal: Goal, month = currentPlanningMonth()): string {
  if (goal.kind === 'CUT')
    return goal.current <= goal.target
      ? 'Dentro do teto até agora'
      : 'Teto ultrapassado';
  if (goal.kind === 'RESERVE' && goal.target <= 0)
    return 'Sem base de despesas fixas';
  if (goal.done) return 'Objetivo alcançado';
  if (goal.targetDate && goal.targetDate < month) return 'Prazo vencido';
  if (goal.targetDate === month) return 'Prazo neste mês';
  return goal.fits === false ? 'Requer ajuste no plano' : 'Em andamento';
}
export function projectedRemainder(
  projection: ProjectionData,
  month: BudgetMonth
): number | null {
  if (projection.assumptions.basedOn === 0) return null;
  return (
    projection.assumptions.income -
    month.fixed -
    month.variable -
    month.installment
  );
}
export async function planningRequest<T>(
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
      typeof data?.error === 'string'
        ? data.error
        : 'Não foi possível carregar ou salvar o planejamento. Tente novamente.'
    );
  if (data === null)
    throw new Error('Resposta de planejamento inválida. Recarregue os dados.');
  return data as T;
}
