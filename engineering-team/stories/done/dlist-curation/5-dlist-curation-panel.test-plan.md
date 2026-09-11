# Test Plan: Story 5 — The DList Curation panel

**Story:** `engineering-team/stories/dlist-curation/5-dlist-curation-panel.md`
**ADR:** `engineering-team/decisions/dlist-curation/0005-dlist-curation-panel.md`
**Date:** 2026-09-10

## Coverage map

Suite: `test/dlist-curation-panel.test.js` — the house three-class pattern (U behavioral via ESM
import of `ui/src/utils/treasureMap.js`; S source-structure over the panel and the page; R sentinels
that pass before and after). Registered in `test/test.js` (require, run, results line, overall
verdict, skip aggregate).

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 folded panel + label + no-assistant | S1 baseline via useAuth, return null without an assistant · S2 disclosure idiom, one `<h4>` "DList Curation" with glyphs, label not hard-coded · U7 describeDListCuration (None yet / 1 / N) | `test/dlist-curation-panel.test.js` | structure + unit |
| AC-2 explains itself | S4 the approved sentence verbatim | same | structure |
| AC-3 search | S3 hook used inside the body component mounted under the fold; useProfiles + AuthorCell; own/assistant exclusion (`.author !==`) | same | structure |
| AC-4 already empowered | S4 "In your Map" / "Replace" · U2 findDListEntries (mine vs another assistant is the pubkey on the entry) | same | structure + unit |
| AC-5 add: header first | S5 POST /api/dlist-curation/header { target }; 409 / existing surfaced | same | structure |
| AC-6 add: then the Map | U3 append · U4 replace in place, duplicates dropped, other kinds/d-tags untouched · U5 empty-string hint · S5 upsertDListEntry(event, 39998 …) + aDListRelays · S4 preview + "Sign & publish" · S6 signer chain + onPublished | same | unit + structure |
| AC-7 the empowered list | U2 finder (both kinds, reserved word, invalid delegates, colons, order) · S6 link to `/tapestry/lists/<coordinate>` | same | unit + structure |
| AC-8 revoke | U6 removeDListEntry · S4 "Revoke", "stays on relays" · S5 removeDListEntry(event …) · S6 chain | same | unit + structure |
| AC-9 honest, never corrupting | S6 catch + error surface; the page re-search is the only refresh (onPublished) | same | structure |
| AC-10 nothing else moves | S7 mount order (Trusted Lists → DList Curation → hand edit) · R1 story-1 card + page order · R2 hook untouched · R3 publish gate + both-fail contract · R4 util exports + TL upsert semantics | same | structure + unit |

**AC→handle lines:** AC-1 → S1, S2, U7 · AC-2 → S4 · AC-3 → S3 · AC-4 → S4, U2 · AC-5 → S5 ·
AC-6 → U3, U4, U5, S5, S4, S6 · AC-7 → U2, S6 · AC-8 → U6, S4, S5, S6 · AC-9 → S6 ·
AC-10 → S7, R1, R2, R3, R4 · U1 is the export precondition.

## Edge cases

Not derivable from any single criterion:

- [x] **E1 — the reserved word** (U2): `39998:dlist-header` is the blanket designation, never a
      per-DList entry (ADR 0002 §4).
