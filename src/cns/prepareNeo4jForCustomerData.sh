#!/bin/bash

# Call this script prior to (or at the beginning of) updateAllScoresForSingleCustomer.sh for a given customer.
# This script prepares neo4j for storage of WoT metrics using a given customer as observer.
# It updates the neo4j database to ensure two properties:
# 1. every NostrUser has a single associated SetOfNostrUserWotMetricsCards node.
# 2. each SetOfNostrUserWotMetricsCards node has a single associated NostrUserWotMetricsCard node for the given customer.
# It is called with a command like:
# bash prepareNeo4jForCustomerData.sh <customer_id> <customer_pubkey>
# which in turn calls two other scripts:
# bash addSetsOfMetricsCards.sh (property 1)
# bash addMetricsCards.sh <customer_id> <customer_pubkey> (property 2)
# Example: (cloudfodder.brainstorm.social)
# bash prepareNeo4jForCustomerData.sh 52387c6b99cc42aac51916b08b7b51d2baddfc19f2ba08d82a48432849dbdfb2 2

source /etc/brainstorm.conf # NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, BRAINSTORM_LOG_DIR

# Source structured logging utilities
source "$BRAINSTORM_MODULE_BASE_DIR/src/utils/structuredLogging.sh"

# Check if customer_pubkey, customer_id, and customer_name are provided
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
    echo "Usage: $0 <customer_pubkey> <customer_id> <customer_name>"
    exit 1
fi

# Get customer_pubkey
CUSTOMER_PUBKEY="$1"

# Get customer_id
CUSTOMER_ID="$2"

# Get customer_name
CUSTOMER_DIRECTORY_NAME="$3"  

# Get log directory
LOG_DIR="$BRAINSTORM_LOG_DIR/customers/$CUSTOMER_DIRECTORY_NAME"

# Create log directory if it doesn't exist; chown to brainstorm user
mkdir -p "$LOG_DIR"
chown brainstorm:brainstorm "$LOG_DIR"

# Log file
LOG_FILE="$LOG_DIR/prepareNeo4jForCustomerData.log"

touch ${LOG_FILE}
chown brainstorm:brainstorm ${LOG_FILE}

# TODO: check if CUSTOMER_ID and CUSTOMER_PUBKEY are valid

echo "$(date): Starting prepareNeo4jForCustomerData for customer_pubkey $CUSTOMER_PUBKEY and customer_id $CUSTOMER_ID"
echo "$(date): Starting prepareNeo4jForCustomerData for customer_pubkey $CUSTOMER_PUBKEY and customer_id $CUSTOMER_ID" >> ${LOG_FILE}

# Emit structured event for task start
oMetadata=$(jq -n \
    --argjson customer_id "$CUSTOMER_ID" \
    --arg customer_pubkey "$CUSTOMER_PUBKEY" \
    --arg message "Starting prepareNeo4jForCustomerData" \
    --arg task_type "customer_preparation" \
    --arg database "neo4j" \
    --arg category "maintenance" \
    --arg scope "customer" \
    ' {
        "customer_id": $customer_id,
        "customer_pubkey": $customer_pubkey,
        "message": $message,
        "task_type": $task_type,
        "database": $database,
        "category": $category,
        "scope": $scope
    }')
emit_task_event "TASK_START" "prepareNeo4jForCustomerData" "$CUSTOMER_PUBKEY" "$oMetadata"

# Emit structured event for first child script
oMetadata=$(jq -n \
    --argjson customer_id "$CUSTOMER_ID" \
    --arg customer_pubkey "$CUSTOMER_PUBKEY" \
    --arg message "Starting SetOfNostrUserWotMetricsCards setup" \
    --arg phase "metrics_cards_setup" \
    --arg step "sets_of_metrics_cards" \
    --arg child_script "addSetsOfMetricsCards.sh" \
    ' {
        "customer_id": $customer_id,
        "customer_pubkey": $customer_pubkey,
        "message": $message,
        "phase": $phase,
        "step": $step,
        "child_script": $child_script
    }')
emit_task_event "PROGRESS" "prepareNeo4jForCustomerData" "$CUSTOMER_PUBKEY" "$oMetadata"

# Ensure the observer (customer) always has a NostrUser node and SetOfNostrUserWotMetricsCards,
# regardless of hop distance from the owner. Without this, customers who aren't followed by
# anyone (hops=999) would never get scored because addSetsOfMetricsCards.sh filters on hops<100.
cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" "
MERGE (n:NostrUser {pubkey: '$CUSTOMER_PUBKEY'})
MERGE (n)-[:WOT_METRICS_CARDS]->(s:Set:SetOfNostrUserWotMetricsCards)
SET s.observee_pubkey = n.pubkey
RETURN count(s) AS created
"
echo "$(date): Ensured observer $CUSTOMER_PUBKEY has SetOfNostrUserWotMetricsCards"
echo "$(date): Ensured observer $CUSTOMER_PUBKEY has SetOfNostrUserWotMetricsCards" >> ${LOG_FILE}

