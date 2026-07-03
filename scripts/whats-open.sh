#!/usr/bin/env bash
# whats-open.sh — one unified roll-up of open work across the repo, from ANY session.
#
# It DERIVES the view from the tracking surfaces that are already machine-readable
# (OPEN handoffs, open books, audit carry-forwards, un-picked-up intake, protocol
# worksheet, product-team surfaces, open PRs, unmerged branches, staging delta).
# The OPEN.md ledger is the home for small / cross-cutting items that have no
# other surface. Together they answer "what's still open?"
#
# Runnable solo (`bash scripts/whats-open.sh`) or via the `/whats-open` command,
# which runs this and then adds triage/prioritization. See OPEN.md and CLAUDE.md.
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
REPO="nous-clawds4/tapestry"
KEEPLIST="scripts/long-lived-branches.txt"
hr() { printf '\n──────── %s ────────\n' "$1"; }

hr "OPEN.md ledger — small / cross-cutting items (the homeless ones)"
if [ -f OPEN.md ]; then
  grep -E '^\|' OPEN.md | grep -iE '\|[[:space:]]*OPEN[[:space:]]*\|' || echo "  (no OPEN rows in the ledger)"
else
  echo "  (OPEN.md not found)"
fi

hr "🔴 OPEN handoffs — docs/*HANDOFF*.md"
any=0
for f in docs/*HANDOFF*.md; do
  [ -e "$f" ] || continue
  # 🔴 on a Status line = OPEN (✅ = addressed/superseded). Match the marker, not the
  # word, since the convention varies: "🔴 OPEN" vs bolded "🔴 **OPEN**".
  if grep -qi 'Status:.*🔴' "$f"; then
    any=1; printf "  %s\n      %s\n" "$f" "$(grep -m1 -i 'Status:' "$f" | sed 's/\*\*//g' | cut -c1-150)"
  fi
done
[ "$any" = 0 ] && echo "  (none open)"

hr "Open books — engineering-team/audits/*/book.md (Status: Open)"
any=0
for f in engineering-team/audits/*/book.md; do
  [ -e "$f" ] || continue
  if grep -qiE '^\*\*Status:\*\*[[:space:]]*Open' "$f"; then
    any=1
    slug=$(basename "$(dirname "$f")")
    opened=$(grep -m1 -iE '^\*\*Opened:\*\*' "$f" | grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' | head -1)
    parked=$(grep -m1 -iE '^\*\*Parked:\*\*' "$f" | sed 's/\*\*//g')
    age=""
    if [ -n "$opened" ] && date -d "$opened" +%s >/dev/null 2>&1; then
      age=" (opened $opened, $(( ( $(date +%s) - $(date -d "$opened" +%s) ) / 86400 ))d ago)"
    fi
    echo "  $slug$age${parked:+ — $parked}"
  fi
done
[ "$any" = 0 ] && echo "  (none open)"

hr "Closed-book carry-forwards — unchecked items in audits/*/audit.md §6 (deferred scope)"
any=0
for f in engineering-team/audits/*/audit.md; do
  [ -e "$f" ] || continue
  case "$f" in */done/*) continue ;; esac
  # Unchecked "- [ ]" bullets inside the "## 6" (carry-forward) section.
  items=$(awk '/^## 6[^0-9]/{s=1; next} /^## /{s=0} s && /^[[:space:]]*- \[ \]/' "$f")
  if [ -n "$items" ]; then
    any=1
    echo "  $(basename "$(dirname "$f")"):"
    echo "$items" | sed 's/^/    /' | head -10
  fi
done
[ "$any" = 0 ] && echo "  (none — every closed book's register is clear)"

hr "Intake entries with no PICKED UP / RESOLVED marker — heuristic, review manually"
awk '
  /^## 20[0-9][0-9]-/ { if (h != "" && !d) print "  " h; h=$0; d=0 }
  /PICKED UP|RESOLVED/ { d=1 }
  END { if (h != "" && !d) print "  " h }
' engineering-team/stories/_intake.md 2>/dev/null || echo "  (intake not found)"

hr "In-flight stories — active epics, Status not Done"
any=0
for f in engineering-team/stories/*/[0-9]*-*.md; do
  [ -e "$f" ] || continue
  case "$f" in */done/*|*test-plan*) continue ;; esac
  status=$(grep -m1 -E '^\*\*Status:\*\*' "$f" | sed 's/\*\*//g; s/^Status:[[:space:]]*//')
  case "$status" in
    Done*|"") ;;   # Done or no status line — skip (no-status files are template drafts)
    *) any=1; printf "  %-70s %s\n" "${f#engineering-team/stories/}" "[$status]" ;;
  esac
done
[ "$any" = 0 ] && echo "  (none — every active story is Done or has no status)"

