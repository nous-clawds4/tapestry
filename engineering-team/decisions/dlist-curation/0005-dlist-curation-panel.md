# ADR 0005: The DList Curation panel — a new page-level panel over pure Map-entry helpers, the story-4 endpoint, and the page's existing sign-and-publish chain

**Status:** Accepted
**Date:** 2026-09-10
**Story:** `engineering-team/stories/dlist-curation/5-dlist-curation-panel.md`

## Context

The story's acceptance criteria, in short: **AC-1** a second folded panel, "DList Curation", with a
count label, same disclosure behavior as story 1, no panel without an assistant; **AC-2** the
approved explanatory sentence; **AC-3** keyword search over the community's self-declared shared
concepts, own/assistant-authored headers excluded, loading and empty states; **AC-4** "In your Map"
(Add disabled) vs "via another assistant" (Add reads Replace); **AC-5** Add calls the story-4
endpoint, shows its outcome, stops on 409 or failure; **AC-6** then composes the Map update
(`["39998:<d>", <my assistant>, <first DList relay or "">]`, replace in place or append, everything
else verbatim, skew-proof `created_at`), previews, signs with NIP-07 drift-guarded, publishes local
plus external through the page's existing chain, re-runs the search; **AC-7** the empowered-entries
list with d-tag, whose assistant, relay hint, and the header's name + link when found locally;
**AC-8** revoke per entry (republish without it; header stays); **AC-9** honest, never corrupting,
never out of order; **AC-10** nothing else moves.

**What the panel stands on** (all read this session):

