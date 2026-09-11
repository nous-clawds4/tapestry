# ADR 0002: The two headers — pure pointer checks, the shared header through the story-1 lookup, and one isolated import control

**Status:** Accepted
**Date:** 2026-09-11
**Story:** `engineering-team/stories/my-curated-dlists/2-the-two-headers.md`
**Amended by:** ADR `my-curated-dlists/0003` sub-decision 9 — `deferred` now follows the house rule
(`ui/src/utils/bDisposition.js` `dispositionOf`: a real `b` beats `b-tag-deferred`); story 2 review NB-1.

## Context

The story asks the curated-DList detail page (story 1's front door, ADR 0001) to show:
- **AC-1** — "Your assistant's DList header": where it was found, that your assistant (short pubkey)
  authored it, a raw-event toggle hidden on every load, and a Simple Lists link when it is in this
  instance's strfry.
- **AC-2** — the pointer it carries (coordinate + type), with a plain sentence for each of five
  cases: no `b` tag; a `b` that is not a list coordinate; a type other than `inherit-items`; more
  than one pointer (the first is followed); the reserved `b-tag-deferred` as its own non-error state.
- **AC-3** — "Shared DList header": followed through the pointer, local strfry first, then the
  community relay the DList Curation panel searches; where found; a raw toggle closed on every load;
  a Simple Lists link when local.
- **AC-4** — "Import to local strfry" for either header found only on a relay: the exact event,
  unmodified; re-check; success → "in this instance's strfry" + the link; failure → inline, nothing
  else changes; no signing, no external publish, no graph write.
- **AC-5** — not found / couldn't check, for both headers; the shared section explains when it
  cannot know which header to show.
- **AC-6** — story 1 unchanged in behaviour; the TA Treasure Map and Simple Lists pages unchanged;
  the import is the only write.

Facts from the code (read this session):
1. **Story 1 already resolves the assistant's header.** `CuratedDListDetail.jsx` calls
   `useCurationHeaders([access.row])` (before its early return) and renders the lookup state as one
   line; a marked comment is the insertion point for stories 2–3. `useCurationHeaders`
   (`ui/src/hooks/useCurationHeaders.js`) wraps the pure `lookupCurationHeaders(rows, { scanLocal,
   fetchRelay })` (`ui/src/utils/treasureMap.js`), which returns per coordinate `{ event, where:
   'local'|'relay', checkedRelay }` or `{ missing: true, checkedRelay, failed }` — local strfry
   first, then the row's ws/wss `relay` only when missing. It has no way to re-run on demand.
2. **The pointer rule already exists** for Map Entries: `communityPointerOf(header)` returns the
   first `b` whose value matches `A_TAG_FORM` (`/^\d+:[0-9a-f]{64}:.+$/`), skipping the sentinel,
   with type = element 3 or `pointer` when absent (ADR `dlist-curation/0006`). It reports one pointer
   and nothing about the others. The sentinel is the literal `b-tag-deferred`, carried bare
   (`protocols/drafts/inherit-from.md` § reserved value): consumers derive nothing from it and render
   it as its own state.
3. **The community relay the DList Curation panel searches** is `COMMUNITY_RELAYS`, exported from
   `ui/src/hooks/useCommunitySharedConcepts.js:9` (`['wss://dcosl.brainstorm.world']`).
4. **The Treasure Map page's import idiom** (`TrustedAssertions.jsx:99–120`) is
   `POST /api/strfry/publish` with `{ event, signAs: 'client' }`. The handler
   (`src/api/strfry/commands/publishEvent.js`) requires `id`, `sig`, `pubkey`, never re-signs a
   client event, and pipes it into `strfry import` — which verifies signatures by default
   (`--no-verify` is the opt-out; not passed). Client-signed publishing is permissionless by design
   (`src/middleware/auth.js:451–454`, ADR `security-auth-exposure/0002`), so a customer can import.
   Its only other side effect is `maybeBrainWriteTapestry`, which acts only on kind-39999 letters
   whose `z` is `39998:<TA>:tapestry` authored by the TA or owner (`tapestryBrainWrite.js:36–43`) —
   never a DList header. The live strfry → Neo4j stream ingests only kinds 3, 10000, 1984.
5. **Simple Lists reads local strfry only** (`DListDetail.jsx`), so its link works only once the
   header is local — which is why the link and the import are coupled.
6. **Story 1's hygiene pin.** `test/my-curated-dlists-page.test.js` S6 asserts that
   `MyCuratedDLists.jsx`, `CuratedDListDetail.jsx`, `useTreasureMap.js` and `useCurationHeaders.js`
   contain no `/api/strfry/publish`, no `method: 'POST'`, no signing. The import therefore cannot live
   in any of those four files without re-aiming a shipped story's suite.

**Concepts:** `39998:<TA>:list`, `39998:<TA>:shared-concept`, `39998:<TA>:tapestry-assistant`
(orientation only, as in ADR 0001). No concept is added or changed.

**POV reflex checks.** *Who is this true for?* — the viewer: their own assistant's header (the
front door already guarantees it) and the public shared header it names. *Where does trust come
from?* — none is computed; the pointer checks read the header's own tags. *Could anyone publish
their own version?* — yes, and the import respects that: it stores an event exactly as its author
signed it, through the permissionless client-signed path, gating nothing. *What changes when the POV
changes?* — nothing stored; every load re-derives. Principle 4: strfry holds the letter; the graph
is not written.

