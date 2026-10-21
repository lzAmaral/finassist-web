package httpserver

import (
	"context"
	"errors"
	"fmt"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/settings"
	"maps"
	"strconv"
	"strings"
	"time"
)

func (a *api) legacyNotificationSettings() bool {
	return a.notifications != nil && a.settings != nil && a.settings.channel() == "telegram"
}
func digestPreferenceValues(p domain.NotificationPreferences) map[string]string {
	return map[string]string{
		"DIGEST_ENABLED": strconv.FormatBool(p.Telegram && p.Types[domain.NotificationDigest]),
		"DIGEST_HOUR":    strconv.Itoa(p.Hour), "DIGEST_WEEKDAY": strings.ToLower(time.Weekday(p.Weekday).String()), "DIGEST_TIMEZONE": p.TimeZone,
	}
}
func applyDigestPreferenceValue(p *domain.NotificationPreferences, key, value string) {
	switch key {
	case "DIGEST_ENABLED":
		enabled, _ := strconv.ParseBool(value)
		p.Types[domain.NotificationDigest] = enabled
		if enabled {
			p.Telegram = true
		}
	case "DIGEST_HOUR":
		p.Hour, _ = strconv.Atoi(value)
		p.Minute = 0
	case "DIGEST_TIMEZONE":
		p.TimeZone = value
	case "DIGEST_WEEKDAY":
		for day := range 7 {
			if strings.EqualFold(time.Weekday(day).String(), value) {
				p.Weekday = day
				break
			}
		}
	}
}

// A tela React antiga usa o mesmo registro oficial do Svelte, sem gravar uma segunda agenda.
func (a *api) prepareLegacyDigest(ctx context.Context, values map[string]string) (remaining map[string]string, prefs *domain.NotificationPreferences, changed []string, err error) {
	remaining = values
	if !a.legacyNotificationSettings() {
		return
	}
	hasDigest := false
	for key := range values {
		if strings.HasPrefix(key, "DIGEST_") {
			hasDigest = true
		}
	}
	if !hasDigest {
		return
	}
	// Validar o lote antes de tocar qualquer uma das duas áreas de configurações.
	for key, value := range values {
		def, ok := settings.Lookup(key)
		if !ok || def.Internal {
			return nil, nil, nil, fmt.Errorf("%w: %s", settings.ErrUnknownKey, key)
		}
		if def.Kind == settings.KindSecret && !a.settings.Service.EncryptionEnabled() {
			return nil, nil, nil, settings.ErrNoEncryptionKey
		}
		if check := def.Check(value); check != nil {
			return nil, nil, nil, &settings.ValidationError{Err: check}
		}
	}
	p, readErr := a.notifications.Preferences(ctx)
	if readErr != nil {
		return nil, nil, nil, readErr
	}
	p.Types = maps.Clone(p.Types)
	remaining = map[string]string{}
	for key, value := range values {
		if strings.HasPrefix(key, "DIGEST_") {
			applyDigestPreferenceValue(&p, key, value)
			changed = append(changed, key)
		} else {
			remaining[key] = value
		}
	}
	if len(remaining) > 0 && len(changed) > 0 {
		return nil, nil, nil, &settings.ValidationError{Err: errors.New("salve notificações separadamente das demais configurações")}
	}
	return remaining, &p, changed, nil
}
