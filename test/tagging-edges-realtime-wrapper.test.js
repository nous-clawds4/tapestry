'use strict';
/**
 * Tests for Story 3 (epic tagging-edges) — the real-time path's supervisord wrapper,
 * src/pipeline/tagging-edges/realtime/run.sh, run in child processes.
 *
 * Story: engineering-team/stories/tagging-edges/3-real-time-path.md — AC-5 (off by default; off means off; recovers
 *        alone; alongside the pass), AC-3 (a bad setup writes nothing), and "For Test Design → The switch and status".
 * ADR:   engineering-team/decisions/tagging-edges/0003-real-time-path.md — the Decision diagram, § "Where it runs
 *        (D2-A)" (the program block and "The wrapper run.sh"), § "Status and switch (D8-A)" ("The wrapper does not
 *        restart Node while the switch is off"), § "Knowing what changed while it was away" (the state table:
 *        daemon.lock "by the wrapper"), C20, and "Clarifications (Test Design)" T23 (the wrapper's test seams), T24 and
 *        T28 (the wrapper's details: flock and sleep through PATH, index.js beside run.sh, `&&` in the per-start
 *        subshell, backoff sleeps in the background, bash-3.2-compatible), and T34 (the healthy-run seam
 *        TAGGING_EDGES_REALTIME_HEALTHY_SECONDS; RW22, added from the mutation pass over the blind reference).
 *
 * Intentionally failing until run.sh lands (red phase). The script is looked up LAZILY inside each test through
 * load(), so this suite always loads, and each test fails with "… run.sh not implemented yet" rather than an error of
 * the suite's own.
 *
 * How it runs. Every wrapper is started as supervisord starts it — `bash <repo>/src/pipeline/tagging-edges/realtime/run.sh`
 * — in its own process group, from a throwaway working directory, with (T23):
 *   TAGGING_EDGES_STATE_DIR               a temp state dir (switch.json and daemon.lock live in <it>/realtime/);
 *   BRAINSTORM_CONF                       a temp conf of `export …` lines, as /etc/brainstorm.conf is, carrying a
 *                                         marker variable, plus BRAINSTORM_MODULE_{BASE,SRC,PIPELINE}_DIR pointing at
 *                                         a DECOY install directory: run.sh finds index.js beside itself (T28), so a
 *                                         path built from those variables, or a fixed install path, is caught (RW4);
 *   TAGGING_EDGES_REALTIME_POLL_SECONDS=1 the switch poll (3 in the backoff scenarios, so a poll sleep is never
 *                                         mistaken for a backoff sleep of 1, 2, 4, 8, 16 or 30 s);
 *   TAGGING_EDGES_REALTIME_HEALTHY_SECONDS=3  (RW22 only; T34) the healthy-run threshold, so a healthy run takes
 *                                         seconds, not a minute;
 *   PATH                                  the test's `sleep`, a stub `node`, and the test's `flock`, before the host's
 *                                         PATH. The stub node records one line per start (its pid, argv, cwd, the
 *                                         marker variables, TAGGING_EDGES_STATE_DIR, and — where asked — the inode
 *                                         fd 8 is open on) and then sleeps until TERM (recording the signal, taking
 *                                         1 s to stop), exits at once with a chosen code, holds until the test
 *                                         releases it, or runs a set number of seconds and then exits (a behaviour
 *                                         may be set per start). No real node, Neo4j, strfry or network is involved;
 *                                         the stub's one use of the real node is fstat(8), and its own sleeps call
 *                                         the host's sleep by absolute path, so they never reach the test's `sleep`.
 * The switch file is written as the owner route writes it: the canonical compact form, atomically (ADR § D3's table).
 * All scenarios run concurrently (each with its own temp dirs) the first time a test needs one, so the whole suite
 * takes about 10 s; each test then asserts on the observations of its scenario. Every wrapper's process group is
 * SIGKILLed and waited out when its scenario ends (and again at process exit, as a safety net), and the temp root under
 * os.tmpdir() is removed when the suite ends.
 *
 * flock and sleep through PATH (T28 "run.sh calls flock and sleep through PATH (bare names), as it does node").
 *   - `flock`: on a host with flock(1) (Linux, the container, CI) the test's `flock` is a passthrough that runs the
 *     host's flock(1) and logs the call; on a host without it (macOS) it is a perl shim implementing flock(1)'s fd form
 *     (`flock [-n] [-x|-s] [-u] [-w secs] [-E code] FD`) over flock(2) — the same kernel lock, released when the last
 *     descriptor closes — and logging the call. Either way every call is logged as "<args>\t<ok|busy|…>", and RW17
 *     pins that each wrapper takes `flock -n 8` through PATH. With neither flock(1) nor perl, every test is skipped.
 *   - `sleep`: the test's `sleep` logs its argument and then, per scenario, (default) returns at once for a sleep of
 *     10 s or more and runs the host's sleep otherwise — so the second instance's `sleep 30; exit 75` is seen to exit
 *     75 inside the window (RW14); ("fast") returns at once for the first 12 calls, so the whole 1→2→4…30 s backoff
 *     is seen in well under a second (RW18, RW19; RW22 around its healthy run); or ("stretch") makes every sleep
 *     but the poll's last 20 s, so a TERM during a backoff sleep can be seen to be handled at once, not when the sleep
 *     ends (RW20).
 *   - No bash: every test is skipped, with a note.
 * The wrapper runs under the host's bash (3.2 on macOS, 5.x in the container). RW21 is a cheap, heuristic static check
 * for bash-4-only syntax, plus `bash -n` under every bash this host has (a 3.x one where present).
 *
 * Every pubkey-like value is a fake from test/helpers/taggingEdgesFixtures.js (the switch's changedBy prefix):
 * never a deployment's TA pubkey and never the ADR 0015 literal. No test sends a request to any host.
 *
 * Hand-rolled in the project's existing test style — no new framework. Runs on Node 16 and 22 (CommonJS).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const F = require('./helpers/taggingEdgesFixtures');

const REPO = path.resolve(__dirname, '..');
const RUN_SH_REL = 'src/pipeline/tagging-edges/realtime/run.sh';
const RUN_SH = path.join(REPO, RUN_SH_REL);
/** The engine's entry file: the index.js beside the run.sh under test, as an absolute path (T28 "Finding the engine"). */
const INDEX_JS = path.join(path.dirname(RUN_SH), 'index.js');
/** The launcher's pgrep -f guard for a pass (ADR "Facts": launchChildTask.sh:32-43; story "A second gate"). */
const PGREP_PATTERN = 'pipeline/tagging-edges/reconcileTaggingEdges';
const HEAP_FLAG = '--max-old-space-size=384';
const POLL_SECONDS = '1';
/** The poll in the backoff scenarios (RW18–RW20): not a backoff value, so a poll sleep is never read as a backoff. */
const BACKOFF_POLL_SECONDS = '3';
/** The backoff's first eight sleeps: "backs off 1→2→4…30 s" (ADR § Where it runs), doubling and capped at 30. */
const BACKOFF_SEQUENCE = [1, 2, 4, 8, 16, 30, 30, 30];
/** RW22: T34's healthy-run seam, set small so a healthy run takes seconds, and the stub's healthy run, longer than it. */
const HEALTHY_SECONDS = '3';
const HEALTHY_RUN_SECONDS = 4;
/** RW22: the backoff sleeps when three quick exits are followed by a healthy run that then exits 1 — reset to 1 (T34). */
const HEALTHY_RESET_SEQUENCE = [1, 2, 4, 1];
const CHANGED_AT = '2026-09-28T12:00:00.000Z';
/** switch.json's changedBy is an 8-character prefix of the owner's pubkey — here a fixture's, never a real one. */
const CHANGED_BY = F.ALICE.slice(0, 8);
const UNSET = '<unset>';

/** Every window the suite waits, in milliseconds (POLL_SECONDS = 1). */
const MS = {
  offWindow: 3000,     // RW1: no node while off
  firstStart: 5000,    // an "on" wrapper's first start
  restart: 5000,       // a start after the previous one exited (backoff 1 s) or after the switch went on again
  flipOn: 4000,        // RW3: switched on while idle
  quickWindow: 6500,   // RW7: starts counted after the first
  offAfterExit: 3500,  // RW10: no start after node exited with the switch off
  sourceMissing: 2500, // RW9: conf missing
  sourceFixed: 8000,   // RW9: a start after the conf appears (backoff 1→2→4 s)
  lockWindow: 4000,    // RW14: the second wrapper
  signalExit: 6000,    // RW11–13: exit after the signal
  idleSettle: 1500,    // RW13: let the idle wrapper reach its loop before the signal
  fastWindow: 5000,    // RW18–19: the backoff's first eight sleeps, each returning at once
  backoffSettle: 300,  // RW20: let the wrapper reach its wait on the (stretched) backoff sleep before the signal
  backoffTerm: 1000,   // RW20: the bound — a TERM during a backoff exits within 1 s (T28)
  backoffWatch: 3000,  // RW20: how long the test watches for that exit
  healthyWindow: 9000, // RW22: three quick exits, a 4 s healthy run, and the backoff sleep after it
  poll: 40,            // the suite's own observation step
};

// ─── test harness ──────────────────────────────────────────────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (v) => {
  try { return JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? `${x}n` : x)); } catch (_) { return String(v); }
};
/** Run several cases; report every failing one, not only the first. */
async function cases(list, fn) {
  const failed = [];
  for (const c of list) {
    try { await fn(c); } catch (e) { failed.push(`[${c.name}] ${e.message}`); }
  }
  assert(failed.length === 0, `${failed.length} of ${list.length} case(s) failed:\n        ${failed.join('\n        ')}`);
}
/** A test that cannot run on this host: counted as skipped, with the reason printed. */
class Skip extends Error { constructor(reason) { super(reason); this.skip = true; } }
const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (pred()) return true;
    await delay(MS.poll);
  }
  return !!pred();
}
const rand = () => crypto.randomBytes(4).toString('hex');
const secs = (ms) => (ms === null || ms === undefined ? 'n/a' : `${(ms / 1000).toFixed(2)} s`);

/** The wrapper under test, looked up lazily, with a descriptive red-phase message. */
function load() {
  try { fs.accessSync(RUN_SH, fs.constants.R_OK); return RUN_SH; }
  catch (e) { throw new Error(`${RUN_SH_REL} not implemented yet (not readable: ${firstLine(e)})`); }
}

// ─── host tools ────────────────────────────────────────────────────────────────────────────────────────────────
let HOST = null;
/** bash, flock(1), perl, sleep and ps on this host (detected once). */
function host() {
  if (HOST) return HOST;
  const sh = (cmd) => spawnSync('bash', ['-c', cmd], { encoding: 'utf8', timeout: 5000 });
  const probe = sh('printf "%s\\n%s" "$BASH_VERSION" "$(command -v bash)"');
  const ok = !probe.error && probe.status === 0;
  const [version, bashPath] = ok ? probe.stdout.split('\n') : [];
  const which = (name) => {
    if (!ok) return null;
    const r = sh(`command -v ${name}`);
    const p = (r.stdout || '').trim();
    return r.status === 0 && p.startsWith('/') ? p : null;
  };
  const flock = which('flock');
  const perl = which('perl');
  const sleep = which('sleep') || '/bin/sleep';
  const psr = spawnSync('ps', ['-A', '-ww', '-o', 'pid=,ppid=,pgid=,args='], { encoding: 'utf8', timeout: 5000 });
  const ps = !psr.error && psr.status === 0 && /^\s*\d+\s+\d+\s+\d+\s/m.test(psr.stdout || '');
  HOST = {
    bash: ok ? { version: version || '?', path: bashPath && bashPath.startsWith('/') ? bashPath : 'bash' } : null,
    flock, perl, sleep, ps,
    lockMode: flock ? 'flock' : (perl ? 'shim' : null),
  };
  return HOST;
}
function hostLine() {
  const h = host();
  if (!h.bash) return 'host: no bash';
  const lock = h.lockMode === 'flock' ? `flock(1) at ${h.flock}, behind a logging passthrough on the wrapper's PATH` : h.lockMode === 'shim' ? 'no flock(1): perl flock(2) shim on the wrapper\'s PATH' : 'no flock(1), no perl';
  return `host: bash ${h.bash.version} · ${lock} · sleep ${h.sleep} behind the test's sleep · ps ${h.ps ? 'yes' : 'no'}`;
}

