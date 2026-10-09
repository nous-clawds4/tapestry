/**
 * Router config management API
 *
 * Streams are persisted in a state file (router-state.json) with an `enabled` flag.
 * Only enabled streams are written to the strfry router config file.
 * Presets (router-presets.json) provide templates with defaultEnabled flags.
 *
 * POST /api/strfry/router-config         — update streams (full replacement)
 * GET  /api/strfry/router-plugins        — list available plugin scripts
 * GET  /api/strfry/router-presets        — list available presets
 * POST /api/strfry/router-restart        — rebuild the config from saved state, restart strfry-router
 * POST /api/strfry/router-restore-defaults — restore presets with their defaultEnabled state
 * POST /api/strfry/router-toggle         — toggle a stream's enabled state
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { isOwner } = require('../../middleware/auth');
const { getRouterProcessStatus } = require('./routerStatus');

// The router decides what this instance mirrors to and from other relays, so every
// router mutation is owner-grade. Require the owner OR a genuinely-local operator
// (req.localTrusted = loopback + no proxy header), mirroring wipe.js and the
// publishEvent assistant-gate (ADR security-auth-exposure 0001/0002). Default-deny
// already blocks the unauthenticated case; this also blocks an authenticated non-owner.
function requireOwnerOrLocal(req, res) {
  if (isOwner(req) || req.localTrusted) return true;
  res.status(403).json({ success: false, error: 'Changing the relay router requires owner authentication' });
  return false;
}

const ROUTER_CONFIG_PATH = '/etc/strfry-router-tapestry.config';
const ROUTER_STATE_PATH = '/var/lib/brainstorm/router-state.json';
const PRESETS_PATH = path.resolve(__dirname, '../../../setup/router-presets.json');
// Where strfry-router plugins live (Dockerfile + bin/install.js). Read per call, so
// BRAINSTORM_ROUTER_PLUGINS_DIR can point a stack-free suite (or a non-standard
// install) at another directory; unset in the shipped container.
const DEFAULT_PLUGINS_DIR = '/usr/local/lib/strfry/plugins';
function pluginsDir() {
  return path.resolve(process.env.BRAINSTORM_ROUTER_PLUGINS_DIR || DEFAULT_PLUGINS_DIR);
}

// ── Stream filter sanitization (ADR relay-management/0002) ───
//
// The deployed strfry router hard-fails its WHOLE config on any filter key
// outside the closed vocabulary ids/authors/kinds/since/until/limit/#<single
// ASCII letter>. Client JSON must therefore never persist opaquely: one bad
// key POSTed into state would crash-loop the router at the next restart.
// Twin of the shape guard in negentropySync.js (deliberately per-surface;
// server enforces shape, not value format — ADR relay-management/0001).

const TAG_FILTER_KEY_RE = /^#[a-zA-Z]$/;
const SCALAR_INT_FILTER_KEYS = ['since', 'until', 'limit'];
const STRING_ARRAY_FILTER_KEYS = ['ids', 'authors'];

/**
 * Reconstruct a stream filter as an insertion-order-preserving whitelist copy
 * of the router's legal filter vocabulary; everything else is dropped.
 * Non-object input (null, arrays, strings, …) → undefined, so the stream
 * persists with no filter and generateConfig omits the line. Empty kinds []
 * is preserved — the UI emits {"kinds":[],"limit":500} and the deployed
 * parser accepts it (byte-compat). A negative `limit` is dropped: the image's
 * patched router sends the limit upstream on connect (ADR relay-stream-gaps/0002),
 * so it must be 0 (live only) or more. Pure: never mutates its input.
 */
function sanitizeStreamFilter(filter) {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) return undefined;
  const out = {};
  for (const key of Object.keys(filter)) {
    const val = filter[key];
    if (key === 'kinds') {
      if (Array.isArray(val)) out.kinds = val.filter(Number.isInteger);
    } else if (STRING_ARRAY_FILTER_KEYS.includes(key)) {
      if (Array.isArray(val)) {
        const values = val.filter(v => typeof v === 'string' && v.length > 0);
        if (values.length > 0) out[key] = values;
      }
    } else if (SCALAR_INT_FILTER_KEYS.includes(key)) {
      if (Number.isInteger(val) && (key !== 'limit' || val >= 0)) out[key] = val;
    } else if (TAG_FILTER_KEY_RE.test(key)) {
      if (Array.isArray(val)) {
        const values = val.filter(v => typeof v === 'string' && v.length > 0);
        if (values.length > 0) out[key] = values;
      }
    }
    // Any other key: dropped — the deployed parser hard-fails on it.
  }
  return out;
}

