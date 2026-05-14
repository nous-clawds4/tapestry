# ADR 0006: GR-Community scoring algorithm + REST API layering

**Status:** Accepted
**Date:** 2026-05-14
**Story:** `engineering-team/stories/8-gr-community-scoring-and-api.md`

## Context

Story #8 lands two things: the **GR-Community scoring algorithm** (PLAN.md §4) and the **read-only REST API** that Slice 3 will consume. The algorithm is a two-gate confidence-weighted GrapeRank variant tailored for community membership. The REST layer queries strfry + Neo4j through a thin abstraction so handlers stay testable.

Relevant facts:

- **Existing global GR** at `src/algos/personalizedGrapeRank/calculateGrapeRank.js` is heavyweight: file-based scorecards under `/var/lib/brainstorm/algos/personalizedGrapeRank/tmp/`, multi-step shell script, scheduled task in `src/api/scheduled-tasks/`. Designed for ~2.6M-profile global scoring (per OPERATIONS.md §5).
- **Per-community scoring is bounded** (~hundreds of members per community per viewer). PLAN.md §6 Q5 commits to 3-5 seed communities at launch. The scaling profile justifies a different design: in-memory, on-demand, lightweight TTL cache.
- **The existing `@graperank/calculator` dep** (`package.json:43`) provides a calculator class via `src/algos/importedGrapeRankEngine/calculateFromLibrary.js`. Reading it briefly: it's general-purpose but file/JSON-config-driven. Adopting it for per-community work would force the same heavyweight assumptions onto the new code path.
- **Route registration** in `src/api/index.js:92-` is a single `async function register(app)` block. Adding `app.get('/api/communities')` and three siblings is mechanical, matches existing patterns (`app.get('/api/lists/...')`, `app.get('/api/grapevine/...')`).
- **TA pubkey resolution** uses `getOwnerAssistantPubkey()` from `src/utils/assistantKeys.js`, surfaced via `GET /api/assistant/pubkey` (`src/api/index.js:463`). Slice 2 must use this same source for the viewer-fallback path; no hardcoded pubkey.
- **Concept graph integration**: Once Slice 1 firmware lands, `brainstorm-community` nodes exist in Neo4j as kind-39998 concept-headers + their kind-39999 schemas as core nodes. Endorsement signals live in strfry as kind-39999 events tagged with `a` = community a-tag and `p` = target pubkey. The data-source layer reads from these stores.
- **No running local stack.** Implementation lands without live data; live behavior is staging smoke. Therefore the data-source layer must return empty-when-empty without throwing — staging deploys on fresh databases must answer `GET /api/communities` with `{ success: true, communities: [] }`, not 500.

Constraints we must honor:

- **No new lint/typecheck/build tooling** beyond what already exists (CLAUDE.md house rule).
- **The existing global GR computation stays untouched** — Slice 2 introduces a new code path, doesn't refactor the old one.
- **The pure-function scoring module must not import any I/O** — keeps it offline-testable + reusable from CLI / scripts / etc.
- **Convergence must be empirically demonstrated**, not just asserted — tests run the algorithm against synthetic graphs with known steady-state scores.

## Options considered

### Option A — In-memory per-request scoring + thin data-source abstraction (chosen)

1. **Algorithm module** at `src/algos/grCommunity/`:
   - `computeScores.js` — pure function `computeGrCommunityScores({ seeds, endorsements, vetoes, baselineGr, options })` → `{ scores: Map<pubkey, number>, iterations: number }`.
   - `twoGate.js` — helper `twoGateWeight(rater, baselineGr, communityGr)` → `number`.
   - `index.js` — re-exports + the `WEIGHTING_MODEL_ID` constant.
   - No imports of `fs`, `nostr-tools`, `neo4j-driver`, or any other I/O surface.
   - The fixed-point iteration:
     ```
     init: c[p] = 1 for p in seeds, c[p] = 0 otherwise
     for iter in 1..maxIterations:
       for each non-seed p:
         numerator = sum over raters r endorsing p:
                       baselineGr[r] * c[r] * (+1)
                   + sum over raters r vetoing p:
                       baselineGr[r] * c[r] * (-1)
         denominator = sum over raters r rating p:
                         baselineGr[r] * c[r]
         c_new[p] = denominator > 0 ? clamp(numerator / denominator, 0, 1) : 0
       if max |c_new[p] - c[p]| < convergenceThreshold: break
       c = c_new
     return { scores: c, iterations: iter }
     ```
   - **Self-ratings excluded** per standard GR practice (PLAN.md §4 "Self-endorsement — excluded").
   - **Veto magnitude symmetric to endorse** for v1 (PLAN.md §4 calibration item, default ±1).
