#!/bin/bash
# tagging-edges story 2 / ADR tagging-edges/0002. Takes the pass's kernel lock and execs node, so the lock lives as
# long as the pass and the task time-out's kill -9 reaches it (launchChildTask.sh:407). No secret on any argv.
set -euo pipefail
source /etc/brainstorm.conf
DIR="${BRAINSTORM_MODULE_SRC_DIR}/pipeline/tagging-edges"
STATE_DIR="${TAGGING_EDGES_STATE_DIR:-/var/lib/brainstorm/tagging-edges}"
mkdir -p "$STATE_DIR" && chmod 700 "$STATE_DIR"
exec 9>>"$STATE_DIR/pass.lock"
if flock -n 9; then exec node "$DIR/reconcileTaggingEdges.js"; fi
exec node "$DIR/reconcileTaggingEdges.js" --lock-busy
