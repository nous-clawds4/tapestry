'use strict';
/**
 * Tests for Story 4 (epic tagging-edges) — the strict relay count the drift route counts relay taggings through.
 *
 * Story: engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md — AC-4 ("Unknown, never 0": a count that
 *        fails, or takes longer than 10 seconds, reads "unknown", never 0; "Reads only").
 * ADR:   engineering-team/decisions/tagging-edges/0004-tagging-pipeline-panel.md — § Context ("There is no strict relay
 *        count": `strfry scan --count` prints one number and exits 0, its stderr is never empty), § Sub-decisions
 *        ("The relay count" (a)), § Server (`countStrict(filter, { timeoutMs = 10000, spawnImpl } = {})`), and
 *        § Seams for Test Design ("countStrict is tested through a fake strfry placed first on PATH
 *        (test/strfry-scan-strict.test.js:117-190), extended to record $3").
 *
 * Unit under test: `countStrict(filter, { timeoutMs, spawnImpl })` from src/lib/strfryScanStrict.js → a JS number, or a
 * rejection with `ScanError { code, message, stderrTail }` whose code is one of filter-too-large, spawn, process-error,
 * timeout, exit, signal, unparseable — each of which src/lib/tagging-edges/realtime.js's allowErrorCode passes
 * unchanged. A count that is not exactly one line `/^\d+\n$/` holding a safe integer is `unparseable`, never 0 and never
 * a guess. Stderr on a clean exit is never a failure on its own. `scanStrict` itself is not changed (SC20 smoke).
 *
 * How: a FAKE `strfry` — a throwaway shell script put first on PATH, as in test/strfry-scan-strict.test.js — records
 * its argument count (one line per run), `$1`, `$2`, `$3` and its pid (first, so a time-out cannot beat it); writes
 * prepared stderr; prints prepared stdout parts (a 0.3 s pause between parts, so each is its own pipe write); then
 * exits with a code, kills itself with SIGTERM ('signal'), or hangs ('hang': ignores SIGTERM, execs `sleep 30`, which
 * keeps the pid, so only SIGKILL stops it). The script lives in one mkdtemp directory per run, each test's stage in
 * its own; PATH and FAKE_STRFRY_STAGE are restored after every test and a 'hang' fake still alive is SIGKILLed.
 * No stack, relay, graph or network. SC21 waits out the 10 s default time-out, so the suite takes about 20 s.
 *
 * Intentionally failing until countStrict lands (red phase). The module is require()d LAZILY inside each test through
 * load(), which names what is missing, so the suite always loads. Fixture pubkeys are fake 64-hex values from
 * test/helpers/taggingEdgesFixtures.js — never a deployment's TA and never the ADR 0015 literal. Node 16 and 22.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { Z, idOf } = require('./helpers/taggingEdgesFixtures');

const MODULE_REQUIRE = '../src/lib/strfryScanStrict';
const REALTIME_REQUIRE = '../src/lib/tagging-edges/realtime';
const NL = '\n';
const ALLOWED_CODES = Object.freeze(['filter-too-large', 'spawn', 'process-error', 'timeout', 'exit', 'signal', 'unparseable']);

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const show = (v) => { try { return JSON.stringify(v); } catch { return String(v); } };
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
function same(actual, expected, label) {
  const a = show(actual); const e = show(expected);
  if (a !== e) throw new Error(`${label}\n        expected: ${e}\n        actual:   ${a}`);
}
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

/** Lazily load the module; with `needCount`, fail by name while countStrict is missing (red phase). */
function load({ needCount = true } = {}) {
  let mod;
  try { mod = require(MODULE_REQUIRE); }
  catch (e) {
    throw new Error(`src/lib/strfryScanStrict.js could not be loaded (require('${MODULE_REQUIRE}') failed: ${String(e.message).split(NL)[0]})`);
  }
  if (needCount) {
    assert(mod && typeof mod.countStrict === 'function',
      `src/lib/strfryScanStrict.js not implemented yet: it does not export countStrict(filter, { timeoutMs = 10000, spawnImpl }) (ADR 0004 § Server); its exports are ${show(mod && Object.keys(mod))}`);
  }
  return mod;
}
function loadRealtime() {
  try { return require(REALTIME_REQUIRE); }
  catch (e) { throw new Error(`src/lib/tagging-edges/realtime.js could not be loaded: ${String(e.message).split(NL)[0]}`); }
}

