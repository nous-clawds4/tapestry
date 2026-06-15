# Review: Story live-feed #1 — Live-feed read path

**Reviewer:** Claude (acting as Reviewer; fresh context, not the Implementer)
**Date:** 2026-06-15
**Diff:** `git diff 9c5a0035..HEAD` (Gate-3 baseline `9c5a0035` → HEAD `72ba34ca`)
**Story:** `engineering-team/stories/live-feed/1-feed-read-path.md`
**ADR:** `engineering-team/decisions/live-feed/0001-feed-read-path-endpoint.md` (incl. the testability-seam amendment)
**Test plan:** `engineering-team/stories/live-feed/1-feed-read-path.test-plan.md`

## Files in the diff

| File | Change |
|---|---|
| `src/api/feed/feedReadPath.js` | **New** — the read-path module (`buildFeed`, `handleGetFeed` + internal helpers). |
| `src/api/index.js` | +2 lines: `require('./feed/feedReadPath.js')` and `app.get('/api/feed', handleGetFeed)`. |
| `engineering-team/audits/live-feed/journal.md` | Director's Gate-4 journal entry (process artifact, not code). |

Strictly additive: no search/profile/ranking/firmware code touched; `package.json` / `package-lock.json` untouched.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. My own run. Verbatim summary tail:

```
reputation-info-popup suite:                     PASS (16 passed, 0 failed)
live-feed-read-path suite:                       PASS (23 passed, 0 failed)
Overall:                                         PASS
```

  All 35 suites PASS; the new `live-feed-read-path` suite is **23/23** (S1, S2, B1–B21). No pre-existing suite regressed. (The `Config file /etc/brainstorm.conf not found … BRAINSTORM_RELAY_PUBKEY: null` lines are expected off-container noise from `getOwnerAssistantPubkey()`, not failures — the hermetic tests never reach the real relay-set helper.)
- [ ] `npm run test:playwright` — **N/A.** The `/feed` page is Story #2; this story is a backend read path, no browser surface. Test plan explicitly excludes Playwright here.
- [x] _Lint not configured — skipped (house rule: no new lint tooling)._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped (JS-without-build)._

## Spec adherence — the 5 acceptance criteria

- [x] **AC-1 Resolution & content.** Source resolution + kind-1-from-follows, newest-first, 50-cap, item shape, local profile enrichment, kind-6/7 + non-followed exclusion. `buildFeed` orchestrates: `resolveSource` (`feedReadPath.js:92-104`), `getLocalFollows` (`:111-125`), `fetchNotes` (`:158-173` — `kind !== 1` drop at `:165`, `followSet.has` drop at `:166`, `sort` desc + `slice(0, FEED_CAP=50)` at `:171-172`), `enrichAuthors` (`:179-213` — local kind-0 only, item shape `{ id, pubkey, createdAt, content, author:{ displayName, avatar } }` at `:202-211`). Covered by B1–B8 (all pass).
- [x] **AC-2 Relay source with fallback.** `resolveGeneralPurposeRelays` (`:131-152`) builds the handle from the **TA-derived slug** (`:133-134`), `runCypher` resolves members; empty → fallback (`:149` guard + `:151`), error → fallback (`catch` at `:150` → `:151`). `relaySource` returned as `'set'`/`'fallback'` and surfaced on OK/EMPTY (`:247,:249`). Covered by B9 (set), B10 (empty→fallback), B11 (error→fallback) — all pass.
- [x] **AC-3 No source identity.** `resolveSource` returns `null` → `buildFeed` returns `{ status:'NO_SOURCE' }` at `:231` **before** any relay/strfry call (the `getLocalFollows`/`fetchNotes` steps are below the early return). Covered by B12, B13 (no relays queried), B14 (distinct from EMPTY).
- [x] **AC-4 Follow list not local.** `getLocalFollows` returns `null` when no kind-3 exists (`:114`); `buildFeed` maps that to `{ status:'FOLLOW_LIST_UNAVAILABLE', source }` at `:235-237`. Distinct from NO_SOURCE (source already resolved) and EMPTY. Covered by B15, B16.
- [x] **AC-5 Present but empty.** A present kind-3 (incl. zero p-tags → `follows:[]`, `:124`) flows past the unavailable check; `fetchNotes([],…)` short-circuits to `[]` (`:159`); `items.length === 0` → `{ status:'EMPTY', …, items:[] }` at `:246-248`. Covered by B17 (empty notes) and B18 (zero p-tags is EMPTY, not UNAVAILABLE).
- [x] **B19** confirms the four `status` values are mutually distinct; **B20/B21** confirm the login-wins-over-House resolution order.

