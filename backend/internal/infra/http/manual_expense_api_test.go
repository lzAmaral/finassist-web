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
	"github.com/google/uuid"
)

type manualExpenseFake struct {
	*fakeReader
	input   domain.ManualExpense
	result  domain.ManualExpenseResult
	failure error
	calls   int
}

func (f *manualExpenseFake) SaveManualExpense(_ context.Context, in domain.ManualExpense) (domain.ManualExpenseResult, error) {
	f.input = in
	f.calls++
	return f.result, f.failure
}
func manualBody() domain.ManualExpense {
	return domain.ManualExpense{RequestID: uuid.New(), AccountID: uuid.New(), AmountCents: 123456, Description: "  Compra sintética  ", Date: "2026-10-31", Category: domain.CategoryMarket, PaymentMethod: domain.PaymentMethodPix}
}
func manualJSON(t *testing.T, body any) string {
	t.Helper()
	b, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}
func TestManualExpenseAPIProtectionValidationAndErrors(t *testing.T) {
	f := &manualExpenseFake{fakeReader: &fakeReader{}}
	s := NewServer(0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err := s.mountAPI(StaticPassword(testPassword), f, func() time.Time { return time.Date(2026, 11, 1, 1, 30, 0, 0, time.UTC) }); err != nil {
		t.Fatal(err)
	}
	body := manualBody()
	raw := manualJSON(t, body)
	path := "/api/transactions/manual"
	headers := map[string]string{"Content-Type": "application/json"}
	if r := do(s, "POST", path, raw, headers); r.Code != 401 {
		t.Fatalf("sessão=%d", r.Code)
	}
	cookie := login(t, s)
	for _, h := range []map[string]string{{"Content-Type": "application/json", "Origin": "https://evil.example"}, {"Content-Type": "text/plain"}} {
		if r := do(s, "POST", path, raw, h, cookie); r.Code != 403 {
			t.Fatalf("origem/tipo=%d", r.Code)
		}
	}
	invalid := []string{"", "null", "[]", "{", raw + ` {}`, raw + ` garbage`, strings.Replace(raw, `123456`, `1.5`, 1), strings.Replace(raw, `123456`, `9223372036854775808`, 1), strings.Replace(raw, `123456`, `0`, 1), strings.Replace(raw, `123456`, `-1`, 1), strings.Replace(raw, `123456`, `1000000000000`, 1), strings.Replace(raw, `2026-10-31`, `2026-11-01`, 1), strings.Replace(raw, `2026-10-31`, `2026-02-30`, 1), strings.Replace(raw, `MARKET`, `SALARY`, 1), strings.Replace(raw, `PIX`, `CREDIT_CARD`, 1), strings.Replace(raw, body.AccountID.String(), uuid.Nil.String(), 1), strings.Replace(raw, body.RequestID.String(), "bad-uuid", 1), raw[:len(raw)-1] + `,"kind":"INCOME"}`, raw[:len(raw)-1] + `,"status":"PENDING"}`, raw[:len(raw)-1] + `,"installmentCount":2}`, strings.Replace(raw, `  Compra sintética  `, strings.Repeat("x", 8200), 1)}
	for _, in := range invalid {
		if r := do(s, "POST", path, in, headers, cookie); r.Code != 400 {
			t.Fatalf("inválido (%s)=%d %s", in, r.Code, r.Body)
		}
	}
	if f.calls != 0 {
		t.Fatalf("gravou entrada inválida %d", f.calls)
	}
	f.result = domain.ManualExpenseResult{ID: uuid.New(), PurchaseID: uuid.New(), RequestID: body.RequestID, Date: body.Date, AmountCents: body.AmountCents}
	for _, cents := range []int64{1, 123456, 999999999999} {
		body.AmountCents = cents
		if r := do(s, "POST", path, manualJSON(t, body), headers, cookie); r.Code != 201 || f.input.Description != "Compra sintética" || f.input.AmountCents != cents {
			t.Fatalf("salvo=%d %s", r.Code, r.Body)
		}
	}
	f.result.Replayed = true
	if r := do(s, "POST", path, raw, headers, cookie); r.Code != 200 || !strings.Contains(r.Body.String(), `"replayed":true`) {
		t.Fatalf("replay=%d %s", r.Code, r.Body)
	}
	for _, tc := range []struct {
		err    error
		status int
	}{{domain.ErrManualExpenseAccount, 400}, {domain.ErrManualExpenseInvalid, 400}, {domain.ErrManualExpenseConflict, 409}, {errors.New("senha-banco-secreta"), 500}} {
		f.failure = tc.err
		r := do(s, "POST", path, raw, headers, cookie)
		if r.Code != tc.status || strings.Contains(r.Body.String(), "senha-banco-secreta") {
			t.Fatalf("falha=%d %s", r.Code, r.Body)
		}
	}
}
func TestManualExpenseAPIUnavailable(t *testing.T) {
	s := newTestAPI(t, &fakeReader{})
	cookie := login(t, s)
	r := do(s, "POST", "/api/transactions/manual", manualJSON(t, manualBody()), map[string]string{"Content-Type": "application/json"}, cookie)
	if r.Code != 503 {
		t.Fatalf("writer ausente=%d %s", r.Code, r.Body)
	}
}
