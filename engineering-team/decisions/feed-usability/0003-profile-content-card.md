# ADR 0003: Pinned-note-aware profile "Content" card — a dedicated read path on the shared relay-source

**Status:** Accepted
**Date:** 2026-07-03
**Story:** `engineering-team/stories/feed-usability/3-profile-content-card.md`
**Epic:** `engineering-team/epics/feed-usability.md`
**Depends on:** `feed-usability/0001` (the `isReply` flag on enriched items — used for the top-level fallback)

## Context

The profile page (`/user/:pubkey`) ends with a **"Content" section** that shows one note.
Today it is `ProfileContentSection` (`ui/src/components/ProfileContentSection.jsx`) calling
`useUserNotes(pubkey, 1)` and rendering `data.items[0]` — the viewed user's single
most-recent kind-1, **which may be a reply**. Story 3 changes *which* note the card shows,
in this order:

1. the user's **pinned note** (NIP-51 **kind-10001** pin list), if one resolves;
2. else their most-recent **top-level** (non-reply) note;
3. else an explicit empty state.

Acceptance criteria, quoted to design against:

> - **Pinned note wins** — a pinned note, visibly labelled pinned.
> - **One pinned note when several are pinned** — exactly one, by a deterministic rule
>   favoring the most-recently-pinned entry.
> - **Unresolvable pins fall through** — pin list present but nothing resolvable ⇒ the
>   non-pinned selection; never an error or a stuck-loading card.
> - **No pin → latest top-level note** — most-recent non-reply, even when newer replies exist.
> - **Only replies, no pin → explicit empty state** — a "no top-level notes to feature"
>   message; the `/user/:pubkey/notes` link stays available.
> - **Existing empty state preserved** — no kind-1 at all ⇒ the pre-existing empty message.

### What the codebase already gives us

- **Shared sourcing:** `src/api/_shared/relaySource.js` exports `resolveGeneralPurposeRelays`,
  `realQuerySync`, `realScanStrfry`, `realRunCypher` (+ constants) — the general-purpose
  relay-set resolution and the `SimplePool.querySync` wrapper. `src/api/event/eventReadPath.js`
  already builds on it and fetches a **single event by id** with `querySync(relays, { ids: [id] })`
  (`eventReadPath.js:131`) behind the injectable-deps seam. This is the exact toolkit the pin
  resolution needs.
- **Shared enrichment:** `src/api/_shared/noteEnrichment.js` `enrichNotes(notes, scanStrfry)`
  produces the feed item shape **including `isReply`** (ADR 0001) — so "latest top-level note"
  is `items.find(it => !it.isReply)`.
- **No kind-10001 reader exists** anywhere — this ADR adds the first (read-only).

### The duplication this resolves

`feedReadPath.js` and `userNotesReadPath.js` each keep their **own** copies of the sourcing
helpers; ADR `note-surfaces/0001` logged "consolidate into `_shared/relaySource.js` when a
third consumer appears." **This is that third consumer** — it builds on the shared module
rather than adding a third private copy, discharging that tracked follow-up for the new code.

### Concepts touched (no definition changes)

- `39998:<TA>:nostr-kind` — kind-10001 (pin list, read as a **selector only**, never rendered
  as an entry), kind-1 (the shown note), kind-0 (author display via `enrichNotes`).
- `39998:<TA>:nostr-user` — the viewed user (pin-list author; the pinned note may be authored
  by anyone).
- `39999:<TA>:the-set-of-general-purpose-relays` — where the pin list + pinned note are fetched.

TA pubkey resolved at runtime (relaySource resolves the set by slug). **No firmware reinstall.**

### Constraints

- **Additive & read-only.** No writes; no change to `/feed`, `/user/:pubkey/notes`, search,
  ranking, tagging, or firmware. The by-author read path stays untouched (the `/notes` page
  must **not** prefer pins or filter to top-level).
- **JS-without-build; no new dependency.** Reuses relaySource + enrichNotes.
- **Node-testable.** Selection logic lives server-side behind the injectable-deps seam, driven
  by in-memory fakes — the established behavioral-test pattern.

## Options considered

### Option A — New server read path `profileContentReadPath.js` on `_shared/relaySource` *(chosen)*

