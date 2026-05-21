# ADR 0016: Add `requireOwnerOrAdmin` middleware; widen BullBoard auth gate to admins

**Status:** Accepted
**Date:** 2026-05-21
**Story:** `engineering-team/stories/18-bullboard-admin-access.md`

## Context

Story #18 widens the BullBoard auth gate from owner-only to "owner or admin" so trusted admins in `BRAINSTORM_ADMIN_PUBKEYS` can manage the BullMQ task queue with full parity to the owner (read AND mutate). Other owner-only endpoints (admin add/list/remove) must stay strictly owner-only to preserve the privilege-escalation guardrail.

### Grounded facts after reading source

- **Existing helper:** `getAdminPubkeys()` + `isAdminPubkey(pubkey)` at [`src/utils/config.js:94-117`](../../src/utils/config.js#L94) already encapsulate admin-list resolution. They read from `settings.json` first (runtime-editable via the admin-management page) and fall back to `BRAINSTORM_ADMIN_PUBKEYS` in `brainstorm.conf`. The same helpers are already consumed by other admin checks elsewhere in the app — this is the existing source-of-truth the story AC pinned.
- **Existing middleware:** `requireOwnerOnly` at [`src/api/admin/index.js:86-95`](../../src/api/admin/index.js#L86). 401 if unauthenticated; 403 if session pubkey !== owner. Used at four call sites: `/api/admin/list`, `/api/admin/add`, `/api/admin/remove` (admin management — must stay owner-only per story #18), and the BullBoard mount in `api/index.js:469` (this is the one that moves).
- **BullBoard mount:** [`src/manage/taskQueue/queue/bullBoardMount.js:22`](../../src/manage/taskQueue/queue/bullBoardMount.js#L22) declares `function mountBullBoard(app, { queues, requireOwnerOnly })` — the destructured parameter is named `requireOwnerOnly` but is otherwise a generic Express middleware. The mount calls `app.use('/admin/queues', requireOwnerOnly, serverAdapter.getRouter())` — the middleware reference is opaque to BullBoard. Swapping the actual middleware is purely a wiring change.
- **Existing tests touching the mount middleware** — story #13's R4 sentinel ([`test/task-queue-bullmq.test.js`](../../test/task-queue-bullmq.test.js)) and story #15's R4 sentinel ([`test/task-queue-neo4j-resource-class.test.js`](../../test/task-queue-neo4j-resource-class.test.js)) both regex-match `requireOwnerOnly|requireOwner` in `bullBoardMount.js`. Both need to evolve to track the new middleware name (or relax to a generic auth-middleware-existence check).

### Concept-graph impact

None. No new concepts, no schema, no firmware reinstall.

## Options considered

### Option A — Add a sibling `requireOwnerOrAdmin` middleware (chosen)

In `src/api/admin/index.js`, add a new function alongside the existing `requireOwnerOnly`:

```js
function requireOwnerOrAdmin(req, res, next) {
  if (!req.session?.pubkey) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  const sessionPubkey = req.session.pubkey;
  const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
  if (sessionPubkey === ownerPubkey) {
    return next();
  }
  if (isAdminPubkey(sessionPubkey)) {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Owner or admin access required' });
}
```

Export from `module.exports`. Pass to the BullBoard mount in place of `requireOwnerOnly`. Rename the parameter in `bullBoardMount.js` from `requireOwnerOnly` to `authMiddleware` for accuracy. Update the boot-log line from `"Mounted at /admin/queues (owner-only)"` to `"Mounted at /admin/queues (owner+admin)"`.

**Pros**
- Smallest possible change. New middleware is ~10 lines; mount wiring change is 1 line; param rename in `bullBoardMount.js` is cosmetic but accurate.
- **Privilege-escalation guardrail preserved by construction.** Admin-management endpoints in `api/index.js:456-458` still pass `adminApi.requireOwnerOnly` — they continue to require the owner exactly as today. The story #18 contract ("only BullBoard's mount moves to the broader gate") is enforced by *which middleware reference appears at the call site*, not by a runtime check.
- Existing `requireOwnerOnly` callers untouched. Zero risk of accidental scope creep.
- Pattern naturally extends to future multi-level admin tiering — add more sibling middlewares (e.g., `requireReadOnlyAdmin`) without restructuring.
- Consumes existing helpers (`isAdminPubkey`, `getConfigFromFile`) — no new config-source plumbing.

**Cons**
- Two middlewares with similar-looking names in the same module. Mitigated by clear naming + JSDoc.
- The `bullBoardMount.js` parameter rename ripples to one caller in `api/index.js`. Trivial; called out for completeness.

### Option B — Parameterize the existing `requireOwnerOnly` into a factory

Convert `requireOwnerOnly` from a plain function into a factory: `requireOwnerOnly({ allowAdmins: true })` returns a middleware. Existing callers change from `requireOwnerOnly` to `requireOwnerOnly()`; BullBoard mount calls it with `{ allowAdmins: true }`.

**Pros**
- One middleware function exists; consolidated logic.

**Cons**
- **Renames the meaning of `requireOwnerOnly` retroactively.** A function called "OwnerOnly" that sometimes admits admins is semantically misleading. New readers have to learn the option flag to know what each call site actually does.
- **Ripples to all four existing call sites.** They have to change from `requireOwnerOnly` to `requireOwnerOnly()` (or stay as-is and rely on JS treating a function reference as the middleware — but that's the current pattern and would conflict with the factory shape). Either way, the change surface is larger.
- Factory pattern is non-idiomatic in this codebase — no other auth middleware uses it.
- Doesn't naturally extend to multi-level tiering (would require more option flags, more matrix-y semantics).

Rejected.

### Option C — Compose middlewares at the call site

`app.use('/admin/queues', requireOwnerOnly, fallbackToAdmin, router)`. The first middleware rejects on non-owner via 403; an `app.use` error handler catches and tries the admin middleware.

**Cons:** Express middleware chaining doesn't naturally support "if rejected, try this next" without restructuring `requireOwnerOnly` to call `next()` differently. Larger change, more subtle failure modes.

Rejected.

## Decision

**Chosen: Option A.** New `requireOwnerOrAdmin` middleware in `src/api/admin/index.js`, used only at the BullBoard mount. Existing `requireOwnerOnly` callers (admin-management endpoints) untouched.

What we trade away: a small amount of "single middleware to rule them all" minimalism. Accepted because (a) the two middlewares have clearly different responsibilities, (b) the existing-callers-untouched property is itself the privilege-escalation guardrail, and (c) the codebase already has a precedent for narrow-purpose middleware names (`requireOwnerOnly` itself).

## Consequences

**Enabled**
- Admins can use BullBoard's full feature set immediately. Workflow bottleneck closed.
- The "owner OR admin" middleware is now available for future endpoints that want that gate (none today, but the door is open).
- Privilege-escalation guardrail enforced by construction: any future change that wires a new endpoint to `requireOwnerOnly` keeps it owner-only; a change that wires it to `requireOwnerOrAdmin` is loud + grep-able in the diff.

**Constrained / made harder**
- A future "remove admins from BullBoard" rollback is a real but mechanical change — swap the BullBoard mount's middleware reference back to `requireOwnerOnly`. The `requireOwnerOrAdmin` function can stay defined; it's just unused.
- Auditing who-did-what for queue mutations is still per BullBoard's own logging + our `events.jsonl` (no per-pubkey attribution at the auth layer). Story #18 §Out of scope explicitly defers this.

**Follow-up debt (out of scope here)**
- **Multi-level admin tiering** (read-only-admin vs full-admin, deferred per story #18).
- **Per-admin audit log** for queue mutations.
- **UI signaling** that admins can now access BullBoard. Today it just works; no UI hint that admins have access. If operators want a visible "you have admin access" indicator, that's a future UX story.

**Firmware reinstall required?** No.

## Implementation notes

The Implementer reads this section verbatim.

### 1. `src/api/admin/index.js`

**Add import** — adjust the existing import to also pull in `isAdminPubkey`:
```js
const { getConfigFromFile, getAdminPubkeys, isAdminPubkey } = require('../../utils/config');
```

**Add the new middleware** (place adjacent to `requireOwnerOnly` for discoverability):

```js
/**
 * Middleware: require owner OR admin.
 * Used by endpoints that admins are trusted to operate (e.g., BullBoard at
 * /admin/queues). Admin-management endpoints (/api/admin/add etc.) still use
 * requireOwnerOnly — see ADR 0016 §Privilege-escalation guardrail.
 */
function requireOwnerOrAdmin(req, res, next) {
  if (!req.session?.pubkey) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  const sessionPubkey = req.session.pubkey;
  const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
  if (ownerPubkey && sessionPubkey === ownerPubkey) {
    return next();
  }
  if (isAdminPubkey(sessionPubkey)) {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Owner or admin access required' });
}
```

**Update `module.exports`** to include `requireOwnerOrAdmin`:
```js
module.exports = {
  handleListAdmins,
  handleAddAdmin,
  handleRemoveAdmin,
  requireOwnerOnly,
  requireOwnerOrAdmin
};
```

### 2. `src/api/index.js:467-470`

Change the BullBoard mount wiring. Currently:
```js
mountBullBoard(app, {
    queues: taskQueue.getAllQueues(),
    requireOwnerOnly: adminApi.requireOwnerOnly
});
```

Becomes:
```js
mountBullBoard(app, {
    queues: taskQueue.getAllQueues(),
    authMiddleware: adminApi.requireOwnerOrAdmin
});
```

Also update the section-divider comment from `"BullBoard ... owner-only at /admin/queues"` to `"BullBoard ... owner+admin at /admin/queues"`.

**Leave lines 456-458 (`/api/admin/list|add|remove`) UNCHANGED.** Those still use `adminApi.requireOwnerOnly` — privilege-escalation guardrail preserved.

### 3. `src/manage/taskQueue/queue/bullBoardMount.js`

Rename the destructured parameter for accuracy:

```js
function mountBullBoard(app, { queues, authMiddleware }) {
  if (!Array.isArray(queues) || queues.length === 0) {
    console.warn('[bull-board] mountBullBoard called with no queues — skipping mount.');
    return;
  }
  if (typeof authMiddleware !== 'function') {
    throw new Error('mountBullBoard requires authMiddleware function');
  }

  // ... [unchanged lazy-require block] ...

  app.use('/admin/queues', authMiddleware, serverAdapter.getRouter());
  console.log('[bull-board] Mounted at /admin/queues (owner+admin)');
}
```

Update the file's header docblock to reference ADR 0016 alongside ADR 0010, and update the boardTitle in the BullBoard config from `'Tapestry Task Queue — Owner Only'` to `'Tapestry Task Queue — Owner + Admin'` (visible in the UI).

### 4. `OPERATIONS.md` §10.2

Update the "BullBoard UI" section's auth description. Current text (around line 425-428) says the mount is owner-only. New text: explain that as of story #18 / ADR 0016, the gate is "owner or any pubkey in `BRAINSTORM_ADMIN_PUBKEYS`." Implementer picks minimal wording.

### 5. Tests (Tester drives in Phase 3)

The Tester will:

- **Update R4 in `test/task-queue-bullmq.test.js`** (story #13's BullBoard-mount sentinel, around line 315) to assert the new middleware reference (e.g., regex now matches `authMiddleware|requireOwnerOrAdmin` instead of `requireOwnerOnly|requireOwner`).
- **Update R4 in `test/task-queue-neo4j-resource-class.test.js`** (story #15's same sentinel, around line 315) likewise.
- **Add a new positive-case sentinel** that asserts `src/api/admin/index.js` contains the literal `requireOwnerOrAdmin` function declaration AND that the function body references `isAdminPubkey` (proves the admin list is actually consulted).
- **Add a new privilege-escalation guardrail sentinel** that asserts `src/api/index.js` STILL wires `/api/admin/list`, `/api/admin/add`, `/api/admin/remove` to `adminApi.requireOwnerOnly` (and NOT to `requireOwnerOrAdmin`). This is the test that catches the scariest possible regression.

The Tester decides whether these new sentinels live in one of the existing suites (story #13's BullBoard suite is a natural home) or in a new suite for story #18.

### Smoke

Cycle-local (Reviewer):
- Verify the new boot-log line `[bull-board] Mounted at /admin/queues (owner+admin)` appears after `supervisorctl restart brainstorm`.
- (If feasible without too much ceremony) authenticate as an admin pubkey in a browser and confirm `/admin/queues/` returns the BullBoard UI. If that requires standing up a second test pubkey, defer to cycle-staging where the operator has real admin accounts.
- Verify `/api/admin/list` still returns 403 for a non-owner authenticated request — privilege-escalation guardrail intact.

Cycle-staging (Operator):
- The acid test: sign in as an admin (not the owner) via the browser; navigate to `https://staging.brainstorm.world/admin/queues/`; confirm the BullBoard UI loads with full functionality (can see jobs, can retry, can pause).

### Concept handle

None.

## Out of scope

- **Multi-level admin tiering** (read-only-admin vs full-admin). Future story.
- **Per-admin audit log** for queue mutations.
- **UI hint** that admins now have BullBoard access — no signal in the SPA today, none added in this story.
- **Removing the admin from `BRAINSTORM_ADMIN_PUBKEYS` while a tab is open.** Sessions don't auto-expire on role change. If the operator removes an admin via `/api/admin/remove`, that admin's session-cookie still validates for whatever session-secret lifetime applies, but their next `/admin/queues` request will hit the middleware fresh and get bounced. Acceptable. (If we ever want strict "remove → immediate cutoff," that's a session-invalidation story.)
