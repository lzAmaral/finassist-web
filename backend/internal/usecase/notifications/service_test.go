package notifications

import (
	"bytes"
	"context"
	"errors"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"log/slog"
	"strings"
	"testing"
	"time"
)

type memoryStore struct {
	p    domain.NotificationPreferences
	rows map[string]domain.Notification
	next map[string]time.Time
}

func testPreferences() domain.NotificationPreferences {
	return domain.NotificationPreferences{Types: map[string]bool{"weekly_digest": true, "review": true, "goals": true, "reminders": true}, Hour: 9, Weekday: 1, TimeZone: "America/Sao_Paulo", Telegram: true}
}
func newMemory() *memoryStore {
	return &memoryStore{p: testPreferences(), rows: map[string]domain.Notification{}, next: map[string]time.Time{}}
}
func (m *memoryStore) Init(context.Context, domain.NotificationPreferences) error { return nil }
func (m *memoryStore) Preferences(context.Context) (domain.NotificationPreferences, error) {
	return m.p, nil
}
func (m *memoryStore) SavePreferences(_ context.Context, p domain.NotificationPreferences) error {
	m.p = p
	for k, n := range m.rows {
		if !p.Telegram || !p.Types[n.Kind] {
			n.DeliveryStatus = "cancelled"
			m.rows[k] = n
		}
	}
	return nil
}
func (m *memoryStore) Insert(_ context.Context, n domain.Notification, tg bool) error {
	if _, ok := m.rows[n.Identity]; ok {
		return nil
	}
	n.ID = n.Identity
	n.DeliveryStatus = "in_app"
	if tg {
		n.DeliveryStatus = "pending"
	}
	m.rows[n.ID] = n
	return nil
}
func (m *memoryStore) List(context.Context) ([]domain.Notification, error) {
	out := []domain.Notification{}
	for _, n := range m.rows {
		out = append(out, n)
	}
	return out, nil
}
func (m *memoryStore) Mark(context.Context, string, bool) (bool, error) { return true, nil }
func (m *memoryStore) Claim(_ context.Context, now time.Time) (*domain.Notification, error) {
	for k, n := range m.rows {
		if (n.DeliveryStatus == "pending" || n.DeliveryStatus == "retry") && n.Attempts < 3 && !m.next[k].After(now) && m.p.Telegram && m.p.Types[n.Kind] {
			n.Attempts++
			n.DeliveryStatus = "sending"
			m.rows[k] = n
			return &n, nil
		}
	}
	return nil, nil
}
func (m *memoryStore) Finish(_ context.Context, id, status, code string, next time.Time) error {
	n := m.rows[id]
	n.DeliveryStatus = status
	n.LastError = code
	m.rows[id] = n
	m.next[id] = next
	return nil
}

type rejection struct{}

func (rejection) Error() string          { return "recusado: conteúdo privado R$ 123,45" }
func (rejection) DeliveryRejected() bool { return true }

type fakeTransport struct {
	calls int
	texts []string
	err   error
}

