#!/usr/bin/env bash
# Launch Claude Code with .env variables exported so .mcp.json ${VAR} interpolation works.
# Usage:  bash scripts/claude.sh        (oppure: npm run claude)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENV_FILE="$PROJECT_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Errore: $ENV_FILE non trovato."
  echo "Crea il file .env partendo da .env.example prima di avviare Claude Code."
  exit 1
fi

# Export all non-comment, non-empty lines from .env
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

exec claude "$@"
