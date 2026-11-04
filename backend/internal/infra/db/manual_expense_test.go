package db

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain/ports"
	"github.com/google/uuid"
)

func quickAccount(t *testing.T, r *testRepo, pg *DB) uuid.UUID {
	t.Helper()
	id := statementAccount(t, r, pg)
	t.Cleanup(func() {
		if _, err := pg.Pool.Exec(context.Background(), `DELETE FROM manual_expense_requests WHERE payment_id IN (SELECT id FROM payments WHERE account_id=$1)`, id); err != nil {
			t.Error(err)
		}
	})
	return id
}
func quickInput(account uuid.UUID) domain.ManualExpense {
	return domain.ManualExpense{RequestID: uuid.New(), AccountID: account, AmountCents: 123456, Description: "zzmanual " + uuid.NewString(), Date: "2003-10-31", Category: domain.CategoryOther, PaymentMethod: domain.PaymentMethodPix}
}
func quickCount(t *testing.T, pg *DB, account uuid.UUID) int {
	t.Helper()
	var n int
	if err := pg.Pool.QueryRow(context.Background(), `SELECT count(*) FROM payments WHERE account_id=$1`, account).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}
func TestManualExpensePersistenceCentsCategoryHistoricalDateAndReopen(t *testing.T) {
	r, pg := newTestRepo(t)
	ctx := context.Background()
	account := quickAccount(t, r, pg)
	if _, err := pg.Pool.Exec(ctx, `UPDATE accounts SET balance=234.56 WHERE id=$1`, account); err != nil {
		t.Fatal(err)
	}
	in := quickInput(account)
	key := "exact:" + in.Description
	if _, err := pg.Pool.Exec(ctx, `INSERT INTO category_rules(key,category) VALUES($1,'FOOD')`, key); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pg.Pool.Exec(ctx, `DELETE FROM category_rules WHERE key=$1`, key) })
	saved, err := r.SaveManualExpense(ctx, in)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Replayed || saved.ID == uuid.Nil || saved.PurchaseID == uuid.Nil || saved.RequestID != in.RequestID || saved.Date != in.Date || saved.AmountCents != in.AmountCents {
		t.Fatalf("recibo=%+v", saved)
	}
	reopened, _ := newTestRepo(t)
	retry := in
	retry.Description = "  " + in.Description + " \n"
	replay, err := reopened.SaveManualExpense(ctx, retry)
	expected := saved
	expected.Replayed = true
	if err != nil || replay != expected {
		t.Fatalf("reconexão=%+v erro=%v", replay, err)
	}
	month := time.Date(2003, 10, 1, 0, 0, 0, 0, time.UTC)
	rows, n, err := reopened.Transactions(ctx, domain.TransactionFilter{Month: &month, AccountID: &account, Limit: 20})
	if err != nil || n != 1 || len(rows) != 1 {
		t.Fatalf("lista=%+v n=%d %v", rows, n, err)
	}
	row := rows[0]
	if row.ID != saved.ID || row.AccountID == nil || *row.AccountID != account || row.Amount != 1234.56 || row.Date.Format(time.DateOnly) != in.Date || row.Category != "OTHER" || row.PaymentMethod != "PIX" || row.Kind != "EXPENSE" || row.Type != "SINGLE" || row.Status != "PAID" || row.Description != in.Description {
		t.Fatalf("persistido=%+v", row)
	}
	var financial, created string
	var balance float64
	if err := pg.Pool.QueryRow(ctx, `SELECT due_date::text,created_at::date::text FROM payments WHERE id=$1`, saved.ID).Scan(&financial, &created); err != nil || financial != in.Date || created == in.Date {
		t.Fatalf("data=%s auditoria=%s %v", financial, created, err)
	}
	if err := pg.Pool.QueryRow(ctx, `SELECT balance FROM accounts WHERE id=$1`, account).Scan(&balance); err != nil || balance != 234.56 {
		t.Fatalf("saldo alterado=%f %v", balance, err)
	}
	for _, cents := range []int64{1, 999999999999} {
		next := in
		next.RequestID = uuid.New()
		next.AmountCents = cents
		receipt, err := r.SaveManualExpense(ctx, next)
		if err != nil {
			t.Fatal(err)
		}
		var actual int64
		if err := pg.Pool.QueryRow(ctx, `SELECT (amount*100)::bigint FROM payments WHERE id=$1`, receipt.ID).Scan(&actual); err != nil || actual != cents {
			t.Fatalf("centavos=%d esperado=%d %v", actual, cents, err)
		}
	}
	for _, edit := range []func(*domain.ManualExpense){func(x *domain.ManualExpense) { x.Description += " alterado" }, func(x *domain.ManualExpense) { x.AmountCents++ }, func(x *domain.ManualExpense) { x.Date = "2003-11-01" }, func(x *domain.ManualExpense) { x.Category = domain.CategoryFood }, func(x *domain.ManualExpense) { x.PaymentMethod = domain.PaymentMethodCash }, func(x *domain.ManualExpense) { x.AccountID = uuid.New() }} {
		changed := in
		edit(&changed)
		if _, err := r.SaveManualExpense(ctx, changed); !errors.Is(err, domain.ErrManualExpenseConflict) {
			t.Fatalf("conflito=%v", err)
		}
	}
}
func TestManualExpenseConcurrentIdempotencyAndAccountValidation(t *testing.T) {
	r, pg := newTestRepo(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	account := quickAccount(t, r, pg)
	in := quickInput(account)
	type outcome struct {
		result domain.ManualExpenseResult
		err    error
	}
	results := make(chan outcome, 8)
	start := make(chan struct{})
	for i := 0; i < 8; i++ {
		go func() { <-start; res, err := r.SaveManualExpense(ctx, in); results <- outcome{res, err} }()
	}
	close(start)
	fresh := 0
	var first uuid.UUID
	for i := 0; i < 8; i++ {
		out := <-results
		if out.err != nil {
			t.Fatal(out.err)
		}
		if first == uuid.Nil {
			first = out.result.ID
		}
		if out.result.ID != first {
			t.Fatal("IDs divergentes")
		}
		if !out.result.Replayed {
			fresh++
		}
	}
	if fresh != 1 || quickCount(t, pg, account) != 1 {
		t.Fatalf("novos=%d", fresh)
	}
	// Duas versões concorrentes da mesma chave não podem criar dois lançamentos.
	left := quickInput(account)
	right := left
	right.Description += " divergente"
	conflicts := make(chan outcome, 2)
	gate := make(chan struct{})
	for _, input := range []domain.ManualExpense{left, right} {
		go func() {
			<-gate
			res, err := r.SaveManualExpense(ctx, input)
			conflicts <- outcome{res, err}
		}()
	}
	close(gate)
	accepted, rejected := 0, 0
	for i := 0; i < 2; i++ {
		out := <-conflicts
		switch {
		case out.err == nil && !out.result.Replayed:
			accepted++
		case errors.Is(out.err, domain.ErrManualExpenseConflict):
			rejected++
		default:
			t.Fatalf("resultado concorrente inesperado: %+v %v", out.result, out.err)
		}
	}
	if accepted != 1 || rejected != 1 || quickCount(t, pg, account) != 2 {
		t.Fatalf("conflitos concorrentes: aceitos=%d recusados=%d", accepted, rejected)
	}
	for _, invalid := range []uuid.UUID{uuid.New(), quickAccount(t, r, pg)} {
		if invalid != account {
			if _, err := pg.Pool.Exec(ctx, `UPDATE accounts SET type='CREDIT' WHERE id=$1`, invalid); err != nil {
				t.Fatal(err)
			}
		}
		bad := quickInput(invalid)
		if _, err := r.SaveManualExpense(ctx, bad); !errors.Is(err, domain.ErrManualExpenseAccount) {
			t.Fatalf("conta inelegível=%v", err)
		}
	}
}
func TestManualExpenseRollbackDoesNotConsumeRequest(t *testing.T) {
	r, pg := newTestRepo(t)
	ctx := context.Background()
	account := quickAccount(t, r, pg)
	in := quickInput(account)
	name := "manual_fail_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err := pg.Pool.Exec(ctx, `CREATE FUNCTION `+name+`() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha sintética de recibo'; END $$`); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pg.Pool.Exec(ctx, `DROP FUNCTION IF EXISTS `+name+`() CASCADE`) })
	if _, err := pg.Pool.Exec(ctx, fmt.Sprintf(`CREATE TRIGGER %s BEFORE INSERT ON manual_expense_requests FOR EACH ROW WHEN (NEW.request_id='%s'::uuid) EXECUTE FUNCTION %s()`, name, in.RequestID, name)); err != nil {
		t.Fatal(err)
	}
	if _, err := r.SaveManualExpense(ctx, in); err == nil {
		t.Fatal("esperava falha parcial")
	}
	var purchases, receipts int
	if err := pg.Pool.QueryRow(ctx, `SELECT count(*) FROM purchases WHERE description=$1`, in.Description).Scan(&purchases); err != nil {
		t.Fatal(err)
	}
	if err := pg.Pool.QueryRow(ctx, `SELECT count(*) FROM manual_expense_requests WHERE request_id=$1`, in.RequestID).Scan(&receipts); err != nil {
		t.Fatal(err)
	}
	if purchases != 0 || receipts != 0 || quickCount(t, pg, account) != 0 {
		t.Fatalf("sobrou compra=%d recibo=%d", purchases, receipts)
	}
	if _, err := pg.Pool.Exec(ctx, `DROP FUNCTION `+name+`() CASCADE`); err != nil {
		t.Fatal(err)
	}
	if res, err := r.SaveManualExpense(ctx, in); err != nil || res.Replayed {
		t.Fatalf("retry após rollback=%+v %v", res, err)
	}
}
func quickExternal(in domain.ManualExpense) (*domain.Purchase, *domain.Payment) {
	amount := float64(in.AmountCents) / 100
	desc := "descrição bancária"
	purchase, _ := domain.NewPurchase(amount, &desc, domain.CategoryFood, domain.PaymentMethodOther, domain.PurchaseTypeSingle, "sintético")
	pay := domain.NewPayment(purchase.ID, amount, domain.PaymentStatusPaid)
	day, _ := time.Parse(time.DateOnly, in.Date)
	external := uuid.NewString()
	pay.DueDate = &day
	pay.AccountID = &in.AccountID
	pay.ExternalID = &external
	return purchase, pay
}
func TestManualExpenseExternalSaveConcurrentRechecksAndRetainsAccount(t *testing.T) {
	r, pg := newTestRepo(t)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	account := quickAccount(t, r, pg)
	other := quickAccount(t, r, pg)
	in := quickInput(account)
	purchase, pay := quickExternal(in)
	external := ports.ExternalTransaction{ID: *pay.ExternalID, Amount: pay.Amount, Kind: purchase.Kind, Category: domain.CategoryFood, Date: *pay.DueDate}
	if linked, err := r.ReconcileExternal(ctx, external, account); err != nil || linked {
		t.Fatalf("prévio=%v %v", linked, err)
	}
	// Segura a conta até o manual entrar na fila; SaveExternal começa enquanto ele aguarda.
	blocker, err := pg.Pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer blocker.Rollback(ctx)
	if _, err := blocker.Exec(ctx, `SELECT id FROM accounts WHERE id=$1 FOR UPDATE`, account); err != nil {
		t.Fatal(err)
	}
	manualDone := make(chan error, 1)
	go func() { _, err := r.SaveManualExpense(ctx, in); manualDone <- err }()
	waitForAccountLock := func(query string) {
		t.Helper()
		for {
			var waiting bool
			if err := pg.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND query=$1 AND wait_event_type='Lock')`, query).Scan(&waiting); err != nil {
				t.Fatal(err)
			}
			if waiting {
				return
			}
			select {
			case <-ctx.Done():
				t.Fatal("gravação não aguardou trava de conta")
			default:
				time.Sleep(10 * time.Millisecond)
			}
		}
	}
	waitForAccountLock("SELECT type FROM accounts WHERE id=$1 FOR UPDATE")
	externalDone := make(chan error, 1)
	go func() { externalDone <- r.SaveExternal(ctx, purchase, pay) }()
	waitForAccountLock("SELECT id FROM accounts WHERE id=$1 FOR UPDATE")
	if err := blocker.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if err := <-manualDone; err != nil {
		t.Fatal(err)
	}
	if err := <-externalDone; err != nil {
		t.Fatal(err)
	}
	if n := quickCount(t, pg, account); n != 1 {
		t.Fatalf("duplicou após concorrência=%d", n)
	}
	if err := r.SaveExternal(ctx, purchase, pay); err != nil {
		t.Fatal(err)
	}
	for _, acc := range []uuid.UUID{account, other} {
		if exists, err := r.RefreshExternal(ctx, external, acc); err != nil || !exists {
			t.Fatalf("refresh=%v %v", exists, err)
		}
	}
	var actualAccount uuid.UUID
	var category, date string
	if err := pg.Pool.QueryRow(ctx, `SELECT pay.account_id,effective_payment_category(pay.id,p.category),due_date::text FROM payments pay JOIN purchases p ON p.id=pay.purchase_id WHERE external_id=$1`, *pay.ExternalID).Scan(&actualAccount, &category, &date); err != nil || actualAccount != account || category != "OTHER" || date != in.Date {
		t.Fatalf("conciliação conta=%s categoria=%s dia=%s %v", actualAccount, category, date, err)
	}
	if quickCount(t, pg, account) != 1 || quickCount(t, pg, other) != 0 {
		t.Fatal("refresh duplicou/moveu conta")
	}
}
func TestManualExpenseExternalFirstKeepsIntentionalNewExpense(t *testing.T) {
	r, pg := newTestRepo(t)
	ctx := context.Background()
	account := quickAccount(t, r, pg)
	in := quickInput(account)
	purchase, pay := quickExternal(in)
	if err := r.SaveExternal(ctx, purchase, pay); err != nil {
		t.Fatal(err)
	}
	saved, err := r.SaveManualExpense(ctx, in)
	if err != nil {
		t.Fatal(err)
	}
	if saved.ID == pay.ID || quickCount(t, pg, account) != 2 {
		t.Fatal("manual fundiu fatos financeiros por inferência")
	}
	var description, category string
	if err := pg.Pool.QueryRow(ctx, `SELECT description,category FROM purchases WHERE id=$1`, purchase.ID).Scan(&description, &category); err != nil || description != *purchase.Description || category != "FOOD" {
		t.Fatalf("externo alterado: %s %s %v", description, category, err)
	}
}
