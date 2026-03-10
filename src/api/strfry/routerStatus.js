/**
 * GET /api/strfry/router-status
 *
 * Returns the strfry router status: process state and streams (with enabled flag).
 * Reads from router-state.json for the authoritative stream list.
 */
const { exec } = require('child_process');
const fs = require('fs');

const ROUTER_STATE_PATH = '/var/lib/brainstorm/router-state.json';
const ROUTER_CONFIG_PATH = '/etc/strfry-router-tapestry.config';

function loadState() {
  try {
    if (fs.existsSync(ROUTER_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(ROUTER_STATE_PATH, 'utf8'));
    }
  } catch (e) {
    console.warn('[router-status] Failed to load state:', e.message);
  }
  return null;
}

async function handleRouterStatus(req, res) {
  try {
    // Get supervisor status
    const processStatus = await new Promise((resolve) => {
      exec('supervisorctl status strfry-router', { timeout: 5000 }, (err, stdout) => {
        if (err && !stdout) {
          resolve({ status: 'unknown', detail: err.message });
          return;
        }
        const line = (stdout || '').trim();
        if (line.includes('RUNNING')) {
          const uptimeMatch = line.match(/uptime\s+(\S+)/);
          resolve({ status: 'running', uptime: uptimeMatch ? uptimeMatch[1] : null });
        } else if (line.includes('STOPPED')) {
          resolve({ status: 'stopped' });
        } else if (line.includes('FATAL')) {
          resolve({ status: 'fatal', detail: line });
        } else {
          resolve({ status: 'unknown', detail: line });
        }
      });
    });

    // Read state file for streams
    const state = loadState();
    const streams = state?.streams || [];

    res.json({
      success: true,
      router: {
        process: processStatus,
        configPath: ROUTER_CONFIG_PATH,
        statePath: ROUTER_STATE_PATH,
        streams,
      },
    });
  } catch (err) {
    console.error('handleRouterStatus error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleRouterStatus };
