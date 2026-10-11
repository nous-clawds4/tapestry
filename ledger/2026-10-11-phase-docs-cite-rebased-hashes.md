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

**Pointer:** `engineering-team/reviews/assistant-duty-menu/1-the-duty-menu-page-and-its-check.md` (NB13, Harness
friction).
