/**
 * Story 2 (epic: deploy-safety-gate) — Cycle-skill safe-to-merge check +
 * canonical shared recipe.
 *
 * Story: engineering-team/stories/deploy-safety-gate/2-cycle-safe-to-merge-check.md
 * ADR:   engineering-team/decisions/deploy-safety-gate/0002-safe-to-merge-check-script-and-shared-recipe.md
 * Payload contract consumed (not reopened): ADR deploy-safety-gate/0001.
 *
 * Two test classes, both STACK-FREE (CI has no stack; nothing here touches
 * staging/prod or the local control panel):
 *
 *   B-class (behavior) — spawns `bash scripts/check-safe-to-merge.sh` against
 *     an EPHEMERAL in-process Node http server on an OS-assigned 127.0.0.1
 *     port, serving scripted /api/deploy-safety/status responses. The fixture
 *     IS the instance: safe / unsafe / unreachable / garbage sequences are
 *     deterministic. The script's [max-attempts] [interval-seconds] args keep
 *     every run fast — no test ever waits real minutes. Covers the exit-code
 *     contract (0 safe / 1 bound-exhausted / 2 no-usable-answer / 3 usage),
 *     the per-attempt journal line (timestamp, verdict, reasons, raw body
 *     with echoed bufferMs), the 3-strike no-answer fast path with
 *     usable-answer counter reset, and AC-1's consume-the-verdict-as-delivered
 *     rule. Spawn is async (child_process.spawn, awaited) so the in-process
 *     fixture can serve while the script runs — spawnSync would deadlock it.
 *
 *   C-class (content) — file reads, per the per-query-neo4j T5 /
 *     harness-lint precedent: docs/SAFE_TO_MERGE.md exists, names the script,
 *     pins 45 attempts × 60 s, maps staging→staging.brainstorm.world,
 *     main→tapestry.brainstorm.world, feat/tags→tags.brainstorm.world;
 *     cycle-staging and cycle-prod reference the recipe between PR-open /
 *     approval and the merge command (the merge's immediate precursor, by
 *     file step order) and restate no numbers; cycle-full names the check by
 *     delegation only (AC-4 negative: no script name, no doc name, no
 *     numbers, no tags URL, no endpoint path); doc↔script number alignment
 *     (the ADR's Consequences coupling note).
 *
 * ALL tests FAIL until the feature lands — the script, the doc, and the
 * skill edits do not exist yet. Each guard throws a feature-missing message
 * (never an opaque spawn/ENOENT error) so the pre-implementation failure
 * reads as "the feature is missing".
 */

const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'check-safe-to-merge.sh');
const DOC = path.join(ROOT, 'docs', 'SAFE_TO_MERGE.md');
const CYCLE_STAGING = path.join(ROOT, '.claude', 'skills', 'cycle-staging', 'SKILL.md');
const CYCLE_PROD = path.join(ROOT, '.claude', 'skills', 'cycle-prod', 'SKILL.md');
const CYCLE_FULL = path.join(ROOT, '.claude', 'skills', 'cycle-full', 'SKILL.md');

// Standalone-number matchers ("60s", "60 s", "×45", "45 attempts" all match;
// "450", "160" don't).
const NUM45 = /(^|[^0-9])45([^0-9]|$)/;
const NUM60 = /(^|[^0-9])60([^0-9]|$)/;
// A skill "references the recipe" via the doc or the script — either counts.
const RECIPE_REF = /SAFE_TO_MERGE\.md|check-safe-to-merge\.sh/;

// The pinned journal-line format (ADR 0002 sub-decision 7 / Implementation
// notes): [<UTC ISO ts>] attempt <i>/<N> verdict=<...> reasons=<...> raw=<...>
const ATTEMPT_RE = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\] attempt (\d+)\/(\d+) verdict=(safe|unsafe|no-answer) reasons=(.*?) raw=(.*)$/;

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { return null; }
}

function assertScriptExists() {
  assert(fs.existsSync(SCRIPT),
    'scripts/check-safe-to-merge.sh does not exist yet — the safe-to-merge ' +
    'wait-and-recheck mechanism (ADR deploy-safety-gate/0002 Option A) is not ' +
    'implemented.');
}

/** Some line of `content` matches every one of the given regexes. */
function hasLine(content, ...regexes) {
  return content.split('\n').some((line) => regexes.every((re) => re.test(line)));
}

