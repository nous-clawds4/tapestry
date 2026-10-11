# Test Plan: Story 8 — Every admin action checks who is asking (the sweep)

**Story:** `engineering-team/stories/security-auth-exposure/8-admin-action-sweep.md`
**ADR:** `engineering-team/decisions/security-auth-exposure/0005-one-route-table-default-deny.md`
**Book:** `engineering-team/audits/admin-action-owner-check/book.md`
**Date:** 2026-10-10

## Disclosure (book ground rule 1)

The repo is public and members of this class are still open on production. **No file in this plan, and none of the
committed test files, names a still-open route** (the class-A registrations) **or the two sensitive reads the owner
closed.** The committed suites derive every route set at runtime — from the real router walk and from the table once it
exists — so AC-1/AC-2/AC-5/AC-6 are asserted over *every* route the table marks owner/owner-only/public (and every route
with no entry) without naming any of them. Where a check genuinely needs a class-A route or one of the two closed reads
by name, those assertions live only in `test/admin-action-sweep-named.test.js`, which is **HELD** (committed with the fix
or after it ships) and is held in the working tree as `test/admin-action-sweep-named.test.js.held` so the gate never runs
it before then. This plan refers to those by class only ("a GET that acts", "the two closed sensitive reads").

## Test levels and seams

Everything is **stack-free** (no Docker; the local stack is not running) and runs under `npm test` via `test/registry.js`.

- **Child-process route walk** — `test/helpers/routeWalk.js`. The gate loads suites in-process and the real
  `register(app)` has side effects (it writes the strfry router config and its state file), so the walk runs in a child:
  it maps the in-container module prefix `/usr/local/lib/node_modules/brainstorm/` to the repo, stubs the owner-assistant
  key loader and `initRouter`, swallows and counts writes to the two router files, points
  `TAPESTRY_SETTINGS_PATH`/`BRAINSTORM_BASE_DIR`/`BRAINSTORM_CONF_PATH` at a temp dir, leaves `TASK_QUEUE_ENABLED` unset,
  calls `register(app)`, and prints `app._router.stack` as JSON. The entrypoint's own routes (`bin/control-panel.js`) and
  the task-queue dashboard mount (`USE /admin/queues`) are added by static list, since the entrypoint cannot load without
  Redis.
- **Child-process access harness** — `test/helpers/accessHarness.js`. Runs the **real** `authMiddleware` and the **real**
  `isOwnerOrAdmin` in front of marker handlers (middleware mode), and calls the publish / settings handlers directly
  (handlers mode). The conf seam (ADR Decision 5) is exercised by writing a temp `brainstorm.conf`
  (`BRAINSTORM_CONF_PATH`) with an owner and a temp settings file (`TAPESTRY_SETTINGS_PATH`) with an admin, both set
  before any module loads — so the owner/admin pass is shown against the real check, not a stand-in (closes the audit §5
  stand-in debt). Callers: owner, admin, signed-in stranger, visitor, direct-local (loopback, no forwarding header).
- **Public-reads baseline** — `test/fixtures/admin-action-sweep/public-reads.json` (197 reads). The set of reads that a
  visitor reached, with no guard in front, at this commit — the AC-5 "unchanged" baseline. It excludes the two reads the
  owner closed and four reads whose paths contain a class-A substring (those four are pinned in the HELD suite).

## Coverage map

