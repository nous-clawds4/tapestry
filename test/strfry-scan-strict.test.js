'use strict';
/**
 * Tests for Story 2 (epic: tagging-edges) — the strict relay reader the gap-filling pass reads its relay through.
 *
 * Story: engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.md (AC-4: a read that fails or comes
 *        back incomplete changes nothing and says which read failed and why; AC-1 / AC-3 lean on a complete read)
 * ADR:   engineering-team/decisions/tagging-edges/0002-gap-filling-pass.md — D2 "Reading the relay" (a new small
 *        streaming reader, one `#z` scan, no count), § Implementation notes → `src/lib/strfryScanStrict.js`, and
 *        § Seams for Test Design → "Strict reader"
 * Plan:  engineering-team/stories/tagging-edges/2-gap-filling-pass-and-backfill.test-plan.md
 *
 * Unit under test: `scanStrict(filter, { timeoutMs, isExpected, maxBytes, spawnImpl })` from src/lib/strfryScanStrict.js
 * → `{ events, lines, bytes, elapsedMs }`, or a rejection with `ScanError { code, message, stderrTail }`. A failed or
 * cut-short scan must never read as "the relay holds this" — or as "the relay holds nothing", which the pass would turn
 * into removals — so every way the ADR names for a scan to be incomplete rejects with its own code: spawn,
 * process-error, timeout, exit, signal, truncated, unparseable, not-an-event-line, duplicate, off-filter, too-large.
 * SS29 (review round 3) also calls the exported `redactPublicText(s)` directly, the one redactor the runner shares.
 *
 * How: a FAKE `strfry` — a throwaway shell script put first on PATH (the pattern of test/setup-status.test.js
 * X1–X4) — records how it was called, writes prepared stderr, prints prepared stdout bytes (one pipe write per part,
 * a pause between parts) and then exits, kills itself with a signal, or hangs. The reader's real spawn, pipe decoding,
 * exit / signal and time-out handling all run with no strfry installed. The script lives in one
 * fs.mkdtempSync(os.tmpdir()/strfry-scan-strict-bin-*) directory per run and each test's output in its own
 * strfry-scan-strict-* stage directory, all removed afterwards; PATH and FAKE_STRFRY_STAGE are restored after every
 * test. No stack, no relay, no network, no graph: nothing is written outside those temp directories.
 *
 * Intentionally failing until src/lib/strfryScanStrict.js lands (red phase). The module is require()d LAZILY inside
 * each test through load(), so this suite always loads. Fixture pubkeys are fake 64-hex values from
 * test/helpers/taggingEdgesFixtures.js — never a deployment's TA and never the ADR 0015 literal.
 * Works on Node 16 and 22: no global fetch, no structuredClone, no node:test.
 *
 * Story 3 (the real-time path) amends the reader. Story: engineering-team/stories/tagging-edges/3-real-time-path.md;
 * ADR: engineering-team/decisions/tagging-edges/0003-real-time-path.md — § Amendments → ADR 0002 "New files
 * (src/lib/strfryScanStrict.js)", § Implementation notes → Changed files, owner decision 6 (CF-3), and § Clarifications
 * T1. SS31–SS39 are its red-phase tests: the `onEvent` streaming option (events not kept; every completeness rule
 * unchanged), filter arrays, the argv text written with `\/` and size-checked before spawn (`filter-too-large`,
 * 100,000 bytes), `escapeFilterArgv` re-exported from src/lib/tagging-edges/realtime.js (required LAZILY, like the
 * reader), the off-filter text, and the widened `redactPublicText`. SS9 is re-aimed by that size check (a 3.3 MB
 * filter is now refused before spawn, never reaching the real spawn's E2BIG); SS28's title takes ADR 0002's current
 * wording (story 3 CF-1); SS29's clock-time case label no longer says there is no name:port rule. SS40 (added from the
 * mutation pass over story 3's blind reference implementation) pins that an onEvent that throws rejects the scan with
 * the handler's own error, never resolving. SS41 (story 3's review, round 2, R2-NB3) pins redactPublicText's 4 KB cut:
 * no part of a token straddling the mark gets out, input with no whitespace in its first 4 KB comes out empty, and a
 * 1 MB input returns within 1 s (timed in a child process, so a regression fails instead of hanging the suite).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');
const {
  IDENTITIES, ALICE, CAROL, OTHER_DEPLOY, D, STAMP, Z, fourStamps, idOf, pubkeyOf, makeTagging, makeElement, manyTaggings,
  JACK, CANONICAL,
} = require('./helpers/taggingEdgesFixtures');

const MODULE_REQUIRE = '../src/lib/strfryScanStrict';
const NL = '\n';
const HEX64_RUN = /[0-9a-fA-F]{64}/;

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const show = (v) => { try { return JSON.stringify(v); } catch { return String(v); } };
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
function same(actual, expected, label) {
  const a = JSON.stringify(sortKeys(actual));
  const e = JSON.stringify(sortKeys(expected));
  if (a !== e) throw new Error(`${label}\n        expected: ${clip(e)}\n        actual:   ${clip(a)}`);
}
function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}\n        expected: ${show(expected)}\n        actual:   ${show(actual)}`);
}
const clip = (s, n = 600) => (typeof s === 'string' && s.length > n ? `${s.slice(0, n)}… (${s.length} chars)` : s);
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

/** Lazily load the module under test with a descriptive red-phase message. */
function load() {
  let mod;
  try { mod = require(MODULE_REQUIRE); }
  catch (e) {
    throw new Error(`src/lib/strfryScanStrict.js not implemented yet (require('${MODULE_REQUIRE}') failed: ${String(e.message).split(NL)[0]})`);
  }
  assert(mod && typeof mod.scanStrict === 'function',
    `src/lib/strfryScanStrict.js must export scanStrict(filter, { timeoutMs, isExpected, maxBytes, spawnImpl }) (ADR 0002 § Implementation notes); its exports are ${show(mod && Object.keys(mod))}`);
  return mod;
}

// ─── fixtures ────────────────────────────────────────────────────────────────────────────────────────────────────
/** The pass's one relay scan (ADR 0002 D2 (i)): kind 39999 over the four `#z` stamps of the two identities. */
const FILTER = Object.freeze({ kinds: [39999], '#z': fourStamps(IDENTITIES) });

/** An isExpected in the ADR's words — kind 39999 and a `z` among the requested stamps. Injected, as the pass injects its own. */
function isExpectedFor(filter) {
  const wanted = new Set(filter['#z']);
  return (ev) => !!ev && ev.kind === 39999 && Array.isArray(ev.tags)
    && ev.tags.some((t) => Array.isArray(t) && t[0] === 'z' && wanted.has(t[1]));
}
const IS_EXPECTED = isExpectedFor(FILTER);
/** A predicate that accepts anything, so only the reader's own event-line rules can refuse a line. */
const ACCEPT_ALL = () => true;

// Taggings carrying each stamp alone and both (the identities kept different), and a tag element.
const TAGGING_CANON = makeTagging();
const TAGGING_LOCAL = makeTagging({ d: 'ss-local-stamp-only', id: idOf('ss:local'), stamps: [Z.localTagging] });
const TAGGING_BOTH = makeTagging({ d: 'ss-both-stamps', id: idOf('ss:both'), target: CAROL, stamps: [Z.canonicalTagging, Z.localTagging] });
const ELEMENT = makeElement();
const OK_EVENTS = Object.freeze([TAGGING_CANON, TAGGING_LOCAL, TAGGING_BOTH, ELEMENT]);

const lineOf = (ev) => JSON.stringify(ev) + NL;
const linesOf = (evs) => evs.map(lineOf).join('');
const OK_STDOUT = linesOf(OK_EVENTS);
/** One odd line between two good event lines, so the reader must neither stop early nor skip it. */
const between = (line) => lineOf(TAGGING_CANON) + line + NL + lineOf(ELEMENT);

// ─── the fake strfry ─────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The script, written ONCE per run (a first exec of a new file is slow on some hosts) and driven by a per-test stage
 * directory named in FAKE_STRFRY_STAGE. It records its argument count (one line per invocation), `$1` and `$2`; writes
 * the stage's `err` to stderr; prints `out.0`, `out.1`, … to stdout with a 0.3 s pause between parts (so each part is
 * its own pipe write); then finishes as `finish` says: an exit code, `signal` (kills itself with SIGTERM), or `hang`
 * (ignores SIGTERM, records its pid, and sleeps 30 s in the same process — so only SIGKILL stops it).
 */
const FAKE_SCRIPT = String.raw`#!/bin/sh
# Fake strfry for test/strfry-scan-strict.test.js (ADR tagging-edges/0002, Seams for Test Design -> Strict reader).
D="$FAKE_STRFRY_STAGE"
if [ -z "$D" ] || [ ! -d "$D" ]; then echo 'fake strfry: FAKE_STRFRY_STAGE is not set' >&2; exit 97; fi
printf '%s\n' "$#" >> "$D/calls"
printf '%s' "$1" > "$D/arg1"
printf '%s' "$2" > "$D/arg2"
if [ -f "$D/err" ]; then cat "$D/err" >&2; fi
i=0
while [ -f "$D/out.$i" ]; do
  if [ "$i" -gt 0 ]; then sleep 0.3; fi
  cat "$D/out.$i"
  i=$((i + 1))
done
finish=$(cat "$D/finish")
case "$finish" in
  hang) trap '' TERM; printf '%s' "$$" > "$D/pid"; exec sleep 30 ;;
  signal) kill -TERM "$$"; sleep 5; exit 0 ;;
  *) exit "$finish" ;;
esac
`;

let fakeBin = null;
/** The directory holding the one fake `strfry` of this run (created on first use, removed at the end of run()). */
function fakeBinDir() {
  if (!fakeBin) {
    fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'strfry-scan-strict-bin-'));
    fs.writeFileSync(path.join(fakeBin, 'strfry'), FAKE_SCRIPT, { mode: 0o755 });
  }
  return fakeBin;
}
function removeFakeBin() {
  if (fakeBin) { fs.rmSync(fakeBin, { recursive: true, force: true }); fakeBin = null; }
}

/**
 * The fake's modes (the Seams list): each returns `{ parts, stderr, finish }` — stdout parts (string or Buffer), the
 * stderr text, and how the process ends (an exit code, 'signal' or 'hang'). `absent` puts no strfry on PATH at all.
 */
