'use strict';
/**
 * honest-test-gate #1 — a gate run's result tells the truth, however it was run.
 *
 * Story: engineering-team/stories/honest-test-gate/1-gate-result-tells-the-truth.md
 * ADR:   engineering-team/decisions/honest-test-gate/0001-registry-runner-and-run-record.md
 * Plan:  engineering-team/stories/honest-test-gate/1-gate-result-tells-the-truth.test-plan.md
 *
 * PHASE-3 GUARD (ADR 0001 carve-out). This story's deliverable is test infrastructure, so
 * the Implementer edits test/test.js and nine suites — and must NOT modify this file,
 * test/helpers/gateFixtures.js, or test/stack-free-npm-test.test.js.
 *
 * Every test runs stack-free (CI runs them all):
 *   A–E  engine behaviour: each drives runGate() (test/helpers/gateRunner.js) in a child
 *        process over fixture suites written to a temp dir, with records in a temp
 *        GATE_RECORD_DIR, and judges the child's exit, its output and the record it left.
 *        The reader (test/gate-status.js) is exercised on records the engine produced.
 *   C7/C8 the shared stack-HTTP helper, through a fake `docker` on PATH.
 *   C9/C10, F  source contracts: the nine suites use the shared helper; the docs point
 *        at one recipe.
 *
 * Pre-implementation every test fails with a message naming the missing piece and the
 * ADR section that defines it — never with an import crash. Nothing here requires the
 * engine at module load: the current runner loads every registered suite up front, so
 * a load-time throw here would crash the whole gate.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const F = require('./helpers/gateFixtures');

const { short } = F;
const TEST_DIR = F.TEST_DIR;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function skip(reason) { throw Object.assign(new Error(reason), { skipped: true }); }

function onlyRecord(sc, why) {
  const recs = F.readRecords(sc.recordDir);
  assert(recs.length === 1,
    `${why}: expected exactly one run record in the record directory, found ${recs.length} — every run writes its own record (ADR §2)`);
  assert(recs[0].rec, `${why}: the run record ${recs[0].path} is not valid JSON`);
  return recs[0];
}

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
/** A fixture's name as it appears in an output line, with or without its .test.js suffix. */
function nameRe(name) { return new RegExp(`(^|[\\s/\\\\\\[\\]:])${escRe(name)}(\\.test\\.js)?(?![\\w.-])`); }
/** The per-suite result lines ([i/N] … PASS|FAIL|SKIP …) for one fixture. */
function resultLines(stdout, name) {
  return F.lines(stdout).filter((l) => /\[\d+\/\d+\]/.test(l) && nameRe(name).test(l) && /\b(PASS|FAIL|SKIP)\b/.test(l));
}
function countsOf(line) {
  const m = String(line).match(/(\d+) passed, (\d+) failed, (\d+) skipped/);
  return m ? { pass: +m[1], fail: +m[2], skipped: +m[3] } : null;
}

/* ═══ AC-1 — the result can be read back, however the run was launched ═══════ */

test('A1 (AC-1): a foreground run records the same verdict and exit code it exits with — PASS/0 for a passing registry, FAIL/1 for a failing one', () => {
  F.need('runner');
  for (const [names, want] of [
    [['pass', 'second-pass'], { verdict: 'PASS', code: 0 }],
    [['pass', 'fail'], { verdict: 'FAIL', code: 1 }],
  ]) {
    const sc = F.scenario();
    try {
      const r = F.runEngineSync(sc, names.map((n) => sc.suite(`${n}.test.js`)));
      assert(r.status === want.code,
        `the runner must exit ${want.code} for ${names.join(' + ')}; it exited ${r.status} (signal ${r.signal}). stderr: ${short(r.stderr)}`);
      const { rec, path: p } = onlyRecord(sc, names.join(' + '));
      assert(rec.state === 'finished', `record ${path.basename(p)} must be in state "finished"; got ${JSON.stringify(rec.state)}`);
      assert(rec.verdict === want.verdict && rec.exitCode === want.code,
        `the record must hold what the runner decided — ${want.verdict} / exit ${want.code}; got ${rec.verdict} / exit ${rec.exitCode}`);
      assert(new RegExp(`^Overall: ${want.verdict}\\b`).test(F.lastLine(r.stdout)),
        `the last output line must be the verdict (Overall: ${want.verdict} …); got ${JSON.stringify(F.lastLine(r.stdout))}`);
    } finally { sc.cleanup(); }
  }
});

