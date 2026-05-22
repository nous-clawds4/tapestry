#!/bin/bash
set -e          # Exit immediately on command failure
set -o pipefail # Fail if any pipeline command fails

# reconciliation.sh
# Main orchestrator for reconciling the Neo4j social graph with strfry
# (the canonical nostr event store) — FOLLOWS / MUTES / REPORTS edges derived
# from kind 3 / 10000 / 1984 events.
#
# Story #21 / ADR 0018 — one engine, three author-scoped modes:
#   --mode recent           Incremental sweep: only authors with an event since
#                           the persisted watermark. The routine (~10 min) task.
#                           Bootstraps with a full pass if no watermark exists.
#   --mode all              Full sweep over every author (today's behavior). The
#                           correctness oracle and weekly drift-recovery fallback.
#   --mode author --pubkey  Reconcile a single author. No watermark; on-demand.
#
# recent/author restrict BOTH the strfry dump AND the Neo4j extraction to the
# SAME covered author set (the correctness invariant — see ADR 0018 §Option A),
# then reuse the existing diff + APOC apply verbatim.

# Source environment configuration
source /etc/brainstorm.conf

# Source structured logging utility
source /usr/local/lib/node_modules/brainstorm/src/utils/structuredLogging.sh

BASE_DIR_RECONCILIATION="/usr/local/lib/node_modules/brainstorm/src/pipeline/reconciliation"
BASE_DIR=${BASE_DIR_RECONCILIATION:-"/usr/local/lib/node_modules/brainstorm/src/pipeline/reconciliation"}
LOG_DIR=${BRAINSTORM_LOG_DIR:-"/var/log/brainstorm"}
APOC_COMMANDS_DIR="${BASE_DIR}/apocCypherCommands"

# Persisted watermark helper (get_watermark / write_state / get_last_full_completed)
source "${BASE_DIR}/reconciliationState.sh"

mkdir -p "${APOC_COMMANDS_DIR}"

LOG_FILE="${LOG_DIR}/reconciliation.log"
touch $LOG_FILE
chown brainstorm:brainstorm $LOG_FILE

# -----------------------------------------------------------------------------
# Argument parsing — mode + pubkey
# -----------------------------------------------------------------------------
MODE="recent"
PUBKEY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)   MODE="$2"; shift 2 ;;
    --pubkey) PUBKEY="$2"; shift 2 ;;
    *)        shift ;;
  esac
done

# Overlap window (seconds) re-scanned on top of the watermark so events that
# landed during the prior run are re-covered; re-scanning is idempotent.
RECONCILIATION_OVERLAP_SECONDS="${RECONCILIATION_OVERLAP_SECONDS:-3600}"

# Function for logging
log() {
  echo "$(date): $1" | tee -a "${LOG_FILE}"
}

# Function to check disk space
check_disk_space() {
  local label=$1
  log "${label} - Checking disk space"
  log "${label} - Overall disk usage:"
  df -h / | tee -a "${LOG_FILE}"
  log "${label} - Neo4j data directory size:"
  du -sh /var/lib/neo4j/data | tee -a "${LOG_FILE}"
  log "${label} - Neo4j transaction logs size:"
  du -sh /var/lib/neo4j/data/transactions | tee -a "${LOG_FILE}"
}

emit_function_error() {
  local function_name="$1"
  local line_number="$2"
  local exit_code="$3"
  local last_command="${BASH_COMMAND}"

  local error_metadata=$(jq -n \
    --arg message "Function failure in reconciliation script" \
    --arg function "$function_name" \
    --argjson line_number "$line_number" \
    --argjson exit_code "$exit_code" \
    --arg failed_command "$last_command" \
    --arg phase "pre_phase_A" \
    --arg context "cleanup_operations" \
    --arg category "function_error" \
    --arg scope "system" \
    '{
      message: $message,
      function: $function,
      line_number: $line_number,
      exit_code: $exit_code,
      failed_command: $failed_command,
      phase: $phase,
      context: $context,
      category: $category,
      scope: $scope
    }')
  emit_task_event "TASK_ERROR" "reconciliation" "system" "$error_metadata"
}

