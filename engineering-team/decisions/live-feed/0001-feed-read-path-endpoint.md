# ADR 0001: Live-feed read path — a single public read-only endpoint that assembles the feed

**Status:** Proposed
**Date:** 2026-06-15
**Story:** `engineering-team/stories/live-feed/1-feed-read-path.md`
**Epic:** `engineering-team/epics/live-feed.md`
**Book:** `engineering-team/audits/live-feed/book.md` (Direction-mode, armed)

## Context

We are building the **backend read path** for a basic live feed: kind-1 notes authored by the
accounts a single **source identity** follows, newest first, capped at the 50 most recent. The
`/feed` *page* (Story 2) is out of scope — this ADR designs only the read path the page will
consume, exposed as data with four distinct outcomes.

The story's acceptance criteria, quoted to design against:

> - **Resolution & content.** Given a source identity whose **kind-3 follow list is present in
>   local strfry** and whose follows have posted kind-1 notes, when the feed contents are
>   requested, then the result is the kind-1 notes **authored by those follows**, ordered
>   **newest-first**, capped at the **50 most recent** qualifying notes; each item carries the
>   note's **author identifier, timestamp, and text**, plus the author's **display name and
>   avatar drawn from local profile data** (kind-0 in strfry / Meilisearch). Kind-6 (reposts)
>   and kind-7 (reactions) are **excluded**; notes from accounts the source does **not** follow
>   are excluded.
> - **Relay source with fallback.** … the followed authors' kind-1 notes are gathered from the
>   instance's configured **general-purpose relays** (the `the-set-of-general-purpose-relays`
>   set under the `nostr-relay` concept, resolved by slug relative to this instance's own
>   Tapestry Assistant — never a hardcoded deployment identifier). When that set **cannot be
>   resolved or is empty**, the read path instead uses the fixed fallback relays
>   `wss://relay.damus.io`, `wss://relay.primal.net`, `wss://nos.lol`, and still returns notes.
>   (Resolved-set vs fallback is an observable distinction in the outcome.)
> - **Edge — no source identity.** Given there is **no logged-in user and no House
>   point-of-view identity configured**, … the result is an explicit **"no source / no House
>   PoV" outcome** — distinct from an empty list — and no relays are queried.
> - **Edge — follow list not local.** Given a source identity exists but its **kind-3 follow
>   list is not present in local strfry**, … the result is an explicit **"follow list not
>   available" outcome** — distinct from both the no-source outcome and an empty-but-present
>   feed.
> - **Edge — present but empty.** Given a source identity's kind-3 follow list **is present**
>   in local strfry but yields **no qualifying kind-1 notes** within the recent window, … the
>   result is an explicit **empty-feed outcome** for a valid, present follow list — distinct
>   from the two outcomes above.

### Concepts touched (resolved via the Concept Graph, not BIBLE)

All handles use this instance's TA pubkey
`e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36`.

