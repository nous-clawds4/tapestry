#!/bin/bash
#
# ensureRawDataCsv.sh — coordinates the shared raw-data CSV cache for the
# personalized GrapeRank pipeline. Story #12 / ADR 0009.
#
# IMPORTANT: this script is intended to be SOURCED, not executed.
#   source "${BRAINSTORM_MODULE_ALGOS_DIR}/personalizedGrapeRank/ensureRawDataCsv.sh"
#   ensure_raw_data_csv || exit 1
#   # … rest of caller's pipeline runs while fd 200 holds the shared lock …
#
# Sourcing causes the helper to (a) acquire a shared flock on
# /var/lib/brainstorm/algos/personalizedGrapeRank/tmp/.csv.lock via fd 200
# and (b) keep that fd open in the calling shell. The lock is released
# automatically when the caller's shell exits. Readers running in parallel
# don't block one another; only the initialization writer takes an exclusive
# lock (briefly).
#
# AC-2: exactly one initialization runs under contention; the second waits.
# AC-3: the four CSVs are published via `<name>.csv.partial` + `mv` so a
#       concurrent reader never observes a half-written file.
# AC-4 / AC-5: freshness is decided by the mtime of the .last_init sentinel
#       against the configurable RAW_CSV_STALENESS_SECONDS window.
# AC-7: this helper is the single coordination point shared by the customer-
#       aware and owner-scoped pipelines.
# AC-10: structured-event phase tokens visible in the cache lifecycle:
#       csv_cache_hit, csv_cache_wait_begin, csv_cache_wait_end,
#       csv_cache_init_begin, csv_cache_init_end.
#
# Future writer sites MUST go through this helper or replicate the lock
# protocol — flock(1) is advisory, so any uncooperative writer re-introduces
# the race ADR 0009 was created to eliminate.

# Avoid double-sourcing in the same shell.
if [[ "${__BRAINSTORM_ENSURE_RAW_DATA_CSV_SOURCED:-}" == "1" ]]; then
    return 0 2>/dev/null || true
fi
__BRAINSTORM_ENSURE_RAW_DATA_CSV_SOURCED=1

# Source configuration. Both files set required env vars used below.
source /etc/brainstorm.conf   # NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, BRAINSTORM_MODULE_BASE_DIR
source /etc/graperank.conf    # RAW_CSV_STALENESS_SECONDS

# Source structured logging utilities (provides emit_task_event).
source "${BRAINSTORM_MODULE_BASE_DIR}/src/utils/structuredLogging.sh"

# Defaults and paths. The TMP_DIR is the shared root; CSVs and the sentinel
# live directly inside it. Per-customer subdirectories at TMP_DIR/<NAME>/ are
# managed by their own pipeline phases — this helper does NOT touch them.
ENSURE_CSV_TMP_DIR="/var/lib/brainstorm/algos/personalizedGrapeRank/tmp"
ENSURE_CSV_LOCK_FILE="${ENSURE_CSV_TMP_DIR}/.csv.lock"
ENSURE_CSV_SENTINEL="${ENSURE_CSV_TMP_DIR}/.last_init"
ENSURE_CSV_FILES=(ratees.csv follows.csv mutes.csv reports.csv)
ENSURE_CSV_LOCK_WAIT_SECONDS=600   # 10 min hard ceiling on any flock wait

# Default staleness window (30 min). Operator-overridable via /etc/graperank.conf.
: "${RAW_CSV_STALENESS_SECONDS:=1800}"

# Internal: is the cache fresh (all four CSVs present AND sentinel newer than
# the staleness window)?
_ensure_csv_cache_is_fresh() {
    local f
    for f in "${ENSURE_CSV_FILES[@]}"; do
        [[ -f "${ENSURE_CSV_TMP_DIR}/${f}" ]] || return 1
    done
    [[ -f "${ENSURE_CSV_SENTINEL}" ]] || return 1

    local sentinel_mtime now age
    sentinel_mtime=$(stat -c '%Y' "${ENSURE_CSV_SENTINEL}" 2>/dev/null \
                  || stat -f '%m' "${ENSURE_CSV_SENTINEL}" 2>/dev/null \
                  || echo 0)
    now=$(date +%s)
    age=$(( now - sentinel_mtime ))
    [[ "${age}" -lt "${RAW_CSV_STALENESS_SECONDS}" ]]
}

