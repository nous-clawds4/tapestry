# Test Plan: Story 1 — The "writes nothing to strfry" assertions must measure only what this instance could have written

**Story:** `engineering-team/stories/test-suite-hermeticity/1-narrow-strfry-write-assertion-brackets.md`
**ADR:** `engineering-team/decisions/test-suite-hermeticity/0001-author-scoped-write-assertion-brackets.md`
**Date:** 2026-08-10

## The shape of this story, and who edits what

This story's deliverable **is** a test-file change: there is no source change at all (ADR 0001,
"Consequences" — no file outside `test/` is touched). That inverts the usual phase split, so it is
stated explicitly rather than left to convention.

- **Phase 3 (Tester, this plan)** adds a *new* guard suite, `test/strfry-write-assertion-bracket.test.js`,
  and registers it in `test/test.js`. Its S-class assertions fail against the two suites as they
  stand today — that is the failing-tests-first contract.
- **Phase 4 (Implementer)** edits `test/relationship-primitives.test.js`,
  `test/relationship-primitives-probe.test.js`, and `OPEN.md` to make those assertions pass.
  **The Implementer must not modify `test/strfry-write-assertion-bracket.test.js`.**

ADR 0001's implementation note says the Implementer's `test/` diff should be empty — that is the
harness's standing rule, and it is inapplicable here for the reason above. The rule exists to stop an
Implementer weakening the tests that judge them; that protection is preserved by pinning the new
guard suite as off-limits while the two suites under repair are in scope. **This is a deliberate
deviation from ADR 0001's note and needs ratification at this gate** — the alternative (the Tester
performs the narrowing) leaves Phase 4 with nothing to do and no failing test to drive it.

## Coverage map

| Criterion | Test | Test file | Level |
|---|---|---|---|
| AC-1 (flake gone) | `S1` — neither bracket helper asks for a whole-corpus count | `test/strfry-write-assertion-bracket.test.js` | source assertion |
| AC-1 (flake gone) | **Verification protocol V1** — 10 consecutive runs of each suite, router live | manual, recorded below | integration |
| AC-2 (teeth kept) | `S2` — both helpers scope the count by `authors` | `test/strfry-write-assertion-bracket.test.js` | source assertion |
| AC-2 (teeth kept) | `H1` — an author-scoped count detects a real TA-signed write | `test/strfry-write-assertion-bracket.test.js` | live stack |
| AC-2 (teeth kept) | `H2` — the fingerprint is not narrowed to nothing | `test/strfry-write-assertion-bracket.test.js` | live stack |
| AC-3 (portable) | `S3` — no 64-hex literal; both resolve `/api/assistant/pubkey` at runtime | `test/strfry-write-assertion-bracket.test.js` | source assertion |
| AC-4 (tax retired) | `S4` — the row-150 quiesce guidance is gone from both messages | `test/strfry-write-assertion-bracket.test.js` | source assertion |
| AC-4 (tax retired) | **Reviewer checklist** — OPEN.md row 150 flipped to `DONE` | review | manual |

### Two deliberate omissions

- **AC-4's ledger flip is not automated.** A test asserting "OPEN.md row 150 says DONE" would couple
  the suite to an ordinal that is known to be reassigned — OPEN.md row 151 records two machines
  minting colliding row numbers and a renumber inside a merge. The Reviewer verifies it instead.
- **AC-1's repeat-run proof is a protocol, not a test.** Ten runs of two suites is minutes of wall
  clock; as a standing test it would cost every future gate more than the flake did. It is run once,
  as evidence, at Review.

## Why H1 and H2 pass before implementation

Both are **pre-satisfied by design** and say so in the suite header. They characterize the
*fingerprint* ADR 0001 chose; S1–S4 then pin the two suites to that fingerprint. The pairing is what
makes the story safe: without H1/H2, every S-class assertion could be satisfied by a filter matching
nothing — a permanently-green dead test, which is precisely the failure this story exists to prevent.
There is repo precedent for a documented pre-satisfied guard: `relationship-primitives-probe` H3 is
already satisfied by default-deny pre-implementation and is annotated as such.

## Edge cases covered

