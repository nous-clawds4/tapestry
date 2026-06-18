# Test Plan: Story 2 (tag-federation, Half 2 — Part A) — Seed the pointer-`b` map on the three tag concepts

**Story:** `engineering-team/stories/tag-federation/2-per-concept-b-tag-seeds.md`
**ADR:** `engineering-team/decisions/tag-federation/0002-per-concept-b-tag-seeds.md`
**Prereq (primitive, NOT re-tested here):** `engineering-team/decisions/community-reference/0034-b-tag-primitive-emitter-derivation.md` (Done) — covered by `test/b-tag-primitive.test.js`.
**Date:** 2026-06-17

## What this story is (and what that means for testing)

This story is a **pure manifest DATA change**: it adds three `communityReference` blocks to
`firmware/active/manifest.json`. The consuming code — the emitter (`pass_communityReferences`),
the derivation (`buildImportCypher`'s `b` branch), the stub-retire gate — **already exists on this
branch** and is covered by Story 38. Therefore:

- **Runnable now (DATA-CONTRACT):** parse the manifest, assert the exact structure of the three new
  blocks + a scope guard. This is the bulk of the testable surface and needs no running stack.
- **Live-only (NOT host-unit-testable):** the behavioral outcome (reinstall → pointer-`b` on the local
  header → derived `REFERENCES{source:'b-tag'}` edge, no fresh stub, idempotent / never-clobber,
  graceful-skip on pin mismatch). These need a running stack (reinstall-then-inspect). They are
  documented below as a manual recipe — **no fake unit test pretends to cover them.**

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (`tag` block exact) | `AC-1: the tag concept carries a communityReference with the exact headerATag, relayHints, and knownGoodEventId` | `test/b-tag-seeds.test.js` | data-contract (unit, host) |
| AC-1 (`nostr-user-tag` block exact) | `AC-1: the nostr-user-tag concept carries a communityReference with the exact headerATag, relayHints, and knownGoodEventId` | `test/b-tag-seeds.test.js` | data-contract (unit, host) |
| AC-1 (`tag-pinning` block exact) | `AC-1: the tag-pinning concept carries a communityReference with the exact headerATag, relayHints, and knownGoodEventId` | `test/b-tag-seeds.test.js` | data-contract (unit, host) |
| AC-1 (shape parity / not malformed) | `AC-1: the three new communityReference blocks share the KEY shape of the existing nostr-relay block (not malformed)` | `test/b-tag-seeds.test.js` | data-contract (unit, host) |
| AC-1 (ADR-0015 coordinate, documentation-as-test) | `AC-1: each headerATag's pubkey segment is the ADR-0015 LEGACY coordinate (a data literal, NOT a runtime TA key)` | `test/b-tag-seeds.test.js` | data-contract (unit, host) |
| Scope guard (this story's AC-8-equivalent) | `SCOPE GUARD: exactly nostr-relay + the three tag concepts carry a communityReference — nothing else crept in` | `test/b-tag-seeds.test.js` | data-contract (unit, host) |
| Manifest integrity (not corrupted) | `manifest.json still parses as valid JSON and the concepts array is intact` | `test/b-tag-seeds.test.js` | data-contract (unit, host) |
| AC-2 (pointer-`b` seeded) | — live recipe step (a) below — | n/a | **LIVE-ONLY (manual)** |
| AC-3 (lineage edge derived) | — live recipe step (b) below — | n/a | **LIVE-ONLY (manual)** |
| AC-4 (no fresh stub) | — live recipe step (c) below — | n/a | **LIVE-ONLY (manual)** |
| AC-5 (idempotent / never-clobber) | — live recipe step (d) below — | n/a | **LIVE-ONLY (manual)** |
| AC-6 (graceful-skip on pin mismatch) | — live recipe step (e) below — | n/a | **LIVE-ONLY (manual)** |
| AC-7 (David PR breadcrumb) | — PR-description deliverable, not a test — | n/a | **PR deliverable** |

## Live-only ACs — the reinstall-then-inspect manual recipe

These exercise the *behavioral* outcome of the manifest change on a running stack. They cannot run on
the unit-test host (no strfry, no Neo4j, no TA signer). The recipe is inherited from **ADR 0034 OQ-4**
and restated in **ADR 0002 §"Implementation notes → Verify recipe"**. Run on the **local** stack —
`feat/b-tag-primitive` does not auto-deploy anywhere (ADR 0002 §Constraints).

**Prerequisite:** the manifest must carry the three new blocks (AC-1, the data-contract tests above must
pass) before this recipe is meaningful, then run `POST /api/firmware/install` once.

For each slug in {`tag`, `nostr-user-tag`, `tag-pinning`}, with `<localTA>` = `GET /api/assistant/pubkey`:

- **(a) AC-2 — pointer-`b` seeded.** Scan the local header:
  `GET /api/strfry/scan?filter={"kinds":[39998],"authors":["<localTA>"],"#d":["<slug>"]}`.
  Assert `events[0].tags` contains **exactly one** `["b","39998:82b75e47…:<slug>","pointer"]`.
- **(b) AC-3 — lineage edge derived.** Cypher:
  `MATCH (c {uuid:'39998:<localTA>:<slug>'})-[r:REFERENCES]->(t) RETURN r.source` → `'b-tag'`.
- **(c) AC-4 — no fresh stub.** Assert no `REFERENCES {source:'firmware-community'}` edge is freshly
  MERGEd from that header during this install run (pre-existing legacy stubs, if any, may remain — ADR
  0034 AC-7; the gate is `seededB`).
- **(d) AC-5 — idempotent / never-clobber.** Re-run `POST /api/firmware/install`. Assert still exactly
  one `b` tag and one edge, and the header was not re-published on the second run (the never-clobber
  `t[0] === 'b'` check suppresses re-seeding). Separately, hand-set a foreign-target `b` on a header and
  re-install → seed suppressed (operator edit not clobbered).
- **(e) AC-6 — graceful-skip on pin mismatch.** Temporarily point one `knownGoodEventId` at a wrong id,
  install. Assert the foreign-community-header materialization is **logged-and-skipped** but the local
  pointer-`b` is **still** seeded from the manifest `headerATag` literal (per ADR 0034 OQ-1 — the pointer
  carries zero consensus weight; the seed is independent of the foreign-fetch result). Revert the id.

### Degenerate-dev-box caveat (READ before interpreting live results)

On **this dev box** the local TA pubkey **equals** the `82b75e47…` canonical coordinate
(`/api/assistant/pubkey` === the ADR-0015 coordinate; confirmed in ADR 0002 OQ-2). So locally:

- the local header `39998:<localTA>:<slug>` **is the same event** as the canonical pin target
  `39998:82b75e47…:<slug>`, and
- the derived `REFERENCES {source:'b-tag'}` edge is a **self-loop** (the header points at itself by uuid).

This is a **degenerate but valid** case — `seededB` / never-clobber / idempotency all still hold, and the
self-loop is harmless and idempotent. It does **not** invalidate steps (a)–(e); it only means the *shape*
you observe locally is the self-referential one.

**The non-degenerate (real-world) shape — runnable only on a non-dev deployment:** there the local TA
differs from the coordinate, so the local header is `39998:<thatInstanceTA>:<slug>` and the `b` points at
the **distinct** `82b75e47…` canonical — a genuine foreign-coordinate map. That foreign-coordinate edge
**only materializes on a non-dev deployment**; the live reinstall needs a running stack, so this story is
verified on the local box (self-loop shape) and reasoned about for the non-dev shape here.

### AC-7 — David PR breadcrumb (not a test)

A **PR-description deliverable**, not code and not a test. The PR must carry a prominent note to David that
this ships **one** pointer-`b` per local header (the ratified design), flag his "two b-tags" phrasing as the
open question, and give a concrete breadcrumb of exactly what he'd change to alter the shape (which manifest
field, which `buildImportCypher` branch, which emitter line). Tracked as a review-gate checklist item, not a
red/green test.

## Edge cases

- [x] **Manifest corrupted by the insertion** — covered by the JSON-parse + sibling-integrity guard
      (`manifest.json still parses…`). A broken comma or clobbered neighbour trips this clearly.
- [x] **Scope creep** — the scope guard fails if any concept *beyond* nostr-relay + the three tag concepts
      gains a `communityReference`.
- [x] **A future "fix" replacing the literal coordinate with a runtime lookup** — the documentation-as-test
      (`AC-1: each headerATag's pubkey segment is the ADR-0015 LEGACY coordinate…`) trips, encoding the
      named-exception expectation.
- [ ] **Pin staleness (a canonical header re-published before ship)** — out of unit scope; handled by the
      AC-6 graceful-skip live path. ADR 0002 OQ-1: the Implementer SHOULD re-confirm the three pins are
      still live on dcosl at implementation time, but a mismatch never blocks the ship.

## Test infrastructure

- Test framework: Node built-in runner (`node test/test.js`); the new suite is registered at all four
  points in `test/test.js` (require, run, summary line, overallOk line), mirroring `b-tag-primitive`.
- Concept Graph API / strfry / Neo4j (`localhost:8877`, the container stack): **only** needed for the
  LIVE-ONLY recipe above — the data-contract suite needs no running stack.
- Firmware state: the data-contract tests require **no** install. The live recipe requires
  `POST /api/firmware/install` to have run after the manifest blocks land.
- Fixtures: none — the suite parses the real `firmware/active/manifest.json`.

## How to run

```
node test/b-tag-seeds.test.js     # just this suite
npm test                          # full aggregator
```

## Verification

The new data-contract tests fail with the current code (the manifest lacks the three blocks).
Confirmed 2026-06-17 at commit `f28b06b4`:

```
--- b-tag seeds tests (epic tag-federation, Story 2) ---
  PASS  manifest.json still parses as valid JSON and the concepts array is intact
  FAIL  AC-1: the tag concept carries a communityReference with the exact headerATag, relayHints, and knownGoodEventId
        communityReference missing on concept tag — Story 2 must add a communityReference block to it (per ADR 0002 §"Exact manifest blocks to add").
  FAIL  AC-1: the nostr-user-tag concept carries a communityReference with the exact headerATag, relayHints, and knownGoodEventId
        communityReference missing on concept nostr-user-tag — Story 2 must add a communityReference block to it (per ADR 0002 §"Exact manifest blocks to add").
  FAIL  AC-1: the tag-pinning concept carries a communityReference with the exact headerATag, relayHints, and knownGoodEventId
        communityReference missing on concept tag-pinning — Story 2 must add a communityReference block to it (per ADR 0002 §"Exact manifest blocks to add").
  FAIL  AC-1: the three new communityReference blocks share the KEY shape of the existing nostr-relay block (not malformed)
        tag must carry a communityReference object to compare shape against nostr-relay
  FAIL  AC-1: each headerATag's pubkey segment is the ADR-0015 LEGACY coordinate (a data literal, NOT a runtime TA key)
        tag must carry a communityReference.headerATag string
  FAIL  SCOPE GUARD: exactly nostr-relay + the three tag concepts carry a communityReference — nothing else crept in
        exactly these four concepts may carry a communityReference: ["nostr-relay","nostr-user-tag","tag","tag-pinning"]. Found: ["nostr-relay"]. This story adds EXACTLY the three tag blocks (tag, nostr-user-tag, tag-pinning) on top of the pre-existing nostr-relay — no more, no fewer, and nothing else.

b-tag-seeds: 1 passed, 6 failed
```

Note: the `manifest.json still parses…` guard PASSES today by design — the manifest is currently
uncorrupted; that test guards against the Implementer's insertion *breaking* it, so it stays green
through the red phase and must remain green after implementation.