2. **Data-source layer** at `src/api/communities/dataSources.js`:
   - `loadCommunityRecord(slug, viewerPubkey)` — queries Neo4j for the kind-39999 ListItem with matching `d`-tag from the viewer's network. Returns `null` when not found.
   - `loadCommunitiesForViewer(viewerPubkey)` — queries Neo4j for all community-records reachable through the viewer's trust network. Returns `[]` on empty.
   - `loadEndorsementSignals(communityATag)` — queries strfry for `{ kinds: [39999], '#a': [communityATag] }`. Returns `[]` on empty.
   - `loadBaselineGrScores(pubkeys)` — queries Neo4j for the existing GR scores on `NostrUserWotMetricsCard` (same source the global GR uses). Returns `{}` on empty.
   - Each function wraps its query in `try/catch` and returns the empty equivalent on **any** error (logs the error at WARN level for operator visibility). This is the load-bearing "never 500 on fresh deploy" property.
3. **REST handlers** at `src/api/communities/{list,detail,members}.js`:
   - Thin orchestration: resolve viewer (`req.query.viewer || getOwnerAssistantPubkey()`), call the appropriate data-source functions, call `computeGrCommunityScores` if scores are needed, shape the JSON, return.
   - Each handler has a `try/catch` outer wrap that 500s only on truly unexpected failures (e.g., assistant key not configured at all); the normal empty-data path returns 200 with the empty equivalent.
4. **Trivial in-process cache** keyed by `<communityATag>:<viewerPubkey>` with a 60-second TTL. Stored as a `Map` at module scope. No persistence; cache cold-starts on each process boot. Eviction on size > 200 entries (FIFO).
5. **Route registration** in `src/api/index.js`:
   ```js
   const communitiesApi = require('./communities');
   // ... inside register(app):
   app.get('/api/communities', communitiesApi.handleList);
   app.get('/api/communities/:slug', communitiesApi.handleDetail);
   app.get('/api/communities/:slug/members', communitiesApi.handleMembers);
   ```
6. **OpenAPI docs** in `src/api/openapi.yaml` — four new path entries under `paths:`, mirroring the response shape from the firmware schema.

**Pros:**
- Pure-function algorithm is offline-testable. Synthetic-graph tests give us correctness guarantees without a running stack.
- Data-source abstraction means Slice 4 (writes) can plug in event-publishing logic alongside the read functions without touching the scoring math.
- The "empty-when-empty, never 500" property means staging deploys come up clean before any community exists.
- No new dependencies; no new tooling; matches existing API-registration patterns exactly.
- Per-community computation is fast enough (< 50 ms for 200-member synthetic graphs in unit tests) that lazy on-request computation works — no scheduled-task complexity required.

**Cons:**
- Cache TTL is dumb (no invalidation on new endorsement events). For v1, fine; if endorsement traffic grows, a smarter cache becomes a real story.
- Hand-implementing the GR math instead of reusing `@graperank/calculator` is duplication. But the existing library is JSON-config-driven and assumes file persistence; adapting it to per-community in-memory work would be more code than the math itself.

### Option B — Reuse `@graperank/calculator` + persist per-community scorecards.json

Adopt the existing `@graperank/calculator` package. For each (community, viewer) pair, write `scorecards.json` files into `/var/lib/brainstorm/algos/grCommunity/<slug>/<viewer>/` and reuse the existing file-based pipeline.

**Pros:**
- DRY with the existing global GR pipeline.
- Battle-tested calculator code path.

**Cons (why rejected):**
- Storage explodes by `|communities| × |viewers|`. For 5 launch communities × 1000 active viewers = 5000 directories of scorecards. Per-viewer scoring is what makes it personalized; per-viewer file persistence is what makes it untenable.
- The existing calculator is config-driven; adapting it to two-gate weighting requires plumbing options through layers that weren't designed for them.
- File I/O dominates the latency for a sub-50ms computation, defeating the on-demand model.
- Tighter coupling to `/var/lib/brainstorm/` makes the algorithm impossible to test offline.