// ─── the stubs and shims the wrappers find on PATH ─────────────────────────────────────────────────────────────
/** The stub node. Its own sleeps call the host's sleep by absolute path, so they never reach the test's `sleep`. */
const nodeStub = (realSleep) => `#!/bin/bash
# Stub \`node\` for test/tagging-edges-realtime-wrapper.test.js. One "start" line per start, then per $RW_STUB_DIR/behaviour
# ($RW_STUB_DIR/behaviour.<n>, when present, overrides it for the n-th start, counting from 1 in $RW_STUB_DIR/count):
#   (absent) or "run"  sleep until TERM or INT, record the signal, take 1 s to stop, exit 0 (at most 60 s in all);
#   "exit:N"           exit N at once;
#   "hold:N"           wait for $RW_STUB_DIR/release (removing it), then exit N;
#   "for:S:N"          run S whole seconds (or until TERM or INT), then exit N.
d="\${RW_STUB_DIR:?RW_STUB_DIR unset}"
nap="${realSleep}"
n=$(( $(cat "$d/count" 2>/dev/null || echo 0) + 1 ))
printf '%s\\n' "$n" > "$d/count"
# The behaviour is read, and the traps set, before the start is announced: a test that reacts to the start line can
# neither change this start's behaviour nor signal it before it listens.
behaviour="$(cat "$d/behaviour.$n" 2>/dev/null || cat "$d/behaviour" 2>/dev/null)"
on_signal() {
  printf 'signal\\t%s\\t%s\\n' "$$" "$1" >> "$d/node.log"
  "$nap" 1
  printf 'stopped\\t%s\\n' "$$" >> "$d/node.log"
  exit 0
}
trap 'on_signal TERM' TERM
trap 'on_signal INT' INT
us=$'\\037'
args=""
for a in "$@"; do args="$args$a$us"; done
ino="-"
if [ -n "\${RW_REAL_NODE:-}" ]; then
  ino="$("$RW_REAL_NODE" -e 'try{process.stdout.write(String(require("fs").fstatSync(8,{bigint:true}).ino))}catch(e){process.stdout.write("closed")}' 2>/dev/null)"
fi
printf 'start\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t%s\\n' "$$" "\${TE_RW_MARKER-${UNSET}}" "\${TE_RW_ONLY_FIRST-${UNSET}}" "\${TAGGING_EDGES_STATE_DIR-${UNSET}}" "$ino" "$PWD" "$args" >> "$d/node.log"
case "$behaviour" in
  exit:*) exit "\${behaviour#exit:}" ;;
esac
ticks=300
case "$behaviour" in
  for:*) rest="\${behaviour#for:}"; ticks=$(( \${rest%%:*} * 5 )) ;;
esac
i=0
while [ "$i" -lt "$ticks" ]; do
  case "$behaviour" in
    hold:*) if [ -e "$d/release" ]; then rm -f "$d/release"; exit "\${behaviour#hold:}"; fi ;;
  esac
  "$nap" 0.2
  i=$((i + 1))
done
case "$behaviour" in
  for:*) exit "\${behaviour##*:}" ;;
esac
printf 'timeout\\t%s\\n' "$$" >> "$d/node.log"
exit 3
`;

/** flock(1)'s fd form over flock(2), for hosts without flock(1). Logs "<args>\t<ok|busy|unsupported>" to $RW_FLOCK_LOG. */
const FLOCK_SHIM = `#!/usr/bin/env perl
use strict; use warnings; use Fcntl qw(:flock);
my @argv = @ARGV;
sub done { my ($res, $code) = @_; if ($ENV{RW_FLOCK_LOG} && open(my $l, '>>', $ENV{RW_FLOCK_LOG})) { print $l join(' ', @argv), "\\t", $res, "\\n"; close $l; } exit $code; }
my ($nb, $sh, $un, $wait, $conflict, $fd) = (0, 0, 0, undef, 1, undef);
my @a = @ARGV;
while (@a) {
  my $x = shift @a;
  if ($x eq '-n' || $x eq '--nb' || $x eq '--nonblock') { $nb = 1 }
  elsif ($x eq '-x' || $x eq '-e' || $x eq '--exclusive') { }
  elsif ($x eq '-s' || $x eq '--shared') { $sh = 1 }
  elsif ($x eq '-u' || $x eq '--unlock') { $un = 1 }
  elsif ($x eq '-o' || $x eq '--close') { }
  elsif ($x eq '-w' || $x eq '--wait' || $x eq '--timeout') { $wait = shift @a }
  elsif ($x eq '-E' || $x eq '--conflict-exit-code') { $conflict = shift @a }
  elsif ($x =~ /^-([nxseuo]+)$/) { my $f = $1; $nb = 1 if $f =~ /n/; $sh = 1 if $f =~ /s/; $un = 1 if $f =~ /u/ }
  elsif ($x =~ /^\\d+$/ && !@a) { $fd = $x }
  else { done('unsupported', 64) }
}
done('unsupported', 64) unless defined $fd;
my $fh;
for my $m ('>>&=', '<&=', '+<&=') { last if open($fh, $m, $fd); undef $fh; }
done('bad-fd', 1) unless $fh;
if ($un) { flock($fh, LOCK_UN) ? done('ok', 0) : done('busy', 1) }
my $op = $sh ? LOCK_SH : LOCK_EX;
if ($nb || (defined $wait && $wait == 0)) { flock($fh, $op | LOCK_NB) ? done('ok', 0) : done('busy', $conflict) }
if (defined $wait) {
  my $end = time + $wait;
  while (time < $end) { done('ok', 0) if flock($fh, $op | LOCK_NB); select(undef, undef, undef, 0.05); }
  done('busy', $conflict);
}
flock($fh, $op) ? done('ok', 0) : done('busy', 1);
`;

/** On a host with flock(1): a `flock` that runs it and logs "<args>\t<ok|busy|exit-N>" to $RW_FLOCK_LOG (T28 PATH lookup). */
const flockPassthrough = (realFlock) => `#!/bin/bash
"${realFlock}" "$@"
rc=$?
case "$rc" in 0) res=ok ;; 1) res=busy ;; *) res="exit-$rc" ;; esac
if [ -n "\${RW_FLOCK_LOG:-}" ]; then printf '%s\\t%s\\n' "$*" "$res" >> "$RW_FLOCK_LOG"; fi
exit "$rc"
`;

/**
 * The test's `sleep`: logs "sleep\t<args>" to $RW_SLEEP_LOG, then per $RW_SLEEP_MODE —
 *   long (default)  returns at once for 10 s or more, and runs the real sleep otherwise;
 *   fast            returns at once for the first $RW_SLEEP_FAST_MAX calls (default 12), then runs the real sleep;
 *   stretch         a sleep of any length other than the poll's ($TAGGING_EDGES_REALTIME_POLL_SECONDS) lasts
 *                   $RW_SLEEP_STRETCH s (default 20); the poll's runs as asked.
 * The real sleep is exec'd, so a signal to the sleep's pid reaches it.
 */
const sleepShim = (realSleep) => `#!/bin/bash
log="\${RW_SLEEP_LOG:?RW_SLEEP_LOG unset}"
n=0
if [ -f "$log" ]; then n=$(( $(wc -l < "$log") )); fi
printf 'sleep\\t%s\\n' "$*" >> "$log"
s="\${1:-0}"
case "$s" in ''|*[!0-9.]*) exec "${realSleep}" "$@" ;; esac
case "\${RW_SLEEP_MODE:-long}" in
  fast) if [ "$n" -lt "\${RW_SLEEP_FAST_MAX:-12}" ]; then exit 0; fi; exec "${realSleep}" "$@" ;;
  stretch) if [ "$s" != "\${TAGGING_EDGES_REALTIME_POLL_SECONDS:-}" ]; then exec "${realSleep}" "\${RW_SLEEP_STRETCH:-20}"; fi ;;
esac
w="\${s%%.*}"
if [ "\${w:-0}" -ge 10 ]; then exit 0; fi
exec "${realSleep}" "$@"
`;

let ROOT = null;   // the run's temp root
let TOOLS = null;  // { nodeBin, flockBin, sleepBin, cwd }
function tools() {
  if (TOOLS) return TOOLS;
  ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'te-realtime-wrapper-'));
  const dir = (n) => { const p = path.join(ROOT, 'tools', n); fs.mkdirSync(p, { recursive: true }); return p; };
  const nodeBin = dir('node-stub');
  const flockBin = dir('flock-shim');
  const sleepBin = dir('sleep-shim');
  const cwd = dir('cwd');
  const decoy = dir('decoy-install');
  const hs = host();
  fs.writeFileSync(path.join(nodeBin, 'node'), nodeStub(hs.sleep), { mode: 0o755 });
  fs.writeFileSync(path.join(flockBin, 'flock'), hs.lockMode === 'flock' ? flockPassthrough(hs.flock) : FLOCK_SHIM, { mode: 0o755 });
  fs.writeFileSync(path.join(sleepBin, 'sleep'), sleepShim(hs.sleep), { mode: 0o755 });
  TOOLS = { nodeBin, flockBin, sleepBin, cwd, decoy };
  return TOOLS;
}

