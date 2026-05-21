#!/bin/bash
set -e          # Exit immediately on command failure
set -o pipefail # Fail if any pipeline command fails

# processAllActiveCustomers.sh
# Consolidated script to process all active customers
# Replaces the processAllActiveCustomers.sh (deprecated) + processAllActiveCustomers.js combination

# Source configuration
source /etc/brainstorm.conf # BRAINSTORM_MODULE_ALGOS_DIR, BRAINSTORM_LOG_DIR

# Optional 1st argument: warmStart flag, forwarded to each processCustomer
# invocation and ultimately to the GrapeRank calculation for each customer.
WARM_START="${1:-}"

# Source structured logging utilities
source "$BRAINSTORM_MODULE_BASE_DIR/src/utils/structuredLogging.sh"

# Create log directory if it doesn't exist; chown to brainstorm:brainstorm
mkdir -p "$BRAINSTORM_LOG_DIR"
chown brainstorm:brainstorm "$BRAINSTORM_LOG_DIR"

# Log file
LOG_FILE="$BRAINSTORM_LOG_DIR/processAllActiveCustomers.log"
touch ${LOG_FILE}
chown brainstorm:brainstorm ${LOG_FILE}

# Logging function
log_message() {
    echo "$(date): $1"
    echo "$(date): $1" >> ${LOG_FILE}
}

log_message "Starting processAllActiveCustomers"

# Emit structured event for task start
emit_task_event "TASK_START" "processAllActiveCustomers" "" '{
    "message": "Starting processing of all active customers",
    "orchestrator_type": "customer_iteration",
    "description": "Consolidated script to process all active customers",
    "scope": "all_customers",
    "warm_start": "'$WARM_START'"
}'

# Define paths
ALGOS_DIR="${BRAINSTORM_MODULE_ALGOS_DIR}"
CUSTOMERS_DIR='/var/lib/brainstorm/customers';
CUSTOMERS_JSON="${CUSTOMERS_DIR}/customers.json";
PROCESS_CUSTOMER_SCRIPT="${ALGOS_DIR}/customers/processCustomer.sh"

# Check if customers.json exists
if [ ! -f "$CUSTOMERS_JSON" ]; then
    log_message "Error: Customers file not found at $CUSTOMERS_JSON"
    exit 1
fi

# Check if processCustomer.sh exists
if [ ! -f "$PROCESS_CUSTOMER_SCRIPT" ]; then
    log_message "Error: processCustomer.sh not found at $PROCESS_CUSTOMER_SCRIPT"
    exit 1
fi

log_message "Reading customers from $CUSTOMERS_JSON"

# Parse JSON and extract active customers
# Using jq to parse JSON safely
if ! command -v jq &> /dev/null; then
    log_message "Error: jq is required but not installed"
    exit 1
fi

# Get active customers using jq
active_customers=$(jq -r '.customers | to_entries[] | select(.value.status == "active") | "\(.value.id),\(.value.pubkey),\(.value.name)"' "$CUSTOMERS_JSON")

if [ -z "$active_customers" ]; then
    log_message "No active customers found"
    exit 0
fi

# Count active customers
customer_count=$(echo "$active_customers" | wc -l)
log_message "Found $customer_count active customers"

# Emit structured event for customer discovery
emit_task_event "PROGRESS" "processAllActiveCustomers" "" '{
    "step": "customer_discovery",
    "active_customers_found": '$customer_count',
    "message": "Discovered active customers from customers.json",
    "data_source": "customers.json",
    "operation": "customer_enumeration"
}'

# Process each active customer
processed_count=0
failed_count=0

# Emit structured event for processing start
emit_task_event "PROGRESS" "processAllActiveCustomers" "" '{
    "step": "customer_processing_start",
    "total_customers": '$customer_count',
    "message": "Starting individual customer processing",
    "operation": "batch_processing_initialization"
}'

