package db

import (
	"context"
	"errors"
	"testing"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain/ports"
	"github.com/google/uuid"
)

func reviewExpense(t *testing.T, repo *testRepo, pg *DB, description string, category domain.Category) *domain.Payment {
	t.Helper()
	p, err := domain.NewPurchase(12.34, &description, category, domain.PaymentMethodPix, domain.PurchaseTypeSingle, "synthetic-fa05")
	if err != nil {
		t.Fatal(err)
	}
	pay := domain.NewPayment(p.ID, 12.34, domain.PaymentStatusPaid)
	pay.DueDate = &mar1999
	external := "fa05-" + pay.ID.String()
	pay.ExternalID = &external
	if err := repo.SaveExternal(context.Background(), p, pay); err != nil {
		t.Fatal(err)
	}
	cleanup(t, pg, p)
	return pay
}
func requireReviewCategory(t *testing.T, repo *testRepo, id uuid.UUID, want string) {
	t.Helper()
	item, err := repo.CategoryTransaction(context.Background(), id)
	if err != nil || item.Category != want {
		t.Fatalf("categoria esperada %s: %+v %v", want, item, err)
	}
}
func TestCategoryReview_IndividualSurvivesSyncAndIsolatesSibling(t *testing.T) {
	repo, pg := newTestRepo(t)
	ctx := context.Background()
	first := reviewExpense(t, repo, pg, "FA05 individual", domain.CategoryOther)
	sibling := domain.NewPayment(first.PurchaseID, 12.34, domain.PaymentStatusPending)
	sibling.DueDate = &mar1999
	if err := repo.SavePayment(ctx, sibling); err != nil {
		t.Fatal(err)
	}
	var before string
	snapshot := `SELECT json_build_array(pay.id,pay.purchase_id,pay.external_id,pay.amount,pay.status,pay.due_date,pay.paid_at,pay.created_at)::text FROM payments pay WHERE id=$1`
	if err := pg.Pool.QueryRow(ctx, snapshot, first.ID).Scan(&before); err != nil {
		t.Fatal(err)
	}
	if ok, err := repo.SetTransactionCategory(ctx, first.ID, "HEALTH"); err != nil || !ok {
		t.Fatalf("correção: %v %v", ok, err)
	}
	acc, err := repo.UpsertAccount(ctx, ports.ExternalAccount{ID: uuid.NewString(), ItemID: "fa05", Type: "BANK", Name: "Sintética"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pg.Pool.Exec(ctx, `UPDATE payments SET account_id=NULL WHERE account_id=$1`, acc)
		pg.Pool.Exec(ctx, `DELETE FROM accounts WHERE id=$1`, acc)
	})
	for range 2 {
		found, err := repo.RefreshExternal(ctx, ports.ExternalTransaction{ID: *first.ExternalID, Category: domain.CategoryFood}, acc)
		if err != nil || !found {
			t.Fatalf("resync: %v %v", found, err)
		}
	}
	requireReviewCategory(t, repo, first.ID, "HEALTH")
	requireReviewCategory(t, repo, sibling.ID, "FOOD")
	var after string
	if err := pg.Pool.QueryRow(ctx, snapshot, first.ID).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if before != after {
		t.Fatalf("identidade/valor/situação/data alterados: %s -> %s", before, after)
	}
	items, total, err := repo.Transactions(ctx, domain.TransactionFilter{Month: &mar1999, Category: "HEALTH", Search: "FA05 individual", Limit: 100})
	if err != nil || total != 1 || len(items) != 1 || items[0].ID != first.ID {
		t.Fatalf("filtro de categoria efetiva: %+v %d %v", items, total, err)
	}
	details, err := repo.FindPaymentDetailsByMonth(ctx, mar1999)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, d := range details {
		if d.Description != nil && *d.Description == "FA05 individual" && d.Category == "HEALTH" {
			found = true
		}
	}
	if !found {
		t.Fatal("chat/resumo deve ler correção individual")
	}
	// OTHER explícito continua sendo escolha do proprietário, mesmo se o banco aprimorar a categoria.
	if _, err := repo.SetTransactionCategory(ctx, first.ID, "OTHER"); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.RefreshExternal(ctx, ports.ExternalTransaction{ID: *first.ExternalID, Category: domain.CategoryFood}, acc); err != nil {
		t.Fatal(err)
	}
	requireReviewCategory(t, repo, first.ID, "OTHER")
	review, _, err := repo.CategoryReview(ctx, 1000, 0)
	if err != nil {
		t.Fatal(err)
	}
	for _, i := range review {
		if i.ID == first.ID {
			t.Fatal("escolha explícita Outros não volta à fila")
		}
	}
}
func TestCategoryReview_ExactPreviewFutureReapplyRemoval(t *testing.T) {
	repo, pg := newTestRepo(t)
	ctx := context.Background()
	key := "exact:fa05 loja 101"
	t.Cleanup(func() { pg.Pool.Exec(ctx, `DELETE FROM category_rules WHERE key=$1`, key) })
	first := reviewExpense(t, repo, pg, "FA05 Loja 101", domain.CategoryOther)
	other := reviewExpense(t, repo, pg, "FA05 Loja 102", domain.CategoryOther)
	preview, err := repo.PreviewCategoryRule(ctx, key, "SHOPPING")
	if err != nil || preview.Count != 1 || preview.Items[0].ID != first.ID {
		t.Fatalf("prévia isolada: %+v %v", preview, err)
	}
	if _, err := repo.ApplyCategoryRule(ctx, key, "SHOPPING", true, ""); !errors.Is(err, domain.ErrCategoryPreviewChanged) {
		t.Fatalf("prévia obrigatória: %v", err)
	}
	if changed, err := repo.ApplyCategoryRule(ctx, key, "SHOPPING", false, preview.Hash); err != nil || changed != 0 {
		t.Fatalf("só futuros: %d %v", changed, err)
	}
	requireReviewCategory(t, repo, first.ID, "OTHER")
	manualDescription := "FA05 Loja 101"
	manual, err := domain.NewPurchase(12.34, &manualDescription, domain.CategoryFood, domain.PaymentMethodCash, domain.PurchaseTypeRecurring, "synthetic-fa05")
	if err != nil {
		t.Fatal(err)
	}
	manualPay := domain.NewPayment(manual.ID, 12.34, domain.PaymentStatusPending)
	manualPay.DueDate = &mar1999
	if err := repo.Save(ctx, manual, []domain.Payment{*manualPay}); err != nil {
		t.Fatal(err)
	}
	cleanup(t, pg, manual)
	requireReviewCategory(t, repo, manualPay.ID, "SHOPPING")
	nextPay := domain.NewPayment(manual.ID, 12.34, domain.PaymentStatusPending)
	nextPay.DueDate = &apr1999
	if err := repo.SavePayment(ctx, nextPay); err != nil {
		t.Fatal(err)
	}
	requireReviewCategory(t, repo, nextPay.ID, "SHOPPING")
	// Remove somente os fixtures manuais para isolar as contagens da prévia abaixo.
	if _, err := pg.Pool.Exec(ctx, `DELETE FROM purchases WHERE id=$1`, manual.ID); err != nil {
		t.Fatal(err)
	}
	future := reviewExpense(t, repo, pg, "FA05 Loja 101", domain.CategoryFood)
	requireReviewCategory(t, repo, future.ID, "SHOPPING")
	preview, err = repo.PreviewCategoryRule(ctx, key, "HEALTH")
	if err != nil || preview.Count != 2 {
		t.Fatalf("prévia reaplicar: %+v %v", preview, err)
	}
	if _, err := repo.SetTransactionCategory(ctx, first.ID, "HOUSING"); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.ApplyCategoryRule(ctx, key, "HEALTH", true, preview.Hash); !errors.Is(err, domain.ErrCategoryPreviewChanged) {
		t.Fatalf("recusa prévia desatualizada: %v", err)
	}
	preview, err = repo.PreviewCategoryRule(ctx, key, "HEALTH")
	if err != nil || preview.Count != 1 {
		t.Fatalf("protege correção individual: %+v %v", preview, err)
	}
	if changed, err := repo.ApplyCategoryRule(ctx, key, "HEALTH", true, preview.Hash); err != nil || changed != 1 {
		t.Fatalf("reaplica prévia: %d %v", changed, err)
	}
	requireReviewCategory(t, repo, first.ID, "HOUSING")
	requireReviewCategory(t, repo, other.ID, "OTHER")
	requireReviewCategory(t, repo, future.ID, "HEALTH")
	if removed, err := repo.RemoveCategoryRule(ctx, key); err != nil || !removed {
		t.Fatalf("remove: %v %v", removed, err)
	}
	requireReviewCategory(t, repo, future.ID, "HEALTH")
	after := reviewExpense(t, repo, pg, "FA05 Loja 101", domain.CategoryFood)
	requireReviewCategory(t, repo, after.ID, "FOOD")
	rules, err := repo.CategoryRules(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, rule := range rules {
		if rule.Key == key {
			t.Fatal("regra removida ainda listada")
		}
	}
}
func TestCategoryReview_ProtectsGenericPixAndSimilarDebitNames(t *testing.T) {
	repo, pg := newTestRepo(t)
	ctx := context.Background()
	pix := reviewExpense(t, repo, pg, "PIX", domain.CategoryOther)
	item, err := repo.CategoryTransaction(ctx, pix.ID)
	if err != nil || item.RuleAllowed {
		t.Fatalf("Pix genérico não permite regra: %+v %v", item, err)
	}
	if _, err := repo.PreviewCategoryRule(ctx, item.Key, "FOOD"); !errors.Is(err, domain.ErrCategoryRuleNotAllowed) {
		t.Fatalf("regra Pix deve falhar: %v", err)
	}
	for _, description := range []string{"DEBITO VISA ELECTRON BRASIL 20/09 FA05 Loja Centro", "DEBITO VISA ELECTRON BRASIL 20/09 FA05 Loja Bairro"} {
		reviewExpense(t, repo, pg, description, domain.CategoryOther)
	}
	preview, err := repo.PreviewCategoryRule(ctx, "exact:debito visa electron brasil 20/09 fa05 loja centro", "FOOD")
	if err != nil || preview.Count != 1 {
		t.Fatalf("não agrupa só pela primeira palavra do comércio: %+v %v", preview, err)
	}
	if ok, err := repo.SetTransactionCategory(ctx, uuid.New(), "FOOD"); err != nil || ok {
		t.Fatalf("id ausente: %v %v", ok, err)
	}
}
