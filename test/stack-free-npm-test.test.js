/**
 * Story test-hermeticity-ci #2: `npm test` is honest without the stack.
 * Test plan: engineering-team/stories/test-hermeticity-ci/2-stack-free-npm-test.test-plan.md
 *
 * The 12 live-API contract suites must whole-suite SKIP — visibly, counted,
 * behind a bounded reachability probe — when the control panel is absent,
 * mirroring the *-publish precedent (test/most-pinned-tag-index-publish.test.js:48-53);
 * the runner must render SKIP (not PASS) per skipped suite and print an
 * aggregate `Total skipped:` line; skips must never mask real failures.
 *
 * Levels:
 *  - BEHAVIORAL: each target suite is spawned in a child node process with
 *    BRAINSTORM_BASE_URL pointed at a dead port (127.0.0.1:9 — instant
 *    connection refusal), which simulates stack absence even on machines
 *    where the real stack is up. The suites already read this env var.
 *  - The stack-PRESENT no-coverage-loss check (G2) self-skips when the real
 *    control panel is unreachable — the same honesty rule this story ships.
 *
 * harness-gate-integrity #1 (ADR 0001) extended this suite with the
 * anti-recurrence guard: every registered suite gates the exit code (G5), a
 * planted failure flips the verdict (G6), and no summary line lets a skip mask
 * a failure (G7).
 *
 * honest-test-gate #1 (ADR honest-test-gate/0001) RE-AIMS G3, G5, G6 and G7. The
 * runner is no longer a hand-written overallOk chain but one ordered registry
 * (test/registry.js) run by an engine (test/helpers/gateRunner.js, runGate()). The
 * four guards keep their properties — skips visible and counted, every suite
 * gates, a failure anywhere fails the gate, a skip never masks a failure — and now
 * check them by behaviour (the engine run over fixture suites, through
 * test/helpers/gateFixtures.js) plus registry completeness, instead of
 * regex-reading test.js. For that story this file is Phase-3 owned (ADR 0001
 * carve-out): the Implementer must not modify it.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const F = require('./helpers/gateFixtures');

const REPO = path.resolve(__dirname, '..');
const TEST_JS = path.join(REPO, 'test', 'test.js');
const DEAD_BASE = 'http://127.0.0.1:9'; // nothing listens on the discard port — instant ECONNREFUSED
const LIVE_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const CHILD_TIMEOUT_MS = 120000;
const SKIP_DECISION_BUDGET_MS = 20000; // generous; a refused probe is instant, a firewalled one is timeout-bounded

// The 12 unguarded live-API contract suites (story Background).
const TARGETS = [
  { file: 'profile-tags' },
  { file: 'tag-detail' },
  { file: 'tag-detail-write' },
  { file: 'tag-index' },
  { file: 'authored-tagging' },
  { file: 'profile-tag-polish' },
  { file: 'pin-a-tag' },
  { file: 'tl-publication-from-pins' },
  { file: 'most-pinned-tag-index' },
  { file: 'tag-detail-curated-view-and-pin-polish' },
  { file: 'restore-historical-data-and-fix-tl-author-filter' },
  { file: 'nip51-list-export-from-pins' },
];

// The four suite files that had never been registered as of 2026-09-12 (ADR
// honest-test-gate/0001 §3): excluded, with a reason, pending OPEN.md row 38.
const KNOWN_EXCLUDED = [
  'generalized-tag-pinning.test.js',
  'pinned-notes-display.test.js',
  'signer-guard-rollout.test.js',
  'tag-a-note-modal.test.js',
];

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function skip(reason) { throw Object.assign(new Error(reason), { skipped: true }); }

const RESULT_MARKER = '___SUITE_RESULT___';

/** Spawn one suite module in a child node process; parse its run() result. */
function runSuiteChild(file, envOverrides) {
  const suitePath = path.join(REPO, 'test', `${file}.test.js`);
  const script =
    `require(${JSON.stringify(suitePath)}).run()` +
    `.then(r => console.log(${JSON.stringify(RESULT_MARKER)} + JSON.stringify(r)))` +
    `.catch(e => { console.error('suite crashed:', e && e.message); process.exit(3); });`;
  const started = Date.now();
  const res = spawnSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
    timeout: CHILD_TIMEOUT_MS,
    env: { ...process.env, ...envOverrides },
  });
  const elapsedMs = Date.now() - started;
  const stdout = res.stdout || '';
  const line = stdout.split('\n').find((l) => l.startsWith(RESULT_MARKER));
  let result = null;
  try { result = line ? JSON.parse(line.slice(RESULT_MARKER.length)) : null; } catch { /* unparseable */ }
  return { result, stdout, stderr: res.stderr || '', status: res.status, elapsedMs };
}

