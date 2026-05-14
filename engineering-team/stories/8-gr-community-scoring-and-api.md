# Story 8: GR-Community scoring + Communities REST API (Slice 2)

**Status:** Approved
**Created:** 2026-05-14
**Type:** Feature

## Background

The Brainstorm Communities differentiator (PLAN.md §2) is **leaderless self-curation via algorithmic convergence**. The algorithm that makes that work is the **GR-Community scoring system** (PLAN.md §4): a two-gate confidence-weighted GrapeRank variant that computes a membership score in `[0, 1]` for every candidate pubkey, derived from endorsement and veto signals issued by other members.

The system has to defend against two adversaries that the existing global GrapeRank (`src/algos/personalizedGrapeRank/`) doesn't fully cover:

1. **Bots** — non-established accounts that mass-endorse to push someone in. **Gate 1** is the rater's baseline GR influence; a bot with no baseline reputation contributes near-zero weight.
2. **High-reputation outsiders** — well-established accounts who try to vote in a community they don't belong to. **Gate 2** is the rater's community-specific GR influence within this community; an outsider with `community_gr ≈ 0` contributes near-zero weight regardless of baseline.

The weight applied to each rating is the **product** of the two gates: `weight(rater) = baseline_gr(rater) * community_gr(rater)`. Multiplicative gating means both must be non-trivial for a rating to count. Sybil-via-endorsement is exponentially harder than either gate alone.

Slice 2 has two halves:

- **The math.** A pure-function implementation of the GR-Community fixed-point iteration. Deterministic, unit-testable in isolation against synthetic graphs, no I/O. Identifier: `gr-community-default-v1` per PLAN.md §4.
- **The REST contract.** A small set of read-only HTTP endpoints that Slice 3 (Discover) will consume in place of the current mock-data imports in `ui-communities/src/data/mockData.js`. The endpoints query strfry (for community records and endorsement events) and Neo4j (for baseline GR scores), but Slice 2 does not block on real data being present — they return empty/empty-list responses when the data layer is empty so that staging deploys can come up cleanly before any community is created.

Live behavior against real strfry/Neo4j data is deferred to staging smoke per the pattern established in stories #4 / #5 / #7. The math is verifiable offline; the REST shape is verifiable by source/contract test; the live data path is verifiable only on a deployed instance with real community records and endorsement events flowing.

## User-facing description

**As Slice 3** (Discover), I want a REST API that returns the list of communities a viewer's trust network curates, plus per-community member rosters with GR-Community scores, **so that** I can swap `import { communities } from './data/mockData'` for `const communities = await fetch('/api/communities').then(r => r.json())` and stop carrying hand-typed trust counts.

**As an operator** running a mirror relay, I want the GR-Community scoring function to be deterministic, importable, and exercisable from outside the HTTP layer, **so that** I can compute the same membership roster from the same seed set + endorsement stream as any other operator running this codebase — that's the algorithmic-convergence property PLAN.md §2 promises.

**As a future agent** orienting via the Concept Graph API, I want the REST endpoint responses to use the same field names as the firmware schema (PLAN.md §3 / `brainstorm-community/json-schema.json`) so that JSON returned by the API validates cleanly against the schema landed by Slice 1.

## Acceptance criteria

Every criterion is testable from outside the implementation — either by importing the pure function and asserting against deterministic inputs, or by source-grepping the endpoint handlers for the locked contract.

### Pure-function GR-Community scoring

- [ ] A module at a stable path (e.g. `src/algos/grCommunity/computeScores.js`) exports a function with the signature `computeGrCommunityScores({ seeds, endorsements, vetoes, baselineGr, options }) -> Map<pubkey, score>` where:
  - `seeds: string[]` — pubkeys treated as community-GR=1 anchors.
  - `endorsements: Array<{ rater: string, target: string }>` — endorsement events.
  - `vetoes: Array<{ rater: string, target: string }>` — veto events.
  - `baselineGr: Map<string, number> | Record<string, number>` — baseline GR influence in `[0, 1]` for each known pubkey. Pubkeys absent from this map are treated as having baseline 0.
  - `options.maxIterations?: number` (default 60), `options.convergenceThreshold?: number` (default 0.001), `options.weightingModel?: string` (default `'gr-community-default-v1'`).
  - Returns a Map keyed by pubkey, valued by the computed community-GR score `c ∈ [0, 1]`.
