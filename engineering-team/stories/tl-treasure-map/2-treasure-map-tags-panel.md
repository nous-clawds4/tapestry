# Story 2: Treasure-Map tags panel

**Status:** Approved
**Created:** 2026-08-27
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A approved 2026-08-27 in the
book's kickoff exchange; scoped gate:
`node -e "require('./test/tl-treasure-map-panel.test.js').run().then(r=>process.exit(r.fail?1:0))"`
— named as `npm test -- test/…` at Gate A, corrected here because `test/test.js` ignores CLI
args and always runs the full registry; the discrepancy is recorded as harness friction at
Gate B)*

## Background
The TA Treasure Map page (`/tapestry/grapevine/trusted-assertions`) finds the signed-in user's
kind-10040 and today shows only grouped tag counts (`TagSummary`) plus the raw JSON. The operator
wants each tag legible: what kind, what class of delegation, who the delegate is, and whether
that delegate is this instance's Tapestry Assistant. The wire convention the panel renders was
ratified by ADR `tl-treasure-map/0001` (story 1).

## User-facing description
As a signed-in Brainstorm customer viewing my Treasure Map in the Tapestry app, I want every tag
of my Map enumerated with its kind, its classification, the delegate's avatar linking to their
profile, and a Local-TA/external indication, so that I can see at a glance who publishes what on
my behalf.

## Acceptance criteria
- [ ] AC-1: Given a found Map, the page shows a panel with one row per tag, in event order — no
      tag omitted.
- [ ] AC-2: Each row shows the tag's first element and its classification — kinds 30380–30389 →
      "Trusted Assertion", 30390–30399 → "Trusted List", everything else → "other" (ADR 0001
      parse rule; a named `"<kind>:<name>"` entry classifies by its kind segment and displays
      the name).
- [ ] AC-3: Rows whose second element is a 64-hex pubkey show an Avatar linking to
      `/tapestry/users/<pubkey>`; the panel batch-fetches kind-0 profiles via
      `/api/profiles?pubkeys=` so avatars carry real pictures where available.
- [ ] AC-4: The delegate is labeled **Local TA** when it equals the runtime-resolved TA pubkey
      (`ConfigContext.taPubkey`), **external** otherwise; while the TA pubkey is still loading,
      neither label is shown. No TA pubkey literal appears in the diff.
- [ ] AC-5: The relay hint (third element) is displayed when present.
- [ ] AC-6: Tags that are malformed or non-delegation (`["d", …]`, short arrays, non-hex second
      element) render as "other" rows without an avatar and without crashing.
- [ ] AC-7: The no-Map-found path and the raw-event toggle are unchanged.

## Design note *(Light profile — provisional here, ratified at Gate B)*
- **Chosen approach:** a pure classifier util + a presentational panel. New
  `ui/src/utils/treasureMap.js` exporting `classifyEntry(tag)` →
  `{ raw, kind, name, cls: 'ta'|'tl'|'other', pubkey, relay }` implementing ADR 0001 §1 (split
  first element on `:`; all-digits kind; 3038x/3039x ranges; 64-hex pubkey validation,
  case-insensitive, normalized lowercase). New
  `ui/src/pages/grapevine/TreasureMapTagsPanel.jsx` rendering one row per tag — reuses
  `components/Avatar.jsx` (pubkey/profile/size props; the TA badge and runtime TA lookup are
  Avatar's own behavior), links each avatar+pubkey to `/tapestry/users/<pubkey>`, badges
  Local TA / external from `useConfig().taPubkey`, and batch-fetches profiles once per event via
  `/api/profiles?pubkeys=` (deduped). `TrustedAssertions.jsx` swaps its `TagSummary` block for
  the panel — the one behavioral change to the page; the now-orphaned `TagSummary` helper is
  deleted with its sole call site.
- **Rejected alternative:** enrich rows inline in `TrustedAssertions.jsx` with no util/component
  split — rejected because story 3 needs the same classifier for the salient check, and the page
  is already 373 lines; the logic would end up re-derived instead of shared.
- **Blast radius:** `ui/src/pages/grapevine/TrustedAssertions.jsx` plus two new files.
  Grep-verified non-consumers left untouched: `TrustedAssertionsList.jsx`, `TrustedLists.jsx`,
  `SearchPreferences.jsx` (its own `parseMetrics` copy), `src/utils/customerManager.js`
  (server-side reader).
- **Boundary with story 3:** the panel classifies and displays only; the salient generic-30392
  check, the opt-in prompt, preview, and publish are story 3.

## Edge cases & not-covered
- **E1 (not derivable from any AC):** `ConfigContext.taPubkey` resolves async after first
  render — the local TA's own row must not flash "external" before the fetch lands (AC-4's
  loading clause exists because of this race).
- E2: named entry `"30392:mylist"` → cls `tl`, name displayed — display-only today (ADR 0001
  named-entry reservation).
- E3: uppercase-hex pubkey in a wild event — accepted case-insensitively, linked lowercase.
- E4: zero-tag Map → the panel renders an explicit empty state, not a blank region.
- E5: the same pubkey across many rows → independent rows, one deduped profile fetch.
- **Not covered:** picture-URL death and lettered fallback (Avatar's own tested behavior,
  ta-avatar #1); visual layout (B-class browser verification at Gate B); profile-fetch network
  failure beyond "must not throw" (Avatar renders letterform when profile is absent).

## AC→handle lines
- AC-1 → U4, S2
- AC-2 → U1, U2, U3
- AC-3 → S2, S3
- AC-4 → S4, S5, R3
- AC-5 → U5
- AC-6 → U6, U7
- AC-7 → R1, R2
- E1 → S5 · E2 → U3 · E3 → U8 · E4 → S6 · E5 → S7

U* = behavioral unit tests of `classifyEntry` via dynamic `import()` (house precedent: five
suites already `await import(…)` ESM sources). S* = source-structure assertions on the new
panel/page wiring (house pattern per `test/in-app-badged-ta-avatar.test.js`'s header). R* =
regression sentinels that pass today and fail only on collateral damage.

## Linked artifacts
- ADR: `engineering-team/decisions/tl-treasure-map/0001-treasure-map-tl-advertisement-convention.md`
  (consumed, not authored here)
- Test suite: `test/tl-treasure-map-panel.test.js` (the story's scoped gate)
- Review: (filled at Gate B)

Link by path only — never record verdicts or round history in this file.
