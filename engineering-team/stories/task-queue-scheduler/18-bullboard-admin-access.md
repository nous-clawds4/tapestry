# Story 18: Admins can use BullBoard (parity with owner for queue management)

**Status:** Done (backfilled 2026-07-02 — PASS review on record; see docs/HARNESS_REVIEW_HANDOFF_2026-07-02.md Appendix A)
**Created:** 2026-05-21
**Type:** Feature (auth-gate broadening with operator + security implications)

## Background

Story #13 introduced BullBoard at `/admin/queues` (owner-only), gated behind a strict `requireOwnerOnly` middleware that compares `req.session.pubkey === BRAINSTORM_OWNER_PUBKEY`. At the time the choice was deliberate — BullBoard's controls include retry, remove, and pause for in-flight jobs (real side-effects on running calculations), and story #13's review §10.6 captured the decision to err on the side of a narrower gate during the queue's phase-1 rollout.

Stories #15 + #16 + #17 then matured the queue to the point where it's now the default-on path for fresh containers (story #17 / ADR 0015). With the queue as a routine part of operations, the owner-only gate on BullBoard has become a workflow bottleneck: every queue inspection or mutation has to flow through one pubkey, even when trusted admins are otherwise available to help triage.

The deployment already maintains a list of trusted admin pubkeys in `BRAINSTORM_ADMIN_PUBKEYS` (set via the entrypoint, exported into `/etc/brainstorm.conf` per story #16's template-rendering contract). These admins already have other operator-level permissions throughout the app. Extending their reach to include BullBoard's queue management is the natural next step.

This story does **not** rework the admin permissioning model. It changes exactly one gate — the BullBoard mount — from `requireOwnerOnly` to a new "owner or admin" posture. Other owner-only endpoints (admin add/list/remove in `/api/admin/*`) stay strictly owner-only, because those endpoints are about *managing the admin list itself* and granting admins the ability to add or remove other admins would be a privilege-escalation surface.

## User-facing description

**As an owner** of a Tapestry node who has trusted admins listed in `BRAINSTORM_ADMIN_PUBKEYS`, **I want** those admins to be able to use the BullBoard UI at `/admin/queues/` with the same access I have — full read AND mutate (retry / remove / pause jobs), **so that** routine queue operations can be shared across the trusted operator group instead of bottlenecking through my single pubkey.

## Acceptance criteria

### Behavior

- [ ] Given a pubkey listed in `BRAINSTORM_ADMIN_PUBKEYS` is signed in, when they navigate to `https://<host>/admin/queues/`, then the BullBoard UI loads (HTTP 200 with the BullBoard interface, NOT a 403).
- [ ] Given an admin is signed in and viewing BullBoard, when they perform a queue-mutating action (retry / remove / pause a job), then the operation succeeds with the same observable outcome as if the owner had performed it.
- [ ] Given the owner pubkey (the value of `BRAINSTORM_OWNER_PUBKEY`) is signed in, when they navigate to or operate on `/admin/queues/`, then nothing changes from today — full access remains.
- [ ] Given an authenticated pubkey that is **neither** the owner nor in `BRAINSTORM_ADMIN_PUBKEYS`, when they request `/admin/queues`, then they get HTTP 403 with an error message indicating owner-or-admin access is required (Architect picks exact wording).
- [ ] Given an **unauthenticated** request to `/admin/queues`, when it is received, then it returns HTTP 401 — unchanged from today.

### Privilege-escalation guardrail (the "admins can NOT bootstrap themselves" property)

- [ ] **Admin-management endpoints remain owner-only.** `POST /api/admin/add`, `POST /api/admin/remove`, `GET /api/admin/list` continue to return 403 for admins. Only the owner can manage the admin list. Without this guarantee, an admin could promote arbitrary pubkeys to admin, defeating the whole authority hierarchy.

### Config plumbing

- [ ] **`BRAINSTORM_ADMIN_PUBKEYS` is read from the same source** the existing app-wide admin checks already use (i.e., from `/etc/brainstorm.conf` via the existing config-loading pattern). No new env var, no new config file, no new source of truth.
- [ ] **The `BRAINSTORM_ADMIN_PUBKEYS` format follows the existing convention** (comma-separated hex pubkeys). Empty value behaves the same as today's empty-admin-list state — no admins, owner-only access (which preserves the pre-story-#18 behavior for nodes that don't configure admins).

### Test sentinel scope (explicit)

- [ ] **Existing regression sentinels updated, not deleted.** The BullBoard-mount sentinels in story #13's `task-queue-bullmq` suite (R4 region, ~line 315) and story #15's `task-queue-neo4j-resource-class` suite (R4, ~line 315) currently assert the mount uses `requireOwnerOnly`. Both are updated to assert the new middleware shape post-story-#18, while preserving the *underlying contract* (BullBoard is mounted at `/admin/queues` behind SOME auth middleware that protects mutate ops). The exact middleware name is the Architect's call; the sentinels must track whatever name lands.

