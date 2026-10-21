package httpserver

import (
	"encoding/json"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"testing"
	"time"
)

func TestAPIReviewEvidence(t *testing.T) {
	day := time.Date(2026, time.October, 3, 0, 0, 0, 0, time.UTC)
	reader := &fakeReader{payments: []domain.ExpensePayment{
		{ID: "payment-one", Key: "store", Label: "STORE", Category: "FOOD", Date: day, Amount: 40},
		{ID: "payment-two", Key: "store", Label: "STORE", Category: "FOOD", Date: day.AddDate(0, 0, 1), Amount: 40},
	}}
	server := newTestAPI(t, reader)
	response := do(server, "GET", "/api/review?month=2026-10", "", nil, login(t, server))
	var body struct {
		HistoryMonths int `json:"historyMonths"`
		Candidates    []struct {
			Kind     string `json:"kind"`
			Evidence []struct {
				ID     string  `json:"id"`
				Date   string  `json:"date"`
				Amount float64 `json:"amount"`
			} `json:"evidence"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil || response.Code != 200 {
		t.Fatalf("resposta inválida: %d %s %v", response.Code, response.Body.String(), err)
	}
	for _, candidate := range body.Candidates {
		if candidate.Kind == "DUPLICATE" {
			if len(candidate.Evidence) != 2 || candidate.Evidence[0].ID != "payment-one" || candidate.Evidence[1].Date != "2026-10-04" || candidate.Evidence[0].Amount != 40 {
				t.Fatalf("evidências perdidas no contrato: %+v", candidate)
			}
			return
		}
	}
	t.Fatal("possível duplicidade não encontrada")
}
