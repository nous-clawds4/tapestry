# Review: Story 22 — Follow Pack (kind-39089) export target

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-30
**Diff:** `git diff 235256c9...HEAD` (commits `8554c47b` arch, `91f0cbea` test, `f0f2eceb` impl)

## Quality gates (run by reviewer, not trusted)

- [x] `node test/collapse-into-export-concept.test.js` (the story's suite) — **28 passed, 0 failed**. All 5 read-side ACs (AC-7/8/9/10/11) plus the write-side and guards pass.
- [x] `node test/test.js` (full suite) — 3 suites show failures, **all pre-existing and unrelated**:
  - `restore-historical-…` (21/1) — asserts on `ui/src/pages/Pins.jsx` (`pinTag(...)` caller); not in this diff.
  - `tag-detail-curated-…` (31/2) — asserts on `TagPageRow.jsx` / `TagPinAffordance.jsx`; not in this diff.
  - `profile-tags-publish` (1 fail in aggregate, **7/0 standalone**) — order-dependent live-infra flakiness; passes in isolation.
  - Verified pre-existing two ways: (a) my diff touches none of those files; (b) implementation-phase stash test reproduced identical counts (21/1, 31/2) with my changes removed.
- [x] UI build (`npm run build`) — clean (only the repo's standing chunk-size warning).
- [x] `node -c` on both changed server files — syntax OK.
- [ ] _Lint / typecheck / Playwright — not configured / not applicable._

## Spec adherence
- [x] Every acceptance criterion has a passing test (AC-1..6 write-side + guards; AC-7..11 read-side). AC-7/8/9/10/11 transitioned red→green with the implementation.
- [x] No criterion silently dropped. The live `followPackStatus` derivation is explicitly deferred to manual/Playwright in the test plan (same boundary Story 19 drew for `nip51ExportStatus`).
- [x] No behavior added beyond the story. Snapshot semantics honored (no auto-re-export); `image` tag and separate-namespace correctly omitted per ADR Out-of-scope.

## ADR adherence
- [x] Files changed match ADR 0020 Implementation notes exactly:
  - `src/api/trustedList/index.js:34–42` — `FOLLOW_PACK_DESCRIPTION` added; `index.js:279` validates `exportKind ∈ {30000,39089}`; `index.js:366` selects description by kind; `unsigned.kind = exportKind`.
  - `src/api/profile-tags/index.js:1483` — single widened scan `kinds:[30000,39089]`, bucketed per kind, shared `statusFor()`; kind-30000 path byte-equivalent; `followPackStatus` attached with the same shape/vocabulary (`never-exported`/`ok-fresh`/`stale`).
  - `ui/src/utils/publishTagPin.js:234,277` — `kind` param threaded; `naddrEncode({ kind })`; `runReexportForPin` comment documents the snapshot exclusion (`publishTagPin.js:391`).
  - `ui/src/components/PinnedListPanel.jsx:216,231,392` — `naddr39089` memo, gated "Follow Pack (naddr)" row, drift hint.
  - `ui/src/components/ExportModal.jsx:222,225` — opt-in checkbox, `kind:39089` confirm branch, memory hint.
- [x] Layering respected: membership still sourced from the TA-signed kind-30392 at read time; `followPackStatus` derived live per-viewer (`authors:[viewerPubkey]`) — no denormalized/global trust state. Honors CLAUDE.md POV-first / filter-at-view-time invariants.
- [x] No new dependencies. `timeAgo` reused from `ui/src/utils/timeAgo.js`.

## Concept-graph integrity
- [x] No concept definitions changed; kind-39089 reuses the existing `tag-pinning` z-tag handle (`profileTags.TAG_PINNING_Z_TAG`). **No firmware reinstall required** — matches ADR.
- [x] No new hardcoded TA pubkey introduced (the z-tag handle resolves through the existing ADR-0015 named exception, untouched by this diff). CLAUDE.md per-deployment-pubkey rule respected.

## Things tests can't catch
- [x] No secrets, no leftover `console.log`, no commented-out code in the diff.
- [x] Error paths: two-prompt flow — if the user declines the second (pack) NIP-07 prompt after the Follow Set published, the `catch` surfaces the error; the already-published Follow Set stands. Acceptable and honest per ADR (two distinct signed events).
- [x] Input validation: `exportKind` validated server-side at the boundary; non-{30000,39089} → 400. Client only ever sends numeric `30000`/`39089`.
- [x] Concurrency: no shared mutable state added; enricher is per-request.

## House rules check
- [x] Concept Graph authority respected; no BIBLE re-read in code.
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
_None._

### Non-blocking
1. **`ui/src/styles.css`** — the two new classes `bs-export-target-hint` (ExportModal memory hint) and `bs-pindetail-pack-drift` (PinnedListPanel drift hint) are **not styled**, while their siblings (`bs-export-target`, `bs-pindetail-*`) are. Functionally fine (the `<em>` is italic, the `<p>` a plain block), but the drift hint is a status/warning message that would read better with deliberate styling (color/spacing) so it stands out. Optional polish — eyeball in the browser review and add rules if desired.
2. **`ui/src/components/PinnedListPanel.jsx:404`** — drift-hint copy is plural-only ("is 1 members behind") when `followPackBehind === 1`. Cosmetic; the Tester chose plural-always to match the source-grep. Optional: `member${n===1?'':'s'}` — but note that would re-break the AC-10 literal-substring assertion, so if changed, update the test in lockstep.

## Verdict
**PASS** — the diff matches the story ACs, ADR 0020's implementation notes, and the test plan; the story's test gate is clean (28/0); the three full-suite failures are confirmed pre-existing and unrelated. Two non-blocking cosmetic notes (CSS styling, singular grammar) are left to the author's discretion and do not block the deploy chain.
