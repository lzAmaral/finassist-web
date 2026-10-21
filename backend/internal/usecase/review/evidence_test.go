package review

import (
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"testing"
	"time"
)

func TestReviewDuplicateEvidenceExcludesDifferentAmountAndDistantPurchase(t *testing.T) {
	ps := []domain.ExpensePayment{pay("store", 40, 2, "DEBIT_CARD"), pay("store", 40, 3, "DEBIT_CARD"), pay("store", 41, 3, "DEBIT_CARD"), pay("store", 40, 20, "DEBIT_CARD")}
	ps[0].ID, ps[1].ID = "first", "second"
	got := candidatesOf(BuildReview(nil, rowsOf(ps), nil, ps, nil, month(2026, time.November)), ReviewDuplicate)["store"]
	if len(got.Evidence) != 2 || got.Evidence[0].ID != "first" || got.Evidence[1].ID != "second" {
		t.Fatalf("evidência deve identificar somente compras da hipótese: %+v", got)
	}
}

func TestReviewIncreaseEvidenceExplainsBaselineIncludingZero(t *testing.T) {
	oct, nov, sep := month(2026, time.October), month(2026, time.November), month(2026, time.September)
	cats := []domain.CategoryMonth{{Category: "FOOD", Month: sep, Total: 100}, {Category: "OTHER", Month: oct, Total: 100}, {Category: "FOOD", Month: nov, Total: 200}}
	ps := []domain.ExpensePayment{pay("store", 200, 2, "DEBIT_CARD"), pay("other", 20, 2, "DEBIT_CARD")}
	ps[1].Category = "OTHER"
	r := BuildReview(cats, nil, nil, ps, nil, nov)
	got := candidatesOf(r, ReviewIncrease)["FOOD"]
	if r.HistoryMonths != 2 || got.Baseline != 50 || len(got.History) != 2 || got.History[1].Amount != 0 || len(got.Evidence) != 1 {
		t.Fatalf("base e transações precisam explicar o aumento: %+v", got)
	}
}
