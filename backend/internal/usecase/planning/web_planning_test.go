package planning

import (
	"testing"
	"time"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
)

func TestWebPlanningSimultaneousGoalsShareWealth(t *testing.T) {
	save := domain.Goal{Kind: domain.GoalSave, TargetAmount: 10000, TargetDate: month(2027, time.January)}
	reserve := domain.Goal{Kind: domain.GoalReserve, ReserveMonths: 6}
	p := goalProjection()
	first := BuildGoalProgress(save, 7000, p, nil, goalNow)
	second := BuildGoalProgress(reserve, 7000, p, nil, goalNow)
	if first.Current != 7000 || second.Current != 7000 || first.PerMonth != 1000 || second.Coverage != 3.5 {
		t.Fatalf("metas comparam o mesmo patrimônio, sem reservar valores separadamente: juntar=%+v reserva=%+v", first, second)
	}
}

func TestWebPlanningNoIncomeAndPartialHistory(t *testing.T) {
	start := month(2026, time.October)
	rows := []domain.ExpenseKeyMonth{{Key: "mercado", Label: "Mercado", Month: month(2026, time.September), Total: 500, Count: 5}}
	p := BuildProjection(rows, nil, nil, nil, start, 6)
	if p.Assumptions.BasedOn != 1 || p.Assumptions.Income != 0 || p.Assumptions.Variable != 500 {
		t.Fatalf("histórico parcial sem receita mantém zero real, sem inventar renda: %+v", p.Assumptions)
	}
	g := domain.Goal{Kind: domain.GoalSave, TargetAmount: 1000, TargetDate: month(2027, time.January)}
	progress := BuildGoalProgress(g, 0, p, nil, start)
	if progress.Surplus == nil || *progress.Surplus != -500 || progress.Fits == nil || *progress.Fits {
		t.Fatalf("sem receita a sobra é negativa, não ausente: %+v", progress)
	}
	empty := BuildProjection(nil, nil, nil, nil, start, 6)
	progress = BuildGoalProgress(g, 0, empty, nil, start)
	if progress.Surplus != nil || progress.Fits != nil {
		t.Fatalf("sem histórico não existe estimativa de sobra: %+v", progress)
	}
}
