# ADR 0001: Event read path — a public `GET /api/event` that resolves a kind-1 by id or by author across a relay union

**Status:** Accepted
**Date:** 2026-06-18
**Story:** `engineering-team/stories/event-page/1-event-read-path.md`
**Epic:** `engineering-team/epics/event-page.md`

## Context

The `/event` page needs to take a resolved target — an **event id** (from `nevent`/`id`, with optional relay hints + optional known author) or an **author pubkey** (from `pubkey`/`npub`/`nprofile`, with optional hints) — and return either a displayable kind-1 or a precise, distinct reason. This ADR designs **only that backend read path**; the page (ADR 0002) consumes it.

It is the richer cousin of `userNotesReadPath.js` (`note-surfaces` #1): same local-enriched feed item shape (reuses `enrichNotes`), but with (a) an **event-id** mode, (b) **verification** + **kind-gating**, and (c) a **relay union** that adds embedded hints and the author's **outbox** to the well-known set.

### Why a server read path (the client/server split)

The page must decode the 6 bech32 formats client-side anyway (search-field format validation + `naddr`'s kind), but the **fetch** belongs server-side:
- the **well-known set** is the firmware general-purpose relay set, resolvable only via `runCypher` (server) — `feedReadPath.js:138-159`;
- the **outbox bootstrap** (fetch the author's kind-10002, use its write relays) is a server-appropriate multi-relay step;
- keeping `verifyEvent` + enrichment server-side matches the feed/user-notes precedent and the local-only profile rule.

So: **client decodes** → passes `{ id?, author?, relays? }` to `GET /api/event` → **server** resolves the union, fetches, verifies, kind-gates, enriches, returns a discriminated outcome. `naddr` never reaches the server (its kind is in the coordinate → the page reports "kind ‹N› not yet supported" with no fetch — ADR 0002).

### Acceptance criteria, quoted to design against
> - **By event reference** → one of: found (verified kind-1) / unsupported-kind (carries kind) / does-not-validate / not-found.
> - **By author** → author's most-recent verified kind-1, else no-author-note.
> - **Relay union** = hints + author outbox (NIP-65 kind-10002 write relays, when resolvable) + well-known (general-purpose set, slug-from-TA, else fallback `relay.primal.net`/`nos.lol`/`relay.damus.io`); set-vs-fallback observable.
> - **Verification**: never return an unverified event as found.
> - **Enriched, feed-shaped item** (local kind-0 names), so `NoteCard` renders it unchanged.

### Existing mechanisms to reuse (verified in source)
| Need | Pattern | Source |
|---|---|---|
| Relay-set resolution (slug-from-TA + fallback) | `resolveGeneralPurposeRelays(runCypher)` | `feedReadPath.js:138-159` |
| External relay fetch (SimplePool + timeout + dedup) | `realQuerySync` / `handleFetchExternalEvents` | `feedReadPath.js:77-91`, `relay/fetchEvents.js` |
| Local kind-0 scan for enrichment | `realScanStrfry` | `feedReadPath.js:57-69` |
| Enrich raw kind-1 → feed item shape (local-only) | **`enrichNotes(notes, scanStrfry)`** | `_shared/noteEnrichment.js:79` |
| NIP-65 kind-10002 → write relays (r-tag, write-marker filter) | `fetchWriteRelaysFromKind10002` | `ui/src/utils/publishTagPin.js:190-208` (logged-in user; mirror the **parsing** server-side for an arbitrary author) |
| Signature/id verification | `verifyEvent` (confirmed exported) | `nostr-tools` |
| Public route registration; anonymous read-only allowed | `app.get('/api/...')`; auth middleware default | `src/api/index.js:302`; `src/middleware/auth.js:488-489` |

### Constraints
- **Additive, read-only**; no new dependency (`nostr-tools`/`ws`/Neo4j driver/strfry already used). No firmware/concept change.
- **`enrichNotes` reused unchanged** (`enrichNotes` caps the kind-0 *scan arg* at 1000; this path enriches ≤1 note → trivially safe).
- Relay-set handle resolved by **slug-from-TA at runtime** — never a hardcoded pubkey (CLAUDE.md).

## Options considered (the relay-sourcing-reuse decision)

This is the **3rd consumer** of `resolveGeneralPurposeRelays` + the `querySync`/`scanStrfry` wrappers (feed, user-notes, now event). `note-surfaces` ADR 0001 explicitly deferred consolidation "until a third consumer appears." It has.

### Option A — New `event/eventReadPath.js`; extract the sourcing into a NEW `_shared/relaySource.js` that the event path uses; **defer** re-pointing the two shipped modules *(chosen)*
Create `src/api/_shared/relaySource.js` exporting the shared primitives (`resolveGeneralPurposeRelays`, `realQuerySync`, `realScanStrfry`, `realRunCypher`, `FALLBACK_RELAYS`, `RELAY_SET_SLUG`, the module-path constants). The new `eventReadPath.js` imports them; `feedReadPath.js` / `userNotesReadPath.js` keep their private copies **for now**.
- **Pros:** the new code introduces **zero** new duplication (it consumes the shared home); finally establishes `_shared/relaySource.js`; **the event epic stays additive** — it touches no shipped read path, so it doesn't entangle the feed's prod-promotion sequencing or risk the staging-live feed/user-notes. The re-pointing of the two shipped modules becomes a concrete, standalone, behavior-preserving follow-up (guarded by `live-feed-read-path` + `note-surfaces-read-path` suites).
- **Cons:** temporary triplication — `_shared/relaySource.js` duplicates the logic still inlined in the two shipped modules until the follow-up lands. A known, shrinking, tracked debt.

### Option B — Full consolidation now: extract `_shared/relaySource.js` **and** re-point `feedReadPath.js` + `userNotesReadPath.js` in this epic
- **Pros:** zero duplication immediately; closes the deferred follow-up outright.
- **Cons (why not now):** edits two **shipped** modules (feed on staging→prod-pending; user-notes on staging) inside the event epic — entangling their promotions with the event page and adding regression surface to a feature that is otherwise purely additive. Better as a dedicated, separately-promotable refactor. **Surfaced to the operator at the gate** — if they prefer to close the debt now, this is a one-step upgrade from Option A.

### Option C — Inline a 3rd private copy of the sourcing in `eventReadPath.js`
- **Cons (decisive):** grows the duplication into new code with no shared home — exactly what the "3rd consumer" trigger says to stop. Rejected.

## Decision

**Option A.** A new self-contained `src/api/event/eventReadPath.js` exposing `buildEvent(options)` + `handleGetEvent` at public `GET /api/event`, composed from a **new `src/api/_shared/relaySource.js`** (the extracted sourcing primitives) + the reused `enrichNotes`, adding outbox resolution, by-id/by-author fetch, `verifyEvent`, and kind-gating. It returns a discriminated `status` union plus `relaySource`. The event epic touches **no** shipped read path; re-pointing `feedReadPath`/`userNotesReadPath` to `_shared/relaySource.js` is the now-concrete follow-up (Option B as a standalone refactor). Client/server split as in Context; `naddr` is page-only.

## Consequences
- **Enables:** ADR 0002's page calls one endpoint and renders the outcome; future event-centric features (threads, reactions) extend this path.
- **Constrains:** the response shape (`status`, `item`, `kind`, `relaySource`) is a contract ADR 0002 depends on.
- **New shared module:** `_shared/relaySource.js` becomes the canonical sourcing home. **Tracked follow-up (concrete):** re-point `feedReadPath.js` + `userNotesReadPath.js` to it and delete their private copies — behavior-preserving, guarded by their existing suites. Logged in `engineering-team/follow-ups.md`.
- **Best-effort under relay timeout** (cap/timeout per the feed); a slow relay may miss an event that exists elsewhere — acceptable, noted.
- **Firmware reinstall?** **No.**

## Implementation notes

- **New file: `src/api/_shared/relaySource.js`** — move (copy, since the shipped modules aren't re-pointed yet) the sourcing primitives from `feedReadPath.js`:
  - `NOSTR_TOOLS_PATH`, `WS_PATH`, `FETCH_TIMEOUT_MS`, `FALLBACK_RELAYS = ['wss://relay.primal.net','wss://nos.lol','wss://relay.damus.io']`, `RELAY_SET_SLUG`.
  - `realScanStrfry(filter)`, `realRunCypher(cypher,params)`, `realQuerySync(relays,filter)`, `resolveGeneralPurposeRelays(runCypher)` — verbatim from `feedReadPath.js:57-159`.
  - `module.exports` all of them. (Note the fallback order matches the operator's stated list; the feed's existing array is the same set, order non-binding.)
- **New file: `src/api/event/eventReadPath.js`**
  - `const { resolveGeneralPurposeRelays, realQuerySync, realScanStrfry, realRunCypher, FALLBACK_RELAYS } = require('../_shared/relaySource');`
  - `const { enrichNotes } = require('../_shared/noteEnrichment');`
  - `const HEX64 = /^[0-9a-f]{64}$/i;` `const AUTHOR_FETCH_CAP = 10;` (newest-batch to verify through for by-author).
  - **`verify(ev)`** → `require(NOSTR_TOOLS_PATH).verifyEvent(ev)` (lazy require, path-tolerant like enrichNotes; on throw → false).
  - **`fetchOutboxRelays(author, bootstrapRelays, querySync)`** → `querySync(bootstrapRelays, { kinds:[10002], authors:[author], limit: 5 })`; newest kind-10002; collect `r`-tag URLs whose marker ≠ `'read'` (mirror `publishTagPin.js:200-206`); return `wss://`/`ws://` only. Empty/none → `[]`.
  - **`unionRelays(hints, outbox, wellKnown)`** → dedup + keep `wss://`/`ws://`.
  - **`async function buildEvent({ id, author, relays, deps } = {})`** reading injectable deps `deps?.X ?? options.X ?? real*` for `scanStrfry`, `runCypher`, `querySync` (mirrors the feed seam):
    1. Validate: if `id` present and `HEX64.test(id)` → by-id mode; else if `author` present and `HEX64.test(author)` → by-author mode; else `return { status:'INVALID' }`.
    2. `const hints = (relays||[]).filter(wss/ws);` `const { relays: wk, source: relaySource } = await resolveGeneralPurposeRelays(runCypher);`
    3. Outbox: the author to look up = by-author's `author`, or (by-id) the `author` hint if supplied. If present → `outbox = await fetchOutboxRelays(authorPk, [...hints, ...wk], querySync)` else `[]`.
    4. `const union = unionRelays(hints, outbox, wk);`
    5. **by-id:** `events = await querySync(union, { ids:[id] })`; pick the event with matching `id`; none → `{ status:'NOT_FOUND', relaySource }`; found but `!verify(ev)` → `{ status:'INVALID_EVENT', relaySource }`; verified but `ev.kind !== 1` → `{ status:'UNSUPPORTED_KIND', kind: ev.kind, relaySource }`; verified kind-1 → enrich → `{ status:'OK', relaySource, item }`.
    6. **by-author:** `events = await querySync(union, { kinds:[1], authors:[author], limit: AUTHOR_FETCH_CAP })`; keep kind-1 by `author`, sort `created_at` desc, take the first that `verify`s; none → `{ status:'NO_AUTHOR_NOTE', relaySource }`; else enrich `[chosen]` → `{ status:'OK', relaySource, item }`.
  - **`item` = `(await enrichNotes([ev], scanStrfry))[0]`** — the feed item shape.
  - **`async function handleGetEvent(req, res)`** — read `req.query.{id,author,relays}` (`relays` CSV → array); `const r = await buildEvent({ id, author, relays })`; `INVALID` → `res.status(400).json({ success:false, ...r, error:'no valid id or author' })`; else `res.json({ success:true, ...r })`; try/catch → 500. Public (no auth gate; not in any blocklist).
  - `module.exports = { buildEvent, handleGetEvent }`.
- **Edit: `src/api/index.js`** — `const { handleGetEvent } = require('./event/eventReadPath.js');` and `app.get('/api/event', handleGetEvent);` beside `/api/feed`/`/api/user/:pubkey/notes`. (`/api/event` confirmed unused.)
- **No new dependency, no lint/build tooling, no concept/firmware change.**

### Testability
Mirror `note-surfaces-read-path.test.js` (Node runner, in-memory fakes for `scanStrfry`/`runCypher`/`querySync`):
- by-id: OK (verified kind-1) / UNSUPPORTED_KIND (verified non-kind-1, carries kind) / INVALID_EVENT (id matches but verify fails) / NOT_FOUND (no match) / INVALID (bad/empty id+author).
- by-author: OK (newest **verified** kind-1; skips an unverified newer one) / NO_AUTHOR_NOTE.
- relay union: assert the `querySync` fake is called with a relay list that **includes** the hints, the outbox write-relays (from the kind-10002 fake), and the well-known set; `relaySource` set-vs-fallback via the `runCypher` fake.
- outbox: `fetchOutboxRelays` parses write-marker r-tags, drops `read`-marked, newest kind-10002 wins.
- `verifyEvent` is stubbed at the boundary (inject a `verify`/`querySync`-shaped fake or feed pre-built events) so tests stay hermetic — the seam detail is an implementation choice the Tester pins.

## Out of scope
- The page, param decoding, the search field, `naddr` handling, all rendering (ADR 0002).
- **Re-pointing `feedReadPath`/`userNotesReadPath` to `_shared/relaySource.js`** — the tracked follow-up (Option B as a standalone refactor).
- Threads/replies/reactions; multiple results; addressable/non-kind-1 rendering; any write/publish; firmware.
