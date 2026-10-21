package httpserver

import (
	"context"
	"encoding/json"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/google/uuid"
	"io"
	"log/slog"
	"testing"
)

type statementFake struct {
	*fakeReader
	batch     domain.StatementBatch
	confirmed bool
	balance   float64
	failure   error
}

func (f *statementFake) CreateStatementAccount(_ context.Context, _ string, balance float64) (string, error) {
	f.balance = balance
	return uuid.NewString(), f.failure
}
func (f *statementFake) PreviewStatement(_ context.Context, b domain.StatementBatch) (domain.StatementBatch, error) {
	f.batch = b
	f.batch.ID = uuid.NewString()
	f.batch.Status = "PREVIEW"
	return f.batch, f.failure
}
func (f *statementFake) StatementBatches(context.Context) ([]domain.StatementBatch, error) {
	return []domain.StatementBatch{}, f.failure
}
func (f *statementFake) StatementBatch(context.Context, string) (domain.StatementBatch, error) {
	return f.batch, f.failure
}
func (f *statementFake) ConfirmStatement(context.Context, string, []domain.StatementDecision) (domain.StatementBatch, error) {
	f.confirmed = true
	return f.batch, f.failure
}
func (f *statementFake) RevertStatement(context.Context, string) (domain.StatementBatch, error) {
	return f.batch, f.failure
}
func TestStatementImportAPIAuthenticationValidationAndConflict(t *testing.T) {
	f := &statementFake{fakeReader: &fakeReader{}}
	s := NewServer(0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err := s.MountAPI(StaticPassword(testPassword), f); err != nil {
		t.Fatal(err)
	}
	id := uuid.NewString()
	headers := map[string]string{"Content-Type": "application/json"}
	for _, route := range []struct{ method, path string }{{"GET", "/api/imports"}, {"GET", "/api/imports/" + id}, {"POST", "/api/imports/preview"}, {"POST", "/api/imports/accounts"}, {"POST", "/api/imports/" + id + "/confirm"}, {"POST", "/api/imports/" + id + "/revert"}} {
		if rec := do(s, route.method, route.path, `{}`, headers); rec.Code != 401 {
			t.Fatalf("sem sessão %s: %d", route.path, rec.Code)
		}
	}
	cookie := login(t, s)
	if rec := do(s, "POST", "/api/imports/"+id+"/confirm", `{"decisions":[]}`, map[string]string{"Content-Type": "application/json", "Origin": "https://evil.example"}, cookie); rec.Code != 403 || f.confirmed {
		t.Fatalf("origem: %d", rec.Code)
	}
	for _, body := range []string{`{"name":"Banco"}`, `{"name":"Banco","balance":1.234}`, `{"name":"","balance":0}`} {
		if rec := do(s, "POST", "/api/imports/accounts", body, headers, cookie); rec.Code != 400 {
			t.Fatalf("conta inválida=%d %s", rec.Code, rec.Body)
		}
	}
	if rec := do(s, "POST", "/api/imports/accounts", `{"name":"Banco sintético","balance":0}`, headers, cookie); rec.Code != 201 {
		t.Fatalf("saldo zero explícito=%d %s", rec.Code, rec.Body)
	}
	body := map[string]any{"accountId": id, "filename": "sintetico.csv", "format": "csv", "content": "Data;Descrição;Valor\n21/10/2026;Loja;-12,34", "mapping": domain.StatementMapping{Date: 0, Description: 1, Amount: 2, Currency: -1, Header: true, Decimal: ",", DateFormat: "DMY"}}
	encoded, _ := json.Marshal(body)
	if rec := do(s, "POST", "/api/imports/preview", string(encoded), headers, cookie); rec.Code != 200 || len(f.batch.Rows) != 1 || f.confirmed {
		t.Fatalf("prévia=%d %s", rec.Code, rec.Body)
	}
	f.failure = domain.ErrStatementConflict
	if rec := do(s, "POST", "/api/imports/"+id+"/confirm", `{"decisions":[{"row":2,"action":"create"}]}`, headers, cookie); rec.Code != 409 {
		t.Fatalf("conflito=%d %s", rec.Code, rec.Body)
	}
}
func TestStatementImportAPIUnavailable(t *testing.T) {
	s := newTestAPI(t, &fakeReader{})
	cookie := login(t, s)
	if rec := do(s, "GET", "/api/imports", "", nil, cookie); rec.Code != 503 {
		t.Fatalf("modo sem persistência=%d", rec.Code)
	}
}
