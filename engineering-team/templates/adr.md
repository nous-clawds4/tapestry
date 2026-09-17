# ADR <NNNN>: <title>

**Status:** Proposed | Accepted | Superseded by ADR-<n>
**Date:** <DATE>
**Story:** `engineering-team/stories/<epic-slug>/<n>-<slug>.md`

## Context
What is the situation that requires a decision? Pull the relevant facts from the story plus the existing codebase. State constraints (project rules, existing libs, perf budget, concept-graph contracts) explicitly.

If the change affects concepts, name them by handle and describe their current shape (from `/api/concept-graph/node/:handle`).

No gate history here or anywhere in this ADR — don't mention prior rounds' verdicts or kick-back counts (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in `Supersedes` or gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes belong to reviews and the run journal. (ADR harness-gate-integrity/0002.)

## Options considered

### Option A — <name>
Sketch. Pros. Cons.

### Option B — <name>
Sketch. Pros. Cons.

### (Option C — <name>)
Optional third option.

## Decision
We chose **Option <X>** because <reason>.

## Consequences
- What this enables.
- What this constrains or makes harder.
- What new debt or follow-ups this creates.
- **Firmware reinstall required?** (yes/no — applies if concept definitions changed)

## Implementation notes
Specific files, function names, module boundaries. The Implementer reads this, so be concrete.

Test-file changes the ADR requires (suite re-aims, runner registration) belong to Phase 3 — the Tester's lane — never to implementation: Direction-mode Gate 4 pins an empty `test/` diff after the Gate-3 commit, and test edits during Phase 4 blur the failing-tests-first contract in the human-gated flow too. (note-tagging-inspector retro, 2026-07-18.)

**Carve-out — a story whose deliverable IS a test change** (ratified at test-suite-hermeticity #1's Phase-3 gate; OPEN.md row 167): the standing rule inverts. The Tester writes a **new guard suite** that fails against the suites under repair; Phase 4 edits those suites and is explicitly barred from touching the guard suite. The rule's purpose — an Implementer must not weaken their own judge — is preserved, while Phase 4 keeps a real, failing-test-driven deliverable. A reviewer who sees a non-empty Phase-4 `test/` diff checks which case they are in before flagging it.

- File: `path/to/file.js` — add function `doX(input)`.
- File: `path/to/other.js` — extend with the new branch.
- Concept: new handle `kind:pubkey:new-slug` with schema `{...}`; firmware definition at `firmware/concepts/<slug>.json`.

## Out of scope
What this ADR does NOT decide. (E.g., "Caching strategy is deferred to a future ADR.")
