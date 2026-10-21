package db

import (
	"context"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain/ports"
	"os"
	"slices"
	"testing"
	"time"
)

func TestReviewPersistenceAfterResyncAndReconnect(t *testing.T) {
	repo, pg := newTestRepo(t)
	ctx := context.Background()
	key, label := "zzfasix streaming", "ZZFASIX STREAMING"
	month := time.Date(1998, time.June, 1, 0, 0, 0, 0, time.UTC)
	p, err := domain.NewPurchase(49.9, &label, domain.CategoryEntertainment, domain.PaymentMethodPix, domain.PurchaseTypeSingle, "synthetic-fa06")
	if err != nil {
		t.Fatal(err)
	}
	payment := domain.NewPayment(p.ID, 49.9, domain.PaymentStatusPaid)
	payment.DueDate = &month
	externalID := "synthetic-fa06-" + payment.ID.String()
	payment.ExternalID = &externalID
	account := testAccount(t, repo, pg)
	cleanup(t, pg, p)
	t.Cleanup(func() {
		pg.Pool.Exec(ctx, `DELETE FROM review_decisions WHERE key=$1`, key)
		pg.Pool.Exec(ctx, `DELETE FROM review_dismissals WHERE key=$1`, key)
	})
	if err := repo.SaveExternal(ctx, p, payment); err != nil {
		t.Fatal(err)
	}
	dismissal := domain.Dismissal{Kind: "FIXED", Key: key}
	if err := repo.SetDismissal(ctx, dismissal, true); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if found, err := repo.RefreshExternal(ctx, ports.ExternalTransaction{ID: externalID, Kind: domain.KindExpense, Amount: 49.9, Date: month, Category: domain.CategoryEntertainment}, account); err != nil || !found {
			t.Fatalf("resync falhou: %v %v", found, err)
		}
	}
	fresh, err := NewPostgres(ctx, os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer fresh.Close()
	reader := &ReviewRepo{db: fresh}
	dismissals, err := reader.Dismissals(ctx)
	if err != nil || !slices.Contains(dismissals, dismissal) {
		t.Fatalf("dispensa precisa sobreviver resync e conexão nova: %v %v", dismissals, err)
	}
	payments, err := reader.ExpensePayments(ctx, month, month)
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for _, e := range payments {
		if e.Key == key {
			count++
			if e.ID != payment.ID.String() {
				t.Fatalf("ID de evidência perdido: %s", e.ID)
			}
		}
	}
	if count != 1 {
		t.Fatalf("resync criou duplicata: %d", count)
	}
	decision := domain.Decision{Kind: "FIXED", Key: key, Label: label, Category: "ENTERTAINMENT", Month: month, Monthly: 49.9}
	if err := repo.SetDecision(ctx, decision); err != nil {
		t.Fatal(err)
	}
	decisions, err := reader.Decisions(ctx)
	if err != nil || !slices.ContainsFunc(decisions, func(d domain.Decision) bool { return d.Key == key && d.Monthly == 49.9 }) {
		t.Fatalf("decisão não persistida: %v %v", decisions, err)
	}
	if err := reader.DeleteDecision(ctx, "FIXED", key); err != nil {
		t.Fatal(err)
	}
	dismissals, _ = repo.Dismissals(ctx)
	if slices.Contains(dismissals, dismissal) {
		t.Fatal("desfazer deve restaurar a sugestão")
	}
}
