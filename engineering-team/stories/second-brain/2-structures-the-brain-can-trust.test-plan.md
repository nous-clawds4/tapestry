# Test Plan: Story 2 — Structures the brain can trust

**Story:** `engineering-team/stories/second-brain/2-structures-the-brain-can-trust.md`
**ADR:** `engineering-team/decisions/second-brain/0002-hygiene-check-and-primary-property-reconcile.md`
**Date:** 2026-07-23

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC 1 (repeatable, green when sound) | U2 (sound wiring → zero problems), U8 (deterministic report), H1 (live green), H2 (two runs identical) | `test/structures-the-brain-can-trust.test.js` | unit + live integration |
| AC 2 (flagged edges adjudicated, retained) | U2 (incoming memberships classify sound), H3 (the four edges present — live sentinel, passes before AND after) | same | unit + live sentinel |
| AC 3 (drift reconciled) | U7(a) (drift detected with keys named), H4 (live property record agrees with schema post-cleanup), H1 (green implies no drift) | same | unit + live integration |
| AC 4 (specific recurrence reporting) | U3 (wrong-direction-membership), U4 (machinery-incomplete, missing + duplicate), U5 (membership-declaration-mismatch, both directions distinguished), U6 (unreadable-record via the shared goals core), U7(c,d,e) (drift variants) | same | unit (synthetic rows — no live defect is ever introduced) |
| AC 5 (no goal lost) | H5 (goal-set snapshot equality across a real reconcile; also pins `reconciled`/`already-consistent` idempotency) | same | live integration |
| AC 6 (any instance; no hardcodes) | U9 (absent concept → nothing-to-check, sound stays true), S5 (no 64-hex literal in touched server files) | same | unit + source |
| ADR d1 (gate, route, read-only, import pin) | S2, S3, S6, H6 (host GET → 403; host POST → 401) | same | source + live |
| ADR d4 (reconcile mechanism + contract) | S4 (gate, `regenerateJson`, discriminated results), H5 | same | source + live |
| ADR purity/reuse | S1 (hygiene core requires only `./goals`), U6 (parseGoalRow is the classifier), R1 | same | source + unit |
| Regression sentinels | R1 (goals core exports), R2 (create-element + save-schema routes), R3 (untouchables free of this story), H3 | same | source + live |

## Edge cases

- [x] Duplicated `IS_THE_CONCEPT_FOR` (not just missing machinery) — U4(b).
- [x] Both mismatch directions (edge-without-declaration vs declaration-without-edge) distinguished — U5.
- [x] Cosmetic property differences (rich schema objects vs stripped `{type}`) are NOT defects — U7(b).
- [x] Null/unreadable property section classifies as drift, never throws — U7(e).
- [x] Goal-record rules must not leak onto the sibling concept (`parseRecord: null`) — U6.
- [x] Absent concept (second operator, fresh deployment) — U9; live-absent is structurally the same path (staging smoke is the natural live check, per the 0001 precedent).
- [x] Stack absent → H tests SKIP, U/S still gate (CI's stack-free job).

## Test infrastructure

- Framework: the repo's hand-rolled runner (`test/*.test.js` exporting `run()`), registered in `test/test.js`:
  require + `run()` + skip-aware summary line + **`overallOk` entry in the LIVE gating chain before the severed terminator** (OPEN.md #43).
- Live API: loopback via `docker exec tapestry curl http://127.0.0.1:7778/...` (the `localTrusted` caller class); host `http://localhost:7778` used only to prove the remote-class gate answers (H6). Ports/TA are runtime-resolved per test run (`/api/assistant/pubkey`) — no hardcodes in the suite beyond concept slugs.
- Firmware state: none required. Both concepts are runtime-created; no reinstall is involved.
- Fixtures: **none live.** All AC-4 defect cases run against synthetic rows in the pure core (ADR guidance: the throwaway-fixture-concept H path is declined — story 1's orphan-tag teardown lesson; U-class rows are the taxonomy coverage). H5 runs the *real* reconcile against the live goal concept — that is the story's actual cleanup, idempotent by contract, converging to the correct state; no teardown exists or is needed.
- **Contracts pinned by this plan** (the ADR's "exports ≈" latitude, resolved): object-parameter signatures
  `classifyHeaderEdges({concept, headerUuid, edges})`, `classifyElementConsistency({concept, elements, parseRecord})`,
  `comparePropertyRecord({concept, schemaObject, propertySection})`, `assembleReport(conceptResults)`;
  edge rows `{direction: 'out'|'in', rel, otherUuid, otherLabels}`; element rows `{uuid, name, createdAt, json, hasEdge, hasZTag}`;
  problem records `{concept, subject, kind, detail}` with kinds exactly
  `wrong-direction-membership | membership-declaration-mismatch | property-record-drift | machinery-incomplete | unreadable-record`;
  report `{sound, problems, checked}` with problems ordered (concept, kind, subject).

## Deviations (Tester's lane, logged)

1. **Skip-visibility drive-by:** `test/test.js`'s `totalSkipped` array omitted `captureAGoalAndSeeItResult` (story 1's registration miss — skips undercounted). Added it alongside this story's entry; the aggregate is informational-only (never consulted by `overallOk`), and skip counting is a standing reviewer constraint (test-hermeticity #2).
2. **H3/R1–R3 pass before implementation by design** — live/static sentinels guarding AC 2 retention and the reuse/untouchable surfaces. Documented here so "confirmed failing" below reads correctly: 20 fail / 4 sentinel-pass is the intended pre-implementation state.

## How to run

```
node test/structures-the-brain-can-trust.test.js
```

Full gate (registers in the live chain; ~24 min against a running stack — run in background from the start, OPEN.md row 83):

```
npm test
```

No Playwright: this story ships no UI surface (design guide do-not-design list).

## Verification

The new tests fail with the current code. Confirmed 2026-07-23 at commit `18484b25` (branch `feat/second-brain`, stack up, H-class ran live):

```
structures-the-brain-can-trust: 4 passed, 20 failed, 0 skipped
```

- U1–U9, S1, S5: FAIL — `src/lib/brain/hygiene.js does not exist yet` (the pure core is unimplemented).
- S2, S3, S6: FAIL — the brain module has no hygiene route / no hygiene require yet.
- S4: FAIL — `POST /api/normalize/reconcile-primary-property is not registered`.
- H1, H2: FAIL — `Cannot GET /api/brain/hygiene` (route 404).
- H5: FAIL — `Cannot POST /api/normalize/reconcile-primary-property` (route 404).
- H6: FAIL — hygiene GET answers 404, not the in-handler 403.
- **H4: FAIL on the live defect itself** — `properties.origin missing … Got keys: ["name","slug","description"]` — the documented save-schema drift, present on the instance right now. This is the cleanup's live pin.
- H3, R1, R2, R3: PASS — sentinels, by design (deviation 2).

`node --check test/test.js` passes with the registration edits in place.