// ── Plugin path + relay URL validation (follow-up to the owner-gate) ──────────
//
// pluginDown/pluginUp name a program the strfry-router process EXECUTES on every
// event, and urls name the relays this instance mirrors to/from. Twin of
// sanitizeStreamFilter (ADR relay-management/0002): the server enforces SHAPE at
// the client-JSON ingress, and generateConfig JSON-escapes every value at the sink
// (byte-identical to the old `"${value}"` for legal values).
//
// A plugin path is legal iff it is '' (none), or an absolute path to a `.js` file
// with a safe basename that is a DIRECT child of the plugins directory both as
// written (path.resolve collapses `../`) AND after resolving symlinks (realpath),
// and that exists as a regular file. The realpath step means a symlink placed in
// the directory cannot point the router at a program elsewhere, and the existence
// step means a typo or a since-removed plugin cannot crash-loop the router. That is
// exactly the set /api/strfry/router-plugins lists and the UI dropdown offers.
//
// A relay URL is legal iff it parses as ws:// or wss:// with a host, and carries no
// quote, backslash, whitespace or control character. Loopback, private and link-
// local hosts are ACCEPTED on purpose: the endpoints that set URLs are owner/admin/
// local only, the in-container relay (ws://127.0.0.1:7777) and docker service names
// are legitimate targets for an operator, a name-based block could not see what a
// DNS name resolves to, and — because saved state is re-validated below — a default
// block would silently drop streams an instance already runs. No shipped preset
// uses an internal URL. (Recorded in ledger row 2026-09-30-router-saved-state-revalidation.)
//
// The same checks run on every path that builds the router config, not only on
// the client-JSON ingress: saved state (router-state.json) on toggle, restore-
// defaults, restart and startup, and the presets (setup/router-presets.json) when
// they are loaded. See vetStreamsForConfig and loadPresets.

