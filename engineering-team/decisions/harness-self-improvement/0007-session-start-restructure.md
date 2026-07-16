# ADR 0007: session-start-restructure — pointer table, normative ladder, and a budgets data file

**Status:** Accepted
**Date:** 2026-07-04 (accepted same day, operator, in-session gate)
**Story:** `engineering-team/stories/harness-self-improvement/7-session-start-restructure.md`

## Context

Three mechanism questions under the ratified gate decisions (exact caps; README-in-place; card in AGENTS.md).

1. **Where do the caps live and what enforces them?** The budget rule dies if it's prose (the R-E2 lesson this book exists to close). It needs a machine-read home whose *changes* are themselves visible events.
2. **What exactly replaces CLAUDE.md's two session-start blocks** without silently deleting load-bearing text? The "Also check" block carries story 4's capture-discipline sentence (meta rows) — that must survive the compression.
3. **Where is the stale Quickstart line, precisely?** Not in README.md itself: README § Quickstart is clean; the dead `git checkout concept-graph` is `docs/QUICKSTART.md:32`, which README links as its Quickstart guide. "Fix the stale Quickstart line" means that file; the *onboarding path* addition is README-in-place per the gate decision.

## Options considered

### Option A — `scripts/harness-budgets.txt` data file + lint check L11; table-for-blocks swap in CLAUDE.md; ladder as a rewritten AGENTS.md §2
**Budgets:** a new data file in the house pattern (waivers, def-paths, long-lived-branches): one `<path>\t<max-lines>` row per capped file, header carrying the R-S4 rule prose as its single source ("a change that adds lines must free lines; behavior that can live on-demand — command file, skill, script output, hook message — goes there instead"). Lint gains **L11**: `wc -l` per row; over-cap → violation whose message quotes the rule; missing/empty budgets file → INFO skip (L10's missing-def-file semantics); standard waiver mechanism applies. The budgets file joins `scripts/harness-def-paths.txt`, so **changing a cap is itself an L10 event** — cap erosion requires a CHANGELOG row with an origin. Caps are set to the exact post-restructure `wc -l` counts (gate decision 1), measured at implementation time.
**CLAUDE.md:** the "read all four" block and the "Also check at session start" block (lines 5–17) collapse into one **per-task pointer table** (~12 lines): touching code → AGENTS.md (BIBLE via its ToC when needed); deploying → OPERATIONS.md; product direction → ROADMAP.md; protocol/NIP → protocols/README.md; what's open → `/whats-open` (noting the story-6 digest auto-fires); loose ends/handoffs/intake → OPEN.md · `docs/*HANDOFF*` · `_intake.md` rows. Story 4's capture sentence survives as the OPEN.md row's clause ("harness defects get a `meta` row before session end"). Invariants section and TA-pubkey rule untouched. Net: CLAUDE.md shrinks (target ≤ 191; actual count becomes its cap).
**AGENTS.md:** §2 is rewritten as the **probe-and-fallback ladder**: step 0 = the ~10-line stack-free **orientation card** (what the system is, where domain knowledge lives, key directories — gate decision 3); step 1 = the §1 discovery + a short-timeout probe (`curl -sf -m 2 …/summaries`); step 2 (probe succeeds) = the existing three-call pattern, with the "don't load BIBLE.md" rule now explicitly scoped "when the graph is reachable"; step 3 (probe fails — web/remote/CI) = orient from `firmware/*.json`, then BIBLE §5–§9 via ToC, with an explicit *unavailable this session* list (firmware install §6, `/cycle-local`). §4's related don'ts get one-clause scope alignment. Target ≤ ~125 lines; actual count becomes its cap. This makes the story-6 digest's "fallback ladder (§1–§2)" pointer land on normative text.
**README/Quickstart:** README gains a ~6-line "Contributor orientation" block inside its existing Quickstart section (CLAUDE.md → engineering-team/README.md → `bash scripts/whats-open.sh` → BIBLE ToC); `docs/QUICKSTART.md:32`'s dead checkout line is deleted (clone lands on the default branch).
**Pros:** rule + caps in one file whose diffs are L10-recorded; lint mechanics identical to L10's proven shape; every displaced sentence has a named destination. **Cons:** a fourth scripts data file; line-count caps are a proxy for tokens (accepted: dependency-free, matches how the review stated the rule).

### Option B — caps as constants inside `harness-lint.sh`
Rejected: buries the rule prose in a script body; cap changes become script edits that read as lint changes, not budget decisions; breaks the house data-file pattern.

### Option C — prose-only budget rule, no lint check
Rejected: that is the pre-book failure mode by definition (stated twice, enforced nowhere); R-S4 exists because prose alone demonstrably didn't hold.

## Decision

**Option A.** Budgets as a def-path data file enforced by L11; pointer table replaces both CLAUDE.md session-start blocks; the ladder becomes AGENTS.md §2's normative shape; README fixed in place.

## Consequences

- Session-start reading drops from a ~32–34k-token mandate to task-proportional pointers; the always-loaded pair is frozen at measured sizes, and un-freezing requires a visible, origin-attributed CHANGELOG event.
- The stack-absent path (this session's own condition) becomes normative text instead of reviewer folklore.
- Line caps ratchet: future stories that need budget must free it — recorded in the budgets file's diff.
- CLAUDE.md's pointer rows are now the *only* home of the "which doc for which task" mapping — command files and READMEs must point, not restate (L-series spirit; reviewer checks).
- **Firmware reinstall required?** No.

## Implementation notes

- **`scripts/harness-budgets.txt`** — header: consumers (`harness-lint.sh` L11), the R-S4 rule prose, "caps = post-restructure `wc -l`; change a cap only with a CHANGELOG row naming why". Rows: `CLAUDE.md`, `AGENTS.md` with measured counts.
- **`scripts/harness-lint.sh`** — `check_L11()`: read budgets file (missing → INFO skip); per row `wc -l < "$path"`; over → `violation L11 "<path> is N lines, cap C — free lines or move behavior on-demand (rule: scripts/harness-budgets.txt)"`. No arrays needed (line-by-line read); bash-3.2 safe.
- **Restructure order matters:** rewrite CLAUDE.md + AGENTS.md first, measure, then write the budgets rows, then run lint — the suite's real-repo test pins the loop closed.
- **`scripts/harness-def-paths.txt`** — add `scripts/harness-budgets.txt`.
- **`test/harness-lint.test.js`** — three additions: over-cap fixture → L11 violation (message names file + cap); at-cap fixture → clean; missing budgets file → INFO, exit 0. Existing 25 tests untouched.
- **CLAUDE.md / AGENTS.md / README.md / docs/QUICKSTART.md** — per Option A text above; the review audits a before/after accounting (AC-6: every removed passage lands somewhere named or is declared redundant).
- **`engineering-team/CHANGELOG.md`** — one row (rides the same commit as the def-path touches; L10 clean).
- Verification: suites green (25+3 lint, 8 stats, 8 session-start); real-repo lint clean with both files at/under cap; digest pointer resolves (§ numbering in AGENTS.md preserved or the digest string updated in the same commit).

## Out of scope

- Token-based budgeting (line proxy accepted); CI snapshot of summaries (blocked on R-E3/row 13); ROADMAP/OPERATIONS content refresh (rows 14–15); BIBLE restructuring.
