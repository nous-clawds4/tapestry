# ADR 0001: By-author notes read path — a public `GET /api/user/:pubkey/notes` that assembles one user's recent kind-1 notes

**Status:** Accepted
**Date:** 2026-06-18
**Story:** `engineering-team/stories/note-surfaces/1-by-author-notes-read-path.md`
**Epic:** `engineering-team/epics/note-surfaces.md`

## Context

The `note-surfaces` epic adds two surfaces — a profile "Content" section (`note-surfaces` #2) and a `/user/:pubkey/notes` page (#3) — that both need the same thing: the **N most-recent kind-1 notes authored by a given pubkey**, newest-first, profile-enriched into the shared note item shape. This ADR designs **only that backend read path**, exposed as data; the two surfaces (ADR 0002) consume it.

It is a deliberately simpler sibling of the live-feed read path (`feedReadPath.js`, ADR `live-feed/0001`). The feed resolves a *source identity*, reads its kind-3 follow list, and fetches notes for the **set of followed authors**. This read path has **no source identity, no follow list, and no point-of-view** — the author is the pubkey in the URL. Only the *selection* of raw kind-1 differs; the enrichment (author display name + avatar + `nostr:` mention resolution, all from local kind-0) is the **already-shared `enrichNotes`** (`src/api/_shared/noteEnrichment.js:79`, `enrichNotes(notes, scanStrfry)` → items `{ id, pubkey, createdAt, content, author:{displayName,avatar}, mentions }`).

### Acceptance criteria, quoted to design against

> - **Selection & content.** kind-1 by that pubkey, newest-first, capped at N; each item carries id, author pubkey, timestamp, text + author display name/avatar from local kind-0; kind-6/kind-7 and other authors excluded; **item shape identical to the feed's** so `NoteCard` renders it unchanged.
> - **Count parameterization & cap.** count=1 → single latest; count=50 → up to 50; absent/non-numeric/over-maximum → a defined default and a hard maximum (no unbounded result).
> - **Empty outcome** (valid pubkey, zero notes) — distinct from the **invalid-input outcome** (malformed pubkey).
> - **Mentions resolved like the feed** (same `enrichNotes`).

### The sourcing question, settled empirically

The story deferred "relays vs local strfry" to Architecture. **Settled: relays.** Read-only `strfry scan` against the running local stack (2026-06-18):

| Query | Local strfry result |
|---|---|
| `{"kinds":[1],"limit":50}` (any author) | **0 events** |
| `{"kinds":[1],"authors":["3129…f506"]}` (reference user) | **0 events** |
| `{"kinds":[1],"limit":3000}` | **0 events** |
| `{"authors":["3129…f506"]}` (any kind) | 1 event (their kind-0) |

Local strfry on these instances is **not a kind-1 archive** — it holds graph-relevant events (kind-3 follows, kind-0 profiles, tag events), not arbitrary users' posts. Local-only sourcing would render "no notes" for essentially every user. The kind-1 **notes** must come from relays (exactly as `feedReadPath.fetchNotes` does); the **enrichment** (kind-0 author/mention names) stays **local**, exactly as `enrichNotes` already does.

### Existing mechanisms to reuse / mirror (verified in source)

| Need | Pattern | Source |
|---|---|---|
| Resolve general-purpose relay set (slug-from-TA + fallback) | `resolveGeneralPurposeRelays(runCypher)` | `feedReadPath.js:138-159` |
| Fetch kind-1 from relays (SimplePool + timeout + id-dedup) | `realQuerySync` / `fetchNotes` | `feedReadPath.js:77-91,165-180` |
| Local kind-0 scan for enrichment | `realScanStrfry` | `feedReadPath.js:57-69` |
| Enrich raw kind-1 → item shape (author + mentions, local-only) | **`enrichNotes(notes, scanStrfry)`** (already shared) | `src/api/_shared/noteEnrichment.js:79` |
| Public route registration | `app.get('/api/...', handler)` | `src/api/index.js:302` (`/api/feed`) |
| `:pubkey` path-param precedent | `/api/search/profiles/meili/document/:pubkey` | `src/api/index.js:345` |
| Anonymous reachability | auth middleware allows read-only API by default (only a write/backup blocklist is gated) | `src/middleware/auth.js:484-489` |

### Constraints

- **Additive, read-only.** No writes; no change to search, ranking, firmware, **or the shipped `feedReadPath.js`**. With the new module + one route line removed, the app behaves as before.
- **JS-without-build, no new dependency.** `nostr-tools` (`SimplePool`), `ws`, the Neo4j driver, and the strfry CLI are all already used by `feedReadPath.js`. This ADR adds none.
- **`enrichNotes` caller contract** (`noteEnrichment.js:30-37`): it caps the kind-0 *scan argument* at `PROFILE_LOOKUP_CAP=1000` but not the work; a caller serving >1000 distinct authors must pre-cap. This path serves **one** author with **≤50** notes → ≤1 distinct author + its mentions, far under the cap. Safe by construction.

## Options considered

### Option A — New self-contained read-path module sourcing from relays, reusing `enrichNotes` *(chosen)*

Add `src/api/notes/userNotesReadPath.js` exporting `buildUserNotes({ pubkey, limit, deps })` and an Express handler `handleGetUserNotes`, wired at `GET /api/user/:pubkey/notes`. It **mirrors `feedReadPath.js`'s structure** — self-contained, with its own small copies of the sourcing helpers (relay-set resolution, `querySync`, local `scanStrfry`) and the same injectable-deps seam — but its selection step is "kind-1 authored by the single given pubkey, sorted desc, sliced to N." It reuses the one already-shared piece, `enrichNotes`.

- **Pros:**
  - **Matches house style exactly.** `feedReadPath.js` is itself self-contained (defines its own `realQuerySync`/`realScanStrfry`/`resolveGeneralPurposeRelays`); only `enrichNotes` is in `_shared`. This new path is the same shape — least surprising, consistent with the precedent the live-feed epic set.
  - **Strictly additive & reversible.** Touches no shipped code except one route line in `src/api/index.js`. `feedReadPath.js` stays byte-identical — the working, staging-shipped feed carries **zero regression risk**.
  - Reuses `enrichNotes` so the item shape is guaranteed identical to the feed's → `NoteCard` renders it unchanged (criterion 1).
  - The injectable-deps seam (mirroring ADR `live-feed/0001`'s amendment) makes all outcomes unit-testable with in-memory fakes — no live relays/Neo4j/strfry.
- **Cons:**
  - Duplicates ~3 small sourcing helpers (relay resolution, `querySync`, `scanStrfry`) already present in `feedReadPath.js`. Acknowledged and flagged as a **deferred consolidation** (see Consequences) — the same trade-off ADR `live-feed/0001` made when it chose duplication over touching the shared `fetchProfiles.js`.

### Option B — Extract the shared sourcing into `_shared/` and re-point `feedReadPath.js` to reuse it

Move `resolveGeneralPurposeRelays`, `realQuerySync`, `realScanStrfry` into a new `src/api/_shared/relaySource.js`; have **both** `feedReadPath.js` and the new module import them.

- **Pros:** DRY; a single home for relay-set sourcing; the clean long-term end-state.
- **Cons (decisive *for now*):** it **modifies the shipped, staging-live feed read path**, turning a purely additive feature into a change with regression surface across `/feed` — which the epic frames as out of scope and the live-feed batch hasn't even reached prod yet. ADR `live-feed/0001` set the precedent explicitly: prefer a little duplication over touching shipped shared code until a consolidation is justified. We **defer** this to a separate, behavior-preserving refactor (a tracked follow-up) rather than fold it into this feature.

### Option C — Source kind-1 from local strfry only (no relays)

Select the user's kind-1 from local strfry via `scanStrfry({kinds:[1],authors:[pubkey]})`.

- **Cons (decisive):** **empirically returns nothing.** Local strfry holds 0 kind-1 events (evidence above). This surface would be permanently empty for every user. Rejected.

## Decision

**Option A.** A new self-contained `src/api/notes/userNotesReadPath.js` exposing one public `GET /api/user/:pubkey/notes?limit=`, mirroring `feedReadPath.js`'s structure and injectable-deps seam, selecting kind-1 **by the single URL pubkey** from the general-purpose relays (with the same fallback), and reusing the shared `enrichNotes` for the (local-only) author/mention enrichment. It returns a discriminated `status` union (`OK` / `EMPTY` / `INVALID`) plus a `relaySource` (`set` | `fallback`) on `OK`/`EMPTY`, with each item the **exact feed item shape**. It is additive and reversible and leaves the shipped feed untouched. The DRY consolidation of the duplicated sourcing helpers is deferred to a tracked follow-up (Option B, done safely on its own).

## Consequences

- **Enables:** ADR 0002's two surfaces consume one endpoint, parameterized by `limit` (1 for the Content section, 50 for the notes page); they render, they do not re-derive.
- **Constrains:** the response shape (`status`, item fields, `relaySource`) becomes a contract ADR 0002 depends on.
- **New debt / follow-up (tracked):** the sourcing helpers (`resolveGeneralPurposeRelays`, `querySync`, `scanStrfry`) now exist in both `feedReadPath.js` and `userNotesReadPath.js`. Consolidate into `src/api/_shared/relaySource.js` and re-point both — a separate, behavior-preserving refactor (Option B) — when a third consumer appears or a dedicated cleanup is scheduled. Logged in `engineering-team/follow-ups.md` (or the epic) so it isn't silently dropped.
- **Best-effort "N most recent" under relay timeout** — the cap is enforced post-fetch, so a slow/incomplete relay may return fewer than N (same property as the feed). Acceptable for a recent-window surface; noted in Out of scope.
- **Firmware reinstall required?** **No.** Defines no concepts, changes no schema — it only *reads* the existing relay set and existing kind-1/kind-0 events.

## Implementation notes

Concrete targets for the Implementer.

- **New file: `src/api/notes/userNotesReadPath.js`.**
  - `const { enrichNotes } = require('../_shared/noteEnrichment');` (the one shared dependency).
  - Constants: `NOTES_CAP = 50` (hard maximum + default), `HEX64 = /^[0-9a-f]{64}$/i`, `FETCH_TIMEOUT_MS = 8000`, the `FALLBACK_RELAYS` trio, `RELAY_SET_SLUG = 'the-set-of-general-purpose-relays'`, and the absolute `NOSTR_TOOLS_PATH`/`WS_PATH` module-path constants — **copied verbatim** from `feedReadPath.js:35-45` (house convention; lazy-required inside the real helper so the module loads in test/CI).
  - **`clampLimit(raw)`** → integer in `[1, NOTES_CAP]`; non-numeric/absent/over-max → `NOTES_CAP` default (≤0 → 1). Pure; unit-tested directly.
  - Real-helper defaults, **copied from `feedReadPath.js`** (kept private to this module): `realScanStrfry(filter)` (`feedReadPath.js:57-69`), `realRunCypher` (`:72-74`), `realQuerySync(relays, filter)` (`:77-91`), `resolveGeneralPurposeRelays(runCypher)` (`:138-159`).
  - **`fetchAuthorNotes(pubkey, limit, relays, querySync)`** — `querySync(relays, { kinds:[1], authors:[pubkey], limit })`; app-side keep only `kind===1 && ev.pubkey===pubkey`, dedup by `id`, sort `created_at` desc, `slice(0, limit)`. (kind-1-only filter **excludes kind-6/kind-7 by construction**; the author filter excludes everyone else.)
  - **`async function buildUserNotes({ pubkey, limit, deps } = {})`** reading injectable deps `deps?.X ?? options.X ?? <realHelper>` for `scanStrfry`, `runCypher`, `querySync` (mirror `feedReadPath.js:189-194`; **no `getSettings`** — there is no PoV resolution):
    1. `if (!pubkey || !HEX64.test(pubkey)) return { status:'INVALID' };`
    2. `const n = clampLimit(limit);`
    3. `const { relays, source: relaySource } = await resolveGeneralPurposeRelays(runCypher);`
    4. `const notes = await fetchAuthorNotes(pubkey, n, relays, querySync);`
    5. `const items = await enrichNotes(notes, scanStrfry);`
    6. `return items.length === 0 ? { status:'EMPTY', relaySource, items:[] } : { status:'OK', relaySource, items };`
  - **`async function handleGetUserNotes(req, res)`** — `const r = await buildUserNotes({ pubkey: req.params.pubkey, limit: req.query.limit });` then: `r.status==='INVALID'` → `res.status(400).json({ success:false, ...r, error:'invalid pubkey' })`; else `res.json({ success:true, ...r })`. Wrap in try/catch → 500 `{ success:false, error }` (a relay timeout is **not** an error — it yields `EMPTY`/`OK` with whatever arrived, per `realQuerySync`).
  - `module.exports = { buildUserNotes, handleGetUserNotes, clampLimit, NOTES_CAP };`
- **Edit: `src/api/index.js`** — `const { handleGetUserNotes } = require('./notes/userNotesReadPath.js');` and register `app.get('/api/user/:pubkey/notes', handleGetUserNotes);` beside `/api/feed` (line 302). (Confirm it is registered **before** any `app.get('*')` SPA fallback, like the other `/api/*` routes.)
- **No auth change** — anonymous read-only API is allowed by default (`src/middleware/auth.js:488-489`); `/api/user/:pubkey/notes` is not in any write/protected blocklist.
- **No new dependency, no lint/build tooling, no concept/firmware change.**

### Testability

Mirror `test/live-feed-read-path.test.js` (the `test/test.js` Node runner; execution tests with in-memory fakes):
- `buildUserNotes` drives every outcome via injected deps — `INVALID` (bad pubkey, **no deps called**), `EMPTY` (querySync returns `[]`), `OK` (returns kind-1 → assert newest-first order, the N-cap, kind-6/7 + foreign-author exclusion, the item shape, and `relaySource` set-vs-fallback via the `runCypher` fake). No live relays/Neo4j/strfry.
- `clampLimit` is a pure unit: `1→1`, `50→50`, `0/-5→1`, `999→50`, `undefined/'x'→50`.
- Mention resolution is owned/tested by `enrichNotes` (reused unchanged) — this path asserts it passes notes through and returns the enriched shape.

## Out of scope

- The two **surfaces** (Content section, notes page) and their rendering — ADR 0002.
- **Consolidating the duplicated sourcing helpers** into `_shared/relaySource.js` and re-pointing `feedReadPath.js` (Option B) — a tracked follow-up, done separately to keep this additive.
- **Exact-N guarantee under relay timeout** (best-effort, like the feed); caching; pagination beyond N; content kinds other than kind-1; replies/threading/reposts/reactions.
- Any write/publish; any change to the feed read path, search, ranking, or firmware.
