# Test Plan: Story 18 — Admins can use BullBoard (parity with owner for queue management)

**Story:** `engineering-team/stories/18-bullboard-admin-access.md`
**ADR:** `engineering-team/decisions/0016-bullboard-admin-access.md`
**Date:** 2026-05-21

## Test posture

Source/structural **sentinels** in a new file `test/bullboard-admin-access.test.js` pin the ADR-required code shape: `requireOwnerOrAdmin` middleware added, BullBoard mount wired to it, `bullBoardMount.js` parameter renamed to `authMiddleware`, boot-log line updated, OPERATIONS.md documented, **and most critically the privilege-escalation guardrail** that `/api/admin/list|add|remove` still use `requireOwnerOnly` (NOT the new broader middleware).

The **behavioral round-trip** — sign in as a non-owner admin pubkey via the browser, navigate to `/admin/queues/`, and confirm full BullBoard functionality including mutate controls (retry / pause / remove) — is reproducible only against a running stack with real session cookies and is the **authoritative cycle-staging smoke** (operator-required).

Existing R4 sentinels in sibling suites (story #13's `task-queue-bullmq` T7, story #15's `task-queue-neo4j-resource-class` R4) are updated in-place to track the evolving middleware name — the regex broadens from `/requireOwnerOnly|requireOwner/` to `/requireOwnerOnly|requireOwnerOrAdmin|authMiddleware/` so they pass under both the pre- and post-story-#18 shape. This is the same evolution pattern story #17 used to migrate the T10 sentinel.

## Coverage map

| Criterion (story §) | Test name | Test file | Level |
|---|---|---|---|
| AC: admin gets BullBoard UI at /admin/queues | T1 + T2 + T3 + T4 collectively prove the new middleware exists, consults the admin list, is exported, and is wired to the mount | `test/bullboard-admin-access.test.js` | source sentinels |
| AC: admin can perform queue-mutating actions | Implicit from T4 + T5 (mount uses the new middleware → mutate routes are inside the mount → all mutate paths get the same gate). Direct test would require running Express in-process; deferred to cycle-staging smoke. | — | smoke |
| AC: owner retains full access | R1 (existing `requireOwnerOnly` declaration preserved) + T1's spec for the new middleware's logic (owner-pubkey check is the first branch) | `test/bullboard-admin-access.test.js` | source sentinel |
| AC: non-owner non-admin gets 403 | T1 spec includes the 403-with-message-`Owner or admin access required` behavior. Behavioral verification deferred to cycle-staging if feasible. | — | source sentinel + smoke |
| AC: unauthenticated → 401 | T1 spec includes the 401-if-no-session-pubkey branch | — | source sentinel |
| AC: PRIVILEGE-ESCALATION GUARDRAIL | **T7 — `src/api/index.js` still wires `/api/admin/list|add|remove` to `requireOwnerOnly`** | `test/bullboard-admin-access.test.js` | source sentinel (regression guard, passing now and forever) |
| AC: `BRAINSTORM_ADMIN_PUBKEYS` is read from existing source | T2 (middleware references `isAdminPubkey` from utils/config — same helper the rest of the app uses) | `test/bullboard-admin-access.test.js` | source sentinel |
| AC: empty admin list → owner-only behavior preserved | Implicit from `isAdminPubkey()` returning `false` on empty admin list (existing helper behavior, [`src/utils/config.js:114-117`](../../src/utils/config.js#L114)). Verified by direct read of the helper; no separate test needed. | — | implicit (existing helper contract) |
| AC: no regression in any of the 14 npm test suites | npm test passes 15/15 post-impl (the new suite + 14 prior) | (full gate) | gate |
| AC: existing R4/T7 sentinels updated to track new middleware name | T7 in story #13's suite + R4 in story #15's suite both relax their regex to match `requireOwnerOnly|requireOwnerOrAdmin|authMiddleware` | `test/task-queue-bullmq.test.js`, `test/task-queue-neo4j-resource-class.test.js` | source sentinels (already updated as part of this phase) |
| AC: positive-case sentinel that admin list is actually consulted | T2 in new suite — proves `isAdminPubkey` is imported, which proves the admin list is in scope | `test/bullboard-admin-access.test.js` | source sentinel |
| AC: new privilege-escalation guardrail sentinel | T7 in new suite (described above) | `test/bullboard-admin-access.test.js` | source sentinel |

### Suite layout decision

The new sentinels could have lived in story #13's existing `task-queue-bullmq` suite. The Tester chose to put them in a new suite (`test/bullboard-admin-access.test.js`) because:
- The story's contract is cohesive and self-contained — a single file lets a future maintainer find "what does story #18 cover?" by file name.
- The story #13 suite is already 18 sentinels; adding 9 more would balloon it.
- The privilege-escalation guardrail (T7) is the most safety-critical sentinel in the codebase — it deserves prominent placement in its own dedicated suite rather than buried in a 27-sentinel pile.

## Edge cases

| Case | Status |
|---|---|
| Admin pubkey removed from `BRAINSTORM_ADMIN_PUBKEYS` while their tab is open | **Documented in ADR §Out of scope.** Their session cookie still validates until next middleware hit; that hit lands fresh and returns 403. Acceptable. (Strict "remove → immediate cutoff" would be a session-invalidation story.) |
| `BRAINSTORM_ADMIN_PUBKEYS` empty | **Implicit:** `isAdminPubkey()` returns `false` on empty list → admin check fails → falls through to 403 unless session pubkey === owner. Functionally equivalent to pre-story-#18 owner-only behavior. No separate test needed; existing helper contract carries the property. |
| Future change broadens `/api/admin/add` to `requireOwnerOrAdmin` | **CAUGHT by T7.** The privilege-escalation guardrail trips loudly with an error message that walks the next reader through the security implication. |
| Session pubkey === owner AND owner is also in `BRAINSTORM_ADMIN_PUBKEYS` (config redundancy) | Implicit from middleware logic: owner check fires first, returns next(). Admin check never runs. No bug. Acceptable. |
| Future "remove admins from BullBoard" rollback | **Documented in ADR §Consequences.** Swap the BullBoard mount's middleware reference back to `requireOwnerOnly`; flip T1-T6 (or remove them); `requireOwnerOrAdmin` function can stay defined but unused. Mechanically straightforward. |
| Reviewer / Operator wants to verify admin actually CAN see BullBoard in browser | **Deferred to cycle-staging smoke.** Source sentinels can't easily fake a session cookie; the live-stack test is the right surface. |

## Test infrastructure

- **Framework:** Node built-in runner via `npm test` (entry: `test/test.js`).
- **New test file:** `test/bullboard-admin-access.test.js`, registered in `test/test.js` (four-spot wiring: require, run, log, ok-check).
- **Updated test files** (in-place evolution of existing sentinels):
  - `test/task-queue-bullmq.test.js` T7 — regex broadened.
  - `test/task-queue-neo4j-resource-class.test.js` R4 — regex broadened.
- **No new test infrastructure.** Same plain-Node sentinel pattern story #13/#15/#16/#17 used.
- **Concept Graph API:** not required.
- **Firmware reinstall:** no.

## How to run

```
npm test
```

The new suite registers as `bullboard-admin-access suite:` after `entrypoint-template-rendering suite:` in `test/test.js`. Post-implementation expected: `PASS (9 passed, 0 failed)`.

For Reviewer cycle-local smoke (behavioral round-trip):

```bash
docker exec tapestry supervisorctl restart brainstorm
sleep 10
docker exec tapestry tail -30 /var/log/supervisor/brainstorm.log | grep -E "bull-board|TASK_QUEUE_ENABLED"
# Expected (with =true and the new gate):
#   [task-queue] Initialized 51 queues + workers (...)
#   Task queue initialized (TASK_QUEUE_ENABLED=true)
#   [bull-board] Mounted at /admin/queues (owner+admin)
```

For operator cycle-staging smoke (the acid test):

1. Sign in to `https://staging.brainstorm.world/` as a pubkey listed in `BRAINSTORM_ADMIN_PUBKEYS` (NOT the owner).
2. Navigate to `https://staging.brainstorm.world/admin/queues/`.
3. Confirm the BullBoard UI loads with `Tapestry Task Queue — Owner + Admin` in the title.
4. Confirm at least one queue is visible.
5. (Optional / careful) Use the retry or pause UI on a non-critical queue to confirm mutate access works.

If admin sees BullBoard with full functionality, AC #1 + AC #2 are empirically satisfied.

## Verification

The flipped + new tests fail with the pre-implementation code (still requireOwnerOnly-gated). Confirmed on 2026-05-21 at commit `85e7816d`:

```
bullboard-admin-access suite:
  ✗ T1: src/api/admin/index.js declares function requireOwnerOrAdmin
      src/api/admin/index.js does not declare `function requireOwnerOrAdmin` ... Add the new middleware
      adjacent to requireOwnerOnly. The function must: (1) return 401 if !req.session?.pubkey, (2) return
      next() if session pubkey === BRAINSTORM_OWNER_PUBKEY, (3) return next() if isAdminPubkey(session
      pubkey), (4) otherwise return 403 with body {success:false, error:"Owner or admin access required"}.
  ✗ T2: requireOwnerOrAdmin consults the admin list via isAdminPubkey
      src/api/admin/index.js does not reference isAdminPubkey ... The requireOwnerOrAdmin middleware
      must consume the existing isAdminPubkey helper from src/utils/config.js — that helper already
      encapsulates the settings.json → /etc/brainstorm.conf fallback for the admin list.
  ✗ T3: requireOwnerOrAdmin is exported from src/api/admin/index.js
      src/api/admin/index.js does not export requireOwnerOrAdmin ...
  ✗ T4: src/api/index.js wires the BullBoard mount with requireOwnerOrAdmin
      src/api/index.js does not wire the BullBoard mount with requireOwnerOrAdmin ... Update the
      mountBullBoard call to `mountBullBoard(app, { queues: ..., authMiddleware: adminApi.requireOwnerOrAdmin })`.
  ✗ T5: src/manage/taskQueue/queue/bullBoardMount.js destructures authMiddleware
      ... The destructured parameter must be renamed from requireOwnerOnly to authMiddleware so the
      parameter name accurately describes what is being passed in.
  ✗ T6: bullBoardMount.js boot log announces (owner+admin) posture
      ... Update the console.log line from "[bull-board] Mounted at /admin/queues (owner-only)" to
      "[bull-board] Mounted at /admin/queues (owner+admin)". Also update the BullBoard `boardTitle` UI
      field from "Tapestry Task Queue — Owner Only" to "Tapestry Task Queue — Owner + Admin".
  ✓ T7: PRIVILEGE-ESCALATION GUARDRAIL — /api/admin/list|add|remove still wired to requireOwnerOnly
      (passes pre AND post — guardrail in place from story #13's original wiring, story #18 must
      preserve.)
  ✗ T8: OPERATIONS.md documents the new owner+admin BullBoard gate
      OPERATIONS.md §10.2 does not document the new BullBoard auth posture ... A short paragraph or
      bullet is sufficient — the Implementer picks minimal wording.
  ✓ R1: src/api/admin/index.js still declares function requireOwnerOnly
      (passes pre AND post — regression guard. Story #18 is additive; this preserves the existing
      function for the four other call sites.)

Test Results
-------------
bullboard-admin-access suite:                    FAIL (2 passed, 7 failed)
Overall:                                         FAIL
```

The 14 pre-existing suites continue to PASS — the in-place updates to T7 (in story #13's suite) and R4 (in story #15's suite) successfully evolved their regexes to match both pre- and post-story-#18 middleware names. No collateral damage.

Each of the 7 failures carries a right-reason message that points the Implementer at a specific edit:
- T1 specifies the exact 4-branch middleware logic.
- T2 specifies the exact helper import.
- T3 specifies the export.
- T4 specifies the exact `mountBullBoard` call form.
- T5 specifies the parameter rename.
- T6 specifies both the boot-log line AND the BullBoard `boardTitle` update.
- T8 specifies the OPERATIONS.md §10.2 update.

T7 + R1 are passing now and must continue passing post-impl. T7 is the privilege-escalation guardrail (the most safety-critical sentinel in the codebase); R1 is the additive-not-replacement guarantee.