# Internal: run the four cypher-shell extractions, publishing each via
# `<name>.csv.partial` + atomic `mv`. The exclusive lock must be held by the
# caller.
_ensure_csv_run_init() {
    local cypher_ratees cypher_follows cypher_mutes cypher_reports
    cypher_ratees="MATCH (user:NostrUser) WHERE user.hops < 100 RETURN user.pubkey AS ratee_pubkey"
    cypher_follows="MATCH (rater:NostrUser)-[r:FOLLOWS]->(ratee:NostrUser) WHERE ratee.hops < 100 RETURN rater.pubkey AS pk_rater, ratee.pubkey AS pk_ratee"
    cypher_mutes="MATCH (rater:NostrUser)-[r:MUTES]->(ratee:NostrUser) WHERE ratee.hops < 100 RETURN rater.pubkey AS pk_rater, ratee.pubkey AS pk_ratee"
    cypher_reports="MATCH (rater:NostrUser)-[r:REPORTS]->(ratee:NostrUser) WHERE ratee.hops < 100 RETURN rater.pubkey AS pk_rater, ratee.pubkey AS pk_ratee"

    # name : cypher_var pairs, in extraction order.
    local pairs=( "ratees:cypher_ratees" "follows:cypher_follows" "mutes:cypher_mutes" "reports:cypher_reports" )
    local pair name cypher_var query target
    for pair in "${pairs[@]}"; do
        name="${pair%%:*}"
        cypher_var="${pair##*:}"
        query="${!cypher_var}"
        target="${ENSURE_CSV_TMP_DIR}/${name}.csv"
        # Stream into the .partial path; if cypher-shell fails, leave the
        # previous (or empty) target untouched.
        if ! cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" "$query" > "${target}.partial"; then
            rm -f "${target}.partial"
            return 1
        fi
        # Atomic rename via POSIX rename(2) — concurrent readers either see
        # the old file or the new file, never an interleaved one.
        mv "${target}.partial" "${target}" || return 1
    done

    # Touch sentinel AFTER all four CSVs are in place; its mtime is what
    # _ensure_csv_cache_is_fresh consults.
    : > "${ENSURE_CSV_SENTINEL}"
    return 0
}