async function controlPanelReachable(base) {
  try {
    const r = await fetch(`${base}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

/** test/registry.js, freshly loaded, shape-checked. */
function freshRegistry() {
  F.need('registry');
  const p = F.modulePath('registry');
  delete require.cache[require.resolve(p)];
  const reg = require(p);
  assert(reg && Array.isArray(reg.suites) && Array.isArray(reg.excluded),
    `test/registry.js must export { suites: [...], excluded: [...] } (ADR honest-test-gate/0001 §3); got keys ${JSON.stringify(Object.keys(reg || {}))}`);
  return reg;
}

test('G1 (AC-1/AC-4): with the control panel unreachable, each of the 12 live-API suites whole-suite SKIPs — zero failures, a counted skip, a visible SKIP line, decided within the probe budget', () => {
  const offenders = [];
  for (const { file } of TARGETS) {
    const { result, stdout, elapsedMs } = runSuiteChild(file, { BRAINSTORM_BASE_URL: DEAD_BASE });
    if (!result) { offenders.push(`${file}: crashed or returned no result object`); continue; }
    if (result.fail !== 0) {
      offenders.push(`${file}: ${result.fail} test failure(s) against an unreachable panel — must whole-suite SKIP, not fail with 'fetch failed'`);
      continue;
    }
    if (!(result.skipped >= 1)) {
      offenders.push(`${file}: no counted skip (result.skipped=${JSON.stringify(result.skipped)}) — skips must be counted, never silent`);
      continue;
    }
    if (!/SKIP/i.test(stdout)) {
      offenders.push(`${file}: no visible SKIP line in output — the reason must be stated`);
      continue;
    }
    if (elapsedMs > SKIP_DECISION_BUDGET_MS) {
      offenders.push(`${file}: skip decision took ${elapsedMs}ms (> ${SKIP_DECISION_BUDGET_MS}ms) — the probe must be time-bounded`);
    }
  }
  assert(offenders.length === 0,
    `12 live-API suites must skip visibly/countably/quickly when the control panel is unreachable (story AC-1/AC-4); offenders:\n      - ${offenders.join('\n      - ')}`);
});

test('G2 (AC-2): with the real control panel reachable, a guarded suite still RUNS its live tests (no coverage lost to over-guarding) — sampled on tag-detail', async () => {
  if (!(await controlPanelReachable(LIVE_BASE))) {
    skip(`control panel not reachable at ${LIVE_BASE} — the no-coverage-loss sample needs the live stack (AGENTS.md §2 ladder applies)`);
  }
  const { result, stdout } = runSuiteChild('tag-detail', {});
  assert(result, 'tag-detail child produced no result object against the live panel.');
  assert((result.pass + result.fail) >= 1,
    `with the panel reachable, tag-detail must EXECUTE its live tests (pass+fail >= 1); got ${JSON.stringify(result)} — the guard must engage only when the stack is genuinely unreachable (story AC-2).`);
  assert(!result.skipped,
    `with the panel reachable, tag-detail must not whole-suite skip; got skipped=${JSON.stringify(result.skipped)} (over-guarding loses live coverage). Output head: ${JSON.stringify(stdout.slice(0, 160))}`);
});

test('G3 (AC-3; re-aimed by honest-test-gate #1): the 12 live-API suites are registered with a skip note, and the engine renders a whole-suite skip as `SKIP (<n> tests; <note>)` and prints an aggregate `Total skipped:` line', () => {
  F.need('registry', 'runner');
  const reg = freshRegistry();
  const byFile = new Map(reg.suites.filter((e) => e && typeof e.file === 'string').map((e) => [path.basename(e.file), e]));
  const offenders = [];
  for (const { file } of TARGETS) {
    const e = byFile.get(`${file}.test.js`);
    if (!e) offenders.push(`${file}.test.js is not in the registry`);
    else if (!(typeof e.skipNote === 'string' && e.skipNote.trim())) {
      offenders.push(`${file}.test.js has no skipNote — its SKIP line would lose the reason test.js used to print (e.g. "control panel not reachable")`);
    }
  }
  const sc = F.scenario();
  try {
    const r = F.runEngineSync(sc, [sc.suite('skip-only.test.js', 'control panel not reachable')]);
    if (!/SKIP \(3 tests; control panel not reachable\)/.test(r.stdout)) {
      offenders.push(`a whole-suite skip must render \`SKIP (3 tests; control panel not reachable)\`; output tail: ${JSON.stringify(r.stdout.slice(-300))}`);
    }
    if (!/^Total skipped:\s*3\s*$/m.test(r.stdout)) offenders.push('the summary must print an aggregate `Total skipped: 3` line');
  } finally { sc.cleanup(); }
  assert(offenders.length === 0,
    `skips must stay visible per suite and in aggregate (story AC-3); offenders:\n      - ${offenders.join('\n      - ')}`);
});