// ─── fixtures ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The drift route's filter (ADR 0004 § Server → "The relay count"): kind 39999 over both nostr-user-tag stamps. */
const FILTER = Object.freeze({ kinds: [39999], '#z': [Z.canonicalTagging, Z.localTagging] });
/** A filter with `/` in a value, so the argv must carry escapeFilterArgv's `\/` form, not plain JSON. */
const SLASH_FILTER = Object.freeze({ kinds: [39999], '#z': [Z.canonicalTagging], '#d': ['a/b/c', 'http://x/y'] });
/** Strfry's usual stderr on a good count: loguru lines and the Redis connect (ADR 0004 § Context). */
const NOISY_STDERR = [
  '2026-09-30 12:00:00.000 (   0) INFO| arguments: strfry scan --count ...',
  '2026-09-30 12:00:00.001 (   0) INFO| Compiled with: NEGENTROPY RECONCILIATION',
  '2026-09-30 12:00:00.002 (   0) INFO| connected to redis:6379',
  '2026-09-30 12:00:00.003 (   0) WARN| config: something optional was not set',
  '',
].join(NL);

// ─── the fake strfry ─────────────────────────────────────────────────────────────────────────────────────────────
const FAKE_SCRIPT = String.raw`#!/bin/sh
# Fake strfry for test/strfry-count-strict.test.js (ADR tagging-edges/0004, Seams for Test Design -> countStrict).
D="$FAKE_STRFRY_STAGE"
if [ -z "$D" ] || [ ! -d "$D" ]; then echo 'fake strfry: FAKE_STRFRY_STAGE is not set' >&2; exit 97; fi
printf '%s\n' "$#" >> "$D/calls"
printf '%s' "$1" > "$D/arg1"
printf '%s' "$2" > "$D/arg2"
printf '%s' "$3" > "$D/arg3"
printf '%s' "$$" > "$D/pid"
if [ -f "$D/err" ]; then cat "$D/err" >&2; fi
i=0
while [ -f "$D/out.$i" ]; do
  if [ "$i" -gt 0 ]; then sleep 0.3; fi
  cat "$D/out.$i"
  i=$((i + 1))
done
finish=$(cat "$D/finish")
case "$finish" in
  hang) trap '' TERM; exec sleep 30 ;;
  signal) kill -TERM "$$"; sleep 5; exit 0 ;;
  *) exit "$finish" ;;
esac
`;

let fakeBin = null;
function fakeBinDir() {
  if (!fakeBin) {
    fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'strfry-count-strict-bin-'));
    fs.writeFileSync(path.join(fakeBin, 'strfry'), FAKE_SCRIPT, { mode: 0o755 });
  }
  return fakeBin;
}
function removeFakeBin() {
  if (fakeBin) { fs.rmSync(fakeBin, { recursive: true, force: true }); fakeBin = null; }
}

/** Fake configs: `{ parts, stderr, finish }`, or `{ absent: true }` (no strfry on PATH). */
const count = (stdout, extra = {}) => ({ parts: stdout === '' ? [] : [stdout], finish: 0, ...extra });

