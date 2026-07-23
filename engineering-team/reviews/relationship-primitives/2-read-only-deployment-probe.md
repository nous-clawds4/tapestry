# Review: Story 2 — Read-only deployment probe for the primitives surface

**Reviewer:** Claude (acting as Reviewer, fresh context — implementation conversation not seen)
**Date:** 2026-07-22
**Diff:** `git diff 31166bdd..HEAD` on `feat/relationship-primitives` (implementation commit `3aacb0ba`)
**Story:** `engineering-team/stories/relationship-primitives/2-read-only-deployment-probe.md`
**ADR:** `engineering-team/decisions/relationship-primitives/0002-read-only-deployment-probe.md`
**Test plan:** `engineering-team/stories/relationship-primitives/2-read-only-deployment-probe.test-plan.md`

Range contents (3 files, +32/-0): the story's code is `src/api/normalize/probe.js` (new, 20 lines) + the 5-line registration in `src/api/normalize/index.js` (`:3332-3336`). The third file — `engineering-team/audits/relationship-primitives/journal.md` (+7, the Director's Gate-4 entry) — is Direction-mode book process, expected under per-phase commits; noted, not story code. Working tree clean at review start; nothing outside the range considered.

**Test-integrity check (run myself):** `git diff 31166bdd..HEAD -- test/` is **empty** — no test was touched between the ratified failing suite (Gate 3, commit `31166bdd`) and the implementation. `package.json`/`package-lock.json` untouched (the range's only files are the three above). `src/api/normalize/relationships.js` is **byte-identical** across the range — same git blob hash (`25c35329…`) at `31166bdd` and `HEAD` — so story #1's ratified S1 (require list pinned exactly, `test/relationship-primitives.test.js:507-526`) and S2 (no raw alias literals, `:528-539`) audit an unperturbed file. `src/middleware/auth.js` also untouched in the range.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` (full runner, no filters) — run by me on this checkout, **two runs recorded honestly**:
  - **Pre-run strfry drift check** (per the test plan's H4 drift note): `GET /api/strfry/scan/count` sampled `5995596` @ 05:32:45Z → `5995596` @ 05:33:10Z → `5995598` @ 05:34:10Z — **busy window** (strfry-router trickling ~2 ev/min in bursts).
  - **Run 1** (full, launched into the busy window): `EXIT=1`, `Overall: FAIL`. Probe suite `8 passed, 1 failed` — the only failure is **H4**, with exactly the documented drift signature: `scan count went 5995710 -> 5995711` (one router-sync event landed inside the bracket). All eight functional/structural tests passed: U1, U2, S1, S2, S3, H1, H2, H3. `relationship-primitives: 23 passed, 0 failed` (story #1 fully green, H8 included — no regression). Every other suite PASS; `Total skipped: 51`; `harness-lint suite: FAIL (28 passed, 1 failed)` — verified first-hand by running `bash scripts/harness-lint.sh` myself: the single violation is the pre-existing baseline `VIOLATION L9 BIBLE.md — 'Last updated: 2026-07-02' lags the last git change (2026-07-20) by 18d (>14)`, which sits on the severed (non-gating) side of the `overallOk` chain (`test/test.js:927` ends the live chain at `relationshipPrimitivesProbeResult.fail === 0`). Run 1's Overall FAIL is therefore attributable **solely** to H4's drift artifact. (Full log: session scratchpad `reviewer-npm-test-run1.log`.)
  - **Run 2 — the test plan's sanctioned quiet-window remedy** ("a count-drift failure is an environment artifact… quiesce and re-run"): drift re-check found the router still busy (`5995724` @ 06:05:59Z → `5995731` @ 06:07:06Z), so I monitored for stability and fired the standalone suite the moment two consecutive samples matched (`5995733` @ 06:07:32Z = `5995733` @ 06:08:00Z): `node test/relationship-primitives-probe.test.js` → **`9 passed, 0 failed, 0 skipped`, exit 0 — H4 PASS**. Same remedy, same semantics, as story #1's H8 precedent (accepted at that story's Gate 4 and in this story's own test-plan Verification section).
  - Net: every one of the suite's 9 tests has passed on my own runs; the single run-1 failure is the pre-declared environment artifact, resolved exactly as the plan sanctions.
- [x] `npm run test:playwright` — **not applicable**: no UI surface (test plan, "Test infrastructure").
- [x] _Lint not configured — skipped_ (harness-lint covered above).
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence

- [x] **Every acceptance criterion has a passing test** (coverage map verified against the actual suite; all named tests exist in `test/relationship-primitives-probe.test.js` and passed on my runs):
  - **AC-1 answers without credentials** — U1 (bare `{}` request → 200 + exact body, `test/relationship-primitives-probe.test.js:194-205`), H1 (host-side credential-free GET = the unauthenticated-remote class per ADR `security-auth-exposure/0001` → 200 `application/json` exact body).
  - **AC-2 the answer evidences the primitives surface** — U1/H1 (body carries `surface: 'relationship-primitives'` + `operations` naming both primitives — attributable, not generic), S2 (GET registered *inside* `registerNormalizeRoutes`, the same delivery unit as the primitives; regex pins the closing quote so the sibling path can't false-satisfy, `:245-248`), S3 (every advertised operation is a registered `app.post` in `index.js` — the honesty cross-check under future renames, `:251-270`).
  - **AC-3 missing-route contrast** — H2 (`:286-304`): sibling `GET /api/normalize/relationship-primitives-missing-sibling` → 404 non-JSON `Cannot GET …` while the probe → 200 JSON; asserts statuses differ AND content classes differ — exactly the pair the ADR's decision 4 names for the staging capture.
  - **AC-4 zero side effects** — S1 (probe.js contains **no `require` at all** and no `import` — the empty import surface structurally cannot reach Neo4j/strfry/`child_process`/signing keys, `:221-232`), U2 (two consecutive calls byte-identical — nothing computed, no timestamp), H3 (unauthenticated POST to the probe path stays 401 — registering the GET opened no mutation capability), H4 (strfry scan-count bracket equal around three byte-identical GETs — green in the quiet-window run).
  - **AC-5 constitutes bullet 8(a) evidence on staging** — H1+H2 rehearse the exact reproducible request pair locally, per the story's "Delivery" section and ADR decision 5 the staging capture itself is the **Director's journaled read-only exercise, not a test file**. Not a per-story review blocker (same handling as story #1's delivery bullet); see the completion-detection note below.
- [x] **No criterion silently dropped.** The test plan's coverage map, edge cases (bare request, prefix-superset sibling, evidence-rot cross-check, mutation-sneak, stack-absent SKIP), and pre-declared H3 pre-implementation pass all verified against the ratified suite.
- [x] **No behavior added that isn't in the story.** `probe.js` is 20 lines: one static literal, one handler, exports — nothing else. **No health/monitoring creep**: no version, uptime, counts, timestamps, or computed fields (the story's scope note and the ADR's "deliberately excluded" list, enforced by U2/H4 byte-identity). The header comment explicitly forbids future additions (`probe.js:4-6`).

## ADR adherence

Checked clause-by-clause against ADR 0002's Implementation notes:

- [x] **Files match exactly:** new `src/api/normalize/probe.js` + registration-only touch to `src/api/normalize/index.js`. **No changes** to `relationships.js` (blob-identical, verified above), `src/middleware/auth.js`, any firmware JSON, or anything else.
- [x] **Zero-require module:** `probe.js` has an empty import surface — no `require`, no `import` (S1-enforced; visually confirmed on all 20 lines). The module matches the ADR's sketch essentially verbatim, including the contract-stating header comment.
- [x] **Static literal exactly as pinned** (ADR decision 3): `PROBE_RESPONSE` at `probe.js:10-14` is `{ success: true, surface: 'relationship-primitives', operations: ['add-relationship', 'delete-relationship'] }` — field-for-field, value-for-value the ADR's literal. Status 200 via `res.json`. Both `handleRelationshipPrimitivesProbe` and `PROBE_RESPONSE` exported as specified.
- [x] **Registration placement** (ADR decision 1 + Implementation notes): `index.js:3332-3335` — inline `require('./probe')` + `app.get('/api/normalize/relationship-primitives', …)` inside `registerNormalizeRoutes`, **immediately after the relationships registration block** (`:3328-3330`) and before the firmware-install require, mirroring the surface's inline-require pattern. Comment cites the ADR and the NOT-a-health-endpoint constraint, as sketched.
- [x] **Route/method per ADR decisions 1-2:** GET (the only method that passes default-deny credential-free with an attributable body — Express's method-scoped matching makes the answer genuine registration evidence), flat kebab-case name on the same fixed mount as the primitives, no collision with any `auth.js` list — re-verified against source: the path matches nothing in `protectedGetEndpoints` (`src/middleware/auth.js:460-465`), so an unauthenticated GET reaches the deliberate public-read `return next()` at `:474`; the authenticated branch's `'/api/normalize'` entry in `ownerOnlyEndpoints` is POST-scoped (`:417-419`) and `ownerOnlyGetEndpoints` (`:422-427`) doesn't match, so `next()` at `:440`; a POST to the same path stays inside default-deny (`:448-456`, `PUBLIC_MUTATIONS` exact-match excludes it) → 401, confirmed live by H3 in both my runs.
- [x] **No new dependencies** — no `package.json` change in the range; the probe by construction depends on nothing.
- [x] **No deviations:** the Implementer reported zero deviations (journal Gate-4 entry) and I found none — the shipped code is the ADR sketch, byte-for-byte in every load-bearing particular.

## Concept-graph integrity

- [x] Story touches **no concepts** ("Concepts touched: none" — no graph access is part of the probe's contract, operator-ruled). The code references no concept handle, constructs none, and cannot reach the graph (empty import surface).
- [x] **No firmware reinstall needed** — no concept definitions changed (ADR Consequences: "Firmware reinstall required? No"), consistent with the diff (no firmware JSON, no `install.js` touch).
- [x] Orientation via `/api/concept-graph/summaries` was performed and recorded at Architecture (ADR Context, second paragraph) and confirmed the no-concept scope; nothing in the probe re-derives from BIBLE.md.

## Things tests can't catch

- [x] **No secrets** — sweep of the full range diff for 40+-char hex, `password|secret|api[_-]?key|token`: zero hits. **No TA pubkey anywhere** (neither literal nor runtime-resolved — the probe has no identity surface at all); ADR 0015's `LEGACY_*` exception untouched.
- [x] **No debug logging, no `console.*`, no commented-out code, no TODO/FIXME** — `probe.js` is 20 lines with a documentation header only; the `index.js` touch is 5 lines (comment + require + registration).
- [x] **Security / disclosure** — the probe is *deliberately* public and credential-free; that is its contract, and the ADR's conflict check places it in `security-auth-exposure/0002`'s sanctioned public-read class ("the final `return next()` now serves only reads and allowlisted mutations"). Verified the disclosure is exactly as accepted: the static body names **two route slugs already public in this open-source repo** and nothing else — no version, no config, no state, no data. No mutation capability added: the registration is GET-only, `PUBLIC_MUTATIONS` untouched, and an unauthenticated POST to the same path 401s (H3, verified in both my runs). The handler reads **nothing from the request** (`probe.js:16-18`) — no input, no injection surface, no reflected content.
- [x] **Concurrency / races** — stateless static literal; nothing shared, nothing computed. Repeated-call byte-identity is test-pinned (U2, H4).
- [x] **Error paths** — none exist to mishandle: the handler cannot throw (no I/O, no parsing, no state).
- [x] **Scope creep: none.** The range's only `src/` changes are the two in-scope files; the only other file is the Director's journal entry (book process). No product-team writes, no doc drift, no opportunistic refactors.

## House rules check

- [x] Concept Graph API authority respected (orientation recorded in the ADR; no concept logic in code).
- [x] No new lint/typecheck/build tooling (no tooling or dependency changes anywhere in the range).
- [x] No hardcoded TA pubkey (verified above). Docker/host calling conventions honored — the H-class is deliberately host-side because host→`:7778` *is* the unauthenticated-remote class this probe exists to answer.

## Product-guide adherence

- N/A — no PRD; Direction-mode book anchored to an acceptance frame (`engineering-team/audits/relationship-primitives/book.md`).

## Findings

### Blocking

None.

### Non-blocking

1. **`src/api/normalize/probe.js:10-14`** — `PROBE_RESPONSE` is exported as a mutable object (no `Object.freeze`), so a future importer could theoretically mutate the evidence body at runtime. Optional improvement: `Object.freeze` the object and its `operations` array. Not blocking: the ADR sketch (ratified at Gate 2) has no freeze, nothing in production imports the module except the registration (which touches only the handler), and U2/H4 byte-identity plus S3's cross-check would surface any drift that matters.

### Harness friction

1. **`engineering-team/audits/relationship-primitives/journal.md:117-121`** — an orphaned Gate-1 (story #2) entry body with **no `##` heading** sits at the file tail; the fragment **pre-exists this diff** (verified present at base `31166bdd`), so the Gate-4 entry — correctly appended after the last *headed* entry — now sits interleaved above it, and the append-only record misreads at the tail (the Gate-1 body visually attaches to the Gate-4 entry). Director's artifact, not story code; flagged for the Director to repair the heading and to file the OPEN.md `meta` row (this reviewer's write scope per the task is the review file + story status flip, no commits).
2. **`engineering-team/epics/relationship-primitives.md:20`** — the epic roster still annotates story #1 as "**Draft.**" though its story file is `Done` (flipped at story #1's review). Stale annotation only; the lint's L1 checks the story files, which are correct. Director/PO lane.

## Verdict

**PASS**

The diff is the ADR realized without deviation: a 20-line zero-require module plus a 5-line registration, nothing else. All 9 ratified tests pass on my own runs (8 functional/structural on the first full-gate run; H4 — the pre-declared drift-sensitive strfry bracket — green on the sanctioned quiet-window re-run, `9 passed, 0 failed, 0 skipped`, exit 0). Story #1's suite is 23/0 with its audited file blob-identical; no test was weakened; the sweep found nothing blocking. Every acceptance criterion is covered; AC-5's staging capture is, by the story's own Delivery section, the Director's journaled exercise downstream of this review.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place (`engineering-team/stories/relationship-primitives/2-read-only-deployment-probe.md`). No files moved — retirement is per-epic.
- [x] **Completion detection run:** the book (`engineering-team/audits/relationship-primitives/book.md`) is **not yet complete, but its acceptance frame now looks satisfiable end-to-end.** Bullets 1-7 shipped with story #1 (Done). Bullet 8: (b) local functional evidence is captured (both suites green); (a) staging deployment proof is now *mechanically satisfiable exactly as written* — the probe/sibling pair replaces the falsified auth-class mechanism — but the staging merge, the 8(a) capture (`curl -si https://staging.brainstorm.world/api/normalize/relationship-primitives` + `…-missing-sibling`), and the 8(c) `safe-to-merge` output are the **Director's remaining deploy-stage work, not code**. No `/close-book` offer until that evidence is journaled.
