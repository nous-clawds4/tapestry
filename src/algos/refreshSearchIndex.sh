#!/bin/bash
set -o pipefail

# Refresh Meilisearch profiles + (if House PoV configured) House's WoT scores.
# Story #4 / ADR 0003.
#
# Phases:
#   1. Read House PoV from /api/grapevine/preferences (povPubkey, delegatedPubkey, nip85Relay).
#   2. Trigger profile bulk re-ingest via /api/search/profiles/meili/resync (always).
#   3. If House PoV is configured:
#        a. strfry sync House's kind 10040 (Treasure Map) — defensive, in case the
#           treasureMaps router preset is disabled.
#        b. strfry sync House's kind 30382 (Trusted Assertions) from House's NIP-85 relay.
#        c. Run loadScoresIntoMeilisearch.js with --povPubkey + --delegatedPubkey for House.
#      Otherwise: emit a WARN event with houseUnconfigured:true and exit 0 (the run
#      is a partial success — profile sync still happened).

source /etc/brainstorm.conf 2>/dev/null || true
STRUCTURED_LOG_PATH="${BRAINSTORM_MODULE_BASE_DIR:-/usr/local/lib/node_modules/brainstorm}/src/utils/structuredLogging.sh"
if [ -f "$STRUCTURED_LOG_PATH" ]; then
    source "$STRUCTURED_LOG_PATH"
else
    # Fallback no-op so the script still runs in environments without the helper.
    emit_task_event() { :; }
fi

CONTROL_PANEL_PORT="${CONTROL_PANEL_PORT:-7778}"
NIP85_DIR="${BRAINSTORM_NIP85_DIR:-${BRAINSTORM_MODULE_BASE_DIR:-/usr/local/lib/node_modules/brainstorm}/src/algos/nip85}"

emit_task_event "TASK_START" "refreshSearchIndex" "" '{"message":"Starting refreshSearchIndex","task_type":"search_index_refresh"}'

# ── Phase 1: Read House PoV from settings ─────────────────────
emit_task_event "PROGRESS" "refreshSearchIndex" "" '{"phase":"read_house_pov"}'
prefs_json=$(curl -sf -m 10 "http://127.0.0.1:${CONTROL_PANEL_PORT}/api/grapevine/preferences" 2>/dev/null || echo '{}')
pov=$(echo "$prefs_json" | jq -r '.preferences.povPubkey // empty' 2>/dev/null || echo "")
deleg=$(echo "$prefs_json" | jq -r '.preferences.delegatedPubkey // empty' 2>/dev/null || echo "")
relay=$(echo "$prefs_json" | jq -r '.preferences.nip85Relay // empty' 2>/dev/null || echo "")

# ── Phase 2: Trigger profile bulk re-ingest (always) ──────────
emit_task_event "PROGRESS" "refreshSearchIndex" "" '{"phase":"profile_resync"}'
echo "$(date): Triggering profile bulk re-ingest via /api/search/profiles/meili/resync"
curl -sf -m 30 -X POST "http://127.0.0.1:${CONTROL_PANEL_PORT}/api/search/profiles/meili/resync" \
    || echo "$(date): WARNING: profile resync returned non-zero (may be partial)"

# ── Phase 3: Conditional — if House PoV is configured ─────────
if [ -n "$pov" ] && [ -n "$deleg" ]; then
    if [ -n "$relay" ]; then
        echo "$(date): Syncing House kind 10040 (Treasure Map) for pov ${pov:0:8}... from $relay"
        emit_task_event "PROGRESS" "refreshSearchIndex" "$pov" '{"phase":"sync_house_10040"}'
        strfry sync "$relay" --filter "{\"kinds\":[10040],\"authors\":[\"$pov\"]}" --dir down \
            || echo "$(date): WARNING: strfry sync of House kind 10040 returned non-zero"

        echo "$(date): Syncing House kind 30382 (Trusted Assertions) for delegated ${deleg:0:8}... from $relay"
        emit_task_event "PROGRESS" "refreshSearchIndex" "$pov" '{"phase":"sync_house_30382"}'
        strfry sync "$relay" --filter "{\"kinds\":[30382],\"authors\":[\"$deleg\"]}" --dir down \
            || echo "$(date): WARNING: strfry sync of House kind 30382 returned non-zero"
    else
        echo "$(date): WARNING: nip85Relay not configured in Search Preferences; skipping strfry sync of House 10040+30382. Using events already in local strfry."
    fi

    echo "$(date): Loading House scores into Meilisearch"
    emit_task_event "PROGRESS" "refreshSearchIndex" "$pov" '{"phase":"load_house_scores"}'
    node "${NIP85_DIR}/loadScoresIntoMeilisearch.js" --povPubkey "$pov" --delegatedPubkey "$deleg"
    LOAD_RESULT=$?
    if [ $LOAD_RESULT -ne 0 ]; then
        emit_task_event "TASK_ERROR" "refreshSearchIndex" "$pov" '{"message":"loadScoresIntoMeilisearch.js failed","exit_code":'"$LOAD_RESULT"'}'
        exit 1
    fi
else
    echo "$(date): WARN: House PoV is not configured (povPubkey or delegatedPubkey is empty). Skipping score-load step. Profile resync was triggered."
    emit_task_event "WARN" "refreshSearchIndex" "" '{
        "message":"House PoV not configured; skipping score-load step. Profile sync still completed.",
        "houseUnconfigured":true,
        "povPubkey":"'"$pov"'",
        "delegatedPubkey":"'"$deleg"'"
    }'
fi

emit_task_event "TASK_END" "refreshSearchIndex" "" '{"message":"refreshSearchIndex completed","status":"success"}'
echo "$(date): refreshSearchIndex completed successfully"
exit 0
