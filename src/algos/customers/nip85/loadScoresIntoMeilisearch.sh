#!/bin/bash
set -e
set -o pipefail

# Load customer's kind 30382 Trusted Assertions into Meilisearch.
# Phase 1: Sync 30382 events from NIP-85 relay into local strfry
# Phase 2: Parse events and POST scores to Meilisearch load-scores endpoint

source /etc/brainstorm.conf
source "$BRAINSTORM_MODULE_BASE_DIR/src/utils/structuredLogging.sh"

if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Usage: $0 <customer_pubkey> <customer_id> <customer_directory_name>"
    exit 1
fi

CUSTOMER_PUBKEY="$1"
CUSTOMER_ID="$2"
CUSTOMER_DIRECTORY_NAME="$3"

emit_task_event "TASK_START" "loadCustomerScoresIntoMeilisearch" "$CUSTOMER_PUBKEY" '{
    "message": "Starting Meilisearch score loading for customer",
    "task_type": "customer_meilisearch_load",
    "customer_pubkey": "'"$CUSTOMER_PUBKEY"'",
    "phases": ["sync_from_relay", "load_into_meilisearch"],
    "scope": "customer"
}'

# Phase 1: Sync kind 30382 events from NIP-85 relay into local strfry
NIP85_RELAY="${BRAINSTORM_NIP85_RELAYS%%,*}"

if [ -n "$NIP85_RELAY" ]; then
    # Get the customer's relay pubkey (the assistant that authored the 30382 events)
    CUSTOMER_RELAY_PUBKEY=$(node -e "
        const {getCustomerRelayKeys}=require('$BRAINSTORM_MODULE_BASE_DIR/src/utils/customerRelayKeys');
        getCustomerRelayKeys('$CUSTOMER_PUBKEY').then(k => console.log(k?.pubkey||'')).catch(() => console.log(''));
    ")

    if [ -n "$CUSTOMER_RELAY_PUBKEY" ]; then
        echo "$(date): Syncing kind 30382 events from $NIP85_RELAY for customer relay pubkey ${CUSTOMER_RELAY_PUBKEY:0:8}..."
        emit_task_event "PROGRESS" "loadCustomerScoresIntoMeilisearch" "$CUSTOMER_PUBKEY" '{
            "message": "Syncing kind 30382 events from NIP-85 relay",
            "phase": "sync_from_relay",
            "relay": "'"$NIP85_RELAY"'",
            "customer_relay_pubkey": "'"${CUSTOMER_RELAY_PUBKEY:0:8}"'"
        }'

        FILTER="{\"kinds\":[30382],\"authors\":[\"$CUSTOMER_RELAY_PUBKEY\"]}"
        strfry sync "$NIP85_RELAY" --filter "$FILTER" --dir down || echo "$(date): WARNING: strfry sync returned non-zero (may be partial)"
        echo "$(date): Sync complete"
    else
        echo "$(date): WARNING: Could not determine customer relay pubkey, skipping relay sync"
    fi
else
    echo "$(date): WARNING: No NIP-85 relay configured (BRAINSTORM_NIP85_RELAYS), skipping relay sync"
fi

# Phase 2: Load scores into Meilisearch
emit_task_event "PROGRESS" "loadCustomerScoresIntoMeilisearch" "$CUSTOMER_PUBKEY" '{
    "message": "Loading scores into Meilisearch",
    "phase": "load_into_meilisearch"
}'

echo "$(date): Loading scores into Meilisearch for customer ${CUSTOMER_PUBKEY:0:8}..."
node ${BRAINSTORM_MODULE_ALGOS_DIR}/customers/nip85/loadScoresIntoMeilisearch.js "$CUSTOMER_PUBKEY" "$CUSTOMER_ID" "$CUSTOMER_DIRECTORY_NAME"
RESULT=$?

if [ $RESULT -ne 0 ]; then
    echo "$(date): ERROR: loadScoresIntoMeilisearch.js failed with exit code $RESULT"
    emit_task_event "TASK_ERROR" "loadCustomerScoresIntoMeilisearch" "$CUSTOMER_PUBKEY" '{
        "message": "Failed to load scores into Meilisearch",
        "error": "nodejs_script_failure",
        "exit_code": '"$RESULT"'
    }'
    exit 1
fi

emit_task_event "TASK_END" "loadCustomerScoresIntoMeilisearch" "$CUSTOMER_PUBKEY" '{
    "message": "Customer scores loaded into Meilisearch successfully",
    "status": "success",
    "scope": "customer"
}'

echo "$(date): Finished loadScoresIntoMeilisearch for customer ${CUSTOMER_PUBKEY:0:8}"
exit 0
