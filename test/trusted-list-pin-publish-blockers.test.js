/**
 * Tests for Story 1 (epic: tag-stack-merge-hardening) — trusted-list &
 * pin-publish security and data-loss blockers.
 *
 * ADR: engineering-team/decisions/tag-stack-merge-hardening/0001-trusted-list-and-pin-publish-blockers.md
 *
 * Intentionally failing until the fixes land. Hand-rolled in the project's
 * existing test style — no new framework.
 *
 * Layers (matching the search-api-result-controls + curated-view suites):
 *   - BEHAVIORAL-UNIT: helpers the ADR asks to be exported for testing
 *     (`requireAuth`, `isLoopbackRequest` from trustedList/index.js) and the
 *     env-overridable scheduled-tasks config path — invoked directly with
 *     fake req/res or a temp file.
 *   - LIVE-HTTP (per-test SKIP when :7778 unreachable): the real auth
 *     contract — a pubkey-but-not-signature-verified session must be 401'd.
 *   - SOURCE-CONTRACT (regex): ESM UI utils (publishTagPin.js, Tag.jsx) and
 *     binary-dependent server paths (publishToStrfry, runOnePin error path)
 *     that can't be exercised without a browser / the strfry binary / a
 *     >128 KiB synthetic event. Each pins the exact change the ADR prescribes.
 *
 * Testability affordances the Implementer must provide (all consistent with
 * existing repo patterns — see settings.js's TAPESTRY_SETTINGS_PATH and
 * refreshPinnedTags.js exporting runOnePin "for tests"):
 *   1. Export `requireAuth` and `isLoopbackRequest` from src/api/trustedList/index.js.
 *   2. Make the scheduled-tasks config path env-overridable via
 *      SCHEDULED_TASKS_CONFIG_PATH (mirror of settings.js).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}
function readSrc(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); }

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ─── module loader with src/ cache-bust (for the env-overridable config) ─ */
function freshRequire(rel) {
  for (const key of Object.keys(require.cache)) {
    if (key.includes(`${path.sep}src${path.sep}`)) delete require.cache[key];
  }
  return require(path.join(REPO_ROOT, rel));
}

/* ══════════════════════════════════════════════════════════════════════
 * AC-1 / AC-2 — auth bypass: requireAuth must demand session.authenticated
 * ════════════════════════════════════════════════════════════════════ */

function makeRes() {
  const captured = { status: 200, body: null };
  return {
    status(code) { captured.status = code; return this; },
    json(obj) { captured.body = obj; return this; },
    _captured: captured,
  };
}

t('AC-1: requireAuth rejects a session with pubkey but authenticated!==true', () => {
  const mod = require('../src/api/trustedList/index.js');
  assert(typeof mod.requireAuth === 'function',
    'requireAuth must be exported from src/api/trustedList/index.js for unit testing (ADR testability note 1)');
  const res = makeRes();
  const pubkey = 'a'.repeat(64);
  // pubkey set by the signature-free /api/auth/verify-user, but NOT authenticated.
  const out = mod.requireAuth({ session: { pubkey } }, res);
  assert(out === null || out === undefined,
    'requireAuth must NOT return a pubkey when session.authenticated is not true');
  assertEqual(res._captured.status, 401, 'requireAuth must respond 401 for an unauthenticated session');
});

t('AC-2: requireAuth authorizes a signature-verified session', () => {
  const mod = require('../src/api/trustedList/index.js');
  assert(typeof mod.requireAuth === 'function', 'requireAuth must be exported (ADR testability note 1)');
  const res = makeRes();
  const pubkey = 'b'.repeat(64);
  const out = mod.requireAuth({ session: { pubkey, authenticated: true } }, res);
  assertEqual(out, pubkey, 'requireAuth must return the session pubkey for an authenticated session');
  assertEqual(res._captured.status, 200, 'requireAuth must not write an error status for an authenticated session');
});

/* ─── AC-1 live contract (per-test SKIP when server down) ─── */
let serverReachable = null;
async function checkServer() {
  if (serverReachable !== null) return serverReachable;
  try {
    const res = await fetch(`${CONTROL_PANEL_BASE}/api/owner-info`, { signal: AbortSignal.timeout(3000) });
    serverReachable = res.ok;
  } catch { serverReachable = false; }
  return serverReachable;
}

