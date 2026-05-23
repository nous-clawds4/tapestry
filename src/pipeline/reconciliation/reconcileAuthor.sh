#!/bin/bash
set -e          # Exit immediately on command failure
set -o pipefail # Fail if any pipeline command fails

# reconcileAuthor.sh
# Story #23 / ADR 0020 — independent, guarantee-specific reconcile task.
#
# Guarantee: single-author consistency. Reconciles exactly ONE author's
# relationships (kind 3 / 10000 / 1984), on demand. NOT neo4j-heavy: a tiny
# point write that stays responsive for interactive triggers (e.g. a "reconcile
# my profile" button) and never queues behind a sweep.
#
# Usage:  reconcileAuthor.sh --pubkey <64-hex>
#
# Does NOT touch the sweep watermark (state.json) and does NOT trigger the GDS
# follows-graph reprojection — a single-author change doesn't warrant either
# (ADR 0018 §Impl 2 reasoning, retained). The trigger surfaces (profile-page
# button, /api/reconcile-author, per-customer scheduling) are a follow-up story;
# this script delivers the engine only.

source /etc/brainstorm.conf
source /usr/local/lib/node_modules/brainstorm/src/utils/structuredLogging.sh

BASE_DIR_RECONCILIATION="/usr/local/lib/node_modules/brainstorm/src/pipeline/reconciliation"
BASE_DIR=${BASE_DIR_RECONCILIATION:-"/usr/local/lib/node_modules/brainstorm/src/pipeline/reconciliation"}
LOG_DIR=${BRAINSTORM_LOG_DIR:-"/var/log/brainstorm"}
APOC_COMMANDS_DIR="${BASE_DIR}/apocCypherCommands"
mkdir -p "${APOC_COMMANDS_DIR}"
LOG_FILE="${LOG_DIR}/reconciliation.log"
touch "$LOG_FILE"; chown brainstorm:brainstorm "$LOG_FILE" 2>/dev/null || true

TASK_NAME="reconcileAuthor"
PUBKEY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pubkey) PUBKEY="$2"; shift 2 ;;
    *)        shift ;;
  esac
done

log() { echo "$(date): $1" | tee -a "${LOG_FILE}"; }

# OBS-1 (ADR 0020): terminal event on EVERY exit path.
EMITTED_TERMINAL=0
emit_terminal_on_exit() {
  local code=$?
  if [[ "$EMITTED_TERMINAL" -eq 0 && "$code" -ne 0 ]]; then
    emit_task_event "TASK_ERROR" "reconcileAuthor" "system" \
      "{\"message\":\"reconcileAuthor failed\",\"failed_command\":\"${BASH_COMMAND}\",\"exit_code\":${code},\"pubkey\":\"${PUBKEY}\",\"status\":\"failed\"}"
  fi
}
trap emit_terminal_on_exit EXIT

# Validate pubkey: required and 64-hex.
fail() { log "ERROR: $1"; emit_task_event "TASK_ERROR" "reconcileAuthor" "system" "{\"message\":\"$1\",\"status\":\"failed\"}"; EMITTED_TERMINAL=1; exit 1; }
if [[ -z "$PUBKEY" ]]; then fail "--pubkey <hex> is required"; fi
if [[ ! "$PUBKEY" =~ ^[0-9a-fA-F]{64}$ ]]; then fail "--pubkey must be a 64-character hex string (got: '${PUBKEY}')"; fi
PUBKEY=$(printf '%s' "$PUBKEY" | tr 'A-F' 'a-f')

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

# Single-author: strfry --author limits the dump to this one pubkey; the
# converter writes one per-pubkey file; the extractor --authorsFromDir runs the
# streamed WHERE u.pubkey IN $list query with a one-element list.
extract_and_dump_author() {
  local extractor="$1" strfry_script="$2" converter="$3" label="$4"
  bash "${strfry_script}" --author "${PUBKEY}"
  node "${converter}"
  node "${extractor}" --neo4jUri="${NEO4J_URI}" --neo4jUser="${NEO4J_USER}" --neo4jPassword="${NEO4J_PASSWORD}" \
       --logFile="${LOG_FILE}" --authorsFromDir="${BASE_DIR}/currentRelationshipsFromStrfry/${label}"
}

log "Starting ${TASK_NAME} (pubkey=${PUBKEY})"
emit_task_event "TASK_START" "reconcileAuthor" "system" "{
    \"description\": \"Single-author Neo4j <-> strfry reconciliation\",
    \"task\": \"${TASK_NAME}\",
    \"pubkey\": \"${PUBKEY}\",
    \"targets\": [\"mutes\", \"reports\", \"follows\"],
    \"database\": \"neo4j\"
}"
cleanup

#############################################
# A: MUTES (kind 10000) — single author
#############################################
emit_task_event "PROGRESS" "reconcileAuthor" "system" "{\"phase\":\"A\",\"phase_name\":\"process_mutes\",\"task\":\"${TASK_NAME}\",\"pubkey\":\"${PUBKEY}\",\"operation\":\"phase_start\"}"
PHASE_START=$(date +%s)
log "Phase A: mutes — extract + dump (author ${PUBKEY:0:8}…)"
extract_and_dump_author "${BASE_DIR}/getCurrentMutesFromNeo4j.js" "${BASE_DIR}/strfryToKind10000Events.sh" "${BASE_DIR}/kind10000EventsToMutes.js" "mutes"
node "${BASE_DIR}/calculateMutesUpdates.js"
MUTES_ADDED=$(count_lines "${BASE_DIR}/json/mutesToAddToNeo4j.json"); MUTES_DELETED=$(count_lines "${BASE_DIR}/json/mutesToDeleteFromNeo4j.json")
log "Phase A: applying mutes (added=${MUTES_ADDED}, deleted=${MUTES_DELETED})"
mv "$BASE_DIR/json/mutesToAddToNeo4j.json" /var/lib/neo4j/import/mutesToAddToNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_mutesToAddToNeo4j" > /dev/null
mv "$BASE_DIR/json/mutesToDeleteFromNeo4j.json" /var/lib/neo4j/import/mutesToDeleteFromNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_mutesToDeleteFromNeo4j" > /dev/null
mv "$BASE_DIR/allKind10000EventsStripped.json" /var/lib/neo4j/import/allKind10000EventsStripped.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand2_mutes" > /dev/null
emit_task_event "PROGRESS" "reconcileAuthor" "system" "{\"phase\":\"A\",\"phase_name\":\"process_mutes\",\"task\":\"${TASK_NAME}\",\"pubkey\":\"${PUBKEY}\",\"operation\":\"drift\",\"added\":${MUTES_ADDED},\"deleted\":${MUTES_DELETED},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\"}"

