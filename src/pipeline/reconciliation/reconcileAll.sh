#!/bin/bash
set -e          # Exit immediately on command failure
set -o pipefail # Fail if any pipeline command fails

# reconcileAll.sh
# Story #23 / ADR 0020 — independent, guarantee-specific reconcile task.
#
# Guarantee: full consistency across the ENTIRE graph (truly all). The complete
# oracle / incident-recovery sweep — bounded memory, target < 1h.
#
# Mechanism, per kind:
#   Phase A (mutes,   ~190k authors): approach B — full strfry dump → converter
#                                     (no filter) → per-pubkey files → existing
#                                     extractor (--authorsFromDir) → set-diff
#                                     → APOC apply.
#   Phase C (reports, ~170k authors): same as A.
#   Phase B (follows, ~32M edges):    sorted MERGE-JOIN — stream Neo4j FOLLOWS
#                                     to TSV (extractFollowsToTSV.js, no eager
#                                     operator), stream strfry kind-3 to TSV via
#                                     jq, external-`sort` both, `comm` to emit
#                                     adds/deletes, awk → APOC apply JSON.
#                                     Bounded memory regardless of graph size.
#
# No predicate, no filter, no IN-list — every rater. Distinct from
# reconcileNetwork (which scopes by a trust predicate). No watermark.

source /etc/brainstorm.conf
source /usr/local/lib/node_modules/brainstorm/src/utils/structuredLogging.sh

BASE_DIR_RECONCILIATION="/usr/local/lib/node_modules/brainstorm/src/pipeline/reconciliation"
BASE_DIR=${BASE_DIR_RECONCILIATION:-"/usr/local/lib/node_modules/brainstorm/src/pipeline/reconciliation"}
LOG_DIR=${BRAINSTORM_LOG_DIR:-"/var/log/brainstorm"}
APOC_COMMANDS_DIR="${BASE_DIR}/apocCypherCommands"
mkdir -p "${APOC_COMMANDS_DIR}"
LOG_FILE="${LOG_DIR}/reconciliation.log"
touch "$LOG_FILE"; chown brainstorm:brainstorm "$LOG_FILE" 2>/dev/null || true

TASK_NAME="reconcileAll"

log() { echo "$(date): $1" | tee -a "${LOG_FILE}"; }

# OBS-1 (ADR 0020): guarantee a terminal event on EVERY exit path.
EMITTED_TERMINAL=0
emit_terminal_on_exit() {
  local code=$?
  if [[ "$EMITTED_TERMINAL" -eq 0 && "$code" -ne 0 ]]; then
    emit_task_event "TASK_ERROR" "${TASK_NAME}" "system" \
      "{\"message\":\"reconcileAll failed\",\"failed_command\":\"${BASH_COMMAND}\",\"exit_code\":${code},\"status\":\"failed\"}"
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
  rm -f "$BASE_DIR/neo4j-follows.tsv" "$BASE_DIR/neo4j-follows.sorted" "$BASE_DIR/strfry-follows.tsv" "$BASE_DIR/strfry-follows.sorted" "$BASE_DIR/follows-adds.tsv" "$BASE_DIR/follows-deletes.tsv"
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

# Approach B (no filter) — Phase A (mutes) and Phase C (reports) use this.
# The kind-10000/1984 author sets are small (~190k/170k); the existing extractors
# handle them fine (the crash was only follows at 32M).
extract_and_dump_no_filter() {
  local extractor="$1" strfry_script="$2" converter="$3" label="$4"
  bash "${strfry_script}"     # full dump, no time/author filter
  node "${converter}"          # no --filterAuthorsFile → writes ALL per-pubkey
  node "${extractor}" --neo4jUri="${NEO4J_URI}" --neo4jUser="${NEO4J_USER}" --neo4jPassword="${NEO4J_PASSWORD}" \
       --logFile="${LOG_FILE}" --authorsFromDir="${BASE_DIR}/currentRelationshipsFromStrfry/${label}"
}

log "Starting ${TASK_NAME}"
emit_task_event "TASK_START" "${TASK_NAME}" "system" "{
    \"description\": \"Full-graph Neo4j <-> strfry reconciliation (truly all)\",
    \"task\": \"${TASK_NAME}\",
    \"mechanism\": \"mutes+reports approach B; follows sorted merge-join\",
    \"targets\": [\"mutes\", \"reports\", \"follows\"], \"database\": \"neo4j\"
}"
check_disk_space "Before ${TASK_NAME}"
cleanup