Add `src/api/notes/profileContentReadPath.js` exporting `buildProfileContent({ pubkey, deps })`
and `handleGetProfileContent`, wired at `GET /api/user/:pubkey/content`. It uses
`_shared/relaySource` (sourcing) + `_shared/noteEnrichment` (enrich + `isReply`). Returns a
discriminated union:

| `status` | fields | card shows |
|---|---|---|
| `OK` | `pinned: boolean`, `item`, `relaySource` | the note (pinned → "Pinned" label) |
| `NO_TOPLEVEL` | `relaySource` | "no top-level notes to feature" + the notes-page link |
| `EMPTY` | `relaySource` | the pre-existing empty message |
| `INVALID` | — (400) | defensive |

Selection inside `buildProfileContent`:
1. **Pin path.** `querySync(relays, { kinds:[10001], authors:[pubkey] })` → newest kind-10001 →
   its `e`-tag ids **in list order**. One `querySync(relays, { ids, kinds:[1] })` fetches all
   referenced notes; pick the **first pin-list id that resolves to a kind-1** (deterministic;
   the leading `e` tag is the most-recently-pinned by common client convention). Enrich →
   `{ status:'OK', pinned:true, item }`. The pinned note may be authored by anyone.
2. **Fallback.** `querySync(relays, { kinds:[1], authors:[pubkey], limit: CONTENT_CAP })` →
   enrich → `items.find(!isReply)` → `{ status:'OK', pinned:false, item }`.
3. Else `items.length > 0` → `NO_TOPLEVEL`; else `EMPTY`.

Client: a **new one-shot hook** `useProfileContent(pubkey)` (the pre-pagination `useUserNotes`
shape — `{ data, loading, error }`, aborts on unmount), and `ProfileContentSection` switches
from `useUserNotes(pubkey, 1)` to it. `renderContentBody` maps OK→`<NoteCard>` (+ a "Pinned"
badge when `data.pinned`), NO_TOPLEVEL→the new reply-only copy, EMPTY/error→the existing copy;
the `View all notes →` link stays in every state.

- **Pros:**
  - Uses the **shared** relaySource (third consumer) — no third private helper copy; discharges
    the logged consolidation debt for new code.
  - Selection is server-side, behind the deps seam → every outcome (pinned / top-level fallback /
    unresolvable-pins-fall-through / reply-only / empty / invalid) is a Node behavioral test with
    in-memory fakes, no live relays.
  - Decouples the Content section from the now-**paginating** `useUserNotes` (Story 2) — the card
    wants one note, not an accumulator; a dedicated one-shot hook is a better fit and removes an
    accidental coupling.
  - Strictly additive: one module, one route line, one hook, a section edit, copy + a badge style.
    `/feed`, `/notes`, and the by-author read path are untouched.
- **Cons:**
  - A second query on the fallback path (pins, then recent). Only when there's no usable pin;
    both are bounded, best-effort, and the card is a single low-frequency section. Acceptable.

### Option B — Resolve the pin list + notes client-side in `ProfileContentSection`

Fetch kind-10001 + kind-1 in the browser and select there.

- **Cons (decisive):** scatters relay-set resolution and NIP-51 parsing into front-end code,
  can't be unit-tested in the Node harness, and re-litigates the exact split ADR `live-feed/0001`
  (Option B) already rejected. Rejected.

### Option C — Extend `buildUserNotes` with a `content`/`pin` mode instead of a new module

Add a flag to the by-author path so it optionally prefers a pin and returns one note.

- **Cons (decisive):** the by-author path backs the `/user/:pubkey/notes` **page** (and the
  section at limit 1), which must **not** prefer pins or collapse to top-level — that's this
  card's behavior only. Overloading one path with a mode that changes selection for one caller
  invites regressions in the page. A dedicated path keeps each surface's selection rule its own.
  Rejected.

### Sub-decision — pinned-note fetch: one `{ ids }` query (chosen) vs. per-id `buildEvent`

`eventReadPath.buildEvent` resolves a single id with signature verification + NIP-65 outbox
resolution. For the pin list we want the first-resolvable of a few ids: a **single**
`querySync({ ids, kinds:[1] })` gets them all in one round-trip, no per-id outbox/verify
overhead, consistent with how the sibling card reads the general-purpose set. Chosen.