const CTRL_OR_QUOTE_RE = /["'\\]|[\x00-\x1f\x7f]/; // quotes, backslash, any control char
const PLUGIN_BASENAME_RE = /^[A-Za-z0-9._-]+\.js$/;

/**
 * Why a plugin path is not legal, or null when it is (see the block comment above).
 * Checks, in order: shape (no I/O), then the filesystem (realpath, then stat of the
 * resolved target). Never throws.
 */
function pluginPathProblem(value) {
  if (value === undefined || value === null || value === '') return null; // none
  if (typeof value !== 'string') return 'is not a string';
  if (CTRL_OR_QUOTE_RE.test(value)) return 'contains a quote, backslash or control character';
  if (!path.isAbsolute(value)) return 'is not an absolute path';
  if (!PLUGIN_BASENAME_RE.test(path.basename(value))) return 'is not a .js file with a plain name';
  const dir = pluginsDir();
  if (path.dirname(path.resolve(value)) !== dir) return `is not directly inside ${dir}`;
  let realDir;
  try { realDir = fs.realpathSync(dir); } catch { return `cannot be checked: ${dir} does not exist`; }
  let real;
  try { real = fs.realpathSync(value); } catch { return 'does not exist'; }
  if (path.dirname(real) !== realDir) return `resolves (through a symlink) to a file outside ${dir}`;
  let st;
  try { st = fs.statSync(real); } catch { return 'does not exist'; }
  if (!st.isFile()) return 'is not a regular file';
  return null;
}

function isLegalPluginPath(value) {
  return pluginPathProblem(value) === null;
}

/** Why a relay URL is not legal, or null when it is. Never throws. */
function relayUrlProblem(value) {
  if (typeof value !== 'string') return 'is not a string';
  if (CTRL_OR_QUOTE_RE.test(value)) return 'contains a quote, backslash or control character';
  if (!/^wss?:\/\/\S+$/.test(value)) return 'is not a ws:// or wss:// URL without whitespace';
  let u;
  try { u = new URL(value); } catch { return 'does not parse as a URL'; }
  if (!u.hostname) return 'has no host';
  return null;
}

function isLegalRelayUrl(value) {
  return relayUrlProblem(value) === null;
}

/** Show a value in a log line or error: JSON-quoted (no raw newlines), capped. */
function shown(value) {
  const text = typeof value === 'string' ? JSON.stringify(value) : typeof value;
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

/**
 * Every problem that keeps a stream (saved state or preset) out of the router
 * config: its name and dir (written into the config), each url, and both plugins.
 * The filter is deliberately NOT re-checked here — ADR relay-management/0002 keeps
 * filter reconstruction at the client-JSON ingress only, and the sink JSON-escapes it.
 */
function streamProblems(stream) {
  if (!stream || typeof stream !== 'object' || Array.isArray(stream)) return ['is not an object'];
  const problems = [];
  if (typeof stream.name !== 'string' || !/^\w+$/.test(stream.name)) problems.push(`name ${shown(stream.name)} is not letters, digits and underscores`);
  if (!['both', 'up', 'down'].includes(stream.dir)) problems.push(`dir ${shown(stream.dir)} is not both, up or down`);
  if (stream.urls !== undefined && stream.urls !== null && !Array.isArray(stream.urls)) {
    problems.push('urls is not an array');
  } else if (Array.isArray(stream.urls)) {
    for (const u of stream.urls) {
      const why = relayUrlProblem(u);
      if (why) problems.push(`url ${shown(u)} ${why}`);
    }
  }
  for (const field of ['pluginDown', 'pluginUp']) {
    const why = pluginPathProblem(stream[field]);
    if (why) problems.push(`${field} ${shown(stream[field])} ${why}`);
  }
  return problems;
}

/**
 * Re-validate saved streams before they become router config.
 *
 * Behaviour for an ENABLED stream with any problem: it is left out of the
 * generated config (as if disabled) and a warning names the stream and the
 * problem. The rest of the router config is written and the router keeps running.
 * router-state.json itself is not rewritten (ADR relay-management/0002: server-
 * local state an operator may have hand-edited is never rewritten on these paths),
 * so the stream shows as it was saved until the operator fixes or re-saves it.
 * Dropping the whole stream, rather than blanking the bad plugin or url, is the
 * conservative choice: a blanked pluginDown would mirror events the plugin was
 * there to filter, and a half-kept stream would run a config the operator never
 * saved. Disabled streams are not written to the config, so they are not checked.
 *
 * @returns {{ streams: object[], skipped: {name: string, problems: string[]}[] }}
 */
function vetStreamsForConfig(streams, source = 'router-state.json') {
  const kept = [];
  const skipped = [];
  for (const s of Array.isArray(streams) ? streams : []) {
    if (s && s.enabled === false) { kept.push(s); continue; }
    const problems = streamProblems(s);
    if (problems.length === 0) { kept.push(s); continue; }
    const name = s && typeof s.name === 'string' ? s.name : '(unnamed)';
    skipped.push({ name, problems });
    console.warn(`[router] Leaving stream ${shown(name)} out of the router config (from ${source}): ${problems.join('; ')}. Fix it in Settings → Relays or in ${source}.`);
  }
  return { streams: kept, skipped };
}

// ── State persistence ────────────────────────────────────────

function loadState() {
  try {
    if (fs.existsSync(ROUTER_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(ROUTER_STATE_PATH, 'utf8'));
    }
  } catch (e) {
    console.warn('[router] Failed to load state:', e.message);
  }
  return null;
}

function saveState(state) {
  fs.writeFileSync(ROUTER_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

/**
 * Load setup/router-presets.json, keeping only presets that pass the same checks
 * as client JSON and saved state (streamProblems). A preset that fails is dropped
 * with a warning — it is neither offered by /router-presets nor applied by
 * restore-defaults or first boot — and the other presets load as usual.
 */
function loadPresets() {
  let presets = [];
  try {
    if (fs.existsSync(PRESETS_PATH)) {
      presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
    }
  } catch (e) {
    console.warn('[router] Failed to load presets:', e.message);
    return [];
  }
  if (!Array.isArray(presets)) {
    console.warn('[router] Ignoring presets: setup/router-presets.json is not an array');
    return [];
  }
  return presets.filter((p) => {
    const problems = streamProblems(p);
    if (problems.length === 0) return true;
    const name = p && typeof p.name === 'string' ? p.name : '(unnamed)';
    console.warn(`[router] Ignoring preset ${shown(name)} from setup/router-presets.json: ${problems.join('; ')}`);
    return false;
  });
}

/**
 * Initialize state from presets if no state file exists.
 * Called on first boot or after wiping state.
 */
function ensureState() {
  let state = loadState();
  if (state && Array.isArray(state.streams)) return state;

  // Initialize from presets
  const presets = loadPresets();
  state = {
    streams: presets.map(p => ({
      name: p.name,
      description: p.description || '',
      dir: p.dir,
      filter: p.filter,
      urls: p.urls,
      pluginDown: p.pluginDown || '',
      pluginUp: p.pluginUp || '',
      enabled: !!p.defaultEnabled,
      preset: true,  // flag that this came from a preset
    })),
  };
  saveState(state);
  return state;
}

// ── Config generation ────────────────────────────────────────

/**
 * Generate strfry router config text from a streams array.
 * Only includes enabled streams.
 */
function generateConfig(streams, connectionTimeout = 20) {
  const enabled = streams.filter(s => s.enabled !== false);

  let config = `connectionTimeout = ${connectionTimeout}\n\nstreams {\n`;

  for (const stream of enabled) {
    // stream.name is an identifier, already constrained to ^\w+$ at ingress. Every
    // other value is JSON.stringify'd so a quote/newline can never break out of its
    // string (byte-identical to `"${value}"` for legal values).
    config += `\n    ${stream.name} {\n`;
    config += `        dir = ${JSON.stringify(stream.dir)}\n\n`;

    if (stream.filter) {
      const filterStr = JSON.stringify(stream.filter);
      config += `        filter = ${filterStr}\n\n`;
    }

    if (stream.pluginDown) {
      config += `        pluginDown = ${JSON.stringify(stream.pluginDown)}\n\n`;
    }
    if (stream.pluginUp) {
      config += `        pluginUp = ${JSON.stringify(stream.pluginUp)}\n\n`;
    }

    if (stream.urls && stream.urls.length > 0) {
      config += `        urls = [\n`;
      for (const url of stream.urls) {
        config += `            ${JSON.stringify(url)},\n`;
      }
      config += `        ]\n`;
    } else {
      config += `        urls = []\n`;
    }

    config += `    }\n`;
  }

  config += `}\n`;
  return config;
}

/**
 * Build the router config text from saved state, re-validating every enabled
 * stream first (vetStreamsForConfig). Returns the text and the streams left out.
 */
function buildConfigFromState(state) {
  const { streams, skipped } = vetStreamsForConfig(state && state.streams);
  return { configText: generateConfig(streams), skipped };
}

// ── Applying a change: in-place reload, confirmed from the router's log ──
//
// ADR relay-stream-gaps/0001. strfry 1.1.0's router (src/apps/mesh/cmd_router.cpp) watches
// its config file with inotify (IN_MODIFY on the file's inode, 50 ms debounce). On each change
// reconcileConfig() logs "Loading router config file: <path>" and reconnects only the streams
// whose dir or filter changed; the others keep their sockets. A config it cannot parse is
// logged as "Failed to parse router config: <reason>" and the running streams are kept.
// Its log goes to stderr, which supervisord writes to ROUTER_LOG_PATH.
//
// So a change is applied by rewriting the config IN PLACE (fs.writeFileSync on the same
// path) — never temp + rename or delete + create: a new inode is picked up once and then
// silently ends reloads until the next restart — and confirmed from the log written after
// the rewrite. A restart (which disconnects every stream) is only the fallback: the router is
// not running, or no reload shows up in time. A strfry bump must re-verify the two strings and
// the log path; if they drift, every change falls back to a restart, never a false success.
const ROUTER_LOG_PATH = '/var/log/supervisor/strfry-router-error.log';
const RELOAD_LOADED_MARK = 'Loading router config file';
const RELOAD_FAILED_MARK = 'Failed to parse router config';
const RELOAD_TIMEOUT_MS = 3000;
const RELOAD_POLL_MS = 100;
const RELOAD_SETTLE_MS = 300;

/**
 * Read a log written since a router config write. The first Loading line is the reload;
 * a Failed line after it (and before any later Loading line) is its rejection.
 * Returns { loaded, error }: error is strfry's reason, or null.
 */
function classifyReloadLog(text) {
  const lines = String(text || '').split('\n');
  const first = lines.findIndex((l) => l.includes(RELOAD_LOADED_MARK));
  if (first === -1) return { loaded: false, error: null };
  for (let i = first + 1; i < lines.length; i++) {
    if (lines[i].includes(RELOAD_LOADED_MARK)) break;
    const at = lines[i].indexOf(RELOAD_FAILED_MARK);
    if (at !== -1) {
      const reason = lines[i].slice(at + RELOAD_FAILED_MARK.length).replace(/^\s*:\s*/, '').trim();
      return { loaded: true, error: reason || 'no reason given' };
    }
  }
  return { loaded: true, error: null };
}

/**
 * The text appended to a log since byte `offset`, and the file's current size. A file
 * smaller than `offset` was rotated by supervisord, so it is read from the start. Never
 * throws: a missing or unreadable log reads as { text: '', size: 0 }.
 */
function readLogSince(logPath, offset) {
  try {
    const { size } = fs.statSync(logPath);
    const start = size < offset ? 0 : offset;
    if (size <= start) return { text: '', size };
    const buf = Buffer.alloc(size - start);
    const fd = fs.openSync(logPath, 'r');
    try {
      fs.readSync(fd, buf, 0, buf.length, start);
    } finally {
      fs.closeSync(fd);
    }
    return { text: buf.toString('utf8'), size };
  } catch {
    return { text: '', size: 0 };
  }
}

function logSize(logPath) {
  try {
    return fs.statSync(logPath).size;
  } catch {
    return 0;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait for the router to log a reload after byte `offset` of its log. Resolves 'loaded',
 * { rejected: reason }, or 'timeout' after RELOAD_TIMEOUT_MS. After the Loading line it
 * waits RELOAD_SETTLE_MS more, so a Failed line from the same reload is not missed.
 */
async function waitForReload(offset) {
  const deadline = Date.now() + RELOAD_TIMEOUT_MS;
  let pos = offset;
  let text = '';
  const pull = () => {
    const more = readLogSince(ROUTER_LOG_PATH, pos);
    text += more.text;
    pos = more.size;
  };
  while (Date.now() < deadline) {
    await sleep(RELOAD_POLL_MS);
    pull();
    if (classifyReloadLog(text).loaded) {
      await sleep(RELOAD_SETTLE_MS);
      pull();
      const { error } = classifyReloadLog(text);
      return error ? { rejected: error } : 'loaded';
    }
  }
  return 'timeout';
}

class RouterRejectedError extends Error {
  constructor(reason) {
    super(`The router rejected the new configuration (${reason}). It is still running the previous streams; nothing was changed.`);
    this.reason = reason;
  }
}

function restartRouter() {
  return new Promise((resolve, reject) => {
    exec('supervisorctl restart strfry-router', { timeout: 10000 }, (err, stdout) => {
      if (err) reject(new Error(stdout || err.message));
      else resolve(stdout);
    });
  });
}

/**
 * Apply `state` to the running router. Resolves { applied, why?, skipped }:
 * applied 'reloaded' (strfry took the in-place rewrite) or 'restarted' (why: 'not-running'
 * or 'no-reload'); skipped lists streams re-validation left out (usually empty).
 * If strfry rejects the config, `prev` (the state the router is still running) is written
 * back — state file and config — and a RouterRejectedError is thrown.
 */
async function applyConfig(state, prev) {
  const { configText, skipped } = buildConfigFromState(state);
  const proc = await getRouterProcessStatus();
  if (proc.status !== 'running') {
    fs.writeFileSync(ROUTER_CONFIG_PATH, configText, 'utf8');
    await restartRouter();
    return { applied: 'restarted', why: 'not-running', skipped };
  }

  const offset = logSize(ROUTER_LOG_PATH);
  fs.writeFileSync(ROUTER_CONFIG_PATH, configText, 'utf8'); // in place: see the comment above
  const outcome = await waitForReload(offset);
  if (outcome === 'loaded') return { applied: 'reloaded', skipped };
  if (outcome === 'timeout') {
    await restartRouter();
    return { applied: 'restarted', why: 'no-reload', skipped };
  }

  if (prev) {
    saveState(prev);
    fs.writeFileSync(ROUTER_CONFIG_PATH, buildConfigFromState(prev).configText, 'utf8');
  }
  throw new RouterRejectedError(outcome.rejected);
}

/** A handler's success message for how the change was applied. `base` has no final period. */
function appliedMessage(base, { applied, why }) {
  if (applied !== 'restarted') return `${base}.`;
  if (why === 'not-running') return `${base}; the router was not running, so it was started.`;
  return `${base}; the router did not pick it up by itself, so it was restarted.`;
}

// One router mutation at a time (read state → modify → save → apply → roll back), in the
// order the requests arrived, so a rollback never undoes another change and two quick
// toggles never lose one of them. Handlers call this before their first await.
let routerLock = Promise.resolve();
function withRouterLock(fn) {
  const run = routerLock.then(fn, fn);
  routerLock = run.catch(() => {});
  return run;
}

const cloneState = (state) => JSON.parse(JSON.stringify(state));

/** The part of a response that reports streams re-validation left out. */
function skippedReport(skipped) {
  if (!skipped || skipped.length === 0) return {};
  return {
    skipped,
    warning: `Left out of the router config because their saved values are not valid: ${skipped.map((s) => s.name).join(', ')}. See the server log.`,
  };
}

// ── API Handlers ─────────────────────────────────────────────

/**
 * POST /api/strfry/router-config
 * Body: { streams: [...] }
 * Full replacement of the streams array. Each stream may include `enabled`.
 */
async function handleUpdateRouterConfig(req, res) {
  if (!requireOwnerOrLocal(req, res)) return;
  try {
    const { streams } = req.body;
    if (!Array.isArray(streams)) {
      return res.status(400).json({ success: false, error: 'streams must be an array' });
    }

    // Validate each stream
    for (const s of streams) {
      if (!s.name || !/^\w+$/.test(s.name)) {
        return res.status(400).json({ success: false, error: `Invalid stream name: "${s.name}". Use alphanumeric + underscore only.` });
      }
      if (!['both', 'up', 'down'].includes(s.dir)) {
        return res.status(400).json({ success: false, error: `Invalid direction for "${s.name}": "${s.dir}"` });
      }
      if (s.urls && !Array.isArray(s.urls)) {
        return res.status(400).json({ success: false, error: `urls must be an array for "${s.name}"` });
      }
      // Each relay URL must be ws:// or wss:// with no quote/backslash/whitespace/
      // control char — it is written into the router config and dials a relay.
      if (Array.isArray(s.urls)) {
        for (const u of s.urls) {
          if (!isLegalRelayUrl(u)) {
            return res.status(400).json({ success: false, error: `Invalid relay URL for "${s.name}": ${shown(u)}. Use ws:// or wss:// with a host and no quotes, whitespace or control characters.` });
          }
        }
      }
      // pluginDown/pluginUp name a program the router EXECUTES: allow only '' or an
      // existing regular .js file directly inside the plugins directory, symlinks
      // resolved (the set router-plugins lists).
      for (const field of ['pluginDown', 'pluginUp']) {
        const why = pluginPathProblem(s[field]);
        if (why) {
          return res.status(400).json({ success: false, error: `Invalid ${field} for "${s.name}": it ${why}. Must be empty or an existing .js file directly inside ${pluginsDir()}.` });
        }
      }
    }

    // Check for duplicate names
    const names = streams.map(s => s.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length > 0) {
      return res.status(400).json({ success: false, error: `Duplicate stream names: ${dupes.join(', ')}` });
    }

    // Reconstruct every stream's filter against the router's legal vocabulary
    // — client JSON never passes through opaquely (ADR relay-management/0002).
    const sanitizedStreams = streams.map(s => {
      const filter = sanitizeStreamFilter(s.filter);
      const stream = { ...s, filter };
      if (filter === undefined) delete stream.filter; // keep state JSON clean
      return stream;
    });

    // Update state
    await withRouterLock(async () => {
      const prev = cloneState(ensureState());
      const state = { streams: sanitizedStreams };
      saveState(state);
      const result = await applyConfig(state, prev);
      res.json({ success: true, message: appliedMessage('Router config updated', result), applied: result.applied, ...skippedReport(result.skipped) });
    });
  } catch (err) {
    console.error('handleUpdateRouterConfig error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/strfry/router-toggle
 * Body: { name: "<stream name>", enabled: true|false }
 * Toggle a single stream's enabled state without changing anything else.
 */
async function handleToggleStream(req, res) {
  if (!requireOwnerOrLocal(req, res)) return;
  try {
    const { name, enabled } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Missing stream name' });
    if (typeof enabled !== 'boolean') return res.status(400).json({ success: false, error: 'enabled must be a boolean' });

    await withRouterLock(async () => {
      const prev = cloneState(ensureState());
      const state = cloneState(prev);
      const stream = state.streams.find(s => s.name === name);
      if (!stream) {
        res.status(404).json({ success: false, error: `Stream "${name}" not found` });
        return;
      }

      stream.enabled = enabled;
      saveState(state);
      const result = await applyConfig(state, prev);

      res.json({
        success: true,
        message: appliedMessage(`Stream "${name}" ${enabled ? 'enabled' : 'disabled'}`, result),
        applied: result.applied,
        stream: { name, enabled },
        ...skippedReport(result.skipped),
      });
    });
  } catch (err) {
    console.error('handleToggleStream error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/strfry/router-presets
 * Returns available presets from router-presets.json.
 */
async function handleGetPresets(req, res) {
  try {
    const presets = loadPresets();
    res.json({ success: true, presets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/strfry/router-plugins
 * Returns the plugin scripts a stream may use: only files that would pass
 * pluginPathProblem, so the UI never offers a value router-config would refuse.
 */
async function handleListPlugins(req, res) {
  try {
    const dir = pluginsDir();
    const plugins = [];
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).sort();
      for (const f of files) {
        const full = path.join(dir, f);
        if (pluginPathProblem(full) === null) {
          plugins.push({ name: f, path: full });
        }
      }
    }
    res.json({ success: true, plugins, pluginsDir: dir });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/strfry/router-restart
 * Rebuilds the router config from saved state (re-validated, like toggle and
 * startup) and then restarts the router, so a restart never runs a config that
 * no longer matches what the checks allow.
 */
async function handleRestartRouter(req, res) {
  if (!requireOwnerOrLocal(req, res)) return;
  try {
    const { configText, skipped } = buildConfigFromState(ensureState());
    fs.writeFileSync(ROUTER_CONFIG_PATH, configText, 'utf8');
    const result = await new Promise((resolve, reject) => {
      exec('supervisorctl restart strfry-router', { timeout: 10000 }, (err, stdout) => {
        if (err) reject(new Error(stdout || err.message));
        else resolve(stdout.trim());
      });
    });
    res.json({ success: true, message: result, ...skippedReport(skipped) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/strfry/router-restore-defaults
 * Resets state to presets with their defaultEnabled flags.
 */
async function handleRestoreDefaults(req, res) {
  if (!requireOwnerOrLocal(req, res)) return;
  try {
    const presets = loadPresets();
    if (presets.length === 0) {
      return res.status(404).json({ success: false, error: 'No presets file found.' });
    }

    const state = {
      streams: presets.map(p => ({
        name: p.name,
        description: p.description || '',
        dir: p.dir,
        filter: p.filter,
        urls: p.urls,
        pluginDown: p.pluginDown || '',
        pluginUp: p.pluginUp || '',
        enabled: !!p.defaultEnabled,
        preset: true,
      })),
    };

    await withRouterLock(async () => {
      const prev = cloneState(ensureState());
      saveState(state);
      const result = await applyConfig(state, prev);

      const enabledCount = state.streams.filter(s => s.enabled).length;
      res.json({
        success: true,
        message: appliedMessage(`Restored ${state.streams.length} preset stream(s) (${enabledCount} enabled)`, result),
        applied: result.applied,
        ...skippedReport(result.skipped),
      });
    });
  } catch (err) {
    console.error('handleRestoreDefaults error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Initialize router state on server startup.
 * If no state file exists, creates one from presets.
 * Always regenerates the strfry config from state.
 */
async function initRouter() {
  try {
    const state = ensureState();
    const { configText, skipped } = buildConfigFromState(state);
    fs.writeFileSync(ROUTER_CONFIG_PATH, configText, 'utf8');
    const enabledCount = state.streams.filter(s => s.enabled).length;
    console.log(`[router] Initialized: ${state.streams.length} streams (${enabledCount} enabled${skipped.length ? `, ${skipped.length} left out — see warnings above` : ''})`);
  } catch (e) {
    console.warn('[router] Init failed:', e.message);
  }
}

module.exports = {
  generateConfig,
  sanitizeStreamFilter,
  handleUpdateRouterConfig,
  handleToggleStream,
  handleGetPresets,
  handleListPlugins,
  handleRestartRouter,
  handleRestoreDefaults,
  initRouter,
  // Exposed for the stack-free suites (test/strfry-router-saved-state.test.js,
  // test/router-config-reload-in-place.test.js).
  classifyReloadLog,
  readLogSince,
  pluginPathProblem,
  relayUrlProblem,
  vetStreamsForConfig,
  loadPresets,
};
