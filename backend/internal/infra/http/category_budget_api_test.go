package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
)

type categoryBudgetFake struct {
	*fakeReader
	limit    *int64
	version  int64
	month    time.Time
	category domain.Category
	writes   int
	failure  error
}

func (f *categoryBudgetFake) CategoryBudgets(context.Context, time.Time) ([]domain.CategoryBudget, error) {
	return []domain.CategoryBudget{{Category: domain.CategoryFood, LimitCents: f.limit, Version: f.version, PaidCents: 1200, PendingCents: 35, Count: 2}}, f.failure
}
func (f *categoryBudgetFake) SetCategoryBudget(_ context.Context, month time.Time, category domain.Category, limit *int64, version int64) error {
	if f.failure != nil {
		return f.failure
	}
	if version != f.version {
		return domain.ErrCategoryBudgetConflict
	}
	f.limit, f.month, f.category = limit, month, category
	f.version++
	f.writes++
	return nil
}
func TestCategoryBudgetAPI_ValidationSecurityAndLifecycle(t *testing.T) {
	f := &categoryBudgetFake{fakeReader: &fakeReader{}}
	s := NewServer(0, slog.New(slog.DiscardHandler))
	if err := s.MountAPI(StaticPassword(testPassword), f); err != nil {
		t.Fatal(err)
	}
	headers := map[string]string{"Content-Type": "application/json"}
	path := "/api/budget-limits/FOOD?month=2026-10"
	for _, method := range []string{"GET", "PUT", "DELETE"} {
		route := path
		if method == "GET" {
			route = "/api/budget-limits?month=2026-10"
		}
		if rec := do(s, method, route, `{"version":0,"limitCents":0}`, headers); rec.Code != 401 {
			t.Fatalf("auth %s: %d", method, rec.Code)
		}
	}
	cookie := login(t, s)
	for _, method := range []string{"PUT", "DELETE"} {
		for _, h := range []map[string]string{nil, {"Content-Type": "application/json", "Origin": "https://evil.example"}} {
			if rec := do(s, method, path, `{"version":0,"limitCents":0}`, h, cookie); rec.Code != 403 {
				t.Fatalf("CSRF: %d", rec.Code)
			}
		}
	}
	for _, body := range []string{`{}`, `{"limitCents":0}`, `{"version":0}`, `{"version":0,"limitCents":null}`, `{"version":-1,"limitCents":1}`, `{"version":0,"limitCents":-1}`, `{"version":0,"limitCents":1.5}`, `{"version":0,"limitCents":100000000001}`, `{"version":0,"limitCents":1,"unknown":1}`} {
		if rec := do(s, "PUT", path, body, headers, cookie); rec.Code != 400 {
			t.Fatalf("validação %s: %d", body, rec.Code)
		}
	}
	for _, route := range []string{"/api/budget-limits/FOOD", "/api/budget-limits/FOOD?month=bad", "/api/budget-limits/SALARY?month=2026-10"} {
		if rec := do(s, "PUT", route, `{"version":0,"limitCents":0}`, headers, cookie); rec.Code != 400 {
			t.Fatalf("rota inválida: %d", rec.Code)
		}
	}
	if f.writes != 0 {
		t.Fatal("entrada inválida escreveu")
	}
	if rec := do(s, "PUT", path, `{"version":0,"limitCents":0}`, headers, cookie); rec.Code != 200 || f.limit == nil || *f.limit != 0 || f.month.Format("2006-01") != "2026-10" || f.category != domain.CategoryFood {
		t.Fatalf("zero: %d %s", rec.Code, rec.Body)
	}
	if rec := do(s, "PUT", path, `{"version":0,"limitCents":500}`, headers, cookie); rec.Code != 409 {
		t.Fatalf("conflito: %d", rec.Code)
	}
	rec := do(s, "GET", "/api/budget-limits?month=2026-10", "", nil, cookie)
	var data struct {
		Items []struct {
			SpentCents     int64
			Status         string
			RemainingCents *int64
			UsagePercent   *float64
		}
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &data); err != nil {
		t.Fatal(err)
	}
	if rec.Code != 200 || len(data.Items) != 1 || data.Items[0].SpentCents != 1235 || data.Items[0].Status != "exceeded" || data.Items[0].UsagePercent != nil || data.Items[0].RemainingCents == nil || *data.Items[0].RemainingCents != -1235 {
		t.Fatalf("progresso: %d %s", rec.Code, rec.Body)
	}
	if !strings.Contains(rec.Header().Get("Cache-Control"), "no-store") {
		t.Fatal("resposta financeira cacheável")
	}
	if rec := do(s, "DELETE", path, `{"version":1}`, headers, cookie); rec.Code != 200 || f.limit != nil {
		t.Fatalf("remoção: %d", rec.Code)
	}
	f.failure = errors.New("secret database password")
	for _, method := range []string{"GET", "PUT"} {
		route := path
		if method == "GET" {
			route = "/api/budget-limits?month=2026-10"
		}
		rec := do(s, method, route, `{"version":2,"limitCents":500}`, headers, cookie)
		if rec.Code != 500 || strings.Contains(rec.Body.String(), "secret") {
			t.Fatalf("erro interno: %d %s", rec.Code, rec.Body)
		}
	}
}
func TestCategoryBudgetAPI_Unavailable(t *testing.T) {
	s := newTestAPI(t, &fakeReader{})
	if rec := do(s, "GET", "/api/budget-limits?month=2026-10", "", nil, login(t, s)); rec.Code != 503 {
		t.Fatalf("modo indisponível: %d", rec.Code)
	}
}
