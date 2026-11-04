#!/bin/sh
# Use uma conexão direta do Neon em PGDATABASE, sem gravá-la no histórico do shell.
set -eu

: "${PGDATABASE:?defina PGDATABASE com a URL direta do banco de destino}"
command -v psql >/dev/null 2>&1 || {
  echo "instale o cliente psql antes de aplicar as migrations" >&2
  exit 1
}
repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

# -X ignora configurações locais; cada arquivo é atômico e falhas interrompem o lote.
# Não imprime a conexão nem habilita shell tracing: a URL contém a senha.
for migration in "$repo_dir"/backend/migrations/*.sql; do
  printf 'Aplicando %s\n' "$(basename -- "$migration")"
  psql --dbname="$PGDATABASE" -X --no-password --quiet --set=ON_ERROR_STOP=1 --single-transaction --file="$migration"
done
