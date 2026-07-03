# Review: Story 1 — Reputation section point-of-view explainer popup

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-14
**Diff:** `git diff 3a167ab827e3e628c48bf3c7287bb0d0816f2b2d..HEAD` (HEAD `cab52820`, branch `feat/reputation-info-popup`)
**Story:** `engineering-team/stories/reputation-info-popup/1-reputation-section-pov-explainer-popup.md`
**ADR:** `engineering-team/decisions/reputation-info-popup/0034-reputation-section-pov-explainer-popup.md`
**Test plan:** `engineering-team/stories/reputation-info-popup/1-reputation-section-pov-explainer-popup.test-plan.md`

Substantive source changes audited:
- `ui/src/components/ReputationInfo.jsx` (new, 41 lines)
- `ui/src/pages/BrainstormProfile.jsx` (import at `:13`; render at `:369`)
- `test/reputation-info-popup.test.js` (new, 261 lines) + `test/test.js` registration

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. Exit code `0`. Full run: **34/34 suites PASS**, `Overall: PASS`. The new `reputation-info-popup` suite reports **16 passed, 0 failed** (T1–T9 feature + R1–R7 regression). All 33 pre-existing suites remained PASS (Configuration Loading through `profile-verified-counts-explainer-and-alarm`). I ran this myself; this is my own result, not the Implementer's quoted run.
- [x] `npm run test:playwright` (if applicable) — **N/A / skipped.** This is a frontend source-sentinel change; the test plan and ADR 0034 explicitly exclude Playwright (broken harness, out of scope). No browser behavior is asserted by source-regex sentinels, so Playwright adds nothing here.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped (JS-without-build)._

## Spec adherence

Every acceptance criterion is satisfied by the diff and backed by at least one passing test.

- [x] **AC1 — ⓘ control on the Reputation heading, visually/behaviorally consistent with the Verified control.** `ReputationInfo.jsx:16-22` renders `<button type="button" className="bsp-info-btn" ... >ⓘ</button>` — the *same* class, glyph, and `type` as the shipped `VerificationInfo.jsx:17-23`. It is a self-contained, prop-free, hook-free component (`export default function ReputationInfo()` at `:11`, `useState(false)` at `:12`, no props in the signature). Rendered **inside** the heading at `BrainstormProfile.jsx:369`: `<h3>Reputation<ReputationInfo /></h3>`. The Deviation log on the story records the considered placement decision: the shared `.bsp-info-btn { margin-left: auto }` rule is left in effect so the Reputation ⓘ right-aligns at the heading edge — *exactly* mirroring how the Verified ⓘ is right-aligned in its `.bsp-counts` row. This is the most-consistent reading of AC1 ("visually and behaviorally consistent with the existing Verified control") and it is zero-CSS: no `styles.css` change in the diff (confirmed — `styles.css` is not among the touched files). The optional snug-placement override ADR 0034 authorized was deliberately not added; that is within ADR scope, not a deviation from it. Tests: T1, T2, T9 (pass).
- [x] **AC2 — activating the control opens a dismissible popup.** `onClick={() => setOpen(true)}` (`:21`) → `{open && (<div className="bsp-confirm-overlay" ...>` (`:24`) wrapping `bsp-confirm-box` (`:25`). Test T3 (pass).
- [x] **AC3 — closes via "Got it" AND via overlay; inner box does not close.** "Got it" button at `:34` wires `onClick={() => setOpen(false)}`; overlay click at `:24` wires `onClick={() => setOpen(false)}`; inner box at `:25` wires `onClick={e => e.stopPropagation()}`. Identical to `VerificationInfo.jsx:25-39`. Tests T4, T5 (pass).
- [x] **AC4 — copy: Web-of-Trust PoV; either House (instance default) or viewer's Personalized, depending on selection; general, not naming the active PoV.** Rendered `<p className="bsp-confirm-message">` at `:27-32`: "These reputation scores reflect a Web of Trust — a point of view on who is trustworthy. The numbers show either the House point of view (this Tapestry instance's default) or your Personalized point of view, depending on which is currently selected." This names Web of Trust + point of view, names both House and Personalized, frames them as an either/or governed by the current selection, and does not assert which PoV is active. Tests T6, T7 (pass).
- [x] **AC5 — bounded to the Reputation scores; no claim about Following / Verified Followers / Verified Reporters counts.** Grep of `ReputationInfo.jsx` for `Verified Followers` / `Verified Reporters` / `Following\b` → none. The copy speaks only of "these reputation scores." Test T8 (pass). Page-level boundary held by R7.
- [x] **AC6 — regression boundary: scores compute/fetch/PoV-namespace/display unchanged; verification popover untouched.** `BrainstormProfile.jsx` still carries the full Reputation data path: `TRUST_METRICS` (`:43`), `trustScores[metric.tag]` grid (`:382-400`), Meili document fetch (`:161`), `?pov=` resolution `searchParams.get('pov')` (`:85`) + `povSuffix`/`delegatedPubkey` fallback (`:150-156`), effect keyed on `[pubkey, povParam]`. `VerificationInfo.jsx`, `useVerificationInfo.js`, and `BrainstormReporters.jsx` are **not in the diff** (verified by `git diff --name-only`). Tests R1–R6 (pass).