test('A2 (AC-1): the record says which run it is — start time, commit, and whether the tree had uncommitted changes — and the run names its record on its first and last lines', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    const porcelain = F.git(['status', '--porcelain']);
    const head = F.git(['rev-parse', 'HEAD']);
    const r = F.runEngineSync(sc, [sc.suite('pass.test.js')]);
    const { rec, path: p } = onlyRecord(sc, 'A2');
    assert(typeof rec.runId === 'string' && rec.runId.length > 0, `record.runId must identify the run; got ${JSON.stringify(rec.runId)}`);
    const started = Date.parse(rec.startedAt);
    assert(Number.isFinite(started) && Math.abs(Date.now() - started) < 5 * 60 * 1000,
      `record.startedAt must be this run's start time (ISO 8601); got ${JSON.stringify(rec.startedAt)}`);
    assert(rec.git && rec.git.commit === head, `record.git.commit must be the checkout's HEAD (${head}); got ${JSON.stringify(rec.git)}`);
    assert(typeof rec.git.dirty === 'boolean', `record.git.dirty must be true/false; got ${JSON.stringify(rec.git && rec.git.dirty)}`);
    assert(rec.git.dirty === (porcelain.length > 0),
      `record.git.dirty must say whether the tree had uncommitted changes when the run started (git status --porcelain was ${porcelain ? 'non-empty' : 'empty'}); got ${rec.git.dirty}`);
    const file = path.basename(p);
    assert(F.firstLine(r.stdout).includes(file),
      `the run's first line must name its record (${file}) so a reader can find it early; got ${JSON.stringify(F.firstLine(r.stdout))}`);
    assert(F.lastLine(r.stdout).includes(file),
      `the run's last line must name its record (${file}), so even \`| tail -1\` leads to it; got ${JSON.stringify(F.lastLine(r.stdout))}`);
  } finally { sc.cleanup(); }
});

function pipedCase(shell) {
  F.need('runner');
  const sc = F.scenario();
  try {
    const suites = [sc.suite('noisy.test.js'), sc.suite('fail.test.js')];
    const env = F.engineEnv(sc, suites, { label: `piped-${shell}` });
    const r = cp.spawnSync(shell, ['-c', `"${process.execPath}" "${sc.driver}" | tail -1`],
      { cwd: F.REPO, env, encoding: 'utf8', timeout: 90000, maxBuffer: 8 * 1024 * 1024 });
    assert(r.status === 0,
      `precondition: the pipeline's own exit status is tail's 0 — the lie this story makes harmless; got ${r.status}. stderr: ${short(r.stderr)}`);
    const tail = (r.stdout || '').trim();
    assert(/^Overall: FAIL\b/.test(tail),
      `piped into \`tail -1\` under ${shell}, the last line must still be the verdict (Overall: FAIL …) — a run must not lose its own last line to an unflushed pipe at process.exit (ADR §1); tail printed ${JSON.stringify(short(tail, 120))}`);
    const { rec } = onlyRecord(sc, `${shell} … | tail -1`);
    assert(rec.verdict === 'FAIL' && rec.exitCode === 1,
      `the record must still read FAIL / exit 1 however the run was launched; got ${rec.verdict} / exit ${rec.exitCode}`);
  } finally { sc.cleanup(); }
}

test('A3 (AC-1): piped into `tail -1` under bash, the tail still shows the verdict and the record still reads FAIL/1, though the pipeline itself exits 0', () => {
  pipedCase('bash');
});

test('A4 (AC-1): the same piped run under zsh', () => {
  if (!F.hasShell('zsh')) skip('zsh is not installed on this host (e.g. CI Linux); A3 covers bash');
  pipedCase('zsh');
});

test('A5 (AC-1): launched in the background — the launcher returns 0 at once — the finished record still reads FAIL/1', async () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    const suites = [sc.suite('brief.test.js'), sc.suite('fail.test.js')];
    const env = F.engineEnv(sc, suites, { label: 'backgrounded' });
    const r = cp.spawnSync('bash', ['-c', `"${process.execPath}" "${sc.driver}" </dev/null >/dev/null 2>&1 &`],
      { cwd: F.REPO, env, encoding: 'utf8', timeout: 15000 });
    assert(r.status === 0, `precondition: the background launcher exits 0 immediately; got ${r.status}`);
    const done = await F.waitFor(() => {
      const recs = F.readRecords(sc.recordDir);
      return recs.length === 1 && recs[0].rec && recs[0].rec.state && recs[0].rec.state !== 'running' ? recs[0] : null;
    }, 30000);
    assert(done,
      `a backgrounded run must leave a finished record within 30 s; records: ${JSON.stringify(F.readRecords(sc.recordDir).map((x) => x.rec && x.rec.state))}`);
    assert(done.rec.verdict === 'FAIL' && done.rec.exitCode === 1,
      `the record — not the launcher's 0 — is the answer, and it must read FAIL / exit 1; got ${done.rec.verdict} / exit ${done.rec.exitCode}`);
  } finally { sc.cleanup(); }
});

