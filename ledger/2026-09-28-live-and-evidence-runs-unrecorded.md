# An opt-in live test class and a story's evidence runs have no required record before Review, so their results live only in a session

**Id:** 2026-09-28-live-and-evidence-runs-unrecorded
**Type:** meta
**Opened:** 2026-09-28 (tagging-edges #2 review, harness friction 1 and 2)
**Status:** OPEN
**Done:** —

**What was seen.** Story `tagging-edges` #2's live suite has an opt-in write sandbox (`TAGGING_EDGES_LIVE_WRITE_TESTS=1`)
and a read-only class that needs `NEO4J_*` in the environment. `test/registry.js` gives the suite a `skipNote`, so every
gate record shows it skipped (0/0/16) and never red. The test plan's "How to run" prescribes the live run, but no
workflow step records whether it happened. The Implementer ran both classes green before committing; nothing in the
repo said so, and the review's lenses reported the sandbox as never run until the Reviewer re-ran it.

The story's evidence runs (Open question 7: the local end-to-end backfill and its before/after graph snapshot) were
the same: taken before the implementation commit, recorded only in ephemeral scratch and a commit message. Related:
OPEN.md row 59 (live failures masked by environmental skips).

**Fix shape.** Workflow 4 (or the test-plan template) requires an "Implementation verification" entry: each opt-in or
environment-dependent test class's commit, Node version and counts, or an explicit "not run" and why. The story
template gains an "Evidence" section, and evidence runs are taken on the committed tree, as the after-gate is.

**Pointer:** `engineering-team/reviews/tagging-edges/2-gap-filling-pass-and-backfill.md` § Harness friction 1–2;
`test/tagging-edges-live.test.js`; `engineering-team/workflows/4-implementation.md`.
