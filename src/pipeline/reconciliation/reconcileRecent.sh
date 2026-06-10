#!/bin/bash
set -e          # Exit immediately on command failure
set -o pipefail # Fail if any pipeline command fails

# reconcileRecent.sh
# Story #23 / ADR 0020 — independent, guarantee-specific reconcile task.
#
# Guarantee: recent-window consistency. Reconciles ONLY the authors with a
# relevant event (kind 3 / 10000 / 1984) inside a BOUNDED, overridable recency
# window — never the whole graph, never a bootstrap full pass. Its cost is
# proportional to recent activity, not graph size.
#
#   default window  : RECONCILE_RECENT_MAX_RECENCY_SECONDS (default 21600 = 6h)
#   override         : --recency <seconds>   (caps the lookback for this run)
#   lookback         : min( now - watermark + overlap , max_recency )
#                      (no watermark ⇒ just the max_recency window; NO full pass)
#
# Neo4j extraction is a single WHERE u.pubkey IN $covered query (streamed,
# parameterized; getCurrentFollowsFromNeo4j.js --authorsFromDir), not a
# per-author N+1. The strfry dump + converters + set-diff + APOC apply are
# reused verbatim. Drift older than the window is reconcileNetwork's / reconcileAll's job.

source /etc/brainstorm.conf
source /usr/local/lib/node_modules/brainstorm/src/utils/structuredLogging.sh

BASE_DIR_RECONCILIATION="/usr/local/lib/node_modules/brainstorm/src/pipeline/reconciliation"
BASE_DIR=${BASE_DIR_RECONCILIATION:-"/usr/local/lib/node_modules/brainstorm/src/pipeline/reconciliation"}
LOG_DIR=${BRAINSTORM_LOG_DIR:-"/var/log/brainstorm"}
APOC_COMMANDS_DIR="${BASE_DIR}/apocCypherCommands"

# Persisted watermark helper (get_watermark / write_state)
source "${BASE_DIR}/reconciliationState.sh"

mkdir -p "${APOC_COMMANDS_DIR}"
LOG_FILE="${LOG_DIR}/reconciliation.log"
touch "$LOG_FILE"
chown brainstorm:brainstorm "$LOG_FILE" 2>/dev/null || true

# -----------------------------------------------------------------------------
# Bounded, overridable recency window
# -----------------------------------------------------------------------------
# Default cap (6h). Overridable per-invocation with --recency <seconds>.
RECONCILE_RECENT_MAX_RECENCY_SECONDS="${RECONCILE_RECENT_MAX_RECENCY_SECONDS:-21600}"
# Overlap re-scanned on top of the watermark so events that landed during the
# prior run are re-covered; re-scanning already-reconciled authors is idempotent.
RECONCILIATION_OVERLAP_SECONDS="${RECONCILIATION_OVERLAP_SECONDS:-3600}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --recency) RECONCILE_RECENT_MAX_RECENCY_SECONDS="$2"; shift 2 ;;
    *)         shift ;;
  esac
done

log() { echo "$(date): $1" | tee -a "${LOG_FILE}"; }

# -----------------------------------------------------------------------------
# OBS-1 (ADR 0020): guarantee a terminal event on EVERY exit path so a crash
# never reads as "running" forever. Success paths set EMITTED_TERMINAL=1 after
# their TASK_END; any other non-zero exit emits TASK_ERROR here.
# -----------------------------------------------------------------------------
EMITTED_TERMINAL=0
emit_terminal_on_exit() {
  local code=$?
  if [[ "$EMITTED_TERMINAL" -eq 0 && "$code" -ne 0 ]]; then
    emit_task_event "TASK_ERROR" "reconcileRecent" "system" \
      "{\"message\":\"reconcileRecent failed\",\"failed_command\":\"${BASH_COMMAND}\",\"exit_code\":${code},\"status\":\"failed\"}"
  fi
}
trap emit_terminal_on_exit EXIT

check_disk_space() {
  local label=$1
  log "${label} - Checking disk space"
  df -h / | tee -a "${LOG_FILE}"
  du -sh /var/lib/neo4j/data 2>/dev/null | tee -a "${LOG_FILE}" || true
}