async function withFake(config, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strfry-count-strict-'));
  if (!config.absent) {
    (config.parts || []).forEach((p, i) => fs.writeFileSync(path.join(dir, `out.${i}`), p));
    if (config.stderr != null) fs.writeFileSync(path.join(dir, 'err'), config.stderr);
    fs.writeFileSync(path.join(dir, 'finish'), String(config.finish === undefined ? 0 : config.finish));
  }
  const fake = {
    dir,
    invocations: () => { const t = safeRead(path.join(dir, 'calls')); return t === null ? [] : t.split(NL).filter(Boolean).map(Number); },
    arg1: () => safeRead(path.join(dir, 'arg1')),
    arg2: () => safeRead(path.join(dir, 'arg2')),
    arg3: () => safeRead(path.join(dir, 'arg3')),
    pid: () => { const t = safeRead(path.join(dir, 'pid')); return t ? Number(t) : null; },
  };
  const saved = { PATH: process.env.PATH, FAKE_STRFRY_STAGE: process.env.FAKE_STRFRY_STAGE };
  process.env.PATH = config.absent ? dir : `${fakeBinDir()}${path.delimiter}${saved.PATH || ''}`;
  process.env.FAKE_STRFRY_STAGE = dir;
  try { return await fn(fake); }
  finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    // Only a 'hang' fake can still be alive; any other finished on its own, so its pid may since have been reused.
    const pid = config.finish === 'hang' ? fake.pid() : null;
    if (pid) { try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Call countStrict and settle it: `{ value }`, `{ error }`, `{ threw }`, `{ notPromise }` or 'HUNG'. */
async function countWith(mod, filter, options, ms = 10000) {
  let p;
  try { p = mod.countStrict(filter, options); }
  catch (e) { return { threw: e }; }
  if (!p || typeof p.then !== 'function') return { notPromise: p };
  let timer;
  const hung = new Promise((r) => { timer = setTimeout(() => r('HUNG'), ms); });
  try { return await Promise.race([p.then((value) => ({ value }), (error) => ({ error })), hung]); }
  finally { clearTimeout(timer); }
}
function describe(out) {
  if (out === 'HUNG') return 'no answer at all (the promise was still pending)';
  if (out.threw) return `a synchronous throw out of countStrict: ${show(out.threw && out.threw.message)}`;
  if ('notPromise' in out) return `a non-promise return value ${show(out.notPromise)}`;
  if ('value' in out) return `a resolution with ${show(out.value)} (${typeof out.value})`;
  const e = out.error;
  return `a rejection with code ${show(e && e.code)} and message ${show(e && e.message)}`;
}
function resolvedWith(out, expected, label) {
  assert(out !== 'HUNG' && out && 'value' in out, `${label}: expected countStrict to resolve with ${expected}; got ${describe(out)}`);
  assert(typeof out.value === 'number', `${label}: the count must be a JS number (ADR 0004 § Server: "Resolves with a JS number"); got ${show(out.value)} of type ${typeof out.value}`);
  eq(out.value, expected, `${label}: the count`);
  return out.value;
}
/** A rejection with a ScanError carrying `code` (or one of `code` when an array), whose code allowErrorCode keeps. */
function rejectedWith(mod, out, code, label) {
  const codes = Array.isArray(code) ? code : [code];
  const want = codes.map((c) => `'${c}'`).join(' or ');
  assert(out !== 'HUNG' && out && 'error' in out, `${label}: expected countStrict to reject with ScanError code ${want}; got ${describe(out)}`);
  const e = out.error;
  assert(e instanceof Error, `${label}: the rejection should be an Error (a ScanError); got ${show(e)}`);
  assert(typeof mod.ScanError === 'function' && e instanceof mod.ScanError,
    `${label}: the rejection should be an instance of the exported ScanError; got ${e && e.constructor && e.constructor.name}`);
  assert(codes.includes(e.code), `${label}: expected ScanError code ${want}; got code ${show(e.code)} (message: ${show(e.message)})`);
  assert(typeof e.message === 'string' && e.message.trim().length > 0, `${label}: the ScanError should carry a message; got ${show(e.message)}`);
  const { allowErrorCode } = loadRealtime();
  eq(allowErrorCode(e.code), e.code, `${label}: allowErrorCode (src/lib/tagging-edges/realtime.js) must pass the code unchanged`);
  return e;
}

async function waitGone(pid, ms) {
  const deadline = Date.now() + ms;
  for (;;) {
    try { process.kill(pid, 0); } catch (e) { if (e.code === 'ESRCH') return true; }
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** A child-process stand-in for spawnImpl: an EventEmitter with stdout/stderr streams and a kill() recorder. */
function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kills = [];
  child.kill = (sig) => { child.kills.push(sig); return true; };
  return child;
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// ─── the export ──────────────────────────────────────────────────────────────────────────────────────────────────

test('SC1: countStrict is exported beside scanStrict, ScanError, redactPublicText and escapeFilterArgv, which stay exported as they were [AC-4; ADR 0004 § Server]', async () => {
  const mod = load({ needCount: false });
  for (const name of ['scanStrict', 'ScanError', 'redactPublicText', 'escapeFilterArgv']) {
    assert(typeof mod[name] === 'function', `src/lib/strfryScanStrict.js must still export ${name} (ADR 0004 § Server: "exported beside the existing four"); exports are ${show(Object.keys(mod))}`);
  }
  eq(mod.escapeFilterArgv, loadRealtime().escapeFilterArgv, 'escapeFilterArgv is still the planner\'s own function, re-exported');
  load();
});

// ─── a good count ────────────────────────────────────────────────────────────────────────────────────────────────

test('SC2: the filter reaches strfry as exactly `strfry scan --count <escapeFilterArgv(filter)>`, in one run [AC-4; ADR 0004 § Server → What it spawns]', async () => {
  const mod = load();
  for (const [label, filter] of [['the drift filter', FILTER], ['a filter with "/" in its values', SLASH_FILTER]]) {
    const seen = await withFake(count('7030\n'), async (fake) => ({
      out: await countWith(mod, filter, {}),
      invocations: fake.invocations(), arg1: fake.arg1(), arg2: fake.arg2(), arg3: fake.arg3(),
    }));
    resolvedWith(seen.out, 7030, label);
    same(seen.invocations, [3], `${label}: strfry runs once, with three arguments (argument count of each run)`);
    eq(seen.arg1, 'scan', `${label}: strfry's first argument`);
    eq(seen.arg2, '--count', `${label}: strfry's second argument`);
    eq(seen.arg3, mod.escapeFilterArgv(filter), `${label}: strfry's third argument is escapeFilterArgv(filter) exactly (every "/" written "\\/")`);
  }
});

test('SC3: stdout "7030\\n" on exit 0 resolves with the JS number 7030, although strfry wrote log lines, the Redis connect, and even error-looking lines to stderr [AC-4; ADR 0004 § Server → Stderr ("never a failure signal on its own"), Resolves]', async () => {
  const mod = load();
  const out = await withFake(count('7030\n', { stderr: NOISY_STDERR }), () => countWith(mod, FILTER, {}));
  resolvedWith(out, 7030, 'stdout "7030\\n", noisy stderr, exit 0');
  const errorish = `${NOISY_STDERR}2026-09-30 12:00:00.004 (   0) ERR| redis: connection reset, retrying\nstrfry error: a non-fatal complaint\n`;
  const out2 = await withFake(count('7030\n', { stderr: errorish }), () => countWith(mod, FILTER, {}));
  resolvedWith(out2, 7030, 'error-looking stderr on exit 0 is not a failure (ADR 0004 § Server → Stderr)');
});

test('SC4: a real zero ("0\\n") resolves 0, and the largest safe integer resolves exactly — the only answers that are numbers are well-formed ones [AC-4; ADR 0004 § Server → unparseable]', async () => {
  const mod = load();
  const zero = await withFake(count('0\n', { stderr: NOISY_STDERR }), () => countWith(mod, FILTER, {}));
  resolvedWith(zero, 0, 'stdout "0\\n", exit 0');
  const max = String(Number.MAX_SAFE_INTEGER);
  const big = await withFake(count(`${max}\n`), () => countWith(mod, FILTER, {}));
  resolvedWith(big, Number.MAX_SAFE_INTEGER, `stdout "${max}\\n" (Number.MAX_SAFE_INTEGER), exit 0`);
});

test('SC5: a count that arrives in two pipe writes ("70", then "30\\n") resolves 7030 — the answer is judged on the whole stdout [AC-4; ADR 0004 § Server]', async () => {
  const mod = load();
  const out = await withFake({ parts: ['70', '30\n'], finish: 0 }, () => countWith(mod, FILTER, {}));
  resolvedWith(out, 7030, 'stdout "70" + "30\\n" in two writes, exit 0');
});

test('SC6: an injected spawnImpl is how countStrict starts strfry — called once, with "strfry" and [scan, --count, <argv>] [AC-4; ADR 0004 § Server]', async () => {
  const mod = load();
  const calls = [];
  const spawnImpl = (...args) => { calls.push(args); return childProcess.spawn(...args); };
  const seen = await withFake(count('12\n'), async (fake) => ({
    out: await countWith(mod, FILTER, { spawnImpl }), invocations: fake.invocations(),
  }));
  resolvedWith(seen.out, 12, 'stdout "12\\n" through a spawnImpl that forwards to child_process.spawn');
  eq(calls.length, 1, 'spawnImpl calls for one count');
  eq(calls[0][0], 'strfry', 'spawnImpl\'s command');
  same(calls[0][1], ['scan', '--count', mod.escapeFilterArgv(FILTER)], 'spawnImpl\'s argument list');
  same(seen.invocations, [3], 'strfry runs once, and only through spawnImpl (argument count of each run)');
});

// ─── output that is not one safe integer ─────────────────────────────────────────────────────────────────────────

test('SC7: stdout that is not exactly one line /^\\d+\\n$/ rejects "unparseable" — a lone newline or whitespace (which Number() reads as 0), a sign, exponent or hex notation, a leading space, a trailing blank line or CRLF, no final newline, "12a\\n", an empty stdout, two lines — never 0 and never a partial number [AC-4 Unknown, never 0; ADR 0004 § Server → unparseable]', async () => {
  const mod = load();
  const cases = [
    // The "never 0" cases first: Number('\n') and Number(' \n') are both 0, so a Number()-based parser counts them 0.
    ['a lone newline', '\n'],
    ['whitespace only', ' \n'],
    ['a leading space', ' 7030\n'],
    ['a negative number', '-5\n'],
    ['a plus sign', '+5\n'],
    ['exponent notation', '1e3\n'],
    ['hex notation', '0x1F\n'],
    ['a trailing blank line', '7030\n\n'],
    ['a CRLF ending', '7030\r\n'],
    ['a number with no final newline', '7030'],
    ['a number with trailing letters', '12a\n'],
    ['an empty stdout on exit 0', ''],
    ['two numbers on two lines', '7030\n9\n'],
  ];
  const wrong = [];
  for (const [label, stdout] of cases) {
    const out = await withFake(count(stdout, { stderr: NOISY_STDERR }), () => countWith(mod, FILTER, {}));
    try { rejectedWith(mod, out, 'unparseable', `${label} (stdout ${show(stdout)}, exit 0)`); }
    catch (e) { wrong.push(e.message); }
  }
  assert(wrong.length === 0, wrong.join('\n        '));
});

test('SC8: a number beyond Number.MAX_SAFE_INTEGER rejects "unparseable", never a rounded count [AC-4; ADR 0004 § Server → "the number is a safe integer"]', async () => {
  const mod = load();
  const stdout = '9007199254740993\n';
  const out = await withFake(count(stdout), () => countWith(mod, FILTER, {}));
  rejectedWith(mod, out, 'unparseable', `stdout ${show(stdout)} (MAX_SAFE_INTEGER + 2), exit 0`);
});

// ─── a process that did not finish cleanly ───────────────────────────────────────────────────────────────────────

test('SC9: strfry exiting non-zero rejects "exit", even after it printed a well-formed count [AC-4; ADR 0004 § Server → exit]', async () => {
  const mod = load();
  const out = await withFake(count('7030\n', { finish: 1, stderr: NOISY_STDERR }), () => countWith(mod, FILTER, {}));
  rejectedWith(mod, out, 'exit', 'stdout "7030\\n", then exit 1');
});

test('SC10: a failed count\'s stderrTail is summarised as scanStrict does — the last "strfry error:" line, redacted (no host:port, no 64-hex run) [AC-4; ADR 0004 § Server → Stderr]', async () => {
  const mod = load();
  const secretish = idOf('sc10');
  // Two error lines, then a log line after them: the tail is the LAST "strfry error:" line alone, not the stderr's end.
  const stderr = `${NOISY_STDERR}strfry error: first failure\nstrfry error: could not reach redis:6379 for ${secretish}\n2026-09-30 12:00:01.000 (   0) INFO| exiting\n`;
  const out = await withFake(count('', { finish: 2, stderr }), () => countWith(mod, FILTER, {}));
  const e = rejectedWith(mod, out, 'exit', 'two "strfry error:" lines and a log line after them on stderr, exit 2');
  assert(typeof e.stderrTail === 'string', `stderrTail should be the summarised stderr text; got ${show(e.stderrTail)}`);
  // redactPublicText: redis:6379 → <host>, the 64-hex run cut to its first 8 characters.
  eq(e.stderrTail, `strfry error: could not reach <host> for ${secretish.slice(0, 8)}`,
    'stderrTail is the last "strfry error:" line, redacted (host:port → <host>, 64-hex run cut to 8)');
  assert(e.stderrTail.length <= 300, `stderrTail is at most 300 characters; got ${e.stderrTail.length}`);
});

test('SC11: a strfry that never finishes is SIGKILLed at timeoutMs and the count rejects "timeout" within a bound — its process is gone (checked by its pid file) [AC-4 10 s limit; ADR 0004 § Server → timeout]', async () => {
  const mod = load();
  const TIMEOUT = 600;
  const seen = await withFake(count('7030\n', { finish: 'hang' }), async (fake) => {
    const t0 = Date.now();
    const out = await countWith(mod, FILTER, { timeoutMs: TIMEOUT }, 6000);
    const elapsed = Date.now() - t0;
    const pid = fake.pid();
    const gone = pid ? await waitGone(pid, 3000) : null;
    return { out, elapsed, pid, gone };
  });
  rejectedWith(mod, seen.out, 'timeout', `a count printed, then no exit (timeoutMs ${TIMEOUT})`);
  assert(seen.elapsed >= TIMEOUT * 0.8, `the count gave up after ${seen.elapsed} ms, before its timeoutMs of ${TIMEOUT}`);
  assert(seen.elapsed < TIMEOUT + 2500, `the count ignored { timeoutMs: ${TIMEOUT} }: it rejected only after ${seen.elapsed} ms`);
  assert(seen.pid, 'fixture: the fake strfry should have recorded its pid before hanging');
  assert(seen.gone === true,
    `the timed-out strfry (pid ${seen.pid}) is still alive 3 s after the rejection: the time-out must SIGKILL it (this fake ignores SIGTERM)`);
});

test('SC12: strfry killed by a signal rejects "signal", even though it printed a well-formed count [AC-4; ADR 0004 § Server → signal]', async () => {
  const mod = load();
  const out = await withFake(count('7030\n', { finish: 'signal' }), () => countWith(mod, FILTER, {}));
  rejectedWith(mod, out, 'signal', 'stdout "7030\\n", then SIGTERM to itself');
});

// ─── refused before or at spawn ──────────────────────────────────────────────────────────────────────────────────

test('SC13: a filter over the argv limit is refused "filter-too-large" before any spawn — spawnImpl is never called [AC-4; ADR 0004 § Server → filter-too-large]', async () => {
  const mod = load();
  const { LIMITS, filterArgvBytes } = loadRealtime();
  const filter = { kinds: [39999], ids: Array.from({ length: 2000 }, (_, i) => idOf(`sc13:${i}`)) };
  assert(filterArgvBytes(filter) > LIMITS.argvFilterBytes,
    `fixture: the filter should be over ${LIMITS.argvFilterBytes} argv bytes; it is ${filterArgvBytes(filter)}`);
  let spawned = 0;
  const spawnImpl = (...args) => { spawned += 1; return childProcess.spawn(...args); };
  const seen = await withFake(count('1\n'), async (fake) => ({
    out: await countWith(mod, filter, { spawnImpl }), invocations: fake.invocations(),
  }));
  rejectedWith(mod, seen.out, 'filter-too-large', `a filter of ${filterArgvBytes(filter)} argv bytes`);
  eq(spawned, 0, 'spawnImpl calls (it must not have been called)');
  same(seen.invocations, [], 'strfry runs (it must not have started)');

  // The size is the ESCAPED argv's (filterArgvBytes / LIMITS, ADR 0004 § Server → Reuse), not the plain JSON's: a
  // filter of slashes fits as plain JSON but not once every "/" is written "\/".
  const slashy = { kinds: [39999], '#d': ['/'.repeat(60000)] };
  const plain = JSON.stringify(slashy).length;
  assert(plain <= LIMITS.argvFilterBytes && LIMITS.argvFilterBytes < filterArgvBytes(slashy),
    `fixture: the slash filter should be within ${LIMITS.argvFilterBytes} bytes as plain JSON (${plain}) and over it escaped (${filterArgvBytes(slashy)})`);
  let spawned2 = 0;
  const spawnImpl2 = () => { spawned2 += 1; return fakeChild(); };
  const out2 = await countWith(mod, slashy, { spawnImpl: spawnImpl2, timeoutMs: 1000 }, 3000);
  rejectedWith(mod, out2, 'filter-too-large',
    `a filter of ${plain} bytes as plain JSON and ${filterArgvBytes(slashy)} escaped argv bytes (measured escaped, as filterArgvBytes does)`);
  eq(spawned2, 0, 'spawnImpl calls for the slash filter (it must not have been called)');
});

test('SC14: a filter JSON cannot write is refused "spawn" before any spawn, and countStrict never throws [AC-4; ADR 0004 § Server → spawn]', async () => {
  const mod = load();
  const filter = { kinds: [39999] };
  filter.self = filter;
  let spawned = 0;
  const spawnImpl = () => { spawned += 1; return fakeChild(); };
  const out = await countWith(mod, filter, { spawnImpl }, 3000);
  rejectedWith(mod, out, 'spawn', 'a filter that refers to itself');
  eq(spawned, 0, 'spawnImpl calls (it must not have been called)');
});

test('SC15: a spawnImpl that throws rejects "spawn" — countStrict itself never throws [AC-4; ADR 0004 § Server → spawn]', async () => {
  const mod = load();
  const spawnImpl = () => { const e = new Error('spawn EAGAIN'); e.code = 'EAGAIN'; throw e; };
  const out = await countWith(mod, FILTER, { spawnImpl }, 3000);
  rejectedWith(mod, out, 'spawn', 'an injected spawnImpl that throws synchronously');
});

test('SC16: a spawnImpl that gives no child process rejects "spawn", never a count [AC-4; ADR 0004 § Server → "repeats scanStrict\'s closure rules", and scanStrict\'s header: "spawn: spawn() threw, gave no child process"]', async () => {
  const mod = load();
  const out = await countWith(mod, FILTER, { spawnImpl: () => null }, 3000);
  rejectedWith(mod, out, 'spawn', 'an injected spawnImpl that returns null');
});

test('SC17: strfry absent from PATH rejects "process-error" (Node reports ENOENT through the child\'s \'error\' event) — never 0 [AC-4 Unknown, never 0; ADR 0004 § Server → "repeats scanStrict\'s … error … checks", and scanStrict\'s header: "process-error: the child emitted \'error\' (strfry absent included)"]', async () => {
  const mod = load();
  const out = await withFake({ absent: true }, () => countWith(mod, FILTER, {}, 5000));
  rejectedWith(mod, out, 'process-error', 'no strfry on PATH');
});

test('SC18: a child that emits \'error\' rejects "process-error", even if it then printed a count and closed 0 [AC-4; ADR 0004 § Server → process-error]', async () => {
  const mod = load();
  const child = fakeChild();
  const pending = countWith(mod, FILTER, { spawnImpl: () => child, timeoutMs: 2000 }, 4000);
  await new Promise((r) => setImmediate(r));
  const err = new Error('spawn EACCES'); err.code = 'EACCES';
  child.emit('error', err);
  child.stdout.end('7030\n');
  child.stderr.end();
  await new Promise((r) => setImmediate(r));
  child.emit('close', 0, null);
  rejectedWith(mod, await pending, 'process-error', 'a child emitting error EACCES, then "7030\\n" and close(0)');
});

test('SC18b: a stdout that emits \'error\', or a child with no stdout at all, rejects "process-error" even on close(0) — never a count [AC-4; ADR 0004 § Server → "repeats scanStrict\'s closure rules", and scanStrict\'s header: "process-error: … had no stdout, or its stdout failed"]', async () => {
  const mod = load();
  const wrong = [];

  const child = fakeChild();
  const pending = countWith(mod, FILTER, { spawnImpl: () => child, timeoutMs: 2000 }, 4000);
  await new Promise((r) => setImmediate(r));
  if (child.stdout.listenerCount('error') === 0) {
    wrong.push('a failing stdout: countStrict attached no \'error\' listener to the child\'s stdout, so a stdout failure would be an uncaught error, not a "process-error" rejection');
  } else {
    child.stdout.emit('error', Object.assign(new Error('read EPIPE'), { code: 'EPIPE' }));
  }
  child.stdout.end('7030\n');
  child.stderr.end();
  await new Promise((r) => setImmediate(r));
  child.emit('close', 0, null);
  try { rejectedWith(mod, await pending, 'process-error', 'stdout emitting error EPIPE, then "7030\\n" and close(0)'); }
  catch (e) { wrong.push(e.message); }

  const bare = fakeChild();
  bare.stdout = null;
  const pending2 = countWith(mod, FILTER, { spawnImpl: () => bare, timeoutMs: 2000 }, 4000);
  await new Promise((r) => setImmediate(r));
  bare.stderr.end();
  await new Promise((r) => setImmediate(r));
  bare.emit('close', 0, null);
  try { rejectedWith(mod, await pending2, 'process-error', 'a child with no stdout, then close(0)'); }
  catch (e) { wrong.push(e.message); }

  assert(wrong.length === 0, wrong.join('\n        '));
});

// ─── every rejection is a code the status may carry ──────────────────────────────────────────────────────────────

test('SC19: every way a count fails rejects with a ScanError whose code is one the ADR lists and allowErrorCode passes unchanged [AC-4; ADR 0004 § Server → "Rejects with a ScanError, with no other code"]', async () => {
  const mod = load();
  const { LIMITS } = loadRealtime();
  const huge = { kinds: [39999], '#d': ['x'.repeat(LIMITS.argvFilterBytes + 10)] };
  const throwing = () => { throw Object.assign(new Error('boom'), { code: 'ENOMEM' }); };
  const runs = [
    ['non-zero exit', () => withFake(count('5\n', { finish: 3 }), () => countWith(mod, FILTER, {}))],
    ['signal', () => withFake(count('5\n', { finish: 'signal' }), () => countWith(mod, FILTER, {}))],
    ['unparseable', () => withFake(count('five\n'), () => countWith(mod, FILTER, {}))],
    ['timeout', () => withFake(count('', { finish: 'hang' }), () => countWith(mod, FILTER, { timeoutMs: 300 }, 5000))],
    ['filter-too-large', () => countWith(mod, huge, { spawnImpl: throwing }, 3000)],
    ['spawn', () => countWith(mod, FILTER, { spawnImpl: throwing }, 3000)],
    ['absent', () => withFake({ absent: true }, () => countWith(mod, FILTER, {}, 5000))],
  ];
  const { allowErrorCode } = loadRealtime();
  const wrong = [];
  for (const [label, go] of runs) {
    const out = await go();
    if (out === 'HUNG' || !out || !('error' in out)) { wrong.push(`${label}: expected a rejection; got ${describe(out)}`); continue; }
    const e = out.error;
    if (!(typeof mod.ScanError === 'function' && e instanceof mod.ScanError)) wrong.push(`${label}: not a ScanError (${e && e.constructor && e.constructor.name})`);
    if (!ALLOWED_CODES.includes(e && e.code)) wrong.push(`${label}: code ${show(e && e.code)} is not one of ${show(ALLOWED_CODES)}`);
    if (allowErrorCode(e && e.code) !== (e && e.code)) wrong.push(`${label}: allowErrorCode(${show(e && e.code)}) gives ${show(allowErrorCode(e && e.code))}, not the code unchanged`);
  }
  assert(wrong.length === 0, wrong.join('\n        '));
});

// ─── scanStrict is untouched ─────────────────────────────────────────────────────────────────────────────────────

test('SC20: scanStrict is not changed — a count-style "7030" line still rejects "not-an-event-line", and it still runs `strfry scan <filter>` with two arguments [ADR 0004 § Server → "scanStrict is not changed"]', async () => {
  const mod = load({ needCount: false });
  const seen = await withFake(count('7030\n'), async (fake) => {
    let out;
    try {
      out = await mod.scanStrict(FILTER, { isExpected: () => true, timeoutMs: 5000 }).then((value) => ({ value }), (error) => ({ error }));
    } catch (e) { out = { threw: e }; }
    return { out, invocations: fake.invocations(), arg1: fake.arg1(), arg2: fake.arg2() };
  });
  assert(seen.out && 'error' in seen.out, `scanStrict over stdout "7030\\n" should reject; got ${describe(seen.out)}`);
  eq(seen.out.error && seen.out.error.code, 'not-an-event-line', 'scanStrict\'s code for a count-style line');
  same(seen.invocations, [2], 'scanStrict runs strfry once, with two arguments');
  eq(seen.arg1, 'scan', 'scanStrict\'s first argument');
  eq(seen.arg2, mod.escapeFilterArgv(FILTER), 'scanStrict\'s second argument is the escaped filter');
});

// ─── the default time-out, and the timer after a good count ──────────────────────────────────────────────────────

test('SC21: with no timeoutMs, a count that never closes rejects "timeout" at the 10 s default — not scanStrict\'s 60 s — and the child is SIGKILLed [AC-4 10 s limit; ADR 0004 § Server → countStrict(filter, { timeoutMs = 10000, spawnImpl })]', async () => {
  const mod = load();
  const child = fakeChild();
  const t0 = Date.now();
  const out = await countWith(mod, FILTER, { spawnImpl: () => child }, 13000);
  const elapsed = Date.now() - t0;
  rejectedWith(mod, out, 'timeout', 'a child that never closes, no timeoutMs given');
  assert(elapsed >= 9500, `the count gave up after ${elapsed} ms, before the 10000 ms default`);
  assert(elapsed < 12500, `the count rejected only after ${elapsed} ms: the default timeoutMs is not 10000`);
  assert(child.kills.includes('SIGKILL'), `the timed-out child should be killed with SIGKILL; kill() was called with ${show(child.kills)}`);
});

test('SC22: a good count leaves no timer behind — a process that only counts exits right after the count, not when the 10 s default would have fired [ADR 0004 § Server → "repeats scanStrict\'s closure rules: the SIGKILL timer, settle-once" (scanStrict clears its timer on success)]', async () => {
  load();
  const modulePath = require.resolve(MODULE_REQUIRE);
  const script = `require(${JSON.stringify(modulePath)}).countStrict(${JSON.stringify(FILTER)})`
    + '.then((n) => console.log("RESOLVED " + n), (e) => console.log("REJECTED " + (e && e.code)));';
  const LIMIT = 6000;
  const seen = await withFake(count('7030\n', { stderr: NOISY_STDERR }), () => new Promise((resolve) => {
    const t0 = Date.now();
    childProcess.execFile(process.execPath, ['-e', script], { env: { ...process.env }, timeout: 15000 }, (err, stdout, stderr) => {
      resolve({ elapsed: Date.now() - t0, err, stdout: String(stdout), stderr: String(stderr) });
    });
  }));
  assert(seen.stdout.trim() === 'RESOLVED 7030',
    `fixture: the counting process should print "RESOLVED 7030"; it printed ${show(seen.stdout)} (stderr ${show(seen.stderr.slice(0, 300))}${seen.err ? `, error ${show(seen.err.message)}` : ''})`);
  assert(seen.elapsed < LIMIT,
    `the counting process took ${seen.elapsed} ms to exit after a good count: countStrict must clear its time-out timer on success, or it holds a short-lived process open until the timer fires`);
});

async function run() {
  console.log('\n--- strict strfry count (epic tagging-edges, Story 4; ADR 0004 § Server) ---');
  let pass = 0, fail = 0;
  const failures = [];
  try {
    for (const [name, fn] of tests) {
      try { await fn(); console.log(`  PASS  ${name}`); pass++; }
      catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
    }
  } finally { removeFakeBin(); }
  console.log(`\nstrfry-count-strict: ${pass} passed, ${fail} failed`);
  return { pass, fail, skipped: 0, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
