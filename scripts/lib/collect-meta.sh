# collect-meta.sh — the ONE source of the meta-escalation state (ADRs
# harness-self-improvement/0004 + 0006). Sourced (not executed) by its consumers:
#   scripts/whats-open.sh      — the top banner + the "Meta items" section
#   scripts/session-start.sh   — the session-start digest's meta line
# (the /whats-open command file and OPEN.md's rule text QUOTE the thresholds;
# they never restate them.)
#
# THRESHOLDS LIVE HERE ONLY: escalation fires at ≥3 open items or >30d oldest.
# collect_meta() fills META_LINES / META_COUNT / META_MAX_AGE from OPEN.md
# `meta` rows, open `meta` row files under ledger/ (ADR ledger-row-identity/0001)
# and un-marked intake "Meta:" entries (cwd-relative — callers cd to the repo
# root first). meta_escalation_fires() is the canonical predicate;
# meta_banner() the canonical wording. Callers decide WHEN to render.
# Escalation is advisory by construction: it never affects an exit code.

# Portable date→epoch (GNU + BSD) — sibling lib, single source (story
# test-hermeticity-ci #3, OPEN.md row 19: the age trigger was dead on macOS).
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/date-epoch.sh"
# The ledger's row files — sibling lib, single source (ADR ledger-row-identity/0001).
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/collect-ledger.sh"

META_LINES=""
META_COUNT=0
META_MAX_AGE=0
collect_meta() {
  local row cell opened age heading ep label
  if [ -f OPEN.md ]; then
    # Status is found BY VALUE, never by position: a literal pipe inside the Item
    # cell (code span or escaped) shifts every later field, so `$6` is only
    # sometimes the Status (OPEN.md row 290; story ledger-row-identity #2). It is
    # the first cell, from field 6 on (Type is $3; an Item and an Opened cell
    # always sit between), that reads exactly OPEN or starts with DONE; Opened is
    # the cell before it. awk prints two lines per open meta row: that Opened
    # cell, then the row.
    while IFS= read -r cell && IFS= read -r row; do
      opened=$(printf '%s' "$cell" | grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' | head -1)
      age="?"
      if [ -n "$opened" ] && ep=$(date_to_epoch "$opened"); then
        age=$(( ( $(date +%s) - ep ) / 86400 ))
        if [ "$age" -gt "$META_MAX_AGE" ]; then META_MAX_AGE=$age; fi
      fi
      META_COUNT=$((META_COUNT + 1))
      META_LINES="${META_LINES}  [${age}d] $(printf '%s' "$row" | cut -c1-150)"$'\n'
    done < <(grep -E '^\|' OPEN.md | awk -F'|' '$3 ~ /meta/ {
      for (i = 6; i <= NF; i++) {
        c = $i; gsub(/^[ \t]+|[ \t]+$/, "", c)
        if (c == "OPEN" || c ~ /^DONE/) { if (c == "OPEN") { print $(i-1); print $0 }; break }
      }
    }')
  fi
  # Rows minted since the table was frozen are files (ADR ledger-row-identity/0001):
  # same age arithmetic, same counters. awk prints two lines per open meta row
  # file — its Opened date (empty when the field holds none), then "<id> — <title>".
  while IFS= read -r opened && IFS= read -r label; do
    age="?"
    if [ -n "$opened" ] && ep=$(date_to_epoch "$opened"); then
      age=$(( ( $(date +%s) - ep ) / 86400 ))
      if [ "$age" -gt "$META_MAX_AGE" ]; then META_MAX_AGE=$age; fi
    fi
    META_COUNT=$((META_COUNT + 1))
    META_LINES="${META_LINES}  [${age}d] ${label}"$'\n'
  done < <(ledger_file_rows | awk -F'\t' '$2 ~ /meta/ && $4 == "OPEN" { print $3; print $1 " — " $5 }')
  # Un-marked intake "Meta:" entries count too (the 5-week origin-sync item is
  # the motivating casualty); age from the ISO date in the heading itself.
  while IFS= read -r heading; do
    opened=$(printf '%s' "$heading" | grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' | head -1)
    age="?"
    if [ -n "$opened" ] && ep=$(date_to_epoch "$opened"); then
      age=$(( ( $(date +%s) - ep ) / 86400 ))
      if [ "$age" -gt "$META_MAX_AGE" ]; then META_MAX_AGE=$age; fi
    fi
    META_COUNT=$((META_COUNT + 1))
    META_LINES="${META_LINES}  [${age}d] intake: ${heading#  }"$'\n'
  done < <(awk '
    /^## 20[0-9][0-9]-/ { if (h != "" && !d) print "  " h; h=$0; d=0 }
    /PICKED UP|RESOLVED/ { d=1 }
    END { if (h != "" && !d) print "  " h }
  ' engineering-team/stories/_intake.md 2>/dev/null | grep '— Meta:')
}

meta_escalation_fires() {
  [ "$META_COUNT" -ge 3 ] || [ "$META_MAX_AGE" -gt 30 ]
}

meta_banner() {
  printf '\n⚠ META ESCALATION — %s open harness lesson(s), oldest %sd (trigger: ≥3 open or >30d): propose a harness story at triage — group related items, name the story, list what it closes. See OPEN.md § "How to use this ledger".\n' "$META_COUNT" "$META_MAX_AGE"
}
