'use strict';
/**
 * Story relay-stream-gaps #2: a stream's Limit refetches recent events whenever it connects.
 * ADR relay-stream-gaps/0002 (Accepted): patch strfry 1.1.0's router so StreamGroup::connOpen
 * sends a stream's configured `limit` and keeps 0 only when the filter has none; presets and
 * new streams default to 500; ingress drops a negative limit; the editor, OPERATIONS.md and
 * BIBLE §14 say what the Limit does.
 * Test plan: engineering-team/stories/relay-stream-gaps/2-stream-limit-refetches-on-reconnect.test-plan.md
 *
 * Stack-free: no Docker, strfry build, supervisord or network.
 *   P  the new patches/strfry-router/apply-patches.sh is RUN (bash, via spawnSync) against
 *      temp copies of test/fixtures/strfry-1.1.0-router-connOpen/, which holds strfry 1.1.0's
 *      connOpen verbatim at src/apps/mesh/cmd_router.cpp. The script gets the strfry dir as
 *      $1 and runs from an unrelated cwd, as in the Dockerfile. Needs bash and GNU sed/grep,
 *      as the image build does. The C++ change itself was built and run against a real strfry
 *      in the ADR's "Verified evidence"; this suite pins the script that applies it.
 *   D  Dockerfile wiring, source level.
 *   S  setup/router-presets.json, read and composed through generateConfig.
 *   F  sanitizeStreamFilter / generateConfig, EXECUTED via require (pure functions).
 *   U  RelaySettings.jsx, source level (no JSX transpile in this harness).
 *   O, B  OPERATIONS.md and BIBLE §14 wording, source level.
 *
 * Before the implementation the P, D1, D2, D3, S1, S3, F1, U1-U6, O1 and B1 tests fail on a
 * missing file or a contract assertion (never a load error). Tests marked "(guard)" pin
 * behavior the ADR keeps unchanged and pass before and after.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'patches/strfry-router/apply-patches.sh');
const FIXTURE_DIR = path.join(__dirname, 'fixtures/strfry-1.1.0-router-connOpen');
const TARGET_REL = 'src/apps/mesh/cmd_router.cpp';
const DOCKERFILE = path.join(ROOT, 'Dockerfile');
const PRESETS = path.join(ROOT, 'setup/router-presets.json');
const ROUTER_CONFIG = path.join(ROOT, 'src/api/strfry/routerConfig.js');
const RELAY_SETTINGS = path.join(ROOT, 'ui/src/pages/settings/RelaySettings.jsx');
const OPERATIONS = path.join(ROOT, 'OPERATIONS.md');
const BIBLE = path.join(ROOT, 'BIBLE.md');

const ADR = 'ADR relay-stream-gaps/0002';
const DEFAULT_LIMIT = 500; // product decision 1
// strfry 1.1.0 connOpen, inside `if (dir == "down" || dir == "both")` (16-space indent).
const BARE_LINE = '                filterToSend["limit"] = 0;';
const PATCHED_LINE = '                if (!filterToSend.find("limit")) filterToSend["limit"] = 0;';
const BARE_LINE_RE = /^[ \t]*filterToSend\["limit"\] = 0;[ \t]*$/m;

// The hint and card wording, verbatim from the ADR's Implementation notes.
const DOWN_HINT = [
  'Each time this stream connects, every relay re-sends up to this many of its newest matching events, then streams live.',
  'Downloads only.',
  'Blank or 0 = live only (nothing fetched on connect).',
  'strfry relays send at most 500.',
];
const UP_HINT = 'Not used: upload-only streams send new local events as they arrive.';
const LIMIT_LABEL = 'Limit (fetched on connect)';
const CARD_LIVE_ONLY = '(live only: nothing fetched on connect)';
const CARD_FETCHES_RE = /\(fetches up to \$?\{[^}]*\blimit\b[^}]*\} on connect\)/;

// Presets as they ship today: name, direction, kinds. The ADR changes only each limit.
const PRESET_SHAPE = [
  ['dcosl', 'both', [9998, 9999, 39998, 39999]],
  ['dcosl2', 'down', [9998, 9999, 39998, 39999]],
  ['userProfiles', 'down', [0]],
  ['trustedLists', 'both', [30392, 30393, 30394, 30395]],
  ['WoT', 'both', [3, 1984, 10000]],
  ['trustedAssertions', 'up', [30382]],
  ['treasureMaps', 'both', [10040]],
];

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function eq(actual, expected, msg) {
  assert(JSON.stringify(actual) === JSON.stringify(expected),
    `${msg}\n        expected: ${JSON.stringify(expected)}\n        actual:   ${JSON.stringify(actual)}`);
}
const NOT_IMPL = (what) => `${what}: not implemented yet (${ADR}).`;
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function loadBackend() {
  const be = require(ROUTER_CONFIG);
  assert(typeof be.sanitizeStreamFilter === 'function' && typeof be.generateConfig === 'function',
    'routerConfig.js must keep exporting sanitizeStreamFilter and generateConfig; unexpected regression.');
  return be;
}
function countOf(haystack, needle) { return haystack.split(needle).length - 1; }

// ── P helpers: run the patch script against a temp strfry tree ──────────────────────────
let TMP = null; // created in run()
let CWD = null; // an unrelated working directory, so the script must honor $1

function needScript() {
  assert(fs.existsSync(SCRIPT), NOT_IMPL('patches/strfry-router/apply-patches.sh must exist'));
}

/** A fresh copy of the fixture strfry tree; `transform` may rewrite cmd_router.cpp. */
function strfryCopy(transform) {
  const dir = fs.mkdtempSync(path.join(TMP, 'strfry-'));
  fs.cpSync(FIXTURE_DIR, dir, { recursive: true });
  if (transform) {
    const f = path.join(dir, TARGET_REL);
    fs.writeFileSync(f, transform(fs.readFileSync(f, 'utf8')));
  }
  return dir;
}

