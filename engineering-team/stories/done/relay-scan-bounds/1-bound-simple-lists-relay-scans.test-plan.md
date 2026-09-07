# Test Plan: Story 1 — Simple Lists pages must work on a large relay

**Story:** `engineering-team/stories/relay-scan-bounds/1-bound-simple-lists-relay-scans.md`
**ADR:** `engineering-team/decisions/relay-scan-bounds/0001-bounded-scan-contract-and-grouped-tally.md`
**Date:** 2026-09-07

All tests live in one suite, `test/relay-scan-bounds.test.js`, wired into the
`npm test` gate (`test/test.js` — require, run block, summary line, `overallOk`
conjunct, skip tally).

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (List Headers renders at ≥450k) | `E1 (live): GET /api/dlists/item-counts returns the four figures the page needs` | `test/relay-scan-bounds.test.js` | integration |
| AC-1 | `E4: the counts route is registered` | same | static |
| AC-1 | `U1: List Headers no longer pulls every item, and reads the counts endpoint` | same | static |
| AC-2 (per-list count = set membership) | `T1: the operator's example — two lists of 10 sharing 5 items read 10, 10, total 15` | same | unit |
| AC-2 | `T2: a second z tag is honored — the first-tag-wins rule that caused the bug is gone` | same | unit |
| AC-2 | `T5: a kind-9998 header is matched by e tag (staging carries 4 of these)` | same | unit |
| AC-2 | `T6: the same list named twice on one item counts once for that list` | same | unit |
| AC-3 (total = union) | `T1` (asserts total 15, not 20) | same | unit |
| AC-3 | `T7: an item in a 39998 list and a 9998 list counts in both, once in the union` | same | unit |
| AC-3 | `E2 (live): the figures obey the union rule — per-list counts may exceed the total` | same | integration |
| AC-3 | `U2: List Headers shows the union as its total, not every item on the relay` | same | static |
| AC-4 (bounded set + "showing N of M") | `B4 (live): an explicit limit yields a bounded set that declares its own truncation` | same | integration |
| AC-4 | `U3: List Items requests a bounded set and states the total when truncated` | same | static |
| AC-4 | `U4: the relay client exposes the bounded envelope without changing queryRelay` | same | static |
| AC-5 (never a maxBuffer failure) | `B3 (live): the request that fails today succeeds and never reports a maxBuffer failure` | same | integration |
| AC-5 | `B1: the scan endpoint streams instead of buffering into a fixed maxBuffer` | same | static |
| AC-5 | `B2: the scan endpoint declares its bounds, with the byte cap at today's ceiling` | same | static |
| AC-6 (small deployments unchanged) | `B5 (live): a result that fits is not marked truncated` | same | integration |
| AC-6 | `R1: queryRelay still returns the events array, so untouched callers keep working` | same | static |
| AC-6 | `R2: the scan siblings stay registered and untouched` | same | static |
| AC-6 | `R3 (live): the count endpoint still answers for the filter that breaks the page` | same | integration |

## The seam this plan pins

The ADR names the module but not a function. The counting rule is the story's
substance, so it needs a unit-testable seam; this plan pins the smallest one
that also forces the streaming shape the ADR requires:

```js
// src/api/dlists/itemCounts.js
createTally(headerRefs)  ->  { add(event), result() }
result()                 ->  { counts, totalItems, scannedItems, unattached }
module.exports = { handleListItemCounts, createTally }
```

An accumulator rather than `tally(refs, items[])` deliberately: an array
parameter invites buffering all 473,101 events, which is the bug under repair.
If the Implementer wants a different shape, kick back rather than adapt the
tests silently.

## Edge cases

Covered beyond the bare criteria:

- [x] An item naming a header that does not exist — excluded from counts *and*
      from the union, reported as `unattached` (`T3`). 118 such items on the
      local relay.
