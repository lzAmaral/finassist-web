package db

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain/ports"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/usecase/statementimport"
	"github.com/google/uuid"
)

func statementAccount(t *testing.T, r *testRepo, pg *DB) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	id, err := r.UpsertAccount(ctx, ports.ExternalAccount{ID: "statement-import-" + uuid.NewString(), ItemID: "statement-synthetic", Type: "BANK", Name: "Conta sintética"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, err := pg.Pool.Exec(ctx, `DELETE FROM statement_import_rows WHERE account_id=$1`, id)
		if err != nil {
			t.Error(err)
		}
		_, err = pg.Pool.Exec(ctx, `DELETE FROM statement_import_batches WHERE account_id=$1`, id)
		if err != nil {
			t.Error(err)
		}
		_, err = pg.Pool.Exec(ctx, `WITH gone AS (DELETE FROM payments WHERE account_id=$1 RETURNING purchase_id) DELETE FROM purchases WHERE id IN (SELECT purchase_id FROM gone)`, id)
		if err != nil {
			t.Error(err)
		}
		_, err = pg.Pool.Exec(ctx, `DELETE FROM accounts WHERE id=$1`, id)
		if err != nil {
			t.Error(err)
		}
	})
	return id
}
func statementPreview(t *testing.T, r *testRepo, account uuid.UUID, content string) domain.StatementBatch {
	t.Helper()
	b, err := statementimport.Parse(account.String(), "sintetico.csv", content, "csv", domain.StatementMapping{Date: 0, Description: 1, Amount: 2, Currency: -1, Header: true, Decimal: ",", DateFormat: "DMY"})
	if err != nil {
		t.Fatal(err)
	}
	b, err = r.PreviewStatement(context.Background(), b)
	if err != nil {
		t.Fatal(err)
	}
	return b
}
func statementChoices(b domain.StatementBatch) []domain.StatementDecision {
	out := []domain.StatementDecision{}
	for _, row := range b.Rows {
		action := "create"
		if row.Error != "" {
			action = "skip"
		}
		out = append(out, domain.StatementDecision{Row: row.Number, Action: action})
	}
	return out
}
func TestStatementImportPersistenceIdempotencePartialAndFutureSync(t *testing.T) {
	r, pg := newTestRepo(t)
	ctx := context.Background()
	account := statementAccount(t, r, pg)
	content := "Data;Descrição;Valor\n21/10/1996;Mercado sintético;-12,34\n22/10/1996;Salário sintético;100,00\n31/02/1996;Inválido;-1,00"
	b := statementPreview(t, r, account, content)
	var count int
	if err := pg.Pool.QueryRow(ctx, `SELECT count(*) FROM payments WHERE account_id=$1`, account).Scan(&count); err != nil || count != 0 {
		t.Fatalf("prévia gravou ledger: %d %v", count, err)
	}
	confirmed, err := r.ConfirmStatement(ctx, b.ID, statementChoices(b))
	if err != nil {
		t.Fatal(err)
	}
	if confirmed.Created != 2 {
		t.Fatalf("criados=%d", confirmed.Created)
	}
	repeated := statementPreview(t, r, account, content)
	if repeated.ID != b.ID || repeated.Status != "CONFIRMED" {
		t.Fatalf("arquivo repetido: %+v", repeated)
	}
	partial := statementPreview(t, r, account, "Data;Descrição;Valor\n21/10/1996;Mercado sintético;-12,34\n23/10/1996;Novo sintético;-3,00")
	if !partial.Rows[0].Duplicate {
		t.Fatal("duplicado parcial não reconhecido")
	}
	next, err := r.ConfirmStatement(ctx, partial.ID, statementChoices(partial))
	if err != nil {
		t.Fatal(err)
	}
	if next.Created != 1 || next.Rows[0].Action != "duplicate" {
		t.Fatalf("parcial=%+v", next)
	}
	// Open Finance transforma o mesmo pagamento em canônico; reversão deve mantê-lo.
	day := time.Date(1996, 10, 21, 0, 0, 0, 0, time.UTC)
	external := ports.ExternalTransaction{ID: "statement-external-" + uuid.NewString(), Kind: domain.KindExpense, Amount: 12.34, Date: day}
	linked, err := r.ReconcileExternal(ctx, external, account)
	if err != nil || !linked {
		t.Fatalf("conciliação futura=%v %v", linked, err)
	}
	reverted, err := r.RevertStatement(ctx, b.ID)
	if err != nil {
		t.Fatal(err)
	}
	if reverted.Preserved != 1 {
		t.Fatalf("preservados=%d", reverted.Preserved)
	}
	var canonical int
	if err := pg.Pool.QueryRow(ctx, `SELECT count(*) FROM payments WHERE external_id=$1`, external.ID).Scan(&canonical); err != nil || canonical != 1 {
		t.Fatalf("canônico apagado %d %v", canonical, err)
	}
	if _, err = r.RevertStatement(ctx, b.ID); err != nil {
		t.Fatal("reversão repetida", err)
	}
	if err := pg.Pool.QueryRow(ctx, `SELECT count(*) FROM payments WHERE account_id=$1`, account).Scan(&count); err != nil || count != 2 {
		t.Fatalf("esperava canônico e parcial novo: %d %v", count, err)
	}
}
func TestStatementImportCandidatesAtomicityAndExistingPreserved(t *testing.T) {
	r, pg := newTestRepo(t)
	ctx := context.Background()
	account := statementAccount(t, r, pg)
	other := statementAccount(t, r, pg)
	day := time.Date(1995, 10, 21, 0, 0, 0, 0, time.UTC)
	desc := "Compra banco sintética"
	p, _ := domain.NewPurchase(15, &desc, domain.CategoryFood, domain.PaymentMethodPix, domain.PurchaseTypeSingle, "synthetic")
	pay := domain.NewPayment(p.ID, 15, domain.PaymentStatusPaid)
	external := "statement-existing-" + uuid.NewString()
	pay.AccountID = &account
	pay.ExternalID = &external
	pay.DueDate = &day
	if err := r.SaveExternal(ctx, p, pay); err != nil {
		t.Fatal(err)
	}
	b := statementPreview(t, r, account, "Data;Descrição;Valor\n21/10/1995;Compra sintética;-15,00\n22/10/1995;Nova sintética;-8,00")
	if len(b.Rows[0].Candidates) != 1 || !b.Rows[0].Candidates[0].External {
		t.Fatalf("candidatos=%+v", b.Rows)
	}
	// A primeira linha criaria, a segunda decisão ausente: transação inteira reverte.
	_, err := r.ConfirmStatement(ctx, b.ID, []domain.StatementDecision{{Row: 2, Action: "create", CandidateIDs: []string{pay.ID.String()}}})
	if !errors.Is(err, domain.ErrStatementInvalid) {
		t.Fatalf("revisão incompleta: %v", err)
	}
	var count int
	_ = pg.Pool.QueryRow(ctx, `SELECT count(*) FROM payments WHERE account_id=$1`, account).Scan(&count)
	if count != 1 {
		t.Fatal("confirmação parcial persistiu")
	}
	choices := statementChoices(b)
	choices[0].Action = "match"
	choices[0].PaymentID = pay.ID.String()
	confirmed, err := r.ConfirmStatement(ctx, b.ID, choices)
	if err != nil {
		t.Fatal(err)
	}
	if confirmed.Created != 1 {
		t.Fatal("nova linha não persistida")
	}
	if _, err = r.RevertStatement(ctx, b.ID); err != nil {
		t.Fatal(err)
	}
	_ = pg.Pool.QueryRow(ctx, `SELECT count(*) FROM payments WHERE account_id=$1`, account).Scan(&count)
	if count != 1 {
		t.Fatal("preexistente removido")
	}
	// Importado em outra conta não pode ser consumido pelo sincronizador.
	otherBatch := statementPreview(t, r, other, "Data;Descrição;Valor\n21/10/1995;Outra conta;-33,00")
	if _, err = r.ConfirmStatement(ctx, otherBatch.ID, statementChoices(otherBatch)); err != nil {
		t.Fatal(err)
	}
	linked, err := r.ReconcileExternal(ctx, ports.ExternalTransaction{ID: uuid.NewString(), Amount: 33, Kind: domain.KindExpense, Date: day}, account)
	if err != nil || linked {
		t.Fatalf("conciliação cruzou contas: %v %v", linked, err)
	}
}
func TestStatementImportChangedCandidatesAndRules(t *testing.T) {
	r, pg := newTestRepo(t)
	ctx := context.Background()
	account := statementAccount(t, r, pg)
	description := "zzstatement " + uuid.NewString()
	key := "exact:" + description
	if _, err := pg.Pool.Exec(ctx, `INSERT INTO category_rules(key,category) VALUES($1,'FOOD')`, key); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pg.Pool.Exec(ctx, `DELETE FROM category_rules WHERE key=$1`, key) })
	content := fmt.Sprintf("Data;Descrição;Valor\n21/10/1994;%s;-42,00", description)
	b := statementPreview(t, r, account, content)
	confirmed, err := r.ConfirmStatement(ctx, b.ID, statementChoices(b))
	if err != nil {
		t.Fatal(err)
	}
	var category string
	err = pg.Pool.QueryRow(ctx, `SELECT effective_payment_category(pay.id,p.category) FROM payments pay JOIN purchases p ON p.id=pay.purchase_id WHERE pay.id=$1`, confirmed.Rows[0].PaymentID).Scan(&category)
	if err != nil || category != "FOOD" {
		t.Fatalf("regra FA05: %s %v", category, err)
	}
	pending := statementPreview(t, r, account, "Data;Descrição;Valor\n22/10/1994;Novo;-43,00")
	another := statementPreview(t, r, account, "Data;Descrição;Valor\n22/10/1994;Outro nome;-43,00")
	if _, err = r.ConfirmStatement(ctx, another.ID, statementChoices(another)); err != nil {
		t.Fatal(err)
	}
	if _, err = r.ConfirmStatement(ctx, pending.ID, statementChoices(pending)); !errors.Is(err, domain.ErrStatementConflict) {
		t.Fatalf("candidato novo deveria exigir revisão: %v", err)
	}
}

