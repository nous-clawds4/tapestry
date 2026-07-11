# Test Plan: Story 1 — Reputation section point-of-view explainer popup

**Story:** `engineering-team/stories/reputation-info-popup/1-reputation-section-pov-explainer-popup.md`
**ADR:** `engineering-team/decisions/reputation-info-popup/0034-reputation-section-pov-explainer-popup.md`
**Book:** `engineering-team/audits/reputation-info-popup/book.md`
**Date:** 2026-06-14
**Test file:** `test/reputation-info-popup.test.js` (registered in `test/test.js`)

## Approach

This is a frontend-only, additive, presentational change. The repo's established idiom for
profile-UI specs is **source-regex sentinels** run by the `test/test.js` Node built-in runner —
the closest precedent is `test/profile-verified-counts-explainer-and-alarm.test.js` (ADR 0032),
whose `tests`/`test()`/`assert()`/`safeRead()` structure this suite mirrors. **Playwright is not
used here** (its harness is broken and out of scope per ADR 0034 → Testing direction).

The suite has two bands:

- **T1–T9** — feature sentinels. They FAIL pre-implementation (the new `ReputationInfo.jsx` is
  absent and `BrainstormProfile` does not import/render it) and PASS once the Implementer ships it.
- **R1–R7** — regression sentinels. They PASS before AND after, pinning the AC6 regression boundary:
  the Reputation data path, the `?pov=` resolution, the shipped `VerificationInfo` popover, and the
  ADR 0033 §27 House/Personalized-vs-Owner PoV labeling boundary.

