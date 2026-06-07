# Review: Story verified-reporters #2 — Verified reporters membership data

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-07
**Diff:** `git diff staging...HEAD` — implementation commit `94c62a48` (src/api/grapevineInteractions/queries/reportersWithMetrics.js [new], src/api/index.js, ui/src/hooks/useGrapevineReporters.js [new])
**Story:** `engineering-team/stories/verified-reporters/2-verified-reporters-membership-data.md`
**ADR:** `engineering-team/decisions/verified-reporters/0002-verified-reporters-membership-data.md`
**Test plan:** `engineering-team/stories/verified-reporters/2-verified-reporters-membership-data.test-plan.md`

## Quality gates (run by reviewer, not trusted)
- [x] `npm test` — **PASS.** `verified-reporters-membership-data` suite: PASS (12 passed, 0 failed) — T1–T10 (ACs + endpoint contract) green, R1–R2 (follows untouched) green. Overall runner: **PASS** (no other suite regressed).
- [x] Vite build — `ui/` compiles (the new hook), confirmed at implementation.
- [x] Live endpoint smoke — **not run in review (by design).** A meaningful count=list-length / verified-filter check needs the Docker stack with real `[:REPORTS]` data and an account with verified reporters; that is the staging smoke / Story 3 page exercise. The in-capability invariant (`count === data.length`) is enforced in code and asserted by T4.
- [x] _Lint / typecheck / build gates not configured — skipped._

## Spec adherence
- [x] AC1 (verified reporters under PoV; unverified excluded) — `reportersWithMetrics.js:88-90` `MATCH (observee)<-[:REPORTS]-(reporter) WHERE reporter.influence > $cutoff`. T3/T6.
- [x] AC2 (identifier + Rank/credibility per reporter) — RETURN `pubkey, influence, hops, verified{Follower,Muter,Reporter}Count` (`:91-96`); mapped at `:100-107`. T5.
- [x] AC3 (set size == count under same PoV) — cutoff is `VERIFIED_REPORTERS_INFLUENCE_CUTOFF` (`:78`), the **same** var the count algo uses; response `count: data.length` (`:114`). T4 (and its copy-paste guard against the followers cutoff). Holds at House PoV / within the capability; transient divergence vs the Meili profile badge is documented and acceptable (ADR 0002 / ADR 0030).
- [x] AC4 (no PoV → House fallback) — owner/House is the only/default path; non-owner `observer` → 400 (`:65-70`). T6.
- [x] AC5 (no reporters → empty set, not error) — `MATCH … WHERE` yields zero rows → `data:[]`, `count:0`, HTTP 200 (`:98-116`). T7.
- [x] AC6 (bad account id → clear error) — `isValidHexPubkey` + `nip19.npubEncode` round-trip → 400 (`:49-60`). T2.
- [x] No criterion silently dropped; no behavior beyond the story.

## ADR adherence
- [x] Option A — a new isolated endpoint (`reportersWithMetrics.js`), new route, new hook. No generalization of live code (Option B) and no customer-PoV traversal (Option C).
- [x] Inverse-REPORTS Cypher with the verified filter, reusing the reporters cutoff via `getConfigFromFile` — exactly as ADR §Impl specified.
- [x] Response shape `{ success, observer:'owner', observee, count, data }` (`:110-116`); `observer:'owner'` literal (`:112`).
- [x] `NEO4J_QUERY_TIMEOUT_MS` driver deadline → 504 `{success:false}` (`:76, 96, 120-127`).
- [x] **Deliberate non-changes honored:** `followsWithMetrics.js` and `followersWithMetrics.js` not edited (diff: `index.js` only adds one import + one `app.get`); `/user/:pubkey/reporters` route NOT registered and no list page built (those are Story 3).
- [x] No new dependencies (`neo4j-driver`, `nostr-tools`, `getConfigFromFile` all pre-existing).

## Concept-graph integrity
- [x] N/A — runtime Neo4j node properties + the `[:REPORTS]` edge, not graph-concept nodes. No schema/concept change. No firmware reinstall (matches ADR).

## Things tests can't catch
- [x] Security: `observee` is validated (64-hex + npub round-trip) before any query; the Cypher is fully parameterized (`$observee`, `$cutoff`) — no injection vector. `observer` is checked against an allowlist (`'owner'` / owner pubkey).
- [x] Resource cleanup: `session.close()` + `driver.close()` in `finally` (`:131-134`).
- [x] No secrets; the `console.error` calls are legitimate error logging (mirroring the follows handler), not debug cruft. No commented-out code.
- [x] Edge: empty result is a normal 200 (verified above). Timeout → 504. Other errors → 500.
- [x] No scope creep — exactly the three files.

## House rules check
- [x] Concept Graph API authority respected (no concept work).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
None.

### Non-blocking
1. **`reportersWithMetrics.js:108` — `.filter(row => row.pubkey)` is a harmless carryover.** In `followsWithMetrics.js` this filter drops the single null-pubkey row that an `OPTIONAL MATCH` emits when the observee follows no one. This handler uses a plain `MATCH … WHERE` (no `OPTIONAL`), so every row already has a reporter with a pubkey and the filter never removes anything. It's defensive and harmless — optional cleanup, not a bug.
2. **`reportersWithMetrics.js:80` — a Neo4j driver is created per request** (then closed in `finally`). This is the *existing* pattern inherited verbatim from `followsWithMetrics.js`, not introduced by this story; flagging only for awareness. A shared long-lived driver is a repo-wide optimization that belongs with the eventual DRY `<GrapevineList>`/endpoint refactor (ADR 0030 follow-up), not here.

## Verdict
**PASS** — the diff satisfies all six acceptance criteria, conforms to ADR 0002 (Option A, the inverse-REPORTS query, the reporters cutoff, the response shape, the deadline, and every deliberate non-change), the deterministic gate is green (12/12), and there are no blocking issues. The two non-blocking notes are a harmless carryover and a pre-existing pattern. Live count=list-length verification is the staging smoke / Story 3, as designed.