func TestStatementImportExternalSaveRechecksStaleReconciliation(t *testing.T) {
	r, pg := newTestRepo(t)
	ctx := context.Background()
	account := statementAccount(t, r, pg)
	day := time.Date(1993, 10, 21, 0, 0, 0, 0, time.UTC)
	external := ports.ExternalTransaction{ID: "statement-race-" + uuid.NewString(), Kind: domain.KindExpense, Amount: 66.55, Date: day}
	linked, err := r.ReconcileExternal(ctx, external, account)
	if err != nil || linked {
		t.Fatalf("base deveria estar vazia %v %v", linked, err)
	}
	ofx := `<OFX><CURDEF>BRL<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>19931021<TRNAMT>-66.55<FITID>statement-synthetic-ofx<MEMO>Compra sintética</STMTTRN></OFX>`
	b, err := statementimport.Parse(account.String(), "sintetico.ofx", ofx, "ofx", domain.StatementMapping{})
	if err != nil {
		t.Fatal(err)
	}
	b, err = r.PreviewStatement(ctx, b)
	if err != nil {
		t.Fatal(err)
	}
	confirmed, err := r.ConfirmStatement(ctx, b.ID, statementChoices(b))
	if err != nil {
		t.Fatal(err)
	}
	desc := "Compra externa sintética"
	p, _ := domain.NewPurchase(66.55, &desc, domain.CategoryOther, domain.PaymentMethodOther, domain.PurchaseTypeSingle, "synthetic")
	payment := domain.NewPayment(p.ID, 66.55, domain.PaymentStatusPaid)
	payment.AccountID = &account
	payment.ExternalID = &external.ID
	payment.DueDate = &day
	// Equivale ao sincronizador retomar após uma confirmação entre suas duas chamadas.
	if err := r.SaveExternal(ctx, p, payment); err != nil {
		t.Fatal(err)
	}
	var id string
	var count int
	if err := pg.Pool.QueryRow(ctx, `SELECT count(*),min(id::text) FROM payments WHERE account_id=$1`, account).Scan(&count, &id); err != nil || count != 1 || id != confirmed.Rows[0].PaymentID {
		t.Fatalf("identidade perdida: %d %s %v", count, id, err)
	}
	if _, err := r.RevertStatement(ctx, b.ID); err != nil {
		t.Fatal(err)
	}
	if err := pg.Pool.QueryRow(ctx, `SELECT count(*) FROM payments WHERE external_id=$1`, external.ID).Scan(&count); err != nil || count != 1 {
		t.Fatalf("canônico removido %d %v", count, err)
	}
}

func TestStatementImportConcurrentOverlappingBatches(t *testing.T) {
	r, pg := newTestRepo(t)
	ctx := context.Background()
	account := statementAccount(t, r, pg)
	content := "Data;Descrição;Valor\n21/10/1992;Mesmo sintético;-19,87"
	first := statementPreview(t, r, account, content)
	second := statementPreview(t, r, account, content+"\n")
	type result struct {
		batch domain.StatementBatch
		err   error
	}
	results := make(chan result, 2)
	start := make(chan struct{})
	for _, batch := range []domain.StatementBatch{first, second} {
		go func(b domain.StatementBatch) {
			<-start
			confirmed, err := r.ConfirmStatement(ctx, b.ID, statementChoices(b))
			results <- result{confirmed, err}
		}(batch)
	}
	close(start)
	created := 0
	for range 2 {
		got := <-results
		if got.err != nil {
			t.Fatal(got.err)
		}
		created += got.batch.Created
	}
	var count int
	if err := pg.Pool.QueryRow(ctx, `SELECT count(*) FROM payments WHERE account_id=$1`, account).Scan(&count); err != nil || count != 1 || created != 1 {
		t.Fatalf("confirmações simultâneas duplicaram: %d criados=%d %v", count, created, err)
	}
}
