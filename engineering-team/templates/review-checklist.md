# Review: Story <n> — <title>

**Reviewer:** Claude (acting as Reviewer)
**Date:** <DATE>
**Diff:** `git diff <base>...HEAD` (commit <hash>)

## Quality gates (run by reviewer, not trusted)

- [ ] `npm test` — pass / fail / output
- [ ] `npm run test:playwright` (if applicable) — pass / fail / output
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence
- [ ] Every acceptance criterion has a passing test.
- [ ] No criterion is silently dropped.
- [ ] No behavior added that isn't in the story.

## ADR adherence
- [ ] Files changed match the ADR's implementation notes.
- [ ] Layering / module boundaries respected.
- [ ] No new dependencies the ADR didn't authorize.

## Concept-graph integrity
- [ ] Handles are in `kind:pubkey:slug` form.
- [ ] Firmware reinstall called out (or performed) if concept definitions changed.
- [ ] New code orients via `/api/concept-graph/summaries` rather than re-reading BIBLE.md.

## Things tests can't catch
- [ ] No secrets in committed files.
- [ ] No leftover debug logging or `console.log`.
- [ ] No commented-out code.
- [ ] Error paths and edge cases handled where it matters.
- [ ] Concurrency / race conditions considered.
- [ ] Security: input validation at boundaries, no obvious injection vectors.

## House rules check
- [ ] Concept Graph API authority respected.
- [ ] No new lint/typecheck/build tooling without an ADR.

## Findings

### Blocking
1. **<file>:<line>** — <issue>. Asked change: <change>.

### Non-blocking
1. **<file>:<line>** — <observation>. Optional improvement: <suggestion>.

## Verdict
**PASS** | **CHANGES_REQUESTED**
