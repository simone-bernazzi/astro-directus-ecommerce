#!/bin/bash
# complete-relations.sh — completa relazioni M2O/M2M, nascondi menu, ruolo Staff
# Il MCP Directus non può scrivere su core collections (directus_relations,
# directus_collections), quindi questo script chiude ciò che il MCP non può fare.
#
# Uso: npm run setup:relations  (carica .env automaticamente)
# Oppure: source .env && bash scripts/complete-relations.sh

set -euo pipefail

# Carica .env dalla root del progetto se le variabili non sono già nell'ambiente
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" && -z "${DIRECTUS_URL:-}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

BASE_URL="${DIRECTUS_URL:?DIRECTUS_URL non impostato nel .env}"
TOKEN="${DIRECTUS_TOKEN:?DIRECTUS_TOKEN non impostato nel .env}"

H_AUTH="Authorization: Bearer $TOKEN"
H_JSON="Content-Type: application/json"

ok()   { echo "  ✅ $*"; }
skip() { echo "  ⏭️  $* (già presente)"; }
err()  { echo "  ⚠️  $*"; }

post() {
  local url="$1" data="$2" label="${3:-$1}"
  local tmpfile code resp
  tmpfile=$(mktemp)
  code=$(curl -s -o "$tmpfile" -w "%{http_code}" -X POST "$BASE_URL/$url" \
    -H "$H_AUTH" -H "$H_JSON" -d "$data")
  resp=$(cat "$tmpfile"); rm -f "$tmpfile"
  if [[ "$code" =~ ^2 ]]; then
    ok "$label"
  elif [[ "$code" == "400" ]] && echo "$resp" | grep -qiE "already exist|already has|duplicate entry|field.*relationship"; then
    skip "$label"
  else
    err "$label (HTTP $code)"
  fi
}

patch() {
  local url="$1" data="$2"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE_URL/$url" \
    -H "$H_AUTH" -H "$H_JSON" -d "$data")
  [[ "$code" =~ ^2 ]] && ok "$url" || err "$url (HTTP $code)"
}

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Directus — Complete Relations & Permissions"
echo "  BASE_URL: $BASE_URL"
echo "═══════════════════════════════════════════════════"

# ── 1. Relazioni M2O ─────────────────────────────────────────────────────────
echo ""
echo "── Relazioni M2O ──"

declare -a RELATIONS=(
  'contacts|user_id|directus_users'
  'crm_interactions|contact_id|contacts'
  'crm_tasks|contact_id|contacts'
  'crm_documents|contact_id|contacts'
  'crm_pipeline_history|contact_id|contacts'
  'customer_kpis|contact_id|contacts'
  'orders|contact_id|contacts'
  'form_submissions|form_id|forms'
)

for rel in "${RELATIONS[@]}"; do
  IFS='|' read -r col field related <<< "$rel"
  post "relations" \
    "{\"collection\":\"$col\",\"field\":\"$field\",\"related_collection\":\"$related\"}"
done

# ── 2. M2M contacts ↔ crm_tags ───────────────────────────────────────────────
echo ""
echo "── M2M contacts ↔ crm_tags ──"

# Junction table
post "collections" \
  '{"collection":"contacts_crm_tags","meta":{"hidden":true},"schema":{}}'

post "fields/contacts_crm_tags" \
  '{"field":"id","type":"integer","schema":{"is_primary_key":true,"has_auto_increment":true},"meta":{"hidden":true}}'

post "fields/contacts_crm_tags" \
  '{"field":"contact_id","type":"integer","schema":{},"meta":{"hidden":true}}'

post "fields/contacts_crm_tags" \
  '{"field":"tag_id","type":"integer","schema":{},"meta":{"hidden":true}}'

post "relations" \
  '{"collection":"contacts_crm_tags","field":"contact_id","related_collection":"contacts"}'

post "relations" \
  '{"collection":"contacts_crm_tags","field":"tag_id","related_collection":"crm_tags"}'

# Alias field on contacts
post "fields/contacts" \
  '{"field":"tags","type":"alias","meta":{"interface":"list-m2m","special":["m2m"],"options":{"template":"{{name}}"},"display":"related-values","display_options":{"template":"{{name}}"}}}'

post "relations" \
  '{"collection":"contacts","field":"tags","related_collection":"crm_tags","meta":{"junction_field":"tag_id","one_collection_field":null,"sort_field":null}}'

# ── 3. Nascondi sub-collezioni CRM dal menu ───────────────────────────────────
echo ""
echo "── Nascondi CRM sub-collezioni dal menu ──"

for col in crm_interactions crm_tasks crm_documents crm_pipeline_history customer_kpis; do
  patch "collections/$col" '{"meta":{"hidden":true}}'
done

# ── 4. Ruolo Staff + permessi ─────────────────────────────────────────────────
echo ""
echo "── Ruolo Staff ──"

ROLE_RESPONSE=$(curl -s -X POST "$BASE_URL/roles" \
  -H "$H_AUTH" -H "$H_JSON" \
  -d '{"name":"Staff","icon":"people_alt","description":"Operatori negozio"}')

ROLE_ID=$(echo "$ROLE_RESPONSE" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',''))" 2>/dev/null || true)

if [[ -z "$ROLE_ID" ]]; then
  err "Ruolo Staff non creato (esiste già?). Recupero ID esistente..."
  ROLE_ID=$(curl -s "$BASE_URL/roles?filter[name][_eq]=Staff" \
    -H "$H_AUTH" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); print(d.get('data',[{}])[0].get('id',''))" 2>/dev/null || true)
fi

if [[ -n "$ROLE_ID" ]]; then
  ok "Ruolo Staff: $ROLE_ID"

  echo ""
  echo "── Permessi Staff ──"

  for col in contacts crm_interactions crm_tasks crm_documents crm_pipeline_history; do
    for action in create read update delete; do
      post "permissions" \
        "{\"role\":\"$ROLE_ID\",\"collection\":\"$col\",\"action\":\"$action\"}"
    done
  done

  for col in customer_kpis orders; do
    post "permissions" \
      "{\"role\":\"$ROLE_ID\",\"collection\":\"$col\",\"action\":\"read\"}"
  done
else
  err "Impossibile recuperare l'ID del ruolo Staff. Crea i permessi manualmente."
fi

echo ""
echo "═══════════════════════════════════════════════════"
echo "  ✅ Completato."
echo "  Verifica in Settings → Data Model che le relazioni"
echo "  M2O siano visibili con Related Collection corretta."
echo "═══════════════════════════════════════════════════"
echo ""
