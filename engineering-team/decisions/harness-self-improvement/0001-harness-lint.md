# ADR 0001: harness-lint — a bash sibling of whats-open.sh with per-invariant checks, visible waivers, and fixture-driven tests

**Status:** Accepted (gate passed 2026-07-02, operator)
**Date:** 2026-07-02
**Story:** `engineering-team/stories/harness-self-improvement/1-harness-lint.md`

## Context

The harness's bookkeeping invariants (story 1's L1–L9) are all mechanically checkable from the repo tree plus git metadata — no stack, no network. The repo already has two relevant precedents: `scripts/whats-open.sh` (bash, derives a view from tracking surfaces, runs identically in local and remote sessions) and OPERATIONS.md §11's drift sentinels (invariants encoded as tests under `test/`, run by `npm test`). harness-lint needs to be both: a session-start guard (script, exit code, hook-friendly) *and* covered by the test suite (so the Reviewer's `npm test` gate exercises it).

Constraints from the story: one line per violation; exit 0/1; waiver file with OPEN.md citations and stale-waiver detection; wired into `/whats-open`; bash+git+coreutils only; Node test suite with synthetic fixtures plus a repo-clean assertion.

Gate-ratified decisions folded in: L1 parses review verdicts as *last verdict-shaped line wins*; L9 keeps the header check at a 14-day threshold.

Known-expected findings on first run (from pre-implementation reconnaissance):
- **L2:** three more Closed books with Active epics — `event-page`, `note-surfaces`, `open-ranking` (all stories Done; retirement simply never ran) — plus `live-feed` (held deliberately, OPEN.md row 16).
- **L4:** the four live-feed post-close reviews with no stories (OPEN.md row 16).
- **Non-numbered reviews:** `reviews/search-and-router/strfry-router-first-boot-config.md`, `reviews/tag-federation/bible-protocol-flip-accuracy.md` — predate the numbering convention.
- **L9:** BIBLE.md ("2026-05-04" vs git 2026-06-16) and OPERATIONS.md headers.

## Options considered

### Option A — bash script, function per invariant, mirroring whats-open.sh
`scripts/harness-lint.sh` in the same idiom as its sibling: `set -uo pipefail`, repo-root cd, one function per invariant emitting `VIOLATION <id> <path> — <msg>` lines, awk for the two structured parses (review verdicts, worksheet-style status pairing), waivers loaded from a flat file. Tests in Node (`test/harness-lint.test.js`, built-in runner) spawn the script against fixture trees built in a temp dir.
**Pros:** idiom-consistent with the tool it ships inside (`whats-open.sh` invokes it); zero dependencies; trivially honors the no-stack/no-network constraint; exit-code semantics natural for the future SessionStart hook. **Cons:** markdown link extraction and verdict parsing in awk/grep are cruder than a real parser — acceptable because L8 targets simple relative links and L1's rule was validated against all 57 existing reviews.

### Option B — Node script (`scripts/harness-lint.js`)
Richer parsing, easier unit testing of individual checks.
**Pros:** cleaner code for L1/L8. **Cons:** breaks the sibling symmetry with whats-open.sh (which would shell out to node mid-report); requires `node` on PATH for every session-start invocation (true today, but bash+git is a strictly smaller footprint); the repo's operational scripts under `scripts/` are bash.

### Option C — extend whats-open.sh in place
No new file; add invariant sections to the existing report.
**Pros:** one fewer file. **Cons:** conflates an informational roll-up (always exit 0, human-read) with a guard (exit code consumed by hooks/tests); whats-open would need a mode flag; the review explicitly modeled lint as a *sibling* so each stays single-purpose. Rejected.

## Decision

We chose **Option A** because the guard's primary consumers — `/whats-open`, the story-6 SessionStart hook, and contributors running it raw in remote sessions — all want a dependency-free script with honest exit codes, and idiom-consistency with whats-open.sh keeps the two derived views maintainable as a pair. The parsing-fidelity tradeoff is bounded and test-covered.

## Consequences

- Enables the story-2 changelog-touch check and story-7 budget check to land as new functions in an established structure (one function, one id, fixtures).
- The waiver file becomes the single sanctioned place where a known violation can persist — every waiver visibly cites its OPEN.md row, so `/whats-open` shows both the exception and its tracking entry.
- First-run findings (Context above) must be dispositioned at implementation time per the story's no-scope-creep rule: trivial ones fixed (L9 header dates), judgment-required ones waived with citations (live-feed, row 16) or filed (the three unretired epics → either retired in a separate mechanical commit mirroring the sweep, or one OPEN.md row; **Implementer surfaces the choice at the Review gate rather than deciding silently**).
- Fixture tests must `git init` their temp trees (L9 consults `git log`); the script must therefore tolerate running in a repo with sparse history.
- awk-based parsing means exotic markdown (reference-style links, HTML anchors) is out of L8's coverage — documented in the script header; the wiring set uses plain relative links today.
- **Firmware reinstall required?** No — no concept definitions touched; no product source touched.

