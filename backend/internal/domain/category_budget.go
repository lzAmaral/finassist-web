package domain

import "errors"

const MaxCategoryBudgetCents int64 = 100000000000

var ErrCategoryBudgetConflict = errors.New("o limite foi alterado em outra sessão; atualize e confira antes de salvar")
var ErrInvalidCategoryBudget = errors.New("limite, categoria, mês ou versão inválidos")

func ExpenseCategories() []Category {
	return []Category{CategoryFood, CategoryMarket, CategoryTransport, CategoryHealth, CategoryEntertainment,
		CategoryShopping, CategoryHousing, CategoryBills, CategoryEducation, CategoryPeople, CategoryOther}
}

// CategoryBudget considera despesas registradas, sem afirmar cobertura completa.
// Limite nil é ausência; zero é um teto explícito.
type CategoryBudget struct {
	Category     Category `json:"category"`
	Label        string   `json:"label"`
	LimitCents   *int64   `json:"limitCents"`
	Version      int64    `json:"version"`
	PaidCents    int64    `json:"paidCents"`
	PendingCents int64    `json:"pendingCents"`
	Count        int64    `json:"count"`
}
