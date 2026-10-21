package db

import (
	"context"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// Schema próprio permite testar concorrência/persistência sem limpar dados de outros testes.
func notificationTestDB(t *testing.T) (*DB, func() *DB) {
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
	schema := "notifications_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err = admin.Exec(ctx, `CREATE SCHEMA `+schema); err != nil {
		t.Fatal(err)
	}
	open := func() *DB {
		cfg, err := pgxpool.ParseConfig(url)
		if err != nil {
			t.Fatal(err)
		}
		cfg.ConnConfig.RuntimeParams["search_path"] = schema
		pool, err := pgxpool.NewWithConfig(ctx, cfg)
		if err != nil {
			t.Fatal(err)
		}
		return &DB{Pool: pool}
	}
	database := open()
	t.Cleanup(func() { database.Close(); _, _ = admin.Exec(ctx, `DROP SCHEMA `+schema+` CASCADE`); admin.Close() })
	migration, err := os.ReadFile(filepath.Join("..", "..", "..", "migrations", "021_notifications.sql"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err = database.Pool.Exec(ctx, string(migration)); err != nil {
		t.Fatal(err)
	}
	if _, err = database.Pool.Exec(ctx, string(migration)); err != nil {
		t.Fatal("migration não idempotente:", err)
	}
	return database, open
}
func dbNotificationPreferences() domain.NotificationPreferences {
	return domain.NotificationPreferences{Types: map[string]bool{"weekly_digest": true, "review": true, "goals": true, "reminders": true}, Hour: 9, Minute: 30, Weekday: 1, TimeZone: "America/Sao_Paulo", Telegram: true, HideAmounts: true}
}
func TestNotificationsPostgresPersistenceDedupAndClaims(t *testing.T) {
	database, reopen := notificationTestDB(t)
	ctx := context.Background()
	store := NewNotificationStore(database)
	p := dbNotificationPreferences()
	if err := store.Init(ctx, p); err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	n := domain.Notification{Identity: "weekly:2026-W43", Kind: domain.NotificationDigest, Title: "Resumo sintético", Body: "Valores ocultos", CreatedAt: now}
	var wg sync.WaitGroup
	errs := make(chan error, 20)
	for range 12 {
		wg.Go(func() { errs <- store.Insert(ctx, n, true) })
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	items, err := store.List(ctx)
	if err != nil || len(items) != 1 {
		t.Fatalf("identidade duplicada: count=%d err=%v", len(items), err)
	}
	second := reopen()
	defer second.Close()
	saved, err := NewNotificationStore(second).Preferences(ctx)
	if err != nil || saved.TimeZone != p.TimeZone || !saved.HideAmounts {
		t.Fatal("preferências não persistiram")
	}
	claims := make(chan *domain.Notification, 12)
	claimErrors := make(chan error, 12)
	for range 12 {
		wg.Go(func() { n, err := NewNotificationStore(second).Claim(ctx, now); claims <- n; claimErrors <- err })
	}
	wg.Wait()
	close(claims)
	close(claimErrors)
	count := 0
	for n := range claims {
		if n != nil {
			count++
		}
	}
	for err := range claimErrors {
		if err != nil {
			t.Fatal(err)
		}
	}
	if count != 1 {
		t.Fatalf("claims concorrentes=%d; esperado1", count)
	}
	// Simular processo encerrado depois do envio: nenhuma repetição automática é permitida.
	claim, err := store.Claim(ctx, now.Add(2*time.Minute))
	if err != nil || claim != nil {
		t.Fatal("claim ambíguo foi retomado")
	}
	items, err = store.List(ctx)
	if err != nil || items[0].LastError != "delivery_uncertain" || items[0].Attempts != 1 {
		t.Fatal("envio interrompido não registrado como incerto")
	}
	if ok, err := store.Mark(ctx, items[0].ID, false); err != nil || !ok {
		t.Fatal("falha ao ler")
	}
	if ok, err := store.Mark(ctx, items[0].ID, true); err != nil || !ok {
		t.Fatal("falha ao dispensar")
	}
	items, err = store.List(ctx)
	if err != nil || len(items) != 0 {
		t.Fatal("dispensa não persistiu")
	}
	if err = store.Insert(ctx, n, true); err != nil {
		t.Fatal(err)
	}
	items, _ = store.List(ctx)
	if len(items) != 0 {
		t.Fatal("dispensa reapareceu após job repetido")
	}
}
func TestNotificationsPostgresDisableCancelsPending(t *testing.T) {
	database, _ := notificationTestDB(t)
	ctx := context.Background()
	store := NewNotificationStore(database)
	p := dbNotificationPreferences()
	if err := store.Init(ctx, p); err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	n := domain.Notification{Identity: "review:one", Kind: domain.NotificationReview, Title: "Revisão", Body: "Sintético", CreatedAt: now}
	if err := store.Insert(ctx, n, true); err != nil {
		t.Fatal(err)
	}
	p.Types[domain.NotificationReview] = false
	p.TimeZone = "Asia/Tokyo"
	if err := store.SavePreferences(ctx, p); err != nil {
		t.Fatal(err)
	}
	claim, err := store.Claim(ctx, now)
	if err != nil || claim != nil {
		t.Fatal("regra desativada gerou entrega")
	}
	items, err := store.List(ctx)
	if err != nil || len(items) != 1 || items[0].DeliveryStatus != "cancelled" {
		t.Fatal("pendência não cancelada")
	}
	n.Identity = "review:two"
	if err = store.Insert(ctx, n, true); err != nil {
		t.Fatal(err)
	}
	items, _ = store.List(ctx)
	if len(items) != 1 {
		t.Fatal("preferência atual não bloqueou gerador desatualizado")
	}
	p.Types[domain.NotificationReview] = true
	p.Telegram = false
	if err = store.SavePreferences(ctx, p); err != nil {
		t.Fatal(err)
	}
	n.Identity = "review:three"
	if err = store.Insert(ctx, n, true); err != nil {
		t.Fatal(err)
	}
	items, _ = store.List(ctx)
	var current domain.Notification
	for _, item := range items {
		if item.Identity == n.Identity {
			current = item
		}
	}
	if len(items) != 2 || current.DeliveryStatus != "in_app" {
		t.Fatal("Telegram desativado ainda foi enfileirado")
	}
}
