package domain

import (
	"time"

	"github.com/google/uuid"
)

// AgendaPayment preserva a origem: due_date importada é a data da transação, não o vencimento da fatura.
type AgendaPayment struct {
	ID, PurchaseID                  uuid.UUID
	Description                     string
	Amount                          float64
	Status                          PaymentStatus
	Type                            PurchaseType
	Method                          PaymentMethod
	DueDate, ReferenceMonth, PaidAt *time.Time
	AccountID                       *uuid.UUID
	Imported                        bool
	InstallmentNumber               *int
	CreatedAt                       time.Time
}

type AgendaRecurring struct {
	ID          uuid.UUID
	Description string
	Amount      float64
	Day         int
	CreatedAt   time.Time
}
