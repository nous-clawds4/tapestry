# Review: Story verified-reporters #1 — Verified Reporters count on the profile

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-07
**Diff:** `git diff staging...HEAD` — implementation commit `c3a0c8cb` (ui/src/pages/BrainstormProfile.jsx, ui/src/styles.css)
**Story:** `engineering-team/stories/verified-reporters/1-verified-reporters-count.md`
**ADR:** `engineering-team/decisions/verified-reporters/0001-verified-reporters-count.md`
**Test plan:** `engineering-team/stories/verified-reporters/1-verified-reporters-count.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS.** The `profile-verified-reporters-count` suite reports PASS (11 passed, 0 failed): T1–T8 (one per AC) green, R1–R3 (regression sentinels) green. Overall runner: **PASS** (no other suite regressed).
- [x] `npm run test:playwright` — **not run in review (by design).** `tests/brainstorm/profile-verified-reporters-count.spec.js` is supplementary and live-data-dependent; its own header marks it "not run pre-implementation … exercised at the staging smoke." The deterministic gate is the node suite above. Browser/visual verification (the `>0` red-link state) is the staging smoke, matching the Verified Followers precedent.
- [x] Vite build — UI compiles (`npm run build` in `ui/`, confirmed at implementation; the source-regex suite cannot catch a JSX syntax error, the build can).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test.
  - AC1 (label, parity, effective PoV) → T1 (3rd `bsp-count-label` reading "Verified Reporters"), T2 (`trustScores?.verifiedReporterCount`); `BrainstormProfile.jsx:97,248-269`.
  - AC2 (`>0` → negative signal + link) → T3 (`/user/${pubkey}/reporters` + 3rd `bsp-count-link`), T4 (`bsp-count-value-negative` + `--red`); `BrainstormProfile.jsx:253-261`, `styles.css:3409-3411`.
  - AC3 (`0` → neutral, not a link) → T5; the else-branch renders a `<span>` (not a `<Link>`), `fmtCount(0)`→"0"; `BrainstormProfile.jsx:262-267`.
  - AC4 (unavailable → "—", not a link) → T6; `verifiedReporterCount` null ⇒ else-branch ⇒ `fmtCount(null)`→"—".
  - AC5 (loading → dimmed placeholder) → T7; `bsp-count-loading` on the span when `trustLoading`, `styles.css:3413-3415` opacity 0.4.
  - AC6 (accessible name) → T8; `aria-label={\`${verifiedReporterCount} verified reporters. View list.\`}`, `BrainstormProfile.jsx:256`.
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story.

## ADR adherence
- [x] Files changed match ADR 0001 implementation notes exactly (BrainstormProfile.jsx + styles.css; value from `trustScores`; two token-based CSS modifiers).
- [x] Option A honored — reuses the already-fetched, PoV-resolved `trustScores`; no new fetch, no new component, no `useUserCounts` (the ADR's rejected Option C).
- [x] **Deliberate non-changes all honored:**
  - `/user/:pubkey/reporters` route NOT registered (diff touches only the two files; App.jsx untouched) — correct, that's story #3.
  - Existing `verifiedReporterCount` 🚩 "Reporters" trust card retained (R3 green; `TRUST_METRICS` intact).
  - Following and Verified Followers counts untouched (R1/R2 green; only the section comment changed).
- [x] No new dependencies. Tokens only — `var(--red)`, no hardcoded hex/px.
- [x] **Logged deviation reviewed and accepted:** the ADR's four display states are implemented as a 2-branch ternary (`>0 ? <Link> : <span>`), with `fmtCount(null)`→"—" covering loading+unavailable and the `bsp-count-loading` dim added only when `trustLoading`. Observable behavior is identical to the ADR's four states; the simplification is faithful and is logged under the story's `## Deviations`.

## Concept-graph integrity
- [x] N/A — no concept/schema change (a pure front-end display of an existing data field). No firmware reinstall required (matches ADR). No BIBLE.md re-derivation.

## Things tests can't catch
- [x] No secrets in committed files.
- [x] No leftover debug logging / `console.log`; comments are explanatory and appropriate.
- [x] No commented-out code.
- [x] Edge cases handled: `null > 0` is false → falls to the neutral/unavailable branch; on `trustError`, `trustScores` is null so the counter renders a plain "—" non-link (the ADR's error state, reached cleanly without an explicit `trustError` reference); loading "—" is dimmed while unavailable "—" is not — the two are visually distinct as AC4/AC5 require.
- [x] No concurrency concerns (render-only, derived from existing state).
- [x] Security: no new input boundary; the value is read-only display of already-fetched data; `pubkey` interpolated into the route is the same already-validated param used by the sibling count-links.
- [x] No scope creep — only the two files, exactly the story.

## House rules check
- [x] Concept Graph API authority respected (no concept work).
- [x] No new lint/typecheck/build tooling.
- [x] Style-guide copy verbatim: label "Verified Reporters"; aria-label "{n} verified reporters. View list." No banned phrases; the count surface carries no emoji (the glyph ruling applies to the trust card, untouched here).

## Findings

### Blocking
None.

### Non-blocking
1. **`ui/src/pages/BrainstormProfile.jsx:237,262-267`** — during the window where `userCounts` has loaded but `trustScores` is still loading, the row-level dim (`bsp-counts-loading`) is gated on `userCountsLoading`, so Following renders normal, Verified Followers renders a plain "—" (it has no loading treatment), and Verified Reporters renders a *dimmed* "—". The slight inconsistency between the two trust-sourced counts is pre-existing (Verified Followers shipped without a loading state) and the Reporters loading dim is exactly what AC5 mandated. Optional future harmonization belongs with the deferred shared-counts-row work (PRD §8.3), not this story.
2. **`ui/src/pages/BrainstormProfile.jsx:252`** — `verifiedReporterCount > 0` relies on the value being numeric; if the Meili document ever returned it as a string, JS coercion would still behave correctly and `fmtCount` coerces too. This mirrors the existing Verified Followers counter's assumption, so it is consistent with the codebase, not a new risk.

## Verdict
**PASS** — the diff matches the story's six acceptance criteria, conforms to ADR 0001 (including every deliberate non-change), the logged deviation is faithful, the deterministic gate is green (11/11), and there are no blocking issues. Browser/visual confirmation of the `>0` state is the staging smoke (the supplementary Playwright spec), per the established two-tier convention.