function runPatch(strfryDir) {
  const r = spawnSync('bash', [SCRIPT, strfryDir], { cwd: CWD, encoding: 'utf8', timeout: 30000 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}
function show(r) {
  return `exit ${r.status}${r.error ? ` (${r.error.message})` : ''}\n        stdout: ${JSON.stringify(r.stdout)}\n        stderr: ${JSON.stringify(r.stderr)}`;
}
const target = (dir) => path.join(dir, TARGET_REL);
const ORIGINAL = () => fs.readFileSync(path.join(FIXTURE_DIR, TARGET_REL), 'utf8');

// ── source helpers ──────────────────────────────────────────────────────────────────────
/** A RelaySettings top-level declaration, up to the next column-0 `function `. */
function region(src, declMarker, what) {
  const start = src.indexOf(declMarker);
  assert(start !== -1, `${what} is missing from RelaySettings.jsx; unexpected.`);
  const end = src.indexOf('\nfunction ', start + declMarker.length);
  return src.slice(start, end === -1 ? src.length : end);
}

/** Visible text of a JSX fragment: {' '} → space, tags dropped, whitespace collapsed. */
function jsxText(s) {
  return s
    .replace(/\{\s*(['"`])\s+\1\s*\}/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dockerfile instructions with continuation lines joined; comment lines dropped. */
function dockerInstructions(src) {
  const out = [];
  let cur = null;
  for (const line of src.split('\n')) {
    if (cur === null) {
      if (/^\s*(#|$)/.test(line)) continue;
      cur = line;
    } else {
      if (/^\s*#/.test(line)) continue;
      cur += '\n' + line;
    }
    if (!/\\\s*$/.test(line)) { out.push(cur); cur = null; }
  }
  if (cur !== null) out.push(cur);
  return out;
}
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function copyDest(instrs, srcDir) {
  const re = new RegExp(`^COPY\\s+${escRe(srcDir)}/?\\s+(\\S+)\\s*$`);
  for (let i = 0; i < instrs.length; i++) {
    const m = instrs[i].match(re);
    if (m) return { index: i, dest: m[1].replace(/\/+$/, '') };
  }
  return null;
}
function strfryBuildIndex(instrs) {
  return instrs.findIndex((i) => /^RUN\b/.test(i) && /git clone[^\n]*strfry/.test(i));
}

// ═══ P: patches/strfry-router/apply-patches.sh, run against a strfry 1.1.0 connOpen ═══
test('P1: on a copy of strfry 1.1.0\'s connOpen, the router patch exits 0 and turns the one `filterToSend["limit"] = 0;` line into `if (!filterToSend.find("limit")) filterToSend["limit"] = 0;`, indentation kept, every other byte unchanged (AC-1, AC-3, AC-5)', () => {
  const original = ORIGINAL();
  assert(countOf(original, `${BARE_LINE}\n`) === 1, 'the fixture must hold the bare line exactly once; unexpected.');
  needScript();
  const dir = strfryCopy();
  const r = runPatch(dir);
  assert(r.status === 0, `the patch must succeed on strfry 1.1.0's connOpen; ${show(r)}`);
  const patched = fs.readFileSync(target(dir), 'utf8');
  assert(!BARE_LINE_RE.test(patched),
    'no bare `filterToSend["limit"] = 0;` line may remain: it is the line that throws the configured limit away.');
  eq(patched, original.replace(`${BARE_LINE}\n`, `${PATCHED_LINE}\n`),
    'exactly that one line changes: the configured limit is sent when the filter has one (AC-1), 0 is kept when it has none (AC-5), and the rest of connOpen, live subscription included, is untouched (AC-3).');
});

test('P2: running the router patch a second time is a no-op that exits 0; the line is not wrapped twice (idempotent)', () => {
  needScript();
  const dir = strfryCopy();
  const first = runPatch(dir);
  assert(first.status === 0, `first run must succeed; ${show(first)}`);
  const once = fs.readFileSync(target(dir), 'utf8');
  const second = runPatch(dir);
  assert(second.status === 0, `a second run on an already patched tree must exit 0; ${show(second)}`);
  const twice = fs.readFileSync(target(dir), 'utf8');
  assert(twice === once, 'a second run must leave cmd_router.cpp byte-identical.');
  assert(countOf(twice, 'filterToSend.find("limit")') === 1, 'the limit check must appear exactly once after two runs.');
});

test('P3: a strfry tree whose connOpen no longer has the bare limit line fails loudly: non-zero exit and an ERROR line on stderr (a STRFRY_REF bump can\'t silently drop the patch)', () => {
  needScript();
  const dir = strfryCopy((src) => src.replace(`${BARE_LINE}\n`, ''));
  assert(!BARE_LINE_RE.test(fs.readFileSync(target(dir), 'utf8')), 'the transformed fixture must lack the bare line; unexpected.');
  const r = runPatch(dir);
  assert(r.status !== 0 && r.status !== null, `the patch must fail the build when its target line is gone; ${show(r)}`);
  assert(/^ERROR\b/m.test(r.stderr), `stderr must carry an "ERROR: …" line saying the pattern did not match; ${show(r)}`);
});

test('P4: a strfry tree without src/apps/mesh/cmd_router.cpp fails with a non-zero exit', () => {
  needScript();
  const dir = strfryCopy();
  fs.rmSync(target(dir));
  const r = runPatch(dir);
  assert(r.status !== 0 && r.status !== null, `the patch must fail when cmd_router.cpp is missing; ${show(r)}`);
});

test('P5: the patch script\'s header cites strfry 1.1.0 and ADR relay-stream-gaps/0002 (what a STRFRY_REF bump must re-verify)', () => {
  needScript();
  const src = safeRead(SCRIPT);
  assert(/strfry 1\.1\.0/.test(src), 'apply-patches.sh must name strfry 1.1.0 in its header comment.');
  assert(src.includes('relay-stream-gaps/0002'), 'apply-patches.sh must cite ADR relay-stream-gaps/0002 in its header comment.');
});

// ═══ D: Dockerfile wiring ════════════════════════════════════════════════════════════
test('D1: the Dockerfile copies patches/strfry-router/ into the image before the RUN that builds strfry', () => {
  const instrs = dockerInstructions(safeRead(DOCKERFILE));
  const build = strfryBuildIndex(instrs);
  assert(build !== -1, 'the RUN that clones and builds strfry is missing from the Dockerfile; unexpected.');
  const copy = copyDest(instrs, 'patches/strfry-router');
  assert(copy, NOT_IMPL('the Dockerfile must `COPY patches/strfry-router/ <dir>/`'));
  assert(copy.index < build, 'the COPY of patches/strfry-router/ must come before the strfry build RUN.');
});

test('D2: the strfry build RUN applies the router patch to /usr/local/src/strfry with `&& bash …/apply-patches.sh`, after the Redis patches and before make', () => {
  const instrs = dockerInstructions(safeRead(DOCKERFILE));
  const run = instrs[strfryBuildIndex(instrs)] || '';
  assert(run, 'the RUN that clones and builds strfry is missing; unexpected.');
  const redis = copyDest(instrs, 'patches/strfry-redis');
  assert(redis, 'the COPY of patches/strfry-redis/ is missing; unexpected regression.');
  const redisIdx = run.indexOf(`${redis.dest}/apply-patches.sh`);
  assert(redisIdx !== -1, 'the strfry RUN no longer applies the Redis patches; unexpected regression.');
  const router = copyDest(instrs, 'patches/strfry-router');
  assert(router, NOT_IMPL('the Dockerfile must COPY patches/strfry-router/ before the strfry RUN can apply it'));
  const routerRe = new RegExp(`&&\\s*bash\\s+${escRe(router.dest)}/apply-patches\\.sh\\s+/usr/local/src/strfry\\b`);
  const m = run.match(routerRe);
  assert(m, NOT_IMPL(`the strfry RUN chain must run \`&& bash ${router.dest}/apply-patches.sh /usr/local/src/strfry\``));
  const makeIdx = run.search(/\bmake\b/);
  assert(redisIdx < m.index, 'the router patch must run after the Redis patches.');
  assert(makeIdx !== -1 && m.index < makeIdx, 'the router patch must run before make, so the built strfry carries it.');
});

test('D3: the comment above ARG STRFRY_REF names both patch directories, patches/strfry-redis/ and patches/strfry-router/ (a bump re-verifies both)', () => {
  const lines = safeRead(DOCKERFILE).split('\n');
  const at = lines.findIndex((l) => /^ARG\s+STRFRY_REF\b/.test(l));
  assert(at !== -1, 'ARG STRFRY_REF is missing from the Dockerfile; unexpected.');
  const comment = [];
  for (let i = at - 1; i >= 0 && /^\s*#/.test(lines[i]); i--) comment.unshift(lines[i]);
  const text = comment.join('\n');
  assert(text.includes('patches/strfry-redis'), 'the STRFRY_REF comment must still name patches/strfry-redis/.');
  assert(text.includes('patches/strfry-router'), NOT_IMPL('the STRFRY_REF comment must also name patches/strfry-router/'));
});

// ═══ S: setup/router-presets.json ════════════════════════════════════════════════════
test('S1: every preset ships with filter.limit 500, treasureMaps included (AC-4; product decision 1)', () => {
  const presets = JSON.parse(safeRead(PRESETS) || '[]');
  assert(Array.isArray(presets) && presets.length > 0, 'setup/router-presets.json must exist and parse; unexpected.');
  const off = presets.filter((p) => !p.filter || p.filter.limit !== DEFAULT_LIMIT)
    .map((p) => `${p.name}: ${p.filter && 'limit' in p.filter ? p.filter.limit : '(none)'}`);
  eq(off, [], NOT_IMPL(`every preset's filter.limit must be ${DEFAULT_LIMIT}; these are not`));
});

test('S2 (guard): presets keep their names, directions and kinds; each filter is kinds plus limit only, with no tag filters (R3\'s guardrail)', () => {
  const presets = JSON.parse(safeRead(PRESETS) || '[]');
  eq(presets.map((p) => [p.name, p.dir, p.filter && p.filter.kinds]), PRESET_SHAPE,
    'the ADR changes only each preset\'s limit: names, directions and kinds stay as they are.');
  for (const p of presets) {
    const extra = Object.keys(p.filter || {}).filter((k) => k !== 'kinds' && k !== 'limit');
    eq(extra, [], `preset "${p.name}" must stay a kinds + limit filter (no tag filters, nothing else).`);
  }
});

test('S3: every preset, enabled, reaches the router config with "limit":500 in its filter line next to its kinds, so the limit gets to strfry (AC-1, AC-2)', () => {
  const be = loadBackend();
  const presets = JSON.parse(safeRead(PRESETS) || '[]');
  const streams = presets.map((p) => ({
    name: p.name, dir: p.dir, filter: p.filter, urls: p.urls, pluginDown: p.pluginDown, pluginUp: p.pluginUp, enabled: true,
  }));
  const cfg = be.generateConfig(streams);
  const lines = cfg.split('\n').filter((l) => /^\s*filter = /.test(l)).map((l) => JSON.parse(l.replace(/^\s*filter = /, '')));
  assert(lines.length === presets.length, `every preset must emit one filter line; got ${lines.length} for ${presets.length}.`);
  const off = [];
  lines.forEach((f, i) => {
    if (f.limit !== DEFAULT_LIMIT || JSON.stringify(f.kinds) !== JSON.stringify(presets[i].filter.kinds)) {
      off.push(`${presets[i].name}: ${JSON.stringify(f)}`);
    }
  });
  eq(off, [], NOT_IMPL(`each preset's config filter must carry "limit":${DEFAULT_LIMIT}; these do not`));
});

// ═══ F: sanitizeStreamFilter and generateConfig (executed) ════════════════════════════
test('F1: sanitizeStreamFilter drops a negative limit and keeps the other keys in order, so the router config gets no limit and the stream is live only', () => {
  const be = loadBackend();
  eq(be.sanitizeStreamFilter({ kinds: [0], limit: -1, '#t': ['x'] }), { kinds: [0], '#t': ['x'] },
    NOT_IMPL('a negative limit must be dropped at ingress (it now reaches strfry\'s REQ)'));
  eq(be.sanitizeStreamFilter({ limit: -500 }), {}, NOT_IMPL('limit -500 must be dropped'));
  const cfg = be.generateConfig([{ name: 'neg', dir: 'down', filter: be.sanitizeStreamFilter({ kinds: [0], limit: -5 }), urls: ['wss://a.example'], enabled: true }]);
  assert(cfg.includes('        filter = {"kinds":[0]}\n'),
    NOT_IMPL(`a stream saved with a negative limit must reach the config with no limit\n        config: ${JSON.stringify(cfg)}`));
});

test('F2 (guard): sanitizeStreamFilter keeps limit 0 and any positive integer as-is, in place, with no upper clamp (the relay caps) (AC-1, AC-5)', () => {
  const be = loadBackend();
  for (const n of [0, 5, DEFAULT_LIMIT, 5000]) {
    const f = { kinds: [1], limit: n, '#t': ['x'] };
    eq(be.sanitizeStreamFilter(f), f, `limit ${n} must be kept unchanged, key order included.`);
  }
});

test('F3 (guard): since and until are unchanged: integers kept, negatives and 0 included; non-integers dropped (the ADR touches limit only)', () => {
  const be = loadBackend();
  eq(be.sanitizeStreamFilter({ since: -5, until: -1 }), { since: -5, until: -1 },
    'since/until keep today\'s rule (any integer). Only limit gains the >= 0 check; the rest of OPEN.md row 31(b) is not this story.');
  eq(be.sanitizeStreamFilter({ since: 0, until: 1700000000 }), { since: 0, until: 1700000000 }, 'integer since/until are kept.');
  eq(be.sanitizeStreamFilter({ since: 1.5, until: '10' }), {}, 'non-integer since/until are dropped, as today.');
});

test('F4 (guard): a limit that is not an integer is still dropped (1.5, "500", null, NaN, Infinity, true)', () => {
  const be = loadBackend();
  for (const v of [1.5, '500', null, NaN, Infinity, true]) {
    eq(be.sanitizeStreamFilter({ kinds: [1], limit: v }), { kinds: [1] }, `limit ${String(v)} must be dropped.`);
  }
});

test('F5 (guard): a stream with no limit stays without one: no default is added on save, and its config line has no limit (AC-5: live only unless a limit is set)', () => {
  const be = loadBackend();
  eq(be.sanitizeStreamFilter({ kinds: [10040] }), { kinds: [10040] },
    'sanitizeStreamFilter must not add a limit: a stream with none stays live only (AC-5; product decision 3).');
  const cfg = be.generateConfig([{ name: 'treasureMaps', dir: 'both', filter: be.sanitizeStreamFilter({ kinds: [10040] }), urls: ['wss://a.example'], enabled: true }]);
  assert(cfg.includes('        filter = {"kinds":[10040]}\n'), `the config must carry no limit for it\n        config: ${JSON.stringify(cfg)}`);
});

test('F6 (guard): generateConfig emits the same bytes before and after sanitization for limits 0, 5, 500 and none, and writes "limit":500 inline (R2\'s baseline holds; AC-3)', () => {
  const be = loadBackend();
  const streams = [
    { name: 'zero', dir: 'down', filter: { kinds: [0], limit: 0 }, urls: ['wss://a.example'], pluginDown: '', pluginUp: '', enabled: true },
    { name: 'five', dir: 'both', filter: { kinds: [3, 1984, 10000], limit: 5 }, urls: ['wss://b.example'], pluginDown: '', pluginUp: '', enabled: true },
    { name: 'fiveHundred', dir: 'down', filter: { kinds: [0], limit: DEFAULT_LIMIT }, urls: ['wss://c.example'], pluginDown: '', pluginUp: '', enabled: true },
    { name: 'none', dir: 'up', filter: { kinds: [30382] }, urls: ['wss://d.example'], pluginDown: '', pluginUp: '', enabled: true },
  ];
  const before = be.generateConfig(streams);
  const after = be.generateConfig(streams.map((s) => ({ ...s, filter: be.sanitizeStreamFilter(s.filter) })));
  assert(after === before, `saving must not change the config of a stream whose filter didn't change\n        before: ${JSON.stringify(before)}\n        after:  ${JSON.stringify(after)}`);
  assert(before.includes('        filter = {"kinds":[0],"limit":500}\n'), `the 500 limit must appear inline in the filter line\n        config: ${JSON.stringify(before)}`);
});

// ═══ U: RelaySettings.jsx (source level) ══════════════════════════════════════════════
test('U1: RelaySettings.jsx declares `const DEFAULT_STREAM_LIMIT = 500;` at module scope (AC-4; product decision 1)', () => {
  const src = safeRead(RELAY_SETTINGS);
  assert(src.length > 0, 'RelaySettings.jsx is missing; unexpected.');
  assert(/^const DEFAULT_STREAM_LIMIT\s*=\s*500\s*;/m.test(src), NOT_IMPL('RelaySettings.jsx must declare `const DEFAULT_STREAM_LIMIT = 500;` at module scope'));
});

test('U2: a new stream starts at the default limit: emptyStream() uses DEFAULT_STREAM_LIMIT, not 5 (AC-4)', () => {
  const body = region(safeRead(RELAY_SETTINGS), 'function emptyStream(', 'emptyStream');
  assert(!/\blimit\s*:\s*5\b/.test(body), NOT_IMPL('emptyStream() must no longer start new streams at limit 5'));
  assert(/\blimit\s*:\s*DEFAULT_STREAM_LIMIT\b/.test(body), NOT_IMPL('emptyStream() must set `limit: DEFAULT_STREAM_LIMIT`'));
});

test('U3: the editor\'s Limit field is labelled "Limit (fetched on connect)" and its placeholder is DEFAULT_STREAM_LIMIT (AC-4)', () => {
  const editor = region(safeRead(RELAY_SETTINGS), 'function StreamEditor(', 'StreamEditor');
  const labels = [...editor.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map((m) => jsxText(m[1]));
  assert(labels.includes(LIMIT_LABEL), NOT_IMPL(`the Limit field's label must read "${LIMIT_LABEL}"; labels now: ${JSON.stringify(labels)}`));
  assert(!/placeholder=["']5["']/.test(editor), NOT_IMPL('the Limit placeholder must no longer be "5"'));
  assert(/placeholder=\{[^}]*DEFAULT_STREAM_LIMIT/.test(editor), NOT_IMPL('the Limit input\'s placeholder must come from DEFAULT_STREAM_LIMIT'));
});

test('U4: the hint under the Limit field says each relay re-sends up to that many newest matching events on every connect, downloads only, blank or 0 = live only, strfry caps at 500 (AC-4, AC-5)', () => {
  const text = jsxText(region(safeRead(RELAY_SETTINGS), 'function StreamEditor(', 'StreamEditor'));
  const missing = DOWN_HINT.filter((s) => !text.includes(s));
  eq(missing, [], NOT_IMPL('the StreamEditor must show the download hint (ADR wording); missing sentences'));
});

test('U5: for an upload-only stream (form.dir === \'up\') the hint instead says "Not used: upload-only streams send new local events as they arrive." (AC-4)', () => {
  const text = jsxText(region(safeRead(RELAY_SETTINGS), 'function StreamEditor(', 'StreamEditor'));
  const cond = text.search(/form\.dir\s*===\s*['"]up['"]/);
  assert(cond !== -1, NOT_IMPL('the StreamEditor must pick the Limit hint on `form.dir === \'up\'`'));
  const at = text.indexOf(UP_HINT, cond);
  assert(at !== -1, NOT_IMPL(`the upload-only hint "${UP_HINT}" must follow the form.dir === 'up' check`));
});

test('U6: the stream card\'s Filter line says " (fetches up to N on connect)" for limit > 0, " (live only: nothing fetched on connect)" for blank or 0, and nothing for upload-only streams; "(limit: N)" is gone (AC-4, AC-5)', () => {
  const src = safeRead(RELAY_SETTINGS);
  const card = region(src, 'function RouterStatus(', 'RouterStatus');
  const at = card.indexOf('Filter:');
  assert(at !== -1, 'the stream card\'s "Filter:" line is missing from RouterStatus; unexpected.');
  const end = card.indexOf('</div>', at);
  const line = card.slice(at, end === -1 ? card.length : end);
  assert(!src.includes('(limit: '), NOT_IMPL('the old "(limit: N)" card wording must be gone'));
  assert(CARD_FETCHES_RE.test(line), NOT_IMPL('the Filter line must show " (fetches up to ${stream.filter.limit} on connect)" when the limit is above 0'));
  assert(line.includes(CARD_LIVE_ONLY), NOT_IMPL(`the Filter line must show " ${CARD_LIVE_ONLY}" when the limit is blank or 0`));
  assert(/stream\.dir\s*[!=]==?\s*['"]up['"]|['"]up['"]\s*[!=]==?\s*stream\.dir/.test(line),
    NOT_IMPL('the Filter line must check stream.dir against \'up\' so upload-only streams show no limit wording'));
});

test('U7 (guard): the stream card still shows its Filter line under the existing condition (kinds or tag filters present)', () => {
  const card = region(safeRead(RELAY_SETTINGS), 'function RouterStatus(', 'RouterStatus');
  assert(/\{stream\.filter && \(stream\.filter\.kinds\?\.length > 0 \|\| tagFiltersFromFilter\(stream\.filter\)\.length > 0\) && \(/.test(card),
    'the condition that shows the Filter line must stay as it is (ADR: "Keep the existing condition that shows the summary line").');
});

// ═══ O, B: documentation ═════════════════════════════════════════════════════════════
test('O1: OPERATIONS.md "What a deploy does" says a router stream refetches its newest events up to its Limit on reconnect (live only when blank or 0), and that anything beyond that needs a negentropy sync', () => {
  const src = safeRead(OPERATIONS);
  const start = src.indexOf('**What a deploy does.**');
  assert(start !== -1, 'OPERATIONS.md "**What a deploy does.**" paragraph is missing; unexpected.');
  const end = src.indexOf('\n\n', start);
  const para = src.slice(start, end === -1 ? src.length : end);
  assert(!para.includes('brings nothing published upstream while it was down'),
    NOT_IMPL('the paragraph must drop "a router stream brings nothing published upstream while it was down"'));
  const missing = [[/refetch/i, 'refetch'], [/newest/i, 'newest'], [/\bLimit\b/, 'Limit'], [/blank or 0/i, 'blank or 0'], [/live only/i, 'live only'], [/negentropy sync/i, 'negentropy sync']]
    .filter(([re]) => !re.test(para)).map(([, w]) => w);
  eq(missing, [], NOT_IMPL('the new sentence must mention'));
});

test('B1: BIBLE §14 "Presets are opt-in cross-instance mirroring" says a stream\'s Limit is how many newest events each relay re-sends on every connect, honored by the image\'s patched strfry router (upstream ignores it), blank or 0 = live only', () => {
  const src = safeRead(BIBLE);
  const start = src.indexOf('#### Presets are opt-in cross-instance mirroring');
  assert(start !== -1, 'BIBLE §14 "Presets are opt-in cross-instance mirroring" is missing; unexpected.');
  const end = src.indexOf('| Preset |', start);
  const para = src.slice(start, end === -1 ? start + 3000 : end);
  const missing = [[/\bLimit\b/, 'Limit'], [/(re)?fetch/i, 'fetch/refetch'], [/connect/i, 'connect'], [/newest/i, 'newest'], [/patch/i, 'the patched strfry router'], [/upstream/i, 'upstream strfry ignoring it'], [/blank or 0/i, 'blank or 0'], [/live only/i, 'live only']]
    .filter(([re]) => !re.test(para)).map(([, w]) => w);
  eq(missing, [], NOT_IMPL('BIBLE §14 must gain the Limit sentence; it does not mention'));
});

// ── runner ──────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- router stream limit on connect tests (relay-stream-gaps #2) ---');
  let pass = 0;
  let fail = 0;
  const skipped = 0;
  const failures = [];
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'router-stream-limit-'));
  CWD = fs.mkdtempSync(path.join(TMP, 'cwd-'));
  try {
    for (const t of tests) {
      try {
        await t.fn();
        console.log(`  PASS  ${t.name}`);
        pass++;
      } catch (err) {
        console.log(`  FAIL  ${t.name}\n        ${err.message}`);
        failures.push({ name: t.name, message: err.message });
        fail++;
      }
    }
  } finally {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  console.log(`\nrouter-stream-limit-on-connect: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  run().then(({ fail }) => { process.exitCode = fail === 0 ? 0 : 1; }).catch((e) => { console.error(e); process.exitCode = 1; });
}

module.exports = { run };
