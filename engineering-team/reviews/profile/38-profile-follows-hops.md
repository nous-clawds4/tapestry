# Review: Story 38 — Follows-hops to this profile

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-17
**Diff:** `git diff origin/main...HEAD` (commit `ef1de465`)
**Story:** `engineering-team/stories/profile/38-profile-follows-hops.md`
**ADR:** `engineering-team/decisions/profile/0034-profile-follows-hops.md`
**Test plan:** `engineering-team/stories/profile/38-profile-follows-hops.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. `profile-follows-hops suite: PASS (25 passed, 0 failed)`; `Overall: PASS`. Every prior suite still PASS (no regressions).
- [x] `npm run test:playwright` — not run (live-data, staging-only by design; the spec is committed and marked supplementary).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] UI build — `cd ui && npm run build` succeeds (JSX/imports valid; verified during implementation).

## Spec adherence

- [x] Every acceptance criterion has a passing test (T1–T22 map 1:1+ to ACs per the test plan's coverage map).
- [x] **Placement & label** — `<span>`…`<span className="bsp-count-label">Hops</span>` inserted between the Verified Followers `</Link>` and the Verified Reporters block ([BrainstormProfile.jsx:299-305](ui/src/pages/BrainstormProfile.jsx)). (T17/T18)
- [x] **Source selection** — `hopsSource = user?.pubkey || ownerPubkey` ([:109](ui/src/pages/BrainstormProfile.jsx)); logged-in viewer else Owner via `useConfig()`. Explicitly not the House PoV / `?pov=`. (T15/T16)
- [x] **Directionality** — Cypher uses the directed `-[:FOLLOWS*..20]->` ([follows-hops.js:32](src/api/export/users/queries/follows-hops.js)). (T4)
- [x] **Finite N + tooltip** — `rows[0].hops`; tooltip `"<target> is N hop(s) away from <source> by follows."` with `hops === 1 ? '' : 's'`. (T22)
- [x] **No path → ∞ + tooltip** — `rows.length === 0 → {hops:null}` → hook `noPath` → `'∞'` + `"There is no follow path from <source> to <target>."`. (T7/T20/T21)
- [x] **Self-view → 0** — `source === target` short-circuit returns `{hops:0}` without querying ([follows-hops.js:49-51](src/api/export/users/queries/follows-hops.js)); correctly avoids the `[:FOLLOWS*..20]` implicit-lower-bound-1 cycle trap. (T3)
- [x] **Always live, no precomputed** — distance is `length(p)` from `shortestPath`; the precomputed `NostrUser.hops` is never read. (T4)
- [x] **Async / non-blocking** — own `AbortController`-scoped hook ([useFollowsHops.js](ui/src/hooks/useFollowsHops.js)). (T13)
- [x] **Present but not clickable** — rendered as a `<span>`, not a `<Link>`. (T19)
- [x] **Graceful failure** — `catch → {success:false}` → hook `error` → `'—'`; `∞` is keyed on `noPath`, never on `error`, so a timeout/error never shows a false ∞. (T8/T20) Confirmed live during implementation: a query exceeding the 2.5 s timeout returned `{success:false}` (→ "—"), not ∞.
- [x] No behavior added beyond the story.

## ADR adherence

- [x] Files changed match ADR 0034's implementation notes exactly: `runCypher` 3rd-arg extension; new `follows-hops.js` handler; re-export; one route in `index.js`; new `useFollowsHops` hook; `BrainstormProfile.jsx` render.
- [x] Native `shortestPath` via the **pooled Bolt driver** `runCypher` — not `cypher-shell`/`execSync`, not GDS.
- [x] Cap **20** is a literal; pubkeys are **bound params** `$src`/`$tgt` (no interpolation of user input).
- [x] Per-query **timeout** (2500 ms, ADR ~2.5 s) passed via the new `txConfig` → `session.run(cypher, params, txConfig)`.
- [x] **Public** endpoint — not added to any allowlist in `src/middleware/auth.js` (grep confirms absent); works for logged-out viewers, falls through to read-only `next()`.
- [x] 3-state response contract exactly as specified.
- [x] No CSS change (reuses `.bsp-count` / `.bsp-count-value` / `.bsp-count-label` / `.bsp-count-loading`).
- [x] Backward compatible: `runCypher(cypher, params = {}, txConfig)` — existing 2-arg callers pass `undefined` txConfig, unaffected. (R2)

## Concept-graph integrity
- [x] No concept/schema change → **firmware reinstall N/A**.
- [x] No concept handles in code; nothing re-derived from BIBLE.md.

## Things tests can't catch
- [x] No secrets, no leftover debug logging (the single `console.error` in the catch is legitimate error logging, consistent with sibling handlers), no commented-out code, no TODOs.
- [x] Input validated at the boundary (`/^[0-9a-f]{64}$/` on both pubkeys → 400).
- [x] No injection vector (bound params + literal cap + static query string).
- [x] AbortController cleanup + `!aborted` loading guard — no leak/race (mirrors `useUserCounts`).
- [x] Reactive correctness: when logged out and `ownerPubkey` is still loading, `hopsSource` is `undefined` → hook no-ops and shows "—"; once config resolves, the `[source,target]` dep re-runs the fetch. No crash.

## House rules check
- [x] Concept Graph API authority respected (N/A — no concept change).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
_None._

### Non-blocking
1. **[follows-hops.js:66](src/api/export/users/queries/follows-hops.js)** — the response forwards the raw `error.message` (e.g. the verbose Neo4j timeout string) in the JSON body. The frontend ignores it (it shows fixed copy), and this matches sibling handlers (`hops-count.js`), so it's not a leak — but a generic message would be marginally cleaner. Optional.
2. **[follows-hops.js:26](src/api/export/users/queries/follows-hops.js)** — validation accepts lowercase hex only. Consistent with nostr's lowercase-hex convention and the pubkeys the page actually passes; an uppercase value would 400 → "—" (graceful). Acceptable as-is.
3. **Known consequence (not a defect), to verify on staging:** at cap 20 + 2.5 s timeout, confirming **∞** for a disconnected/very-far target from a highly-connected source (e.g. the Owner) can exceed the timeout and surface as "—" instead of ∞. Documented in ADR 0034 Consequences and OPEN.md #7; accepted by the requester. The fast no-path (∞) and finite-N values are **not** verifiable on the stale/near-empty local stack (OPEN.md #6) — they **must be verified on staging** (≈ prod scale) during the deploy chain.

## Verdict
**PASS** — the diff matches the story, ADR, and test plan; all 25 sentinel tests pass with no regressions; no blocking issues. Required follow-up at deploy time: verify real hop values (finite N and ∞) on **staging**, where `NostrUser.pubkey` is indexed and the graph is populated.