t('AC-1 (live): a pubkey-only session is 401d by refresh-pinned-tag, no impersonation', async () => {
  if (!(await checkServer())) return 'SKIP';
  // Step 1: signature-free verify-user sets session.pubkey (no challenge signed).
  const verify = await fetch(`${CONTROL_PANEL_BASE}/api/auth/verify-user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pubkey: 'c'.repeat(64) }),
  });
  const cookie = verify.headers.get('set-cookie');
  if (!cookie) return 'SKIP'; // session cookie not issued in this env
  const jar = cookie.split(',').map((c) => c.split(';')[0].trim()).join('; ');
  // Step 2: try to act as that pubkey. Read-only target (nonexistent pin).
  const res = await fetch(`${CONTROL_PANEL_BASE}/api/trusted-list/refresh-pinned-tag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: jar },
    body: JSON.stringify({ pinEventId: 'd'.repeat(64) }),
  });
  assertEqual(res.status, 401,
    'an unauthenticated (pubkey-only) session must be rejected 401 — not allowed past requireAuth to impersonate');
});

/* ══════════════════════════════════════════════════════════════════════
 * AC-4 — cron endpoint must be loopback-only
 * ════════════════════════════════════════════════════════════════════ */

t('AC-4: isLoopbackRequest allows a loopback socket with no proxy headers', () => {
  const mod = require('../src/api/trustedList/index.js');
  assert(typeof mod.isLoopbackRequest === 'function',
    'isLoopbackRequest must be exported from src/api/trustedList/index.js (ADR testability note 1)');
  const ok = mod.isLoopbackRequest({ socket: { remoteAddress: '127.0.0.1' }, headers: {} });
  assertEqual(ok, true, 'a direct loopback call (no proxy headers) must be allowed');
  const ok6 = mod.isLoopbackRequest({ socket: { remoteAddress: '::1' }, headers: {} });
  assertEqual(ok6, true, 'IPv6 loopback ::1 must be allowed');
});

t('AC-4: isLoopbackRequest rejects an nginx-proxied request (X-Forwarded-For present)', () => {
  const mod = require('../src/api/trustedList/index.js');
  assert(typeof mod.isLoopbackRequest === 'function', 'isLoopbackRequest must be exported (ADR testability note 1)');
  const proxied = mod.isLoopbackRequest({
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'x-forwarded-for': '203.0.113.7' },
  });
  assertEqual(proxied, false, 'a request carrying X-Forwarded-For (proxied through nginx) must be rejected');
  const realIp = mod.isLoopbackRequest({
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'x-real-ip': '203.0.113.7' },
  });
  assertEqual(realIp, false, 'a request carrying X-Real-IP must be rejected');
});

t('AC-4: isLoopbackRequest rejects a non-loopback peer', () => {
  const mod = require('../src/api/trustedList/index.js');
  assert(typeof mod.isLoopbackRequest === 'function', 'isLoopbackRequest must be exported (ADR testability note 1)');
  const ext = mod.isLoopbackRequest({ socket: { remoteAddress: '203.0.113.7' }, headers: {} });
  assertEqual(ext, false, 'a non-loopback remote address must be rejected');
});

/* ══════════════════════════════════════════════════════════════════════
 * AC-3 — no empty Follow Set on first pin
 * ════════════════════════════════════════════════════════════════════ */

