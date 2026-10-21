package app

import (
	"context"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/config"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/infra/db"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/settings"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/usecase/insights"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type notificationSettingsStore struct{ rows []settings.Row }

func (f *notificationSettingsStore) LoadSettings(context.Context) ([]settings.Row, error) {
	return f.rows, nil
}
func (f *notificationSettingsStore) SaveSetting(context.Context, settings.Row) error { return nil }
func (f *notificationSettingsStore) DeleteSetting(context.Context, string) error     { return nil }

func notificationAppDB(t *testing.T) *db.DB {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL não configurada")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	schema := "notification_source_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err = admin.Exec(ctx, `CREATE SCHEMA `+schema); err != nil {
		t.Fatal(err)
	}
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",public"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pool.Close(); _, _ = admin.Exec(ctx, `DROP SCHEMA `+schema+` CASCADE`); admin.Close() })
	files, err := filepath.Glob(filepath.Join("..", "..", "migrations", "*.sql"))
	if err != nil {
		t.Fatal(err)
	}
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		if _, err = pool.Exec(ctx, string(data)); err != nil {
			t.Fatalf("migration %s: %v", filepath.Base(file), err)
		}
	}
	return &db.DB{Pool: pool}
}
func TestNotificationSourcePostgresRulesAndLegacyPreferences(t *testing.T) {
	database := notificationAppDB(t)
	ctx := context.Background()
	logger := slog.New(slog.DiscardHandler)
	// Todas as definições vêm da fixture, sem consultar configuração privada do ambiente.
	settingsStore := &notificationSettingsStore{}
	for _, def := range settings.Defs {
		value := def.Default
		switch def.Key {
		case "DIGEST_ENABLED":
			value = "true"
		case "DIGEST_HOUR":
			value = "14"
		case "DIGEST_WEEKDAY":
			value = "wednesday"
		case "DIGEST_TIMEZONE":
			value = "Asia/Tokyo"
		}
		settingsStore.rows = append(settingsStore.rows, settings.Row{Key: def.Key, Value: value})
	}
	configured := settings.NewService(settingsStore, nil, logger)
	if err := configured.Load(ctx); err != nil {
		t.Fatal(err)
	}
	a := &app{ctx: ctx, db: database, cfg: &config.Config{Channel: config.ChannelTelegram}, settings: configured, logger: logger, insights: insights.NewInsights(db.NewDashboardReader(database))}
	if err := a.buildNotifications(); err != nil {
		t.Fatal(err)
	}
	p, err := a.notifications.Preferences(ctx)
	if err != nil || p.Hour != 14 || p.Weekday != 3 || p.TimeZone != "Asia/Tokyo" || !p.Telegram {
		t.Fatalf("agenda anterior não foi herdada: err=%v", err)
	}
	p.Hour = 8
	p.TimeZone = "America/Sao_Paulo"
	p.HideAmounts = true
	if err = a.notifications.Save(ctx, p); err != nil {
		t.Fatal(err)
	}
	if err = a.buildNotifications(); err != nil {
		t.Fatal(err)
	}
	persisted, err := a.notifications.Preferences(ctx)
	if err != nil || persisted.Hour != 8 || persisted.TimeZone != "America/Sao_Paulo" || !persisted.HideAmounts {
		t.Fatal("reinício sobrescreveu preferências")
	}
	today := time.Date(2026, 10, 19, 12, 0, 0, 0, time.UTC)
	purchase := uuid.New()
	if _, err = database.Pool.Exec(ctx, `INSERT INTO purchases(id,description,category,payment_method,type,total_amount,raw_input,created_at) VALUES($1,'Loja sintética','FOOD','CREDIT','SINGLE',600,'fixture','2026-10-01')`, purchase); err != nil {
		t.Fatal(err)
	}
	for _, date := range []string{"2026-10-17", "2026-10-18"} {
		if _, err = database.Pool.Exec(ctx, `INSERT INTO payments(purchase_id,amount,status,due_date,reference_month) VALUES($1,300,'PAID',$2::date,'2026-10-01')`, purchase, date); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = database.Pool.Exec(ctx, `INSERT INTO payments(purchase_id,amount,status,due_date,reference_month) VALUES($1,50,'PENDING','2026-10-20','2026-10-01')`, purchase); err != nil {
		t.Fatal(err)
	}
	if _, err = database.Pool.Exec(ctx, `INSERT INTO payments(purchase_id,amount,status,due_date,reference_month,external_id) VALUES($1,70,'PENDING','2026-10-20','2026-10-01','imported-fixture')`, purchase); err != nil {
		t.Fatal(err)
	}
	if _, err = database.Pool.Exec(ctx, `INSERT INTO goals(id,kind,name,category,cut_percent,baseline,created_at) VALUES($1,'CUT','Meta sintética','FOOD',10,100,'2026-10-01')`, uuid.New()); err != nil {
		t.Fatal(err)
	}
	items, err := a.notificationSource(ctx, today, p)
	if err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	identities := map[string]bool{}
	for _, n := range items {
		counts[n.Kind]++
		if n.Identity == "" || identities[n.Identity] {
			t.Fatal("identidade vazia/duplicada")
		}
		identities[n.Identity] = true
	}
	if counts[domain.NotificationDigest] != 1 || counts[domain.NotificationReview] < 1 || counts[domain.NotificationGoals] != 1 || counts[domain.NotificationReminder] != 1 {
		t.Fatalf("tipos calculados incorretamente: %v", counts)
	}
	// A prévia usa o builder real, mascara valores e não grava notificações.
	preview, err := a.notifications.Preview(ctx, today, p)
	if err != nil {
		t.Fatal(err)
	}
	for _, n := range preview {
		if strings.Contains(n.Body, "300,00") || strings.Contains(n.Body, "650,00") {
			t.Fatal("prévia vazou valor")
		}
	}
	saved, err := a.notifications.List(ctx)
	if err != nil || len(saved) != 0 {
		t.Fatal("prévia gravou avisos")
	}
	// O mesmo job com source real é deduplicado no Postgres inclusive após remontar o serviço.
	p.Hour = 0
	p.Minute = 0
	p.Weekday = int(today.Weekday())
	if err = a.notifications.Save(ctx, p); err != nil {
		t.Fatal(err)
	}
	if err = a.notifications.Tick(ctx, today); err != nil {
		t.Fatal(err)
	}
	first, err := a.notifications.List(ctx)
	if err != nil || len(first) != len(items) {
		t.Fatalf("agendamento sem navegador: count=%d err=%v", len(first), err)
	}
	if err = a.buildNotifications(); err != nil {
		t.Fatal(err)
	}
	if err = a.notifications.Tick(ctx, today.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	repeated, err := a.notifications.List(ctx)
	if err != nil || len(repeated) != len(first) {
		t.Fatal("job repetido após reinício duplicou avisos")
	}
	if _, err = database.Pool.Exec(ctx, `INSERT INTO review_dismissals(kind,key) SELECT 'DUPLICATE', 'loja sintetica'`); err != nil {
		t.Fatal(err)
	}
	p.Types[domain.NotificationReview] = false
	p.Types[domain.NotificationGoals] = false
	p.Types[domain.NotificationReminder] = false
	items, err = a.notificationSource(ctx, today, p)
	if err != nil || len(items) != 1 || items[0].Kind != domain.NotificationDigest {
		t.Fatal("tipo desativado ainda gerou alerta")
	}
}