#############################################
# A: MUTES (kind 10000) — approach B, no filter
#############################################
emit_task_event "PROGRESS" "${TASK_NAME}" "system" "{\"phase\":\"A\",\"phase_name\":\"process_mutes\",\"task\":\"${TASK_NAME}\",\"operation\":\"phase_start\"}"
PHASE_START=$(date +%s); MUTES_BEFORE=$(neo4j_rel_count "MUTES")
log "Phase A: mutes — full dump + extract (approach B, no filter)"
extract_and_dump_no_filter "${BASE_DIR}/getCurrentMutesFromNeo4j.js" "${BASE_DIR}/strfryToKind10000Events.sh" "${BASE_DIR}/kind10000EventsToMutes.js" "mutes"
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
emit_task_event "PROGRESS" "${TASK_NAME}" "system" "{\"phase\":\"A\",\"phase_name\":\"process_mutes\",\"task\":\"${TASK_NAME}\",\"operation\":\"drift\",\"added\":${MUTES_ADDED},\"deleted\":${MUTES_DELETED},\"edge_counts_before\":${MUTES_BEFORE},\"edge_counts_after\":${MUTES_AFTER},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\"}"

#############################################
# C: REPORTS (kind 1984) — approach B, no filter, append-only
#############################################
emit_task_event "PROGRESS" "${TASK_NAME}" "system" "{\"phase\":\"C\",\"phase_name\":\"process_reports\",\"task\":\"${TASK_NAME}\",\"operation\":\"phase_start\"}"
PHASE_START=$(date +%s); REPORTS_BEFORE=$(neo4j_rel_count "REPORTS")
log "Phase C: reports — full dump + extract (approach B, no filter)"
extract_and_dump_no_filter "${BASE_DIR}/getCurrentReportsFromNeo4j.js" "${BASE_DIR}/strfryToKind1984Events.sh" "${BASE_DIR}/kind1984EventsToReports.js" "reports"
log "Phase C: computing reports diff"
node "${BASE_DIR}/calculateReportsUpdates.js"
REPORTS_ADDED=$(count_lines "${BASE_DIR}/json/reportsToAddToNeo4j.json"); REPORTS_DELETED=0
log "Phase C: applying reports (added=${REPORTS_ADDED})"
mv "$BASE_DIR/json/reportsToAddToNeo4j.json" /var/lib/neo4j/import/reportsToAddToNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_reportsToAddToNeo4j" > /dev/null
mv "$BASE_DIR/allKind1984EventsStripped.json" /var/lib/neo4j/import/allKind1984EventsStripped.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand2_reports" > /dev/null
REPORTS_AFTER=$(neo4j_rel_count "REPORTS")
emit_task_event "PROGRESS" "${TASK_NAME}" "system" "{\"phase\":\"C\",\"phase_name\":\"process_reports\",\"task\":\"${TASK_NAME}\",\"operation\":\"drift\",\"added\":${REPORTS_ADDED},\"deleted\":${REPORTS_DELETED},\"edge_counts_before\":${REPORTS_BEFORE},\"edge_counts_after\":${REPORTS_AFTER},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\"}"

#############################################
# B: FOLLOWS (kind 3) — SORTED MERGE-JOIN (the ADR 0020 mechanism for 32M edges)
#############################################
emit_task_event "PROGRESS" "${TASK_NAME}" "system" "{\"phase\":\"B\",\"phase_name\":\"process_follows\",\"task\":\"${TASK_NAME}\",\"operation\":\"phase_start\",\"mechanism\":\"sorted_merge_join\"}"
PHASE_START=$(date +%s); FOLLOWS_BEFORE=$(neo4j_rel_count "FOLLOWS")

# 1. Stream the FULL Neo4j FOLLOWS edge set to TSV (rater\tratee), reactively —
#    one streamed query, no eager operator, bounded memory.
log "Phase B: streaming Neo4j FOLLOWS → TSV"
node "${BASE_DIR}/extractFollowsToTSV.js" \
  --neo4jUri="${NEO4J_URI}" --neo4jUser="${NEO4J_USER}" --neo4jPassword="${NEO4J_PASSWORD}" \
  --logFile="${LOG_FILE}" --output="${BASE_DIR}/neo4j-follows.tsv"

# 2. Dump strfry kind-3 (full, no filter) + convert events → TSV (rater\tratee per p-tag).
log "Phase B: dumping strfry kind-3 (full)"
bash "${BASE_DIR}/strfryToKind3Events.sh"
log "Phase B: converting strfry events → TSV via jq"
jq -r '. as $e | (.tags // []) | map(select(.[0] == "p")) | .[] | (($e.pubkey // "") | ascii_downcase) + "\t" + ((.[1] // "") | ascii_downcase)' \
  "${BASE_DIR}/allKind3EventsStripped.json" \
  | awk -F'\t' 'length($1)==64 && length($2)==64' \
  > "${BASE_DIR}/strfry-follows.tsv"

# 3. External-sort both sides (LC_ALL=C for byte-wise, sort -T in BASE_DIR for temp).
log "Phase B: external-sorting both sides"
LC_ALL=C sort -u -T "${BASE_DIR}" "${BASE_DIR}/neo4j-follows.tsv"  -o "${BASE_DIR}/neo4j-follows.sorted"
LC_ALL=C sort -u -T "${BASE_DIR}" "${BASE_DIR}/strfry-follows.tsv" -o "${BASE_DIR}/strfry-follows.sorted"

