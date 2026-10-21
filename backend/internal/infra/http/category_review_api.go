package httpserver

import (
	"errors"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain/ports"
	"github.com/google/uuid"
)

const maxCategoryReviewBody = 4 << 10

func (a *api) categoryStore(w http.ResponseWriter) ports.CategoryReviewStore {
	store, ok := a.reader.(ports.CategoryReviewStore)
	if !ok {
		writeError(w, http.StatusServiceUnavailable, "classificação indisponível neste modo")
		return nil
	}
	return store
}
func validExactCategory(key, category string) bool {
	return strings.HasPrefix(key, "exact:") && utf8.RuneCountInString(key) > 6 && utf8.RuneCountInString(key) <= 506 && slices.Contains(ruleCategories, domain.Category(category))
}
func (a *api) categoryReview(w http.ResponseWriter, r *http.Request) {
	store := a.categoryStore(w)
	if store == nil {
		return
	}
	offset := 0
	if value := r.URL.Query().Get("offset"); value != "" {
		var err error
		offset, err = strconv.Atoi(value)
		if err != nil || offset < 0 {
			writeError(w, 400, "offset inválido")
			return
		}
	}
	items, total, err := store.CategoryReview(r.Context(), maxUncategorized, offset)
	if err != nil {
		a.fail(w, "fila de classificação", err)
		return
	}
	rules, err := store.CategoryRules(r.Context())
	if err != nil {
		a.fail(w, "regras de categoria", err)
		return
	}
	type option struct {
		Value string `json:"value"`
		Label string `json:"label"`
	}
	options := make([]option, 0, len(ruleCategories))
	for _, c := range ruleCategories {
		options = append(options, option{string(c), c.Label()})
	}
	writeJSON(w, 200, map[string]any{"items": items, "total": total, "rules": rules, "categories": options, "limit": maxUncategorized, "offset": offset})
}
func (a *api) categoryFailure(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrCategoryPreviewChanged):
		writeError(w, 409, err.Error())
	case errors.Is(err, domain.ErrCategoryRuleNotAllowed):
		writeError(w, 400, err.Error())
	default:
		a.fail(w, "classificação", err)
	}
}
func (a *api) previewExactCategoryRule(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Key      string `json:"key"`
		Category string `json:"category"`
	}
	if !decodeJSON(w, r, maxCategoryReviewBody, &body) {
		return
	}
	if !validExactCategory(body.Key, body.Category) {
		writeError(w, 400, "regra ou categoria inválida")
		return
	}
	store := a.categoryStore(w)
	if store == nil {
		return
	}
	preview, err := store.PreviewCategoryRule(r.Context(), body.Key, body.Category)
	if err != nil {
		a.categoryFailure(w, err)
		return
	}
	writeJSON(w, 200, preview)
}
func (a *api) applyExactCategoryRule(w http.ResponseWriter, r *http.Request, key, category string, applyExisting bool, hash string) {
	if !validExactCategory(key, category) {
		writeError(w, 400, "regra ou categoria inválida")
		return
	}
	store := a.categoryStore(w)
	if store == nil {
		return
	}
	changed, err := store.ApplyCategoryRule(r.Context(), key, category, applyExisting, hash)
	if err != nil {
		a.categoryFailure(w, err)
		return
	}
	writeJSON(w, 200, map[string]int64{"changed": changed})
}
func (a *api) setTransactionCategory(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, 400, "id inválido")
		return
	}
	var body struct {
		Category string `json:"category"`
	}
	if !decodeJSON(w, r, maxCategoryReviewBody, &body) {
		return
	}
	if !slices.Contains(ruleCategories, domain.Category(body.Category)) {
		writeError(w, 400, "categoria inválida")
		return
	}
	store := a.categoryStore(w)
	if store == nil {
		return
	}
	found, err := store.SetTransactionCategory(r.Context(), id, body.Category)
	if err != nil {
		a.categoryFailure(w, err)
		return
	}
	if !found {
		writeError(w, 404, domain.ErrCategoryTransactionNotFound.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"saved": true})
}
func (a *api) removeCategoryRule(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if key == "" || utf8.RuneCountInString(key) > 506 {
		writeError(w, 400, "key inválida")
		return
	}
	store := a.categoryStore(w)
	if store == nil {
		return
	}
	removed, err := store.RemoveCategoryRule(r.Context(), key)
	if err != nil {
		a.categoryFailure(w, err)
		return
	}
	if !removed {
		writeError(w, 404, "regra não encontrada")
		return
	}
	writeJSON(w, 200, map[string]any{"removed": true, "effect": "a regra deixa de valer para próximos lançamentos; correções já aplicadas permanecem"})
}

func (a *api) categoryTransaction(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		writeError(w, 400, "id inválido")
		return
	}
	store := a.categoryStore(w)
	if store == nil {
		return
	}
	item, err := store.CategoryTransaction(r.Context(), id)
	if errors.Is(err, domain.ErrCategoryTransactionNotFound) {
		writeError(w, 404, err.Error())
		return
	}
	if err != nil {
		a.categoryFailure(w, err)
		return
	}
	writeJSON(w, 200, item)
}
