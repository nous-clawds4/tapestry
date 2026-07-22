# Review: Story 1 — Close the unauthenticated write-surface exposure

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-19
**Diff:** `git diff origin/staging...HEAD` — implementation commit `1fbf4a53` (3 source files); tests `99019d90`; ADR `70531bc6`.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS.** Target suite `close-unauth-write-surface: 14 passed, 0 failed, 0 skipped` (re-run by reviewer). Full-suite run (post-impl) `Overall: PASS`, **0 FAIL lines**, 50 skipped (env-dependent H-class, unchanged from baseline). Baseline (pre-impl) was FAIL on the 8 intended failures — the expected transition.
- [x] `npm run test:playwright` — not applicable (no UI change).
- [x] _Lint / Typecheck / Build — not configured; skipped (JS-without-build, per CLAUDE.md)._

## Spec adherence

- [x] Every acceptance criterion verified — independently, on the live local stack, not just via the suite:

| AC | Check | Result |
|---|---|---|
| AC-1 | proxied unauth `POST /api/normalize/*` | **401** |
| AC-2 | proxied unauth **write** `POST /api/neo4j/query` (`DETACH DELETE`) | **403** |
| AC-2 | proxied unauth **read** | 200 (runs — refined AC-2, operator-approved) |
| AC-3 | spoofed `X-Forwarded-For: 127.0.0.1` on `/api/normalize` | **401** (header presence = proxied) |
| AC-4 | owner UI path | code-audited (see below) |
| AC-5 | proxied deploy-safety status + concept-graph reads | 200 / 200 |
| AC-6 | **real (non-dryRun) firmware install** | `39/39 success`, log "SUCCESS", **no gate-block in logs** |
| AC-7 | ships to staging/prod/feat/tags | deploy-time (Stage 2), not this review |

- [x] No criterion silently dropped. AC-4 and AC-7 are the only ones not fully live-tested here — see below; both are appropriately deferred, not dropped.
- [x] No behavior added beyond the story. The diff is exactly the ADR's three changes.

**AC-4 (owner UI) — how it's covered without a scriptable NIP-07 login:** the write-gate is `isWrite && !isOwner(req) && !req.localTrusted`; `isOwner` (auth.js) checks `session.pubkey === ownerPubkey`; the concepts UI's `ui/src/api/cypher.js` posts same-origin with no `credentials:` override, so an owner's session cookie flows and `isOwner` returns true → write passes. The `/api/normalize` owner branch (`auth.js:327+`) is untouched by this diff. The `localTrusted`-write live check (200) exercises the identical OR-position the owner takes. A browser owner-session authoring smoke belongs to the staging deploy (NIP-07 can't be scripted; `docs/SMOKE_TEST.md` §NIP-07 limit) — recorded, not skipped.

**AC-6 — verified for real, not just dryRun.** `dryRun:true` can skip the write path; I ran a full non-dryRun install. It completed 39/39 and — the load-bearing signature — produced **no `"Write queries require owner authentication"` in `/var/log/brainstorm/`**, proving the in-process bridge's `/api/neo4j/query` and `/api/normalize` writes passed via `req.localTrusted`. This is the change most at risk (install.js bridge XFF removal) and it is confirmed.

## ADR adherence

- [x] Files changed match the ADR's implementation notes exactly: `auth.js` honest-local gate + `req.localTrusted` (`:317-324`), `queryPost.js` write-gate + `isOwner` import (`:27`), `install.js` bridge XFF removal (`:1349`). `172.18.0.1` dropped; `x-real-ip` included; `trust proxy` stays off (S-class sentinel confirms none in `src/`).
- [x] Layering respected: the read/write decision lives in the handler (where the Cypher body is visible), authorization identity in the middleware — as the ADR reasoned.
- [x] No new dependencies. `queryPost` → `middleware/auth` require adds no package; reviewer confirmed **no circular-require breakage** (`isOwner` resolves to a function when `queryPost` loads standalone).
- [x] The optional `customerOrOwnerEndpoints` cleanup was (correctly) left out — the ADR marked it non-required.

## Concept-graph integrity

- [x] No handles introduced; no concept definitions changed.
- [x] **Firmware reinstall:** not required by the change (auth/middleware only) — and independently, a full reinstall was run as the AC-6 test and succeeded, so the graph is intact.
- [x] N/A — no graph-orientation code added.

## Things tests can't catch

- [x] No secrets committed. (The change *removes* credential exposure.)
- [x] No leftover debug logging / `console.log` in the diff. (The three added comments are explanatory and cite the ADR.)
- [x] No commented-out code.
- [x] Error paths: unauth write → clean 403 JSON; the `req.headers &&` guard tolerates a missing headers object (belt-and-suspenders for non-Express callers).
- [x] Concurrency: none introduced (per-request middleware/handler logic; no shared state).
- [x] **Security (the point of the story):** input boundary now enforced — proxied writes rejected, spoof closed by construction (a present forwarding header = remote, so the attacker cannot forge *absence* through nginx). Reviewer re-verified the spoof live.

## House rules check

- [x] Concept Graph API authority respected (not touched).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking
None.

### Non-blocking
1. **`src/api/neo4j/queryPost.js:14`** — `isOwner` is imported at module top by destructure. It resolves correctly in the live load order (verified), but a lazy `require(...).isOwner` inside the handler would be immune to any future circular-require reordering. Optional hardening, not required.
2. **Residual risk (by design, from ADR):** unauthenticated **read** Cypher via `/api/neo4j/query` remains open — an attacker can still read the raw graph. This is the accepted cost of preserving public browsing under the refined AC-2, and is recorded in the ADR (future hardening: migrate public reads to `/api/concept-graph/*`, then lock the endpoint). Not a defect in this story; flagged so it isn't forgotten — belongs on the epic backlog.
3. **Behavior change (verified, now documented):** host → published `:7778` requests now require auth (they arrive from the Docker bridge IP). Correct and intended; the genuine local path is container loopback / owner UI. I closed the ADR's open "confirming test" follow-up and added the verified consequence to the ADR at Review.

### Harness friction
None new this story. (Noted in passing, already tracked: `test/test.js`'s `overallOk` chain has a severed dead block below its line-882 terminator — OPEN.md #43; the Tester correctly registered the new suite in the live chain above it.)

## Verdict
**PASS**

The diff is exactly the agreed ADR design; every acceptance criterion is verified (AC-1/2/3/5/6 live, AC-4 by sound code-audit + a deferred browser smoke, AC-7 at deploy). The real firmware install closes the one criterion the automated tests covered only structurally. No blocking findings. Residual unauth-read risk and the docker-bridge behavior change are documented, accepted-by-design consequences — not defects.

Remaining before this is closed: ship to **staging → prod → feat/tags** (AC-7) via the deploy chain, and the operator-side companions in the book (rotate the Neo4j password; firewall Bolt `7687`/`7474`) — those are not closed by this code.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done`.
- [x] Completion detection run — see below.