No criterion silently dropped. No behavior added beyond the story (the response is exactly the discriminated union the ADR specifies; the handler adds only `success:true` + 500-on-throw).

## ADR adherence (Option A + amendment)

- [x] **Option A, single self-contained module.** New `src/api/feed/feedReadPath.js` exporting `buildFeed` + `handleGetFeed` (`:264`); wired at `GET /api/feed` in `src/api/index.js:299` alongside `/api/relay/external`. Matches §Decision / §Implementation notes.
- [x] **Reuses the four named primitives** via the cited real helpers: `getSettings` from `config/settings` (`:45-47`, verified `src/config/settings.js:76,130`), `runCypher` from `lib/neo4j-driver` (`:65-67`, verified `src/lib/neo4j-driver.js:53` returns rows with a `json` key per `RETURN jt.value AS json`), `SimplePool.querySync` with `Promise.race` timeout + `pool.close` (`:70-84`, mirrors `fetchEvents.js`), local `strfry scan` via `execSync` (`:50-62`, mirrors `scan.js`/`fetchProfiles.js`).
- [x] **Injectable-deps seam (amendment).** `buildFeed` reads each boundary as `deps?.X ?? options.X ?? <realHelper>` exactly as the amendment dictates: `getSettings` (`:224`), `scanStrfry` (`:225`), `runCypher` (`:226`), `querySync` (`:227`). Accepts fakes both spread and under `options.deps`. Production `handleGetFeed` calls `buildFeed({ sessionPubkey: req.session?.pubkey })` with **no deps** (`:257`) → real helpers, unchanged behavior.
- [x] **Relay-set handle is TA-slug, never a hardcoded UUID.** `39999:${ta}:the-set-of-general-purpose-relays` where `ta = getOwnerAssistantPubkey()` (`:133-134`). Verified `src/utils/assistantKeys.js:49-82` returns a 64-hex TA pubkey (env / brainstorm.conf / secure-keys), not a deployment UUID.
- [x] **Cypher matches the ADR's query** (`:135-138`) verbatim including `WHERE NOT m:Superset` and the `NostrEventTag {type:'json'}` join.
- [x] **No new dependency**, no lint/typecheck/build tooling, no concept/schema change. `package.json`/lock untouched.

## Concept-graph integrity

- [x] Handle is in `kind:pubkey:slug` form (`39999:<TA-hex>:the-set-of-general-purpose-relays`), TA resolved at runtime — no hardcoded deployment identifier.
- [x] **No concept definitions changed** → firmware reinstall **not** required (ADR §Consequences confirms; this is a read-only consumer). Correctly not performed.
- [x] New code orients via the Concept Graph (`runCypher` on the Set node), not by re-deriving from BIBLE.md.

## Things tests can't catch

