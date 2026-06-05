# Review: Story 45 (data layer) — live roster client

**Reviewer:** independent agent (separate context, adversarial).
**Date:** 2026-06-05
**Scope:** `ui-communities/src/lib/roster.js` (new), `ui-communities/src/lib/membership.js` (gate factored to `isMember`); tests `test/roster-client.test.js` (9) + `test/roster-engine.test.js` (10, updated).

## Quality gates
- `node test/test.js` — **PASS** (roster-client 9/9, roster-engine 10/10, full suite green).
- `eslint` (ui-communities) — clean.

## Verdict: PASS, no blocking issues.

Verified correct (independently):
- **Gate (`isMember`)** is exactly `applications ≥ threshold AND applications > disputes` — never net-difference. `threshold` `== null` coalesce; **explicit 0 preserved** and still requires `apps > disputes` (0/0 → not a member). `deriveRoster` delegates to it and the two-part / not-net-difference semantics (roster-engine T9/T10) still hold — refactor didn't weaken the oracle.
- **`getRoster` threshold fallback** `opts.threshold ?? circle.membershipThreshold ?? 1` correctly distinguishes explicit 0 from absent.
- **`mergeRows`** unions per-pubkey across claimed tags (sums apps/disputes; first-non-empty profile fields).
- **`parseClaimCoord`** regex anchored/linear (no ReDoS), rejects non-39999/malformed, accepts colon-bearing slugs.
- **`defaultResolveEventId`** dedupes by id, picks newest by `created_at`; **`collectFromRelay`** is a faithful clone of `events/fetch.js` (resolve-once, timer cleared, sub/relay closed, connect-failure swallowed).
- **`defaultFetchCounts`** degrades to empty on `!resp.ok` / `success===false` / thrown — same posture as `lib/profiles.js`. CORS/network failure → empty roster, no crash.

## Addressed on review feedback
- Added T9 — **multi-claim union through `getRoster`** end-to-end (1+1 apps across two claimed tags ≥ threshold 2).
- Extended T5 — **`picture`/`nip05` carry-over** in `mergeRows` (first-non-empty, not overwritten).

## Non-blocking (carried)
- Test-prelude injects reference `isMember`/`mergeRows`/`rosterFromCounts` so `getRoster` (T6–T9) tests *orchestration* against fakes; the helpers' own correctness is covered against source by T1–T5. Bounded; the real fix is ESM import (suite-wide infra), deferred.
- Private network defaults (`defaultResolveEventId`/`defaultFetchCounts`) aren't unit-tested (not exported); they mirror proven `fetch.js`/`profiles.js`.
- `USE_MOCK` → empty roster (intentional; the count primitive has no mock). The People-tab story can seed mock members for dev.

## Outcome
Story 45 **data layer DONE**. The UI (People tab + trust signal — the acceptance criteria) is the remaining work and the human-review point (copy/visual hard rules). v1 members-only; applicant role waits on a `selfApplied` flag from `profiles-tagged`. Block 5 stays open.