test('A6 (AC-1): two runs overlapping on one checkout each leave their own readable record; the reader lists both and selects each by label', async () => {
  F.need('runner', 'status');
  const sc = F.scenario();
  try {
    const suites = [sc.suite('brief.test.js'), sc.suite('pass.test.js')];
    const a = F.startEngine(sc, suites, { label: 'overlap-A' });
    const b = F.startEngine(sc, suites, { label: 'overlap-B' });
    const [ra, rb] = await Promise.all([a.exited, b.exited]);
    assert(ra.status === 0 && rb.status === 0,
      `both overlapping runs must finish PASS / exit 0; got ${ra.status} and ${rb.status}. stderr: ${short(a.stderr() + b.stderr())}`);
    const recs = F.readRecords(sc.recordDir).filter((x) => x.rec);
    assert(recs.length === 2, `two overlapping runs must leave two records; found ${recs.length}`);
    const ids = recs.map((x) => x.rec.runId);
    assert(new Set(ids).size === 2, `the two records must carry distinct run ids; got ${JSON.stringify(ids)}`);
    const labels = recs.map((x) => x.rec.label).sort();
    assert(JSON.stringify(labels) === JSON.stringify(['overlap-A', 'overlap-B']),
      `each record must carry its own run's label; got ${JSON.stringify(labels)}`);
    assert(recs.every((x) => x.rec.state === 'finished' && x.rec.verdict === 'PASS'),
      `neither record may be overwritten or left unfinished by the other; got ${JSON.stringify(recs.map((x) => [x.rec.state, x.rec.verdict]))}`);
    const list = F.runStatus(['--list'], sc.recordDir);
    for (const id of ids) {
      assert(list.stdout.includes(id), `gate:status --list must show both overlapping runs; ${id} is missing from ${JSON.stringify(short(list.stdout))}`);
    }
    const idA = recs.find((x) => x.rec.label === 'overlap-A').rec.runId;
    const idB = recs.find((x) => x.rec.label === 'overlap-B').rec.runId;
    const byLabel = F.runStatus(['--label', 'overlap-B'], sc.recordDir);
    assert(byLabel.stdout.includes(idB) && !byLabel.stdout.includes(idA),
      `gate:status --label overlap-B must report that run and not the other; got ${JSON.stringify(short(byLabel.stdout))}`);
    assert(byLabel.status === 0, `gate:status must exit with the selected run's recorded code (0); got ${byLabel.status}`);
  } finally { sc.cleanup(); }
});

test('A7 (AC-1): with no record directory configured, the run writes its record under tmp/gate-runs/ and leaves nothing for git status to report', () => {
  F.need('runner');
  const sc = F.scenario();
  const defaultDir = path.join(F.REPO, 'tmp', 'gate-runs');
  const label = `gate-guard-default-dir-${process.pid}-${Date.now()}`;
  let created = [];
  try {
    const before = F.git(['status', '--porcelain']);
    const r = F.runEngineSync(sc, [sc.suite('pass.test.js')], { label, recordDir: null });
    created = F.readRecords(defaultDir).filter((x) => x.rec && x.rec.label === label);
    assert(r.status === 0, `precondition: the run passes; it exited ${r.status}. stderr: ${short(r.stderr)}`);
    assert(created.length === 1,
      `with no record directory configured, the record must land in tmp/gate-runs/ (ADR §2); found ${created.length} record(s) labelled ${label} there`);
    const after = F.git(['status', '--porcelain']);
    assert(after === before, `a run must leave nothing for git status to report; before:\n${before}\nafter:\n${after}`);
  } finally {
    for (const x of created) { try { fs.unlinkSync(x.path); } catch { /* already gone */ } }
    sc.cleanup();
  }
});

test('A8 (AC-1): `npm run gate:status` is the documented reader — it reports the newest run and exits with that run\'s recorded status; with no records it exits 2', () => {
  F.need('runner', 'status');
  const pkg = JSON.parse(fs.readFileSync(path.join(F.REPO, 'package.json'), 'utf8'));
  const script = pkg.scripts && pkg.scripts['gate:status'];
  assert(script && /test\/gate-status\.js/.test(script),
    `package.json must define a "gate:status" script running test/gate-status.js (ADR §5); got ${JSON.stringify(script)}`);
  const sc = F.scenario();
  const empty = F.scenario();
  try {
    F.runEngineSync(sc, [sc.suite('fail.test.js')], { label: 'older-fail' });
    const s1 = F.runStatus([], sc.recordDir);
    assert(s1.status === 1 && /\bFAIL\b/.test(s1.stdout),
      `gate:status on a FAIL run must print FAIL and exit 1; got exit ${s1.status}: ${JSON.stringify(short(s1.stdout))}`);
    F.runEngineSync(sc, [sc.suite('pass.test.js')], { label: 'newer-pass' });
    const s2 = F.runStatus([], sc.recordDir);
    assert(s2.status === 0 && /\bPASS\b/.test(s2.stdout),
      `gate:status must report the newest run (now a PASS) and exit 0; got exit ${s2.status}: ${JSON.stringify(short(s2.stdout))}`);
    const s0 = F.runStatus([], empty.recordDir);
    assert(s0.status === 2, `gate:status with no records must exit 2 (ADR §5); got ${s0.status}: ${JSON.stringify(short(s0.stdout + s0.stderr))}`);
  } finally { sc.cleanup(); empty.cleanup(); }
});

