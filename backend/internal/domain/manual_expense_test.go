package domain

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestManualExpenseValidationBrazilianCivilDate(t *testing.T) {
	now := time.Date(2026, 11, 1, 1, 30, 0, 0, time.UTC) // Ainda 31/10 no Brasil.
	valid := ManualExpense{RequestID: uuid.New(), AmountCents: 1, Description: "  Mercado  ", Date: "2026-10-31", AccountID: uuid.New(), Category: CategoryMarket, PaymentMethod: PaymentMethodPix}
	for _, cents := range []int64{1, 123456, 999999999999} {
		in := valid
		in.AmountCents = cents
		if err := in.Normalize(now); err != nil || in.Description != "Mercado" {
			t.Fatalf("válido: %+v %v", in, err)
		}
	}
	cases := map[string]func(*ManualExpense){
		"zero": func(m *ManualExpense) { m.AmountCents = 0 }, "negativo": func(m *ManualExpense) { m.AmountCents = -1 }, "overflow": func(m *ManualExpense) { m.AmountCents = 1000000000000 },
		"chave nula": func(m *ManualExpense) { m.RequestID = uuid.Nil }, "conta nula": func(m *ManualExpense) { m.AccountID = uuid.Nil },
		"descrição vazia": func(m *ManualExpense) { m.Description = " \t\n" }, "descrição longa": func(m *ManualExpense) { m.Description = strings.Repeat("á", 201) },
		"dia impossível": func(m *ManualExpense) { m.Date = "2026-02-30" }, "formato": func(m *ManualExpense) { m.Date = "2026-1-01" }, "antes de 2000": func(m *ManualExpense) { m.Date = "1999-12-31" },
		"ano zero":          func(m *ManualExpense) { m.Date = "0000-01-01" },
		"futuro brasileiro": func(m *ManualExpense) { m.Date = "2026-11-01" }, "categoria receita": func(m *ManualExpense) { m.Category = CategorySalary },
		"cartão crédito": func(m *ManualExpense) { m.PaymentMethod = PaymentMethodCreditCard }, "enum": func(m *ManualExpense) { m.PaymentMethod = "INVALID" },
	}
	for name, edit := range cases {
		t.Run(name, func(t *testing.T) {
			in := valid
			edit(&in)
			if err := in.Normalize(now); err != ErrManualExpenseInvalid {
				t.Fatalf("erro=%v", err)
			}
		})
	}
	in := valid
	in.Date = "2000-01-01"
	in.Description = strings.Repeat("á", 200)
	if err := in.Normalize(now); err != nil {
		t.Fatal(err)
	}
}
