#!/bin/bash

CONFIG_FILE="/etc/brainstorm.conf"
source "$CONFIG_FILE" # BRAINSTORM_MODULE_PIPELINE_DIR

# Source structured logging utility
source "${BRAINSTORM_MODULE_SRC_DIR}/utils/structuredLogging.sh"

touch ${BRAINSTORM_LOG_DIR}/callBatchTransfer.log
chown brainstorm:brainstorm ${BRAINSTORM_LOG_DIR}/callBatchTransfer.log

emit_task_event "TASK_START" "callBatchTransfer" "system" "{}"

echo "$(date): Starting callBatchTransfer"
echo "$(date): Starting callBatchTransfer" >> ${BRAINSTORM_LOG_DIR}/callBatchTransfer.log

echo "$(date): Continuing callBatchTransfer ... starting batch/transfer.sh"
echo "$(date): Continuing callBatchTransfer ... starting batch/transfer.sh" >> ${BRAINSTORM_LOG_DIR}/callBatchTransfer.log

emit_task_event "PROGRESS" "callBatchTransfer" "system" '{"step":"batch_transfer","description":"Running batch transfer pipeline"}'

bash $BRAINSTORM_MODULE_PIPELINE_DIR/batch/transfer.sh
TRANSFER_EXIT=$?

echo "$(date): Continuing callBatchTransfer ... batch/transfer.sh completed"
echo "$(date): Continuing callBatchTransfer ... batch/transfer.sh completed" >> ${BRAINSTORM_LOG_DIR}/callBatchTransfer.log

echo "$(date): Finished callBatchTransfer"
echo "$(date): Finished callBatchTransfer" >> ${BRAINSTORM_LOG_DIR}/callBatchTransfer.log

endMetadata=$(jq -n --argjson exit_code "$TRANSFER_EXIT" '{ exit_code: $exit_code }')
emit_task_event "TASK_END" "callBatchTransfer" "system" "$endMetadata"
exit $TRANSFER_EXIT