/* ═══ AC-2 — a run that doesn't finish says so ═════════════════════════════════ */

async function interruptCase(signal, expectCode) {
  F.need('runner');
  const sc = F.scenario();
  try {
    const e = F.startEngine(sc, [sc.suite('pass.test.js'), sc.suite('slow.test.js')], { label: `interrupted-${signal}` });
    const mid = await F.waitFor(() => {
      const rec = (F.readRecords(sc.recordDir)[0] || {}).rec;
      return rec && rec.progress && rec.progress.completed >= 1 ? rec : null;
    }, 20000);
    assert(mid,
      `precondition: the run must record its progress (1 suite finished) before it is signalled; records: ${JSON.stringify(F.readRecords(sc.recordDir).map((x) => x.rec && x.rec.progress))}`);
    e.child.kill(signal);
    const res = await e.exited;
    const { rec } = onlyRecord(sc, signal);
    assert(rec.verdict !== 'PASS', `an interrupted run must never read PASS; got ${rec.verdict}`);
    assert(rec.state === 'interrupted' && rec.verdict === 'INTERRUPTED',
      `after ${signal} the record must read state "interrupted" / verdict INTERRUPTED; got ${rec.state} / ${rec.verdict}`);
    assert(rec.progress && rec.progress.completed === 1,
      `the record must say how far the run got (1 of 2 suites finished); got ${JSON.stringify(rec.progress)}`);
    assert(rec.signal === signal, `the record must name the signal (${signal}); got ${JSON.stringify(rec.signal)}`);
    assert(res.status === expectCode && rec.exitCode === expectCode,
      `the exit status must be ${expectCode} (128 + signal number) and match the record; the process ended with ${res.status} (signal ${res.signal}), the record says ${rec.exitCode}`);
    assert(/^Overall: INTERRUPTED\b/.test(F.lastLine(e.output())),
      `the last output line must say Overall: INTERRUPTED; got ${JSON.stringify(F.lastLine(e.output()))}`);
  } finally { sc.cleanup(); }
}

test('B1 (AC-2): SIGINT mid-run gives INTERRUPTED with the finished-suite count and exit 130 — never PASS', () => interruptCase('SIGINT', 130));

test('B2 (AC-2): SIGTERM mid-run (how a tool time limit stops it) gives INTERRUPTED and exit 143', () => interruptCase('SIGTERM', 143));

test('B3 (AC-2): a run killed outright (SIGKILL) is reported UNFINISHED by gate:status with exit 3 — never as the previous run\'s PASS', async () => {
  F.need('runner', 'status');
  const sc = F.scenario();
  try {
    const prior = F.runEngineSync(sc, [sc.suite('pass.test.js')], { label: 'prior-pass' });
    assert(prior.status === 0, `precondition: an earlier passing run exits 0; got ${prior.status}. stderr: ${short(prior.stderr)}`);
    const e = F.startEngine(sc, [sc.suite('pass.test.js'), sc.suite('slow.test.js')], { label: 'killed' });
    const mid = await F.waitFor(() => {
      const k = F.readRecords(sc.recordDir).find((x) => x.rec && x.rec.label === 'killed');
      return k && k.rec.progress && k.rec.progress.completed >= 1 ? k : null;
    }, 20000);
    assert(mid, 'precondition: the second run must record its progress before it is killed');
    e.child.kill('SIGKILL');
    await e.exited;
    const killed = F.readRecords(sc.recordDir).find((x) => x.rec && x.rec.label === 'killed');
    assert(killed && killed.rec.verdict !== 'PASS', `a killed run's record must never read PASS; got ${JSON.stringify(killed && killed.rec.verdict)}`);
    const s = F.runStatus([], sc.recordDir);
    assert(/UNFINISHED/.test(s.stdout), `gate:status must report the newest run — the killed one — as UNFINISHED; got ${JSON.stringify(short(s.stdout))}`);
    assert(s.stdout.includes(killed.rec.runId),
      `gate:status must be reporting the killed run ${killed.rec.runId}, not the earlier PASS; got ${JSON.stringify(short(s.stdout))}`);
    assert(s.status === 3, `gate:status must exit 3 for an unfinished run (ADR §5); got ${s.status}`);
  } finally { sc.cleanup(); }
});

