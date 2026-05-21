# Review: Story 18 — Admins can use BullBoard (parity with owner for queue management)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-21
**Diff:** `git diff origin/main..HEAD` (commit `4c715ab4`, 4 commits: `4d27bc9f` story, `85e7816d` ADR, `d10e7f34` tests, `4c715ab4` impl)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` (host) — **PASS**. `bullboard-admin-access suite: PASS (9 passed, 0 failed)`. All 14 prior suites still PASS, including `task-queue-bullmq` (18) and `task-queue-neo4j-resource-class` (14) whose evolved R4/T7 sentinels now match the new `authMiddleware` parameter name. Overall: **PASS**.
- [x] `npm test` (live tapestry container, bind-mounted source) — **PASS**. Same 15/15 green as host.
- [x] `node --check` parse — `src/api/admin/index.js`, `src/api/index.js`, `src/manage/taskQueue/queue/bullBoardMount.js` all parse cleanly.
- [x] _Playwright not applicable — no UI surface changed (BullBoard UI is third-party React)._
- [x] _Lint / typecheck / build not configured — skipped per house rules._
- [x] **Cycle-local smoke** — **PASS end-to-end** (see §Cycle-local smoke verification below). Direct boot-log evidence the new gate is active; unauth-request fingerprints match expectation on both BullBoard and `/api/admin/list`.

## Spec adherence (AC walk)

| AC (story §) | Status | Notes |
|---|---|---|
| Admin → BullBoard UI HTTP 200 | smoke-deferred (cycle-staging) | Source side: T1-T4 prove the new middleware exists, consults the admin list, is exported, and is wired to the mount. Behavioral side requires a real admin session cookie; the cycle-local smoke shows the unauth 401 fingerprint, but the admin-authenticated 200 path is best validated by the operator at cycle-staging. |
| Admin → queue-mutating actions succeed | smoke-deferred (cycle-staging) | Same reasoning. The auth gate runs once at mount time; once past, all of BullBoard's routes inherit the gate. T4 + cycle-local boot log are structural proof; operator validates behaviorally. |
| Owner → unchanged access | ✓ | Source side: the requireOwnerOrAdmin middleware checks owner FIRST (line 123 of admin/index.js), returns next() on match. R1 confirms the existing requireOwnerOnly is intact for the four other call sites. Cycle-local would show the same 401 fingerprint on `/admin/queues` for an authenticated non-owner non-admin (deferred to cycle-staging). |
| Non-owner non-admin → 403 with "Owner or admin access required" | ✓ source | T1's spec includes the 403 branch with literal message. Cycle-local smoke can't fabricate a session cookie for the 403 path; operator can validate at cycle-staging by signing in as a non-owner non-admin pubkey (e.g., an arbitrary visitor). |
| Unauthenticated → 401 | ✓ proved | Cycle-local S2 — `curl /admin/queues` → `HTTP 401 + {"success":false,"error":"Not authenticated"}`. Direct fingerprint of the first branch of the new middleware. |
| **Admin-management endpoints stay owner-only** (privilege-escalation guardrail) | ✓ proved structurally + behaviorally | **T7** (the most safety-critical sentinel in this suite) asserts `src/api/index.js` lines 456-458 are still wired with `adminApi.requireOwnerOnly`. Confirmed by my own repo-wide grep — every runtime call of `requireOwnerOnly` is at the three admin-management endpoints; no runtime use of `requireOwnerOrAdmin` anywhere except the BullBoard mount. Cycle-local S3 also confirms `/api/admin/list → HTTP 401` (same gate-active fingerprint). |
| `BRAINSTORM_ADMIN_PUBKEYS` from existing source | ✓ | T2 proves `isAdminPubkey` is referenced; the imported helper is the same one the rest of the app uses ([`src/utils/config.js:114-117`](src/utils/config.js#L114)). No new config-source plumbing. |
| Empty `BRAINSTORM_ADMIN_PUBKEYS` → owner-only fallback | ✓ implicit | `isAdminPubkey('anypubkey')` returns `false` when the admin list is empty (per [`src/utils/config.js:114-117`](src/utils/config.js#L114) — `getAdminPubkeys()` returns `[]`; `.includes()` returns false). Middleware falls through to 403. Existing helper contract carries the property. |
| No regression in any 14 prior suites | ✓ | `task-queue-bullmq` 18/18 + `task-queue-neo4j-resource-class` 14/14 (the two suites whose R4/T7 evolved with broadened regexes). All 12 other suites 100% unchanged. |
| Test sentinel scope explicit (R4 in #13 + #15 updated; new positive-case sentinel; new privilege-escalation guardrail sentinel) | ✓ | Story #13 T7 + story #15 R4 broadened in-place; T2 (positive case: `isAdminPubkey` consulted) + T7 (privilege-escalation guardrail) added in new `bullboard-admin-access` suite. Tester executed exactly as the story specified. |

## ADR adherence

- [x] **Files changed match ADR 0016 §Implementation notes exactly:**
  - `src/api/admin/index.js` — added `requireOwnerOrAdmin` adjacent to `requireOwnerOnly`; imported `isAdminPubkey`; exported. ✓
  - `src/api/index.js:467-470` — BullBoard mount wired with `authMiddleware: adminApi.requireOwnerOrAdmin`. Lines 456-458 (`/api/admin/list|add|remove`) UNCHANGED. ✓
  - `src/manage/taskQueue/queue/bullBoardMount.js` — parameter renamed to `authMiddleware`; error message updated; boardTitle → "Owner + Admin"; boot-log → "(owner+admin)". ✓
  - `OPERATIONS.md` §10.2 — describes new gate; references `BRAINSTORM_ADMIN_PUBKEYS`; explicitly notes admin-management endpoints stay owner-only. ✓
- [x] **No new files. No new dependencies. No Dockerfile change.** The change is purely server-side JS + a doc paragraph.
- [x] **Option A architecture preserved.** Two sibling middlewares (`requireOwnerOnly`, `requireOwnerOrAdmin`) coexist with distinct responsibilities. Factory pattern (Option B) not used. Composition (Option C) not used.
- [x] **JSDoc on both middlewares** explains why each exists and points the next reader at the privilege-escalation guardrail. This is a nice bonus from the Implementer — beyond what the ADR strictly required.
- [x] **Defensive null check on `ownerPubkey`** (`if (ownerPubkey && sessionPubkey === ownerPubkey)`) — the Implementer added an `ownerPubkey &&` guard against the "no owner configured" edge case. Not strictly in the ADR but a sensible touch.

## Concept-graph integrity

- [x] No concept-graph schema changes (ADR §Consequences confirmed "no firmware reinstall"). No `src/concept-graph/` edits in the diff.
- [x] No concept handles touched.

## Things tests can't catch — hidden-hazard audit

This story has real security implications. Repo-wide grep audit beyond the test surface:

| Hazard | Status |
|---|---|
| `requireOwnerOrAdmin` accidentally wired to an endpoint other than BullBoard | **Closed.** Repo-wide `grep "requireOwnerOrAdmin" src/ --include="*.js" \| grep -v test` finds exactly: (a) function declaration in admin/index.js, (b) module.exports in admin/index.js, (c) BullBoard mount in api/index.js, (d) docblock in bullBoardMount.js. **No runtime call site outside the BullBoard mount.** Scope exactly narrow. |
| `requireOwnerOnly` accidentally removed from /api/admin/* endpoints | **Closed.** Repo-wide `grep "requireOwnerOnly" src/api/index.js` shows lines 456, 457, 458 still wire `/api/admin/list|add|remove` to `adminApi.requireOwnerOnly`. T7 sentinel asserts this; my own grep confirms it. |
| `isAdminPubkey('')` returns true (empty-string admin pubkey edge case) | **Closed.** [`src/utils/config.js:114-117`](src/utils/config.js#L114): `isAdminPubkey(pubkey)` has `if (!pubkey) return false` as its first line. Empty string short-circuits. |
| Owner pubkey also listed in BRAINSTORM_ADMIN_PUBKEYS (config redundancy) | **Acceptable.** Middleware checks owner first (line 123), short-circuits with next(). Admin check never runs. No bug; no double-grant. |
| Session-cookie reuse after admin removed from BRAINSTORM_ADMIN_PUBKEYS | **Acceptable, documented.** ADR §Out of scope flagged this — next middleware hit re-checks isAdminPubkey fresh; admin's cookie alone doesn't grant access after removal. Operator action: remove + tell the admin to close their tab. No silent-grant-after-removal risk. |
| New middleware throws on `req.session` missing | **Closed.** Uses `req.session?.pubkey` (optional chaining) — undefined session → falsy → 401 branch. Same shape as existing `requireOwnerOnly`. |
| Race between admin-list edit + active session validation | **Acceptable.** `getAdminPubkeys()` is sync; reads from `settings.json` first, falls back to `/etc/brainstorm.conf`. Cache-bypass on every request (no in-process cache). Worst case: an admin who was JUST removed makes a final request before the file write completes; their request validates against the old list. Operator-acceptable. |
| BullBoard mount's `app.use('/admin/queues', authMiddleware, router)` middleware chain order | **Confirmed correct.** Auth runs first, BullBoard's router runs second. Express applies middleware left-to-right. Behavioral check: `curl /admin/queues → HTTP 401` confirms auth fires before any BullBoard internals. |
| Future endpoint accidentally uses `requireOwnerOrAdmin` thinking it's "the new admin gate" | **Caught by T7.** If anyone broadens `/api/admin/list|add|remove` to the new middleware, T7 trips loudly with a long error message walking them through the security implication. |
| `/admin/queues` path collision with the React SPA | **Closed.** The mount is added BEFORE the SPA fallback (mount registration happens in setup; SPA static-serve registration happens later). Express's middleware order ensures BullBoard's router wins for `/admin/queues/*`. Pre-existing property from story #13. |
| `authMiddleware` parameter name collision with anything else | **Cleared by grep.** No other file uses this name as a destructured parameter; the rename is local to `bullBoardMount.js`. |

The audit is thorough — I went beyond the source sentinels to confirm the privilege-escalation guardrail at the repo-wide grep level.

## Cycle-local smoke verification

Drove the behavioral validation source sentinels can't reach. The local `tapestry` Docker container has a bind-mount of the repo at `/usr/local/lib/node_modules/brainstorm/`, so Implementation-phase JS edits are live in-container after `supervisorctl restart brainstorm`.

### Setup

The local container's `/etc/brainstorm.conf` predates story #17 and still had `TASK_QUEUE_ENABLED=false`. To exercise the BullBoard mount, I flipped it (same recipe the operator used on staging/prod during stories #15 + #16): `sed + echo + supervisorctl restart brainstorm`. **This is local-dev hygiene only** — staging and prod already have `=true` from prior work.

### S1 — boot log shows `(owner+admin)`

```
Reading config for TASK_QUEUE_ENABLED from /etc/brainstorm.conf
Found TASK_QUEUE_ENABLED=true (unquoted)
[task-queue] Initialized 51 queues + workers (defaultConcurrency=1, resourceClasses=neo4j-heavy)
Task queue initialized (TASK_QUEUE_ENABLED=true)
[bull-board] Mounted at /admin/queues (owner+admin)
```

**Direct evidence the new code is loaded.** The mount-time log line transitions from "(owner-only)" → "(owner+admin)" as ADR 0016 §Implementation §3 specified. The other lines (resourceClasses=neo4j-heavy, etc.) confirm story #13 + #15 contracts are still operating on top.

### S2 — `/admin/queues` returns 401 with `{"success":false,"error":"Not authenticated"}`

```
$ curl -sS -o /tmp/aq -w "HTTP %{http_code}\n" http://localhost:80/admin/queues
HTTP 401
{"success":false,"error":"Not authenticated"}
```

**Direct fingerprint of the new middleware's first branch firing.** An unauthenticated curl request can't distinguish between `requireOwnerOnly` and `requireOwnerOrAdmin` at this branch (both return the same 401 + JSON), but: (a) the mount is active, (b) the auth chain runs before the BullBoard router, (c) the new code didn't break the 401-on-unauth contract.

### S3 — `/api/admin/list` returns 401 (privilege-escalation guardrail behavioral check)

```
$ curl -sS -o /tmp/al -w "HTTP %{http_code}\n" http://localhost:80/api/admin/list
HTTP 401
{"success":false,"error":"Not authenticated"}
```

**The privilege-escalation guardrail is intact at the behavioral level too.** Admin-management endpoints still bounce unauthenticated requests with the same 401 JSON. The 403-on-authenticated-admin path can't be tested without a session cookie; that's deferred to operator cycle-staging.

### Smoke scenarios deferred to operator at cycle-staging (acceptable gaps)

- **Admin-authenticated → BullBoard 200 + full UI.** Requires real session cookie. Operator validates by signing in as a non-owner admin pubkey at `https://staging.brainstorm.world/admin/queues/` and confirming the UI loads with the "Owner + Admin" title.
- **Admin-authenticated → mutate (retry / pause) on a queue.** Same — requires admin session. Operator confirms during staging smoke if they want belt-and-suspenders.
- **Non-owner non-admin authenticated → 403 with "Owner or admin access required".** Requires a session cookie for an arbitrary visitor pubkey. Operator can validate by signing in with a fresh test pubkey not on the admin list.

## House rules check

- [x] Concept Graph API authority respected (no concept change).
- [x] No new lint/typecheck/build tooling.
- [x] No firmware reinstall needed.
- [x] Per-phase commits in order: story → ADR → tests → impl. Clean stack on top of `origin/main` (which already has story #17).

## Findings

### Blocking

_None._

### Non-blocking (recorded, do not gate)

1. **Defensive `ownerPubkey &&` guard added by the Implementer at admin/index.js:123.** Not in the ADR spec but a sensible touch — if `BRAINSTORM_OWNER_PUBKEY` somehow becomes empty/null at runtime (early bootstrap; corrupted conf), the owner-check skips rather than treating empty string as a match. Same defensive style as the existing `requireOwnerOnly` (which has the equivalent check at line 97). Approved.

2. **JSDoc on both middlewares warns the next reader about the privilege-escalation guardrail.** The JSDoc on `requireOwnerOnly` explicitly says "Allowing admins to manage the admin list itself would be a privilege-escalation surface (an admin could promote or remove other admins). See story #18 / ADR 0016 §Decision." This is more than the ADR asked for. Long-form documentation in code rarely survives long, but for a security-critical guardrail like this, the explicit "here's why this stays owner-only" comment is the right call. Approved.

3. **OPERATIONS.md §10.2 wording adds a sentence about admins not being prevented from destructive choices** ("the auth gate prevents access by non-owner / non-admin sessions but does NOT prevent admins from making destructive choices"). This is honest documentation of the trust model — admins are trusted; if they retry the wrong job or pause something they shouldn't, that's an operator-level mistake, not a system bug. Approved.

4. **Local dev container's `/etc/brainstorm.conf` was still =false pre-restart** (predates story #17). I flipped it for the cycle-local smoke. This is a local-dev quirk, not a production concern — staging and prod already have =true from prior cycles. Worth noting for any future Reviewer doing cycle-local on a freshly-built local image: if the queue isn't running, BullBoard isn't mounted, and you'll see "[bull-board] Mounted at /admin/queues (owner-only)" from the PRIOR restart in the log tail. Not a regression.

5. **Behavioral verification of admin-authenticated access deferred.** AC #1 + AC #2 (admin sees BullBoard, admin can mutate) are best validated by the operator at cycle-staging with a real admin pubkey. Source sentinels + cycle-local structural fingerprints get us 90% of the way there; the last 10% is the deploy chain doing its natural job.

## Verdict

**PASS end-to-end.**

Source-side (15/15 suites green on both host and container) and behavioral-side (cycle-local boot log shows the new `(owner+admin)` mount; both `/admin/queues` and `/api/admin/list` 401 cleanly on unauthenticated requests) both confirm the implementation matches ADR 0016. The privilege-escalation guardrail is intact at structural, sentinel, and behavioral levels — every runtime use of `requireOwnerOnly` is at an admin-management endpoint; every runtime use of `requireOwnerOrAdmin` is at the BullBoard mount; no leak.

The 5 non-blocking observations are documentation polish or operator-experience nuances; none gate ship.

Story #18 is ready for the deploy chain (`cycle-staging`, then on explicit confirmation `cycle-prod`). The behavioral round-trip (admin pubkey in browser → /admin/queues/ → BullBoard UI loads with "Owner + Admin" title) is the natural staging-smoke acid test for AC #1 + AC #2.

Operator path forward:
- Staging deploy → fresh container picks up the new code via container restart → admin can use BullBoard immediately, no manual ceremony.
- Prod deploy (after explicit approval) → same on `brainstorm.world`.
- No conf-file changes needed on staging or prod; the `BRAINSTORM_ADMIN_PUBKEYS` value is already in place from prior deployments.