- **`the-set-of-general-purpose-relays`** — a `Set` node, handle
  `39999:<TA>:the-set-of-general-purpose-relays`, under the `nostr-relay` concept
  (`39998:<TA>:nostr-relay`). Its members are reached by `HAS_ELEMENT`; each member's `json`
  tag carries `nostrRelay.websocketUrl`. Confirmed members today: `wss://relay.damus.io`,
  `wss://relay.primal.net`, `wss://nos.lol`, `wss://relay.nostr.band`. (Note: the story's
  "Concepts touched" lists this under kind 39998; the node is actually kind 39999 — a
  documentation nit in the story, not a design change. The set is resolved by **slug** built
  from this instance's TA, never a hardcoded UUID.)
- **`nostr-kind`** (`39998:<TA>:nostr-kind`) — kind-3 (source follow list, read from local
  strfry), kind-1 (feed notes, fetched from relays), kind-0 (author profiles, read locally).
- **`nostr-user`** (`39998:<TA>:nostr-user`) — the source identity, a Nostr account identified
  by pubkey.

**No concept definitions change.** This is a read-only consumer of the existing graph; it adds
no nodes, schemas, or properties. (See Consequences → firmware.)

### Existing mechanisms to reuse (found in source)

| Need | Existing pattern | File |
|---|---|---|
| Logged-in user pubkey | cookie session `req.session?.pubkey` (set by the auth middleware; readable on public GETs) | `src/middleware/auth.js`, used in `src/api/auth/getUserClassification.js` |
| House PoV pubkey | `getSettings().grapevine.searchPreferences.povPubkey` (site-wide, owner-controlled, may be `null`) — the canonical House identity per ADR 0033 / BIBLE §27 | `src/config/settings.js`, `src/api/settings/grapevinePrefApi.js` |
| Read kind-3 / kind-0 from **local strfry** | `exec("strfry scan '<filter>'")`, parse JSONL | `src/api/strfry/queries/scan.js` (`handleStrfryScan`); same `execSync` shape in `src/api/profiles/fetchProfiles.js` |
| Resolve concept-graph set members server-side | `runCypher(...)` on the set UUID, parse member `json` tags | `src/lib/neo4j-driver.js` (`runCypher`); query shape mirrors `src/api/concept-graph/index.js` |
| Fetch nostr events from **external relays** | `SimplePool.querySync(relays, filter)` with `Promise.race` timeout + id-dedup | `src/api/relay/fetchEvents.js` (`handleFetchExternalEvents`) |
| Author profiles from **local** kind-0 | local strfry scan; the project also keeps kind-0 in Meilisearch | `src/api/profiles/fetchProfiles.js` (local-strfry branch only), `src/api/search/profiles/meili/index.js` |
| Route registration | `app.get('/api/...', handler)` in the central router | `src/api/index.js` |

### Constraints

- **Additive, read-only** (frame bullet 7): no writes/publishes; no change to search, profile
  pages, ranking/scoring, or firmware. With the new route removed, the app behaves as before.
- **JS-without-build, no new dependencies.** `nostr-tools` (`SimplePool`), `ws`, the Neo4j
  driver, `express-session`, and the strfry CLI are all already in use. This ADR adds none.
- **Profiles must come from local data, not external relays** (a real divergence from
  `fetchProfiles.js`, whose first hop is external profile relays). The story is explicit:
  display name + avatar are drawn from the instance's existing local profile data, *not* the
  external relays the kind-1 notes come from.

## Options considered

### Option A — One new read-path module + one public GET endpoint, reusing the four existing primitives

Add `src/api/feed/feedReadPath.js` exporting a pure-ish orchestrator `buildFeed({ sessionPubkey })`
and an Express handler `handleGetFeed`, wired at `GET /api/feed` in `src/api/index.js`. The
orchestrator composes, in order, four small internal helpers — each a thin reuse of an existing
pattern:

1. **`resolveSource(sessionPubkey)`** → `{ pubkey, origin: 'login' | 'house' }` or `null`.
   `sessionPubkey` (logged-in) wins; else `getSettings().grapevine.searchPreferences.povPubkey`
   (House); else `null` → the `NO_SOURCE` outcome (no relays queried).
2. **`getLocalFollows(pubkey)`** → reads the source's latest kind-3 from **local strfry** via
   `exec("strfry scan '{\"kinds\":[3],\"authors\":[pubkey]}'")` (the `scan.js` pattern),
   extracts followed pubkeys from `p` tags. **Absence of any kind-3 event** → the
   `FOLLOW_LIST_UNAVAILABLE` outcome. A kind-3 with zero `p` tags is a *present* list with no
   follows → flows on to the empty-feed path.
3. **`resolveGeneralPurposeRelays()`** → `{ relays, source: 'set' | 'fallback' }`. Builds the
   set handle `39999:<TA>:the-set-of-general-purpose-relays` from this instance's TA pubkey
   (`GET /api/assistant/pubkey`'s source, i.e. the assistant-keys util) + the fixed slug, runs
   one `runCypher` to pull members' `json` tags, parses `nostrRelay.websocketUrl`. Empty or
   error → the hardcoded fallback `['wss://relay.damus.io','wss://relay.primal.net','wss://nos.lol']`
   with `source:'fallback'`.
4. **`fetchNotes(followPubkeys, relays)`** → `SimplePool.querySync(relays, {kinds:[1], authors, limit})`
   with the `fetchEvents.js` timeout + id-dedup, then app-side: keep only `kind===1` authored
   by a followed pubkey, sort `created_at` desc, slice to 50.
5. **`enrichAuthors(notes)`** → one local kind-0 lookup (local strfry scan, optionally Meili)
   for the distinct authors; attach `displayName` + `avatar`; missing profile → nulls, never an
   external fetch.

The handler maps the orchestrator's tagged result to JSON `{ success:true, status, ... }` where
`status ∈ { OK, EMPTY, NO_SOURCE, FOLLOW_LIST_UNAVAILABLE }` and, on `OK`/`EMPTY`,
`relaySource ∈ { set, fallback }`.

- **Pros:**
  - Each step is a near-verbatim reuse of an established pattern; almost no novel code, which is
    exactly what the frame wants for a "deliberately plain" feature.
  - The four outcomes are a single discriminated `status` union — directly testable from the
    outside (the Tester can assert each `status` independently), satisfying the "distinct
    outcome" wording of all four criteria.
  - One self-contained module with no reach into search/profile/ranking code → trivially
    additive; deleting the route + module reverts cleanly (frame bullet 7).
  - Relay-set resolution is by slug-from-TA, never a hardcoded UUID (criterion 2 + frame).
  - `resolveSource` reuses the canonical House identity (`searchPreferences.povPubkey`, ADR
    0033 / BIBLE §27) rather than inventing a second House notion.
- **Cons:**
  - Introduces a profile-read path that is *local-only*, diverging from `fetchProfiles.js`
    (external-first). We accept a small amount of duplicated kind-0 read logic rather than
    changing the shared, externally-reaching helper (changing it would risk the search/profile
    surfaces the frame forbids touching).
  - `SimplePool.querySync` returns whatever the relays send within the timeout; "50 most
    recent" is enforced app-side after fetch, so a slow/incomplete relay can yield fewer than 50
    even when more exist. Acceptable for a "recent window, not full history" feed and called out
    in Out of scope.

### Option B — Compose the feed in the browser (Story 2 page) from existing endpoints; add no backend

Story 2's page calls the existing public endpoints directly: `GET /api/strfry/scan` for kind-3,
`GET /api/relay/external` for kind-1, `GET /api/profiles` for kind-0, and reads the relay set
client-side. No new backend module; "the read path" becomes orchestration JS shipped to the
browser.

- **Pros:** zero new server endpoints; maximal reuse of shipped handlers.
- **Cons (decisive):**
  - **Violates the story's scope split.** Story 1 is explicitly "the backend read path …
    independent of how they are displayed," consumed by Story 2. Option B has no Story-1
    deliverable — it folds the read path into the page, collapsing the two stories.
  - The four **distinct outcomes** would have to be reconstructed in the browser from four
    separate call results — exactly the discrimination the story wants owned and tested as data.
  - `GET /api/profiles` fetches kind-0 from **external** profile relays first — contradicting
    "drawn from local profile data, not from the external relays."
  - Resolving the relay set and the House PoV client-side spreads PoV/relay logic into
    front-end code, away from the server's canonical settings/graph access.
  - Not testable as a backend unit; the book's Tier-4 evidence and the per-story test plan would
    have nothing server-side to assert.

### Option C — Generalize `fetchProfiles.js` and `fetchEvents.js` into a shared "social read" service the feed and other surfaces share

Refactor the existing profile/event fetchers into a new shared service (local-first profiles,
relay-set-aware event fetch) and build the feed on top, so future surfaces reuse it.

- **Pros:** less long-term duplication; a single home for "read social data" concerns.
- **Cons (decisive):** the refactor **touches `fetchProfiles.js`**, which backs the search and
  profile surfaces the frame forbids modifying — turning an additive, reversible feature into a
  cross-cutting change with regression surface across the app. Over-engineers a feature whose
  whole point is to be "relatively basic, nothing fancy." Generalization with one consumer is
  premature; revisit when a second consumer actually appears.

## Decision

We chose **Option A** — a single new, self-contained read-path module
(`src/api/feed/feedReadPath.js`) exposed as one public `GET /api/feed`, composed from thin
reuses of the four existing primitives (session/House-PoV resolution, local strfry scan,
concept-graph set resolution via `runCypher`, and `SimplePool` relay fetch), returning a
discriminated `status` union plus a `relaySource` discriminator.

It is the only option that honors the Story-1/Story-2 split (a backend deliverable testable
without the page), produces the four required *distinct* outcomes as data, keeps profile reads
**local** as the story demands, resolves the relay set by **slug-from-TA** (never a hardcoded
UUID), and stays strictly additive and reversible — without touching the search/profile/ranking
code the frame protects. We trade away a small amount of duplicated local kind-0 read logic
(vs. Option C's risky shared refactor) and accept best-effort "50 most recent" semantics under
relay timeout (vs. a guaranteed exact-50, which a recent-window feed does not need).

## Consequences

- **Enables:** Story 2 (`/feed` page) consumes one endpoint whose response already encodes all
  four states; the page renders, it does not re-derive. Establishes a clean, local-first,
  relay-set-aware read pattern the later tagging book can build beside.
- **Constrains:** the response shape (`status`, item fields, `relaySource`) becomes a contract
  Story 2 depends on — changing it later means updating the page. Documented below so the
  contract is explicit.
- **New debt / follow-ups:** a second, local-only kind-0 read path lives alongside
  `fetchProfiles.js`; if a third consumer appears, revisit Option C's consolidation then. The
  "50 most recent" cap is enforced post-fetch, so it is best-effort under relay timeout — noted
  in Out of scope.
- **Firmware reinstall required?** **No.** This feature defines no concepts and changes no
  schemas or properties — it only *reads* the existing `the-set-of-general-purpose-relays` set
  and existing strfry/Meili data. No `POST /api/firmware/install` is needed.

## Implementation notes

Concrete targets for the Implementer.

- **New file: `src/api/feed/feedReadPath.js`.**
  - `async function buildFeed({ sessionPubkey })` → returns one of:
    - `{ status: 'NO_SOURCE' }` (no `sessionPubkey`, no House `povPubkey`; no relays queried)
    - `{ status: 'FOLLOW_LIST_UNAVAILABLE', source: { pubkey, origin } }` (no kind-3 in local strfry)
    - `{ status: 'EMPTY', source, relaySource, items: [] }` (kind-3 present, no qualifying notes)
    - `{ status: 'OK', source, relaySource, items: [ {...} ] }`
    - where `source = { pubkey, origin: 'login' | 'house' }`, `relaySource: 'set' | 'fallback'`,
      and each item `= { id, pubkey, createdAt, content, author: { displayName, avatar } }`.
  - Internal helpers (keep them in this file unless a clean shared home already exists):
    - `resolveSource(sessionPubkey)` — `sessionPubkey` first; else
      `getSettings().grapevine?.searchPreferences?.povPubkey` (require a non-empty 64-hex string);
      else `null`. Reuse `getSettings` from `src/config/settings.js`.
    - `getLocalFollows(pubkey)` — `exec`/`execSync` `strfry scan '{"kinds":[3],"authors":["<pubkey>"]}'`
      following the escaping in `src/api/strfry/queries/scan.js`; take the newest kind-3 by
      `created_at`; map `p`-tags → pubkeys. **No kind-3 at all → return a sentinel meaning
      "unavailable"** (distinct from "present but zero follows", which returns `[]`).
    - `resolveGeneralPurposeRelays()` — build handle
      `39999:${TA}:the-set-of-general-purpose-relays` where `${TA}` is this instance's assistant
      pubkey (resolve via the existing assistant-keys/util the `/api/assistant/pubkey` route uses
      — **do not** hardcode the hex); `runCypher` (from `src/lib/neo4j-driver.js`):
      `MATCH (s:Set {uuid:$h})-[:HAS_ELEMENT]->(m:ListItem) WHERE NOT m:Superset MATCH (m)-[:HAS_TAG]->(jt:NostrEventTag {type:'json'}) RETURN jt.value AS json`;
      parse each → `JSON.parse(json).nostrRelay.websocketUrl`; filter to `wss://`/`ws://`.
      Empty/error → `{ relays: ['wss://relay.damus.io','wss://relay.primal.net','wss://nos.lol'], source: 'fallback' }`;
      else `{ relays, source: 'set' }`.
    - `fetchNotes(followPubkeys, relays)` — reuse the `SimplePool.querySync(relays, filter)` +
      `Promise.race` timeout + id-dedup from `src/api/relay/fetchEvents.js`; filter
      `{ kinds:[1], authors: followPubkeys }` (kind-1 only — **excludes kind-6/kind-7 by
      construction**); app-side: drop any event whose author is not in `followPubkeys`, sort by
      `created_at` desc, slice to **50**. Guard `authors` length (SimplePool/relay limits) —
      chunk if `followPubkeys` is large, then merge+dedup+re-sort+re-slice.
    - `enrichAuthors(notes)` — distinct author pubkeys → **local** kind-0 only: local strfry
      scan (`{"kinds":[0],"authors":[...]}`, the `fetchProfiles.js` local branch) and/or the
      Meili profile store (`src/api/search/profiles/meili/`); parse `content` → `name`/
      `display_name` and `picture`; missing → `{ displayName: null, avatar: null }`. **Never**
      fetch kind-0 from the external relays used for the notes.
  - `async function handleGetFeed(req, res)` — `const r = await buildFeed({ sessionPubkey: req.session?.pubkey })`;
    `res.json({ success: true, ...r })`. Public (no auth gate). Wrap in try/catch → 500
    `{ success:false, error }` on unexpected failure (relay timeout is **not** failure — it
    yields `EMPTY`/`OK` with whatever arrived, per `fetchEvents.js`).
  - `module.exports = { buildFeed, handleGetFeed }`.
- **Edit: `src/api/index.js`** — `const { handleGetFeed } = require('./feed/feedReadPath.js');`
  and register `app.get('/api/feed', handleGetFeed);` alongside the other public read endpoints
  (near `/api/strfry/scan`, `/api/profiles`, `/api/relay/external`).
- **Module path note:** `fetchEvents.js`/`fetchProfiles.js` require `nostr-tools`/`ws` via the
  absolute container path `/usr/local/lib/node_modules/brainstorm/node_modules/...` and the
  `globalThis.WebSocket` shim. Reuse that exact convention in `feedReadPath.js`.
- **No new dependency, no lint/build tooling, no concept/firmware change.**

## Out of scope

- The `/feed` **page** — rendering, headings, the "most recent 50" indicator, empty-state copy,
  public reachability, 1280px no-overflow. That is `live-feed` #2; this ADR fixes only the data
  contract it consumes.
- **Exact-50 guarantee under relay timeout.** The cap is enforced post-fetch; a slow/incomplete
  relay may return fewer. Acceptable for a recent-window feed.
- **Caching / refresh strategy** for the feed response (deferred; `fetchProfiles.js` caches
  kind-0 — the feed may lean on whatever local-read caching exists but adds no new cache here).
- **Pagination, threading/replies, reposts (kind-6), reactions (kind-7), full history** — all
  excluded by the story.
- **Reconciling the local-only profile read with `fetchProfiles.js`** into a shared service —
  deferred until a second consumer exists (rejected Option C).
- **Any write/publish; any change to search, profile pages, ranking/scoring, or firmware.**
