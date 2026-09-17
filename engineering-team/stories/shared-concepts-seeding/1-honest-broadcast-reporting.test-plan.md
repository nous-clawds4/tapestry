# Test Plan: Story 1 — Tell me what actually happened when I offer or wire a concept

**Story:** `engineering-team/stories/shared-concepts-seeding/1-honest-broadcast-reporting.md`
**ADR:** none — Architecture skipped by design (Bug under Standard)
**Date:** 2026-08-10
**Suite:** `test/honest-broadcast-reporting.test.js` (registered in `test/test.js` — five touches)

## The finding this phase turned up

**No `ui/src` module is executed anywhere in the node runner.** Every `ui/src` reference in every
existing suite is `readFileSync` for structural pins; there is no jsdom, no bundler-in-test, no
module substitution, and the Playwright specs drive a real browser rather than unit-testing modules.

That is fatal for testing *this* bug where it currently lives. The defect is "the code does not
inspect a return value," and the three outcomes it must distinguish — **reached / kept-local /
didn't land** — are reachable only by controlling the relay or the deployment's publish gate.
Neither is available to the runner. A structural pin like `/skippedByGate/.test(src)` would pass on
the token's mere presence, which is exactly the class of assertion that lets a defect regress
silently.

**So the tests are written against a small pure core, `src/lib/broadcastOutcome.js`:**

- `classifyBroadcast(result)` → `'published' | 'kept-local' | 'not-delivered'`
- `outcomeMessage({ outcome, verb, already })` → the human-readable string

This is a shape the story did not name, because Architecture was skipped — the skip was justified
("the concept page's handler is the working model") but the model is inline in a JSX file, and
copying an untestable shape into a second untestable file is what the skip quietly implied.

**It is not an invention.** `bValueForms`, `adoptionQueue`, `trustedDictionary` and `sharingState`
are all zero-require cores in `src/lib/` extracted for precisely this reason; `sharingState` was
created one story ago on the same argument. `U9` pins the purity.

**If the owner would rather not extract**, the fallback is structural pins only — and the plan
should say plainly that the three outcomes would then be unverified, with the bug free to return.

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| AC-1 — broadcast reached ≥1 relay → told it reached | `U2`, `U5` | unit |
| AC-2 — publishing switched off → told kept-local, distinct, not an error | `U1`, `U5`, `U8` | unit |
| AC-3 — reached no relay → told it did not land, and can retry | `U3`, `U5`, `U8` | unit |
| AC-4 — wiring distinguishes the same three | `U6`, `S2` | unit + structural |
| AC-5 — repeat actions keep the distinction | `U7` | unit |
| AC-6 — keep-private makes no community claim | `S3` | structural |
| AC-7 — both surfaces report identically | `S4` | structural |

**Supporting:** `U4` the safe-direction rule; `U9` purity; `S1` the submit path stops discarding the
result; `S5` the working model in `ConceptDetail` is not disturbed; `H1` the publish-policy endpoint
the gate depends on still answers.

**`U4` is the load-bearing test.** For every unreadable result — `null`, `undefined`, `{}`,
`{successes: null}`, a string, a number — the classification must **never** be `'published'`, and
must land on `'not-delivered'`. This story exists because code claimed community reach it had not
verified; the fix must not reintroduce that on a shape it did not anticipate.

## Edge cases

- [x] Partial success (some relays accept, some refuse) counts as **published** — the concept is
      retrievable (`U2`).
- [x] `kept-local` must not read as a failure *and* must not claim reach — both directions asserted
      (`U8`).
- [x] A failed broadcast tells the user they can try again (`U8`, AC-3's second half).
- [x] Submit and wire do not share one message — different acts (`U6`).
- [x] A repeat action reads differently from a first-time one, and still distinguishes all three
      (`U7`).
- [x] `defer` never broadcasts and makes no community claim (`S3`).
- [x] The sibling `wireAndBroadcast` is fixed in the same pass — a half-sweep fails `S2`.
- [ ] **Real relay failure end-to-end** — not covered. Would require breaking or blackholing the
      community relay from a live instance; not an acceptable test cost. The classification is
      exercised at the unit level instead, and `H1` pins the gate's data source.
- [ ] **The exact wording** — asserted only for distinctness, absence of error language, and the
      retry hint. Prose is the owner's call, not the tester's.

## Test infrastructure

- **Framework:** the house runner — `node test/test.js`; standalone via
  `node test/honest-broadcast-reporting.test.js`.
- **Registration:** five touches in `test/test.js`.
- **Stack:** only `H1` needs it, and it `SKIP`s when down.
- **Fixtures: none minted.** The `U` tests use literal copies of the two shapes `publishToRelays`
  actually resolves with (`{successes, failures}` and `{skippedByGate: true}`), read from
  `ui/src/utils/nostrPublish.js:95`. If that contract ever changes, these tests go stale silently —
  the one weakness of unit-testing against a copied shape, recorded here rather than hidden.
- **Firmware:** no reinstall; no concept definitions change.

## How to run

```bash
node test/honest-broadcast-reporting.test.js
```

Full suite:

```bash
npm test
```

Redirect to a file and grep it — never pipe a gate through `tail`, which discards the failing
suite's line and replaces the runner's exit code (OPEN.md row 157).

## Verification

Confirmed failing for the right reasons on 2026-08-10 at commit `8cd39a44`, stack up at :7778 —
**11 failed, 4 passed, 0 skipped.** All four passes are the intended regression guards.

```
  ✗ U1..U8  src/lib/broadcastOutcome.js does not load: Cannot find module '…/src/lib/broadcastOutcome.js'
  ✗ U9      src/lib/broadcastOutcome.js is missing
  ✗ S1      declareAndBroadcast must resolve its outcome through the shared core
            rather than assuming success
  ✗ S2      wireAndBroadcast carries the identical defect and must be fixed in the
            same pass — fixing one and leaving the other is a half-sweep
  ✓ S3 (regression) keeping private makes no community claim
  ✓ S4 (regression) both calling surfaces display the returned outcome
  ✓ S5 (regression) the concept page keeps the working model intact
  ✓ H1      the publish-policy endpoint the gate reads still answers

honest-broadcast-reporting: 4 passed, 11 failed, 0 skipped
```

Every failure names the missing artifact or the unmet behavior. `S1` and `S2` fail on the real
defect rather than on a missing file, so they would still fail if the core existed but the two
siblings kept discarding the publish result.
