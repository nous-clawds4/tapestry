#!/usr/bin/env bash
# harness-lint.sh — the harness checks its own bookkeeping invariants.
#
# Sibling of whats-open.sh (ADR harness-self-improvement/0001): whats-open
# DERIVES the open-work view; this script ASSERTS that the harness's own
# records are internally consistent. One line per violation, exit 1 on any
# unwaived violation, exit 0 otherwise. Run standalone, via /whats-open, or
# from a SessionStart hook. Needs only bash + git + coreutils; no network,
# no stack, no node_modules.
#
# Invariants:
#   L1 status-flip       PASS-final review  ⇒ its story is **Status:** Done
#   L2 epic-retirement   Closed book        ⇒ every epic it lists is Done
#   L3 epic-umbrella     active story folder ⇒ epics/<epic>.md exists
#   L4 review-has-story  numbered review    ⇒ a story with the same <n> exists
#   L5 no-hardcoded-port wiring files carry no literal localhost:<port>
#   L6 no-machine-paths  wiring files carry no /Users/... or /home/<name>/...
#   L7 verdict-enum      verdict-bearing files use PASS | CHANGES_REQUESTED only
#   L8 dead-links        relative markdown links in wiring/orientation docs resolve
#   L9 stale-headers     hand-maintained "Last updated:" within 14 days of git
#   L10 changelog-touch  latest commit touching harness-definition paths (per
#                        scripts/harness-def-paths.txt) also touches
#                        engineering-team/CHANGELOG.md; a missing CHANGELOG is
#                        itself a violation; waiver shape: commit:<short-sha>
#
# Review verdicts (L1/L4): the LAST verdict-shaped token in the file wins —
# a token is PASS or CHANGES_REQUESTED appearing on a heading line or inside
# bold markers (operator-ratified rule, story #1). Reviews without a numeric
# prefix are reported as INFO, not violations.
#
# Waivers: scripts/harness-lint-waivers.txt — tab-separated:
#   <invariant-id> <path-or-glob> <citation (OPEN.md row or reason)>
# A waived hit prints "WAIVED ..." (visibly, with its citation) and does not
# affect the exit code. A waiver that matches nothing prints "STALE-WAIVER".
#
# Known limits: L8 covers plain inline relative links only (no reference-style
# links or HTML anchors — the wiring uses none). L9 needs GNU `date -d`; on
# systems without it (stock macOS) the check is skipped silently, matching
# whats-open.sh's date handling.
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

WAIVER_FILE="scripts/harness-lint-waivers.txt"
violations=0

# Wiring set — the harness-definition files whose content must stay portable.
WIRING_DIRS=(.claude/agents .claude/commands .claude/skills
  engineering-team/roles engineering-team/workflows engineering-team/templates
  product-team/roles product-team/workflows product-team/templates)
LINK_DOCS_EXTRA=(CLAUDE.md AGENTS.md engineering-team/README.md product-team/README.md)

# ---------- waivers ----------
W_IDS=(); W_GLOBS=(); W_CITES=(); W_USED=()
if [ -f "$WAIVER_FILE" ]; then
  while IFS=$'\t' read -r wid wglob wcite; do
    case "$wid" in \#*|"") continue ;; esac
    W_IDS+=("$wid"); W_GLOBS+=("$wglob"); W_CITES+=("${wcite:-no citation}"); W_USED+=(0)
  done < "$WAIVER_FILE"
fi

violation() { # <id> <path> <msg>
  local id="$1" p="$2" msg="$3" i
  # ${!arr[@]} on an EMPTY array trips `set -u` on bash < 4.4 (macOS ships 3.2),
  # so guard on the length, which is safe everywhere.
  if [ "${#W_IDS[@]}" -gt 0 ]; then
    for i in "${!W_IDS[@]}"; do
      if [ "${W_IDS[$i]}" = "$id" ] && [[ "$p" == ${W_GLOBS[$i]} ]]; then
        W_USED[$i]=1
        echo "WAIVED $id $p (${W_CITES[$i]})"
        return
      fi
    done
  fi
  echo "VIOLATION $id $p — $msg"
  violations=$((violations + 1))
}

# ---------- L1 + L4: reviews vs stories ----------
# Final verdict = last PASS / CHANGES_REQUESTED token on a heading or bold line.
review_verdict() { # <file> -> PASS | CR | NONE
  awk '
    /^#/ || /\*\*/ {
      line = $0
      while (match(line, /CHANGES[ _]?REQUESTED|PASS/)) {
        v = (substr(line, RSTART, 2) == "PA") ? "PASS" : "CR"
        line = substr(line, RSTART + RLENGTH)
      }
    }
    END { print (v == "") ? "NONE" : v }
  ' "$1"
}