/** Slice of `content` between the first `startMarker` and the first
 *  `endMarker` after it. Throws if either marker is missing (harness bug,
 *  not feature bug — the markers exist in the current files). */
function between(content, startMarker, endMarker, file) {
  const i = content.indexOf(startMarker);
  assert(i >= 0, `${file}: marker ${JSON.stringify(startMarker)} not found — re-baseline this test.`);
  const j = content.indexOf(endMarker, i + startMarker.length);
  assert(j > i, `${file}: marker ${JSON.stringify(endMarker)} not found after ${JSON.stringify(startMarker)} — re-baseline this test.`);
  return content.slice(i, j);
}

/* ─────────────── B-class fixture machinery ─────────────── */

/** An ADR-0001-shaped /api/deploy-safety/status body (compact JSON, the
 *  contract the script greps). */
function statusBody({ safe = true, reasons, bufferMs = 600000, nextFire = null } = {}) {
  return JSON.stringify({
    success: true,
    safeToDeploy: safe,
    verdict: safe ? 'safe' : 'unsafe',
    reasons: safe ? [] : (reasons || ['QUEUE_TASK_RUNNING']),
    checkedAt: new Date().toISOString(),
    bufferMs,
    queue: { enabled: true, stateKnown: true, activeCount: safe ? 0 : 1, activeTasks: [], schedulerHalted: false },
    legacy: { inFlightCount: 0 },
    schedule: { enabledEntryCount: 1, nextFire },
  });
}

const SAFE = () => ({ status: 200, contentType: 'application/json', body: statusBody({ safe: true }) });
const UNSAFE = (reasons, bufferMs) => ({ status: 200, contentType: 'application/json', body: statusBody({ safe: false, reasons, bufferMs }) });
const NOT_FOUND = () => ({ status: 404, contentType: 'text/plain', body: 'Cannot GET /api/deploy-safety/status' });
const GARBAGE = () => ({ status: 200, contentType: 'text/html', body: '<html><body>definitely not JSON</body></html>' });
const MISSING_FIELD = () => ({ status: 200, contentType: 'application/json', body: '{"success":true,"verdict":"mystery"}' });

/**
 * Ephemeral scripted HTTP fixture — the "instance" every B test checks.
 * Serves `specs` in order; once only one remains it repeats forever. Records
 * every request. OS-assigned port; 127.0.0.1 only; never staging/prod.
 */
function startFixture(specs) {
  return new Promise((resolve, reject) => {
    const requests = [];
    const remaining = specs.slice();
    const server = http.createServer((req, res) => {
      requests.push({ url: req.url, method: req.method });
      const spec = remaining.length > 1 ? remaining.shift() : remaining[0];
      res.writeHead(spec.status, { 'Content-Type': spec.contentType });
      res.end(spec.body);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      resolve({
        base: `http://127.0.0.1:${server.address().port}`,
        requests,
        close: () => new Promise((r) => {
          if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
          server.close(r);
        }),
      });
    });
  });
}

/** A 127.0.0.1 port with no listener (bound then released) — "instance
 *  unreachable" without ever touching a real host. */
async function refusedPort() {
  const srv = http.createServer();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  await new Promise((r) => srv.close(r));
  return port;
}

/**
 * Run the script asynchronously (the event loop must stay live so the
 * in-process fixture can answer). Resolves { code, stdout, stderr, ms,
 * timedOut }. A hung script is killed at `timeoutMs` — "hung with no output"
 * is an AC-3 named defect, so a timeout is a test failure, never a wait.
 */
function runScript(args, { timeoutMs = 30000 } = {}) {
  assertScriptExists();
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn('bash', [SCRIPT, ...args], { cwd: ROOT, env: process.env });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: stderr + String(err), ms: Date.now() - started, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, ms: Date.now() - started, timedOut });
    });
  });
}

function parseAttempts(stdout) {
  return stdout.split('\n')
    .map((l) => l.match(ATTEMPT_RE))
    .filter(Boolean)
    .map((m) => ({ ts: m[1], i: Number(m[2]), n: Number(m[3]), verdict: m[4], reasons: m[5], raw: m[6] }));
}

