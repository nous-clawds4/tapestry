# Test Plan: Story 20 — Move Pin detail into a Tag-detail "Pinned" tab; simplify /pins rows

**Story:** `engineering-team/stories/20-pin-detail-into-tag-pinned-tab.md`
**ADR:** `engineering-team/decisions/0018-pin-detail-into-tag-pinned-tab.md`
**Date:** 2026-05-29

## Approach

This story is almost entirely **client-side UI / routing structure** with
no server, wire, or concept-graph changes. The project's established
style for UI acceptance criteria (see
`test/tag-detail-curated-view-and-pin-polish.test.js`,
`test/nip05-checkmark-verification.test.js`) is **source-file inspection**:
read the JSX/CSS with `fs.readFileSync` and assert on structural markers
the ADR commits to (component existence, route wiring, label strings,
removed/added controls, query-param usage). We follow that style in a new
Node suite `test/pin-detail-into-tag-pinned-tab.test.js`, registered in
`test/test.js`.

Three classes of test:

1. **New-structure tests (fail now, pass after implementation)** — the
   bulk: `PinnedListPanel` exists, Tag.jsx tab wiring, `Back to Tag`
   label, `?tab=pinned` links, `/pin` redirect, chevron, dead-CSS
   removal.
2. **Preservation guards (pass now, must stay passing)** — AC-17
   keep-set (export-modal backdrop/Escape, `menuRecentlyClosedRef`
   stacked-menu guard, `.bs-tl-export-backdrop` / `.pcd-*` CSS) and
   AC-18 default-tab machinery (`TagViewControls`, `TagSomeoneModal`,
   `TagPageRow` still wired into Tag.jsx). These guard against
   regressions during the restructure.
3. **Behavioral ACs verified structurally + by manual/browser smoke** —
   AC-4 (auto-switch after first pin), AC-7 (tab state survives
   switches), AC-8 (owner controls behave as on /pin), AC-17 (mobile
   modal *rendering*). Static proxies assert the ADR-named markers;
   runtime confirmation is a Reviewer browser walkthrough at desktop +
   touch viewport (precedent: Story 18 self-reviewed manually). Flagged
   per-row below.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 | `AC-1: Tag.jsx renders the tab strip only when the viewer has pinned (gated on viewerPin)` | `test/pin-detail-into-tag-pinned-tab.test.js` | source-inspection |
| AC-2 | `AC-2: Tag.jsx exposes a keyboard-operable tablist with default + Pinned tabs` | same | source-inspection |
| AC-3 | `AC-3: default selected tab derives from pin status (pinned → Pinned tab) via tab query param` | same | source-inspection |
| AC-4 | `AC-4: first pin flow switches the active tab to 'pinned' (structural proxy)` | same | source-inspection + manual |
| AC-5 | `AC-5: PinnedListPanel renders TL metadata (Observer/Cutoff/Min rank/Last refreshed/d-tag/naddr) and OMITS the Tag row` | same | source-inspection |
| AC-6 | `AC-6: PinnedListPanel renders the kind-30392 member list via useTLDetail` | same | source-inspection |
| AC-7 | `AC-7: Tag.jsx keeps the default-tab section mounted (panels toggled, not unmounted)` | same | source-inspection + manual |
| AC-8 | `AC-8: PinnedListPanel carries owner controls (Refresh/Edit via CurationMethodDialog+onUnpin/Share/Export) keyed by viewerPin.pinEventId` | same | source-inspection + manual |
| AC-9 | `AC-9: TagPinAffordance unpinned label is 'Pin' and click calls onPin` | same | source-inspection |
| AC-10 | `AC-10: TagPinAffordance pinned-on-default label is 'Pinned' and click switches tab, NOT navigate('/pin')` | same | source-inspection |
| AC-11 | `AC-11: TagPinAffordance on Pinned tab shows 'Back to Tag' and switches to default tab` | same | source-inspection |
| AC-12 | `AC-12: Pins.jsx rows carry no action controls (no Share/Export/Edit dialog/overflow menu)` | same | source-inspection |
| AC-13 | `AC-13: Pins.jsx rows link to /tag/:slug/:eventId?tab=pinned` | same | source-inspection |
| AC-14 | `AC-14: Pins.jsx rows render an always-visible right-edge chevron` | same | source-inspection |
| AC-15 | `AC-15: Pins.jsx keeps heading/intro/sign-in/empty + page-level Refresh all` | same | source-inspection |
| AC-16 | `AC-16: /pin/:dTag route no longer renders PinDetail; redirects to the tag Pinned tab` | same | source-inspection |
| AC-17a | `AC-17 keep: export-modal backdrop + Escape-close preserved in TLExportButton + styles` | same | preservation guard |
| AC-17b | `AC-17 keep: menuRecentlyClosedRef stacked-menu guard preserved in TagPageRow + TagSomeoneModal` | same | preservation guard |
| AC-17c | `AC-17 rework: dead .bs-pins-row-overflow-trigger/.bs-pins-row-actions-menu CSS removed` | same | source-inspection |
| AC-18 | `AC-18: Tag.jsx default tab still wires TagViewControls + TagPageRow + TagSomeoneModal` | same | preservation guard |

