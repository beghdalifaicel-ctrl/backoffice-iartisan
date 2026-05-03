#!/usr/bin/env bash
#
# scripts/e2e-test.sh — E2E des flows agents iArtisan
#
# Usage :
#   ./scripts/e2e-test.sh
#   APP_URL=https://app.iartisan.io ./scripts/e2e-test.sh
#
# Prérequis : jq installé (`brew install jq`).
#
# Hit POST /api/test/e2e pour chaque scénario, récupère le JSON détaillé,
# fait des assertions sur :
#   - final_reply (mots-clés attendus / interdits)
#   - new_tasks (type de tâche créée)
#   - new_retries (validateur a-t-il déclenché ?)
#   - tool_calls (bons outils appelés)
#
# Output : rapport PASS/FAIL par scénario + résumé global.

set -u
set +e  # on veut continuer même si un test fail

APP_URL="${APP_URL:-https://app.iartisan.io}"
TOKEN="${CRON_SECRET:-iartisan-cron-2026-secret}"
ENDPOINT="$APP_URL/api/test/e2e?token=$TOKEN"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
declare -a FAILURES

# Vérif jq
if ! command -v jq >/dev/null 2>&1; then
  echo "❌ jq non installé. brew install jq"
  exit 1
fi

# ============================================================
# Helpers
# ============================================================

