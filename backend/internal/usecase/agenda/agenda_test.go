package agenda

import (
	"testing"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/google/uuid"
)

func day(s string) *time.Time { d, _ := time.Parse(time.DateOnly, s); return &d }
func pending(description, due string, amount float64) domain.AgendaPayment {
	p := domain.AgendaPayment{ID: uuid.New(), PurchaseID: uuid.New(), Description: description, Amount: amount,
		Status: domain.PaymentStatusPending, Type: domain.PurchaseTypeSingle}
	if due != "" {
		p.DueDate = day(due)
	}
	return p
}

func TestBuildSeparatesDebtInstallmentsAndObligations(t *testing.T) {
	now := *day("2026-10-21")
	now = now.Add(12 * time.Hour)
	cardID := uuid.New()
	paid := pending("Compra (1/3)", "2026-10-20", 100)
	paid.Imported, paid.AccountID, paid.Status = true, &cardID, domain.PaymentStatusPaid
	imported := pending("Compra (2/3)", "2026-11-20", 100)
	imported.Imported, imported.AccountID = true, &cardID
	overdue := pending("Conta vencida", "2026-10-20", 10.10)
	today := pending("Conta hoje", "2026-10-21", 20.20)
	installment := pending("Notebook", "2026-10-22", 30)
	installment.Type = domain.PurchaseTypeInstallment
	cancelled := pending("Cancelada", "2026-10-21", 999)
	cancelled.Status = domain.PaymentStatusCancelled
	settled := pending("Pago manualmente", "2026-10-21", 888)
	settled.Status = domain.PaymentStatusPaid
	bankPending := pending("Transação bancária pendente", "2026-10-21", 777)
	bankPending.Imported = true
	result := Build(now, []domain.Account{{ID: cardID, Type: domain.AccountCredit, Balance: 5000}, {Type: domain.AccountBank, Balance: 10000}}, nil,
		[]domain.AgendaPayment{paid, imported, overdue, overdue, today, installment, cancelled, settled, bankPending}, nil)
	if len(result.Cards) != 1 || result.Cards[0].DebtBalance != 5000 || result.Cards[0].Invoice != nil || result.Cards[0].DueDate != nil {
		t.Fatalf("saldo sem fatura ou data inventada: %+v", result.Cards)
	}
	if len(result.Cards[0].Installments) != 2 {
		t.Fatalf("parcelas conhecidas: %+v", result.Cards[0].Installments)
	}
	if len(result.Commitments) != 3 {
		t.Fatalf("compras/fatura/duplicatas não são obrigações adicionais: %+v", result.Commitments)
	}
	if result.Totals["overdue"].Confirmed != 10.10 || result.Totals["today"].Confirmed != 20.20 || result.Totals["next30"].Estimated != 30 || result.Totals["next30"].Confirmed != 0 {
		t.Fatalf("totais separados: %+v", result.Totals)
	}
	if result.Commitments[0].Status != "OVERDUE" || result.Commitments[0].PaymentEvidence != nil {
		t.Fatalf("passagem do vencimento não é pagamento: %+v", result.Commitments[0])
	}
}

func TestBuildRecurrenceMonthEndAndPaymentCoverage(t *testing.T) {
	now := day("2026-01-31").Add(12 * time.Hour)
	purchase := uuid.New()
	recurring := domain.AgendaRecurring{ID: purchase, Description: "Mensalidade", Amount: 19.90, Day: 31, CreatedAt: *day("2025-01-01")}
	paid := pending("Mensalidade", "", 19.90)
	paid.PurchaseID, paid.ReferenceMonth, paid.Status = purchase, day("2026-01-01"), domain.PaymentStatusPaid
	result := Build(now, nil, nil, []domain.AgendaPayment{paid}, []domain.AgendaRecurring{recurring})
	if len(result.Commitments) != 1 || *result.Commitments[0].DueDate != "2026-02-28" || !result.Commitments[0].Estimated {
		t.Fatalf("dia 31 deve limitar ao fim do mês, sem repetir janeiro pago: %+v", result.Commitments)
	}
	cancelled := paid
	cancelled.ID = uuid.New()
	cancelled.Status, cancelled.ReferenceMonth = domain.PaymentStatusCancelled, day("2026-02-01")
	result = Build(now, nil, nil, []domain.AgendaPayment{paid, cancelled}, []domain.AgendaRecurring{recurring})
	if len(result.Commitments) != 0 {
		t.Fatalf("mês cancelado não deve reaparecer como estimativa: %+v", result.Commitments)
	}
	paid.Status = domain.PaymentStatusPending
	paid.DueDate = day("2026-01-29")
	result = Build(now, nil, nil, []domain.AgendaPayment{paid}, []domain.AgendaRecurring{recurring})
	if len(result.Commitments) != 2 || result.Totals["overdue"].Confirmed != 19.90 || result.Totals["next30"].Estimated != 19.90 {
		t.Fatalf("obrigação existente substitui previsão no mesmo mês: %+v", result)
	}
}

func TestBuildWindowsCentsUnknownDatesAndLocalDay(t *testing.T) {
	now, _ := time.Parse(time.RFC3339, "2026-11-01T01:30:00Z")
	result := Build(now, nil, nil, []domain.AgendaPayment{
		pending("Hoje A", "2026-10-31", 0.10), pending("Hoje B", "2026-10-31", 0.20),
		pending("7 dias", "2026-11-07", 10), pending("8 dias", "2026-11-08", 20),
		pending("30 dias", "2026-11-30", 30), pending("31 dias", "2026-12-01", 40), pending("Sem data", "", 50),
	}, nil)
	if result.Today != "2026-10-31" || result.Totals["today"].Confirmed != 0.30 || result.Totals["next7"].Confirmed != 10 || result.Totals["next30"].Confirmed != 60 || result.Totals["undated"].Confirmed != 50 {
		t.Fatalf("dia civil, limites e centavos: %+v", result)
	}
}