test('G4 (AC-4): each of the 12 suites carries a bounded reachability guard (probe function + AbortSignal.timeout ≤ 5000ms) in its source', () => {
  const offenders = [];
  for (const { file } of TARGETS) {
    const p = path.join(REPO, 'test', `${file}.test.js`);
    let src = '';
    try { src = fs.readFileSync(p, 'utf8'); } catch { offenders.push(`${file}: unreadable`); continue; }
    const m = src.match(/AbortSignal\.timeout\(\s*(\d+)\s*\)/);
    if (!m) { offenders.push(`${file}: no AbortSignal.timeout(...) bounded probe found`); continue; }
    if (Number(m[1]) > 5000) { offenders.push(`${file}: probe timeout ${m[1]}ms exceeds the 5000ms bound`); continue; }
    if (!/reachab/i.test(src)) { offenders.push(`${file}: no reachability guard function found (expected the controlPanelReachable() pattern)`); }
  }
  assert(offenders.length === 0,
    `every target suite needs the bounded-probe guard the *-publish suites already use (story AC-4); offenders:\n      - ${offenders.join('\n      - ')}`);
});

test('G5 (test-hermeticity-ci #2 AC-5 + harness-gate-integrity #1 AC2; re-aimed by honest-test-gate #1): every suite file is registered or excluded with a reason, test.js runs the registry through the engine, and a failing suite fails the gate while a skip never does', () => {
  F.need('registry', 'runner');
  const reg = freshRegistry();
  const offenders = [];
  const files = fs.readdirSync(path.join(REPO, 'test')).filter((n) => n.endsWith('.test.js')).sort();
  const registered = reg.suites
    .filter((e) => e && typeof e.file === 'string' && e.file.endsWith('.test.js'))
    .map((e) => path.basename(e.file));
  const dupes = [...new Set(registered.filter((f, i) => registered.indexOf(f) !== i))];
  if (dupes.length) offenders.push(`registered more than once: ${dupes.join(', ')}`);
  const excluded = reg.excluded.map((e) => (e && typeof e.file === 'string' ? path.basename(e.file) : JSON.stringify(e)));
  for (const e of reg.excluded) {
    if (!(e && typeof e.reason === 'string' && e.reason.trim())) offenders.push(`an excluded entry has no reason: ${JSON.stringify(e)}`);
  }
  const both = registered.filter((f) => excluded.includes(f));
  if (both.length) offenders.push(`both registered and excluded: ${both.join(', ')}`);
  const unaccounted = files.filter((f) => !registered.includes(f) && !excluded.includes(f));
  if (unaccounted.length) offenders.push(`suite files neither registered nor excluded — they would silently never run: ${unaccounted.join(', ')}`);
  const phantom = [...registered, ...excluded].filter((f) => !files.includes(f));
  if (phantom.length) offenders.push(`the registry names files that do not exist: ${phantom.join(', ')}`);
  if (JSON.stringify([...excluded].sort()) !== JSON.stringify(KNOWN_EXCLUDED)) {
    offenders.push(`the exclusions must be exactly the four files that had never run as of 2026-09-12 (${KNOWN_EXCLUDED.join(', ')}); got ${JSON.stringify(excluded)}`);
  }
  const src = fs.readFileSync(TEST_JS, 'utf8');
  if (!/\brunGate\s*\(/.test(src) || !/require\(\s*['"]\.\/registry(\.js)?['"]\s*\)/.test(src)) {
    offenders.push("test/test.js must run the registry through the engine — require('./registry') and runGate(...) (ADR honest-test-gate/0001 §4)");
  }
  const sc = F.scenario();
  try {
    const failing = F.runEngineSync(sc, [sc.suite('pass.test.js'), sc.suite('fail.test.js'), sc.suite('second-pass.test.js')]);
    if (failing.status !== 1 || !/^Overall: FAIL\b/.test(F.lastLine(failing.stdout))) {
      offenders.push(`one failing suite must fail the gate (exit 1, Overall: FAIL); got exit ${failing.status}, last line ${JSON.stringify(F.lastLine(failing.stdout))}`);
    }
    const skipping = F.runEngineSync(sc, [sc.suite('pass.test.js'), sc.suite('skip-only.test.js')]);
    if (skipping.status !== 0 || !/^Overall: PASS\b/.test(F.lastLine(skipping.stdout))) {
      offenders.push(`a skip must never fail the gate — pass + skip-only must exit 0 with Overall: PASS; got exit ${skipping.status}, last line ${JSON.stringify(F.lastLine(skipping.stdout))}`);
    }
  } finally { sc.cleanup(); }
  assert(offenders.length === 0,
    `gate completeness / exit strictness regressed; offenders:\n      - ${offenders.join('\n      - ')}`);
});

test('G6 (harness-gate-integrity #1 AC1; re-aimed by honest-test-gate #1): a failure anywhere in the registry — first, middle or last — fails the gate, and an all-pass registry passes it', () => {
  F.need('runner');
  const sc = F.scenario();
  const offenders = [];
  try {
    const P = ['pass.test.js', 'second-pass.test.js', 'third-pass.test.js', 'fourth-pass.test.js'];
    const allPass = F.runEngineSync(sc, [...P, 'fifth-pass.test.js'].map((n) => sc.suite(n)));
    if (allPass.status !== 0 || !/^Overall: PASS\b/.test(F.lastLine(allPass.stdout))) {
      offenders.push(`an all-pass registry must exit 0 with Overall: PASS; got exit ${allPass.status}, last line ${JSON.stringify(F.lastLine(allPass.stdout))}`);
    }
    for (const [where, at] of [['first', 0], ['middle', 2], ['last', 4]]) {
      const names = [...P];
      names.splice(at, 0, 'fail.test.js');
      const r = F.runEngineSync(sc, names.map((n) => sc.suite(n)));
      if (r.status !== 1 || !/^Overall: FAIL\b/.test(F.lastLine(r.stdout))) {
        offenders.push(`a failing suite in the ${where} position must fail the gate (exit 1, Overall: FAIL); got exit ${r.status}, last line ${JSON.stringify(F.lastLine(r.stdout))}`);
      }
    }
  } finally { sc.cleanup(); }
  assert(offenders.length === 0,
    `every suite must gate the exit code (harness-gate-integrity #1 AC1); offenders:\n      - ${offenders.join('\n      - ')}`);
});

test('G7 (harness-gate-integrity #1 AC3; re-aimed by honest-test-gate #1): a suite that failed while also skipping reads FAIL with its skip count — never SKIP', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    const r = F.runEngineSync(sc, [sc.suite('fail-with-skips.test.js')]);
    const lines = F.lines(r.stdout).filter((l) => /fail-with-skips/.test(l) && /\b(PASS|FAIL|SKIP)\b/.test(l));
    assert(lines.length > 0, `no result line for the fail-with-skips suite in the output; tail: ${JSON.stringify(r.stdout.slice(-300))}`);
    const masked = lines.filter((l) => /\bSKIP\b/.test(l));
    assert(masked.length === 0,
      `a { fail: 1, skipped: 2 } result must never render SKIP (#58: a skip masking a real failure); got ${JSON.stringify(masked)}`);
    assert(lines.some((l) => /\bFAIL\b/.test(l) && /\b2 skipped\b/.test(l)),
      `it must render FAIL with its skip count ("2 skipped"); got ${JSON.stringify(lines)}`);
    assert(r.status === 1, `and the gate must fail (exit 1); got ${r.status}`);
  } finally { sc.cleanup(); }
});

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      if (err && err.skipped) {
        console.log(`  - SKIP ${t.name} (${err.message})`);
        skipped++;
        continue;
      }
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  return skipped ? { pass, fail, skipped } : { pass, fail };
}

module.exports = { run };
