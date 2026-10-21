package ports

import (
	"context"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"time"
)

type NotificationStore interface {
	Init(context.Context, domain.NotificationPreferences) error
	Preferences(context.Context) (domain.NotificationPreferences, error)
	SavePreferences(context.Context, domain.NotificationPreferences) error
	Insert(context.Context, domain.Notification, bool) error
	List(context.Context) ([]domain.Notification, error)
	Mark(context.Context, string, bool) (bool, error)
	Claim(context.Context, time.Time) (*domain.Notification, error)
	Finish(context.Context, string, string, string, time.Time) error
}