## Options considered

### Option A — Pure pointer checks + the shared header through `useCurationHeaders` + an isolated headers module (chosen)
- Pure, testable checks in `treasureMap.js`: `parseCoordinate`, `describeCurationHeader` (authorship,
  the followed pointer, the sentinel, the problem list), `curationPointerRow`.
- The shared header is resolved by the **same** primitive as the assistant's header: a row built
  from the pointer with `relay: COMMUNITY_RELAYS[0]`, passed to a second `useCurationHeaders` — so
  it inherits local-first, failed-vs-missing, and newest-wins for free.
- `useCurationHeaders` gains `refresh()` for the post-import re-check.
- A new `CuratedDListHeaders.jsx` holds the two sections, the raw-event toggle, and the **only**
  write (the import), so story 1's no-write pin keeps holding for everything else.
- **Pros.** No new lookup code; the one write is confined to one module the Tester can pin exactly;
  every decision the story introduces is a pure function.
- **Cons.** The shared lookup reads one community relay (the list has one entry today); a second
  `useCurationHeaders` call on the page.

### Option B — A dedicated shared-header hook over `fetchFromRelays` (client-side websockets)
The shape `useCommunitySharedConcepts` uses.
- **Pros.** Queries every community relay at once.
- **Cons.** A second lookup implementation with different failure semantics (the browser fetch
  cannot report "failed" apart from "empty"), the exact duplication row 249 already names; the
  import's re-check would need its own path.

### Option C — Teach Simple Lists to fall back to the community relay
- **Cons.** The operator chose the import path at kickoff (story Out of scope); it changes a page
  other features use.

### Option D — Inline everything in `CuratedDListDetail.jsx`
- **Cons.** Puts a write into a file story 1's suite pins as write-free (fact 6); mixes the front
  door's routing logic with section rendering the next story will extend again.

## Decision

We chose **Option A**: it adds no lookup code, keeps the page's single write in one pinned place,
and makes every rule the story introduces (which pointer, which problems, which row to look up) a
pure function.

### Sub-decisions
1. **The followed pointer is `communityPointerOf`'s** — the first `b` matching `A_TAG_FORM`,
   sentinel skipped, type defaulting to `pointer` — so Map Entries and this page never disagree about
   which shared header a curation header names.
2. **The problems are reported, never inferred into an error state:** `no-b` (zero `b` tags);
   `not-a-coordinate` (any `b` whose value is neither `A_TAG_FORM` nor the sentinel);
   `wrong-type` (the followed pointer's type ≠ `inherit-items`); `multiple` (more than one
   `A_TAG_FORM` `b`). `deferred` (the sentinel present) is a separate flag, never a problem. A
   header can carry several at once; each gets its sentence.
3. **Authorship is checked, not assumed:** `authoredByAssistant = event.pubkey === assistantPubkey`
   (lowercased). The lookup already filters by author, so a mismatch should never appear — if it
   does, the page says so rather than trusting the filter.
4. **The shared header is looked up at the community relay the panel searches**
   (`COMMUNITY_RELAYS[0]`), through `lookupCurationHeaders` — local strfry first. A pointer naming a
   header that lives elsewhere reads "not found locally or on <community relay>" — honest about
   where it looked.
5. **The Simple Lists link appears only when the lookup says `where: 'local'`** — for either header —
   at `/tapestry/lists/<encodeURIComponent(coord)>`. Found on a relay → the import control instead.
6. **The import sends the found event object as received** — `{ event, signAs: 'client' }` to
   `POST /api/strfry/publish`, never re-built or re-stamped — then calls that section's `refresh()`.
   Success is `res.ok && data.success`; anything else shows `Import failed: <error>` in that section
   and changes nothing else. If the re-check still does not find it locally, the section says so.
7. **Raw toggles are page-local state, `false` on mount** — never persisted — matching the page
   family's idiom (`TrustedAssertions.jsx` "▸ Show raw event").

## Consequences
- Story 3 appends below the two sections; the shared header's lookup (fact 1's shape) is available
  to it if the items view needs the shared coordinate.
- `useCurationHeaders` gains `refresh()` (ADR 0001 note 3 extended — additive; its existing callers
  are unaffected). The detail page's single lookup-state line (ADR 0001 note 5) moves into the
  assistant-header section.
- The page now performs one write, only on an explicit click, only into local strfry. strfry's own
  router may mirror locally imported events per its stream configuration; an event fetched from the
  community relay is already there.