# create function for cleaning up
function cleanup() {
  log "Starting cleanup"
  set -e
  trap 'emit_function_error "cleanup" "$LINENO" "$?"' ERR

  # clean up mutes
  rm -f /var/lib/neo4j/import/mutesToAddToNeo4j.json
  rm -f /var/lib/neo4j/import/allKind10000EventsStripped.json
  rm -f /var/lib/neo4j/import/mutesToDeleteFromNeo4j.json
  # clean up follows
  rm -f /var/lib/neo4j/import/followsToAddToNeo4j.json
  rm -f /var/lib/neo4j/import/allKind3EventsStripped.json
  rm -f /var/lib/neo4j/import/followsToDeleteFromNeo4j.json
  # clean up reports
  rm -f /var/lib/neo4j/import/reportsToAddToNeo4j.json
  rm -f /var/lib/neo4j/import/allKind1984EventsStripped.json

  # clean up current relationships from base directory
  rm -f $BASE_DIR/currentMutesFromStrfry.json
  rm -f $BASE_DIR/currentFollowsFromStrfry.json
  rm -f $BASE_DIR/currentReportsFromStrfry.json

  # clean up reconciliation/currentRelationshipsFromStrfry (fresh per run)
  rm -rf $BASE_DIR/currentRelationshipsFromStrfry
  mkdir -p $BASE_DIR/currentRelationshipsFromStrfry/follows
  mkdir -p $BASE_DIR/currentRelationshipsFromStrfry/mutes
  mkdir -p $BASE_DIR/currentRelationshipsFromStrfry/reports
  chown -R brainstorm:brainstorm $BASE_DIR/currentRelationshipsFromStrfry

  # clean up reconciliation/currentRelationshipsFromNeo4j (fresh per run)
  rm -rf $BASE_DIR/currentRelationshipsFromNeo4j
  mkdir -p $BASE_DIR/currentRelationshipsFromNeo4j/follows
  mkdir -p $BASE_DIR/currentRelationshipsFromNeo4j/mutes
  mkdir -p $BASE_DIR/currentRelationshipsFromNeo4j/reports
  chown -R brainstorm:brainstorm $BASE_DIR/currentRelationshipsFromNeo4j

  log "Completed cleanup"
  trap - ERR
}

# -----------------------------------------------------------------------------
# Helpers (story #21 / ADR 0018)
# -----------------------------------------------------------------------------

# Count the JSONL lines (= edges) in a diff output file; 0 if absent.
count_lines() {
  if [[ -f "$1" ]]; then wc -l < "$1" | tr -d ' '; else echo 0; fi
}

# Cheap Neo4j relationship count via the count store; 0 on any failure.
neo4j_rel_count() {
  local rel="$1" out
  out=$(cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" --format plain \
        "MATCH ()-[r:${rel}]->() RETURN count(r) AS c;" 2>/dev/null | grep -oE '[0-9]+' | head -1 || true)
  echo "${out:-0}"
}

# Extract current Neo4j state + dump/convert strfry events for one kind, ordered
# by mode. In all mode: Neo4j-first (full). In recent/author: strfry-first so the
# covered author set exists before the (restricted) Neo4j extraction runs.
#   $1 extractor.js   $2 strfryToKind*.sh   $3 converter.js   $4 label(follows|mutes|reports)
extract_and_dump() {
  local extractor="$1" strfry_script="$2" converter="$3" label="$4"
  local strfry_args="" extractor_args=""

  case "$MODE" in
    recent) strfry_args="--recent ${SINCE_SECONDS}" ;;
    author) strfry_args="--author ${PUBKEY}" ;;
  esac
  if [[ "$MODE" != "all" ]]; then
    extractor_args="--authorsFromDir=${BASE_DIR}/currentRelationshipsFromStrfry/${label}"
  fi

  if [[ "$MODE" == "all" ]]; then
    node "${extractor}" --neo4jUri="${NEO4J_URI}" --neo4jUser="${NEO4J_USER}" --neo4jPassword="${NEO4J_PASSWORD}" --logFile="${LOG_FILE}"
    bash "${strfry_script}" ${strfry_args}
    node "${converter}"
  else
    bash "${strfry_script}" ${strfry_args}
    node "${converter}"
    node "${extractor}" --neo4jUri="${NEO4J_URI}" --neo4jUser="${NEO4J_USER}" --neo4jPassword="${NEO4J_PASSWORD}" --logFile="${LOG_FILE}" ${extractor_args}
  fi
}