No criterion is silently dropped; no behavior beyond the story is added.

## ADR adherence

- [x] **Files changed match ADR 0034's implementation notes.** Exactly the three files the ADR names under `ui/src/` plus the test infra: `ReputationInfo.jsx` (new), `BrainstormProfile.jsx` (import + in-heading render), and — per the chosen zero-CSS placement — **no** `styles.css` change (the ADR made that change conditional on the snug-placement option, which was not taken). No `src/api/**`, no new endpoint, no new hook.
- [x] **Option A implemented faithfully.** New sibling presentational component that clones the `bsp-info-btn` / `bsp-confirm-overlay` / `bsp-confirm-box` / `bsp-confirm-ok` pattern, prop-free and hook-free, with static copy and **no data hook**. `import React, { useState } from 'react';` is the only import (`:1`) — no `useVerificationInfo`, no fetch. Matches ADR 0034 Decision and Implementation notes line-for-line.
- [x] **Regression boundary honored (ADR 0033 §27).** The House/Personalized wording lives only inside `ReputationInfo`, scoped to the Reputation section. `BrainstormProfile.jsx` carries no `House (default)` label (R7 pass). The one `Personalized` literal in `BrainstormProfile.jsx:51` is the pre-existing `personalizedPageRank` trust-metric label inside `TRUST_METRICS` — not a PoV label, and not touched by this diff. The Owner-PoV counts are not relabeled.
- [x] **No new dependencies the ADR didn't authorize.** No `package.json` / lockfile change; no new tooling.
- [x] **No ADR superseded.** Additive only; ADR 0032's verification popover and its T4–T7 sentinels remain valid (the `profile-verified-counts-explainer-and-alarm` suite still passes 15/15).

## Concept-graph integrity

- [x] **Handles in `kind:pubkey:slug` form.** No concept handles appear in source. The story/ADR reference `39998:…:web-of-trust` and `39998:…:graperank` in correct form, and correctly record that "House PoV"/"Personalized PoV" are product/UI notions with no graph node (verified against `/api/concept-graph/summaries`).
- [x] **Firmware reinstall — not required and correctly not called for.** No concept definition is added or changed (no concept-definition files in the diff). ADR 0034 states this explicitly. House rule satisfied.
- [x] **New code orients via Concept Graph, not by re-deriving from BIBLE.md.** The component carries no concept-graph data path at all (static copy, no fetch). Orientation (ADR `Concept orientation`) was done via the Concept Graph API before writing source. Concept Graph authority respected.

## Things tests can't catch

- [x] **No secrets in committed files.** Grep for `api_key|secret|password|token` in the new component → none.
- [x] **No leftover debug logging or `console.log`.** Grep for `console.|debugger` in `ReputationInfo.jsx` → none.
- [x] **No commented-out code.** Only a JSDoc header comment (`:3-10`) describing the component; no dead code.
- [x] **No TODO/FIXME.** Grep → none.
- [x] **Error paths / edge cases.** Static, presentational, prop-free component with no inputs — no error paths to handle. The inner-box `stopPropagation` edge (reading the copy must not dismiss it) is handled (`:25`) and tested (T5).
- [x] **Concurrency / races.** None — single local `useState`, no async, no fetch, no effects.
- [x] **Security / input validation.** No user input, no injection surface, no `dangerouslySetInnerHTML`, no URL/HTML interpolation. The ⓘ trigger is a real `<button type="button">` with `aria-label` and `title` set (`:19-20`), so the control is keyboard-focusable and screen-reader-labeled — accessibility of the control is sound and consistent with the Verified ⓘ.

## House rules check

- [x] **Concept Graph API authority respected** (orientation done; no concept defs changed).
- [x] **No new lint/typecheck/build tooling** (none added; JS-without-build preserved).

## Scope-creep sweep

- [x] Diff touches only the nine files the story/ADR/test-plan anticipate: the new component, the profile import+render, the new test file + its registration, and the harness artifacts (epic, story, ADR, test plan, journal). Nothing else.
- [x] The open profile-followers follow-ups (the duplicate Verified Followers metric row; Personalized PoV for the follows/followers tables) were **NOT** touched — `BrainstormFollowers`/follows tables are not in the diff, and `BrainstormProfile.jsx`'s only change is the two-line import+render. Out-of-scope items in the story are respected.

## Findings

### Blocking
None.

### Non-blocking
1. **`ui/src/components/ReputationInfo.jsx` vs `ui/src/components/VerificationInfo.jsx`** — the two popups now share a ~25-line open/close/overlay/box skeleton, as ADR 0034 Consequences anticipated. This is acknowledged debt, deliberately deferred: extract a shared `InfoPopover` primitive only when a *third* explainer appears, as its own refactor story. No action this cycle.

## Verdict
**PASS** — the diff matches the story, ADR 0034 (Option A), and the test plan; my own `npm test` run is green (34/34 suites, exit 0, reputation-info-popup 16/16); the regression boundary (Reputation data path, `?pov=` resolution, `VerificationInfo`/`useVerificationInfo`/`BrainstormReporters`, ADR 0033 §27 PoV-labeling) is intact; no secrets, debug code, scope creep, or unauthorized tooling. Mergeable as-is.