- [ ] **Seed members always score 1.** Given any input set where `seeds = [A, B]`, the returned Map has `c(A) === 1` and `c(B) === 1` after one iteration — they're not iterated against, they're fixed.
- [ ] **The two-gate weighting is multiplicative.** Given a rater R with `baselineGr(R) = 0.0` and an endorsement of target T, T's score from R alone is 0 regardless of how the rest of the graph votes. Same for `community_gr(R) = 0.0` once iteration converges. Tested with at least two synthetic graphs that pin this behavior — a "bot endorsement does not lift target" graph and a "high-baseline outsider endorsement does not lift target" graph.
- [ ] **A veto cancels an endorsement of equal weight.** Given two raters R1 (endorse) and R2 (veto) with equal `baseline_gr * community_gr` weights, target T's net rating sums to 0 and the computed score is `<= 0.5` (the default threshold) for that target alone (subject to convergence settling).
- [ ] **The function is pure.** Calling it twice with the same arguments returns equal Maps (no internal state, no Date.now(), no Math.random()). Verified by running the same input twice in a single test and asserting deep-equality of the result Maps.
- [ ] **Convergence terminates.** The function returns within `options.maxIterations` iterations OR earlier once the maximum per-pubkey change between iterations falls below `options.convergenceThreshold`. The returned Map has a non-enumerable `iterations` property (or the function returns `{ scores, iterations }`) so callers can verify convergence happened.
- [ ] **No I/O.** The pure-function module does not import `fs`, `neo4j-driver`, `nostr-tools`, the strfry CLI, or any other I/O surface. Verified by source-grep on the module file.
- [ ] **Identifier registered.** The module exports a constant `WEIGHTING_MODEL_ID = 'gr-community-default-v1'` so callers can reference the algorithm name without re-typing the string. Matches the value PLAN.md §4 commits to and the firmware schema's `weightingModel` default.

### Helpers + classification

- [ ] A helper `isMember(score, threshold)` returns `true` when `score >= threshold` and `false` otherwise. Threshold default is 0.5 per PLAN.md §4.
- [ ] A helper `partitionMembers(scoresMap, threshold)` returns `{ members: pubkey[], nonMembers: pubkey[] }` (the inverse of the score map, sorted by score descending within each bucket). Seeds always appear in `members`.

### Data-source abstraction

- [ ] A module at `src/api/communities/dataSources.js` (or equivalent path) exports four async functions: `loadCommunityRecord(slug, viewerPubkey)`, `loadCommunitiesForViewer(viewerPubkey)`, `loadEndorsementSignals(communityATag)`, and `loadBaselineGrScores(pubkeys)`. Each function returns the empty equivalent (`null`, `[]`, `{}`) when the underlying store is empty or unavailable — they **must not throw** on a fresh deployment with no community records yet.
- [ ] The Neo4j and strfry query layers are isolated behind these four functions, so the REST handlers and the pure scoring function never call `session.run()` or `fetch('http://localhost:7777')` directly.

### REST API surface

