# Phase 4: Implementation

## Role
Implementer. See `engineering-team/roles/implementer.md`.

## Input
- An approved user story.
- An approved ADR.
- An approved test plan with failing tests committed.

## Output
- Code that makes the failing tests pass.
- Test gate clean: `npm test` (and `npm run test:playwright` if relevant).
- Lint/typecheck/build are not configured — skip those gates unless the ADR introduced them.

## Steps

1. **Run `npm test`** first. Confirm what's actually failing right now.
2. **Re-read story, ADR, test plan** before touching code.
3. **Orient via the Concept Graph** if the change touches concepts. Call `/summaries` first.
4. **Write the smallest code** that makes the tests pass while honoring the ADR.
5. **Honor architecture rules:**
   - Concept Graph API first.
   - Three-call pattern; no `/subgraph` depth > 1.
   - Handles in `kind:pubkey:slug` form.
   - Don't load BIBLE.md/firmware JSON for concepts in the graph.
6. **Honor house rules:**
   - Concept Graph API at `localhost:8877` is authoritative.
   - Run `curl -X POST http://localhost:8877/api/firmware/install` after changing concept definitions.
   - No new lint/typecheck/build tooling without an ADR.
7. **Run the gate:** `npm test`. Must be clean. If not, fix it before claiming done.
8. **If forced outside the ADR,** stop and escalate. The ADR needs amending before you continue.
9. **Hand off:** `/review-changes`.

## Common pitfalls
- Doing more than the story asks. Add a TODO or a follow-up story instead.
- Refactoring neighbors "while we're here". Not authorized by the ADR. Don't.
- Modifying tests to make them pass. If a test is wrong, kick back to Tester.
- Forgetting the firmware reinstall after a concept-definition change.

## Per-phase commits
Yes. Commit when the test gate is clean. Reference the story and ADR in the commit message (e.g., `impl: <slug> (story #<n>, ADR <NNNN>)`).
