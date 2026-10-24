package ports

import (
	"context"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
)

// Capacidade opcional, sem ampliar os contratos dos leitores legados.
type CategoryBudgetStore interface {
	CategoryBudgets(context.Context, time.Time) ([]domain.CategoryBudget, error)
	SetCategoryBudget(context.Context, time.Time, domain.Category, *int64, int64) error
}