# Public entry point. The caller sources this script and then calls this
# function. On success, fd 200 is left open in the caller's shell with a
# shared (LOCK_SH) flock; the kernel releases the lock automatically when
# the caller's shell exits.
ensure_raw_data_csv() {
    # Make sure the tmp tree and the lock file exist before any flock attempt.
    mkdir -p "${ENSURE_CSV_TMP_DIR}"
    chown -R brainstorm:brainstorm "${ENSURE_CSV_TMP_DIR}" 2>/dev/null || true
    chmod -R 755 "${ENSURE_CSV_TMP_DIR}" 2>/dev/null || true
    touch "${ENSURE_CSV_LOCK_FILE}" 2>/dev/null || true

    # Open fd 200 on the lock file. The fd stays open in the caller's shell
    # for the duration of the caller's pipeline.
    exec 200>"${ENSURE_CSV_LOCK_FILE}"

    # Step 1: acquire shared lock. This blocks only the writer (init); other
    # shared-lock readers proceed in parallel.
    emit_task_event "PROGRESS" "ensureRawDataCsv" "" '{"phase":"csv_cache_wait_begin","mode":"shared"}'
    if ! flock -s -w "${ENSURE_CSV_LOCK_WAIT_SECONDS}" 200; then
        emit_task_event "TASK_ERROR" "ensureRawDataCsv" "" '{"phase":"csv_cache_lock_timeout","mode":"shared","wait_seconds":"'"${ENSURE_CSV_LOCK_WAIT_SECONDS}"'"}'
        return 1
    fi
    emit_task_event "PROGRESS" "ensureRawDataCsv" "" '{"phase":"csv_cache_wait_end","mode":"shared"}'

    # Step 2: fast path — cache fresh under shared lock.
    if _ensure_csv_cache_is_fresh; then
        emit_task_event "PROGRESS" "ensureRawDataCsv" "" '{"phase":"csv_cache_hit","staleness_seconds":"'"${RAW_CSV_STALENESS_SECONDS}"'"}'
        return 0
    fi

    # Step 3: cache stale or missing — upgrade. flock(2) doesn't atomically
    # upgrade shared → exclusive in the same fd, so drop shared, acquire
    # exclusive, then double-check.
    flock -u 200
    emit_task_event "PROGRESS" "ensureRawDataCsv" "" '{"phase":"csv_cache_wait_begin","mode":"exclusive"}'
    if ! flock -x -w "${ENSURE_CSV_LOCK_WAIT_SECONDS}" 200; then
        emit_task_event "TASK_ERROR" "ensureRawDataCsv" "" '{"phase":"csv_cache_lock_timeout","mode":"exclusive","wait_seconds":"'"${ENSURE_CSV_LOCK_WAIT_SECONDS}"'"}'
        return 1
    fi
    emit_task_event "PROGRESS" "ensureRawDataCsv" "" '{"phase":"csv_cache_wait_end","mode":"exclusive"}'

    # Step 4: double-check under exclusive — a peer may have initialized
    # while we waited.
    if _ensure_csv_cache_is_fresh; then
        emit_task_event "PROGRESS" "ensureRawDataCsv" "" '{"phase":"csv_cache_hit","outcome":"reused_peer_init"}'
        # Downgrade to shared for the rest of the caller's pipeline.
        flock -u 200
        flock -s -w 60 200 || return 1
        return 0
    fi

    # Step 5: we own the init. Run extraction with atomic publishing.
    emit_task_event "PROGRESS" "ensureRawDataCsv" "" '{"phase":"csv_cache_init_begin"}'
    local init_started_at init_finished_at init_duration
    init_started_at=$(date +%s)
    if ! _ensure_csv_run_init; then
        emit_task_event "TASK_ERROR" "ensureRawDataCsv" "" '{"phase":"csv_cache_init_failed"}'
        flock -u 200
        return 1
    fi
    init_finished_at=$(date +%s)
    init_duration=$(( init_finished_at - init_started_at ))
    emit_task_event "PROGRESS" "ensureRawDataCsv" "" '{"phase":"csv_cache_init_end","duration_seconds":"'"${init_duration}"'"}'

    # Step 6: downgrade to shared for the rest of the caller's pipeline.
    flock -u 200
    if ! flock -s -w 60 200; then
        emit_task_event "TASK_ERROR" "ensureRawDataCsv" "" '{"phase":"csv_cache_lock_timeout","mode":"shared_downgrade"}'
        return 1
    fi
    return 0
}

# Cache-aware bulk eviction. Callers use this in place of
# `rm -rf /var/lib/brainstorm/algos/personalizedGrapeRank/tmp`. Acquires
# exclusive lock non-blocking; if a peer holds the shared lock (mid-read),
# the eviction is skipped and the cache survives. Targets ONLY the four
# shared CSVs + sentinel — never per-customer subdirectories.
#
# Usage:
#   source "${BRAINSTORM_MODULE_ALGOS_DIR}/personalizedGrapeRank/ensureRawDataCsv.sh"
#   evict_raw_data_csv_cache "<task_name>" "<target>"
evict_raw_data_csv_cache() {
    local task_name="${1:-rawDataCsvCacheEvict}"
    local target="${2:-}"

    mkdir -p "${ENSURE_CSV_TMP_DIR}"
    touch "${ENSURE_CSV_LOCK_FILE}" 2>/dev/null || true

    # Use a fresh fd (201) so we don't collide with a caller already holding
    # fd 200 in this shell.
    exec 201>"${ENSURE_CSV_LOCK_FILE}"

    if flock -x -n 201; then
        local f
        for f in "${ENSURE_CSV_FILES[@]}"; do
            rm -f "${ENSURE_CSV_TMP_DIR}/${f}"
        done
        rm -f "${ENSURE_CSV_SENTINEL}"
        flock -u 201
        exec 201>&-
        emit_task_event "PROGRESS" "$task_name" "$target" '{"phase":"csv_cache_evicted","cleanup_target":"'"${ENSURE_CSV_TMP_DIR}"'"}'
        return 0
    else
        exec 201>&-
        emit_task_event "PROGRESS" "$task_name" "$target" '{"phase":"csv_cache_evict_skipped","reason":"peer_in_flight","cleanup_target":"'"${ENSURE_CSV_TMP_DIR}"'"}'
        return 0
    fi
}

export -f ensure_raw_data_csv evict_raw_data_csv_cache
