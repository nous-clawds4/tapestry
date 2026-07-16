# ADR 0003: Verified Reporters list page

**Status:** Accepted
**Date:** 2026-06-07
**Story:** `engineering-team/stories/verified-reporters/3-verified-reporters-list-page.md`
**Epic:** `verified-reporters`

## Context

Story 3 (final) adds `/user/:pubkey/reporters` — a table of an account's verified reporters, the link target of Story 1's count and the consumer of Story 2's data. ACs: title "Verified Reporters" + back link + description; columns picture/name/Rank sorted by Rank desc; row → reporter profile; row count == the count under the same (House) PoV; a visible PoV line + "About this data" popover; designed empty/loading(skeleton)/error(+retry) states.

**This is a deliberate mirror of an existing, shipped page.** Verified facts on this branch (off `staging`):
- `ui/src/pages/BrainstormFollowers.jsx` (237 lines) is the closest precedent — the "verified <relationship>" list (ADR 0030): `DataTable` + client sort/search/pagination, `loadVisible()`/localStorage column prefs (`STORAGE_KEY = 'bsp-followers-columns'`), the `InfoPopover` ("computed locally … not NIP-85"), `← Back to profile`, row→`/user/${row.pubkey}`, name/rank/npub derivation (`rank = Math.round(f.influence*100)`), `/api/profiles` batching at `PROFILE_CHUNK = 50`. It sorts by `verifiedFollowerCount` desc and uses a text loader (`Loading followers…`) and an error block with no retry.
- The data hook `ui/src/hooks/useGrapevineReporters.js` already exists (Story 2) and returns `{ data, loading, error }` from `GET /api/get-grapevine-reporters?observee=<pk>`.
- Routes live in `ui/src/App.jsx:86-91` (`/user/:pubkey/follows` → `BrainstormFollows`, `/user/:pubkey/followers` → `BrainstormFollowers`).
- Story 1 already links the profile count to `/user/${pubkey}/reporters` (`BrainstormProfile.jsx`); the route is currently unbuilt (404) until this story.
- Copy is fixed by `product-team/guides/verified-reporters-style-guide.md` (canonical table).

Constraints: JS-without-build (no new lint/typecheck); tokens only; no concept-graph/firmware change. House/owner PoV only for v1 (ADR 0002).

## Options considered

### Option A — Mirror BrainstormFollowers.jsx → a new BrainstormReporters.jsx *(chosen)*
A near-copy with bounded deltas (below), reusing `DataTable`, `InfoPopover`, and the `bsp-*` classes; new route; consume the existing `useGrapevineReporters` hook.
- **Pros:** exactly mirrors the ADR 0026/0030 isolation precedent — zero regression risk to the live follows/followers pages; ships parity fast; the new copy/states live in one isolated file.
- **Cons:** a third near-duplicate page (follows/followers/reporters). Addressed: this is now the strongest argument for the already-filed DRY follow-up (a shared `<GrapevineList>` + cypher builder, ADR 0030) — but that refactor stays a follow-up, not bundled here.

### Option B — Extract a shared `<GrapevineList>` component now (DRY all three)
- **Pros:** cleanest long-term DRY.
- **Cons:** refactors the live follows/followers pages (regression risk + scope creep well beyond "add the reporters page"). Rejected for v1 — exactly as ADR 0026/0030 rejected it; it's the right follow-up once all three pages are stable.

### Option C — Generalize an existing page with an interaction-type param
- **Cons:** edits live, prod-adjacent pages; rejected for the same reason as Option B.

## Decision
**Option A** — a new isolated `BrainstormReporters.jsx`, mirroring `BrainstormFollowers.jsx`, with the deltas listed below, House/owner PoV only for v1. Deferred: the DRY refactor (now clearly warranted — note it) and personalized PoV.

