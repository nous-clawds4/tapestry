# Review: Story 7 — Graph-derived twin picker

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-07
**Diff:** story `+ tests` `e0630df9`, impl `2aa8d923` on `chore/snapshot-fixture-hygiene`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/adoption-twins.test.js` — **4 passed, 0 failed** (was 3-failing pre-impl; H rows
      live).
- [x] `node test/trusted-dictionary.test.js` — **16 passed, 0 failed** (the adoption module
      changed; nearest-neighbor regression green).
- [x] `bash scripts/harness-lint.sh` — clean.
- [x] Full `npm test` — both story-relevant suites **PASS** inside the run
      (`adoption-twins: PASS 4/0`, `trusted-dictionary: PASS 16/0`); the run's Overall was FAIL
      on ONE unrelated row — `relationship-primitives-probe` H4, which brackets a whole-corpus
      strfry count and lost the race to live `strfry-router` network ingest. Dispositioned as
      environmental flake, not regression: the diff is read-only on those paths, the same suite
      passed three full runs earlier tonight on adjacent trees, and an immediate standalone
      re-run passed 9/9. Filed as **OPEN.md #150** with the mechanism and fix shape.

## Spec adherence (fast-track — Bug; Architecture skipped per the story)

- [x] **AC-1 source:** `GET /api/adoption-twins` registered in the adoption module
      ([src/api/adoption/index.js](src/api/adoption/index.js)) — Cypher over
      `ListHeader|ClassThreadHeader|ConceptHeader` scoped by the runtime TA's `39998:` uuid
      prefix; the page's twin effect fetches it and **no `api/strfry/scan` call remains in
      AdoptionQueue.jsx** (S1; the now-unused `taPubkey`/`useConfig` also removed).
- [x] **AC-2 wireability:** graph-only fixture excluded, graph+event fixture included with the
      graph's name, event-only fixture excluded (H2's three-way discrimination).
- [x] **AC-3 uniqueness:** no coordinate twice over the full live corpus (H1) — the
      `WITH h.uuid, collect(h.name)[0]` aggregation collapses the dev machine's six same-handle
      graph pairs; live endpoint shows **56 twins, zero duplicated names** (was 166 addresses
      with heavy duplication).
- [x] **AC-4 shape:** name-sorted `{handle, name}` preserved; `wireAndBroadcast` untouched.
- [x] **AC-5 regression:** `/api/adoption-queue` contract intact (H3, passes pre and post).
- [x] Manual walk: the rendered selector on the local Adoption Queue shows **56 options, zero
      duplicated names** (`concept graph` ×1, `dog` ×1 — the owner's reported symptom gone).

## Things tests can't catch

- [x] Read-only endpoint; Cypher fully parametrized (`$prefix`); no new dependencies (runCypher
      and strfryScanStream already imported by the module).
- [x] TA pubkey via `getOwnerAssistantPubkey()` — no literals.
- [x] Event-only fixtures (story-5's headers) and future orphans are structurally excluded — the
      graph is the enumeration source, so wire-only residue can never be offered again.

## Findings

### Blocking

None.

### Non-blocking

1. The six same-handle duplicate graph *nodes* still exist (collapsed at read, not cleaned) and
   the ~83 orphaned strfry husks remain on the wire — both explicitly out of scope; data-hygiene
   disposition stays with the owner.

### Harness friction

1. `relationship-primitives-probe` H4's whole-corpus bracket is flaky under live router ingest —
   filed as OPEN.md **#150** (type `bug`) with mechanism, evidence, and fix shape.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection: story 7, like story 6, is epic hygiene outside the book's F0–F5 frame
      — frame arithmetic unchanged; the standing close offer remains with the owner.
