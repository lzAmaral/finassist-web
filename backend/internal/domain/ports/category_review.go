package ports

import (
	"context"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/google/uuid"
)

// CategoryReviewStore fica separado do contrato legado para não exigir operações de mocks de leitura.
type CategoryReviewStore interface {
	CategoryReview(context.Context, int, int) ([]domain.CategoryReviewItem, int, error)
	CategoryTransaction(context.Context, uuid.UUID) (domain.CategoryReviewItem, error)
	CategoryRules(context.Context) ([]domain.CategoryRule, error)
	PreviewCategoryRule(context.Context, string, string) (domain.CategoryRulePreview, error)
	ApplyCategoryRule(context.Context, string, string, bool, string) (int64, error)
	RemoveCategoryRule(context.Context, string) (bool, error)
	SetTransactionCategory(context.Context, uuid.UUID, string) (bool, error)
}
