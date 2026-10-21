package httpserver

import (
	"context"
	"io"
	"log/slog"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/MarcosAAlbanoJunior/go-financial-assistant/internal/infra/db"
	"github.com/google/uuid"
)

// TEST_DATABASE_URL deve apontar exclusivamente para o banco descartável documentado.
func TestWebGoalsPostgresRoundTrip(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL não configurada; exige PostgreSQL descartável")
	}
	if _, err := exec.LookPath("node"); err != nil {
		t.Skip("node não disponível para a ponte Svelte")
	}
	ctx := context.Background()
	connection, err := db.NewPostgres(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer connection.Close()
	server := NewServer(0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err := server.MountAPI(StaticPassword("senha-sintetica-fa02"), db.NewDashboardReader(connection)); err != nil {
		t.Fatal(err)
	}
	api := httptest.NewServer(server.http.Handler)
	defer api.Close()
	script, err := filepath.Abs("../../../../web/tests/fixtures/go-goals-bridge.mjs")
	if err != nil {
		t.Fatal(err)
	}
	command := exec.CommandContext(ctx, "node", "--experimental-strip-types", script)
	command.Env = append(os.Environ(), "FA02_BACKEND_URL="+api.URL)
	output, err := command.Output()
	if err != nil {
		if failure, ok := err.(*exec.ExitError); ok {
			t.Fatalf("ponte Svelte: %s", failure.Stderr)
		}
		t.Fatal(err)
	}
	id, err := uuid.Parse(strings.TrimSpace(string(output)))
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if _, err := connection.Pool.Exec(ctx, "DELETE FROM goals WHERE id = $1", id); err != nil {
			t.Error(err)
		}
	}()
	// Uma nova conexão comprova persistência, não estado no cliente/proxy.
	reopened, err := db.NewPostgres(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	var name string
	var amount float64
	if err := reopened.Pool.QueryRow(ctx, "SELECT name, target_amount FROM goals WHERE id = $1", id).Scan(&name, &amount); err != nil {
		t.Fatal(err)
	}
	if name != "Prova Svelte PostgreSQL" || amount != 1234.56 {
		t.Fatalf("meta persistida incorreta: %q %.2f", name, amount)
	}
}
