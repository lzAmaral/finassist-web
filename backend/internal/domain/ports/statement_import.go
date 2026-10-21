package ports

import (
	"context"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
)

type StatementImportStore interface {
	CreateStatementAccount(context.Context, string, float64) (string, error)
	PreviewStatement(context.Context, domain.StatementBatch) (domain.StatementBatch, error)
	StatementBatches(context.Context) ([]domain.StatementBatch, error)
	StatementBatch(context.Context, string) (domain.StatementBatch, error)
	ConfirmStatement(context.Context, string, []domain.StatementDecision) (domain.StatementBatch, error)
	RevertStatement(context.Context, string) (domain.StatementBatch, error)
}
