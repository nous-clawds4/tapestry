/**
 * A strict `strfry scan` reader (tagging-edges story 2, ADR tagging-edges/0002 D2; amended by story 3,
 * ADR tagging-edges/0003 § Amendments → ADR 0002 "New files").
 *
 * A read is complete only when every one of these holds; otherwise the promise rejects with a
 * ScanError naming which (its `code`), so a failed or partial scan can never read as "the relay
 * holds nothing":
 *
 *   filter-too-large  the filter's argv text passed LIMITS.argvFilterBytes (checked before spawn)
 *   spawn            spawn() threw, gave no child process, or the filter is not JSON
 *   process-error    the child emitted 'error' (strfry absent included), had no stdout, or its stdout failed
 *   timeout          no 'close' within timeoutMs (the child is SIGKILLed)
 *   exit             it exited with a non-zero code
 *   signal           it was ended by a signal
 *   truncated        stdout was non-empty and did not end in a newline
 *   unparseable      a non-empty line is not JSON
 *   not-an-event-line  a line parsed to something that is not an object with a 64-hex id
 *   duplicate        an id repeats (compared lower-cased)
 *   off-filter       an event the caller's isExpected refuses
 *   too-large        stdout passed maxBytes
 *
 * The filter is one filter or an array of them. It reaches strfry's argv as escapeFilterArgv() writes it — JSON
 * with every `/` written `\/` (T1: the planner's own escape, re-exported here) — so no strfry command line carries
 * the pass's pgrep pattern, whatever a publisher's `d` says (ADR 0003 § Where it runs; AC-5).
 *
 * With `onEvent`, each event is handed to it as its line is read and is not kept (`events` stays empty). Every rule
 * above still holds, so events read before a later failure have already been handed over and the scan still rejects
 * (T31); the line a rule refuses never is. An onEvent that throws rejects the scan with its own error, never an empty
 * or partial read.
 *
 * stdout is decoded with setEncoding('utf8') (a multi-byte character split across pipe chunks is
 * reassembled, never replaced; a byte sequence that is not valid UTF-8 is decoded as U+FFFD, not refused)
 * and split into lines as it arrives. `bytes` counts the decoded text re-encoded as UTF-8 — the bytes
 * read, for valid UTF-8. No count is taken: a second process would read a second snapshot. The error's
 * stderrTail is redacted, because the pass's report carries it to a public route: the last `strfry error:` line
 * or the exit code, at most 300 characters, through redactPublicText() — any URI, any absolute path that starts a
 * word, and any host:port (see redactPublicText) replaced, and every 64-hex run cut to 8 characters. (Amended in
 * review round 1, 2026-09-28: paths too; strfry names its config file's path when it cannot load it. Widened by
 * story 3, CF-3: named and IPv6 host:port too; strfry's stderr names redis:6379.)
 */

const { LIMITS, escapeFilterArgv, filterArgvBytes } = require('./tagging-edges/realtime');

const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_BYTES = 256 * 1024 * 1024;
const STDERR_KEEP = 4096;
const TAIL_MAX = 300;
const REDACT_INPUT_MAX = 4096;
const ID_RE = /^[0-9a-fA-F]{64}$/;

class ScanError extends Error {
  constructor(code, message, stderrTail = null) {
    super(message);
    this.name = 'ScanError';
    this.code = code;
    this.stderrTail = stderrTail;
  }
}

/**
 * Error text a public route may serve (the tagging-edges pass's report and the real-time path's log share this one
 * redactor): any URI (it may carry credentials) → `<uri>`; then any absolute path that starts a word, a `/` at the
 * start or after whitespace, a quote, `[`, `(` or `=` → `<path>` (a path after any other character, such as
 * `file:/…`, `,/…` or `{/…`, is kept); then any host:port → `<host>`: a bracketed IPv6 `[<ipv6>]:<port>`, an IPv4
 * `<a.b.c.d>:<port>`, and a letter-led single-label or dotted name with a 2–5 digit port (`neo4j:7687`,
 * `neo4j.internal:7687`, `redis:6379`; CF-3); and every run of 64 or more hex characters cut to its first 8. A
 * relative path (`../lib/x`) and a clock time (`03:24:18`) are kept. The name rule can also take a letter-led word
 * before `:<digits>`, such as a tagging address whose `d` starts with 2–5 digits (ADR 0003's New debt; T31): too
 * much is cut, never too little. A name with an underscore (`tapestry_neo4j_1:7687`) is not taken (the story's
 * Deviations). Text past 4 KB is cut first, back to the last whitespace within it, so no rule runs on long input (the
 * name rule is quadratic on long dotted or hyphenated text) and no token is split into a part the rules no longer
 * recognise; the caller bounds the length it keeps.
 */
function redactPublicText(s) {
  let text = String(s);
  if (text.length > REDACT_INPUT_MAX) {
    let cut = REDACT_INPUT_MAX;
    while (cut > 0 && !/\s/.test(text[cut - 1])) cut -= 1;
    text = text.slice(0, cut);
  }
  return text
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s'"]+/gi, '<uri>')
    .replace(/(^|[\s'"[(=])\/[^\s'"\])]+/g, '$1<path>')
    .replace(/\[[0-9a-f.]*:[0-9a-f:.]*(?:%[\w.-]+)?\]:\d+\b/gi, '<host>')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}:\d+\b/g, '<host>')
    .replace(/\b[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*:\d{2,5}\b/gi, '<host>')
    .replace(/[0-9a-fA-F]{64,}/g, (m) => m.slice(0, 8));
}

/** The report's view of stderr: the last `strfry error:` line, else the exit code; ≤ 300 chars, redacted. */
function summarizeStderr(stderr, exitCode) {
  const lines = String(stderr || '').split('\n').map((l) => l.trim()).filter(Boolean);
  let picked = null;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].includes('strfry error:')) { picked = lines[i]; break; }
  }
  if (picked === null && exitCode !== null && exitCode !== undefined) picked = `exit code ${exitCode}`;
  if (picked === null) return null;
  return redactPublicText(picked).slice(0, TAIL_MAX);
}