- The shared lookup reads one community relay; widening `COMMUNITY_RELAYS` later widens nothing
  here until `curationPointerRow` is taught to carry several (noted, not built).
- A d-tag containing `%2F` (story 1 review NB-5) and Simple Lists' own double-decode
  (`DListDetail.jsx:15`) can still break the Simple Lists link for exotic d-tags — pre-existing, not
  changed.
- **Firmware reinstall required?** No — no concept definition changes.

## Implementation notes

1. **`ui/src/utils/treasureMap.js`** — extend the `My Curated DLists` section (zero imports kept):
   - `parseCoordinate(coord)` → `{ kind, pubkey, d } | null` — `A_TAG_FORM` on a string; `d` is
     everything after the second colon. Never throws.
   - `describeCurationHeader(event, assistantPubkey)` →
     `{ authoredByAssistant, pointer: { coord, type, kind, pubkey, d } | null, deferred, problems }`,
     `problems` ⊆ `['no-b', 'not-a-coordinate', 'wrong-type', 'multiple']` in that order;
     `pointer` per sub-decision 1 (reuse `communityPointerOf`, then `parseCoordinate`); `deferred`
     when any `b` value is exactly `b-tag-deferred`. Garbage/null event → `authoredByAssistant:
     false, pointer: null, deferred: false, problems: ['no-b']`. Never throws.
   - `curationPointerRow(pointer, relay)` → `{ kind, pubkey, d, relay, coord } | null` — the row
     `lookupCurationHeaders` needs for the shared header.
2. **`ui/src/hooks/useCurationHeaders.js`** — add a `nonce` to the effect's dependencies and return
   `refresh` (`() => setNonce((n) => n + 1)`) alongside `{ headers, loading }`. No other change; it
   stays write-free.
3. **`ui/src/pages/grapevine/CuratedDListHeaders.jsx`** (new) — named exports:
   - `AssistantHeaderSection({ row, lookup, assistantPubkey, onImported })` — title "Your
     assistant's DList header"; states: checking (`!lookup`) · couldn't check (`failed`) · not found
     (the `describeHeaderLookup` text) · found. Found shows: "In this instance's strfry." or
     "Found on <relay> — not in this instance's strfry." with the import control; "Authored by your
     assistant · <short>" (or a warning when `!authoredByAssistant`); "Points to <coord> (<type>)";
     one sentence per `problems` entry and for `deferred`; `<RawEventToggle>`; the Simple Lists link
     ("Open in Simple Lists →") when local.
   - `SharedHeaderSection({ info, lookup, assistantLookup, communityRelay, onImported })` — title
     "Shared DList header"; when there is no pointer, one sentence saying why it can't tell (the
     assistant's header is missing / couldn't be checked / names no shared header / is marked
     deliberately unaffiliated); otherwise the same found / relay / not-found / couldn't-check states,
     the raw toggle, the import control, and the link when local.
   - `RawEventToggle({ event })` — `useState(false)`; "▸ Show raw event" / "▾ Hide raw event";
     `<pre>{JSON.stringify(event, null, 2)}</pre>` styled like the Treasure Map page's.
   - `ImportToLocalButton({ event, onImported })` — the only write:
     `fetch('/api/strfry/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, signAs: 'client' }) })`;
     busy "⏳ Importing…"; success → `onImported()`; failure → "Import failed: <error>" inline.
4. **`ui/src/pages/grapevine/CuratedDListDetail.jsx`** — before the early return: take `refresh`
   from the existing `useCurationHeaders` call; compute `info = describeCurationHeader(lookup?.event,
   assistantPubkey)` only when an event was found; `sharedRow = curationPointerRow(info?.pointer,
   COMMUNITY_RELAYS[0])`; a second `useCurationHeaders(sharedRow ? [sharedRow] : [])`. In the `ok`
   branch replace the lookup-state line with `<AssistantHeaderSection …>` then
   `<SharedHeaderSection …>`, each `onImported` bound to its own `refresh`; keep the heading, the
   subtitle, the back link, and the stories-2–3 insertion comment (now reading story 3). The file
   stays write-free (fact 6).
5. **Nothing else.** No change to the list page, `useTreasureMap.js`, the shipped Treasure Map files,
   Simple Lists, or any server file.

Testable seams for Phase 3 (the Tester's call): `parseCoordinate`, `describeCurationHeader` (each
problem alone and together, the sentinel alone and beside a pointer, authorship both ways, garbage),
`curationPointerRow` behaviorally; structurally — the import's exact request shape and that it lives
only in `CuratedDListHeaders.jsx`, both toggles defaulting closed, the link gated on `'local'`,
`COMMUNITY_RELAYS` feeding the shared row, `refresh` wired to each section; story 1's suite staying
green (its S6 still covers the four files).

## Out of scope
- Story 3's items table, method panel, and Update list.
- Fixing a header (re-pointing, revoking, re-adding); importing the shared list's items; any change
  to Simple Lists.
- Querying more than the first community relay for the shared header.
