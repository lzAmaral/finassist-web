package domain

import (
	"errors"
	"github.com/google/uuid"
	"time"
)

var ErrCategoryPreviewChanged = errors.New("os lançamentos mudaram: confira a prévia novamente")
var ErrCategoryTransactionNotFound = errors.New("lançamento de despesa não encontrado")
var ErrCategoryRuleNotAllowed = errors.New("transferências exigem correção individual")

type CategoryReviewItem struct {
	ID          uuid.UUID `json:"id"`
	Date        time.Time `json:"date"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
	Amount      float64   `json:"amount"`
	Status      string    `json:"status"`
	Key         string    `json:"key"`
	RuleAllowed bool      `json:"ruleAllowed"`
}
type CategoryRulePreview struct {
	Key      string               `json:"key"`
	Category string               `json:"category"`
	Hash     string               `json:"hash"`
	Count    int                  `json:"count"`
	Items    []CategoryReviewItem `json:"items"`
}
