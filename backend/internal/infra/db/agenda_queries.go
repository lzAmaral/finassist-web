package db

import (
	"context"
	"fmt"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/jackc/pgx/v5"
)

func (r *AccountsRepo) AgendaPayments(ctx context.Context, from, through time.Time) ([]domain.AgendaPayment, error) {
	rows, err := r.db.Pool.Query(ctx, `
		SELECT pay.id, p.id, COALESCE(p.description, 'Compromisso sem descrição'), pay.amount,
		       pay.status, p.type, p.payment_method, pay.due_date, pay.reference_month, pay.paid_at,
		       pay.account_id, pay.external_id IS NOT NULL, pay.installment_number, pay.created_at
		FROM payments pay JOIN purchases p ON p.id = pay.purchase_id
		WHERE p.kind = 'EXPENSE' AND (
		  (pay.status = 'PENDING' AND (pay.due_date IS NULL OR pay.due_date <= $2::date))
		  OR COALESCE(pay.reference_month, DATE_TRUNC('month', pay.due_date)) BETWEEN $1::date AND $2::date
		)
		ORDER BY pay.due_date NULLS LAST, pay.id`, from, through)
	if err != nil {
		return nil, fmt.Errorf("erro ao ler pagamentos da agenda: %w", err)
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.AgendaPayment, error) {
		var p domain.AgendaPayment
		err := row.Scan(&p.ID, &p.PurchaseID, &p.Description, &p.Amount, &p.Status, &p.Type, &p.Method,
			&p.DueDate, &p.ReferenceMonth, &p.PaidAt, &p.AccountID, &p.Imported, &p.InstallmentNumber, &p.CreatedAt)
		return p, err
	})
}

func (r *AccountsRepo) AgendaRecurring(ctx context.Context) ([]domain.AgendaRecurring, error) {
	rows, err := r.db.Pool.Query(ctx, `
		SELECT id, COALESCE(description, 'Recorrência sem descrição'), total_amount, day_of_month, created_at
		FROM purchases WHERE kind = 'EXPENSE' AND type = 'RECURRING' AND is_active
		  AND day_of_month BETWEEN 1 AND 31 ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("erro ao ler recorrências da agenda: %w", err)
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.AgendaRecurring, error) {
		var p domain.AgendaRecurring
		err := row.Scan(&p.ID, &p.Description, &p.Amount, &p.Day, &p.CreatedAt)
		return p, err
	})
}
