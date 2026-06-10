#!/bin/bash
set -e          # Exit immediately on command failure
set -o pipefail # Fail if any pipeline command fails

# reconcileNetwork.sh
# Story #23 / ADR 0020 — independent, guarantee-specific reconcile task.
#
# Guarantee: consistency across a configurable TRUSTED NETWORK, defined by a
# Neo4j property predicate:
#   --influence <x>   include users with  u.influence >= x   (default: the
#                     graperank.conf VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF, 0.05)
#   --hops <n>        include users with  u.hops <= n
# Both may be combined (ANDed). With no args, defaults to influence >= cutoff.
#
# SAFETY: at least one SUBSTANTIVE constraint is required. influence must be > 0
# and hops must be < 999 (999 = the "disconnected" sentinel) — otherwise the
# predicate selects the whole graph, i.e. an unconstrained full scan, which is
# exactly the workload that exhausted Neo4j's transaction memory and crashed.
# The script REFUSES a non-substantive constraint regardless of caller (UI
# prompt, scheduler, or direct trigger) and exits without touching the graph.
#
# Approach B (ADR 0020): the network author set comes from Neo4j (the predicate);
# the strfry side is a full kind-3/10000/1984 dump whose converter output is
# FILTERED to that author set (--filterAuthorsFile); the Neo4j side reuses the
# streamed single-query extractor (--authorsFromDir). No watermark (not time-based).

source /etc/brainstorm.conf
source /usr/local/lib/node_modules/brainstorm/src/utils/structuredLogging.sh
# Default "verified" influence cutoff lives in graperank.conf.
source /etc/graperank.conf 2>/dev/null || true

BASE_DIR_RECONCILIATION="/usr/local/lib/node_modules/brainstorm/src/pipeline/reconciliation"
BASE_DIR=${BASE_DIR_RECONCILIATION:-"/usr/local/lib/node_modules/brainstorm/src/pipeline/reconciliation"}
LOG_DIR=${BRAINSTORM_LOG_DIR:-"/var/log/brainstorm"}
APOC_COMMANDS_DIR="${BASE_DIR}/apocCypherCommands"
mkdir -p "${APOC_COMMANDS_DIR}"
LOG_FILE="${LOG_DIR}/reconciliation.log"
touch "$LOG_FILE"; chown brainstorm:brainstorm "$LOG_FILE" 2>/dev/null || true
NETWORK_AUTHORS_FILE="${BASE_DIR}/network-authors.txt"

log() { echo "$(date): $1" | tee -a "${LOG_FILE}"; }

# OBS-1 (ADR 0020): terminal event on EVERY exit path.
EMITTED_TERMINAL=0
emit_terminal_on_exit() {
  local code=$?
  if [[ "$EMITTED_TERMINAL" -eq 0 && "$code" -ne 0 ]]; then
    emit_task_event "TASK_ERROR" "reconcileNetwork" "system" \
      "{\"message\":\"reconcileNetwork failed\",\"failed_command\":\"${BASH_COMMAND}\",\"exit_code\":${code},\"status\":\"failed\"}"
  fi
}
trap emit_terminal_on_exit EXIT

# -----------------------------------------------------------------------------
# Argument parsing: --influence <decimal> and/or --hops <int>
# -----------------------------------------------------------------------------
INFLUENCE_ACTIVE=0; HOPS_ACTIVE=0; INFLUENCE_CUTOFF=""; HOPS_CUTOFF=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --influence) INFLUENCE_ACTIVE=1; INFLUENCE_CUTOFF="$2"; shift 2 ;;
    --hops)      HOPS_ACTIVE=1;      HOPS_CUTOFF="$2";      shift 2 ;;
    *)           shift ;;
  esac
done

# Default network = "verified" (influence >= graperank.conf cutoff) when nothing given.
if [[ $INFLUENCE_ACTIVE -eq 0 && $HOPS_ACTIVE -eq 0 ]]; then
  INFLUENCE_ACTIVE=1
  INFLUENCE_CUTOFF="${VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF:-0.05}"