test('B4 (AC-2): while a run is still going, gate:status reports RUNNING with its progress (exit 4)', async () => {
  F.need('runner', 'status');
  const sc = F.scenario();
  try {
    F.startEngine(sc, [sc.suite('pass.test.js'), sc.suite('slow.test.js')], { label: 'still-running' });
    const mid = await F.waitFor(() => {
      const k = F.readRecords(sc.recordDir)[0];
      return k && k.rec && k.rec.progress && k.rec.progress.completed >= 1 ? k : null;
    }, 20000);
    assert(mid, 'precondition: the run must record its progress');
    const s = F.runStatus([], sc.recordDir);
    assert(/RUNNING/.test(s.stdout) && /\b1\/2\b/.test(s.stdout),
      `while the run is alive, gate:status must report RUNNING with progress 1/2; got ${JSON.stringify(short(s.stdout))}`);
    assert(s.status === 4, `gate:status must exit 4 while the run is still going (ADR §5); got ${s.status}`);
  } finally { sc.cleanup(); }
});

/* ═══ AC-3 — nothing erases or invents a result ═════════════════════════════════ */

function isolationCase(first, why, expectError) {
  F.need('runner');
  const sc = F.scenario();
  try {
    const r = F.runEngineSync(sc, [sc.suite(`${first}.test.js`), sc.suite('pass.test.js')]);
    assert(r.status === 1, `${why}: the run must end FAIL with exit 1; it exited ${r.status} (signal ${r.signal}). stderr: ${short(r.stderr)}`);
    assert(/^Overall: FAIL\b/.test(F.lastLine(r.stdout)),
      `${why}: the run must still end with its verdict; the last line was ${JSON.stringify(F.lastLine(r.stdout))}`);
    const { rec } = onlyRecord(sc, first);
    const byFile = F.entryMap(rec);
    const bad = byFile[`${first}.test.js`];
    const later = byFile['pass.test.js'];
    assert(later && later.verdict === 'PASS' && later.pass === 2,
      `${why}: the suite after it must still run and pass; its record entry is ${JSON.stringify(later)}`);
    return { rec, bad, stdout: r.stdout, expectError };
  } finally { sc.cleanup(); }
}

test('C1 (AC-3): a suite that throws is that suite\'s FAIL, carrying its error; every later suite still runs and the run still ends with a verdict', () => {
  const { bad } = isolationCase('throws-in-run', 'a suite that throws');
  assert(bad && bad.verdict === 'FAIL' && /fetch failed \(fixture: throws-in-run\)/.test(JSON.stringify(bad)),
    `the throwing suite must be recorded FAIL with its error message; got ${JSON.stringify(bad)}`);
});

test('C2 (AC-3): a suite whose module throws while loading is that suite\'s FAIL; the others still load and run', () => {
  const { bad } = isolationCase('throws-at-load', 'a suite that throws at load');
  assert(bad && bad.verdict === 'FAIL' && /boom at load/.test(JSON.stringify(bad)),
    `the suite that failed to load must be recorded FAIL with its load error; got ${JSON.stringify(bad)}`);
});

test('C3 (AC-3): a suite that calls process.exit cannot end the run — it is that suite\'s FAIL, later suites run, and the exit is 1, not the 0 it asked for', () => {
  const { bad } = isolationCase('calls-exit', "a suite's process.exit(0)");
  assert(bad && bad.verdict === 'FAIL', `the suite that called process.exit must be recorded FAIL; got ${JSON.stringify(bad)}`);
});

test('C4 (AC-3): an escaped unhandled rejection does not crash the run — it is reported as a failing stray error and later suites still run', () => {
  const { rec, stdout } = isolationCase('stray-rejection', 'an escaped unhandled rejection');
  const stray = JSON.stringify(rec.strayErrors || []);
  assert(Array.isArray(rec.strayErrors) && rec.strayErrors.length >= 1 && /stray rejection \(fixture: stray-rejection\)/.test(stray),
    `the escaped rejection must be recorded in strayErrors (ADR §1); got ${short(stray)}`);
  assert(/stray/i.test(stdout), 'the run output must report the stray error, not only the record');
});

test('C5 (AC-3): a suite that returns no result counts is a FAIL, not a silent PASS', () => {
  const { bad } = isolationCase('no-counts', 'a suite returning no counts');
  assert(bad && bad.verdict === 'FAIL', `a suite whose run() returns no { pass, fail } must be recorded FAIL; got ${JSON.stringify(bad)}`);
});

test('C6 (AC-3; ADR Decision "Load order"): every suite is loaded before any runs, so a later suite\'s load-time read cannot see an earlier suite\'s run-time write', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    const r = F.runEngineSync(sc, [sc.suite('env-writer.test.js'), sc.suite('env-reader.test.js')]);
    const { rec } = onlyRecord(sc, 'C6');
    const reader = F.entryMap(rec)['env-reader.test.js'];
    assert(reader && reader.verdict === 'PASS',
      'env-reader saw env-writer\'s run-time write while loading — the engine loaded suites lazily. ADR 0001 (Decision, "Load order") requires every suite loaded before any runs, so load-time reads (e.g. the eight TAPESTRY_SETTINGS_PATH readers) keep today\'s meaning. ' +
      `env-reader's record entry: ${JSON.stringify(reader)}`);
    assert(r.status === 0, `with both suites passing the run must exit 0; got ${r.status}`);
  } finally { sc.cleanup(); }
});