function fmt(r) {
  return `exit=${r.code} timedOut=${r.timedOut}\n--- stdout ---\n${r.stdout}\n--- stderr ---\n${r.stderr}`;
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ══════════════ B-class — script behavior against the scripted fixture ══════════════ */

t('B1 (AC-1): a safe verdict on the first attempt exits 0 immediately — acted on, not banked across a sleep', async () => {
  const fx = await startFixture([SAFE()]);
  try {
    // interval 30: if the script slept its interval after a safe verdict, this
    // run would take 30s and trip the duration bound — "act immediately".
    const r = await runScript([fx.base, '5', '30'], { timeoutMs: 15000 });
    assert(!r.timedOut && r.ms < 10000,
      `a safe first answer must exit at once with no residual interval sleep (took ${r.ms}ms, timedOut=${r.timedOut}) — ${fmt(r)}`);
    assert(r.code === 0, `exit code must be 0 on a just-observed safe verdict (got ${r.code}) — ${fmt(r)}`);
    assert(fx.requests.length === 1,
      `exactly one status request expected (got ${fx.requests.length}: ${JSON.stringify(fx.requests)}).`);
    assert(fx.requests[0].url.startsWith('/api/deploy-safety/status'),
      `the script must call GET /api/deploy-safety/status — the story #1 answer (got ${fx.requests[0].url}).`);
    assert(!fx.requests[0].url.includes('bufferMinutes'),
      `the request must NOT pin ?bufferMinutes= — the instance owns the verdict policy (ADR 0002 sub-decision 2); got ${fx.requests[0].url}.`);
    const lines = parseAttempts(r.stdout);
    assert(lines.length === 1 && lines[0].i === 1 && lines[0].n === 5 && lines[0].verdict === 'safe',
      `one journal line "[ts] attempt 1/5 verdict=safe …" expected (got ${JSON.stringify(lines)}) — every attempt is journaled, even the immediately-safe one. ${fmt(r)}`);
    assert(/merge may proceed/i.test(r.stdout),
      `the final line must say the merge may proceed (ADR: "SAFE — merge may proceed …") — ${fmt(r)}`);
    assert(/5 ?min/i.test(r.stdout),
      `the safe outcome must surface the 5-minute staleness rule (re-run if >5 min elapse before the merge) — AC-1's "just observed". ${fmt(r)}`);
  } finally { await fx.close(); }
});

t('B2 (AC-2): unsafe twice then safe — every attempt journaled with timestamp, verdict, reasons, raw body; cadence honored; exits 0 only after safe', async () => {
  const fx = await startFixture([
    UNSAFE(['QUEUE_TASK_RUNNING'], 540000), // distinctive bufferMs to prove the raw echo lands in the journal
    UNSAFE(['NEXT_FIRE_WITHIN_BUFFER']),
    SAFE(),
  ]);
  try {
    // interval 1: two sleeps between the three attempts ⇒ ≥ ~2s total. Proves
    // the stated cadence is honored, not improvised away.
    const r = await runScript([fx.base, '10', '1'], { timeoutMs: 20000 });
    assert(r.code === 0, `must exit 0 once the verdict flips safe (got ${r.code}) — ${fmt(r)}`);
    assert(fx.requests.length === 3, `three attempts expected (got ${fx.requests.length}).`);
    assert(r.ms >= 1800,
      `with interval=1 and two unsafe attempts the run must sleep between rechecks (~2s); ${r.ms}ms means the cadence argument is not honored.`);
    const lines = parseAttempts(r.stdout);
    assert(lines.length === 3,
      `three journal lines expected — AC-2: "at no point does it wait without recording that it is waiting" (got ${lines.length}). ${fmt(r)}`);
    assert(lines[0].verdict === 'unsafe' && lines[1].verdict === 'unsafe' && lines[2].verdict === 'safe',
      `verdict sequence must be unsafe,unsafe,safe (got ${lines.map((l) => l.verdict).join(',')}).`);
    assert(lines[0].reasons.includes('QUEUE_TASK_RUNNING'),
      `attempt 1's journal line must carry the reason the answer gave (QUEUE_TASK_RUNNING) in its reasons= field (got reasons=${lines[0].reasons}).`);
    assert(lines[1].reasons.includes('NEXT_FIRE_WITHIN_BUFFER'),
      `attempt 2's journal line must carry NEXT_FIRE_WITHIN_BUFFER (got reasons=${lines[1].reasons}).`);
    assert(lines[0].raw.includes('540000'),
      `the raw response body — including the echoed bufferMs (540000) — must be journaled verbatim on the attempt line (ADR sub-decision 7; the window each check used is always in the run record). Got raw=${lines[0].raw}`);
    assert(lines.map((l) => l.i).join(',') === '1,2,3',
      `attempt counters must be 1,2,3 (got ${lines.map((l) => l.i).join(',')}).`);
  } finally { await fx.close(); }
});

t('B3 (AC-2/AC-3): always-unsafe exhausts the stated bound — exit 1, every attempt journaled, loud BOUND EXHAUSTED stop, never a merge-on-unsafe', async () => {
  const fx = await startFixture([UNSAFE(['QUEUE_TASK_RUNNING', 'LEGACY_TASK_RUNNING'])]);
  try {
    const r = await runScript([fx.base, '3', '0'], { timeoutMs: 20000 });
    assert(!r.timedOut, `the script hung past the bound — "hung with no output" is an AC-3 named defect. ${fmt(r)}`);
    assert(r.code === 1,
      `bound exhausted while unsafe must exit 1 (the distinct bound-exhausted code — ADR exit contract 0/1/2/3); got ${r.code}. ${fmt(r)}`);
    assert(fx.requests.length === 3, `exactly max-attempts=3 requests expected (got ${fx.requests.length}).`);
    const lines = parseAttempts(r.stdout);
    assert(lines.length === 3 && lines.every((l) => l.verdict === 'unsafe'),
      `three journaled unsafe attempts expected (got ${JSON.stringify(lines.map((l) => l.verdict))}). ${fmt(r)}`);
    assert(/BOUND EXHAUSTED/.test(r.stdout),
      `the final line must report the bound was exhausted and hand the decision over (ADR: "BOUND EXHAUSTED … operator decides"). ${fmt(r)}`);
    assert(/operator/i.test(r.stdout),
      `the stop must explicitly hand the decision to the operator — proceeding is never the script's default. ${fmt(r)}`);
    assert(!/merge may proceed/i.test(r.stdout),
      `a run whose last observed verdict is unsafe must never print the merge-may-proceed outcome. ${fmt(r)}`);
  } finally { await fx.close(); }
});

t('B4 (AC-3): unreachable instance — 3 consecutive no-answer attempts exit 2 early (fast path), never treated as safe, never the full bound', async () => {
  const port = await refusedPort();
  const r = await runScript([`http://127.0.0.1:${port}`, '10', '0'], { timeoutMs: 20000 });
  assert(!r.timedOut, `the script hung on an unreachable instance. ${fmt(r)}`);
  assert(r.code === 2,
    `an answer that cannot be obtained is exit 2 (no-usable-answer), NEVER 0 — "an answer that could not be obtained is never treated as safe" (got ${r.code}). ${fmt(r)}`);
  const lines = parseAttempts(r.stdout);
  assert(lines.length === 3,
    `exactly 3 journaled attempts expected — the 3-consecutive-strike fast exit, not the full 10-attempt bound (got ${lines.length}). ${fmt(r)}`);
  assert(lines.every((l) => l.verdict === 'no-answer'),
    `every attempt must journal verdict=no-answer (got ${JSON.stringify(lines.map((l) => l.verdict))}).`);
  assert(/NO USABLE ANSWER/.test(r.stdout),
    `the final line must state no usable answer was obtained (ADR: "NO USABLE ANSWER — not treated as safe; operator decides"). ${fmt(r)}`);
  assert(/not treated as safe/i.test(r.stdout),
    `the stop must state the no-answer-is-not-safe rule out loud. ${fmt(r)}`);
});

t('B5 (AC-3): unusable answers — 404, non-JSON body, JSON missing safeToDeploy — each counts a strike; exit 2 after three, never safe', async () => {
  const fx = await startFixture([NOT_FOUND(), GARBAGE(), MISSING_FIELD()]);
  try {
    const r = await runScript([fx.base, '10', '0'], { timeoutMs: 20000 });
    assert(r.code === 2,
      `three consecutive unusable answers (non-2xx / unparseable / missing safeToDeploy) must exit 2 (got ${r.code}) — a 404ing pre-story-#1 instance must read "no usable answer", never "safe". ${fmt(r)}`);
    assert(fx.requests.length === 3, `exactly 3 requests expected before the fast exit (got ${fx.requests.length}).`);
    const lines = parseAttempts(r.stdout);
    assert(lines.length === 3 && lines.every((l) => l.verdict === 'no-answer'),
      `three verdict=no-answer journal lines expected (got ${JSON.stringify(lines.map((l) => l.verdict))}). ${fmt(r)}`);
    assert(!/merge may proceed/i.test(r.stdout),
      `an unusable-answer run must never print the merge-may-proceed outcome. ${fmt(r)}`);
  } finally { await fx.close(); }
});

t('B6 (AC-3): a usable answer resets the unusable-strike counter — blips do not kill a run that later observes safe', async () => {
  const fx = await startFixture([
    GARBAGE(), GARBAGE(),                     // strikes 1,2
    UNSAFE(['QUEUE_TASK_RUNNING']),           // usable ⇒ counter resets
    GARBAGE(), GARBAGE(),                     // strikes 1,2 again — never 3
    SAFE(),
  ]);
  try {
    const r = await runScript([fx.base, '10', '0'], { timeoutMs: 20000 });
    assert(r.code === 0,
      `interleaved blips (2 unusable, 1 unsafe, 2 unusable, safe) must reach the safe verdict and exit 0 — a usable answer resets the 3-strike counter, "a single blip shouldn't kill a run" (got ${r.code}). ${fmt(r)}`);
    assert(fx.requests.length === 6, `six attempts expected (got ${fx.requests.length}).`);
    const lines = parseAttempts(r.stdout);
    assert(lines.length === 6,
      `six journal lines expected — waiting through blips is still waiting, and must be recorded (got ${lines.length}). ${fmt(r)}`);
    assert(lines.map((l) => l.verdict).join(',') === 'no-answer,no-answer,unsafe,no-answer,no-answer,safe',
      `verdict sequence must be no-answer,no-answer,unsafe,no-answer,no-answer,safe (got ${lines.map((l) => l.verdict).join(',')}).`);
    assert(!/NO USABLE ANSWER/.test(r.stdout),
      `the no-answer fast exit must NOT fire — the strikes were never 3 consecutive. ${fmt(r)}`);
  } finally { await fx.close(); }
});

t('B7 (AC-3): missing or malformed instance URL — usage to stderr, exit 3, no requests made', async () => {
  const noArgs = await runScript([], { timeoutMs: 10000 });
  assert(noArgs.code === 3,
    `no arguments must exit 3 (usage error — distinct from every verdict outcome; got ${noArgs.code}). ${fmt(noArgs)}`);
  assert(/usage/i.test(noArgs.stderr),
    `usage must be printed to stderr on a missing URL arg (got stderr=${JSON.stringify(noArgs.stderr)}).`);
  const badUrl = await runScript(['not-a-url'], { timeoutMs: 10000 });
  assert(badUrl.code === 3,
    `a malformed instance URL ("not-a-url" — no http(s) scheme) must exit 3, not be curl'd (got ${badUrl.code}). ${fmt(badUrl)}`);
});

t('B8 (AC-1): the script consumes the verdict as delivered — safeToDeploy:true with an imminent nextFire in the payload still exits 0 (no re-derived policy)', async () => {
  // Bait for a re-deriving consumer: the instance says SAFE while the raw
  // schedule data shows a fire 2 minutes out flagged withinBuffer. The verdict
  // policy is the instance's (ratified decision 1); the script must branch on
  // safeToDeploy alone and journal the rest verbatim.
  const fx = await startFixture([{
    status: 200,
    contentType: 'application/json',
    body: statusBody({
      safe: true,
      nextFire: {
        entryId: 'seed:refreshPinnedTagTLs', taskId: 'refreshPinnedTagTLs',
        label: 'Refresh pinned tag TLs',
        at: new Date(Date.now() + 120000).toISOString(),
        inMs: 120000, withinBuffer: true,
      },
    }),
  }]);
  try {
    const r = await runScript([fx.base, '5', '0'], { timeoutMs: 15000 });
    assert(r.code === 0,
      `the instance's verdict is safeToDeploy:true — the script must exit 0 even though the raw schedule data shows an imminent fire; interpreting nextFire/reasons is AC-1's forbidden re-derivation (got ${r.code}). ${fmt(r)}`);
    assert(fx.requests.length === 1, `one attempt expected (got ${fx.requests.length}).`);
    const lines = parseAttempts(r.stdout);
    assert(lines.length === 1 && lines[0].verdict === 'safe' && lines[0].raw.includes('refreshPinnedTagTLs'),
      `the schedule detail must still be journaled verbatim in raw= (recorded, not interpreted). Got ${JSON.stringify(lines)}. ${fmt(r)}`);
  } finally { await fx.close(); }
});

t('B9 (AC-2): with no override args the default bound is 45 attempts — the journal itself says attempt 1/45', async () => {
  const fx = await startFixture([SAFE()]);
  try {
    // Safe on attempt 1 ⇒ no waiting, but the "/45" in the journal line
    // reveals the default bound behaviorally — recipe canon, not improvisation.
    const r = await runScript([fx.base], { timeoutMs: 15000 });
    assert(r.code === 0, `safe first answer under defaults must exit 0 (got ${r.code}). ${fmt(r)}`);
    const lines = parseAttempts(r.stdout);
    assert(lines.length === 1 && lines[0].i === 1 && lines[0].n === 45,
      `the default max-attempts must be 45 (ADR sub-decision 1: 60 s × 45 ≈ 45 min) — the journal must read "attempt 1/45" (got ${JSON.stringify(lines)}). ${fmt(r)}`);
  } finally { await fx.close(); }
});

/* ══════════════ C-class — canonical doc + skill content (AC-4/AC-5) ══════════════ */

t('C1 (AC-5): docs/SAFE_TO_MERGE.md exists, names the script as THE mechanism, and pins the canonical numbers 45 attempts × 60 s', () => {
  const doc = readSafe(DOC);
  assert(doc !== null,
    'docs/SAFE_TO_MERGE.md does not exist yet — the one canonical shared recipe ' +
    '(ADR deploy-safety-gate/0002 Option A, SMOKE_TEST.md pattern-twin) is not written.');
  assert(doc.includes('check-safe-to-merge.sh'),
    'the doc must name scripts/check-safe-to-merge.sh as the way to run the check — ' +
    'the recipe names the mechanism; consumers inherit both from one place.');
  assert(hasLine(doc, NUM45, /attempt/i),
    'the doc must pin the canonical bound — a line associating 45 with attempts ' +
    '("45 attempts") — AC-2: cadence and bound are written into the recipe, not improvised per run.');
  assert(hasLine(doc, NUM60, /(second|sec\b|\bs\b|interval|cadence)/i),
    'the doc must pin the canonical cadence — a line associating 60 with seconds ' +
    '("60 s" / "60-second interval").');
});

t('C2 (AC-5): the doc maps every covered branch to its instance — staging, main, and feat/tags → tags.brainstorm.world', () => {
  const doc = readSafe(DOC);
  assert(doc !== null, 'docs/SAFE_TO_MERGE.md does not exist yet — no branch → instance map.');
  assert(doc.includes('staging.brainstorm.world'),
    'the doc must map the staging promotion to staging.brainstorm.world.');
  assert(hasLine(doc, /\bmain\b/, /tapestry\.brainstorm\.world/),
    'the doc must map main → tapestry.brainstorm.world on one line (the branch → instance table).');
  assert(hasLine(doc, /feat\/tags/, /tags\.brainstorm\.world/),
    'the doc must map feat/tags → tags.brainstorm.world on one line — the ratified tags ' +
    'coverage (agreed decision 5): a tags promotion is never the uncovered path.');
  assert(doc.includes('cycle-staging') && doc.includes('cycle-prod'),
    'the doc must name the consuming cycle procedures (the consumer column of the map).');
});

t('C3 (AC-5/AC-3): the doc states the endpoint, the never-safe-on-no-answer rule, the operator hand-off, the 5-minute staleness rule, and the manual feat/tags procedure', () => {
  const doc = readSafe(DOC);
  assert(doc !== null, 'docs/SAFE_TO_MERGE.md does not exist yet — no verdict-handling rules.');
  assert(doc.includes('/api/deploy-safety/status'),
    'the doc must point at GET /api/deploy-safety/status — the story #1 answer the check consumes.');
  assert(hasLine(doc, /never/i, /safe/i),
    'the doc must state, on one line, that an unobtainable answer is NEVER treated as safe ' +
    '(AC-3; fail-closed is the recipe\'s rule, not per-run judgment).');
  assert(/operator/i.test(doc),
    'the doc must hand the post-stop decision to the operator explicitly — proceeding after ' +
    'a stop is only ever an explicit, recorded operator decision.');
  assert(hasLine(doc, /(^|[^0-9])5([^0-9]|$)/, /min/i),
    'the doc must state the 5-minute staleness rule (re-run the check if >5 min elapse ' +
    'between exit 0 and the merge) — AC-1\'s "just observed".');
  assert(hasLine(doc, /feat\/tags/, /manual/i) || /manual promotions to .{0,5}feat\/tags/i.test(doc),
    'the doc must carry the manual feat/tags promotion procedure — same mechanism, ' +
    'tags.brainstorm.world URL (ADR sub-decision 5).');
  assert(/404/.test(doc),
    'the doc must note the transition reality: an instance whose branch predates story #1 ' +
    '404s the endpoint — that is "no usable answer" (exit 2), never safe.');
});

t('C4 (AC-1/AC-5): cycle-staging references the recipe between PR-open and the merge command — the merge\'s immediate precursor — and restates no numbers', () => {
  const s = readSafe(CYCLE_STAGING);
  assert(s !== null, '.claude/skills/cycle-staging/SKILL.md missing — re-baseline this test.');
  const idxCreate = s.indexOf('gh pr create');
  const idxMerge = s.indexOf('gh pr merge');
  assert(idxCreate >= 0 && idxMerge > idxCreate,
    'cycle-staging/SKILL.md no longer contains the PR-open/merge commands in order — re-baseline this test.');
  const win = s.slice(idxCreate, idxMerge);
  assert(RECIPE_REF.test(win),
    'cycle-staging/SKILL.md has no safe-to-merge step: neither docs/SAFE_TO_MERGE.md nor ' +
    'scripts/check-safe-to-merge.sh is referenced between opening the PR and the merge ' +
    'command. AC-1 requires the check as the deploy-triggering merge\'s immediate precursor, ' +
    'consumed by reference (AC-5), against the instance this merge redeploys.');
  assert(/staging\.brainstorm\.world/.test(win),
    'the pre-merge window must target the staging instance (a staging promotion asks the ' +
    'staging instance).');
  assert(!/bufferMinutes/.test(s),
    'cycle-staging must not pin ?bufferMinutes= — the instance owns the verdict policy ' +
    '(ADR sub-decision 2).');
  assert(!NUM45.test(s) && !NUM60.test(s),
    'cycle-staging restates the cadence/bound numbers (45/60) — the numbers are canon in ' +
    'docs/SAFE_TO_MERGE.md ONLY; a skill that restates them re-opens the drift AC-5 exists to end.');
});

t('C5 (AC-1/AC-5): cycle-prod runs the check after explicit approval and before the merge, targeting production, with the approval-stands rule and no numbers', () => {
  const s = readSafe(CYCLE_PROD);
  assert(s !== null, '.claude/skills/cycle-prod/SKILL.md missing — re-baseline this test.');
  const idxApproval = s.indexOf('Wait for explicit user approval');
  const idxMerge = s.indexOf('gh pr merge');
  assert(idxApproval >= 0 && idxMerge > idxApproval,
    'cycle-prod/SKILL.md no longer contains the approval step before the merge command — re-baseline this test.');
  const win = s.slice(idxApproval, idxMerge);
  assert(RECIPE_REF.test(win),
    'cycle-prod/SKILL.md has no safe-to-merge step between the explicit-approval step and ' +
    'the merge command — the check must be the merge\'s immediate precursor, AFTER approval ' +
    '(a pre-approval safe verdict would be banked across an open-ended human wait, which AC-1 forbids).');
  const firstRef = s.search(RECIPE_REF);
  assert(firstRef > idxApproval,
    'cycle-prod references the safe-to-merge recipe BEFORE the explicit-approval step — the ' +
    'order is approval then check, never the reverse (ADR sub-decision 3).');
  assert(/tapestry\.brainstorm\.world/.test(win),
    'the pre-merge window must target the production instance (a production promotion asks ' +
    'the production instance).');
  assert(hasLine(s, /approval/i, /stand|valid|covers/i),
    'cycle-prod must state the approval-stands rule explicitly: the step-3 approval covers ' +
    'the bundle and remains valid across the bounded wait; an AC-3 stop hands back a FRESH ' +
    'decision (ADR sub-decision 3).');
  assert(!/bufferMinutes/.test(s),
    'cycle-prod must not pin ?bufferMinutes= — the instance owns the verdict policy.');
  assert(!NUM45.test(s) && !NUM60.test(s),
    'cycle-prod restates the cadence/bound numbers (45/60) — the numbers are canon in ' +
    'docs/SAFE_TO_MERGE.md ONLY.');
});

t('C6 (AC-4): cycle-full names the check by delegation in both stage lists and the halt list — and carries no recipe content of its own', () => {
  const s = readSafe(CYCLE_FULL);
  assert(s !== null, '.claude/skills/cycle-full/SKILL.md missing — re-baseline this test.');
  const stage2 = between(s, '### Stage 2', '### Stage 3', 'cycle-full/SKILL.md');
  const stage4 = between(s, '### Stage 4', '### Stage 5', 'cycle-full/SKILL.md');
  const halt = between(s, '## Halt-on-failure', '\n## ', 'cycle-full/SKILL.md');
  const CHECK = /safe[- ]to[- ]merge/i;

  assert(CHECK.test(stage2),
    'cycle-full\'s Stage 2 (staging) inline step list never names the safe-to-merge check — ' +
    'an agent following this summary reaches the staging merge with no check on its path ' +
    '(AC-4: "no path through cycle-full reaches a deploy-triggering merge without the check").');
  assert(stage2.search(CHECK) < stage2.indexOf('Merge it'),
    'in Stage 2 the safe-to-merge step must come BEFORE the merge item — the merge\'s ' +
    'immediate precursor, by list order.');
  assert(CHECK.test(stage4),
    'cycle-full\'s Stage 4 (prod) inline step list never names the safe-to-merge check — ' +
    'the AC-4 delegation must be visible on the path the agent actually follows.');
  assert(stage4.search(CHECK) < stage4.indexOf('Merge it'),
    'in Stage 4 the safe-to-merge step must come BEFORE the merge item.');
  assert(CHECK.test(halt),
    'the Halt-on-failure list must include the safe-to-merge stop (bound exhausted while ' +
    'unsafe, or no usable answer) as a chain-stopping condition.');

  // The AC-4 negative: delegation-naming ONLY — no check logic or recipe text.
  assert(!/check-safe-to-merge\.sh/.test(s),
    'cycle-full must NOT name the script — it delegates to the underlying cycle skills and ' +
    'carries no check mechanism of its own (AC-4).');
  assert(!/SAFE_TO_MERGE/.test(s),
    'cycle-full must NOT link or name docs/SAFE_TO_MERGE.md — the delegate skills own the reference (AC-4).');
  assert(!NUM45.test(s) && !NUM60.test(s),
    'cycle-full must NOT carry the cadence/bound numbers — no recipe content of its own (AC-4).');
  assert(!/bufferMinutes/.test(s), 'cycle-full must NOT carry buffer policy (AC-4).');
  assert(!/tags\.brainstorm\.world/.test(s),
    'cycle-full must NOT carry the branch → instance URL table (tags.brainstorm.world is the tell) — AC-4.');
  assert(!/deploy-safety\/status/.test(s),
    'cycle-full must NOT name the status endpoint — no check logic of its own (AC-4).');
});

t('C7 (alignment): the script exists, is an executable bash script, defaults to the doc\'s numbers (45/60), and forbids jq and bufferMinutes', () => {
  assertScriptExists();
  const st = fs.statSync(SCRIPT);
  assert((st.mode & 0o111) !== 0,
    'scripts/check-safe-to-merge.sh is not executable — the doc\'s canonical invocation is ' +
    'a direct repo-relative run.');
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert(/^#!.*\bbash\b/.test(src),
    'the script must start with a bash shebang (#!/usr/bin/env bash) — the skills\' ' +
    'plain-shell calling convention.');
  assert(NUM45.test(src) && NUM60.test(src),
    'the script must carry the default numbers 45 (attempts) and 60 (interval seconds) — ' +
    'doc↔script number alignment is held by this test (ADR 0002 Consequences: if either ' +
    'changes without the other, this fails).');
  assert(!/\bjq\b/.test(src),
    'the script must not use jq — POSIX-tool extraction only; the check must not die on a ' +
    'missing formatter at the exact moment it matters (ADR sub-decision 6).');
  assert(!/bufferMinutes/.test(src),
    'the script must not pin ?bufferMinutes= — the instance owns the verdict policy; the ' +
    'echoed bufferMs is journaled instead (ADR sub-decision 2).');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- safe-to-merge check tests (epic deploy-safety-gate, Story 2) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message.split('\n')[0]}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\nsafe-to-merge-check: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
