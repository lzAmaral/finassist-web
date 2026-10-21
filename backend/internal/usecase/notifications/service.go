// Package notifications agenda e registra avisos sem depender de uma sessão web.
package notifications

import (
	"context"
	"errors"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain/ports"
	"log/slog"
	"regexp"
	"sync/atomic"
	"time"
	_ "time/tzdata"
)

var moneyPattern = regexp.MustCompile(`R\$\s*-?[\d.,]+`)

func HideAmounts(body string) string {
	return moneyPattern.ReplaceAllString(body, "R$ ••••••")
}

func Validate(p domain.NotificationPreferences) error {
	if p.Hour < 0 || p.Hour > 23 || p.Minute < 0 || p.Minute > 59 || p.Weekday < 0 || p.Weekday > 6 {
		return errors.New("horário ou dia inválido")
	}
	if _, err := time.LoadLocation(p.TimeZone); err != nil || p.TimeZone == "" {
		return errors.New("fuso horário inválido")
	}
	if len(p.Types) != len(domain.NotificationTypes) {
		return errors.New("informe todos os tipos de notificação")
	}
	for _, kind := range domain.NotificationTypes {
		if _, ok := p.Types[kind]; !ok {
			return errors.New("tipo de notificação inválido")
		}
	}
	return nil
}

type Builder func(context.Context, time.Time, domain.NotificationPreferences) ([]domain.Notification, error)
type Service struct {
	Store         ports.NotificationStore
	Build         Builder
	Messenger     ports.Messenger
	TelegramReady func() bool
	Logger        *slog.Logger
	running       atomic.Bool
}

func (s *Service) Preferences(ctx context.Context) (domain.NotificationPreferences, error) {
	return s.Store.Preferences(ctx)
}
func (s *Service) Save(ctx context.Context, p domain.NotificationPreferences) error {
	if err := Validate(p); err != nil {
		return err
	}
	return s.Store.SavePreferences(ctx, p)
}
func (s *Service) Preview(ctx context.Context, now time.Time, p domain.NotificationPreferences) ([]domain.Notification, error) {
	if err := Validate(p); err != nil {
		return nil, err
	}
	loc, _ := time.LoadLocation(p.TimeZone)
	items, err := s.Build(ctx, now.In(loc), p)
	if err != nil {
		return nil, err
	}
	for i := range items {
		items[i].ID = ""
		if p.HideAmounts {
			items[i].Body = HideAmounts(items[i].Body)
		}
	}
	return items, nil
}
func (s *Service) List(ctx context.Context) ([]domain.Notification, error) {
	p, err := s.Preferences(ctx)
	if err != nil {
		return nil, err
	}
	items, err := s.Store.List(ctx)
	if p.HideAmounts {
		for i := range items {
			items[i].Body = HideAmounts(items[i].Body)
		}
	}
	return items, err
}

// Tick recupera o horário perdido no mesmo dia; não despeja semanas antigas ao reiniciar.
func (s *Service) Tick(ctx context.Context, now time.Time) error {
	p, err := s.Preferences(ctx)
	if err != nil {
		return err
	}
	loc, _ := time.LoadLocation(p.TimeZone)
	if loc == nil {
		return errors.New("fuso horário inválido")
	}
	local := now.In(loc)
	if local.Hour()*60+local.Minute() >= p.Hour*60+p.Minute {
		items, err := s.Build(ctx, local, p)
		if err != nil {
			// Pendências já persistidas não dependem de uma nova consulta financeira bem-sucedida.
			return errors.Join(err, s.deliver(ctx, now))
		}
		for _, item := range items {
			if !p.Types[item.Kind] || (item.Kind == domain.NotificationDigest && int(local.Weekday()) != p.Weekday) {
				continue
			}
			item.CreatedAt = now
			if p.HideAmounts {
				item.Body = HideAmounts(item.Body)
			}
			if err := s.Store.Insert(ctx, item, p.Telegram); err != nil {
				return err
			}
		}
	}
	return s.deliver(ctx, now)
}
func (s *Service) deliver(ctx context.Context, now time.Time) error {
	if s.Messenger == nil || s.TelegramReady == nil || !s.TelegramReady() {
		return nil
	}
	for range 25 {
		item, err := s.Store.Claim(ctx, now)
		if err != nil {
			return err
		}
		if item == nil {
			return nil
		}
		p, err := s.Preferences(ctx)
		if err != nil {
			return err
		}
		if !p.Telegram || !p.Types[item.Kind] {
			if err = s.Store.Finish(ctx, item.ID, "cancelled", "", now); err != nil {
				return err
			}
			continue
		}
		text := item.Title + "\n\n" + item.Body
		if p.HideAmounts {
			text = HideAmounts(text)
		}
		sendCtx, cancel := context.WithTimeout(ctx, 20*time.Second)
		_, err = s.Messenger.SendText(sendCtx, "", text)
		cancel()
		status, code, next := "sent", "", now
		if err != nil {
			// Só uma recusa confirmada permite retentar. Timeout/resposta perdida pode ter enviado.
			var rejected interface{ DeliveryRejected() bool }
			safeRetry := errors.Is(err, ports.ErrNoChannel) || (errors.As(err, &rejected) && rejected.DeliveryRejected())
			status, code = "failed", "delivery_uncertain"
			if safeRetry {
				status, code = "retry", "delivery_failed"
				next = now.Add(time.Duration(item.Attempts) * 5 * time.Minute)
				if item.Attempts >= 3 {
					status = "failed"
				}
			}
		}
		// Nunca registrar texto nem o erro do transporte, que pode incluir dados do pedido.
		if err = s.Store.Finish(ctx, item.ID, status, code, next); err != nil {
			return err
		}
	}
	return nil
}
func (s *Service) Running() bool { return s.running.Load() }
func (s *Service) Run(ctx context.Context) {
	s.running.Store(true)
	defer s.running.Store(false)
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		if err := s.Tick(ctx, time.Now()); err != nil && ctx.Err() == nil {
			s.Logger.Error("falha no agendador de notificações")
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
