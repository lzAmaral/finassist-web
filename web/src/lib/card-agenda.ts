export type AgendaWindow = 'overdue' | 'today' | 'next7' | 'next30' | 'undated';
export interface AgendaCommitment {
  id: string;
  description: string;
  amount: number;
  dueDate: string | null;
  status: 'PENDING' | 'OVERDUE';
  estimated: boolean;
  source:
    | 'manual-payment'
    | 'manual-installment-schedule'
    | 'manual-recurring-estimate';
  paymentEvidence: string | null;
}
export interface AgendaCard {
  id: string;
  name: string;
  last4: string;
  brand: string;
  debtBalance: number;
  creditLimit: number | null;
  availableCreditLimit: number | null;
  closeDate: string | null;
  dueDate: string | null;
  copiedAt: string;
  sourceUpdatedAt: string | null;
  invoice: {
    id: string;
    amount: number;
    dueDate: string | null;
    paymentStatus: 'UNKNOWN' | 'PENDING' | 'PAID';
    paymentEvidence: string | null;
  } | null;
  installments: {
    id: string;
    description: string;
    amount: number;
    referenceDate: string | null;
    status: 'RECORDED';
  }[];
}
export interface CardAgendaData {
  today: string;
  timeZone: string;
  source: 'go-postgres' | 'cloud-snapshot';
  agendaAvailable: boolean;
  excludedCurrencies?: number;
  unavailableReason: string | null;
  invoiceUnavailableReason: string;
  cards: AgendaCard[];
  commitments: AgendaCommitment[];
  totals: Record<
    AgendaWindow,
    { confirmed: number; estimated: number; count: number }
  >;
}
export const agendaWindows: { key: AgendaWindow; label: string }[] = [
  { key: 'overdue', label: 'Vencidos' },
  { key: 'today', label: 'Hoje' },
  { key: 'next7', label: 'Próximos 7 dias' },
  { key: 'next30', label: 'Próximos 30 dias' },
  { key: 'undated', label: 'Sem data' }
];
export function agendaDate(value: string | null): string {
  if (!value) return 'Não informada';
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(date.valueOf())) return 'Não informada';
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
export function inAgendaWindow(
  c: AgendaCommitment,
  window: AgendaWindow,
  today: string
): boolean {
  if (!c.dueDate) return window === 'undated';
  if (window === 'overdue') return c.dueDate < today;
  if (window === 'today') return c.dueDate === today;
  if (window === 'undated') return false;
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + (window === 'next7' ? 7 : 30));
  return c.dueDate > today && c.dueDate <= end.toISOString().slice(0, 10);
}
