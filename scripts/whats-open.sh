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

# ---------- meta escalation pre-pass (ADRs harness-self-improvement/0004 + 0006) ----------
# Collect open harness lessons ONCE, before any section prints: the top banner
# and the "Meta items" section both consume this. The collector, the thresholds,
# and the banner wording live in scripts/lib/collect-meta.sh — shared with the
# session-start digest; never restate them here.
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/collect-meta.sh"
# Named here rather than leaned on transitively through collect-meta.sh: this script
# calls utf8_trim, intake_entries and date_to_epoch itself, and an implicit dependency
# is how three of story rollup-scanner-fidelity #1's six defects survived.
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/utf8-trim.sh"
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/collect-intake.sh"
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/date-epoch.sh"
collect_meta
if meta_escalation_fires; then
  meta_banner
fi

hr "OPEN.md ledger — small / cross-cutting items (the homeless ones)"
if [ -f OPEN.md ]; then
  ledger_open=0
  grep -E '^\|' OPEN.md | grep -iE '\|[[:space:]]*OPEN[[:space:]]*\|' && ledger_open=1
  # Rows minted since the table was frozen are files under ledger/ (ADR
  # ledger-row-identity/0001): one summary line each, in the table's column order.
  # ledger_file_rows comes in with collect-meta.sh, sourced above.
  file_rows=$(ledger_file_rows | awk -F'\t' '$4 == "OPEN" { printf "| %s | %s | **%s** → ledger/%s.md | %s | OPEN | | |\n", $1, $2, $5, $1, $3 }')
  if [ -n "$file_rows" ]; then ledger_open=1; printf '%s\n' "$file_rows"; fi
  [ "$ledger_open" = 1 ] || echo "  (no OPEN rows in the ledger)"
else
  echo "  (OPEN.md not found)"
fi

hr "Meta items (harness lessons) — escalates at ≥3 open or >30d"
if [ "$META_COUNT" -gt 0 ]; then
  printf '%s' "$META_LINES"
else
  echo "  (none open — the inbox is clear)"
fi

hr "🔴 OPEN handoffs — docs/*HANDOFF*.md"
any=0
for f in docs/*HANDOFF*.md; do
  [ -e "$f" ] || continue
  # 🔴 on a Status line = OPEN (✅ = addressed/superseded). Match the marker, not the
  # word, since the convention varies: "🔴 OPEN" vs bolded "🔴 **OPEN**".
  if grep -qi 'Status:.*🔴' "$f"; then
    # utf8_trim, not `cut -c1-150`: these lines carry emoji and em-dashes, and a cut
    # by byte can land inside one (scripts/lib/utf8-trim.sh; OPEN.md row 290 (d)).
    any=1; printf "  %s\n      %s\n" "$f" "$(utf8_trim 150 "$(grep -m1 -i 'Status:' "$f" | sed 's/\*\*//g')")"
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
    # date_to_epoch, not `date -d`: -d is GNU-only and macOS date answers "illegal
    # option -- d", so no age has ever printed on a Mac. Row 19 fixed exactly this in
    # collect-meta.sh on 2026-07-06 and this copy was missed (scripts/lib/date-epoch.sh).
    if [ -n "$opened" ] && ep=$(date_to_epoch "$opened"); then
      age=" (opened $opened, $(( ( $(date +%s) - ep ) / 86400 ))d ago)"
    fi
    echo "  $slug$age${parked:+ — $parked}"
  fi
done
[ "$any" = 0 ] && echo "  (none open)"

