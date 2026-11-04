package httpserver

import (
	"errors"
	"net/http"
	"slices"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain/ports"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/usecase/planning"
)

func (a *api) categoryBudgetStore(w http.ResponseWriter) ports.CategoryBudgetStore {
	store, ok := a.reader.(ports.CategoryBudgetStore)
	if !ok {
		writeError(w, 503, "limites por categoria indisponíveis neste modo")
		return nil
	}
	return store
}

func (a *api) categoryBudgets(w http.ResponseWriter, r *http.Request) {
	month, ok := a.monthParam(w, r, "month", true)
	if !ok {
		return
	}
	store := a.categoryBudgetStore(w)
	if store == nil {
		return
	}
	rows, err := store.CategoryBudgets(r.Context(), month)
	if err != nil {
		a.fail(w, "limites por categoria", err)
		return
	}
	items := make([]planning.CategoryBudgetProgress, 0, len(rows))
	for _, row := range rows {
		items = append(items, planning.BuildCategoryBudget(row))
	}
	writeJSON(w, 200, map[string]any{"month": formatMonth(month), "items": items})
}

func (a *api) setCategoryBudget(w http.ResponseWriter, r *http.Request) {
	month, ok := a.monthParam(w, r, "month", true)
	if !ok {
		return
	}
	category := domain.Category(r.PathValue("category"))
	var body struct {
		LimitCents *int64 `json:"limitCents"`
		Version    *int64 `json:"version"`
	}
	if !decodeJSONStrict(w, r, 1024, &body) {
		return
	}
	removing := r.Method == http.MethodDelete
	if !slices.Contains(domain.ExpenseCategories(), category) || body.Version == nil || *body.Version < 0 ||
		(!removing && (body.LimitCents == nil || *body.LimitCents < 0 || *body.LimitCents > domain.MaxCategoryBudgetCents)) || (removing && body.LimitCents != nil) {
		writeError(w, 400, domain.ErrInvalidCategoryBudget.Error())
		return
	}
	store := a.categoryBudgetStore(w)
	if store == nil {
		return
	}
	err := store.SetCategoryBudget(r.Context(), month, category, body.LimitCents, *body.Version)
	switch {
	case errors.Is(err, domain.ErrCategoryBudgetConflict):
		writeError(w, 409, err.Error())
	case errors.Is(err, domain.ErrInvalidCategoryBudget):
		writeError(w, 400, err.Error())
	case err != nil:
		a.fail(w, "salvar limite por categoria", err)
	default:
		writeJSON(w, 200, map[string]bool{"saved": true})
	}
}

func (a *api) registerCategoryBudgets(rt routes) {
	rt.mux.Handle("GET /api/budget-limits", rt.protected(a.categoryBudgets))
	rt.mux.Handle("PUT /api/budget-limits/{category}", rt.protected(jsonOnly(a.setCategoryBudget)))
	rt.mux.Handle("DELETE /api/budget-limits/{category}", rt.protected(jsonOnly(a.setCategoryBudget)))
}