// ─── files the wrapper reads ───────────────────────────────────────────────────────────────────────────────────
function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp-${rand()}`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}
/** switch.json in the canonical compact form the owner route writes (ADR § D3's table). */
const canonicalSwitch = (on) => JSON.stringify({ version: 1, on, changedAt: CHANGED_AT, changedBy: CHANGED_BY });
const switchPath = (stateDir) => path.join(stateDir, 'realtime', 'switch.json');
const writeSwitch = (stateDir, on) => writeAtomic(switchPath(stateDir), canonicalSwitch(on));
/**
 * A conf of `export …` lines, as /etc/brainstorm.conf is (ADR § Where it runs). Its BRAINSTORM_MODULE_*_DIR point at a
 * decoy install directory, never at the run.sh under test (T28: index.js is found beside run.sh). With `fails`, its
 * last command fails after everything is exported, so sourcing it returns non-zero (T28 "Sourcing", RW19).
 */
function writeConf(file, { marker, onlyFirst, fails = false }) {
  const decoy = tools().decoy;
  const lines = [
    '# test conf (test/tagging-edges-realtime-wrapper.test.js)',
    `BRAINSTORM_MODULE_BASE_DIR="${decoy}/"`,
    `BRAINSTORM_MODULE_SRC_DIR="${decoy}/src/"`,
    `BRAINSTORM_MODULE_PIPELINE_DIR="${decoy}/src/pipeline"`,
    'export BRAINSTORM_MODULE_BASE_DIR',
    'export BRAINSTORM_MODULE_SRC_DIR',
    'export BRAINSTORM_MODULE_PIPELINE_DIR',
    `TE_RW_MARKER="${marker}"`,
    'export TE_RW_MARKER',
  ];
  if (onlyFirst !== undefined) lines.push(`TE_RW_ONLY_FIRST="${onlyFirst}"`, 'export TE_RW_ONLY_FIRST');
  if (fails) lines.push('# the source fails here: the last command returns non-zero', 'false');
  writeAtomic(file, `${lines.join('\n')}\n`);
  return file;
}
/** A fresh state dir (the wrapper makes realtime/ in it). */
function mkState(...parts) {
  const p = path.join(ROOT, ...parts, 'state');
  fs.mkdirSync(p, { recursive: true, mode: 0o700 });
  return p;
}
function mkStub(behaviour, ...parts) {
  const p = path.join(ROOT, ...parts, 'stub');
  fs.mkdirSync(p, { recursive: true });
  if (behaviour) fs.writeFileSync(path.join(p, 'behaviour'), behaviour);
  return p;
}
const setBehaviour = (stubDir, b) => fs.writeFileSync(path.join(stubDir, 'behaviour'), b);
const release = (stubDir) => fs.writeFileSync(path.join(stubDir, 'release'), '');
function statOrNull(p) { try { return fs.statSync(p); } catch (_) { return null; } }
function inoOf(p) { try { return String(fs.statSync(p, { bigint: true }).ino); } catch (_) { return null; } }
function readLines(p) { try { return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean); } catch (_) { return []; } }
function realOrNull(p) { try { return fs.realpathSync(p); } catch (_) { return null; } }
/** The sleeps a wrapper took through PATH, as the test's `sleep` logged their arguments. */
const sleepsOf = (h) => readLines(path.join(h.stubDir, 'sleep.log')).map((l) => l.split('\t').slice(1).join('\t'));
/** The flock calls a wrapper made through PATH: [{ args, res }]. */
const flocksOf = (h) => readLines(path.join(h.stubDir, 'flock.log')).map((l) => { const i = l.lastIndexOf('\t'); return { args: l.slice(0, i), res: l.slice(i + 1) }; });
/** The backoff sleeps among a wrapper's logged sleeps: every one but the poll's (BACKOFF_POLL_SECONDS in RW18–RW20). */
const backoffSleeps = (sleeps) => sleeps.filter((s) => s !== BACKOFF_POLL_SECONDS);

// ─── wrappers ──────────────────────────────────────────────────────────────────────────────────────────────────
const LIVE = new Set();
function killAllNow() {
  for (const h of LIVE) { try { process.kill(-h.pid, 'SIGKILL'); } catch (_) { /* gone */ } }
}
let exitHookOn = false;

/** Read the stub's log: new "start" / "signal" / "stopped" / "timeout" lines, time-stamped when first seen. */
function observe(h) {
  let text;
  try { text = fs.readFileSync(path.join(h.stubDir, 'node.log'), 'utf8'); } catch (_) { return; }
  const lines = text.split('\n');
  lines.pop(); // an unfinished line waits for the next look
  const at = Date.now();
  for (let i = h.seen; i < lines.length; i++) {
    const f = lines[i].split('\t');
    if (f[0] === 'start') {
      h.starts.push({ pid: Number(f[1]), marker: f[2], onlyFirst: f[3], stateDir: f[4], fd8: f[5], cwd: f[6], args: (f[7] || '').split('\u001f').slice(0, -1), at });
    } else if (f[0] === 'signal') {
      h.signals.push({ pid: Number(f[1]), sig: f[2], at });
    } else if (f[0] === 'stopped') {
      h.stopped.push({ pid: Number(f[1]), at });
    } else if (f[0] === 'timeout') {
      h.timeouts.push({ pid: Number(f[1]), at });
    }
  }
  h.seen = lines.length;
}

/**
 * Start `bash run.sh` as supervisord would, in its own process group. PATH is `extraPath`, the test's `sleep`, the
 * stub node, the test's `flock` (a logging passthrough to flock(1), or the perl shim), then the host's PATH. The
 * sleep mode (RW_SLEEP_MODE) and the poll can be set through `extraEnv`.
 */
function spawnWrapper({ label, stateDir, conf, stubDir, extraPath = [], extraEnv = {} }) {
  const t = tools();
  const hs = host();
  const env = {
    PATH: [...extraPath, t.sleepBin, t.nodeBin, t.flockBin, process.env.PATH || '/usr/bin:/bin'].join(':'),
    HOME: ROOT,
    LANG: 'C',
    LC_ALL: 'C',
    TAGGING_EDGES_STATE_DIR: stateDir,
    BRAINSTORM_CONF: conf,
    TAGGING_EDGES_REALTIME_POLL_SECONDS: POLL_SECONDS,
    RW_STUB_DIR: stubDir,
    RW_FLOCK_LOG: path.join(stubDir, 'flock.log'),
    RW_SLEEP_LOG: path.join(stubDir, 'sleep.log'),
    ...extraEnv,
  };
  if (process.env.TMPDIR) env.TMPDIR = process.env.TMPDIR;
  const child = spawn(hs.bash.path, [RUN_SH], { cwd: t.cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const h = {
    label, child, pid: child.pid, stubDir, stateDir, spawnedAt: Date.now(),
    starts: [], signals: [], stopped: [], timeouts: [], seen: 0, exited: null, out: '',
  };
  const keep = (b) => { h.out = (h.out + b.toString('utf8')).slice(-4000); };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  child.on('error', (e) => { if (!h.exited) h.exited = { code: null, signal: null, error: firstLine(e), at: Date.now() }; });
  child.on('exit', (code, signal) => {
    observe(h);
    h.exited = { code, signal, at: Date.now(), stoppedAtExit: h.stopped.length, signalsAtExit: h.signals.length };
  });
  h.timer = setInterval(() => observe(h), MS.poll);
  if (h.timer.unref) h.timer.unref();
  LIVE.add(h);
  if (!exitHookOn) { process.on('exit', killAllNow); exitHookOn = true; }
  return h;
}
/**
 * SIGKILL the wrapper's process group (it, its node and their children), wait for the wrapper's exit, and then for
 * the group to empty — a node the wrapper did not wait for goes too.
 */
async function kill(h) {
  const group = (sig) => { try { process.kill(-h.pid, sig); return true; } catch (_) { return false; } };
  if (!h.exited && !group('SIGKILL')) { try { h.child.kill('SIGKILL'); } catch (_) { /* gone */ } }
  await waitFor(() => h.exited, 3000);
  if (group(0)) { group('SIGKILL'); await waitFor(() => !group(0), 2000); }
  clearInterval(h.timer);
  observe(h);
  LIVE.delete(h);
}
/** The wrapper's recent output, for a failure message. */
const tailOf = (h) => {
  const t = h.out.trim();
  return t ? `\n        wrapper output (tail): ${show(t.slice(-400))}` : '\n        wrapper output: (none)';
};
/** Plain observations of a wrapper, for the tests — with the flock calls and sleeps it made through PATH so far. */
function snap(h) {
  return {
    label: h.label, pid: h.pid, stubDir: h.stubDir, stateDir: h.stateDir, spawnedAt: h.spawnedAt,
    starts: h.starts.slice(), signals: h.signals.slice(), stopped: h.stopped.slice(), timeouts: h.timeouts.slice(),
    exited: h.exited, out: h.out, flocks: flocksOf(h), sleeps: sleepsOf(h),
  };
}

/** Every process in the wrapper's tree or process group: [{ pid, ppid, pgid, args }] (null without ps). */
function psTree(rootPid) {
  if (!host().ps) return null;
  const r = spawnSync('ps', ['-A', '-ww', '-o', 'pid=,ppid=,pgid=,args='], { encoding: 'utf8', timeout: 5000 });
  if (r.error || r.status !== 0) return null;
  const rows = r.stdout.split('\n')
    .map((l) => l.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s(.*)$/))
    .filter(Boolean)
    .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), pgid: Number(m[3]), args: m[4].trim() }));
  const tree = new Set([rootPid]);
  for (let grew = true; grew;) {
    grew = false;
    for (const x of rows) if (!tree.has(x.pid) && tree.has(x.ppid)) { tree.add(x.pid); grew = true; }
  }
  return rows.filter((x) => tree.has(x.pid) || x.pgid === rootPid);
}

// ─── scenarios (all started together, once) ────────────────────────────────────────────────────────────────────
/** RW1–RW3: five wrappers whose switch is off in five ways; then the absent one is switched on. */
async function scenarioOff() {
  const conf = writeConf(path.join(ROOT, 'off', 'brainstorm.conf'), { marker: 'off' });
  const variants = [
    { label: 'absent', content: null },
    { label: '{"version":1,"on":false,…}', content: canonicalSwitch(false) },
    { label: 'empty', content: '' },
    { label: '{"version":1,"on":"true",…} (a string, not the boolean)', content: JSON.stringify({ version: 1, on: 'true', changedAt: CHANGED_AT, changedBy: CHANGED_BY }) },
    { label: 'not JSON', content: 'on\n' },
  ];
  const ws = variants.map((v, i) => {
    const stateDir = mkState('off', String(i));
    if (v.content !== null) writeAtomic(switchPath(stateDir), v.content);
    return { v, h: spawnWrapper({ label: `off ${v.label}`, stateDir, conf, stubDir: mkStub(null, 'off', String(i)) }) };
  });
  try {
    await delay(MS.offWindow);
    const byVariant = ws.map(({ v, h }) => ({ name: v.label, ...snap(h) }));
    const absent = ws[0].h;
    const rt = path.join(absent.stateDir, 'realtime');
    const dir = statOrNull(rt);
    const lock = statOrNull(path.join(rt, 'daemon.lock'));
    let flipped = { wrapperExited: absent.exited };
    if (!absent.exited) {
      const before = absent.starts.length;
      writeSwitch(absent.stateDir, true);
      const t = Date.now();
      const started = await waitFor(() => absent.starts.length > before, MS.flipOn);
      flipped = { started, ms: started ? absent.starts[before].at - t : null, wrapper: snap(absent) };
    }
    return {
      byVariant,
      realtimeDir: dir && { isDir: dir.isDirectory(), mode: dir.mode & 0o777 },
      daemonLock: lock && { isFile: lock.isFile() },
      absent: snap(absent),
      flipped,
    };
  } finally {
    await Promise.all(ws.map((w) => kill(w.h)));
  }
}

/** RW4–RW6, RW16: an "on" wrapper; node holds, the conf is edited, node exits 1, and the next start is observed. */
async function scenarioOn() {
  const confPath = path.join(ROOT, 'on', 'brainstorm.conf');
  const alpha = `alpha-${rand()}`;
  const beta = `beta-${rand()}`;
  writeConf(confPath, { marker: alpha, onlyFirst: 'yes' });
  const stateDir = mkState('on');
  writeSwitch(stateDir, true);
  const stubDir = mkStub('hold:1', 'on');
  const h = spawnWrapper({ label: 'on', stateDir, conf: confPath, stubDir, extraEnv: { RW_REAL_NODE: process.execPath } });
  const o = { alpha, beta, stateDir, first: false, second: false, lockIno: null, ps1: null, ps2: null };
  try {
    o.first = await waitFor(() => h.starts.length >= 1, MS.firstStart);
    o.lockIno = inoOf(path.join(stateDir, 'realtime', 'daemon.lock'));
    if (o.first) {
      o.ps1 = psTree(h.pid);
      writeConf(confPath, { marker: beta });
      setBehaviour(stubDir, 'run');
      release(stubDir);
      o.second = await waitFor(() => h.starts.length >= 2, MS.restart);
      if (o.second) { await delay(200); o.ps2 = psTree(h.pid); }
    }
    return { ...o, wrapper: snap(h) };
  } finally {
    await kill(h);
  }
}

/** RW7–RW8: node exits at once (1, and 0); starts are counted over the window after the first. */
async function scenarioQuick() {
  const conf = writeConf(path.join(ROOT, 'quick', 'brainstorm.conf'), { marker: 'quick' });
  const ws = [1, 0].map((code) => {
    const stateDir = mkState('quick', String(code));
    writeSwitch(stateDir, true);
    return { code, h: spawnWrapper({ label: `quick exit ${code}`, stateDir, conf, stubDir: mkStub(`exit:${code}`, 'quick', String(code)) }) };
  });
  try {
    await Promise.all(ws.map((w) => waitFor(() => w.h.starts.length >= 1, MS.firstStart)));
    const ends = ws.filter((w) => w.h.starts.length).map((w) => w.h.starts[0].at + MS.quickWindow);
    if (ends.length) await delay(Math.max(0, Math.max(...ends) - Date.now()));
    return {
      byCode: ws.map((w) => {
        const t0 = w.h.starts.length ? w.h.starts[0].at : null;
        const offsets = t0 === null ? [] : w.h.starts.map((s) => s.at - t0).filter((ms) => ms <= MS.quickWindow);
        return { name: `node exits ${w.code}`, code: w.code, offsets, ...snap(w.h) };
      }),
    };
  } finally {
    await Promise.all(ws.map((w) => kill(w.h)));
  }
}

/** RW9: BRAINSTORM_CONF names a file that does not exist yet; later it appears. */
async function scenarioSource() {
  const confPath = path.join(ROOT, 'source', 'conf-appears-later', 'brainstorm.conf');
  const gamma = `gamma-${rand()}`;
  const stateDir = mkState('source');
  writeSwitch(stateDir, true);
  const h = spawnWrapper({ label: 'conf missing', stateDir, conf: confPath, stubDir: mkStub('run', 'source') });
  try {
    await delay(MS.sourceMissing);
    const before = { starts: h.starts.length, exited: h.exited };
    writeConf(confPath, { marker: gamma });
    const t = Date.now();
    const started = await waitFor(() => h.starts.length > before.starts, MS.sourceFixed);
    const start = started ? h.starts[before.starts] : null;
    return { gamma, before, started, start, ms: start ? start.at - t : null, wrapper: snap(h) };
  } finally {
    await kill(h);
  }
}

/** RW10: node exits 0 after the switch went off; nothing restarts it; switched on again, it starts. */
async function scenarioSwitchOff() {
  const conf = writeConf(path.join(ROOT, 'switch-off', 'brainstorm.conf'), { marker: 'switch-off' });
  const stateDir = mkState('switch-off');
  writeSwitch(stateDir, true);
  const stubDir = mkStub('hold:0', 'switch-off');
  const h = spawnWrapper({ label: 'switched off', stateDir, conf, stubDir });
  const o = { first: false, afterOff: null, reOn: null };
  try {
    o.first = await waitFor(() => h.starts.length >= 1, MS.firstStart);
    if (o.first) {
      writeSwitch(stateDir, false);
      setBehaviour(stubDir, 'run');
      release(stubDir);
      await delay(MS.offAfterExit);
      o.afterOff = { starts: h.starts.length, exited: h.exited };
      if (!h.exited) {
        writeSwitch(stateDir, true);
        const t = Date.now();
        const started = await waitFor(() => h.starts.length > o.afterOff.starts, MS.restart);
        o.reOn = { started, ms: started ? h.starts[o.afterOff.starts].at - t : null };
      }
    }
    return { ...o, wrapper: snap(h) };
  } finally {
    await kill(h);
  }
}

/** RW11–RW13: TERM to a running wrapper, INT to another, TERM to an idle one — each to the wrapper's pid alone. */
async function scenarioSignals() {
  const conf = writeConf(path.join(ROOT, 'signals', 'brainstorm.conf'), { marker: 'signals' });
  const mk = (name, on) => {
    const stateDir = mkState('signals', name);
    if (on) writeSwitch(stateDir, true);
    return spawnWrapper({ label: name, stateDir, conf, stubDir: mkStub('run', 'signals', name) });
  };
  const term = mk('term', true);
  const int = mk('int', true);
  const idle = mk('idle', false);
  const ws = [term, int, idle];
  try {
    await waitFor(() => term.starts.length >= 1 && int.starts.length >= 1, MS.firstStart);
    await delay(Math.max(0, idle.spawnedAt + MS.idleSettle - Date.now()));
    const before = ws.map((h) => ({ starts: h.starts.length, exited: h.exited }));
    const sentAt = Date.now();
    const send = (h, sig) => { if (!h.exited) { try { process.kill(h.pid, sig); } catch (_) { /* gone */ } } };
    send(term, 'SIGTERM');
    send(int, 'SIGINT');
    send(idle, 'SIGTERM');
    await waitFor(() => ws.every((h) => h.exited), MS.signalExit);
    await delay(300);
    return {
      sentAt,
      byName: Object.fromEntries(ws.map((h, i) => [h.label, { before: before[i], ...snap(h) }])),
    };
  } finally {
    await Promise.all(ws.map((h) => kill(h)));
  }
}

/** RW14–RW15: a second wrapper on a held state dir; then the holder crashes and a third takes over. */
async function scenarioLock() {
  const conf = writeConf(path.join(ROOT, 'lock', 'brainstorm.conf'), { marker: 'lock' });
  const stateDir = mkState('lock');
  writeSwitch(stateDir, true);
  const a = spawnWrapper({ label: 'first (holder)', stateDir, conf, stubDir: mkStub('run', 'lock', 'a') });
  const handles = [a];
  const o = { firstStarted: false, second: null, third: null, holderGone: null };
  try {
    o.firstStarted = await waitFor(() => a.starts.length >= 1, MS.firstStart);
    if (!o.firstStarted) return { ...o, first: snap(a) };
    const bStub = mkStub('run', 'lock', 'b');
    const b = spawnWrapper({ label: 'second', stateDir, conf, stubDir: bStub });
    handles.push(b);
    await waitFor(() => b.exited, MS.lockWindow);
    await delay(200);
    o.second = snap(b);
    o.firstDuringSecond = { exited: a.exited, starts: a.starts.length };
    await kill(b);
    // The holder "crashes": SIGKILL to its whole group (the wrapper, its node, and their children, each of which holds
    // an inherited fd 8). The group is waited out, so the next wrapper cannot race the kernel's teardown.
    await kill(a);
    o.holderGone = await waitFor(() => { try { process.kill(-a.pid, 0); return false; } catch (e) { return e.code === 'ESRCH'; } }, 3000);
    const c = spawnWrapper({ label: 'third (after the crash)', stateDir, conf, stubDir: mkStub('run', 'lock', 'c') });
    handles.push(c);
    const started = await waitFor(() => c.starts.length >= 1, MS.firstStart);
    o.third = { started, ...snap(c) };
    return { ...o, first: snap(a) };
  } finally {
    await Promise.all(handles.map((h) => kill(h)));
  }
}

/**
 * RW18–RW19: sleeps through PATH return at once (the first 12), so the backoff's first eight sleeps are logged in well
 * under a second. Node exits at once with 1, and with 0; and a conf whose source fails (its last command is `false`).
 */
async function scenarioBackoffFast() {
  const conf = writeConf(path.join(ROOT, 'backoff', 'brainstorm.conf'), { marker: 'backoff' });
  const failing = `fails-${rand()}`;
  const failingConf = writeConf(path.join(ROOT, 'backoff', 'failing.conf'), { marker: failing, fails: true });
  const mk = (name, c, behaviour) => {
    const stateDir = mkState('backoff', name);
    writeSwitch(stateDir, true);
    return spawnWrapper({
      label: name, stateDir, conf: c, stubDir: mkStub(behaviour, 'backoff', name),
      extraEnv: { RW_SLEEP_MODE: 'fast', TAGGING_EDGES_REALTIME_POLL_SECONDS: BACKOFF_POLL_SECONDS },
    });
  };
  const exit1 = mk('node-exits-1', conf, 'exit:1');
  const exit0 = mk('node-exits-0', conf, 'exit:0');
  const source = mk('source-fails', failingConf, 'run');
  const ws = [exit1, exit0, source];
  try {
    await Promise.all(ws.map((h) => waitFor(() => backoffSleeps(sleepsOf(h)).length >= BACKOFF_SEQUENCE.length, MS.fastWindow)));
    await delay(200);
    return {
      failing,
      byNodeExit: [[exit1, 1], [exit0, 0]].map(([h, code]) => ({ name: `node exits ${code}`, code, ...snap(h) })),
      source: snap(source),
    };
  } finally {
    await Promise.all(ws.map((h) => kill(h)));
  }
}

/** RW20: node exits 1 at once; the backoff sleep through PATH is stretched to 20 s; TERM is sent during it. */
async function scenarioTermInBackoff() {
  const conf = writeConf(path.join(ROOT, 'term-backoff', 'brainstorm.conf'), { marker: 'term-backoff' });
  const stateDir = mkState('term-backoff');
  writeSwitch(stateDir, true);
  const h = spawnWrapper({
    label: 'TERM during a backoff', stateDir, conf, stubDir: mkStub('exit:1', 'term-backoff'),
    extraEnv: { RW_SLEEP_MODE: 'stretch', RW_SLEEP_STRETCH: '20', TAGGING_EDGES_REALTIME_POLL_SECONDS: BACKOFF_POLL_SECONDS },
  });
  const o = { first: false, inBackoff: false, before: null, sentAt: null };
  try {
    o.first = await waitFor(() => h.starts.length >= 1, MS.firstStart);
    if (o.first) {
      o.inBackoff = await waitFor(() => backoffSleeps(sleepsOf(h)).length >= 1, MS.restart);
      if (o.inBackoff && !h.exited) {
        await delay(MS.backoffSettle);
        o.before = { starts: h.starts.length, exited: h.exited, sleeps: sleepsOf(h) };
        o.sentAt = Date.now();
        try { process.kill(h.pid, 'SIGTERM'); } catch (_) { /* gone */ }
        await waitFor(() => h.exited, MS.backoffWatch);
        await delay(200);
      }
    }
    return { ...o, wrapper: snap(h) };
  } finally {
    await kill(h);
  }
}

/**
 * RW22: T34's seam TAGGING_EDGES_REALTIME_HEALTHY_SECONDS set to 3; sleeps through PATH return at once (the first 12).
 * Node exits 1 at once on starts 1–3, runs 4 s on start 4 (longer than the healthy threshold) and then exits 1, and
 * exits 1 at once after that.
 */
async function scenarioHealthyReset() {
  const conf = writeConf(path.join(ROOT, 'healthy', 'brainstorm.conf'), { marker: 'healthy' });
  const stateDir = mkState('healthy');
  writeSwitch(stateDir, true);
  const stubDir = mkStub('exit:1', 'healthy');
  fs.writeFileSync(path.join(stubDir, 'behaviour.4'), `for:${HEALTHY_RUN_SECONDS}:1`);
  const h = spawnWrapper({
    label: 'a healthy run resets the backoff', stateDir, conf, stubDir,
    extraEnv: {
      RW_SLEEP_MODE: 'fast',
      TAGGING_EDGES_REALTIME_POLL_SECONDS: BACKOFF_POLL_SECONDS,
      TAGGING_EDGES_REALTIME_HEALTHY_SECONDS: HEALTHY_SECONDS,
    },
  });
  try {
    await waitFor(() => backoffSleeps(sleepsOf(h)).length >= HEALTHY_RESET_SEQUENCE.length && h.starts.length > HEALTHY_RESET_SEQUENCE.length, MS.healthyWindow);
    await delay(200);
    return { wrapper: snap(h) };
  } finally {
    await kill(h);
  }
}

const SCENARIOS = {
  off: scenarioOff, on: scenarioOn, quick: scenarioQuick, source: scenarioSource,
  switchOff: scenarioSwitchOff, signals: scenarioSignals, lock: scenarioLock,
  backoffFast: scenarioBackoffFast, termInBackoff: scenarioTermInBackoff, healthyReset: scenarioHealthyReset,
};
let STARTED = null;
/** Start every scenario at once (the first time one is needed); each settles to { ok, value } or { ok: false, error }. */
function startAll() {
  if (STARTED) return STARTED;
  tools();
  STARTED = {};
  for (const [name, fn] of Object.entries(SCENARIOS)) {
    STARTED[name] = Promise.resolve().then(fn).then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }));
  }
  return STARTED;
}
/**
 * One scenario's observations — or a Skip when this host cannot run the wrapper, or the red-phase error when run.sh
 * does not exist yet. A wrapper that does not call `flock` through PATH is not skipped: T28 makes that the contract,
 * and RW17 names the failure.
 */
async function need(name) {
  const hs = host();
  if (!hs.bash) throw new Skip('bash is not available on this host (the wrapper is a bash script run by supervisord as /bin/bash run.sh)');
  load();
  if (!hs.lockMode) throw new Skip('this host has no flock(1) and no perl for the test\'s flock(2) shim, so the wrapper cannot take realtime/daemon.lock here');
  const r = await startAll()[name];
  if (!r.ok) throw r.error;
  return r.value;
}

// ─── reading the observations ──────────────────────────────────────────────────────────────────────────────────
const argvOf = (s) => (s ? `[${s.args.map((a) => show(a)).join(', ')}]` : 'n/a');
/** The script argument: the first argument that is not a node option. */
function scriptOf(start) {
  const i = start.args.findIndex((a) => !a.startsWith('-'));
  return i < 0 ? { index: -1, arg: null, resolved: null } : { index: i, arg: start.args[i], resolved: path.resolve(start.cwd || '/', start.args[i]) };
}
/**
 * Is `arg` the absolute path of the index.js beside the run.sh under test (T28)? Exactly INDEX_JS, or an absolute
 * spelling of the same file (the same directory once symlinks are resolved).
 */
function isIndexBesideRunSh(arg) {
  if (typeof arg !== 'string' || !path.isAbsolute(arg)) return false;
  if (arg === INDEX_JS) return true;
  if (path.basename(arg) !== 'index.js') return false;
  const want = realOrNull(path.dirname(RUN_SH));
  return want !== null && realOrNull(path.dirname(arg)) === want;
}
/**
 * The ADR's `flock -n 8` (ADR § Where it runs): an exclusive, non-blocking lock on fd 8, with no other option.
 * Accepts the equivalent spellings -n / --nb / --nonblock, and -x / -e / --exclusive, alone or combined (-xn).
 */
function isFlockN8(args) {
  const t = String(args).split(' ').filter(Boolean);
  if (t.length < 2 || t[t.length - 1] !== '8') return false;
  let nb = false;
  for (const x of t.slice(0, -1)) {
    if (x === '-n' || x === '--nb' || x === '--nonblock') nb = true;
    else if (x === '-x' || x === '-e' || x === '--exclusive') { /* the default */ }
    else if (/^-[nxe]+$/.test(x)) { if (x.includes('n')) nb = true; }
    else return false;
  }
  return nb;
}
const flocksShown = (w) => (w.flocks.length ? w.flocks.map((f) => `flock ${f.args} → ${f.res}`).join('; ') : 'none');

// ─── the switch: off means no node (AC-5) ──────────────────────────────────────────────────────────────────────
test('RW1: while switch.json is absent, {"version":1,"on":false,…}, empty, {"on":"true"} (a string) or not JSON, the wrapper starts no node process at all within 3 s, and it keeps running — it idles, it never exits (ADR § Where it runs "Its loop reads switch.json … and starts Node only while on", D2-A "idles while the switch is off (no Node process)"; § Status and switch "A missing or unreadable switch.json reads as off"; AC-5 "Off by default", "Off means off"; T23)', async () => {
  const o = await need('off');
  await cases(o.byVariant, async (v) => {
    assert(v.starts.length === 0,
      `node was started ${v.starts.length} time(s) within ${MS.offWindow} ms with switch.json ${v.name} — while off the wrapper runs no Node process\n        expected: 0 starts\n        actual:   ${v.starts.length}, first argv ${argvOf(v.starts[0])}${tailOf(v)}`);
    assert(v.exited === null,
      `the wrapper exited while off (${show(v.exited)}) — it must idle and never exit, so supervisord never restarts or FATALs it${tailOf(v)}`);
  });
});

test('RW2: the wrapper makes <TAGGING_EDGES_STATE_DIR>/realtime with mode 0700 and opens realtime/daemon.lock there at start, even while the switch is off (ADR § Where it runs "It makes <stateDir>/realtime (mode 0700), then runs exec 8>>\"$DIR/daemon.lock\""; § D3 state table "daemon.lock — by the wrapper"; T23 TAGGING_EDGES_STATE_DIR)', async () => {
  const o = await need('off');
  const problems = [];
  if (!o.realtimeDir || !o.realtimeDir.isDir) problems.push(`<stateDir>/realtime was not created (stat: ${show(o.realtimeDir)})`);
  else if (o.realtimeDir.mode !== 0o700) problems.push(`<stateDir>/realtime has mode ${o.realtimeDir.mode.toString(8)}\n        expected: 700\n        actual:   ${o.realtimeDir.mode.toString(8)}`);
  if (!o.daemonLock || !o.daemonLock.isFile) problems.push(`<stateDir>/realtime/daemon.lock was not created as a file (stat: ${show(o.daemonLock)})`);
  assert(problems.length === 0, `${problems.join('\n        ')}${tailOf(o.absent)}`);
});

test('RW3: switched on (canonical {"version":1,"on":true,…}) while it idles, the wrapper starts node within 4 s at a 1 s poll — it re-reads switch.json on every poll, not once at start (ADR § Where it runs "Its loop reads switch.json every 2 s … starts Node only while on"; T23 TAGGING_EDGES_REALTIME_POLL_SECONDS; AC-5 the owner turns it on without a shell)', async () => {
  const o = await need('off');
  const f = o.flipped;
  assert(!f.wrapperExited, `the wrapper had already exited before the switch went on: ${show(f.wrapperExited)}${tailOf(o.absent)}`);
  assert(f.started,
    `node was not started within ${MS.flipOn} ms of switch.json becoming {"version":1,"on":true,…}\n        expected: a start within ${secs(MS.flipOn)}\n        actual:   none${tailOf(f.wrapper)}`);
});

// ─── starting node (T23) ───────────────────────────────────────────────────────────────────────────────────────
test('RW4: with {"version":1,"on":true,…} node is started through PATH as `node --max-old-space-size=384 <abs>/index.js`, where <abs>/index.js is the absolute path of the index.js beside the run.sh under test — not one built from the conf\'s BRAINSTORM_MODULE_*_DIR (a decoy here) or a fixed install path — with the heap flag once, before the script, and no argument after it (ADR Decision diagram and § Where it runs "exec node --max-old-space-size=384 …/realtime/index.js"; § Throughput "the 384 MB heap"; T23 "It resolves node through PATH"; T28 "It finds index.js beside itself: \"$(cd \"$(dirname \"$0\")\" && pwd)/index.js\"")', async () => {
  const o = await need('on');
  assert(o.first, `node was never started within ${MS.firstStart} ms with the switch on${tailOf(o.wrapper)}`);
  const s = o.wrapper.starts[0];
  const heap = s.args.filter((a) => a.startsWith('--max-old-space-size'));
  const sc = scriptOf(s);
  const problems = [];
  if (heap.length !== 1 || heap[0] !== HEAP_FLAG) problems.push(`node's heap flag\n        expected: exactly one ${show(HEAP_FLAG)}\n        actual:   ${show(heap)}`);
  if (sc.index < 0) problems.push('node was given no script argument');
  else {
    if (s.args.indexOf(HEAP_FLAG) > sc.index) problems.push(`${HEAP_FLAG} comes after the script, so node would hand it to the script instead of taking it`);
    if (!isIndexBesideRunSh(sc.arg)) problems.push(`node's script\n        expected: ${show(INDEX_JS)} — the absolute path of the index.js beside the run.sh under test (T28)\n        actual:   ${show(sc.arg)}${path.isAbsolute(sc.arg) ? '' : ` (not absolute; from node's working directory it would be ${show(sc.resolved)})`}${sc.arg.startsWith(tools().decoy) ? ' (built from the conf\'s BRAINSTORM_MODULE_*_DIR, which point at a decoy here)' : ''}`);
    if (sc.index !== s.args.length - 1) problems.push(`arguments after the script (the engine takes none): ${show(s.args.slice(sc.index + 1))}`);
  }
  assert(problems.length === 0, `argv ${argvOf(s)}\n        ${problems.join('\n        ')}`);
});

test('RW5: node runs with the conf\'s exported variables (the conf is sourced for the start), the wrapper\'s TAGGING_EDGES_STATE_DIR, and fd 8 open on <stateDir>/realtime/daemon.lock — the descriptor Node\'s lockHeld checks (ADR § Where it runs "Each Node start sources it in a subshell", "Node refuses a hand run … /proc/self/fdinfo/8 … ino equals daemon.lock\'s"; C20; T23 BRAINSTORM_CONF; T24)', async () => {
  const o = await need('on');
  assert(o.first, `node was never started within ${MS.firstStart} ms with the switch on${tailOf(o.wrapper)}`);
  const s = o.wrapper.starts[0];
  const problems = [];
  if (s.marker !== o.alpha) problems.push(`TE_RW_MARKER (exported by BRAINSTORM_CONF)\n        expected: ${show(o.alpha)}\n        actual:   ${show(s.marker)}`);
  if (s.onlyFirst !== 'yes') problems.push(`TE_RW_ONLY_FIRST (exported by BRAINSTORM_CONF)\n        expected: "yes"\n        actual:   ${show(s.onlyFirst)}`);
  if (s.stateDir !== o.stateDir) problems.push(`TAGGING_EDGES_STATE_DIR as node sees it\n        expected: ${show(o.stateDir)}\n        actual:   ${show(s.stateDir)}`);
  if (!o.lockIno) problems.push('<stateDir>/realtime/daemon.lock does not exist');
  else if (s.fd8 !== o.lockIno) problems.push(`fd 8 in node\n        expected: open on daemon.lock (inode ${o.lockIno})\n        actual:   ${s.fd8 === 'closed' ? 'fd 8 is not open' : `inode ${show(s.fd8)}`}`);
  assert(problems.length === 0, problems.join('\n        '));
});

test('RW6: the conf is re-read at every node start — an edit between two starts is seen by the second, and a variable only the first version exported is gone, because the wrapper never sources the conf into its own environment (ADR § Where it runs "It does not source /etc/brainstorm.conf itself … so the file is re-read at every Node start"; § How each AC is met, AC-5 "the conf is re-read per start")', async () => {
  const o = await need('on');
  assert(o.first, `node was never started within ${MS.firstStart} ms with the switch on${tailOf(o.wrapper)}`);
  assert(o.second, `node was not started again within ${MS.restart} ms after it exited 1 (the conf had been edited in between)${tailOf(o.wrapper)}`);
  const s = o.wrapper.starts[1];
  const problems = [];
  if (s.marker !== o.beta) problems.push(`TE_RW_MARKER at the second start\n        expected: ${show(o.beta)} (the edited conf)\n        actual:   ${show(s.marker)}${s.marker === o.alpha ? ' (the first version: the conf was not re-read)' : ''}`);
  if (s.onlyFirst !== UNSET) problems.push(`TE_RW_ONLY_FIRST at the second start (only the first conf exported it)\n        expected: unset\n        actual:   ${show(s.onlyFirst)} (the wrapper kept the first conf's exports in its own environment)`);
  assert(problems.length === 0, problems.join('\n        '));
});

// ─── recovering alone (AC-5) ───────────────────────────────────────────────────────────────────────────────────
test('RW7: a node that exits at once — with 1, and with 0 — is restarted with backoff, not in a hot loop: in the 6.5 s after the first start there are 2 to 4 starts, the second 0.8–3.5 s after the first and any third at least 1.6 s after the second (ADR § Where it runs "A non-zero exit, or any exit within 60 s of start, backs off 1→2→4…30 s"; AC-5 "Repeated failed starts never leave it stopped")', async () => {
  const o = await need('quick');
  await cases(o.byCode, async (w) => {
    assert(w.starts.length >= 1, `node was never started within ${MS.firstStart} ms with the switch on${tailOf(w)}`);
    const off = w.offsets;
    const gaps = off.slice(1).map((t, i) => t - off[i]);
    const seen = `starts at ${show(off.map((t) => +(t / 1000).toFixed(2)))} s`;
    assert(off.length <= 4, `a hot loop: ${off.length} starts in ${secs(MS.quickWindow)} (${seen})\n        expected: at most 4 (1→2→4 s backoff gives 3)\n        actual:   ${off.length}`);
    assert(off.length >= 2, `node was not restarted within ${secs(MS.quickWindow)} after exiting ${w.code} (${seen})\n        expected: a second start about 1 s later\n        actual:   none${tailOf(w)}`);
    assert(gaps[0] >= 800 && gaps[0] <= 3500, `the first restart came ${secs(gaps[0])} after the first start (${seen})\n        expected: 0.8–3.5 s (a 1 s backoff, plus at most a poll)\n        actual:   ${secs(gaps[0])}`);
    if (gaps.length >= 2) assert(gaps[1] >= 1600, `the second restart came ${secs(gaps[1])} after the first restart (${seen})\n        expected: at least 1.6 s (the backoff doubles to 2 s)\n        actual:   ${secs(gaps[1])}`);
  });
});

test('RW8: the wrapper itself never exits when node exits — after repeated quick node exits (with 1 and with 0) it is still running, so supervisord never sees it exit and never marks it FATAL (ADR § Where it runs "It never exits by itself, so supervisord never marks it FATAL (AC-5)"; D2-A; AC-5 "Recovers alone")', async () => {
  const o = await need('quick');
  await cases(o.byCode, async (w) => {
    assert(w.starts.length >= 2, `node exited ${w.code} and was not restarted (${w.starts.length} start(s)) — the wrapper stopped supervising it${tailOf(w)}`);
    assert(w.exited === null, `the wrapper exited after node exited ${w.code}: ${show(w.exited)}\n        expected: still running\n        actual:   exited${tailOf(w)}`);
  });
});

test('RW9: a conf that cannot be sourced (BRAINSTORM_CONF names a missing file) starts no node and does not stop the wrapper; once the conf appears, a later start runs node with it, within 8 s (ADR § Where it runs "a failed source exits non-zero into the backoff"; AC-3 "A bad setup writes nothing"; AC-5 "Recovers alone"; T23 BRAINSTORM_CONF; T28 "Sourcing" — `( . "$BRAINSTORM_CONF" && exec node … )`)', async () => {
  const o = await need('source');
  const problems = [];
  if (o.before.starts !== 0) problems.push(`node was started ${o.before.starts} time(s) while the conf was missing\n        expected: 0 (the source fails, so exec node is never reached)\n        actual:   ${o.before.starts}`);
  if (o.before.exited) problems.push(`the wrapper exited while the conf was missing: ${show(o.before.exited)}`);
  if (!o.started) problems.push(`no start within ${secs(MS.sourceFixed)} after the conf appeared`);
  else if (o.start.marker !== o.gamma) problems.push(`the start after the conf appeared\n        expected: TE_RW_MARKER ${show(o.gamma)}\n        actual:   ${show(o.start.marker)}`);
  if (o.wrapper.exited) problems.push(`the wrapper exited: ${show(o.wrapper.exited)}`);
  assert(problems.length === 0, `${problems.join('\n        ')}${tailOf(o.wrapper)}`);
});

test('RW10: after node exits with the switch off, the wrapper does not start it again (no start for 3.5 s, the wrapper still running), and it starts node once the switch is on again (ADR § Status and switch "The wrapper does not restart Node while the switch is off, and turning it back on catches up"; AC-5 "Off means off", "Turning it on again catches up")', async () => {
  const o = await need('switchOff');
  assert(o.first, `node was never started within ${MS.firstStart} ms with the switch on${tailOf(o.wrapper)}`);
  const problems = [];
  const extra = o.afterOff.starts - 1;
  if (extra !== 0) problems.push(`node was started ${extra} more time(s) within ${secs(MS.offAfterExit)} of exiting with the switch off\n        expected: 0\n        actual:   ${extra}`);
  if (o.afterOff.exited) problems.push(`the wrapper exited after node's exit with the switch off: ${show(o.afterOff.exited)}`);
  else if (!o.reOn || !o.reOn.started) problems.push(`node was not started within ${secs(MS.restart)} of the switch going on again`);
  assert(problems.length === 0, `${problems.join('\n        ')}${tailOf(o.wrapper)}`);
});

// ─── stopping (supervisord's TERM) ─────────────────────────────────────────────────────────────────────────────
test('RW11: TERM to the wrapper (its pid alone) forwards TERM to node, waits for node to finish, and exits 0 — node is not started again (ADR § Where it runs "A TERM or INT trap sends TERM to the child, waits for it, and exits 0"; the program block\'s stopwaitsecs=10; AC-5)', async () => {
  const o = await need('signals');
  const w = o.byName.term;
  assert(w.before.starts === 1 && !w.before.exited, `before the signal: expected one running node and a running wrapper, got ${w.before.starts} start(s), wrapper exited ${show(w.before.exited)}${tailOf(w)}`);
  const problems = [];
  const nodePid = w.starts[0].pid;
  const got = w.signals.filter((s) => s.pid === nodePid).map((s) => s.sig);
  if (got.length !== 1 || got[0] !== 'TERM') problems.push(`the signals node received\n        expected: ["TERM"]\n        actual:   ${show(got)}`);
  if (!w.exited) problems.push(`the wrapper had not exited ${secs(MS.signalExit)} after TERM`);
  else {
    if (w.exited.code !== 0 || w.exited.signal) problems.push(`the wrapper's exit\n        expected: code 0\n        actual:   ${show({ code: w.exited.code, signal: w.exited.signal })}`);
    if (!w.exited.stoppedAtExit) problems.push('the wrapper exited before node finished (node takes 1 s to stop after TERM) — it must wait for the child');
  }
  if (w.starts.length !== 1) problems.push(`node was started ${w.starts.length - 1} more time(s) after TERM`);
  assert(problems.length === 0, `${problems.join('\n        ')}${tailOf(w)}`);
});

test('RW12: INT to the wrapper forwards TERM — not INT, which a background job starts with ignored — to node, waits for it, and exits 0 (ADR § Where it runs "A TERM or INT trap sends TERM to the child … so TERM is what is forwarded")', async () => {
  const o = await need('signals');
  const w = o.byName.int;
  assert(w.before.starts === 1 && !w.before.exited, `before the signal: expected one running node and a running wrapper, got ${w.before.starts} start(s), wrapper exited ${show(w.before.exited)}${tailOf(w)}`);
  const problems = [];
  const nodePid = w.starts[0].pid;
  const got = w.signals.filter((s) => s.pid === nodePid).map((s) => s.sig);
  if (got.length !== 1 || got[0] !== 'TERM') problems.push(`the signals node received after INT to the wrapper\n        expected: ["TERM"]\n        actual:   ${show(got)}`);
  if (!w.exited) problems.push(`the wrapper had not exited ${secs(MS.signalExit)} after INT`);
  else {
    if (w.exited.code !== 0 || w.exited.signal) problems.push(`the wrapper's exit\n        expected: code 0\n        actual:   ${show({ code: w.exited.code, signal: w.exited.signal })}`);
    if (!w.exited.stoppedAtExit) problems.push('the wrapper exited before node finished — it must wait for the child');
  }
  if (w.starts.length !== 1) problems.push(`node was started ${w.starts.length - 1} more time(s) after INT`);
  assert(problems.length === 0, `${problems.join('\n        ')}${tailOf(w)}`);
});

test('RW13: TERM to an idle wrapper (switch off, no node) makes it exit 0 within a few seconds, starting no node (ADR § Where it runs "A TERM or INT trap … exits 0"; the program block\'s stopwaitsecs=10)', async () => {
  const o = await need('signals');
  const w = o.byName.idle;
  const problems = [];
  if (w.starts.length) problems.push(`node was started ${w.starts.length} time(s) by an idle wrapper`);
  if (!w.exited) problems.push(`the idle wrapper had not exited ${secs(MS.signalExit)} after TERM`);
  else if (w.exited.code !== 0 || w.exited.signal) problems.push(`the idle wrapper's exit\n        expected: code 0\n        actual:   ${show({ code: w.exited.code, signal: w.exited.signal })}`);
  assert(problems.length === 0, `${problems.join('\n        ')}${tailOf(w)}`);
});

// ─── one instance (daemon.lock) ────────────────────────────────────────────────────────────────────────────────
test('RW14: a second wrapper on the same state dir, while the first holds realtime/daemon.lock and runs node, never starts node — it calls `sleep 30` through PATH (returning at once here, through the test\'s sleep) and then exits 75, within the 4 s window (ADR § Where it runs "flock -n 8 || { sleep 30; exit 75; }. A second instance idles and exits; it never runs Node"; T23; T28 "run.sh calls flock and sleep through PATH (bare names)")', async () => {
  const o = await need('lock');
  assert(o.firstStarted, `the first wrapper never started node within ${MS.firstStart} ms${tailOf(o.first)}`);
  const b = o.second;
  const problems = [];
  if (b.starts.length) problems.push(`the second wrapper started node ${b.starts.length} time(s) (argv ${argvOf(b.starts[0])}) — only the lock holder may run node`);
  if (!b.sleeps.some((s) => Number(s) === 30)) problems.push(`the second wrapper's sleeps through PATH\n        expected: a \`sleep 30\` (the ADR's idle before exit 75)\n        actual:   ${b.sleeps.length ? show(b.sleeps) : 'none (its sleep did not go through PATH, or it never slept)'}`);
  if (!b.exited) problems.push(`the second wrapper had not exited within ${secs(MS.lockWindow)}\n        expected: exit 75 once its (shortened) sleep 30 returned\n        actual:   still running`);
  else if (b.exited.code !== 75 || b.exited.signal) problems.push(`the second wrapper's exit\n        expected: code 75\n        actual:   ${show({ code: b.exited.code, signal: b.exited.signal })}`);
  if (o.firstDuringSecond.exited) problems.push(`the first wrapper (the lock holder) exited while the second ran: ${show(o.firstDuringSecond.exited)}`);
  else if (o.firstDuringSecond.starts !== 1) problems.push(`the first wrapper's node was restarted while the second ran (${o.firstDuringSecond.starts} starts)`);
  assert(problems.length === 0, `${problems.join('\n        ')}${tailOf(b)}`);
});

test('RW15: the lock is the kernel\'s, released with its holder — after the holding wrapper and its node are killed (a crash), a new wrapper on the same state dir takes realtime/daemon.lock and starts node within 5 s (ADR § Where it runs "flock -n 8"; AC-5 "recovers from a crash by itself", "Repeated failed starts never leave it stopped")', async () => {
  const o = await need('lock');
  assert(o.firstStarted, `the first wrapper never started node within ${MS.firstStart} ms${tailOf(o.first)}`);
  assert(o.holderGone, 'fixture: the first wrapper\'s process group still had members 3 s after it was SIGKILLed');
  assert(o.third && o.third.started,
    `no node was started within ${MS.firstStart} ms by a new wrapper after the lock holder was killed\n        expected: a start (the dead holder's flock is gone)\n        actual:   none${o.third ? tailOf(o.third) : ''}`);
});

// ─── the pass's pgrep guard (AC-5 "Alongside the pass") ────────────────────────────────────────────────────────
test(`RW16: no command line of the path matches the pass's pgrep guard — the wrapper's, node's argv, and every process in the wrapper's tree or process group, observed while node runs, never contain '${PGREP_PATTERN}' (ADR § Where it runs "No command line of the path matches the pass's pgrep pattern"; story "A second gate"; AC-5 "A pass started while the path runs is never refused or skipped because of it")`, async () => {
  const o = await need('on');
  assert(o.first, `node was never started within ${MS.firstStart} ms with the switch on${tailOf(o.wrapper)}`);
  const problems = [];
  const hit = (s) => String(s).includes(PGREP_PATTERN);
  if (hit(RUN_SH)) problems.push(`the wrapper's own path ${show(RUN_SH)} matches`);
  o.wrapper.starts.forEach((s, i) => { if (s.args.some(hit)) problems.push(`node's argv at start ${i + 1} matches: ${argvOf(s)}`); });
  const psNote = [];
  for (const [when, rows] of [['while the first node held', o.ps1], ['after the restart', o.ps2]]) {
    if (rows === null) { psNote.push(`${when}: ps not available`); continue; }
    for (const r of rows) if (hit(r.args)) problems.push(`${when}: pid ${r.pid} ${show(r.args)}`);
  }
  if (o.ps1) {
    if (!o.ps1.some((r) => r.pid === o.wrapper.pid && r.args.includes('realtime/run.sh'))) problems.push(`fixture: ps did not show the wrapper (pid ${o.wrapper.pid}) — ${o.ps1.length} rows in its tree`);
    if (!o.ps1.some((r) => r.args.includes('realtime/index.js'))) problems.push(`fixture: ps did not show node running realtime/index.js in the wrapper's tree — rows ${show(o.ps1.map((r) => r.args))}`);
  }
  if (psNote.length) console.log(`        NOTE  RW16: ${psNote.join('; ')} (node's argv was still checked)`);
  assert(problems.length === 0, problems.join('\n        '));
});

// ─── flock and sleep through PATH; the backoff (T28) ───────────────────────────────────────────────────────────
test('RW17: run.sh calls `flock -n 8` through PATH by its bare name — every wrapper, idle ones included (it locks before its loop), calls the test\'s flock in that form; the lock holder\'s call succeeds, the second instance\'s is refused, and the call of the wrapper started after the holder\'s crash succeeds — and an idle wrapper\'s switch poll is `sleep <TAGGING_EDGES_REALTIME_POLL_SECONDS>` through PATH (ADR § Where it runs "exec 8>>"$DIR/daemon.lock"; flock -n 8 || { sleep 30; exit 75; }", "Its loop reads switch.json every 2 s"; T23 TAGGING_EDGES_REALTIME_POLL_SECONDS; T28 "PATH lookups. run.sh calls flock and sleep through PATH (bare names), as it does node")', async () => {
  const off = await need('off');
  const lock = await need('lock');
  const list = [
    ...off.byVariant.map((w) => ({ name: `idle, switch.json ${w.name}`, w, want: 'ok', idle: true })),
    { name: 'the lock holder', w: lock.first, want: 'ok' },
    ...(lock.second ? [{ name: 'the second instance', w: lock.second, want: 'busy' }] : []),
    ...(lock.third ? [{ name: 'the wrapper started after the holder\'s crash', w: lock.third, want: 'ok' }] : []),
  ];
  await cases(list, async ({ w, want, idle }) => {
    const problems = [];
    if (!w.flocks.length) {
      problems.push(`no flock call through PATH\n        expected: \`flock -n 8\` → ${want}\n        actual:   none — flock was not called by its bare name, so the test's flock on PATH never ran${host().lockMode === 'shim' ? ' (and this host has no other flock(1))' : ''}`);
    } else {
      if (w.flocks.some((f) => !isFlockN8(f.args))) problems.push(`flock called in another form\n        expected: \`flock -n 8\` (exclusive, non-blocking, on fd 8)\n        actual:   ${flocksShown(w)}`);
      if (want === 'ok' && !w.flocks.some((f) => f.res === 'ok')) problems.push(`the lock was not taken\n        expected: flock -n 8 → ok\n        actual:   ${flocksShown(w)}`);
      if (want === 'busy' && w.flocks.some((f) => f.res === 'ok')) problems.push(`the second instance took the lock the first holds\n        expected: flock -n 8 → busy\n        actual:   ${flocksShown(w)}`);
    }
    if (idle) {
      if (!w.sleeps.length) problems.push(`the idle wrapper took no sleep through PATH in ${secs(MS.offWindow)}\n        expected: its switch poll, \`sleep ${POLL_SECONDS}\`\n        actual:   none`);
      else if (w.sleeps.some((s) => Number(s) !== Number(POLL_SECONDS))) problems.push(`the idle wrapper's sleeps through PATH\n        expected: each \`sleep ${POLL_SECONDS}\` (TAGGING_EDGES_REALTIME_POLL_SECONDS)\n        actual:   ${show(w.sleeps)}`);
    }
    assert(problems.length === 0, `${problems.join('\n        ')}${tailOf(w)}`);
  });
});

/** Do a wrapper's first backoff sleeps through PATH read 1, 2, 4, 8, 16, 30, 30, 30? A problem line, or null. */
function backoffProblem(w) {
  const got = backoffSleeps(w.sleeps).slice(0, BACKOFF_SEQUENCE.length);
  if (got.length === BACKOFF_SEQUENCE.length && got.every((s, i) => Number(s) === BACKOFF_SEQUENCE[i])) return null;
  const short = got.length < BACKOFF_SEQUENCE.length
    ? ` — only ${got.length} within ${secs(MS.fastWindow)}${got.length === 0 ? ' (no backoff sleep went through PATH)' : ''}`
    : '';
  return `the backoff sleeps through PATH (the poll's ${BACKOFF_POLL_SECONDS} s left out)\n        expected: ${show(BACKOFF_SEQUENCE.map(String))}\n        actual:   ${show(got)}${short}`;
}

test('RW18: after quick node exits — with 1, and with 0 — the wrapper backs off through PATH between starts: its sleeps are 1, 2, 4, 8, 16, 30, 30, 30 s, doubling from 1 s and capped at 30 s (each returns at once here, through the test\'s sleep), with a node start before each (ADR § Where it runs "A non-zero exit, or any exit within 60 s of start, backs off 1→2→4…30 s"; Decision diagram "backs off 1→30 s between runs"; T28 "run.sh calls flock and sleep through PATH"; AC-5 "Repeated failed starts never leave it stopped")', async () => {
  const o = await need('backoffFast');
  await cases(o.byNodeExit, async (w) => {
    const problems = [];
    if (!w.starts.length) problems.push('node was never started with the switch on');
    const p = backoffProblem(w);
    if (p) problems.push(p);
    else if (w.starts.length < BACKOFF_SEQUENCE.length) problems.push(`${BACKOFF_SEQUENCE.length} backoff sleeps came with only ${w.starts.length} node start(s)\n        expected: a node start before each backoff sleep\n        actual:   ${w.starts.length} start(s)`);
    if (w.exited) problems.push(`the wrapper exited: ${show(w.exited)}`);
    assert(problems.length === 0, `${problems.join('\n        ')}${tailOf(w)}`);
  });
});

test('RW19: a conf whose source fails — it exports its variables, then its last command fails — starts no node: the per-start subshell is `( . "$BRAINSTORM_CONF" && exec node … )`, so a failed source never reaches node (with `;` node would start on the half-read conf); the subshell exits non-zero into the backoff instead — 1, 2, 4, 8, 16, 30, 30, 30 s through PATH, as for a node that exits — and the wrapper keeps running (ADR § Where it runs "The file\'s lines are `export …`; a failed source exits non-zero into the backoff"; T28 "Sourcing. The per-start subshell is ( . "$BRAINSTORM_CONF" && exec node … ). The Decision diagram\'s ; is corrected to &&"; AC-3 "A bad setup writes nothing"; AC-5 "Recovers alone")', async () => {
  const o = await need('backoffFast');
  const w = o.source;
  const problems = [];
  if (w.starts.length) {
    const m = w.starts[0].marker;
    problems.push(`node was started ${w.starts.length} time(s) although sourcing the conf failed\n        expected: 0 (\`. conf && exec node\` stops at the failed source)\n        actual:   ${w.starts.length}, TE_RW_MARKER ${show(m)}${m === o.failing ? ' — the failing conf\'s exports reached node, so the source\'s status was ignored (`;`, not `&&`)' : ''}`);
  }
  const p = backoffProblem(w);
  if (p) problems.push(p);
  if (w.exited) problems.push(`the wrapper exited: ${show(w.exited)}`);
  assert(problems.length === 0, `${problems.join('\n        ')}${tailOf(w)}`);
});

// ─── stopping during a backoff (T28 "Signals") ─────────────────────────────────────────────────────────────────
test('RW20: TERM to the wrapper during a backoff sleep makes it exit 0 within 1 s, starting no node — its backoff sleeps run in the background and it `wait`s, so the trap runs at once, not when the sleep ends (here the backoff sleep through PATH is stretched to 20 s) (ADR § Where it runs "A TERM or INT trap … exits 0"; the program block\'s stopwaitsecs=10; T28 "Signals. It runs its backoff sleeps in the background and waits, so a TERM during a backoff exits within 1 s")', async () => {
  const o = await need('termInBackoff');
  const w = o.wrapper;
  assert(o.first, `node was never started within ${MS.firstStart} ms with the switch on${tailOf(w)}`);
  assert(o.inBackoff,
    `after node exited 1, the wrapper took no backoff sleep through PATH within ${secs(MS.restart)}\n        expected: \`sleep 1\` through PATH (T28), stretched here to 20 s\n        actual:   sleeps ${show(w.sleeps)}${w.exited ? `, wrapper exited ${show(w.exited)}` : ''}${tailOf(w)}`);
  assert(o.before && !o.before.exited, `fixture: the wrapper had exited before the TERM: ${show(w.exited)}${tailOf(w)}`);
  const problems = [];
  if (!w.exited) {
    problems.push(`the wrapper had not exited ${secs(MS.backoffWatch)} after TERM during its backoff sleep (${show(o.before.sleeps)})\n        expected: exit 0 within ${secs(MS.backoffTerm)}\n        actual:   still running — a sleep in the foreground defers the trap until the sleep ends`);
  } else {
    const ms = w.exited.at - o.sentAt;
    if (ms > MS.backoffTerm) problems.push(`the wrapper's exit after TERM during its backoff sleep\n        expected: within ${secs(MS.backoffTerm)}\n        actual:   ${secs(ms)}`);
    if (w.exited.code !== 0 || w.exited.signal) problems.push(`the wrapper's exit\n        expected: code 0\n        actual:   ${show({ code: w.exited.code, signal: w.exited.signal })}`);
  }
  if (w.starts.length !== o.before.starts) problems.push(`node was started ${w.starts.length - o.before.starts} more time(s) after TERM`);
  assert(problems.length === 0, `${problems.join('\n        ')}${tailOf(w)}`);
});

// ─── bash 3.2 (T28 "Compatibility") ────────────────────────────────────────────────────────────────────────────
/**
 * Bash-4-and-later syntax a cheap line scan can see. HEURISTIC: it matches text, not a parse, after comments are
 * stripped; it can miss what it does not list, and a match inside a quoted string would be a false alarm (the failure
 * names the line, for a human to judge).
 */
const BASH4_ONLY = [
  { what: 'an associative array (declare/local/typeset -A; bash 4.0)', re: /(?:^|[\s;&|(])(?:declare|local|typeset|readonly)\s+(?:-[A-Za-z]+\s+)*-[A-Za-z]*A/ },
  { what: 'a nameref or global declaration (declare/local/typeset -n or -g; bash 4.2–4.3)', re: /(?:^|[\s;&|(])(?:declare|local|typeset)\s+(?:-[A-Za-z]+\s+)*-[A-Za-z]*[gn]\b/ },
  { what: 'case conversion ${var,,} ${var^^} ${var,} ${var^} (bash 4.0)', re: /\$\{[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]*\])?(?:\^\^?|,,?)/ },
  { what: 'a ${var@op} transformation (bash 4.4)', re: /\$\{[A-Za-z_][A-Za-z0-9_]*(?:\[[^\]]*\])?@[QEPAaKkUuL]\}/ },
  { what: 'mapfile / readarray / coproc (bash 4.0)', re: /(?:^|[\s;&|(`])(?:mapfile|readarray|coproc)(?=\s|$)/ },
  { what: '|& (bash 4.0)', re: /\|&/ },
  { what: '&>> (bash 4.0)', re: /&>>/ },
  { what: 'a ;& or ;;& case terminator (bash 4.0)', re: /;;&|(?<!;);&(?=\s|$)/ },
  { what: 'wait -n / -f / -p (bash 4.3+)', re: /(?:^|[\s;&|(])wait\s+(?:-[A-Za-z]+\s+)*-[A-Za-z]*[nfp]\b/ },
  { what: 'test -v / [ -v ] / [[ -v ]] (bash 4.2)', re: /(?:\[\[?|(?:^|[\s;&|(])test)\s+(?:!\s+)?-v\s/ },
  { what: 'a negative array subscript ${a[-1]} (bash 4.3)', re: /\$\{[A-Za-z_][A-Za-z0-9_]*\[\s*-\s*\d/ },
  { what: 'a negative substring length ${var:off:-n} (bash 4.2)', re: /\$\{[A-Za-z_][A-Za-z0-9_]*:[^}:]*:\s*-\s*\d/ },
  { what: 'an automatic file descriptor {var}> / {var}< (bash 4.1)', re: /(?<![$\w])\{[A-Za-z_][A-Za-z0-9_]*\}[<>]/ },
  { what: '$BASHPID / $EPOCHSECONDS / $EPOCHREALTIME / $SRANDOM / $BASH_ARGV0 (bash 4.0–5.1)', re: /\$\{?(?:BASHPID|EPOCHSECONDS|EPOCHREALTIME|SRANDOM|BASH_ARGV0)\b/ },
  { what: 'printf %(fmt)T (bash 4.2)', re: /%\([^)]*\)T/ },
  { what: 'a bash-4 shopt (globstar, lastpipe, inherit_errexit, …)', re: /\bshopt\s+-s\s+(?:[A-Za-z_]+\s+)*(?:globstar|lastpipe|inherit_errexit|localvar_inherit|localvar_unset|assoc_expand_once|globasciiranges|direxpand|dirspell|checkjobs|autocd|compat3[12]|compat4\d)\b/ },
  { what: 'a fractional read -t timeout (bash 4.0)', re: /(?:^|[\s;&|(])read\s+(?:-[A-Za-z]+\s+)*-[A-Za-z]*t\s*\d*\.\d/ },
];
/** run.sh's lines with comments stripped (a whole-line comment, or a # after whitespace), numbered from 1. */
function codeLines(text) {
  return text.split('\n').map((line, i) => ({ n: i + 1, raw: line, code: /^\s*#/.test(line) ? '' : line.replace(/(^|\s)#.*$/, '$1') }));
}

test('RW21 (heuristic): run.sh stays bash-3.2-compatible — a cheap static scan finds none of the bash-4-only syntax it knows (associative arrays, ${var,,} / ${var^^}, mapfile / readarray / coproc, |&, &>>, ;& / ;;&, wait -n, [[ -v ]], ${a[-1]}, {fd}>, $EPOCHSECONDS, bash-4 shopts, …), and `bash -n` accepts it under every bash this host has (a 3.x one where present). A heuristic only: it can miss what it does not list, and it runs nothing (T28 "Compatibility. It stays bash-3.2-compatible"; the wrapper runs under the container\'s bash and under macOS\'s /bin/bash 3.2)', async () => {
  const file = load();
  const text = fs.readFileSync(file, 'utf8');
  const problems = [];
  for (const { n, raw, code } of codeLines(text)) {
    for (const { what, re } of BASH4_ONLY) if (re.test(code)) problems.push(`line ${n}: ${what}\n            ${show(raw.trim())}`);
  }
  const hs = host();
  const bashes = [...new Set(['/bin/bash', hs.bash ? hs.bash.path : null].filter((b) => b && (b === 'bash' || statOrNull(b))))];
  const versions = [];
  for (const b of bashes) {
    const v = spawnSync(b, ['-c', 'printf %s "$BASH_VERSION"'], { encoding: 'utf8', timeout: 5000 });
    if (v.error || v.status !== 0) continue;
    const version = (v.stdout || '').trim() || '?';
    versions.push(version);
    const r = spawnSync(b, ['-n', file], { encoding: 'utf8', timeout: 5000 });
    if (r.error || r.status !== 0) problems.push(`\`${b} -n run.sh\` (bash ${version}) rejects it: ${show(((r.stderr || '') + (r.error ? firstLine(r.error) : '')).trim().slice(0, 300))}`);
  }
  if (!versions.length) console.log('        NOTE  RW21: no bash on this host, so only the static scan ran');
  else if (!versions.some((v) => /^3\./.test(v))) console.log(`        NOTE  RW21: no bash 3.x on this host; \`bash -n\` ran under ${versions.join(', ')} (the static scan still ran)`);
  assert(problems.length === 0, `${problems.length} bash-3.2 compatibility problem(s) in ${RUN_SH_REL}:\n        ${problems.join('\n        ')}`);
});

// ─── a healthy run resets the backoff (T34; found by the mutation pass over the blind reference) ─────────────────
test('RW22: a healthy run resets the backoff — with T34\'s seam TAGGING_EDGES_REALTIME_HEALTHY_SECONDS=3, three node starts that exit 1 at once are backed off 1, 2, 4 s through PATH, and after a fourth start that runs 4 s (longer than the threshold) and then exits 1, the next backoff sleep is 1 s again, not 8 (ADR § Where it runs "A non-zero exit, or any exit within 60 s of start, backs off 1→2→4…30 s (reset after 60 s of healthy running)"; T34 "run.sh honours TAGGING_EDGES_REALTIME_HEALTHY_SECONDS (default 60) … that many seconds of healthy running resets the backoff"; AC-5 "Recovers alone")', async () => {
  const o = await need('healthyReset');
  const w = o.wrapper;
  const want = HEALTHY_RESET_SEQUENCE.map(String);
  const got = backoffSleeps(w.sleeps).slice(0, want.length);
  const offsets = w.starts.map((s) => s.at - w.starts[0].at);
  const problems = [];
  if (w.starts.length <= want.length) {
    problems.push(`node was started ${w.starts.length} time(s) within ${secs(MS.healthyWindow)}; the scenario needs ${want.length + 1} (starts at ${show(offsets)} ms)`);
  } else if (offsets[4] - offsets[3] < Number(HEALTHY_SECONDS) * 1000) {
    problems.push(`fixture: the 4th start should run ${HEALTHY_RUN_SECONDS} s, longer than the ${HEALTHY_SECONDS} s threshold; the 5th came ${offsets[4] - offsets[3]} ms after it (starts at ${show(offsets)} ms)`);
  }
  if (show(got) !== show(want)) {
    problems.push(`the backoff sleeps through PATH (the poll's ${BACKOFF_POLL_SECONDS} s left out)\n        expected: ${show(want)} — back to 1 s after the 4th start ran longer than TAGGING_EDGES_REALTIME_HEALTHY_SECONDS=${HEALTHY_SECONDS} (T34)\n        actual:   ${show(got)}${got[3] === '8' ? ' — the backoff kept doubling: the healthy run did not reset it, or the T34 seam was not honoured' : ''}; node starts at ${show(offsets)} ms`);
  }
  if (w.exited) problems.push(`the wrapper exited: ${show(w.exited)}`);
  assert(problems.length === 0, `${problems.join('\n        ')}${tailOf(w)}`);
});

// ─── runner ────────────────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- tagging-edges real-time wrapper tests (epic tagging-edges, Story 3 — run.sh in child processes) ---');
  console.log(`  ${hostLine()}`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  try {
    for (const [name, fn] of tests) {
      try { await fn(); console.log(`  PASS  ${name}`); pass++; }
      catch (err) {
        if (err && err.skip) { console.log(`  SKIP  ${name}\n        ${err.message}`); skipped++; }
        else { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
      }
    }
  } finally {
    if (STARTED) await Promise.all(Object.values(STARTED));
    for (const h of [...LIVE]) await kill(h);
    if (exitHookOn) { process.removeListener('exit', killAllNow); exitHookOn = false; }
    if (ROOT) { try { fs.rmSync(ROOT, { recursive: true, force: true }); } catch (_) { /* best effort */ } }
    ROOT = null; TOOLS = null; STARTED = null;
  }
  console.log(`\ntagging-edges-realtime-wrapper: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
