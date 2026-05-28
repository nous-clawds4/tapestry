# ADR 0026: Follows list on the primary profile page

**Status:** Accepted
**Date:** 2026-05-28
**Story:** `engineering-team/stories/29-profile-follows-list.md`

> **v1 scope (2026-05-28 amendment):** customer-observer support is **deferred**; v1 is **owner point-of-view only**. The point-of-view selector, customer-relative metrics, and customer-default-observer behavior move to a follow-up story. This ADR designs owner-only v1 and documents the customer path as a named extension point.

## Context

Story 29 adds a standalone `/user/:pubkey/follows` page to the primary (React) profile, listing the accounts a user follows with trust metrics (rank, hops, verified follower/muter/reporter counts), client-side search/pagination, persisted column prefs, and a "computed locally, not NIP-85" disclosure. Default sort: **verified-followers count, descending**, across the whole follow set. **For v1, all metrics are computed from the instance owner's point of view.**

Code facts (verified against source; stack live at `:7778`):

- **The existing `follows` query is not observer-relative — and already serves the owner POV.** `src/api/grapevineInteractions/queries/cypherQueries.js:20-24` returns `followee.influence`/`followee.hops` (single global properties on the `NostrUser` node) and never uses `$observer`. Those node properties **are** the owner's GrapeRank run — exactly what v1 needs — but the query returns **no verified counts**.
- **Owner vs. customer is one endpoint with an internal branch, not separate endpoints.** `src/api/export/users/queries/userdata.js` takes a single `observerPubkey` param (`:24`) and flips an internal `source` (`:40-54`): `'owner'`/absent ⇒ read the **`NostrUser` node** itself; any customer pubkey ⇒ read a purpose-built **`NostrUserWotMetricsCard {observer_pubkey, observee_pubkey}`** node (`:75-85`), with the same `RETURN` field list either way (`:148-156`). The owner has **no** card (its scores live inline on `NostrUser`); each customer gets its own card set. **v1 implements only the `NostrUser`-node (owner) branch;** the card branch is the documented customer-phase extension.
- **All five per-row metrics are co-located.** `influence`, `hops`, `verifiedFollowerCount`, `verifiedMuterCount`, `verifiedReporterCount` all live together on the source node (`NostrUser` for owner; the card for a customer) — `userdata.js:148-156`.
- **A third metrics store exists** (context for the POV-naming divergence, not used here). The profile's *Reputation* section reads Meilisearch POV-namespaced `wot_*_<8char>` fields (`ui/src/pages/BrainstormProfile.jsx:119-188`) — which is why the profile uses `?pov=<8char>` while the grapevine APIs use `observer=<full pubkey | 'owner'>`.
- **`Following: N` (strfry) and the follow-list length (Neo4j) can diverge.** `handleGetUserCounts` (`userdata.js:301-352`) counts kind-3 `p` tags from strfry because Neo4j `FOLLOWS` lags the kind-3 event by hours/days. The list comes from Neo4j. Badge ≠ list length is expected.
- **Neo4j calls here are timeout-sensitive.** `userdata.js:60,176,271-280` wraps queries in a `NEO4J_QUERY_TIMEOUT_MS` deadline (default 15000) → **504** (the #6 / ADR 0024–0025 hardening). `get-grapevine-interaction` (`index.js:52`) has **no** such deadline.
- **UI stack:** Vite 7 + React 19 + react-router-dom 7 (`createBrowserRouter`, `useParams`/`useSearchParams`); built by `npm run build` in `ui/` into `dist/`, static-served by `bin/control-panel.js`. Reusable `ui/src/components/DataTable.jsx` gives header-click sort + a cross-column text filter + custom `render` + `onRowClick` — but **no pagination, no column-visibility, no fixed default sort**. Modal/overlay pattern in `ConfirmDialog.jsx`/`ReportModal.jsx`. `nip19.npubEncode` (nostr-tools) inline for npub. Raw `fetch` + AbortController is the hook convention (`hooks/useUserCounts.js`).

Project constraints: **no new lint/typecheck/build tooling** (the `ui/` Vite build is pre-existing; the control-panel server stays JS-without-build); honor the Neo4j query-deadline pattern; **no concept-graph or firmware change** — `graperank`/`web-of-trust` are touched conceptually but their definitions are unchanged (the metrics are runtime Neo4j node/card properties, not concept-graph nodes). **Firmware reinstall: not required.**

## Options considered

### Option A — New, purpose-built endpoint *(chosen)*

`GET /api/get-grapevine-follows?observee=<pk>[&observer=<pk|'owner'>]`. **v1 Cypher (owner only):**
```
MATCH (observee:NostrUser {pubkey:$observee})
OPTIONAL MATCH (observee)-[:FOLLOWS]->(f:NostrUser)
RETURN f.pubkey AS pubkey, f.influence AS influence, f.hops AS hops,
       f.verifiedFollowerCount AS verifiedFollowerCount,
       f.verifiedMuterCount   AS verifiedMuterCount,
       f.verifiedReporterCount AS verifiedReporterCount
```
— essentially the existing follows query plus the three node-resident verified counts. **Customer-phase extension (deferred):** branch on `observer` exactly like `userdata.js:75-85` — `OPTIONAL MATCH (card:NostrUserWotMetricsCard {observer_pubkey:$observer, observee_pubkey:f.pubkey})` and read metrics from `card` instead of `f`. Apply the `NEO4J_QUERY_TIMEOUT_MS` deadline + 504. The page sorts/searches/paginates client-side over the full array; names/pics via `/api/profiles?pubkeys=`.

- **Pros:** isolates from the shared, timeout-sensitive `get-grapevine-interaction` and the legacy page (zero regression); the page points at the endpoint that will *grow* the card branch, so **no future page migration** when customer support lands; adds the deadline the old endpoint lacks; clean single-purpose contract with the default-sort field present.
- **Cons:** duplicates the `FOLLOWS` traversal; one more endpoint to maintain; for owner-only v1 it's only marginally more code than Option B.

### Option B — Add the three verified-count fields to the existing `follows` query ("B-lite")

For owner-only v1, just append `verifiedFollowerCount/MuterCount/ReporterCount` (node properties) to `cypherQueries.js`'s `follows` `RETURN` + the `index.js:57-71` row mapping; the page calls `get-grapevine-interaction?interactionType=follows&observee=<pk>`.

- **Pros:** smallest possible change (~6 lines), fully additive/backward-compatible, no new route. (The owner-only scope *removes* what made the original Option B messy — no card join, no per-variant gating, no touching the other 19 queries.)
- **Cons:** when customer support lands, metrics must become observer-relative — forcing either a card-branch retrofit into the shared 20-query endpoint (the surface we want to avoid) or a dedicated endpoint built *then* + a **page migration** (churn). Doesn't add the missing deadline. Touches the shared endpoint recent timeout work (#5/#6/#27) was stabilizing.

### Option C — Source metrics from Meilisearch (rejected)

Meili has a ready-made 0–100 `rank` and native sort/paginate, but holds per-user docs, **not** the follow adjacency — forcing a cross-store join over a multi-thousand pubkey set (Meili `filter id IN [...]` impractical at that size); POV is a collision-prone 8-char suffix. Note only as a *future* server-side sort/paginate option.

## Decision

We chose **Option A**, implementing only the **owner (`NostrUser`-node) branch** for v1. The owner-only scope makes B-lite tempting (it's tiny), but customer support is **deferred, not cancelled** — so A's endpoint is the right home for the eventual card branch, lets v1 ship against the final URL/contract (no later page migration), isolates from the fragile shared endpoint, and picks up the missing query deadline. We accept duplicating the `FOLLOWS` traversal as the price. Sort/search/pagination stay **client-side** for v1 (legacy parity; avoids needing names in Neo4j).

*(If you'd rather minimize v1 code and accept a later page migration, B-lite is the lean alternative — say so at the gate and I'll switch the decision.)*

## Consequences

- **Enables:** native follows exploration on the primary profile, built from existing patterns (node sourcing, `DataTable`, the Neo4j deadline, `/api/profiles` batch, `nip19`); a clean home for the deferred customer phase.
- **Watch-outs (v1):**
  - **Count vs list divergence** — `Following: N` (strfry) ≠ list length (Neo4j) is expected; UI copy + tests must **not** assume equality.
  - **UI rebuild required** — `ui/src` changes need `npm run build` (Vite → `dist/`) to appear; the local Docker bind-mount serves `dist/`, so testing includes a rebuild.
  - **Owner-only** — logged-in customers and logged-out visitors all see the owner POV; no selector.
- **Deferred / follow-ups (customer phase):** add the card branch to this endpoint (`observer` param + `NostrUserWotMetricsCard` join, per `userdata.js:75-85`), the POV selector, customer-default-observer, and `?observer=<customer>` URL support. At that point **verify an index on `NostrUserWotMetricsCard(observer_pubkey, observee_pubkey)`** (large follow sets multiply card lookups → 504 risk without it). Also: generalize to other interaction types; consider server-side sort/paginate; reconcile the two POV schemes.
- **Firmware reinstall required?** **No** — no concept definitions change.

## Implementation notes

**Backend (v1, owner only)**
- New file `src/api/grapevineInteractions/queries/followsWithMetrics.js` exporting `handleGetGrapevineFollows(req, res)`:
  - Params: `observee` (required, 64-hex; validate via `nip19.npubEncode` round-trip like `userdata.js:30-35`). `observer` is accepted but **v1 honors only owner**; recommend returning **400 `customer observers not yet supported`** for a non-owner `observer` so the contract is explicit (rather than silently coercing to owner).
  - v1 Cypher as in Option A. Parse Neo4j ints via `.toNumber()`/`parseInt` (cf. `index.js:57-71`, `userdata.js:222-254`); skip the null `f` row when observee has no follows.
  - Run with `{ timeout: queryTimeoutMs }` + the 504-on-`TransactionTimedOut` handling from `userdata.js:60,176,271-280`.
  - Response: `{ success:true, observer:'owner', observee, count, data:[…] }`.
  - **Extension point (deferred):** for a customer POV, branch the source on `observer` exactly like `userdata.js:40-54,75-85` (`NostrUserWotMetricsCard` via `OPTIONAL MATCH`).
- Register in `src/api/index.js` next to line 317: `app.get('/api/get-grapevine-follows', handleGetGrapevineFollows);`.

**Frontend (`ui/src`, Vite — `npm run build` to reflect)**
- Route: add `{ path:'/user/:pubkey/follows', element:<BrainstormFollows/> }` to `ui/src/App.jsx` (mirror `:80-82`); import the page.
- New `ui/src/pages/BrainstormFollows.jsx`: `useParams()` → observee; top bar + `BrainstormUserMenu` (mirror `BrainstormProfile:193-201`); `<Link to={`/user/${pubkey}`}>← Back to profile</Link>`; info popover; the table. **No POV selector in v1.**
- New hook `ui/src/hooks/useGrapevineFollows.js` (mirror `useUserCounts.js`): fetch `/api/get-grapevine-follows?observee=<pk>` → `{data,loading,error}`.
- Names/pics: batch `GET /api/profiles?pubkeys=` (mirror `BrainstormProfile:108-112`), **chunk** (≤~200/req); merge `display_name`/`name`/`picture`.
- Derived cells: `rank = influence==null ? '—' : Math.round(influence*100)`; `name = display_name || name || shortenedNpub`; `npub = nip19.npubEncode(pubkey)` (cf. `BrainstormProfile:99,101`); avatar = the `<img>`/initials pattern (`BrainstormProfile:216-227`).
- Table: reuse `DataTable.jsx` (header-sort + `render` + `onRowClick` → `navigate('/user/'+row.pubkey)`). **Default sort:** pre-sort the data array by `verifiedFollowerCount` desc before passing in (DataTable's initial `sortKey` is null → preserves order). Add at the **page level** (keep `DataTable` changes minimal): client pagination, a "Columns" show/hide toggle, and keep name/npub searchable regardless of visibility.
- Column-visibility persistence: small `useColumnPrefs` hook backed by `localStorage` (key e.g. `bsp-follows-columns`); defaults pic/name/rank shown, npub/hops/verified* hidden; a "Reset to defaults" control.
- Info popover: a small `<InfoPopover>` reusing the overlay+box+`stopPropagation` pattern of `ConfirmDialog.jsx`, opened by a tappable ⓘ button (tap toggles — not hover). Copy: "All data on this page is computed locally by this Tapestry instance and is not imported via NIP-85."
- "Following" badge → link: in `BrainstormProfile.jsx:236-241`, wrap the count in `<Link to={`/user/${pubkey}/follows`}>` (import `Link`).
- Styles: add `bsp-`-prefixed rules in `ui/src/styles.css`; reuse `data-table`/`bsp-*` classes where possible.

## Out of scope (this ADR / v1)

- **Customer observers** — the card branch, POV selector, customer-default-observer, and `?observer=<customer>` support (deferred; see story #29 "Deferred to a follow-up").
- Other interaction types (followers/mutes/reports/frens/…).
- Changing `get-grapevine-interaction` or the legacy `grapevine-analysis.html`.
- Reconciling the profile's `?pov=<8char>`/Meili POV scheme with the new `?observer=`.
- Server-side sort/search/pagination, and Meilisearch as the metrics source.
- Persisting column prefs server-side (localStorage only).
