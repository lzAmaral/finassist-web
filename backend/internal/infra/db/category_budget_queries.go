package db

import (
	"context"
	"slices"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
)

func (r *BudgetRepo) CategoryBudgets(ctx context.Context, month time.Time) ([]domain.CategoryBudget, error) {
	categories := domain.ExpenseCategories()
	keys := make([]string, len(categories))
	for i, category := range categories {
		keys[i] = string(category)
	}
	rows, err := r.db.Pool.Query(ctx, `WITH spent AS (
 SELECT effective_payment_category(pay.id,p.category) AS category,
 (COALESCE(SUM(pay.amount) FILTER (WHERE pay.status='PAID'),0)*100)::bigint AS paid,
 (COALESCE(SUM(pay.amount) FILTER (WHERE pay.status='PENDING'),0)*100)::bigint AS pending,
 COUNT(*) AS count
 FROM payments pay JOIN purchases p ON p.id=pay.purchase_id
 WHERE `+paymentMonth+`=$1 AND p.kind='EXPENSE' AND pay.status<>'CANCELLED'
 GROUP BY effective_payment_category(pay.id,p.category)
 ) SELECT c.category, b.limit_cents, COALESCE(b.version,0),
 COALESCE(s.paid,0), COALESCE(s.pending,0), COALESCE(s.count,0)
 FROM UNNEST($2::text[]) WITH ORDINALITY c(category,position)
 LEFT JOIN category_budget_limits b ON b.category=c.category AND b.month=$1
 LEFT JOIN spent s ON s.category=c.category ORDER BY c.position`, month, keys)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]domain.CategoryBudget, 0, len(categories))
	for rows.Next() {
		var b domain.CategoryBudget
		if err := rows.Scan(&b.Category, &b.LimitCents, &b.Version, &b.PaidCents, &b.PendingCents, &b.Count); err != nil {
			return nil, err
		}
		result = append(result, b)
	}
	return result, rows.Err()
}

func (r *BudgetRepo) SetCategoryBudget(ctx context.Context, month time.Time, category domain.Category, limit *int64, version int64) error {
	if month.Day() != 1 || version < 0 || !slices.Contains(domain.ExpenseCategories(), category) || (limit != nil && (*limit < 0 || *limit > domain.MaxCategoryBudgetCents)) {
		return domain.ErrInvalidCategoryBudget
	}
	// A versão preservada na remoção impede que um formulário antigo sobrescreva
	// um limite que tenha sido removido e recriado.
	query := `UPDATE category_budget_limits SET limit_cents=$3,version=version+1,updated_at=NOW() WHERE month=$1 AND category=$2 AND version=$4`
	args := []any{month, category, limit, version}
	if version == 0 {
		if limit == nil {
			return domain.ErrCategoryBudgetConflict
		}
		query = `INSERT INTO category_budget_limits(month,category,limit_cents,version) VALUES($1,$2,$3,1) ON CONFLICT DO NOTHING`
		args = args[:3]
	}
	tag, err := r.db.Pool.Exec(ctx, query, args...)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return domain.ErrCategoryBudgetConflict
	}
	return nil
}
