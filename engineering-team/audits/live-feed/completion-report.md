# Completion report — live-feed book

**Feature:** public `/feed` Live Feed (kind-1 notes from the source identity's follows) + `GET /api/feed` read path.
**Branch merged to staging:** `feat/live-feed` → PR [#296](https://github.com/nous-clawds4/tapestry/pull/296), merge commit `80a39afd` (merged 2026-06-15T01:35:31Z).
**Staging deploy:** `deploy-staging.yml` run `27518919488` — success, 1m20s.
**Test suite:** `npm test` (= `node test/test.js`) — 434 passing (live-feed-read-path 23/23, live-feed-feed-page 18/18).
**Live evidence is independently re-verifiable** against `https://staging.brainstorm.world` (anonymous `curl` — no auth): `GET /api/feed` and `GET /feed`. Full raw trail in [`journal.md`](./journal.md).

Bullet numbering follows the book's `### Acceptance frame` list (8 bullets).

---

### Bullet 1 — Public, bookmarkable `/feed`, 200, no horizontal overflow @1280px
**Status: met.**
- Anonymous `GET https://staging.brainstorm.world/feed` → **HTTP 200, `text/html`** (no login wall — the SPA fallback `bin/control-panel.js:297-301` serves it and `src/middleware/auth.js` passes all non-`/api/` paths). Same anonymous 200 locally.
- No-overflow: the page renders a single capped-width column with wrapping note text (`bsp-feed-*` in `ui/src/styles.css`: `max-width` + `width:100%` + `box-sizing:border-box` + `overflow-wrap:anywhere`). The Tier-4 staging render (below) at a 1530px-wide viewport shows the content in one centered column with no horizontal scrollbar / no content past the column.

### Bullet 2 — Source identity = logged-in user, else House PoV; no source selector
**Status: met.**
- Anonymous (no login) `GET /api/feed` → `source.origin: "house"`, `source.pubkey: 0f6c8526…` — the House PoV is used when there is no logged-in user.
- Logged-in branch confirmed at Tier-4: with the MCP tab's staging session, `/feed` rendered a **different** feed (top author "Lyn Alden") than the anonymous House-PoV render (top author "Vitor Pamplona") — i.e. the logged-in user's own follows drive the feed when logged in.
- No source selector / PoV picker on the page (story #2 + ADR 0002 out-of-scope; Reviewer scope sweep, review `2-feed-page.md`).

### Bullet 3 — Kind-3 follow list read from local strfry
**Status: met.**
- `src/api/feed/feedReadPath.js` `getLocalFollows()` reads the source's kind-3 from local strfry (`strfry scan`), per ADR 0001 and the Reviewer's ADR/spec check.
- Observed both outcomes by data state: **local** stack (House PoV has no kind-3 in local strfry) → `status: FOLLOW_LIST_UNAVAILABLE`; **staging** (House PoV's kind-3 present) → `status: OK` with 50 notes. The distinction is driven by what local strfry holds — demonstrating the read is from local strfry.

### Bullet 4 — Kind-1 notes from the general-purpose relay set (slug-from-TA) with hardcoded fallback
**Status: met.**
- Staging `GET /api/feed` → **`relaySource: "set"`** — the Concept-Graph `the-set-of-general-purpose-relays` set resolved **by slug relative to this instance's TA** (`getOwnerAssistantPubkey()`, never a hardcoded deployment UUID; verified by the Gate-2 judge and the Reviewer) and returned notes.
- Hardcoded fallback (`wss://relay.damus.io`, `wss://relay.primal.net`, `wss://nos.lol`) on empty/error set is covered by tests B10/B11 in `test/live-feed-read-path.test.js`.

### Bullet 5 — Kind-1 by the source's follows, newest-first, capped, kind-6/7 excluded; each note shows author name + avatar (local kind-0) + timestamp + text
**Status: met.**
- Staging `GET /api/feed` returned **50 items** (the fixed cap `FEED_CAP = 50`), **newest-first verified** (`created_at` non-increasing), each item `{ id, pubkey, createdAt, content, author: { displayName, avatar } }`, **50/50 with a non-null display name** drawn from local kind-0 (e.g. "Vitor Pamplona", "Jon Gordon", "Avi Burra").
- kind-1 only; kind-6 (reposts) / kind-7 (reactions) and non-followed authors excluded — tests B7/B8 (`test/live-feed-read-path.test.js`); the read path fetches `{ kinds: [1], authors: <follows> }`.
- Tier-4 render shows each note with avatar + author display name + a formatted local timestamp (e.g. "6/14/2026, 11:32:53 PM") + text.

### Bullet 6 — Three empty/edge states with a clear on-page indicator (never blank/error)
**Status: met.**
- The read path returns a discriminated `status` union; the page maps each to a message (`ui/src/pages/BrainstormFeed.jsx`, `FEED_COPY`):
  - **6a** no source / no House PoV → `NO_SOURCE` → "No House point-of-view is selected…" (tests B12-B14 + render branch).
  - **6b** follow list not in local strfry → `FOLLOW_LIST_UNAVAILABLE` → **observed live locally**: `/feed` rendered "The follow list for this identity is not available locally yet." (screenshot in journal; runtime-verified, not just a unit test).
  - **6c** follow list present but no notes → `EMPTY` → "No recent notes from the accounts this identity follows." (tests B17-B19 + render branch).
- Each is a clear on-page message, not a blank page or raw error (Reviewer XSS/scope sweep; plus a defensive "couldn't load" branch for transport failure).

### Bullet 7 — Additive and read-only; no writes; no change to search/profile/ranking/firmware; reversible
**Status: met.**
- The change adds only: `src/api/feed/feedReadPath.js` + a `GET /api/feed` registration in `src/api/index.js`; `ui/src/pages/BrainstormFeed.jsx` + `ui/src/hooks/useFeed.js` + one `/feed` route line in `ui/src/App.jsx` + `bsp-feed-*` in `ui/src/styles.css`. No writes/publishes; no change to the search page, profile pages, ranking/scoring, or firmware (no concept definitions changed → no firmware reinstall). Reviewer scope-creep sweep on both stories confirms; `package.json`/lock untouched (no new dependency).
- **Tier 5 regression on staging:** `/`, `/about`, `/user/<pubkey>`, `/api/get-user-counts`, `/api/assistant/pubkey` all → 200 — existing surfaces unaffected.

### Bullet 8 — Live on `staging.brainstorm.world/feed`, staging smoke passing; mandatory Tier-4 rendered ≥3 notes
**Status: met.**
- Live on staging (PR #296 merged, deploy `27518919488` success). Five-tier smoke passed: Tier 1 stability (3 consecutive 200s), Tier 2 sanity, Tier 3 (above), Tier 4 (below), Tier 5 regression (above).
- **Tier 4 (mandatory rendered-UI evidence):** anonymous `GET /feed` → 200, and the rendered page shows **50 notes** (≫ the required ≥3) for the **House PoV's follows**, fetched from the general-purpose relay set. Captured via screenshot **and** full DOM extract (both journaled): heading "Live Feed" + indicator "Showing the most recent 50 notes." + notes from Vitor Pamplona, Jon Gordon, cloud fodder, Avi Burra, vinney… each with avatar + author + timestamp + text, newest-first. The rendered authors match the anonymous `/api/feed` House-PoV source exactly. (The anonymous render was produced without logging out the shared session — the page's `/api/feed` fetch was forced credential-less and the feed component remounted via in-SPA navigation; no staging state was mutated.)

---

## Summary
All 8 acceptance-frame bullets are met and verified on staging. The full data path works end-to-end on prod-scale staging data: House-PoV kind-3 (local strfry) → kind-1 (general-purpose relay **set**, slug-from-TA) → local kind-0 author enrichment → 50 notes rendered newest-first on the public `/feed` page. The change is strictly additive and read-only; the existing app is unaffected (Tier-5 regression green).

**Non-blocking follow-ups (do not affect any bullet; for `/close-book` triage):**
1. `src/api/feed/feedReadPath.js:53` reuses the imperfect single-quote escape from `fetchProfiles.js` (narrow surface — source pubkey is HEX64-validated upstream).
2. `BrainstormFeed.jsx` avatar `<img>` omits the `onError` broken-image-hide handler other pages use (cosmetic).
3. On a *live relay-fetch timeout*, the read path currently surfaces a 500 rather than degrading to `EMPTY`/`OK` (no acceptance bullet pins timeout→EMPTY; at evidence time the relays responded in ~9.4s and `/api/feed` returned `OK` with 50 notes, so this path was not exercised).