const MODES = {
  ok: () => ({ parts: [OK_STDOUT], stderr: 'INFO| strfry scan: a log line on stderr, as strfry writes them\n', finish: 0 }),
  fail: () => ({ parts: [OK_STDOUT], finish: 1 }),
  hang: () => ({ parts: [OK_STDOUT], finish: 'hang' }),
  signal: () => ({ parts: [OK_STDOUT], finish: 'signal' }),
  truncated: (stdout = OK_STDOUT.slice(0, -1)) => ({ parts: [stdout], finish: 0 }),
  logline: (line) => ({ parts: [between(line)], finish: 0 }),
  'not-object': (line) => ({ parts: [between(line)], finish: 0 }),
  'dup-id': (first, second) => ({ parts: [lineOf(first) + lineOf(ELEMENT) + lineOf(second)], finish: 0 }),
  'off-filter': (ev) => ({ parts: [between(JSON.stringify(ev))], finish: 0 }),
  'split-utf8': (parts) => ({ parts, finish: 0 }),
  'too-large': () => ({ parts: [OK_STDOUT], finish: 0 }),
  'stderr-error': (stderr, code = 1) => ({ parts: [OK_STDOUT], stderr, finish: code }),
  absent: () => ({ absent: true }),
};

/**
 * Run `fn(fake)` with the fake strfry first on PATH and a fresh stage directory in FAKE_STRFRY_STAGE (or, for
 * `absent`, PATH holding only that empty directory). Restores PATH and FAKE_STRFRY_STAGE, kills a hung fake that is
 * still alive, and removes the stage afterwards. `fake` reads back what the fake recorded: `invocations()` (the
 * argument count of each run), `arg1()`, `arg2()`, `pid()` (hang only).
 */
async function withFake(config, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'strfry-scan-strict-'));
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
    pid: () => { const t = safeRead(path.join(dir, 'pid')); return t ? Number(t) : null; },
  };
  const saved = { PATH: process.env.PATH, FAKE_STRFRY_STAGE: process.env.FAKE_STRFRY_STAGE };
  process.env.PATH = config.absent ? dir : `${fakeBinDir()}${path.delimiter}${saved.PATH || ''}`;
  process.env.FAKE_STRFRY_STAGE = dir;
  try { return await fn(fake); }
  finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    const pid = fake.pid();
    if (pid) { try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Call scanStrict and settle it: `{ value }`, `{ error }`, `{ threw }` (a synchronous throw), `{ notPromise }` or 'HUNG'. */
async function scanWith(mod, filter, options, ms = 10000) {
  let p;
  try { p = mod.scanStrict(filter, options); }
  catch (e) { return { threw: e }; }
  if (!p || typeof p.then !== 'function') return { notPromise: p };
  let timer;
  const hung = new Promise((r) => { timer = setTimeout(() => r('HUNG'), ms); });
  try { return await Promise.race([p.then((value) => ({ value }), (error) => ({ error })), hung]); }
  finally { clearTimeout(timer); }
}

function summarize(v) {
  if (!v || typeof v !== 'object') return show(v);
  const n = Array.isArray(v.events) ? `${v.events.length} event(s)` : show(v.events);
  return `{ events: ${n}, lines: ${show(v.lines)}, bytes: ${show(v.bytes)}, elapsedMs: ${show(v.elapsedMs)} }`;
}
function describe(out) {
  if (out === 'HUNG') return 'no answer at all (the promise was still pending)';
  if (out.threw) return `a synchronous throw out of scanStrict: ${show(out.threw && out.threw.message)}`;
  if ('notPromise' in out) return `a non-promise return value ${show(out.notPromise)}`;
  if ('value' in out) return `a resolution with ${summarize(out.value)}`;
  const e = out.error;
  return `a rejection with code ${show(e && e.code)} and message ${show(e && e.message)}`;
}

/** The scan resolved; returns its value. */
function resolvedWith(out, label) {
  assert(out !== 'HUNG' && out && 'value' in out, `${label}: expected scanStrict to resolve (a complete read); got ${describe(out)}`);
  const v = out.value;
  assert(v && typeof v === 'object' && Array.isArray(v.events), `${label}: expected { events, lines, bytes, elapsedMs }; got ${show(v)}`);
  return v;
}

/** The scan rejected with a ScanError carrying `code`; returns the error. */
function rejectedWith(mod, out, code, label) {
  assert(out !== 'HUNG' && out && 'error' in out, `${label}: expected scanStrict to reject with ScanError code '${code}'; got ${describe(out)}`);
  const e = out.error;
  assert(e instanceof Error, `${label}: the rejection should be an Error (a ScanError); got ${show(e)}`);
  assert(e.code === code, `${label}: expected ScanError code '${code}'; got code ${show(e.code)} (message: ${show(e.message)})`);
  assert(typeof e.message === 'string' && e.message.trim().length > 0, `${label}: the ScanError should carry a message; got ${show(e.message)}`);
  if (typeof mod.ScanError === 'function') {
    assert(e instanceof mod.ScanError, `${label}: the rejection should be an instance of the exported ScanError; got ${e && e.constructor && e.constructor.name}`);
  }
  return e;
}

/** Poll until `pid` no longer exists (ESRCH), up to `ms`. */
async function waitGone(pid, ms) {
  const deadline = Date.now() + ms;
  for (;;) {
    try { process.kill(pid, 0); } catch (e) { if (e.code === 'ESRCH') return true; }
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, 50));
  }
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

// ─── a complete read ─────────────────────────────────────────────────────────────────────────────────────────────

