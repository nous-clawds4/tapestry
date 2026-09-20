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
# The multibyte-aware trim and the _intake.md marker grammar — sibling libs, single
# source each (ADR rollup-scanner-fidelity/0001, OPEN.md rows 290 and 208).
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/utf8-trim.sh"
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/collect-intake.sh"

META_LINES=""
META_COUNT=0
META_MAX_AGE=0
collect_meta() {
  local row cell opened age heading ep label state
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
      META_LINES="${META_LINES}  [${age}d] $(utf8_trim 150 "$row")"$'\n'
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
  # Intake "Meta:" entries that are not retired count too (the 5-week origin-sync item
  # is the motivating casualty); age from the ISO date in the heading itself. The marker
  # grammar is collect-intake.sh's, not a second copy: this loop used to test PICKED
  # UP|RESOLVED unanchored, so `**NOT PICKED UP**` retired an entry — the bug
  # whats-open.sh fixed on 2026-09-13 and this sibling kept (ADR
  # rollup-scanner-fidelity/0001). A `partial` entry says in its own marker that work
  # remains, so it counts, and its line says which it is. awk prints two lines per
  # entry: its state, then its heading.
  while IFS= read -r state && IFS= read -r heading; do
    opened=$(printf '%s' "$heading" | grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' | head -1)
    age="?"
    if [ -n "$opened" ] && ep=$(date_to_epoch "$opened"); then
      age=$(( ( $(date +%s) - ep ) / 86400 ))
      if [ "$age" -gt "$META_MAX_AGE" ]; then META_MAX_AGE=$age; fi
    fi
    META_COUNT=$((META_COUNT + 1))
    label="intake"
    [ "$state" = partial ] && label="intake (partly picked up)"
    META_LINES="${META_LINES}  [${age}d] ${label}: ${heading}"$'\n'
  done < <(intake_entries | awk -F'\t' '($1 == "open" || $1 == "partial") && $3 ~ /— Meta:/ { print $1; print $3 }')
}

meta_escalation_fires() {
  [ "$META_COUNT" -ge 3 ] || [ "$META_MAX_AGE" -gt 30 ]
}

meta_banner() {
  printf '\n⚠ META ESCALATION — %s open harness lesson(s), oldest %sd (trigger: ≥3 open or >30d): propose a harness story at triage — group related items, name the story, list what it closes. See OPEN.md § "How to use this ledger".\n' "$META_COUNT" "$META_MAX_AGE"
}
