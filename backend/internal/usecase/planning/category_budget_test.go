package planning

import (
	"testing"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
)

func TestCategoryBudgetProgress(t *testing.T) {
	zero, hundred := int64(0), int64(10000)
	for _, tc := range []struct {
		name                 string
		limit                *int64
		paid, pending, count int64
		status               string
		remaining            int64
	}{
		{"sem limite", nil, 1234, 500, 2, "no-limit", 0},
		{"zero sem histórico", &zero, 0, 0, 0, "no-records", 0},
		{"zero explícito", &zero, 1, 0, 1, "exceeded", -1},
		{"pendentes consomem limite", &hundred, 9000, 1001, 2, "exceeded", -1},
		{"exatamente no teto", &hundred, 9000, 1000, 2, "at-limit", 0},
		{"dentro", &hundred, 8000, 1000, 2, "within-limit", 1000},
		{"histórico ausente", &hundred, 0, 0, 0, "no-records", 10000},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := BuildCategoryBudget(domain.CategoryBudget{Category: domain.CategoryFood, LimitCents: tc.limit, PaidCents: tc.paid, PendingCents: tc.pending, Count: tc.count})
			if got.Status != tc.status || got.SpentCents != tc.paid+tc.pending || got.Label != "Alimentação" {
				t.Fatalf("progresso: %+v", got)
			}
			if tc.limit == nil {
				if got.RemainingCents != nil || got.UsagePercent != nil {
					t.Fatal("ausência virou zero")
				}
			} else if got.RemainingCents == nil || *got.RemainingCents != tc.remaining {
				t.Fatalf("restante: %+v", got)
			}
			if tc.limit != nil && *tc.limit == 0 && got.UsagePercent != nil {
				t.Fatal("percentual indefinido com limite zero")
			}
			if tc.limit != nil && *tc.limit > 0 && (got.UsagePercent == nil || *got.UsagePercent != float64(tc.paid+tc.pending)*100/float64(*tc.limit)) {
				t.Fatal("percentual incorreto")
			}
		})
	}
}
