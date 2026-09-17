# Review: Story 3 — Inverse queue (publish candidates)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-06
**Diff:** `git diff 5ea92618^..HEAD` (commits `5ea92618` story+book, `dd2b5d88` ADR, `833a2b62` failing tests, `1d51a8b4` implementation) — 11 files, +968/−120.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **run independently** (2026-08-06, router quiesced/restored): **Overall PASS, fully green** — `inverse-queue-publish-candidates` 16/16, F1 19/19 and F5 26/26 unregressed, `show-the-four` 35/0 (the chore's S5 fix rides this branch). Identical to the Implementer's run; the first fully-green full-suite era continues.
- [x] `bash scripts/harness-lint.sh` — clean.
- [x] Live endpoint: all four arrays served (`nominations`/`declined`/`publishCandidates`/`deferredInUse`); Implementer's browser evidence reviewed (populated + empty mine views, view switching, console clean) and consistent with the code.

## Spec adherence (story ACs)

- [x] **AC-1 population** — `computePublishCandidates` ([adoptionQueue.js](../../../src/lib/adoptionQueue.js)): bState routing exhaustive, cross-author-only on both evidence kinds, usage-sorted (U2/U3/U5/U6 + H1).
- [x] **AC-2 evidence distinguishable** — filings vs affiliations counted separately (U4, H1) and rendered so (📄 · 🔗).
- [x] **AC-3 accept** — self-declare via the extracted helper; removal + self-b stamped (H2).
- [x] **AC-4 decline** — the sentinel; removal + stays gone (H3 + U5; the sentinel's stop-re-prompting property is F5's, inherited).
- [x] **AC-5 reveal** — the collapsed line (rendered only when N>0 — the sensible reading), expanding to evidence + the sentinel-stripping submit path (H4 proves the strip end-to-end from this surface).
- [x] **AC-6 placement** — three-view control on the one page; **F1's view and server behavior untouched** (H5 + the F1 suite's own 19/19; F1/F5 server files zero-diff).
- [x] **AC-7 nothing auto-acts / empty states** — read-only endpoint; both empty-state copies present and the mine one verified rendering live.
- [x] **AC-8 gating** — actions are the shipped gated endpoints (their suites pin the gates); view public (H1 host fetch).
- [x] **AC-9 gates** — per Quality gates.
- [x] **The clean-pass claim verified mechanically:** the implementation commit touched **zero** test files; no deviations from ADR 0003 found; no new ledger rows needed.

## ADR adherence

- [x] Files match ADR 0003 exactly: pure sibling + seam classification (`dispositionOf` imported in the handler, both libs still zero-require — U7 pins it); both header populations projected; union `#z` scan (one array correctly serving both cores — each filters to its own header set); new streaming `#b` scan; additive response keys; `dispositionActions.js` extraction with the panel re-pointed.
- [x] Behavior preservation of the extraction verified: the four owner-facing message strings removed from the panel reappear 1:1 in the helper.
- [x] No new dependencies; untouchables (middleware, scripts, firmware, protocols, CLAUDE.md, .github) zero-diff; no 64-hex literals added.

## Concept-graph integrity

- [x] No concept definitions changed; **firmware reinstall: N/A**. No new runtime concepts (F2 reuses F5's sentinel and F1's page).

## Things tests can't catch

- [x] The union `#z` scan serves both cores without cross-contamination (each core's usage loop is bounded by its own headers map — verified by read).
- [x] React escaping covers all rendered strings; the endpoint takes no parameters; both action paths validate server-side.
- [x] No secrets, no debug logging, no leftover instrumentation.

## Findings

### Blocking

None.

### Non-blocking

1. **[AdoptionQueue.jsx](../../../ui/src/pages/shared-concepts/AdoptionQueue.jsx) adopt message** — the F1 adopt confirmation now concatenates helper output ("Adopted — Wired — broadcast to the community relay.") — reads awkwardly. Cosmetic copy nit; fold into any later polish pass.
2. **Browser-tool ref-click quirk** (recorded for future sessions, not a product issue): the in-app browser's synthetic ref-click failed to dispatch the React view switch while programmatic and real clicks work — worth remembering when a "click did nothing" appears in future verifications.

### Harness friction

None new this story.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Book box **F2 ticked**; completion detection performed — book remains Open (F3/F4 unbuilt); result reported in chat.