t('AC-3a: Tag.jsx awaits the refresh-pinned-tag call before the NIP-51 export', () => {
  const src = readSrc('ui/src/pages/Tag.jsx');
  assert(/await\s+fetch\(\s*['"]\/api\/trusted-list\/refresh-pinned-tag/.test(src),
    'Tag.jsx must AWAIT the /api/trusted-list/refresh-pinned-tag call (so the kind-30392 exists) before exporting — ' +
    'currently fire-and-forget, racing the export against a not-yet-created list');
  const refreshIdx = src.indexOf('refresh-pinned-tag');
  const exportIdx = src.indexOf('publishNip51ExportForPin');
  assert(refreshIdx !== -1 && exportIdx !== -1 && refreshIdx < exportIdx,
    'the refresh call must precede the publishNip51ExportForPin call in publishWithCuration');
});

t('AC-3b: publishNip51ExportForPin refuses to publish an empty member set', () => {
  const src = readSrc('ui/src/utils/publishTagPin.js');
  // The util must short-circuit when the prepared list has zero members,
  // BEFORE signing/publishing — so no empty kind-30000 is ever published.
  assert(/memberCount\s*===\s*0|memberCount\s*<\s*1|!\s*memberCount/.test(src),
    'publishNip51ExportForPin must guard on memberCount === 0 and skip publishing an empty follow-set (AC-3)');
  // The guard must sit before the signEvent call (return/skip early).
  const guardIdx = src.search(/memberCount\s*===\s*0|memberCount\s*<\s*1|!\s*memberCount/);
  const signIdx = src.indexOf('signEvent');
  assert(guardIdx !== -1 && signIdx !== -1 && guardIdx < signIdx,
    'the zero-member guard must come BEFORE window.nostr.signEvent so an empty list is never signed/published');
});

/* ══════════════════════════════════════════════════════════════════════
 * AC-5 — transient publish failure must not wipe a healthy TL
 * ════════════════════════════════════════════════════════════════════ */

t('AC-5: runOnePin returns the computed dTag on its publish-error path', () => {
  const src = readSrc('src/api/trustedList/refreshPinnedTags.js');
  // The catch around buildAndPublishTL must carry dTag back, so
  // refreshAllPinnedTags keeps the pin's dTag in currentDTags and
  // retractStaleTLs does NOT publish an empty-membership replacement.
  const catchBlock = src.match(/catch\s*\(\s*err\s*\)\s*\{\s*return\s*\{\s*status:\s*['"]error['"][^}]*\}/);
  assert(catchBlock,
    'could not locate the publish-error catch returning a status:error object in refreshPinnedTags.js — has it moved?');
  assert(/\bdTag\b/.test(catchBlock[0]),
    'runOnePin\'s publish-error return must include `dTag` (computed before the publish) so retractStaleTLs ' +
    'does not treat the errored pin\'s TL as stale and wipe it (AC-5)');
});

/* ══════════════════════════════════════════════════════════════════════
 * AC-6 — large TLs publish (event off the shell argv)
 * ════════════════════════════════════════════════════════════════════ */

t('AC-6: publishToStrfry feeds the event via stdin, not a shell argument', () => {
  const src = readSrc('src/api/trustedList/index.js');
  const fn = src.match(/async function publishToStrfry[\s\S]*?\n\}/);
  assert(fn, 'could not locate publishToStrfry in src/api/trustedList/index.js');
  const body = fn[0];
  assert(!/echo\s+'/.test(body),
    'publishToStrfry must NOT put the signed event on the command line via `echo \'<json>\'` ' +
    '(128 KiB MAX_ARG_STRLEN cap makes TLs >~600 members always fail to publish — AC-6)');
  assert(/spawn\s*\(/.test(body) && /stdin/.test(body),
    'publishToStrfry must spawn strfry and write the event to the child\'s stdin (no argv size limit)');
});

/* ══════════════════════════════════════════════════════════════════════
 * AC-7 — fresh deploy ships a default-DISABLED pinned-TL refresh entry
 * ════════════════════════════════════════════════════════════════════ */

t('AC-7: readConfig seeds a disabled refreshPinnedTagTLs entry on fresh install', () => {
  const tmp = path.join(os.tmpdir(), `sched-fresh-${process.pid}-${tests.length}.json`);
  try { fs.unlinkSync(tmp); } catch {}
  process.env.SCHEDULED_TASKS_CONFIG_PATH = tmp;
  const mod = freshRequire('src/api/scheduled-tasks/index.js');
  assert(typeof mod.readConfig === 'function', 'scheduled-tasks must export readConfig');
  const config = mod.readConfig();
  assert(config && Array.isArray(config.entries), 'readConfig must return { entries: [...] }');
  const entry = config.entries.find((e) => e.taskId === 'refreshPinnedTagTLs');
  assert(entry,
    'a fresh-install config (config file absent) must seed a refreshPinnedTagTLs schedule entry ' +
    '(requires the SCHEDULED_TASKS_CONFIG_PATH env override — ADR testability note 2 / AC-7)');
  assertEqual(entry.enabled, false,
    'the seeded refreshPinnedTagTLs entry must be DISABLED by default (matches every other scheduled task; ' +
    'retraction must not auto-run on fresh deploy — AC-7)');
  delete process.env.SCHEDULED_TASKS_CONFIG_PATH;
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- trusted-list & pin-publish blockers (epic tag-stack-merge-hardening, Story 1) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const result = await fn();
      if (result === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; continue; }
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\ntrusted-list-pin-publish-blockers: ${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ''}`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