### Option C — Background scheduled task that recomputes every community every N minutes

A scheduled task in `src/api/scheduled-tasks/` recomputes all known communities for the canonical viewer (TA pubkey) every N minutes; stores scorecards in Redis or Neo4j; the REST endpoints become pure reads from the cache.

**Pros:**
- Fast endpoints (constant-time reads).
- Predictable resource usage.

**Cons (why rejected):**
- Doesn't personalize per viewer — the viewer's trust network is the input to community-GR (gate 2). A pre-computed-for-TA-only model only serves the anonymous-visitor view; signed-in users get the same view as anonymous ones, which defeats half the differentiator.
- Adds scheduler complexity for a non-problem (v1 communities are bounded).
- Premature optimization. Add a scheduled job only when on-demand starts to hurt — currently it doesn't, because there are no communities.

## Decision

We chose **Option A**.

The algorithm is straightforward enough to hand-implement; the math is testable in isolation; and the bounded scale (per-community sets in the hundreds) makes the on-demand model practical for v1. The data-source abstraction keeps the live-data wiring small and replaceable. The "empty-when-empty, never 500" property is critical for staging coming up cleanly on a fresh droplet.

We trade away: future flexibility (no scheduled-task pre-computation, no smart cache invalidation). We accept this because v1 doesn't need either — the realistic load is "Slice 3 fetches the community list a handful of times when a viewer browses Discover."

## Consequences

- **Enables:** Slice 3 can immediately code against `/api/communities` and swap the mock-data import. Slice 4 (writes) plugs the publish path into the existing data-source layer.
- **Constrains:** Cache invalidation is naive. If endorsement traffic grows past TTL boundaries, viewers may see stale scores for up to 60 seconds. Acceptable for v1.
- **New debt:** Possible future "scheduled per-community recompute" story if Slice 4+5 land and we see real load. The current architecture supports adding it later without rewriting; the scheduled job would just call into the existing data-source layer + scoring module.
- **Firmware reinstall required?** No. Slice 2 doesn't change concept definitions. Slice 1 already activated v1.1.0; this slice consumes that activation.

## Implementation notes

The Implementer reads this section.

### Files & layout

```
src/algos/grCommunity/
├── index.js          — re-exports: computeGrCommunityScores, twoGateWeight, isMember, partitionMembers, WEIGHTING_MODEL_ID
├── computeScores.js  — the pure-function implementation
├── twoGate.js        — twoGateWeight helper
└── classify.js       — isMember + partitionMembers helpers

src/api/communities/
├── index.js          — module export: { handleList, handleDetail, handleMembers }
├── dataSources.js    — loadCommunityRecord, loadCommunitiesForViewer, loadEndorsementSignals, loadBaselineGrScores
├── cache.js          — trivial TTL cache (60s, 200-entry FIFO eviction)
├── list.js           — handleList implementation
├── detail.js         — handleDetail implementation
└── members.js        — handleMembers implementation

test/gr-community-scoring-and-api.test.js — new Node-runner suite
```

### `src/api/index.js` registration

Insert in alphabetical position alongside other route groups (between `community` and `concept-graph` alphabetically, which puts it after `bulk-ingest` / before `concept-graph` calls if such ordering is preserved):

```js
const communitiesApi = require('./communities');
// ... inside register(app):
app.get('/api/communities', communitiesApi.handleList);
app.get('/api/communities/:slug', communitiesApi.handleDetail);
app.get('/api/communities/:slug/members', communitiesApi.handleMembers);
```

No auth middleware on these routes — they're public read.

### Data-source contract

Each function in `dataSources.js`:
1. Wraps its underlying query in `try/catch`.
2. On catch: `console.warn('[communities/dataSources] <function> failed:', err.message); return <empty>` where `<empty>` is `null` / `[]` / `{}` per the function's return type.
3. Documented at the top of the module: "All functions return the empty equivalent on any error so the REST handlers can always succeed on fresh deploys."