#############################################
# C: REPORTS (kind 1984) — single author, append-only
#############################################
emit_task_event "PROGRESS" "reconcileAuthor" "system" "{\"phase\":\"C\",\"phase_name\":\"process_reports\",\"task\":\"${TASK_NAME}\",\"pubkey\":\"${PUBKEY}\",\"operation\":\"phase_start\"}"
PHASE_START=$(date +%s)
log "Phase C: reports — extract + dump (author ${PUBKEY:0:8}…)"
extract_and_dump_author "${BASE_DIR}/getCurrentReportsFromNeo4j.js" "${BASE_DIR}/strfryToKind1984Events.sh" "${BASE_DIR}/kind1984EventsToReports.js" "reports"
node "${BASE_DIR}/calculateReportsUpdates.js"
REPORTS_ADDED=$(count_lines "${BASE_DIR}/json/reportsToAddToNeo4j.json"); REPORTS_DELETED=0
log "Phase C: applying reports (added=${REPORTS_ADDED})"
mv "$BASE_DIR/json/reportsToAddToNeo4j.json" /var/lib/neo4j/import/reportsToAddToNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_reportsToAddToNeo4j" > /dev/null
mv "$BASE_DIR/allKind1984EventsStripped.json" /var/lib/neo4j/import/allKind1984EventsStripped.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand2_reports" > /dev/null
emit_task_event "PROGRESS" "reconcileAuthor" "system" "{\"phase\":\"C\",\"phase_name\":\"process_reports\",\"task\":\"${TASK_NAME}\",\"pubkey\":\"${PUBKEY}\",\"operation\":\"drift\",\"added\":${REPORTS_ADDED},\"deleted\":${REPORTS_DELETED},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\"}"

#############################################
# B: FOLLOWS (kind 3) — single author
#############################################
emit_task_event "PROGRESS" "reconcileAuthor" "system" "{\"phase\":\"B\",\"phase_name\":\"process_follows\",\"task\":\"${TASK_NAME}\",\"pubkey\":\"${PUBKEY}\",\"operation\":\"phase_start\"}"
PHASE_START=$(date +%s)
log "Phase B: follows — extract + dump (author ${PUBKEY:0:8}…)"
extract_and_dump_author "${BASE_DIR}/getCurrentFollowsFromNeo4j.js" "${BASE_DIR}/strfryToKind3Events.sh" "${BASE_DIR}/kind3EventsToFollows.js" "follows"
node "${BASE_DIR}/calculateFollowsUpdates.js"
FOLLOWS_ADDED=$(count_lines "${BASE_DIR}/json/followsToAddToNeo4j.json"); FOLLOWS_DELETED=$(count_lines "${BASE_DIR}/json/followsToDeleteFromNeo4j.json")
log "Phase B: applying follows (added=${FOLLOWS_ADDED}, deleted=${FOLLOWS_DELETED})"
mv "$BASE_DIR/json/followsToAddToNeo4j.json" /var/lib/neo4j/import/followsToAddToNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_followsToAddToNeo4j" > /dev/null
mv "$BASE_DIR/json/followsToDeleteFromNeo4j.json" /var/lib/neo4j/import/followsToDeleteFromNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_followsToDeleteFromNeo4j" > /dev/null
mv "$BASE_DIR/allKind3EventsStripped.json" /var/lib/neo4j/import/allKind3EventsStripped.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand2_follows" > /dev/null
emit_task_event "PROGRESS" "reconcileAuthor" "system" "{\"phase\":\"B\",\"phase_name\":\"process_follows\",\"task\":\"${TASK_NAME}\",\"pubkey\":\"${PUBKEY}\",\"operation\":\"drift\",\"added\":${FOLLOWS_ADDED},\"deleted\":${FOLLOWS_DELETED},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\"}"

# NOTE: NO projectFollowsGraphIntoMemory (single-author change does not warrant
# a full GDS reprojection — ADR 0018 §Impl 2 reasoning, retained).
# NOTE: NO watermark write (reconcileAuthor is orthogonal to the sweep cadence).

cleanup
log "Finished ${TASK_NAME}"
emit_task_event "TASK_END" "reconcileAuthor" "system" "{
    \"task\": \"${TASK_NAME}\", \"pubkey\": \"${PUBKEY}\",
    \"drift\": {
        \"follows\": { \"added\": ${FOLLOWS_ADDED}, \"deleted\": ${FOLLOWS_DELETED} },
        \"mutes\":   { \"added\": ${MUTES_ADDED},   \"deleted\": ${MUTES_DELETED} },
        \"reports\": { \"added\": ${REPORTS_ADDED}, \"deleted\": ${REPORTS_DELETED} }
    },
    \"status\": \"success\", \"database\": \"neo4j\"
}"
EMITTED_TERMINAL=1
exit 0