test('C7 (AC-3): the shared stack-HTTP helper reports "no response" — never a status — for empty output, a missing status marker, curl\'s 000, or a failed docker exec', () => {
  F.need('stackHttp');
  const sc = F.scenario();
  try {
    const bin = F.makeFakeDocker(sc.dir);
    for (const mode of ['empty', 'nomarker', 'zero', 'exit1']) {
      const out = F.probeStackHttp(bin, mode);
      assert(!out.threw, `loopbackRequest must not throw when the stack gives no response (${mode}); it threw ${JSON.stringify(out.threw)}`);
      assert(out.r && out.r.noResponse === true && out.r.status === null,
        `${mode}: expected { noResponse: true, status: null } — a status the stack never sent must not be invented (row 263); got ${JSON.stringify(out.r)}`);
      assert(/no response/i.test(out.described || ''), `${mode}: describeResponse must say there was no response; got ${JSON.stringify(out.described)}`);
    }
  } finally { sc.cleanup(); }
});

test('C8 (AC-3): the shared stack-HTTP helper passes real statuses through untouched — a 200 whose body says success:false stays 200, a real 500 stays 500', () => {
  F.need('stackHttp');
  const sc = F.scenario();
  try {
    const bin = F.makeFakeDocker(sc.dir);
    for (const [mode, status, success] of [['ok', 200, true], ['ok-false', 200, false], ['http500', 500, false]]) {
      const out = F.probeStackHttp(bin, mode);
      assert(!out.threw, `${mode}: loopbackRequest threw ${JSON.stringify(out.threw)}`);
      assert(out.r && out.r.noResponse === false && out.r.status === status,
        `${mode}: the status the stack sent (${status}) must come through as-is${mode === 'ok-false' ? ' — the old helpers turned a 200 carrying success:false into a 500' : ''}; got ${JSON.stringify(out.r)}`);
      assert(out.r.json && out.r.json.success === success, `${mode}: the parsed body must be returned; got ${JSON.stringify(out.r.json)}`);
      assert(new RegExp(`HTTP ${status}`).test(out.described || ''), `${mode}: describeResponse must name the status (HTTP ${status}); got ${JSON.stringify(out.described)}`);
    }
  } finally { sc.cleanup(); }
});

const NINE = [
  'customize-pin-curation-publish', 'tag-detail-curated-view-and-pin-polish-publish', 'tl-membership-method-selector',
  'tl-publication-from-pins-publish', 'tl-publication-from-pins', 'relationship-primitives',
  'firmware-concept-elements-sets', 'move-nodes-between-sets-ui', 'operational-direction',
];
const GUARD_FILES = new Set(['gate-result-record.test.js', 'stack-free-npm-test.test.js']);

