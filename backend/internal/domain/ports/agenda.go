package ports

import (
	"context"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
)

// AgendaReader é opcional para leitores antigos. Não cria obrigações a partir do extrato.
type AgendaReader interface {
	AgendaPayments(context.Context, time.Time, time.Time) ([]domain.AgendaPayment, error)
	AgendaRecurring(context.Context) ([]domain.AgendaRecurring, error)
}
