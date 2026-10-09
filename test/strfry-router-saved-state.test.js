/**
 * Router config: plugin symlinks, saved state and presets go through the same checks.
 *
 * Follow-up to the owner gate (strfry-router-owner-gate) and the value hardening
 * (strfry-router-value-hardening). Those validate client JSON at POST /router-config;
 * this suite pins the rest of the paths that end up in the strfry-router config:
 *
 *   P  plugin paths: symlinks are resolved (realpath), and the target must exist, be a
 *      regular file, and still sit directly in the plugins directory — else 400, before
 *      any write or restart.
 *   V  saved state (router-state.json) is re-validated whenever the config is rebuilt
 *      from it: toggle, restore-defaults, restart and startup. An enabled stream with an
 *      invalid name, dir, url or plugin is left out of the config (as if disabled), named
 *      in a warning and in the response's `skipped`; router-state.json is not rewritten;
 *      the other streams are written and the router is restarted as usual.
 *   R  presets (setup/router-presets.json) are checked when loaded: an invalid preset is
 *      neither listed nor applied. The shipped presets all pass.
 *   L  GET /router-plugins lists only plugins that pass the check.
 *   H  loopback / private / link-local / docker-service relay hosts stay accepted — a
 *      documented choice (see the comment above pluginPathProblem in routerConfig.js).
 *   D  the operator note on auditing saved plugin paths exists in docs/CONFIGURATION.md.
 *
 * Stack-free: child_process.exec is stubbed before routerConfig.js loads (it destructures
 * exec at require time); reads of router-state.json / router-presets.json and writes of the
 * router's two files are intercepted for the duration of run() and restored after; plugin
 * files live in a temp dir that BRAINSTORM_ROUTER_PLUGINS_DIR points at during run().
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROUTER = path.join(ROOT, 'src/api/strfry/routerConfig.js');
const CONFIG_PATH = '/etc/strfry-router-tapestry.config';
const STATE_PATH = '/var/lib/brainstorm/router-state.json';
const PRESETS_PATH = path.join(ROOT, 'setup/router-presets.json');
const CONFIGURATION_DOC = path.join(ROOT, 'docs/CONFIGURATION.md');

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ── fixtures: a plugins dir, a directory outside it, and symlinks between them ──
const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'router-saved-state-')));
const PLUGINS = path.join(TMP, 'plugins');
const OUTSIDE = path.join(TMP, 'outside');
const LINKED_DIR = path.join(TMP, 'plugins-link'); // a symlink to PLUGINS
fs.mkdirSync(PLUGINS);
fs.mkdirSync(path.join(PLUGINS, 'data'));
fs.mkdirSync(OUTSIDE);
fs.writeFileSync(path.join(PLUGINS, 'good.js'), '// plugin\n');
fs.writeFileSync(path.join(PLUGINS, 'notes.txt'), 'not a plugin\n');
fs.writeFileSync(path.join(PLUGINS, 'bad name.js'), '// unsafe basename\n');
fs.mkdirSync(path.join(PLUGINS, 'folder.js')); // a directory with a .js name
fs.writeFileSync(path.join(OUTSIDE, 'elsewhere.js'), '// outside the plugins dir\n');
fs.symlinkSync(path.join(OUTSIDE, 'elsewhere.js'), path.join(PLUGINS, 'link-out.js'));
fs.symlinkSync(path.join(PLUGINS, 'good.js'), path.join(PLUGINS, 'link-in.js'));
fs.symlinkSync(path.join(PLUGINS, 'data'), path.join(PLUGINS, 'link-dir.js'));
fs.symlinkSync(PLUGINS, LINKED_DIR);
const GOOD = path.join(PLUGINS, 'good.js');

// ── stubs, installed for run() only ──
const cp = require('child_process');
const realExec = cp.exec;
let execCalls = 0;
// Restarts counted apart from other supervisorctl calls: since relay-stream-gaps #1
// (ADR relay-stream-gaps/0001) a stream change first asks for the router's status and
// restarts only when it is not running (this stub never answers RUNNING) or no reload is
// logged — so "applied by restart" is one restart, not one exec.
let restartCalls = 0;
cp.exec = function (cmd, opts, cb) {
  execCalls++;
  if (/supervisorctl\s+restart\s+strfry-router/.test(cmd)) restartCalls++;
  const done = typeof opts === 'function' ? opts : cb;
  if (done) process.nextTick(() => done(null, 'strfry-router: started', ''));
};
delete require.cache[require.resolve(ROUTER)];
const router = require(ROUTER);
cp.exec = realExec; // routerConfig.js already holds the stub

let savedState = null;     // what router-state.json "contains" (null = absent)
let presetsText = null;    // what router-presets.json "contains" (null = the real file)
let configWrites = [];     // texts written to the router config
let stateWrites = [];      // states written to router-state.json
let warnings = [];

const real = { existsSync: fs.existsSync, readFileSync: fs.readFileSync, writeFileSync: fs.writeFileSync, warn: console.warn };
function installStubs() {
  fs.existsSync = function (p, ...rest) {
    if (String(p) === STATE_PATH) return savedState !== null;
    if (String(p) === PRESETS_PATH && presetsText !== null) return true;
    return real.existsSync.call(fs, p, ...rest);
  };
  fs.readFileSync = function (p, ...rest) {
    if (String(p) === STATE_PATH) return JSON.stringify(savedState);
    if (String(p) === PRESETS_PATH && presetsText !== null) return presetsText;
    return real.readFileSync.call(fs, p, ...rest);
  };
  fs.writeFileSync = function (p, data, ...rest) {
    if (String(p) === CONFIG_PATH) { configWrites.push(String(data)); return undefined; }
    if (String(p) === STATE_PATH) { const st = JSON.parse(String(data)); stateWrites.push(st); savedState = st; return undefined; }
    return real.writeFileSync.call(fs, p, data, ...rest);
  };
  console.warn = (...args) => { warnings.push(args.join(' ')); };
}
function removeStubs() {
  fs.existsSync = real.existsSync;
  fs.readFileSync = real.readFileSync;
  fs.writeFileSync = real.writeFileSync;
  console.warn = real.warn;
}
function reset(state, presets) {
  savedState = state === undefined ? null : JSON.parse(JSON.stringify(state));
  presetsText = presets === undefined ? null : JSON.stringify(presets);
  configWrites = []; stateWrites = []; warnings = []; execCalls = 0; restartCalls = 0;
}

function mkRes() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
  };
}
const local = (body) => ({ session: {}, localTrusted: true, body });

// A saved state with one valid stream and one invalid stream of each kind.
const STREAM_OK = { name: 'good', dir: 'down', filter: { kinds: [0], limit: 5 }, urls: ['wss://relay.example'], pluginDown: GOOD, pluginUp: '', enabled: true };
const STREAM_PLUGIN_OUT = { name: 'pluginOut', dir: 'down', urls: ['wss://relay.example'], pluginDown: path.join(OUTSIDE, 'elsewhere.js'), enabled: true };
const STREAM_PLUGIN_LINK = { name: 'pluginLink', dir: 'down', urls: ['wss://relay.example'], pluginDown: path.join(PLUGINS, 'link-out.js'), enabled: true };
const STREAM_PLUGIN_GONE = { name: 'pluginGone', dir: 'down', urls: ['wss://relay.example'], pluginUp: path.join(PLUGINS, 'removed.js'), enabled: true };
const STREAM_BAD_URL = { name: 'badUrl', dir: 'both', urls: ['wss://relay.example', 'http://relay.example'], enabled: true };
const STREAM_BAD_NAME = { name: 'x {\n    y', dir: 'both', urls: ['wss://relay.example'], enabled: true };
const STREAM_BAD_DIR = { name: 'badDir', dir: 'sideways', urls: ['wss://relay.example'], enabled: true };
const STREAM_OFF_BAD = { name: 'offBad', dir: 'down', urls: [], pluginDown: '/tmp/elsewhere.js', enabled: false };
const MIXED_STATE = { streams: [STREAM_OK, STREAM_PLUGIN_OUT, STREAM_PLUGIN_LINK, STREAM_PLUGIN_GONE, STREAM_BAD_URL, STREAM_BAD_NAME, STREAM_BAD_DIR, STREAM_OFF_BAD] };
const LEFT_OUT = ['pluginOut', 'pluginLink', 'pluginGone', 'badUrl', 'x {\n    y', 'badDir'];

function assertOnlyGoodInConfig(text) {
  assert(text.includes('\n    good {\n'), 'the valid stream must still be written to the config');
  assert(text.includes(`pluginDown = ${JSON.stringify(GOOD)}`), 'the valid stream keeps its plugin');
  for (const bad of ['pluginOut', 'pluginLink', 'pluginGone', 'badUrl', 'badDir', 'offBad']) {
    assert(!text.includes(`\n    ${bad} {`), `stream "${bad}" must be left out of the config`);
  }
  assert(!text.includes('elsewhere.js') && !text.includes('removed.js') && !text.includes('http://'), 'no invalid value may reach the config');
  assert(!text.includes('x {') && !/\n\s*y\n/.test(text), 'an invalid stream name must not reach the config');
}
function assertSkippedReported(body) {
  assert(body && body.success === true, `expected success, got ${JSON.stringify(body)}`);
  const names = (body.skipped || []).map((s) => s.name).sort();
  assert(JSON.stringify(names) === JSON.stringify([...LEFT_OUT].sort()), `skipped must name exactly the invalid enabled streams; got ${JSON.stringify(names)}`);
  assert(body.skipped.every((s) => Array.isArray(s.problems) && s.problems.length > 0), 'each skipped stream carries its problems');
  assert(typeof body.warning === 'string' && body.warning.length > 0, 'the response carries a warning line');
}
function assertWarned() {
  for (const name of ['pluginOut', 'pluginLink', 'pluginGone', 'badUrl', 'badDir']) {
    assert(warnings.some((w) => /Leaving stream/.test(w) && w.includes(`"${name}"`)), `a warning must name stream "${name}"`);
  }
  assert(warnings.every((w) => !w.includes('\n')), 'warnings are single lines (values are JSON-quoted)');
}

const tests = [];
const T = (name, fn) => tests.push([name, fn]);

// ── P: plugin path checks ────────────────────────────────────────────────────
T('P1: an existing regular .js file directly in the plugins dir is legal; empty means none', () => {
  assert(router.pluginPathProblem(GOOD) === null, router.pluginPathProblem(GOOD));
  assert(router.pluginPathProblem('') === null && router.pluginPathProblem(undefined) === null, 'empty plugin is legal');
});
T('P2: a symlink in the plugins dir to a file inside it is legal (it resolves inside)', () => {
  assert(router.pluginPathProblem(path.join(PLUGINS, 'link-in.js')) === null, router.pluginPathProblem(path.join(PLUGINS, 'link-in.js')));
});
T('P3: a plugins dir that is itself a symlink still admits its files (both sides are realpathed)', () => {
  const prev = process.env.BRAINSTORM_ROUTER_PLUGINS_DIR;
  process.env.BRAINSTORM_ROUTER_PLUGINS_DIR = LINKED_DIR;
  try {
    assert(router.pluginPathProblem(path.join(LINKED_DIR, 'good.js')) === null, router.pluginPathProblem(path.join(LINKED_DIR, 'good.js')));
    assert(router.pluginPathProblem(path.join(LINKED_DIR, 'link-out.js')) !== null, 'a symlink out is still refused through a symlinked dir');
  } finally { process.env.BRAINSTORM_ROUTER_PLUGINS_DIR = prev; }
});
const BAD_PLUGINS = [
  ['a symlink in the plugins dir pointing outside it', path.join(PLUGINS, 'link-out.js'), /symlink|outside/],
  ['a symlink with a .js name pointing at a directory', path.join(PLUGINS, 'link-dir.js'), /regular file|outside/],
  ['a .js name that does not exist', path.join(PLUGINS, 'removed.js'), /does not exist/],
  ['a directory with a .js name', path.join(PLUGINS, 'folder.js'), /regular file/],
  ['a relative path', 'good.js', /absolute/],
  ['a file in a subdirectory', path.join(PLUGINS, 'data', 'x.js'), /directly inside/],
  ['a file outside the plugins dir', path.join(OUTSIDE, 'elsewhere.js'), /directly inside/],
  ['an unsafe basename', path.join(PLUGINS, 'bad name.js'), /plain name/],
  ['a traversal that lands outside', `${PLUGINS}/../outside/elsewhere.js`, /directly inside/],
];
for (const [label, value, why] of BAD_PLUGINS) {
  T(`P: pluginPathProblem refuses ${label}`, () => {
    const got = router.pluginPathProblem(value);
    assert(got && why.test(got), `expected a problem matching ${why}, got ${JSON.stringify(got)}`);
  });
}
for (const [label, value] of BAD_PLUGINS.slice(0, 4)) {
  T(`P: POST /router-config with ${label} → 400 before any write or restart`, async () => {
    reset({ streams: [STREAM_OK] });
    const res = mkRes();
    await router.handleUpdateRouterConfig(local({ streams: [{ name: 'a', dir: 'down', urls: [], pluginDown: value }] }), res);
    assert(res.statusCode === 400, `expected 400, got ${res.statusCode} ${JSON.stringify(res.body)}`);
    assert(configWrites.length === 0 && stateWrites.length === 0 && execCalls === 0, `must refuse before any write/restart (config ${configWrites.length}, state ${stateWrites.length}, exec ${execCalls})`);
  });
}
T('P: POST /router-config with an existing plugin succeeds and writes it', async () => {
  reset({ streams: [] });
  const res = mkRes();
  await router.handleUpdateRouterConfig(local({ streams: [STREAM_OK] }), res);
  assert(res.statusCode === null && res.body && res.body.success === true, `expected success, got ${res.statusCode} ${JSON.stringify(res.body)}`);
  assert(!('skipped' in res.body), 'a clean save reports nothing skipped');
  assert(configWrites.length === 1 && configWrites[0].includes(`pluginDown = ${JSON.stringify(GOOD)}`) && restartCalls === 1, 'config written with the plugin and the router restarted');
});

// ── V: saved state is re-validated whenever the config is rebuilt ────────────
T('V1: vetStreamsForConfig keeps valid and disabled streams, leaves out invalid enabled ones', () => {
  reset();
  const { streams, skipped } = router.vetStreamsForConfig(MIXED_STATE.streams);
  assert(JSON.stringify(streams.map((s) => s.name)) === JSON.stringify(['good', 'offBad']), `kept: ${JSON.stringify(streams.map((s) => s.name))}`);
  assert(JSON.stringify(skipped.map((s) => s.name).sort()) === JSON.stringify([...LEFT_OUT].sort()), `skipped: ${JSON.stringify(skipped.map((s) => s.name))}`);
});
T('V2: toggle rebuilds from saved state, leaves invalid streams out, keeps the router up, does not rewrite their saved values', async () => {
  reset(MIXED_STATE);
  const res = mkRes();
  await router.handleToggleStream(local({ name: 'good', enabled: true }), res);
  assert(res.statusCode === null, `expected success, got ${res.statusCode} ${JSON.stringify(res.body)}`);
  assertSkippedReported(res.body);
  assert(configWrites.length === 1 && restartCalls === 1, 'config written once and the router restarted');
  assertOnlyGoodInConfig(configWrites[0]);
  assertWarned();
  const after = stateWrites[stateWrites.length - 1];
  assert(JSON.stringify(after.streams.map(({ enabled, ...rest }) => rest)) === JSON.stringify(MIXED_STATE.streams.map(({ enabled, ...rest }) => rest)),
    'router-state.json must keep every stream exactly as saved (only the toggled flag may change)');
});
T('V3: restart rebuilds the config from re-validated saved state before restarting', async () => {
  reset(MIXED_STATE);
  const res = mkRes();
  await router.handleRestartRouter(local({}), res);
  assertSkippedReported(res.body);
  assert(configWrites.length === 1 && execCalls === 1, `restart writes the config once, then restarts (config ${configWrites.length}, exec ${execCalls})`);
  assertOnlyGoodInConfig(configWrites[0]);
  assert(stateWrites.length === 0, 'restart does not write router-state.json when it exists');
});
T('V4: startup (initRouter) writes a config without the invalid streams and does not throw', async () => {
  reset(MIXED_STATE);
  await router.initRouter();
  assert(configWrites.length === 1, 'initRouter writes the config');
  assertOnlyGoodInConfig(configWrites[0]);
  assertWarned();
  assert(stateWrites.length === 0 && execCalls === 0, 'initRouter neither rewrites state nor restarts');
});
T('V5: a saved state with only invalid streams still yields a parseable empty config', async () => {
  reset({ streams: [STREAM_PLUGIN_OUT, STREAM_BAD_URL] });
  await router.initRouter();
  const sm = configWrites[0].match(/streams\s*\{([\s\S]*?)\}\s*$/);
  assert(sm && sm[1].trim() === '', `expected an empty streams block, got ${JSON.stringify(configWrites[0])}`);
});
T('V6: restore-defaults applies presets through the same checks (an invalid preset is not restored)', async () => {
  const presets = JSON.parse(real.readFileSync.call(fs, PRESETS_PATH, 'utf8'));
  presets.push({ name: 'badPreset', dir: 'down', urls: ['wss://relay.example'], pluginDown: path.join(OUTSIDE, 'elsewhere.js'), defaultEnabled: true });
  reset(MIXED_STATE, presets);
  const res = mkRes();
  await router.handleRestoreDefaults(local({}), res);
  assert(res.body && res.body.success === true, `expected success, got ${JSON.stringify(res.body)}`);
  const restored = stateWrites[stateWrites.length - 1].streams.map((s) => s.name);
  assert(!restored.includes('badPreset'), 'an invalid preset must not be restored into state');
  assert(restored.length === presets.length - 1, `every valid preset is restored (${restored.length} of ${presets.length - 1})`);
  assert(!configWrites[0].includes('elsewhere.js') && restartCalls === 1, 'config written without it and the router restarted');
  assert(warnings.some((w) => w.includes('"badPreset"')), 'a warning names the ignored preset');
});
T('V7: first boot (no router-state.json) seeds state from presets through the same checks', async () => {
  reset(undefined, [
    { name: 'okPreset', dir: 'down', filter: { kinds: [0] }, urls: ['wss://relay.example'], pluginDown: '', pluginUp: '', defaultEnabled: true },
    { name: 'badPreset', dir: 'down', urls: ['javascript:alert(1)'], defaultEnabled: true },
  ]);
  await router.initRouter();
  assert(stateWrites.length === 1, 'first boot writes router-state.json once');
  assert(JSON.stringify(stateWrites[0].streams.map((s) => s.name)) === JSON.stringify(['okPreset']), `seeded: ${JSON.stringify(stateWrites[0].streams.map((s) => s.name))}`);
  assert(configWrites[0].includes('\n    okPreset {\n') && !configWrites[0].includes('javascript:'), 'config holds only the valid preset');
});

// ── R: presets ───────────────────────────────────────────────────────────────
T('R1: every shipped preset passes the checks (none is dropped by loadPresets)', () => {
  reset();
  const raw = JSON.parse(real.readFileSync.call(fs, PRESETS_PATH, 'utf8'));
  const loaded = router.loadPresets();
  assert(loaded.length === raw.length && loaded.length > 0, `shipped presets dropped: ${raw.length - loaded.length} (${warnings.join(' | ')})`);
});
T('R2: GET /router-presets omits an invalid preset and keeps the rest', async () => {
  reset(undefined, [
    { name: 'okPreset', dir: 'both', urls: ['wss://relay.example'], defaultEnabled: false },
    { name: 'badDirPreset', dir: 'sideways', urls: ['wss://relay.example'], defaultEnabled: false },
    { name: 'badUrlPreset', dir: 'down', urls: ['wss://a"b'], defaultEnabled: false },
  ]);
  const res = mkRes();
  await router.handleGetPresets({}, res);
  assert(JSON.stringify(res.body.presets.map((p) => p.name)) === JSON.stringify(['okPreset']), `listed: ${JSON.stringify(res.body.presets.map((p) => p.name))}`);
});
T('R3: a presets file that is not an array loads as no presets, without throwing', () => {
  reset(undefined, { name: 'not-an-array' });
  assert(Array.isArray(router.loadPresets()) && router.loadPresets().length === 0, 'expected []');
});

// ── L: the plugin list only offers what router-config would accept ───────────
T('L1: GET /router-plugins lists only regular .js files with safe names that resolve inside the dir', async () => {
  reset();
  const res = mkRes();
  await router.handleListPlugins({}, res);
  const names = res.body.plugins.map((p) => p.name);
  assert(JSON.stringify(names) === JSON.stringify(['good.js', 'link-in.js']), `listed: ${JSON.stringify(names)}`);
  assert(res.body.plugins.every((p) => router.pluginPathProblem(p.path) === null), 'every listed path passes the check');
  assert(res.body.pluginsDir === PLUGINS, `pluginsDir: ${res.body.pluginsDir}`);
});

// ── H: internal relay hosts stay accepted (documented choice) ────────────────
const INTERNAL = ['ws://127.0.0.1:7777', 'ws://localhost:7777', 'ws://[::1]:7777', 'ws://10.0.0.5:7777', 'ws://192.168.1.20', 'ws://169.254.10.10', 'ws://strfry:7777', 'wss://relay.internal/relay'];
T('H1: loopback, private, link-local and docker-service relay URLs are accepted (documented choice)', async () => {
  for (const u of INTERNAL) assert(router.relayUrlProblem(u) === null, `${u}: ${router.relayUrlProblem(u)}`);
  reset({ streams: [] });
  const res = mkRes();
  await router.handleUpdateRouterConfig(local({ streams: [{ name: 'lan', dir: 'down', urls: INTERNAL }] }), res);
  assert(res.body && res.body.success === true, `expected success, got ${res.statusCode} ${JSON.stringify(res.body)}`);
});
T('H2: the choice is written down next to the validators', () => {
  const src = real.readFileSync.call(fs, ROUTER, 'utf8');
  assert(/Loopback, private and link-\s*\/\/\s*local hosts are ACCEPTED on purpose/.test(src), 'routerConfig.js must document why internal relay hosts are accepted');
});
T('H3: relay URLs still need ws(s), a host, and no quote/whitespace/control char', () => {
  for (const u of ['http://relay.example', 'wss://', 'wss://a b', 'wss://a"b', 'wss://a\u0007b', 42]) {
    assert(router.relayUrlProblem(u) !== null, `${JSON.stringify(u)} must be refused`);
  }
});

// ── D: the operator note ─────────────────────────────────────────────────────
T('D1: docs/CONFIGURATION.md tells an operator how to audit saved plugin paths', () => {
  const doc = real.readFileSync.call(fs, CONFIGURATION_DOC, 'utf8');
  const i = doc.indexOf('### Auditing saved plugin paths');
  assert(i !== -1, 'CONFIGURATION.md needs a "### Auditing saved plugin paths" section');
  const section = doc.slice(i, doc.indexOf('\n### ', i + 1) === -1 ? undefined : doc.indexOf('\n### ', i + 1));
  assert(section.includes('/var/lib/brainstorm/router-state.json'), 'names where the file lives');
  assert(section.includes('docker exec tapestry') && section.includes('pluginDown') && section.includes('pluginUp'), 'gives a command that lists pluginDown/pluginUp');
  assert(section.includes('/usr/local/lib/strfry/plugins'), 'names the plugins directory');
});

async function run() {
  console.log('\n--- strfry router saved-state / preset / plugin-symlink tests ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  const prevDir = process.env.BRAINSTORM_ROUTER_PLUGINS_DIR;
  process.env.BRAINSTORM_ROUTER_PLUGINS_DIR = PLUGINS;
  installStubs();
  try {
    for (const [name, fn] of tests) {
      try {
        await fn();
        console.log(`  PASS  ${name}`);
        pass++;
      } catch (err) {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      }
    }
  } finally {
    removeStubs();
    if (prevDir === undefined) delete process.env.BRAINSTORM_ROUTER_PLUGINS_DIR;
    else process.env.BRAINSTORM_ROUTER_PLUGINS_DIR = prevDir;
    fs.rmSync(TMP, { recursive: true, force: true });
  }
  console.log(`\nstrfry-router-saved-state: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