## Implementation notes

- **`scripts/harness-lint.sh`** — structure:
  - Header comment: purpose, invariant list, waiver format, L8 coverage caveat.
  - `WIRING` path-set variable: `.claude/agents .claude/commands .claude/skills engineering-team/roles engineering-team/workflows engineering-team/templates product-team/roles product-team/workflows product-team/templates CLAUDE.md` (+ the two team READMEs for L8).
  - `violation <id> <path> <msg>` helper: checks the waiver table first; waived hits print `WAIVED <id> <path> (<citation>)`, unwaived print `VIOLATION …` and increment the counter. Waivers that match nothing by end of run print `STALE-WAIVER`.
  - One function per invariant, `check_L1` … `check_L9`:
    - **L1/L4** share a walk of `engineering-team/reviews/<epic>/<n>-*.md` (active only). Verdict = last line matching `PASS|CHANGES.?REQUESTED` in bold/heading position (awk keeps the final match — the ratified rule). L4 fires when no story with the same `<n>-` prefix exists in `stories/<epic>/` (checking `done/<epic>/` too, which must NOT count as satisfying L1's *active* requirement — a Done story in `done/` is fine, that's a retired epic). L1 fires when the story exists but `**Status:**` ≠ `Done`. L1 skips files L4 already flagged. Reviews without a `<n>-` prefix are reported as `INFO non-numbered-review` (not a violation, not exit-affecting).
    - **L2** parses each `audits/*/book.md` with `Status: Closed`, extracts backticked epic slugs from its "## Epics in this book" section, requires `epics/<slug>.md` to carry `Status: Done`.
    - **L3** for each active `stories/<epic>/` directory (excluding `done`), requires `epics/<epic>.md`.
    - **L5** greps the WIRING set for `localhost:8877` and `localhost:[0-9]{4}` not preceded by `$TAPESTRY_PORT` context — implemented as: flag `localhost:` followed by digits, allow-list `localhost:\$TAPESTRY_PORT`; AGENTS.md and `.claude/skills/cycle-*` (which legitimately own `:7778` for the local base URL) exempt via the waiver file, not hard-coded exemptions — so the exemptions are visible and citable.
    - **L6** greps WIRING for `(/Users/|/home/)[a-z]` (excluding `$HOME`-style variables).
    - **L7** asserts the four verdict-bearing files each contain `CHANGES_REQUESTED`, and that `review-changes.md` and `review-checklist.md` don't offer `FAIL` as a verdict token.
    - **L8** extracts `](...)` relative targets (stripping `#anchors`) from WIRING + CLAUDE.md + AGENTS.md + both READMEs, resolves each against the linking file's directory and repo root, flags misses.
    - **L9** for BIBLE.md + OPERATIONS.md: compare `**Last updated:**` date to `git log -1 --format=%ad --date=short -- <file>`; flag when >14 days apart. Skip silently when git history is absent (fixture tolerance).
  - Summary line + `exit [ $violations -gt 0 ]`.
- **`scripts/harness-lint-waivers.txt`** — `<id>\t<path-or-glob>\t<citation>`; shipped with: L4 × `reviews/live-feed/[3-6]-*` (OPEN.md row 16); L2 × `live-feed` (row 16); L5 × the cycle-skill `:7778` mentions and AGENTS.md (rationale lines, they own the constant); plus whatever the first-run disposition adds (see Consequences).
- **`scripts/whats-open.sh`** — new section "Harness invariants (harness-lint)" that runs the script and prints its output; the roll-up itself still exits 0 (informational), the raw script keeps the real exit code.
- **`test/harness-lint.test.js`** — Node built-in runner, registered in `test/test.js` the same way existing suites are. Builds a minimal fixture harness-tree per invariant in `fs.mkdtempSync` (each with `git init` + one commit where needed), spawns the script via `child_process.spawnSync('bash', …)`, asserts: detection of each seeded violation; clean exit on a clean fixture; waiver suppression + visible `WAIVED` line; `STALE-WAIVER` on an unused waiver; and finally spawns against the real repo expecting exit 0 (post-disposition).
- No changes to product source, firmware, or the concept graph.

## Out of scope

- L10 (changelog-touch) — story 2 adds `check_L10` once CHANGELOG.md exists.
- Budget-rule check (CLAUDE.md/AGENTS.md line caps) — story 7.
- Gate-"not run" streak detection — revisit with story 5's review parsing.
- Any CI invocation (OPEN.md row 13).
- Retiring the three newly-found unretired epics — dispositioned at the Review gate, not silently inside this story.