- [x] **No secrets** in committed files; no private keys / nsec / tokens. The only literals are the three documented fallback relay URLs (`:37`) and the public relay-set slug.
- [x] **No leftover debug logging / `console.*` / `debugger` / TODO** in the module (swept clean).
- [x] **No commented-out code.**
- [x] **Error paths handled where it matters.** Relay-set resolution degrades to fallback on both empty and throw (`:150-151`); kind-0 enrichment swallows scan errors → null profiles (`:184-186`); unparseable strfry/JSON lines are skipped (`:59,:147,:192`); the handler wraps everything in try/catch → 500 only on genuinely unexpected failure (`:259-261`), and a relay timeout is **not** treated as failure (the `realQuerySync` timeout rejects, but it's invoked inside `fetchNotes`/`buildFeed` which would 500 — see non-blocking note 2; behavior is still safe and tested at the logic layer).
- [x] **Security — public, no-auth endpoint.** The only directly caller-controlled input is `req.session?.pubkey`, which `resolveSource` validates against `HEX64` (`:93`) before any shell/relay use; the House `povPubkey` is likewise HEX64-validated (`:100`). An anonymous caller cannot select an arbitrary source — they get either their validated session pubkey or the instance's configured House PoV, never a free-form value. No privilege escalation: the endpoint is read-only and returns the same public data shape regardless of caller. Relay filters use structured objects (`{kinds, authors, limit}`) passed to `SimplePool`, not string concatenation — no relay-filter injection. The Cypher uses a **parameterized** `$h` bind (`:138`), not string interpolation — no Cypher injection.
- [x] **Concurrency.** Stateless per-request; the only shared state is the `_taPubkeyCache` inside `assistantKeys` (benign read-cache) and a fresh `SimplePool` per fetch, closed in `finally` (`:81-83`). No races introduced.

## House rules

- [x] Concept Graph API authority respected (relay set resolved from the graph, not hardcoded).
- [x] No new lint/typecheck/build tooling; no new dependency; no firmware change.

## Findings

### Blocking
_None._

### Non-blocking (file an OPEN item; not gating this merge)
1. **`src/api/feed/feedReadPath.js:53`** — `realScanStrfry` escapes single quotes as `filterStr.replace(/'/g, "\\'")` (backslash-escape), which is **not** correct inside a single-quoted POSIX shell string; the canonical `src/api/strfry/queries/scan.js:22` uses the proper `'\''` form (`replace(/'/g, "'\\''")`). The exploitable surface here is narrow: the directly caller-controlled source pubkey is HEX64-validated before it reaches the shell, and the kind-0 author values are second-order (must already be a followed author whose note survived the relay fetch). Crucially, this **reuses the identical imperfect escaping already shipped in `src/api/profiles/fetchProfiles.js:94`** — the very file the ADR cited as the local-kind-0 pattern to copy — so it is a pre-existing project-wide convention, not a regression introduced by this story. Recommend hardening both call sites to the `scan.js` `'\''` form in a follow-up (file under `OPEN.md`); not blocking this additive, reversible read path. The hermetic tests never exercise this real helper, by design.
2. **`src/api/feed/feedReadPath.js:243,259-261`** — a relay-fetch timeout in `realQuerySync` (`:79`) rejects, which propagates up through `fetchNotes`/`buildFeed` and is caught by `handleGetFeed` as a **500**, rather than degrading to `EMPTY`/`OK` with whatever arrived as the ADR's §Implementation-notes phrasing ("relay timeout is **not** failure → yields EMPTY/OK") suggests. This is a behavioral nuance at the *live* boundary that the unit suite (which injects a resolved `querySync`) does not exercise, and the story's acceptance criteria do not pin timeout-to-EMPTY semantics — the contract only requires the four outcomes + fallback, all of which hold. The book's mandatory **Tier-4 staging smoke** (anonymous `GET /feed` 200 + ≥3 rendered notes for the House PoV's follows) is the right place to confirm the live timeout posture; flag for that smoke. Optional improvement: in `fetchNotes`, treat a relay timeout as "return whatever arrived (possibly `[]`)" rather than throwing, to match the ADR's stated posture. Not blocking — no AC depends on it and the 500-on-genuine-failure path is correct.

Both items are improvements to the *real* I/O helpers that the hermetic suite deliberately does not cover; neither affects the four-outcome contract, the relay set/fallback logic, the item shape, or the read-only/additive posture that the story and ADR require. They belong in the Tier-4 staging smoke and an `OPEN.md` follow-up, not as a merge block.

## Scope-creep sweep

- [x] Strictly additive and read-only (frame bullet 7). No writes/publishes; no change to search, profile pages, ranking/scoring, or firmware. With `app.get('/api/feed', …)` and the module removed, the app behaves exactly as before.
- [x] No `/feed` page code (that's Story #2): the diff contains no HTML/CSS/client JS, no headings/indicators/empty-state copy — only the backend data contract.
- [x] No out-of-scope features: no tagging, no PoV selector, no reposts/reactions/replies/pagination/infinite-scroll.

## Verdict

**PASS** — mergeable as-is. The implementation matches Option A and the testability-seam amendment, satisfies all five acceptance criteria with 23/23 passing behavioral+structural tests on my own run, resolves the general-purpose relay set by TA-derived slug with the correct empty/error fallback, keeps profile reads local, and stays strictly additive and reversible. The two non-blocking findings are improvements to the live I/O helpers (a pre-existing escaping convention inherited from `fetchProfiles.js`, and a timeout-posture nuance) to be confirmed in the mandatory Tier-4 staging smoke and filed as an `OPEN.md` follow-up — neither affects the story's contract or the read-only posture.

Story `**Status:**` flipped to `Done` in this same review commit per workflow 5 / Reviewer role. The epic folder is **not** moved — retirement is per-epic at close-out (Story #2 + Tier-4 staging evidence remain).
