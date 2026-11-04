package db

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/jackc/pgx/v5"
)

func (r *TransactionsRepo) SaveManualExpense(ctx context.Context, input domain.ManualExpense) (domain.ManualExpenseResult, error) {
	var result domain.ManualExpenseResult
	if err := input.Normalize(time.Now()); err != nil {
		return result, err
	}
	canonical, err := json.Marshal(input)
	if err != nil {
		return result, err
	}
	hash := sha256.Sum256(canonical)
	fingerprint := hex.EncodeToString(hash[:])
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	// A chave é global na instalação. A trava também cobre envios concorrentes para contas distintas.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, input.RequestID.String()); err != nil {
		return result, err
	}
	var previous string
	err = tx.QueryRow(ctx, `SELECT fingerprint,payment_id,purchase_id,request_id,financial_date::text,amount_cents FROM manual_expense_requests WHERE request_id=$1`, input.RequestID).
		Scan(&previous, &result.ID, &result.PurchaseID, &result.RequestID, &result.Date, &result.AmountCents)
	if err == nil {
		if previous != fingerprint {
			return domain.ManualExpenseResult{}, domain.ErrManualExpenseConflict
		}
		result.Replayed = true
		return result, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return result, err
	}
	var accountType string
	err = tx.QueryRow(ctx, `SELECT type FROM accounts WHERE id=$1 FOR UPDATE`, input.AccountID).Scan(&accountType)
	if errors.Is(err, pgx.ErrNoRows) || err == nil && accountType != "BANK" {
		return result, domain.ErrManualExpenseAccount
	}
	if err != nil {
		return result, err
	}

	amount := float64(input.AmountCents) / 100
	purchase, err := domain.NewPurchase(amount, &input.Description, input.Category, input.PaymentMethod, domain.PurchaseTypeSingle, "lançamento manual pela web")
	if err != nil {
		return result, err
	}
	day, _ := time.Parse(time.DateOnly, input.Date)
	payment := domain.NewPayment(purchase.ID, amount, domain.PaymentStatusPaid)
	payment.AccountID, payment.DueDate, payment.PaidAt = &input.AccountID, &day, &day

	if err = insertPurchase(ctx, tx, purchase); err != nil {
		return result, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO payments(id,purchase_id,amount,status,due_date,paid_at,account_id,created_at)
		VALUES($1,$2,$3,'PAID',$4::date,$4::date::timestamptz,$5,$6)`, payment.ID, purchase.ID, amount, day, input.AccountID, payment.CreatedAt); err != nil {
		return result, err
	}

	// A categoria explícita não deve ceder nem a regras futuras nem a RefreshExternal.
	if _, err = tx.Exec(ctx, `INSERT INTO payment_category_overrides(payment_id,category,source) VALUES($1,$2,'manual')
		ON CONFLICT(payment_id) DO UPDATE SET category=EXCLUDED.category,source='manual',rule_key=NULL,updated_at=NOW()`, payment.ID, input.Category); err != nil {
		return result, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO manual_expense_requests(request_id,fingerprint,purchase_id,payment_id,financial_date,amount_cents)
		VALUES($1,$2,$3,$4,$5::date,$6)`, input.RequestID, fingerprint, purchase.ID, payment.ID, day, input.AmountCents); err != nil {
		return result, err
	}
	result = domain.ManualExpenseResult{ID: payment.ID, PurchaseID: purchase.ID, RequestID: input.RequestID, Date: input.Date, AmountCents: input.AmountCents}
	return result, tx.Commit(ctx)
}
