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

> **Docs-mode / doc-lane variant:** there are no ACs and no test surface — replace this section with a **claims-adherence table**: one row per substantive claim the document makes, with the evidence that verified it (file read, command run, source checked). The *Quality gates* section records the doc-facing checks actually performed (links resolve, cross-references accurate, index rows updated). File the review under the non-numbered form (0-intake §3).

> **Test-deliverable stories** (the deliverable IS a test change): a non-empty Phase-4 `test/` diff is expected, not a violation — verify which case applies per the carve-out in `templates/adr.md`: Phase 4 may edit the suites under repair and MUST NOT touch the Tester's guard suite.

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

## Product-guide adherence *(when the story traces to a PRD)*
- [ ] Copy matches the style guide's canonical table verbatim.
- [ ] Design-guide patterns honored (tokens/components, not raw values; designed empty/loading/error states).

## Findings

### Blocking
1. **<file>:<line>** — <issue>. Asked change: <change>.

### Non-blocking
1. **<file>:<line>** — <observation>. Optional improvement: <suggestion>.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. <or "none">

## Verdict
**PASS** | **CHANGES_REQUESTED**

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place.
- [ ] Completion detection performed; the result and any book arithmetic recorded in the run journal (Direction) or the chat (human-gated) — never in this file. `/close-book` offered if the book looks complete.
