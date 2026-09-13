# Review: Story 1 — magic-carpet runs production's security hardening

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-12
**Diff:** `git diff origin/feature-magic-carpet...fix/mc-security-parity` (impl `f0dc38ce`, tests `9b7dc355`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` (`node test/test.js` in the worktree, stack-free) — **Overall: PASS**. All seven security suites green: close-unauth-write-surface 14/0, default-deny-mutations 14/0, login-signature-verification 13/0, publish-event-signature-verification 2/0, strfry-wipe-owner-gate 3/0, users-page-neo4j-endpoint 2/0, site-trust-signals 20/0 (8 H-class SKIP, no stack). Bounty unit tests also pass. Re-run independently by the Reviewer (not relying on an in-container run — OPEN.md #271).
- [ ] `npm run test:playwright` — not run; there is no browser suite for this story. Live-host / browser checks are deferred to deploy (see Things-tests-can't-catch).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test (or a deferred-to-deploy live check, noted):
  - No credential-leaking query endpoint → run-query route + `runQuery.js` removed; `users-page-neo4j-endpoint` AC-2 green. Live "no password in any response" is a deploy check.
  - Write surface closed (parity #1/#2) → `close-unauth-write-surface` + `default-deny-mutations` green.
  - Relay wipe owner-only → `strfry-wipe-owner-gate` green.
  - No owner powers without a verified login → login reframe + default-deny 401 green.
  - Published events authentic → `publish-event-signature-verification` green (forged rejected before `strfry import`; valid still publishes).
  - Login full parity → `login-signature-verification` green.
  - Own features still work → Users-page AC-1 green; bounty/receiving live checks deferred to deploy.
  - Ownership list current → `site-trust-signals` U6c green.
  - Shipped & verified → deploy-time.
- [x] No criterion silently dropped.
- [x] No behavior added beyond the story (see ADR adherence + Deviations).

## ADR adherence
- [x] **Wholesale files are byte-identical to `origin/staging`** — verified by diff: `src/middleware/auth.js`, `src/api/neo4j/queryPost.js`, `src/api/strfry/wipe.js`. This is the strongest possible parity guarantee; the ADR's "diverged only by the gate, nothing MC-specific lost" claim holds (identical `module.exports`, no MC-only functions).
- [x] `publishEvent.js` surgical and correct: **resilient** nostr-tools require (absolute → bare fallback, not absolute-only — the ADR's load-bearing requirement, proven necessary in Test Design), assistant-gate (`!isOwner(req) && !req.localTrusted` → 403), client-path `verifyEvent(JSON round-trip)` before `strfry import`. **No `maybeBrainWriteTapestry`** (MC has no such module) — correct.
- [x] MC's own relay fan-out (`invalidateProfileCache` + `publishToRelays`) preserved (logged deviation) — the authenticity guard was placed ahead of it. Dropping it would have been out-of-scope behavior change; keeping it is right.
- [x] Login #3 layered without regressing Matthias's fix: `verifyLoginEvent` + `finalizeAuthenticatedSession` (session regenerate) + `pendingAuth` (identity only after verified login); `session.nsec` is never assigned; the paste-your-nsec page is deleted. Matthias's signature check is subsumed by the stronger staging verifier.
- [x] Firmware internal bridge no longer forges `x-forwarded-for` (`install.js`) — honest-direct-local, per ADR/#1.
- [x] ESTATE trim: `communities`/`curate` removed from `siteTrust.js` (0 refs).
- [x] No new dependencies. No lint/typecheck/build tooling added.

**Deviation review (logged in the story):**
- `fetchProfiles.js` requires made resilient (absolute → bare) — **acceptable**. Load-only, no behavior change; MC's `publishEvent` imports it for the fan-out, and the ported behavioral suites could not load it off-container otherwise. It applies the exact resilient-require pattern the ADR mandates elsewhere. Slightly beyond the auth/publish boundary but principled and minimal.

## Concept-graph integrity
- [x] N/A — no concepts touched (auth/authorization/publish boundary). No firmware reinstall required.

## Things tests can't catch
- [x] No secrets in committed files (scanned the surgical diffs).
- [x] No new debug logging (the one `console.log('Published event to strfry…')` is pre-existing, on staging too).
- [x] No commented-out code.
- [x] **Push discipline honored** — `fix/mc-security-parity` is **not on origin**; nothing describing the exposure is public. Confirmed via `git ls-remote`.
- [x] Security boundaries: the port matches the ratified prod design; the authenticated-non-owner gap is deliberately out of scope (prod has it too).

## House rules check
- [x] Concept Graph API authority respected (N/A here).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
_None._

### Non-blocking
1. **`src/api/openapi.yaml:1286`** — the OpenAPI spec still documents the removed `GET /api/neo4j/run-query` (marked `deprecated: true`). Staging removed this block entirely (0 refs there); the port missed it. Docs-only — the route is gone from `index.js`, so hitting it 404s; no exposure. **Recommend** deleting the block for full staging parity (the spec should not advertise a removed credential-leak endpoint).
2. **`src/firmware/install.js:80,87`** — two comments still reference "the GET run-query endpoint" / "run-query API" (response-shape prose). Staging cleaned these (0 refs). Cosmetic; **recommend** updating on this touch for parity.

Both are trivial doc/comment sweeps that would bring MC to full parity with staging; neither affects the security posture or any test. If not fixed in this branch before deploy, they should be swept to OPEN.md (workflow 5 / OPEN.md #80).

### Harness friction
1. None new this phase. (The zsh `:t`-modifier handle-mangling, OPEN.md #237, recurred while reading `origin/<branch>:path` earlier in the cycle — already a known row.)

## Verdict
**PASS**

The security parity port is complete, faithful (wholesale files byte-identical to staging; surgical changes match the ratified design and the test plan), and independently verified green. The two non-blocking findings are stale documentation of an already-removed endpoint, not security or behavior gaps.

Deferred to deploy (not run here, by design): the full 134-suite in-container runner, and live-host checks (endpoints actually 404/403 on magic-carpet.brainstorm.world; bounty/receiving flows still work; then the operator's Neo4j password rotation per the book).

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result recorded in chat (not here). `/close-book` offer decision left to the operator at the gate.
