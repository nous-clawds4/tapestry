'use strict';
/**
 * The gate engine — honest-test-gate #1, ADR honest-test-gate/0001 §1.
 *
 * runGate({ suites, recordDir, label }) runs an ordered registry of suites and reports
 * the run truthfully, however it was launched or ended:
 *
 *   - A run record (gateRecord.js) is written before the first suite, rewritten after
 *     every suite, and finished with the verdict and exit code the process exits with.
 *   - Every suite is loaded before any runs (ADR Decision, "Load order"), each load
 *     guarded, then run in isolation: a throw, a load failure, a process.exit call or
 *     missing result counts is that suite's FAIL, never the end of the run. Escaped
 *     async errors are recorded and fail the run instead of crashing it.
 *   - stdout/stderr are set blocking. Node writes pipes asynchronously on macOS and
 *     process.exit then drops whatever is still queued, so without this a piped run can
 *     lose its own verdict line. A reader that goes away (EPIPE) stops the output, not
 *     the run.
 *   - SIGINT/SIGTERM/SIGHUP record INTERRUPTED with the progress so far and exit
 *     128 + signal number. A SIGKILLed run stays "running"; the reader reports it as
 *     unfinished once its process is gone.
 *   - Every total is summed from the one results array.
 *
 * suites: [{ file, skipNote? }], file resolved against test/; or a pseudo-entry
 * { name, run } (the config smoke check). skipNote is the reason printed when the whole
 * suite skipped.
 */

const path = require('path');
const R = require('./gateRecord');

const TEST_DIR = path.resolve(__dirname, '..');
const SIGNALS = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 };

function nameOf(entry) {
  if (entry.name) return entry.name;
  return path.basename(String(entry.file)).replace(/\.test\.js$/, '').replace(/\.js$/, '');
}

function errorText(err) { return String((err && err.message) || err); }

function brief(v) {
  try {
    const s = JSON.stringify(v);
    return s === undefined ? String(v) : s.slice(0, 80);
  } catch { return String(v); }
}

function normalize(res) {
  if (!res || typeof res.pass !== 'number' || typeof res.fail !== 'number') {
    return { pass: 0, fail: 1, skipped: 0, error: `returned no result counts (got ${brief(res)})` };
  }
  return { pass: res.pass, fail: res.fail, skipped: typeof res.skipped === 'number' ? res.skipped : 0, failures: res.failures };
}

function verdictOf(r) {
  if (r.fail > 0 || r.error) return 'FAIL';
  if (r.pass + r.fail === 0 && r.skipped > 0) return 'SKIP';
  return 'PASS';
}

function counts(r) { return `(${r.pass} passed, ${r.fail} failed, ${r.skipped} skipped)`; }