**Copy sentinels assert required *tokens/concepts*, not verbatim wording.** The exact user-facing
string is Director-owned and finalized at Implementation (book → "Open design decisions delegated to
the Director"). So the copy sentinels anchor on the mandated concepts — **Web of Trust** / **point
of view**, **House**, **Personalized**, the either/or-by-selection framing — and on the *absence* of
references to the top-of-page counts. They do not pin a full sentence, so they don't over-constrain
the Director's word choice.

**False-positive avoidance (per ADR 0034).** The phrase `point of view` already lives in
`VerificationInfo.jsx`. Every reputation copy sentinel reads only the **new** file
(`ui/src/components/ReputationInfo.jsx`), which does not exist pre-implementation, and asserts the
House/Personalized/Web-of-Trust wording, which exists in no shipped UI file. The "imports/renders"
sentinel (T9) anchors on the literal identifier `ReputationInfo` in `BrainstormProfile.jsx` and
scopes the render check to the sliced `<h3>Reputation …</h3>` heading — both absent today.

## Coverage map

Every acceptance criterion maps to at least one test. (ACs quoted from the story, in order.)

| Criterion | What it requires | Test(s) | File | Level |
|---|---|---|---|---|
| **AC1** — Reputation heading shows a circled-i (ⓘ) control, visually/behaviorally consistent with the Verified control | New `ReputationInfo.jsx` exists; reuses `bsp-info-btn` + ⓘ glyph + activatable `<button>`; self-contained `useState`, prop-free/hook-free; imported by and rendered **inside** the `<h3>Reputation>` heading | `T1`, `T2`, `T9` | `test/reputation-info-popup.test.js` | source-sentinel |
| **AC2** — activating the control opens a dismissible popup | Clicking the ⓘ renders the shared `bsp-confirm-overlay` + `bsp-confirm-box` popup | `T3` | same | source-sentinel |
| **AC3** — popup closes via the acknowledgement button AND via overlay dismissal (matching the existing pattern) | `bsp-confirm-ok` "Got it" → `setOpen(false)`; overlay click → `setOpen(false)`; inner-box click → `stopPropagation` (stays open) | `T4`, `T5` | same | source-sentinel |
| **AC4** — copy explains the scores reflect a Web-of-Trust PoV; either House (instance default) or viewer's Personalized, depending on which is selected; general, not naming the active one | Copy names Web of Trust + "point of view"; names **House** AND **Personalized**; frames them as either/or by current selection | `T6`, `T7` | same | source-sentinel |
| **AC5** — copy is bounded to the Reputation scores; makes no claim about Following / Verified Followers / Verified Reporters counts | The popup copy does **not** reference "Verified Followers", "Verified Reporters", or "Following"; and `BrainstormProfile` does not relabel those counts House/Personalized | `T8`, `R7` | same | source-sentinel |
| **AC6** — with the control removed the page behaves as before: compute / fetch / PoV-namespace / which scores display are all unchanged; verification popover untouched | Meili document fetch + `TRUST_METRICS` + `trustScores[…]` grid intact; `?pov=` resolution (`povParam`/`povSuffix`/`delegatedPubkey`) intact; effect still keyed `[pubkey, povParam]`; `VerificationInfo` + `useVerificationInfo` + the rendered Verified ⓘ untouched | `R1`, `R2`, `R3`, `R4`, `R5`, `R6` | same | regression sentinel |

### Test names (behavior in plain language)

- T1: ReputationInfo.jsx exists and renders an ⓘ button using the shared `bsp-info-btn` pattern.
- T2: ReputationInfo is a self-contained component with open/close state and NO data hook.
- T3: activating the ⓘ opens a dismissible popup using the shared overlay/box pattern.
- T4: the popup closes via its "Got it" acknowledgement button.
- T5: the popup closes when the surrounding overlay is dismissed, but not when its inner box is clicked.
- T6: the popup copy names a Web-of-Trust point of view as the source of the reputation scores.
- T7: the popup copy names BOTH the House and the Personalized point of view, generally.
- T8: the popup copy is bounded to the Reputation scores and makes NO claim about the Following / Verified Followers / Verified Reporters counts.
- T9: BrainstormProfile imports ReputationInfo and renders it inside the `<h3>Reputation</h3>` heading.
- R1: the Reputation data path is unchanged — Meili document fetch, TRUST_METRICS, trustScores grid.
- R2: the `?pov=` resolution is unchanged — povParam + povSuffix + delegated-pubkey fallback.
- R3: the trust effect re-runs on `[pubkey, povParam]` — the scores still track the selected PoV.
- R4: the shared VerificationInfo popover is unchanged — still consumes useVerificationInfo and renders the verification title.
- R5: useVerificationInfo still fetches owner-info — the verification data path is untouched.
- R6: BrainstormProfile still renders the shared VerificationInfo popover near the counts.
- R7: BrainstormProfile does NOT label the top-of-page counts with House/Personalized PoV (ADR 0033 §27 boundary).

## Edge cases

Covered by the sentinels above:

- [x] **Inner-box click must NOT dismiss** (only the overlay/Got it close) — T5 asserts `stopPropagation` on `bsp-confirm-box`, so a viewer reading the copy doesn't accidentally close it.
- [x] **Static, not dynamic** — the popup must not name the *active* PoV. T7 asserts an either/or-by-selection framing (both House and Personalized present); the dynamic variant is out of scope per the story.
- [x] **Scope leakage into the top-of-page counts** — T8 (popup copy) + R7 (page-level boundary) together ensure the House/Personalized wording stays scoped to the Reputation scores, never the Owner-PoV counts (ADR 0033 §27).
- [x] **Additive, not a replacement** — R6 asserts `VerificationInfo` is still imported and rendered (the new import is added *beside* it), guarding against an accidental swap.

Not applicable to this story (frontend-only, presentational; no API/graph surface):

- [ ] Empty input / concurrent calls / Concept Graph API unavailable / concept handle not found — this change adds no fetch, no endpoint, and touches no concept-graph behavior, so there is no runtime data path to exercise. (Concept orientation was done at Architecture; no concept definition is added or changed, so no firmware reinstall.)

## Test infrastructure

- **Test framework:** Node built-in runner via `npm test` (entry `test/test.js`). The new suite
  `test/reputation-info-popup.test.js` is registered there (require + `run()` call + results line +
  overall-OK conjunct).
- **Concept Graph API (`localhost:8877` / panel `:7778`):** **not required.** These are static
  source-regex sentinels reading files under `ui/src/`; they do not hit any API.
- **Firmware state:** none. No concept definition is added or changed (ADR 0034), so no
  `POST /api/firmware/install` precondition.
- **Fixtures:** none. The suite reads source files directly via `safeRead()`.
- **Files the sentinels read:**
  - `ui/src/components/ReputationInfo.jsx` (NEW — created by the Implementer)
  - `ui/src/components/VerificationInfo.jsx` (regression — must stay unchanged)
  - `ui/src/hooks/useVerificationInfo.js` (regression — must stay unchanged)
  - `ui/src/pages/BrainstormProfile.jsx` (import + render in heading; data-path regression)
  - `ui/src/pages/BrainstormReporters.jsx` (path resolved; not asserted by this suite — the
    `/reporters` regression is owned by the existing ADR-0032 suite)

## How to run

```
npm test
```

Playwright is intentionally not used for this story (broken harness; out of scope per ADR 0034).

## Verification

Confirmed on 2026-06-14, branch `feat/reputation-info-popup` (working tree: new test file +
`test/test.js` registration only; no source modified).

The new feature sentinels (T1–T9) fail **for the right reason** — the feature is absent
(`ReputationInfo.jsx does not exist yet`; `BrainstormProfile` does not import it) — not a typo or an
import error. The 7 regression sentinels (R1–R7) pass, confirming the AC6 boundary is currently
intact. Every one of the 33 pre-existing suites still passes; `Overall: FAIL` is due solely to the
intentionally-failing new suite.

```
reputation-info-popup suite:
  ✗ T1: ReputationInfo.jsx exists and renders an ⓘ button using the shared bsp-info-btn pattern (AC1)
      ui/src/components/ReputationInfo.jsx does not exist yet (the feature is unimplemented).
  ✗ T2: ReputationInfo is a self-contained component with open/close state and NO data hook (AC1)
      ReputationInfo.jsx does not exist yet.
  ✗ T3: activating the ⓘ opens a dismissible popup using the shared overlay/box pattern (AC2)
      ReputationInfo.jsx does not exist yet.
  ✗ T4: the popup closes via its "Got it" acknowledgement button (AC3)
      ReputationInfo.jsx does not exist yet.
  ✗ T5: the popup closes when the surrounding overlay is dismissed, but not when its inner box is clicked (AC3)
      ReputationInfo.jsx does not exist yet.
  ✗ T6: the popup copy names a Web-of-Trust point of view as the source of the reputation scores (AC4)
      ReputationInfo.jsx does not exist yet.
  ✗ T7: the popup copy names BOTH the House and the Personalized point of view, generally (AC4)
      ReputationInfo.jsx does not exist yet.
  ✗ T8: the popup copy is bounded to the Reputation scores and makes NO claim about the Following / Verified Followers / Verified Reporters counts (AC5)
      ReputationInfo.jsx does not exist yet.
  ✗ T9: BrainstormProfile imports ReputationInfo and renders it inside the <h3>Reputation</h3> heading (AC1)
      BrainstormProfile must import ReputationInfo from ../components/ReputationInfo (beside the VerificationInfo import). Absent pre-implementation.
  ✓ R1: the Reputation data path is unchanged — Meili document fetch, TRUST_METRICS, trustScores grid (AC6)
  ✓ R2: the ?pov= resolution is unchanged — povParam + povSuffix + delegated-pubkey fallback (AC6)
  ✓ R3: the trust effect re-runs on [pubkey, povParam] — the scores still track the selected PoV (AC6)
  ✓ R4: the shared VerificationInfo popover is unchanged — still consumes useVerificationInfo and renders the verification title (AC6)
  ✓ R5: useVerificationInfo still fetches owner-info — the verification data path is untouched (AC6)
  ✓ R6: BrainstormProfile still renders the shared VerificationInfo popover near the counts (AC6)
  ✓ R7: BrainstormProfile does NOT label the top-of-page counts with House/Personalized PoV (ADR 0033 §27 boundary; AC5)

...
reputation-info-popup suite:                     FAIL (7 passed, 9 failed)
Overall:                                         FAIL
```

All 33 pre-existing suites reported PASS in the same run (Configuration Loading through
`profile-verified-counts-explainer-and-alarm`).

## Notes for the Implementer

- The 9 failing sentinels become green by adding `ui/src/components/ReputationInfo.jsx` and the
  import + in-heading render in `BrainstormProfile.jsx` per ADR 0034's Implementation notes.
- The copy sentinels (T6–T8) deliberately leave the verbatim wording open. Satisfy them by using
  the Director's finalized copy that (a) names Web of Trust + "point of view", (b) names **House**
  and **Personalized** as either/or-by-current-selection, and (c) references none of the top-of-page
  counts.
- Do not touch the Reputation data path, `?pov=` resolution, `VerificationInfo`,
  `useVerificationInfo`, or `BrainstormReporters` — R1–R7 will catch any regression there.
