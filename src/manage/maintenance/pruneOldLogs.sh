#!/bin/bash
set -o pipefail

# pruneOldLogs — Maintenance task to clean up log files, rotated archives,
# and stale temporary files. Run standalone from Task Explorer or on a schedule.
#
# Retention policies:
#   events-*.jsonl archives    → delete after 30 days
#   structured.log             → truncate to last 50 MB
#   system task *.log          → truncate to last 5 MB if over 20 MB
#   customer logs              → delete files older than 30 days
#   supervisor logs            → truncate to last 10 MB if over 50 MB
#   neo4j logs                 → truncate to last 10 MB if over 50 MB
#   stale /tmp files           → delete after 1 day

source /etc/brainstorm.conf
source "$BRAINSTORM_MODULE_BASE_DIR/src/utils/structuredLogging.sh"

LOG_DIR="${BRAINSTORM_LOG_DIR:-/var/log/brainstorm}"
TOTAL_FREED=0

# ── Helper: truncate a file to its last N megabytes ──────────
# Usage: truncate_if_over <file> <max_mb> <keep_mb>
truncate_if_over() {
    local file="$1"
    local max_mb="$2"
    local keep_mb="$3"

    [ -f "$file" ] || return 0

    local size_bytes
    size_bytes=$(stat -c %s "$file" 2>/dev/null || stat -f %z "$file" 2>/dev/null || echo 0)
    local max_bytes=$((max_mb * 1024 * 1024))

    if [ "$size_bytes" -gt "$max_bytes" ]; then
        local before_mb=$((size_bytes / 1024 / 1024))
        local keep_bytes=$((keep_mb * 1024 * 1024))

        tail -c "$keep_bytes" "$file" > "${file}.tmp" 2>/dev/null
        mv "${file}.tmp" "$file" 2>/dev/null

        local after_bytes
        after_bytes=$(stat -c %s "$file" 2>/dev/null || stat -f %z "$file" 2>/dev/null || echo 0)
        local freed=$((size_bytes - after_bytes))
        TOTAL_FREED=$((TOTAL_FREED + freed))

        echo "  Truncated $(basename "$file"): ${before_mb}MB → ${keep_mb}MB (freed $((freed / 1024 / 1024))MB)"
    fi
}

# ── Helper: delete old files and track freed space ───────────
# Usage: delete_old_files <directory> <name_pattern> <days>
delete_old_files() {
    local dir="$1"
    local pattern="$2"
    local days="$3"

    [ -d "$dir" ] || return 0

    local count=0
    local freed=0

    while IFS= read -r file; do
        local size
        size=$(stat -c %s "$file" 2>/dev/null || stat -f %z "$file" 2>/dev/null || echo 0)
        freed=$((freed + size))
        rm -f "$file"
        count=$((count + 1))
    done < <(find "$dir" -name "$pattern" -mtime +$days -type f 2>/dev/null)

    if [ "$count" -gt 0 ]; then
        TOTAL_FREED=$((TOTAL_FREED + freed))
        echo "  Deleted $count files matching '$pattern' older than ${days}d (freed $((freed / 1024 / 1024))MB)"
    fi
}

# ══════════════════════════════════════════════════════════════
# Main
# ══════════════════════════════════════════════════════════════

emit_task_event "TASK_START" "pruneOldLogs" "system" '{
    "message": "Starting log pruning maintenance task",
    "task_type": "maintenance",
    "scope": "system"
}'

echo "$(date): Starting pruneOldLogs"
echo "=================================================="

# 1. Delete events-*.jsonl archives older than 30 days
echo "[1/7] Events JSONL archives (30-day retention)..."
delete_old_files "$LOG_DIR/taskQueue" "events-*.jsonl" 30

# 2. Truncate structured.log if over 50 MB
echo "[2/7] Structured log (50 MB cap)..."
truncate_if_over "$LOG_DIR/taskQueue/structured.log" 50 10

# 3. Truncate system task logs over 20 MB
echo "[3/7] System task logs (20 MB cap)..."
for f in "$LOG_DIR"/*.log; do
    [ -f "$f" ] || continue
    truncate_if_over "$f" 20 5
done

# 4. Delete customer log files older than 30 days
echo "[4/7] Customer logs (30-day retention)..."
if [ -d "$LOG_DIR/customers" ]; then
    delete_old_files "$LOG_DIR/customers" "*.log" 30
fi

# 5. Truncate supervisor logs over 50 MB
echo "[5/7] Supervisor logs (50 MB cap)..."
for f in /var/log/supervisor/*.log; do
    [ -f "$f" ] || continue
    truncate_if_over "$f" 50 10
done

# 6. Truncate Neo4j logs over 50 MB
echo "[6/7] Neo4j logs (50 MB cap)..."
for f in /var/log/neo4j/*.log; do
    [ -f "$f" ] || continue
    truncate_if_over "$f" 50 10
done

# 7. Clean stale /tmp files older than 1 day
echo "[7/7] Stale /tmp files (1-day retention)..."
STALE_COUNT=0
while IFS= read -r file; do
    rm -f "$file" 2>/dev/null
    STALE_COUNT=$((STALE_COUNT + 1))
done < <(find /tmp -maxdepth 1 \( -name 'brainstorm_*' -o -name 'graperank_*' -o -name 'scores_completed_*' -o -name 'personalizedPageRankForApi_*' \) -mtime +1 -type f 2>/dev/null)
if [ "$STALE_COUNT" -gt 0 ]; then
    echo "  Deleted $STALE_COUNT stale temp files"
fi

# Summary
FREED_MB=$((TOTAL_FREED / 1024 / 1024))
echo "=================================================="
echo "$(date): Finished pruneOldLogs — freed approximately ${FREED_MB}MB"

emit_task_event "TASK_END" "pruneOldLogs" "system" '{
    "message": "Log pruning complete",
    "status": "success",
    "freed_bytes": '$TOTAL_FREED',
    "freed_mb": '$FREED_MB',
    "scope": "system"
}'

exit 0
