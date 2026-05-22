#!/bin/bash
# reconciliationState.sh
#
# Persisted watermark for incremental reconciliation (story #21 / ADR 0018).
# Sourced by reconciliation.sh. State lives at:
#   /var/lib/brainstorm/pipeline/reconciliation/state.json
#
# Shape:
#   {
#     "lastRunStartedAt":      <unix seconds>,   # the recent-mode watermark
#     "lastRunCompletedAt":    <unix seconds>,
#     "lastRunMode":           "recent" | "all",
#     "lastFullRunCompletedAt":<unix seconds>,
#     "edgeCounts":            { "follows": N, "mutes": N, "reports": N }
#   }

RECON_STATE_DIR="${RECON_STATE_DIR:-/var/lib/brainstorm/pipeline/reconciliation}"
RECON_STATE_FILE="${RECON_STATE_FILE:-${RECON_STATE_DIR}/state.json}"

# Echo the lastRunStartedAt watermark (unix seconds); empty when no state exists.
get_watermark() {
  [[ -f "$RECON_STATE_FILE" ]] || return 0
  jq -r '.lastRunStartedAt // empty' "$RECON_STATE_FILE" 2>/dev/null
}

# Echo lastFullRunCompletedAt (unix seconds); empty when unknown.
get_last_full_completed() {
  [[ -f "$RECON_STATE_FILE" ]] || return 0
  jq -r '.lastFullRunCompletedAt // empty' "$RECON_STATE_FILE" 2>/dev/null
}

# write_state <startedAt> <completedAt> <mode> [fullCompletedAt] [followsCount] [mutesCount] [reportsCount]
# Atomic (write tmp + mv). Preserves lastFullRunCompletedAt unless a new one is given.
write_state() {
  local started="$1" completed="$2" mode="$3" fullCompleted="$4"
  local follows="${5:-0}" mutes="${6:-0}" reports="${7:-0}"

  mkdir -p "$RECON_STATE_DIR"
  if [[ -z "$fullCompleted" ]]; then
    fullCompleted="$(get_last_full_completed)"
  fi
  [[ -z "$fullCompleted" ]] && fullCompleted=0

  local tmp="${RECON_STATE_FILE}.tmp.$$"
  jq -n \
    --argjson started "$started" \
    --argjson completed "$completed" \
    --arg mode "$mode" \
    --argjson fullCompleted "$fullCompleted" \
    --argjson follows "$follows" \
    --argjson mutes "$mutes" \
    --argjson reports "$reports" \
    '{
      lastRunStartedAt: $started,
      lastRunCompletedAt: $completed,
      lastRunMode: $mode,
      lastFullRunCompletedAt: $fullCompleted,
      edgeCounts: { follows: $follows, mutes: $mutes, reports: $reports }
    }' > "$tmp" && mv "$tmp" "$RECON_STATE_FILE"
  chown brainstorm:brainstorm "$RECON_STATE_FILE" 2>/dev/null || true
}
