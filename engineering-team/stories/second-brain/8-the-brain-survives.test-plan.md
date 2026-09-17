# Test Plan: Story 8 — The brain survives — export and restore

**Story:** `engineering-team/stories/second-brain/8-the-brain-survives.md`
**ADR:** `engineering-team/decisions/second-brain/0008-the-brain-survives.md`
**Date:** 2026-07-24

## Coverage map

One suite, `test/the-brain-survives.test.js`, in the house four-class pattern (test-hermeticity-ci/0001). 31 tests: U1–U8 (executed pure-core), S1–S13 (source assertions), H1–H8 (live local stack, per-test SKIP when absent), R1–R2 (regression sentinels).

| Criterion | Tests | Level |
|---|---|---|
| AC1 — dated, local artifact; all five families; owner-authored scope | U2 (membership + raw fidelity), U3 (envelope + determinism), S1 (route/gate/attachment filename), H1 (live envelope, five families, dated, attachment headers, identity-free), H3 (export is a pure read) | unit + source + integration |
| AC2 — restore drill reproduces; live brain untouched; journaled | U6/U7/U8 (the collision triple, record collisions, the ordered verbatim plan), S4/S5/S7 (producer discipline; mint idioms; ensures incl. `ensureGoalConcept`), H4 (the live round-trip: decomposition position, pointer, spine entries, decision CLOSES its proposal, capturedOn not restamped, sections verbatim on re-export), H5 (the protection: refusals write nothing; the live brain's own export REFUSES against the live brain), H6 (the journal: fifth concept self-bootstraps; dated/attributed/outcome-enum record; bad outcome writes nothing), S13 (the drill script's contract: pinned sentence, journals BOTH outcomes, router quiesce, firmware bring-up, no published ports, `--rm`, compares via `contentEquivalent`) | unit + source + integration |
| AC3 — no egress | S8 (no outbound token on any new path; drill script loopback-only), S12 (brain module stays mutation/strfry-free), H3 (export changes nothing) | source + integration |
| AC4 — export twice → equivalent content | U3 (canonical determinism), U4 (the ONE `contentEquivalent` definition: reflexive, order-insensitive, ignores takenOn, detects a one-field change), H2 (live: two exports → equivalent) | unit + integration |
| AC5 — copy discipline; portability seed; no regression | S10 (the pinned "Export brain." + ratified d12 confirmation/failure strings verbatim, digit-free, jargon-free), S9 (no 64-hex anywhere touched), U2 + H1 (artifact entries are exactly {name, section} — no uuid/createdAt/pubkey; live artifact contains no TA hex), S2 (the TEN-require allowlist), S3/S11/R1/R2 (lanes + untouchables + existing reads), the seven sibling re-pins (below) | source + unit + integration |

**Cross-cutting:** U1/U6 pin both cores dependency-free; U5 pins `validateArtifact`'s named shape errors; H7 pins the caller classes (remote GET export → 403; remote POSTs → 401); H8 pins hygiene green throughout.

## Edge cases