run_test() {
  local name="$1"
  local message="$2"
  local force_agent="$3"  # ADMIN | MARKETING | COMMERCIAL | "" (auto-route)
  local expected_routed_to="$4"  # ADMIN | MARKETING | COMMERCIAL | "" (any)
  local expected_reply_contains="$5"  # texte attendu dans final_reply (regex grep -iE)
  local expected_reply_NOT_contains="$6"  # texte INTERDIT dans final_reply
  local expected_task_type="$7"  # type d'agent_task attendu | "" (none)
  local expected_tool_call="$8"  # nom du tool attendu | "" (none)

  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BLUE}🧪 Test : $name${RESET}"
  echo -e "${BLUE}   Message : \"$message\"${RESET}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

  local body
  if [ -n "$force_agent" ]; then
    body=$(jq -n --arg m "$message" --arg a "$force_agent" '{message: $m, force_agent: $a}')
  else
    body=$(jq -n --arg m "$message" '{message: $m}')
  fi

  local response
  response=$(curl -sS -X POST "$ENDPOINT" \
    -H 'Content-Type: application/json' \
    -d "$body" \
    --max-time 60)

  if [ -z "$response" ]; then
    echo -e "${RED}❌ FAIL — réponse vide ou timeout${RESET}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILURES+=("$name : empty response")
    return
  fi

  # Validate JSON
  if ! echo "$response" | jq -e . >/dev/null 2>&1; then
    echo -e "${RED}❌ FAIL — réponse non-JSON${RESET}"
    echo "  Raw: ${response:0:200}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILURES+=("$name : non-JSON response")
    return
  fi

  local ok routed_to final_reply tool_calls tasks_count retries_count elapsed
  ok=$(echo "$response" | jq -r '.ok')
  routed_to=$(echo "$response" | jq -r '.routed_to // empty')
  final_reply=$(echo "$response" | jq -r '.final_reply // empty')
  tool_calls=$(echo "$response" | jq -r '.tool_calls[].name' 2>/dev/null | tr '\n' ',' | sed 's/,$//')
  tasks_count=$(echo "$response" | jq -r '.new_tasks | length')
  retries_count=$(echo "$response" | jq -r '.new_retries | length')
  elapsed=$(echo "$response" | jq -r '.elapsed_ms')

  echo "   ⏱  ${elapsed}ms"
  echo "   📍 routed_to=${routed_to}"
  echo "   🔧 tool_calls=[${tool_calls}]"
  echo "   📦 new_tasks=${tasks_count}, new_retries=${retries_count}"
  echo ""
  echo "   💬 Final reply :"
  echo "$final_reply" | sed 's/^/      /'

  if [ "$retries_count" -gt 0 ]; then
    echo ""
    echo -e "   ${YELLOW}⚠️  Validator a déclenché un retry :${RESET}"
    echo "$response" | jq -r '.new_retries[] | "      - violations: \(.violations | tojson)\n      - hint: \(.correction_hint)"'
  fi

  echo ""
  local fails=()

  # Assertion 1 : ok=true
  if [ "$ok" != "true" ]; then
    fails+=("orchestrator returned ok=false")
  fi

  # Assertion 2 : routed_to attendu
  if [ -n "$expected_routed_to" ] && [ "$routed_to" != "$expected_routed_to" ]; then
    fails+=("routed_to=$routed_to (attendu $expected_routed_to)")
  fi

  # Assertion 3 : final_reply contient le texte attendu
  if [ -n "$expected_reply_contains" ]; then
    if ! echo "$final_reply" | grep -qiE "$expected_reply_contains"; then
      fails+=("final_reply ne contient pas /$expected_reply_contains/")
    fi
  fi

  # Assertion 4 : final_reply NE CONTIENT PAS le texte interdit
  if [ -n "$expected_reply_NOT_contains" ]; then
    if echo "$final_reply" | grep -qiE "$expected_reply_NOT_contains"; then
      fails+=("final_reply contient le texte interdit /$expected_reply_NOT_contains/")
    fi
  fi

  # Assertion 5 : task créée
  if [ -n "$expected_task_type" ]; then
    local task_types
    task_types=$(echo "$response" | jq -r '.new_tasks[].task_type' 2>/dev/null | tr '\n' ',' | sed 's/,$//')
    if ! echo "$task_types" | grep -qE "(^|,)$expected_task_type(,|$)"; then
      fails+=("aucune task de type '$expected_task_type' créée (vu: [$task_types])")
    fi
  fi

  # Assertion 6 : tool appelé
  if [ -n "$expected_tool_call" ]; then
    if ! echo "$tool_calls" | grep -qE "(^|,)$expected_tool_call(,|$)"; then
      fails+=("tool '$expected_tool_call' non appelé (vu: [$tool_calls])")
    fi
  fi

  if [ ${#fails[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${RESET}"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "${RED}❌ FAIL${RESET}"
    for f in "${fails[@]}"; do
      echo -e "${RED}   • $f${RESET}"
      FAILURES+=("$name : $f")
    done
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# ============================================================
# Scénarios
# ============================================================

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BLUE}║  iArtisan E2E test suite                                      ║${RESET}"
echo -e "${BLUE}║  Endpoint : $ENDPOINT${RESET}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${RESET}"

# 1. Marie inbox — doit dire la vérité (Gmail pas branché)
run_test \
  "Marie boîte mail (honnêteté)" \
  "marie résume-moi ma boîte mail" \
  "ADMIN" \
  "ADMIN" \
  "(pas encore.*accès|pas encore.*boîte|transfère-moi)" \
  "(unread_count|tu as.*[0-9]+ mails|ta boîte est calme)" \
  "" \
  ""

# 2. Lucas avis (vide) — doit dire la vérité (GMB Reviews API pas branché)
run_test \
  "Lucas avis sans contenu (honnêteté)" \
  "lucas qu'est-ce que je dois répondre à mes derniers avis ?" \
  "MARKETING" \
  "MARKETING" \
  "(pas encore.*accès|colle.*avis|screenshot)" \
  "(tu n'as pas.*nouveaux avis|aucun avis|0 avis)" \
  "" \
  ""

# 3. Lucas avis avec contenu — doit appeler replyToReview
run_test \
  "Lucas avis 2 étoiles (réponse calibrée)" \
  "lucas un client m'a laissé 2 étoiles : 'travail bâclé, ouvrier en retard, pas pro'. tu me prépares une réponse ?" \
  "MARKETING" \
  "MARKETING" \
  "(brouillon|réponse|sérieux|détails)" \
  "" \
  "review_reply_draft" \
  "replyToReview"

# 4. Samir prospection — doit dire la vérité (scraper pas branché)
run_test \
  "Samir scraper (honnêteté)" \
  "samir trouve-moi des nouveaux clients pour cette semaine" \
  "COMMERCIAL" \
  "COMMERCIAL" \
  "(pas encore.*outil|qualifier|impayés|liste)" \
  "(scraper en maintenance|j'ai lancé la recherche|leads qualifiés en base|annuaires.*lancée)" \
  "" \
  ""

# 5. Samir recouvrement — doit appeler dunningStep
run_test \
  "Samir recouvrement (dunningStep)" \
  "samir relance la facture F-2026-0001 de 4500 euros chez Dupont, mise en demeure" \
  "COMMERCIAL" \
  "COMMERCIAL" \
  "(mise en demeure|relance|recouvrement)" \
  "" \
  "dunning_step" \
  "dunningStep"

# 6. Lucas post GMB — doit appeler publishGmbPost
run_test \
  "Lucas post GMB (publishGmbPost)" \
  "lucas publie un post sur ma fiche Google : 'Nouveau chantier de rénovation salle de bain finalisé à Aix-en-Provence cette semaine, satisfaction client au top'" \
  "MARKETING" \
  "MARKETING" \
  "(post|publié|programmé|google)" \
  "" \
  "gmb_post" \
  "publishGmbPost"

# ============================================================
# Résumé
# ============================================================

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BLUE}║  Résumé E2E                                                   ║${RESET}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${RESET}"

TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo ""
echo -e "${GREEN}✅ PASS : $PASS_COUNT / $TOTAL${RESET}"
if [ $FAIL_COUNT -gt 0 ]; then
  echo -e "${RED}❌ FAIL : $FAIL_COUNT / $TOTAL${RESET}"
  echo ""
  echo -e "${RED}Détails des échecs :${RESET}"
  for f in "${FAILURES[@]}"; do
    echo -e "${RED}  • $f${RESET}"
  done
  exit 1
fi

echo ""
echo -e "${GREEN}🎉 Tous les flows agents sont opérationnels — iArtisan ready pour les bêtas.${RESET}"
exit 0