## Consequences
- **Completes the feature end to end** — the count (Story 1) now links to a real page backed by real data (Story 2).
- **Honest House-PoV attribution.** Because membership is House-only in v1 (ADR 0002), the list a viewer sees is always the House view. So the PoV line is the **House line, always** — showing "Relative to your web of trust" would misattribute a House-PoV list. The personal-PoV line ships with personalized membership (deferred). This keeps the no-global-view principle truthful rather than cosmetic.
- **count = list length** is the page's own live row count (from the hook), never the precomputed Meili profile badge — so no real-time-equality coupling (per ADR 0002/0030).
- **Third near-duplicate page** → strengthens the DRY follow-up (ADR 0030's `<GrapevineList>`); still deferred.
- **Scale:** verified-reporter sets are expected small (being reported by trusted users is rare — the feature's premise), so ADR 0030's mega-account whole-set-fetch concern barely applies; the same Neo4j 504 guard is inherited via the Story-2 endpoint. No special handling.
- **Firmware reinstall required?** No.

## Implementation notes
**New file `ui/src/pages/BrainstormReporters.jsx`** — copy `BrainstormFollowers.jsx`, then apply these deltas (everything else identical):
1. **Hook:** import and use `useGrapevineReporters(pubkey)` (not followers).
2. **localStorage key:** `STORAGE_KEY = 'bsp-reporters-columns'` (distinct, so it doesn't clobber follows/followers prefs).
3. **Title:** `Verified Reporters`.
4. **Description line (new):** under the title, render `Verified users who have reported this account.` (style guide). Followers has no description — this is added.
5. **PoV line (new):** a visible line below the description. **v1: always the House line** — `Relative to the House (default) web of trust. Sign in and build your network to see your own view.` (style guide). (The personal line `Relative to your web of trust.` is reserved for when personalized membership ships.)
6. **"About this data" popover (extended):** keep the existing local/NIP-85 sentence and add the style guide's second paragraph: `Counts are personal to each viewer's web of trust. There is no single global number. When you have no calculated web of trust, the House (default) view is shown.`
7. **Default sort:** by **`rank` descending** (`(b.rank ?? -1) - (a.rank ?? -1)`), where `rank = Math.round(influence*100)` — deliberately different from followers' `verifiedFollowerCount` sort (most credible reporters first).
8. **Empty state:** `No verified reporters. No one in this web of trust has reported this account.` (style guide).
9. **Loading (skeleton, not text):** replace the `Loading followers…` text with a skeleton — a few placeholder rows. Add minimal token-based CSS to `ui/src/styles.css` (e.g. `.bsp-skeleton-row { height: 2.25rem; border-radius: 6px; background: linear-gradient(90deg, rgba(255,255,255,.04), rgba(255,255,255,.09), rgba(255,255,255,.04)); background-size: 200% 100%; animation: bsp-shimmer 1.2s infinite; }` + `@keyframes bsp-shimmer`). This honors AC7 / the design guide (the precedent's text loader is the one place we intentionally improve).
10. **Error (+ retry):** show the style guide error copy `Couldn't load reporters. Trust scores may still be computing for this view. Try again in a moment.` with a `Try again` button (reuse the existing `.bsp-trust-unavailable` 🔒 block; add a retry button). Wire retry by a **backward-compatible addition to `ui/src/hooks/useGrapevineReporters.js`**: return a `refetch` (e.g. a `reload()` that bumps an internal nonce in the effect dep) alongside `{ data, loading, error }`; the button calls it. (Additive — does not change the existing return contract; the only edit to a Story-2 file, in-scope for the retry AC.)
11. **Columns / rows / search / `/api/profiles` batching / row→profile nav:** unchanged from `BrainstormFollowers.jsx` (same `ALL_COLUMNS`, `DEFAULT_VISIBLE`, `PROFILE_CHUNK = 50`, `onRowClick → navigate('/user/'+row.pubkey)`). The page's live count is `rows.length` (never the Meili badge).

**Route:** add to `ui/src/App.jsx` after the followers route (`:90-91`): `{ path: '/user/:pubkey/reporters', element: <BrainstormReporters /> }` + the import. (Vite build — `npm run build` in `ui/` to reflect.)

## Out of scope
- The profile count + link (Story 1) and the endpoint/data (Story 2) — consumed, not rebuilt.
- **Personalized/customer PoV** and the personal-PoV line — deferred (ADR 0002).
- The DRY `<GrapevineList>` refactor — the existing ADR 0030 follow-up.
- Report-type split (Phase 2); pile-on (Phase 3); changing follows/followers pages or the profile counts.
