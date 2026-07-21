# Build Audit: Auth Exposure Hardening

**Book:** `engineering-team/audits/security-auth-exposure/book.md`
**Date:** 2026-07-20
**Branch / commit range:** book work `d983af55..5abbaf1a` on `staging`; deployed source = story-1 `1fbf4a53` + story-2 `012f889b` (3 files). Merges: staging #391/#394, prod #389/#392/#395, feat/tags #390/#393/#396 (the run-query prelude + both stories).
**Provenance:** Acceptance-frame (no PRD) — human-gated book.
**Confidence:** high — small, surgical diff; every AC verified live on staging + prod + feat/tags; both test suites green at close.

> As-built record for the book that closed the unauthenticated HTTP write/RCE/credential-leak surface on every Tapestry instance and made the auth middleware private-by-default for mutations.

## 1. What shipped

- **The `run-query` RCE + credential leak is gone** (prelude, standalone — not a book story): `GET /api/neo4j/run-query` deleted. It shelled out to `cypher-shell` with the Neo4j password interpolated into the command string — an unauthenticated, internet-reachable credential leak (response body + process args) and shell-injection RCE. Removed + deployed to all three instances (#388/#389/#390).
- **The localhost-bypass root cause is closed** — `stories/security-auth-exposure/1-close-unauthenticated-write-surface.md`. "Local" now means loopback peer **and** no proxy-forwarding header, so nginx-proxied (i.e. all external) traffic is treated as remote; a spoofed `X-Forwarded-For: 127.0.0.1` is a *present* header and therefore remote. `POST /api/neo4j/query` write-Cypher is owner-gated in the handler; reads stay open for public browsing.
- **The auth middleware is default-deny for mutations** — `stories/security-auth-exposure/2-default-deny-mutating-endpoints.md`. Any unauthenticated `POST/PUT/PATCH/DELETE` is rejected 401 unless its path is on a two-entry public allowlist. This closed 44 previously-unguarded admin mutations by construction (`firmware/install`, `tapestry-key/*`, `run-task`, `strfry/wipe`, `DELETE meili/wipe`, the unauth-TA-signing `trusted-list/publish`, and `strfry/publish signAs:'assistant'`), and makes every *future* mutating endpoint private by default.
- **The leaked Neo4j credential is dead** (operator companion): password rotated on all three instances and verified (app↔Neo4j healthy, real graph data).

## 2. Epics & stories rolled up

### Epic: `security-auth-exposure`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 close-unauthenticated-write-surface | Honest-local bypass (loopback + no proxy header) + `req.localTrusted`; `/api/neo4j/query` write-gate in the handler | Done | `reviews/security-auth-exposure/1-close-unauthenticated-write-surface.md` (PASS) |
| #2 default-deny-mutating-endpoints | Method-based default-deny for unauth mutations + exact-match public allowlist; bypass broadened to all `/api/*`; `strfry/publish signAs:'assistant'` owner-gate | Done | `reviews/security-auth-exposure/2-default-deny-mutating-endpoints.md` (PASS) |

*(The `run-query` deletion was a standalone prelude fix, not a book story; it is recorded here because it is part of the same exposure and the book's anchor references it.)*

## 3. As-built inventory (from the diff)

- **`src/middleware/auth.js`** — the `authMiddleware` local bypass now gates on `isDirectLocal = loopbackPeer && !viaProxy` (`viaProxy` = presence of `X-Forwarded-For`/`X-Real-IP`), stamps `req.localTrusted`, and applies to **all** `/api/*` paths (story 2 broadened it from `/api/normalize||/api/neo4j`). The unauthenticated branch is now **method-based default-deny**: `MUTATING = [POST,PUT,PATCH,DELETE]` → 401 unless `req.path` ∈ `PUBLIC_MUTATIONS = ['/api/neo4j/query','/api/strfry/publish']` (exact match). The old `writeEndpoints` allowlist and the dead `?action=` check were deleted; `protectedGetEndpoints` retained. `trust proxy` stays **off** (req.ip = socket peer).
- **`src/api/neo4j/queryPost.js`** — write-Cypher (`WRITE_KEYWORDS`) gated: `isWrite && !isOwner(req) && !req.localTrusted → 403`; reads unaffected. Imports `isOwner` from the auth middleware.
- **`src/api/strfry/commands/publishEvent.js`** — `signAs:'assistant'` (server signs with the TA key) gated: `!isOwner(req) && !req.localTrusted → 403`; `signAs:'client'` (permissionless, own-signed) unchanged.
- **Deleted:** `src/api/neo4j/runQuery.js` (the RCE handler) + its route/require in `src/api/index.js` + its dead `auth.js` list entry (prelude).
- **User-facing / contracts:** no new endpoints; the change is authorization behavior on the existing surface. No concept-graph concepts, handles, schemas, or firmware definitions touched → **no firmware reinstall required** (though a full loopback reinstall was run as the AC-6 test and succeeded, 39/39, on the local stack).
- **Tests added:** `test/close-unauth-write-surface.test.js` (14), `test/default-deny-mutations.test.js` (14), both registered in `test/test.js`'s live gate.

## 4. Deviations from intent

| # | Specified (frame bullet) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | "unauth `POST /api/neo4j/query` returns 401/403 — arbitrary Cypher no longer reachable anonymously" | Unauth **write** Cypher → 403; unauth **read** Cypher still runs | interpretation (operator-approved) | The endpoint is the read backbone of 20+ UI pages incl. public browsing; a blanket deny re-breaks browsing. Handler gates writes. (ADR 0001; story-1 AC-2 refinement) | Public browsing preserved; **residual: an attacker can still read the raw graph via unauth read Cypher** | Migrate public reads to `/api/concept-graph/*` then lock `/neo4j/query` fully — backlog |
| 2 | "legitimate local-operator paths still work: the documented host→CLI workflow" | Host→published `:7778` now requires auth; the genuine-local path is **container loopback** (`docker exec`) or the owner UI | constraint-discovered | On a droplet the published `:7778` is internet-reachable from the same Docker-bridge IP as a host curl — trusting it was part of the hole. (ADR 0001 Consequences, confirmed at review) | Local graph editing goes via docker-exec/loopback or the UI, not a naked host curl | Documented in ADR 0001 |
| 3 | "default-open middleware posture is addressed … conscious, recorded decision" | Flipped to **default-deny for mutations** (systemic), not audit-and-protect | intentional-change (operator chose systemic at Planning) | Audit-and-protect leaves the default open; systemic closes it for all future endpoints. (Story 2 Planning) | Every future mutating endpoint is private by default | — |
| 4 | (bypass scope) | Honest-local bypass **broadened** from `/normalize`+`/neo4j` to all `/api/*` | added-beyond-story-1 (required by story 2) | The trusted-list loopback cron (`refresh-*`) curls `127.0.0.1` directly with no session; default-deny would 401 it. Broadening keeps in-container callers trusted; the signal is externally unspoofable. (ADR 0002) | Cron + firmware bridge keep working; route-level `requireOwner` still blocks loopback callers (verified) | — |
| 5 | `strfry/publish` handling | Endpoint allowlisted public; `signAs:'assistant'` owner-gated in the handler | added (necessary to allowlist safely) | Preserves logged-out client-signed tagging (permissionless publish) while closing the unauth-TA-signing hole. (ADR 0002, operator sub-decision) | Logged-out profile tagging preserved; TA-signing owner-only | ProfileTagsSection being ungated where siblings require login is a UX inconsistency — optional future UX story |

**Undocumented work:** none — the diff is exactly the three ADR-specified changes plus the prelude deletion; no unexplained hunks.

## 5. Quality state at close

- **Test gate:** `npm test` → **Overall PASS, 0 FAIL lines** (reviewer's independent full run, 2026-07-20; 51 env-dependent skips). Both new suites green at close: `close-unauth-write-surface` 14/0, `default-deny-mutations` 14/0.
- **Verified live** on staging + prod + feat/tags: unauth `firmware/install`/`DELETE meili/wipe` → 401; `strfry/publish` assistant → 403 / client → 400; `neo4j/query` read → 200; public reads (deploy-safety, concept-graph) → 200; concepts UI browses. Real loopback firmware install 39/39 (AC-6). No test-node pollution on any instance.
- **Accepted residual (by design):** unauthenticated **read** Cypher via `/api/neo4j/query` remains open (deviation #1) — a raw-graph read surface, accepted to preserve public browsing.
- **Debt (ADR Consequences):** authenticated-**non-owner** privilege granularity is untouched — a logged-in guest can still reach non-owner mutations via the authenticated branch (unchanged from before). Deploy-invariant dependency: every proxy hop must set `X-Forwarded-For` (true for both nginx layers).

## 6. Carry-forward register

- [ ] **Firewall the internet-exposed backend ports** (`7474`/`7687`/`8687` Neo4j, `7778` control-panel-API, `7700` Meili, `3069` nostr-search-api) — DO Cloud Firewall, default-deny allow 22/80/443. **OPEN.md #66** (full runbook in `book.md` § Companion). The last book companion; operator-deferred 2026-07-20.
- [ ] **Restrict unauthenticated read Cypher** (deviation #1) — migrate public UI reads to `/api/concept-graph/*`, then lock `/api/neo4j/query` fully.
- [ ] **Default-deny for authenticated-non-owner mutations** — tighten the authenticated branch so a logged-in guest can't reach non-owner-listed mutations. Candidate story.
- [ ] **Durable port hardening (code)** — bind the backend ports to `127.0.0.1` in `docker-compose.yml` (as the deploy already does for `:80`); defense-in-depth vs a misconfigured firewall.
- [ ] *(Optional UX)* gate `ProfileTagsSection` behind login for consistency with its siblings (deviation #5).

## 7. Process findings (harness)

| Finding | Source | Terminal state |
|---|---|---|
| A `dryRun:true` firmware install does **not** exercise the internal-bridge write path — the Implementer's dryRun "verification" of AC-6 didn't prove it; the Reviewer caught it by running a **real** (non-dryRun) install both stories. | story-1 & story-2 review docs (§ AC-6) | **Declined** — the practice is already recorded in both review docs as the verification method; a low-frequency reviewer judgment call, and the meta-ledger is already over its escalation threshold (session-start digest: 17+ open). Not worth a new ledger row. |
| Source-string sentinels match **comment** text: story-1's "bridge no longer forges x-forwarded-for" sentinel matched the explanatory code comment that mentioned the header; reworded the comment. | story-1 implementation (self-corrected in-phase) | **Declined** — minor, self-corrected within the phase, obvious fix (scope the sentinel or avoid the literal in comments); low recurrence value. |
| `test/test.js`'s `overallOk` chain has a severed dead block below its line-882 terminator; suites below it don't gate the build. Both new suites were registered in the **live** chain above it. | both review "Harness friction" lines | **Pre-existing — OPEN.md #43** (no new action; correct registration confirmed). |
| **The `run-query` deletion (prelude) removed the route + server handler but did not grep for *client* callers — `ui/src/pages/users/Index.jsx` still fetched `GET /api/neo4j/run-query` on mount, and the book's live UI verification exercised the concepts pages, not `/users`. Result: the Users page's Neo4j list broke on all three instances (404), undetected at close.** | post-close sweep 2026-07-20 (operator asked "any other loose ends?") | **Fixed this session** as a standalone fast-track bug — `engineering-team/stories/users-page-run-query-regression.md` (swap to `POST /api/neo4j/query`, which preserves the `cypherResults` shape). Institutionalized by a **permanent regression guard** — `test/users-page-neo4j-endpoint.test.js` scans all of `ui/src` for callers of removed endpoints. Process lesson ("an endpoint deletion must grep client callers + exercise affected UI, not just the server route"): **soft-declined** as a new meta-ledger row — the guard test *is* the durable mitigation for this class, and the meta-ledger is already over its escalation threshold (22 open). |

## Companion status at close

- **Neo4j password rotation** — ✅ DONE + verified on all three instances (book.md § Companion #1).
- **Firewall** — ⏳ deferred → **OPEN.md #66** (carried forward; operator-ratified close with it tracked separately).
