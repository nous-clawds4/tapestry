# Test Plan: Story 2 — One place that lists everything my instance has offered

**Story:** `engineering-team/stories/shared-concepts-legibility/2-mine-only-self-declared.md`
**ADR:** `engineering-team/decisions/shared-concepts-legibility/0002-my-offerings-bulk-resolver.md`
**Date:** 2026-08-09
**Suite:** `test/my-offerings.test.js` (registered in `test/test.js` — five touches)

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| AC-1 — every declaration listed, sent or not | `H2` | live |
| AC-2 — a declaration on the relay reads as shared | `H3` | live |
| AC-3 — a declaration not on the relay reads as not-yet-sent | `H3` | live |
| AC-4 — relay unreachable never renders as unsent | `H3` (branch), `S6` | live + structural |
| AC-5 — only my instance's offerings | `H4` | live |
| AC-6 — the community directory survives | `S7` | structural |
| AC-7 — a not-yet-sent row leads to where sending lives | `S5` | structural |

**Supporting:** `S1` registration + public posture; `S2` the ADR's cross-endpoint pin; `S3` the
no-swallow pin; `S4` runtime TA; `S6` the three row states + one page-level relay statement;
`S8`/`H6` regressions on story 1; `H1` response shape; `H5` ordering.

**`H2` is the test this story exists for.** It recomputes the local self-declared set *independently*
from `/api/strfry/scan` and asserts the endpoint returns exactly it — in both directions, so neither
a dropped row nor an invented one passes. If someone later "simplifies" the endpoint into a filter
over the relay, `H2` fails with the missing coordinates named. On this instance that is a live
condition, not a hypothetical: 4 declared locally, 3 on the relay.

**`H3` grades against the relay, not against the endpoint.** It queries `wss://dcosl.brainstorm.world`
through `/api/relay/external` and compares row by row, so the endpoint cannot mark its own homework.
It also branches: when the relay could not be read, *every* row must be `null` — asserting the
AC-4 rule rather than skipping it.

## Edge cases

- [x] A declaration that never reached the relay is still listed (`H2` — the story's whole point).
- [x] The endpoint invents nothing: coords not self-declared locally must not appear (`H2`, reverse
      direction).
- [x] Relay unreachable → all rows `null`, never `false` (`H3` branch).
- [x] Rows from other authors excluded (`H4`).
- [x] Both sharing-state endpoints share one home for the tri-state rule (`S2`).
- [x] `published` is never `undefined` — the UI branches on `null` (`H1`).
- [x] Ordering is stable and newest-first (`H5`).
- [x] The community directory keeps its own data source (`S7`).
- [ ] **Concurrent declaration during the two reads** — not covered. The local and relay reads are
      not atomic, so a concept declared between them could read as not-yet-sent for one page load.
      Self-correcting on refresh; not worth machinery.
- [ ] **A locally declared header absent from Neo4j** — its row still lists (display comes from event
      tags), but the concept page it links to renders blank. Pre-existing, recorded in ADR 0002
      Consequences; not asserted here.

## A coverage limitation, stated rather than papered over

**`S3` is a structural pin, not a behavioural test.** The ADR requires that a failed local scan
return non-200 rather than an empty list — the single most important failure mode, because an empty
list on a completeness page asserts "you have offered nothing." Proving that behaviourally means
breaking strfry on a live instance, which is not an acceptable test cost. So `S3` pins the shape
instead: the local scan must not be wrapped in a swallow-catch, the handler must carry a non-200
path, and the relay read must *still* be tri-stated. A determined implementation could satisfy all
three and still degrade; the pin narrows the failure surface, it does not close it.

**There is no `U` layer in this suite, deliberately.** The pure core (`carriesSelfPointer`,
`resolveSharingState`) is unchanged from story 1 and already carries eight unit tests. This story's
new logic is the handler's local↔relay join, which is exercised live against real divergent data
(`H2`/`H3`) rather than through fixtures. Adding unit tests that re-exercise story 1's functions
would inflate the count without adding coverage.

## Test infrastructure

- **Framework:** the house runner — `node test/test.js`; standalone via `node test/my-offerings.test.js`.
- **Registration:** five touches in `test/test.js`.
- **Stack:** `H*` probe `/api/assistant/pubkey` and `SKIP` when it is down.
- **Fixtures: none minted, nothing to tear down.** The `H*` tests derive their expectations from the
  instance's actual state. Trade-off, same as story 1: coverage depends on instance state — an
  instance that has declared nothing `SKIP`s `H2`, and one with fewer than two offerings `SKIP`s
  `H5`. This instance currently exercises both fully.
- **Firmware:** no reinstall — no concept definitions change.

## How to run

```bash
node test/my-offerings.test.js
```

Full suite:

```bash
npm test
```

Note: `npm test` writes to a file and is read with grep — never piped through `tail`, which discards
the failing suite's line and replaces the runner's exit code (OPEN.md row 157).

## Verification

Confirmed failing for the right reasons on 2026-08-09 at commit `25e46680`, stack up at :7778 —
**10 failed, 3 passed, 1 skipped.** The three passes are the intended regression guards; the skip is
`H5`, correctly inert until rows exist.

```
  ✗ S1  src/api/concept/myOfferings.js is missing
  ✗ S2  …/myOfferings.js unreadable
  ✗ S3  …/myOfferings.js unreadable
  ✗ S4  handler unreadable
  ✗ S5  ui/src/pages/shared-concepts/MyOfferings.jsx is missing
  ✗ S6  MyOfferings.jsx unreadable
  ✓ S7 (regression) the community-wide directory keeps its data source
  ✓ S8 (regression) story 1's single-coordinate endpoint is still registered
  ✗ H1  expected 200 from /api/my-offerings, got 404
  ✗ H2  every self-declared header in local strfry must be listed. Missing 4:
        ["…:b-coverage-fixture-s1b","…:tapestry","…:dog","…:dog-breed"]
  ✗ H3  the endpoint must answer before published can be checked — got 404 null
  ✗ H4  the endpoint must answer before authorship can be checked — got 404 null
  SKIP  H5 (fewer than two rows)
  ✓ H6 (regression) story 1's single-coordinate read still answers

my-offerings: 3 passed, 10 failed, 1 skipped
```

**A first draft of this suite reported 4 passed / 9 failed, and one of those passes was a lie.**
`H4` filtered an absent response to an empty array and concluded no foreign rows existed — passing
on nothing. `H3` likewise failed with `"no offerings to check"`, a message that reads like a skip
reason. Both now assert the endpoint answered *before* inspecting rows, which is why the honest
pre-implementation count is 3/10 rather than 4/9. Recorded because a vacuous green is worse than a
red: it reports coverage that does not exist.
