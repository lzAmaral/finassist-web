package httpserver

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"testing"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/google/uuid"
)

type categoryReviewFake struct {
	*fakeReader
	changed             bool
	key, category, hash string
	apply               bool
	failure             error
}

func (f *categoryReviewFake) CategoryReview(context.Context, int, int) ([]domain.CategoryReviewItem, int, error) {
	return []domain.CategoryReviewItem{}, 0, f.failure
}
func (f *categoryReviewFake) CategoryRules(context.Context) ([]domain.CategoryRule, error) {
	return []domain.CategoryRule{}, f.failure
}
func (f *categoryReviewFake) CategoryTransaction(context.Context, uuid.UUID) (domain.CategoryReviewItem, error) {
	return domain.CategoryReviewItem{}, f.failure
}
func (f *categoryReviewFake) PreviewCategoryRule(_ context.Context, key, category string) (domain.CategoryRulePreview, error) {
	return domain.CategoryRulePreview{Key: key, Category: category, Hash: "snapshot", Items: []domain.CategoryReviewItem{}}, f.failure
}
func (f *categoryReviewFake) ApplyCategoryRule(_ context.Context, key, category string, apply bool, hash string) (int64, error) {
	f.key, f.category, f.apply, f.hash = key, category, apply, hash
	return 3, f.failure
}
func (f *categoryReviewFake) RemoveCategoryRule(_ context.Context, key string) (bool, error) {
	f.key = key
	return true, f.failure
}
func (f *categoryReviewFake) SetTransactionCategory(_ context.Context, _ uuid.UUID, category string) (bool, error) {
	f.changed = true
	f.category = category
	return true, f.failure
}
func TestCategoryReviewAPI_SessionOriginValidationAndConflicts(t *testing.T) {
	f := &categoryReviewFake{fakeReader: &fakeReader{}}
	s := NewServer(0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err := s.MountAPI(StaticPassword(testPassword), f); err != nil {
		t.Fatal(err)
	}
	id := uuid.NewString()
	headers := map[string]string{"Content-Type": "application/json"}
	for _, route := range []struct{ method, path, body string }{
		{"GET", "/api/categorize/review", ""},
		{"GET", "/api/categorize/transactions/" + id, ""},
		{"PUT", "/api/categorize/transactions/" + id, `{"category":"FOOD"}`},
		{"POST", "/api/categorize/preview", `{"key":"exact:loja 101","category":"FOOD"}`},
		{"DELETE", "/api/categorize/rules?key=exact:loja", ""},
	} {
		if rec := do(s, route.method, route.path, route.body, headers); rec.Code != 401 {
			t.Fatalf("sem sessão %s = %d", route.path, rec.Code)
		}
	}
	cookie := login(t, s)
	if rec := do(s, "PUT", "/api/categorize/transactions/"+id, `{"category":"HEALTH"}`, map[string]string{"Content-Type": "application/json", "Origin": "https://evil.example"}, cookie); rec.Code != 403 || f.changed {
		t.Fatalf("origem bloqueada = %d", rec.Code)
	}
	if rec := do(s, "PUT", "/api/categorize/transactions/"+id, `{"category":"SALARY"}`, headers, cookie); rec.Code != 400 || f.changed {
		t.Fatalf("categoria fora do contrato = %d", rec.Code)
	}
	if rec := do(s, "PUT", "/api/categorize/transactions/"+id, `{"category":"HEALTH"}`, headers, cookie); rec.Code != 200 || !f.changed || f.category != "HEALTH" {
		t.Fatalf("correção individual = %d %s", rec.Code, rec.Body)
	}
	if rec := do(s, "PUT", "/api/categorize/rules", `{"key":"exact:loja 101","category":"FOOD","applyExisting":false,"previewHash":"snapshot"}`, headers, cookie); rec.Code != 200 || f.apply || f.hash != "snapshot" || f.key != "exact:loja 101" {
		t.Fatalf("regra só futura = %d %s", rec.Code, rec.Body)
	}
	f.failure = domain.ErrCategoryPreviewChanged
	if rec := do(s, "PUT", "/api/categorize/rules", `{"key":"exact:loja 101","category":"FOOD","applyExisting":true,"previewHash":"stale"}`, headers, cookie); rec.Code != http.StatusConflict {
		t.Fatalf("prévia alterada = %d %s", rec.Code, rec.Body)
	}
	f.failure = nil
	if rec := do(s, "DELETE", "/api/categorize/rules?key=exact:loja%20101", "", nil, cookie); rec.Code != 200 {
		t.Fatalf("remoção = %d %s", rec.Code, rec.Body)
	}
}
func TestCategoryReviewAPI_ReadOnlyModeIsExplicit(t *testing.T) {
	s := newTestAPI(t, &fakeReader{})
	cookie := login(t, s)
	if rec := do(s, "GET", "/api/categorize/review", "", nil, cookie); rec.Code != 503 {
		t.Fatalf("contrato de leitura não suporta escrita/revisão = %d", rec.Code)
	}
}