test('C9 (AC-3): no suite invents an HTTP status or parses curl\'s status itself — the nine suites that reach the stack through docker exec use the shared helper', () => {
  const offenders = [];
  for (const f of fs.readdirSync(TEST_DIR).filter((n) => n.endsWith('.test.js') && !GUARD_FILES.has(n)).sort()) {
    const src = fs.readFileSync(path.join(TEST_DIR, f), 'utf8');
    if (/\?\s*200\s*:\s*500\b/.test(src)) {
      offenders.push(`${f}: derives a status from the response body (\`? 200 : 500\`), so an empty response reads as an HTTP 500 the stack never sent (row 263)`);
    }
    if (/%\{http_code\}|__STATUS__/.test(src)) {
      offenders.push(`${f}: formats or parses curl's status marker itself — that belongs to test/helpers/stackHttp.js (ADR §6)`);
    }
  }
  for (const n of NINE) {
    const src = F.readSafe(path.join(TEST_DIR, `${n}.test.js`)) || '';
    if (!/require\(\s*['"]\.\/helpers\/stackHttp(\.js)?['"]\s*\)/.test(src)) offenders.push(`${n}.test.js: does not use the shared helper (require('./helpers/stackHttp'))`);
  }
  assert(offenders.length === 0, `stack HTTP must go through one honest helper (ADR §6); offenders:\n      - ${offenders.join('\n      - ')}`);
});

test('C10 (AC-3): operational-direction H1 fails when nothing answers, instead of passing', () => {
  const src = fs.readFileSync(path.join(TEST_DIR, 'operational-direction.test.js'), 'utf8');
  const start = src.indexOf("test('H1:");
  assert(start !== -1, "operational-direction.test.js: test('H1: … not found — re-aim this guard if H1 was renamed");
  const next = src.indexOf('\ntest(', start + 1);
  const body = src.slice(start, next === -1 ? undefined : next);
  assert(/noResponse|describeResponse/.test(body),
    `H1 must fail when the stack gives no response. Today it asserts \`out.trim() !== '404'\`, which curl's 000 satisfies, so nothing answering PASSES. H1: ${short(body, 300)}`);
  assert(!/%\{http_code\}/.test(body), "H1 must not parse curl's status itself (ADR §6)");
});

/* ═══ AC-4 — the numbers add up, and skips are visible ═════════════════════════ */

test('D1 (AC-4): the totals equal the sums of the per-suite counts, and every per-suite result line shows passed, failed and skipped counts', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    const r = F.runEngineSync(sc, [
      sc.suite('pass.test.js'), sc.suite('mixed.test.js'), sc.suite('skip-only.test.js', 'fixture skip note'), sc.suite('fail.test.js'),
    ]);
    const { rec } = onlyRecord(sc, 'D1');
    const t = rec.totals || {};
    assert(t.passed === 5 && t.failed === 1 && t.skipped === 4,
      `the record's totals must be the per-suite sums (5 passed, 1 failed, 4 skipped); got ${JSON.stringify(t)}`);
    const m = F.lastLine(r.stdout).match(/(\d+) passed\D+(\d+) failed\D+(\d+) skipped/);
    assert(m && +m[1] === 5 && +m[2] === 1 && +m[3] === 4,
      `the verdict line must carry the same totals (5 passed, 1 failed, 4 skipped); got ${JSON.stringify(F.lastLine(r.stdout))}`);
    for (const [name, pass, fail, skipped] of [['pass', 2, 0, 0], ['mixed', 2, 0, 1], ['skip-only', 0, 0, 3], ['fail', 1, 1, 0]]) {
      const got = resultLines(r.stdout, name);
      assert(got.length >= 1, `no per-suite result line ([i/N] ${name}: …) in the output`);
      const c = countsOf(got[got.length - 1]);
      assert(c && c.pass === pass && c.fail === fail && c.skipped === skipped,
        `${name}'s result line must show "${pass} passed, ${fail} failed, ${skipped} skipped"; got ${JSON.stringify(got[got.length - 1])}`);
    }
  } finally { sc.cleanup(); }
});

test('D2 (AC-4): the verdict line states the skipped total — a green run with skipped tests reads differently from a green run without', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    const clean = F.runEngineSync(sc, [sc.suite('pass.test.js')]);
    assert(/^Overall: PASS\b.*\b0 skipped\b/.test(F.lastLine(clean.stdout)),
      `a run with nothing skipped must say so on its verdict line ("0 skipped"); got ${JSON.stringify(F.lastLine(clean.stdout))}`);
    const skippy = F.runEngineSync(sc, [sc.suite('pass.test.js'), sc.suite('skip-only.test.js')]);
    assert(/^Overall: PASS\b.*\b3 skipped\b/.test(F.lastLine(skippy.stdout)),
      `a green run whose live tests skipped must say so on its verdict line ("3 skipped"); got ${JSON.stringify(F.lastLine(skippy.stdout))}`);
    assert(/^Total skipped:\s*3\s*$/m.test(skippy.stdout), 'the summary must also print `Total skipped: 3`');
  } finally { sc.cleanup(); }
});

test('D3 (AC-4): a suite whose tests all skipped reads SKIP and never flips the verdict; a suite that failed while skipping reads FAIL with its skip count', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    const skipOnly = F.runEngineSync(sc, [sc.suite('skip-only.test.js')]);
    assert(skipOnly.status === 0 && /^Overall: PASS\b/.test(F.lastLine(skipOnly.stdout)),
      `skips never fail the gate — a skip-only registry must exit 0 with Overall: PASS; got exit ${skipOnly.status}, ${JSON.stringify(F.lastLine(skipOnly.stdout))}`);
    const s = resultLines(skipOnly.stdout, 'skip-only');
    assert(s.length >= 1 && s.every((l) => /\bSKIP\b/.test(l)), `a suite whose tests all skipped must read SKIP; got ${JSON.stringify(s)}`);
    const failSkip = F.runEngineSync(sc, [sc.suite('fail-with-skips.test.js')]);
    const f = resultLines(failSkip.stdout, 'fail-with-skips');
    assert(f.length >= 1 && f.every((l) => /\bFAIL\b/.test(l) && !/\bSKIP\b/.test(l)) && f.some((l) => /\b2 skipped\b/.test(l)),
      `a suite that failed while also skipping must read FAIL with "2 skipped" — a skip must never mask a failure; got ${JSON.stringify(f)}`);
    assert(failSkip.status === 1, `and the gate must fail (exit 1); got ${failSkip.status}`);
  } finally { sc.cleanup(); }
});

/* ═══ AC-5 — progress is visible while it runs ═════════════════════════════════ */

