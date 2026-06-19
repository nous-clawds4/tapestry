# ADR 0002: The `/event` page — client-side param decode + precedence, the search fallback, and outcome rendering

**Status:** Accepted
**Date:** 2026-06-18
**Stories:** `engineering-team/stories/event-page/2-event-page-param-render.md`, `engineering-team/stories/event-page/3-event-page-search.md`
**Epic:** `engineering-team/epics/event-page.md`
**Depends on:** ADR `event-page/0001` (`GET /api/event` contract)

## Context

Rework the placeholder `ui/src/pages/BrainstormEvent.jsx` (today it just echoes the identifier) into a working single-event view. **Front-end only**: it decodes/validates the 6 params client-side, resolves a target, calls `GET /api/event` (ADR 0001) for `id`/`author` targets, and renders the outcome with the shared `NoteCard` (like `/feed`). The `/event` route already exists in `ui/src/App.jsx` (top-level public) — **no routing change needed.**

### The contract this page consumes (ADR 0001)
`GET /api/event?id=&author=&relays=` → `{ success, status, relaySource?, item?, kind? }`, status ∈ `OK` (item) / `UNSUPPORTED_KIND` (kind) / `INVALID_EVENT` / `NOT_FOUND` / `NO_AUTHOR_NOTE` / `INVALID`. `OK` item is the feed shape → `NoteCard` renders it unchanged.

### Why client-side decode
The 6 bech32/hex formats decode with `nip19` in the browser (the `nostrEntities.js:36-55` patterns already do exactly this). The page needs client decode anyway for: the search-field **format validation**, extracting **relay hints** (`nevent`/`nprofile` `.relays`) and **author** (`nevent.author`) to pass to the endpoint, and **`naddr`** (its `.kind` → "not yet supported" with no fetch). The server only ever sees resolved `{id?, author?, relays?}`.

### The 6 params, precedence, and the hex ambiguity
Precedence (operator-confirmed): **`nevent` › `id` › `naddr` › `pubkey` › `npub` › `nprofile`**. Decode map:
| param | nip19 / form | target |
|---|---|---|
| `nevent` | decode → `{id, author?, relays?}` | `{mode:'id', id, author, relays}` |
| `id` | 64-hex | `{mode:'id', id}` |
| `naddr` | decode → `{kind, …}` | `{mode:'naddrUnsupported', kind}` (no fetch) |
| `pubkey` | 64-hex | `{mode:'author', author}` |
| `npub` | decode → pubkey | `{mode:'author', author}` |
| `nprofile` | decode → `{pubkey, relays?}` | `{mode:'author', author, relays}` |

**Hex ambiguity (search field only):** a bare 64-hex is valid as *both* `id` and `pubkey`. In a URL the param **name** disambiguates. In the search field there's no name, so by **precedence (`id` before `pubkey`)** a pasted bare 64-hex is treated as an **event id**. (To look up an author by raw key via search, paste an `npub`/`nprofile`; or use the `?pubkey=` URL param.) Documented gotcha, deterministic.

### Constraints
- **Additive & read-only.** Reworks one placeholder page; reuses `NoteCard`; the only other touch is the route already existing. No new dependency/tooling; `nip19` + `react-router-dom` + the `bsp-*`/`bsp-note-card-*` styles are present.
- **No re-derivation of the read path** — the page maps `{status,item,kind}` to DOM; it does not fetch/verify/enrich (ADR 0001 owns that). `relaySource` is ignored (not asked for).
- Public by construction (top-level route + SPA fallback; auth middleware lets non-`/api/` through).

## Options considered

