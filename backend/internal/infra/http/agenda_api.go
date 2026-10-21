package httpserver

import (
	"net/http"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain/ports"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/usecase/agenda"
)

func (a *api) agenda(w http.ResponseWriter, r *http.Request) {
	reader, ok := a.reader.(ports.AgendaReader)
	if !ok {
		writeJSON(w, http.StatusNotImplemented, map[string]string{"error": "agenda indisponível nesta versão do backend"})
		return
	}
	accounts, err := a.reader.Accounts(r.Context())
	if err != nil {
		a.fail(w, "cartões da agenda", err)
		return
	}
	institutions, err := a.reader.Institutions(r.Context())
	if err != nil {
		a.fail(w, "origem dos cartões", err)
		return
	}
	now := a.now()
	_, from, through := agenda.Dates(now)
	payments, err := reader.AgendaPayments(r.Context(), from, through)
	if err != nil {
		a.fail(w, "pagamentos da agenda", err)
		return
	}
	recurring, err := reader.AgendaRecurring(r.Context())
	if err != nil {
		a.fail(w, "recorrências da agenda", err)
		return
	}
	writeJSON(w, http.StatusOK, agenda.Build(now, accounts, institutions, payments, recurring))
}

func (a *api) registerAgenda(rt routes) { rt.mux.Handle("GET /api/agenda", rt.protected(a.agenda)) }