test('SS1: a complete scan resolves with every event line in the order strfry printed it, unchanged, with its line and byte counts — stderr log lines on a clean exit do not fail it', async () => {
  const mod = load();
  const out = await withFake(MODES.ok(), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  const r = resolvedWith(out, 'ok mode (four event lines, exit 0, a log line on stderr)');
  same(r.events, OK_EVENTS, 'events: the printed events, in order and unchanged (taggings with each stamp alone and both, and a tag element)');
  eq(r.lines, OK_EVENTS.length, 'lines: one per event line printed');
  eq(r.bytes, Buffer.byteLength(OK_STDOUT, 'utf8'), 'bytes: every stdout byte read');
  assert(typeof r.elapsedMs === 'number' && Number.isFinite(r.elapsedMs) && r.elapsedMs >= 0,
    `elapsedMs: a finite number of milliseconds, 0 or more; got ${show(r.elapsedMs)}`);
});

test('SS2: the filter reaches strfry as exactly `strfry scan <filter JSON>`, in one process — no count process is spawned', async () => {
  const mod = load();
  const seen = await withFake(MODES.ok(), async (fake) => ({
    out: await scanWith(mod, FILTER, { isExpected: IS_EXPECTED }),
    invocations: fake.invocations(), arg1: fake.arg1(), arg2: fake.arg2(),
  }));
  resolvedWith(seen.out, 'ok mode');
  same(seen.invocations, [2], 'strfry is run once, with two arguments (ADR 0002: "No count is taken (a separate process is a separate snapshot)"); argument count of each run');
  eq(seen.arg1, 'scan', 'strfry\'s first argument');
  let passed;
  try { passed = JSON.parse(seen.arg2); } catch { passed = undefined; }
  assert(passed !== undefined, `strfry's second argument must be the filter as JSON; it received ${show(clip(seen.arg2))}`);
  same(passed, FILTER, 'the filter strfry received (parsed from its second argument)');
});

test('SS3: an injected spawnImpl is how the reader starts strfry — called exactly once, and nothing else reaches strfry', async () => {
  const mod = load();
  const calls = [];
  const spawnImpl = (...args) => { calls.push(args); return childProcess.spawn(...args); };
  const seen = await withFake(MODES.ok(), async (fake) => ({
    out: await scanWith(mod, FILTER, { isExpected: IS_EXPECTED, spawnImpl }),
    invocations: fake.invocations(),
  }));
  const r = resolvedWith(seen.out, 'ok mode through a spawnImpl that forwards to child_process.spawn');
  eq(r.events.length, OK_EVENTS.length, 'events read through the injected spawnImpl');
  eq(calls.length, 1, 'spawnImpl calls for one scan');
  same(seen.invocations, [2], 'strfry runs once, and only through spawnImpl (argument count of each run)');
});

test('SS4: an empty stdout on exit 0 is a complete, empty read — as is a stdout of blank lines only', async () => {
  const mod = load();
  const empty = await withFake({ parts: [], finish: 0 }, () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  const r = resolvedWith(empty, 'no stdout at all, exit 0 (ADR: "stdout is empty or ends in \\n")');
  same(r.events, [], 'events of an empty read');
  eq(r.lines, 0, 'lines of an empty read');
  eq(r.bytes, 0, 'bytes of an empty read');
  const blank = await withFake({ parts: [NL + NL], finish: 0 }, () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  same(resolvedWith(blank, 'stdout "\\n\\n", exit 0').events, [], 'events when stdout holds only blank lines');
});

test('SS5: blank lines between event lines are skipped, not refused ("every non-empty line" is an event line)', async () => {
  const mod = load();
  const stdout = lineOf(TAGGING_CANON) + NL + lineOf(TAGGING_LOCAL) + NL + NL + lineOf(ELEMENT);
  const out = await withFake({ parts: [stdout], finish: 0 }, () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  same(resolvedWith(out, 'event lines with blank lines between them').events, [TAGGING_CANON, TAGGING_LOCAL, ELEMENT], 'events, blank lines skipped');
});

// ─── a process that did not finish cleanly ───────────────────────────────────────────────────────────────────────

test('SS6: strfry exiting non-zero rejects "exit", even after it printed complete event lines', async () => {
  const mod = load();
  const out = await withFake(MODES.fail(), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  rejectedWith(mod, out, 'exit', 'fail mode (four valid event lines, then exit 1)');
});

test('SS7: strfry absent from PATH rejects "process-error" (Node reports ENOENT through the child\'s \'error\' event), never an empty read', async () => {
  const mod = load();
  const out = await withFake(MODES.absent(), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  rejectedWith(mod, out, 'process-error', 'no strfry on PATH');
});

test('SS8: a spawn that throws rejects "spawn" — scanStrict itself never throws', async () => {
  const mod = load();
  const spawnImpl = () => { const e = new Error('spawn E2BIG'); e.code = 'E2BIG'; throw e; };
  const out = await scanWith(mod, FILTER, { isExpected: IS_EXPECTED, spawnImpl });
  rejectedWith(mod, out, 'spawn', 'an injected spawnImpl that throws synchronously');
});

// Re-aimed by story 3 (ADR tagging-edges/0003 § Amendments → ADR 0002 "New files": "The argv text … is size-checked
// before spawn (`filter-too-large`)", for every caller). Story 2 pinned "spawn" here: the real spawn's E2BIG. Every
// filter over 100,000 argv bytes is now refused before spawn, so a 3.3 MB filter never reaches E2BIG; SS8 still pins
// "spawn" for a spawn that throws. Clarification T31 confirms the re-aim: "filter-too-large makes story 2's SS9 … unreachable."
test('SS9: a filter too long for one command line (3.3 MB of JSON) is refused "filter-too-large" before spawn, and strfry never runs (story 2 pinned "spawn" — the real spawn\'s E2BIG; ADR tagging-edges/0003 re-aims it: every argv over 100,000 bytes is refused before spawn)', async () => {
  const mod = load();
  // ADR 0002 D2 (ii): "spawn throws E2BIG above about 1,955 ids". 50,000 ids is about 3.3 MB of argv on any host.
  const filter = { kinds: [39999], ids: Array.from({ length: 50000 }, (_, i) => idOf(i + 1)) };
  assert(JSON.stringify(filter).length > 2 * 1024 * 1024, 'fixture: the filter should be over 2 MiB of JSON');
  const seen = await withFake(MODES.ok(), async (fake) => ({
    out: await scanWith(mod, filter, { isExpected: ACCEPT_ALL }),
    invocations: fake.invocations(),
  }));
  rejectedWith(mod, seen.out, 'filter-too-large', 'a 3.3 MB filter on the command line (ADR 0003: over 100,000 argv bytes → filter-too-large, before spawn)');
  same(seen.invocations, [], 'strfry runs (it must not have started)');
});

test('SS10: a strfry that never finishes is killed with SIGKILL at timeoutMs and the scan rejects "timeout" — the events it printed are not a read', async () => {
  const mod = load();
  const TIMEOUT = 600;
  const seen = await withFake(MODES.hang(), async (fake) => {
    const t0 = Date.now();
    const out = await scanWith(mod, FILTER, { isExpected: IS_EXPECTED, timeoutMs: TIMEOUT }, 6000);
    const elapsed = Date.now() - t0;
    const pid = fake.pid();
    const gone = pid ? await waitGone(pid, 3000) : null;
    return { out, elapsed, pid, gone };
  });
  rejectedWith(mod, seen.out, 'timeout', `hang mode (four event lines printed, then no exit; timeoutMs ${TIMEOUT})`);
  assert(seen.elapsed >= TIMEOUT * 0.8, `the scan gave up after ${seen.elapsed} ms, before its timeoutMs of ${TIMEOUT}`);
  assert(seen.elapsed < TIMEOUT + 2500, `the scan ignored { timeoutMs: ${TIMEOUT} }: it rejected only after ${seen.elapsed} ms`);
  assert(seen.pid, 'fixture: the fake strfry should have recorded its pid before hanging');
  assert(seen.gone === true,
    `the timed-out strfry (pid ${seen.pid}) is still alive 3 s after the rejection: the time-out must SIGKILL it (this fake ignores SIGTERM)`);
});

test('SS11: strfry killed by a signal rejects "signal", even though every line it printed was a complete event', async () => {
  const mod = load();
  const out = await withFake(MODES.signal(), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  rejectedWith(mod, out, 'signal', 'signal mode (four valid event lines, then SIGTERM to itself)');
});

// ─── output that is not a whole read ─────────────────────────────────────────────────────────────────────────────

test('SS12: a stdout whose last line has no final newline rejects "truncated", even when that line is a complete event', async () => {
  const mod = load();
  const out = await withFake(MODES.truncated(), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  rejectedWith(mod, out, 'truncated', 'truncated mode (four event lines, the last with no "\\n", exit 0)');
});

test('SS13: a stdout cut off in the middle of an event line rejects — never resolves with the events before the cut', async () => {
  const mod = load();
  const stdout = linesOf([TAGGING_CANON, TAGGING_LOCAL]) + lineOf(ELEMENT).slice(0, 40);
  const out = await withFake(MODES.truncated(stdout), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  assert(out !== 'HUNG' && out && 'error' in out,
    `two event lines and then 40 bytes of a third, exit 0: expected a rejection ('truncated' — or 'unparseable', if the reader reads the tail as a line); got ${describe(out)}`);
  const e = out.error;
  assert(e && (e.code === 'truncated' || e.code === 'unparseable'),
    `a stdout cut mid-line: expected ScanError code 'truncated' (or 'unparseable'); got code ${show(e && e.code)} (message: ${show(e && e.message)})`);
});

test('SS14: a line that is not JSON — a strfry log line on stdout, or a broken event — rejects "unparseable" (it is not skipped)', async () => {
  const mod = load();
  const cases = [
    ['a strfry log line', 'strfry: a log line, not an event'],
    ['a timestamped log line', 'INFO| 2026-09-27 12:00:00.000 scan complete'],
    ['an event cut off inside its JSON, then a newline', lineOf(TAGGING_LOCAL).slice(0, 60)],
  ];
  for (const [label, line] of cases) {
    const out = await withFake(MODES.logline(line), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
    rejectedWith(mod, out, 'unparseable', `logline mode: ${label} between two event lines`);
  }
});

test('SS15: a line that parses but is not an object with a 64-hex id rejects "not-an-event-line"', async () => {
  const mod = load();
  const hexOf = (n) => idOf('ss:short-long').repeat(2).slice(0, n);
  const cases = [
    ['a number', '42'],
    ['a string', '"an event"'],
    ['null', 'null'],
    ['true', 'true'],
    ['an array holding an event', JSON.stringify([TAGGING_LOCAL])],
    ['an object with no id', JSON.stringify({ kind: 39999, tags: [['z', Z.localTagging]] })],
    ['a 63-hex id', JSON.stringify({ ...TAGGING_LOCAL, id: hexOf(63) })],
    ['a 65-hex id', JSON.stringify({ ...TAGGING_LOCAL, id: hexOf(65) })],
    ['a 64-character id that is not hex', JSON.stringify({ ...TAGGING_LOCAL, id: 'g'.repeat(64) })],
    ['a numeric id', JSON.stringify({ ...TAGGING_LOCAL, id: 12345 })],
  ];
  for (const [label, line] of cases) {
    const out = await withFake(MODES['not-object'](line), () => scanWith(mod, FILTER, { isExpected: ACCEPT_ALL }));
    rejectedWith(mod, out, 'not-an-event-line', `not-object mode: ${label} between two event lines (isExpected accepts anything)`);
  }
});

test('SS16: an event whose id is upper-case hex is an event line — returned unchanged, for the contract (not the reader) to judge', async () => {
  const mod = load();
  const upper = makeTagging({ d: 'ss-upper-case-id', id: idOf('ss:upper').toUpperCase() });
  assert(upper.id !== upper.id.toLowerCase(), 'fixture: the id should contain hex letters');
  const out = await withFake({ parts: [lineOf(TAGGING_CANON) + lineOf(upper)], finish: 0 }, () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  same(resolvedWith(out, 'an event line whose id is 64 upper-case hex characters (ADR: "64-hex in either case")').events,
    [TAGGING_CANON, upper], 'events, the upper-case id kept exactly as printed');
});

test('SS17: an id that appears twice — the same line, the same id with other content, or ids that differ only in case — rejects "duplicate"', async () => {
  const mod = load();
  const lower = makeTagging({ d: 'ss-case-a', id: idOf('ss:case') });
  const upper = makeTagging({ d: 'ss-case-b', id: lower.id.toUpperCase() });
  assert(lower.id !== upper.id, 'fixture: the two ids should differ in case');
  const cases = [
    ['the same event line twice', TAGGING_CANON, TAGGING_CANON],
    ['one id on two different events', TAGGING_CANON, makeTagging({ d: 'ss-same-id-other-d', id: TAGGING_CANON.id })],
    ['two ids that differ only in case', lower, upper],
  ];
  for (const [label, first, second] of cases) {
    const out = await withFake(MODES['dup-id'](first, second), () => scanWith(mod, FILTER, { isExpected: ACCEPT_ALL }));
    rejectedWith(mod, out, 'duplicate', `dup-id mode: ${label}, a tag element between them`);
  }
});

test('SS18: an event the injected isExpected refuses rejects "off-filter" — the wrong kind, a stamp outside the filter, no stamp, or one the predicate vetoes', async () => {
  const mod = load();
  const vetoed = makeTagging({ d: 'ss-vetoed', id: idOf('ss:veto') });
  const cases = [
    ['a kind-1 note', makeTagging({ d: 'ss-kind-1', id: idOf('ss:kind1'), kind: 1, stamps: [] }), IS_EXPECTED],
    ['a kind-39999 carrying only another deployment\'s stamp', makeTagging({ d: 'ss-other-deploy', id: idOf('ss:other'), stamps: [STAMP(OTHER_DEPLOY)] }), IS_EXPECTED],
    ['a kind-39999 with no z stamp', makeTagging({ d: 'ss-no-stamp', id: idOf('ss:nostamp'), stamps: [] }), IS_EXPECTED],
    ['a tagging the injected predicate vetoes (so the reader asks isExpected)', vetoed, (ev) => IS_EXPECTED(ev) && ev.id !== vetoed.id],
  ];
  for (const [label, ev, isExpected] of cases) {
    const out = await withFake(MODES['off-filter'](ev), () => scanWith(mod, FILTER, { isExpected }));
    rejectedWith(mod, out, 'off-filter', `off-filter mode: ${label}, between two expected event lines`);
  }
});

test('SS19: a multi-byte character split across two pipe writes is decoded byte-exact — no U+FFFD, every event as printed', async () => {
  const mod = load();
  const tagging = makeTagging({ d: 'profile-tag-日本語-😀-podcaster', id: idOf('ss:utf8-tagging') });
  const element = makeElement({ d: 'подкастер-🎙️-éàü', id: idOf('ss:utf8-element'), stamps: [Z.localTag] });
  const whole = Buffer.from(lineOf(tagging) + lineOf(element), 'utf8');
  const cut1 = whole.indexOf(Buffer.from('日', 'utf8')) + 1; // inside a 3-byte character
  const cut2 = whole.indexOf(Buffer.from('🎙', 'utf8')) + 2; // inside a 4-byte character
  assert(cut1 > 1 && cut2 > cut1, `fixture: both cuts should fall inside the output (${cut1}, ${cut2})`);
  const parts = [whole.subarray(0, cut1), whole.subarray(cut1, cut2), whole.subarray(cut2)];
  assert(parts[0].toString('utf8').endsWith('�') && parts[1].toString('utf8').endsWith('�'),
    'fixture: each cut should split a character (decoding a part alone gives U+FFFD)');
  const out = await withFake(MODES['split-utf8'](parts), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  const r = resolvedWith(out, 'split-utf8 mode (three pipe writes, each cut inside a multi-byte character)');
  same(r.events, [tagging, element], 'events decoded across the split writes');
  const text = r.events.map(lineOf).join('');
  assert(!text.includes('�'), `a split character was decoded as U+FFFD: ${clip(text, 300)}`);
  assert(Buffer.compare(Buffer.from(text, 'utf8'), whole) === 0, 'the events, serialised again, should equal the bytes strfry wrote, byte for byte');
  eq(r.bytes, whole.length, 'bytes: the UTF-8 bytes read, not the characters');
});

test('SS20: a stdout of exactly maxBytes is read; one byte more than maxBytes rejects "too-large"', async () => {
  const mod = load();
  const size = Buffer.byteLength(OK_STDOUT, 'utf8');
  const atLimit = await withFake(MODES['too-large'](), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED, maxBytes: size }));
  eq(resolvedWith(atLimit, `a ${size}-byte stdout with maxBytes ${size} ("total bytes ≤ maxBytes")`).events.length, OK_EVENTS.length, 'events at the limit');
  const over = await withFake(MODES['too-large'](), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED, maxBytes: size - 1 }));
  rejectedWith(mod, over, 'too-large', `too-large mode: a ${size}-byte stdout with maxBytes ${size - 1}`);
});

test('SS21: a production-sized scan (about 10.4k events, over 8.2 MB) is read whole with the default time-out and size limit', async () => {
  const mod = load();
  const events = manyTaggings(10400, { prefix: 'ss-census', over: (i) => (i % 3 === 0 ? { stamps: [Z.localTagging] } : {}) })
    .map((ev) => ({ ...ev, content: 'c'.repeat(330) }));
  const stdout = linesOf(events);
  const size = Buffer.byteLength(stdout, 'utf8');
  assert(size > 8.2e6, `fixture: the output should exceed production's 8.2 MB (ADR 0002 D2); it is ${size} bytes`);
  const out = await withFake({ parts: [stdout], finish: 0 }, () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }, 30000));
  const r = resolvedWith(out, `${events.length} event lines, ${size} bytes, default options (maxBytes 256 MiB, timeoutMs 60 s)`);
  eq(r.events.length, events.length, 'events read');
  eq(r.events[r.events.length - 1].id, events[events.length - 1].id, 'the last event read is the last printed');
  eq(r.lines, events.length, 'lines');
  eq(r.bytes, size, 'bytes');
});

// ─── what a failed scan says about why ───────────────────────────────────────────────────────────────────────────

test('SS22: a failed scan\'s stderrTail is only strfry\'s last "strfry error:" line, each 64-hex run cut to its first 8 characters', async () => {
  const mod = load();
  const key = pubkeyOf('ss:stderr-key');
  const lastError = `strfry error: filter rejected for 39999:${ALICE}:${D} by ${key}`;
  const stderr = [
    'INFO| opening the database',
    `strfry error: an earlier problem with ${pubkeyOf('ss:earlier')}`,
    'INFO| scanning',
    lastError,
    `INFO| exiting after ${pubkeyOf('ss:after')}`,
  ].join(NL) + NL;
  const out = await withFake(MODES['stderr-error'](stderr), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  const e = rejectedWith(mod, out, 'exit', 'stderr-error mode (exit 1)');
  eq(e.stderrTail, `strfry error: filter rejected for 39999:${ALICE.slice(0, 8)}:${D} by ${key.slice(0, 8)}`,
    'stderrTail: the last "strfry error:" line alone, with each 64-hex run cut to 8 characters');
  for (const [field, value] of [['message', e.message], ['stderrTail', e.stderrTail]]) {
    assert(!HEX64_RUN.test(String(value)), `the ScanError's ${field} carries a full 64-hex run (the report shows identities as 8-character prefixes only): ${show(value)}`);
  }
});

test('SS23: a long "strfry error:" line is cut to at most 300 characters in stderrTail', async () => {
  const mod = load();
  const key = pubkeyOf('ss:long-line');
  const stderr = `strfry error: bad event ${key} ${'because of a reason '.repeat(40)}\n`;
  const out = await withFake(MODES['stderr-error'](stderr), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  const e = rejectedWith(mod, out, 'exit', 'stderr-error mode with an 830-character error line');
  assert(typeof e.stderrTail === 'string' && e.stderrTail.length <= 300,
    `stderrTail: at most 300 characters; got ${typeof e.stderrTail === 'string' ? `${e.stderrTail.length} characters` : show(e.stderrTail)}`);
  assert(e.stderrTail.startsWith(`strfry error: bad event ${key.slice(0, 8)} because of a reason`),
    `stderrTail: the start of the error line, its 64-hex run cut to 8 characters; got ${show(e.stderrTail)}`);
});

test('SS24: with no "strfry error:" line, stderrTail carries the exit code and none of strfry\'s other stderr', async () => {
  const mod = load();
  const stderr = `fatal: something broke near ${pubkeyOf('ss:noise')}\nmore unrelated noise\n`;
  const out = await withFake(MODES['stderr-error'](stderr, 7), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  const e = rejectedWith(mod, out, 'exit', 'stderr-error mode with no "strfry error:" line (exit 7)');
  assert(typeof e.stderrTail === 'string' && e.stderrTail.length <= 300 && /7/.test(e.stderrTail),
    `stderrTail: the exit code (7), at most 300 characters; got ${show(e.stderrTail)}`);
  assert(!/something broke|unrelated noise/.test(e.stderrTail), `stderrTail must not carry stderr other than a "strfry error:" line; got ${show(e.stderrTail)}`);
  for (const [field, value] of [['message', e.message], ['stderrTail', e.stderrTail]]) {
    assert(!HEX64_RUN.test(String(value)), `the ScanError's ${field} carries a full 64-hex run: ${show(value)}`);
  }
});

test('SS25: a stderr flood (about 300 KB) neither stalls the scan nor hides the last "strfry error:" line at its end', async () => {
  const mod = load();
  const key = pubkeyOf('ss:flood');
  const stderr = 'strfry error: an early problem that scrolls away\n'
    + `INFO| ${'x'.repeat(94)}\n`.repeat(3000)
    + `strfry error: the final problem with ${key}\n`;
  const t0 = Date.now();
  const out = await withFake(MODES['stderr-error'](stderr), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED, timeoutMs: 20000 }, 8000));
  const e = rejectedWith(mod, out, 'exit', 'stderr-error mode, 300 KB of stderr, then exit 1');
  assert(Date.now() - t0 < 8000, 'the scan should settle promptly: stderr must be drained as it arrives');
  eq(e.stderrTail, `strfry error: the final problem with ${key.slice(0, 8)}`, 'stderrTail after a stderr flood (the reader keeps a 4 KiB tail)');
});

// ─── the defaults (ADR 0002 Implementation notes: `timeoutMs = 60000`, `maxBytes = 256 MiB`) ────────────────────

test('SS26: with no timeoutMs the reader arms a 60-second time-out (ADR: timeoutMs = 60000) — as a timer or as spawn\'s own timeout option', async () => {
  const mod = load();
  const delays = [];
  const spawnOptions = [];
  const spawnImpl = (cmd, args, opts) => { spawnOptions.push(opts || {}); return childProcess.spawn(cmd, args, opts); };
  const realSetTimeout = global.setTimeout;
  const out = await withFake(MODES.ok(), async () => {
    global.setTimeout = function spiedSetTimeout(fn, ms, ...rest) { delays.push(Number(ms)); return realSetTimeout.call(this, fn, ms, ...rest); };
    try { return await scanWith(mod, FILTER, { isExpected: IS_EXPECTED, spawnImpl }); }
    finally { global.setTimeout = realSetTimeout; }
  });
  resolvedWith(out, 'ok mode with no timeoutMs given');
  const armed = delays.includes(60000) || spawnOptions.some((o) => o && o.timeout === 60000);
  assert(armed, `the reader should arm a 60,000 ms time-out when none is given; timers armed during the scan: ${show(delays)}, spawn options: ${show(spawnOptions.map((o) => o && o.timeout))}`);
});

/** The pass's size limit when none is given: 256 MiB (ADR 0002 Implementation notes, scanStrict's maxBytes default). */
const DEFAULT_MAX_BYTES = 256 * 1024 * 1024;

/**
 * A child process for spawnImpl whose stdout is `totalBytes` bytes of complete, in-filter event lines (about 1 MiB
 * each, built from one shared buffer so the fixture itself stays small), then exit 0. It honours kill(): it stops
 * writing and closes with that signal, as a killed process would.
 */
function bigStdoutChild(totalBytes) {
  const { EventEmitter } = require('events');
  const { PassThrough } = require('stream');
  const LINE = 1024 * 1024;
  const SLACK = 4096; // a last line may run this much over LINE, so no remainder is too small to be a line
  const filler = Buffer.alloc(LINE + SLACK, 'c');
  const events = manyTaggings(Math.ceil(totalBytes / LINE) + 1, { prefix: 'ss-max-bytes' });
  const parts = []; // [prefix, contentBytes, suffix] per line
  let left = totalBytes;
  for (const ev of events) {
    if (left <= 0) break;
    const text = JSON.stringify({ ...ev, content: '' });
    const at = text.indexOf('"content":""') + '"content":"'.length;
    const prefix = Buffer.from(text.slice(0, at), 'utf8');
    const suffix = Buffer.from(`${text.slice(at)}\n`, 'utf8');
    const base = prefix.length + suffix.length;
    let content = Math.min(LINE - base, left - base);
    if (left - (base + content) < SLACK) content = left - base;
    assert(content >= 0 && content <= filler.length, `fixture: could not lay out ${totalBytes} bytes of event lines`);
    parts.push([prefix, content, suffix]);
    left -= base + content;
  }
  assert(left === 0, `fixture: laid out ${totalBytes - left} of ${totalBytes} bytes`);
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = null;
  child.pid = 424242;
  let killedWith = null;
  let closed = false;
  const close = (code, signal) => {
    if (closed) return;
    closed = true;
    child.stdout.end();
    child.stderr.end();
    setImmediate(() => { child.emit('exit', code, signal); child.emit('close', code, signal); });
  };
  child.kill = (sig = 'SIGTERM') => { killedWith = killedWith || sig; close(null, sig); return true; };
  const write = async (buf) => {
    if (killedWith || closed) return false;
    if (!child.stdout.write(buf)) await new Promise((r) => child.stdout.once('drain', r));
    return true;
  };
  setImmediate(async () => {
    for (const [prefix, content, suffix] of parts) {
      if (!(await write(prefix)) || !(await write(filler.subarray(0, content))) || !(await write(suffix))) return;
    }
    close(0, null);
  });
  return child;
}

// Owner ruling at the Test Design gate (2026-09-27): only the over-limit half is pinned. Reading exactly 256 MiB of
// events cost about 1 GB of memory per gate run; the "at the limit" side is covered at small sizes by SS20-SS21.
test('SS27: with no maxBytes the reader rejects a stdout of 256 MiB + 1 byte as "too-large" (ADR: maxBytes = 256 MiB)', async () => {
  const mod = load();
  const over = await scanWith(mod, FILTER, { isExpected: IS_EXPECTED, spawnImpl: () => bigStdoutChild(DEFAULT_MAX_BYTES + 1) }, 60000);
  rejectedWith(mod, over, 'too-large', `a stdout of ${DEFAULT_MAX_BYTES + 1} bytes of event lines, no maxBytes given`);
});

// ─── review round 2 (2026-09-28): no absolute path in the stderr tail ───────────────────────────────────────────

/**
 * strfry's own line when it cannot load its config file, verbatim: the container's strfry 1.1.0, run as
 * `strfry --config=/nonexistent-review-probe.conf scan '{"limit":1}'`, exit 1 (review 2026-09-28, Blocking 1). The
 * pass runs `strfry scan` with no --config, so in production the path is the default, /etc/strfry.conf.
 */
const REAL_CONFIG_ERROR = "strfry error: Failed to load config file '/nonexistent-review-probe.conf': filesystem error: open() failed: No such file or directory [/nonexistent-review-probe.conf]";
/** An absolute path: a "/" that starts a word (at the start, or after a space, quote, bracket, parenthesis or "="). */
const ABSOLUTE_PATH_RE = /(^|[\s'"[(=])\/[^\s'"\])]/;

test('SS28: a failed scan\'s stderrTail names no absolute path that starts a word — strfry\'s real "Failed to load config file" line, for the probe path and for the default /etc/strfry.conf, keeps its gist with each path redacted, because the public status route serves it (ADR 0002 "Who reads it": no config value or credential, and no absolute path that starts a word; review 2026-09-28, Blocking 1; title per story 3 CF-1)', async () => {
  const mod = load();
  const problems = [];
  for (const [what, line] of [
    ['the line strfry printed for --config=/nonexistent-review-probe.conf', REAL_CONFIG_ERROR],
    ['the same line for the default config /etc/strfry.conf', REAL_CONFIG_ERROR.split('/nonexistent-review-probe.conf').join('/etc/strfry.conf')],
  ]) {
    const out = await withFake(MODES['stderr-error'](`${line}\n`), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
    let e;
    try { e = rejectedWith(mod, out, 'exit', `${what} (exit 1)`); } catch (err) { problems.push(err.message); continue; }
    const tail = e.stderrTail;
    if (typeof tail !== 'string' || tail.length > 300) {
      problems.push(`${what}: stderrTail should be a string of at most 300 characters; got ${show(tail)}`);
      continue;
    }
    if (!tail.startsWith('strfry error: Failed to load config file') || !tail.includes('No such file or directory')) {
      problems.push(`${what}: stderrTail should keep the error's gist ("strfry error: Failed to load config file …" and "No such file or directory"); got ${show(tail)}`);
    }
    for (const [field, value] of [['message', e.message], ['stderrTail', tail]]) {
      const text = String(value);
      const needles = ['/etc', '[/', '/nonexistent'].filter((n) => text.includes(n));
      if (needles.length > 0 || ABSOLUTE_PATH_RE.test(text)) {
        problems.push(`${what}: the ScanError's ${field} carries an absolute path${needles.length ? ` (${needles.join(', ')})` : ''}: ${show(text)}`);
      }
    }
  }
  assert(problems.length === 0, problems.join('\n        '));
});

// ─── review round 3 (2026-09-28): the redactor's URI and IPv4 host:port rules, pinned directly ─────────────────────

/** A credentialed Bolt URI and a Bolt IPv4 host:port, as a Neo4j error repeats them (review round 3, first finding). */
const CRED_URI = 'bolt://neo4j:uri-secret-7f3a@neo4j.fake.invalid:7687';
const IPV4_HOST_PORT = '172.18.0.3:7687';

test('SS29: redactPublicText, exported beside scanStrict, replaces a credentialed URI (its host an IPv4 address or a name) with <uri> and an IPv4 host:port with <host>, keeps a relative module name and a clock time, and cuts a 64-hex run to 8 characters (story Deviations: "the one redactor"; review round 3: no test reached the URI or IPv4 rule)', () => {
  const mod = load();
  assert(typeof mod.redactPublicText === 'function',
    `src/lib/strfryScanStrict.js must export redactPublicText (story Deviations: "It exports scanStrict, ScanError and, since review round 1, redactPublicText"); its exports are ${show(Object.keys(mod))}`);
  const key = pubkeyOf('ss:redact-key');
  const problems = [];
  for (const [what, input, want] of [
    ['a credentialed URI whose host is a name', `Could not perform discovery for ${CRED_URI} (routing table empty)`, 'Could not perform discovery for <uri> (routing table empty)'],
    ['a credentialed URI whose host is an IPv4 address', `No routing servers available at bolt://neo4j:pw-3b1c@${IPV4_HOST_PORT}`, 'No routing servers available at <uri>'],
    ['an IPv4 host:port outside any URI', `connect ECONNREFUSED ${IPV4_HOST_PORT}`, 'connect ECONNREFUSED <host>'],
    ['a relative module name (kept)', "Cannot find module '../../lib/x'", "Cannot find module '../../lib/x'"],
    ['a clock time (kept: the name:port rule of ADR tagging-edges/0003 needs a letter-led name)', 'retry at 03:24:18 failed', 'retry at 03:24:18 failed'],
    ['a 64-hex run', `rejected ${key} twice`, `rejected ${key.slice(0, 8)} twice`],
  ]) {
    let got;
    try { got = mod.redactPublicText(input); } catch (e) { problems.push(`${what}: redactPublicText threw ${show(e.message)}`); continue; }
    if (got !== want) problems.push(`${what}: redactPublicText(${show(input)})\n          expected: ${show(want)}\n          actual:   ${show(got)}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('SS30: a "strfry error:" line naming a credentialed URI and an IPv4 host:port reaches stderrTail with both replaced — <uri> and <host> — and the rest of the line kept (the report carries stderrTail to a public route; review round 3)', async () => {
  const mod = load();
  const line = `strfry error: could not reach ws://relay:pw-9e2d@10.1.2.3:7777 (connect 10.1.2.3:7777 refused)`;
  const out = await withFake(MODES['stderr-error'](`INFO| starting\n${line}\n`), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  const e = rejectedWith(mod, out, 'exit', 'stderr-error mode with a credentialed URI and an IPv4 host:port (exit 1)');
  eq(e.stderrTail, 'strfry error: could not reach <uri> (connect <host> refused)',
    'stderrTail: the "strfry error:" line with its URI replaced by <uri> and its IPv4 host:port by <host>');
  for (const [field, value] of [['message', e.message], ['stderrTail', e.stderrTail]]) {
    for (const needle of ['pw-9e2d', '10.1.2.3']) {
      assert(!String(value).includes(needle), `the ScanError's ${field} carries ${show(needle)}: ${show(value)}`);
    }
  }
});

// ═══ Story 3 (ADR tagging-edges/0003): streaming, filter arrays, the argv escape and size check, the wider redactor ═══

const REALTIME_REQUIRE = '../src/lib/tagging-edges/realtime';
/** src/lib/tagging-edges/realtime.js, lazily (clarification T1: escapeFilterArgv and filterArgvBytes live there). */
function loadRealtime() {
  let m;
  try { m = require(REALTIME_REQUIRE); }
  catch (e) {
    throw new Error(`src/lib/tagging-edges/realtime.js not implemented yet (require('${REALTIME_REQUIRE}') failed: ${String(e.message).split(NL)[0]})`);
  }
  return m;
}
/** Clarification T1, the suite's own copy to compare with: JSON.stringify(filter) with every "/" written "\/". */
const escapedArgv = (filter) => JSON.stringify(filter).split('/').join('\\/');
const argvBytes = (filter) => Buffer.byteLength(escapedArgv(filter), 'utf8');
/** ADR 0003 LIMITS.argvFilterBytes: an argv filter text over this many bytes is refused before spawn. */
const ARGV_FILTER_BYTES = 100000;
/** The launcher's pgrep guard for the pass: the registry's script_relative_path (ADR 0003 "The launcher's pgrep guard"). */
const PASS_PGREP_PATTERN = 'pipeline/tagging-edges/reconcileTaggingEdges';

/**
 * A child process for spawnImpl that writes `stderr`, prints `stdout` and closes with `code` — no strfry and no shell,
 * so a 100 KB argv meets no host limit. kill() closes it with that signal, as a killed process would.
 */
function scriptedChild({ stdout = '', stderr = '', code = 0 } = {}) {
  const { EventEmitter } = require('events');
  const { PassThrough } = require('stream');
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = null;
  child.pid = 434343;
  let closed = false;
  const close = (c, s) => {
    if (closed) return;
    closed = true;
    child.stdout.end();
    child.stderr.end();
    setImmediate(() => { child.emit('exit', c, s); child.emit('close', c, s); });
  };
  child.kill = (sig = 'SIGTERM') => { close(null, sig); return true; };
  setImmediate(() => {
    if (closed) return;
    if (stderr) child.stderr.write(stderr);
    if (stdout) child.stdout.write(stdout);
    setImmediate(() => close(code, null));
  });
  return child;
}
/** A spawnImpl that records { cmd, args } of every call and answers with scriptedChild(answer). */
function recordingSpawn(answer = {}) {
  const calls = [];
  const spawnImpl = (cmd, args, opts) => { calls.push({ cmd, args: Array.isArray(args) ? args.slice() : args, opts }); return scriptedChild(answer); };
  spawnImpl.calls = calls;
  return spawnImpl;
}

/**
 * scanStrict with an onEvent collector: `{ out, got, at, late }` — `got` the events onEvent received in order, `at`
 * the Date.now() of each call, `late` the calls that came after the scan had settled (50 ms of watching).
 */
async function streamWith(mod, filter, options, ms) {
  const got = [];
  const at = [];
  const onEvent = (ev) => { got.push(ev); at.push(Date.now()); };
  const out = await scanWith(mod, filter, { ...options, onEvent }, ms);
  const settledCount = got.length;
  await new Promise((r) => setTimeout(r, 50));
  return { out, got, at, late: got.length - settledCount };
}
/** The streamed scan resolved; returns its value (events may be absent or empty — they are not kept). */
function streamedResolution(out, label) {
  assert(out !== 'HUNG' && out && 'value' in out, `${label}: expected scanStrict to resolve (a complete read); got ${describe(out)}`);
  assert(out.value && typeof out.value === 'object', `${label}: expected { lines, bytes, elapsedMs }; got ${show(out.value)}`);
  return out.value;
}
function notKept(v, label) {
  const ev = v.events;
  assert(ev === undefined || (Array.isArray(ev) && ev.length === 0),
    `${label}: with onEvent the result keeps no events (ADR tagging-edges/0003: "events not kept"); it holds ${Array.isArray(ev) ? `${ev.length} event(s)` : show(ev)}`);
}
const idsOf = (evs) => evs.map((e) => e && e.id);

test('SS31: with onEvent, each event goes to onEvent as its line is read — in the order strfry printed it, unchanged, an event from an early pipe write before a later write arrives — and none is kept: the result carries no events, only its line and byte counts, and nothing reaches onEvent after it resolves (ADR tagging-edges/0003 § Amendments, "New files": "An additive onEvent streaming option"; Implementation notes: "events not kept")', async () => {
  const mod = load();
  const s = await withFake(MODES.ok(), () => streamWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  const v = streamedResolution(s.out, 'ok mode with onEvent (four event lines, exit 0)');
  same(s.got, OK_EVENTS, 'the events onEvent received, in order and unchanged');
  notKept(v, 'ok mode with onEvent');
  eq(v.lines, OK_EVENTS.length, 'lines: one per event line read');
  eq(v.bytes, Buffer.byteLength(OK_STDOUT, 'utf8'), 'bytes: every stdout byte read');
  eq(s.late, 0, 'onEvent calls after the scan resolved');

  // Two pipe writes 0.3 s apart (the fake pauses between parts): a streaming reader hands over the first write's events
  // before the second write exists; a reader that buffers until close hands all four over at once.
  const parts = [linesOf(OK_EVENTS.slice(0, 2)), linesOf(OK_EVENTS.slice(2))];
  const split = await withFake({ parts, finish: 0 }, () => streamWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  streamedResolution(split.out, 'two pipe writes 0.3 s apart, with onEvent');
  same(idsOf(split.got), idsOf(OK_EVENTS), 'events onEvent received across the two writes');
  const gap = split.at.length === 4 ? split.at[2] - split.at[1] : null;
  assert(gap !== null && gap >= 200,
    `onEvent should get the first write's events as their lines are read, about 0.3 s before the second write's; the gap between the 2nd and 3rd calls was ${show(gap)} ms`);

  const events = manyTaggings(3000, { prefix: 'ss-stream' });
  const big = await withFake({ parts: [linesOf(events)], finish: 0 }, () => streamWith(mod, FILTER, { isExpected: IS_EXPECTED }, 30000));
  const vb = streamedResolution(big.out, '3,000 event lines with onEvent');
  eq(big.got.length, events.length, 'events onEvent received from a 3,000-line scan');
  eq(big.got.length && big.got[big.got.length - 1].id, events[events.length - 1].id, 'the last event onEvent received is the last printed');
  notKept(vb, '3,000 event lines with onEvent');
  eq(vb.lines, events.length, 'lines of the 3,000-line scan');
});

test('SS32: with onEvent every completeness rule still holds — a duplicate, a truncated last line, an off-filter event, a stdout over maxBytes, a line that is not JSON, one that is not an event, and a non-zero exit each still reject with their code; the events read before the failing line reached onEvent, and the line a rule refuses (the repeat, the unterminated line, the off-filter event) never does (ADR tagging-edges/0003: "every completeness rule unchanged"; clarification T31: "onEvent delivers each event as it is parsed, so events before a later failure have already been delivered. The scan still rejects.")', async () => {
  const mod = load();
  const offNote = makeTagging({ d: 'ss-stream-kind-1', id: idOf('ss:stream:kind1'), kind: 1, stamps: [] });
  const size = Buffer.byteLength(OK_STDOUT, 'utf8');
  const list = [
    { what: 'the same event line twice, a tag element between (dup-id mode)', mode: MODES['dup-id'](TAGGING_CANON, TAGGING_CANON), isExpected: ACCEPT_ALL, code: 'duplicate', mustHave: [TAGGING_CANON, ELEMENT], once: TAGGING_CANON.id },
    { what: 'four event lines, the last with no final newline (truncated mode)', mode: MODES.truncated(), isExpected: IS_EXPECTED, code: 'truncated', mustHave: OK_EVENTS.slice(0, 3), mustNot: [OK_EVENTS[3]] },
    { what: 'a kind-1 note isExpected refuses, between two expected lines (off-filter mode)', mode: MODES['off-filter'](offNote), isExpected: IS_EXPECTED, code: 'off-filter', mustHave: [TAGGING_CANON], mustNot: [offNote] },
    { what: `a ${size}-byte stdout with maxBytes ${size - 1}`, mode: MODES['too-large'](), isExpected: IS_EXPECTED, maxBytes: size - 1, code: 'too-large', mustHave: [] },
    { what: 'a strfry log line between two event lines (logline mode)', mode: MODES.logline('strfry: a log line, not an event'), isExpected: IS_EXPECTED, code: 'unparseable', mustHave: [TAGGING_CANON] },
    { what: 'a line that is a number, between two event lines (not-object mode)', mode: MODES['not-object']('42'), isExpected: ACCEPT_ALL, code: 'not-an-event-line', mustHave: [TAGGING_CANON] },
    { what: 'four valid event lines, then exit 1 (fail mode)', mode: MODES.fail(), isExpected: IS_EXPECTED, code: 'exit', mustHave: OK_EVENTS },
  ];
  const problems = [];
  for (const c of list) {
    const opts = { isExpected: c.isExpected };
    if (c.maxBytes !== undefined) opts.maxBytes = c.maxBytes;
    const s = await withFake(c.mode, () => streamWith(mod, FILTER, opts));
    try { rejectedWith(mod, s.out, c.code, `${c.what}, with onEvent`); } catch (e) { problems.push(e.message); }
    const got = idsOf(s.got);
    const want = idsOf(c.mustHave);
    if (show(got.slice(0, want.length)) !== show(want)) {
      problems.push(`${c.what}: onEvent should have received the ${want.length} event(s) read before the failing line, in order; it received ${got.length}: ${show(got.map((x) => String(x).slice(0, 8)))}`);
    }
    for (const ev of c.mustNot || []) {
      if (got.includes(ev.id)) problems.push(`${c.what}: onEvent received the event the rule refuses (${ev.id.slice(0, 8)})`);
    }
    if (c.once && got.filter((x) => x === c.once).length > 1) problems.push(`${c.what}: onEvent received the repeated event twice`);
    const printed = new Set(idsOf([...OK_EVENTS, offNote]));
    const stray = got.filter((x) => !printed.has(x));
    if (stray.length) problems.push(`${c.what}: onEvent received events strfry never printed: ${show(stray)}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('SS33: a filter may be an array of filters — strfry receives the array as its one filter argument (parsed back, equal to it; 2 and 200 one-address filters), and the scan reads its events as usual (ADR tagging-edges/0003 § Amendments: "The filter may be an array"; binding 3, batched: one {kinds:[39999], authors:[pk], "#d":[d]} per address, ≤ 200 per scan)', async () => {
  const mod = load();
  const two = [
    { kinds: [39999], authors: [ALICE], '#d': [D] },
    { kinds: [39999], authors: [CAROL], '#d': ['ss-array-second'] },
  ];
  const many = Array.from({ length: 200 }, (_, i) => ({ kinds: [39999], authors: [pubkeyOf(`ss:array:${i}`)], '#d': [`ss-array-${i}`] }));
  for (const [label, filters] of [['a filter array of two one-address filters', two], ['a filter array of 200 one-address filters', many]]) {
    const seen = await withFake(MODES.ok(), async (fake) => ({
      out: await scanWith(mod, filters, { isExpected: ACCEPT_ALL }),
      invocations: fake.invocations(), arg1: fake.arg1(), arg2: fake.arg2(),
    }));
    const r = resolvedWith(seen.out, `ok mode, ${label}`);
    same(r.events, OK_EVENTS, `${label}: the events read`);
    same(seen.invocations, [2], `${label}: strfry runs once, with two arguments`);
    eq(seen.arg1, 'scan', `${label}: strfry's first argument`);
    let passed;
    try { passed = JSON.parse(seen.arg2); } catch { passed = undefined; }
    assert(Array.isArray(passed), `${label}: strfry's second argument should be the filter array as JSON; it received ${show(clip(seen.arg2, 200))}`);
    same(passed, filters, `${label}: the filter array strfry received (parsed from its second argument)`);
  }
});

test('SS34: the filter strfry receives on argv writes every "/" as "\\/" — for an object and for an array — so a publisher\'s #d naming the pass\'s pgrep pattern never puts "pipeline/tagging-edges/reconcileTaggingEdges" on a command line; the text parses back to the filter, and a filter with no "/" is plain JSON (ADR tagging-edges/0003 § Where it runs: "scanStrict writes / as \\/ in the filter it puts on argv", AC-5; clarification T1)', async () => {
  const mod = load();
  const slashed = { kinds: [39999], authors: [ALICE], '#d': [PASS_PGREP_PATTERN, 'a/b//c'] };
  const list = [
    ['an object whose #d names the pgrep pattern', slashed],
    ['an array whose filters carry "/" in #d', [slashed, { kinds: [39999], authors: [CAROL], '#d': [`x/${PASS_PGREP_PATTERN}/y`] }]],
    ['a filter with no "/"', { kinds: [39999], authors: [ALICE], '#d': [D] }],
  ];
  const problems = [];
  for (const [label, filter] of list) {
    const spawnImpl = recordingSpawn();
    const out = await scanWith(mod, filter, { isExpected: ACCEPT_ALL, spawnImpl });
    try { resolvedWith(out, `${label} (an empty read)`); } catch (e) { problems.push(e.message); continue; }
    if (spawnImpl.calls.length !== 1) { problems.push(`${label}: spawnImpl should be called once; it was called ${spawnImpl.calls.length} time(s)`); continue; }
    const { cmd, args } = spawnImpl.calls[0];
    if (cmd !== 'strfry' || !Array.isArray(args) || args.length !== 2 || args[0] !== 'scan') {
      problems.push(`${label}: spawnImpl should get ('strfry', ['scan', <filter>]); it got (${show(cmd)}, ${show(args && clip(show(args), 200))})`);
      continue;
    }
    if (args[1] !== escapedArgv(filter)) {
      problems.push(`${label}: the filter argument should be JSON.stringify(filter) with every "/" written "\\/" (T1)\n          expected: ${clip(escapedArgv(filter), 300)}\n          actual:   ${clip(String(args[1]), 300)}`);
    }
    let parsed;
    try { parsed = JSON.parse(args[1]); } catch { parsed = undefined; }
    if (show(sortKeys(parsed)) !== show(sortKeys(filter))) problems.push(`${label}: the filter argument does not parse back to the filter; it parses to ${clip(show(parsed), 300)}`);
    if (args.join(' ').includes(PASS_PGREP_PATTERN)) problems.push(`${label}: the command line carries the pass's pgrep pattern ${PASS_PGREP_PATTERN}, so the launcher would skip a pass (AC-5)`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('SS35: the argv filter\'s byte size after the "\\/" escape is checked before spawn — over 100,000 bytes rejects ScanError "filter-too-large" with spawnImpl never called (a filter whose plain JSON fits but whose escaped text does not; 100,001 bytes; over in UTF-8 bytes but not in characters; an array over in total), and exactly 100,000 escaped bytes is spawned (ADR tagging-edges/0003 round step 2: "The byte size of the final argv text (after \\/ escaping) is checked inside scanStrict before spawning. Over 100,000 bytes it refuses"; LIMITS.argvFilterBytes)', async () => {
  const mod = load();
  const withD = (s) => ({ kinds: [39999], '#d': [s] });
  const baseLen = argvBytes(withD(''));
  const slashy = withD('a/'.repeat(40000));
  const over1 = withD('x'.repeat(ARGV_FILTER_BYTES + 1 - baseLen));
  const wide = withD('é'.repeat(60000));
  const arr = [withD('x'.repeat(50000)), withD('y'.repeat(50000))];
  const exact = withD('x'.repeat(ARGV_FILTER_BYTES - baseLen));
  const exactSlashed = withD('/'.repeat(20000) + 'x'.repeat(ARGV_FILTER_BYTES - baseLen - 40000));
  // The fixtures, checked with the suite's own copy of the escape.
  assert(Buffer.byteLength(JSON.stringify(slashy), 'utf8') <= ARGV_FILTER_BYTES && argvBytes(slashy) > ARGV_FILTER_BYTES, 'fixture: slashy fits plain but not escaped');
  assert(argvBytes(over1) === ARGV_FILTER_BYTES + 1, `fixture: over1 is 100,001 bytes (${argvBytes(over1)})`);
  assert(escapedArgv(wide).length <= ARGV_FILTER_BYTES && argvBytes(wide) > ARGV_FILTER_BYTES, 'fixture: wide fits in characters but not in bytes');
  assert(arr.every((f) => argvBytes(f) < ARGV_FILTER_BYTES) && argvBytes(arr) > ARGV_FILTER_BYTES, 'fixture: each array member fits, the array does not');
  assert(argvBytes(exact) === ARGV_FILTER_BYTES && argvBytes(exactSlashed) === ARGV_FILTER_BYTES, 'fixture: the at-limit filters are exactly 100,000 escaped bytes');
  const problems = [];
  for (const [label, filter] of [
    ['a #d of "a/" × 40,000 (80 KB plain, 120 KB escaped)', slashy],
    ['a filter of 100,001 escaped bytes', over1],
    ['a #d of "é" × 60,000 (60k characters, 120 KB of UTF-8)', wide],
    ['an array of two 50 KB filters', arr],
  ]) {
    const spawnImpl = recordingSpawn();
    const out = await scanWith(mod, filter, { isExpected: ACCEPT_ALL, spawnImpl });
    try { rejectedWith(mod, out, 'filter-too-large', `${label} (${argvBytes(filter)} escaped bytes)`); } catch (e) { problems.push(e.message); }
    if (spawnImpl.calls.length !== 0) problems.push(`${label}: spawnImpl was called ${spawnImpl.calls.length} time(s); the size check comes before spawn`);
  }
  for (const [label, filter] of [
    ['a filter of exactly 100,000 bytes, no "/"', exact],
    ['a filter of exactly 100,000 bytes after 20,000 "/" are escaped', exactSlashed],
  ]) {
    const spawnImpl = recordingSpawn();
    const out = await scanWith(mod, filter, { isExpected: ACCEPT_ALL, spawnImpl });
    try { resolvedWith(out, `${label} (at the limit: spawned, an empty read)`); } catch (e) { problems.push(e.message); }
    if (spawnImpl.calls.length !== 1) problems.push(`${label}: spawnImpl should be called once at the limit; it was called ${spawnImpl.calls.length} time(s)`);
    else if (spawnImpl.calls[0].args[1] !== escapedArgv(filter)) problems.push(`${label}: the argv filter should be the escaped text (${argvBytes(filter)} bytes); it was ${Buffer.byteLength(String(spawnImpl.calls[0].args[1]), 'utf8')} bytes, ${String(spawnImpl.calls[0].args[1]).includes('\\/') ? 'escaped' : 'not escaped'}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('SS36: escapeFilterArgv is exported beside scanStrict and is the very function src/lib/tagging-edges/realtime.js exports — JSON.stringify(filter) with every "/" written "\\/", for an object, an array and a filter with no "/" (clarification T1: strfryScanStrict.js "requires them from ./tagging-edges/realtime and re-exports escapeFilterArgv, so scanStrict and the planner size filters with the one escape")', () => {
  const mod = load();
  assert(typeof mod.escapeFilterArgv === 'function',
    `src/lib/strfryScanStrict.js must re-export escapeFilterArgv (clarification T1); its exports are ${show(Object.keys(mod))}`);
  const rt = loadRealtime();
  assert(typeof rt.escapeFilterArgv === 'function', `src/lib/tagging-edges/realtime.js must export escapeFilterArgv (T1, T2); its exports are ${show(Object.keys(rt))}`);
  assert(mod.escapeFilterArgv === rt.escapeFilterArgv, 'strfryScanStrict.escapeFilterArgv must be realtime.js\'s own function, re-exported (T1: "the one escape"), not a copy');
  const problems = [];
  for (const [label, filter] of [
    ['an object with "/" in #d and #a', { kinds: [39999], authors: [ALICE], '#d': ['a/b'], '#a': [`39999:${JACK}:x/y`] }],
    ['an array', [{ kinds: [5], authors: [ALICE], '#e': [idOf('ss:esc')] }, { kinds: [39999], '#d': ['//'] }]],
    ['a filter with no "/"', FILTER],
  ]) {
    let got;
    try { got = mod.escapeFilterArgv(filter); } catch (e) { problems.push(`${label}: escapeFilterArgv threw ${show(e.message)}`); continue; }
    if (got !== escapedArgv(filter)) problems.push(`${label}: escapeFilterArgv(filter)\n          expected: ${clip(escapedArgv(filter), 300)}\n          actual:   ${clip(show(got), 300)}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

// Clarification T31, "Redaction": the widened rule may cut a tagging address whose d starts with 2–5 digits (the ADR's
// New debt), so SS37 pins only letter-led d values (D is profile-tag-…) and leaves the digit-led case unpinned.
/** A 64-hex pubkey that starts with a letter, so the name:port rule's "letter-led name" could reach it. */
const LETTER_LED = `c${idOf('ss:letter-led').slice(1)}`;

test('SS37: redactPublicText, widened for CF-3, replaces a letter-led host name with a port — dotted or single-label: neo4j.internal:7687, neo4j:7687, localhost:7687, redis:6379 — and a bracketed IPv6 host:port ([::1]:7687, [2001:db8::17]:7687) with <host>; bolt URIs stay <uri> and an IPv4 host:port <host>; a relative path, a clock time, and tagging addresses and stamps inside text keep everything but the 64-hex cut (ADR tagging-edges/0003 owner decision 6; Implementation notes: "<name>:<2-5 digits> (a letter-led single-label or dotted name) and [<ipv6>]:<port> with <host>"; story "For Test Design": neo4j.internal:7687 and [::1]:7687)', () => {
  const mod = load();
  assert(typeof mod.redactPublicText === 'function', `src/lib/strfryScanStrict.js must export redactPublicText; its exports are ${show(Object.keys(mod))}`);
  const cut = (pk) => pk.slice(0, 8);
  assert(/^[a-f]/.test(LETTER_LED) && /^[a-f]/.test(CANONICAL), 'fixture: the letter-led pubkeys start with a letter');
  const problems = [];
  for (const [what, input, want] of [
    ['a dotted host name and port', 'connect ECONNREFUSED neo4j.internal:7687', 'connect ECONNREFUSED <host>'],
    ['a single-label host name and port', 'Could not perform discovery for neo4j:7687', 'Could not perform discovery for <host>'],
    ['localhost and port', 'connect ECONNREFUSED localhost:7687', 'connect ECONNREFUSED <host>'],
    ['redis:6379, as strfry names it', "Couldn't connect to redis:6379 (retrying)", "Couldn't connect to <host> (retrying)"],
    ['[::1]:7687', 'connect ECONNREFUSED [::1]:7687', 'connect ECONNREFUSED <host>'],
    ['a longer bracketed IPv6 host:port', 'connect ETIMEDOUT [2001:db8::17]:7687 after 30 s', 'connect ETIMEDOUT <host> after 30 s'],
    ['a bolt URI with a dotted host', 'Could not perform discovery for bolt://neo4j.internal:7687', 'Could not perform discovery for <uri>'],
    ['a bolt URI with an IPv6 host', 'no routing servers at bolt://[::1]:7687', 'no routing servers at <uri>'],
    ['a credentialed neo4j+s URI', 'failed: neo4j+s://neo4j:pw-51ab@db.example.com:7687 refused', 'failed: <uri> refused'],
    ['an IPv4 host:port (still <host>)', 'connect ECONNREFUSED 172.18.0.3:7687', 'connect ECONNREFUSED <host>'],
    ['a relative module name (kept)', "Cannot find module '../../lib/x'", "Cannot find module '../../lib/x'"],
    ['a clock time (kept)', 'retry at 03:24:18 failed', 'retry at 03:24:18 failed'],
    ['a tagging address by a letter-led author (only the 64-hex cut)', `refused 39999:${LETTER_LED}:${D} twice`, `refused 39999:${cut(LETTER_LED)}:${D} twice`],
    ['a tagging address by a digit-led author (only the 64-hex cut)', `refused 39999:${ALICE}:${D}`, `refused 39999:${cut(ALICE)}:${D}`],
    ['a tag address (only the 64-hex cut)', `tag 39999:${JACK}:podcaster not found`, `tag 39999:${cut(JACK)}:podcaster not found`],
    ['a nostr-user-tag stamp (only the 64-hex cut)', `stamp 39998:${CANONICAL}:nostr-user-tag`, `stamp 39998:${cut(CANONICAL)}:nostr-user-tag`],
  ]) {
    let got;
    try { got = mod.redactPublicText(input); } catch (e) { problems.push(`${what}: redactPublicText threw ${show(e.message)}`); continue; }
    if (got !== want) problems.push(`${what}: redactPublicText(${show(input.length > 160 ? `${input.slice(0, 160)}…` : input)})\n          expected: ${show(want)}\n          actual:   ${show(got)}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

test('SS38: a "strfry error:" line naming host:port values the widened redactor covers — redis:6379 (which strfry\'s stderr always names), neo4j.internal:7687 and [::1]:7687 — reaches stderrTail with each replaced by <host> and the rest of the line kept, and none of them reaches the ScanError\'s message or stderrTail (ADR tagging-edges/0003 § Status and switch: "strfry stderr (which always names redis:6379)"; owner decision 6, CF-3)', async () => {
  const mod = load();
  const line = 'strfry error: could not reach redis:6379, then neo4j.internal:7687 and [::1]:7687';
  const out = await withFake(MODES['stderr-error'](`INFO| starting\n${line}\n`), () => scanWith(mod, FILTER, { isExpected: IS_EXPECTED }));
  const e = rejectedWith(mod, out, 'exit', 'stderr-error mode with three host:port values (exit 1)');
  eq(e.stderrTail, 'strfry error: could not reach <host>, then <host> and <host>',
    'stderrTail: the "strfry error:" line with redis:6379, neo4j.internal:7687 and [::1]:7687 each replaced by <host>');
  for (const [field, value] of [['message', e.message], ['stderrTail', e.stderrTail]]) {
    for (const needle of ['redis:6379', 'neo4j.internal', ':7687', '[::1]']) {
      assert(!String(value).includes(needle), `the ScanError's ${field} carries ${show(needle)}: ${show(value)}`);
    }
  }
});

test('SS39: an off-filter rejection says the event was refused by the caller\'s isExpected — with and without onEvent (ADR tagging-edges/0003 Changed files: "the off-filter text becomes \'refused by the caller\'s isExpected\'"; § Amendments: "The off-filter rule becomes \'an event the caller\'s isExpected refuses\'")', async () => {
  const mod = load();
  const vetoed = makeTagging({ d: 'ss-veto-text', id: idOf('ss:veto-text') });
  const isExpected = (ev) => IS_EXPECTED(ev) && ev.id !== vetoed.id;
  const problems = [];
  for (const [label, extra] of [['without onEvent', {}], ['with onEvent', { onEvent: () => {} }]]) {
    const out = await withFake(MODES['off-filter'](vetoed), () => scanWith(mod, FILTER, { isExpected, ...extra }));
    let e;
    try { e = rejectedWith(mod, out, 'off-filter', `a tagging the injected isExpected vetoes, ${label}`); } catch (err) { problems.push(err.message); continue; }
    if (!/refused by the caller'?s isExpected/i.test(String(e.message))) problems.push(`${label}: the off-filter message should say "refused by the caller's isExpected"; it says ${show(e.message)}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

// ─── found by the mutation pass over story 3's blind reference implementation ──────────────────────────────────
test('SS40: an onEvent that throws rejects the scan with the handler\'s own error and the scan never resolves — whether it throws on the first of four events (more lines follow) or on the last (the stdout complete and strfry exiting 0 after it): a failed handler is never swallowed, so a scan whose caller could not take an event never reads as a complete, partial or empty read (the reader\'s header: the caller\'s handler failed → reject, never an empty or partial read; ADR tagging-edges/0003: the onEvent streaming option with "every completeness rule unchanged"; clarification T31: "The scan still rejects"; story 2 AC-4: a read that fails changes nothing)', async () => {
  const mod = load();
  const problems = [];
  for (const [label, throwOn] of [['thrown on the first event', 1], ['thrown on the last event', OK_EVENTS.length]]) {
    const thrown = new Error(`onEvent handler failed (${label})`);
    let calls = 0;
    const onEvent = () => { calls += 1; if (calls === throwOn) throw thrown; };
    const out = await scanWith(mod, FILTER, { isExpected: IS_EXPECTED, onEvent, spawnImpl: recordingSpawn({ stdout: OK_STDOUT }), timeoutMs: 5000 }, 3000);
    if (calls < throwOn) {
      problems.push(`${label}: onEvent was called ${calls} time(s) for ${OK_EVENTS.length} event lines, so it never threw — scanStrict should hand each event to onEvent as its line is read (ADR tagging-edges/0003: "An additive onEvent streaming option")`);
      continue;
    }
    if (out === 'HUNG' || !out || !('error' in out)) {
      problems.push(`${label}: expected scanStrict to reject with the handler's error; got ${describe(out)}`);
      continue;
    }
    const e = out.error;
    const carries = e === thrown || (e && e.cause === thrown) || (e && typeof e.message === 'string' && e.message.includes(thrown.message));
    if (!carries) problems.push(`${label}: the rejection should be the handler's own error (or one that names it); got ${describe(out)}`);
  }
  assert(problems.length === 0, problems.join('\n        '));
});

// ═══ Story 3's review, round 2 (2026-09-29): the redactor's 4 KB cut ═══════════════════════════════════════════════

/** redactPublicText's input bound: 4 KB of text (ADR tagging-edges/0003, New debt: "It cuts its input to 4 KB first"). */
const REDACT_CUT = 4096;
/** Filler with none of the tokens' characters' 4-character runs, ending in whitespace, exactly `n` characters long. */
const fillerOf = (n) => `${'qq qqq '.repeat(Math.ceil(n / 7)).slice(0, n - 1)} `;
/** Every 4-character run of `s` (the pieces a leak would show). */
const pieces4 = (s) => { const out = new Set(); for (let i = 0; i + 4 <= s.length; i += 1) out.add(s.slice(i, i + 4)); return [...out]; };

test('SS41: redactPublicText cuts its input to 4 KB before any rule runs, and a cut never lets part of a token out — a credentialed URI, a host name with its port, or an IPv4 address with its port that straddles the 4,096th character, wherever the mark falls inside it, comes out with no 4-character piece of its secret or its host; an input of at most 4 KB is redacted whole, not cut; an input with no whitespace in its first 4 KB comes out empty, a credential inside it included; and a 1 MB input — dotted and hyphenated text (the name rule\'s slow case), with whitespace every 1,000 characters or none at all — returns within a generous 1 s with at most 4 KB of text (ADR tagging-edges/0003 § Consequences, New debt: "It cuts its input to 4 KB first"; strfryScanStrict.js: "Text past 4 KB is cut first, back to the last whitespace within it, so no rule runs on long input … and no token is split into a part the rules no longer recognise"; review round 2, R2-NB3: "no test pins the 4 KB cap")', () => {
  const mod = load();
  assert(typeof mod.redactPublicText === 'function', `src/lib/strfryScanStrict.js must export redactPublicText; its exports are ${show(Object.keys(mod))}`);
  const redact = mod.redactPublicText;
  const problems = [];
  const TOKENS = [
    { what: 'a credentialed URI', token: 'bolt://svcuser:Pw4kStraddle9@db-west.fake.invalid:7687', secret: ['Pw4kStraddle9', 'db-west.fake.invalid'] },
    { what: 'a host name and port', token: 'db-west.fake.invalid:7687', secret: ['db-west.fake.invalid'] },
    { what: 'an IPv4 address and port', token: '10.20.30.40:7687', secret: ['10.20.30.40'] },
  ];
  for (const { what, token, secret } of TOKENS) {
    const bad = secret.flatMap(pieces4);
    for (let k = 1; k < token.length; k += 1) {
      const input = `${fillerOf(REDACT_CUT - k)}${token} and more text after it`;
      let got;
      try { got = redact(input); } catch (e) { problems.push(`${what}, ${k} of its characters within 4 KB: redactPublicText threw ${show(e.message)}`); continue; }
      const seen = bad.filter((p) => got.includes(p));
      if (seen.length > 0) problems.push(`${what}, ${k} of its ${token.length} characters within the first 4 KB: the output shows ${show(seen.slice(0, 4))} (its end: ${show(got.slice(-60))})`);
      if (got.length > REDACT_CUT) problems.push(`${what}, split at ${k}: the output is ${got.length} characters, over 4 KB`);
    }
    const whole = `${fillerOf(REDACT_CUT - token.length)}${token}`;
    const got = redact(whole);
    if (!(got.endsWith('<uri>') || got.endsWith('<host>'))) problems.push(`${what} ending an input of exactly 4 KB: redacted whole, not cut (it should end in <uri> or <host>); its end: ${show(got.slice(-60))}`);
  }
  for (const [what, input] of [
    ['5,000 characters with no whitespace', 'q'.repeat(5000)],
    ['4 KB with no whitespace, then more text', `${'q'.repeat(REDACT_CUT)} and more text`],
    ['a credentialed URI inside a long run with no whitespace', `${'q'.repeat(100)}bolt://svcuser:Pw4kStraddle9@db-west.fake.invalid:7687/${'q'.repeat(5000)} tail`],
  ]) {
    const got = redact(input);
    if (got !== '') problems.push(`${what}: expected empty output, got ${got.length} characters (${show(got.slice(0, 60))}…)`);
  }
  // The 1 MB inputs run in a child Node process with a wall-clock limit: without the cut, the name rule takes hours on
  // them (a synchronous regex no timer can interrupt), so a regression fails here in seconds instead of hanging.
  const child = childProcess.spawnSync(process.execPath, ['-e', `
    const { redactPublicText } = require(${JSON.stringify(require.resolve(MODULE_REQUIRE))});
    const dotted = 'a-b.c-d.e-f.g-h.';
    const out = [];
    for (const [what, input] of [
      ['1 MB of dotted, hyphenated text with whitespace every 1,000 characters', (dotted.repeat(62).slice(0, 999) + ' ').repeat(1049)],
      ['1 MB of dotted, hyphenated text with no whitespace', dotted.repeat(65536)],
    ]) {
      const t0 = process.hrtime.bigint();
      const got = redactPublicText(input);
      out.push({ what, chars: input.length, ms: Number(process.hrtime.bigint() - t0) / 1e6, outChars: got.length });
    }
    process.stdout.write(JSON.stringify(out) + '\\n');
  `], { encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024 });
  if (child.error || child.status !== 0) {
    problems.push(`the 1 MB inputs: the child ${child.error && child.error.code === 'ETIMEDOUT' ? 'did not finish within 20 s of real time' : `failed (status ${child.status}, signal ${child.signal}): ${clip(String(child.stderr || ''), 300)}`} — redactPublicText must cut long input before any rule runs`);
  } else {
    for (const r of JSON.parse(String(child.stdout).trim().split('\n').pop())) {
      if (r.ms > 1000) problems.push(`${r.what} (${r.chars} characters): redactPublicText took ${r.ms.toFixed(0)} ms (the bound is a generous 1 s; the 4 KB cut makes it a few ms)`);
      if (r.outChars > REDACT_CUT) problems.push(`${r.what}: the output is ${r.outChars} characters, over 4 KB`);
    }
  }
  // The first ten and the last two (the 1 MB checks come last), with a count of those between.
  const shown = problems.length > 12 ? [...problems.slice(0, 10), `… ${problems.length - 12} more …`, ...problems.slice(-2)] : problems;
  assert(problems.length === 0, shown.join('\n        '));
});

async function run() {
  console.log('\n--- strict strfry scan reader (epic tagging-edges, Story 2; ADR 0002 D2) ---');
  let pass = 0, fail = 0;
  const failures = [];
  try {
    for (const [name, fn] of tests) {
      try { await fn(); console.log(`  PASS  ${name}`); pass++; }
      catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
    }
  } finally { removeFakeBin(); }
  console.log(`\nstrfry-scan-strict: ${pass} passed, ${fail} failed`);
  return { pass, fail, skipped: 0, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
