# Review: Story 1 — Strfry-free relationship add/delete primitives

**Reviewer:** Claude (acting as Reviewer, fresh context — implementation conversation not seen)
**Date:** 2026-07-21
**Diff:** `git diff 49e863cd..HEAD` on `feat/relationship-primitives` (implementation commit `a182dc9d`)
**Story:** `engineering-team/stories/relationship-primitives/1-relationship-add-delete-primitives.md`
**ADR:** `engineering-team/decisions/relationship-primitives/0001-strfry-free-relationship-primitives.md`
**Test plan:** `engineering-team/stories/relationship-primitives/1-relationship-add-delete-primitives.test-plan.md`

Range contents: the story's code is `src/api/normalize/relationships.js` (new, 221 lines) + the 7-line registration in `src/api/normalize/index.js` + the story's journaled `## Deviations` entry. The other files in the range — `engineering-team/audits/relationship-primitives/journal.md` (Gate-4 entries), `engineering-team/epics/relationship-primitives.md` (roster line), `engineering-team/stories/relationship-primitives/2-read-only-deployment-probe.md` (Draft) — are the book's Direction-mode process artifacts and story #2's planning output; noted, not re-reviewed here. Untracked/modified `product-team/**` files in the working tree belong to the separate product flow and were ignored.

**Test-integrity check (run myself):** `git diff 49e863cd..HEAD -- test/` is empty — no test was weakened between the ratified failing suite (Gate 3, commit `49e863cd`) and the implementation. `package.json`/`package-lock.json` untouched in the range.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` (full runner, no filters) — **PASS**, run by me on this checkout:
  - Pre-run strfry drift check (per the test plan's H8 caveat 2 and the Gate-4 control experiment): `GET /api/strfry/scan/count` sampled twice 66 s apart — `5993920` @ 20:18:32Z → `5993924` @ 20:19:38Z (**+4 events, ~0.06 ev/s — busy window**, strfry-router live-syncing).
  - Full run launched anyway (records everything besides H8 regardless): **`EXIT=0`, `Overall: PASS`**. `relationship-primitives: 23 passed, 0 failed, 0 skipped` — every U1–U11, S1–S4, H1–H8 line reads PASS (full log: session scratchpad `review-run1.log`, lines 2290–2323).
  - **H8 passed on this single run despite the busy pre-check window** — its bracket is seconds-tight and landed between router bursts. The plan's sanctioned quiet-window re-run remedy was therefore **not needed**; one run, recorded honestly.
  - Known-baseline residue, unchanged by this story: `harness-lint suite: FAIL (28 passed, 1 failed)` — the pre-existing L9 BIBLE.md staleness row, which sits on the severed side of the `overallOk` chain (OPEN.md #43), exactly as the test plan's Verification section documents. `Total skipped: 51` (other suites' H-class skips; relationship-primitives itself skipped 0 — the local stack was up).
- [x] `npm run test:playwright` — **not applicable**: no UI surface in this story (test plan, "Test infrastructure").
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence

- [x] **Every acceptance criterion has a passing test** (coverage map verified against the actual suite; all named tests exist in `test/relationship-primitives.test.js` and passed in my run):
  - **AC-1 add idempotent** — U9 (created vs already-existed discrimination), H1 (200 `created`, exactly 1 edge), H2 (repeat → `already-existed`, still 1 edge).
  - **AC-2 delete targeted** — U10 (`deleted` vs `not-found`, `deletedCount`), H3 (reverse-direction and other-type decoy edges survive — `test/relationship-primitives.test.js:615-620` asserts decoy survival explicitly), H4 (repeat → `not-found`, removes nothing).
  - **AC-3 preconditions fail loudly** — U5 (missing/empty fields, 400 naming the field, zero Cypher), U6 (unknown relType incl. story-named `HAS_SUBGOAL`, 400 + allowed list), U7 (firmware-aliased-but-non-whitelisted `IS_THE_CONCEPT_FOR`/`CLASS_THREAD_INITIATION`, 400 both ops), U8 + S2 (alias-layer resolution, no alias literals — `relationships.js:67-68` builds `ALLOWED` via `firmware.relAlias`), U11/H5 (404 naming exactly the missing uuid(s)), H6 (400 live, both routes).
  - **AC-4 owner-gated, locally reachable** — gate at `src/api/normalize/relationships.js:102` (`!isOwner(req) && !req.localTrusted` → 403, the wipe.js pattern); U1/U2 (unauthenticated-shaped → 403 before any Cypher), U3 (**authenticated non-owner → 403 from both operations**), U4 (`localTrusted` passes), H1–H6 (success paths via container loopback — the trusted-local convention itself), H7 (host-side POST → 401, the remote path), S3 (both POSTs registered on the fixed mount).
  - **AC-5 strfry-free + hazard documented** — S1 (import surface exactly `{neo4j-driver, ./firmware, middleware/auth}`; forbidden specifiers absent), every U test (child_process call delta 0), H8 (scan-count equality bracketing a full add+delete cycle), S4 (header cites `firmware/install` and explains the hazard), U9/U10/H1/H3 (`note` matching `/install/i` on `created`/`deleted` only).
- [x] **No criterion silently dropped.** The book's minimum floor (add-new, add-idempotent, delete-existing, delete-missing, nonexistent node, rejected relType, non-owner 403 both ops, no-strfry-write) is fully present and passing.
- [x] **No behavior added that isn't in the story.** The module contains exactly the two handlers, shared validation, the diagnostic 404 helper, and the whitelist. Direction and self-loop non-policy are documented (`relationships.js:9-11`) per ADR, not new behavior.
- [x] **Delivery note:** the story's staging delivery bullet (read-only deployment probe, `safe-to-merge` before the book's merge) is book-level, carried by story #2 (Draft, in-range) and the Director's merge-time check — not a blocker for this story's per-story review.

## ADR adherence

Checked clause-by-clause against ADR 0001's Implementation notes:

- [x] **Files match:** new `src/api/normalize/relationships.js`; registration-only touch to `src/api/normalize/index.js`. Diff confirms **no changes** to `src/middleware/auth.js`, `src/firmware/install.js`, `src/api/neo4j/*`, or any firmware JSON.
- [x] **Import surface exactly three requires** — `relationships.js:60-62`: `../../lib/neo4j-driver` (`runCypher`/`writeCypher`, exported at `src/lib/neo4j-driver.js:146` as cited), `./firmware`, `../../middleware/auth` (`isOwner` at `src/middleware/auth.js:265` as cited). Nothing else; S1 enforces it mechanically.
- [x] **Whitelist via `relAlias`** — `relationships.js:67-68` matches the ADR sketch verbatim (`WHITELISTED_CANONICALS = ['CLASS_THREAD_TERMINATION','CLASS_THREAD_PROPAGATION']`, `ALLOWED` built at module load). `firmware.relAlias` verified at `src/api/normalize/firmware.js:71-80` with the `:76` alias-passthrough fallback, exactly as the ADR describes.
- [x] **Gate order** — `gateAndValidate` (`relationships.js:101-125`): (1) owner gate → 403, (2) required non-empty string fields → 400 naming the field, (3) `resolveRelType` → 400 with `allowed`. Matches ADR note order; U1/U3/U5 confirm the gate fires before any Cypher.
- [x] **Response contract** matches the decision-5 table: 200 + `result` discriminator for all four converged outcomes (`relationships.js:166-175`, `:204-214`), hazard `note` only on `created`/`deleted` (`:174`, `:213`), 404 `{success:false, error:'Node not found: …', missing:[…]}` (`:138-142`), 400s with `allowed` (`:121`), 403 body text exactly the ADR's `'Editing relationships requires owner authentication'` (`:105`), 500 catch (`:176-179`, `:215-218`), 401 left to default-deny middleware (H7).
- [x] **Cypher matches the sketches** — add (`:156-161`): `MATCH`/`MATCH`/`OPTIONAL MATCH`/`WITH count`/`MERGE`/`RETURN alreadyExisted, labels`; delete (`:194-198`): `OPTIONAL MATCH`/`DELETE`/`RETURN count(r), labels`. Zero rows → diagnostic `runCypher` naming missing uuid(s) (`:131-143`). Label-free match honors decision 4; labels echoed in responses.
- [x] **Injection boundary** — only `alias` (a value that passed `ALLOWED.has`, produced by the firmware layer, never the caller's raw string) is interpolated into query text (`:158`, `:160`, `:196`); U8 pins this behaviorally, S2 structurally.
- [x] **Inline-require registration** — `index.js` diff: `const { handleAddRelationship, handleDeleteRelationship } = require('./relationships');` + two `app.post` lines, inline inside `registerNormalizeRoutes` immediately above the firmware-install require, exactly the ADR's two-route registration keeping `index.js` top-of-file imports untouched.
- [x] **No new dependencies** — no `package.json` change in the range.
- [x] **One journaled deviation** (story `## Deviations`, Gate-4-accepted): the header usage example uses the canonical slug `CLASS_THREAD_TERMINATION` instead of the ADR sketch's `"HAS_ELEMENT"`, because the ratified S2 test forbids quoted alias literals anywhere in the module. Verified: doc-level only; both spellings accepted at runtime (U8). The stricter ratified clause correctly won. No other deviation found.

## Concept-graph integrity

- [x] Handles referenced by the story are in `kind:pubkey:slug` form (`39998:<TA>:relationship` etc.) with the runtime-resolution note; the **code** never constructs or references a concept handle at all.
- [x] No concept definitions changed → **no firmware reinstall needed**, per ADR Consequences ("Firmware reinstall required? No") — consistent with the diff (no firmware JSON, no `install.js` touch).
- [x] Orientation via `/api/concept-graph/summaries` was performed and recorded in the ADR's Context (Architecture phase); the module itself has no concept-derivation logic to mis-orient.

## Things tests can't catch

- [x] **No secrets** — grep of `relationships.js` for pubkey/npub/nsec/secret/token/password: zero hits.
- [x] **No leftover debug logging / `console.log`** — the only console output is `console.error` on the two catch paths (`:177`, `:216`), matching the surface convention (20 `console.error` uses in `normalize/index.js`).
- [x] **No commented-out code, no TODO/FIXME** (grep clean).
- [x] **Error paths:** all caller-input failures typed and loud; driver failure → 500 with message. One narrow gap recorded as non-blocking finding 1 below.
- [x] **Concurrency:** `MERGE` keeps the graph correct under concurrent identical adds; the `created`-vs-`already-existed` misattribution is the ADR's accepted caveat (Consequences), fine for a single-operator tool.
- [x] **Security:** input validated at the boundary (types, non-empty, whitelist); the relationship type — the one thing Cypher can't parameterize — is interpolated only from the firmware-derived whitelist value; uuids travel as query parameters (`$fromUuid`/`$toUuid`), never interpolated. The gate admits owner *or* genuinely-local caller only; authenticated non-owners are 403'd (the story's explicit hardening over surface default-deny).
- [x] **TA pubkey never referenced** — grep for `pubkey|82b75e47` in `relationships.js`: zero hits. The module neither filters by, signs as, nor names the TA identity; ADR 0015's `LEGACY_*` exception is untouched.
- [x] **Scope creep:** none in code — the range's only `src/` changes are the two in-scope files; process artifacts noted in the header of this review.

## House rules check

- [x] Concept Graph API authority respected (orientation recorded in ADR; no BIBLE re-derivation in code).
- [x] No new lint/typecheck/build tooling (no tooling or dependency changes anywhere in the range).
- [x] No hardcoded TA pubkey (verified above); Docker calling conventions honored (container-loopback operator path documented in the module header `relationships.js:48-57`).

## Product-guide adherence

- N/A — no PRD; this is a Direction-mode book anchored to an acceptance frame (`engineering-team/audits/relationship-primitives/book.md`).

## Findings

### Blocking

None.

### Non-blocking

1. **`src/api/normalize/relationships.js:164`, `:201`** — `return respondMissingNodes(res, …)` is returned **without `await`** from inside the `try`. In an async function, `return promise` does not route the promise's rejection through the surrounding `catch`, so if the *diagnostic* `runCypher` rejects (driver dies between the main query and the diagnostic — a vanishingly narrow window, since the main query just returned zero rows successfully), the rejection is unhandled under Express 4 and the request hangs instead of 500ing. Optional improvement: `return await respondMissingNodes(…)` at both call sites. Not blocking: the ADR's own sketch doesn't specify `await`, the primary driver-failure path *is* caught, and the 500 path is deliberately un-pinned by the test plan.
2. **ADR 0001, Context → "ADR conflict check"** — cites the authenticated-non-owner remainder as `security-auth-exposure/0002` "residual **(c)**"; the actual residual list (`engineering-team/decisions/security-auth-exposure/0002-default-deny-unauthenticated-mutations.md:75`) has it as **(b)** ((c) is the `ProfileTagsSection` UX note). Citation-only; the substance (the gap exists and this story covers it for its two operations) is correct. Known from Gate 2; my role's output is the review file, so recorded here rather than edited into the ADR.
3. **ADR 0001, Implementation notes** — "mirroring the firmware-install require at `:3325`": at the review base (`49e863cd`) that require sits at `src/api/normalize/index.js:3326`. Citation-only; same handling as finding 2.
4. **`isOwner` ≡ `isOwnerOrAdmin`** (`src/middleware/auth.js:265` → `:250`) — the "owner gate" also admits configured **admin** pubkeys, not the owner alone. This is exactly the templated wipe.js gate's semantics, which the ADR pinned by name and line, so it is ADR-conformant and not a defect of this story — recorded because the story's AC language says "owner gate," and the admin-inclusion nuance is worth carrying into the separately-scoped admin-mutation-surface follow-up (intake 2026-07-21).

### Harness friction

None — story, ADR, test plan, and journal were accurate guides for this review; the two ADR citation nits above were already flagged at Gate 2 and are recorded as findings, not new friction.

## Verdict

**PASS**

The diff is mergeable as-is: all 23 ratified tests pass on my own full-gate run (`EXIT=0`, `Overall: PASS`), every acceptance criterion is covered and verified, the implementation matches ADR 0001's notes clause-for-clause with one accepted doc-level deviation, the strfry-free guarantee holds both structurally (S1) and behaviorally (H8), and the sweep found nothing blocking.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place (`engineering-team/stories/relationship-primitives/1-relationship-add-delete-primitives.md`). No files moved — retirement is per-epic.
- [x] Completion detection run: the book (`engineering-team/audits/relationship-primitives/book.md`) is **not** yet complete — story #2 (read-only deployment probe, the operator-ruled fix-forward carrying the frame's bullet-8(a) deployment evidence) is still Draft, and the staging delivery evidence + `safe-to-merge` output are not yet journaled. No `/close-book` offer at this time.
