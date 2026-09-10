# Story 7: Regenerating a Treasure Map preserves every entry the generator does not own

**Status:** Approved
**Created:** 2026-09-10
**Type:** Bug

## Background
Two generators produce a user's kind-10040 Treasure Map from configuration alone — the API
handler `POST /api/create-unsigned-kind10040` (the legacy customer page's create → NIP-07 sign →
publish flow) and the CLI `bin/brainstorm-create-kind10040.js` (the legacy NIP-85 control panel's
`/api/create-kind10040`, which writes a template file for later signing). Each builds a fresh tag
list of the eleven `30382:*` Trust-Assertion rows and never reads the Map the user already has.
Because kind 10040 is replaceable, signing and publishing that template **replaces** the whole Map:
the `30392` Trusted-Lists delegation (tl-treasure-map #3), every per-DList curation entry (this
book, stories 2–6), the blanket `39998:dlist-header` designation if present, and any tag another
tool wrote are silently gone. The Treasure Map page would then read "Not set" and "None yet" with
no explanation. The hazard was recorded when the designation entry was specified (BIBLE § Assistant
Keys: "a merge-preserve fix is required"; handoff D8 cost (a)) and grew with every entry family this
book added. The publish scripts (`publish-signed-kind10040`, `brainstorm-create-and-publish-kind10040`)
only forward an already-signed event and are not part of the defect.

## User-facing description
As a user regenerating my Treasure Map through either generator, I want the regenerated Map to keep
every entry the generator does not own — my Trusted-Lists delegation, my curated DLists, my
assistant designation, anything else I or another tool put there — and refresh only the
Trust-Assertion rows, so that regenerating never silently undoes what my Map already says.

## Acceptance criteria
- [ ] **AC-1 (preserved, verbatim, in order).** Given a current Map carrying tags other than
      `30382:*` rows (a `30392` entry, per-DList `39998:<d>` / `39999:<d>` entries, a
      `39998:dlist-header` entry, an unknown tag), regenerating yields a template whose tags contain
      every one of those tags byte-for-byte, in their original relative order, and contains no
      `30382:*` row from the old Map.
- [ ] **AC-2 (the fresh rows).** The template contains exactly today's eleven `30382:*` rows (same
      metrics, same order, same provider pubkey and relay hint), placed as one block where the old
      Map's first `30382:*` row stood — or first when the old Map had none.
- [ ] **AC-3 (no current Map).** When the user has no Map anywhere the generator looks, the
      template is exactly what it is today (the eleven rows, nothing else).
- [ ] **AC-4 (replaceable-event rules).** `created_at` is strictly greater than the current Map's
      even under clock skew (`max(now, old + 1)`); `content` is preserved (empty when there is none);
      the template stays unsigned (no `id`/`sig`) for the user's signer.
- [ ] **AC-5 (where the current Map comes from, and what an error means).** The generator looks in
      local strfry first, then — only when absent locally — on the NIP-85 home relay and the
      general-purpose relays the export flow already knows; the newest copy wins. A *lookup
      failure* (a relay or scan error, not "no Map") refuses to regenerate blind: the API answers a
      5xx with a plain message and the CLI exits non-zero with the same message. "No Map found" is
      not a failure (AC-3).
- [ ] **AC-6 (both generators, one rule).** The API handler and the CLI script apply the same merge
      rule through one shared, pure helper; the file the CLI writes carries the merged tags.
- [ ] **AC-7 (the response tells the truth).** The API response reports how many tags were
      preserved, how many `30382:*` rows were regenerated, and where the current Map was found
      (`local` / `relay` / `none`); the CLI prints the same.
- [ ] **AC-8 (nothing else moves).** The publish endpoints and scripts are unchanged; the content
      of the `30382:*` rows is unchanged; the Treasure Map page and its panels are untouched; the
      legacy pages keep working without modification.

## Concepts touched
None — the Map's `30382:*` rows are configuration, not concepts; no concept-graph change, no
firmware reinstall.

## Out of scope
- Emitting the blanket `39998:dlist-header` entry (still specified-not-wired; preserved if present).
- The legacy pages' UI; the publish half of either flow; story 4's endpoint.
- De-duplicating or validating the preserved tags (they are the user's; kept as found).
- Other 10040 *readers* (`customerManager`, search preferences) — unaffected by a writer fix.

## Open questions
None — the operator approved the story and agreed to skip Architecture (Bug lane, Standard) at the
story gate, 2026-09-10; the design note below is ratified by the Reviewer.

## Design note *(if Architecture is skipped; ratified by the Reviewer)*
- **Chosen approach:** `src/lib/treasureMapMerge.js` (zero-require, pure):
  `mergeTreasureMapTags(existingEvent, freshRows)` → `{ tags, preserved, regenerated }` per AC-1/AC-2,
  and `restampTreasureMap(existingEvent, now)` per AC-4. `src/api/export/nip85/currentMap.js`:
  `fetchCurrentMap(pubkey, deps)` → `{ event, where }` or `{ event:null, where:'none' }`, throwing on
  a lookup *error*; default deps = story 4's `scanLocal` / `fetchFromRelays` from
  `src/api/dlist-curation/index.js`, relays = the NIP-85 home relay + `settings.aRelays`' general
  group. Both generators call `fetchCurrentMap` then `mergeTreasureMapTags`; the API handler adds the
  AC-7 fields to its `data`; the CLI prints them and writes the merged template.
- **Rejected alternative:** re-implementing the merge inside each generator (two copies drift — the
  reason the defect had two homes to begin with); or making the *publish* step merge (too late: the
  event is already signed).
- **Blast radius:** the two generator files; one new lib module; one new fetch module; no UI, no
  publish path, no readers. The eleven `30382:*` rows move into a shared constant so both generators
  and the tests agree on them.

## Linked artifacts
- ADR: — (Bug lane; Architecture skipped if the operator agrees — design note above)
- Test plan: `engineering-team/stories/dlist-curation/7-treasure-map-merge-preserve.test-plan.md` (suite: `test/dlist-curation-merge-preserve.test.js`)
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