check_reviews() {
  local rf epic base n verdict story status matches
  for rf in engineering-team/reviews/*/*.md; do
    [ -e "$rf" ] || continue
    case "$rf" in engineering-team/reviews/done/*) continue ;; esac
    epic=$(basename "$(dirname "$rf")")
    base=$(basename "$rf")
    if [[ ! "$base" =~ ^[0-9]+- ]]; then
      echo "INFO non-numbered-review $rf (predates the numbering convention; not matchable to a story)"
      continue
    fi
    n="${base%%-*}"
    # story lookup: active folder first, then the retired counterpart
    matches=(engineering-team/stories/"$epic"/"$n"-*.md)
    [ -e "${matches[0]}" ] || matches=(engineering-team/stories/done/"$epic"/"$n"-*.md)
    story=""
    for s in "${matches[@]}"; do
      case "$s" in *.test-plan.md) continue ;; esac
      [ -e "$s" ] && { story="$s"; break; }
    done
    if [ -z "$story" ]; then
      violation L4 "$rf" "review has no matching story engineering-team/stories/[done/]$epic/$n-*.md"
      continue
    fi
    verdict=$(review_verdict "$rf")
    if [ "$verdict" = "PASS" ]; then
      status=$(grep -m1 -E '^\*\*Status:\*\*' "$story" | sed 's/^\*\*Status:\*\*[[:space:]]*//')
      case "$status" in
        Done*) ;;
        *) violation L1 "$story" "review $rf is PASS-final but story status is '${status:-missing}'" ;;
      esac
    fi
  done
}

# ---------- L2: closed books ⇒ epics Done ----------
check_L2() {
  local bf slug status estatus ef
  for bf in engineering-team/audits/*/book.md; do
    [ -e "$bf" ] || continue
    case "$bf" in engineering-team/audits/done/*) continue ;; esac
    status=$(grep -m1 -E '^\*\*Status:\*\*' "$bf" | sed 's/^\*\*Status:\*\*[[:space:]]*//')
    case "$status" in Closed*) ;; *) continue ;; esac
    # epic slugs = backticked tokens under "## Epics in this book"
    while IFS= read -r slug; do
      [ -n "$slug" ] || continue
      ef="engineering-team/epics/$slug.md"
      if [ ! -f "$ef" ]; then
        violation L2 "$ef" "book $bf is Closed but its epic file is missing"
        continue
      fi
      estatus=$(grep -m1 -E '^\*\*Status:\*\*' "$ef" | sed 's/^\*\*Status:\*\*[[:space:]]*//')
      case "$estatus" in
        Done*) ;;
        *) violation L2 "$ef" "book $bf is Closed but this epic is '${estatus:-missing}'" ;;
      esac
    done < <(awk '/^## Epics in this book/{s=1; next} /^## /{s=0} s && /^- /' "$bf" \
             | grep -oE '^- `[a-z0-9-]+`' | grep -oE '`[a-z0-9-]+`' | tr -d '`')
  done
}

