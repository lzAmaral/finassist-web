package httpserver

import (
	"errors"
	"math"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/domain/ports"
	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/usecase/statementimport"
	"github.com/google/uuid"
)

func (a *api) statementStore(w http.ResponseWriter) ports.StatementImportStore {
	store, ok := a.reader.(ports.StatementImportStore)
	if !ok {
		writeError(w, 503, "importação requer o backend Go com persistência")
		return nil
	}
	return store
}
func (a *api) statementFailure(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrStatementInvalid):
		writeError(w, 400, err.Error())
	case errors.Is(err, domain.ErrStatementNotFound):
		writeError(w, 404, err.Error())
	case errors.Is(err, domain.ErrStatementConflict):
		writeError(w, 409, err.Error())
	default:
		a.fail(w, "importação de extrato", err)
	}
}
func (a *api) registerImports(rt routes) {
	rt.mux.Handle("POST /api/imports/accounts", rt.protected(jsonOnly(a.createStatementAccount)))
	rt.mux.Handle("GET /api/imports", rt.protected(a.listStatements))
	rt.mux.Handle("GET /api/imports/{id}", rt.protected(a.getStatement))
	rt.mux.Handle("POST /api/imports/preview", rt.protected(jsonOnly(a.previewStatement)))
	rt.mux.Handle("POST /api/imports/{id}/confirm", rt.protected(jsonOnly(a.confirmStatement)))
	rt.mux.Handle("POST /api/imports/{id}/revert", rt.protected(jsonOnly(a.revertStatement)))
}
func (a *api) listStatements(w http.ResponseWriter, r *http.Request) {
	store := a.statementStore(w)
	if store == nil {
		return
	}
	batches, err := store.StatementBatches(r.Context())
	if err != nil {
		a.statementFailure(w, err)
		return
	}
	accounts, err := a.reader.Accounts(r.Context())
	if err != nil {
		a.statementFailure(w, err)
		return
	}
	type option struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	opts := []option{}
	for _, acc := range accounts {
		if acc.Type == domain.AccountBank {
			opts = append(opts, option{acc.ID.String(), acc.Name})
		}
	}
	writeJSON(w, 200, map[string]any{"accounts": opts, "batches": batches})
}
func (a *api) previewStatement(w http.ResponseWriter, r *http.Request) {
	var body struct {
		AccountID string                  `json:"accountId"`
		Filename  string                  `json:"filename"`
		Content   string                  `json:"content"`
		Format    string                  `json:"format"`
		Mapping   domain.StatementMapping `json:"mapping"`
	}
	if !decodeJSONStrict(w, r, 4<<20, &body) {
		return
	}
	if _, err := uuid.Parse(body.AccountID); err != nil || strings.TrimSpace(body.Filename) == "" || utf8.RuneCountInString(body.Filename) > 200 {
		writeError(w, 400, "conta ou nome de arquivo inválido")
		return
	}
	batch, err := statementimport.Parse(body.AccountID, body.Filename, body.Content, body.Format, body.Mapping)
	if err != nil {
		a.statementFailure(w, err)
		return
	}
	store := a.statementStore(w)
	if store == nil {
		return
	}
	batch, err = store.PreviewStatement(r.Context(), batch)
	if err != nil {
		a.statementFailure(w, err)
		return
	}
	writeJSON(w, 200, batch)
}
func statementID(w http.ResponseWriter, r *http.Request) string {
	id := r.PathValue("id")
	if _, err := uuid.Parse(id); err != nil {
		writeError(w, 400, "id inválido")
		return ""
	}
	return id
}
func (a *api) getStatement(w http.ResponseWriter, r *http.Request) {
	id := statementID(w, r)
	if id == "" {
		return
	}
	store := a.statementStore(w)
	if store == nil {
		return
	}
	b, err := store.StatementBatch(r.Context(), id)
	if err != nil {
		a.statementFailure(w, err)
		return
	}
	writeJSON(w, 200, b)
}
func (a *api) confirmStatement(w http.ResponseWriter, r *http.Request) {
	id := statementID(w, r)
	if id == "" {
		return
	}
	var body struct {
		Decisions []domain.StatementDecision `json:"decisions"`
	}
	if !decodeJSONStrict(w, r, 1<<20, &body) {
		return
	}
	if len(body.Decisions) > statementimport.MaxRows {
		writeError(w, 400, "limite de linhas excedido")
		return
	}
	store := a.statementStore(w)
	if store == nil {
		return
	}
	b, err := store.ConfirmStatement(r.Context(), id, body.Decisions)
	if err != nil {
		a.statementFailure(w, err)
		return
	}
	writeJSON(w, 200, b)
}
func (a *api) revertStatement(w http.ResponseWriter, r *http.Request) {
	id := statementID(w, r)
	if id == "" {
		return
	}
	store := a.statementStore(w)
	if store == nil {
		return
	}
	b, err := store.RevertStatement(r.Context(), id)
	if err != nil {
		a.statementFailure(w, err)
		return
	}
	writeJSON(w, 200, b)
}

func (a *api) createStatementAccount(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name    string   `json:"name"`
		Balance *float64 `json:"balance"`
	}
	if !decodeJSONStrict(w, r, 4096, &body) {
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	if body.Name == "" || utf8.RuneCountInString(body.Name) > 100 || body.Balance == nil || math.IsNaN(*body.Balance) || math.IsInf(*body.Balance, 0) || math.Abs(*body.Balance) > 1e9 || math.Abs(*body.Balance*100-math.Round(*body.Balance*100)) > 0.0001 {
		writeError(w, 400, "nome ou saldo informado inválido")
		return
	}
	store := a.statementStore(w)
	if store == nil {
		return
	}
	id, err := store.CreateStatementAccount(r.Context(), body.Name, *body.Balance)
	if err != nil {
		a.statementFailure(w, err)
		return
	}
	writeJSON(w, 201, map[string]string{"id": id})
}
