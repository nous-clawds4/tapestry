# A full-gate baseline taken at the failing-tests commit hides regressions the story's own tests introduce

**Id:** 2026-10-02-gate-baseline-hides-story-regressions
**Type:** meta
**Opened:** 2026-10-02 (tagging-edges #5 review 1, harness friction)
**Status:** OPEN
**Done:** —

**What was seen.**
- **Where the baseline came from.** For story 5's Implementation, the full-gate baseline was taken at the
  failing-tests commit (`b6726818`), not at a tree from before the story. The story's own new suite was therefore
  already in it.
- **What it hid.** One test in that suite (SR34) used a pattern that a stack-free source guard forbids, so
  `gate-result-record` went red. It was red in the baseline and in the after run alike, so the suite-by-suite
  comparison filed it under "standing live-stack failures".
- **What it caused.** The story's § Evidence repeated that claim. Only the review's independent runner caught it, by
  comparing against earlier records. CI's required stack-free job would have failed the PR.

**Fix shape.**
- Take the comparison baseline from the tree before the story's test commit: the ADR commit, or the story's branch
  point. A red-to-green check of the story's own suites is a separate step.
- Name the standing set by checking it against an earlier record from another branch, not by "red in both runs".
- Say this in `engineering-team/workflows/4-implementation.md` (the gate step), and in the host-gate note the
  sessions use.

**Pointer:** `engineering-team/reviews/tagging-edges/5-real-time-path-switch.md` § Findings, blocking 1 and 2, and §
Harness friction.