| Criterion | Test(s) | File | Level |
|---|---|---|---|
| **AC-1** signed-in non-owner refused 403 on any non-allowlisted action, every method + spelling | `AC1` (fail-closed synthetic routes GET/HEAD/POST/PUT/DELETE + caps; and every table owner/owner-only route) | `test/admin-action-sweep-access.test.js` | integration (real middleware, child) |
| **AC-2** visitor refused 401 likewise | `AC2` (same shape, visitor) | `test/admin-action-sweep-access.test.js` | integration |
| **AC-3** owner / admin / direct-local lose nothing — owner & admin vs the REAL check | `AC3`, `AC3b` (conf seam present), `PARAM*` owner-allowed arms | `test/admin-action-sweep-access.test.js` | integration |
| AC-3 instance scripts end-to-end (firmware-install bridge, loopback jobs) | **LIVE check at deploy** (AC-9 probes) — see "Live / manual" | — | live |
| **AC-4** one explicit allowlist, each entry a `why`; entries still reach the named people | `T3` (every public/signed-in action has a non-empty `why`); `AC4` decided entries (client-signed publish, read backbone, sign-in handshake, POV sync) reach; `AC4` every signed-in table entry reaches a signed-in stranger | `test/admin-action-sweep.test.js`, `test/admin-action-sweep-access.test.js` | structural + integration |
| **AC-5** reads unchanged (except the two closed) | `AC5` every fixture read still answers a visitor + the deploy-relied reads by name; `AC5` every `kind:'read' access:'public'` table entry answers a visitor | `test/admin-action-sweep-access.test.js` | integration |
| AC-5 the two closed reads now refuse | `N2` | `test/admin-action-sweep-named.test.js` (**HELD**) | integration |
| **AC-6** every route sorted; the gate fails naming an unguarded action; shown with an added POST and an added GET | `W1` (walk), `AC6a` (coverage, names `METHOD path`), `AC6b` (inject one POST + one GET, caught until guarded/listed), `T2` (no stale entry), `T4` (resolver agreement incl. HEAD + caps), `T5` (fail-closed + ACCESS_ORDER), `T6` (no open action outside `/api`), `T7` (six lists deleted) | `test/admin-action-sweep.test.js` | structural |
| **AC-7** 401/403 with `{success:false,error}` naming who may act | `AC7` | `test/admin-action-sweep-access.test.js` | integration |
| **AC-8** no page changes (owner chose the bare 403) | No UI test — AC-8 reads "no page changes". A review sentinel/manual confirms no `ui/` change. | — | manual/review |
| **AC-9** shipped everywhere; post-deploy a visitor 401 on a fixed mutation and a fixed GET that acts | **LIVE probes at deploy** — see "Live / manual" | — | live |
| Owner-only parameter rule 1: `signAs:'assistant'` — admin refused, owner allowed (OPEN.md row 269) | `PARAM1`, `PARAM1b` | `test/admin-action-sweep-access.test.js` | handler (child) |
| Owner-only parameter rule 2: admin-list key in a settings update/reset — admin refused, owner allowed | `PARAM2`, `PARAM2b` | `test/admin-action-sweep-access.test.js` | handler (child) |
| AC-6 named demonstration against real class-A routes (a GET that acts; a destructive mutation; an identity action) | `N1`, `N3`, `N4`, `N5` | `test/admin-action-sweep-named.test.js` (**HELD**) | integration |

## Edge cases covered

- HEAD resolves as GET (both the resolver `T4` and the live refusals `AC1`/`AC2`/`N1`).
- Capitalised spellings (`/API/…`, mixed case) — `AC1`, `AC2`, `T4`, `N3`.
- `?action=` query form of a GET that acts — `N1` (HELD).
- Fail-closed: an unknown `/api` path (any method, GET included) resolves to `owner`, never public — `T5`. This pins that
  a bare `GET *` catch-all is **not** a public table entry (which would reopen every unknown GET).
- Strictest-match-wins and registration-order independence — `T4` (agreement) + `T5` (ACCESS_ORDER rank).
- Direct-local still trusted (loopback, no forwarding header) — `AC3`, `PARAM1` (local arm).
- Client-signed publish never reads the TA key, and is not caught by the assistant-only gate — `PARAM1b`.
- An admin may still change a non-admin-list setting (admins equal the owner elsewhere) — `PARAM2b`.
- No router file is written during the walk — `W1` asserts `routerWrites === 0`.

## Prerequisites / state

None. All suites are stack-free. The child processes write only to per-run temp dirs. No firmware install or other graph
state is required.

## Re-aimed existing suites (the ADR's ~14)

Nine suites named the six lists the ADR deletes (`ownerOnlyEndpoints`, `ownerOnlyGetEndpoints`, `protectedGetEndpoints`,
`authenticatedEndpoints`, `MUTATING`, `PUBLIC_MUTATIONS`, `customerOrOwnerEndpoints`). Each had its list-reading
assertion re-aimed at `resolveRouteAccess`, keeping every status-code / registration assertion; status codes were not
weakened. The five brain-epic R2 sentinels reference `PUBLIC_MUTATIONS` only in prose and assert the route is **absent**
from `auth.js` — still true after the lists are deleted — so they need no change (9 re-aimed + 5 unchanged ≈ the ADR's
"about 14").

| Suite | What was re-aimed | Now asserts |
|---|---|---|
| `test/task-routes-owner-admin.test.js` | T5 read `ownerOnlyEndpoints` | the six task paths resolve to `owner` in the table |
| `test/curated-dlist-update-publish.test.js` | S10 read three lists | `POST /api/dlist-curation/update` resolves to `signed-in` |
| `test/dictionary-edit-concept.test.js` | E12 read two lists | the edit route resolves to `signed-in` |
| `test/dictionary-wired-create.test.js` | E12 read two lists | the new-concept route resolves to `signed-in` |
| `test/dictionary-resync-concept.test.js` | E9 read two lists | the resync route resolves to `signed-in` |
| `test/author-scoped-inspection-roster.test.js` | S2 read `protectedGetEndpoints` | the roster GET resolves to `public` |
| `test/tagging-edges-wiring.test.js` | SWR11, SWR67 read owner lists | the status/held/realtime-status reads resolve `public`; the owner-only/owner-or-admin routes resolve owner-side |
| `test/tagging-edges-drift-route.test.js` | DR26 read five lists | the drift-counts GET resolves to `owner` |
| `test/default-deny-mutations.test.js` | the `PUBLIC_MUTATIONS`/method-based source sentinel, and the story-2 "authenticated branch is unaffected" test | the table opens the two decided public mutations and fail-closes everything else; a signed-in non-owner is now refused 403 on an unlisted mutation (synthetic path) |

