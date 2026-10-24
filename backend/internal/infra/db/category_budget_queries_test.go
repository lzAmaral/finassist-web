package db

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
)

func TestCategoryBudgets_ObservedExpensesAndPeriods(t *testing.T) {
	repo, pg := newTestRepo(t)
	ctx := context.Background()
	month := time.Date(1991, 4, 1, 0, 0, 0, 0, time.UTC)
	next := month.AddDate(0, 1, 0)
	add := func(amount float64, kind domain.PurchaseKind, status domain.PaymentStatus, due, reference *time.Time) *domain.Payment {
		t.Helper()
		p, err := domain.NewPurchase(amount, nil, domain.CategoryFood, domain.PaymentMethodPix, domain.PurchaseTypeSingle, "synthetic-fa12")
		if err != nil {
			t.Fatal(err)
		}
		p.Kind = kind
		pay := domain.NewPayment(p.ID, amount, status)
		pay.DueDate, pay.ReferenceMonth = due, reference
		pay.CreatedAt = month
		if err := repo.Save(ctx, p, []domain.Payment{*pay}); err != nil {
			t.Fatal(err)
		}
		cleanup(t, pg, p)
		return pay
	}
	add(12.34, domain.KindExpense, domain.PaymentStatusPaid, &month, nil)
	add(2.01, domain.KindExpense, domain.PaymentStatusPending, nil, &month)
	add(0.10, domain.KindExpense, domain.PaymentStatusPaid, nil, nil)
	add(999, domain.KindExpense, domain.PaymentStatusCancelled, &month, nil)
	add(888, domain.KindIncome, domain.PaymentStatusPaid, &month, nil)
	add(777, domain.KindTransfer, domain.PaymentStatusPaid, &month, nil)
	add(666, domain.KindExpense, domain.PaymentStatusPending, &next, &month)
	corrected := add(5.55, domain.KindExpense, domain.PaymentStatusPaid, &month, nil)
	if ok, err := repo.SetTransactionCategory(ctx, corrected.ID, "HEALTH"); err != nil || !ok {
		t.Fatalf("override: %v %v", ok, err)
	}
	rows, err := repo.CategoryBudgets(ctx, month)
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != len(domain.ExpenseCategories()) {
		t.Fatalf("categorias: %d", len(rows))
	}
	byCategory := map[domain.Category]domain.CategoryBudget{}
	for _, row := range rows {
		byCategory[row.Category] = row
	}
	food := byCategory[domain.CategoryFood]
	if food.PaidCents != 1244 || food.PendingCents != 201 || food.Count != 3 || food.LimitCents != nil || food.Version != 0 {
		t.Fatalf("despesas: %+v", food)
	}
	if health := byCategory[domain.CategoryHealth]; health.PaidCents != 555 || health.Count != 1 {
		t.Fatalf("categoria efetiva: %+v", health)
	}
	if housing := byCategory[domain.CategoryHousing]; housing.Count != 0 || housing.LimitCents != nil {
		t.Fatalf("sem histórico: %+v", housing)
	}
}

func TestCategoryBudgets_PersistenceConflictsAndRemoval(t *testing.T) {
	repo, pg := newTestRepo(t)
	ctx := context.Background()
	month := time.Date(1991, 5, 1, 0, 0, 0, 0, time.UTC)
	t.Cleanup(func() { pg.Pool.Exec(ctx, `DELETE FROM category_budget_limits WHERE month=$1`, month) })
	zero, limit := int64(0), int64(12345)
	if err := repo.SetCategoryBudget(ctx, month, domain.CategoryFood, &zero, 0); err != nil {
		t.Fatal(err)
	}
	// Outra conexão deve observar o limite persistido, inclusive o zero explícito.
	reader, _ := newTestRepo(t)
	read := func() domain.CategoryBudget {
		t.Helper()
		rows, err := reader.CategoryBudgets(ctx, month)
		if err != nil {
			t.Fatal(err)
		}
		for _, row := range rows {
			if row.Category == domain.CategoryFood {
				return row
			}
		}
		t.Fatal("categoria ausente")
		return domain.CategoryBudget{}
	}
	if row := read(); row.LimitCents == nil || *row.LimitCents != 0 || row.Version != 1 {
		t.Fatalf("persistência: %+v", row)
	}
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for range 2 {
		wg.Go(func() { results <- repo.SetCategoryBudget(ctx, month, domain.CategoryFood, &limit, 1) })
	}
	wg.Wait()
	close(results)
	succeeded, conflicts := 0, 0
	for err := range results {
		if err == nil {
			succeeded++
		} else if errors.Is(err, domain.ErrCategoryBudgetConflict) {
			conflicts++
		} else {
			t.Fatal(err)
		}
	}
	if succeeded != 1 || conflicts != 1 {
		t.Fatalf("escritas concorrentes: %d / %d", succeeded, conflicts)
	}
	if row := read(); row.LimitCents == nil || *row.LimitCents != limit || row.Version != 2 {
		t.Fatalf("edição: %+v", row)
	}
	if err := repo.SetCategoryBudget(ctx, month, domain.CategoryFood, nil, 2); err != nil {
		t.Fatal(err)
	}
	if row := read(); row.LimitCents != nil || row.Version != 3 {
		t.Fatalf("remoção: %+v", row)
	}
	if err := repo.SetCategoryBudget(ctx, month, domain.CategoryFood, &zero, 3); err != nil {
		t.Fatal(err)
	}
	for _, version := range []int64{0, 1, 2, 3} {
		if err := repo.SetCategoryBudget(ctx, month, domain.CategoryFood, &limit, version); !errors.Is(err, domain.ErrCategoryBudgetConflict) {
			t.Fatalf("versão antiga %d: %v", version, err)
		}
	}
	rows, err := reader.CategoryBudgets(ctx, month.AddDate(0, 1, 0))
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range rows {
		if row.LimitCents != nil || row.Version != 0 {
			t.Fatalf("limite vazou para outro mês: %+v", row)
		}
	}
	tooMuch := domain.MaxCategoryBudgetCents + 1
	if err := repo.SetCategoryBudget(ctx, month, domain.CategoryFood, &tooMuch, 4); !errors.Is(err, domain.ErrInvalidCategoryBudget) {
		t.Fatalf("limite máximo: %v", err)
	}
}
