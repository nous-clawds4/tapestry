# Story 6: Self-cleaning snapshot fixtures — the suite's mints leave the strip

**Status:** Approved
**Created:** 2026-08-07
**Type:** Bug (test-hygiene; fast-track — Architecture skipped as obvious, the change lives in the
test suite; approved by the owner in-session 2026-08-07)

## Background

Story 5's H4 row proves the snapshot mint end-to-end, so every full suite run publishes one real,
TA-signed snapshot whose members are the two test fixture concepts. Six accumulated on the local
instance in one evening and render in the Trusted Dictionary page's "Published snapshots" strip —
the owner flagged the clutter. Every other suite already keeps surfaces clean by the same means:
teardown bare-republishes its fixtures, removing the signal the surfaces read. The snapshot mints
are the one residue class that never got that treatment (recorded as "documented residue" in the
story-5 test plan). Fix at the source — the suite cleans up after itself — rather than teaching
production read paths to filter test data (which would leak fixture knowledge into `src/` and
still leave the events visible to every other consumer).

**Who is affected:** anyone viewing a dev instance's Trusted Dictionary page after test runs; the
test suite's residue contract.

## User-facing description

As **the owner**, I want test runs to leave no visible trace in the Published snapshots strip, so
that **the dictionary page shows only snapshots a human deliberately published.**

## Acceptance criteria

- [ ] **Self-cleaning teardown:** after a full run of `test/trusted-dictionary.test.js`, the strip
      (`GET /api/trusted-dictionary` → `snapshots[]`) contains no fixture-membered snapshots —
      including any left by *earlier* runs (the teardown sweeps all of them, so running the suite
      once performs the one-time cleanup of the six existing residue snapshots).
- [ ] **Precision:** only snapshots whose member list is non-empty and consists entirely of
      `trusted-dictionary-fixture-*` coordinates are swept. A real owner-published snapshot is
      never touched. (Named edge: an owner publish clicked mid-test-window while only fixtures
      qualify is indistinguishable by content and would be swept — accepted for dev boxes.)
- [ ] **H4 unweakened:** the mint-appears-in-strip proof still executes (H4 runs before teardown);
      the suite stays green end-to-end.
- [ ] **Graph-side safety (the OPEN.md #142 class):** the bare republish of a graph-wired element
      event is verified against re-import side effects before landing — the element's Neo4j node
      survives without corruption (spike on one real residue event, result recorded in the review).

## Concepts touched

None changed. The swept events are elements of the runtime concept `trusted dictionary snapshot`
(39998:<TA>:trusted-dictionary-snapshot) — events bared on the wire; their Neo4j element nodes
remain (no element-delete primitive exists, deliberately — BIBLE §30 posture). No firmware
reinstall.

## Out of scope

- Any production-code filtering of the strip (rejected at discussion — wrong layer).
- An element-retraction/delete primitive (its own future story if ever wanted).
- Graph-side removal of the residue element nodes (invisible to this page; accepted).

## Open questions

None — direction settled at discussion 2026-08-07 (owner chose source-cleanup over UI filter).

## Linked artifacts
- ADR: skipped (fast-track; approach recorded in this story's Background)
- Test plan: story-5 plan's residue note amended in place (`5-trusted-dictionary.test-plan.md`)
- Review: (filled in after Review phase)