Each re-aimed suite now fails on exactly its re-aimed assertion(s) (table/`resolveRouteAccess` absent, or the new refusal
not yet in place) and keeps every other test green.

## Live / manual checks (not automated here)

- **AC-3 end-to-end for the instance's own scripts** — the firmware-install bridge and the loopback scheduled jobs still
  do their work. These need the running stack; verify at deploy (the bridge is an in-process direct-local caller, the
  crons curl loopback with no forwarding header, both stamped `req.localTrusted`).
- **AC-9 post-deploy probes** — after each deploy to production, `staging`, `feat/tags`, `feature-magic-carpet`: a
  visitor is refused 401 on at least one fixed action under a mutation method and at least one fixed GET that acts.
- **AC-8** — confirm no `ui/` change (owner chose the bare 403; a follow-up story handles the controls).

## How to run

```
npm test                       # full gate; read the verdict with: npm run gate:status
node test/admin-action-sweep.test.js          # the structural half on its own
node test/admin-action-sweep-access.test.js   # the behavioural half on its own
```

## Verification

Confirmed failing for the right reason on 2026-10-10 at commit `9186a8c2` (table and conf seam not built; the new
refusal bodies and the deleted lists not yet in place — never a syntax or import error):

Full gate (`npm test`): baseline before this plan was **PASS — 5559 passed, 0 failed, 582 skipped, 295 suites**
(run `20261010T174820Z-10208-39f2`). After adding the two new suites and re-aiming the nine, it is
**FAIL — 5554 passed, 27 failed, 582 skipped, 297 suites** (run `20261010T182851Z-17286-344d`), with exactly the
intended suites failing:

```
Failed suites: default-deny-mutations, dictionary-wired-create, dictionary-edit-concept, dictionary-resync-concept,
curated-dlist-update-publish, author-scoped-inspection-roster, task-routes-owner-admin, admin-action-sweep,
admin-action-sweep-access, tagging-edges-wiring, tagging-edges-drift-route
Overall: FAIL — 5554 passed, 27 failed, 582 skipped across 297 suites
```

The structural suite on its own, against today's code:

```
admin-action-sweep: 1 passed, 8 failed, 0 skipped
  PASS  W1: the child route walk returns the whole router without touching a router file
  FAIL  AC6a … src/middleware/routeAccess.js does not exist yet (ADR 0005 Decision 1)
  FAIL  AC6b … src/middleware/routeAccess.js does not exist yet (ADR 0005 Decision 1)
  FAIL  T2  … src/middleware/routeAccess.js does not exist yet (ADR 0005 Decision 1)
  FAIL  T3  … src/middleware/routeAccess.js does not exist yet (ADR 0005 Decision 1)
  FAIL  T4  … src/middleware/routeAccess.js does not exist yet (ADR 0005 Decision 1)
  FAIL  T5  … src/middleware/routeAccess.js does not exist yet (ADR 0005 Decision 1)
  FAIL  T6  … src/middleware/routeAccess.js does not exist yet (ADR 0005 Decision 1)
  FAIL  T7  … src/middleware/auth.js still declares the deleted list(s): ownerOnlyEndpoints, … PUBLIC_MUTATIONS
```

The behavioural suite on its own, against today's code (regression guards already green; new behaviour red):

```
admin-action-sweep-access: 5 passed, 8 failed, 0 skipped
  FAIL  AC3b … the BRAINSTORM_CONF_PATH seam (ADR 0005 Decision 5) is missing
  FAIL  AC1  … routeAccess.js does not exist yet
  FAIL  AC2  … routeAccess.js does not exist yet
  PASS  AC3
  PASS  AC4 (decided allowlist entries)
  FAIL  AC4 (signed-in table entries) … routeAccess.js does not exist yet
  PASS  AC5 (fixture + deploy reads)
  FAIL  AC5 (table public reads) … routeAccess.js does not exist yet
  FAIL  AC7 … the 401 body must be { success:false, error:<names who> }; got {"error":"Authentication required for this action"}
  FAIL  PARAM1 … the conf seam is missing
  PASS  PARAM1b
  FAIL  PARAM2 … an admin changing adminPubkeys … got status 200, changed true
  PASS  PARAM2b
```

Post-fix confidence: run against a correct candidate `routeAccess.js` (built from the inventory, no bare `*`), the
structural suite passed **8/9** — only `T7` stayed red, because deleting the six lists from `auth.js` is the
Implementer's change, not the table's. The coverage/agreement/stale/fail-closed logic was independently cross-checked
against the walked router and all reported zero mismatches.