- [x] **E2 — invalid delegates are not entries** (U2): a `39998:<d>` tag whose second element is
      not 64-hex is skipped (story 2's demotion rule carried over); uppercase hex normalizes.
- [x] **E3 — d-tags with colons** (U2): `39998:a:b` → d `a:b` (ADR 0002 §1, first-colon split).
- [x] **E4 — future-dated Map** (U3, U6): upsert and remove both stamp `max(now, old + 1)`.
- [x] **E5 — exact-match replace** (U4): `39998:dogs` replaces only `39998:dogs`; `39999:dogs`
      and `39998:dogs-2` are untouched; a later duplicate is dropped (writer normalizes to one).
- [x] **E6 — revoke drops every duplicate** (U6) and is a no-op on an absent entry.
- [x] **E7 — the label counts every per-DList entry**, mine or another assistant's (U7 with the
      finder's output; ADR sub-decision 2).
- [x] **E8 — no relay fetch on page load** (S3): the hook lives in a body component rendered only
      under the fold.
- [ ] **Not covered — the live flow in a browser** (search, Add, the 409 rendering, Sign & publish,
      Revoke): needs a NIP-07 signer and a real session. The reviewer's Playwright-with-`page.route`
      method (story 1) can exercise render paths with the endpoint and the Map scan mocked; the
      community fetch is an HTTP `GET /api/relay/external` (via `nostrPublish.js`), mockable with
      `page.route` — *corrected at review #5; the plan first called it a WebSocket*. The signing step itself stays with the operator.
- [ ] **Not covered — the endpoint** (story 4's suite) and the publish primitives (their own lanes).
- [ ] **Not applicable — Concept Graph API:** no concept behaviour changes.

## Test infrastructure
- Test framework: Node's built-in runner (`node test/test.js`); no Playwright half for this story.
- Concept Graph API / relays / DOM: not exercised.
- Firmware state: none required.
- Fixtures: inline — two synthetic 64-hex pubkeys, synthetic kind-10040 tag lists, the approved
  AC-2 sentence as a constant.

## How to run

Full suite:
```
npm test
```

Story-scoped gate (this suite plus the six Treasure Map guards that pin story 1's card, the page
order, and the neighbouring panels):
```
node -e "Promise.all(['./test/dlist-curation-panel.test.js','./test/dlist-curation-tl-panel.test.js','./test/tl-treasure-map-optin-publish.test.js','./test/tl-treasure-map-panel.test.js','./test/treasure-map-panel-summary.test.js','./test/treasure-map-relay-presence.test.js','./test/treasure-map-relay-sync.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"
```

## Verification
The new tests fail with the current code — the U class because the four exports do not exist (the
util loads; R4 exercises its existing exports), the S class on the missing panel and wiring. The
four sentinels pass; the six guards are green. Confirmed on 2026-09-10 at commit ee019420 (working
tree = that commit plus this suite and its runner registration):

```
=== NEW SUITE (expect U/S failing, R passing) ===
  ✗ U1: the four helpers are exported from the treasure-map util
      ui/src/utils/treasureMap.js must export findDListEntries (ADR 0005 §Implementation 1)
  ✗ U2: findDListEntries — both kinds, reserved word excluded, invalid delegates excluded, order and colons preserved, never throws
      ui/src/utils/treasureMap.js must export findDListEntries (ADR 0005 §Implementation 1)
  ✗ U3: upsertDListEntry — appends when absent; everything else verbatim; content kept; created_at skew-proof
      ui/src/utils/treasureMap.js must export findDListEntries (ADR 0005 §Implementation 1)
  ✗ U4: upsertDListEntry — replaces the exact entry in place, drops later duplicates, leaves other kinds and other d-tags alone
      ui/src/utils/treasureMap.js must export findDListEntries (ADR 0005 §Implementation 1)
  ✗ U5: upsertDListEntry — a missing relay hint ships as the empty string (three-element shape preserved)
      ui/src/utils/treasureMap.js must export findDListEntries (ADR 0005 §Implementation 1)
  ✗ U6: removeDListEntry — drops every matching entry, keeps everything else verbatim, skew-proof, no-op safe
      ui/src/utils/treasureMap.js must export findDListEntries (ADR 0005 §Implementation 1)
  ✗ U7: describeDListCuration — the collapsed label: None yet / 1 DList curated / N DLists curated
      ui/src/utils/treasureMap.js must export findDListEntries (ADR 0005 §Implementation 1)
  ✗ S1: the panel exists, takes its baseline from the signed-in user's assistant, and imports the four helpers
      ADR §Implementation 2: ui/src/pages/grapevine/DListCurationPanel.jsx must exist
  ✗ S2: folded by the settled idiom — control, initial false, keyboard, gated body, one <h4> titled DList Curation with the glyphs
      AC-1: aria-expanded={<state>} on the header control
  ✗ S3: the community list is fetched only when opened — the hook lives in a body component mounted under the fold
      AC-3: the same source as the Shared Concepts pages
  ✗ S4: explains itself, and the add / replace / in-your-map / revoke controls exist with the ratified copy
      AC-2: the approved sentence, verbatim
  ✗ S5: Add calls the story-4 endpoint and handles its outcomes; the Map is composed through the helpers with the DList relay hint
      AC-5: POST /api/dlist-curation/header { target }
  ✗ S6: the page's own chain — drift-guarded NIP-07 signing, publishOrThrow, re-search on success
      AC-6/AC-8: getActiveSignerOrThrow → signEvent → publishOrThrow
  ✗ S7: the page mounts the panel once, between the Trusted Lists panel and the hand-edit panel, with onPublished={search}
      ADR §Implementation 3: single mount
  ✓ R1: story 1's card is untouched and the page order around it holds
  ✓ R2: the community-shares hook is consumed, not modified
  ✓ R3: the publish gate hook and the both-fail contract are untouched
  ✓ R4: the util's existing exports and TL upsert semantics are unchanged
RESULT {"pass":4,"fail":14,"skipped":0}
=== GUARDS ===
dlist-curation-tl-panel → {"pass":19,"fail":0,"skipped":0}
  ✓ U1: no generic entry → the new entry is appended, everything else verbatim
  ✓ U5: unconfigured relay → empty-string hint; content and kind preserved
tl-treasure-map-optin-publish → {"pass":23,"fail":0,"skipped":0}
tl-treasure-map-panel → {"pass":18,"fail":0,"skipped":0}
treasure-map-panel-summary → {"pass":18,"fail":0,"skipped":0}
treasure-map-relay-presence → {"pass":35,"fail":0,"skipped":0}
  ✓ N1: local has the Map and the relay does not → send it out
  ✓ N2: the relay has the Map and local does not → bring it back
  ✓ N3: neither side has it → no action, and the reason says so
  ✓ N4: both hold the same event → no action, reported as in sync
treasure-map-relay-sync → {"pass":22,"fail":0,"skipped":0}
GUARD_TOTAL_FAIL=0
```
