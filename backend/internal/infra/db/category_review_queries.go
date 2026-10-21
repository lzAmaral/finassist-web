package db

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// A chave exata conserva números, pontuação e todas as palavras; nunca agrupa lojas pelo primeiro nome.
const exactCategoryKey = `('exact:' || BTRIM(REGEXP_REPLACE(LOWER(COALESCE(p.description, '')), '\s+', ' ', 'g')))`
const categoryReviewSelect = `SELECT pay.id, ` + txDate + `, COALESCE(p.description,''),
 effective_payment_category(pay.id,p.category), pay.amount, pay.status, ` + exactCategoryKey + `
 FROM payments pay JOIN purchases p ON p.id=pay.purchase_id `

var categoryTransferRE = regexp.MustCompile(`(?i)pix|transfer|\b(ted|doc)\b`)

func categoryRuleAllowed(key string) bool {
	label := strings.TrimPrefix(key, "exact:")
	return strings.TrimSpace(label) != "" && utf8.RuneCountInString(label) <= 500 && !categoryTransferRE.MatchString(label)
}

func scanCategoryItems(rows pgx.Rows) ([]domain.CategoryReviewItem, error) {
	defer rows.Close()
	items := []domain.CategoryReviewItem{}
	for rows.Next() {
		var i domain.CategoryReviewItem
		if err := rows.Scan(&i.ID, &i.Date, &i.Description, &i.Category, &i.Amount, &i.Status, &i.Key); err != nil {
			return nil, err
		}
		i.RuleAllowed = categoryRuleAllowed(i.Key)
		items = append(items, i)
	}
	return items, rows.Err()
}

