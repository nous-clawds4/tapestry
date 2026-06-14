#!/usr/bin/env bash
# whats-open.sh — one unified roll-up of open work across the repo, from ANY session.
#
# It DERIVES the view from the tracking surfaces that are already machine-readable
# (OPEN handoffs, open books, un-picked-up intake, protocol worksheet, open PRs,
# unmerged branches). The OPEN.md ledger is the home for small / cross-cutting
# items that have no other surface. Together they answer "what's still open?"
#
# Runnable solo (`bash scripts/whats-open.sh`) or via the `/whats-open` command,
# which runs this and then adds triage/prioritization. See OPEN.md and CLAUDE.md.
set -uo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
REPO="nous-clawds4/tapestry"
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
  grep -qiE '^\*\*Status:\*\*[[:space:]]*Open' "$f" && { any=1; echo "  $(basename "$(dirname "$f")")"; }
done
[ "$any" = 0 ] && echo "  (none open)"

hr "Intake entries with no PICKED UP / RESOLVED marker — heuristic, review manually"
awk '
  /^## 20[0-9][0-9]-/ { if (h != "" && !d) print "  " h; h=$0; d=0 }
  /PICKED UP|RESOLVED/ { d=1 }
  END { if (h != "" && !d) print "  " h }
' engineering-team/stories/_intake.md 2>/dev/null || echo "  (intake not found)"

hr "Protocol worksheet — protocols/worksheet.md (open problems)"
if [ -f protocols/worksheet.md ]; then
  grep -nE '^\s*[-*#].*\bW[0-9]+\b' protocols/worksheet.md | grep -viE 'done|resolved|closed|✅|ratified' | head -15 || echo "  (none flagged open — see worksheet)"
else
  echo "  (worksheet not found)"
fi

hr "Open PRs"
if command -v gh >/dev/null 2>&1; then
  gh pr list --repo "$REPO" --state open --json number,title,baseRefName \
    --jq '.[] | "  #\(.number) → \(.baseRefName): \(.title)"' 2>/dev/null || echo "  (gh error)"
  [ -z "$(gh pr list --repo "$REPO" --state open --json number --jq '.[].number' 2>/dev/null)" ] && echo "  (none)"
else
  echo "  (gh not available — skip)"
fi

hr "Unmerged feature branches vs origin/main (candidate cleanup)"
git fetch -q origin 2>/dev/null || true
# Exclude the long-lived sandbox branches (per CLAUDE.md autonomy ceiling) — they are not "to close".
git branch -r --no-merged origin/main 2>/dev/null \
  | grep -vE 'origin/(HEAD|main|staging|feature-magic-carpet|feat/communities|feat/curate|feat/pubkey-tagging-target)' \
  | sed 's/^/  /' | head -40
[ -z "$(git branch -r --no-merged origin/main 2>/dev/null | grep -vE 'origin/(HEAD|main|staging|feature-magic-carpet|feat/communities|feat/curate|feat/pubkey-tagging-target)')" ] && echo "  (none)"

printf '\nDerived from the tracking surfaces. Small/cross-cutting items with no other home belong in OPEN.md; everything else lives in its surface and is linked from there.\n'
