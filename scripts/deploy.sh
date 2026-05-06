#!/usr/bin/env bash
# Deploy frontend to VPS: build → rsync → npm install --production → pm2 restart
# Usage:  npm run deploy        (oppure: bash scripts/deploy.sh)
# Config: DEPLOY_HOST, DEPLOY_USER, DEPLOY_PATH, DEPLOY_PM2_APP nel .env

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load .env
ENV_FILE="$PROJECT_ROOT/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Errore: $ENV_FILE non trovato."
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Required vars
DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/frontend}"
DEPLOY_PM2_APP="${DEPLOY_PM2_APP:-frontend}"

if [ -z "$DEPLOY_HOST" ]; then
  echo "Errore: DEPLOY_HOST non impostato nel .env"
  echo "Aggiungi: DEPLOY_HOST=ip_o_hostname_del_server"
  exit 1
fi

REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

echo ""
echo "▸ Build in locale..."
cd "$PROJECT_ROOT"
npm run build

echo ""
echo "▸ rsync dist/ → ${REMOTE}:${DEPLOY_PATH}/dist/"
rsync -avz --delete dist/ "${REMOTE}:${DEPLOY_PATH}/dist/"

echo ""
echo "▸ rsync package.json + package-lock.json + ecosystem.config.cjs..."
rsync -avz package.json package-lock.json ecosystem.config.cjs "${REMOTE}:${DEPLOY_PATH}/"

echo ""
echo "▸ npm install --production + pm2 restart sul server..."
# shellcheck disable=SC2029
ssh "$REMOTE" "
  source ~/.nvm/nvm.sh
  nvm use 22
  cd ${DEPLOY_PATH}
  npm install --production --silent
  pm2 startOrRestart ecosystem.config.cjs --update-env
  pm2 save
"

echo ""
echo "✓ Deploy completato → ${DEPLOY_PM2_APP} riavviato su ${REMOTE}"
