# ADR 0005: harness-stats — a shared verdict library, slug-based story matching, and an always-zero exit

**Status:** Accepted (gate passed 2026-07-02, operator — Option A)
**Date:** 2026-07-02
**Story:** `engineering-team/stories/harness-self-improvement/5-harness-stats.md`

## Context

Three design problems. (1) The operator-ratified last-token verdict rule currently lives as an inline awk program inside `harness-lint.sh:review_verdict()`; stats needs the identical rule, and a second copy is the drift class this book kills. (2) Fixture trees run the scripts with `cwd` far from the repo, so any shared file must resolve relative to the *script's* location, not the working directory. (3) Story↔commit matching has no formal convention — messages conventionally carry the story slug and/or `(epic #n)` — so cycle times are necessarily heuristic and must report coverage honestly (gate decision 2).

Also fixed by prior decisions: always-exit-0 (story AC-2, the ADR-0004 advisory principle); controlled-timestamp fixtures (gate decision 3); the stats script is harness *definition* (registers in `harness-def-paths.txt`).

## Options considered

### Option A — extract `scripts/lib/review-verdict.awk`; both scripts resolve it via `BASH_SOURCE`; stats matches stories by slug with a coverage line
The awk program becomes a standalone file. `harness-lint.sh` and `harness-stats.sh` each compute `LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/review-verdict.awk"` once and call `awk -f "$LIB" <file>` — correct even when `cwd` is a fixture tree, because the script file itself always lives in the real repo (`BASH_SOURCE` is bash-3.2-safe). Story matching: a commit belongs to a story when its subject contains the story's kebab slug (slugs are effectively unique across the repo); cycle time = first `story:`-prefixed matching commit → last `review:`-prefixed matching commit (falling back to first→last matching commit when prefixes are absent), timestamps from `git log --format=%at`. Stories with no matching commits count into the coverage denominator.
**Pros:** one parser, two consumers, zero cwd fragility; slug matching needs no new convention and degrades honestly. **Cons:** `scripts/lib/` is a new directory (registered as a def path); slug matching misses stories whose commits never name the slug — accepted and *reported* (the coverage line is the design).

### Option B — stats shells out to `harness-lint.sh --verdict <file>`
**Pros:** no new file. **Cons:** grafts a CLI query surface onto a pass/fail gate; every stats run forks the whole lint script per review file; couples an instrument to a gate binary. Rejected.

### Option C — formalize a commit-message trailer (`Story: <epic>#<n>`) and match on it
**Pros:** exact matching, 100% coverage going forward. **Cons:** a new convention nobody's history follows — coverage would be ~0% on the existing 205 commits this story exists to measure; retrofitting messages is impossible. A future retro may propose the trailer *prospectively*; v1 must measure the past. Rejected for now.

## Decision

**Option A.** One shared parser resolved script-relative, slug-based matching with honest coverage, exit 0 unconditionally.

## Consequences

- `scripts/lib/` joins `harness-def-paths.txt` (the lib is definition — changing the verdict rule is a harness change and now L10-visible).
- `harness-lint.sh`'s `review_verdict()` becomes a thin wrapper; its 25 existing tests re-run unchanged and must stay green — the refactor is behavior-preserving by test.
- Coverage-line honesty means the number can be unflattering (old commits predate slug discipline) — that is data, not a bug; a future prospective trailer convention (Option C) is a natural retro proposal the stats output itself will motivate.
- Books under `audits/done/` count in throughput (closed books don't vanish from history when retired).
- **Firmware reinstall required?** No.

## Implementation notes

- **`scripts/lib/review-verdict.awk`** — the exact program from `harness-lint.sh` (heading-or-bold lines; last PASS/CHANGES_REQUESTED token wins; prints `PASS` | `CR` | `NONE`), with a header comment naming the ratified rule and both consumers.
- **`scripts/harness-lint.sh`** — `review_verdict()` → `awk -f "$LIB" "$1"`; `LIB` resolved once via `BASH_SOURCE`. No output change.
- **`scripts/harness-stats.sh`** — `set -uo pipefail`, cd to repo root (tolerate none), sections:
  - *(a) phase commits:* `git log --no-merges --format=%s` piped once; counts per prefix overall; per-epic = subjects containing each `epics/*.md` basename (incl. retired epic files — they remain in `epics/`); remainder bucketed "unattributed".
  - *(b) verdicts:* every `reviews/**/[0-9]*-*.md` (active + `done/`) through the shared awk → PASS/CR/NONE tallies; kick-back rate = CR-final ÷ (PASS+CR); churn = story numbers with >1 review file in an epic; "reviews with kick-back history" = files containing an interim `CHANGES_REQUESTED` regardless of final verdict (labeled as such).
  - *(c) books:* `audits/*/book.md` + `audits/done/*/book.md`: Status + Opened/Closed dates via the existing `date -d` guard; ages for Open, durations for Closed.
  - *(d) cycle times:* per story file (active + done, non-test-plan): slug from filename; matching commits via one pre-fetched `git log --format='%at %s'` scan; elapsed days story→review (fallback first→last); median + range via awk; the **coverage line**.
  - *Summary block* (`──── summary ────`): totals, kick-back rate, churn count, books open/closed, median cycle, coverage. `exit 0` unconditionally (parse failures degrade to "n/a", never nonzero).
- **`workflows/6-book-close.md` step 7** — "cite `scripts/harness-stats.sh` output when available (story 5)" → "cite `scripts/harness-stats.sh` output (run it at retro time)".
- **`scripts/harness-def-paths.txt`** — add `scripts/harness-stats.sh` and `scripts/lib` (same commit as the CHANGELOG row).
- **`test/harness-stats.test.js`** — fixture builder reuses the story-1 pattern plus `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` env on `git commit`; cases per the story's AC-5 list; registered in `test/test.js` per convention.
- Verification: suite green (new + existing 25), lint clean, real-repo run exits 0 with plausible numbers quoted in the review.

## Out of scope

- The prospective commit-trailer convention (future retro proposal).
- Defect-escape tracking; output persistence; whats-open/hook wiring (story 6 owns hook content).