## Decision

**Option A.** A new self-contained `src/api/notes/profileContentReadPath.js` on
`_shared/relaySource` + `_shared/noteEnrichment`, exposed at `GET /api/user/:pubkey/content`,
returning `{ status: OK|NO_TOPLEVEL|EMPTY|INVALID, pinned?, item?, relaySource? }`. It selects
**pinned note (first resolvable `e`-tag of the newest kind-10001) → latest top-level note
(`!isReply`) → NO_TOPLEVEL → EMPTY**. A new one-shot `useProfileContent(pubkey)` hook feeds the
updated `ProfileContentSection` (a "Pinned" badge on the pinned case; the reply-only message on
NO_TOPLEVEL; the existing empty message otherwise; the notes-page link always present). It is
additive and read-only; it builds on the shared sourcing module rather than duplicating it.

## Consequences

- **Enables:** a fair one-note summary on every profile; a first kind-10001 reader the codebase
  can reuse; the Content section no longer rides the paginating `useUserNotes`.
- **Constrains:** the `/api/user/:pubkey/content` response shape becomes the section's contract.
  The "first `e` tag = most-recently-pinned" rule is a **convention choice** (NIP-51 does not
  mandate list ordering) — documented; any deterministic pick satisfies AC-2, and this is the
  common one.
- **Debt discharged / remaining:** new code uses `_shared/relaySource` (the third-consumer
  consolidation the note-surfaces ADR asked for). `feedReadPath.js`/`userNotesReadPath.js` still
  hold their own copies — re-pointing those two is still the tracked, separate refactor (not in
  this story).
- **Best-effort under relay timeout:** pins/notes are fetched best-effort (same posture as the
  sibling cards); "no top-level in the recent window" is treated as NO_TOPLEVEL. Acceptable.
- **Firmware reinstall required?** **No.** No concept/schema change; reads existing
  kind-10001/kind-1/kind-0 + the existing relay set.

## Implementation notes

### Server — new read path

- **New file `src/api/notes/profileContentReadPath.js`:**
  - `const { resolveGeneralPurposeRelays, realQuerySync, realScanStrfry, realRunCypher } = require('../_shared/relaySource');`
    and `const { enrichNotes } = require('../_shared/noteEnrichment');`
  - Constants: `HEX64 = /^[0-9a-f]{64}$/i`, `CONTENT_CAP = 50` (fallback fetch window),
    `PIN_TRY_CAP = 10` (max pin ids to attempt).
  - `pinnedNoteIds(tags)` — the `e`-tag event ids of a kind-10001, **in list order**, first
    `PIN_TRY_CAP`. (`t[0] === 'e' && t[1]`; ignore `a`/other tags — kind-1 pins only.)
  - `async function resolvePinnedItem(pubkey, relays, querySync, scanStrfry)` — newest
    kind-10001 by `pubkey`; if none / no ids → `null`. One `querySync(relays, { ids, kinds:[1] })`;
    map by id; pick the first pin-list id that maps to a `kind===1` event; enrich that one →
    return the item (any author). Nothing resolves → `null`.
  - `async function buildProfileContent({ pubkey, deps } = {})` reading `deps?.scanStrfry ?? options.scanStrfry ?? realScanStrfry`
    (same for `runCypher`, `querySync`) — mirror the seam in `userNotesReadPath.js`:
    1. `if (!pubkey || !HEX64.test(pubkey)) return { status:'INVALID' };`
    2. `const { relays, source: relaySource } = await resolveGeneralPurposeRelays(runCypher);`
    3. `const pinned = await resolvePinnedItem(pubkey, relays, querySync, scanStrfry);`
       `if (pinned) return { status:'OK', relaySource, pinned:true, item: pinned };`
    4. `const raw = (await querySync(relays, { kinds:[1], authors:[pubkey], limit: CONTENT_CAP })) || [];`
       keep `kind===1 && pubkey` , dedup by id, sort `created_at` desc; `const items = await enrichNotes(kept, scanStrfry);`
    5. `const top = items.find(it => !it.isReply); if (top) return { status:'OK', relaySource, pinned:false, item: top };`
    6. `return items.length > 0 ? { status:'NO_TOPLEVEL', relaySource } : { status:'EMPTY', relaySource };`
  - `async function handleGetProfileContent(req, res)` — `buildProfileContent({ pubkey: req.params.pubkey })`;
    `INVALID` → `res.status(400).json({ success:false, ...r, error:'invalid pubkey' })`; else
    `res.json({ success:true, ...r })`. try/catch → 500 (a relay timeout is not an error — it
    yields EMPTY/NO_TOPLEVEL/OK with whatever arrived).
  - `module.exports = { buildProfileContent, handleGetProfileContent, pinnedNoteIds, CONTENT_CAP, PIN_TRY_CAP };`