while IFS=',' read -r customer_id customer_pubkey customer_name; do
    log_message "Processing customer: $customer_name (id: $customer_id) with pubkey $customer_pubkey"
    
    # Emit structured event for child task start
    emit_task_event "CHILD_TASK_START" "processAllActiveCustomers" "" '{
        "child_task": "processCustomer",
        "customer_id": "'$customer_id'",
        "customer_pubkey": "'$customer_pubkey'",
        "customer_name": "'$customer_name'",
        "message": "Starting processing for customer '$customer_name'",
        "operation": "individual_customer_processing"
    }'
    
    # Construct and execute the command (forward WARM_START as optional 4th arg)
    command="bash $PROCESS_CUSTOMER_SCRIPT $customer_pubkey $customer_id $customer_name $WARM_START"
    log_message "Executing: $command"
    
    if $command; then
        log_message "Successfully completed processing for customer: $customer_name"
        processed_count=$((processed_count + 1))
        
        # Emit structured event for child task success
        emit_task_event "CHILD_TASK_END" "processAllActiveCustomers" "" '{
            "child_task": "processCustomer",
            "customer_id": "'$customer_id'",
            "customer_name": "'$customer_name'",
            "status": "success",
            "message": "Successfully completed processing for customer '$customer_name'",
            "operation": "individual_customer_processing"
        }'
    else
        log_message "Error processing customer $customer_name"
        failed_count=$((failed_count + 1))
        
        # Emit structured event for child task error
        emit_task_event "CHILD_TASK_ERROR" "processAllActiveCustomers" "" '{
            "child_task": "processCustomer",
            "customer_id": "'$customer_id'",
            "customer_name": "'$customer_name'",
            "status": "error",
            "message": "Error processing customer '$customer_name'",
            "operation": "individual_customer_processing"
        }'
        
        # Continue with other customers even if one fails
    fi
done <<< "$active_customers"

log_message "Processing summary: $processed_count successful, $failed_count failed out of $customer_count total"

# Emit structured event for processing summary
emit_task_event "PROGRESS" "processAllActiveCustomers" "" '{
    "step": "processing_summary",
    "total_customers": '$customer_count',
    "successful_customers": '$processed_count',
    "failed_customers": '$failed_count',
    "message": "Completed processing all customers",
    "operation": "batch_processing_summary",
    "success_rate": "'$(echo "scale=2; $processed_count * 100 / $customer_count" | bc)'"
}'

# Cache-aware cleanup of the shared raw-data CSV cache. Per ADR 0009: use a
# non-blocking exclusive flock so an in-flight peer (any other customer
# recalc or the owner pipeline) is not interrupted. evict_raw_data_csv_cache
# targets ONLY the four shared CSVs + .last_init sentinel — per-customer
# subdirectories under tmp/<CUSTOMER>/ are cleaned up by
# updateAllScoresForSingleCustomer.sh.
log_message "Cache-aware cleanup of personalizedGrapeRank shared CSV cache"

emit_task_event "PROGRESS" "processAllActiveCustomers" "" '{
    "step": "cleanup_start",
    "message": "Starting cache-aware cleanup of personalizedGrapeRank shared CSV cache",
    "operation": "temporary_file_cleanup",
    "cleanup_target": "/var/lib/brainstorm/algos/personalizedGrapeRank/tmp"
}'

# Source the helper — provides evict_raw_data_csv_cache (uses flock -x -n).
source "${BRAINSTORM_MODULE_ALGOS_DIR}/personalizedGrapeRank/ensureRawDataCsv.sh"
evict_raw_data_csv_cache "processAllActiveCustomers" ""

emit_task_event "PROGRESS" "processAllActiveCustomers" "" '{
    "step": "cleanup_complete",
    "message": "Completed cache-aware cleanup of personalizedGrapeRank shared CSV cache",
    "operation": "temporary_file_cleanup",
    "cleanup_target": "/var/lib/brainstorm/algos/personalizedGrapeRank/tmp"
}'

log_message "Finished processAllActiveCustomers"

# Emit structured event for task completion
if [ $failed_count -gt 0 ]; then
    oMetadata=$(jq -n \
        --arg status "partial_success" \
        --argjson total_customers "$customer_count" \
        --argjson successful_customers "$processed_count" \
        --argjson failed_customers "$failed_count" \
        --arg orchestrator_type "customer_iteration" \
        --arg message "Completed processing all active customers with some failures" \
        --argjson success_rate "'$(echo "scale=2; $processed_count * 100 / $customer_count" | bc)'" \
        '{
            "status": $status,
            "total_customers": $total_customers,
            "successful_customers": $successful_customers,
            "failed_customers": $failed_customers,
            "orchestrator_type": $orchestrator_type,
            "message": $message,
            "success_rate": $success_rate
        }')
    emit_task_event "TASK_END" "processAllActiveCustomers" "" "$oMetadata"
    exit 1
else
    oMetadata=$(jq -n \
        --arg status "success" \
        --argjson total_customers "$customer_count" \
        --argjson successful_customers "$processed_count" \
        --argjson failed_customers "$failed_count" \
        --arg orchestrator_type "customer_iteration" \
        --arg message "Successfully completed processing all active customers" \
        --arg success_rate "100.00" \
        '{
            "status": $status,
            "total_customers": $total_customers,
            "successful_customers": $successful_customers,
            "failed_customers": $failed_customers,
            "orchestrator_type": $orchestrator_type,
            "message": $message,
            "success_rate": $success_rate
        }')
    emit_task_event "TASK_END" "processAllActiveCustomers" "" "$oMetadata"
    exit 0
fi