function cleanup() {
  log "Starting cleanup"
  rm -f /var/lib/neo4j/import/mutesToAddToNeo4j.json /var/lib/neo4j/import/allKind10000EventsStripped.json /var/lib/neo4j/import/mutesToDeleteFromNeo4j.json
  rm -f /var/lib/neo4j/import/followsToAddToNeo4j.json /var/lib/neo4j/import/allKind3EventsStripped.json /var/lib/neo4j/import/followsToDeleteFromNeo4j.json
  rm -f /var/lib/neo4j/import/reportsToAddToNeo4j.json /var/lib/neo4j/import/allKind1984EventsStripped.json
  rm -f "$BASE_DIR/currentMutesFromStrfry.json" "$BASE_DIR/currentFollowsFromStrfry.json" "$BASE_DIR/currentReportsFromStrfry.json"
  rm -rf "$BASE_DIR/currentRelationshipsFromStrfry"
  mkdir -p "$BASE_DIR/currentRelationshipsFromStrfry/follows" "$BASE_DIR/currentRelationshipsFromStrfry/mutes" "$BASE_DIR/currentRelationshipsFromStrfry/reports"
  rm -rf "$BASE_DIR/currentRelationshipsFromNeo4j"
  mkdir -p "$BASE_DIR/currentRelationshipsFromNeo4j/follows" "$BASE_DIR/currentRelationshipsFromNeo4j/mutes" "$BASE_DIR/currentRelationshipsFromNeo4j/reports"
  chown -R brainstorm:brainstorm "$BASE_DIR/currentRelationshipsFromStrfry" "$BASE_DIR/currentRelationshipsFromNeo4j" 2>/dev/null || true
  log "Completed cleanup"
}

count_lines() { if [[ -f "$1" ]]; then wc -l < "$1" | tr -d ' '; else echo 0; fi; }

neo4j_rel_count() {
  local rel="$1" out
  out=$(cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" --format plain \
        "MATCH ()-[r:${rel}]->() RETURN count(r) AS c;" 2>/dev/null | grep -oE '[0-9]+' | head -1 || true)
  echo "${out:-0}"
}

# strfry-first (so the covered-author set exists before the restricted Neo4j
# extraction), restricted to the recency window. Identical machinery to the old
# recent mode; the follows extractor now runs ONE streamed IN-query internally.
#   $1 extractor.js  $2 strfryToKind*.sh  $3 converter.js  $4 label
extract_and_dump() {
  local extractor="$1" strfry_script="$2" converter="$3" label="$4"
  bash "${strfry_script}" --recent "${SINCE_SECONDS}"
  node "${converter}"
  node "${extractor}" --neo4jUri="${NEO4J_URI}" --neo4jUser="${NEO4J_USER}" --neo4jPassword="${NEO4J_PASSWORD}" \
       --logFile="${LOG_FILE}" --authorsFromDir="${BASE_DIR}/currentRelationshipsFromStrfry/${label}"
}

# Cheap no-drift pre-check: true (0) only when all three kinds parse to zero
# events since the window start — otherwise proceed normally.
no_drift_since() {
  local since_ts="$1" total=0 k c
  for k in 3 10000 1984; do
    c=$(strfry scan --count "{ \"kinds\": [${k}], \"since\": ${since_ts} }" 2>/dev/null | grep -oE '[0-9]+' | tail -1 || true)
    [[ -z "$c" ]] && return 1
    total=$(( total + c ))
  done
  [[ "$total" -eq 0 ]]
}

# -----------------------------------------------------------------------------
# Compute the bounded lookback (NO bootstrap-to-full)
# -----------------------------------------------------------------------------
NOW_UNIX=$(date +%s)
WATERMARK="$(get_watermark)"
if [[ -n "$WATERMARK" ]]; then
  SINCE_SECONDS=$(( NOW_UNIX - WATERMARK + RECONCILIATION_OVERLAP_SECONDS ))
else
  # No watermark (fresh deploy / lost state): use the default window only.
  # reconcileRecent NEVER promotes to a full pass — that is reconcileAll's job.
  SINCE_SECONDS=$RECONCILE_RECENT_MAX_RECENCY_SECONDS
fi
# Cap the lookback at the (overridable) max recency.
if [[ "$SINCE_SECONDS" -gt "$RECONCILE_RECENT_MAX_RECENCY_SECONDS" ]]; then
  SINCE_SECONDS=$RECONCILE_RECENT_MAX_RECENCY_SECONDS
fi
WINDOW_START=$(( NOW_UNIX - SINCE_SECONDS ))

log "Starting reconcileRecent (watermark=${WATERMARK:-none}, lookback=${SINCE_SECONDS}s, max_recency=${RECONCILE_RECENT_MAX_RECENCY_SECONDS}s)"
emit_task_event "TASK_START" "reconcileRecent" "system" "{
    \"description\": \"Recent-window Neo4j <-> strfry reconciliation\",
    \"task\": \"reconcileRecent\",
    \"watermark\": ${WATERMARK:-0},
    \"lookback_seconds\": ${SINCE_SECONDS},
    \"max_recency_seconds\": ${RECONCILE_RECENT_MAX_RECENCY_SECONDS},
    \"targets\": [\"mutes\", \"reports\", \"follows\"],
    \"database\": \"neo4j\"
}"

