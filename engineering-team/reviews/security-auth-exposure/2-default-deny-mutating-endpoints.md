# Review: Story 2 — Default-deny for unauthenticated mutations

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-20
**Diff:** `git diff origin/staging...HEAD` — implementation commit `012f889b` (2 source files); tests `e3f18e5e`; ADR `28a6a9bb`.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS.** Reviewer re-ran the target suite: `default-deny-mutations: 14 passed, 0 failed, 0 skipped`, and story-1's suite still 14/0. Full-suite reviewer re-run: **Overall PASS, 0 FAIL lines, 51 skipped** (env-dependent H-class; +1 vs story-1's 50 is unrelated).
- [x] `npm run test:playwright` — not applicable (no UI change).
- [x] _Lint / Typecheck / Build — not configured; skipped (JS-without-build)._

## Spec adherence

- [x] Every acceptance criterion verified **independently on the live stack**, not just via the suite:

| AC | Check | Result |
|---|---|---|
| AC-1 | unauth `POST /api/firmware/install` | **401** |
| AC-1 | unauth `PUT /api/user-prefs`, `POST /api/run-task` | **401** (verb-agnostic; the old list was POST-only) |
| AC-1 | unauth `DELETE …/meili/wipe` | **401** (verb blind spot closed) |
| AC-2 | allowlist `POST /api/neo4j/query` read | 200 (reaches handler; story-1 gate) |
| AC-2 | `POST /api/strfry/publish` `signAs:client` | 400 (not the 403 gate — client publish preserved) |
| AC-3 | `POST /api/strfry/publish` `signAs:assistant` unauth | **403** ("Signing as the assistant requires owner authentication") |
| AC-4 | authenticated-session mutation | passes middleware (authenticated branch untouched — see below) |
| AC-5 | `GET /api/concept-graph/summaries`, `/api/deploy-safety/status` | 200 |
| AC-6 | **real firmware install via loopback** | `39/39`, `missing:[]`, no auth-gate blocks in logs |
| AC-7 | ships to three instances | deploy-time (Stage 2) |
| legit-public | `POST /api/auth/verify-user` | 400 (reaches handler — auth-prefix skip-list intact) |

- [x] No criterion silently dropped. AC-4 (owner) is covered by the unchanged authenticated branch + the `publishEvent` gate's `isOwner` (symmetric to the live `localTrusted` proof); AC-7 is deploy. Both appropriately deferred, not dropped.
- [x] No behavior added beyond the ADR — the diff is exactly the three specified changes.

## ADR adherence

- [x] Matches ADR 0002's implementation notes exactly: method-based default-deny with exact-match `PUBLIC_MUTATIONS = ['/api/neo4j/query','/api/strfry/publish']` (`auth.js`), `writeEndpoints` deleted, `protectedGetEndpoints` kept; bypass broadened to `req.path.startsWith('/api/')`; `signAs:'assistant'` gated on `isOwner(req) || req.localTrusted` in `publishEvent.js`.
- [x] Exact-match allowlist (`.includes(req.path)`) is correct and fail-closed — a trailing-slash or sub-path variant denies rather than over-matches. The two entries are exact route paths.
- [x] No new dependencies; `publishEvent → middleware/auth` require adds no package and has **no circular-require breakage** (verified: both resolve to functions).

## The bypass broadening — scrutinized (largest blast-radius change)

The change widens ADR 0001's honest-local bypass from two path prefixes to all `/api/*`. I verified it is safe on three axes:

1. **Externally unspoofable.** `isDirectLocal` requires a loopback socket peer AND no `X-Forwarded-For`/`X-Real-IP`. On a deployed instance an external request either comes via nginx (header present) or hits the published app port with a non-loopback peer — neither can produce it. Unchanged from ADR 0001; only the path scope grew.
2. **Route-level guards remain in force.** The critical test: a **loopback** `POST /api/admin/add` and `/api/concept/*/pull-community-class-thread` (both `requireOwner`) return **401** — the global bypass calls `next()`, then the route guard blocks. So broadening does **not** defeat owner-gated routes; it only lets in-container callers reach the *un*guarded endpoints (the operator, the firmware bridge, the trusted-list cron — all trusted, and the reason the cron doesn't 401).
3. **Contrast confirmed.** Loopback `trusted-list/refresh-all-pinned-tags` passes auth and runs the handler (curl timeout on real work); the *proxied* call to the same path is denied **401 in ~10ms**.

Net: the local-trust surface grew to all in-container callers, which are already trusted (shell access or the app's own self-calls); no external exposure. Sound.

## Concept-graph integrity

- [x] No handles or concept definitions changed.
- [x] **Firmware reinstall:** not required by the change — and a full loopback reinstall was run as the AC-6 test and succeeded (39/39), so the graph is intact and the internal bridge is unaffected.

## Things tests can't catch

- [x] No secrets committed; the change *reduces* exposure.
- [x] No leftover debug logging / commented-out code. The removed `writeEndpoints` list is a deletion, not a comment-out. Added comments cite the ADR.
- [x] Error paths: clean 401 (deny) and 403 (TA-signing) JSON; `req.headers &&` guard from ADR 0001 preserved.
- [x] Concurrency: none introduced.
- [x] **Security (the point):** the unauthenticated mutation surface is now default-closed. 44 previously-unguarded admin mutations (incl. `firmware/install`, `tapestry-key/*`, `run-task`, `strfry/wipe`, `meili/wipe`, and the unauth-TA-signing `trusted-list/publish` + this endpoint's `signAs:'assistant'`) are closed by construction, and every future mutating endpoint is private by default.

## House rules check

- [x] Concept Graph API authority respected (untouched).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
None.

### Non-blocking
1. **Residual (by design, ADR-documented):** an anonymous caller can still `POST /api/strfry/publish` an *own-signed* event to local strfry — a relay accepting signed events (permissionless publish; spam is a relay write-policy/rate-limit concern, out of scope). Flagged, not a defect.
2. **Authenticated-non-owner privilege granularity (out of scope, worth a backlog note):** the authenticated branch still `next()`s any logged-in user for non-owner-listed mutations. This story deliberately targets *unauthenticated* mutations; tightening logged-in-guest access is a candidate follow-up.
3. **`src/api/strfry/commands/publishEvent.js:10`** — `isOwner` imported at module top (destructure). Resolves correctly in the live load order (verified); a lazy `require(...).isOwner` inside the handler would be immune to future reorderings. Optional, not required.

### Harness friction
None new. (The pre-existing `test.js` `overallOk` severed-block defect, OPEN.md #43, is untouched; the new suite is correctly in the live chain.)

## Verdict
**PASS**

The diff is exactly ADR 0002; every acceptance criterion is verified live (AC-1/2/3/5/6 directly, AC-4 by the unchanged authenticated branch + structural symmetry, AC-7 at deploy). The highest-risk change — broadening the honest-local bypass — is verified safe: it is externally unspoofable and does not defeat route-level owner guards. The real loopback firmware install (39/39, no auth blocks) closes the one criterion the automated tests cover only structurally. No blocking findings; the two residuals are accepted-by-design and ADR-documented.

Remaining before the book closes: ship to **staging → prod → feat/tags** (AC-7), and the operator-side companions (rotate the Neo4j password; firewall Bolt `7687`/`7474`) — still not addressed by code.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done`.
- [x] Completion detection run — see below.
