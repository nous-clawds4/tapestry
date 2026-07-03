# ADR 0002: harness-changelog — an append-only origin log, a shared path-set data file, and lint check L10

**Status:** Accepted (gate passed 2026-07-02, operator)
**Date:** 2026-07-02
**Story:** `engineering-team/stories/harness-self-improvement/2-harness-changelog.md`

## Context

Story 2 needs four artifacts to agree on one fact — *which paths constitute the harness definition*: the CHANGELOG convention text (README), the L10 check (harness-lint.sh), the divergence notice (whats-open.sh), and future consumers (story 5's stats, story 6's hook). Duplicating that path list across them would reproduce the exact restatement-drift failure class this book exists to kill. The repo already has the precedent for shared script data: `scripts/long-lived-branches.txt` (story-R-W1), read by whats-open with a drift warning.

Gate-ratified decisions folded in: one row per logical change; divergence base = merge-base with `origin/staging`, falling back to `origin/main`; L10 v1 checks the latest harness-touching commit only.

Test-suite interaction (found at design time): the story-1 fixtures commit their whole tree in one commit that touches def paths; once L10 exists, a fixture without a CHANGELOG would trip it and break all 19 existing tests. The clean fixture must therefore gain a CHANGELOG file — after which the single fixture commit touches both def paths and the CHANGELOG, satisfying L10 by construction.

## Options considered

### Option A — shared data file `scripts/harness-def-paths.txt`; CHANGELOG as an append-only table; L10 in harness-lint
The path set lives in one comment-and-lines data file (mirroring `long-lived-branches.txt`); harness-lint L10 and whats-open's divergence section both read it; README's convention text points at the file instead of restating the list. CHANGELOG.md is a chronological, append-at-bottom table (Date | Change | Why | Origin) — the OPEN.md row discipline, union-merge tolerant, greppable.
**Pros:** single definition, precedent-consistent, both consumers trivially in sync; table format matches the house ledger style and story 5 can parse it. **Cons:** one more small file; a data file can itself go stale — mitigated because the two consumers *are* the session-start surfaces.

### Option B — path set defined only inside harness-lint.sh; whats-open shells out to `harness-lint.sh --print-def-paths`
No new file.
**Pros:** one fewer artifact. **Cons:** couples whats-open's report to lint's CLI surface; a flag is less discoverable than a file; README would cite a script internal rather than a data artifact. The data-file precedent already won this argument once (branch keep-list).

### Option C — structured changelog (YAML/JSON) for machine consumption
**Pros:** trivially parseable for stats. **Cons:** breaks the house style (every ledger here is markdown); humans write these rows at commit time — friction kills compliance; a markdown table is already parseable enough (OPEN.md's rows prove it). Rejected.

## Decision

We chose **Option A**: it kills the four-way duplication with the mechanism this repo already uses for exactly this problem, and keeps the changelog in the ledger idiom contributors already maintain correctly (OPEN.md's write discipline demonstrably works).

## Consequences

- Story 5 (stats) and story 6 (SessionStart hook) get the path set for free from the same file.
- The CHANGELOG's Origin column becomes parseable input for the story-3 retro ("which channels produce changes").
- Adding a new harness surface (a new skill, a new script) now requires touching `harness-def-paths.txt` — itself a def path, so forgetting it is L10-visible on the next lint run.
- Fixture base gains a CHANGELOG.md; the 19 existing tests are re-baselined by that one addition (no assertion changes — verified at implementation).
- L10's latest-only scope means a *pair* of commits (harness change, then unrelated non-harness commit) hides nothing — the check keys on the latest commit *touching def paths*, not the latest commit overall.
- **Firmware reinstall required?** No.

## Implementation notes

- **`scripts/harness-def-paths.txt`** — comment header + one path (file or dir) per line: `CLAUDE.md`, `AGENTS.md`, `engineering-team/roles`, `engineering-team/workflows`, `engineering-team/templates`, `engineering-team/README.md`, `product-team/roles`, `product-team/workflows`, `product-team/templates`, `product-team/guardrails`, `product-team/README.md`, `.claude/agents`, `.claude/commands`, `.claude/skills`, `scripts/whats-open.sh`, `scripts/harness-lint.sh`, `scripts/harness-lint-waivers.txt`, `scripts/harness-def-paths.txt`, `scripts/long-lived-branches.txt`, `engineering-team/CHANGELOG.md`. (Records — stories/reviews/decisions/audits/OPEN.md — are deliberately NOT definition.)
- **`engineering-team/CHANGELOG.md`** — header: purpose, the one-row-per-logical-change rule, the touch-rule, "rows before 2026-07-02 are reconstructed"; then the table, chronological, append at bottom. Seed rows per the story's AC-2 list, each with commit pointer(s) and origin (mine `git log` for SHAs; the review doc + MIGRATION doc + journals supply origins).
- **`scripts/harness-lint.sh`** — `check_L10`: skip if no git history (fixture rule, as L9); read def paths from the data file (skip check with a visible `INFO` if the file is missing); `latest=$(git log -1 --no-merges --format=%h -- $paths)`; if that commit's `--name-only` list lacks `engineering-team/CHANGELOG.md` AND lacks nothing-but-CHANGELOG… simply: quiet when it includes the CHANGELOG, else `violation L10 "commit:$latest" "<msg naming first touched def path>"`. A missing CHANGELOG.md file (while def paths exist) is itself `violation L10 engineering-team/CHANGELOG.md "changelog missing"`. Waiver path shape `commit:<short-sha>` lets a specific commit be waived.
- **`scripts/whats-open.sh`** — new section "Harness definition changes since your branch diverged": resolve `base=$(git merge-base HEAD origin/staging 2>/dev/null || git merge-base HEAD origin/main 2>/dev/null)`; if base exists, `git log --oneline $base..origin/staging -- $paths` (falling back to `origin/main` when staging is absent); print "(none — your branch has current harness definitions)" when empty; skip silently when no remote refs (fixtures/offline).
- **`engineering-team/README.md`** § "Tuning the team" — add the convention paragraph: what counts as harness definition (point at the data file), the touch-rule, one row per logical change, and that L10 + `/whats-open` enforce/surface it.
- **`test/harness-lint.test.js`** — `cleanFiles()` gains `engineering-team/CHANGELOG.md` (+ the def-paths data file so fixtures exercise the real read path); new tests: L10 fires on a second commit touching a def path without the CHANGELOG; L10 quiet when the same commit touches both; L10 flags a missing CHANGELOG; L10 skipped without git. Existing 19 tests unchanged in assertion, re-run green.
- Story's own CHANGELOG rows (the review/sweep/story-1 entries + this story) land in the seed — making the repo pass L10 at close (AC-6).

## Out of scope

- Commit-time blocking (hooks/CI) — story 6 / OPEN.md row 13 territory.
- Parsing the CHANGELOG for metrics — story 5.
- The stricter every-commit-since-last-touch L10 variant — future tightening, per the gate decision.