/**
 * `strfry scan <filter>` → Promise<{ events, lines, bytes, elapsedMs }>, or a ScanError. With `onEvent`, `events`
 * is empty: each event went to onEvent (called synchronously, as its line is read).
 * @param {object|object[]} filter
 * @param {{ timeoutMs?: number, isExpected: (ev) => boolean, maxBytes?: number, onEvent?: (ev) => void,
 *   spawnImpl?: Function }} opts
 */
function scanStrict(filter, { timeoutMs = DEFAULT_TIMEOUT_MS, isExpected, maxBytes = DEFAULT_MAX_BYTES, onEvent, spawnImpl } = {}) {
  if (typeof isExpected !== 'function') {
    return Promise.reject(new TypeError('scanStrict: opts.isExpected must be a function (a strict read checks every event)'));
  }
  // The argv text is sized before spawn: an over-long command line is refused here (the planner bisects it), never
  // left to the host's E2BIG. A filter JSON cannot write is refused as a spawn failure, as it always was.
  let argv;
  try {
    const argvBytes = filterArgvBytes(filter);
    if (argvBytes > LIMITS.argvFilterBytes) {
      return Promise.reject(new ScanError('filter-too-large',
        `strfry scan filter is ${argvBytes} bytes on the command line, over ${LIMITS.argvFilterBytes}`));
    }
    argv = escapeFilterArgv(filter);
  } catch (_) {
    return Promise.reject(new ScanError('spawn', 'could not start strfry scan: the filter is not JSON'));
  }
  const streaming = typeof onEvent === 'function';
  const spawn = spawnImpl || require('child_process').spawn;
  const started = Date.now();
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    let child = null;
    let buf = '';
    let bytes = 0;
    let lineCount = 0;
    let stderr = '';
    const events = [];
    const ids = new Set();

    const kill = () => { try { if (child) child.kill('SIGKILL'); } catch (_) { /* already gone */ } };
    const abort = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      kill();
      reject(err);
    };
    const fail = (code, message, exitCode = null) => {
      if (!settled) abort(new ScanError(code, message, summarizeStderr(stderr, exitCode)));
    };
    const succeed = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ events, lines: lineCount, bytes, elapsedMs: Date.now() - started });
    };

    const takeLine = (raw) => {
      const line = raw.trim();
      if (!line) return true;
      lineCount += 1;
      let ev;
      try { ev = JSON.parse(line); } catch (_) { fail('unparseable', `line ${lineCount} is not JSON`); return false; }
      if (!ev || typeof ev !== 'object' || Array.isArray(ev) || typeof ev.id !== 'string' || !ID_RE.test(ev.id)) {
        fail('not-an-event-line', `line ${lineCount} is not an event`);
        return false;
      }
      const id = ev.id.toLowerCase();
      if (ids.has(id)) { fail('duplicate', `line ${lineCount} repeats an event id`); return false; }
      ids.add(id);
      let ok = false;
      try { ok = !!isExpected(ev); } catch (_) { ok = false; }
      if (!ok) { fail('off-filter', `line ${lineCount} was refused by the caller's isExpected`); return false; }
      if (!streaming) { events.push(ev); return true; }
      try { onEvent(ev); } catch (err) { abort(err); return false; } // the caller could not take it: never a read
      return true;
    };

    try {
      child = spawn('strfry', ['scan', argv], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      settled = true;
      reject(new ScanError('spawn', `could not start strfry scan: ${(err && err.code) || 'error'}`));
      return;
    }

    if (!child || typeof child.on !== 'function') {
      settled = true;
      reject(new ScanError('spawn', 'could not start strfry scan: no child process'));
      return;
    }

    timer = setTimeout(() => fail('timeout', `strfry scan timed out after ${timeoutMs}ms`), timeoutMs);

    // No stdout only when spawn hit EMFILE/ENFILE, which also emits 'error' (handled below) — so the
    // listeners stay attached, and a close without a read is a failure, never an empty relay.
    const reading = !!child.stdout;
    if (reading) {
      child.stdout.on('error', (err) => fail('process-error', `strfry scan stdout failed: ${(err && err.code) || 'error'}`));
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => {
        if (settled) return;
        bytes += Buffer.byteLength(chunk, 'utf8');
        if (bytes > maxBytes) { fail('too-large', `strfry scan output passed ${maxBytes} bytes`); return; }
        buf += chunk;
        if (chunk.indexOf('\n') < 0) return; // a chunk with no newline completes no line
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!takeLine(line)) return;
        }
      });
    }
    if (child.stderr) {
      child.stderr.on('error', () => { /* the tail is advisory; completeness is judged on stdout */ });
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => {
        stderr = (stderr + chunk).slice(-STDERR_KEEP);
      });
    }
    child.on('error', (err) => fail('process-error', `strfry scan could not run: ${(err && err.code) || 'error'}`));
    child.on('close', (code, signal) => {
      if (settled) return;
      if (signal !== null && signal !== undefined) { fail('signal', `strfry scan ended by ${signal}`); return; }
      if (code !== 0) { fail('exit', `strfry scan exited with code ${code}`, code); return; }
      if (!reading) { fail('process-error', 'strfry scan had no stdout to read'); return; }
      if (buf.length > 0) { fail('truncated', 'strfry scan output did not end in a newline'); return; }
      succeed();
    });
  });
}

module.exports = { scanStrict, ScanError, redactPublicText, escapeFilterArgv };