hr "Protocol worksheet — protocols/worksheet.md (open problems)"
if [ -f protocols/worksheet.md ]; then
  # Pair each "## W<n>" heading with its following "**Status:**" line; print only
  # entries whose status is not graduated/resolved/closed. Entries with no
  # parseable Status line are flagged rather than silently guessed.
  awk '
    /^## W[0-9]+/ { if (h != "") emit(); h=$0; s="" }
    /^\*\*Status:\*\*/ { if (h != "") s=$0 }
    END { if (h != "") emit() }
    function emit() {
      if (s == "")                        { print "  " h "  [no Status line — unparsed]" }
      else if (s !~ /[Gg]raduated|[Rr]esolved|[Cc]losed|[Dd]one|✅|[Rr]atified/) {
        gsub(/\*\*/, "", s); print "  " h "\n      " substr(s, 1, 140)
      }
      h=""; s=""
    }
  ' protocols/worksheet.md
  echo "  (entries not listed are graduated/resolved)"
else
  echo "  (worksheet not found)"
fi

hr "Product-team surfaces"
any=0
for f in product-team/prd/*.md; do
  [ -e "$f" ] || continue
  status=$(grep -m1 -E '^\*\*Status:\*\*' "$f" | sed 's/\*\*//g; s/^Status:[[:space:]]*//')
  case "$status" in
    Draft*) any=1; echo "  PRD still Draft: $f" ;;
  esac
done
if [ -f product-team/stories-queue.md ] && ! grep -qiE '^\*\*Status:\*\*.*(Promoted|Consumed|Shipped)' product-team/stories-queue.md; then
  any=1; echo "  stories-queue.md has no Promoted/Consumed stamp — pending handoff or stale (stamp it at promotion)"
fi
for f in engineering-team/audits/*/prd-addendum.md; do
  [ -e "$f" ] || continue
  case "$f" in */done/*) continue ;; esac
  if grep -qiE '^##.*Open questions' "$f" && ! grep -qiE 'consumed|superseded' "$f"; then
    any=1; echo "  unconsumed addendum questions: $f"
  fi
done
[ "$any" = 0 ] && echo "  (nothing pending on the product side)"

hr "Harness invariants — scripts/harness-lint.sh"
if [ -f scripts/harness-lint.sh ]; then
  # Informational here (the roll-up always exits 0); run the script directly
  # or via a hook for the real exit code.
  bash scripts/harness-lint.sh 2>&1 | sed 's/^/  /'
else
  echo "  (harness-lint.sh not found)"
fi

hr "Open PRs"
if command -v gh >/dev/null 2>&1; then
  gh pr list --repo "$REPO" --state open --json number,title,baseRefName \
    --jq '.[] | "  #\(.number) → \(.baseRefName): \(.title)"' 2>/dev/null || echo "  (gh error)"
  [ -z "$(gh pr list --repo "$REPO" --state open --json number --jq '.[].number' 2>/dev/null)" ] && echo "  (none)"
else
  echo "  (gh not available — skip)"
fi

hr "Riding staging, not yet on main"
git fetch -q origin main staging 2>/dev/null || true
delta=$(git log --oneline --merges origin/main..origin/staging 2>/dev/null | head -15)
if [ -n "$delta" ]; then
  echo "$delta" | sed 's/^/  /'
  n=$(git log --oneline origin/main..origin/staging 2>/dev/null | wc -l | tr -d ' ')
  echo "  ($n commits total — anything here known not-prod-ready needs an OPEN.md row before cycle-prod)"
else
  echo "  (staging and main are level)"
fi

hr "Unmerged feature branches vs origin/main (candidate cleanup)"
# Long-lived / keep-by-design branches live in scripts/long-lived-branches.txt
# (kept in sync with OPERATIONS §1–§2 + templates/book.md autonomy ceiling) —
# they are not "to close" and get their own section below.
keep_pattern='origin/(HEAD|main|staging)'
if [ -f "$KEEPLIST" ]; then
  keep_branches=$(grep -vE '^\s*(#|$)' "$KEEPLIST" | awk '{print $1}')
  keep_pattern="origin/(HEAD|$(echo "$keep_branches" | paste -sd'|' - | sed 's/|/|/g'))"
fi
git branch -r --no-merged origin/main 2>/dev/null \
  | grep -vE "^\s*${keep_pattern}\$" \
  | sed 's/^/  /' | head -40
[ -z "$(git branch -r --no-merged origin/main 2>/dev/null | grep -vE "^\s*${keep_pattern}\$")" ] && echo "  (none)"

if [ -f "$KEEPLIST" ]; then
  hr "Held by design (scripts/long-lived-branches.txt) — drift check vs origin"
  while IFS= read -r line; do
    case "$line" in \#*|"") continue ;; esac
    b=$(echo "$line" | awk '{print $1}')
    reason=$(echo "$line" | cut -f2- -d'	' 2>/dev/null || true)
    if git show-ref --verify --quiet "refs/remotes/origin/$b"; then
      printf "  %-42s %s\n" "$b" "${reason:-}"
    else
      printf "  ⚠️  %-38s listed here but MISSING on origin — renamed or deleted? Update %s + OPERATIONS §1/§2\n" "$b" "$KEEPLIST"
    fi
  done < "$KEEPLIST"
fi

printf '\nDerived from the tracking surfaces. Small/cross-cutting items with no other home belong in OPEN.md; everything else lives in its surface and is linked from there.\n'
