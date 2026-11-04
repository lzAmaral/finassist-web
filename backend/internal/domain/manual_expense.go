package domain

import (
	"errors"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

var ErrManualExpenseInvalid = errors.New("dados da despesa inválidos")
var ErrManualExpenseAccount = errors.New("selecione uma conta bancária existente")
var ErrManualExpenseConflict = errors.New("este envio já foi usado com outros dados; retome o envio original")

type ManualExpense struct {
	RequestID     uuid.UUID     `json:"requestId"`
	AmountCents   int64         `json:"amountCents"`
	Description   string        `json:"description"`
	Date          string        `json:"date"`
	AccountID     uuid.UUID     `json:"accountId"`
	Category      Category      `json:"category"`
	PaymentMethod PaymentMethod `json:"paymentMethod"`
}

// Normalize valida a data civil no Brasil, independentemente do fuso do servidor.
func (m *ManualExpense) Normalize(now time.Time) error {
	m.Description = strings.TrimSpace(m.Description)
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		return err
	}
	day, dateErr := time.Parse(time.DateOnly, m.Date)
	if m.RequestID == uuid.Nil || m.AccountID == uuid.Nil || m.AmountCents < 1 || m.AmountCents > 999999999999 ||
		!utf8.ValidString(m.Description) || utf8.RuneCountInString(m.Description) < 1 || utf8.RuneCountInString(m.Description) > 200 ||
		dateErr != nil || day.Year() < 2000 || day.Format(time.DateOnly) != m.Date || m.Date > now.In(loc).Format(time.DateOnly) ||
		!slices.Contains(ExpenseCategories(), m.Category) || !slices.Contains([]PaymentMethod{PaymentMethodPix, PaymentMethodDebitCard, PaymentMethodCash, PaymentMethodOther}, m.PaymentMethod) {
		return ErrManualExpenseInvalid
	}
	return nil
}

type ManualExpenseResult struct {
	ID          uuid.UUID `json:"id"`
	PurchaseID  uuid.UUID `json:"purchaseId"`
	RequestID   uuid.UUID `json:"requestId"`
	Date        string    `json:"date"`
	AmountCents int64     `json:"amountCents"`
	Replayed    bool      `json:"replayed"`
}