### Option A — Client decode util + a `useEventResolve` hook + pure render helper + an `EventSearch` component; rework `BrainstormEvent.jsx` *(chosen)*
- **`ui/src/utils/eventParam.js`** (new, pure, nip19-based, unit-testable): `resolveEventParams(searchParams)` → `{ target | null, invalidParams: string[] }` (precedence iteration; supported-but-undecodable → `invalidParams`; unknown names ignored); and `classifyEventInput(string)` → a `target` or `null` (the search-field classifier, hex→id per precedence).
- **`ui/src/hooks/useEventResolve.js`** (new, mirrors `useUserNotes.js`): given `{id?, author?, relays?}`, fetch `/api/event?…`; `{data, loading, error}`; no fetch when neither id nor author.
- **`BrainstormEvent.jsx`** reworked: `resolveEventParams` → if `target` is id/author use the hook, render via a pure exported `renderResolvedEvent({data,loading,error})`; if `naddrUnsupported` render "kind ‹N› not yet supported"; if no target render `<EventSearch />`; always show an invalid-params notice when `invalidParams` is non-empty.
- **`EventSearch`** (story #3, in the page file or its own component): input + Enter; on submit `classifyEventInput` → if valid, **navigate to the canonical `/event?<type>=<value>`** (so the result is shareable and #2's path renders it); else show the "not recognized" notice.
- **Pros:** mirrors the established hook + pure-render + copy-constant pattern (`BrainstormFeed.jsx`); the decode/classify logic is a pure, sentinel-testable unit; search reduces to "produce a URL param," unifying it with the param path; strictly additive (one route already exists; `NoteCard` reused).
- **Cons:** a few new files — but each matches an existing convention and keeps the page testable.

### Option B — Decode + fetch entirely client-side (no `/api/event`; the page queries relays in-browser)
- **Cons (decisive):** the **well-known set** needs `runCypher` (server-only) and the **outbox bootstrap** is a server step — ADR 0001's whole rationale. Pushing relay/Neo4j logic into the browser contradicts it and can't resolve the firmware set. Rejected.

### Option C — Server decodes the bech32 too (page passes raw `nevent`/`npub`/… to the server)
- **Cons:** the search field still needs **client** format-validation, and `naddr`'s kind-gate is a no-fetch client decision — so the client decodes regardless. Decoding twice (or round-tripping `naddr` to the server just to be told its kind) is wasteful. Client-decode + server-fetch (Option A) is the clean split. Rejected.

## Decision
**Option A.** A pure `eventParam.js` decode/classify util, a `useEventResolve` hook, a reworked `BrainstormEvent.jsx` with a pure exported `renderResolvedEvent` + module-level `EVENT_COPY`, and an `EventSearch` field that resolves by navigating to the canonical URL param. `naddr` and invalid/unsupported-param handling are client-side; `id`/`author` fetch via ADR 0001. No routing change.

## Consequences
- **Enables:** the user-visible `/event` view; note `nostr:` links (`/event?id=`, `/event?nevent=`, `/event?naddr=`) now resolve to a real view or a precise message instead of the placeholder.
- **Constrains:** coupled to ADR 0001's `status` shape. The hex-ambiguity rule (search bare-hex → id) is a documented behavior.
- **Build/deploy:** Vite `/dist` rebuild (existing step). **Firmware reinstall?** No.
- **No new debt** beyond ADR 0001's shared-sourcing follow-up.

## Implementation notes
All UI under `ui/src` (Vite — `npm run build` in `ui/`).

- **New `ui/src/utils/eventParam.js`** — `import { nip19 } from 'nostr-tools'`:
  - `const HEX64 = /^[0-9a-f]{64}$/i;` `const ORDER = ['nevent','id','naddr','pubkey','npub','nprofile'];`
  - `decodeOne(type, value)` → a `target` or `null`: `nevent`→`nip19.decode` guard type==='nevent' → `{mode:'id', id:data.id, author:data.author||null, relays:data.relays||[]}`; `id`/`pubkey`→`HEX64` → `{mode:'id',id}` / `{mode:'author',author}`; `naddr`→decode → `{mode:'naddrUnsupported', kind:data.kind}`; `npub`→decode → `{mode:'author',author:data}`; `nprofile`→decode → `{mode:'author',author:data.pubkey,relays:data.relays||[]}`. Any throw / wrong type → `null`.
  - `export function resolveEventParams(searchParams)` → iterate `ORDER`; for each name **present** in `searchParams`, `decodeOne`; first non-null → `target`; every present supported name that decoded `null` → push to `invalidParams`; return `{ target: firstValid||null, invalidParams }`. (Names outside `ORDER` untouched → ignored.)
  - `export function classifyEventInput(str)` → trim; try in precedence order: bech32 prefix dispatch (`nevent1`/`naddr1`/`npub1`/`nprofile1` → `decodeOne`), else `HEX64` → `{mode:'id',id}` (**id before pubkey**); return `target` or `null`. Also return the canonical `{paramName, value}` for URL navigation (e.g. `nevent`→`('nevent', str)`, hex→`('id', str)`).
- **New `ui/src/hooks/useEventResolve.js`** — mirror `useUserNotes.js`: args `{ id, author, relays }`; effect deps on those; `if (!id && !author) { setLoading(false); return; }`; `fetch('/api/event?' + qs)` where qs includes `id`/`author` and `relays` (CSV) when present; gate on `success`; `{data,loading,error}`; abort on unmount.
- **Rework `ui/src/pages/BrainstormEvent.jsx`** — keep the `bsp-page`→`bsp-top-bar`(logo + `BrainstormUserMenu`)→`bsp-content` shell:
  - `const [params, setParams] = useSearchParams();` `const { target, invalidParams } = resolveEventParams(params);`
  - `const { data, loading, error } = useEventResolve(target && (target.mode==='id'||target.mode==='author') ? target : {});`
  - Module-level `export const EVENT_COPY = { HEADING:'Event', LOADING:'Loading…', UNSUPPORTED:(k)=>\`Kind ${k} events are not yet supported.\`, INVALID_EVENT:'This event could not be verified — its signature or id does not validate.', NOT_FOUND:'Event not found on the relays we checked.', NO_AUTHOR_NOTE:'No kind-1 note found for this author.', INVALID_PARAMS:(n)=>\`Ignoring invalid parameter(s): ${n}.\`, SEARCH_PROMPT:'Paste an nevent, id, naddr, npub, pubkey, or nprofile.', SEARCH_INVALID:'That isn’t a recognized nevent, id, naddr, npub, pubkey, or nprofile.' };` (punctuation non-binding).
  - Body: render the invalid-params notice when `invalidParams.length`; then: no `target` → `<EventSearch />`; `target.mode==='naddrUnsupported'` → `<div className="bsp-empty">{EVENT_COPY.UNSUPPORTED(target.kind)}</div>`; id/author → `renderResolvedEvent({ data, loading, error })`.
  - **`export function renderResolvedEvent({ data, loading, error })`** — **pure** (no fetch/hook/router/globals): `loading && !data` → loading; `error || !data || !STATUSES.includes(data.status)` → a neutral "couldn’t load" (defensive); `OK` → `<NoteCard item={data.item} />`; `UNSUPPORTED_KIND` → `UNSUPPORTED(data.kind)`; `INVALID_EVENT` → `INVALID_EVENT`; `NOT_FOUND` → `NOT_FOUND`; `NO_AUTHOR_NOTE` → `NO_AUTHOR_NOTE` (each in a `bsp-empty` block).
  - **`EventSearch`** (component, exported for sentinels): controlled input + Enter button; on submit `const c = classifyEventInput(input)` → if `c` → `setParams({ [c.paramName]: c.value })` (navigates in-page → `resolveEventParams` re-runs); else show `EVENT_COPY.SEARCH_INVALID`. Shows `EVENT_COPY.SEARCH_PROMPT` as the label/placeholder.
- **Styles `ui/src/styles.css`** — reuse `bsp-page`/`bsp-content`/`bsp-empty`/`bsp-note-card-*`; add minimal `bsp-event-*` (search input, notice) using existing tokens; cap column + wrap (no 1280px overflow — `bsp-content` is already capped, `bsp-note-card-text` already wraps).
- **No App.jsx change** (the `/event` route exists). **No new dependency, no tooling, no concept/firmware change. `NoteCard.jsx` not edited.**

### Testability
Source-sentinels (the `ui/src/*.jsx` house pattern) **plus** real unit tests for the pure `eventParam.js` (it's plain JS + `nip19`, executes in the Node runner — like `nostrEntities` is tested in `live-feed-feed-page.test.js` T20-T23):
- `eventParam.js` (execute): `resolveEventParams` precedence (multiple valid → first by ORDER; malformed supported → `invalidParams`; unknown names ignored); each of the 6 decodes; `naddr`→`naddrUnsupported`+kind; `classifyEventInput` (bech32 dispatch; bare-hex→id; junk→null; canonical paramName). Fixtures minted with `nip19` (self-validating), as the feed suite does.
- Sentinels: `BrainstormEvent.jsx` renders via `<NoteCard item=`, exports pure `renderResolvedEvent`, has the `EVENT_COPY` strings + each status branch, renders `<EventSearch>` when no target, and the naddr→unsupported branch; `useEventResolve.js` fetches `/api/event` + returns `{data,loading,error}` + aborts; `EventSearch` classifies + `setParams`/navigates on valid, shows the notice on invalid.
- Rendered confirmation (the reference `nevent`, an author lookup, the search field, an `naddr`) is the **staging** capstone (local Docker avoided — parallel session).

## Out of scope
- The read/fetch/verify/relay logic (ADR 0001).
- Rendering non-kind-1 events; threads/replies/reactions; multiple results.
- NIP-05 / free-text search; autocomplete/history.
- Any write/publish; changes to the feed, profiles, ranking, firmware, or existing note link targets.
