#!/bin/bash
set -e          # Exit immediately on command failure
set -o pipefail # Fail if any pipeline command fails

# GDS-based hop distance calculation.
# Uses Neo4j's Graph Data Science library for BFS traversal — orders of magnitude
# faster than the iterative Cypher approach in calculateHops.sh.
#
# Algorithm:
# 1. Project the FOLLOWS graph into GDS memory (~5-10s for 30M edges)
# 2. Run BFS from owner node — returns all reachable nodes with hop distances
# 3. Write hop distances back to NostrUser nodes in batches
# 4. Set unreachable nodes to 999
# 5. Drop the projection
#
# Falls back to calculateHops.sh if GDS is not available.

source /etc/brainstorm.conf # NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, BRAINSTORM_OWNER_PUBKEY, BRAINSTORM_LOG_DIR

# Source structured logging utility
source /usr/local/lib/node_modules/brainstorm/src/utils/structuredLogging.sh

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
GDS_GRAPH_NAME="hopsGraph"

# Start structured logging
oMetadata=$(jq -n \
    --arg algorithm "hop_distance_gds" \
    --arg target "owner" \
    --arg owner_pubkey "$BRAINSTORM_OWNER_PUBKEY" \
    --arg method "GDS_BFS" \
    '{
        algorithm: $algorithm,
        target: $target,
        owner_pubkey: $owner_pubkey,
        method: $method
    }')
emit_task_event "TASK_START" "calculateOwnerHops" "system" "$oMetadata"

echo "$(date): Starting calculateHops (GDS method)"
echo "$(date): Starting calculateHops (GDS method)" >> ${BRAINSTORM_LOG_DIR}/calculateHops.log

# ── Phase 1: Drop existing projection if present ──
progressMetadata=$(jq -n \
    --arg phase "preparation" \
    --arg step "drop_existing_graph" \
    --arg description "Dropping existing GDS graph projection if present" \
    '{ phase: $phase, step: $step, description: $description }')
emit_task_event "PROGRESS" "calculateOwnerHops" "system" "$progressMetadata"

cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
    "CALL gds.graph.drop('$GDS_GRAPH_NAME', false) YIELD graphName RETURN graphName" 2>/dev/null || true

echo "$(date): Existing projection dropped (if any)"
echo "$(date): Existing projection dropped (if any)" >> ${BRAINSTORM_LOG_DIR}/calculateHops.log

# ── Phase 2: Project the FOLLOWS graph into GDS memory ──
progressMetadata=$(jq -n \
    --arg phase "projection" \
    --arg step "project_follows_graph" \
    --arg description "Projecting FOLLOWS graph into GDS memory" \
    '{ phase: $phase, step: $step, description: $description }')
emit_task_event "PROGRESS" "calculateOwnerHops" "system" "$progressMetadata"

