/**
 * Story communities-notifications/7: notification preferences (ADR-0037).
 * The off-by-default guarantee is a pure function (defaultPreferences /
 * mergePreferences), tested against real source via extract-and-eval (loaded
 * inside tests to tolerate the new module). UI + route/menu wiring via
 * source-guards. localStorage I/O is not unit-tested in Node.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PREFS = path.join(ROOT, 'ui-communities/src/lib/notificationPrefs.js');
const PAGE = path.join(ROOT, 'ui-communities/src/pages/NotificationSettings.jsx');
const APP = path.join(ROOT, 'ui-communities/src/App.jsx');
const HEADER = path.join(ROOT, 'ui-communities/src/components/Header.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { throw new Error(`failed to read ${path.relative(ROOT, p)}: ${e.message}`); } }
function loadExport(file, name) {
  const src = read(file);
  const re = new RegExp(`export\\s+function\\s+${name}\\s*\\(([^)]*)\\)\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = src.match(re);
  if (!m) throw new Error(`${path.basename(file)} must export function ${name}`);
  // eslint-disable-next-line no-new-func
  return new Function(m[1], m[2]);
}

test('T1: defaultPreferences → every occasion off', () => {
  const def = loadExport(PREFS, 'defaultPreferences');
  const p = def();
  assert(p.vouched === false && p['new-posts'] === false && p.replies === false, 'all three off by default');
});

test('T2: mergePreferences with no stored value → all off', () => {
  const merge = loadExport(PREFS, 'mergePreferences');
  for (const stored of [null, undefined, {}]) {
    const p = merge(stored);
    assert(p.vouched === false && p['new-posts'] === false && p.replies === false, `no stored (${JSON.stringify(stored)}) → all off`);
  }
});

test('T3: a stored true is preserved; others stay off (independent)', () => {
  const merge = loadExport(PREFS, 'mergePreferences');
  const p = merge({ vouched: true });
  assert(p.vouched === true, 'vouched on');
  assert(p['new-posts'] === false && p.replies === false, 'others off');
});

test('T4: unknown stored keys are ignored', () => {
  const merge = loadExport(PREFS, 'mergePreferences');
  const p = merge({ bogus: true, vouched: false });
  assert(p.bogus === undefined, 'unknown key dropped');
  assert(p.vouched === false && p['new-posts'] === false && p.replies === false, 'known stay off');
});

test('T5: non-boolean stored values are ignored (default off)', () => {
  const merge = loadExport(PREFS, 'mergePreferences');
  const p = merge({ vouched: 'yes', replies: 1 });
  assert(p.vouched === false && p.replies === false, 'non-boolean → default off');
});

// ── source-guards ──
test('T6: NotificationSettings renders a toggle per occasion with On/Off label + saves on change', () => {
  const src = read(PAGE);
  assert(/OCCASIONS/.test(src), 'driven by the OCCASIONS list');
  assert(/savePreference/.test(src), 'saves via savePreference on change');
  assert(/\bOn\b/.test(src) && /\bOff\b/.test(src), 'shows an On/Off text label (not color alone)');
});

test('T7: no master "turn on everything" control', () => {
  const src = read(PAGE);
  assert(/OCCASIONS\.map|OCCASIONS\)\.map|map\(/.test(src), 'renders per-occasion');
  assert(!/turn on everything|enable all|all notifications/i.test(src), 'no master enable-all control');
});

test('T8: a failed save reverts and offers retry; ok shows Saved', () => {
  const src = read(PAGE);
  assert(/\.ok\b|ok\s*[)?:&]/.test(src), 'checks the save result ok flag');
  assert(/Saved/.test(src), 'quiet Saved confirmation on success');
  assert(/Retry|Couldn.t save/i.test(src), 'revert + retry affordance on failure');
});

test('T9: a /settings route maps to NotificationSettings and the account menu links to it', () => {
  const app = read(APP);
  assert(/['"]settings['"]/.test(app) && /NotificationSettings/.test(app), 'App routes /settings → NotificationSettings');
  const header = read(HEADER);
  assert(/\/settings/.test(header) && /Notification settings/i.test(header), 'account menu links to notification settings');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (e) { console.log(`  ✗ ${t.name}`); console.log(`      ${e.message.split('\n')[0]}`); fail++; }
  }
  return { pass, fail };
}
module.exports = { run };
