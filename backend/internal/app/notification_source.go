package app

import (
	"context"
	"crypto/sha256"
	"fmt"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/config"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain/ports"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/format"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/infra/db"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/infra/telegram"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/usecase/agenda"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/usecase/notifications"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/usecase/review"
	"time"
)

func (a *app) buildNotifications() error {
	enabled, weekday, hour, loc := a.settings.Digest()
	store := db.NewNotificationStore(a.db)
	p := domain.NotificationPreferences{Types: map[string]bool{domain.NotificationDigest: true, domain.NotificationReview: true, domain.NotificationGoals: true, domain.NotificationReminder: true}, Hour: hour, Weekday: int(weekday), TimeZone: loc.String(), Telegram: enabled && a.cfg.Channel == config.ChannelTelegram}
	if err := store.Init(a.ctx, p); err != nil {
		return fmt.Errorf("notificações indisponíveis (aplique migration 021): %w", err)
	}
	a.notifications = &notifications.Service{Store: store, Build: a.notificationSource, Messenger: &a.channel, Logger: a.logger, TelegramReady: func() bool {
		live := a.channel.live.Load()
		if live == nil || !a.channelConfigured.Load() {
			return false
		}
		_, isTelegram := live.messenger.(*telegram.Client)
		return isTelegram
	}}
	return nil
}

// notificationSource compõe leituras oficiais Go; o agendador e a prévia usam a mesma função.
func (a *app) notificationSource(ctx context.Context, today time.Time, p domain.NotificationPreferences) ([]domain.Notification, error) {
	out := []domain.Notification{}
	month := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.UTC)
	civil := time.Date(today.Year(), today.Month(), today.Day(), 12, 0, 0, 0, time.UTC)
	add := func(kind, key, title, body string) {
		sum := sha256.Sum256([]byte(kind + ":" + key))
		out = append(out, domain.Notification{Identity: fmt.Sprintf("%x", sum), Kind: kind, Title: title, Body: body})
	}
	if p.Types[domain.NotificationDigest] {
		body, err := a.insights.WeeklyDigest(ctx, civil)
		if err != nil {
			return nil, err
		}
		year, week := today.ISOWeek()
		add(domain.NotificationDigest, fmt.Sprintf("%d-W%02d", year, week), "Resumo semanal", body)
	}
	if p.Types[domain.NotificationReview] {
		rv, err := a.insights.Review(ctx, month)
		if err != nil {
			return nil, err
		}
		for _, c := range rv.Candidates {
			if c.Dismissed || (c.Kind != review.ReviewDuplicate && c.Kind != review.ReviewIncrease && c.Kind != review.ReviewNew) {
				continue
			}
			title := "Revisar gasto"
			if c.Kind == review.ReviewDuplicate {
				title = "Possível cobrança duplicada"
			}
			add(domain.NotificationReview, month.Format("2006-01")+":"+c.Kind+":"+c.Key, title, fmt.Sprintf("%s: %s no mês. Confira as evidências em Revisão; a sugestão não confirma uma cobrança indevida.", c.Label, format.FormatBRL(c.Amount)))
		}
		savings, err := a.insights.Savings(ctx, month)
		if err != nil {
			return nil, err
		}
		for _, s := range savings {
			if s.Status == review.SavingReturned {
				add(domain.NotificationReview, month.Format("2006-01")+":returned:"+s.Decision.Kind+":"+s.Decision.Key, "Cobrança voltou", fmt.Sprintf("%s teve nova cobrança de %s após a decisão de cancelamento. Confira em Revisão.", s.Decision.Label, format.FormatBRL(s.Returned)))
			}
		}
	}
	if p.Types[domain.NotificationGoals] {
		goals, _, err := a.insights.Goals(ctx, civil)
		if err != nil {
			return nil, err
		}
		for _, g := range goals {
			var body string
			switch {
			case g.Goal.Kind == domain.GoalCut && g.Current > g.Target:
				body = fmt.Sprintf("A meta %s ultrapassou o teto de %s; gasto atual %s.", g.Goal.Name, format.FormatBRL(g.Target), format.FormatBRL(g.Current))
			case g.Goal.Kind == domain.GoalCut && g.Projected != nil && *g.Projected > g.Target:
				body = fmt.Sprintf("No ritmo atual, a meta %s fecha o mês em %s, acima do teto de %s. É uma projeção.", g.Goal.Name, format.FormatBRL(*g.Projected), format.FormatBRL(g.Target))
			case g.Goal.Kind == domain.GoalSave && !g.Done && g.Fits != nil && !*g.Fits:
				body = fmt.Sprintf("Guardar %s por mês para a meta %s supera a sobra projetada. Confira as premissas em Metas.", format.FormatBRL(g.PerMonth), g.Goal.Name)
			}
			if body != "" {
				add(domain.NotificationGoals, month.Format("2006-01")+":"+g.Goal.ID.String(), "Meta precisa de atenção", body)
			}
		}
	}
	if p.Types[domain.NotificationReminder] {
		reader := db.NewDashboardReader(a.db).(ports.AgendaReader)
		payments, err := reader.AgendaPayments(ctx, month, civil.AddDate(0, 0, 7))
		if err != nil {
			return nil, err
		}
		recurring, err := reader.AgendaRecurring(ctx)
		if err != nil {
			return nil, err
		}
		// Build usa o fuso civil padrão da agenda. Meio-dia UTC preserva a data em São Paulo.
		result := agenda.Build(civil, nil, nil, payments, recurring)
		for _, c := range result.Commitments {
			if c.DueDate == nil || *c.DueDate < today.Format(time.DateOnly) || *c.DueDate > civil.AddDate(0, 0, 1).Format(time.DateOnly) {
				continue
			}
			qualifier := "Compromisso manual"
			if c.Estimated {
				qualifier = "Previsão estimada; confirme antes de pagar"
			}
			add(domain.NotificationReminder, c.ID+":"+*c.DueDate, "Lembrete de compromisso", fmt.Sprintf("%s: %s em %s. %s. A quitação não foi confirmada.", c.Description, format.FormatBRL(c.Amount), *c.DueDate, qualifier))
		}
	}
	return out, nil
}
