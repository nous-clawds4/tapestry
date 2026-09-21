# On a later review round the Implementer appends Deviations but is not asked to revise ones the fix has made false, so the story's record can contradict itself

**Id:** 2026-09-21-deviations-not-revised-on-rework
**Type:** meta
**Opened:** 2026-09-21 (setup-status-and-alert #1, review round 2, harness friction 1)
**Status:** OPEN
**Done:** —

Implementer step 9 (`engineering-team/roles/implementer.md:47`) says to log judgment calls under
`## Deviations`. It says nothing about the Deviations already there when a review sends the work
back.

In setup-status-and-alert #1, round 2's fix (a conditional reset of the held answer during render)
added a "Review round 2" sub-bullet. But it left the bullet above it saying the provider "calls
`setState` only in the fetch's callbacks", which the fix had just made false. The round-2 Reviewer
caught it (Non-blocking 1). It was corrected in a separate docs commit after the round-2 review.

Round 1's blocking finding also rested partly on a Deviation that stopped short of the case it
missed: "an answer for a previous account is never shown", which said nothing about the same account
signing back in.

**Why it matters:** the book close harvests Deviations into the build audit. A self-contradicting
Deviation becomes a false line in the as-built record.

**Fix shape:** a line in Implementer step 9, or in workflow 4's rework path. When a review has asked
for changes, re-read every Deviation that describes the code the fix touches, and revise it rather
than only appending. The Reviewer's round-N check then covers the revised text as a fresh claim, as
roles/reviewer.md step 10 already asks.

**Pointer:** `engineering-team/reviews/setup-status-and-alert/1-setup-shows-where-you-stand.md`
§ Round 2, Non-blocking 1 and Harness friction 1.