async function progressCase(mode) {
  F.need('runner');
  const sc = F.scenario();
  try {
    const marker = path.join(sc.dir, 'finished-at');
    const e = F.startEngine(sc, [sc.suite('marked-noisy.test.js'), sc.suite('blocking.test.js')], {
      label: `progress-${mode}`,
      stdoutTo: mode === 'file' ? path.join(sc.dir, 'stdout.log') : 'pipe',
      extraEnv: { GATE_FIXTURE_MARKER: marker },
    });
    const seenAt = await e.firstMatch(/\[1\/2\][^\n]*marked-noisy[^\n]*\bPASS\b/, 30000);
    await e.exited;
    const finishedAt = Number(F.readSafe(marker));
    assert(Number.isFinite(finishedAt) && finishedAt > 0, 'precondition: the first suite ran and marked when it finished');
    assert(seenAt !== null, `the first suite's result line ([1/2] marked-noisy … PASS) never appeared in the ${mode} output`);
    const lag = seenAt - finishedAt;
    assert(lag <= 5000,
      `a finished suite's result line must be readable within 5 s (AC-5); going to a ${mode}, it appeared ${lag} ms after the suite finished, while the next suite blocked the event loop. Output is being held back (Node writes pipes asynchronously on macOS; ADR §1 makes stdout blocking)`);
  } finally { sc.cleanup(); }
}

test('E1 (AC-5): with stdout going to a pipe and the next suite blocking the event loop, a finished suite\'s result line arrives within 5 s', () => progressCase('pipe'));

test('E2 (AC-5): the same with stdout going to a file', () => progressCase('file'));

/* ═══ AC-6 — everyone reads it the same way ═════════════════════════════════════ */

const README = 'engineering-team/README.md';
const DOC_SITES = [
  'engineering-team/roles/implementer.md',
  'engineering-team/roles/reviewer.md',
  'engineering-team/roles/tester.md',
  'engineering-team/roles/director.md',
  'engineering-team/workflows/3-test-design.md',
  'engineering-team/workflows/4-implementation.md',
  'engineering-team/workflows/5-review.md',
  'engineering-team/workflows/6-book-close.md',
  'engineering-team/workflows/light-profile.md',
  'engineering-team/workflows/protocol-spec-workflow.md',
  'engineering-team/templates/review-checklist.md',
  'engineering-team/templates/test-plan.md',
  'engineering-team/templates/build-audit.md',
  '.claude/agents/implementer.md',
  '.claude/agents/reviewer.md',
  '.claude/agents/tester.md',
  '.claude/agents/gate-judge.md',
  '.claude/commands/implement-feature.md',
  '.claude/commands/review-changes.md',
  '.claude/skills/direct-feature/SKILL.md',
];

test('F1 (AC-6): engineering-team/README.md carries the one recipe — "Running and reading the test gate": read with npm run gate:status, tag with GATE_LABEL, never trust a background notice or a piped status', () => {
  const src = fs.readFileSync(path.join(F.REPO, README), 'utf8');
  const h = src.match(/^(#{2,4})\s+Running and reading the test gate\s*$/m);
  assert(h, `${README} must have a "Running and reading the test gate" section (ADR §7)`);
  const rest = src.slice(h.index + h[0].length);
  const end = rest.search(new RegExp(`^#{1,${h[1].length}}\\s`, 'm'));
  const body = end === -1 ? rest : rest.slice(0, end);
  const missing = [];
  if (!/npm run gate:status/.test(body)) missing.push('`npm run gate:status` as the way to read the result');
  if (!/GATE_LABEL/.test(body)) missing.push('`GATE_LABEL` for tagging a run when others may be running');
  if (!/background/i.test(body)) missing.push('never trusting a background-completion notice');
  if (!/pipe|PIPESTATUS|\$\?/i.test(body)) missing.push('never trusting a piped exit status');
  assert(missing.length === 0, `the recipe section must cover: ${missing.join('; ')}`);
});

test('F2 (AC-6): every doc that tells a role to run or read the gate points at that recipe, and none carries the zsh-broken PIPESTATUS workaround', () => {
  const offenders = [];
  for (const rel of DOC_SITES) {
    const src = F.readSafe(path.join(F.REPO, rel));
    if (src === null) { offenders.push(`${rel}: missing`); continue; }
    if (!/Running and reading the test gate|README\.md#running-and-reading-the-test-gate/.test(src)) {
      offenders.push(`${rel}: does not point at the README recipe ("Running and reading the test gate")`);
    }
    if (/PIPESTATUS/.test(src)) offenders.push(`${rel}: carries the PIPESTATUS workaround, which yields nothing in zsh (row 111)`);
  }
  assert(offenders.length === 0, `every run-or-read site must point at one recipe (ADR §7); offenders:\n      - ${offenders.join('\n      - ')}`);
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- gate result record tests (epic honest-test-gate, Story 1) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      if (err && err.skipped) { console.log(`  SKIP  ${name} (${err.message})`); skipped++; continue; }
      console.log(`  FAIL  ${name}\n        ${err && err.message}`);
      failures.push({ name, message: err && err.message });
      fail++;
    }
  }
  console.log(`\ngate-result-record: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
