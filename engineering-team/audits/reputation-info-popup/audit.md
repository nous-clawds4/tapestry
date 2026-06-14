# Build Audit: Reputation info popup (profile page)

**Book:** `engineering-team/audits/reputation-info-popup/book.md`
**Date:** 2026-06-14
**Branch / commit range:** `feat/reputation-info-popup`; feature diff `3a167ab8..e8b9182e` (staging PR [#287](https://github.com/nous-clawds4/tapestry/pull/287)); live on `main` `b4699d58` (prod PR [#288](https://github.com/nous-clawds4/tapestry/pull/288))
**Provenance:** Acceptance-frame
**Confidence:** high

> As-built record. The book was run autonomously through the Direction-mode harness (Product Owner → Architect → Tester → Implementer → Reviewer, each judged gate cleared by a blinded gate-judge), deployed to staging, and — on explicit operator direction, post-run — promoted to production. Every acceptance-frame bullet was verified on staging and again on production.

## 1. What shipped
- An informational popup (a circled-"i" ⓘ control) beside the profile page's **Reputation** section heading that explains, in plain language, that the reputation scores reflect a Web-of-Trust point of view — either the **House** point of view (the instance's default) or the viewer's **Personalized** point of view, depending on which is currently selected — `stories/reputation-info-popup/1-reputation-section-pov-explainer-popup.md`.

## 2. Epics & stories rolled up

### Epic: `reputation-info-popup`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 reputation-section-pov-explainer-popup | New `ReputationInfo.jsx` ⓘ-popup (static House/Personalized explainer) rendered in the profile "Reputation" heading | Done | `reviews/reputation-info-popup/1-reputation-section-pov-explainer-popup.md` (PASS) |

## 3. As-built inventory
*(derived from the diff `3a167ab8..e8b9182e`)*
- **User-facing:** one new control — a ⓘ button in the `<h3>Reputation</h3>` heading on the profile page (`/user/:pubkey`) that opens a dismissible popup (acknowledgement button + overlay-click to close). New file `ui/src/components/ReputationInfo.jsx` (41 lines); 2-line change to `ui/src/pages/BrainstormProfile.jsx` (import + render in the heading). No CSS change (reuses `.bsp-info-btn` / `.bsp-confirm-overlay` / `.bsp-confirm-box` / `.bsp-confirm-ok`).
- **Domain:** none. No Concept Graph definitions added or changed (oriented against `web-of-trust` and `graperank`; "House"/"Personalized point of view" are product/UI notions, not graph concepts). No schema change. **No firmware reinstall.**
- **Data & contracts:** none. No new endpoint, event kind, API route, or stored shape. The component is prop-free and hook-free (no data fetch). The Reputation data path (Meilisearch document fetch, `TRUST_METRICS` grid, `?pov=` resolution) is untouched.
- **Tests:** new `test/reputation-info-popup.test.js` (16 source-sentinel tests), registered in `test/test.js`.

## 4. Deviations from intent
The as-built **fully satisfies all six acceptance-frame bullets** (verified on staging and prod). The entries below are intentional interpretation/deferral choices, harvested from the story's `## Deviations`, the ADR's `Consequences`/`Out of scope`, and the story's `Out of scope` — reconciled against the diff. No anchor bullet was relaxed.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 1: ⓘ "visually and behaviorally consistent with the existing Verified control" | ⓘ right-aligns at the heading edge (shared `.bsp-info-btn { margin-left:auto }` left in effect; no CSS override added) | interpretation | Story `## Deviations`: maximizes consistency with the Verified ⓘ (also right-aligned in its `.bsp-counts` row) and keeps the change zero-CSS; ADR 0034 authorized either placement | Minor visual: the ⓘ sits at the right edge of the "Reputation" heading rather than snug after the word | Revisit only if a snug placement is later preferred (one-line `.bsp-section h3 .bsp-info-btn { margin-left:0 }`) |
| 2 | Frame bullet 3: explain House-or-Personalized "depending on which is currently selected" | Static, general copy that does **not** name the *active* PoV | deferred | Book/intake scope decision (operator, 2026-06-14): the dynamic variant would require promoting the resolved `povSuffix` from the fetch effect into render state — explicitly out of scope | Reader learns scores reflect *either* PoV by selection, but the popup doesn't state which is active in the moment | Dynamic "you are viewing the {House\|Personalized} PoV" variant, if wanted |
| 3 | (interaction pattern) | A second popup skeleton (`ReputationInfo`) duplicates ~25 lines of the `VerificationInfo` open/close/overlay boilerplate | deferred (debt) | ADR 0034 `Consequences`: chose a sibling component (Option A) over generalizing a shared `InfoPopover` primitive, to keep the change additive and avoid touching shipped/tested code | None (internal structure only) | Extract a shared `InfoPopover` primitive when a **third** explainer appears (deliberate refactor story) |

**Undocumented work:** none. Every file in the book diff traces to story #1 / ADR 0034 (the 2 source files, the test file + registration, and the harness artifacts).

## 5. Quality state at close
- **Test gate at close:** `npm test` → **PASS** (34 suites; the new `reputation-info-popup` suite 16/16; all 33 pre-existing suites unchanged).
- **Known open issues / accepted bugs:** none.
- **Debt logged:** the two near-identical popup skeletons (`VerificationInfo` + `ReputationInfo`) — see §4 #3; tracked for an `InfoPopover` extraction once a third explainer exists (ADR 0034 `Consequences`).
- **Process note (harness, not product):** one Gate-5 kick-back occurred — the Director instructed the Reviewer not to flip the story `Status: Done`, but the pinned Gate-5 rubric requires that flip *in the review commit* and it is outside the Director's edit lane. The blinded judge caught it; it was corrected and re-judged clean. Suggest clarifying in `roles/director.md` (Gate 5) and the `direct-feature` skill that the Reviewer authors the Status flip. (Goalpost-class — applies to the next run, operator-ratified.)

## 6. Carry-forward register
- [ ] Dynamic "which PoV is active" variant of the popup (from §4 #2 / story `Out of scope`).
- [ ] Extract a shared `InfoPopover` primitive when a third explainer is added (from §4 #3 / ADR 0034 `Consequences`).
- [ ] Optional: snug (non-right-aligned) ⓘ placement, if preferred (from §4 #1).
- [ ] Adjacent, already-open profile-followers follow-ups on the same surface (intake 2026-06-06; `docs/PROFILE_FOLLOWERS_HANDOFF_2026-06-06.md`) — esp. **item 6** (Personalized PoV for the follows/followers *tables*), which is thematically related: this feature explains House-vs-Personalized for the Reputation scores while the tables remain House/Owner-only. PoV consistency across the profile is a natural next consideration.
- [ ] Ratify the popup copy (it was chosen by the Director under the book's delegation; the product team may want to own the final wording).
