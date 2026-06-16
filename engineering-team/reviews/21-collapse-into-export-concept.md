# Review: Story 21 — Collapse pin publication into a single "Export" concept

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-29
**Diff:** `git diff 6fcd1fc0~1...HEAD` — impl `59f09b7c` + UI polish `389d70f2`
**Story:** `engineering-team/stories/21-collapse-into-export-concept.md`
**ADR:** `engineering-team/decisions/0019-collapse-into-export-concept.md`
**Test plan:** `engineering-team/stories/21-collapse-into-export-concept.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **Story-21 suites pass**; overall harness FAIL only on pre-existing failures (see Findings/Non-blocking #4).
  - `collapse-into-export-concept`: **16 passed, 0 failed**
  - `pin-detail-into-tag-pinned-tab`: **20 passed, 0 failed** (superseded guards updated)
  - `tag-detail-curated-view-and-pin-polish`: 31 passed, 2 failed — both **pre-existing** (TagPageRow `is-revealed`, TagPinAffordance tooltip), verified failing at the baseline worktree.
  - `restore-historical-data-and-fix-tl-author-filter`: 21 passed, 1 failed — **pre-existing** (Pins.jsx pinTag taPubkey caller).
- [x] UI `vite build` — clean (only the pre-existing chunk-size warning).
- [ ] `npm run test:playwright` — not run (no new spec mandated by the plan).
- [x] _Lint / typecheck / build infra — not configured; none added (CLAUDE.md respected)._

## Spec adherence

- [x] Every acceptance criterion is covered — automated where a meaningful guard exists, manual/deploy-verified for the interaction-only ACs, exactly as the PO-approved test plan scopes it.
  - Automated (16 guards): AC-1, AC-3, AC-4, AC-8, AC-9, AC-11, AC-12/13 (×3 wiring), AC-15/16, AC-18, AC-19, AC-20, AC-21, AC-22, AC-23.
  - Manual / deploy-verified: AC-2, AC-5, AC-6, AC-7, AC-10, AC-14, AC-17, AC-24, AC-25, AC-26 — confirmed live via `cycle-local` (deployed bundle carries all mandated copy; server change live).
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story (pin-time flow left intact per ADR; the `.pcd`/`.tsm` mobile-tray fix is a small pre-existing-bug cleanup, called out in the polish commit).

## ADR adherence

- [x] Files changed match ADR 0019's Implementation notes: `refreshPinnedTags.js` cutoff fallback; `profile-tags/index.js` available-tags `authorPubkey`; new `ExportModal.jsx`; `PinnedListPanel.jsx` collapse + naddr rows + status state machine; `publishTagPin.js` `syncPinnedExportsForTag`; wiring in `Tag.jsx` + `useProfileTags.js`; `Pins.jsx` copy.
- [x] **Ordering honored** — `ExportModal.handleConfirm` recomputes the kind-30392 *before* publishing the kind-30000 (`ExportModal.jsx`), so the Follow Set reads fresh membership (the ADR's key sequencing constraint, since `prepare-nip51-export` reads the current 30392).
- [x] **No new server endpoint** (as decided); server diff limited to the cutoff fallback + the additive `authorPubkey` field.
- [x] **No new dependency**, no firmware concept, no reinstall — confirmed.
- [x] Orphaned `TLExportButton`/`TLShareButton` retired per ADR; no remaining code importers (only comments and *negative* test assertions reference the names).

## Concept-graph integrity

- [x] Z-tag composition unchanged (reuses `tag-pinning` via the `LEGACY_*` literal per ADR 0015).
- [x] No firmware definition changed → no reinstall (correctly stated in the ADR).
- [x] TA pubkey usage unchanged: kind-30392 stays TA-signed server-side, kind-30000 stays user-signed (NIP-07). No new hardcodes introduced.

## Things tests can't catch

- [x] No secrets committed.
- [x] No leftover `console.log` / debug logging in the diff.
- [x] No commented-out code (only explanatory comments).
- [x] Error paths handled: orchestrator is best-effort (swallows fetch failures, cron is the backstop); declined NIP-07 → `declined` status (AC-14); copy has clipboard→execCommand→manual-select fallback chain.
- [x] **Concurrency** considered: per-pin trailing debounce with supersede-resolve coalesces rapid taggings (Open Q1); the recompute-then-export ordering avoids a stale-membership race.
- [x] **Security / POV**: both server endpoints validate `pin author == session`; the orchestrator only ever acts on the acting viewer's own pins → AC-25/26 invariants hold; available-tags `authorPubkey` is public data already on the event.

## House rules check

- [x] Concept Graph authority respected; ADR oriented via `/api/concept-graph/summaries`.
- [x] No new lint/typecheck/build tooling.
- [x] Branch discipline: work committed on `collapse-into-export-concept` (the earlier mis-landed commits were corrected — adr moved off the pushed `feat/pubkey-tagging-target`).

## Findings

### Blocking
_None._

### Non-blocking
1. **`engineering-team/decisions/0019-...md`** — the ADR does not yet formally record that it **supersedes** ADR 0018 pin-detail AC-8 / AC-17-keep and ADR 0014/0016 Decision 11 (cutoff-stays-2). The tests were updated to match; the ADR should carry a one-line supersession note for the audit trail. Optional: Architect adds it.
2. **`ui/src/styles.css`** — `.bs-tl-share-*` rules are now dead CSS after `TLShareButton` deletion (the `.bs-tl-export-*` rules are still used by `ExportModal`). Harmless; optional cleanup.
3. **`ui/src/utils/publishTagPin.js` (`syncPinnedExportsForTag`)** — `pinRow.nip51ExportStatus` is captured at call time. A pin's *first-ever* export immediately followed by a tagging (before `/pins` reflects it) could skip that one re-export and read as `never-exported`. Acceptable for v1 — the debounce window + the next tagging/cron converge it; worth a comment if revisited.
4. **Pre-existing failures (not introduced by this story):** `tag-detail-curated` AC-8 (`TagPageRow` is-revealed) + AC-17 (`TagPinAffordance` tooltip), and `restore-historical-data` (`Pins.jsx` pinTag taPubkey). All three fail identically at the baseline worktree (HEAD before Story 21) and belong to Story 20's open review. Out of scope here; should be resolved under Story 20.

## Verdict

**PASS.**

All in-scope acceptance criteria are met, the implementation matches ADR 0019 (including the critical 30392-before-30000 ordering and the user-signed/TA-signed invariants), the quality gate shows zero Story-21 failures, and the build is clean. The remaining harness red is entirely pre-existing Story-20 fallout, attributed and out of scope. Non-blocking items are documentation/cleanup nits.

Ready for the deploy chain (`cycle-staging` → `cycle-prod`).
