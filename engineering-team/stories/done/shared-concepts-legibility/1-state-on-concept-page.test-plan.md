# Test Plan: Story 1 — Show a concept's sharing state on its own page

**Story:** `engineering-team/stories/shared-concepts-legibility/1-state-on-concept-page.md`
**ADR:** `engineering-team/decisions/shared-concepts-legibility/0001-sharing-state-resolver.md`
**Date:** 2026-08-09
**Suite:** `test/state-on-concept-page.test.js` (registered in `test/test.js` — five touches)

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| AC-1 — no marker → "not yet shared" | `U6`, `H3` | unit + live |
| AC-2 — self-pointer on the relay → "shared" | `U3`, `H2` | unit + live |
| AC-3 — declared locally, not on the relay | `U4` (relay copy lacks the pointer), `U5` (no relay copy), `H2` | unit + live |
| AC-4 — relay unreachable → unconfirmed, never "not shared" | `U2` | unit |
| AC-5 — wired state identifies its target followably | `U7` (resolver), `S3` (link to `header/:coord`) | unit + structural |
| AC-6 — sentinel → "kept private", never an error or broken link | `U8` | unit |
| AC-7 — multiple markers all represented, self vs external distinguishable | `U7` | unit |
| AC-8 — button says re-submit once shared | `S4` | structural |
| AC-9 — confirmation before a re-submit, saying why | `S5` | structural |
| AC-10 — state updates after submit without a reload | `S6` | structural |

**Supporting tests** (not 1:1 with a criterion): `U1` the shared `carriesSelfPointer` predicate; `U8`
the zero-require purity pin; `S1` route registration and its public posture; `S2` handler-seam
composition; `H1` response shape; `H4` handle validation; `S7`/`H5` regressions.

**AC-4 is the load-bearing test.** The owner's ruling that "shared" means published makes silence
from the relay dangerous: absent a tri-state, an unreachable relay renders as "not shared," which is
precisely the false answer this story exists to remove. `U2` asserts both that `published === null`
*and* that it is not `false`, because the second is the failure mode.

## Edge cases

- [x] The third tag element (`'pointer'`) is optional — its absence must not change the answer (`U1`).
- [x] A missing or malformed event returns false rather than throwing (`U1`).
- [x] **Published-before-declared** — a relay copy that exists but carries no self-pointer is *not*
      shared. The published test is two-part (`U4`).
- [x] The sentinel never leaks into `wiredTo`, where the UI would render it as a broken link (`U8`).
- [x] Self-declared and wired **co-occur**; the resolver must not switch on the first match (`U7`).
- [x] A well-formed but unknown handle does not 500; a malformed handle is a 400 (`H4`).
- [x] The public read does not loosen the write path's owner gate (`S7`).
- [x] The neighbouring `/api/adoption-queue` read still answers (`H5`).
- [ ] **Concurrent submits** — not covered. The write path is unchanged and already idempotent.
- [ ] **Relay slowness short of timeout** — not covered; bounded by `FETCH_TIMEOUT_MS`, and the ADR
      requires the page to render without waiting on the badge.

## A correction this phase found in the ADR

The ADR's implementation notes say `resolveSharingState` should delegate to `dispositionOf` from
`src/lib/bValueForms.js`. **That would break the house pure-lib pattern** — `adoptionQueue.js`,
`trustedDictionary.js` and `bValueForms.js` are all *strictly* zero-require (verified: 0 matches for
`require(` in each), and `adoption-candidates-queue.test.js:219` pins that as a rule.

The tests are written to the corrected shape, which follows the precedent `trustedDictionary`
already set — *"the qualifying set is resolved at the HANDLER seam"*:

- `src/lib/sharingState.js` stays zero-require and exports `carriesSelfPointer(event, coord)` and
  `resolveSharingState({ coord, disposition, wiredTo, relayEvent, relayOk })`.
- The **handler** calls `dispositionOf` (and `classifyBValue` for `wiredTo`), then passes the
  classified pieces into the resolver. `S2` pins that the handler — not the lib — reaches for
  `bValueForms`, and `U8` pins the lib's purity.

Nothing about the decision changes; only where the composition happens. The ADR's Implementation
notes want a one-line amendment to match.

## Test infrastructure

- **Framework:** the house runner — `node test/test.js`; the suite is standalone-runnable via
  `node test/state-on-concept-page.test.js`.
- **Registration:** five touches in `test/test.js` (require, `run()` call, summary line, `overallOk`
  conjunct, skip-total array) — the established pattern.
- **Stack:** `H*` tests probe `/api/assistant/pubkey` at `localhost:$TAPESTRY_PORT` (default 7778)
  and return `SKIP` when it is down.
- **Fixtures: none minted, so nothing to tear down.** The `H*` tests *discover* own-TA headers at
  runtime from `/api/strfry/scan` and pick a self-declared one and a bare one. This deliberately
  avoids the fixture-teardown debt earlier suites in this area carried — the trade is that coverage
  depends on instance state: with no own headers of a given shape, the relevant test `SKIP`s rather
  than failing. (On this machine `H2` currently binds to a leftover `b-coverage-fixture-s1b` husk —
  harmless for the assertion, and a reminder that the local wire-archaeology cleanup is still open.)
- **Firmware:** no reinstall — no concept definitions change (ADR Consequences).

## How to run

```bash
node test/state-on-concept-page.test.js
```

Full suite:

```bash
npm test
```

## Verification

Confirmed failing for the right reasons on 2026-08-09 at commit `535c0a00`, stack up at :7778 —
**18 failed, 2 passed, 0 skipped**. The two passes are the intended regression guards.

```
  ✗ U1..U8   src/lib/sharingState.js does not load: Cannot find module '…/src/lib/sharingState.js'
  ✗ S1       src/api/concept/sharingState.js is missing
  ✗ S2       src/api/concept/sharingState.js unreadable
  ✗ S3       ui/src/hooks/useSharingState.js is missing
  ✗ S4       an already-shared concept's button must say it re-submits rather than
             submits for the first time
  ✗ S5       ConceptDetail must reuse ConfirmDialog rather than publishing straight from the click
  ✗ S6       the submit handler must call the hook's refresh() on success
  ✓ S7 (regression, passes pre AND post): self-declare keeps its owner gate and own-header restriction
  ✗ H1       expected 200 from the sharing-state read, got 404
  ✗ H2       …:b-coverage-fixture-s1b carries a self-pointing b in local strfry, so
             local.selfDeclared must be true — got null
  ✗ H3       expected a local block, got null
  ✗ H4       a malformed handle must be a 400, got 404
  ✓ H5 (regression, passes pre AND post): the neighbouring adoption-queue read still answers

state-on-concept-page: 2 passed, 18 failed, 0 skipped
```

Every failure names the missing artifact or the unmet behavior — none is a bare assertion. `H2`'s
message quotes the specific coordinate it resolved, so a future reader can tell which header the
claim was made about.
