# Review: Story 7 — session-start-restructure

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-04
**Diff:** story-7 commits — CLAUDE.md pointer table, AGENTS.md ladder, `scripts/harness-budgets.txt` (new) + lint L11, README orientation block, `docs/QUICKSTART.md` fix, `test/harness-lint.test.js` +3, def-paths + CHANGELOG (`d013c891` tests, `634e3882` impl)

## Quality gates (run by reviewer, not trusted)

- [x] Suites re-run standalone: **harness-lint 28/28 (25 pre-existing + 3 L11), harness-stats 8/8, session-start 8/8**. Full `npm test` failing set unchanged from the pre-book stack-dependent baseline (OPEN.md row 13) — zero regression.
- [x] `bash scripts/harness-lint.sh` — **exit 0, clean**; L10 satisfied (impl commit touches def paths + CHANGELOG together); L11 live over the real budgets file with both files **exactly at cap** (`wc -l`: CLAUDE.md 190/190, AGENTS.md 102/102 — the ratified no-headroom semantics, holding on day one).
- [x] **Cross-reference sweep:** the story-6 digest's "fallback ladder (§1–§2)" resolves (§1 discovery, §2 ladder — numbering preserved §1–§6); CLAUDE.md's "AGENTS.md §1–§3" and "§6" house-rule pointers still accurate; no `checkout concept-graph` survives outside record artifacts (test plan, ADR — descriptions of the fix, not instructions); "read all four" survives only in records (epic text, handoff, CHANGELOG).
- [x] **Deletion audit (AC-6), line by line over `git diff`:** every removed clause either re-homed or named redundant — see Spec adherence.
- [x] Playwright / lint / typecheck — n/a.

## Spec adherence (AC-by-AC)

- [x] **AC-1** pointer table replaces both blocks; invariants + TA rule untouched; 191 → **190** lines. Story 4's capture sentence survives on the OPEN.md row; the 🔴/✅ handoff semantics survive on theirs.
- [x] **AC-2** ladder in AGENTS.md §2 with the stack-free card (5 lines — under the ~15 budget), ≤2s probe, success branch carrying the preserved three-call intro + "then stop" verbatim, failure branch (`firmware/*.json` → BIBLE §5–§9 via ToC) + explicit unavailable-list; §4's don't-load rule scoped to the reachable branch — the §4.4 contradiction is resolved *in both files that expressed it*.
- [x] **AC-3** README 4-step contributor orientation in Quickstart, in place (gate decision 2); `docs/QUICKSTART.md:32` dead checkout deleted. (The review's finding said "README.md's Quickstart"; the actual line lived in the linked `docs/QUICKSTART.md` — corrected in the ADR, fixed at the real site.)
- [x] **AC-4** L11 live; caps in `scripts/harness-budgets.txt` only, with the R-S4 rule prose as its header; violation message names count + cap + rule source (fixture-pinned). The budgets file is a def path — cap raises are L10-recorded events. CLAUDE.md's table intro *quotes* the rule in six words and points ("free lines before adding any") — the story-4 quote-don't-restate precedent, not a second source.
- [x] **AC-5** 3 new tests; at-cap-is-clean boundary pinned; the shared fixture untouched (25 pre-existing tests unmodified, each doubling as the missing-budgets INFO path); real-repo caps verified from two independent directions (JS recount + bash L11).
- [x] **AC-6** deletion accounting: re-homed — all four doc descriptors (→ table rows), write discipline (→ OPEN.md row + § "How to use this ledger", verified to carry the scope/DONE/escalation detail), handoff semantics, intake + protocols pointers, AGENTS.md §2 prose (→ ladder branches, "then stop" verbatim). **Named redundant** (the AC's declared channel): the OPEN.md examples list (covered by the ledger's own rules §), BIBLE's "design decisions" descriptor (ADRs are the record; the ToC exposes it), protocols' "Custom NIPs, local pre-NIPs" enumeration (protocols/README.md is the index and says so), the "read all four" mandate itself (the defect under repair), and two rationale clauses ("so any next session sees them", "surfaces below hold the larger triaged work") absorbed by table structure.
- [x] **AC-7** def-paths (+`scripts/harness-budgets.txt` — self-listing property held a fourth time), CHANGELOG row, lint clean.

## ADR adherence

- [x] Option A precisely: budgets data file (tab-separated, house pattern), L11 with L10's missing-file INFO semantics, table-for-blocks swap, §2 ladder rewrite, README-in-place, QUICKSTART line deleted. Restructure-then-measure order honored (caps equal measured counts).
- [x] No deviations. No new dependencies (bash + coreutils; no arrays in L11 — bash-3.2 safe; `IFS=$'\t'` supported on 3.2).

## Concept-graph integrity

- [x] n/a — orientation/wiring only. **Firmware reinstall:** not required.

## Things tests can't catch

- [x] AGENTS.md grew 98 → 102 (the ladder is net-new normative text; the story's cap semantics are post-restructure sizes, ratified). CLAUDE.md shrank. Combined always-loaded budget: 292 lines, now frozen.
- [x] A malformed budgets row (space for tab) silently skips in L11 (`case` guard) — mitigated for the two real files by the JS test, which parses rows independently and fails on a missing/unparseable row. Acceptable; noted for any future third row.
- [x] No secrets, no debug output; L11 adds no network/stack dependency (the no-env fixture test still passes).

## Findings

### Blocking
_None._

### Non-blocking
1. **`.claude/commands/design-architecture.md` (house rules)** — "If the local stack is not running, ask the user whether to bring it up before proceeding" predates and now contradicts the normative ladder (remote sessions cannot bring the stack up; the ladder's stack-absent branch is the sanctioned path). One-line repoint to AGENTS.md §2. Recorded as **OPEN.md row 18** (`meta`) — the Reviewer's sanctioned channel; candidate for immediate disposition at the imminent book retro.
2. **`scripts/harness-lint.sh` L11 malformed-row skip** — see above; consider a `STALE-BUDGET`-style INFO if a third capped file is ever added. No action now.

### Harness friction *(→ OPEN.md `meta` rows)*
1. Row 18 (above). Adding it brought the open `meta` count to **3, firing the escalation banner on the real repo** — the loop's capture → escalate chain triggering on its own review findings, with the book-close retro (frame bullet 9) as the designated consumer. Working as designed; noted here as the first live escalation.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection run: **7 of 7 stories Done** — frame bullets 1–8 are satisfied; bullet 9 ("this book's own `/close-book` executes the new post-mortem/retro step — the first live run") is satisfied *by the act of closing*. **The book looks complete. Offering `/close-book`** (not auto-running): the close will run the first live retro, with queued inputs including the story-1 verdict-rule edge, the 19-story coverage gap, the gate-judge Bash revisit, rows 16 + 18, and this book's own stats.