func (f *fakeTransport) SendText(_ context.Context, _, text string) (string, error) {
	f.calls++
	f.texts = append(f.texts, text)
	return "", f.err
}
func (f *fakeTransport) SendDocument(context.Context, string, string, []byte, string) (string, error) {
	panic("não deve enviar arquivo")
}
func fixedBuild(_ context.Context, _ time.Time, _ domain.NotificationPreferences) ([]domain.Notification, error) {
	return []domain.Notification{{Identity: "digest-2026-W43", Kind: domain.NotificationDigest, Title: "Resumo", Body: "Despesas R$ 123,45 em 19/10/2026"}}, nil
}
func testService(store *memoryStore, transport *fakeTransport) *Service {
	return &Service{Store: store, Build: fixedBuild, Messenger: transport, TelegramReady: func() bool { return true }, Logger: slog.New(slog.DiscardHandler)}
}
func mustTick(t *testing.T, s *Service, now time.Time) {
	t.Helper()
	if err := s.Tick(context.Background(), now); err != nil {
		t.Fatal(err)
	}
}
func TestScheduleDedupRestartAndTimeZone(t *testing.T) {
	store := newMemory()
	transport := &fakeTransport{}
	s := testService(store, transport)
	// Segunda 11:59 UTC ainda é 08:59 em São Paulo.
	now := time.Date(2026, 10, 19, 11, 59, 0, 0, time.UTC)
	mustTick(t, s, now)
	if len(store.rows) != 0 {
		t.Fatal("enviou antes do horário local")
	}
	mustTick(t, s, now.Add(time.Minute))
	mustTick(t, s, now.Add(2*time.Minute))
	if len(store.rows) != 1 || transport.calls != 1 {
		t.Fatalf("deduplicação falhou: rows=%d sends=%d", len(store.rows), transport.calls)
	}
	store.p.TimeZone = "UTC"
	restarted := testService(store, transport)
	mustTick(t, restarted, now.Add(3*time.Minute))
	if transport.calls != 1 {
		t.Fatal("reinício/fuso duplicou entrega")
	}
}
func TestDeliveryRetriesAreBoundedAndPrivate(t *testing.T) {
	store := newMemory()
	transport := &fakeTransport{err: rejection{}}
	s := testService(store, transport)
	var log bytes.Buffer
	s.Logger = slog.New(slog.NewTextHandler(&log, nil))
	now := time.Date(2026, 10, 19, 13, 0, 0, 0, time.UTC)
	for _, delta := range []time.Duration{0, time.Minute, 5 * time.Minute, 15 * time.Minute, 30 * time.Minute} {
		mustTick(t, s, now.Add(delta))
	}
	n := store.rows["digest-2026-W43"]
	if transport.calls != 3 || n.DeliveryStatus != "failed" || n.Attempts != 3 {
		t.Fatalf("retentativas não limitadas: sends=%d status=%s attempts=%d", transport.calls, n.DeliveryStatus, n.Attempts)
	}
	if strings.Contains(log.String(), "123") || strings.Contains(n.LastError, "123") {
		t.Fatal("conteúdo financeiro em log/erro")
	}
}
func TestDisconnectedDisableAndPrivacyPreview(t *testing.T) {
	store := newMemory()
	store.p.HideAmounts = true
	transport := &fakeTransport{}
	s := testService(store, transport)
	s.TelegramReady = func() bool { return false }
	now := time.Date(2026, 10, 19, 13, 0, 0, 0, time.UTC)
	mustTick(t, s, now)
	if len(store.rows) != 1 || transport.calls != 0 {
		t.Fatal("canal desconectado impediu in-app ou tentou enviar")
	}
	p := store.p
	p.Types = map[string]bool{"weekly_digest": false, "review": true, "goals": true, "reminders": true}
	if err := s.Save(context.Background(), p); err != nil {
		t.Fatal(err)
	}
	s.TelegramReady = func() bool { return true }
	mustTick(t, s, now.Add(time.Hour))
	if transport.calls != 0 || store.rows["digest-2026-W43"].DeliveryStatus != "cancelled" {
		t.Fatal("regra desativada enviou pendência")
	}
	// A prévia não toca o store nem o transporte e respeita os valores ocultos.
	previewService := &Service{Build: fixedBuild}
	items, err := previewService.Preview(context.Background(), now, store.p)
	if err != nil || len(items) != 1 || strings.Contains(items[0].Body, "123,45") || !strings.Contains(items[0].Body, "19/10/2026") {
		t.Fatalf("prévia inválida: err=%v", err)
	}
}
func TestAmbiguousTransportFailureIsNeverRetried(t *testing.T) {
	store := newMemory()
	transport := &fakeTransport{err: errors.New("resposta perdida")}
	s := testService(store, transport)
	now := time.Date(2026, 10, 19, 13, 0, 0, 0, time.UTC)
	mustTick(t, s, now)
	mustTick(t, s, now.Add(time.Hour))
	if transport.calls != 1 || store.rows["digest-2026-W43"].LastError != "delivery_uncertain" {
		t.Fatal("entrega ambígua foi repetida")
	}
}
func TestPreferencesValidation(t *testing.T) {
	good := testPreferences()
	if err := Validate(good); err != nil {
		t.Fatal(err)
	}
	for _, change := range []func(*domain.NotificationPreferences){func(p *domain.NotificationPreferences) { p.TimeZone = "bad/zone" }, func(p *domain.NotificationPreferences) { p.Minute = 60 }, func(p *domain.NotificationPreferences) { p.Weekday = 7 }, func(p *domain.NotificationPreferences) { p.Types = map[string]bool{"unknown": true} }} {
		p := testPreferences()
		change(&p)
		if Validate(p) == nil {
			t.Fatal("preferência inválida aceita")
		}
	}
}

func TestRunSchedulesWithoutBrowser(t *testing.T) {
	store := newMemory()
	store.p.Hour = 0
	store.p.Weekday = int(time.Now().In(time.UTC).Weekday())
	store.p.TimeZone = "UTC"
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	s := testService(store, &fakeTransport{})
	s.TelegramReady = func() bool { return false }
	s.Build = func(ctx context.Context, now time.Time, p domain.NotificationPreferences) ([]domain.Notification, error) {
		if !s.Running() {
			t.Error("agendador não sinalizou atividade")
		}
		cancel()
		return fixedBuild(ctx, now, p)
	}
	done := make(chan struct{})
	go func() { s.Run(ctx); close(done) }()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("agendador não parou com contexto")
	}
	if len(store.rows) != 1 || s.Running() {
		t.Fatal("job sem navegador não persistiu aviso ou não encerrou")
	}
}

func TestQueuedDeliverySurvivesDataReadError(t *testing.T) {
	store := newMemory()
	transport := &fakeTransport{}
	s := testService(store, transport)
	s.TelegramReady = func() bool { return false }
	now := time.Date(2026, 10, 19, 13, 0, 0, 0, time.UTC)
	mustTick(t, s, now)
	s.TelegramReady = func() bool { return true }
	s.Build = func(context.Context, time.Time, domain.NotificationPreferences) ([]domain.Notification, error) {
		return nil, errors.New("fonte temporariamente indisponível")
	}
	if err := s.Tick(context.Background(), now.Add(time.Minute)); err == nil {
		t.Fatal("falha de consulta foi omitida")
	}
	if transport.calls != 1 || store.rows["digest-2026-W43"].DeliveryStatus != "sent" {
		t.Fatal("consulta falhou e impediu entrega já persistida")
	}
}
