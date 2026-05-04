#!/bin/bash

source /etc/brainstorm.conf # BRAINSTORM_LOG_DIR
# Owner-side verified-follower cutoff. Read from /etc/graperank.conf if defined;
# fall back to 0.05 (the unified value from PREFERENCES_AUDIT §6.2 consolidation).
[ -f /etc/graperank.conf ] && source /etc/graperank.conf
CUTOFF=${VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF:-0.05}

touch ${BRAINSTORM_LOG_DIR}/calculateVerifiedFollowerCounts.log
chown brainstorm:brainstorm ${BRAINSTORM_LOG_DIR}/calculateVerifiedFollowerCounts.log

echo "$(date): Starting calculateVerifiedFollowerCounts (cutoff=${CUTOFF})"
echo "$(date): Starting calculateVerifiedFollowerCounts (cutoff=${CUTOFF})" >> ${BRAINSTORM_LOG_DIR}/calculateVerifiedFollowerCounts.log

CYPHER1="
MATCH (n:NostrUser)<-[f:FOLLOWS]-(m:NostrUser)
WHERE m.influence > ${CUTOFF}
WITH n, count(f) AS verifiedFollowerCount
SET n.verifiedFollowerCount = verifiedFollowerCount
RETURN COUNT(n) AS numUsersUpdated"

# set verifiedFollowerCount to 0 for users with no verified followers
CYPHER2="
MATCH (n:NostrUser)
OPTIONAL MATCH (n)<-[f:FOLLOWS]-(m:NostrUser)
WHERE m.influence > ${CUTOFF}
WITH n, count(f) as verifiedFollowerCount
WHERE verifiedFollowerCount = 0
SET n.verifiedFollowerCount = 0
RETURN count(n) AS numUsersUpdated
"

cypherResults=$(cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" "$CYPHER1")
numUsersUpdated="${cypherResults:16}"

echo "$(date): numUsersUpdated: $numUsersUpdated (with nonzero verifiedFollowerCount)"
echo "$(date): numUsersUpdated: $numUsersUpdated (with nonzero verifiedFollowerCount)" >> ${BRAINSTORM_LOG_DIR}/calculateVerifiedFollowerCounts.log

cypherResults=$(cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" "$CYPHER2")
numUsersUpdated="${cypherResults:16}"

echo "$(date): numUsersUpdated: $numUsersUpdated (with zero verifiedFollowerCount)"
echo "$(date): numUsersUpdated: $numUsersUpdated (with zero verifiedFollowerCount)" >> ${BRAINSTORM_LOG_DIR}/calculateVerifiedFollowerCounts.log

echo "$(date): Finished calculateVerifiedFollowerCounts"
echo "$(date): Finished calculateVerifiedFollowerCounts" >> ${BRAINSTORM_LOG_DIR}/calculateVerifiedFollowerCounts.log