fi
if [[ $INFLUENCE_ACTIVE -eq 1 && -z "$INFLUENCE_CUTOFF" ]]; then
  INFLUENCE_CUTOFF="${VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF:-0.05}"
fi

# -----------------------------------------------------------------------------
# SAFETY: refuse a non-substantive constraint (would select the whole graph)
# -----------------------------------------------------------------------------
fail() { log "ERROR: $1"; emit_task_event "TASK_ERROR" "reconcileNetwork" "system" "{\"message\":\"$1\",\"status\":\"failed\"}"; EMITTED_TERMINAL=1; exit 1; }

if [[ $INFLUENCE_ACTIVE -eq 0 && $HOPS_ACTIVE -eq 0 ]]; then
  fail "no substantive network constraint (need --influence >0 and/or --hops <999); refusing to scan the whole graph"
fi
if [[ $INFLUENCE_ACTIVE -eq 1 ]] && ! awk "BEGIN{exit !(${INFLUENCE_CUTOFF} > 0)}" 2>/dev/null; then
  fail "influence cutoff (${INFLUENCE_CUTOFF}) must be > 0 — influence >= 0 selects every user (no constraint)"
fi
if [[ $HOPS_ACTIVE -eq 1 ]] && ! awk "BEGIN{exit !(${HOPS_CUTOFF} < 999)}" 2>/dev/null; then
  fail "hops cutoff (${HOPS_CUTOFF}) must be < 999 — 999 is the disconnected sentinel, so hops <= 999 selects every user (no constraint)"
fi

# Build the Cypher predicate.
PRED=""
[[ $INFLUENCE_ACTIVE -eq 1 ]] && PRED="u.influence >= ${INFLUENCE_CUTOFF}"
if [[ $HOPS_ACTIVE -eq 1 ]]; then
  [[ -n "$PRED" ]] && PRED="${PRED} AND "
  PRED="${PRED}u.hops <= ${HOPS_CUTOFF}"
fi
log "Starting reconcileNetwork (predicate: ${PRED})"

