/**
 * Router config management API
 * 
 * POST /api/strfry/router-config  — update the full router config (streams array)
 * GET  /api/strfry/router-plugins — list available plugin scripts
 * POST /api/strfry/router-restart — restart the strfry-router process
 * POST /api/strfry/router-restore-defaults — restore the default config
 */
const { exec } = require('child_process');
const fs = require('fs');

const ROUTER_CONFIG_PATH = '/etc/strfry-router-tapestry.config';
const ROUTER_DEFAULT_PATH = '/etc/strfry-router-tapestry.config.default';
const PLUGINS_DIR = '/usr/local/lib/strfry/plugins';

/**
 * Generate strfry router config text from a streams array
 */
function generateConfig(streams, connectionTimeout = 20) {
  let config = `connectionTimeout = ${connectionTimeout}\n\nstreams {\n`;

  for (const stream of streams) {
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
 * Ensure the default config backup exists
 */
function ensureDefaultBackup() {
  if (!fs.existsSync(ROUTER_DEFAULT_PATH) && fs.existsSync(ROUTER_CONFIG_PATH)) {
    fs.copyFileSync(ROUTER_CONFIG_PATH, ROUTER_DEFAULT_PATH);
  }
}

/**
 * POST /api/strfry/router-config
 * Body: { streams: [...] }
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

    // Ensure default backup exists before first edit
    ensureDefaultBackup();

    // Generate and write config
    const configText = generateConfig(streams);
    fs.writeFileSync(ROUTER_CONFIG_PATH, configText, 'utf8');

    // Restart router
    await new Promise((resolve, reject) => {
      exec('supervisorctl restart strfry-router', { timeout: 10000 }, (err, stdout) => {
        if (err) reject(new Error(stdout || err.message));
        else resolve(stdout);
      });
    });

    res.json({ success: true, message: 'Router config updated and restarted.' });
  } catch (err) {
    console.error('handleUpdateRouterConfig error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/strfry/router-plugins
 * Returns list of available plugin scripts
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
 */
async function handleRestoreDefaults(req, res) {
  try {
    if (!fs.existsSync(ROUTER_DEFAULT_PATH)) {
      return res.status(404).json({ success: false, error: 'No default config backup found.' });
    }
    fs.copyFileSync(ROUTER_DEFAULT_PATH, ROUTER_CONFIG_PATH);

    // Restart router
    await new Promise((resolve, reject) => {
      exec('supervisorctl restart strfry-router', { timeout: 10000 }, (err, stdout) => {
        if (err) reject(new Error(stdout || err.message));
        else resolve(stdout);
      });
    });

    res.json({ success: true, message: 'Default config restored and router restarted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  handleUpdateRouterConfig,
  handleListPlugins,
  handleRestartRouter,
  handleRestoreDefaults,
};
