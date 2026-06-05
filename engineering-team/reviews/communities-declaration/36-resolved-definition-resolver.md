# Review: Story 36 — §26 Resolved-Definition resolver

**Reviewer:** Claude · **Date:** 2026-06-05 · **Type:** Feature (substrate; contract = ADR 0028, no new ADR).

## Quality gates
- [x] `node test/test.js` — **resolved-definition-resolver 7/7**; Overall PASS, no regression.
- [x] `npm run lint` / `npm run build` — clean (verified in the Block 2 batch).

## Spec adherence (vs §26 / ADR 0028)
- [x] `mergeDefinition` whole-field replace: non-empty child overrides, empty/absent inherits (incl. empty topics array) — T2/T3/T4.
- [x] `resolveDefinition` async **live** walk via injected `fetchByATag` (no snapshot) — T7.
- [x] **First-listed-wins**: parents folded in reverse so the earliest `b` parent merges last and wins — T6, matches ADR 0028's precedence.
- [x] **MAX_DEPTH = 16** + visited-set **cycle-guard that truncates** (never throws) — T5; matches the read-path "degrade gracefully" decision.
- [x] Set-valued override algebra correctly **deferred** (whole-field replace only).

## Findings
**Blocking:** none.
**Non-blocking:**
1. `mergeDefinition` only knows the four definition fields (`name, description, belongingBar, topics`). New CD fields must be added to `DEFINITION_FIELDS`. Acceptable + documented.
2. The resolver is client-side (per ADR 0029's strangler/direct-relay stance). A server/graph-side resolver, if ever needed, is separate.

## Verdict
**PASS.** Faithful client implementation of the §26 contract. Unblocks Block 2's fork + inherited-field display.