- [x] **Filter narrowed to nothing** (the dangerous over-fix) — `H2`.
- [x] **Bracket deleted rather than narrowed** — `S1` fails if a suite issues no `scan/count` at all.
- [x] **TA pubkey hardcoded** (CLAUDE.md per-deployment rule) — `S3`.
- [x] **TA pubkey unresolvable at runtime** — `H1`/`H2` fail loudly rather than skipping; ADR 0001
      requires the same of the two suites (never fall back to `{}`, never `SKIP`).
- [x] **Stack absent** — S-class still runs and gates; H-class per-test `SKIP`, matching the
      established split.
- [x] **Test pollutes the corpus** — `H1` deletes its probe event in a `finally`, scoped to that one
      event id, and fails loudly with the exact cleanup command if the delete does not take.

## Test infrastructure

- Framework: the repo's own runner — `node test/test.js`, suites exporting `run()`. No new tooling
  (CLAUDE.md: JS-without-build).
- Registered in `test/test.js` at four sites: `require` (line ~174), invocation (line ~536), the
  skip-aware summary line, and the overall-pass conjunction.
- Live stack: `http://localhost:7778` plus `docker exec tapestry` — H-class needs **both**, because
  `H1` publishes over the container loopback (the `req.localTrusted` class permitted to mint
  TA-signed events, `publishEvent.js:33-38`).
- Firmware state: no precondition; no concept definitions change; no reinstall needed.
- Fixtures: one TA-signed **kind 7357** event (regular range — non-replaceable so it cannot be
  silently replaced, non-ephemeral so it is actually stored; unused by the application). Created and
  deleted within `H1`.

## How to run

```bash
node test/strfry-write-assertion-bracket.test.js
```

Full gate:

```bash
npm test
```

## Verification

The new S-class tests fail against the current code; the H-class teeth guards pass, as designed.
Confirmed 2026-08-10 at commit `b7832fe9`:

```
--- strfry write-assertion bracket tests (epic test-suite-hermeticity, Story 1) ---
  FAIL  S1 (AC-1): neither bracket helper asks strfry for a whole-corpus count …
        test/relationship-primitives.test.js still counts the WHOLE corpus — the empty filter {} is
        the whole defect (ADR 0001) … Got: const r = await fetch(`${HOST_BASE}/api/strfry/scan/count?filter=${encodeURIComponent('{}')}`, {
  FAIL  S2 (AC-2): both bracket helpers scope the count by author …
        test/relationship-primitives.test.js's strfryEventCount must scope its filter by "authors" …
  FAIL  S3 (AC-3): neither suite bakes in a pubkey literal …
        test/relationship-primitives.test.js must resolve the TA pubkey at runtime via GET /api/assistant/pubkey …
  FAIL  S4 (AC-4): the row-150 "quiesce the router and re-run" guidance is gone …
        test/relationship-primitives.test.js still tells the reader to quiesce a concurrent publisher and re-run …
  PASS  H1 (AC-2): an author-scoped count still detects an event this instance actually wrote …
  PASS  H2 (AC-2): the author-scoped fingerprint is not narrowed to nothing …

strfry-write-assertion-bracket: 2 passed, 4 failed, 0 skipped
```

Corpus left as found — TA-scoped count `8591` before and after the run; `strfry scan --count
'{"kinds":[7357]}'` returns `0`.

## Verification protocol V1 (AC-1) — run at Review, recorded in the review

The automated suite cannot prove absence of a flake; repetition can. With `strfry-router`
**running** (`docker exec tapestry supervisorctl status strfry-router`), and **no** quiescing:

```bash
for i in $(seq 1 10); do node test/relationship-primitives.test.js; done
for i in $(seq 1 10); do node test/relationship-primitives-probe.test.js; done
```

Pass condition: H8 green in 10/10 and H4 green in 10/10.
Baseline for comparison, measured pre-fix on 2026-08-10: **5 red / 1 green** across six H4 runs.

Supporting evidence to capture alongside it — the premise of ADR 0001 in one measurement: sample the
whole-corpus count and the author-scoped count across the same ~10-minute window and record that the
former moves (it moved +165 during test design) while the latter does not (30 samples, one distinct
value).