check_disk_space "Before reconcileRecent"

# Cheap no-drift early-exit.
if no_drift_since "$WINDOW_START"; then
  log "No events since window start — no drift detected; advancing watermark and exiting"
  emit_task_event "PROGRESS" "reconcileRecent" "system" "{\"phase\":\"no_drift\",\"task\":\"reconcileRecent\",\"lookback_seconds\":${SINCE_SECONDS},\"description\":\"no events in window — no drift detected\"}"
  write_state "$NOW_UNIX" "$(date +%s)" "recent" "" "" "" ""
  emit_task_event "TASK_END" "reconcileRecent" "system" "{\"task\":\"reconcileRecent\",\"watermark_advanced_to\":${NOW_UNIX},\"no_drift\":true,\"status\":\"success\"}"
  EMITTED_TERMINAL=1
  exit 0
fi

cleanup

#############################################
# A: PROCESS MUTES (kind 10000)
#############################################
emit_task_event "PROGRESS" "reconcileRecent" "system" "{\"phase\":\"A\",\"phase_name\":\"process_mutes\",\"task\":\"reconcileRecent\",\"operation\":\"phase_start\"}"
PHASE_START=$(date +%s)
MUTES_BEFORE=$(neo4j_rel_count "MUTES")
log "Phase A: mutes — extract + dump"
extract_and_dump "${BASE_DIR}/getCurrentMutesFromNeo4j.js" "${BASE_DIR}/strfryToKind10000Events.sh" "${BASE_DIR}/kind10000EventsToMutes.js" "mutes"
log "Phase A: computing mutes diff"
node "${BASE_DIR}/calculateMutesUpdates.js"
MUTES_ADDED=$(count_lines "${BASE_DIR}/json/mutesToAddToNeo4j.json")
MUTES_DELETED=$(count_lines "${BASE_DIR}/json/mutesToDeleteFromNeo4j.json")
log "Phase A: applying mutes to Neo4j (added=${MUTES_ADDED}, deleted=${MUTES_DELETED})"
mv "$BASE_DIR/json/mutesToAddToNeo4j.json" /var/lib/neo4j/import/mutesToAddToNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_mutesToAddToNeo4j" > /dev/null
mv "$BASE_DIR/json/mutesToDeleteFromNeo4j.json" /var/lib/neo4j/import/mutesToDeleteFromNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_mutesToDeleteFromNeo4j" > /dev/null
mv "$BASE_DIR/allKind10000EventsStripped.json" /var/lib/neo4j/import/allKind10000EventsStripped.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand2_mutes" > /dev/null
MUTES_AFTER=$(neo4j_rel_count "MUTES")
emit_task_event "PROGRESS" "reconcileRecent" "system" "{\"phase\":\"A\",\"phase_name\":\"process_mutes\",\"task\":\"reconcileRecent\",\"operation\":\"drift\",\"added\":${MUTES_ADDED},\"deleted\":${MUTES_DELETED},\"edge_counts_before\":${MUTES_BEFORE},\"edge_counts_after\":${MUTES_AFTER},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\"}"

