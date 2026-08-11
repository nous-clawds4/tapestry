# Epic: test-suite-hermeticity

**Created:** 2026-08-10
**Status:** In Progress

## Goal

Make the test suites answer their own question and nothing else. A test that goes red for a reason
unrelated to its assertion is not a weak test — it is an **absence of a test**, plus a recurring tax
on every gate that runs it. This epic removes the environmental couplings that make suites report on
the machine's ambient state instead of on the code under test.

Named in OPEN.md row 13 (2026-07-02 harness sweep) and reinforced by its reviewer input (PR #337,
vcavallo): *"a CI gate must surface flakes, not normalize retry-until-green."* This epic is where
that normalization gets undone, one coupling at a time.

## Why it matters

Retry-until-green is not a workaround; it is a slow leak. Each spurious red costs a human the
judgment call "is this real?", and the cheapest way to answer it — re-run, or quiesce and re-run —
trains everyone to discount that suite's verdict. Once discounted, a **true** red in the same test
is indistinguishable from the noise, and the assertion has stopped protecting anything.

Row 150's flake is the worked example: it guards a **principle-4 invariant** (the relationship
primitives are strfry-free — BIBLE §30), which is exactly the class of assertion that must stay
trustworthy, and it is the one that had degraded furthest.

## Stories

`stories/test-suite-hermeticity/`:

1. **narrow-strfry-write-assertion-brackets** — the two whole-corpus `scan/count` brackets in
   `relationship-primitives` H8 and `relationship-primitives-probe` H4 measure the entire strfry
   corpus, so live `strfry-router` ingest inside the bracket window fails them. Closes OPEN.md
   row 150.

## Out of scope (whole epic, unless a later story says otherwise)

- **The CI job** and the stack-free/live-API suite split — OPEN.md row 13 (b) and (c). This epic
  fixes couplings; standing up CI is its own story and depends on the split.
- **Playwright / e2e in CI** — explicitly deferred by row 13's reviewer input (heavy dependency
  setup, relay-state pollution). The hosted-throwaway-relay question belongs to that later phase.
- **Rewriting suites that are merely slow.** Slow is not flaky. Only couplings that produce wrong
  verdicts are in scope.

## Related

- OPEN.md row 13 — the parent finding (test-suite hermeticity + no CI).
- OPEN.md row 150 — the six-sighting flake story #1 closes.
- `docs/HARNESS_REVIEW_HANDOFF_2026-07-02.md` §4.1 R-E3.
