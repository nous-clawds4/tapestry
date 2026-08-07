# Review: Story 6 — Self-cleaning snapshot fixtures

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-07
**Diff:** `git diff 7f2b4b28...HEAD` on `chore/snapshot-fixture-hygiene` (story `+ impl`, impl `42600a33`)

## Quality gates (run by reviewer, not trusted)

- [x] `node test/trusted-dictionary.test.js` — **16 passed, 0 failed, 0 skipped** with the new
      teardown live (H rows executed against the stack).
- [x] `bash scripts/harness-lint.sh` — clean (0 violations).
- [x] Full `npm test` not re-run for this story: the diff touches only the story-6 suite's own
      teardown, its header comment, and two docs — no `src/`, no other suite, no runner change.
      The merged tree at the branch base was full-suite green tonight (twice).

## Spec adherence (fast-track — Bug/test-hygiene; Architecture skipped as recorded in the story)

- [x] **AC-1 self-cleaning + one-time cleanup:** post-run strip = **0 snapshots** (was 6); the
      run's own H4 mint plus all five prior residue snapshots swept in one pass — the sweep scans
      the live strip, not just this run's mint, so the one-time cleanup happened by running the
      suite once, as the story specifies.
- [x] **AC-2 precision:** sweep requires non-empty members ∧ every coord prefixed
      `39998:<TA>:trusted-dictionary-fixture-`; a real snapshot (any non-fixture member, or
      empty members) is skipped. The named mid-test-window edge is recorded in the story.
- [x] **AC-3 H4 unweakened:** the mint-appears-in-strip assertion still runs before teardown and
      passed in the gate run.
- [x] **AC-4 graph-side safety:** spiked on the real date-only residue event before implementation
      — publish succeeded, strip dropped 6→5, and the Neo4j node was untouched (same uuid, name
      byte-identical); post-run, all 7 element nodes ("dictionary 2026-08-07…") remain with names
      intact. The OPEN.md #142 re-import class does not fire on plain strfry publishes (that
      incident was the self-declare path's explicit re-import).
- [x] User-facing outcome verified in the browser: the local page renders console-clean with no
      "Published snapshots" section (the strip renders only when non-empty).

## Things tests can't catch

- [x] No production code touched — zero risk to staging/prod behavior; the strip's emptiness on
      dev is data-truth, not filtering.
- [x] The sweep uses the suite's existing idioms (`publishTaEvent` with the nextStamp discipline,
      host-fetch scan) — no new mechanisms.
- [x] Teardown lives in H5's `finally`, so it runs even when earlier H rows fail.

## Findings

### Blocking

None.

### Non-blocking

1. **Graph-side element nodes still accumulate** (7 now, +1 per run, invisible to every
   user-facing surface). Accepted in the story's Out of scope; an element-retraction primitive
   remains future work if ever wanted.

### Harness friction

None.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection: story 6 is epic hygiene outside the book's F0–F5 frame — the frame's
      completion arithmetic is unchanged (6/6, close already offered; the offer stands with the
      owner).
