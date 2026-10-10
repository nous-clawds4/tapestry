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

**Pointer:** `engineering-team/reviews/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md` § Harness friction 1 and Non-blocking 1