# Add SetOfNostrUserWotMetricsCards nodes to the neo4j database. This does not require customer_id or customer_pubkey.
if bash $BRAINSTORM_MODULE_BASE_DIR/src/cns/addSetsOfMetricsCards.sh; then
    # Emit structured event for first child script success
    oMetadata=$(jq -n \
        --argjson customer_id "$CUSTOMER_ID" \
        --arg customer_pubkey "$CUSTOMER_PUBKEY" \
        --arg message "SetOfNostrUserWotMetricsCards setup completed successfully" \
        --arg phase "metrics_cards_setup" \
        --arg step "sets_of_metrics_cards_complete" \
        ' {
            "customer_id": $customer_id,
            "customer_pubkey": $customer_pubkey,
            "message": $message,
            "phase": $phase,
            "step": $step
        }')
    emit_task_event "PROGRESS" "prepareNeo4jForCustomerData" "$CUSTOMER_PUBKEY" "$oMetadata"
else
    # Emit structured event for first child script failure
    oMetadata=$(jq -n \
        --argjson customer_id "$CUSTOMER_ID" \
        --arg customer_pubkey "$CUSTOMER_PUBKEY" \
        --arg message "SetOfNostrUserWotMetricsCards setup failed" \
        --arg phase "metrics_cards_setup" \
        --arg step "sets_of_metrics_cards_failed" \
        ' {
            "customer_id": $customer_id,
            "customer_pubkey": $customer_pubkey,
            "message": $message,
            "phase": $phase,
            "step": $step
        }')
    emit_task_event "TASK_ERROR" "prepareNeo4jForCustomerData" "$CUSTOMER_PUBKEY" "$oMetadata"
    exit 1
fi

echo "$(date): Continuing prepareNeo4jForCustomerData for customer_pubkey $CUSTOMER_PUBKEY and customer_id $CUSTOMER_ID"
echo "$(date): Continuing prepareNeo4jForCustomerData for customer_pubkey $CUSTOMER_PUBKEY and customer_id $CUSTOMER_ID" >> ${LOG_FILE}

# Emit structured event for second child script
oMetadata=$(jq -n \
    --argjson customer_id "$CUSTOMER_ID" \
    --arg customer_pubkey "$CUSTOMER_PUBKEY" \
    --arg message "Starting customer-specific NostrUserWotMetricsCard setup" \
    --arg phase "metrics_cards_setup" \
    --arg step "customer_specific_metrics_cards" \
    ' {
        "customer_id": $customer_id,
        "customer_pubkey": $customer_pubkey,
        "message": $message,
        "phase": $phase,
        "step": $step
    }')
emit_task_event "PROGRESS" "prepareNeo4jForCustomerData" "$CUSTOMER_PUBKEY" "$oMetadata"

# Add NostrUserWotMetricsCard nodes to the neo4j database for the given customer
if bash $BRAINSTORM_MODULE_BASE_DIR/src/cns/addMetricsCards.sh $CUSTOMER_PUBKEY $CUSTOMER_ID $CUSTOMER_DIRECTORY_NAME; then
    # Emit structured event for second child script success
    oMetadata=$(jq -n \
        --argjson customer_id "$CUSTOMER_ID" \
        --arg customer_pubkey "$CUSTOMER_PUBKEY" \
        --arg message "Customer-specific NostrUserWotMetricsCard setup completed successfully" \
        --arg phase "metrics_cards_setup" \
        --arg step "customer_metrics_cards_complete" \
        ' {
            "customer_id": $customer_id,
            "customer_pubkey": $customer_pubkey,
            "message": $message,
            "phase": $phase,
            "step": $step
        }')
    emit_task_event "PROGRESS" "prepareNeo4jForCustomerData" "$CUSTOMER_PUBKEY" "$oMetadata"
else
    # Emit structured event for second child script failure
    oMetadata=$(jq -n \
        --argjson customer_id "$CUSTOMER_ID" \
        --arg customer_pubkey "$CUSTOMER_PUBKEY" \
        --arg message "Customer-specific NostrUserWotMetricsCard setup failed" \
        --arg phase "metrics_cards_setup" \
        --arg step "customer_metrics_cards_failed" \
        ' {
            "customer_id": $customer_id,
            "customer_pubkey": $customer_pubkey,
            "message": $message,
            "phase": $phase,
            "step": $step
        }')
    emit_task_event "TASK_ERROR" "prepareNeo4jForCustomerData" "$CUSTOMER_PUBKEY" "$oMetadata"
    exit 1
fi

# Emit structured event for successful completion
oMetadata=$(jq -n \
    --argjson customer_id "$CUSTOMER_ID" \
    --arg customer_pubkey "$CUSTOMER_PUBKEY" \
    --arg message "Neo4j customer data preparation completed successfully" \
    --arg phase "customer_preparation" \
    --arg step "customer_preparation_complete" \
    ' {
        "customer_id": $customer_id,
        "customer_pubkey": $customer_pubkey,
        "message": $message,
        "phase": $phase,
        "step": $step
    }')
emit_task_event "TASK_END" "prepareNeo4jForCustomerData" "$CUSTOMER_PUBKEY" "$oMetadata"

echo "$(date): Finished prepareNeo4jForCustomerData for customer_pubkey $CUSTOMER_PUBKEY and customer_id $CUSTOMER_ID"
echo "$(date): Finished prepareNeo4jForCustomerData for customer_pubkey $CUSTOMER_PUBKEY and customer_id $CUSTOMER_ID" >> ${LOG_FILE}

