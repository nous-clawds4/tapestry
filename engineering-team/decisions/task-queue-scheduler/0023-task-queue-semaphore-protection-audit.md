# ADR 0023: Entry-point tagging is load-bearing — audit closes subshell-chain coverage gaps

**Status:** Accepted (fast-tracked, shipped 2026-05-26)
**Date:** 2026-05-24 (audit + design) → 2026-05-26 (shipped via fast-track)
**Story:** N/A (fast-tracked per `/discuss` Option C decision 2026-05-26; original story #26 metadata stays in held-branch git history as audit trail)
**Builds on:** ADR 0013 (`neo4j-heavy` resource-class semaphore). Made load-bearing by ADR 0024 (scheduled-task timeout propagation) + ADR 0025 (kill timeout-orphans by default), both shipped 2026-05-25/26 — those fixes restored the semaphore mechanism that this ADR's parent-tag audit assumes.

## Summary

Documents the convention that every entry-point in a tagged `neo4j-heavy` task's invocation chain must itself be tagged, and ships the audit-driven tag-additions for the two outstanding gaps (`processAllTasks`, `processNpubsUpToMaxNumBlocks`).

The full convention text, audit method, audit-results table, and architectural property explanation live in [ADR 0013's "Protection model" amendment](0013-task-queue-neo4j-resource-class.md#protection-model--entry-point-tagging-is-load-bearing-amended-2026-05-24-adr-0023). The operator-facing convention summary lives in [BIBLE.md §24](../../BIBLE.md). The 6 structural sentinels that pin the audit's deliverables live at [`test/task-queue-semaphore-protection-audit.test.js`](../../test/task-queue-semaphore-protection-audit.test.js).

## History (why this file is a stub)

The full design work — Options A/B/C deliberation, dormant-child-tag retention rationale, deployment dry-run, Implementer outcome contract, plus two later amendments (1) scoping JS-driven `child_process.exec` from API handlers out as a separate intake, and (2) documenting the operator-observed discrepancy that became the investigation behind ADR 0024 — was completed across 6 commits on branch `fix/launch-child-task-protection-audit`. That branch was held unmerged while the underlying semaphore mechanism was broken (the ~6s-release bug that surfaced during the planned review). Once ADR 0024 + ADR 0025 restored the mechanism, the audit's *value* (registry tag additions + ADR 0013 amendment + BIBLE.md §24 paragraph + 6 sentinel tests) was carried forward via fast-track per Option C of the 2026-05-26 `/discuss` decision; the held branch's full ADR (with its "premise undermined" amendments), story file, test plan, and withdrawn-verdict review report stay in git history as the audit trail rather than landing on main where the now-obsolete warning amendments would confuse future readers.

The held branch's content can be inspected via git:

```bash
git log fix/launch-child-task-protection-audit
git show fix/launch-child-task-protection-audit:engineering-team/decisions/0023-task-queue-semaphore-protection-audit.md
git show fix/launch-child-task-protection-audit:engineering-team/stories/26-task-queue-semaphore-protection-audit.md
git show fix/launch-child-task-protection-audit:engineering-team/reviews/26-task-queue-semaphore-protection-audit.md
```

## Out of scope

- **JS-driven `child_process.exec` from legacy API handlers** — 5 endpoints that bypass `launchChildTask.sh` entirely. Filed as a separate 2026-05-24 intake in `engineering-team/stories/_intake.md`. Different mitigation shape (refactor handler to enqueue via BullMQ, deprecate endpoint, or accept) than the subshell pattern this audit addresses.
- **Programmatic registry-walking validator** that would automatically enforce the parent-tag convention at boot or in CI. Held-branch ADR 0023's Option C; rejected as premature.
- **Refactoring parent scripts to invoke children via `/api/run-task`** (held-branch ADR 0023's Option B from `/discuss`). Substantial architectural change; deferred indefinitely.
