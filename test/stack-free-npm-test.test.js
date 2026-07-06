/**
 * Story test-hermeticity-ci #2: `npm test` is honest without the stack.
 * Test plan: engineering-team/stories/test-hermeticity-ci/2-stack-free-npm-test.test-plan.md
 *
 * The 12 live-API contract suites must whole-suite SKIP — visibly, counted,
 * behind a bounded reachability probe — when the control panel is absent,
 * mirroring the *-publish precedent (test/most-pinned-tag-index-publish.test.js:48-53);
 * test/test.js must render SKIP (not PASS) per skipped suite and print an
 * aggregate `Total skipped:` line; skips must never mask real failures.
 *
 * Levels:
 *  - BEHAVIORAL: each target suite is spawned in a child node process with
 *    BRAINSTORM_BASE_URL pointed at a dead port (127.0.0.1:9 — instant
 *    connection refusal), which simulates stack absence even on machines
 *    where the real stack is up. The suites already read this env var.
 *  - SOURCE CONTRACTS on test/test.js for the summary + exit shape (running
 *    the full aggregator from inside itself would recurse).
 *  - The stack-PRESENT no-coverage-loss check (G2) self-skips when the real
 *    control panel is unreachable — the same honesty rule this story ships.
 *
 * G1, G3, G4 FAIL pre-implementation; G2 and G5 are standing regression
 * guards (green pre- and post-) against over-guarding and skip-masking.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const TEST_JS = path.join(REPO, 'test', 'test.js');
const DEAD_BASE = 'http://127.0.0.1:9'; // nothing listens on the discard port — instant ECONNREFUSED
const LIVE_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const CHILD_TIMEOUT_MS = 120000;
const SKIP_DECISION_BUDGET_MS = 20000; // generous; a refused probe is instant, a firewalled one is timeout-bounded

// The 12 unguarded live-API contract suites (story Background) and their
// result variables in test/test.js's summary/exit sections.
const TARGETS = [
  { file: 'profile-tags', resultVar: 'profileTagsResult' },
  { file: 'tag-detail', resultVar: 'tagDetailResult' },
  { file: 'tag-detail-write', resultVar: 'tagDetailWriteResult' },
  { file: 'tag-index', resultVar: 'tagIndexResult' },
  { file: 'authored-tagging', resultVar: 'authoredTaggingResult' },
  { file: 'profile-tag-polish', resultVar: 'profileTagPolishResult' },
  { file: 'pin-a-tag', resultVar: 'pinATagResult' },
  { file: 'tl-publication-from-pins', resultVar: 'tlPubFromPinsResult' },
  { file: 'most-pinned-tag-index', resultVar: 'mostPinnedTagIndexResult' },
  { file: 'tag-detail-curated-view-and-pin-polish', resultVar: 'tagDetailCuratedResult' },
  { file: 'restore-historical-data-and-fix-tl-author-filter', resultVar: 'restoreHistoricalDataAndTlFilterResult' },
  { file: 'nip51-list-export-from-pins', resultVar: 'nip51ListExportResult' },
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

test('G3 (AC-3): test.js renders SKIP (not PASS) for each of the 12 when skipped, and prints an aggregate `Total skipped:` line in the final summary', () => {
  const src = fs.readFileSync(TEST_JS, 'utf8');
  const offenders = [];
  for (const { file, resultVar } of TARGETS) {
    if (!new RegExp(`${resultVar}\\.skipped`).test(src)) {
      offenders.push(`${file}: summary line never consults ${resultVar}.skipped — a skipped run would render as PASS/FAIL, hiding that nothing ran`);
    }
  }
  if (!src.includes('Total skipped:')) {
    offenders.push('no aggregate `Total skipped:` line in the final summary — the reviewer constraint requires the skipped total to be visible at a glance');
  }
  assert(offenders.length === 0,
    `test.js summary must surface skips per-suite and in aggregate (story AC-3); offenders:\n      - ${offenders.join('\n      - ')}`);
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

test('G5 (AC-5 guard): skips can never mask failures — every target suite\'s `.fail === 0` stays in the overallOk chain, the chain never consults `.skipped`, and the exit code stays strict', () => {
  const src = fs.readFileSync(TEST_JS, 'utf8');
  const offenders = [];
  for (const { file, resultVar } of TARGETS) {
    if (!src.includes(`${resultVar}.fail === 0`)) {
      offenders.push(`${file}: ${resultVar}.fail === 0 missing from the overallOk chain`);
    }
  }
  const chain = src.match(/const overallOk =([\s\S]*?);/);
  assert(chain, 'test.js must compute overallOk (the aggregate exit expression) — not found.');
  if (/\.skipped/.test(chain[1])) {
    offenders.push('the overallOk expression consults .skipped — skip state must never influence pass/fail semantics');
  }
  if (!/process\.exit\(overallOk \? 0 : 1\)/.test(src)) {
    offenders.push('process.exit(overallOk ? 0 : 1) missing — the exit code must remain the strict verdict');
  }
  assert(offenders.length === 0,
    `exit-code strictness regressed (story AC-5); offenders:\n      - ${offenders.join('\n      - ')}`);
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
