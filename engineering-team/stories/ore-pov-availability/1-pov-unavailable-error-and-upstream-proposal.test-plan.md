# Test Plan: Story 1 — POV-unavailable error — never substitute, propose upstream, document

**Story:** `engineering-team/stories/ore-pov-availability/1-pov-unavailable-error-and-upstream-proposal.md`
**ADR:** `engineering-team/decisions/ore-pov-availability/0001-pov-unavailable-semantics-and-upstream-proposal.md`
**Date:** 2026-08-12

## Coverage map

All tests live in the existing hermetic suite `test/open-ranking-stats.test.js` (already registered in `test/test.js` — no runner change). The new `P*` section is additive; a deliberate feature of this plan is that **AC2 and AC3 are pinned by existing, unmodified tests** — their continued passing *is* the no-regression proof.

| Criterion | Test name | Test file | Level | New? |
|---|---|---|---|---|
| AC1 — informative refusal (gate ON) | `P1` — 422 X-Reason states unavailability + names the registry-derived default algorithm; body is the bare error object (no stats fields); scores never fetched | `test/open-ranking-stats.test.js` | unit (injected deps) | **new** |
| AC1 (never-substitute at the fetch level) | `B5` — unprovisioned pov → 422 + X-Reason present, scores never fetched | same | unit | existing, unmodified |
| AC2 — anti-oracle unchanged (gate OFF) | `G1` (oracle never runs), `G2` (provisioned ≡ unprovisioned byte-for-byte) | same | unit | existing, unmodified |
| AC3 — provisioned regression guard (gate ON) | `B4`, `G3`, `B12` (owner-pov variant) | same | unit | existing, unmodified |
| AC4 — upstream proposal artifact | `P2` — artifact exists; contains `### Unavailable pov`, the MUST-NOT-fall-back sentence, `422 Unprocessable Content`, `X-Reason`, the `202`/`Retry-After` split, target `01.md`, `Closes #8`, wds4 authorship | same | structural (file content) | **new** |
| AC4 — `protocols/upstream/` indexed | `P5` — protocols/README.md layout gains `upstream/` | same | structural | **new** |
| AC5 — docs page | `P3` — never-substitute guarantee, client recovery (request the default global algorithm), upstream issue link | same | structural | **new** |
| AC5 — worksheet tracking | `P4` — W12 carries the artifact path, the 2026-08-12 date, the story ref, AND its pre-existing oracle history intact (append-only guard) | same | structural | **new** |

## Edge cases

- [x] **Registry drift immunity:** P1 derives the expected alternative id from `buildCapabilityResponse()` (the ORE-01 "first element = default" rule) rather than hardcoding `'graperank'` — a future default rename can't silently decouple the guidance from the capability doc.
- [x] **Informative string must not leak into the gated path:** existing `G2` asserts gate-CLOSED X-Reason equality between provisioned/unprovisioned povs; if the Implementer accidentally routed the new reason through the gate-closed branch, G2 breaks.
- [x] **Missing-pov (gate ON) stays a distinct error:** `B6` (unmodified) — the client-mistake 422 is not required to carry the availability guidance.
- [x] **Worksheet update is append-only:** P4's history assertion fails if the W12 rewrite loses the enumeration-oracle finding.
- **Not automated (deliberate):** the [BIBLE.md:1726](../../../BIBLE.md) quoted-string touch-up (ADR §Implementation notes 2) — prose-pinning a 4k-line living doc is brittle; the Reviewer audits it manually at Phase 5.

## Test infrastructure

- Framework: the repo's hand-rolled runner — `npm test` (entry `test/test.js`); this suite also runs standalone via `node -e "require('./test/open-ranking-stats.test.js').run()"`.
- Hermetic: pure builders + injected deps (ADR open-ranking/0001 seam). No live Neo4j/Meili/concept-graph API, no firmware precondition, no Playwright.
- Fixtures: the suite's existing `makeDeps()` spies (`_provisionedCalls`, `_fetchCalls`) and hex fixtures (`UNPROV_POV` etc.).

## How to run

```
npm test
```

Single-suite (fast):

```
node -e "require('./test/open-ranking-stats.test.js').run().then(r => console.log('pass:', r.pass, 'fail:', r.fail))"
```

## Verification

The new tests fail with the current code, each for its intended reason (not an import/typo error), and all 24 pre-existing tests pass. Confirmed 2026-08-12 at commit `8665802e`:

```
  ✓ (24 pre-existing tests pass — S1–S2, C1–C3, B1–B13, G1–G3, V1, E1–E2)
  ✗ P1 (AC1, gate OPEN): the unprovisioned-pov 422 X-Reason explains unavailability AND names the default global algorithm; the body is the bare error object with no stats fields
      X-Reason must STATE the unavailability ("personalized scores are not available…") — a bare refusal fails AC1's informative-refusal requirement; got "pov not provisioned".
  ✗ P2 (AC4): the upstream proposal artifact exists and is submission-ready (verbatim spec text + PR title/description)
      protocols/upstream/ore-01-pov-unavailable.md does not exist yet — the Implementer must create the upstream proposal artifact (ADR ore-pov-availability/0001 §Implementation notes 4).
  ✗ P3 (AC5): /developers/open-ranking documents the contract — never-substitute guarantee, client recovery, upstream link
      the docs page must state the never-substitute guarantee (results are never silently computed from another point of view) — the word is absent today.
  ✗ P4 (AC5): worksheet W12 records the upstream proposal (artifact path, date, story ref) without losing its history
      W12 must point at the drafted proposal artifact (protocols/upstream/ore-01-pov-unavailable.md).
  ✗ P5 (AC4): protocols/README.md indexes the new upstream/ directory in its layout block
      protocols/README.md must gain the 'upstream/' layout line (ADR ore-pov-availability/0001 §Implementation notes 5) — proposals to external protocols need a discoverable home.
TOTAL pass: 24 fail: 5
```
