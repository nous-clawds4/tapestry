# Test Plan: Story 2 — Sync the Treasure Map with one relay

**Story:** `engineering-team/stories/treasure-map-relay-presence/2-per-relay-map-sync.md`
**ADR:** `engineering-team/decisions/treasure-map-relay-presence/0002-per-relay-map-sync.md`
**Date:** 2026-09-07

## Coverage map

All tests live in `test/treasure-map-relay-sync.test.js`, registered in `test/test.js`.
Classes: **N** pure decision logic, **F** the API projection, **S** structure, **D** the negative
criterion, **R** sentinels.

| Criterion | Test | Level |
|---|---|---|
| AC-1 action appears only where meaningful, labeled by direction | `N1`–`N7` (the full decision table), `S1`, `S5` | unit |
| AC-2 sending converges the relay | `S1` (routes through `publishToRelays`), `S4` (re-checks after) | structure |
| AC-3 pulling converges local, and the page follows | `F1` (the whole event is available to pull), `S1`, `S3` (`onMapReplaced={search}`) | unit + structure |
| AC-4 nothing is ever deleted | `D1` | negative |
| AC-5 publish policy honored | `S2` (gated *before* the click; `skippedByGate` distinguished from failure) | structure |

## Edge cases

- [x] **The unorderable pair** (`N6`). Equal `created_at`, different `id`. Neither is "more
      recent", so the plan is `null` with reason `divergent`. This is the case a naive
      `newer ? pull : push` gets wrong by silently pushing.
- [x] **Neither side has it** (`N3`) — distinct from "in sync", and both distinct from a real
      direction.
- [x] **Malformed input** (`N7`) — `undefined`, `{}`, a non-string `id`. The planner must return a
      plan object rather than throw, because it runs during render for every row.
- [x] **`full=1` must not disturb the other statuses** (`F3`, `F4`) — absent and unreachable still
      answer the same way, still HTTP 200.
- [x] **Pull must not re-fetch** (`F5`) — exactly one probe call, so the event handed to the import
      path is the one story 1's probe already signature-verified. A second, unverified fetch is
      the natural shortcut and this fails it.
- [x] **The local side is not the displayed side** (`S5`) — when `inLocal` is false, the displayed
      event came from an external relay and local holds *nothing*. Getting this wrong points every
      button the wrong way for exactly the users whose Map is missing locally.
- [x] **A suppressed publish is not a failure** (`S2`) — `skippedByGate` must read as "kept local".

## A note on what is *not* behaviorally covered

`S5` is a **source-level pin**, not a behavioral test — the one place in this plan where that
substitution is made. The ADR's `planRelaySync(localEvent, relayEvent)` signature takes the local
event already resolved, so the resolution step itself (`inLocal ? event : null`) has no behavioral
surface reachable from Node without rendering React.

The alternative was to fold `inLocal` into the planner's signature, making it fully testable — but
that is an ADR change, and the Tester's lane is to report the gap rather than redesign around it.
The pin is precise and the decision table it feeds is fully covered by `N1`–`N7`, so the residual
risk is narrow: an implementation could satisfy `S5`'s text and still wire the value through
incorrectly. Flagged for the Reviewer, and a candidate for the next Tester-lane touch of this file.

## Test infrastructure

- **Framework:** Node built-in runner — `node test/test.js`. No new framework, no new dependency.
- **Hermetic by construction.** Every `F` test injects `probe`; nothing opens a socket, requires
  `nostr-tools`, or touches the local relay. Same rationale as story 1's suite: OPEN.md row 13
  (bare-checkout `nostr-tools` failures) and rows 75/126/128/141 (ambient-relay drift and fixture
  residue). This suite adds no relay fixtures, so it cannot decay.
- **Contracts pinned:** `planRelaySync(localEvent, relayEvent) → { direction, reason }` and the
  opt-in `full` parameter on `handleRelayPresence(req, res, { probe })`.
- **Concept Graph API:** not used. **Firmware:** no precondition — no concept definitions change.
- **Local full-suite note:** `npm test` locally is red-by-default on three unrelated
  `trusted-lists` suites (OPEN.md row 191) — a server-posture condition, not a code failure.

## How to run

The suite in isolation:

```bash
node -e "require('./test/treasure-map-relay-sync.test.js').run().then(r => console.log(r))"
```

The full gate:

```bash
npm test
```

## Verification

Confirmed 2026-09-07 at commit `b76aae5a`:

```
=== 9 passed, 13 failed ===
```

**The 13 failures are the new behavior**, each failing because the code does not exist — not from
a typo or an import error:

```
  ✗ N1..N7  ADR 0002 § Implementation notes 1: ui/src/utils/treasureMap.js must export
            planRelaySync(localEvent, relayEvent)
  ✗ F1      AC-3: pulling needs the whole signed event — got keys id,created_at
  ✗ S1      AC-1: the panel must decide direction with planRelaySync
  ✗ S2      AC-5: the panel must consult isExternalPublishAllowed …
  ✗ S3      AC-3: the panel must signal that the displayed Map was replaced
  ✗ S4      ADR 0002 § Implementation notes 3: … must share one probe path
  ✗ S5      ADR 0002 § Decision: direction is decided against local's copy …
```

**The 9 passes are all guards, by design** — they must pass before *and* after, and fail only on
collateral damage:

- `F2` — the cross-story guard. It re-pins story 1's narrow default response shape (its `A6`), so
  the tempting shortcut for this story (widening the default instead of adding `full`) fails here
  as well as there.
- `F3`, `F4`, `F5` — `full=1` must not disturb absent, unreachable, or the single-probe property.
  These pass now because `full` is ignored; their job is to stay green once it is honored.
- `D1` — the negative criterion. Passes now (nothing constructs a deletion) and must never flip.
- `R1`–`R4` — story 1's helpers, the panel's story-1 surface, the page's other Treasure-Map
  panels, and the shared publish helpers this ADR depends on (`publishToRelays`' explicit relay
  list and its `skippedByGate` return).

`node --check` passes on `test/test.js`; the suite is registered at all four touchpoints.
