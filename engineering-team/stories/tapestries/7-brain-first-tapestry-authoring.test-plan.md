# Test Plan: Story 7 — Brain-first tapestry authoring

**Story:** `engineering-team/stories/tapestries/7-brain-first-tapestry-authoring.md`
**ADR:** `engineering-team/decisions/tapestries/0007-brain-first-authoring-publish-hook.md`
**Book:** `engineering-team/audits/brain-first-tapestry-authoring/book.md`
**Date:** 2026-08-04

One suite, five classes — `test/brain-first-tapestry-authoring.test.js`, registered additively in `test/test.js` (require + run + summary line + `overallOk` term + skip roll-up entry; no existing line changed). Unlike the epic's #5/#6 stories, the deliverable here is **server-side store convergence** — a mocked-network Playwright spec would mock the very stores under test — so the binding browser-free suite carries the integration load against the live local stack, with clean SKIPs (counted, never silent) when the stack is down:

- **U1–U3** — pure draft-builder tests (dynamic `import()` of `ui/src/pages/tapestries/tapestryDraft.mjs`, the epic's established pattern): the create draft authors `word` + `tapestry` + `graph` (exactly those three top-level sections; `word.slug` = tapestry slug, `word.name` = title, `wordTypes` = `["word"]` — the deriver's own default, so derive never fights authoring), and both republish builders carry an authored `word` through verbatim.
- **G0–G5** — dependency-injected guard tests of `isOwnedTapestryEvent(event, {taPubkey, ownerPubkey})` (named export of the new `src/api/strfry/tapestryBrainWrite.js`; G0 is the headline module-exists sentinel): accepts TA-authored and owner-authored kind-39999 letters z-tagged to *this instance's* tapestry concept; rejects third-party authors, wrong/missing/foreign-namespace z-tags, and non-39999 kinds. Fixture pubkeys only — no stack, no config.
- **S1** — source sentinel: `publishEvent.js` requires the brain-write module and **awaits** `maybeBrainWriteTapestry(` — the un-awaited-hook failure mode (publish response racing the brain write) is caught at the source level.
- **I1–I7** — live-stack integration (host reads via `localhost:$TAPESTRY_PORT`; assistant-signed publishes via the house docker-exec loopback pattern, which is what earns `req.localTrusted`): the full AC chain on the real stores, in order — publish + `brainWrite` in one response (I1), brain node with `ListItem` label + the *exact implicit z-tag row ConceptElements queries* + explicit `HAS_ELEMENT` placement (I2), letter carries all three sections (I3), published json Ajv-validates against the schema fetched from the live graph (I4), `tapestryKey` + derived LMDB doc with `word`/`tapestry`/`graph`/`graphContext` via the tapestry-key API (I5), add-republish updates brain json + derived doc (I6), remove-republish re-converges with the brain's json tag **byte-identical** to the letter's (I7 — the stores-agree assertion in its strongest form).
- **R1–R2** — regression guards that pass pre AND post: legacy word-less letters are never retrofitted by the add builder (word authoring is create-only), and a third-party client-signed tapestry letter still publishes permissionlessly (ADR security-auth-exposure/0002) while producing **no** brain node and no `brainWrite` result (the allow-list holding; also proves client-signed events traverse the hook's code path).

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 assistant-signed create reaches both stores | `I1` (publish + brainWrite in one response), `I2` (ListItem label; the implicit z-tag row the Elements view unions; HAS_ELEMENT placement), `I3` (letter in strfry) | `test/brain-first-tapestry-authoring.test.js` | integration (live stack) |
| AC-2 own-key create reaches both stores | **By composition** (see limitation below): `G2` (guard accepts the owner pubkey) + `R2` (client-signed events traverse the same post-import hook — its skip branch is observable) + `I1` (accepted events brain-write) + `S1` (the hook is awaited at the one shared seam) | same | unit + integration |
| AC-3 letter carries word+tapestry+graph, schema-valid, no regression | `U1` (authored shape + the pre-change tapestry/graph contract intact), `I3` (live letter), `I4` (Ajv against the live concept schema), `R1` (legacy letters untouched); existing `tests/brainstorm/tapestries-nav-and-directory.spec.js` + `tapestry-exploration.spec.js` stay green unchanged (render regression) | same + existing specs | unit + integration + e2e (existing) |
| AC-4 tapestryKey + derived LMDB doc | `I1` (brainWrite reports the key), `I5` (derived doc: word/tapestry/graph/graphContext; graphContext.identifiers.uuid points back at the element) | same | integration |
| AC-5 edits keep the stores agreeing | `U2`/`U3` (republish builders preserve word), `I6` (add: brain json + derived doc gain the member), `I7` (remove: byte-identical json tag in brain and letter) | same | unit + integration |
| Allow-list (ADR guard; implied by AC-1/AC-2's "owner" scoping) | `G1`–`G5` (accept TA/owner; reject third-party, wrong z, wrong kind), `R2` (end-to-end rejection with permissionless publish intact) | same | unit + integration |

## Edge cases

- [x] Wrong z-tag / missing z-tag / **foreign TA namespace** in the z-tag (`G4` — three asserts).
- [x] Wrong kind (39998 header, kind-1 note) never takes the brain-write path (`G5`).
- [x] Third-party author: publish succeeds, brain untouched (`G3` unit; `R2` end-to-end).
- [x] Legacy word-less letters (the live `b0b48b00` shape): republish never invents `word` (`R1`).
- [x] Same-second replaceable ties: `I1` bumps `created_at` past the prior fixture run (NIP-01 tie-break hygiene, mirroring the add-builder's own rule).
- [x] Stack down: every I-test and `R2` SKIP with the count surfaced in the suite summary and `test/test.js`'s roll-up — never silent (test-hermeticity-ci #2 constraint).
- [ ] Local strfry import fails but external relays accept (brain misses the letter): **deliberately untested** — pre-existing partial-publish envelope, explicitly out of scope in story + ADR.

## Known coverage limitation (recorded, not hidden)

A true end-to-end own-key (NIP-07) create cannot be tested: it requires signing as the instance owner, whose private key neither the repo nor the CI environment possesses (by design). AC-2's chain is therefore proven by composition — `R2` shows client-signed events reach the hook's code path, `G2` shows the guard accepts the owner pubkey, `I1` shows accepted events complete the full brain write, and `S1` pins that the hook is awaited on the shared seam before the response — plus the existing mocked create-tapestry spec covering the own-key UI flow shape. The Reviewer should treat any future weakening of `G2` or `S1` as breaking AC-2's evidence chain.

## Test infrastructure

- Framework: Node built-in runner via `npm test` (suite registered in `test/test.js`); no new frameworks.
- Live stack: `localhost:$TAPESTRY_PORT` (default 7778, `TAPESTRY_PORT` env override); assistant-signed publishes go through `docker exec tapestry curl 127.0.0.1:7778` (the house `localTrusted` loopback pattern from `test/teach-it-what-matters.test.js`); container name overridable via `TAPESTRY_CONTAINER`.
- Firmware state: requires the `tapestry` concept installed (standard firmware; present on any installed instance). The runtime TA pubkey is resolved per-run from `/api/assistant/pubkey` — never hardcoded (fixture literals appear only in stack-free tests).
- Fixtures & residue (OPEN.md #128 lesson): live writes use **stable** d-tags — `tapestry-brainfirst-fixture-t7fixture` (TA-authored fixture tapestry; members drawn from firmware concepts `tag` / `nostr-user-tag`) and `test-brainfirst-thirdparty-t7` (throwaway-key letter). Each run **replaces** the prior run's addressable event: zero corpus growth, classifiable prefix for any future sweep. Residue per machine: exactly one fixture tapestry (relay + brain node once implemented) and one third-party letter (relay only, brain-excluded by design).

## How to run

```
node test/brain-first-tapestry-authoring.test.js
```

Full gate (registered):
```
npm test
```

## Verification

The new tests fail with the current code, each for the feature-absent reason (never an import error or typo). Confirmed 2026-08-04 at commit `73e608b1` (stack UP — integration tests exercised live; `node --check test/test.js` clean):

```
brain-first-tapestry-authoring: 2 passed, 17 failed, 0 skipped

✗ U1  — "the create draft has no top-level `word` section …"
✗ U2/U3 — "precondition: the create draft has no word section (U1's contract) …"
✗ G0  — "the brain-write module is missing or unloadable (Cannot find module '…/src/api/strfry/tapestryBrainWrite.js') …"
✗ G1–G5 — "precondition: the brain-write module is missing (G0's contract) …"
✗ S1  — "publishEvent.js does not require ../tapestryBrainWrite …"
✗ I1  — "the publish response carries no brainWrite result — the post-import hook did not run …"
✗ I2–I7 — "precondition: I1 did not complete …" (articulate fail-fast, no cascade crashes)
✓ R1  — legacy word-less letters stay word-less (passes pre AND post, as designed)
✓ R2  — third-party client-signed publish stays permissionless, no brain node (passes pre AND post, as designed)
```

The two R-class passes are the designed pre-implementation baseline: they pin behavior that must SURVIVE the feature (permissionless third-party publish; create-only word authoring).
