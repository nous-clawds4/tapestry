#!/usr/bin/env bash
# harness-stats.sh — the harness measures itself (ADR harness-self-improvement/0005).
#
# Derives, from the repo's own conventions, the numbers the book-close retro
# (workflows/6-book-close.md step 7) argues from:
#   (a) phase commits   story:/adr:/test:/impl:/review: counts, per epic
#   (b) review verdicts final PASS vs CHANGES_REQUESTED (shared last-token
#                       rule: scripts/lib/review-verdict.awk), re-review churn,
#                       kick-back rate
#   (c) books           opened vs closed, ages and open→close durations
#   (d) cycle times     story→review elapsed per story, matched by kebab slug
#                       in commit subjects, with an HONEST coverage line —
#                       unmatched stories are counted, never dropped
# then one summary block (the paste-into-the-retro unit).
#
# This is an INSTRUMENT, not a gate: it ALWAYS exits 0 (the ADR-0004 advisory
# principle — it can never poison a hook, a test gate, or a pipeline). Parse
# failures degrade to "n/a". Needs bash + git + coreutils only; no network,
# no stack. Slug matching is heuristic by design — trust the coverage line,
# not the vibe. Date math is portable (GNU + BSD) via scripts/lib/date-epoch.sh.
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || true

VERDICT_LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/review-verdict.awk"
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/date-epoch.sh"
hr() { printf '\n──────── %s ────────\n' "$1"; }

HAS_GIT=0
git rev-parse --git-dir >/dev/null 2>&1 && HAS_GIT=1

# One git scan feeds sections (a) and (d): "epoch<TAB>subject" per commit.
LOG=""
[ "$HAS_GIT" = 1 ] && LOG=$(git log --no-merges --format='%at	%s' 2>/dev/null || true)

days_between() { # <epoch-from> <epoch-to> -> integer days
  echo $(( ($2 - $1) / 86400 ))
}

# ---------- (a) phase commits ----------
hr "Phase commits (story:/adr:/test:/impl:/review:)"
TOTAL_PHASE=0
if [ -n "$LOG" ]; then
  for p in story adr test impl review; do
    n=$(printf '%s\n' "$LOG" | cut -f2- | grep -c "^$p: " || true)
    printf '  %-8s %s\n' "$p:" "$n"
    TOTAL_PHASE=$((TOTAL_PHASE + n))
  done
  echo "  per epic (subject contains the epic name; heuristic):"
  PHASE_SUBJECTS=$(printf '%s\n' "$LOG" | cut -f2- | grep -E '^(story|adr|test|impl|review): ' || true)
  attributed=0
  for ef in engineering-team/epics/*.md; do
    [ -e "$ef" ] || continue
    e=$(basename "$ef" .md)
    n=$(printf '%s\n' "$PHASE_SUBJECTS" | grep -cF "$e" || true)
    [ "$n" -gt 0 ] && { printf '    %s: %s\n' "$e" "$n"; attributed=$((attributed + n)); }
  done
  # Overlaps possible when one subject names two epics; the bucket below is
  # therefore a floor, printed only when meaningful.
  [ "$TOTAL_PHASE" -gt "$attributed" ] && echo "    (unattributed to any epic name: $((TOTAL_PHASE - attributed)))"
else
  echo "  (no git history — skipped)"
fi

# ---------- (b) review verdicts ----------
hr "Review verdicts (shared last-token rule — scripts/lib/review-verdict.awk)"
PASS_N=0; CR_N=0; NONE_N=0; KB_HIST=0; CHURN=0
for rf in engineering-team/reviews/*/[0-9]*-*.md engineering-team/reviews/done/*/[0-9]*-*.md; do
  [ -e "$rf" ] || continue
  v=$(awk -f "$VERDICT_LIB" "$rf" 2>/dev/null || echo NONE)
  case "$v" in
    PASS) PASS_N=$((PASS_N + 1)) ;;
    CR)   CR_N=$((CR_N + 1)) ;;
    *)    NONE_N=$((NONE_N + 1)) ;;
  esac
  grep -q 'CHANGES_REQUESTED\|CHANGES REQUESTED' "$rf" && KB_HIST=$((KB_HIST + 1))
done
# churn: story numbers with >1 review file inside one epic folder
for d in engineering-team/reviews/*/ engineering-team/reviews/done/*/; do
  [ -d "$d" ] || continue
  case "$d" in engineering-team/reviews/done/) continue ;; esac
  n=$(ls "$d" 2>/dev/null | grep -E '^[0-9]+-' | sed 's/^\([0-9]*\)-.*/\1/' | sort | uniq -d | wc -l | tr -d ' ')
  CHURN=$((CHURN + n))