# Cheap no-drift pre-check (recent mode). True (0) only when all three kinds
# parse to zero events since the watermark — otherwise proceed normally.
no_drift_since() {
  local since_ts="$1" total=0 k c
  for k in 3 10000 1984; do
    c=$(strfry scan --count "{ \"kinds\": [${k}], \"since\": ${since_ts} }" 2>/dev/null | grep -oE '[0-9]+' | tail -1 || true)
    [[ -z "$c" ]] && return 1   # parse uncertain → do NOT early-exit
    total=$(( total + c ))
  done
  [[ "$total" -eq 0 ]]
}

# -----------------------------------------------------------------------------
# Mode resolution + watermark
# -----------------------------------------------------------------------------
NOW_UNIX=$(date +%s)
REQUESTED_MODE="$MODE"
BOOTSTRAP="false"
WATERMARK="$(get_watermark)"
SINCE_SECONDS=0

if [[ "$MODE" == "author" ]]; then
  if [[ -z "$PUBKEY" ]]; then
    log "ERROR: --mode author requires --pubkey <hex>"
    exit 1
  fi
elif [[ "$MODE" == "recent" ]]; then
  if [[ -z "$WATERMARK" ]]; then
    # First run after deploy (or lost/corrupt watermark): bootstrap with a full
    # pass to establish a baseline, then the watermark is written on success.
    BOOTSTRAP="true"
    MODE="all"
    log "No watermark found — bootstrapping with a full reconciliation pass (mode=all)"
  else
    SINCE_SECONDS=$(( NOW_UNIX - WATERMARK + RECONCILIATION_OVERLAP_SECONDS ))
  fi
elif [[ "$MODE" != "all" ]]; then
  log "ERROR: unknown --mode '${MODE}' (expected recent|all|author)"
  exit 1
fi

log "Starting reconciliation (requested mode=${REQUESTED_MODE}, effective mode=${MODE}, bootstrap=${BOOTSTRAP}, watermark=${WATERMARK:-none})"

emit_task_event "TASK_START" "reconciliation" "system" "{
    \"description\": \"Neo4j <-> strfry reconciliation\",
    \"mode\": \"${MODE}\",
    \"requested_mode\": \"${REQUESTED_MODE}\",
    \"bootstrap\": ${BOOTSTRAP},
    \"watermark\": ${WATERMARK:-0},
    \"pubkey\": \"${PUBKEY}\",
    \"targets\": [\"mutes\", \"reports\", \"follows\"],
    \"database\": \"neo4j\"
}"

check_disk_space "Before reconciliation"

# Cheap no-drift early-exit (recent mode only).
if [[ "$MODE" == "recent" ]] && no_drift_since "$(( WATERMARK - RECONCILIATION_OVERLAP_SECONDS ))"; then
  log "No events since watermark — no drift detected; advancing watermark and exiting"
  emit_task_event "PROGRESS" "reconciliation" "system" "{\"phase\":\"no_drift\",\"mode\":\"recent\",\"watermark\":${WATERMARK},\"description\":\"no events since watermark — no drift detected\"}"
  write_state "$NOW_UNIX" "$(date +%s)" "recent"
  emit_task_event "TASK_END" "reconciliation" "system" "{\"mode\":\"recent\",\"bootstrap\":false,\"watermark_advanced_to\":${NOW_UNIX},\"no_drift\":true,\"status\":\"success\"}"
  exit 0
fi

# cleanup, to cover the possibility that the prior run was interrupted
cleanup

#############################################
# A: PROCESS MUTES (kind 10000)
#############################################
emit_task_event "PROGRESS" "reconciliation" "system" "{\"phase\":\"A\",\"phase_name\":\"process_mutes\",\"mode\":\"${MODE}\",\"operation\":\"phase_start\"}"
PHASE_START=$(date +%s)
MUTES_BEFORE=$(neo4j_rel_count "MUTES")