- [x] Out-of-contract section fields survive export AND restore verbatim (U2; H4's `harnessExtra` field) — raw fidelity is the protection artifact's contract.
- [x] Parser-invalid rows are excluded from export (U2) — membership is the parser's call.
- [x] Empty artifact restores as a no-op success (U8); an empty brain exports a valid artifact (ADR d3; exercised structurally via U3's empty families).
- [x] Same record slug in a DIFFERENT family is NOT a collision (U7) — slugs are family-scoped.
- [x] ALL collisions are listed in one refusal, not just the first (U6).
- [x] Restore does NOT require an empty target — it restores beside live content (H4), and the collision guard alone is the protection (H5).
- [x] Re-running a restore refuses (goal collisions) — the re-run guard for free (H5a).
- [x] capturedOn is NOT restamped on restore; derived standing re-derives on the target (H4).
- [x] proposalId → slug linkage survives restore: the restored decision closes its restored proposal in the open queue (H4).
- [x] The signal's one-fact-two-spines fan-out survives restore (H4: `preferred` on the child, `passed over` on the parent).
- [x] Outcome vocabulary is closed: `matched` | `did-not-match`; anything else refuses and writes nothing (H6).
- [x] Concept Graph API unavailable → all H rows SKIP per-test (the CI stack-free job).

## Test infrastructure

- Framework: the house zero-dependency runner (`tests` array + `run()`), registered in `test/test.js`'s **live** `overallOk` chain — the standard five-touch: require (`test/test.js:189`), run call, summary line, terminator flip (`teachItWhatMattersResult.fail === 0;` → ` && … theBrainSurvivesResult.fail === 0;`, dead block left intact — OPEN.md #43), `totalSkipped` array.
- Live API: loopback via `docker exec tapestry curl 127.0.0.1:7778` (the `localTrusted` caller class); host-side `fetch localhost:7778` only for the remote-caller-class checks (H7). TA pubkey runtime-resolved per test run via `/api/assistant/pubkey` — never transcribed.
- Firmware state: none required (all five brain concepts + the drill concept are runtime-created; the suite never boots the scratch container — the drill is the operator's one-time act per ADR d10, environmental by design).
- **Fixtures — STATE-FREE discovery teardown (OPEN.md row 94's fix, adopted for this suite):** one cross-linked sentinel artifact (`harness-survive-*`: parent + viable child goal with back-dated capturedOn and an out-of-contract field, resource, work record, proposal + closing decision, signal). Teardown DISCOVERS fixture elements by sentinel json-CONTAINS query — never from process-local arrays — so a crashed prior run's strays are swept by the next pre-clean instead of stranding "already exists" cascades. Sequence: discover uuids → strfry delete per d-tag + count-0 verify → Neo4j DETACH DELETE + value-scoped orphan-tag sweep → discovery count-0 verify. Loud failure on residue. Runtime-created CONCEPTS persist (elements only); idempotent across runs.
- **Sibling re-pins (ADR d13, the eighth occurrence):** the identical brain-import allowlist widened from NINE to **TEN** (`+ /lib\/brain\/export$/`) in all seven sibling suites — `capture-a-goal-and-see-it:333`, `structures-the-brain-can-trust:454`, `break-a-goal-into-pieces:540`, `attach-the-world:560`, `sessions-read-the-brain:573`, `the-proposal-loop:580`, `teach-it-what-matters:563`. Widen-only; all seven verified green post-re-pin (below).
- **Playwright: none.** The affordance is a fetch-download + one confirmation sentence; S10 pins the strings verbatim in source, H1/H7 pin the endpoint contract and gates. (Tester's-discretion call per the ADR; consistent with the epic's precedent for thin UI surfaces. The Implementer verifies the rendered button manually at the vite-build step.)

## Pass-by-design sentinels (documented, the story-2→7 review precedent)

Pass BEFORE the feature lands: **S9** (no 64-hex — new files guarded), **S11** (ui untouchables), **S12** (brain read-only today), **H8** (hygiene green), **R1**, **R2**. H7's POST halves are 401 before and after (middleware default-denies before routing) but the row FAILS pre-impl on its GET half (404 ≠ 403 — route absent). Everything else fails until the feature lands.

## How to run

```
node test/the-brain-survives.test.js
```

Full gate (≈25 min — quiesce `strfry-router` first per OPEN.md row 75; background AS the backgrounded call):

```
npm test
```

## Verification

The new tests fail with the current code, for the right reasons (cores missing → U throws the named not-implemented errors; routes unregistered → H rows get Express "Cannot GET/POST"; strings/script absent → S rows name the missing artifact). Confirmed 2026-07-24 at commit `03a68913` (stack present — H rows ran LIVE, 0 skipped):

```
the-brain-survives: 6 passed, 25 failed, 0 skipped
```

Per-class: U1–U8 all FAIL (cores missing) · S1–S8, S10, S13 FAIL (routes/files/strings absent) · S9, S11, S12 PASS (pass-by-design) · H1–H7 FAIL (routes absent; live-run) · H8 PASS · R1, R2 PASS. Post-impl expectation: **31 passed, 0 failed, 0 skipped** (stack present).

Seven siblings green under the widen-only TEN re-pin, standalone, same commit:

```
capture-a-goal-and-see-it: 27 passed, 0 failed, 0 skipped
structures-the-brain-can-trust: 24 passed, 0 failed, 0 skipped
break-a-goal-into-pieces: 30 passed, 0 failed, 0 skipped
attach-the-world: 29 passed, 0 failed, 0 skipped
sessions-read-the-brain: 30 passed, 0 failed, 0 skipped
the-proposal-loop: 33 passed, 0 failed, 0 skipped
teach-it-what-matters: 27 passed, 0 failed, 0 skipped
```

`node --check test/test.js` clean after the five-touch registration.

## Notes for the Implementer

- The U rows pin the pure-core CONTRACTS the ADR names: `familyEntries(rows, sectionKey, parser)` → `[{name, section}]`; `assembleExport(familiesByKey, takenOn)`; `contentEquivalent(a, b)`; `validateArtifact(artifact)` → `{ok:true} | {ok:false, error}`; `planRestore(artifact, existing, {deriveGoalDTag})` → `{ok:true, mints:[{family, name, section}]}` (family-ordered) `| {ok:false, refusal, collisions}`. The `deriveGoalDTag` option keeps the restore core zero-require (the caller supplies the real `dtag.childDTag(name, headerUuid)` bound to the target header).
- H4 asserts `restored: {goals:2, resources:1, workRecords:1, proposals:2, signals:1}` — the d6 result shape, exact.
- H6 asserts the journal wrapper key is `restoreDrill` and the section carries `exportTakenOn/drilledOn/outcome/target/performedBy`.
- The drill script's S13 contract: `DRILL_SENTENCE` verbatim, `record-restore-drill`, `did-not-match`, `supervisorctl stop strfry-router`, `api/firmware/install`, `docker run` + `--rm` with NO `-p`/`--publish` on the run line, and a `contentEquivalent`/`lib/brain/export` reference. No `https://` anywhere; `http://` hosts loopback-only.
- The full `npm test` gate: quiesce `strfry-router` first; known environmental flakes (row-75 scan-count drift; `tl-publication-from-pins-publish` under churn) are never second-brain defects.