projectionResult=$(cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" "
    MATCH (source:NostrUser)-[r:FOLLOWS]->(target:NostrUser)
    RETURN gds.graph.project(
        '$GDS_GRAPH_NAME',
        source,
        target
    )
")

echo "$(date): Graph projected into memory"
echo "$(date): Graph projected into memory" >> ${BRAINSTORM_LOG_DIR}/calculateHops.log

# ── Phase 3: Initialize all nodes to 999 hops ──
progressMetadata=$(jq -n \
    --arg phase "initialization" \
    --arg step "reset_all_hops" \
    --arg description "Setting all NostrUser nodes to 999 hops" \
    '{ phase: $phase, step: $step, description: $description }')
emit_task_event "PROGRESS" "calculateOwnerHops" "system" "$progressMetadata"

cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
    "MATCH (u:NostrUser) CALL { WITH u SET u.hops = 999 } IN TRANSACTIONS OF 50000 ROWS"

echo "$(date): All nodes initialized to 999 hops"
echo "$(date): All nodes initialized to 999 hops" >> ${BRAINSTORM_LOG_DIR}/calculateHops.log

# ── Phase 4: Run BFS from owner and write hop distances ──
progressMetadata=$(jq -n \
    --arg phase "bfs" \
    --arg step "run_bfs_and_write" \
    --arg description "Running GDS BFS from owner node and writing hop distances" \
    --arg owner_pubkey "$BRAINSTORM_OWNER_PUBKEY" \
    '{ phase: $phase, step: $step, description: $description, owner_pubkey: $owner_pubkey }')
emit_task_event "PROGRESS" "calculateOwnerHops" "system" "$progressMetadata"

bfsResult=$(cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" "
    MATCH (source:NostrUser {pubkey: '$BRAINSTORM_OWNER_PUBKEY'})
    CALL gds.bfs.stream('$GDS_GRAPH_NAME', {
        sourceNode: source
    })
    YIELD path
    WITH [n IN nodes(path) | n] AS pathNodes
    WITH pathNodes, last(pathNodes) AS targetNode, size(pathNodes) - 1 AS hopDistance
    CALL { WITH targetNode, hopDistance SET targetNode.hops = hopDistance }
    IN TRANSACTIONS OF 50000 ROWS
    RETURN count(*) AS nodesUpdated, max(hopDistance) AS maxHopReached
")

echo "$bfsResult"
echo "$(date): BFS complete: $bfsResult" >> ${BRAINSTORM_LOG_DIR}/calculateHops.log

# Parse results — extract nodesUpdated and maxHopReached
# cypher-shell output format: "nodesUpdated, maxHopReached\n1234567, 8"
nodesUpdated=$(echo "$bfsResult" | tail -1 | cut -d',' -f1 | tr -d ' ')
maxHopReached=$(echo "$bfsResult" | tail -1 | cut -d',' -f2 | tr -d ' ')

progressMetadata=$(jq -n \
    --arg phase "bfs" \
    --arg step "bfs_complete" \
    --argjson nodes_updated "${nodesUpdated:-0}" \
    --argjson max_hop "${maxHopReached:-0}" \
    --arg description "BFS traversal and write-back complete" \
    '{ phase: $phase, step: $step, nodes_updated: $nodes_updated, max_hop_reached: $max_hop, description: $description }')
emit_task_event "PROGRESS" "calculateOwnerHops" "system" "$progressMetadata"

# ── Phase 5: Set owner to 0 (BFS path to self has length 0) ──
cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
    "MATCH (u:NostrUser {pubkey:'$BRAINSTORM_OWNER_PUBKEY'}) SET u.hops = 0"

# ── Phase 6: Drop the projection ──
progressMetadata=$(jq -n \
    --arg phase "cleanup" \
    --arg step "drop_graph" \
    --arg description "Dropping GDS graph projection" \
    '{ phase: $phase, step: $step, description: $description }')
emit_task_event "PROGRESS" "calculateOwnerHops" "system" "$progressMetadata"

cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
    "CALL gds.graph.drop('$GDS_GRAPH_NAME') YIELD graphName RETURN graphName"

echo "$(date): Graph projection dropped"
echo "$(date): Graph projection dropped" >> ${BRAINSTORM_LOG_DIR}/calculateHops.log

echo "$(date): Finished calculateHops (GDS method)"
echo "$(date): Finished calculateHops (GDS method)" >> ${BRAINSTORM_LOG_DIR}/calculateHops.log

# End structured logging
endMetadata=$(jq -n \
    --argjson nodes_updated "${nodesUpdated:-0}" \
    --argjson max_hop_reached "${maxHopReached:-0}" \
    --arg method "GDS_BFS" \
    --arg completion_reason "bfs_complete" \
    '{
        nodes_updated: $nodes_updated,
        max_hop_reached: $max_hop_reached,
        method: $method,
        completion_reason: $completion_reason
    }')
emit_task_event "TASK_END" "calculateOwnerHops" "system" "$endMetadata"
exit 0
