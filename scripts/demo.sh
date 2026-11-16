#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ "$(node --version)" != "v$(cat .nvmrc)" ]]; then
  echo "Use Node.js $(cat .nvmrc), conforme .nvmrc." >&2
  exit 1
fi
if [[ "$(pnpm --version)" != "11.25.0" ]]; then
  echo "Use pnpm 11.25.0, conforme package.json." >&2
  exit 1
fi
if [[ $# -gt 1 || ( $# -eq 1 && "$1" != "--prepare-only" ) ]]; then
  echo "Uso: pnpm demo [--prepare-only]" >&2
  exit 1
fi

# Um seed novo por execução. Não lê nem sobrescreve o .env ou dados reais.
demo_dir=$(mktemp -d "${TMPDIR:-/tmp}/labrary-demo.XXXXXXXX")
chmod 700 "$demo_dir"
{
  printf 'export AUTH_DEMO=true\nexport AUTH_PROVIDER=local\nexport AUTH_USERS_FILE=\nexport NODE_ENV=development\n'
  printf 'export APP_ORIGIN=http://localhost:5173\nexport API_PORT=3000\nexport WEB_PORT=5173\n'
  printf 'export PROJECT_DATA_FILE=%q\n' "$demo_dir/projects.json"
  printf 'export GROUP_DATA_FILE=%q\n' "$demo_dir/groups.json"
  printf 'export RUBRIC_DATA_FILE=%q\n' "$demo_dir/rubrics.json"
  printf 'export RESULT_RELEASE_DATA_FILE=%q\n' "$demo_dir/results.json"
  printf 'export UPLOAD_DIR=%q\n' "$demo_dir/uploads"
} > "$demo_dir/environment.sh"
chmod 600 "$demo_dir/environment.sh"
printf 'Ambiente de demonstração preparado em %s\n' "$demo_dir"
printf 'Para reutilizar: source %q && pnpm dev\n' "$demo_dir/environment.sh"
if [[ "${1:-}" == "--prepare-only" ]]; then exit 0; fi
source "$demo_dir/environment.sh"
exec pnpm dev
