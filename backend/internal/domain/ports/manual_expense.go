package ports

import (
	"context"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
)

type ManualExpenseStore interface {
	SaveManualExpense(context.Context, domain.ManualExpense) (domain.ManualExpenseResult, error)
}
