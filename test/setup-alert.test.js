'use strict';
/**
 * setup-status-and-alert #2: the Setup Alert.
 *
 * Story: engineering-team/stories/setup-status-and-alert/2-the-setup-alert.md
 * ADR:   engineering-team/decisions/setup-status-and-alert/0002-the-setup-alert-pill.md
 * Plan:  engineering-team/stories/setup-status-and-alert/2-the-setup-alert.test-plan.md
 * Browser half: tests/brainstorm/setup-alert.spec.js (B-class — what a viewer SEES in each top bar).
 *
 * Classes:
 *   C — the alert's copy in ui/src/pages/setup/steps.js, loaded in Node as ESM.
 *   D — source sentinels on the JSX this runner cannot execute: the component, its four mounts, and
 *       the provider's request key (ADR 0002 Decision 5).
 *   S — no pubkey literal in the new component.
 *
 * All of it FAILS against the current code: ui/src/components/SetupAlert.jsx does not exist, steps.js
 * has no alert copy, no host mounts a pill, and the provider's key ignores the viewer's assistant.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const STEPS = path.join(REPO, 'ui/src/pages/setup/steps.js');
const ALERT = path.join(REPO, 'ui/src/components/SetupAlert.jsx');
const PROVIDER = path.join(REPO, 'ui/src/context/SetupStatusContext.jsx');
const HOSTS = [
  // [file, import path the host uses, what the ADR says the host covers]
  ['ui/src/components/BrainstormUserMenu.jsx', './SetupAlert', 'TopBar pages and the fourteen own bars'],
  ['ui/src/pages/BrainstormSearch.jsx', '../components/SetupAlert', 'the landing and results views'],
  ['ui/src/components/Header.jsx', './SetupAlert', 'every /tapestry page'],
  ['ui/src/pages/developers/DevPage.jsx', '../../components/SetupAlert', 'the developer pages'],
];

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);

async function loadEsm(absPath) {
  try { return await import(pathToFileURL(absPath).href); } catch (err) { return { __loadError: err }; }
}

/* ───────────────────────── C — the copy (story 2 § Copy) ───────────────────────── */

test('C1: steps.js carries the alert\'s words from story 2 § Copy, verbatim', async () => {
  const mod = await loadEsm(STEPS);
  assert(!mod.__loadError, `ui/src/pages/setup/steps.js must load in Node as ESM: ${mod.__loadError && mod.__loadError.message}`);
  const c = mod.SETUP_ALERT_COPY;
  assert(c && typeof c === 'object', 'steps.js must export SETUP_ALERT_COPY (ADR 0002 § Implementation notes 3)');
  assert(c.name === 'Finish setting up your account', `SETUP_ALERT_COPY.name (the pill's accessible name): got ${show(c.name)}`);
  assert(c.sentence === 'Finish setting up your account', `SETUP_ALERT_COPY.sentence: got ${show(c.sentence)}`);
  assert(c.button === 'Finish setup →', `SETUP_ALERT_COPY.button: got ${show(c.button)}`);
});

test('C2: alertCountText says "· 1 step left" and "· N steps left"', async () => {
  const mod = await loadEsm(STEPS);
  assert(typeof mod.alertCountText === 'function', 'steps.js must export alertCountText(n) (ADR 0002 § Implementation notes 3)');
  for (const [n, want] of [[1, '· 1 step left'], [2, '· 2 steps left'], [3, '· 3 steps left']]) {
    assert(mod.alertCountText(n) === want, `alertCountText(${n}): expected ${show(want)}, got ${show(mod.alertCountText(n))}`);
  }
});

/* ───────────────────────── D — the component, its mounts, the provider key ───────────────────────── */

test('D1: ui/src/components/SetupAlert.jsx is one link to /setup that reads the shared answer and fetches nothing itself', async () => {
  assert(fs.existsSync(ALERT), 'ui/src/components/SetupAlert.jsx does not exist (ADR 0002 § Implementation notes 1).');
  const src = safeRead(ALERT);
  assert(/export\s+default\s+function\s+SetupAlert\b/.test(src), 'SetupAlert.jsx must export default function SetupAlert');
  assert(/useSetupStatus\s*\(/.test(src), 'the pill must read the shared answer with useSetupStatus() (ADR 0001; story 2 AC-4)');
  assert(/from\s+['"]\.\.\/context\/SetupStatusContext['"]/.test(src), 'SetupAlert.jsx must import useSetupStatus from ../context/SetupStatusContext');
  assert(/useAuth\s*\(/.test(src), 'the pill must read useAuth() to hide while signed out or while sign-in resolves');
  assert(/useLocation\s*\(/.test(src), 'the pill must read useLocation() to hide on /setup and its step pages');
  assert(/<Link\b[^>]*\bto=["']\/setup["']/.test(src), 'the pill must be a <Link to="/setup">');
  assert(/aria-label=\{\s*SETUP_ALERT_COPY\.name\s*\}/.test(src), 'the pill\'s accessible name must be SETUP_ALERT_COPY.name (story 2 AC-5)');
  assert(!/\bfetch\s*\(/.test(src), 'the pill must not fetch: the provider is the one reader (story 2 AC-4)');
  assert(!/<button\b/.test(src), 'the pill has no button inside it: no close control, and no nested interactive element (story 2 AC-3)');
});

test('D2: each of the four hosts imports and renders <SetupAlert /> (ADR 0002 § Implementation notes 2)', async () => {
  for (const [rel, importPath, covers] of HOSTS) {
    const src = safeRead(path.join(REPO, rel));
    assert(src, `${rel} could not be read`);
    const esc = importPath.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    assert(new RegExp(`import\\s+SetupAlert\\s+from\\s+['"]${esc}['"]`).test(src),
      `${rel} must import SetupAlert from '${importPath}' (it covers ${covers})`);
    assert(/<SetupAlert\s*\/>/.test(src), `${rel} must render <SetupAlert /> (it covers ${covers})`);
  }
});

test('D3: the provider asks again when the viewer\'s assistant changes (ADR 0002 Decision 5)', async () => {
  const src = safeRead(PROVIDER);
  const line = (src.match(/const\s+request\s*=[^\n;]*;?/) || [''])[0];
  assert(line, 'SetupStatusContext.jsx must still compute `const request = …` (ADR 0001 § 3)');
  assert(/assistantPubkey/.test(line),
    `the request key must include the viewer's assistant (user?.assistantPubkey), so AuthContext.refreshUser() after creating one makes the provider ask again; the key is: ${line.trim()}`);
  assert(/pubkey/.test(line) && /attempt/.test(line), `the key must keep the pubkey and the attempt (ADR 0001 § 3); got: ${line.trim()}`);
});

/* ───────────────────────── S — house rules ───────────────────────── */

test('S1: no 64-hex pubkey literal in SetupAlert.jsx (house rule)', async () => {
  assert(fs.existsSync(ALERT), 'ui/src/components/SetupAlert.jsx does not exist.');
  const hit = safeRead(ALERT).match(/['"`][0-9a-f]{64}['"`]/i);
  assert(!hit, `SetupAlert.jsx holds a 64-hex literal ${hit && hit[0]}`);
});

async function run() {
  console.log('\n=== setup-alert (setup-status-and-alert #2) ===');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}${String.fromCharCode(10)}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${String.fromCharCode(10)}setup-alert: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

module.exports = { run };
