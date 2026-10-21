import type { CardAgendaData } from '../card-agenda.js';
import type { Snapshot } from './finance-data.js';

// O snapshot atual não preserva creditData nem faturas; a ausência não vira valor zero.
export function cloudAgenda(
  snapshot: Snapshot,
  now = new Date()
): CardAgendaData {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  return {
    today,
    timeZone: 'America/Sao_Paulo',
    source: 'cloud-snapshot',
    agendaAvailable: false,
    excludedCurrencies: snapshot.accounts.filter(
      (a) => a.type === 'CREDIT' && a.currencyCode !== 'BRL'
    ).length,
    unavailableReason:
      'A agenda de compromissos exige o backend Go. O extrato cloud não confirma contas a pagar nem quitação de faturas.',
    invoiceUnavailableReason:
      'A fonte atual não fornece fatura identificada com valor e confirmação de quitação. Saldo devedor e compras não equivalem ao valor da fatura.',
    cards: snapshot.accounts
      .filter((a) => a.type === 'CREDIT' && a.currencyCode === 'BRL')
      .map((a) => ({
        id: a.id,
        name: a.name,
        last4: '',
        brand: '',
        debtBalance: a.balance,
        creditLimit: null,
        availableCreditLimit: null,
        closeDate: null,
        dueDate: null,
        copiedAt: snapshot.syncedAt,
        sourceUpdatedAt:
          snapshot.items.find((i) => i.id === a.itemId)?.updatedAt ?? null,
        invoice: null,
        installments: []
      })),
    commitments: [],
    totals: {
      overdue: { confirmed: 0, estimated: 0, count: 0 },
      today: { confirmed: 0, estimated: 0, count: 0 },
      next7: { confirmed: 0, estimated: 0, count: 0 },
      next30: { confirmed: 0, estimated: 0, count: 0 },
      undated: { confirmed: 0, estimated: 0, count: 0 }
    }
  };
}