# 4. Merge-join via comm: adds = in strfry only; deletes = in Neo4j only.
log "Phase B: merge-join (comm)"
LC_ALL=C comm -23 "${BASE_DIR}/strfry-follows.sorted" "${BASE_DIR}/neo4j-follows.sorted" > "${BASE_DIR}/follows-adds.tsv"
LC_ALL=C comm -13 "${BASE_DIR}/strfry-follows.sorted" "${BASE_DIR}/neo4j-follows.sorted" > "${BASE_DIR}/follows-deletes.tsv"

# 5. Convert add/delete TSV → APOC apply JSON (the existing apocCypherCommand1
#    consumers expect {pk_rater, pk_ratee, timestamp}). Timestamp on truly-new
#    edges is set to 0 (the strfry kind-3 created_at signal is dropped on this
#    full-mode path — acceptable for the periodic oracle sweep; recent activity
#    is timestamped via reconcileRecent / the live stream).
mkdir -p "${BASE_DIR}/json"
awk -F'\t' '{printf "{\"pk_rater\":\"%s\",\"pk_ratee\":\"%s\",\"timestamp\":0}\n", $1, $2}' "${BASE_DIR}/follows-adds.tsv"    > "${BASE_DIR}/json/followsToAddToNeo4j.json"
awk -F'\t' '{printf "{\"pk_rater\":\"%s\",\"pk_ratee\":\"%s\"}\n", $1, $2}'                  "${BASE_DIR}/follows-deletes.tsv" > "${BASE_DIR}/json/followsToDeleteFromNeo4j.json"
FOLLOWS_ADDED=$(count_lines "${BASE_DIR}/json/followsToAddToNeo4j.json")
FOLLOWS_DELETED=$(count_lines "${BASE_DIR}/json/followsToDeleteFromNeo4j.json")

# 6. Apply via existing APOC commands.
log "Phase B: applying follows (added=${FOLLOWS_ADDED}, deleted=${FOLLOWS_DELETED})"
mv "$BASE_DIR/json/followsToAddToNeo4j.json" /var/lib/neo4j/import/followsToAddToNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_followsToAddToNeo4j" > /dev/null
mv "$BASE_DIR/json/followsToDeleteFromNeo4j.json" /var/lib/neo4j/import/followsToDeleteFromNeo4j.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand1_followsToDeleteFromNeo4j" > /dev/null
mv "$BASE_DIR/allKind3EventsStripped.json" /var/lib/neo4j/import/allKind3EventsStripped.json
cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" -a "$NEO4J_URI" -f "$BASE_DIR/apocCypherCommands/apocCypherCommand2_follows" > /dev/null

# 7. Clean intermediate TSV files (they can be multi-GB).
rm -f "$BASE_DIR/neo4j-follows.tsv" "$BASE_DIR/neo4j-follows.sorted" "$BASE_DIR/strfry-follows.tsv" "$BASE_DIR/strfry-follows.sorted" "$BASE_DIR/follows-adds.tsv" "$BASE_DIR/follows-deletes.tsv"

FOLLOWS_AFTER=$(neo4j_rel_count "FOLLOWS")
emit_task_event "PROGRESS" "${TASK_NAME}" "system" "{\"phase\":\"B\",\"phase_name\":\"process_follows\",\"task\":\"${TASK_NAME}\",\"operation\":\"drift\",\"added\":${FOLLOWS_ADDED},\"deleted\":${FOLLOWS_DELETED},\"edge_counts_before\":${FOLLOWS_BEFORE},\"edge_counts_after\":${FOLLOWS_AFTER},\"duration\":$(( $(date +%s) - PHASE_START )),\"status\":\"completed\",\"mechanism\":\"sorted_merge_join\"}"

log "Projecting followsGraph into memory"
bash "$BRAINSTORM_MODULE_SRC_DIR/algos/projectFollowsGraphIntoMemory.sh"

cleanup
check_disk_space "At end of ${TASK_NAME}"

log "Finished ${TASK_NAME}"
emit_task_event "TASK_END" "${TASK_NAME}" "system" "{
    \"task\": \"${TASK_NAME}\",
    \"drift\": {
        \"follows\": { \"added\": ${FOLLOWS_ADDED}, \"deleted\": ${FOLLOWS_DELETED} },
        \"mutes\":   { \"added\": ${MUTES_ADDED},   \"deleted\": ${MUTES_DELETED} },
        \"reports\": { \"added\": ${REPORTS_ADDED}, \"deleted\": ${REPORTS_DELETED} }
    },
    \"status\": \"success\", \"database\": \"neo4j\"
}"
EMITTED_TERMINAL=1
exit 0
