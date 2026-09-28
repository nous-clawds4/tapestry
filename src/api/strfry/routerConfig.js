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
 * POST /api/strfry/router-restart        — restart the strfry-router process
 * POST /api/strfry/router-restore-defaults — restore presets with their defaultEnabled state
 * POST /api/strfry/router-toggle         — toggle a stream's enabled state
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { isOwner } = require('../../middleware/auth');

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
const PLUGINS_DIR = '/usr/local/lib/strfry/plugins';

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
 * is preserved — today's UI emits {"kinds":[],"limit":5} and the deployed
 * parser accepts it (byte-compat). Pure: never mutates its input.
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
      if (Number.isInteger(val)) out[key] = val;
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
// event, and urls name the relays this instance mirrors to/from. Both used to be
// stored straight from client JSON and written into the router config unescaped
// (generateConfig below), so a `"` or newline broke out of the string — a crash-
// loop at the next restart, or an injected directive — and an arbitrary path
// became an executed program. Twin of sanitizeStreamFilter (ADR relay-management/
// 0002): the server enforces SHAPE at the client-JSON ingress, and generateConfig
// JSON-escapes every value at the sink. For legal values JSON.stringify is byte-
// identical to the old `"${value}"`, so the deployed parser sees no change.
//
// A plugin path is legal iff it is '' (none) or a `.js` file that is a DIRECT
// child of PLUGINS_DIR — path.resolve collapses any `../` so traversal cannot
// escape, and the basename is limited to a safe charset. That is exactly the set
// /api/strfry/router-plugins lists and the UI dropdown offers. A relay URL is
// legal iff it is ws:// or wss:// with no quote, backslash, whitespace or control
// character. Presets (setup/router-presets.json) are a trusted source and reach
// generateConfig via restore/init without re-validation; the sink escaping still
// covers them.

const CTRL_OR_QUOTE_RE = /["'\\]|[\x00-\x1f]/; // reject quotes, backslash, and any control char

function isLegalPluginPath(value) {
  if (value === undefined || value === null || value === '') return true; // none
  if (typeof value !== 'string') return false;
  if (CTRL_OR_QUOTE_RE.test(value)) return false;
  const base = path.basename(value);
  if (!/^[A-Za-z0-9._-]+\.js$/.test(base)) return false;
  // Must resolve to a direct child of PLUGINS_DIR (collapses any `../`).
  return path.dirname(path.resolve(value)) === PLUGINS_DIR;
}

function isLegalRelayUrl(value) {
  if (typeof value !== 'string') return false;
  if (CTRL_OR_QUOTE_RE.test(value)) return false;
  return /^wss?:\/\/\S+$/.test(value); // ws:// or wss://, no whitespace
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

function loadPresets() {
  try {
    if (fs.existsSync(PRESETS_PATH)) {
      return JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
    }
  } catch (e) {
    console.warn('[router] Failed to load presets:', e.message);
  }
  return [];
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
 * Write the strfry config from current state and restart the router.
 */
async function applyConfig(state) {
  const configText = generateConfig(state.streams);
  fs.writeFileSync(ROUTER_CONFIG_PATH, configText, 'utf8');

  await new Promise((resolve, reject) => {
    exec('supervisorctl restart strfry-router', { timeout: 10000 }, (err, stdout) => {
      if (err) reject(new Error(stdout || err.message));
      else resolve(stdout);
    });
  });
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
            const shown = typeof u === 'string' ? JSON.stringify(u) : typeof u;
            return res.status(400).json({ success: false, error: `Invalid relay URL for "${s.name}": ${shown}. Use ws:// or wss:// with no quotes, whitespace or control characters.` });
          }
        }
      }
      // pluginDown/pluginUp name a program the router EXECUTES: allow only '' or a
      // .js file directly inside PLUGINS_DIR (the set router-plugins lists).
      if (!isLegalPluginPath(s.pluginDown)) {
        return res.status(400).json({ success: false, error: `Invalid pluginDown for "${s.name}". Must be empty or a .js file directly inside ${PLUGINS_DIR}.` });
      }
      if (!isLegalPluginPath(s.pluginUp)) {
        return res.status(400).json({ success: false, error: `Invalid pluginUp for "${s.name}". Must be empty or a .js file directly inside ${PLUGINS_DIR}.` });
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
    const state = { streams: sanitizedStreams };
    saveState(state);
    await applyConfig(state);

    res.json({ success: true, message: 'Router config updated and restarted.' });
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

    const state = ensureState();
    const stream = state.streams.find(s => s.name === name);
    if (!stream) {
      return res.status(404).json({ success: false, error: `Stream "${name}" not found` });
    }

    stream.enabled = enabled;
    saveState(state);
    await applyConfig(state);

    res.json({
      success: true,
      message: `Stream "${name}" ${enabled ? 'enabled' : 'disabled'}.`,
      stream: { name, enabled },
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
 * Returns list of available plugin scripts.
 */
async function handleListPlugins(req, res) {
  try {
    const plugins = [];
    if (fs.existsSync(PLUGINS_DIR)) {
      const files = fs.readdirSync(PLUGINS_DIR);
      for (const f of files) {
        if (f.endsWith('.js')) {
          plugins.push({
            name: f,
            path: `${PLUGINS_DIR}/${f}`,
          });
        }
      }
    }
    res.json({ success: true, plugins, pluginsDir: PLUGINS_DIR });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/strfry/router-restart
 */
async function handleRestartRouter(req, res) {
  if (!requireOwnerOrLocal(req, res)) return;
  try {
    const result = await new Promise((resolve, reject) => {
      exec('supervisorctl restart strfry-router', { timeout: 10000 }, (err, stdout) => {
        if (err) reject(new Error(stdout || err.message));
        else resolve(stdout.trim());
      });
    });
    res.json({ success: true, message: result });
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

    saveState(state);
    await applyConfig(state);

    const enabledCount = state.streams.filter(s => s.enabled).length;
    res.json({
      success: true,
      message: `Restored ${state.streams.length} preset stream(s) (${enabledCount} enabled).`,
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
    const configText = generateConfig(state.streams);
    fs.writeFileSync(ROUTER_CONFIG_PATH, configText, 'utf8');
    const enabledCount = state.streams.filter(s => s.enabled).length;
    console.log(`[router] Initialized: ${state.streams.length} streams (${enabledCount} enabled)`);
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
};