# -----------------------------------------------------------------------------
# Helpers (mirrors reconcileRecent.sh)
# -----------------------------------------------------------------------------
count_lines() { if [[ -f "$1" ]]; then wc -l < "$1" | tr -d ' '; else echo 0; fi; }
neo4j_rel_count() {
  local rel="$1" out
  out=$(cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" --format plain \
        "MATCH ()-[r:${rel}]->() RETURN count(r) AS c;" 2>/dev/null | grep -oE '[0-9]+' | head -1 || true)
  echo "${out:-0}"
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

# Full strfry dump (no time filter); converter FILTERS to the network author set;
# Neo4j side reuses the streamed --authorsFromDir extractor.
#   $1 extractor.js  $2 strfryToKind*.sh  $3 converter.js  $4 label
extract_and_dump() {
  local extractor="$1" strfry_script="$2" converter="$3" label="$4"
  bash "${strfry_script}"
  node "${converter}" --filterAuthorsFile="${NETWORK_AUTHORS_FILE}"
  node "${extractor}" --neo4jUri="${NEO4J_URI}" --neo4jUser="${NEO4J_USER}" --neo4jPassword="${NEO4J_PASSWORD}" \
       --logFile="${LOG_FILE}" --authorsFromDir="${BASE_DIR}/currentRelationshipsFromStrfry/${label}"
}

# -----------------------------------------------------------------------------
# Resolve the network author set from Neo4j (the predicate)
# -----------------------------------------------------------------------------
log "Resolving network authors (WHERE ${PRED})"
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" --format plain \
  "MATCH (u:NostrUser) WHERE ${PRED} RETURN u.pubkey AS pubkey;" 2>/dev/null \
  | grep -oE '[0-9a-f]{64}' > "$NETWORK_AUTHORS_FILE" || true
NETWORK_COUNT=$(count_lines "$NETWORK_AUTHORS_FILE")
log "Network author set: ${NETWORK_COUNT} users"

emit_task_event "TASK_START" "reconcileNetwork" "system" "{
    \"description\": \"Trusted-network Neo4j <-> strfry reconciliation\",
    \"task\": \"reconcileNetwork\",
    \"influence_active\": ${INFLUENCE_ACTIVE}, \"influence_cutoff\": \"${INFLUENCE_CUTOFF:-}\",
    \"hops_active\": ${HOPS_ACTIVE}, \"hops_cutoff\": \"${HOPS_CUTOFF:-}\",
    \"predicate\": \"${PRED}\", \"network_count\": ${NETWORK_COUNT},
    \"targets\": [\"mutes\", \"reports\", \"follows\"], \"database\": \"neo4j\"
}"

if [[ "$NETWORK_COUNT" -eq 0 ]]; then
  log "Network author set is empty — nothing to reconcile"
  emit_task_event "TASK_END" "reconcileNetwork" "system" "{\"task\":\"reconcileNetwork\",\"network_count\":0,\"status\":\"success\"}"
  EMITTED_TERMINAL=1
  exit 0
fi

cleanup

#############################################
# A: MUTES (kind 10000)
#############################################
emit_task_event "PROGRESS" "reconcileNetwork" "system" "{\"phase\":\"A\",\"phase_name\":\"process_mutes\",\"task\":\"reconcileNetwork\",\"operation\":\"phase_start\"}"
PHASE_START=$(date +%s); MUTES_BEFORE=$(neo4j_rel_count "MUTES")
log "Phase A: mutes — extract + dump"
extract_and_dump "${BASE_DIR}/getCurrentMutesFromNeo4j.js" "${BASE_DIR}/strfryToKind10000Events.sh" "${BASE_DIR}/kind10000EventsToMutes.js" "mutes"
log "Phase A: computing mutes diff"
node "${BASE_DIR}/calculateMutesUpdates.js"
MUTES_ADDED=$(count_lines "${BASE_DIR}/json/mutesToAddToNeo4j.json"); MUTES_DELETED=$(count_lines "${BASE_DIR}/json/mutesToDeleteFromNeo4j.json")
log "Phase A: applying mutes (added=${MUTES_ADDED}, deleted=${MUTES_DELETED})"
mv "$BASE_DIR/json/mutesToAddToNeo4j.json" /var/lib/neo4j/import/mutesToAddToNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_mutesToAddToNeo4j" > /dev/null
mv "$BASE_DIR/json/mutesToDeleteFromNeo4j.json" /var/lib/neo4j/import/mutesToDeleteFromNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_mutesToDeleteFromNeo4j" > /dev/null
mv "$BASE_DIR/allKind10000EventsStripped.json" /var/lib/neo4j/import/allKind10000EventsStripped.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand2_mutes" > /dev/null
MUTES_AFTER=$(neo4j_rel_count "MUTES")
emit_task_event "PROGRESS" "reconcileNetwork" "system" "{\"phase\":\"A\",\"phase_name\":\"process_mutes\",\"task\":\"reconcileNetwork\",\"operation\":\"drift\",\"added\":${MUTES_ADDED},\"deleted\":${MUTES_DELETED},\"edge_counts_before\":${MUTES_BEFORE},\"edge_counts_after\":${MUTES_AFTER},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\"}"

#############################################
# C: REPORTS (kind 1984) — append-only
#############################################
emit_task_event "PROGRESS" "reconcileNetwork" "system" "{\"phase\":\"C\",\"phase_name\":\"process_reports\",\"task\":\"reconcileNetwork\",\"operation\":\"phase_start\"}"
PHASE_START=$(date +%s); REPORTS_BEFORE=$(neo4j_rel_count "REPORTS")
log "Phase C: reports — extract + dump"
extract_and_dump "${BASE_DIR}/getCurrentReportsFromNeo4j.js" "${BASE_DIR}/strfryToKind1984Events.sh" "${BASE_DIR}/kind1984EventsToReports.js" "reports"
log "Phase C: computing reports diff"
node "${BASE_DIR}/calculateReportsUpdates.js"
REPORTS_ADDED=$(count_lines "${BASE_DIR}/json/reportsToAddToNeo4j.json"); REPORTS_DELETED=0
log "Phase C: applying reports (added=${REPORTS_ADDED})"
mv "$BASE_DIR/json/reportsToAddToNeo4j.json" /var/lib/neo4j/import/reportsToAddToNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_reportsToAddToNeo4j" > /dev/null
mv "$BASE_DIR/allKind1984EventsStripped.json" /var/lib/neo4j/import/allKind1984EventsStripped.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand2_reports" > /dev/null
REPORTS_AFTER=$(neo4j_rel_count "REPORTS")
emit_task_event "PROGRESS" "reconcileNetwork" "system" "{\"phase\":\"C\",\"phase_name\":\"process_reports\",\"task\":\"reconcileNetwork\",\"operation\":\"drift\",\"added\":${REPORTS_ADDED},\"deleted\":${REPORTS_DELETED},\"edge_counts_before\":${REPORTS_BEFORE},\"edge_counts_after\":${REPORTS_AFTER},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\"}"

#############################################
# B: FOLLOWS (kind 3)
#############################################
emit_task_event "PROGRESS" "reconcileNetwork" "system" "{\"phase\":\"B\",\"phase_name\":\"process_follows\",\"task\":\"reconcileNetwork\",\"operation\":\"phase_start\"}"
PHASE_START=$(date +%s); FOLLOWS_BEFORE=$(neo4j_rel_count "FOLLOWS")
log "Phase B: follows — extract + dump"
extract_and_dump "${BASE_DIR}/getCurrentFollowsFromNeo4j.js" "${BASE_DIR}/strfryToKind3Events.sh" "${BASE_DIR}/kind3EventsToFollows.js" "follows"
log "Phase B: computing follows diff"
node "${BASE_DIR}/calculateFollowsUpdates.js"
FOLLOWS_ADDED=$(count_lines "${BASE_DIR}/json/followsToAddToNeo4j.json"); FOLLOWS_DELETED=$(count_lines "${BASE_DIR}/json/followsToDeleteFromNeo4j.json")
log "Phase B: applying follows (added=${FOLLOWS_ADDED}, deleted=${FOLLOWS_DELETED})"
mv "$BASE_DIR/json/followsToAddToNeo4j.json" /var/lib/neo4j/import/followsToAddToNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_followsToAddToNeo4j" > /dev/null
mv "$BASE_DIR/json/followsToDeleteFromNeo4j.json" /var/lib/neo4j/import/followsToDeleteFromNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_followsToDeleteFromNeo4j" > /dev/null
mv "$BASE_DIR/allKind3EventsStripped.json" /var/lib/neo4j/import/allKind3EventsStripped.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand2_follows" > /dev/null
FOLLOWS_AFTER=$(neo4j_rel_count "FOLLOWS")
emit_task_event "PROGRESS" "reconcileNetwork" "system" "{\"phase\":\"B\",\"phase_name\":\"process_follows\",\"task\":\"reconcileNetwork\",\"operation\":\"drift\",\"added\":${FOLLOWS_ADDED},\"deleted\":${FOLLOWS_DELETED},\"edge_counts_before\":${FOLLOWS_BEFORE},\"edge_counts_after\":${FOLLOWS_AFTER},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\"}"

log "Projecting followsGraph into memory"
bash "$BRAINSTORM_MODULE_SRC_DIR/algos/projectFollowsGraphIntoMemory.sh"

cleanup
log "Finished reconcileNetwork"
emit_task_event "TASK_END" "reconcileNetwork" "system" "{
    \"task\": \"reconcileNetwork\", \"predicate\": \"${PRED}\", \"network_count\": ${NETWORK_COUNT},
    \"drift\": {
        \"follows\": { \"added\": ${FOLLOWS_ADDED}, \"deleted\": ${FOLLOWS_DELETED} },
        \"mutes\":   { \"added\": ${MUTES_ADDED},   \"deleted\": ${MUTES_DELETED} },
        \"reports\": { \"added\": ${REPORTS_ADDED}, \"deleted\": ${REPORTS_DELETED} }
    },
    \"status\": \"success\", \"database\": \"neo4j\"
}"
EMITTED_TERMINAL=1
exit 0
