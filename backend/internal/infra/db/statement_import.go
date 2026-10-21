package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"slices"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type statementQuerier interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

func readStatement(ctx context.Context, q statementQuerier, id string, lock bool) (domain.StatementBatch, error) {
	var b domain.StatementBatch
	var data []byte
	query := `SELECT id::text,account_id::text,filename,file_hash,status,created_at::text,payload FROM statement_import_batches WHERE id=$1`
	if lock {
		query += ` FOR UPDATE`
	}
	err := q.QueryRow(ctx, query, id).Scan(&b.ID, &b.AccountID, &b.Filename, &b.Hash, &b.Status, &b.CreatedAt, &data)
	if errors.Is(err, pgx.ErrNoRows) {
		return b, domain.ErrStatementNotFound
	}
	if err != nil {
		return b, err
	}
	if err = json.Unmarshal(data, &b.Rows); err != nil {
		return b, err
	}
	return b, nil
}
func statementCandidates(ctx context.Context, q statementQuerier, account string, row *domain.StatementRow) error {
	row.Candidates = []domain.StatementCandidate{}
	row.Duplicate = false
	if row.Error != "" {
		return nil
	}
	if err := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM statement_import_rows WHERE account_id=$1 AND fingerprint=$2 AND active)`, account, row.Fingerprint).Scan(&row.Duplicate); err != nil {
		return err
	}
	kind := "EXPENSE"
	if row.Cents > 0 {
		kind = "INCOME"
	}
	rows, err := q.Query(ctx, `SELECT pay.id::text,COALESCE(pay.due_date,pay.created_at::date)::text,COALESCE(p.description,''),pay.external_id IS NOT NULL FROM payments pay JOIN purchases p ON p.id=pay.purchase_id WHERE pay.account_id=$1 AND pay.status<>'CANCELLED' AND p.kind=$2 AND ABS(pay.amount-$3)<0.005 AND ABS(COALESCE(pay.due_date,pay.created_at::date)-$4::date)<=3 ORDER BY pay.id LIMIT 20`, account, kind, math.Abs(float64(row.Cents))/100, row.Date)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var c domain.StatementCandidate
		if err := rows.Scan(&c.ID, &c.Date, &c.Description, &c.External); err != nil {
			return err
		}
		row.Candidates = append(row.Candidates, c)
	}
	return rows.Err()
}
func (r *TransactionsRepo) PreviewStatement(ctx context.Context, b domain.StatementBatch) (domain.StatementBatch, error) {
	data, err := json.Marshal(b.Rows)
	if err != nil {
		return b, err
	}
	var exists bool
	if err = r.db.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM accounts WHERE id=$1 AND type='BANK')`, b.AccountID).Scan(&exists); err != nil {
		return b, err
	}
	if !exists {
		return b, domain.ErrStatementInvalid
	}
	var id string
	err = r.db.Pool.QueryRow(ctx, `INSERT INTO statement_import_batches(account_id,filename,file_hash,payload) VALUES($1,$2,$3,$4) ON CONFLICT(account_id,file_hash) DO UPDATE SET payload=CASE WHEN statement_import_batches.status='PREVIEW' THEN EXCLUDED.payload ELSE statement_import_batches.payload END RETURNING id::text`, b.AccountID, b.Filename, b.Hash, data).Scan(&id)
	if err != nil {
		return b, err
	}
	return r.StatementBatch(ctx, id)
}
func (r *TransactionsRepo) StatementBatch(ctx context.Context, id string) (domain.StatementBatch, error) {
	b, err := readStatement(ctx, r.db.Pool, id, false)
	if err != nil {
		return b, err
	}
	if b.Status == "PREVIEW" {
		for i := range b.Rows {
			if err := statementCandidates(ctx, r.db.Pool, b.AccountID, &b.Rows[i]); err != nil {
				return b, err
			}
		}
	}
	for _, row := range b.Rows {
		if row.Action == "created" {
			b.Created++
		}
		if row.Action == "preserved" || row.Action == "matched" {
			b.Preserved++
		}
	}
	return b, nil
}
func (r *TransactionsRepo) StatementBatches(ctx context.Context) ([]domain.StatementBatch, error) {
	rows, err := r.db.Pool.Query(ctx, `SELECT id::text,account_id::text,filename,file_hash,status,created_at::text FROM statement_import_batches ORDER BY created_at DESC LIMIT 30`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.StatementBatch{}
	for rows.Next() {
		var b domain.StatementBatch
		b.Rows = []domain.StatementRow{}
		if err := rows.Scan(&b.ID, &b.AccountID, &b.Filename, &b.Hash, &b.Status, &b.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}
func (r *TransactionsRepo) ConfirmStatement(ctx context.Context, id string, decisions []domain.StatementDecision) (domain.StatementBatch, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return domain.StatementBatch{}, err
	}
	defer tx.Rollback(ctx)
	b, err := readStatement(ctx, tx, id, true)
	if err != nil {
		return b, err
	}
	if b.Status == "CONFIRMED" {
		for _, row := range b.Rows {
			if row.Action == "created" {
				b.Created++
			}
			if row.Action == "matched" {
				b.Preserved++
			}
		}
		return b, nil
	}
	if b.Status != "PREVIEW" {
		return b, domain.ErrStatementConflict
	}
	if _, err = tx.Exec(ctx, `SELECT id FROM accounts WHERE id=$1 FOR UPDATE`, b.AccountID); err != nil {
		return b, err
	}
	choices := map[int]domain.StatementDecision{}
	for _, d := range decisions {
		if _, ok := choices[d.Row]; ok {
			return b, domain.ErrStatementInvalid
		}
		if d.Action != "create" && d.Action != "skip" && d.Action != "match" {
			return b, domain.ErrStatementInvalid
		}
		choices[d.Row] = d
	}
	known := map[int]bool{}
	for _, row := range b.Rows {
		known[row.Number] = true
	}
	for n := range choices {
		if !known[n] {
			return b, domain.ErrStatementInvalid
		}
	}
	used := map[string]bool{}
	for i := range b.Rows {
		row := &b.Rows[i]
		d, ok := choices[row.Number]
		if !ok {
			return b, fmt.Errorf("%w: revise todas as linhas", domain.ErrStatementInvalid)
		}
		if row.Error != "" && d.Action != "skip" {
			return b, domain.ErrStatementInvalid
		}
		if d.Action == "skip" {
			row.Action = "skipped"
			continue
		}
		if err = statementCandidates(ctx, tx, b.AccountID, row); err != nil {
			return b, err
		}
		if row.Duplicate {
			row.Action = "duplicate"
			continue
		}
		created := d.Action == "create"
		paymentID := d.PaymentID
		if created {
			// Uma correspondência nova após a prévia deve ser revisada antes da gravação.
			current := []string{}
			for _, c := range row.Candidates {
				current = append(current, c.ID)
			}
			slices.Sort(current)
			slices.Sort(d.CandidateIDs)
			if !slices.Equal(current, d.CandidateIDs) {
				return b, domain.ErrStatementConflict
			}
			amount := math.Abs(float64(row.Cents)) / 100
			purchase, newErr := domain.NewPurchase(amount, &row.Description, domain.CategoryOther, domain.PaymentMethodOther, domain.PurchaseTypeSingle, "importação de extrato")
			if newErr != nil {
				return b, newErr
			}
			if row.Cents > 0 {
				purchase.Kind = domain.KindIncome
			}
			if err = insertPurchase(ctx, tx, purchase); err != nil {
				return b, err
			}
			paymentID = uuid.NewString()
			day, _ := time.Parse("2006-01-02", row.Date)
			if _, err = tx.Exec(ctx, `INSERT INTO payments(id,purchase_id,amount,status,due_date,paid_at,account_id) VALUES($1,$2,$3,'PAID',$4::date,$4::date::timestamptz,$5)`, paymentID, purchase.ID, amount, day, b.AccountID); err != nil {
				return b, err
			}
			if _, err = tx.Exec(ctx, `UPDATE purchases p SET category=r.category FROM category_rules r WHERE p.id=$1 AND p.kind='EXPENSE' AND r.key=`+expenseKey, purchase.ID); err != nil {
				return b, err
			}
			if err = applyExactPaymentCategory(ctx, tx, purchase.ID, uuid.MustParse(paymentID)); err != nil {
				return b, err
			}
			row.Action = "created"
			b.Created++
		} else {
			found := false
			for _, c := range row.Candidates {
				if c.ID == paymentID {
					found = true
				}
			}
			if !found || used[paymentID] {
				return b, domain.ErrStatementConflict
			}
			// Trava também o pagamento: reversão e sincronização respeitam a mesma identidade.
			var locked string
			if err = tx.QueryRow(ctx, `SELECT id::text FROM payments WHERE id=$1 AND status<>'CANCELLED' FOR UPDATE`, paymentID).Scan(&locked); err != nil {
				return b, domain.ErrStatementConflict
			}
			row.Action = "matched"
			b.Preserved++
		}
		used[paymentID] = true
		row.PaymentID = paymentID
		if _, err = tx.Exec(ctx, `INSERT INTO statement_import_rows(batch_id,row_number,account_id,fingerprint,payment_id,created) VALUES($1,$2,$3,$4,$5,$6)`, b.ID, row.Number, b.AccountID, row.Fingerprint, paymentID, created); err != nil {
			return b, err
		}
	}
	b.Status = "CONFIRMED"
	data, _ := json.Marshal(b.Rows)
	if _, err = tx.Exec(ctx, `UPDATE statement_import_batches SET status=$2,payload=$3 WHERE id=$1`, id, b.Status, data); err != nil {
		return b, err
	}
	if err = tx.Commit(ctx); err != nil {
		return b, err
	}
	return b, nil
}
func (r *TransactionsRepo) RevertStatement(ctx context.Context, id string) (domain.StatementBatch, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return domain.StatementBatch{}, err
	}
	defer tx.Rollback(ctx)
	b, err := readStatement(ctx, tx, id, true)
	if err != nil {
		return b, err
	}
	if b.Status == "REVERTED" {
		return b, nil
	}
	if b.Status != "CONFIRMED" {
		return b, domain.ErrStatementConflict
	}
	if _, err = tx.Exec(ctx, `SELECT id FROM accounts WHERE id=$1 FOR UPDATE`, b.AccountID); err != nil {
		return b, err
	}
	for i := range b.Rows {
		row := &b.Rows[i]
		if row.Action != "created" {
			continue
		}
		var purchaseID string
		var external *string
		err = tx.QueryRow(ctx, `SELECT purchase_id::text,external_id FROM payments WHERE id=$1 FOR UPDATE`, row.PaymentID).Scan(&purchaseID, &external)
		if errors.Is(err, pgx.ErrNoRows) {
			row.Action = "removed"
			continue
		}
		if err != nil {
			return b, err
		}
		if external != nil {
			row.Action = "preserved"
			b.Preserved++
			continue
		}
		if _, err = tx.Exec(ctx, `DELETE FROM payments WHERE id=$1 AND external_id IS NULL`, row.PaymentID); err != nil {
			return b, err
		}
		if _, err = tx.Exec(ctx, `DELETE FROM purchases WHERE id=$1 AND NOT EXISTS(SELECT 1 FROM payments WHERE purchase_id=$1)`, purchaseID); err != nil {
			return b, err
		}
		row.Action = "removed"
	}
	if _, err = tx.Exec(ctx, `UPDATE statement_import_rows SET active=FALSE WHERE batch_id=$1 AND (NOT created OR payment_id IS NULL)`, id); err != nil {
		return b, err
	}
	b.Status = "REVERTED"
	data, _ := json.Marshal(b.Rows)
	if _, err = tx.Exec(ctx, `UPDATE statement_import_batches SET status=$2,payload=$3 WHERE id=$1`, id, b.Status, data); err != nil {
		return b, err
	}
	if err = tx.Commit(ctx); err != nil {
		return b, err
	}
	return b, nil
}

func (r *TransactionsRepo) CreateStatementAccount(ctx context.Context, name string, balance float64) (string, error) {
	id := uuid.NewString()
	_, err := r.db.Pool.Exec(ctx, `INSERT INTO accounts(id,external_id,item_id,type,name,balance) VALUES($1,$2,'statement-import','BANK',$3,$4)`, id, "statement-import:"+id, name, balance)
	return id, err
}

// A sincronização revalida depois da trava usada pela confirmação: um lote pode
// ter sido confirmado entre ReconcileExternal e SaveExternal.
func claimStatementExternal(ctx context.Context, tx pgx.Tx, purchase *domain.Purchase, payment *domain.Payment) (bool, error) {
	if payment.AccountID == nil || payment.ExternalID == nil {
		return false, nil
	}
	if _, err := tx.Exec(ctx, `SELECT id FROM accounts WHERE id=$1 FOR UPDATE`, *payment.AccountID); err != nil {
		return false, err
	}
	day := payment.CreatedAt
	if payment.DueDate != nil {
		day = *payment.DueDate
	}
	var id string
	err := tx.QueryRow(ctx, `SELECT pay.id::text FROM payments pay JOIN purchases p ON p.id=pay.purchase_id WHERE pay.account_id=$1 AND pay.external_id IS NULL AND pay.status<>'CANCELLED' AND p.kind=$2 AND p.type='SINGLE' AND ABS(pay.amount-$3)<0.005 AND ABS(COALESCE(pay.due_date,pay.created_at::date)-$4::date)<=3 AND EXISTS(SELECT 1 FROM statement_import_rows r WHERE r.payment_id=pay.id AND r.created AND r.active) ORDER BY pay.created_at,pay.id LIMIT 1 FOR UPDATE OF pay`, *payment.AccountID, purchase.Kind, payment.Amount, day).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	_, err = tx.Exec(ctx, `UPDATE payments SET external_id=$2,status=$3,paid_at=$4 WHERE id=$1`, id, *payment.ExternalID, payment.Status, payment.PaidAt)
	return err == nil, err
}
