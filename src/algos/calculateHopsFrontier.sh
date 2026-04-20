#!/bin/bash
set -e          # Exit immediately on command failure
set -o pipefail # Fail if any pipeline command fails

# Frontier-based hop distance calculation.
# Instead of scanning ALL relationships each iteration (the old approach),
# this only looks at nodes at the current hop level and their unvisited
# neighbors. Much faster because each iteration's work is proportional
# to the frontier size, not the total graph size.
#
# Performance (2.46M nodes, 30M FOLLOWS):
# - Old iterative: scans 30M edges × 12 iterations = 360M scans, minutes
# - Frontier-based: each hop only scans frontier's edges, seconds total
#
# The original calculateHops.sh is retained for fallback/comparison.

source /etc/brainstorm.conf # NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, BRAINSTORM_OWNER_PUBKEY, BRAINSTORM_LOG_DIR

# Source structured logging utility
source /usr/local/lib/node_modules/brainstorm/src/utils/structuredLogging.sh

MAX_HOPS=12

# Start structured logging
oMetadata=$(jq -n \
    --arg algorithm "hop_distance_frontier" \
    --arg target "owner" \
    --arg owner_pubkey "$BRAINSTORM_OWNER_PUBKEY" \
    --argjson max_hops "$MAX_HOPS" \
    '{
        algorithm: $algorithm,
        target: $target,
        owner_pubkey: $owner_pubkey,
        max_hops: $max_hops
    }')
emit_task_event "TASK_START" "calculateOwnerHops" "system" "$oMetadata"

echo "$(date): Starting calculateHops (frontier method)"
echo "$(date): Starting calculateHops (frontier method)" >> ${BRAINSTORM_LOG_DIR}/calculateHops.log

# ── Phase 1: Initialize all nodes to 999 hops ──
progressMetadata=$(jq -n \
    --arg phase "initialization" \
    --arg step "reset_all_hops" \
    --arg description "Setting all users to 999 hops" \
    '{ phase: $phase, step: $step, description: $description }')
emit_task_event "PROGRESS" "calculateOwnerHops" "system" "$progressMetadata"

cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
    "MATCH (u:NostrUser) CALL { WITH u SET u.hops = 999 } IN TRANSACTIONS OF 50000 ROWS"

echo "$(date): All nodes initialized to 999 hops"
echo "$(date): All nodes initialized to 999 hops" >> ${BRAINSTORM_LOG_DIR}/calculateHops.log

# ── Phase 2: Set owner to hop 0 ──
progressMetadata=$(jq -n \
    --arg phase "initialization" \
    --arg step "set_owner_zero" \
    --arg description "Setting owner to 0 hops" \
    --arg owner_pubkey "$BRAINSTORM_OWNER_PUBKEY" \
    '{ phase: $phase, step: $step, description: $description, owner_pubkey: $owner_pubkey }')
emit_task_event "PROGRESS" "calculateOwnerHops" "system" "$progressMetadata"

cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
    "MATCH (u:NostrUser {pubkey:'$BRAINSTORM_OWNER_PUBKEY'}) SET u.hops = 0"

echo "$(date): Owner set to 0 hops"
echo "$(date): Owner set to 0 hops" >> ${BRAINSTORM_LOG_DIR}/calculateHops.log

# ── Phase 3: Frontier-based hop propagation ──
totalUpdated=0
currentHop=0

while [ "$currentHop" -lt "$MAX_HOPS" ]; do
    nextHop=$((currentHop + 1))

    # Only match nodes at the CURRENT frontier (hops = currentHop)
    # and their unvisited neighbors (hops = 999)
    cypherResults=$(cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" "
        MATCH (u:NostrUser {hops: $currentHop})-[:FOLLOWS]->(f:NostrUser {hops: 999})
        CALL { WITH f SET f.hops = $nextHop } IN TRANSACTIONS OF 50000 ROWS
        RETURN count(f) AS updated
    ")

    # Parse the count from cypher-shell output (skip header line)
    numUpdates=$(echo "$cypherResults" | tail -1 | tr -d ' ')

    totalUpdated=$((totalUpdated + numUpdates))

    echo "$(date): Hop $nextHop: $numUpdates nodes updated (total: $totalUpdated)"
    echo "$(date): Hop $nextHop: $numUpdates nodes updated (total: $totalUpdated)" >> ${BRAINSTORM_LOG_DIR}/calculateHops.log

    progressMetadata=$(jq -n \
        --arg phase "calculation" \
        --arg step "frontier_iteration" \
        --argjson hop_level "$nextHop" \
        --argjson updates "$numUpdates" \
        --argjson total_updated "$totalUpdated" \
        --arg description "Completed hop level $nextHop" \
        '{
            phase: $phase,
            step: $step,
            hop_level: $hop_level,
            updates: $updates,
            total_updated: $total_updated,
            description: $description
        }')
    emit_task_event "PROGRESS" "calculateOwnerHops" "system" "$progressMetadata"

    # Stop if no more nodes were updated (all reachable nodes assigned)
    if [ "$numUpdates" -eq 0 ]; then
        break
    fi

    currentHop=$nextHop
done

# ── Phase 4: Completion ──
maxHopReached=$currentHop
if [ "$numUpdates" -eq 0 ]; then
    completion_reason="no_more_updates"
else
    completion_reason="max_hops_reached"
fi

progressMetadata=$(jq -n \
    --arg phase "completion" \
    --argjson max_hop_reached "$maxHopReached" \
    --argjson total_updated "$totalUpdated" \
    --arg completion_reason "$completion_reason" \
    --arg description "Hop distance calculation completed" \
    '{
        phase: $phase,
        max_hop_reached: $max_hop_reached,
        total_updated: $total_updated,
        completion_reason: $completion_reason,
        description: $description
    }')
emit_task_event "PROGRESS" "calculateOwnerHops" "system" "$progressMetadata"

echo "$(date): Finished calculateHops (frontier method) — $totalUpdated nodes, max hop $maxHopReached, reason: $completion_reason"
echo "$(date): Finished calculateHops (frontier method) — $totalUpdated nodes, max hop $maxHopReached, reason: $completion_reason" >> ${BRAINSTORM_LOG_DIR}/calculateHops.log

# End structured logging
endMetadata=$(jq -n \
    --argjson total_updated "$totalUpdated" \
    --argjson max_hop_reached "$maxHopReached" \
    --arg method "frontier" \
    --arg completion_reason "$completion_reason" \
    '{
        total_updated: $total_updated,
        max_hop_reached: $max_hop_reached,
        method: $method,
        completion_reason: $completion_reason
    }')
emit_task_event "TASK_END" "calculateOwnerHops" "system" "$endMetadata"
exit 0