- [ ] `GET /api/communities?viewer=<pubkey>` returns `{ success: true, communities: [...] }`. The `communities` array is sorted by `trustedHere` desc (i.e. trust-ranked from the viewer's perspective). Each entry has: `slug`, `name`, `description`, `tags: string[]`, `memberCount: number`, `trustedHere: number`, `activity: string | null`, `accent: string | null`, `members: string[]` (top N member pubkeys for the avatar stack), `joined: boolean` (true if viewer is themselves a member). Empty array on empty data — never 500.
- [ ] `GET /api/communities/:slug?viewer=<pubkey>` returns `{ success: true, community: {...} }` with the same shape as a list entry plus `posts: []` (Slice 6 wires kind-1 feed). 404 with `{ success: false, message: 'Circle not found' }` when no community-record exists for the slug in the viewer's trust network.
- [ ] `GET /api/communities/:slug/members?viewer=<pubkey>` returns `{ success: true, members: [...] }` where each entry has: `pubkey`, `score` (the computed GR-Community score in `[0,1]`), `isMember: boolean`, `vouchedBy: number` (count of endorsements from member raters), `voucherNames: string[]` (top 3 voucher names from the viewer's network — populated when names resolvable, empty array otherwise). Sorted by score desc.
- [ ] When `viewer` query param is absent, the endpoints fall back to **the local Tapestry Assistant pubkey** discovered via `/api/assistant/pubkey` (per AGENTS.md §1) — never hardcoded, never a build-time constant. The fallback is the brainstorm.world TA on the brainstorm.world droplet, the communities-droplet TA on the communities droplet, etc.
- [ ] All four routes are registered in `src/api/index.js` inside the existing `async function register(app)` block, alongside the other `app.get('/api/...')` calls. Registration is additive — no existing routes moved or removed.
- [ ] Each handler has an early-return path when the data layer is empty: returns success with the empty equivalent, **never 500**. A staging deploy on an empty instance must answer all four routes cleanly.

### Auth / privacy

- [ ] The endpoints are **read-only and public** (no `authMiddleware` requirement for v1). This matches PLAN.md §6 Q5.1 ("Discover (no account, full v1)"). The `viewer` query parameter is the only viewer-identity input; absent → fall back to the local TA. **No session cookies, no NIP-07, no signature** required to read. (Writes land in Slice 4 and will require auth.)
- [ ] The fallback to the local TA pubkey reads from the same source used by `src/api/assistant/pubkey.js` (or wherever the assistant module lives) — verified by source-import, not a hardcoded npub.

### OpenAPI documentation

- [ ] `src/api/openapi.yaml` adds path entries for the four new endpoints (`/api/communities`, `/api/communities/{slug}`, `/api/communities/{slug}/members`, plus the data-sources subroutes if any are surfaced). Each path has a brief description, parameter list, and response schema referencing the firmware shape from PLAN.md §3 where applicable. The Swagger UI at `/docs` (per `bin/control-panel.js:248`) renders the new entries without errors.

### Performance shape

- [ ] The pure function completes in `< 50 ms` for synthetic graphs with 200 members and 800 endorsement signals (verified by a benchmark inside the test suite). Per-community sets are bounded; this is the realistic upper bound for v1 communities. **No O(n²) hot paths**; the iteration is O(iterations × |signals|).

### Regression

- [ ] `npm test` continues to pass all existing suites (treasure-maps, scheduled-search, strfry-router-first-boot, per-query-neo4j-timeout, communities-ui-scaffold, firmware-v1.1.0-finalization). Slice 2 adds a new suite; no existing tests should flip.
- [ ] Existing global `src/algos/personalizedGrapeRank/` computation untouched. Slice 2 introduces new code, no modifications to the existing GrapeRank module.

## Concepts touched

- `brainstorm-community` (kind 39998) — read via `loadCommunityRecord` / `loadCommunitiesForViewer`. Handle: `39998:<TA pubkey>:brainstorm-community` after Slice 1 installs.
- `brainstorm-community-signal` (kind 39999) — read via `loadEndorsementSignals`. Handle: `39998:<TA pubkey>:brainstorm-community-signal`.
- `graperank` (kind 39998 from v1.0.0) — `loadBaselineGrScores` reads from the same source as the existing global GR computation (NostrUserWotMetricsCard or equivalent).

Per AGENTS.md §1, all handles construct dynamically from the local TA pubkey — never hardcoded.

## Out of scope

- **Endorsement event publishing.** Slice 4 wires NIP-07 + the kind-39999 write path. Slice 2 only reads signals.
- **kind-1 reads/writes for the Conversation tab.** Slice 6.
- **Caching policy beyond a trivial per-request computation.** A `Map<communityATag, { computedAt, scores }>` with a 60-second TTL is the v1 ceiling; richer cache invalidation (e.g. listen for new endorsement events and recompute) is a future story.
- **Scheduled-task integration.** The existing scheduled-task system at `src/api/scheduled-tasks/` runs heavyweight global GR. Per-community GR runs on-demand; a scheduled job is not warranted at v1 scale.
- **Write endpoints.** No `POST /api/communities`, no `POST /api/communities/:slug/endorse`. Writes land in Slice 4 with NIP-07 auth.
- **NIP-72 wrapping logic.** The schema accepts an optional `nip72Wrapping` field (Slice 1), but Slice 2's REST endpoints don't dereference it; that's a future story when wrapping UX ships.
- **Pagination.** v1 communities are bounded enough (~hundreds of members each, dozens of communities per viewer) that pagination is a premature optimization. If/when it becomes real, that's a separate story.
- **WebSocket / streaming.** Endpoints are plain GET.
- **Server-side i18n on `description` / `name` fields.** The firmware schema has a `language` field per community but the REST response surfaces strings as-is; localization is a post-v1 concern.

## Open questions

Resolved before story approval:

- **In-memory vs file-based computation.** In-memory. Per-community scoring is bounded; persisting scorecards.json files per community per viewer would multiply storage by `|communities| × |viewers|` for a tiny computational win. Trivial 60-second TTL cache covers the realistic load profile.
- **Should `viewer` query param accept npub or hex?** Hex only for v1 (matches the rest of the existing API surface; npub decoding is a UI concern that's already in `ui-communities/` via the eventual nostr-tools dep).
- **What happens if `viewer` is malformed?** Fall back to TA. **Don't 400.** The endpoints are public read-only and we want them to succeed even on bad input from misbehaving clients.
- **Where does `gr-community-default-v1` live in the registry?** PLAN.md §7 has a future "GrapeRank Scoring Systems registry" item. For Slice 2, the identifier is a constant in the algorithm module and the REST layer references it directly. The registry abstraction lands in a future story when there's a second algorithm to register.

## Linked artifacts

- ADR: [`engineering-team/decisions/0006-gr-community-scoring-and-api.md`](../decisions/0006-gr-community-scoring-and-api.md)
- Test plan: [`engineering-team/stories/8-gr-community-scoring-and-api.test-plan.md`](8-gr-community-scoring-and-api.test-plan.md)
- Review: `engineering-team/reviews/8-gr-community-scoring-and-api.md` (filled in by Reviewer)
