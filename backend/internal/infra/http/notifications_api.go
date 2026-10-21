package httpserver

import (
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/usecase/notifications"
	"github.com/google/uuid"
	"net/http"
)

// SetNotifications liga o serviço persistente antes de MountAPI.
func (s *Server) SetNotifications(service *notifications.Service) { s.notifications = service }
func (a *api) registerNotifications(rt routes) {
	rt.mux.Handle("GET /api/notifications", rt.protected(a.notificationsList))
	rt.mux.Handle("PUT /api/notifications/preferences", rt.protected(jsonOnly(a.notificationsPreferences)))
	rt.mux.Handle("POST /api/notifications/preview", rt.protected(jsonOnly(a.notificationsPreview)))
	rt.mux.Handle("POST /api/notifications/{id}/{action}", rt.protected(jsonOnly(a.notificationsMark)))
}
func (a *api) notificationsAvailable(w http.ResponseWriter) bool {
	if a.notifications == nil {
		writeError(w, http.StatusServiceUnavailable, "notificações indisponíveis neste backend")
		return false
	}
	return true
}
func (a *api) notificationsList(w http.ResponseWriter, r *http.Request) {
	if !a.notificationsAvailable(w) {
		return
	}
	p, err := a.notifications.Preferences(r.Context())
	if err != nil {
		a.fail(w, "preferências de notificações", err)
		return
	}
	items, err := a.notifications.List(r.Context())
	if err != nil {
		a.fail(w, "notificações", err)
		return
	}
	ready := a.notifications.TelegramReady != nil && a.notifications.TelegramReady()
	writeJSON(w, http.StatusOK, map[string]any{"preferences": p, "notifications": items, "telegramReady": ready, "schedulerRunning": a.notifications.Running()})
}
func (a *api) notificationPreferencesBody(w http.ResponseWriter, r *http.Request) (domain.NotificationPreferences, bool) {
	var p domain.NotificationPreferences
	if !decodeJSONStrict(w, r, 4096, &p) {
		return p, false
	}
	if err := notifications.Validate(p); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return p, false
	}
	return p, true
}
func (a *api) notificationsPreferences(w http.ResponseWriter, r *http.Request) {
	if !a.notificationsAvailable(w) {
		return
	}
	p, ok := a.notificationPreferencesBody(w, r)
	if !ok {
		return
	}
	if err := a.notifications.Save(r.Context(), p); err != nil {
		a.fail(w, "salvar notificações", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
func (a *api) notificationsPreview(w http.ResponseWriter, r *http.Request) {
	if !a.notificationsAvailable(w) {
		return
	}
	p, ok := a.notificationPreferencesBody(w, r)
	if !ok {
		return
	}
	items, err := a.notifications.Preview(r.Context(), a.now(), p)
	if err != nil {
		a.fail(w, "prévia das notificações", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"notifications": items})
}
func (a *api) notificationsMark(w http.ResponseWriter, r *http.Request) {
	if !a.notificationsAvailable(w) {
		return
	}
	id, err := uuid.Parse(r.PathValue("id"))
	action := r.PathValue("action")
	if err != nil || (action != "read" && action != "dismiss") {
		writeError(w, http.StatusBadRequest, "notificação ou ação inválida")
		return
	}
	found, err := a.notifications.Store.Mark(r.Context(), id.String(), action == "dismiss")
	if err != nil {
		a.fail(w, "atualizar notificação", err)
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "notificação não encontrada")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
