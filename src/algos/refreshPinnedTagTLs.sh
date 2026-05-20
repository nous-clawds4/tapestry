#!/bin/bash
set -o pipefail

# Refresh pinned-tag Trusted Lists.
# Story #11 / ADR 0010.
#
# Calls the loopback endpoint /api/trusted-list/refresh-all-pinned-tags
# which enumerates every Pin event in local strfry, refreshes the
# corresponding kind-30392 TL under each pin's observer POV, and retracts
# any stale TL slots whose pin was unpinned since the last run.

source /etc/brainstorm.conf 2>/dev/null || true
STRUCTURED_LOG_PATH="${BRAINSTORM_MODULE_BASE_DIR:-/usr/local/lib/node_modules/brainstorm}/src/utils/structuredLogging.sh"
if [ -f "$STRUCTURED_LOG_PATH" ]; then
    source "$STRUCTURED_LOG_PATH"
else
    emit_task_event() { :; }
fi

CONTROL_PANEL_PORT="${CONTROL_PANEL_PORT:-7778}"

emit_task_event "TASK_START" "refreshPinnedTagTLs" "" '{"message":"Starting refreshPinnedTagTLs","task_type":"tl_publication"}'

emit_task_event "PROGRESS" "refreshPinnedTagTLs" "" '{"phase":"refresh_all_pinned_tags"}'
resp=$(curl -sf -m 300 -X POST "http://127.0.0.1:${CONTROL_PANEL_PORT}/api/trusted-list/refresh-all-pinned-tags" 2>/dev/null || echo "")

if [ -z "$resp" ]; then
    emit_task_event "WARN" "refreshPinnedTagTLs" "" '{"reason":"refresh endpoint returned empty / non-2xx"}'
    emit_task_event "TASK_END" "refreshPinnedTagTLs" "" '{"failure":true}'
    exit 1
fi

echo "$(date): refresh-all-pinned-tags response: $resp"

emit_task_event "TASK_END" "refreshPinnedTagTLs" "" '{"failure":false}'
exit 0
