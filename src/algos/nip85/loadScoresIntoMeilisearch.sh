#!/bin/bash
set -e
set -o pipefail

# Load owner's kind 30382 Trusted Assertions into Meilisearch.
# Phase 1: Sync 30382 events from NIP-85 relay into local strfry
# Phase 2: Parse events and POST scores to Meilisearch load-scores endpoint

source /etc/brainstorm.conf
source "$BRAINSTORM_MODULE_BASE_DIR/src/utils/structuredLogging.sh"

emit_task_event "TASK_START" "loadOwnerScoresIntoMeilisearch" "$BRAINSTORM_OWNER_PUBKEY" '{
    "message": "Starting Meilisearch score loading for owner",
    "task_type": "owner_meilisearch_load",
    "phases": ["sync_from_relay", "load_into_meilisearch"],
    "scope": "owner"
}'

# Phase 1: Sync kind 30382 events from NIP-85 relay into local strfry
NIP85_RELAY="${BRAINSTORM_NIP85_RELAYS%%,*}"

if [ -n "$NIP85_RELAY" ]; then
    # Get the TA pubkey (the assistant that authored the 30382 events)
    TA_PUBKEY=$(node -e "const {getOwnerAssistantPubkey}=require('$BRAINSTORM_MODULE_BASE_DIR/src/utils/assistantKeys');console.log(getOwnerAssistantPubkey()||'')")

    if [ -n "$TA_PUBKEY" ]; then
        echo "$(date): Syncing kind 30382 events from $NIP85_RELAY for TA pubkey ${TA_PUBKEY:0:8}..."
        emit_task_event "PROGRESS" "loadOwnerScoresIntoMeilisearch" "$BRAINSTORM_OWNER_PUBKEY" '{
            "message": "Syncing kind 30382 events from NIP-85 relay",
            "phase": "sync_from_relay",
            "relay": "'"$NIP85_RELAY"'",
            "ta_pubkey": "'"${TA_PUBKEY:0:8}"'"
        }'

        FILTER="{\"kinds\":[30382],\"authors\":[\"$TA_PUBKEY\"]}"
        strfry sync "$NIP85_RELAY" --filter "$FILTER" --dir down || echo "$(date): WARNING: strfry sync returned non-zero (may be partial)"
        echo "$(date): Sync complete"
    else
        echo "$(date): WARNING: Could not determine TA pubkey, skipping relay sync"
    fi
else
    echo "$(date): WARNING: No NIP-85 relay configured (BRAINSTORM_NIP85_RELAYS), skipping relay sync"
fi

# Phase 2: Load scores into Meilisearch
emit_task_event "PROGRESS" "loadOwnerScoresIntoMeilisearch" "$BRAINSTORM_OWNER_PUBKEY" '{
    "message": "Loading scores into Meilisearch",
    "phase": "load_into_meilisearch"
}'

echo "$(date): Loading scores into Meilisearch..."
node ${BRAINSTORM_NIP85_DIR}/loadScoresIntoMeilisearch.js
RESULT=$?

if [ $RESULT -ne 0 ]; then
    echo "$(date): ERROR: loadScoresIntoMeilisearch.js failed with exit code $RESULT"
    emit_task_event "TASK_ERROR" "loadOwnerScoresIntoMeilisearch" "$BRAINSTORM_OWNER_PUBKEY" '{
        "message": "Failed to load scores into Meilisearch",
        "error": "nodejs_script_failure",
        "exit_code": '"$RESULT"'
    }'
    exit 1
fi

emit_task_event "TASK_END" "loadOwnerScoresIntoMeilisearch" "$BRAINSTORM_OWNER_PUBKEY" '{
    "message": "Owner scores loaded into Meilisearch successfully",
    "status": "success",
    "scope": "owner"
}'

echo "$(date): Finished loadScoresIntoMeilisearch for owner"
exit 0
