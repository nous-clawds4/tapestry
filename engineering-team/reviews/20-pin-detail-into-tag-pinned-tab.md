# Review: Story 20 — Move Pin detail into a Tag-detail "Pinned" tab; simplify /pins rows

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-29
**Story:** `engineering-team/stories/20-pin-detail-into-tag-pinned-tab.md`
**ADR:** `engineering-team/decisions/0018-pin-detail-into-tag-pinned-tab.md`
**Test plan:** `engineering-team/stories/20-pin-detail-into-tag-pinned-tab.test-plan.md`
**Diff:** `git diff 1ca1d7d0..HEAD -- ui/` (impl commits `25253a53`, `5b4cad13`)

## Quality gates (run by reviewer, not trusted)

- [x] `node test/pin-detail-into-tag-pinned-tab.test.js` — **20 passed, 0 failed**.
- [x] `npx vite build` — **clean** (only the pre-existing chunk-size warning).
- [~] `npm run test:playwright` — **NOT run** (gated behind `BRAINSTORM_SERVER_ACCESSIBLE=true`). Static audit of the specs surfaced a regression — see Blocking #1.
- [x] User confirmed runtime behavior in-browser (tabs, button, redirect) — covers the AC-4/7/8/17 behaviors the static suite can't.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion (AC-1…AC-18) has a passing Node test; all green.
- [x] No criterion silently dropped. Decisions match the story: `/pin` redirects (Q1), Pinned tab default-when-pinned (Q2), Refresh-all kept (ADR), AC-17 mobile-modal WIP preserved.
- [x] No behavior added beyond the story.

## ADR adherence
- [x] Files match ADR §Implementation: new `PinnedListPanel.jsx` + `PinRedirect.jsx`; `Tag.jsx` `?tab=pinned` tabs; `TagPinAffordance` toggle; `Pins.jsx` plain rows + chevron; `App.jsx` route swap; `PinDetail.jsx` removed.
- [x] Query-param tab mechanism (Option A) as decided. Default panel kept mounted via `hidden` (AC-7). Owner actions keyed by `viewerPin.pinEventId` — no extra lookup, as the ADR noted; the `/api/profile-tags/pins` fetch survives only for the export status.
- [x] No new dependencies. Reuses `useTLDetail`, `computeTLDTag`, `CurationMethodDialog`, `TLShareButton`, `TLExportButton`.
- [x] ADR 0016 partial-supersede recorded (0016 header note + 0018 banner).

## Concept-graph integrity
- [x] No concept/schema change; no firmware reinstall needed (matches ADR).
- [x] No hardcoded TA-pubkey literals introduced (scan clean). TA pubkey resolved at runtime via `useConfig().taPubkey` in `PinnedListPanel`/`useTLDetail`.

## Things tests can't catch
- [x] No secrets, no `console.log`/`debugger`, no `TODO`/`FIXME`, no commented-out code in the diff.
- [x] Tab-state effect + `switchTab` don't fight (functional `setSearchParams` updater, `replace:true`); no render loop.
- [x] Unpin path: `onChanged`→`refetchHeader` drops `viewerPin`→`isPinned` false→effect falls back to the default tab (stale `?tab=pinned` handled).
- [x] PinRedirect handles loading + unresolvable TL (→ `/pins`).

## House rules check
- [x] Concept Graph API authority respected (N/A — no concept change).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking

1. **`tests/brainstorm/nip51-list-export-from-pins.spec.js:602` (test "AC-19: /pin/:dTag renders the existing kind-30392 metadata … AND adds the new Export section")** — this Story-19 Playwright spec navigates to `PIN_DETAIL_URL` (`/pin/:dTag`, line 610) and asserts the **PinDetail** page (heading, observer, export section, share button). Story 20 retired `PinDetail`; `/pin/:dTag` now redirects to `/tag/:slug/:eventId?tab=pinned`, and the Pinned-tab content renders **only** when `/api/profile-tags/by-id` returns a `viewerPin`. The AC-19 test sets up `mockStrfryScanForPinDetail` + `mockPinsRoute` but **does not call `mockTagByIdRoute`** (lines 602–608), so after the redirect the Tag page gets no `viewerPin` → no Pinned tab → all four assertions fail. The spec breaks under `npm run test:playwright` (env-gated, so not in the default `npm test` gate, but a real regression nonetheless).

   **Asked change:** Update that spec to the retired-page reality. Either (a) retarget AC-19 to the tag Pinned tab: add `await mockTagByIdRoute(page, { viewerPin: { pinEventId: PIN_EVENT_ID, createdAt: 1715000100, curationMethod: { observer: VIEWER_PK, method: 'nip85:rank', cutoff: 1, includeScoreInTL: true } } })` and `page.goto('/tag/' + TAG_SLUG + '/' + TAG_ID + '?tab=pinned')`; or (b) keep `page.goto(PIN_DETAIL_URL)` and assert the redirect lands on the Pinned tab. Also rename the now-stale `PIN_DETAIL_URL` / `mockStrfryScanForPinDetail` so intent matches. While there, sanity-check the export-section assertion against the **changed pin-row match key** — `PinnedListPanel` now matches the export row by `p.pinEventId === viewerPin.pinEventId` (old `PinDetail` matched by tag identity); the `mockPinsRoute` row uses `pinEventId: PIN_EVENT_ID`, so it aligns iff the mocked `viewerPin.pinEventId` is also `PIN_EVENT_ID`.

### Non-blocking

1. **`ui/src/pages/Tag.jsx:209-227` / `:240-247`** — the default `<section role="tabpanel" aria-labelledby="bs-tag-tab-default">` is rendered even when the viewer is **not** pinned, but the referenced tab (`bs-tag-tab-default`) and the `tablist` only render inside the `{isPinned && …}` block. So an unpinned viewer's section carries a `tabpanel` role with a dangling `aria-labelledby` and no owning `tablist` — technically invalid ARIA (functionally/visually fine). Optional: apply the `role="tabpanel"`/`aria-labelledby` attributes only when `isPinned`.

2. **`ui/src/pages/Tag.jsx:290-303`** — when pinned, `PinnedListPanel` is mounted (just `hidden`) even while the default tab is active, so `useTLDetail` + the `/api/profile-tags/pins` fetch fire regardless of which tab is shown. Harmless (AC-3 makes the Pinned tab the default-when-pinned anyway, so it's usually the visible view), and mounting-to-preserve-state is the chosen AC-7 approach. Optional: lazy-mount on first activation if the extra fetch ever matters.

3. **`ui/src/pages/Pins.jsx:42-49` (`PinsMemberCountHint`)** — copy still says "cutoff (default 2)". Story 17 moved the default to 1. **Pre-existing** (not introduced by this story); flagging as an optional drive-by cleanup, not part of this review's verdict.

## Verdict
**CHANGES_REQUESTED**

The Story-20 implementation itself is correct, complete against all 18 ACs, ADR-conformant, build-clean, and browser-verified — it would PASS on its own. The single blocking item is collateral: retiring `PinDetail` invalidated the Story-19 Playwright spec's AC-19 test, which still drives `/pin/:dTag` expecting the deleted page. Updating that one spec (≈10 lines) closes the gap. Everything else is non-blocking.
