# A non-trivial ledger-row fix (PR #787, router hardening) merged to staging with no Reviewer pass, and nothing in the harness asked for one

**Id:** 2026-10-10-ledger-fix-pr-merged-unreviewed
**Type:** meta
**Opened:** 2026-10-10 (book `relay-stream-gaps` close, audit §4 and §7)
**Status:** OPEN
**Done:** —

**What was seen.** PR #787 (`fix/router-hardening-followup`) fixed OPEN.md row `2026-09-30-router-saved-state-revalidation`:
+689 −62 across `src/api/strfry/routerConfig.js`, a new 32-test suite, docs and the BIBLE. It was written on 2026-09-30,
and the row was marked DONE that day. It was merged into `staging` on 2026-10-09 (`ff3d4e6c`, deploy #543) as the base
that book `relay-stream-gaps` built on.
- No review file names it (`git grep` over `engineering-team/reviews/` finds it only as context in the book's reviews).
- The PR has no GitHub review (`gh api repos/nous-clawds4/tapestry/pulls/787/reviews` returns an empty list).
- Story 1's review says outright: "PR #787 … was not itself reviewed; story 1 is reviewed on top of it." That Reviewer
  did check part of it: #787's restart-counting tests still held after story 1's test plan re-aimed them.

`workflows/0-intake.md` step 3 allows a hotfix outside the cycle only when it is trivial and the operator is present,
with a row naming the commit. A Standard bug otherwise gets Tests, Implementation and Review. #787 was neither trivial
nor reviewed, and no step stopped the merge. The cost here was low: story 1's review, its sandbox runs and the full
gate all ran over #787's code. But the same path can carry unreviewed code to staging on its own.

**Fix shape.** One of:
- `workflows/0-intake.md`'s hotfix clause says what "trivial" excludes (new suites, security-relevant logic, more than
  a few lines), and that a ledger-row fix above that bar gets at least a doc-lane review file before it merges.
- Or `/cycle-staging` asks, before the merge, which review covers the PR's code, and records the answer in the PR.

Either touches harness-definition paths and owes a CHANGELOG row. Ports to both flows: a Director that merges a
prerequisite PR meets the same gap.

**Pointer:** `engineering-team/audits/relay-stream-gaps/audit.md` §4 (Undocumented work) and §7;
`engineering-team/reviews/done/relay-stream-gaps/1-stream-changes-without-router-restart.md` header and Quality gates;
`ledger/2026-09-30-router-saved-state-revalidation.md`; `engineering-team/workflows/0-intake.md` step 3.
