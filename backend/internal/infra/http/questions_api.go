package httpserver

import (
	"math"
	"net/http"
	"net/url"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain/ports"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/usecase/agenda"
)

type questionEvidence struct {
	ID          string  `json:"id"`
	Description string  `json:"description"`
	Date        string  `json:"date"`
	Amount      float64 `json:"amount"`
	Href        string  `json:"href"`
}
type questionPeriod struct {
	Month    string             `json:"month"`
	Total    float64            `json:"total"`
	Count    int                `json:"count"`
	Href     string             `json:"href"`
	Evidence []questionEvidence `json:"evidence"`
}
type questionAnswer struct {
	Kind            string            `json:"kind"`
	Category        string            `json:"category"`
	Status          string            `json:"status"`
	Source          string            `json:"source"`
	GeneratedAt     string            `json:"generatedAt"`
	SourceUpdatedAt *string           `json:"sourceUpdatedAt"`
	Freshness       string            `json:"freshness"`
	Periods         []questionPeriod  `json:"periods"`
	Difference      *float64          `json:"difference"`
	Percent         *float64          `json:"percent"`
	Agenda          *agenda.Result    `json:"agenda"`
	CommitmentLinks map[string]string `json:"commitmentLinks"`
}

// As perguntas usam os mesmos leitores dos relatórios. Descrições externas são apenas dados;
// nenhuma pergunta chama IA ou transforma texto do extrato em instruções.
func (a *api) questions(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	if kind != "category_total" && kind != "month_comparison" && kind != "commitments" {
		writeError(w, http.StatusBadRequest, "escolha uma pergunta sugerida: category_total, month_comparison ou commitments")
		return
	}
	month, ok := a.monthParam(w, r, "month", true)
	if !ok {
		return
	}
	category := ""
	if kind == "category_total" {
		category, ok = enumParam(w, r.URL.Query().Get("category"), "categoria", categories)
		if !ok {
			return
		}
		if category == "" {
			writeError(w, http.StatusBadRequest, "selecione uma categoria para esta pergunta")
			return
		}
	}
	now := a.now()
	out := questionAnswer{Kind: kind, Category: category, Status: "ok", Source: "go-postgres", GeneratedAt: now.UTC().Format(time.RFC3339), Freshness: "unknown", Periods: []questionPeriod{}, CommitmentLinks: map[string]string{}}
	institutions, err := a.reader.Institutions(r.Context())
	if err != nil {
		a.fail(w, "origem das perguntas", err)
		return
	}
	// A mais antiga das fontes conhecidas evita apresentar a última sincronização parcial como global.
	var oldest *time.Time
	complete := len(institutions) > 0
	for _, institution := range institutions {
		if institution.SourceUpdatedAt == nil {
			complete = false
			continue
		}
		if oldest == nil || institution.SourceUpdatedAt.Before(*oldest) {
			value := *institution.SourceUpdatedAt
			oldest = &value
		}
	}
	if oldest != nil {
		value := oldest.UTC().Format(time.RFC3339)
		out.SourceUpdatedAt = &value
		if complete {
			out.Freshness = "recent"
		}
		if now.Sub(*oldest) > 48*time.Hour || oldest.After(now) {
			out.Freshness = "stale"
		}
	}
	if kind == "commitments" {
		reader, supported := a.reader.(ports.AgendaReader)
		if !supported {
			writeError(w, http.StatusNotImplemented, "compromissos indisponíveis nesta versão do backend")
			return
		}
		_, from, through := agenda.Dates(now)
		payments, err := reader.AgendaPayments(r.Context(), from, through)
		if err != nil {
			a.fail(w, "compromissos", err)
			return
		}
		recurring, err := reader.AgendaRecurring(r.Context())
		if err != nil {
			a.fail(w, "recorrências", err)
			return
		}
		result := agenda.Build(now, nil, nil, payments, recurring)
		out.Agenda = &result
		for _, payment := range payments {
			date := payment.CreatedAt
			if payment.ReferenceMonth != nil {
				date = *payment.ReferenceMonth
			}
			if payment.DueDate != nil {
				date = *payment.DueDate
			}
			out.CommitmentLinks[payment.ID.String()] = "/transacoes?" + url.Values{"month": {formatMonth(date)}, "flow": {"EXPENSE"}}.Encode()
		}
		if len(result.Commitments) == 0 {
			out.Status = "no_data"
		}
		writeJSON(w, http.StatusOK, out)
		return
	}
	months := []time.Time{month}
	if kind == "month_comparison" {
		months = []time.Time{month.AddDate(0, -1, 0), month}
	}
	var totals []domain.MonthTotals
	if kind == "month_comparison" {
		totals, err = a.reader.MonthlyTotals(r.Context(), months[0], month)
		if err != nil || len(totals) != 2 {
			a.fail(w, "totais da pergunta", err)
			return
		}
	}
	for _, period := range months {
		filter := domain.TransactionFilter{Month: &period, Kind: "EXPENSE", Category: category, Limit: 20}
		movements, count, err := a.reader.Transactions(r.Context(), filter)
		if err != nil {
			a.fail(w, "evidências da pergunta", err)
			return
		}
		q := url.Values{"month": {formatMonth(period)}, "flow": {"EXPENSE"}}
		if category != "" {
			q.Set("category", domain.Category(category).Label())
		}
		link := "/transacoes?" + q.Encode()
		part := questionPeriod{Month: formatMonth(period), Count: count, Href: link, Evidence: []questionEvidence{}}
		if category != "" {
			breakdown, err := a.reader.ExpenseBreakdown(r.Context(), period, domain.BreakdownByCategory)
			if err != nil {
				a.fail(w, "categoria da pergunta", err)
				return
			}
			for _, item := range breakdown {
				if item.Key == category {
					part.Total = item.Total
				}
			}
		} else {
			for _, total := range totals {
				if formatMonth(total.Month) == part.Month {
					part.Total = total.Expense
				}
			}
		}
		for _, movement := range movements {
			part.Evidence = append(part.Evidence, questionEvidence{movement.ID.String(), movement.Description, movement.Date.Format(time.DateOnly), movement.Amount, link})
		}
		out.Periods = append(out.Periods, part)
	}
	if kind == "month_comparison" {
		if out.Periods[0].Count == 0 || out.Periods[1].Count == 0 {
			out.Status = "insufficient_data"
		} else {
			delta := (math.Round(out.Periods[1].Total*100) - math.Round(out.Periods[0].Total*100)) / 100
			out.Difference = &delta
			if out.Periods[0].Total > 0 {
				percentage := math.Round(delta/out.Periods[0].Total*10000) / 100
				out.Percent = &percentage
			}
		}
	} else if out.Periods[0].Count == 0 {
		_, count, err := a.reader.Transactions(r.Context(), domain.TransactionFilter{Month: &month, Limit: 1})
		if err != nil {
			a.fail(w, "disponibilidade da pergunta", err)
			return
		}
		out.Status = "no_matches"
		if count == 0 {
			out.Status = "no_data"
		}
	}
	writeJSON(w, http.StatusOK, out)
}
func (a *api) questionOptions(w http.ResponseWriter, r *http.Request) {
	type option struct {
		Value string `json:"value"`
		Label string `json:"label"`
	}
	out := make([]option, 0, len(categories))
	for _, category := range categories {
		out = append(out, option{string(category), category.Label()})
	}
	writeJSON(w, http.StatusOK, out)
}

func (a *api) registerQuestions(rt routes) {
	rt.mux.Handle("GET /api/questions/options", rt.protected(a.questionOptions))
	rt.mux.Handle("GET /api/questions", rt.protected(a.questions))
}
