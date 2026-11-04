package planning

import "github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"

type CategoryBudgetProgress struct {
	domain.CategoryBudget
	SpentCents     int64    `json:"spentCents"`
	RemainingCents *int64   `json:"remainingCents"`
	UsagePercent   *float64 `json:"usagePercent"`
	Status         string   `json:"status"`
}

func BuildCategoryBudget(b domain.CategoryBudget) CategoryBudgetProgress {
	b.Label = b.Category.Label()
	p := CategoryBudgetProgress{CategoryBudget: b, SpentCents: b.PaidCents + b.PendingCents, Status: "no-limit"}
	if b.LimitCents == nil {
		return p
	}
	remaining := *b.LimitCents - p.SpentCents
	p.RemainingCents = &remaining
	if *b.LimitCents > 0 {
		usage := float64(p.SpentCents) * 100 / float64(*b.LimitCents)
		p.UsagePercent = &usage
	}
	switch {
	case b.Count == 0:
		p.Status = "no-records"
	case remaining < 0:
		p.Status = "exceeded"
	case remaining == 0:
		p.Status = "at-limit"
	default:
		p.Status = "within-limit"
	}
	return p
}