## Edge cases

- [ ] Stale `?tab=pinned` on a tag the viewer has NOT pinned → falls
  back to the default tab (ADR Decision; structural marker: the
  `'pinned'` selection is conjoined with `viewerPin`/`isPinned`).
- [ ] `/pin/:dTag` for a non-existent TL → redirect resolver should not
  hang (ADR: redirect to `/pins` on not-found). Manual.
- [ ] `PinnedListPanel` for a pin whose TL hasn't been generated yet
  (`useTLDetail` returns no event) → loading/empty state, not a crash.
  Manual.
- [ ] AC-17 mobile *rendering* (full modal/bottom-sheet, not anchored
  popover) — manual at a touch viewport; static guards only assert the
  code is present.

## Test infrastructure

- Test framework: Node built-in runner (`npm test` → `test/test.js`).
  New suite registered alongside the others.
- No Concept Graph API dependency (no concept/schema change in this
  story) — the suite is pure file inspection and runs offline.
- No firmware-install precondition.
- Fixtures: none; reads repo source files directly.

## How to run

```
npm test
```

(The suite is also runnable standalone:
`node test/pin-detail-into-tag-pinned-tab.test.js`.)

## Verification

The new-structure and rework tests fail against current `HEAD` (feature
not implemented; `PinnedListPanel` absent; `/pin` still renders
`PinDetail`; Pins rows lack `?tab=pinned`/chevron; dead overflow CSS
still present). Preservation guards pass against the current working
tree and must continue to pass.

Confirmed 2026-05-29 via `node test/pin-detail-into-tag-pinned-tab.test.js`:
**5 passed, 15 failed.** Each failure is the right reason (missing
structure), not an import/typo error:

```
FAIL AC-1  Tag.jsx must render a tablist (role="tablist") … Not found.
FAIL AC-2  tab buttons must carry role="tab".
FAIL AC-3  Tag.jsx must use useSearchParams to read the ?tab= selector.
FAIL AC-4  the pin flow must switch the active tab to 'pinned' … Not found.
FAIL AC-5  ui/src/components/PinnedListPanel.jsx must exist …
FAIL AC-6  could not read ui/src/components/PinnedListPanel.jsx (ENOENT)
FAIL AC-7  tab content must be wrapped in role="tabpanel" regions.
FAIL AC-8  could not read ui/src/components/PinnedListPanel.jsx (ENOENT)
PASS AC-9  TagPinAffordance unpinned label "Pin" + onPin (regression guard)
FAIL AC-10 TagPinAffordance must NOT navigate to '/pin/...' (still present)
FAIL AC-11 button label must read "Back to Tag".
FAIL AC-12 Pins.jsx must not render TLShareButton on rows.
FAIL AC-13 each /pins row must link with ?tab=pinned.
FAIL AC-14 each /pins row must show a right-edge chevron.
PASS AC-15 Pins.jsx keeps heading/intro/sign-in/empty + Refresh all (guard)
FAIL AC-16 /pin/:dTag must no longer render <PinDetail> (got <PinDetail>).
PASS AC-17a export-modal backdrop + Escape-close preserved (keep-set guard)
PASS AC-17b menuRecentlyClosedRef stacked-menu guard preserved (keep-set)
FAIL AC-17c dead .bs-pins-row-overflow-trigger CSS must be removed.
PASS AC-18 default tab still wires TagViewControls/TagPageRow/TagSomeoneModal
```

After implementation, all 20 should pass (the 5 guards must remain
passing). Runtime-only behaviors (AC-4 auto-switch, AC-7 state
preservation, AC-8 owner-control parity, AC-17 mobile rendering) get a
Reviewer browser walkthrough at desktop + touch viewport in addition to
their static proxies.
