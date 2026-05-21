/**
 * Story #18 / ADR 0016 — Widen the BullBoard auth gate at /admin/queues from
 * owner-only to "owner or admin." Adds a sibling middleware
 * `requireOwnerOrAdmin` in src/api/admin/index.js; switches the BullBoard
 * mount in src/api/index.js to use it; renames the destructured parameter
 * in bullBoardMount.js from `requireOwnerOnly` to `authMiddleware` for
 * accuracy.
 *
 * Source/structural sentinels pin the ADR-required code shape. The
 * behavioral round-trip — sign in as an admin (not the owner) and confirm
 * /admin/queues/ loads the full BullBoard UI with mutate controls — is
 * reproducible only against a running stack with a real session cookie
 * and is the authoritative cycle-staging smoke (Operator-required).
 *
 * T1..T8 : FAIL pre-implementation, PASS post.
 * R1     : PASS pre AND post — regression guard on the existing
 *          requireOwnerOnly function (story #13's contract preserved).
 *
 * The most safety-critical test is **T7 — privilege-escalation guardrail.**
 * It asserts src/api/index.js STILL wires /api/admin/list, /api/admin/add,
 * /api/admin/remove to adminApi.requireOwnerOnly (not to the new broader
 * middleware). Without this guarantee, an admin could promote themselves
 * to admin or remove other admins, defeating the whole authority hierarchy
 * story #18 was careful to preserve.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const ADMIN_INDEX     = path.join(ROOT, 'src/api/admin/index.js');
const API_INDEX       = path.join(ROOT, 'src/api/index.js');
const BULLBOARD_MOUNT = path.join(ROOT, 'src/manage/taskQueue/queue/bullBoardMount.js');
const OPERATIONS_MD   = path.join(ROOT, 'OPERATIONS.md');

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (_e) { return null; }
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ---------------------------------------------------------------------------
// Failing tests — FAIL now, PASS once story #18 is implemented per ADR 0016.
// ---------------------------------------------------------------------------

test('T1: src/api/admin/index.js declares function requireOwnerOrAdmin (story #18 / ADR 0016 §Implementation §1)', () => {
  const src = readSafe(ADMIN_INDEX);
  assert(
    src !== null,
    'src/api/admin/index.js does not exist at the expected path — re-baseline this sentinel.'
  );
  assert(
    /function\s+requireOwnerOrAdmin\b/.test(src),
    'src/api/admin/index.js does not declare `function requireOwnerOrAdmin` (story #18 / ADR 0016 ' +
      '§Implementation §1). Add the new middleware adjacent to requireOwnerOnly. The function must: ' +
      '(1) return 401 if !req.session?.pubkey, (2) return next() if session pubkey === ' +
      'BRAINSTORM_OWNER_PUBKEY, (3) return next() if isAdminPubkey(session pubkey), (4) otherwise ' +
      'return 403 with body {success:false, error:"Owner or admin access required"}.'
  );
});

test('T2: requireOwnerOrAdmin consults the admin list via isAdminPubkey (story #18 AC + ADR 0016 §Implementation §1)', () => {
  const src = readSafe(ADMIN_INDEX);
  assert(src !== null, 'src/api/admin/index.js missing — T1 must pass first.');
  // The new middleware must consume isAdminPubkey from utils/config so the admin list flows from
  // the same source-of-truth the rest of the app already uses (story #18 AC: "no new env var, no new
  // config file, no new source of truth").
  assert(
    /isAdminPubkey/.test(src),
    'src/api/admin/index.js does not reference isAdminPubkey (story #18 / ADR 0016 §Implementation §1). ' +
      'The requireOwnerOrAdmin middleware must consume the existing isAdminPubkey helper from ' +
      'src/utils/config.js — that helper already encapsulates the settings.json → /etc/brainstorm.conf ' +
      'fallback for the admin list. Without this reference, the middleware would have to re-derive ' +
      'admin-list resolution (forking the source-of-truth, which is exactly what the story AC ' +
      'forbids). Import isAdminPubkey at the top of the file alongside the existing config helpers.'
  );
});

test('T3: requireOwnerOrAdmin is exported from src/api/admin/index.js (story #18 / ADR 0016 §Implementation §1)', () => {
  const src = readSafe(ADMIN_INDEX);
  assert(src !== null, 'src/api/admin/index.js missing.');
  // Look for requireOwnerOrAdmin appearing in the module.exports block. We allow either
  // shorthand form `requireOwnerOrAdmin` or full form `requireOwnerOrAdmin: requireOwnerOrAdmin`.
  const exportsIdx = src.indexOf('module.exports');
  assert(
    exportsIdx !== -1,
    'src/api/admin/index.js has no module.exports block — re-baseline.'
  );
  const exportsSection = src.slice(exportsIdx);
  assert(
    /requireOwnerOrAdmin/.test(exportsSection),
    'src/api/admin/index.js does not export requireOwnerOrAdmin (story #18 / ADR 0016 §Implementation §1). ' +
      'Add it to module.exports alongside the existing requireOwnerOnly export so api/index.js can wire it ' +
      'to the BullBoard mount.'
  );
});

test('T4: src/api/index.js wires the BullBoard mount with requireOwnerOrAdmin (story #18 / ADR 0016 §Implementation §2)', () => {
  const src = readSafe(API_INDEX);
  assert(src !== null, 'src/api/index.js missing.');
  // Look for mountBullBoard call, followed within a reasonable distance by requireOwnerOrAdmin reference.
  // The ADR pins: `mountBullBoard(app, { queues: ..., authMiddleware: adminApi.requireOwnerOrAdmin })`.
  assert(
    /mountBullBoard\s*\([^)]*[\s\S]{0,400}requireOwnerOrAdmin/.test(src),
    'src/api/index.js does not wire the BullBoard mount with requireOwnerOrAdmin (story #18 / ADR 0016 ' +
      '§Implementation §2). The widened-gate is the entire point of story #18; the mount must consume ' +
      'the new middleware, not requireOwnerOnly. Update the mountBullBoard call to ' +
      '`mountBullBoard(app, { queues: taskQueue.getAllQueues(), authMiddleware: adminApi.requireOwnerOrAdmin })`.'
  );
});

test('T5: src/manage/taskQueue/queue/bullBoardMount.js destructures authMiddleware parameter (story #18 / ADR 0016 §Implementation §3)', () => {
  const src = readSafe(BULLBOARD_MOUNT);
  assert(src !== null, 'bullBoardMount.js missing.');
  // The destructured parameter is renamed from requireOwnerOnly to authMiddleware for accuracy.
  // We check the param appears in the function signature region AND that the file uses it as a
  // middleware in the app.use() call.
  assert(
    /\bauthMiddleware\b/.test(src),
    'src/manage/taskQueue/queue/bullBoardMount.js does not reference authMiddleware (story #18 / ADR ' +
      '0016 §Implementation §3). The destructured parameter must be renamed from requireOwnerOnly to ' +
      'authMiddleware so the parameter name accurately describes what is being passed in. The old name ' +
      'was misleading post-story-#18 — calling something "requireOwnerOnly" when it now admits admins ' +
      'too is exactly the kind of stale naming that confuses future readers.'
  );
});

test('T6: bullBoardMount.js boot log announces (owner+admin) posture (story #18 / ADR 0016 §Implementation §3)', () => {
  const src = readSafe(BULLBOARD_MOUNT);
  assert(src !== null, 'bullBoardMount.js missing.');
  // The boot-log line should signal the new posture so operators reading brainstorm.log can confirm
  // the new gate is in effect. ADR pins the form "(owner+admin)" but we accept the spaced variant too.
  assert(
    /owner\s*\+\s*admin/i.test(src),
    'src/manage/taskQueue/queue/bullBoardMount.js does not announce the owner+admin posture in its ' +
      'boot-log line (story #18 / ADR 0016 §Implementation §3). The Reviewer + operator look for this ' +
      'literal in brainstorm.log to confirm the new gate is active. Update the console.log line from ' +
      '"[bull-board] Mounted at /admin/queues (owner-only)" to "[bull-board] Mounted at /admin/queues ' +
      '(owner+admin)". Also update the BullBoard `boardTitle` UI field from "Tapestry Task Queue — ' +
      'Owner Only" to "Tapestry Task Queue — Owner + Admin".'
  );
});

test('T7: PRIVILEGE-ESCALATION GUARDRAIL — /api/admin/list|add|remove still wired to requireOwnerOnly (story #18 AC + ADR 0016 §Decision)', () => {
  const src = readSafe(API_INDEX);
  assert(src !== null, 'src/api/index.js missing.');
  // The MOST safety-critical sentinel in this suite. Without this guarantee, admins could promote
  // themselves to admin or remove other admins — defeating the whole authority hierarchy.
  for (const endpoint of ['/api/admin/list', '/api/admin/add', '/api/admin/remove']) {
    const escaped = endpoint.replace(/\//g, '\\/');
    // Match a line containing the endpoint literal AND `requireOwnerOnly` on the same line.
    const re = new RegExp(`['"\`]${escaped}['"\`][^\\n]*requireOwnerOnly\\b`);
    assert(
      re.test(src),
      'PRIVILEGE-ESCALATION GUARDRAIL TRIPPED: src/api/index.js does not wire ' + endpoint + ' to ' +
        'requireOwnerOnly (story #18 AC; ADR 0016 §Decision; ADR 0016 §Implementation §2). The story ' +
        '#18 contract is **narrow** — only the BullBoard mount moves to the broader gate. Admin ' +
        'management endpoints (' + endpoint + ' and siblings) MUST remain owner-only; admins must NOT ' +
        'be able to manage the admin list itself, or the privilege hierarchy collapses (an admin could ' +
        'add or remove other admins). If this test is failing because someone broadened ' + endpoint + ' ' +
        'to requireOwnerOrAdmin, REVERT that change immediately — the only legitimate way to broaden ' +
        'these endpoints is via a separate story that explicitly weighs the security implications.'
    );
  }
});

test('T8: OPERATIONS.md documents the new owner+admin BullBoard gate (story #18 / ADR 0016 §Implementation §4)', () => {
  const src = readSafe(OPERATIONS_MD);
  assert(src !== null, 'OPERATIONS.md missing.');
  // The BullBoard section in §10 must mention admin access alongside owner. We don't pin exact
  // wording (Implementer's call) but we require that the BullBoard documentation acknowledges admin
  // access — either by referencing BRAINSTORM_ADMIN_PUBKEYS, "owner+admin", or "admin" near a
  // BullBoard mention.
  const bullBoardSection = src.match(/###\s*10\.2[\s\S]{0,2000}/);
  assert(
    bullBoardSection !== null,
    'OPERATIONS.md does not contain §10.2 (BullBoard section). Re-baseline this sentinel — the section ' +
      'numbering may have changed.'
  );
  const section = bullBoardSection[0];
  assert(
    /BRAINSTORM_ADMIN_PUBKEYS|owner\s*\+\s*admin|owner or admin|owner and admin/i.test(section),
    'OPERATIONS.md §10.2 does not document the new BullBoard auth posture (story #18 / ADR 0016 ' +
      '§Implementation §4). The section currently describes the gate as owner-only; update it to ' +
      'note that as of story #18 / ADR 0016, the gate also admits any pubkey in ' +
      'BRAINSTORM_ADMIN_PUBKEYS. A short paragraph or bullet is sufficient — the Implementer picks ' +
      'minimal wording. Operators reading OPERATIONS.md to triage "who can use BullBoard" land here.'
  );
});

// ---------------------------------------------------------------------------
// Regression sentinels — PASS now AND post-implementation.
// ---------------------------------------------------------------------------

test('R1: src/api/admin/index.js still declares function requireOwnerOnly (story #13 + #16 contracts preserved)', () => {
  const src = readSafe(ADMIN_INDEX);
  assert(src !== null, 'src/api/admin/index.js missing — re-baseline this sentinel.');
  // Story #18 ADDS a sibling middleware (requireOwnerOrAdmin); it does NOT replace requireOwnerOnly.
  // The existing function declaration must survive intact so the four other call sites (admin
  // add/list/remove plus any future endpoints with strict owner gating) continue to work.
  assert(
    /function\s+requireOwnerOnly\b/.test(src),
    'R1: src/api/admin/index.js no longer declares function requireOwnerOnly (story #13 / #16 ' +
      'regression caused by story #18). Story #18 was explicit that the change is ADDITIVE — a sibling ' +
      'middleware (requireOwnerOrAdmin) is added; the existing requireOwnerOnly stays. Removing it ' +
      'breaks the four other call sites (admin add/list/remove) plus the privilege-escalation ' +
      'guardrail in T7. Restore the function declaration with its original body.'
  );
  // Also pin the existing logic shape (owner pubkey check, 401/403 codes).
  assert(
    /BRAINSTORM_OWNER_PUBKEY/.test(src) && /401/.test(src) && /403/.test(src),
    'R1: src/api/admin/index.js no longer references the canonical owner-pubkey + 401/403 status ' +
      'codes (story #13 / #16 regression). The existing requireOwnerOnly contract (401 unauth, 403 ' +
      'non-owner) must remain — story #18 only adds a sibling middleware; it does not change the ' +
      'shape of the existing one.'
  );
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail };
}

module.exports = { run };
