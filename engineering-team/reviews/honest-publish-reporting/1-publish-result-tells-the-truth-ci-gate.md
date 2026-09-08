# Review: Story 1 (follow-up) — the nostr-tools version gate on the publish suite

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-08
**Diff:** `git diff origin/staging...HEAD` (branch `fix/honest-publish-reporting-ci-skip-guard`;
guard `9083baae`, implementation `b41fbd6f`)
**Mode:** test-deliverable carve-out (ADR template; OPEN.md row 167) — the Tester wrote the guard
suite, Phase 4 repaired the suite beneath it and is barred from editing the guard.

## Quality gates (run by reviewer, not trusted)

- [x] **Carve-out honored.** `b41fbd6f` touches exactly one file,
      `test/honest-publish-reporting.test.js`. `git show --stat b41fbd6f -- <guard>` is empty: the
      Implementer did not edit their own judge.
- [x] **Suites run by me, all green:**

      honest-publish-reporting            10 passed, 0 failed, 0 skipped
      honest-publish-reporting-ci-guard    5 passed, 0 failed, 0 skipped
      global-publish-gate                  8 passed, 0 failed
      honest-broadcast-reporting           15 passed, 0 failed, 0 skipped
      treasure-map-relay-presence          35 passed, 0 failed
      tl-treasure-map-optin-publish        23 passed, 0 failed
      event-tagging-write-path             19 passed, 0 failed

- [x] **CI's condition reproduced by me**, by moving `ui/node_modules/nostr-tools` aside:
      `honest-publish-reporting: 2 passed, 0 failed, 8 skipped` — previously `9 passed, 1 failed`.
      Directory restored and re-verified at 2.23.3.
- [x] `harness-lint.sh` — clean (0 violations).

## Spec adherence

- [x] Every guard requirement has a passing test.

  | # | Requirement | Status |
  |---|---|---|
  | `Q1` | suite exports `nostrToolsVersionGate` + `SKIP_REASON` | pass |
  | `Q2` | mismatch yields a reason naming both versions | pass |
  | `Q3` | matching versions do not skip | pass |
  | `Q4` | pin read from `ui/package-lock.json`, never hardcoded | pass |
  | `Q5` | suite does **not** skip where ui/ pinned deps are installed | pass |

- [x] **The explicitly rejected shortcut was not taken.** The test plan named loosening `D1` to
      accept either `refused` or `unreachable` as the fix that must not be made, because that
      assertion encodes ADR 0001's decisive constraint. Verified directly: the diff of `D1` contains
      no removed lines — only the one-line skip guard was added. Its assertions are intact.
- [x] **The second shortcut was also not taken.** `G1` and `S1` are ungated (`grep` for `SKIP_REASON`
      in their bodies returns 0), so the stack-free run retains real coverage instead of going green
      by skipping everything — the failure mode `Q5` exists to catch.

## ADR adherence

- [x] No production code changed; ADR 0001's classification contract is untouched.
- [x] No new dependencies, no new lint/typecheck/build tooling.
- [x] The skip idiom (`return 'SKIP'`) matches the repo's existing precedent
      (`adoption-candidates-queue.test.js`), not a new mechanism.

## Concept-graph integrity

- [x] Not applicable — no concept handles, no graph writes, no firmware implications.

## Things tests can't catch

- [x] **The gate fails safe in every direction.** I probed it directly rather than reading it:

      match (2.23.3/2.23.3) -> RUN      mismatch (2.10.4/2.23.3) -> SKIP
      resolved null         -> SKIP     pinned null              -> SKIP
      both null             -> SKIP     empty object             -> SKIP

      Only an exact version match runs. Every uncertain case skips, matching the house principle
      the sibling core states outright — fail toward honesty rather than toward the cheerful answer.
- [x] The gate resolves with the *identical* `require.resolve('nostr-tools/pool', { paths: [UI] })`
      call that `esmPoolPath()` uses, so it cannot report agreement while the harness loads something
      else.
- [x] No secrets, no debug leftovers, no commented-out code.
- [x] The skip reason is printed once per run and names both versions and the remedy
      (`npm ci` in ui/), so a CI reader is not left guessing.

## House rules check

- [x] No new test framework; existing hand-rolled runner and SKIP convention.
- [x] Registration in `test/test.js` complete at all four integration points (require, run, summary
      line, overall gate, skipped tally).

## Findings

### Blocking

None.

### Non-blocking

1. **CI still has no real coverage of this suite — and the fix is one line.** Eight of ten tests now
   skip in CI, permanently, because `ui/node_modules` is never installed there. The honest framing is
   that CI never *had* valid coverage: the previous `9 passed` was measured against a library
   production does not ship and meant nothing. So this change improves truthfulness rather than
   reducing coverage. But the *real* fix is a CI step (`npm ci --prefix ui`) that would let the suite
   actually exercise the shipped version. The Tester scoped it out deliberately as a workflow change
   with its own cost; it should not be lost. **Ask:** an OPEN.md row.

2. **The production fragility this exposed is still unaddressed** (carried forward from the first
   review of this story). `ui/src/utils/nostrPublish.js` classifies `unreachable` by
   `startsWith('connection failure:')` — a nostr-tools **internal message format**, not a public
   contract. This gate makes the *tests* notice a version mismatch; it does nothing to protect
   production. A future dependency bump could silently turn `unreachable` back into `accepted`,
   regressing into the exact defect this story fixed. ADR 0001 chose that signal knowingly as the
   only one available, and nothing currently pins it. **Ask:** an OPEN.md row, independent of this
   change.

### Harness friction

1. **`/cycle-staging` merges without ever inspecting PR check status.** `stack-free` **did** run on
   the staging PR (#605) and **did** fail, 56s in — the signal existed before that merge. It is not a
   *required* check for `staging`, so the merge proceeded, and the failure only surfaced later at the
   prod gate where it is required. The skill's procedure runs the deploy-safety check (which asks
   "is the target instance busy?") but has no step that runs `gh pr checks` (which asks "is this
   change actually green?"). Those are different questions and only one is being asked. **Ask:** an
   OPEN.md row proposing a `gh pr checks` step in `/cycle-staging` before the merge — cheap, and it
   would have caught this at the staging gate instead of mid-promotion.

## Verdict

**PASS**

The change does one thing and does it honestly: it stops a suite from asserting things that cannot
be true of the shipped code, without weakening a single assertion. Both shortcuts that would have
produced a green CI for the wrong reason — loosening `D1`, or gating everything — were available,
were named in advance as failures, and were not taken; I verified both by diff rather than by
description. The gate fails safe in every input direction I could construct. What remains open is
recorded above and is larger than this change.

## On PASS (same commit)
- [x] Story `**Status:**` already `Done` from the first review; unchanged (this is a follow-up
      review of the same story, not a new one).
- [x] Completion detection performed; result reported in chat, not recorded here.
