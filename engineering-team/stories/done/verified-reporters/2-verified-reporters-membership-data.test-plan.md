# Test Plan: Story verified-reporters #2 — Verified reporters membership data

**Story:** `engineering-team/stories/verified-reporters/2-verified-reporters-membership-data.md`
**ADR:** `engineering-team/decisions/verified-reporters/0002-verified-reporters-membership-data.md`
**Date:** 2026-06-07

## Approach
Deterministic **source-regex node suite** — `test/verified-reporters-membership-data.test.js`, run by `npm test`, wired into `test/test.js`. This mirrors the `profile-follows-list` precedent, which pinned a new backend endpoint at source (handler + `index.js` registration + hook) without prescribing the exact wiring. The handler, route, and hook do not exist pre-implementation, so **T1–T10 are the failing tests**; **R1–R2** are regression sentinels (the untouched follows endpoint/route) that pass before and after.

No live integration test in `npm test`: the endpoint is Neo4j-backed and needs the stack plus `[:REPORTS]` edges and a known-reported account, which is live-data dependent and flaky. The **count = list length** guarantee is enforced *by construction* (`count: data.length`, asserted by T4) and against the count algo by reusing `VERIFIED_REPORTERS_INFLUENCE_CUTOFF` (T4). Live end-to-end exercise happens at Story 3 (the list page Playwright spec) and at the staging smoke.

**False-positive trap handled:** `src/api/index.js` and `followsWithMetrics.js` already contain `REPORTS` / `verifiedReporterCount` (the follows RETURN surfaces the reporter *count* per row). Every sentinel targets the NEW handler/route/hook (`handleGetGrapevineReporters`, `/api/get-grapevine-reporters`, the `[:REPORTS]` edge + `VERIFIED_REPORTERS_INFLUENCE_CUTOFF` filter in the new file) — absent pre-implementation.

## Coverage map
| Criterion | Test(s) | Level |
|---|---|---|
| AC1 — verified reporters under the (House v1) PoV; unverified excluded | T3 (`[:REPORTS]` edge + `influence >` filter), T6 (owner/House POV only) | source-regex |
| AC2 — identifier + Rank/credibility per reporter | T5 (pubkey, influence, hops, verified*Count) | source-regex |
| AC3 — set size == count under same PoV | T4 (`VERIFIED_REPORTERS_INFLUENCE_CUTOFF`, not the followers cutoff; `count: data.length`) | source-regex |
| AC4 — no PoV → House fallback | T6 (owner/House is the v1 default path; non-owner observer → 400) | source-regex |
| AC5 — no reporters → empty set, not an error | T7 (`data` from `result.records.map`; `{success,observer,observee,count,data}` shape) | source-regex |
| AC6 — bad account id → clear error | T2 (`observee` validation → 400) | source-regex |
| Endpoint reachable / handler exists | T1 (handler + export), T9 (route registered), T10 (hook fetches it), T8 (deadline → 504) | source-regex |
| Regression — follows endpoint untouched | R1 (handler + `:FOLLOWS` edge), R2 (`/api/get-grapevine-follows` route) | source-regex |

## Edge cases
- [x] Empty result is a successful 200 with `data:[] count:0` (the filtered MATCH yields zero rows) — T7.
- [x] Wrong cutoff (copy-paste from followers) would silently break count=list-length — T4 guards both presence of `VERIFIED_REPORTERS_INFLUENCE_CUTOFF` and absence of `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`.
- [x] Runaway inbound traversal on a heavily-reported account → 504 deadline — T8 (though verified-reporter sets are expected small).
- [x] Personalized/customer PoV — deferred (ADR 0002); non-owner observer rejected (T6), not silently coerced.
- [ ] Live count = list-length against a real account — deferred to Story 3 page smoke / staging (guaranteed by construction here).

## Test infrastructure
- Framework: Node built-in runner (`node test/test.js`). Wired in `test/test.js` (require + run + results line + `overallOk`).
- Concept Graph API: not required (runtime Neo4j node properties, not graph-concept nodes; no firmware change).
- Live stack: not needed for this suite (source-regex). Story 3 / staging exercise the endpoint against Neo4j.
- Fixtures: none (source-regex).

## How to run
```
npm test
```

## Verification
The new suite fails with the current code (T1–T10 fail — handler/route/hook absent; R1–R2 pass — follows untouched). Confirmed via `npm test` on 2026-06-07:

```
verified-reporters-membership-data suite:
  ✗ T1: reportersWithMetrics.js exists and exports handleGetGrapevineReporters (ADR 0002 §Impl)
  ✗ T2: handler requires + 64-hex-validates `observee`, returning 400 otherwise (AC6)
  ✗ T3: handler Cypher traverses the inbound :REPORTS edge with a verified-influence filter (AC1)
  ✗ T4: the verified filter uses VERIFIED_REPORTERS_INFLUENCE_CUTOFF (not the followers cutoff) and the response count is data.length (AC3)
  ✗ T5: success rows carry identity + credibility metric per reporter (AC2)
  ✗ T6: a non-owner `observer` is rejected with 400 — owner/House POV only in v1 (AC1/AC4; personalized POV deferred)
  ✗ T7: success response shape is {success, observer:'owner', observee, count, data} (AC3/AC5)
  ✗ T8: handler enforces the Neo4j deadline (NEO4J_QUERY_TIMEOUT_MS) with a 504 {success:false} branch
  ✗ T9: GET /api/get-grapevine-reporters is registered in src/api/index.js → handleGetGrapevineReporters
  ✗ T10: ui/src/hooks/useGrapevineReporters.js fetches /api/get-grapevine-reporters
  ✓ R1: the follows endpoint is untouched — followsWithMetrics.js still exports handleGetGrapevineFollows over the :FOLLOWS edge
  ✓ R2: the existing /api/get-grapevine-follows route remains registered

verified-reporters-membership-data suite:        FAIL (2 passed, 10 failed)
```

Each `✗` fails because the feature is unimplemented (the new handler/route/hook are absent), not from a typo or import error. All other suites remain PASS.
