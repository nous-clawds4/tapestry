# date-epoch.sh — the ONE portable YYYY-MM-DD → epoch-seconds converter
# (story test-hermeticity-ci #3, OPEN.md row 19). GNU date takes -d; BSD/
# macOS date needs -j -f (midnight-normalized here so both platforms agree
# to the day). Sourced (not executed) by:
#   scripts/lib/collect-meta.sh — meta-row ages (the >30d escalation trigger)
#   scripts/harness-lint.sh     — L9 freshness-header staleness
#   scripts/harness-stats.sh    — book durations and ages
# Prints the epoch and returns 0, or prints nothing and returns 1 — callers
# keep their existing skip/"?" degradation on genuinely unparseable dates.
# GNU behavior is unchanged (the -d branch wins there).
date_to_epoch() { # <YYYY-MM-DD>
  [ -n "${1:-}" ] || return 1
  date -d "$1" +%s 2>/dev/null && return 0
  date -j -f '%Y-%m-%d %H:%M:%S' "$1 00:00:00" +%s 2>/dev/null
}
