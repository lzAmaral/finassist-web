package db

import (
	"context"
	"testing"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/usecase/agenda"
	"github.com/google/uuid"
)

func TestAgendaQueries_SourceAndRecurrenceCoverage(t *testing.T) {
	repo, pg := newTestRepo(t)
	ctx := context.Background()
	from := time.Date(1999, 1, 1, 0, 0, 0, 0, time.UTC)
	due := from.AddDate(0, 0, 10)
	through := from.AddDate(0, 1, 0)
	ids := map[uuid.UUID]bool{}
	var recurringID uuid.UUID
	for _, kind := range []domain.PurchaseKind{domain.KindExpense, domain.KindIncome, domain.KindTransfer} {
		desc := "fixture-agenda-" + string(kind)
		p := &domain.Purchase{ID: uuid.New(), Description: &desc, Category: domain.CategoryOther, Kind: kind,
			PaymentMethod: domain.PaymentMethodPix, Type: domain.PurchaseTypeRecurring, TotalAmount: 12.34,
			DayOfMonth: new(31), IsActive: true, RawInput: "fixture-agenda", CreatedAt: from}
		if kind == domain.KindTransfer {
			direction := domain.TransferDirectionOut
			p.TransferDirection = &direction
		}
		payment := domain.NewPayment(p.ID, 12.34, domain.PaymentStatusPaid)
		payment.ReferenceMonth = &from
		if err := repo.Save(ctx, p, []domain.Payment{*payment}); err != nil {
			t.Fatal(err)
		}
		cleanup(t, pg, p)
		ids[p.ID] = true
		if kind == domain.KindExpense {
			recurringID = p.ID
		}
	}
	desc := "fixture-agenda-importada (1/2)"
	imported, err := domain.NewPurchase(56.78, &desc, domain.CategoryOther, domain.PaymentMethodCreditCard, domain.PurchaseTypeSingle, "fixture-agenda")
	if err != nil {
		t.Fatal(err)
	}
	pay := domain.NewPayment(imported.ID, 56.78, domain.PaymentStatusPending)
	external := "agenda-" + uuid.NewString()
	pay.ExternalID, pay.DueDate = &external, &due
	if err := repo.Save(ctx, imported, []domain.Payment{*pay}); err != nil {
		t.Fatal(err)
	}
	cleanup(t, pg, imported)
	if _, err := pg.Pool.Exec(ctx, `UPDATE payments SET external_id = $2 WHERE id = $1`, pay.ID, external); err != nil {
		t.Fatal(err)
	}
	ids[imported.ID] = true
	payments, err := repo.AgendaPayments(ctx, from, through)
	if err != nil {
		t.Fatal(err)
	}
	var ownPayments []domain.AgendaPayment
	for _, p := range payments {
		if ids[p.PurchaseID] {
			ownPayments = append(ownPayments, p)
		}
	}
	if len(ownPayments) != 2 {
		t.Fatalf("somente despesas, inclusive quitada para cobrir recorrência: %+v", ownPayments)
	}
	for _, p := range ownPayments {
		if p.PurchaseID == imported.ID && (!p.Imported || p.DueDate == nil || p.Status != domain.PaymentStatusPending) {
			t.Fatalf("origem/status/data perdidos: %+v", p)
		}
		if p.PurchaseID == recurringID && (p.ReferenceMonth == nil || p.Status != domain.PaymentStatusPaid) {
			t.Fatalf("cobertura de mês quitado perdida: %+v", p)
		}
	}
	recurrences, err := repo.AgendaRecurring(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var ownRecurring []domain.AgendaRecurring
	for _, p := range recurrences {
		if ids[p.ID] {
			ownRecurring = append(ownRecurring, p)
		}
	}
	if len(ownRecurring) != 1 || ownRecurring[0].ID != recurringID || ownRecurring[0].Day != 31 {
		t.Fatalf("recorrências devem excluir renda/transferência: %+v", ownRecurring)
	}
	result := agenda.Build(from.Add(12*time.Hour), nil, nil, ownPayments, ownRecurring)
	if len(result.Commitments) != 0 {
		t.Fatalf("postagem importada e recorrência paga não são novos compromissos: %+v", result.Commitments)
	}
}