log "Phase A: mutes — extract + dump (mode=${MODE})"
extract_and_dump \
  "${BASE_DIR}/getCurrentMutesFromNeo4j.js" \
  "${BASE_DIR}/strfryToKind10000Events.sh" \
  "${BASE_DIR}/kind10000EventsToMutes.js" \
  "mutes"

log "Phase A: computing mutes diff"
node "${BASE_DIR}/calculateMutesUpdates.js"
MUTES_ADDED=$(count_lines "${BASE_DIR}/json/mutesToAddToNeo4j.json")
MUTES_DELETED=$(count_lines "${BASE_DIR}/json/mutesToDeleteFromNeo4j.json")

log "Phase A: applying mutes to Neo4j (added=${MUTES_ADDED}, deleted=${MUTES_DELETED})"
mv $BASE_DIR/json/mutesToAddToNeo4j.json /var/lib/neo4j/import/mutesToAddToNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_mutesToAddToNeo4j" > /dev/null
mv $BASE_DIR/json/mutesToDeleteFromNeo4j.json /var/lib/neo4j/import/mutesToDeleteFromNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_mutesToDeleteFromNeo4j" > /dev/null
mv $BASE_DIR/allKind10000EventsStripped.json /var/lib/neo4j/import/allKind10000EventsStripped.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand2_mutes" > /dev/null

MUTES_AFTER=$(neo4j_rel_count "MUTES")
emit_task_event "PROGRESS" "reconciliation" "system" "{\"phase\":\"A\",\"phase_name\":\"process_mutes\",\"mode\":\"${MODE}\",\"operation\":\"drift\",\"added\":${MUTES_ADDED},\"deleted\":${MUTES_DELETED},\"edge_counts_before\":${MUTES_BEFORE},\"edge_counts_after\":${MUTES_AFTER},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\"}"

#############################################
# C: PROCESS REPORTS (kind 1984) — append-only, no deletes
#############################################
emit_task_event "PROGRESS" "reconciliation" "system" "{\"phase\":\"C\",\"phase_name\":\"process_reports\",\"mode\":\"${MODE}\",\"operation\":\"phase_start\"}"
PHASE_START=$(date +%s)
REPORTS_BEFORE=$(neo4j_rel_count "REPORTS")

log "Phase C: reports — extract + dump (mode=${MODE})"
extract_and_dump \
  "${BASE_DIR}/getCurrentReportsFromNeo4j.js" \
  "${BASE_DIR}/strfryToKind1984Events.sh" \
  "${BASE_DIR}/kind1984EventsToReports.js" \
  "reports"

log "Phase C: computing reports diff"
node "${BASE_DIR}/calculateReportsUpdates.js"
REPORTS_ADDED=$(count_lines "${BASE_DIR}/json/reportsToAddToNeo4j.json")
REPORTS_DELETED=0

log "Phase C: applying reports to Neo4j (added=${REPORTS_ADDED})"
mv $BASE_DIR/json/reportsToAddToNeo4j.json /var/lib/neo4j/import/reportsToAddToNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_reportsToAddToNeo4j" > /dev/null
mv $BASE_DIR/allKind1984EventsStripped.json /var/lib/neo4j/import/allKind1984EventsStripped.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand2_reports" > /dev/null

REPORTS_AFTER=$(neo4j_rel_count "REPORTS")
emit_task_event "PROGRESS" "reconciliation" "system" "{\"phase\":\"C\",\"phase_name\":\"process_reports\",\"mode\":\"${MODE}\",\"operation\":\"drift\",\"added\":${REPORTS_ADDED},\"deleted\":${REPORTS_DELETED},\"edge_counts_before\":${REPORTS_BEFORE},\"edge_counts_after\":${REPORTS_AFTER},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\"}"

#############################################
# B: PROCESS FOLLOWS (kind 3)
#############################################
emit_task_event "PROGRESS" "reconciliation" "system" "{\"phase\":\"B\",\"phase_name\":\"process_follows\",\"mode\":\"${MODE}\",\"operation\":\"phase_start\"}"
PHASE_START=$(date +%s)
FOLLOWS_BEFORE=$(neo4j_rel_count "FOLLOWS")

