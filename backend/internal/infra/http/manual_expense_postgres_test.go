package httpserver

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"math"
	"os"
	"testing"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/infra/db"
	"github.com/google/uuid"
)

// A integração usa exclusivamente TEST_DATABASE_URL descartável e dados sintéticos.
func TestManualExpensePostgresHTTPToTransactionsSummaryAndReconnect(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL não definida")
	}
	ctx := context.Background()
	pg, err := db.NewPostgres(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pg.Close)
	account := uuid.New()
	if _, err := pg.Pool.Exec(ctx, `INSERT INTO accounts(id,external_id,item_id,type,name,balance) VALUES($1,$2,'manual-test','BANK','Conta sintética',345.67)`, account, "manual-test:"+account.String()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := pg.Pool.Exec(ctx, `DELETE FROM manual_expense_requests WHERE payment_id IN(SELECT id FROM payments WHERE account_id=$1)`, account); err != nil {
			t.Error(err)
		}
		if _, err := pg.Pool.Exec(ctx, `WITH deleted AS(DELETE FROM payments WHERE account_id=$1 RETURNING purchase_id) DELETE FROM purchases WHERE id IN(SELECT purchase_id FROM deleted)`, account); err != nil {
			t.Error(err)
		}
		if _, err := pg.Pool.Exec(ctx, `DELETE FROM accounts WHERE id=$1`, account); err != nil {
			t.Error(err)
		}
	})
	mount := func(database *db.DB) *Server {
		s := NewServer(0, slog.New(slog.NewTextHandler(io.Discard, nil)))
		if err := s.MountAPI(StaticPassword(testPassword), db.NewDashboardReader(database)); err != nil {
			t.Fatal(err)
		}
		return s
	}
	s := mount(pg)
	cookie := login(t, s)
	headers := map[string]string{"Content-Type": "application/json"}
	summary := func(server *Server, month string) float64 {
		r := do(server, "GET", "/api/summary?month="+month, "", nil, cookie)
		if r.Code != 200 {
			t.Fatalf("resumo=%d %s", r.Code, r.Body)
		}
		var body struct {
			Current struct {
				Expense float64 `json:"expense"`
			} `json:"current"`
		}
		if err := json.Unmarshal(r.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		return body.Current.Expense
	}
	baselines := map[string]float64{"2005-03": summary(s, "2005-03"), "2005-04": summary(s, "2005-04")}
	var saved []domain.ManualExpenseResult
	var submitted []domain.ManualExpense
	for i, date := range []string{"2005-03-31", "2005-04-01"} {
		body := manualBody()
		body.AccountID = account
		body.Date = date
		body.AmountCents = []int64{1, 123456}[i]
		body.Description = "Compra sintética março/abril"
		body.Category = domain.CategoryMarket
		rec := do(s, "POST", "/api/transactions/manual", manualJSON(t, body), headers, cookie)
		if rec.Code != 201 {
			t.Fatalf("POST=%d %s", rec.Code, rec.Body)
		}
		var receipt domain.ManualExpenseResult
		if err := json.Unmarshal(rec.Body.Bytes(), &receipt); err != nil {
			t.Fatal(err)
		}
		saved = append(saved, receipt)
		submitted = append(submitted, body)
		if receipt.Date != date || receipt.AmountCents != body.AmountCents || receipt.RequestID != body.RequestID || receipt.Replayed {
			t.Fatalf("recibo=%+v", receipt)
		}
	}
	reopened, err := db.NewPostgres(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	s = mount(reopened)
	cookie = login(t, s)
	for i, in := range submitted {
		rec := do(s, "POST", "/api/transactions/manual", manualJSON(t, in), headers, cookie)
		var replay domain.ManualExpenseResult
		if err := json.Unmarshal(rec.Body.Bytes(), &replay); err != nil {
			t.Fatal(err)
		}
		expected := saved[i]
		expected.Replayed = true
		if rec.Code != 200 || replay != expected {
			t.Fatalf("replay após restart=%d %+v", rec.Code, replay)
		}
		month := in.Date[:7]
		rec = do(s, "GET", "/api/transactions?month="+month+"&account="+account.String(), "", nil, cookie)
		if rec.Code != 200 {
			t.Fatalf("GET=%d %s", rec.Code, rec.Body)
		}
		var list struct {
			Items []struct {
				ID            uuid.UUID `json:"id"`
				Date          string    `json:"date"`
				Description   string    `json:"description"`
				Amount        float64   `json:"amount"`
				Category      string    `json:"category"`
				PaymentMethod string    `json:"paymentMethod"`
				AccountID     uuid.UUID `json:"accountId"`
				Status        string    `json:"status"`
				Kind          string    `json:"kind"`
				Type          string    `json:"type"`
			} `json:"items"`
			Total int `json:"total"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
			t.Fatal(err)
		}
		if list.Total != 1 || len(list.Items) != 1 {
			t.Fatalf("lista=%s", rec.Body)
		}
		row := list.Items[0]
		if row.ID != saved[i].ID || row.AccountID != account || row.Date != in.Date || row.Description != in.Description || math.Round(row.Amount*100) != float64(in.AmountCents) || row.Category != "MARKET" || row.PaymentMethod != "PIX" || row.Status != "PAID" || row.Kind != "EXPENSE" || row.Type != "SINGLE" {
			t.Fatalf("GET incoerente=%+v", row)
		}
		if delta := summary(s, month) - baselines[month]; math.Abs(delta-float64(in.AmountCents)/100) > 0.00001 {
			t.Fatalf("resumo mês=%s delta=%f", month, delta)
		}
	}
	var count int
	var balance float64
	if err := reopened.Pool.QueryRow(ctx, `SELECT count(*) FROM payments WHERE account_id=$1`, account).Scan(&count); err != nil || count != 2 {
		t.Fatalf("reconexão duplicou: %d %v", count, err)
	}
	if err := reopened.Pool.QueryRow(ctx, `SELECT balance FROM accounts WHERE id=$1`, account).Scan(&balance); err != nil || balance != 345.67 {
		t.Fatalf("saldo=%f %v", balance, err)
	}
}
