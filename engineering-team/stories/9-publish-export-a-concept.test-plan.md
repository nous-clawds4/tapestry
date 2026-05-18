# Test Plan: Story 9 — Publish/export a concept to the community

**Story:** `engineering-team/stories/9-publish-export-a-concept.md`
**ADR:** `engineering-team/decisions/0004-publish-export-a-concept.md`
**Date:** 2026-05-17

> **Revision (2026-05-18, ADR 0004 Rev 1):** concept export publishes ONLY to `wss://dcosl.brainstorm.world` (relay-parameterized `publishEverywhere`). Sentinels unchanged and still valid (TE1 still pins `publishEverywhere` usage; RE1 still pins the primitive + `PUBLISH_RELAYS` present). Smoke relay target below is now the dcosl DList relay.

## Approach

Precedent: stories #5 / #6 / strfry-router-first-boot. Export is a relay round-trip — its real behavior (events landing on community relays, Concept-Graph-rooted closure, foreign nodes excluded, idempotency, partial-failure reporting, owner-only enforcement) is **not reproducible in the hand-rolled Node runner** without infra this project has no ADR for, and ADR 0004 deliberately left the route name/path open ("`src/api/concept/` OR extend `src/api/concept-graph/`"). So the in-runner suite pins only the **stable contract ADR 0004 did fix**, and the behavioral proof is the **authoritative local/staging smoke** below.

**Deliberate limitation (read this).** Source sentinels cannot prove that export actually emits the right event set or that it excludes foreign-authored nodes — a structurally-present but semantically-wrong implementation could pass TE1/TE2. The authoritative behavioral gate for AC-1…AC-6 is the §"Not covered" smoke. **The Reviewer must treat that smoke evidence as required, not optional.**

## Coverage map

| Criterion | Test / mechanism | File | Level |
|---|---|---|---|
| AC-1 (own concept fully published) | **TE1** pins that a concept-scoped export is wired through the existing `publishEverywhere`; the actual Header + Concept-Graph closure reaching relays is **smoke N1** | test/publish-export-a-concept.test.js | source + smoke |
| AC-2 (foreign nodes NOT published) | **TE2** pins a server export path filtered to this instance's own/TA pubkey (provenance); concrete exclusion of a planted foreign node is **smoke N2** | test/publish-export-a-concept.test.js | source + smoke |
| AC-3 (graphContext stripped) | Invariant of reusing the existing share path (ADR 0004); verified by **smoke N1** (published events carry no `graphContext`) | — | smoke |
| AC-4 (idempotent re-run) | Replaceable-event property; **smoke N3** | — | smoke |
| AC-5 (partial relay failure reported, no abort) | **smoke N4** | — | smoke |
| AC-6 (owner-only) | **TE2** pins provenance in the server path; owner-guard enforcement is **smoke N5** | test/publish-export-a-concept.test.js | source + smoke |

TE1, TE2 = FAIL pre-implementation, PASS post. RE1 = PASS pre AND post (scope guard; flip to FAIL ⇒ Implementer changed the out-of-scope publish primitive or drifted to ADR Option B).

## Edge cases

- [x] **Existing per-profile `publishEverywhere` not false-matched.** TE1 requires `publishEverywhere` **and** a concept-export token in the same file; `ui/src/hooks/useProfileActions.js` (profile publish) has no such token → correctly still FAIL pre-impl (confirmed in the run below).
- [x] **Option-B drift caught.** RE1 fails if any `src/api` file gains `SimplePool` + `.publish(` (server-side external publisher). Pre-impl `fetchEvents.js` uses `SimplePool.querySync` for FETCH only — guard holds.
- [x] **Publish primitive freeze.** RE1 fails if `publishEverywhere`/`PUBLISH_RELAYS` is removed/renamed (ADR 0004 "No change to nostrPublish.js").
- [ ] **Semantically-wrong export (wrong event set / foreign node leak).** Not catchable in source — this is exactly what smoke N1/N2 exist to catch.

## Not covered (deferred to local/staging smoke — authoritative behavioral gate)

Run on the local docker stack (`cycle-local`, `http://localhost:8080`) or `staging.brainstorm.world`.

**N1 — AC-1/AC-3 (full Concept-Graph-rooted export, graphContext stripped):** as owner, trigger "Publish concept" for `nostr-relay`. Query `wss://dcosl.brainstorm.world` via `/api/relay/external` for `{kinds:[39998,39999],authors:["<local TA pubkey>"]}` scoped to the concept. Expect the 39998 Header **and** the 39999 Concept Graph node **and** its closure (superset, sets, elements, schema, primary-property, properties-set, property-tree-graph, core-nodes-graph). Expect **no `graphContext`** in any published event.

**N2 — AC-2 (provenance: foreign nodes excluded):** plant a foreign-authored node inside the `nostr-relay` concept (an element/superset signed by a non-TA pubkey — e.g. via the Story #8 import, or hand-published). Run export. Expect that foreign-authored event is **absent** from the published set (only `authors:["<TA>"]` events emitted).

**N3 — AC-4 (idempotent):** run export twice. Expect identical a-tags, no divergence (replaceable events).

**N4 — AC-5 (partial failure):** make one relay hint unreachable. Expect the action reports per-event/per-relay successes+failures and completes (no abort).

**N5 — AC-6 (owner-only):** attempt the action without an owner session. Expect denied.

**Strongest end-to-end:** instance B runs N1; instance A imports it via Story #8 — the two stories' smoke compose into one cross-instance proof.

## Test infrastructure

- **Framework:** existing hand-rolled Node runner (`npm test` → `test/test.js`). No new deps/framework (house rule). Registered: `publishExportConcept` in `test/test.js`.
- **No Playwright spec.** Externally-dependent relay round-trips are not deterministically reproducible in-runner without mocking infra this project has no ADR for; pinning a fetch/publish URL would prescribe the ADR-open mechanism. Behavioral proof is the smoke above (story #5/#6 precedent).
- **Fixtures:** none in-runner (source scans). Smoke fixtures: local docker stack or staging; a planted foreign-authored node for N2.

## How to run

```
npm test
```

Targeted:
```
node -e "require('./test/publish-export-a-concept.test.js').run()"
```

## Verification

New tests fail on the pre-implementation tree (working tree atop story/ADR commit `b416c938`):

```
publish-export-a-concept suite:
  ✗ TE1: a "publish concept" action is wired through the existing publishEverywhere primitive (AC-1, ADR 0004 Option A)
  ✗ TE2: a server endpoint enumerates a concept's OWN-authored events (provenance filter to this TA pubkey) (AC-2/AC-6, ADR 0004)
  ✓ RE1: publish primitive reused unchanged; no ADR-Option-B server-side external publisher introduced
publish-export-a-concept suite:                  FAIL (1 passed, 2 failed)
Overall:                                         FAIL
```

- TE1, TE2 fail citing AC + ADR, describing what must change without prescribing the ADR-open route — not a typo/import error (suite loaded and ran).
- RE1 passes (intentional scope guard; a flip to FAIL during Implementation = Option-B drift or publish-primitive change).
- All 6 pre-existing suites stay green — no collateral regression from registering the new suite.