hr "Closed-book carry-forwards — unchecked items in audits/*/audit.md §6 (deferred scope)"
# Bounded, and honest about what it left out. Nothing ever ticks a §6 item when it is
# resolved elsewhere, so this register only grows: 55 books / 359 items on 2026-09-20,
# which nobody reads. Two suppressors, both overridable, plus a line stating the true
# totals — a section that hides work silently is the defect this story is about.
# The cure is the tick rule in workflows/6-book-close.md; these keep it readable meanwhile.
CARRY_DAYS=${WHATS_OPEN_CARRY_DAYS:-90}
CARRY_BOOKS=${WHATS_OPEN_CARRY_BOOKS:-8}
# A typo'd override must not take the roll-up down with it: anything that is not a run of
# digits falls back to the default (set -u would otherwise abort on the failed arithmetic).
case $CARRY_DAYS in ''|*[!0-9]*) CARRY_DAYS=90 ;; esac
case $CARRY_BOOKS in ''|*[!0-9]*) CARRY_BOOKS=8 ;; esac
carry_cutoff=$(( $(date +%s) - CARRY_DAYS * 86400 ))
carry_books=0; carry_items=0; carry_aged=0; carry_rows=""
for f in engineering-team/audits/*/audit.md; do
  [ -e "$f" ] || continue
  case "$f" in */done/*) continue ;; esac
  # Unchecked "- [ ]" bullets inside the "## 6" (carry-forward) section.
  items=$(awk '/^## 6[^0-9]/{s=1; next} /^## /{s=0} s && /^[[:space:]]*- \[ \]/' "$f")
  [ -n "$items" ] || continue
  n=$(printf '%s\n' "$items" | wc -l | tr -d ' ')
  carry_books=$((carry_books + 1)); carry_items=$((carry_items + n))
  bk="$(dirname "$f")/book.md"
  # The close date lives on **Closed:** — except in four books where it is only on the
  # Status line ("**Status:** Closed (2026-07-13)"). Read both before giving up.
  closed=$(grep -m1 -iE '^\*\*Closed:\*\*' "$bk" 2>/dev/null | grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' | head -1)
  [ -n "$closed" ] || closed=$(grep -m1 -iE '^\*\*Status:\*\*' "$bk" 2>/dev/null | grep -oE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' | head -1)
  # A book we cannot date is never suppressed — it sorts first and is always listed.
  if [ -n "$closed" ] && ep=$(date_to_epoch "$closed"); then
    if [ "$ep" -lt "$carry_cutoff" ]; then carry_aged=$((carry_aged + 1)); continue; fi
  else
    ep=9999999999
  fi
  carry_rows="${carry_rows}${ep}\t${f}\n"
done
if [ "$carry_books" = 0 ]; then
  echo "  (none — every closed book's register is clear)"
else
  shown=0
  while IFS=$'\t' read -r _ f; do
    [ -n "${f:-}" ] || continue
    [ "$shown" -lt "$CARRY_BOOKS" ] || break
    shown=$((shown + 1))
    echo "  $(basename "$(dirname "$f")"):"
    awk '/^## 6[^0-9]/{s=1; next} /^## /{s=0} s && /^[[:space:]]*- \[ \]/' "$f" | sed 's/^/    /' | head -10
  done < <(printf '%b' "$carry_rows" | sort -rn)   # %b, not a bare format: a path could hold a %
  # Name both suppressors separately: a reader must not have to subtract to learn what is
  # missing, and the two have different cures (age it out, or raise the budget).
  printf '  %s closed books hold %s unticked §6 items; showing the %s most recently closed.\n' \
    "$carry_books" "$carry_items" "$shown"
  printf '  Not shown: %s closed before the %s-day window, %s beyond the %s-book budget. Each book is capped at 10 items.\n' \
    "$carry_aged" "$CARRY_DAYS" "$(( carry_books - carry_aged - shown ))" "$CARRY_BOOKS"
  printf '  Widen with WHATS_OPEN_CARRY_DAYS / WHATS_OPEN_CARRY_BOOKS.\n'
  printf '  Tick a §6 item when it is resolved elsewhere (workflows/6-book-close.md) — that is what keeps this list true.\n'
fi

hr "Intake entries — engineering-team/stories/_intake.md (heuristic, review manually)"
# One reader, scripts/lib/collect-intake.sh, which also owns the marker grammar. This
# section used to carry its own copy of it and collect-meta.sh another; one was fixed on
# 2026-09-13 and the other was not, and they then disagreed about 6 of 33 entries.
if [ -f engineering-team/stories/_intake.md ]; then
  intake_all=$(intake_entries)
  echo "  No PICKED UP / RESOLVED / DONE / REASSIGNED marker:"
  unmarked=$(printf '%s\n' "$intake_all" | awk -F'\t' '$1 == "open" { print "    " $3 }')
  printf '%s\n' "${unmarked:-    (none)}"
  # A marker whose own parenthetical says work remains — (partial), (Part A),
  # (in progress), (Tier 1–2). Five entries today, none of which any reader has ever
  # listed; one of them says "**Part B still OPEN**" (OPEN.md row 208).
  partly=$(printf '%s\n' "$intake_all" | awk -F'\t' '$1 == "partial" { print "    " $3 }')
  if [ -n "$partly" ]; then
    echo "  Partly picked up — the marker itself says work remains:"
    printf '%s\n' "$partly"
  fi
  # A ### block under a marked parent is invisible to every reader, so retiring the
  # parent erases the child with no warning. That is how an untriaged security note was
  # lost for a day in September.
  nested=$(printf '%s\n' "$intake_all" | awk -F'\t' '$1 == "retired" && $4 != "" { print "    " $3 "\n        " $4 }')
  if [ -n "$nested" ]; then
    echo "  ⚠️  Retired entries that still carry ### sub-blocks — check the body before trusting the marker:"
    printf '%s\n' "$nested"
  fi
else
  echo "  (intake not found)"
fi

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

hr "Harness definition changes since your branch diverged"
# Commits on the shared line (origin/staging, else origin/main) touching the
# harness-definition paths (scripts/harness-def-paths.txt) that this branch's
# merge-base predates — new obligations to read before relying on stale rules.
if [ -f scripts/harness-def-paths.txt ]; then
  def_paths=()
  while IFS= read -r p; do
    case "$p" in \#*|"") continue ;; esac
    def_paths+=("$p")
  done < scripts/harness-def-paths.txt
  shared_ref=""
  git rev-parse --verify -q origin/staging >/dev/null 2>&1 && shared_ref="origin/staging"
  [ -z "$shared_ref" ] && git rev-parse --verify -q origin/main >/dev/null 2>&1 && shared_ref="origin/main"
  # bash-3.2 + set -u: expanding an empty array errors — guard the length first
  # (same discipline as harness-lint's waiver loops; story-2 review carry-over).
  if [ "${#def_paths[@]}" -eq 0 ]; then
    echo "  (def-paths file lists nothing — skipped)"
  elif [ -n "$shared_ref" ] && base=$(git merge-base HEAD "$shared_ref" 2>/dev/null); then
    changes=$(git log --oneline "$base".."$shared_ref" -- "${def_paths[@]}" 2>/dev/null | head -15)
    if [ -n "$changes" ]; then
      echo "$changes" | sed 's/^/  /'
      echo "  → read engineering-team/CHANGELOG.md for what changed and why"
    else
      echo "  (none — your branch has current harness definitions)"
    fi
  else
    echo "  (no shared-line remote ref — skipped)"
  fi
else
  echo "  (scripts/harness-def-paths.txt not found — skipped)"
fi

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