# ---------- L3: active story folders ⇒ epic umbrella ----------
check_L3() {
  local d epic
  for d in engineering-team/stories/*/; do
    [ -d "$d" ] || continue
    epic=$(basename "$d")
    case "$epic" in done|_*) continue ;; esac
    [ -f "engineering-team/epics/$epic.md" ] \
      || violation L3 "engineering-team/stories/$epic/" "active story folder has no engineering-team/epics/$epic.md"
  done
}

# ---------- L5 + L6: portability of the wiring set ----------
check_L5_L6() {
  local hit f
  while IFS= read -r hit; do
    f="${hit%%:*}"
    violation L5 "$f" "hardcoded port: ${hit#*:}"
  done < <(grep -rn 'localhost:[0-9]' "${WIRING_DIRS[@]}" CLAUDE.md 2>/dev/null \
           | grep -v 'localhost:\$TAPESTRY_PORT' | sort -u)
  while IFS= read -r hit; do
    f="${hit%%:*}"
    violation L6 "$f" "machine-local absolute path: ${hit#*:}"
  done < <(grep -rnE '(/Users/|/home/)[A-Za-z]' "${WIRING_DIRS[@]}" CLAUDE.md 2>/dev/null | sort -u)
}

# ---------- L7: canonical verdict vocabulary ----------
check_L7() {
  local f
  for f in .claude/commands/review-changes.md engineering-team/roles/reviewer.md \
           engineering-team/workflows/5-review.md engineering-team/templates/review-checklist.md; do
    [ -f "$f" ] || continue
    grep -q 'CHANGES_REQUESTED' "$f" \
      || violation L7 "$f" "missing the canonical CHANGES_REQUESTED verdict token"
    grep -qE '\*\*FAIL\*\*' "$f" \
      && violation L7 "$f" "offers **FAIL** — the verdict enum is exactly PASS | CHANGES_REQUESTED"
  done
}

# ---------- L8: relative markdown links resolve ----------
check_L8() {
  local f dir target clean
  local files=()
  for d in "${WIRING_DIRS[@]}"; do
    while IFS= read -r f; do files+=("$f"); done < <(find "$d" -name '*.md' 2>/dev/null)
  done
  for f in "${LINK_DOCS_EXTRA[@]}"; do [ -f "$f" ] && files+=("$f"); done
  for f in "${files[@]}"; do
    dir=$(dirname "$f")
    while IFS= read -r target; do
      clean="${target%%#*}"                     # strip anchor
      [ -n "$clean" ] || continue               # pure-anchor link
      case "$clean" in
        http://*|https://*|mailto:*) continue ;;
        *'<'*|*'$'*|*'*'*|*'{'*) continue ;;    # template placeholders / globs
      esac
      [ -e "$dir/$clean" ] || [ -e "$clean" ] \
        || violation L8 "$f" "dead relative link → $clean"
    done < <(grep -oE '\]\([^)]+\)' "$f" 2>/dev/null | sed 's/^](//; s/)$//')
  done
}

# ---------- L9: hand-maintained freshness headers ----------
check_L9() {
  git rev-parse --git-dir >/dev/null 2>&1 || return 0
  date -d 2020-01-01 +%s >/dev/null 2>&1 || return 0   # needs GNU date; else skip
  local f hdr gitd hs gs days
  for f in BIBLE.md OPERATIONS.md; do
    [ -f "$f" ] || continue
    hdr=$(grep -m1 -E '^\*\*Last updated:\*\*' "$f" | grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' | head -1)
    [ -n "$hdr" ] || continue
    gitd=$(git log -1 --format=%ad --date=short -- "$f" 2>/dev/null)
    [ -n "$gitd" ] || continue
    hs=$(date -d "$hdr" +%s 2>/dev/null) || continue
    gs=$(date -d "$gitd" +%s 2>/dev/null) || continue
    days=$(( (gs - hs) / 86400 ))
    [ "$days" -gt 14 ] \
      && violation L9 "$f" "'Last updated: $hdr' lags the last git change ($gitd) by ${days}d (>14)"
  done
}

# ---------- L10: harness-definition commits carry a CHANGELOG row ----------
DEF_PATHS_FILE="scripts/harness-def-paths.txt"
CHANGELOG="engineering-team/CHANGELOG.md"
check_L10() {
  git rev-parse --git-dir >/dev/null 2>&1 || return 0   # fixture tolerance, as L9
  if [ ! -f "$DEF_PATHS_FILE" ]; then
    echo "INFO $DEF_PATHS_FILE missing — L10 (changelog-touch) skipped; the convention isn't adopted in this tree"
    return 0
  fi
  local def_paths=() p latest
  while IFS= read -r p; do
    case "$p" in \#*|"") continue ;; esac
    [ -e "$p" ] && def_paths+=("$p")
  done < "$DEF_PATHS_FILE"
  [ "${#def_paths[@]}" -gt 0 ] || return 0
  if [ ! -f "$CHANGELOG" ]; then
    violation L10 "$CHANGELOG" "harness-definition paths exist but the changelog is missing (the touch-rule can't be satisfied)"
    return 0
  fi
  latest=$(git log -1 --no-merges --format=%h -- "${def_paths[@]}" 2>/dev/null)
  [ -n "$latest" ] || return 0
  git show --name-only --format= "$latest" 2>/dev/null | grep -qx "$CHANGELOG" \
    || violation L10 "commit:$latest" "latest harness-definition commit ($(git show -s --format=%s "$latest" | cut -c1-60)…) did not touch $CHANGELOG — add the row (one per logical change)"
}

# ---------- run ----------
check_reviews
check_L2
check_L3
check_L5_L6
check_L7
check_L8
check_L9
check_L10

# stale waivers — visible, non-fatal (same bash-3.2 empty-array guard as violation())
if [ "${#W_IDS[@]}" -gt 0 ]; then
  for i in "${!W_IDS[@]}"; do
    [ "${W_USED[$i]}" = 0 ] \
      && echo "STALE-WAIVER ${W_IDS[$i]} ${W_GLOBS[$i]} (${W_CITES[$i]}) — matches nothing; remove or update"
  done
fi

if [ "$violations" -eq 0 ]; then
  echo "harness-lint: clean (0 violations)"
  exit 0
else
  echo "harness-lint: $violations violation(s)"
  exit 1
fi
