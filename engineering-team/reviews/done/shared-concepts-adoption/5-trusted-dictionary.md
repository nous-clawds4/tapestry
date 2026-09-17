# Review: Story 5 — Trusted dictionary

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-07
**Diff:** `git diff 1dd1fc8c...HEAD` on `feat/trusted-dictionary` (story `f8c64b5b`, ADR `6378b9d8`, tests `be56a849`, impl `811455bb`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **Overall PASS**, exit 0, zero failing tests across every suite (reviewer's own
      full run, 2026-08-07; `trusted-dictionary suite: PASS (16 passed, 0 failed, 0 skipped)` —
      the H rows executed against the live stack, no skips; harness-lint 41/0; total skipped
      across all suites 53, all in unrelated suites' preconditioned rows).
- [x] `npm run test:playwright` — not applicable (no Playwright row in the plan; the page is
      fetch+render over the server assembly, walked manually below).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped_ (the vite UI build was exercised for the manual walk).

## Spec adherence

- [x] Every acceptance criterion has passing coverage: AC-1 `U2`/`U3`/`H1`/`S1`; AC-2 `U4`/`U6`/`H1`;
      AC-3 `H2`+`H1`+`S3`; AC-4 `H3`+`H1`+`S3`; AC-5 `H4`+`S2`; AC-6 `U5`+`H1`+`H4`+`S2` (see
      Findings NB-1 for the declined-stays-in half); AC-7 `H4`+`U7`+`S2`; regressions `S4`+`H5`.
- [x] No criterion silently dropped.
- [x] No behavior beyond the story: diff file list is exactly the ADR's implementation-notes list;
      the four Implementer judgment calls are logged in the story's `## Deviations` and all four
      are within the ADR's fixed points (the snapshot-name seconds-stamp is a corrected
      illustration, not a contract change — the ADR pins params-in-json, owner gate, recompute,
      sentinel drop, all honored).

## ADR adherence

- [x] Files match: `src/lib/trustedDictionary.js` (pure, zero-require), `src/api/adoption/index.js`
      (`assembleTrustedDictionary` + `GET /api/trusted-dictionary`, registered :258–262),
      `src/api/normalize/index.js` (concept bootstrap + gated `POST
      /api/normalize/trusted-dictionary-snapshot`), page/route/nav.
- [x] Layering per ADR fixed points: qualifying set resolved at the handler seam (Neo4j two-branch,
      [index.js:182–207](src/api/adoption/index.js:182)); arithmetic in the core; snapshot POST
      recomputes server-side via the exported assembly ([normalize/index.js](src/api/normalize/index.js),
      lazy require — adoption never requires normalize back, no cycle); cutoff reads
      `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` default 0.01 (batch-side, divergence documented in the
      ADR and left parked); threshold `TRUSTED_DICTIONARY_MIN_USERS` default 2; config read at
      handler scope, not module init.
- [x] No new dependencies: `runCypher` (existing shared lib), `getConfigFromFile` (existing) — both
      ADR-authorized; nothing else added.

## Concept-graph integrity

- [x] Handles constructed `kind:pubkey:slug` from the runtime TA
      ([index.js:234](src/api/adoption/index.js:234)); **zero 64-hex literals in the src/ui diff**
      (audited); ADR-0015 `LEGACY_*` constants and their files untouched.
- [x] Firmware reinstall: **not required** — `trusted dictionary snapshot` is runtime-created via
      the ensure idiom (the F1 adoption-disposition precedent), called out in story + ADR. Its
      slugified coord (`trusted-dictionary-snapshot`) is live-proven by H4's #z scan.
- [x] No BIBLE.md/firmware re-derivation in new code.

## Things tests can't catch

- [x] No secrets; the suite's five identities are deliberately non-secret throwaways (documented).
- [x] No leftover debug logging — the only `console.error`s are the module's established
      error-path idiom; no `console.log`, no TODO/FIXME in added lines (grep-audited).
- [x] No commented-out code.
- [x] Error paths: 500-with-message on assembly/mint failure; refusal surfaces as message text in
      the UI; malformed `userPubkey` fails the hex-64 gate into house (never reaches Cypher);
      malformed snapshot json in the strip parses to nulls, never throws.
- [x] Concurrency: GET is read-only; double-publish is UI-busy-guarded and name-deduped
      server-side (see NB-2).
- [x] Security: all Cypher parametrized (`$authors`/`$observer`/`$cutoff`) — no interpolation;
      the mint gate (`isOwner || localTrusted`) runs before any work; the POST ignores
      client-posted membership entirely (recompute), which closes the forged-snapshot vector.

## House rules check

- [x] Concept Graph API authority respected (orientation was via `/summaries`; no new concept
      definitions in code).
- [x] No new lint/typecheck/build tooling.

## Product-guide adherence

- N/A — acceptance-frame book (no PRD). Empty/loading/error states are designed and verified in
  the manual walk.

## Manual walk (live, local stack)

`/tapestry/shared-concepts/dictionary` renders console-clean: threshold in the subtitle, POV
disclosure line ("Scored from the house point of view"), Publish snapshot + Refresh, the designed
empty state (correct — the suite teardown removes the fixture trust rows), and the Published
snapshots strip listing the test runs' mints newest-first ("2026-08-07 — 2 concepts (house POV)"
×3 — exactly the documented one-mint-per-run residue, members = fixtures A and D as designed).

## Findings

### Blocking

None.

### Non-blocking

1. **AC-6, declined-stays-in half — covered by construction, not by a dedicated test.** The
   dictionary assembly never reads the disposition ledger (audited: `dispositionRecords`/
   `LEDGER_SLUG` appear only in the F1 handler — 4 refs module-wide, 0 inside
   `assembleTrustedDictionary`), so declined concepts cannot be excluded. Same structural-coverage
   posture the F2 review accepted for its AC-7. Optional belt-and-braces: a one-line H assertion
   that a declined fixture stays in `entries` — worth adding only if this path ever gains a
   ledger read.
2. **Same-second double-publish collides on the name dedupe** ([normalize/index.js](src/api/normalize/index.js),
   seconds-stamp name) and returns a clean surfaced error. Unreachable through the UI (busy
   guard); arguably correct dedupe semantics. No action.
3. **Garbage config degrades safe:** a non-numeric cutoff yields an empty qualifying set (empty
   dictionary, `cutoff: null` in the disclosure after JSON NaN-serialization); a non-numeric
   threshold falls back to 2 in the core (`Number.isFinite` guard). Cosmetic only; no action.
4. **Snapshot residue accumulates on dev instances** (one element per full-suite run, visible in
   the strip). Documented in the test plan; self-identifying; cosmetic.

### Harness friction

None — every phase doc, port, and pattern pointer this story followed was accurate.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; book arithmetic reported in chat (human-gated flow), offer
      made there — never recorded here.
