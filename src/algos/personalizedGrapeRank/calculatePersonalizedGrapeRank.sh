#!/bin/bash

# Source configuration
source /etc/brainstorm.conf # BRAINSTORM_OWNER_PUBKEY, BRAINSTORM_MODULE_ALGOS_DIR
source /etc/graperank.conf   # Rating and confidence values, RAW_CSV_STALENESS_SECONDS

touch ${BRAINSTORM_LOG_DIR}/calculatePersonalizedGrapeRank.log
chown brainstorm:brainstorm ${BRAINSTORM_LOG_DIR}/calculatePersonalizedGrapeRank.log

echo "$(date): Starting calculatePersonalizedGrapeRank"
echo "$(date): Starting calculatePersonalizedGrapeRank" >> ${BRAINSTORM_LOG_DIR}/calculatePersonalizedGrapeRank.log

# Ensure the shared raw-data CSV cache is present and fresh. Story #12 / ADR
# 0009 folded this (owner-scoped) script into the same coordination protocol
# used by the customer-aware pipeline. The helper is sourced so the shared
# flock on fd 200 stays open for the rest of the pipeline; the kernel
# releases it when this script exits. The owner script is NOT retired — it
# remains a peer of the customer-aware writer under the shared cache.
echo "$(date): Continuing calculatePersonalizedGrapeRank ... ensuring shared raw-data CSV cache"
echo "$(date): Continuing calculatePersonalizedGrapeRank ... ensuring shared raw-data CSV cache" >> ${BRAINSTORM_LOG_DIR}/calculatePersonalizedGrapeRank.log
source "${BRAINSTORM_MODULE_ALGOS_DIR}/personalizedGrapeRank/ensureRawDataCsv.sh"
if ! ensure_raw_data_csv; then
    echo "$(date): ERROR: ensure_raw_data_csv failed; aborting" >> ${BRAINSTORM_LOG_DIR}/calculatePersonalizedGrapeRank.log
    exit 1
fi

# THIS_DIR is still needed for the bash child-script invocations below.
THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "$(date): Continuing calculatePersonalizedGrapeRank ... cache ready, starting initializeRatings"
echo "$(date): Continuing calculatePersonalizedGrapeRank ... cache ready, starting initializeRatings" >> ${BRAINSTORM_LOG_DIR}/calculatePersonalizedGrapeRank.log

# create one large raw data object oRatingsReverse.json of format: [context][ratee][rater] = [score, confidence]
bash $THIS_DIR/initializeRatings.sh

echo "$(date): Continuing calculatePersonalizedGrapeRank ... finished initializeRatings, calling initializeScorecards"
echo "$(date): Continuing calculatePersonalizedGrapeRank ... finished initializeRatings, calling initializeScorecards" >> ${BRAINSTORM_LOG_DIR}/calculatePersonalizedGrapeRank.log

# intialize oScorecards: iterate through ratees.csv and create empty objects for each ratee
bash $THIS_DIR/initializeScorecards.sh

echo "$(date): Continuing calculatePersonalizedGrapeRank ... finished initializeScorecards, calling calculateGrapeRank"
echo "$(date): Continuing calculatePersonalizedGrapeRank ... finished initializeScorecards, calling calculateGrapeRank" >> ${BRAINSTORM_LOG_DIR}/calculatePersonalizedGrapeRank.log

# iterate through GrapeRank until max iterations or until convergence
bash $THIS_DIR/calculateGrapeRank.sh

echo "$(date): Continuing calculatePersonalizedGrapeRank ... finished calculateGrapeRank, calling updateNeo4j"
echo "$(date): Continuing calculatePersonalizedGrapeRank ... finished calculateGrapeRank, calling updateNeo4j" >> ${BRAINSTORM_LOG_DIR}/calculatePersonalizedGrapeRank.log

# update Neo4j with data from scorecards.json
bash $THIS_DIR/updateNeo4j.sh

echo "$(date): Continuing calculatePersonalizedGrapeRank ... finished updateNeo4j"
echo "$(date): Continuing calculatePersonalizedGrapeRank ... finished updateNeo4j" >> ${BRAINSTORM_LOG_DIR}/calculatePersonalizedGrapeRank.log

# Per ADR 0009: the shared raw-data CSV cache outlives this script. The
# trailing bulk wipe was removed — the cache is now an explicit, observable
# resource refreshed by staleness expiry, and cache-aware eviction happens
# at the orchestrator boundaries (processAllActiveCustomers,
# updateAllScoresForOwner, calculatePersonalizedGrapeRankController) via
# the helper's evict_raw_data_csv_cache function.

# Update the WHEN_LAST_CALCULATED timestamp in the configuration file
TIMESTAMP=$(date +%s)
TMP_CONF=$(mktemp)
cat /etc/graperank.conf | sed "s/^export WHEN_LAST_CALCULATED=.*$/export WHEN_LAST_CALCULATED=$TIMESTAMP/" > "$TMP_CONF"
cp "$TMP_CONF" /etc/graperank.conf
chmod 644 /etc/graperank.conf
chown root:brainstorm /etc/graperank.conf
rm "$TMP_CONF"

echo "$(date): Finished calculatePersonalizedGrapeRank"
echo "$(date): Finished calculatePersonalizedGrapeRank" >> ${BRAINSTORM_LOG_DIR}/calculatePersonalizedGrapeRank.log