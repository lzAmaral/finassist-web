package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain/ports"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/usecase/notifications"
	"github.com/google/uuid"
	"log/slog"
	"net/http"
	"strings"
	"testing"
	"time"
)

type notificationHTTPStore struct {
	ports.NotificationStore
	p      domain.NotificationPreferences
	saved  bool
	marked string
	err    error
}

func (f *notificationHTTPStore) Preferences(context.Context) (domain.NotificationPreferences, error) {
	return f.p, f.err
}
func (f *notificationHTTPStore) SavePreferences(_ context.Context, p domain.NotificationPreferences) error {
	if f.err != nil {
		return f.err
	}
	f.p = p
	f.saved = true
	return nil
}
func (f *notificationHTTPStore) List(context.Context) ([]domain.Notification, error) {
	return []domain.Notification{}, f.err
}
func (f *notificationHTTPStore) Mark(_ context.Context, id string, _ bool) (bool, error) {
	f.marked = id
	return true, f.err
}
func TestNotificationsAPI_SessionOriginPreferencesAndPreview(t *testing.T) {
	store := &notificationHTTPStore{p: domain.NotificationPreferences{Types: map[string]bool{"weekly_digest": true, "review": true, "goals": true, "reminders": true}, Hour: 9, Weekday: 1, TimeZone: "UTC", HideAmounts: true}}
	service := &notifications.Service{Store: store, Build: func(context.Context, time.Time, domain.NotificationPreferences) ([]domain.Notification, error) {
		return []domain.Notification{{Kind: domain.NotificationDigest, Title: "Resumo", Body: "Despesa R$ 100,00"}}, nil
	}, TelegramReady: func() bool { return false }}
	s := NewServer(0, slog.New(slog.DiscardHandler))
	s.SetNotifications(service)
	if err := s.MountAPI(StaticPassword(testPassword), &fakeReader{}); err != nil {
		t.Fatal(err)
	}
	headers := map[string]string{"Content-Type": "application/json"}
	payload, _ := json.Marshal(store.p)
	body := string(payload)
	id := uuid.NewString()
	for _, route := range []struct{ method, path string }{{"GET", "/api/notifications"}, {"PUT", "/api/notifications/preferences"}, {"POST", "/api/notifications/preview"}, {"POST", "/api/notifications/" + id + "/read"}} {
		if rec := do(s, route.method, route.path, body, headers); rec.Code != http.StatusUnauthorized {
			t.Fatalf("sem sessão %s = %d", route.path, rec.Code)
		}
	}
	cookie := login(t, s)
	evil := map[string]string{"Content-Type": "application/json", "Origin": "https://evil.example"}
	if rec := do(s, "PUT", "/api/notifications/preferences", body, evil, cookie); rec.Code != 403 || store.saved {
		t.Fatal("origem externa alterou preferências")
	}
	if rec := do(s, "PUT", "/api/notifications/preferences", strings.Replace(body, `"UTC"`, `"bad/zone"`, 1), headers, cookie); rec.Code != 400 || store.saved {
		t.Fatal("fuso inválido aceito")
	}
	if rec := do(s, "PUT", "/api/notifications/preferences", body, headers, cookie); rec.Code != 200 || !store.saved {
		t.Fatalf("salvar=%d", rec.Code)
	}
	store.saved = false
	if rec := do(s, "POST", "/api/notifications/preview", body, headers, cookie); rec.Code != 200 || strings.Contains(rec.Body.String(), "100,00") || store.saved {
		t.Fatalf("prévia=%d", rec.Code)
	}
	if rec := do(s, "GET", "/api/notifications", "", nil, cookie); rec.Code != 200 || !strings.Contains(rec.Body.String(), `"schedulerRunning":false`) || !strings.Contains(rec.Body.String(), `"telegramReady":false`) {
		t.Fatalf("capacidade indevida=%d %s", rec.Code, rec.Body)
	}
	if rec := do(s, "POST", "/api/notifications/"+id+"/read", "{}", headers, cookie); rec.Code != 200 || store.marked != id {
		t.Fatal("leitura não persistida")
	}
	store.err = errors.New("falha sintética privada")
	if rec := do(s, "PUT", "/api/notifications/preferences", body, headers, cookie); rec.Code != 500 || store.saved || strings.Contains(rec.Body.String(), "privada") {
		t.Fatal("erro de persistência virou sucesso/vazou conteúdo")
	}
}
func TestNotificationsAPI_Unavailable(t *testing.T) {
	s := newTestAPI(t, &fakeReader{})
	cookie := login(t, s)
	if rec := do(s, "GET", "/api/notifications", "", nil, cookie); rec.Code != 503 {
		t.Fatal("serviço ausente não é explícito")
	}
}