`loadEndorsementSignals(communityATag)` returns an array of `{ rater: hexPubkey, target: hexPubkey, type: 'endorse'|'veto' }`. The function reads kind-39999 events from strfry, filters to `#a = [communityATag]`, parses each event's `p` tag (target) + `type` tag (default `'endorse'` per PLAN.md §3 / firmware schema), and yields rater = event author. The strfry CLI call (or its node binding) is encapsulated here; the rest of the codebase doesn't know strfry exists.

### Pure-function scoring contract

`computeGrCommunityScores({ seeds, endorsements, vetoes, baselineGr, options })`:
- Returns `{ scores: Map<string, number>, iterations: number }`.
- `seeds` always end up in the returned map with `score === 1`.
- Pubkeys not present in any rating + not in seeds are not in the returned map (not "score 0 for everyone in the world" — keep the output bounded to known pubkeys).
- `options` is optional; defaults: `{ maxIterations: 60, convergenceThreshold: 0.001, weightingModel: 'gr-community-default-v1' }`.
- If `options.weightingModel !== 'gr-community-default-v1'`, throw — Slice 2 only supports the default model; future models register through a registry that doesn't exist yet.

### Cache

`src/api/communities/cache.js` exports a single function `getOrCompute(key, computeFn, ttlMs = 60000)`. Internally a `Map<string, { value, expiresAt }>` with `Date.now()` for the TTL check. Eviction: when `map.size > 200`, delete the oldest entry by iteration order (Maps preserve insertion order).

Key format: `${communityATag}:${viewerPubkey}` for member-roster scores; `list:${viewerPubkey}` for the community list per viewer.

### OpenAPI

Add to `src/api/openapi.yaml` under `paths:`. Reference component schemas matching the firmware shape (`brainstormCommunity`). One block per endpoint; brief description; parameters; success response with the `{ success: true, ... }` envelope; 404 for `/:slug` when the community isn't found.

### Test surface

The Tester writes a Node-runner suite that:

**Algorithm correctness (pure-function tests):**
- T1: seeds always score 1
- T2: bot endorsement (baseline_gr=0) doesn't lift target
- T3: high-baseline outsider endorsement (community_gr ≈ 0 after iteration) doesn't lift target
- T4: balanced endorse + veto yields a score below threshold for the target
- T5: function is pure — same input → equal Map output
- T6: function converges within maxIterations on a synthetic 50-node graph
- T7: function rejects unknown weightingModel
- T8: function excludes self-ratings
- T9: performance benchmark — 200 members + 800 signals completes in < 50ms

**REST contract (source-regex tests):**
- T10: `src/api/index.js` registers all four routes
- T11: each handler module exports the expected named function (`handleList`, etc.)
- T12: handlers fall back to `getOwnerAssistantPubkey()` when `req.query.viewer` is absent
- T13: data-source functions exist and have a try/catch wrapping their query
- T14: pure-function module has zero imports of `fs`, `neo4j-driver`, `nostr-tools`, `child_process`, or `ws`
- T15: response envelopes match the locked contract (`{ success: true, communities: [...] }` etc.) — verified by grep against the handler source
- T16: openapi.yaml includes the four new path entries

### Verification on real data

Deferred to staging smoke once the communities droplet exists:

```bash
# Empty-instance check (immediately after fresh deploy, before any community exists):
curl -s https://communities.brainstorm.world/api/communities | jq
# Expect: {"success":true,"communities":[]}

# After Slice 4 ships writes and at least one community is created:
curl -s "https://communities.brainstorm.world/api/communities?viewer=$VIEWER_HEX" | jq
curl -s "https://communities.brainstorm.world/api/communities/<slug>/members?viewer=$VIEWER_HEX" | jq '.members[0]'
```

## Out of scope

- **Write endpoints** — Slice 4.
- **WebSocket / streaming** — plain GET only.
- **Pagination** — bounded scale doesn't require it.
- **`@graperank/calculator` integration** — see Option B rationale.
- **Scheduled-task recomputation** — Option C; revisit if real load materializes.
- **Surfacing `nip72Wrapping` in responses** — schema accepts it but Slice 2 doesn't dereference it. NIP-72-wrapped communities will round-trip the field but the membership calc uses the same code path either way.
