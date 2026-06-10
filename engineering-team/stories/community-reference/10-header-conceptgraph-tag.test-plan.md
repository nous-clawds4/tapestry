# Test Plan: Story 10 — Header→ConceptGraph self-describing tag (hybrid)

**Story:** `engineering-team/stories/10-header-conceptgraph-tag.md`
**ADR:** `engineering-team/decisions/0007-header-conceptgraph-tag.md`
**Date:** 2026-05-19

## Approach
Precedent: stories #5/#6/#8. The spec-required change is a single deterministic tag emission in `handleCreateConcept`. A source/structural sentinel pins the contract without prescribing pre- vs post-sign computation. Whether the emitted 39998 event actually carries the tag with the right value after a real firmware reinstall is **not** reproducible in the hand-rolled Node runner — that is the **authoritative cycle-local smoke** (Reviewer-required).

## Coverage map

| AC | Test / mechanism | File | Level |
|---|---|---|---|
| AC-1 (new header carries deterministic tag) | **T1** pins the `["concept-graph","39999:…-concept-graph"]` emission in `handleCreateConcept`; the *actual emitted event value* is **smoke S1** | test/header-conceptgraph-tag.test.js | source + smoke |
| AC-2 (firmware reinstall → headers carry it; idempotent) | Deterministic value ⇒ idempotent by construction; **smoke S2** (reinstall twice, identical) | — | smoke |
| AC-3 (tag-absent headers resolvable by compute rule) | Documented contract (BIBLE); the *consumer* is stream #5 — pinned here only as documentation, exercised by #5 | — | doc / #5 |
| AC-4 (zero behavior change for non-readers) | **R1** guards the existing header builder; nothing reads the tag (no consumer this story) | test/header-conceptgraph-tag.test.js | source (sentinel) |
| AC-5 (BIBLE documents tag + contract) | Verified by reading the BIBLE diff at Review | BIBLE.md | doc |

T1 = FAIL pre-impl, PASS post. R1 = PASS pre AND post (out-of-scope guard on the existing 39998 header tag shape).

## Edge cases
- [x] **No false-match on existing `concept-graph` strings.** The T1 regex is anchored on a tag-literal start (`['concept-graph',` then a `39999:…-concept-graph` value). It does NOT match NODE_ROLES' `'concept-graph'` role string, the `concept-header-for-the-concept-of-…` slugs, or `['z', firmware.conceptUuid('concept-graph')]` — confirmed: T1 FAILs pre-impl.
- [x] **Pre/post-sign agnostic.** T1 matches whether the value is a template literal, string concat, or built from the signing pubkey post-sign — only the `['concept-graph', …39999:…-concept-graph…]` shape is required, not a specific code path.
- [ ] **Actual emitted event value / idempotency / firmware-header backfill** — not catchable in source; that's smoke S1/S2.

## Not covered (deferred to cycle-local smoke — authoritative, Reviewer-required)
Run on the local docker stack (`:7778` per this env; `cycle-local`):

**S1 — AC-1 (real emission):** `POST /api/firmware/install`, then `strfry scan '{"kinds":[39998]}'`; assert the `nostr-relay` header event carries a tag `["concept-graph","39999:<local TA pubkey>:nostr-relay-concept-graph"]`. Also create an ad-hoc concept via `POST /api/normalize/create-concept` and assert the same shape on its header.

**S2 — AC-2 (idempotent):** re-run firmware install; the header's `concept-graph` tag value is identical (deterministic; kind-39998 replaceable — no divergence).

**S3 — AC-3 (compute fallback, documentation check):** confirm BIBLE §5 states the `tag-if-present else compute 39999:<pubkey>:<slug>-concept-graph` resolution contract (the consumer is stream #5; nothing resolves it here).

## Test infrastructure
- Existing hand-rolled Node runner (`npm test` → `test/test.js`); no new deps/framework. Registered: `headerConceptGraphTag`.
- Asserts against `src/api/normalize/index.js`. No Playwright (externally-dependent firmware-install + strfry round-trip → smoke, per precedent).

## How to run
```
npm test
```
Targeted: `node -e "require('./test/header-conceptgraph-tag.test.js').run()"`

## Verification
New test fails on the pre-implementation tree (working tree atop ADR commit `f052984e`):

```
header-conceptgraph-tag suite:
  ✗ T1: handleCreateConcept emits the deterministic concept-graph tag on the 39998 header (AC-1, ADR 0007)
  ✓ R1: the existing 39998 header tag builder is preserved (regression guard)
header-conceptgraph-tag suite:                   FAIL (1 passed, 1 failed)
Overall:                                         FAIL
```
(Filled from the actual run below.)