- [x] An item with no `z` and no `e` tag at all (`T4`). 11 on the local relay.
- [x] The same list named twice on one item — counts once (`T6`).
- [x] An item spanning both reference styles, `z` to a 39998 list and `e` to a
      9998 list (`T7`). Staging carries 4 kind-9998 headers, so this path is live.
- [x] A bounded response whose set happens to fit — must *not* claim truncation
      (`B5`), the case that would silently regress small deployments.
- [x] An unregistered route falling through to the SPA catch-all — the helper
      reports "returned no JSON (HTTP 404) — the SPA catch-all served
      index.html" rather than a raw JSON parse error.
- [ ] **Not covered by `npm test`:** behavior at ≥450,000 items. No local or CI
      fixture reaches that scale. `T1`–`T7` prove the rule and the streaming
      shape prove scale-independence; the 450k case is a **staging smoke**, listed
      under Verification below.

## Test infrastructure

- Framework: the project's Node runner (`npm test` → `node test/test.js`). No new
  test tooling.
- Live (`B3`–`B5`, `E1`–`E3`, `R3`) hit the control panel at
  `http://localhost:7778` (override with `BRAINSTORM_BASE_URL`). Each probes the
  stack first and returns `SKIP` when it is absent, so the CI stack-free job stays
  meaningful — verified: with the stack unreachable the suite reports
  `2 passed, 14 failed, 7 skipped`.
- Firmware state: none required. The suite reads whatever the relay holds and
  asserts invariants rather than absolute counts, so it is not fixture-dependent.
- Fixtures: the `T` tests build their events inline (`item({ z: [...], e: [...] })`).

## How to run

```
npm test
```

This suite alone:

```
node -e "require('./test/relay-scan-bounds.test.js').run()"
```

## Verification

Confirmed 2026-09-07 at commit `ca59d338`, against the local stack (9,497 list
items — under the 10 MB ceiling, so this relay is a *passing* deployment):

```
relay-scan-bounds: 4 passed, 19 failed, 0 skipped
```

Failing for the right reasons — every message names the missing behavior, not an
import error:

```
  FAIL  T1: the operator's example — two lists of 10 sharing 5 items read 10, 10, total 15
        src/api/dlists/itemCounts.js must export createTally(headerRefs) -> { add(event), result() }
  FAIL  B1: the scan endpoint streams instead of buffering into a fixed maxBuffer
        AC-5: the scan must stream (spawn), as scanStream.js already does — exec buffers the whole result
  FAIL  B4 (live): an explicit limit yields a bounded set that declares its own truncation
        AC-4/AC-5: a bounded response must say it is bounded — never quietly partial
  FAIL  E1 (live): GET /api/dlists/item-counts returns the four figures the page needs
        GET /api/dlists/item-counts returned no JSON (HTTP 404) — the SPA catch-all served index.html
  FAIL  U1: List Headers no longer pulls every item, and reads the counts endpoint
        AC-1: the unbounded queryRelay({kinds:[9999,39999]}) is the request that fails on staging — moving ~416 MB to compute a few hundred integers
```

The 4 already-green tests are intentional: `R1`, `R2`, `R3` are regression pins
(green before and after), and **`B3` passes on this relay because 9,497 items fit
under the ceiling** — it is precisely the test that fails on staging and tags, and
a standing pin here.

### Not verifiable locally

- **Full `npm test`** crashes at suite #2 (`profile-tags-publish`) with
  `ECONNREFUSED` from `test/helpers/livePov.js:97` — Meilisearch is not exposed to
  the host on this machine (`localhost:7700` unreachable). **Pre-existing and
  unrelated**: captured on the unmodified tree at `ca59d338` before this suite was
  written. The gate wiring in `test/test.js` is verified by parse (`vm.Script`) and
  by running the suite standalone; CI runs the whole gate stack-free.
- **The ≥450,000-item case (AC-1, AC-5)** — a staging smoke after deploy:
  `/tapestry/lists` and `/tapestry/lists/items` render, and
  `GET /api/strfry/scan?filter={"kinds":[9999,39999]}` returns `success:true`.
  Today all three fail there.
