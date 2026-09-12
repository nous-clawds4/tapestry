/**
 * Security follow-up: POST /api/strfry/wipe must require owner OR localTrusted.
 *
 * Surfaced by the post-run-query-fix regression audit (2026-07-21): src/api/strfry/wipe.js
 * had no in-handler auth gate — it execs `strfry delete --filter='{}'` (wipes ALL events).
 * Default-deny already 401s the UNAUTHENTICATED case, but an authenticated non-owner
 * bypassed the middleware and reached the handler. This gate mirrors the queryPost
 * write-gate and publishEvent assistant-gate (ADR security-auth-exposure 0001/0002):
 *   !isOwner(req) && !req.localTrusted  ->  403 (before any exec).
 *
 * Stack-free: child_process.exec is stubbed BEFORE wipe.js loads (it destructures exec
 * at require time), so no real `strfry delete` can ever run from this suite.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WIPE = path.join(ROOT, 'src/api/strfry/wipe.js');

function assert(cond, msg) { if (!cond) throw new Error(msg); }

/* Stub child_process.exec BEFORE requiring wipe.js. */
const cp = require('child_process');
let execCalls = 0;
cp.exec = function (cmd, opts, cb) {
  execCalls++;
  const done = typeof opts === 'function' ? opts : cb;
  if (done) process.nextTick(() => done(null, '0', ''));
};

delete require.cache[require.resolve(WIPE)];
const { handleWipeStrfry } = require(WIPE);

function mkRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
  };
}

const tests = [
  ['authenticated non-owner / unauthenticated wipe → 403 and NO strfry delete runs', async () => {
    execCalls = 0;
    const res = mkRes();
    // session:{} + localTrusted:false → isOwner false, not local → gate must fire.
    await handleWipeStrfry({ session: {}, localTrusted: false }, res);
    assert(res.statusCode === 403, `expected 403 for a non-owner wipe, got ${res.statusCode}.`);
    assert(execCalls === 0, `the gate must fire BEFORE exec; strfry delete ran (${execCalls} exec call(s)).`);
  }],

  ['localTrusted (loopback operator/cron) wipe → not 403 (passes the gate)', async () => {
    const res = mkRes();
    await handleWipeStrfry({ session: {}, localTrusted: true }, res);
    assert(res.statusCode !== 403, 'a localTrusted wipe must be allowed; got 403.');
  }],

  ['S: wipe.js imports isOwner and gates on owner OR localTrusted with a 403', () => {
    const src = fs.readFileSync(WIPE, 'utf8');
    assert(/require\(['"][^'"]*middleware\/auth['"]\)/.test(src) && /isOwner/.test(src),
      'wipe.js must import isOwner from the auth middleware.');
    assert(/\b403\b/.test(src) && /localTrusted/.test(src),
      'wipe.js must gate on isOwner OR req.localTrusted with a 403.');
  }],
];

async function run() {
  console.log('\n--- strfry wipe owner-gate tests ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\nstrfry-wipe-owner-gate: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
