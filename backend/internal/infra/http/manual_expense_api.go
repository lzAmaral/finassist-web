package httpserver

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain/ports"
)

func (a *api) manualExpense(w http.ResponseWriter, r *http.Request) {
	var body domain.ManualExpense
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		writeError(w, 400, "corpo inválido")
		return
	}
	if err := dec.Decode(new(any)); err != io.EOF {
		writeError(w, 400, "envie um único objeto JSON")
		return
	}
	if err := body.Normalize(a.now()); err != nil {
		writeError(w, 400, domain.ErrManualExpenseInvalid.Error())
		return
	}
	store, ok := a.reader.(ports.ManualExpenseStore)
	if !ok {
		writeError(w, 503, "lançamento manual requer o backend Go com persistência")
		return
	}
	result, err := store.SaveManualExpense(r.Context(), body)
	if err != nil {
		switch {
		case errors.Is(err, domain.ErrManualExpenseInvalid), errors.Is(err, domain.ErrManualExpenseAccount):
			writeError(w, 400, err.Error())
		case errors.Is(err, domain.ErrManualExpenseConflict):
			writeError(w, 409, domain.ErrManualExpenseConflict.Error())
		default:
			a.fail(w, "lançamento manual", err)
		}
		return
	}
	status := http.StatusCreated
	if result.Replayed {
		status = http.StatusOK
	}
	writeJSON(w, status, result)
}