- **Community headers.** `ui/src/hooks/useCommunitySharedConcepts.js` — fetches kind-39998 headers
  from `COMMUNITY_RELAYS` (`wss://dcosl.brainstorm.world`) through `fetchFromRelays` in
  `ui/src/utils/nostrPublish.js`, keeps newest-per-coordinate, keeps only self-declared ones (a `b`
  equal to the header's own coordinate), returns `{ rows, loadedAt }` with rows
  `{ uuid, eventId, name, description, author, createdAt }`; `rows` is `null` while loading. It
  fetches on mount.
- **The Map's writer pattern.** `ui/src/utils/treasureMap.js` `upsertGenericTlTag` — replace the
  first matching entry in place, drop later duplicates, copy every other tag verbatim,
  `created_at = max(now, old + 1)` (ADR `tl-treasure-map/0001` §3; the skew rule). `classifyEntry`
  reads any first element as kind + everything after the first colon.
- **The sign-and-publish chain.** `TlOptInCard.jsx:52-66`: `getActiveSignerOrThrow()` (drift
  guard, `ui/src/utils/signerGuard.js:55`) → `window.nostr.signEvent(unsigned)` →
  `publishOrThrow(signed)` (`ui/src/utils/publishProfileTag.js`: local strfry + external relays,
  throws only when both fail, inherits the local-only gate) → `onPublished()` (the page's `search`).
- **The disclosure idiom** — ADR `dlist-curation/0001` (this book, story 1) and
  `treasure-map-relay-presence/0003`: local `useState(false)`, a `role="button"` header with
  `aria-expanded`, Enter/Space handling, `{open && body}`; the shared primitive was deferred twice.
- **The endpoint contract** — ADR `dlist-curation/0004`: `POST /api/dlist-curation/header`
  `{ target }` → 200 `{ success, existing, header, published:{ local, relays:[{url,status,reason|error}] } }`
  or `null` published when `existing:true`; 409 `{ success:false, error, existing:{ b:[…], event } }`;
  400/401/404/500 with `error`. Same-origin cookies carry the session.
- **The mount site and its order pin.** `TrustedAssertions.jsx:246-253` mounts `TlOptInCard` then
  `TreasureMapManualEdit`; `tl-treasure-map-optin-publish` S10 pins raw toggle → card → hand-edit
  (`at('<TlOptInCard') < at('<TreasureMapManualEdit')`) — a panel between them keeps it true.
- **Baseline and config.** `useAuth().user.assistantPubkey` (never `ConfigContext.taPubkey`,
  OPEN.md row 188); `useConfig().aRelays.aDListRelays[0]` for the hint; `useProfiles` +
  `AuthorCell` for author display (the Shared Concepts pages' pattern); `queryRelay` for local
  strfry lookups; the DList detail route accepts an a-tag as its id
  (`ui/src/pages/lists/DListDetail.jsx:33`).

**Per-DList entries on the Map today.** `classifyEntry` gives a `39998:<d>` entry kind 39998, name
`<d>`, class `other`; story 6 gives it a class and a badge. This story needs to *find* such entries
and *write* them; it must not pre-empt story 6's display work.

**Concept orientation.** `39998:<TA>:shared-concept` and `39998:<TA>:tapestry-assistant`; no
definition changes.

## Options considered

### Option A — A new panel component; four pure helpers beside the epic's others; the existing chain reused (chosen)

`ui/src/pages/grapevine/DListCurationPanel.jsx` (one file, like `TlOptInCard`), mounted by the page
between the Trusted Lists panel and the hand-edit panel. Pure helpers in `ui/src/utils/treasureMap.js`:
`findDListEntries(tags)`, `upsertDListEntry(event, kind, d, pubkey, relay)`,
`removeDListEntry(event, kind, d)`, `describeDListCuration(entries)`. The body — hook, search, list —
mounts only under `{open && …}`, so the community relay is fetched on first open, not on every page
load.

- **Pros.** Every rule of ADR 0002 §5 and every label becomes a pure, ESM-testable function
  (U-class), the way every helper in this epic is tested. The sign-and-publish chain, the drift
  guard, the publish gate, and the page's refresh are consumed unchanged. The panel's own state is
  local; no context changes. The mount keeps the pinned page order.
- **Cons.** A sixth hand-rolled disclosure on this page family — the extraction chore is now earned
  (recorded below). One component file of a few hundred lines.

### Option B — Generalize `TlOptInCard` into one "delegation panel" that renders both flows

- **Pros.** One disclosure implementation.
- **Cons.** The flows differ in shape (one entry with three states vs a searchable many-entry list
  with a server step); a generic component would carry both sets of props and states and re-touch
  story 1's just-shipped card and its 19-test suite. Rejected.

### Option C — Extract the shared disclosure primitive in this story

- **Pros.** The chore ADR 0003 (relay-presence) and ADR 0001 (this book) both deferred.
- **Cons.** Same reasoning as both: a refactor across shipped panels with its own regression
  surface, on the back of a feature story. Rejected here; **flagged as earned** — a standalone
  chore before or at the book close.

### Option D — Compose the Map update server-side and only sign in the browser

- **Cons.** The Map is the user's event; every user-signed surface composes client-side
  (ADR `tl-treasure-map/0001` consumer guidance; `TlOptInCard`'s rejected alternative). Rejected.

### Sub-decisions

1. **"Already empowered" matching is by d-tag.** A per-DList entry carries no community pubkey, so a
   community row is "In your Map" when the Map has `39998:<its d-tag>` naming my assistant. Two
   community headers sharing a d-tag both read as such; adding the other one is what the endpoint's
   never-clobber 409 exists for, reachable after a revoke. Documented in the panel copy, not
   engineered around.
2. **Counting.** The collapsed label counts every per-DList entry on the Map (kind 39998 or 39999),
   mine or another assistant's — "the number of DLists currently empowered on the Map";
   `"None yet"` / `"1 DList curated"` / `"N DLists curated"`.
3. **Header lookup for the list (AC-7)** is one local `queryRelay` per distinct assistant pubkey on
   the entries (`{kinds:[kind], authors:[pubkey], '#d':[…d-tags]}`), matched back by exact
   coordinate; never the community relay (the list is about *my* Map, local is the source of truth).
   Link: `/tapestry/lists/<encoded coordinate>`.
4. **Add is two-step.** Step 1 (Add / Replace) calls the endpoint and renders its outcome rows plus
   the composed Map update and its preview; step 2 (Sign & publish) signs and publishes. Step 2 is
   also the shape of Revoke (compose without the entry → preview → sign → publish).
5. **Skipped-row reason literal.** The panel renders the endpoint's `reason`/`error` strings
   verbatim; it pins nothing about their wording (story 4's NB-1).

## Decision

We chose **Option A** with the sub-decisions above.

## Consequences

- **Enables** story 6: the finder helper and the per-DList entry rows are the same objects Map
  Entries will classify; story 6 adds the class, badge, and link there without re-deriving.
- **A behavior change users will notice.** A new panel on the Treasure Map page; folded, so the page
  gains one line until opened.
- **Constrains.** The helpers' return shapes and the label strings are contracts Phase 3 pins. The
  panel depends on the endpoint's response shape (ADR 0004 §8; 409 payload).
- **Debt.** The shared-disclosure chore is now earned (six hand-rolled disclosures on one page
  family) — record at the book close as a follow-up story; the panel does not persist its open state.
- **Firmware reinstall required?** **No.**

## Implementation notes

1. **`ui/src/utils/treasureMap.js`** — additive exports, JSDoc in the file's style:
   - `findDListEntries(tags)` → `[{ index, raw, kind, d, pubkey, relay }]` for every tag whose first
     element matches `^(39998|39999):(.+)$` with `<d> !== 'dlist-header'` and a 64-hex second element
     (lowercased); order preserved; never throws.
   - `upsertDListEntry(event, kind, d, pubkey, relay)` → the unsigned Map with the first entry whose
     first element is exactly `${kind}:${d}` replaced in place (later duplicates dropped) or the
     entry appended; every other tag verbatim in order; `content` preserved;
     `created_at = max(now, old + 1)`. Mirrors `upsertGenericTlTag`.
   - `removeDListEntry(event, kind, d)` → same, with every `${kind}:${d}` entry dropped.
   - `describeDListCuration(entries)` → `{ count, label }` per sub-decision 2.
2. **`ui/src/pages/grapevine/DListCurationPanel.jsx`** (new), props `{ event, onPublished }`:
   - Baseline as in `TlOptInCard`: `useAuth().user.assistantPubkey`; `if (!event || !assistantPubkey) return null`; `useConfig().aRelays?.aDListRelays?.[0] || ''`.
   - Header control: the idiom from `TlOptInCard.jsx` (role=button, tabIndex, aria-expanded,
     aria-label `DList Curation — <label>`, Enter/Space with preventDefault, `▾/▸`), title
     "DList Curation", label from `describeDListCuration(findDListEntries(event.tags))`.
   - Body under `{open && …}`: the AC-2 paragraph verbatim; a `<DListCurationBody>` that calls
     `useCommunitySharedConcepts()` (so the fetch starts on first open), `useProfiles` for authors,
     a search `<input>` filtering rows by name/description/d-tag (case-insensitive substring; d-tag
     parsed from `uuid`), excluding `row.author ∈ {user.pubkey, assistantPubkey}`; rows render
     name, description, `AuthorCell`, and the control: "In your Map" (disabled) / "Replace" /
     "Add" per sub-decision 1 and AC-4; loading (`rows === null`) and empty states explicit.
   - Add/Replace: `fetch('/api/dlist-curation/header', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ target: row.uuid }) })`;
     render `existing`/`published.local`/`published.relays[]` rows; on 409 render `existing.b`
     verbatim with the not-re-pointed sentence and stop; on any non-2xx render `error` and stop.
     On success set `pending = { kind:39998, d, unsigned: upsertDListEntry(event, 39998, d, assistantPubkey, relayHint), mode:'add' }`
     and render the preview toggle (JSON, like the card) + "Sign & publish".
   - Sign & publish (add and revoke): `getActiveSignerOrThrow()` → `{...pending.unsigned, pubkey}`
     → `window.nostr.signEvent` → `publishOrThrow` → `onPublished()`; errors inline; the Map on
     screen is never replaced locally (the page re-search does it).
   - Empowered list: `findDListEntries(event.tags)` → rows with d-tag, "your assistant" / "another
     assistant · <8>…<4>", relay hint, header name + link when the local lookup (sub-decision 3)
     finds it, "header not found locally" otherwise; Revoke sets
     `pending = { …, unsigned: removeDListEntry(event, kind, d), mode:'revoke' }` with the copy
     "The assistant's header stays on relays."
   - No `taPubkey`; no 64-hex literal; no new dependencies.
3. **`ui/src/pages/grapevine/TrustedAssertions.jsx`** — import and mount
   `<DListCurationPanel event={event} onPublished={search} />` after `<TlOptInCard …/>` and before
   `<TreasureMapManualEdit …/>` (keeps S10's order pin).
4. **Phase 3 guidance (the Tester's lane).** Suite e.g. `test/dlist-curation-panel.test.js`,
   three classes: **U** — the four helpers by ESM import (finder: kinds, reserved word, malformed
   pubkeys, order; upsert: append / replace in place / duplicate drop / verbatim others / content /
   skew; remove: all matching entries; labels: 0/1/N). **S** — the component: baseline via
   `useAuth`, no `taPubkey`; the disclosure idiom (aria-expanded, useState(false), Enter/Space,
   `{open &&`); the hook used inside the open body; the endpoint path; the AC-2 sentence verbatim;
   the chain `getActiveSignerOrThrow` → `signEvent` → `publishOrThrow`; the page mounts it between
   the two panels. **R** — story 1's card and suite untouched; `useCommunitySharedConcepts` and
   `nostrPublish` untouched; page order sentinel. **B** (optional) — Playwright with `page.route`
   mocks for auth, the Map scan, the community fetch (WebSocket — may need the hook mocked at the
   relay level or the endpoint stubbed), and the endpoint; the reviewer's story-1 method.

## Out of scope

- Map Entries' class, badge, and link (story 6); the shared-disclosure chore; the merge-preserve
  fix (7).
- Any endpoint change; kind-39999 adds; deleting headers; persisting the panel's open state.
