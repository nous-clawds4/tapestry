# Review: Story 4 — Publish-time default stamping

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-06
**Diff:** `git diff 84926063^..HEAD` (commits `84926063` story+book, `4a5b90fd` ADR, `d9b3e2c4` failing tests, `c3d0a017` implementation, `1935…/f1x` review-round pin amendment) — 13 files, +669/−11 before the round.

## Round history (this file is where it lives)

**Round 1 verdict: kickback.** The Reviewer's first independent full run failed on ONE term hidden
above the log window: `restore-historical-data-and-fix-tl-author-filter` (the ADR-0015 migration
suite) — its caller pin forbade the token `taPubkey` anywhere in `Tag.jsx`'s `pinTag(...)` args and
tripped on ADR 0004's `localTaPubkey: taPubkey` (the *value* is the runtime TA from `useConfig` —
the exact pattern the ADR-0015 era itself built for `publishProfileTagAssertion`; the removed
handle-composition *parameter* was not reintroduced, and the canonical handle stays on the frozen
literal). Ask: amend the pin to assert intent — parameter KEYS checked, value usage allowed.
**Resolved** in the same session: the pin now extracts arg keys and bans `taPubkey` as a key, dated
and citing ADR 0004; 22/0 on the amended suite; the definitive full re-run is **Overall: PASS with
zero failing lines** (window widened to hold the entire grown summary — the narrow-tail trap that
hid this term twice is noted below).

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — the definitive independent run (2026-08-06, router quiesced, nothing
      concurrent): **Overall PASS, zero FAIL lines** — all five story suites green
      (`publish-time-default-stamping` 14/14), the amended ADR-0015 suite 22/0,
      `relationship-primitives` green (the earlier once-off was the pre-documented OPEN.md #141
      churn flake — did not reproduce without concurrent load).
- [x] `bash scripts/harness-lint.sh` — clean.
- [x] Bundle check: three `:tag-pinning` templates served (the legacy constant + both personal
      additions); concepts surface console-clean on load.

## Spec adherence (story ACs)

- [x] **AC-1 pin parity** — both builders gain the conditional personal handle
      ([publishTagPin.js](../../../ui/src/utils/publishTagPin.js)); `localTaPubkey` plumbed at all
      four call sites (Tag.jsx, PinnedListPanel ×2, ExportModal + its new `useConfig` hook);
      legacy literal untouched (S1's lookahead-tightened pin + the ADR-0015 suite's own guards).
- [x] **AC-2 TL parity** — the personal handle beside `TAG_PINNING_Z_TAG`, runtime-resolved (S2).
- [x] **AC-3 the resolver** — `selectPointerTargets` + `STAMP_CAP` in the b-semantics home;
      type/form/self/cap/dedupe semantics U-pinned exhaustively (U1–U5).
- [x] **AC-4 the seam** — the header query collects `{value, type}` b rows (null-row filtered;
      no cartesian risk — single superset edge); wired → both z's (H2), unwired/deferred → single
      z byte-identically (H1/H3, regression rows).
- [x] **AC-5 no regressions** — profile-tag dual lines byte-unchanged (S3); every sibling suite
      green; no re-stamping path anywhere in the diff (confirmed by read).
- [x] **AC-6 gates** — per Quality gates.

## ADR adherence + episode audit

- [x] Files match ADR 0004 exactly; no unauthorized dependencies; untouchables zero-diff.
- [x] **The red-era-poisoned singleton (AUDITED, SOUND):** H2's fixed-name fixture was first minted
      during the failing-first era (single-z, as the code then correctly produced); the dupe check
      then froze it. One surgical graph delete let the re-mint supersede it at the same replaceable
      coordinate; three consecutive 14/14 runs followed; the suite itself was never modified; the
      lesson is recorded in the test plan for future singleton designs. A one-time transitional
      artifact — no standing defect.
- [x] **The #141 attribution (VERIFIED):** the implementation-phase `Overall: FAIL` was
      `relationship-primitives` H8 under concurrent-load bracketing — the ledger row's exact
      mechanism; green standalone twice and green in the quiet definitive run.

## Concept-graph integrity

- [x] No concept definitions changed; **firmware reinstall: N/A**. No pubkey literals added — the
      personal handles are runtime-templated everywhere (the ADR-0015 discipline extended, not
      eroded).

## Findings

### Blocking

None (the round-1 kickback resolved in-session; see Round history).

### Non-blocking

1. **The narrow-tail log trap** — twice this story, a failing term hid above a `tail -49` window
   whose size lagged the growing suite roster, costing two diagnosis detours. Future full-run
   captures should size the window generously (the definitive run used 62) or grep the full
   stream. Noted for the book's audit; not worth a ledger row on its own.
2. **`syncPinnedExportsForTag` / secondary pin flows** — the sweep story's map should confirm
   whether any internal TL/bookmark republish path composes tags without the new param (the
   S-level gap already recorded in the test plan).

### Harness friction

1. The ADR-0015 caller pin's token-level regex (intent: parameter removal; effect: value ban) —
   amended in place, dated. Same genus as the S2-spelling episode in F1's suite: pins written
   tighter than their intent. No new ledger row (rows 109/112's umbrella covers assertion-form
   lessons; the amendment comment carries the specifics).

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Book box **F4 ticked**; completion detection performed — **only F3 remains open**; result
      and the near-complete book arithmetic reported in chat.
