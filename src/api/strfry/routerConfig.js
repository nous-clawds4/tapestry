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

const ROUTER_CONFIG_PATH = '/etc/strfry-router-tapestry.config';
const ROUTER_STATE_PATH = '/var/lib/brainstorm/router-state.json';
const PRESETS_PATH = path.resolve(__dirname, '../../../setup/router-presets.json');
const PLUGINS_DIR = '/usr/local/lib/strfry/plugins';

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
    config += `\n    ${stream.name} {\n`;
    config += `        dir = "${stream.dir}"\n\n`;

    if (stream.filter) {
      const filterStr = JSON.stringify(stream.filter);
      config += `        filter = ${filterStr}\n\n`;
    }

    if (stream.pluginDown) {
      config += `        pluginDown = "${stream.pluginDown}"\n\n`;
    }
    if (stream.pluginUp) {
      config += `        pluginUp = "${stream.pluginUp}"\n\n`;
    }

    if (stream.urls && stream.urls.length > 0) {
      config += `        urls = [\n`;
      for (const url of stream.urls) {
        config += `            "${url}",\n`;
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
    }

    // Check for duplicate names
    const names = streams.map(s => s.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length > 0) {
      return res.status(400).json({ success: false, error: `Duplicate stream names: ${dupes.join(', ')}` });
    }

    // Update state
    const state = { streams };
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
  handleUpdateRouterConfig,
  handleToggleStream,
  handleGetPresets,
  handleListPlugins,
  handleRestartRouter,
  handleRestoreDefaults,
  initRouter,
};
