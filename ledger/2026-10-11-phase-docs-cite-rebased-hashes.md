# Phase documents cite commit hashes that a later rebase onto shared `staging` orphans

**Id:** 2026-10-11-phase-docs-cite-rebased-hashes
**Type:** meta
**Opened:** 2026-10-11 (assistant-duty-menu #1, review finding NB13 and harness friction 1)
**Status:** OPEN
**Done:** —

**What happened.** Sessions that develop directly on shared `staging` rebase or cherry-pick their unpushed commits
whenever another session pushes first. The commits get new hashes, but the phase documents written in between keep
the old ones. assistant-duty-menu #1's test plan cited `7f9fdf92` and `6f9bd983`, which are not ancestors of
`staging`; the commits landed as `b2477a93` and `2a4e63ab`. Gate records (`tmp/gate-runs/*.json`) also keep the
pre-rebase hash they ran on.

**Fix shape.**
- Phase documents cite a commit only after it is on `origin/staging`, or cite the gate run id instead.
- Alternatively, a lint check (L-series) that every 7+ hex hash in a phase document resolves to an ancestor of HEAD.

**Recurred 2026-10-11 (`assistant-shared-categories` #1, Gate B review, harness friction 2).** The Implementer's
full-suite record sat on `035c80ea`. That commit was rebased onto another session's push and landed as `397d236`, so
`035c80ea` is not an ancestor of `staging`. The Reviewer re-ran the suite at HEAD for the review. The story's evidence
section now names the landed commit.

**Recurred 2026-10-12 (`assistant-coming-soon` #1, Gate B review, harness friction 3), as a sibling.** The story's
J3 full-suite record (gate run `20261012T021106Z-17851-7755`) ran on `88fa4da4+dirty`, a working tree that matches no
commit; the story says so. Its planning commits were also rebased before push (`c51ef49` stayed, the next three were
rewritten onto another book's `6bab1e5`). The reviewer's full run at HEAD `f92c462` (`20261012T025139Z-32472-0dfa`)
replaces the record.


**Recurred 2026-10-12 (book `assistant-duties-settings`).** The story's § Deviations cited `3b3b3e0ed` for R3's test
fix. A rebase onto another session's push made it `903c10e98`. The session noticed straight after the push and fixed
the citation in `36e200fcd`. The fix shape here still stands: cite commits only after the push, or cite them by subject
line.

**Pointer:** `engineering-team/reviews/assistant-duty-menu/1-the-duty-menu-page-and-its-check.md` (NB13, Harness
friction).

**Recurred 2026-10-12 (`duty-menus-and-self-maps` #3; book close, audit §7 P10).** Story 3's round-1 review commit
`18d0cb9f` was rebased onto another session's push and became `b25f89ac`. Round 2 had to show that the diff was the
same from either base (`engineering-team/reviews/done/duty-menus-and-self-maps/3-self-maps.md`:529–532), and
`18d0cb9f` is cited only in that explanation. Same fix shape. Does it port to the other flow? Yes.

**Recurred 2026-10-13 (`assistant-self-map` #4; its review, non-blocking 2 and 3).** The held Phase-3 commits were
rebased onto another session's push before Implementation. The test plan's verification cited the old ADR commit
`6f57e8e9` (now `bf16714f`), and the red-tests ledger row cited `ccc3cda0` (now `5fa417b3`). Both were corrected after
review, citing commits by subject too. To keep the hashes valid, the session then merged `origin/staging` rather than
rebasing again.
