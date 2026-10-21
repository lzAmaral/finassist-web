package domain

import "errors"

var ErrStatementInvalid = errors.New("importação inválida")
var ErrStatementNotFound = errors.New("lote não encontrado")
var ErrStatementConflict = errors.New("lote ou correspondência mudou; recarregue a prévia")

type StatementMapping struct {
	Date        int    `json:"date"`
	Description int    `json:"description"`
	Amount      int    `json:"amount"`
	Currency    int    `json:"currency"` // -1 = BRL explícito na configuração
	Header      bool   `json:"header"`
	Decimal     string `json:"decimal"`
	DateFormat  string `json:"dateFormat"`
}
type StatementCandidate struct {
	ID          string `json:"id"`
	Date        string `json:"date"`
	Description string `json:"description"`
	External    bool   `json:"external"`
}
type StatementRow struct {
	Number      int                  `json:"number"`
	Date        string               `json:"date"`
	Description string               `json:"description"`
	Cents       int64                `json:"cents"`
	Fingerprint string               `json:"fingerprint"`
	Error       string               `json:"error,omitempty"`
	Duplicate   bool                 `json:"duplicate"`
	Candidates  []StatementCandidate `json:"candidates"`
	Action      string               `json:"action,omitempty"`
	PaymentID   string               `json:"paymentId,omitempty"`
}
type StatementBatch struct {
	ID        string         `json:"id"`
	AccountID string         `json:"accountId"`
	Filename  string         `json:"filename"`
	Hash      string         `json:"hash"`
	Status    string         `json:"status"`
	CreatedAt string         `json:"createdAt"`
	Rows      []StatementRow `json:"rows"`
	Created   int            `json:"created"`
	Preserved int            `json:"preserved"`
}
type StatementDecision struct {
	Row          int      `json:"row"`
	Action       string   `json:"action"`
	PaymentID    string   `json:"paymentId,omitempty"`
	CandidateIDs []string `json:"candidateIds,omitempty"`
}
