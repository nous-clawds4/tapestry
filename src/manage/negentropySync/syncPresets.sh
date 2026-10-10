#!/bin/bash
set -o pipefail

# Run every switched-on negentropy-sync preset.
# Story relay-stream-gaps #3 / ADR relay-stream-gaps/0003.
#
# Calls the loopback endpoint /api/strfry/negentropy-presets/run, which syncs the switched-on
# presets one at a time through the Negentropy Sync tab's single slot and records each preset's
# result where the tab shows it. A direct loopback call is local-trusted, so it passes the
# owner gate. The run can be long (each preset may wait 10 minutes for a manual sync, then sync
# for up to 10), hence curl -m 21600, matching the registry entry's 6-hour timeout.
#
# Exit 0: the run succeeded and no preset failed, or another run was already going (409
# alreadyRunning: WARN, nothing doubled). Exit 1: any preset failed, or no usable answer
# (empty, control panel down, non-2xx, not JSON). The response is parsed with node.

source /etc/brainstorm.conf 2>/dev/null || true
STRUCTURED_LOG_PATH="${BRAINSTORM_MODULE_BASE_DIR:-/usr/local/lib/node_modules/brainstorm}/src/utils/structuredLogging.sh"
if [ -f "$STRUCTURED_LOG_PATH" ]; then
    source "$STRUCTURED_LOG_PATH"
else
    emit_task_event() { :; }
fi

TASK_NAME="syncNegentropyPresets"
LOG_FILE="${BRAINSTORM_LOG_DIR:-/var/log/brainstorm}/syncNegentropyPresets.log"
note() {
    echo "$(date): $*"
    echo "$(date): $*" 2>/dev/null >> "$LOG_FILE" || true
}
finish() {
    # $1 = failure (true|false), $2 = exit code
    emit_task_event "TASK_END" "$TASK_NAME" "system" "{\"failure\":$1}"
    exit "$2"
}

emit_task_event "TASK_START" "$TASK_NAME" "system" '{"message":"Starting syncNegentropyPresets","task_type":"negentropy_sync"}'
note "Starting syncNegentropyPresets"

# The body, then the HTTP status on its own last line (000 when nothing answered). No -f: the
# 409 alreadyRunning body is needed.
out=$(curl -s -m 21600 -X POST -w '\n%{http_code}' "http://127.0.0.1:${CONTROL_PANEL_PORT:-7778}/api/strfry/negentropy-presets/run" 2>/dev/null)
http_code="${out##*$'\n'}"
body="${out%$'\n'*}"
note "run endpoint answered HTTP ${http_code}: ${body}"

# ok | alreadyRunning | failed <n> | invalid
verdict=$(printf '%s' "$body" | node -e '
let s = "";
process.stdin.on("data", (d) => { s += d; });
process.stdin.on("end", () => {
  let r;
  try { r = JSON.parse(s); } catch (e) { console.log("invalid"); return; }
  if (r && r.alreadyRunning === true) console.log("alreadyRunning");
  else if (r && r.success === true && Array.isArray(r.results)) console.log(r.failed === 0 ? "ok" : `failed ${r.failed}`);
  else console.log("invalid");
});' 2>/dev/null)

if [ "$http_code" = "409" ] && [ "$verdict" = "alreadyRunning" ]; then
    emit_task_event "WARN" "$TASK_NAME" "system" '{"reason":"alreadyRunning: a presets run is already going, so this trigger was skipped"}'
    note "A presets run is already going; skipped"
    finish false 0
fi

if [ "${http_code:0:1}" != "2" ] || [ -z "$body" ] || [ -z "$verdict" ] || [ "$verdict" = "invalid" ]; then
    emit_task_event "WARN" "$TASK_NAME" "system" "{\"reason\":\"no usable answer from the run endpoint (HTTP ${http_code})\"}"
    note "Failed: no usable answer from the run endpoint (HTTP ${http_code})"
    finish true 1
fi

if [ "$verdict" != "ok" ]; then
    note "Finished: ${verdict} preset(s); see Settings → Relays → Negentropy Sync"
    finish true 1
fi

note "Finished: every switched-on preset synced"
finish false 0
