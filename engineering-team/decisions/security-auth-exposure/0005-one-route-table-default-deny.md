# ADR 0005: One route table; every action is the owner's side's unless the table opens it

**Status:** Accepted (owner, Architecture gate, 2026-10-10)
**Date:** 2026-10-10
**Story:** `engineering-team/stories/security-auth-exposure/8-admin-action-sweep.md`
**Book:** `engineering-team/audits/admin-action-owner-check/book.md`
**Supersedes (in part):** ADR `security-auth-exposure/0002` Decision items 1 and 4 (the central check's hand-kept lists, and
"no change to the authenticated branch"); ADR `security-auth-exposure/0004`'s "the middleware is left as is". ADRs 0001
(direct-local trust), 0003 (signed sign-in) and 0004's route guards stand unchanged.

## Context

**What the story asks (quoted in short).** AC-1: a signed-in person outside the owner's side gets 403 on any action not
on the allowlist, under any method (GET and HEAD included) and any spelling. AC-2: a visitor gets 401 on any action not
on the visitors' part of the allowlist. AC-3: the owner, admins and direct-local callers lose nothing, shown for the
owner and admins against the real check and for the instance's scripts end to end (the firmware-install bridge, the
loopback jobs). AC-4: one explicit allowlist, each entry naming who and why, approved by the owner before Implementation.
AC-5: reads unchanged (the owner's exception list is empty). AC-6: every route sorted; a test in the normal gate fails,
naming the route, when an action has neither an owner's-side guard nor an allowlist entry, shown with an added POST and
an added GET that acts. AC-7: 401/403 with a short error saying who may act, and the API reference says so. AC-8: no
page changes (owner's answer b). AC-9: shipped everywhere it is live in one round, no open route named first.

**Orientation.** The local stack was not running (probe failed), so the Concept Graph could not be consulted. The story
touches no concepts, event kinds or firmware, so nothing was needed from it; orientation was from the code.

**How the inventory was taken.** The real route registration (`register(app)` in `src/api/index.js`) was loaded into a
bare Express app with no stack running, and `app._router.stack` was walked: 383 route registrations (218 GET, 160 POST,
3 PUT, 2 DELETE, no PATCH). The real `authMiddleware` was then run against every registration for a visitor, a
signed-in non-owner and the owner, with a forwarding header set as nginx traffic has. Each registration that a signed-in
non-owner passes, and each GET whose handler could act, was read for its own caller check and its effect. The
entrypoint's own routes (`bin/control-panel.js`) and the task-queue dashboard mount were read by hand, since the
entrypoint cannot be loaded without Redis.

**What it found.** The named inventory is private (book ground rule 1) and is committed with the fixes. In classes:

| Class | Meaning | Registrations |
|---|---|---|
| A | an action a non-owner can reach today | **29** (28 distinct routes, one registered twice) across **13 modules**; 27 are mutation methods reachable by any signed-in key, 2 are GET routes that act or start heavy work, reachable by visitors too |
| B | an action already guarded (central lists, route guard or handler check) | 100 |
| C | a read, public or guarded; 5 of these are reads served by POST outside the API prefix | 220 |
| D | an action open on purpose: 7 for visitors (client-signed publish, the read backbone, the sign-in handshake), 27 for signed-in people (the POV sync and actions on the person's own things) | 34 |

The entrypoint adds eight more routes, all reads (well-known files, legacy pages, the app shell), static and API-docs
mounts, and one guarded mount.

**Why class A exists.** The central check (`src/middleware/auth.js`) is default-open for signed-in sessions and decides
by hand-kept lists matched by substring: `ownerOnlyEndpoints` (POST only), `ownerOnlyGetEndpoints`,
`protectedGetEndpoints`, `customerOrOwnerEndpoints`, `authenticatedEndpoints`, and the visitors' `PUBLIC_MUTATIONS`. Three
stories in one day each found a hole those lists missed (stories 5, 6, 7). A route nobody adds to a list is open to
every signed-in key; a GET is never a mutation by method, so GET routes that act are open to visitors too. Method alone
cannot classify a route either way: some GETs act, and some POSTs only read (the open-ranking provider, the read
backbone, two template builders).

**Constraints.**
- Direct-local callers stay trusted (book decision 4): the middleware stamps `req.localTrusted` and returns before any
  list check (ADR 0001/0002). Loopback callers found: the presets runner, the pinned-tag and applicability refreshers,
  the search-index refresher, the firmware-install bridge, the local CLI.
- Express matches routes case-insensitively, with an optional trailing slash, and runs a route's GET handlers for HEAD
  (stories 5 and 7). Any check that decides by path must agree with how Express dispatches, or it can be walked around.
- Route guards and handler checks that already narrow a route (the sync guards, `requireOwner`, `requireOwnerOnly`,
  `requireOwnerOrAdmin`, `requireOwnAssistant`, the owner-or-local handler checks) stay; they carry finer rules than a
  table can.
- `isOwnerOrAdmin` reads the owner from `/etc/brainstorm.conf` through `getConfigFromFile`, which has no override, so
  earlier stories could show the owner/admin pass only through stand-ins (audit `negentropy-sync-access` §5). The
  admin list already has one: `TAPESTRY_SETTINGS_PATH`.
- No new tooling or build step. Express 4.21 (`path-to-regexp` 0.1.12) is what is installed.
- Loading the registration has side effects a test must contain: router initialisation writes the strfry router config
  and its state file.

## Options considered

### Option A — One route table; the central check denies everything the table doesn't open *(chosen)*

A single module holds a **total** table: every route the instance serves, keyed `"<METHOD> <path as registered>"`, each
with an access level and a kind (`read` / `action`), and a `why` on every action open to anyone outside the owner's
side. The middleware resolves each request against the table with Express's own path matcher and enforces the level.
A request no entry matches is the owner's side's (fail closed). A test walks the real router stack and fails, naming
the route, for any route with no entry.

- **Pros:** the next action anyone adds is closed until someone opens it (the story's user-facing ask). One place lists
  what everyone else may do (AC-4). Visitors and signed-in people are judged by one rule, so the anonymous default-deny
  of ADR 0002 and the new signed-in default-deny cannot drift. The substring matching that over-matched before is gone.
  One mechanism closes all of class A, so there is no slow member for the serious ones to wait on.
- **Cons:** about 400 table lines, and every new route needs one (the test enforces it). The table must agree with
  Express's dispatch; this is designed for below (same matcher, strictest match wins, an agreement check in the test).

### Option B — A guard mounted on each class-A route, as ADR 0004 did for the sync routes

Mount `requireOwnerOrAdmin`-style guards (admitting direct-local callers) at each of the 29 registrations, in 13
modules; the test requires each route to show a recognised guard, or an allowlist or read entry.

- **Pros:** each route's rule is visible where it is registered; no change to the middleware.
- **Cons:** the default stays open: a forgotten guard is open until the test runs. 29 edits across 13 modules make a
  wide diff whose every hunk names a still-open route. The GET half still needs every read declared somewhere, or the
  test cannot tell a new GET that acts from a read. It keeps the parallel lists this story exists to retire.

### Option C — Install a guard on every route after registration, from the same table

After `register(app)`, walk `app._router.stack` and prepend a guard (built from the table entry) to each route's own
handler stack, so the rule runs on exactly the route Express dispatched.

- **Pros:** cannot disagree with Express's matching; HEAD and case are Express's own.
- **Cons:** rewrites Express internals (`route.stack` layers) at runtime in production, not only in a test. Routes
  registered after the install step, or on a mount it does not know, get no guard, so the failure mode is open, not
  closed. The middleware's direct-local trust would have to be re-derived per route.

### Sub-decision for AC-6 — derive the route set from the running router *(chosen)* vs a static scan

A static scan of `app.get(`/`app.post(` calls misses routes built in loops or by helpers, mounted routers, and
conditional registration, and has to guess at template paths. Walking the router stack of the real `register(app)` sees
exactly what Express will dispatch, including both registrations of a duplicated path. It runs in about half a second
with no stack, given three seams below. The entrypoint is the one place that cannot load stack-free, so it alone is
scanned statically: it registers eight literal routes plus its middleware, static and docs mounts.

## Decision

**Option A**, with the router-stack test.

1. **The table** — new module `src/middleware/routeAccess.js`:
   - `ROUTE_ACCESS`: an object keyed `"<METHOD> <path>"`, exactly as registered (e.g. `"POST /api/strfry/publish"`,
     `"GET /api/deploy-safety/status"`, `"DELETE /api/settings/*"`). Value: `{ access, kind, why }`.
     - `access`: `'public'` (anyone), `'signed-in'` (any verified session, plus the owner's side), `'owner'` (owner,
       admins, direct-local), `'owner-only'` (owner and direct-local; only where the owner decides question (e) so).
     - `kind`: `'read'` or `'action'`, the inventory's class, kept for review and for the test.
     - `why`: required (non-empty) on every `action` whose access is `public` or `signed-in`. Together, those entries
       **are the allowlist** (AC-4), each saying who may use it and why. Optional elsewhere.
   - It also covers routes outside the API prefix (the open-ranking provider, NIP-05, the entrypoint's reads, the
     task-queue dashboard mount as `"USE /admin/queues"`). The middleware does not judge those; the test does.
   - `resolveRouteAccess(method, path)`: HEAD looks up GET entries (a key `"HEAD …"`, if one is ever registered, wins).
     Each key's path is compiled once with **Express's own** `path-to-regexp`, resolved from `express`
     (`require.resolve('path-to-regexp', { paths: [require.resolve('express')] })`) with Express's route options
     `{ sensitive: false, strict: false, end: true }`. Of all entries for the method whose pattern matches, the
     **strictest access wins** (`owner-only` > `owner` > `signed-in` > `public`), so the result never depends on
     registration order. No match → `'owner'`.

2. **The central check** — `authMiddleware` in `src/middleware/auth.js`, in this order:
   1. Paths outside the API prefix and the static pages: `next()`, as today.
   2. Direct-local (`isDirectLocal`): stamp `req.localTrusted`, `next()`, as today (ADR 0001/0002). This is what keeps
      the firmware-install bridge, the loopback jobs and the CLI working (AC-3).
   3. The customer-or-owner quirk, **carried unchanged** for AC-5 but keyed by the registered paths, not by substring.
      Today a signed-in person who is neither a customer nor the owner's side is refused the read backbone and the two
      customer reads, all of which visitors get. This ADR does not decide that; see Out of scope.
   4. `const { access } = resolveRouteAccess(req.method, reqPath)`, then:
      - `public` → `next()`;
      - `signed-in` → `next()` with a verified session, else **401**;
      - `owner` → `next()` if `isOwnerOrAdmin(req)`; 403 if signed in; else 401;
      - `owner-only` → `next()` if the session is the owner's; 403 if signed in; else 401.
   5. Delete `ownerOnlyEndpoints`, `ownerOnlyGetEndpoints`, `protectedGetEndpoints`, `authenticatedEndpoints`,
      `MUTATING` and `PUBLIC_MUTATIONS`; the table subsumes them. The blanket skip for the sign-in routes is replaced by
      their own table entries (the handshake is `public` with its `why`), so every route under that prefix is sorted
      like any other. Removing the redundant sync entries does not widen anything: the POV sync is `signed-in` and its
      seven siblings `owner`, and their route guards stay (this is the ledger item `2026-10-10-case-sensitive-routing`
      would otherwise have carried; case-sensitive routing itself stays out of scope).
   6. Refusals (AC-7) are `{ success: false, error }`, and the error names who may act: for example, 401 "Sign in as the
      owner or an admin to do this.", 403 "Only the owner or an admin can do this.", 401 "Sign in to do this." for
      `signed-in`, and "Only the owner can do this." for `owner-only`.

3. **Which entries open what.** The decided entries are: `POST /api/strfry/publish` (public: an event the caller signed;
   the handler keeps `signAs:'assistant'` for the owner's side, ADR 0002); `POST /api/neo4j/query` (public: the read
   backbone; the handler keeps write Cypher for the owner's side, ADR 0001); the sign-in handshake (public, ADR 0003);
   `POST /api/strfry/negentropy-sync` (signed-in; its route guard narrows it to the POV sync, ADR 0004). Every other
   allowlist entry is a proposal the owner approves one by one before Implementation. All the proposals are actions on
   the person's own things that a page already offers them, where the handler already limits the action to the caller.
   They are listed in the private inventory, as are the judgment calls (routes whose class is not obvious, and actions
   a page offers ordinary signed-in people but which act as the instance). The task-control routes (story 6) are
   `owner`. Every read keeps the access it has today: public reads `public`, guarded reads the level their guard
   enforces (AC-5).

4. **Admin versus owner (question e).** Admins are the owner's equal by default (`owner`). The private inventory flags,
   for the owner to decide one by one: signing arbitrary content as the instance's assistant (settles OPEN.md row 269);
   an owner's-side settings write that can change the admin list itself, which sidesteps the owner-only admin routes of
   ADR `task-queue-scheduler/0016`; running scripts on the host; the other actions that sign as the instance; and the
   most destructive actions. A route-wide decision becomes `owner-only` in the table. A decision about one parameter (the
   `signAs` field, the admin-list key) is a check in that handler, using the owner pubkey, not `isOwnerOrAdmin`.

5. **The test seam for AC-3.** `getConfigFromFile` (`src/utils/config.js`) reads `process.env.BRAINSTORM_CONF_PATH ||
   '/etc/brainstorm.conf'`, the same shape as `TAPESTRY_SETTINGS_PATH`. A test can then write a temporary conf with an
   owner and admins and run the **real** `authMiddleware` and the real `isOwnerOrAdmin`, which closes the stand-in debt.

## The owner's decisions at the gate (2026-10-10)

1. **Option A, shipped as one release** (story question d). Batch 0, the shell-input hotfix, shipped before the gate
   (ledger `2026-10-10-request-values-reached-a-shell`).
2. **The allowlist:** all seventeen proposed signed-in entries are approved as proposed (entries S2–S17 of the private
   inventory), with the decided entries in Decision 3. Nothing else is open to people outside the owner's side.
3. **Admin versus owner (question e):** two parameter-level rules become owner-only, checked in their handlers against
   the owner pubkey: signing as the instance's assistant through the client-publish route (`signAs:'assistant'`;
   settles OPEN.md row 269), and changing the admin list through a settings update or reset. Every other flagged
   action stays `owner` (admins equal the owner), including running scripts on the host and the widest wipes.
4. **The judgment calls are accepted as proposed:** the actions a page offers ordinary signed-in people today but which
   act as the instance, or rewrite shared graph state, stay on the owner's side (those people get the bare 403, owner's
   answer b); GET routes that only read or lightly cache stay reads; a GET that acts is the owner's side's for the whole
   route, including its parameterless status use.
5. **AC-5's exception list:** two sensitive public reads become the owner's side's (named in the private inventory,
   committed with the fix). Every other read keeps the access it has today.

## Consequences

- **Closes all of class A at once:** 29 registrations in 13 modules, the two GET routes that act included, for visitors
  (401) and signed-in non-owners (403), under every method and spelling. The next action anyone adds is closed for
  everyone outside the owner's side until a table entry opens it, and the test names it until it is sorted.
- **Visitors' behaviour is preserved:** whatever was public to them stays public; every action not opened stays 401.
  For an unknown path under the API prefix, a visitor now gets 401 and a non-owner 403, where they got 404 before.
- **People who lose an action a page offers them** see the bare 403 (owner's answer b). A follow-up story hides or
  disables those controls. Which pages are affected depends on the owner's allowlist and judgment calls.
- **The cost of a new route is one table line**, enforced by the gate. Reviewers check that an action is not keyed as a
  read; no automated check can tell that a GET acts, which is why sorting is explicit and fails closed.
- **An Express 5 upgrade** must revisit `app._router` (renamed there) in the test and the matcher's options.
- **Strictest match wins.** A public literal route shadowed by a stricter parameter route with the same method would
  turn stricter. The test's agreement check fails on it, so it is found before shipping, not in production.
- **Earlier suites change (Phase 3, Tester's lane):** 14 suites name the deleted lists (among them the task-control and
  router owner-gate suites, and the dictionary, tagging-edges and brain suites). They re-aim at the table and
  `resolveRouteAccess`. Suites that assert a refusal's status code should hold; any that match the old error text change.
- **Disclosure:** the table and the API reference entries name every route, so they land in the same commit as the fix,
  and that commit reaches production in the same round as `staging` and both sandboxes (AC-9). The table records
  classes only, not which routes were open before. The private inventory, which does, is committed with the fix or
  after it ships.
- **Debt carried:** the customer-or-owner quirk (signed-in non-customers get less than visitors on three reads); the
  duplicate registration of one route; case-sensitive routing as a second safeguard (ledger
  `2026-10-10-case-sensitive-routing`).
- **Firmware reinstall required?** No. No concept definitions, event kinds or firmware change.

## Implementation notes

- **New `src/middleware/routeAccess.js`:** `ROUTE_ACCESS`, `ACCESS_ORDER`, `resolveRouteAccess(method, path)` as in
  Decision 1. Compile the patterns lazily, once. Fail on start (throw at module load) if a key is malformed or an
  `action` with `public`/`signed-in` access has no `why`.
- **`src/middleware/auth.js`, `authMiddleware`:** the order in Decision 2; delete the six lists; keep `isRead` (HEAD) and
  the lowercased path only where the quirk block needs them; the table resolver handles case itself. Keep the exported
  names (`isOwner`, `isOwnerOrAdmin`).
- **`src/utils/config.js`, `getConfigFromFile`:** the `BRAINSTORM_CONF_PATH` override (Decision 5). The debug handlers
  that read the conf file directly are left alone.
- **Owner's (e) answers:** `owner-only` entries in the table; parameter-level answers in their handlers
  (`src/api/strfry/commands/publishEvent.js` for `signAs:'assistant'`; `src/api/settings/settingsApi.js` for the admin-list
  key in an update or a reset).
- **`src/api/openapi.yaml`:** every action guarded here states the rule and both answers (401, 403), including the
  task-control entries story 6 left without one (AC-7). These entries land in the fix commit (disclosure).
- **Route guards and handler checks stay as they are.** Do not remove `requireSyncManager*`, `requireOwner`,
  `requireOwnerOnly`, `requireOwnerOrAdmin`, `requireOwnAssistant` or the owner-or-local handler checks.
- **The private inventory** (method, path, class, effect, who reached it, flags, handler location, the allowlist
  proposal) goes into the repo with the fix commit, e.g. `engineering-team/audits/admin-action-owner-check/inventory.md`.
- **For the Tester (Phase 3, not the Implementer):**
  - The route walk runs in a **child process**, because the gate loads suites in-process and the registration has side
    effects. It maps the in-container module prefix `/usr/local/lib/node_modules/brainstorm/` to the repo; stubs the
    owner-assistant key loader (the normalize routes load the key at registration) and router initialisation (which
    writes the strfry router config and its state file); points `TAPESTRY_SETTINGS_PATH`/`BRAINSTORM_BASE_DIR` at a
    temp dir; leaves `TASK_QUEUE_ENABLED` unset; calls the real `register(app)`; and prints the `app._router.stack`
    routes as JSON.
  - It adds the entrypoint's registrations from a static scan of `bin/control-panel.js` and the task-queue dashboard's
    mount.
  - It checks: (1) each route has a table entry, or its own stack starts with a recognised owner's-side guard (matched
    by function identity), and otherwise fails naming `METHOD path`. The AC-6 demonstration injects one extra unguarded
    POST and one extra GET into the walked set. (2) No table entry is stale. (3) Allowlisted actions carry a `why`. (4)
    Agreement: for each API route, `resolveRouteAccess` on its own path (parameters filled) and method, and on HEAD for
    GETs, returns that route's entry. (5) No action outside the API prefix is open without a recognised guard.
  - AC-1/2/3 run the real middleware in front of marker handlers, the way the story-6 suite does, using the conf-path
    seam for the owner and admins.

## Out of scope

- What an action does once the right caller reaches it, including defects found in handlers during the inventory.
  Those are reported privately and handled outside this ADR.
- The customer-or-owner quirk on three reads; widening or narrowing it is a product call (AC-5 keeps it).
- Hiding or disabling controls for people who cannot act (owner's answer b: a follow-up story).
- Case-sensitive routing; rate limits; which relays the POV sync may name; whether any nostr key may sign in.
- Removing the duplicate registration of one route (cleanup, no access change).