done
TOTAL_R=$((PASS_N + CR_N))
echo "  reviews parsed: $((PASS_N + CR_N + NONE_N)) (no-verdict: $NONE_N)"
echo "  final PASS: $PASS_N"
echo "  final CHANGES_REQUESTED: $CR_N"
if [ "$TOTAL_R" -gt 0 ]; then
  KB_RATE="$(( CR_N * 100 / TOTAL_R ))%"
else
  KB_RATE="n/a"
fi
echo "  kick-back rate: $KB_RATE (CR-final ÷ decided)"
echo "  reviews with kick-back history (any CHANGES_REQUESTED mention): $KB_HIST"
echo "  re-review churn (story numbers with >1 review file): $CHURN"

# ---------- (c) books ----------
hr "Books (audits/*/book.md, incl. done/)"
B_OPEN=0; B_CLOSED=0
for bf in engineering-team/audits/*/book.md engineering-team/audits/done/*/book.md; do
  [ -e "$bf" ] || continue
  slug=$(basename "$(dirname "$bf")")
  status=$(grep -m1 -E '^\*\*Status:\*\*' "$bf" | sed 's/^\*\*Status:\*\*[[:space:]]*//')
  opened=$(grep -m1 -E '^\*\*Opened:\*\*' "$bf" | grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' | head -1)
  closed=$(grep -m1 -E '^\*\*Closed:\*\*' "$bf" | grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' | head -1)
  case "$status" in
    Closed*)
      B_CLOSED=$((B_CLOSED + 1))
      dur="n/a"
      if [ -n "$opened" ] && [ -n "$closed" ] && oe=$(date_to_epoch "$opened") && ce=$(date_to_epoch "$closed"); then
        dur="$(days_between "$oe" "$ce")d"
      fi
      echo "  $slug: closed, $dur open→close"
      ;;
    Open*)
      B_OPEN=$((B_OPEN + 1))
      age="?"
      if [ -n "$opened" ] && oe=$(date_to_epoch "$opened"); then
        age="$(days_between "$oe" "$(date +%s)")d"
      fi
      echo "  $slug: open, $age"
      ;;
  esac
done
echo "  open: $B_OPEN"
echo "  closed: $B_CLOSED"

# ---------- (d) cycle times ----------
hr "Story cycle times (kebab-slug match against commit subjects)"
MATCHED=0; TOTAL_S=0; CYCLES=""
for sf in engineering-team/stories/*/[0-9]*-*.md engineering-team/stories/done/*/[0-9]*-*.md; do
  [ -e "$sf" ] || continue
  case "$sf" in *test-plan*) continue ;; esac
  case "$(dirname "$sf")" in */_*) continue ;; esac
  TOTAL_S=$((TOTAL_S + 1))
  base=$(basename "$sf" .md)
  slug=$(printf '%s' "$base" | sed 's/^[0-9]*-//')
  [ -n "$LOG" ] || continue
  m=$(printf '%s\n' "$LOG" | grep -F "$slug" || true)
  [ -n "$m" ] || continue
  s_ts=$(printf '%s\n' "$m" | awk -F'\t' '$2 ~ /^story: /  {print $1}' | sort -n | head -1)
  r_ts=$(printf '%s\n' "$m" | awk -F'\t' '$2 ~ /^review: /' | awk -F'\t' '{print $1}' | sort -n | tail -1)
  label="story→review"
  if [ -z "$s_ts" ] || [ -z "$r_ts" ] || [ "$r_ts" -lt "$s_ts" ]; then
    s_ts=$(printf '%s\n' "$m" | cut -f1 | sort -n | head -1)
    r_ts=$(printf '%s\n' "$m" | cut -f1 | sort -n | tail -1)
    label="first→last"
  fi
  d=$(days_between "$s_ts" "$r_ts")
  echo "  $slug: ${d}d ($label)"
  CYCLES="$CYCLES $d"
  MATCHED=$((MATCHED + 1))
done
MEDIAN="n/a"
if [ -n "${CYCLES// /}" ]; then
  MEDIAN=$(printf '%s\n' $CYCLES | sort -n | awk '{a[NR]=$1} END {print (NR%2) ? a[(NR+1)/2] "d" : a[NR/2] "d"}')
fi
echo "  matched $MATCHED of $TOTAL_S stories (unmatched are counted, not dropped)"

# ---------- summary ----------
hr "──── summary ────"
echo "  phase commits: $TOTAL_PHASE"
echo "  reviews decided: $TOTAL_R · kick-back rate: $KB_RATE · churn: $CHURN"
echo "  books — open: $B_OPEN · closed: $B_CLOSED"
echo "  cycle time median: $MEDIAN (0d = same-day) · matched $MATCHED of $TOTAL_S stories"
echo "  (instrument, not gate — thresholds and judgment belong to the retro)"

exit 0
