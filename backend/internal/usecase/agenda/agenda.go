package agenda

import (
	"math"
	"regexp"
	"sort"
	"time"
	_ "time/tzdata" // O container final não instala o banco de fusos horários do sistema.

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
)

const InvoiceUnavailable = "A fonte atual não fornece fatura identificada com valor e confirmação de quitação. Saldo devedor e compras não equivalem ao valor da fatura."

type Installment struct {
	ID            string  `json:"id"`
	Description   string  `json:"description"`
	Amount        float64 `json:"amount"`
	ReferenceDate *string `json:"referenceDate"`
	Status        string  `json:"status"`
}

type Card struct {
	ID                   string        `json:"id"`
	Name                 string        `json:"name"`
	Last4                string        `json:"last4"`
	Brand                string        `json:"brand"`
	DebtBalance          float64       `json:"debtBalance"`
	CreditLimit          *float64      `json:"creditLimit"`
	AvailableCreditLimit *float64      `json:"availableCreditLimit"`
	CloseDate            *string       `json:"closeDate"`
	DueDate              *string       `json:"dueDate"`
	CopiedAt             string        `json:"copiedAt"`
	SourceUpdatedAt      *string       `json:"sourceUpdatedAt"`
	Invoice              *Invoice      `json:"invoice"`
	Installments         []Installment `json:"installments"`
}

// Invoice não é inferida de saldo, compras ou passagem do vencimento.
type Invoice struct {
	ID              string  `json:"id"`
	Amount          float64 `json:"amount"`
	DueDate         *string `json:"dueDate"`
	PaymentStatus   string  `json:"paymentStatus"`
	PaymentEvidence *string `json:"paymentEvidence"`
}

type Commitment struct {
	ID              string  `json:"id"`
	Description     string  `json:"description"`
	Amount          float64 `json:"amount"`
	DueDate         *string `json:"dueDate"`
	Status          string  `json:"status"`
	Estimated       bool    `json:"estimated"`
	Source          string  `json:"source"`
	PaymentEvidence *string `json:"paymentEvidence"`
}

type Total struct {
	Confirmed float64 `json:"confirmed"`
	Estimated float64 `json:"estimated"`
	Count     int     `json:"count"`
}

type Result struct {
	Today                    string           `json:"today"`
	TimeZone                 string           `json:"timeZone"`
	Source                   string           `json:"source"`
	AgendaAvailable          bool             `json:"agendaAvailable"`
	UnavailableReason        *string          `json:"unavailableReason"`
	InvoiceUnavailableReason string           `json:"invoiceUnavailableReason"`
	Cards                    []Card           `json:"cards"`
	Commitments              []Commitment     `json:"commitments"`
	Totals                   map[string]Total `json:"totals"`
}

var installmentPattern = regexp.MustCompile(`\b\d{1,2}\s*/\s*\d{1,2}\b`)

// Dates contém limites civis, sem transformar um DATE do Postgres em timestamp local.
func Dates(now time.Time) (today, from, through time.Time) {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err == nil {
		now = now.In(loc)
	}
	today = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	from = time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)
	return today, from, today.AddDate(0, 0, 30)
}

