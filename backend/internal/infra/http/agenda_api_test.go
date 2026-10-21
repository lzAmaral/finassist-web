package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/usecase/agenda"
	"github.com/google/uuid"
)

type agendaFake struct {
	*fakeReader
	agendaErr error
}

func (f *agendaFake) AgendaPayments(context.Context, time.Time, time.Time) ([]domain.AgendaPayment, error) {
	due := time.Date(2026, 10, 20, 0, 0, 0, 0, time.UTC)
	return []domain.AgendaPayment{{ID: uuid.New(), PurchaseID: uuid.New(), Description: "Conta sintética", Amount: 123.45,
		DueDate: &due, Status: domain.PaymentStatusPending}}, f.agendaErr
}
func (f *agendaFake) AgendaRecurring(context.Context) ([]domain.AgendaRecurring, error) {
	return nil, f.agendaErr
}

func TestAPI_Agenda(t *testing.T) {
	f := &agendaFake{fakeReader: &fakeReader{accounts: []domain.Account{{ID: uuid.New(), ItemID: "ORIGEM-PRIVADA", Type: domain.AccountCredit, Name: "Cartão sintético", Balance: 500}}}}
	s := NewServer(0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err := s.mountAPI(StaticPassword(testPassword), f, func() time.Time { return time.Date(2026, 10, 21, 12, 0, 0, 0, time.UTC) }); err != nil {
		t.Fatal(err)
	}
	if rec := do(s, "GET", "/api/agenda", "", nil); rec.Code != 401 {
		t.Fatalf("sem sessão: %d", rec.Code)
	}
	cookie := login(t, s)
	rec := do(s, "GET", "/api/agenda", "", nil, cookie)
	if rec.Code != 200 || rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("resposta: %d %s", rec.Code, rec.Body)
	}
	if strings.Contains(rec.Body.String(), "ORIGEM-PRIVADA") {
		t.Fatal("origem privada exposta")
	}
	var result agenda.Result
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Cards) != 1 || result.Cards[0].Invoice != nil || result.Cards[0].DueDate != nil || result.Totals["overdue"].Confirmed != 123.45 {
		t.Fatalf("contrato inválido: %s", rec.Body)
	}
	f.agendaErr = errors.New("SEGREDO-banco")
	rec = do(s, "GET", "/api/agenda", "", nil, cookie)
	if rec.Code != 500 || strings.Contains(rec.Body.String(), "SEGREDO") {
		t.Fatalf("erro: %d %s", rec.Code, rec.Body)
	}
}

func TestAPI_AgendaUnavailableInOldReader(t *testing.T) {
	s := newTestAPI(t, &fakeReader{})
	rec := do(s, "GET", "/api/agenda", "", nil, login(t, s))
	if rec.Code != 501 {
		t.Fatalf("recurso não suportado: %d %s", rec.Code, rec.Body)
	}
}
