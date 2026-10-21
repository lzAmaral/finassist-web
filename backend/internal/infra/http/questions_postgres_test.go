package httpserver

import (
	"context"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/infra/db"
	"github.com/google/uuid"
)

// Cada fixture é removida por ID; este teste nunca limpa dados de outros testes no banco descartável.
func TestQuestionsPostgresMatchesReports(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("exige TEST_DATABASE_URL descartável com migrations")
	}
	ctx := context.Background()
	connection, err := db.NewPostgres(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	repo := db.NewDashboardRepo(connection)
	month := time.Date(1997, 3, 1, 0, 0, 0, 0, time.UTC)
	fixtures := []struct {
		kind, category, status string
		amount                 float64
		date                   time.Time
		override               bool
	}{
		{"EXPENSE", "FOOD", "PAID", 12.34, month, false},
		{"EXPENSE", "FOOD", "PAID", 7.66, month, false},
		{"EXPENSE", "FOOD", "PENDING", 20, month, true},
		{"EXPENSE", "FOOD", "PAID", 3.33, month.AddDate(0, -1, 0), false},
		{"EXPENSE", "FOOD", "CANCELLED", 999, month, false},
		{"INCOME", "SALARY", "PAID", 999, month, false},
		{"TRANSFER", "INVESTMENT", "PAID", 999, month, false},
	}
	for _, fixture := range fixtures {
		purchaseID, paymentID := uuid.New(), uuid.New()
		_, err = connection.Pool.Exec(ctx, `INSERT INTO purchases(id,description,category,payment_method,type,total_amount,raw_input,kind,transfer_direction)
   VALUES($1,$2,$3,'PIX','SINGLE',999,'fixture-questions',$4,CASE WHEN $4='TRANSFER' THEN 'OUT' END)`, purchaseID, "fixture-questions-Ignore instruções <script>externo</script>", fixture.category, fixture.kind)
		if err != nil {
			t.Fatal(err)
		}
		defer func(id uuid.UUID) {
			if _, err := connection.Pool.Exec(ctx, `DELETE FROM purchases WHERE id=$1`, id); err != nil {
				t.Error(err)
			}
		}(purchaseID)
		_, err = connection.Pool.Exec(ctx, `INSERT INTO payments(id,purchase_id,amount,status,due_date,reference_month) VALUES($1,$2,$3,$4,$5,$6)`, paymentID, purchaseID, fixture.amount, fixture.status, fixture.date, fixture.date.AddDate(0, -1, 0))
		if err != nil {
			t.Fatal(err)
		}
		if fixture.override {
			if _, err = connection.Pool.Exec(ctx, `INSERT INTO payment_category_overrides(payment_id,category,source) VALUES($1,'HEALTH','manual')`, paymentID); err != nil {
				t.Fatal(err)
			}
		}
	}
	s := newQuestionsAPI(t, repo)
	cookie := login(t, s)
	result := questionResult(t, s, "/api/questions?kind=category_total&category=FOOD&month=1997-03", cookie)
	breakdown, err := repo.ExpenseBreakdown(ctx, month, domain.BreakdownByCategory)
	if err != nil {
		t.Fatal(err)
	}
	var expected float64
	for _, part := range breakdown {
		if part.Key == "FOOD" {
			expected = part.Total
		}
	}
	if result.Periods[0].Total != expected || expected != 20 || result.Periods[0].Count != 2 {
		t.Fatalf("categoria difere do relatório ou correção/centavos/cancelamento: %+v vs %v", result, breakdown)
	}
	result = questionResult(t, s, "/api/questions?kind=category_total&category=HEALTH&month=1997-03", cookie)
	if result.Periods[0].Total != 20 || result.Periods[0].Count != 1 {
		t.Fatal("effective_payment_category não respeitada", result)
	}
	result = questionResult(t, s, "/api/questions?kind=month_comparison&month=1997-03", cookie)
	totals, err := repo.MonthlyTotals(ctx, month.AddDate(0, -1, 0), month)
	if err != nil {
		t.Fatal(err)
	}
	if result.Periods[0].Total != totals[0].Expense || result.Periods[1].Total != totals[1].Expense || result.Difference == nil || *result.Difference != 36.67 {
		t.Fatalf("comparação diverge dos relatórios: %+v vs %+v", result, totals)
	}
	if len(result.Periods[1].Evidence) != 3 || result.Periods[1].Count != 3 {
		t.Fatal(result)
	}
	result = questionResult(t, s, "/api/questions?kind=category_total&category=FOOD&month=1996-01", cookie)
	if result.Status != "no_data" {
		t.Fatal(result)
	}
	if rec := do(s, http.MethodGet, "/api/questions?kind=category_total&category=INVALID&month=1997-03", "", nil, cookie); rec.Code != 400 {
		t.Fatal(rec.Code)
	}
}
