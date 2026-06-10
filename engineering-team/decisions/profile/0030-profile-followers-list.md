# ADR 0030: Followers list on the primary profile page

**Status:** Accepted
**Date:** 2026-06-06
**Story:** `engineering-team/stories/profile/34-profile-followers-list.md`

## Context

Story #34 adds `/user/:pubkey/followers` — a table of a profile's **verified** followers with the same columns/controls as the Follows page (#29 / ADR 0026), and turns the #33 "Verified Followers" count into a same-tab link to it. v1: **verified followers only**, **owner/House PoV only** (both deferrals mirror #29).

This is a deliberate mirror of ADR 0026, so the design starts there. Verified facts on the current tree (branch off `staging`, which includes #33):

- **Follows is an isolated, purpose-built endpoint** ([followsWithMetrics.js](src/api/grapevineInteractions/queries/followsWithMetrics.js)): `GET /api/get-grapevine-follows?observee=<pk>`, Cypher `MATCH (observee)-[:FOLLOWS]->(f:NostrUser) RETURN f.pubkey, f.influence, f.hops, f.verified{Follower,Muter,Reporter}Count`, owner-PoV from the `NostrUser` node, a `NEO4J_QUERY_TIMEOUT_MS` deadline → 504, non-owner `observer` → 400. Registered at [index.js:320](src/api/index.js:320) (import [:32](src/api/index.js:32)). ADR 0026 chose this **new endpoint specifically to isolate from shared/live code and accept traversal duplication as the price**.
- **Frontend:** [BrainstormFollows.jsx](ui/src/pages/BrainstormFollows.jsx) (234 lines — DataTable + client sort/search/pagination + localStorage column prefs + ⓘ popover + back-link + row→profile nav), hook [useGrapevineFollows.js](ui/src/hooks/useGrapevineFollows.js) (raw `fetch` + AbortController), route [App.jsx:85-86](ui/src/App.jsx:85). Names/pics via batched `/api/profiles` (≤50/req — the #29 staging fix).
- **The #33 count** ([BrainstormProfile.jsx:236](ui/src/pages/BrainstormProfile.jsx:236)) renders "Verified Followers" as a plain `<div className="bsp-count">` — *explicitly* "plain until the followers table ships."
- **The verified cutoff** `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` is read via `getConfigFromFile` ([cypherQueries.js:10](src/api/grapevineInteractions/queries/cypherQueries.js:10)); reuse it (the 0.01/0.05/"score>2" inconsistency stays a separate intake item).

**Two material deltas vs. #29:**
1. **Direction + filter.** Follows lists *all* outbound follows (no filter); followers v1 lists *verified* inbound followers: `(follower)-[:FOLLOWS]->(observee) WHERE follower.influence > cutoff`.
2. **Scale.** Follows sets are small (Jack follows 695). *Verified-follower* sets are large for popular accounts (Jack ≈ 26,711 — confirmed live on staging). #29's "fetch the whole set, sort/search/paginate client-side, batch every name via `/api/profiles`" does **not** scale to tens of thousands (≈534 profile batches for Jack; heavy inbound traversal → 504 risk).

Constraints: no new build/lint tooling; honor the Neo4j deadline pattern; no concept-graph/firmware change (Concept Graph API `:8877` unreachable — concepts named in plain language; runtime Neo4j properties, not graph nodes).

## Options considered

### Option A — Mirror: new endpoint + new page + new hook *(chosen)*
`GET /api/get-grapevine-followers?observee=<pk>` (a sibling of followsWithMetrics.js with reversed direction + verified filter); new `BrainstormFollowers.jsx` (copy of BrainstormFollows with the hook/labels/empty-state swapped); new `useGrapevineFollowers.js`; new route; count→link.
- **Pros:** exactly mirrors ADR 0026's own Option-A rationale — **zero regression risk to the live, prod-shipped Follows feature**; isolated; ships parity fast; the verified filter + scale bound live cleanly in a dedicated query.
- **Cons:** duplicates the ~234-line page and the endpoint/hook. (Addressed: file a DRY follow-up — see Consequences.)

### Option B — Generalize the existing follows endpoint + page (direction/type param)
- **Pros:** DRY.
- **Cons:** edits the **live #29 page + endpoint** (regression risk on prod code); #29 explicitly deferred generalization; folds a verified-filter branch into the unfiltered follows path. Rejected for v1.

### Option C — Extract a shared `<GrapevineList>` component + shared cypher builder
- **Pros:** cleanest long-term DRY.
- **Cons:** refactors the live #29 page (regression risk + scope creep well beyond "add followers"). Rejected for v1 — but it's the right **follow-up** once both pages are stable.

### Scale sub-decision (within A): mirror Follows' client-side pagination *(user decision)*
Per the user, the page **paginates in 50-row blocks exactly like the Follows page** — the endpoint returns the **whole verified set** and the page sorts/searches/**paginates client-side, 50 rows per page** (no server cap). This fully matches the story's "every verified follower / sort across the whole list" AC — **no deviation**.
- **Scale watch-out (mega-accounts):** for a Jack-sized account the whole verified set is ≈26K rows, so first paint waits on (a) a heavy inbound traversal (millions of edges → the 504 deadline is the backstop) and (b) batched `/api/profiles` name lookups for the full set (~26K/50 ≈ 530 batches). This is the same client-side model as #29, just at larger scale; it can be **slow or 504 on the largest accounts**. If staging on a mega-account shows that, the **expected first fix is (b) lazy name-hydration** — fetch the whole verified set once (one traversal) but call `/api/profiles` only for the visible 50-row page, removing the ~530-request name storm (full metric sort + npub search stay whole-set; name search covers hydrated rows). **Server-side pagination is a larger, separate effort that does *not* reduce the traversal** (Neo4j must re-expand the dense node + re-order per page) and forces sort/search out of the client (names live outside the graph) — deferred. Both are follow-ons, not bundled here. *(User, 2026-06-06: ship (a); expects to at least do (b) after seeing real load.)*

## Decision
**Option A (mirror)**, owner/House PoV only, verified filter reusing `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`, the #33 count turned into a link, and **whole-set fetch with client-side 50-row pagination — exactly mirroring Follows** (the user's decision). This honors ADR 0026's isolation precedent (no risk to live Follows) and delivers full parity with the story's ACs. We accept page/endpoint duplication as the price (as ADR 0026 accepted traversal duplication) and file the DRY refactor as a follow-up. The mega-account scale cost is a documented watch-out with server-side pagination as the ready follow-on.

## Consequences
- **Enables:** native verified-followers exploration with Follows parity; isolated from the live Follows feature; bounded cost at scale.
- **Duplication → follow-up.** `BrainstormFollowers.jsx` ≈ `BrainstormFollows.jsx` and the two endpoints share shape. File an intake: *"Extract a shared `<GrapevineList>` component + cypher builder (DRY follows/followers)"* — a deliberate refactor once both are stable (Option C), not bundled here.
- **Count (Meili, precomputed) vs. list length (Neo4j, live) may diverge.** The #33 count comes from Meili `wot_*` (precomputed via kind-30382); this table is a live Neo4j query — and may use a different effective cutoff (the inconsistency intake). Like #29's "Following badge ≠ list length," UI copy + tests must **not** assume equality.
- **Mega-account scale** — fetching + naming the whole verified set (≈26K for Jack) can be slow or 504 on the largest accounts (heavy inbound dense-node traversal + ~530 `/api/profiles` batches). Same client-side model as #29 at larger scale; graceful (504 guard). Expected first optimization if it bites: **(b) lazy name-hydration** (visible-page names only); server-side pagination is a larger, separate follow-on that does not reduce the traversal.
- **Firmware reinstall required?** No (no concept/schema change).

## Implementation notes
**Backend** — new `src/api/grapevineInteractions/queries/followersWithMetrics.js` exporting `handleGetGrapevineFollowers(req, res)`, a near-copy of followsWithMetrics.js with:
- Cypher: `MATCH (follower:NostrUser)-[:FOLLOWS]->(observee:NostrUser {pubkey:$observee}) WHERE follower.influence > $cutoff RETURN follower.pubkey AS pubkey, follower.influence AS influence, follower.hops AS hops, follower.verifiedFollowerCount AS verifiedFollowerCount, follower.verifiedMuterCount AS verifiedMuterCount, follower.verifiedReporterCount AS verifiedReporterCount`. Pass `$cutoff` from `getConfigFromFile('VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF', …)`. **No server-side ORDER BY/LIMIT** — return the whole verified set; the page pre-sorts by `verifiedFollowerCount` desc and paginates client-side 50/page, exactly like Follows (#29).
- Same `observee` validation, owner-only `observer` 400, `NEO4J_QUERY_TIMEOUT_MS` deadline + 504, `toInt`/`toFloat` parsing, and `{ success, observer:'owner', observee, count, data }` response shape as followsWithMetrics.js.
- Register in [src/api/index.js](src/api/index.js) next to the follows route (`app.get('/api/get-grapevine-followers', handleGetGrapevineFollowers)` + import).

**Frontend** (`ui/src`, Vite — `npm run build` to reflect):
- New `ui/src/hooks/useGrapevineFollowers.js` — mirror useGrapevineFollows.js, fetch `/api/get-grapevine-followers?observee=<pk>`.
- New `ui/src/pages/BrainstormFollowers.jsx` — mirror BrainstormFollows.jsx (same DataTable, client sort/search/pagination, localStorage column prefs + reset, ⓘ "computed locally, not NIP-85" popover, "← Back to profile", row→`/user/<pubkey>`, name/rank/npub derivation, `/api/profiles` batching ≤50). Deltas only: the hook, the page title/labels ("Followers"), empty-state copy ("no verified followers"), and a distinct localStorage key (e.g. `bsp-followers-columns`). Default sort: pre-sort by `verifiedFollowerCount` desc (already the server order).
- Route: add `{ path:'/user/:pubkey/followers', element:<BrainstormFollowers/> }` to [ui/src/App.jsx](ui/src/App.jsx:85) + import.
- Count→link: in [BrainstormProfile.jsx:236](ui/src/pages/BrainstormProfile.jsx:236), change the plain Verified-Followers `<div className="bsp-count">` to `<Link to={`/user/${pubkey}/followers`} className="bsp-count bsp-count-link">`, keeping the `fmtCount(trustScores?.verifiedFollowerCount ?? trustScores?.followers)` value. (This is the one edit to a file #33 shipped; the Following link is the template.)
- Styles: reuse existing `bsp-*` / `data-table` classes; no new tooling.

## Out of scope
- **All-followers (unverified) view**; **personalized/customer PoV** for this table — both deferred (story #34).
- The **DRY `<GrapevineList>` refactor** (Option C) — follow-up intake.
- **Scale optimizations** — deferred (v1 is client-side like #29). Expected order if mega-account load proves too slow: **(b) lazy name-hydration first**, then server-side sort/search/pagination (a larger redesign — names live outside the graph).
- Other interaction types (mutes/muters/reports/reporters); the duplicate `TRUST_METRICS` rows; the cutoff inconsistency — existing intake items, untouched.
- Changing the Follows page (#29), `get-grapevine-interaction`, or legacy pages.