#############################################
# C: PROCESS REPORTS (kind 1984) — append-only
#############################################
emit_task_event "PROGRESS" "reconcileRecent" "system" "{\"phase\":\"C\",\"phase_name\":\"process_reports\",\"task\":\"reconcileRecent\",\"operation\":\"phase_start\"}"
PHASE_START=$(date +%s)
REPORTS_BEFORE=$(neo4j_rel_count "REPORTS")
log "Phase C: reports — extract + dump"
extract_and_dump "${BASE_DIR}/getCurrentReportsFromNeo4j.js" "${BASE_DIR}/strfryToKind1984Events.sh" "${BASE_DIR}/kind1984EventsToReports.js" "reports"
log "Phase C: computing reports diff"
node "${BASE_DIR}/calculateReportsUpdates.js"
REPORTS_ADDED=$(count_lines "${BASE_DIR}/json/reportsToAddToNeo4j.json")
REPORTS_DELETED=0
log "Phase C: applying reports to Neo4j (added=${REPORTS_ADDED})"
mv "$BASE_DIR/json/reportsToAddToNeo4j.json" /var/lib/neo4j/import/reportsToAddToNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_reportsToAddToNeo4j" > /dev/null
mv "$BASE_DIR/allKind1984EventsStripped.json" /var/lib/neo4j/import/allKind1984EventsStripped.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand2_reports" > /dev/null
REPORTS_AFTER=$(neo4j_rel_count "REPORTS")
emit_task_event "PROGRESS" "reconcileRecent" "system" "{\"phase\":\"C\",\"phase_name\":\"process_reports\",\"task\":\"reconcileRecent\",\"operation\":\"drift\",\"added\":${REPORTS_ADDED},\"deleted\":${REPORTS_DELETED},\"edge_counts_before\":${REPORTS_BEFORE},\"edge_counts_after\":${REPORTS_AFTER},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\"}"

#############################################
# B: PROCESS FOLLOWS (kind 3)
#############################################
emit_task_event "PROGRESS" "reconcileRecent" "system" "{\"phase\":\"B\",\"phase_name\":\"process_follows\",\"task\":\"reconcileRecent\",\"operation\":\"phase_start\"}"
PHASE_START=$(date +%s)
FOLLOWS_BEFORE=$(neo4j_rel_count "FOLLOWS")
log "Phase B: follows — extract + dump"
extract_and_dump "${BASE_DIR}/getCurrentFollowsFromNeo4j.js" "${BASE_DIR}/strfryToKind3Events.sh" "${BASE_DIR}/kind3EventsToFollows.js" "follows"
log "Phase B: computing follows diff"
node "${BASE_DIR}/calculateFollowsUpdates.js"
FOLLOWS_ADDED=$(count_lines "${BASE_DIR}/json/followsToAddToNeo4j.json")
FOLLOWS_DELETED=$(count_lines "${BASE_DIR}/json/followsToDeleteFromNeo4j.json")
log "Phase B: applying follows to Neo4j (added=${FOLLOWS_ADDED}, deleted=${FOLLOWS_DELETED})"
mv "$BASE_DIR/json/followsToAddToNeo4j.json" /var/lib/neo4j/import/followsToAddToNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_followsToAddToNeo4j" > /dev/null
mv "$BASE_DIR/json/followsToDeleteFromNeo4j.json" /var/lib/neo4j/import/followsToDeleteFromNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_followsToDeleteFromNeo4j" > /dev/null
mv "$BASE_DIR/allKind3EventsStripped.json" /var/lib/neo4j/import/allKind3EventsStripped.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand2_follows" > /dev/null
FOLLOWS_AFTER=$(neo4j_rel_count "FOLLOWS")
emit_task_event "PROGRESS" "reconcileRecent" "system" "{\"phase\":\"B\",\"phase_name\":\"process_follows\",\"task\":\"reconcileRecent\",\"operation\":\"drift\",\"added\":${FOLLOWS_ADDED},\"deleted\":${FOLLOWS_DELETED},\"edge_counts_before\":${FOLLOWS_BEFORE},\"edge_counts_after\":${FOLLOWS_AFTER},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\"}"

log "Projecting followsGraph into memory"
bash "$BRAINSTORM_MODULE_SRC_DIR/algos/projectFollowsGraphIntoMemory.sh"

cleanup
check_disk_space "At end of reconcileRecent"

# Advance the watermark on success.
RUN_COMPLETED=$(date +%s)
write_state "$NOW_UNIX" "$RUN_COMPLETED" "recent" "" "$FOLLOWS_AFTER" "$MUTES_AFTER" "$REPORTS_AFTER"

log "Finished reconcileRecent"
emit_task_event "TASK_END" "reconcileRecent" "system" "{
    \"task\": \"reconcileRecent\",
    \"watermark_advanced_to\": ${NOW_UNIX},
    \"drift\": {
        \"follows\": { \"added\": ${FOLLOWS_ADDED}, \"deleted\": ${FOLLOWS_DELETED} },
        \"mutes\":   { \"added\": ${MUTES_ADDED},   \"deleted\": ${MUTES_DELETED} },
        \"reports\": { \"added\": ${REPORTS_ADDED}, \"deleted\": ${REPORTS_DELETED} }
    },
    \"status\": \"success\",
    \"database\": \"neo4j\"
}"
EMITTED_TERMINAL=1
exit 0