- [ ] **New positive-case sentinel:** the new middleware's source carries the literal `BRAINSTORM_ADMIN_PUBKEYS` reference (or the existing `getAdminPubkeys`-style helper), proving the admin list is actually consulted. Catches a future regression where someone "fixes" the middleware by hardcoding it to owner-only or admin-only.

- [ ] **New privilege-escalation guardrail sentinel:** `/api/admin/list`, `/api/admin/add`, `/api/admin/remove` are still wired to `requireOwnerOnly` in `src/api/index.js` (and NOT to the new "owner-or-admin" middleware). This is the sentinel that catches a future change where someone too aggressively swaps `requireOwnerOnly` for the new broader middleware across the codebase. The story #18 contract is **narrow** — only BullBoard's mount moves to the broader gate.

- [ ] **No regression in any of the existing 14 npm test suites.** Specifically: story #13's task-queue-bullmq suite (18 sentinels) and story #15's task-queue-neo4j-resource-class suite (14 sentinels) continue to pass — the underlying contract holds even as the middleware name evolves. All 12 other suites untouched.

## Concepts touched

- The `requireOwnerOnly` middleware in the admin auth module
- The BullBoard mount in the task-queue module (`/admin/queues`)
- `BRAINSTORM_OWNER_PUBKEY` and `BRAINSTORM_ADMIN_PUBKEYS` — the two pubkey lists in `/etc/brainstorm.conf` that drive the auth gate
- (Architect should resolve concept handles via the Concept Graph API if applicable — none expected since this is server-side auth plumbing, but worth checking)

## Out of scope

- **Multi-level admin tiering.** The operator explicitly noted this is a future story ("perhaps in the future we can have multiple levels of admin"). For now there are just two levels: owner (full power including admin-list management) and admin (full power except admin-list management).
- **Other owner-only endpoints staying owner-only by design.** Specifically `/api/admin/list`, `/api/admin/add`, `/api/admin/remove` continue to require the owner. Story #18 does NOT touch those.
- **Read-only-for-admins / mutate-only-for-owner posture.** The user explicitly chose full parity (option 2 from the prior chat). A read-only admin tier was the rejected option 1; if it ever surfaces as a need, that's the future "multi-level admin tiering" story.
- **UI surface changes.** BullBoard is BullBoard — we're not redesigning the page; we're widening who can reach it.
- **Audit log / who-did-what tracking.** BullBoard's own logs and our `events.jsonl` already capture per-job state changes. If we ever want to attribute queue mutations to specific admin pubkeys, that's a separate observability story.
- **Per-environment admin-list configuration knobs.** `BRAINSTORM_ADMIN_PUBKEYS` is per-deployment via `/etc/brainstorm.conf`. Same mechanism as today; no new override surfaces.
- **Sweeping `requireOwnerOnly` → "owner-or-admin" across the codebase.** Only the BullBoard mount moves. Every other current `requireOwnerOnly` caller stays put.

## Open questions

Resolved at planning (2026-05-21):

- **Access level for admins** → **full parity with owner** (read + mutate). Option 1 (read-only) explicitly rejected by the operator.
- **Other owner-only endpoints** → **stay owner-only.** Admin add/list/remove remain owner-gated.
- **Audit / who-did-what** → **not in this story.** Existing logging is sufficient for now.
- **Test-update scope** → **explicit in the ACs above.** Tester updates the existing R4 sentinels in suites #13 and #15, adds a new positive-case sentinel (admin-list reference) and a new privilege-escalation guardrail sentinel (admin-management endpoints remain owner-only).

Deferred to Architect:

- **Where the new middleware lives.** Likely in the same module as `requireOwnerOnly`; PO has no opinion on the function name (e.g., `requireOwnerOrAdmin`, `requireAdminAccess`, or extending `requireOwnerOnly` with an option flag are all plausible).
- **Exact 403 error-message wording** for the "authenticated but not owner/admin" case.
- **Whether to fold this into an ADR** or fast-track as a small change. The PO sees real design choices (middleware shape, where the admin-list parse lives, how to keep the existing `requireOwnerOnly` callers safe) and recommends a brief ADR — but defers to the Architect.

## Linked artifacts

- ADR: [0016-bullboard-admin-access.md](../decisions/0016-bullboard-admin-access.md)
- Test plan: [18-bullboard-admin-access.test-plan.md](18-bullboard-admin-access.test-plan.md)
- Review: [../reviews/18-bullboard-admin-access.md](../reviews/18-bullboard-admin-access.md) — **PASS** end-to-end (15/15 suites + cycle-local boot log shows `(owner+admin)` mount + privilege-escalation guardrail intact at structural, sentinel, and behavioral levels).