log "Phase B: follows — extract + dump (mode=${MODE})"
extract_and_dump \
  "${BASE_DIR}/getCurrentFollowsFromNeo4j.js" \
  "${BASE_DIR}/strfryToKind3Events.sh" \
  "${BASE_DIR}/kind3EventsToFollows.js" \
  "follows"

log "Phase B: computing follows diff"
node "${BASE_DIR}/calculateFollowsUpdates.js"
FOLLOWS_ADDED=$(count_lines "${BASE_DIR}/json/followsToAddToNeo4j.json")
FOLLOWS_DELETED=$(count_lines "${BASE_DIR}/json/followsToDeleteFromNeo4j.json")

log "Phase B: applying follows to Neo4j (added=${FOLLOWS_ADDED}, deleted=${FOLLOWS_DELETED})"
mv $BASE_DIR/json/followsToAddToNeo4j.json /var/lib/neo4j/import/followsToAddToNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_followsToAddToNeo4j" > /dev/null
mv $BASE_DIR/json/followsToDeleteFromNeo4j.json /var/lib/neo4j/import/followsToDeleteFromNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_followsToDeleteFromNeo4j" > /dev/null
mv $BASE_DIR/allKind3EventsStripped.json /var/lib/neo4j/import/allKind3EventsStripped.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand2_follows" > /dev/null

FOLLOWS_AFTER=$(neo4j_rel_count "FOLLOWS")
emit_task_event "PROGRESS" "reconciliation" "system" "{\"phase\":\"B\",\"phase_name\":\"process_follows\",\"mode\":\"${MODE}\",\"operation\":\"drift\",\"added\":${FOLLOWS_ADDED},\"deleted\":${FOLLOWS_DELETED},\"edge_counts_before\":${FOLLOWS_BEFORE},\"edge_counts_after\":${FOLLOWS_AFTER},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\"}"

# Project followsGraph into memory. A single-author reconcile does not warrant a
# full GDS reprojection, so it is skipped in author mode (ADR 0018 §Impl 2).
if [[ "$MODE" != "author" ]]; then
  log "Projecting followsGraph into memory"
  bash $BRAINSTORM_MODULE_SRC_DIR/algos/projectFollowsGraphIntoMemory.sh
  log "Completed projecting followsGraph into memory"
fi

# CLEAN UP
cleanup
check_disk_space "At end of reconciliation"

# -----------------------------------------------------------------------------
# Persist the watermark on success. author mode is orthogonal — it does NOT
# touch the sweep watermark (ADR 0018 §Impl 1).
# -----------------------------------------------------------------------------
RUN_COMPLETED=$(date +%s)
if [[ "$MODE" == "all" ]]; then
  write_state "$NOW_UNIX" "$RUN_COMPLETED" "all" "$RUN_COMPLETED" "$FOLLOWS_AFTER" "$MUTES_AFTER" "$REPORTS_AFTER"
elif [[ "$MODE" == "recent" ]]; then
  write_state "$NOW_UNIX" "$RUN_COMPLETED" "recent" "" "$FOLLOWS_AFTER" "$MUTES_AFTER" "$REPORTS_AFTER"
fi

log "Finished reconciliation (mode=${MODE}, bootstrap=${BOOTSTRAP})"

emit_task_event "TASK_END" "reconciliation" "system" "{
    \"mode\": \"${MODE}\",
    \"requested_mode\": \"${REQUESTED_MODE}\",
    \"bootstrap\": ${BOOTSTRAP},
    \"watermark_advanced_to\": ${NOW_UNIX},
    \"drift\": {
        \"follows\": { \"added\": ${FOLLOWS_ADDED}, \"deleted\": ${FOLLOWS_DELETED} },
        \"mutes\":   { \"added\": ${MUTES_ADDED},   \"deleted\": ${MUTES_DELETED} },
        \"reports\": { \"added\": ${REPORTS_ADDED}, \"deleted\": ${REPORTS_DELETED} }
    },
    \"status\": \"success\",
    \"database\": \"neo4j\"
}"

# Explicit success exit code for parent script orchestration
exit 0