func Build(now time.Time, accounts []domain.Account, institutions []domain.Institution, payments []domain.AgendaPayment, recurring []domain.AgendaRecurring) Result {
	today, from, through := Dates(now)
	r := Result{Today: today.Format(time.DateOnly), TimeZone: "America/Sao_Paulo", Source: "go-postgres", AgendaAvailable: true,
		InvoiceUnavailableReason: InvoiceUnavailable, Cards: []Card{}, Commitments: []Commitment{}, Totals: map[string]Total{
			"overdue": {}, "today": {}, "next7": {}, "next30": {}, "undated": {},
		}}
	cards := map[string]int{}
	for _, a := range accounts {
		if a.Type != domain.AccountCredit {
			continue
		}
		var updated *string
		for _, i := range institutions {
			if a.InstitutionID != nil && i.ID == *a.InstitutionID && i.SourceUpdatedAt != nil {
				v := i.SourceUpdatedAt.Format(time.RFC3339)
				updated = &v
			}
		}
		cards[a.ID.String()] = len(r.Cards)
		r.Cards = append(r.Cards, Card{ID: a.ID.String(), Name: a.Name, Last4: a.Last4, Brand: a.Brand,
			DebtBalance: a.Balance, CreditLimit: a.CreditLimit, AvailableCreditLimit: a.AvailableCreditLimit,
			CloseDate: dateString(a.CloseDate), DueDate: dateString(a.DueDate), CopiedAt: a.UpdatedAt.Format(time.RFC3339),
			SourceUpdatedAt: updated, Installments: []Installment{}})
	}
	seen := map[string]bool{}
	covered := map[string]bool{}
	for _, p := range payments {
		if seen[p.ID.String()] {
			continue
		}
		seen[p.ID.String()] = true
		month := p.ReferenceMonth
		if month == nil {
			month = p.DueDate
		}
		if month != nil {
			covered[p.PurchaseID.String()+":"+month.Format("2006-01")] = true
		}
		if p.Imported {
			if p.Status != domain.PaymentStatusCancelled && p.AccountID != nil && (p.Type == domain.PurchaseTypeInstallment || installmentPattern.MatchString(p.Description)) {
				if index, ok := cards[p.AccountID.String()]; ok {
					r.Cards[index].Installments = append(r.Cards[index].Installments, Installment{p.ID.String(), p.Description, p.Amount, dateString(p.DueDate), "RECORDED"})
				}
			}
			continue
		}
		if p.Status != domain.PaymentStatusPending {
			continue
		}
		due := dateString(p.DueDate)
		if due != nil && *due > through.Format(time.DateOnly) {
			continue
		}
		status := "PENDING"
		if due != nil && *due < r.Today {
			status = "OVERDUE"
		}
		estimated := p.Type == domain.PurchaseTypeInstallment
		source := "manual-payment"
		if estimated {
			source = "manual-installment-schedule"
		}
		r.Commitments = append(r.Commitments, Commitment{ID: p.ID.String(), Description: p.Description, Amount: p.Amount, DueDate: due,
			Status: status, Estimated: estimated, Source: source})
	}
	for _, p := range recurring {
		if p.Day < 1 || p.Day > 31 {
			continue
		}
		for month := from; !month.After(through); month = month.AddDate(0, 1, 0) {
			key := p.ID.String() + ":" + month.Format("2006-01")
			if covered[key] {
				continue
			}
			last := time.Date(month.Year(), month.Month()+1, 0, 0, 0, 0, 0, time.UTC).Day()
			due := time.Date(month.Year(), month.Month(), min(p.Day, last), 0, 0, 0, 0, time.UTC)
			if due.After(through) || due.Before(p.CreatedAt.UTC().Truncate(24*time.Hour)) {
				continue
			}
			status := "PENDING"
			if due.Before(today) {
				status = "OVERDUE"
			}
			r.Commitments = append(r.Commitments, Commitment{ID: "recurring:" + key, Description: p.Description, Amount: p.Amount,
				DueDate: dateString(&due), Status: status, Estimated: true, Source: "manual-recurring-estimate"})
		}
	}
	sort.Slice(r.Commitments, func(i, j int) bool {
		a, b := r.Commitments[i], r.Commitments[j]
		if a.DueDate == nil {
			return false
		}
		if b.DueDate == nil {
			return true
		}
		if *a.DueDate == *b.DueDate {
			return a.ID < b.ID
		}
		return *a.DueDate < *b.DueDate
	})
	for _, c := range r.Commitments {
		groups := []string{}
		switch {
		case c.DueDate == nil:
			groups = append(groups, "undated")
		case *c.DueDate < r.Today:
			groups = append(groups, "overdue")
		case *c.DueDate == r.Today:
			groups = append(groups, "today")
		default:
			groups = append(groups, "next30")
			if *c.DueDate <= today.AddDate(0, 0, 7).Format(time.DateOnly) {
				groups = append(groups, "next7")
			}
		}
		for _, group := range groups {
			t := r.Totals[group]
			t.Count++
			if c.Estimated {
				t.Estimated = addMoney(t.Estimated, c.Amount)
			} else {
				t.Confirmed = addMoney(t.Confirmed, c.Amount)
			}
			r.Totals[group] = t
		}
	}
	return r
}

func dateString(t *time.Time) *string {
	if t == nil {
		return nil
	}
	v := t.Format(time.DateOnly)
	return &v
}

func addMoney(a, b float64) float64 { return (math.Round(a*100) + math.Round(b*100)) / 100 }
