# Two books designed the same top-bar spot in parallel, and no phase re-read the shared line before Review

**Id:** 2026-09-22-parallel-books-no-shared-line-recheck
**Type:** meta
**Opened:** 2026-09-22 (assistant-management #2, Review and its fix round; local date 2026-09-21)
**Status:** OPEN
**Done:** —

**What happened.** Two books put a pill in the same place, beside every avatar menu:
- setup-status-and-alert #2, the Setup Alert;
- assistant-management #2, the Assistant Alert.

The second one designed, tested and built as if it landed first.

- **The ADR checked, but only its own base.** ADR assistant-management/0002 (17:17 EDT) verified
  "setup-status-and-alert #2 is Approved and has no ADR" against `origin/staging` at `383f99e5`, and that
  was true there. That story's ADR was already committed on its own branch at 15:59.
- **The other story landed in between.** It was implemented at 17:27, reviewed at 18:21 and merged to
  staging at 18:26 (PR #737). That was three minutes after this branch's implementation commit.
- **The epic named the risk, and no phase acted on it.** It said: "Whichever story lands second fits in
  beside the other".
- **Review caught it, by a trial merge** (`git merge-tree --write-tree HEAD origin/staging`). It conflicted
  at all four mounts (review 2, Blocking 1).
- **What the fix round cost:**
  - a merge;
  - an ADR amendment choosing side by side over one slot;
  - corrections to two books' records;
  - re-measuring every width. The new B9 found sideways scrolls at 320, 560 and 656 px, and the fixed
    header growing by 16 px;
  - re-aims in four places in the other book's suite.

**Why it happens.** Every phase reads the shared line as of its own branch point. Nothing re-reads it before
code is written or reviewed. The Architect reads the shared line, not the in-flight branches that the epic's
"Open work this epic touches" names.

**Fix shape** (review 2, harness friction 1):
- **At Phase 4 start, and again at Review:** `git fetch`, then `git merge-tree --write-tree HEAD origin/staging`.
  A conflict in the story's own files sends the story back to Architecture.
- **Where an epic names another in-flight story,** the Architect also reads that story's branch, not only
  the shared line.

The memory note "re-fetch staging before 'doesn't exist yet'" states the same lesson for single claims.
This is its phase-level form.

**What the fix round adds.** The shared line's suite is re-aimed in the merge commit or just after it, and
that re-aim has the same blind spot.
- **Only part of the suite was run.** After the merge, the Tester re-aimed the other book's host row and
  its B9, which named the moved address. Then only that suite's B3 and B9 were run.
- **The whole suite, run later, found two more.** In B11, "…stays when there is no pill" failed, because
  this book's pill hides the same text. Test Design's watch item had said the pill "removes no control";
  it does hide text, and B11 asserts on that text.
- **The fix-shape clause:** after merging a shared line, run the whole of every suite the merge brings in
  that touches the same surface, not only its re-aimed tests.

**Pointer:**
- review `engineering-team/reviews/done/assistant-management/2-the-assistant-alert.md`, Blocking 1 and harness
  friction 1;
- ADR `engineering-team/decisions/done/assistant-management/0002-one-top-bar-alert-slot-setup-first.md`,
  Amendment 1;
- test plan `engineering-team/stories/done/assistant-management/2-the-assistant-alert.test-plan.md`, § Verification
  "After review 2".
