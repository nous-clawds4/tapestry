#!/bin/bash
set -o pipefail

# Refresh the two tag-applicability Trusted Lists.
# tag-applicability Story 1 (derivation) + Story 2 (scheduled) / ADR tag-applicability/0002.
#
# Calls the loopback endpoint /api/trusted-list/refresh-applicability-lists which derives
# "Tags for Nostr Pubkeys" / "Tags for Nostr Events" (HINT ∪ USAGE) and publishes each as a
# TA-signed kind-30393 Trusted List. Keeps the published lists fresh for federation/external
# consumers; the local picker computes live so it does not depend on this cadence.

source /etc/brainstorm.conf 2>/dev/null || true
STRUCTURED_LOG_PATH="${BRAINSTORM_MODULE_BASE_DIR:-/usr/local/lib/node_modules/brainstorm}/src/utils/structuredLogging.sh"
if [ -f "$STRUCTURED_LOG_PATH" ]; then
    source "$STRUCTURED_LOG_PATH"
else
    emit_task_event() { :; }
fi

CONTROL_PANEL_PORT="${CONTROL_PANEL_PORT:-7778}"

emit_task_event "TASK_START" "refreshApplicabilityLists" "" '{"message":"Starting refreshApplicabilityLists","task_type":"tl_publication"}'

emit_task_event "PROGRESS" "refreshApplicabilityLists" "" '{"phase":"refresh_applicability_lists"}'
resp=$(curl -sf -m 300 -X POST "http://127.0.0.1:${CONTROL_PANEL_PORT}/api/trusted-list/refresh-applicability-lists" 2>/dev/null || echo "")

if [ -z "$resp" ]; then
    emit_task_event "WARN" "refreshApplicabilityLists" "" '{"reason":"refresh endpoint returned empty / non-2xx"}'
    emit_task_event "TASK_END" "refreshApplicabilityLists" "" '{"failure":true}'
    exit 1
fi

echo "$(date): refresh-applicability-lists response: $resp"

emit_task_event "TASK_END" "refreshApplicabilityLists" "" '{"failure":false}'
exit 0
