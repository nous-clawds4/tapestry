#!/bin/bash

# process all webs of trust scores
# calculate all scores:
# - hops
# - personalizedPageRank
# - personalizedGrapeRank

# calculate and export whitelist
# calculate and export blacklist
# NIP-85 Trusted Assertions

# ? turn on Stream Filtered Content if not already active

CONFIG_FILE="/etc/brainstorm.conf"
source "$CONFIG_FILE" # BRAINSTORM_MODULE_MANAGE_DIR, BRAINSTORM_LOG_DIR, BRAINSTORM_MODULE_ALGOS_DIR, BRAINSTORM_MODULE_PIPELINE_DIR

# Source structured logging utilities
source "$BRAINSTORM_MODULE_BASE_DIR/src/utils/structuredLogging.sh"

# Source launchChildTask function
source "$BRAINSTORM_MODULE_MANAGE_DIR/taskQueue/launchChildTask.sh"

touch ${BRAINSTORM_LOG_DIR}/updateAllScoresForOwner.log
chown brainstorm:brainstorm ${BRAINSTORM_LOG_DIR}/updateAllScoresForOwner.log

# wrapper function which employs legacy log system; 
# will eventually get rid of this wrapper and just run launchChildTask directly
# OR may modify this to use structured logging; CHILD_TASK_START and CHILD_TASK_END
launch_child_task() {
    local task_name="$1"
    local parent_task_name="$2"
    local options_json="$3"
    local child_args="$4"

    echo "$(date): Continuing $parent_task_name; Starting $task_name using launchChildTask"
    echo "$(date): Continuing $parent_task_name; Starting $task_name using launchChildTask" >> ${BRAINSTORM_LOG_DIR}/updateAllScoresForOwner.log

    if launchChildTask "$task_name" "$parent_task_name" "$options_json" "$child_args"; then
        echo "$(date): $task_name completed successfully via launchChildTask"
        echo "$(date): $task_name completed successfully via launchChildTask" >> ${BRAINSTORM_LOG_DIR}/updateAllScoresForOwner.log
    else
        local exit_code=$?
        echo "$(date): $task_name failed via launchChildTask with exit code: $exit_code"
        echo "$(date): $task_name failed via launchChildTask with exit code: $exit_code" >> ${BRAINSTORM_LOG_DIR}/updateAllScoresForOwner.log
        # Note: launchChildTask handles parentNextStep logic, so we continue based on its return code
    fi

    echo "$(date): Continuing $parent_task_name; $task_name completed"
    echo "$(date): Continuing $parent_task_name; $task_name completed" >> ${BRAINSTORM_LOG_DIR}/updateAllScoresForOwner.log
}

echo "$(date): Starting updateAllScoresForOwner"
echo "$(date): Starting updateAllScoresForOwner" >> ${BRAINSTORM_LOG_DIR}/updateAllScoresForOwner.log

# Emit structured event for task start
oMetadata=$(jq -n \
    --arg message "Starting updateAllScoresForOwner" \
    --arg description "Orchestrates all score calculations for Brainstorm owner, including export." \
    --arg scope "owner_specific" \
    '{
        "message": $message,
        "description": $description,
        "scope": $scope
    }')
emit_task_event "TASK_START" "updateAllScoresForOwner" "" "$oMetadata"

sleep 5

#################### calculateOwnerHops: start  ##############
# Child Task 1: Calculate Owner Hops
launch_child_task "calculateOwnerHops" "updateAllScoresForOwner" "" ""
#################### calculateOwnerHops: complete  ##############

sleep 5

#################### calculateOwnerPageRank: start  ##############
# Child Task 2: Calculate Owner PageRank
launch_child_task "calculateOwnerPageRank" "updateAllScoresForOwner" "" ""
#################### calculateOwnerPageRank: complete  ##############

sleep 5

#################### calculateOwnerGrapeRank: start  ##############
# Child Task 3: Calculate Owner PageRank
launch_child_task "calculateOwnerGrapeRank" "updateAllScoresForOwner" "" ""
#################### calculateOwnerGrapeRank: complete  ##############

sleep 5

#################### processOwnerFollowsMutesReports: start  ##############
# Child Task 4: Process Owner Follows Mutes Reports
launch_child_task "processOwnerFollowsMutesReports" "updateAllScoresForOwner" "" ""
#################### processOwnerFollowsMutesReports: complete  ##############

sleep 5

#################### calculateReportScores: start  ##############
# Child Task 5: calculate Owner Report Scores
launch_child_task "calculateReportScores" "updateAllScoresForOwner" "" ""
#################### calculateReportScores: complete  ##############

sleep 5

#################### exportWhitelist: start  ##############
# Child Task 6: Export Owner Whitelist
# TODO: may rewrite this task to integrate with get-whitelist api endpoint
# Should also rename to exportOwnerWhitelist
# launch_child_task "exportWhitelist" "updateAllScoresForOwner" "" ""
#################### exportWhitelist: complete  ##############

sleep 5

#################### exportOwnerKind30382: start  ##############
# Child Task 7: Export Owner Kind 30382
launch_child_task "exportOwnerKind30382" "updateAllScoresForOwner" "" ""
#################### exportOwnerKind30382: complete  ##############

sleep 5

#################### loadOwnerScoresIntoMeilisearch: start  ##############
# Child Task 8: Load Owner Scores into Meilisearch
launch_child_task "loadOwnerScoresIntoMeilisearch" "updateAllScoresForOwner" "" ""
#################### loadOwnerScoresIntoMeilisearch: complete  ##############

sleep 5

#################### cleanup: start  ##############
# Cache-aware cleanup of the shared raw-data CSV cache. Per ADR 0009: the
# owner pipeline shares the cache with concurrent customer recalcs; a bare
# `rm -rf .../tmp` here would yank files out from under an in-flight reader.
# evict_raw_data_csv_cache uses a non-blocking exclusive flock and targets
# only the four shared CSVs + .last_init sentinel.
if [ -d "/var/lib/brainstorm/algos/personalizedGrapeRank/tmp" ]; then
    echo "$(date): Cache-aware cleanup of personalizedGrapeRank shared CSV cache"
    source "${BRAINSTORM_MODULE_ALGOS_DIR}/personalizedGrapeRank/ensureRawDataCsv.sh"
    evict_raw_data_csv_cache "updateAllScoresForOwner" "$BRAINSTORM_OWNER_PUBKEY"
fi

# Clean up kind 30382 published event files (if any remain from legacy scripts)
if [ -d "/var/lib/brainstorm/data/published" ]; then
    PUBLISHED_COUNT=$(find /var/lib/brainstorm/data/published -name 'kind30382_*.json' -o -name 'kind10040_*.json' 2>/dev/null | wc -l)
    if [ "$PUBLISHED_COUNT" -gt 0 ]; then
        echo "$(date): Cleaning up $PUBLISHED_COUNT published event files"
        find /var/lib/brainstorm/data/published -name 'kind30382_*.json' -delete 2>/dev/null
        find /var/lib/brainstorm/data/published -name 'kind10040_*.json' -delete 2>/dev/null
    fi
fi
#################### cleanup: complete  ##############

echo "$(date): Finished updateAllScoresForOwner"
echo "$(date): Finished updateAllScoresForOwner" >> ${BRAINSTORM_LOG_DIR}/updateAllScoresForOwner.log

# Emit structured event for task completion
emit_task_event "TASK_END" "updateAllScoresForOwner" "" '{
    "status": "success",
    "message": "Finished updateAllScoresForOwner",
    "description": "Orchestrates all score calculations for Brainstorm owner, including export.",
    "scope": "owner_specific"
}'