- **Edit `src/api/index.js`** — register `app.get('/api/user/:pubkey/content', handleGetProfileContent);`
  beside `/api/user/:pubkey/notes` (confirm before any SPA `*` fallback; public — no auth gate).

### Client — hook + section

- **New `ui/src/hooks/useProfileContent.js`** — the pre-pagination one-shot shape (mirror the
  original `useUserNotes`): `useEffect([pubkey])`, guard `!pubkey`, `fetch(\`/api/user/${pubkey}/content\`, { signal })`,
  on `json.success` set `data = json` (`{ status, pinned?, item?, relaySource? }`), else `error`;
  abort on unmount. Returns `{ data, loading, error }`.
- **Edit `ui/src/components/ProfileContentSection.jsx`:**
  - Swap `useUserNotes(pubkey, 1)` → `useProfileContent(pubkey)`; drop the `useUserNotes` import.
  - Extend `CONTENT_COPY` with `PINNED_LABEL: 'Pinned'` and
    `NO_TOPLEVEL: 'No top-level notes to feature yet.'` (punctuation non-binding).
  - `renderContentBody({ data, loading, error })` (stays pure):
    - `loading && !data` → the loading line.
    - `data?.status === 'OK' && data.item` → `<NoteCard item={data.item} />`, and when
      `data.pinned` render a `<div className="bsp-content-pinned">{CONTENT_COPY.PINNED_LABEL}</div>`
      badge above/beside the card (AC-1 "visibly labels it as pinned").
    - `data?.status === 'NO_TOPLEVEL'` → `<div className="bsp-empty">{CONTENT_COPY.NO_TOPLEVEL}</div>`.
    - else (`EMPTY`/error/`INVALID`/unknown) → the existing `CONTENT_COPY.EMPTY` message.
  - The `View all notes →` `<Link>` stays rendered in every state (unchanged).
- **Styles `ui/src/styles.css`** — a small `.bsp-content-pinned` badge (reuse existing token
  colors, e.g. the accent used by `.is-active`); no layout change to the card.

### Testability

- **Server behavioral** (`test/profile-content-card.test.js`, new): inject `querySync`/`scanStrfry`/`runCypher`
  fakes to drive — pinned wins (+ `pinned:true`); multiple pins → the first-resolvable id;
  unresolvable pins fall through to the top-level note; no-pin → first `!isReply` even with a
  newer reply present; reply-only → `NO_TOPLEVEL`; no notes → `EMPTY`; bad pubkey → `INVALID`
  (no relays queried); `pinnedNoteIds` as a pure unit (e-tag order, cap, non-e ignored).
- **Client sentinels**: `ProfileContentSection` renders `<NoteCard item={data.item}>`, the
  `bsp-content-pinned` badge on `pinned`, the NO_TOPLEVEL branch, the always-present notes link;
  `useProfileContent` fetches `/api/user/${pubkey}/content` and passes `success` through.
- **Runtime**: cycle-local browser smoke before review — a profile with a pin shows the pinned
  note + badge; a reply-heavy no-pin profile shows its latest top-level; a replies-only profile
  shows the NO_TOPLEVEL message with the working link.

## Out of scope
- Multiple pinned notes / a pin carousel / a separate "Pinned" section; pin management (write).
- Honoring pins anywhere but this card (`/feed`, `/notes` untouched).
- `a`-tag (addressable) pins — kind-1 (`e`-tag) pins only.
- Re-pointing `feedReadPath.js`/`userNotesReadPath.js` onto `_shared/relaySource` (the remaining
  half of the consolidation — a separate refactor).
- Any write/publish; any change to search, ranking, tagging, or firmware.