async function runGate({ suites, recordDir, label } = {}) {
  if (!Array.isArray(suites)) throw new TypeError('runGate: suites must be an array of { file, skipNote? } entries');

  // The engine's own exits (the signal path and the final verdict) must bypass the
  // per-suite process.exit trap below.
  const realExit = process.exit.bind(process);
  const h = R.createRecord({ dir: R.recordDir(recordDir), label: label || process.env.GATE_LABEL, total: suites.length });
  const shown = h.file.startsWith(`${R.REPO}${path.sep}`) ? path.relative(R.REPO, h.file) : h.file;

  for (const stream of [process.stdout, process.stderr]) {
    if (stream._handle && typeof stream._handle.setBlocking === 'function') stream._handle.setBlocking(true);
  }
  let stdoutGone = false;
  process.stdout.on('error', (e) => { if (e && e.code === 'EPIPE') stdoutGone = true; });
  process.stderr.on('error', () => { /* stderr must never take the run down */ });
  const say = (line) => {
    if (stdoutGone) return;
    try { process.stdout.write(`${line}\n`); } catch { stdoutGone = true; }
  };

  say(`Gate run ${h.rec.runId} — record: ${shown}`);

  let current = null;
  const stray = (err) => {
    h.rec.strayErrors.push({ during: current, message: R.clip((err && err.stack) || err) });
    try { R.updateRecord(h, {}); } catch { /* best effort */ }
  };
  process.on('unhandledRejection', stray);
  process.on('uncaughtException', stray);

  let settled = false;
  for (const [signal, signo] of Object.entries(SIGNALS)) {
    process.on(signal, () => {
      if (settled) return;
      settled = true;
      const exitCode = 128 + signo;
      try { R.interruptRecord(h, { signal, exitCode }); } catch { /* best effort */ }
      say(`Overall: INTERRUPTED — ${signal} after ${h.rec.progress.completed}/${suites.length} suites · record ${shown}`);
      realExit(exitCode);
    });
  }

  const loaded = suites.map((entry) => {
    if (typeof entry.run === 'function') return { entry, mod: { run: entry.run } };
    try {
      return { entry, mod: require(path.resolve(TEST_DIR, entry.file)) };
    } catch (e) {
      return { entry, loadError: `failed to load: ${errorText(e)}` };
    }
  });

  const results = [];
  for (let i = 0; i < loaded.length; i++) {
    const { entry, mod, loadError } = loaded[i];
    const name = nameOf(entry);
    const tag = `[${i + 1}/${loaded.length}]`;
    current = name;
    h.rec.progress.current = name;
    say(`▶ ${tag} ${name}`);
    const started = Date.now();
    let r;
    if (loadError) {
      r = { pass: 0, fail: 1, skipped: 0, error: loadError };
    } else if (!mod || typeof mod.run !== 'function') {
      r = { pass: 0, fail: 1, skipped: 0, error: 'exports no run() function' };
    } else {
      process.exit = (code) => { throw new Error(`called process.exit(${code === undefined ? '' : code}) — a suite may not end the run`); };
      try {
        r = normalize(await mod.run());
      } catch (err) {
        r = { pass: 0, fail: 1, skipped: 0, error: errorText(err) };
      } finally {
        process.exit = realExit;
      }
    }
    Object.assign(r, { name, file: entry.file || name, ms: Date.now() - started, skipNote: entry.skipNote });
    r.verdict = verdictOf(r);
    results.push(r);
    say(`  ${tag} ${name}: ${r.verdict} ${counts(r)} ${r.ms}ms${r.error ? ` — ${r.error}` : ''}`);
    h.rec.progress.completed = i + 1;
    R.updateRecord(h, {
      suites: results.map((x) => ({
        file: x.file, verdict: x.verdict, pass: x.pass, fail: x.fail, skipped: x.skipped, ms: x.ms,
        error: x.error ? R.clip(x.error) : null, failures: R.clipFailures(x.failures),
      })),
    });
  }
  current = null;
  // One macrotask, so an escaped rejection from the last suite lands before the verdict.
  await new Promise((resolve) => setTimeout(resolve, 0));

  const totals = results.reduce(
    (t, x) => ({ passed: t.passed + x.pass, failed: t.failed + x.fail, skipped: t.skipped + x.skipped }),
    { passed: 0, failed: 0, skipped: 0 },
  );
  say('\nTest Results');
  say('-------------');
  for (const x of results) {
    const shape = x.verdict === 'SKIP' ? `SKIP (${x.skipped} tests${x.skipNote ? `; ${x.skipNote}` : ''})` : `${x.verdict} ${counts(x)}`;
    say(`${x.name}: ${shape}`);
  }
  const failed = results.filter((x) => x.verdict === 'FAIL').map((x) => x.name);
  if (h.rec.strayErrors.length) {
    const what = h.rec.strayErrors.map((s) => `during ${s.during || 'the runner'}: ${String(s.message).split('\n')[0]}`).join('; ');
    say(`stray async errors: FAIL (${h.rec.strayErrors.length}) — ${what}`);
    failed.push('stray async errors');
  }
  if (failed.length) say(`Failed suites: ${failed.join(', ')}`);
  say(`Total skipped: ${totals.skipped}`);

  const verdict = failed.length ? 'FAIL' : 'PASS';
  const exitCode = failed.length ? 1 : 0;
  settled = true;
  R.finishRecord(h, {
    verdict,
    exitCode,
    totals: {
      ...totals,
      suitesPassed: results.filter((x) => x.verdict === 'PASS').length,
      suitesFailed: failed.length,
      suitesSkipped: results.filter((x) => x.verdict === 'SKIP').length,
    },
  });
  say(`Overall: ${verdict} — ${totals.passed} passed, ${totals.failed} failed, ${totals.skipped} skipped across ${results.length} suites · record ${shown}`);
  realExit(exitCode);
}

module.exports = { runGate };
