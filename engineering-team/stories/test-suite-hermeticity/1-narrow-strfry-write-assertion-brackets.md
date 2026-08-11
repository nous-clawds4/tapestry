# Story 1: The "writes nothing to strfry" assertions must measure only what this instance could have written

**Status:** Approved
**Created:** 2026-08-10
**Type:** Bug

## Background

Two tests assert that an operation writes **no event** to strfry. Both prove it by taking a strfry
event count before the operation and after it, and requiring the two numbers to be equal:

- `relationship-primitives` **H8** — a full relationship add + delete cycle writes nothing.
  This is the test that guards the **principle-4 invariant** (the graph primitives are strfry-free;
  BIBLE §30) — the reason the epic exists at all.
- `relationship-primitives-probe` **H4** — three repeated probes write nothing.

Both count the **entire corpus**. On any instance whose `strfry-router` is running, the corpus is
also being fed by the network the whole time the bracket is open, so the two numbers differ for a
reason that has nothing to do with the operation under test. The test then reports a write that
never happened.

**This is not a rare race.** Measured on the local stack 2026-08-10 with the router in its normal
running state:

| Measurement | Result |
|---|---|
| H4 standalone, 6 consecutive runs, router live | **5 red / 1 green — 83% spurious** |
| Whole-corpus count, samples 8s apart | +6, +7 events — router ingest is continuous |
| Whole-corpus drift over one 10-minute window | **+165 events** (6,616,398 → 6,616,563) |
| Time for one whole-corpus count | **6–7 seconds** — and each test takes two |
| Count scoped to this instance's own identity, 30 samples over the same 10 minutes | **exactly one distinct value — zero drift** |

The last two rows are the same window, measured two ways: the corpus the bracket currently watches
moved 165 times, and the subset this instance could actually have authored moved not at all.

The bracket is held open for roughly the duration of two 6-second scans, while events arrive at
close to one per second. Red is the *expected* outcome, not the unlucky one.

OPEN.md row 150 has six recorded sightings (2026-08-07, ×2 on 2026-08-09, ×2 on 2026-08-10, plus
the parent suite's), measured at ~40% spurious in July. It is now 83%. The row's own documented
remedy has already had to be escalated once — from "re-run standalone" to "stop the router, re-run,
start it again" — because the re-run alone stopped working. Every full gate now pays that cost.

**Who is affected:** everyone who runs a gate. The direct cost is the router stop/re-run/start
cycle. The larger cost is that a test guarding a named architectural invariant has been trained to
be ignored — and a *true* write regression in H8 would today be indistinguishable from the noise.

## User-facing description

As an engineer running the test gate, I want the "writes nothing to strfry" assertions to answer
only whether *the operation under test* wrote something, so that a red result means a real defect
and I can stop quiescing the router before every gate.

## Acceptance criteria

- [ ] **AC-1 (the flake is gone).** Given `strfry-router` is running and ingesting network traffic,
      when each of the two suites is run 10 consecutive times, then the write-assertion test
      (H8, H4) is green in all 10 runs of each — with no router stop, no re-run, and no other
      manual quiescing.
- [ ] **AC-2 (the teeth are still there).** Given an event **is** written to strfry through this
      instance's own signing path while the bracket is open, when the write assertion runs, then it
      goes red and its message identifies the write. *A narrowing that can no longer detect a real
      write does not satisfy this story.*
- [ ] **AC-3 (portable across deployments).** Given the suites are run against an instance whose
      identity differs from this machine's, when they run, then the write assertions behave
      identically — no per-deployment value baked into the test.
- [ ] **AC-4 (the standing tax is retired).** Given a full `npm test` on a router-connected
      instance, when it completes, then neither H8 nor H4 requires the row-150 quiesce remedy; and
      OPEN.md row 150 is flipped to `DONE` with its "until then" guidance withdrawn so no future
      session re-applies it.

## Concepts touched

None. This story is confined to test infrastructure — no domain concept is defined, read, or
changed. (The invariant the tests *guard* is architectural, not a graph concept: principle 4 /
BIBLE §30.)

## Out of scope

- **Making the tests hermetic by stopping the router from inside the suite.** Named as an option in
  row 150 ("pause/exclude router ingest for the bracket") and deliberately not chosen here: it makes
  a read-only test suite mutate the running stack, and a crashed run would leave the router stopped.
  If the Architect concludes it is the only workable shape, that is a kick-back to Planning.
- **The other seven suites that bracket strfry counts.** They already narrow their filter to a
  specific expected event and are not flaky; they are the precedent, not the work.
- **CI, the stack-free/live-API split, Playwright** — epic-level out-of-scope (OPEN.md row 13).
- **Speeding up the suites.** A large speedup is likely to fall out of this change; it is a welcome
  side effect, not a criterion.

## Open questions

- None blocking. The measurements above establish the failure mechanism; the choice of the narrowed
  fingerprint — and what residual coverage that choice gives up — is the Architect's call and should
  be recorded in an ADR, because this bracket guards a named invariant rather than ordinary behavior.

## Linked artifacts
- ADR: `engineering-team/decisions/test-suite-hermeticity/0001-author-scoped-write-assertion-brackets.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