func (r *ClassifyRepo) CategoryReview(ctx context.Context, limit, offset int) ([]domain.CategoryReviewItem, int, error) {
	const where = ` WHERE p.kind='EXPENSE' AND pay.status<>'CANCELLED'
 AND effective_payment_category(pay.id,p.category)='OTHER'
 AND NOT EXISTS (SELECT 1 FROM payment_category_overrides o WHERE o.payment_id=pay.id)
 AND NOT EXISTS (SELECT 1 FROM category_rules cr WHERE cr.key=` + expenseKey + `) `
	var total int
	if err := r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM payments pay JOIN purchases p ON p.id=pay.purchase_id `+where).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Pool.Query(ctx, categoryReviewSelect+where+` ORDER BY `+txDate+` DESC,pay.id LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	items, err := scanCategoryItems(rows)
	return items, total, err
}
func (r *ClassifyRepo) CategoryRules(ctx context.Context) ([]domain.CategoryRule, error) {
	rows, err := r.db.Pool.Query(ctx, `SELECT key,category FROM category_rules ORDER BY key`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.CategoryRule{}
	for rows.Next() {
		var rule domain.CategoryRule
		if err := rows.Scan(&rule.Key, &rule.Category); err != nil {
			return nil, err
		}
		out = append(out, rule)
	}
	return out, rows.Err()
}

type categoryQuerier interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func previewCategoryRule(ctx context.Context, q categoryQuerier, key, category string, lock bool) (domain.CategoryRulePreview, error) {
	preview := domain.CategoryRulePreview{Key: key, Category: category, Items: []domain.CategoryReviewItem{}}
	if !categoryRuleAllowed(key) {
		return preview, domain.ErrCategoryRuleNotAllowed
	}
	query := categoryReviewSelect + ` WHERE p.kind='EXPENSE' AND pay.status<>'CANCELLED' AND ` + exactCategoryKey + `=$1
 AND NOT EXISTS (SELECT 1 FROM payment_category_overrides o WHERE o.payment_id=pay.id AND o.source='manual')
 ORDER BY pay.id`
	if lock {
		query += ` FOR UPDATE OF pay,p`
	}
	rows, err := q.Query(ctx, query, key)
	if err != nil {
		return preview, err
	}
	preview.Items, err = scanCategoryItems(rows)
	if err != nil {
		return preview, err
	}
	preview.Count = len(preview.Items)
	ruleRows, err := q.Query(ctx, `SELECT category FROM category_rules WHERE key=$1`, key)
	if err != nil {
		return preview, err
	}
	previous := ""
	if ruleRows.Next() {
		if err := ruleRows.Scan(&previous); err != nil {
			ruleRows.Close()
			return preview, err
		}
	}
	ruleErr := ruleRows.Err()
	ruleRows.Close()
	if ruleErr != nil {
		return preview, ruleErr
	}
	payload, err := json.Marshal(struct {
		Preview  domain.CategoryRulePreview
		Previous string
	}{preview, previous})
	if err != nil {
		return preview, err
	}
	sum := sha256.Sum256(payload)
	preview.Hash = hex.EncodeToString(sum[:])
	return preview, nil
}
func (r *ClassifyRepo) PreviewCategoryRule(ctx context.Context, key, category string) (domain.CategoryRulePreview, error) {
	return previewCategoryRule(ctx, r.db.Pool, key, category, false)
}
func (r *ClassifyRepo) ApplyCategoryRule(ctx context.Context, key, category string, applyExisting bool, hash string) (int64, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	// Serializa alterações da mesma regra, incluindo remoção.
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, key); err != nil {
		return 0, err
	}
	preview, err := previewCategoryRule(ctx, tx, key, category, true)
	if err != nil {
		return 0, err
	}
	if hash == "" || hash != preview.Hash {
		return 0, domain.ErrCategoryPreviewChanged
	}
	if _, err = tx.Exec(ctx, `INSERT INTO category_rules(key,category) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET category=EXCLUDED.category,updated_at=NOW()`, key, category); err != nil {
		return 0, err
	}
	var changed int64
	if applyExisting {
		ids := make([]uuid.UUID, 0, len(preview.Items))
		for _, item := range preview.Items {
			ids = append(ids, item.ID)
			if item.Category != category {
				changed++
			}
		}
		_, err = tx.Exec(ctx, `INSERT INTO payment_category_overrides(payment_id,category,source,rule_key)
   SELECT id,$2,'rule',$3 FROM payments WHERE id=ANY($1::uuid[])
   ON CONFLICT(payment_id) DO UPDATE SET category=EXCLUDED.category,source='rule',rule_key=EXCLUDED.rule_key,updated_at=NOW()
   WHERE payment_category_overrides.source<>'manual'`, ids, category, key)
		if err != nil {
			return 0, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return changed, nil
}
func (r *ClassifyRepo) RemoveCategoryRule(ctx context.Context, key string) (bool, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, key); err != nil {
		return false, err
	}
	tag, err := tx.Exec(ctx, `DELETE FROM category_rules WHERE key=$1`, key)
	if err != nil {
		return false, err
	}
	// As correções aplicadas são históricas: remover a regra só afeta lançamentos futuros.
	return tag.RowsAffected() > 0, tx.Commit(ctx)
}
func (r *ClassifyRepo) SetTransactionCategory(ctx context.Context, id uuid.UUID, category string) (bool, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(ctx)
	var found uuid.UUID
	err = tx.QueryRow(ctx, `SELECT pay.id FROM payments pay JOIN purchases p ON p.id=pay.purchase_id
 WHERE pay.id=$1 AND p.kind='EXPENSE' AND pay.status<>'CANCELLED' FOR UPDATE OF pay`, id).Scan(&found)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO payment_category_overrides(payment_id,category,source) VALUES($1,$2,'manual')
 ON CONFLICT(payment_id) DO UPDATE SET category=EXCLUDED.category,source='manual',rule_key=NULL,updated_at=NOW()`, id, category); err != nil {
		return false, fmt.Errorf("erro ao corrigir categoria: %w", err)
	}
	return true, tx.Commit(ctx)
}

func (r *ClassifyRepo) CategoryTransaction(ctx context.Context, id uuid.UUID) (domain.CategoryReviewItem, error) {
	rows, err := r.db.Pool.Query(ctx, categoryReviewSelect+` WHERE pay.id=$1 AND p.kind='EXPENSE' AND pay.status<>'CANCELLED'`, id)
	if err != nil {
		return domain.CategoryReviewItem{}, err
	}
	items, err := scanCategoryItems(rows)
	if err != nil {
		return domain.CategoryReviewItem{}, err
	}
	if len(items) == 0 {
		return domain.CategoryReviewItem{}, domain.ErrCategoryTransactionNotFound
	}
	return items[0], nil
}

// Um único caminho para lançamentos bancários, manuais e novas parcelas/recorrências.
func applyExactPaymentCategory(ctx context.Context, tx pgx.Tx, purchaseID, paymentID uuid.UUID) error {
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended(`+exactCategoryKey+`,0)) FROM purchases p WHERE id=$1`, purchaseID); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
 INSERT INTO payment_category_overrides (payment_id,category,source,rule_key)
 SELECT $2,r.category,'rule',r.key FROM purchases p JOIN category_rules r ON r.key=`+exactCategoryKey+`
 WHERE p.id=$1 AND p.kind='EXPENSE' ON CONFLICT(payment_id) DO NOTHING`, purchaseID, paymentID)
	if err != nil {
		return fmt.Errorf("erro ao aplicar regra exata: %w", err)
	}
	return nil
}
