package httpserver

import (
	"context"
	"encoding/json"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/settings"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/usecase/notifications"
	"log/slog"
	"testing"
)

func TestLegacyDigestSettingsShareNotificationPreferences(t *testing.T) {
	ctx := context.Background()
	logger := slog.New(slog.DiscardHandler)
	legacy := &memSettings{rows: map[string]settings.Row{}}
	for _, def := range settings.Defs {
		legacy.rows[def.Key] = settings.Row{Key: def.Key, Value: def.Default}
	}
	configService := settings.NewService(legacy, nil, logger)
	if err := configService.Load(ctx); err != nil {
		t.Fatal(err)
	}
	store := &notificationHTTPStore{p: domain.NotificationPreferences{Types: map[string]bool{"weekly_digest": true, "review": true, "goals": true, "reminders": true}, Hour: 15, Minute: 45, Weekday: 2, TimeZone: "Asia/Tokyo", Telegram: true}}
	service := &notifications.Service{Store: store}
	s := NewServer(0, logger)
	s.SetSettings(&SettingsDeps{Service: configService, Channel: "telegram"})
	s.SetNotifications(service)
	if err := s.MountAPI(StaticPassword(testPassword), &fakeReader{}); err != nil {
		t.Fatal(err)
	}
	cookie := login(t, s)
	headers := map[string]string{"Content-Type": "application/json"}
	readField := func(key string) string {
		t.Helper()
		rec := do(s, "GET", "/api/settings", "", nil, cookie)
		if rec.Code != 200 {
			t.Fatalf("getSettings=%d", rec.Code)
		}
		var result struct {
			Groups []groupJSON `json:"groups"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		for _, group := range result.Groups {
			for _, field := range group.Fields {
				if field.Key == key {
					return field.Value
				}
			}
		}
		t.Fatalf("campo %s ausente", key)
		return ""
	}
	if readField("DIGEST_HOUR") != "15" || readField("DIGEST_TIMEZONE") != "Asia/Tokyo" {
		t.Fatal("tela antiga leu shadow settings")
	}
	if rec := do(s, "PUT", "/api/settings", `{"values":{"DIGEST_HOUR":"17","DIGEST_WEEKDAY":"friday","DIGEST_ENABLED":"false"}}`, headers, cookie); rec.Code != 200 {
		t.Fatalf("putSettings=%d %s", rec.Code, rec.Body)
	}
	if store.p.Hour != 17 || store.p.Minute != 0 || store.p.Weekday != 5 || store.p.Types[domain.NotificationDigest] || !store.p.Types[domain.NotificationReview] {
		t.Fatal("edição antiga não alterou preferências oficiais corretamente")
	}
	if legacy.rows["DIGEST_HOUR"].Value != "9" || readField("DIGEST_HOUR") != "17" {
		t.Fatal("duas agendas foram persistidas")
	}
	// O caminho Svelte também se reflete imediatamente no GET usado pelo React.
	store.p.Hour = 6
	store.p.Minute = 30
	if readField("DIGEST_HOUR") != "6" {
		t.Fatal("preferência nova não apareceu na API antiga")
	}
	if rec := do(s, "PUT", "/api/settings", `{"values":{"DIGEST_HOUR":"20","SYNC_LOOKBACK_DAYS":"999"}}`, headers, cookie); rec.Code != 400 || store.p.Hour != 6 {
		t.Fatal("lote inválido alterou preferências parcialmente")
	}
	previousLookback := legacy.rows["SYNC_LOOKBACK_DAYS"].Value
	if rec := do(s, "PUT", "/api/settings", `{"values":{"DIGEST_HOUR":"20","SYNC_LOOKBACK_DAYS":"90"}}`, headers, cookie); rec.Code != 400 || store.p.Hour != 6 || legacy.rows["SYNC_LOOKBACK_DAYS"].Value != previousLookback {
		t.Fatal("lote misto válido não foi recusado sem mutação")
	}
	if rec := do(s, "PUT", "/api/settings", `{"values":{"DIGEST_ENABLED":"true"}}`, headers, cookie); rec.Code != 200 || !store.p.Telegram || !store.p.Types[domain.NotificationDigest] {
		t.Fatal("ativação antiga não habilitou resumo/canal")
	}
	t.Setenv("DIGEST_HOUR", "13")
	if rec := do(s, "POST", "/api/settings/reset/DIGEST_HOUR", "{}", headers, cookie); rec.Code != 200 || store.p.Hour != 13 || store.p.Minute != 0 {
		t.Fatalf("reset não restaurou ambiente: %d hour=%d", rec.Code, store.p.Hour)
	}
}
