# Merging a parallel book into a story branch can make that story's Deviations untrue, and nothing re-checks them

**Id:** 2026-10-09-merge-stale-story-deviations
**Type:** meta
**Opened:** 2026-10-09 (assistant-trusted-content-status #1, review)
**Status:** OPEN
**Done:** —

assistant-trusted-content-status #1 logged a Deviation saying it built the hub's Done look first. Before Review,
merging origin/staging brought in assistant-outbox-relays #1's identical build. The merge took staging's side, and the
Deviation became untrue: the story's diff no longer adds any of it. The fresh Reviewer caught it. The book's § Shared
lines asks for `git merge-tree` before Implementation and Review, but nothing asks for the story's own claims to be
reconciled after such a merge. Book close copies Deviations into the as-built record, so a stale one credits the wrong
book.

Fix shape: after merging a parallel book into a story branch, re-read the story's Deviations (and any "built here"
wording in the test plan) against `git diff origin/staging...HEAD`. One line in workflows/4-implementation.md or in the
book template's § Shared lines would do.

**A second, related gap:** staging moved again while the review ran, and the next merge (of
`assistant-profile-checklist`) conflicted in five files *after* the PASS. The deploy skill (`cycle-staging`) says to
surface conflicts, not resolve them. The owner chose to resolve them, re-run the books' suites, and have a fresh
reviewer audit only the merge (an addendum to the same review file, PASS). Nothing in the harness names that step; it
worked here and could be the rule whenever a post-review merge changes reviewed lines.

**Pointer:** `engineering-team/reviews/done/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md` § Harness friction 1 and Non-blocking 1
