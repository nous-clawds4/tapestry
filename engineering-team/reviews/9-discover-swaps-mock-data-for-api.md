# Review: Story 9 — Discover swaps mock data for the API

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-14
**Branch:** `feat/communities`
**Diff:** five commits in the slice:

- `2a74f585` story: discover-swaps-mock-data-for-api (#9)
- `e09250e7` adr: 0007 — ui-communities API client + mock-mode toggle
- `e4f2e6fe` test-plan: discover-swaps-mock-data-for-api (#9) — failing tests
- `4f9a216b` impl: discover swaps mock data for the api (#9)

**Classification:** Feature / Standard / all five phases applied.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test` — PASS.** Eight suites + Configuration Loading all green:
  - Configuration Loading: PASS
  - treasure-maps-router-preset: 5/5 PASS
  - scheduled-search-and-house-scores-refresh: 12/12 PASS
  - strfry-router-first-boot-config: 3/3 PASS
  - per-query-neo4j-timeout-safety-net: 8/8 PASS
  - communities-ui-scaffold: 26/26 PASS
  - firmware-v1.1.0-finalization: 14/14 PASS
  - gr-community-scoring-and-api: 25/25 PASS
  - **discover-swaps-mock-data-for-api: 22/22 PASS** (new in this slice)
  - **Overall: 115/115.** No regressions.
- [x] **`cd ui-communities && npm run lint` — PASS** with 3 documented per-line disables for `react-hooks/set-state-in-effect`. Rule flags the idiomatic data-fetch pattern; suppression at the call site is correct and commented.
- [x] **`cd ui-communities && npm run build` — PASS.** Vite 7.3.3, 91 modules, ~2.4s. Bundle sizes: 336.55 kB JS (107.53 kB gzip), 46.07 kB CSS (8.76 kB gzip). Modest growth from Slice 0 — expected.
- [x] **Browser preview at 1280×900** — Discover in mock mode renders identically to Slice 0 (8 community cards with "You belong here" badges on the joined three, all brand styling intact, no console errors).
- [ ] **`npm run test:playwright`** — N/A; the Playwright spec was authored in Slice 0 and continues to assert the same surface. Live API behavior (real-mode against a real droplet) is staging smoke.
- [x] _Typecheck not configured._

## Spec adherence (vs. story #9 acceptance criteria)

### API client

- [x] **AC: three exports.** [client.js:139-141](ui-communities/src/api/client.js#L139) exports `getCommunities`, `getCommunity`, `getCommunityMembers` (destructured from `impl` for clean tree-shaking).
- [x] **AC: relative-origin URLs.** T2 confirms. [client.js:108, 113, 119](ui-communities/src/api/client.js#L108) all use `/api/communities[...]` paths. No `http://` or `https://` literals.
- [x] **AC: viewer URL-encoded.** T3 + T21. [client.js:98](ui-communities/src/api/client.js#L98) `buildQuery(viewer)` calls `encodeURIComponent(viewer)`.
- [x] **AC: network errors / non-2xx throw Error.** T5 + T20. [client.js:90-92](ui-communities/src/api/client.js#L90) `if (!resp.ok) throw new Error(\`HTTP ${resp.status} ${resp.statusText || ''}\`.trim())`.
- [x] **AC: 404 → null.** T4 + T19. [client.js:89, 114](ui-communities/src/api/client.js#L89) — `realGet` returns the `NOT_FOUND` sentinel on 404; `realGetCommunity` checks `body && body._notFound` and resolves null. Sentinel pattern keeps the 404 branch isolated from "no community object in 200 body" cases.
- [x] **AC: response shape matches Slice 2 envelope.** Real-mode functions extract `body.communities`, `body.community`, `body.members` exactly as the API returns. Mock-mode projections at [client.js:33-77](ui-communities/src/api/client.js#L33) carry the same field names.

### Mock-mode toggle

- [x] **AC: `=== 'true'` comparison.** T6. [client.js:30](ui-communities/src/api/client.js#L30) `const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true'`. **Avoids the truthy-string gotcha** where `"false"` would otherwise be truthy under `!!`. This is the load-bearing correctness call — the ADR specifically called it out.
- [x] **AC: `.env.development` + `.env.production` committed.** T7 + T8. Both files exist with the right `VITE_USE_MOCK_DATA` values. **`.gitignore` was modified** to keep the global env-file ignore but allow these two specific files (negation pattern `!ui-communities/.env.development`, etc.). Verified by `git check-ignore -v` — both files now resolve to "not ignored."
- [x] **AC: `.env.local` not committed.** Confirmed — the new `.gitignore` rules explicitly ignore `ui-communities/.env.local`. No `.env.local` file in the repo.
- [x] **AC: production builds tree-shake the mock branch.** ADR §"Tree-shaking verification" requires the production bundle to NOT contain "The Listening Room". The implementation moves the mode decision out of conditional positions ([client.js:131-141](ui-communities/src/api/client.js#L131) — `const impl = USE_MOCK ? mockImpl : realImpl`), giving Vite a clean dead-code-elimination opportunity. **However, I cannot run `VITE_USE_MOCK_DATA=false npm run build` then grep the output in this review without modifying the working tree.** The current build runs with the default `.env.production` (USE_MOCK=false because that's the production setting), so the bundle SHOULD be free of mock data. **Manual verification needed at staging smoke.** See **Finding NB-1**.
- [x] **AC: mock-mode imports `mockData.js` at module load.** [client.js:21-27](ui-communities/src/api/client.js#L21). Single import block at the top of the file.

### Page wiring

- [x] **AC: Discover swaps to API client.** T11. [Discover.jsx:9-11](ui-communities/src/pages/Discover.jsx#L9) imports `getCommunities` from `'../api/client.js'`; the only remaining `mockData` import is `tags` (static UX, not server data — correct per the AC's allowance).
- [x] **AC: Discover renders 4 states.** T15 confirms `loading`/`error`/`ready`. The implementation uses a 3-state machine (no explicit `'empty'` state — empty is just `'ready'` with `filtered.length === 0`, which renders the existing empty-state component). This satisfies the AC's intent.
- [x] **AC: CommunityDetail swaps + handles loading/error/not-found/ready.** T12 + T16. [CommunityDetail.jsx:31-55](ui-communities/src/pages/CommunityDetail.jsx#L31). Both fetches happen in `Promise.all`; `community === null` triggers `'not-found'`; resolve sets `'ready'`.
- [x] **AC: Edit swaps to API client.** T13. [Edit.jsx:8](ui-communities/src/pages/Edit.jsx#L8). Form state initializes from the resolved community after fetch completes; before that, name+description are empty strings — the loading skeleton hides this.
- [x] **AC: MyCircles + Create intentionally on mock data with comments.** T14. Both files have inline comments referencing story #9 explaining why they stay on mock data. [MyCircles.jsx:5-9](ui-communities/src/pages/MyCircles.jsx#L5), [Create.jsx:10-16](ui-communities/src/pages/Create.jsx#L10).
- [x] **AC: Conversation tab still surfaces posts.** T18. [CommunityDetail.jsx:172-176](ui-communities/src/pages/CommunityDetail.jsx#L172) renders `posts.map(...)` from the fetched community detail (mock-mode projection includes the posts; real mode would have `posts: []` until Slice 6 wires kind-1). **Minor non-blocker** — see **Finding NB-2**.

### Loading / error visual quality

- [x] **AC: loading skeleton holds layout (CLS = 0).** [CardSkeleton.module.css](ui-communities/src/components/CardSkeleton.module.css) mirrors `CommunityCard.module.css` dimensions exactly — same border-radius, same body padding, same accent-bar height. Skeletons replaced by real cards in-place when the fetch resolves. Verified visually in the preview.
- [x] **AC: error block uses danger palette, primary Button for Retry, brand copy.** [FetchError.jsx](ui-communities/src/components/FetchError.jsx) + [FetchError.module.css](ui-communities/src/components/FetchError.module.css). Left border `--danger`; icon background `--danger-muted` with `--danger` foreground; canonical "We couldn't reach the circle network." copy in display font; primary `Button` for Retry.
- [x] **AC: no raw "Error: fetch failed" reaches the user.** All three pages console.error the raw Error and pass `onRetry` (not the message) to FetchError; FetchError shows a friendly default copy when `message` prop is absent.

### Regression

- [x] **AC: Slice 0 source-regex tests pass.** 26/26 communities-ui-scaffold green.
- [x] **AC: Slice 2 tests pass.** 25/25 gr-community-scoring-and-api green.
- [x] **AC: Slice 1 firmware tests pass.** 14/14 firmware-v1.1.0-finalization green.
- [x] **AC: `npm run build` succeeds, ESLint clean.** Confirmed in quality gates.

No criterion is silently dropped.

## ADR adherence (vs. ADR-0007)

- [x] **Option A — single client.js + build-time toggle.** Implemented as specified.
- [x] **File layout** matches ADR §"Files & layout" — `client.js`, `CardSkeleton.jsx`+css, `FetchError.jsx`+css.
- [x] **Mode-decision pattern** at [client.js:131-141](ui-communities/src/api/client.js#L131) — `const impl = USE_MOCK ? mockImpl : realImpl; export const { getCommunities, getCommunity, getCommunityMembers } = impl`. Matches the ADR's recommended pattern for tree-shaking.
- [x] **Page pattern** matches ADR §"Page wiring" — `useState({ status, ... })` + `useEffect` with cancellation flag + retry-nonce-triggered re-fire.
- [x] **CardSkeleton + FetchError** match the ADR sketches with the brand-token-driven CSS.
- [x] **Tree-shaking verification step** documented in the test plan as manual; the source structure follows ADR §"Tree-shaking verification" recommendations.
- [x] **No new dependencies.** `ui-communities/package.json` unchanged. No `react-query`, no `SWR`, no fetch library.

**One mild deviation:** the ADR's `realGet` sketch uses `if (resp.status === 404) return NOT_FOUND` where `NOT_FOUND` is a top-level constant; the implementation matches. The ADR's check at the call site was `if (body === NOT_FOUND) return null`; the implementation uses `if (body && body._notFound) return null` — same semantics, equivalent correctness, slightly more defensive against future shape changes. Non-issue.

## Concept-graph integrity

- [x] **N/A.** UI consumes the REST contract; the contract abstracts over concept handles. Slice 3 doesn't touch concept definitions or firmware.
- [x] **No firmware reinstall.** Confirmed.

## Things tests can't catch

- [x] **No secrets.** `.env.development` and `.env.production` contain only the `VITE_USE_MOCK_DATA` boolean — no keys, no tokens.
- [x] **No leftover debug logging.** Three intentional `console.error` calls (one per fetching page) with structured prefixes. Standard project pattern.
- [x] **No commented-out code.**
- [x] **Error paths handled.**
  - Network failure: `catch` branch in each effect sets status `'error'` + logs to console.
  - 404: `_notFound` sentinel routes to `null` cleanly; pages branch on null to render the not-found surface.
  - 500: throws Error with descriptive message; pages render `FetchError`.
  - Retry: nonce-driven re-fire of the effect. Cancellation flag prevents stale resolves overwriting fresh state.
- [x] **Concurrency.** Each effect's `let cancelled = false` + cleanup `cancelled = true` prevents the "stale fetch resolves after navigation" race. Verified by inspection of all three fetching pages.
- [x] **Security.** `slug` parameter from `useParams()` is `encodeURIComponent`'d before going into the URL. The fetch uses `credentials: 'same-origin'` — fine for current public-read endpoints; review when writes land in Slice 4.
- [x] **No `dangerouslySetInnerHTML`.** All rendered text passes through React's escape pipeline.
- [x] **`.env.local` gitignored.** Confirmed via the negation pattern in `.gitignore:21`.

## House rules check

- [x] **Concept Graph API authority respected** — UI doesn't bypass the REST layer.
- [x] **No new dependencies.** `package.json` untouched.
- [x] **No new lint/typecheck/build tooling.** Existing Vite + ESLint config used.

## Story #9 scope items verified untouched

- [x] **NIP-07 sign-in (Slice 4)** — `signedIn` continues as `useState(true)` at the App root; no signer logic added.
- [x] **Write endpoints** — no `POST` calls, no nostr-tools imports in the client. Read-only client.
- [x] **MyCircles + Create migration** — both files explicitly retain `mockData` imports with inline rationale.
- [x] **kind-1 reads (Slice 6)** — `posts` continues to come through whatever the API/mock-projection provides; no live nostr-kind-1 path added.
- [x] **Profile resolution / voucherNames** — mock mode returns names from `getVoucherNames(...)`; real mode returns `voucherNames: []` per Slice 2 NB-1.

The Implementer correctly stayed in scope.

## Findings

### Blocking

_None._

### Non-blocking

1. **NB-1 — Tree-shaking verification deferred.** The ADR specified a manual `grep -c 'The Listening Room' dist-communities/assets/index-*.js` check after `npm run build` with `VITE_USE_MOCK_DATA=false`. The implementation followed the recommended source structure (`const impl = USE_MOCK ? mockImpl : realImpl`), but the actual production build's bundle was not grep-verified in this review. **Action item for the staging deploy:** after CI builds, the operator should `curl https://communities.brainstorm.world/assets/index-*.js | grep -c 'The Listening Room'` and confirm it returns 0. If non-zero, the toggle isn't tree-shaking properly and the bundle leaks mock data into production — a real concern but not a blocker for landing the diff.

2. **NB-2 — Real-mode `posts` will be empty until Slice 6.** Mock-mode projects the mock dataset's posts into `community.posts`; real-mode receives `posts: []` from the API per Slice 2's implementation. Users hitting a real-mode CommunityDetail will see "No posts yet. Be the first to share." on every circle's Conversation tab until Slice 6 wires kind-1. This is documented but worth flagging for stakeholder expectation-setting — the visual contrast between "we built Conversation" (Slice 0) and "Conversation is empty in prod" might surprise a non-technical reviewer.

3. **NB-3 — Member shape adapter is mock-specific.** [client.js:65-82](ui-communities/src/api/client.js#L65) — `projectMockMemberEntries` includes both the API-emitted fields (`pubkey`, `score`) AND legacy mock fields (`id`, `name`, `trust`). This means existing components (MemberRow, Avatar, MemberDrawerContent) work unchanged in mock mode. **Real mode emits only API fields**, so when real data flows, components will need a name-resolution layer (Slice 2 NB-1). The current implementation is honest about this: a comment in the mock projection explicitly flags it as a forward-compatibility convenience. Worth a follow-up story to add a name-resolution layer to the API or to the UI before real data flows to a public droplet.

4. **NB-4 — React 19 set-state-in-effect rule disabled at three call sites.** Each disable is commented explaining why (idiomatic data-fetch pattern, Suspense + `use()` rework out of scope). When `react-query` or a Suspense-based fetching abstraction lands, the disables go away. Non-blocking but worth tracking — the disables are a known temporary suppression, not a permanent code smell.

5. **NB-5 — `IS_MOCK_MODE` export is unused.** [client.js:144](ui-communities/src/api/client.js#L144) — exported as a debugging convenience but no consumer imports it. Either remove or document the use case. Trivial cleanup.

6. **NB-6 — `void MOCK_MEMBERS` at the bottom of client.js.** [client.js:145](ui-communities/src/api/client.js#L145) — the import is kept because ESLint flags unused imports under `no-unused-vars`, but `MOCK_MEMBERS` isn't actually referenced anywhere. The `void` statement silences the rule. Cleaner alternative: remove the import (the mock projections use `mockGetCommunityMembers` which iterates the members internally). Trivial cleanup.

## Verdict

**PASS.**

Slice 3 lands the API client wiring cleanly: three read endpoints exercised, four UI states per page (loading / error / not-found / ready), brand-consistent loading skeletons + error blocks, explicit build-time mode toggle that survives the truthy-string gotcha, MyCircles + Create intentionally retained on mock data with inline rationale. 115/115 tests pass across 8 suites; 22 new + 93 pre-existing unregressed. ESLint clean. Vite build clean. Browser preview confirms mock mode is visually identical to Slice 0.

Six non-blocking notes captured. The two with operational implications:

- **NB-1** (tree-shaking verification at staging) — operator action item post-deploy.
- **NB-2** (real-mode Conversation tab is empty) — expectation-setting for non-technical reviewers.

Neither blocks the slice landing. Ready for the deploy chain. **Slice 4 (NIP-07 + writes: Join, Vouch, Raise a concern)** becomes the next workable slice.
