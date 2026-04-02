/**
 * Per-user preferences endpoints.
 *
 * GET  /api/user-prefs   — read current user's preferences (requires auth)
 * PUT  /api/user-prefs   — save current user's preferences (requires auth)
 *
 * Stored as JSON files under /var/lib/brainstorm/user-prefs/<pubkey>.json
 * on the persistent tapestry-data volume.
 */

const fs = require('fs');
const path = require('path');

const PREFS_DIR = '/var/lib/brainstorm/user-prefs';

// Ensure the directory exists
function ensureDir() {
  if (!fs.existsSync(PREFS_DIR)) {
    fs.mkdirSync(PREFS_DIR, { recursive: true });
  }
}

function prefsPath(pubkey) {
  // Sanitize: only hex chars allowed
  const clean = pubkey.replace(/[^0-9a-f]/gi, '');
  if (clean.length !== 64) return null;
  return path.join(PREFS_DIR, `${clean}.json`);
}

function handleGetUserPrefs(req, res) {
  try {
    const pubkey = req.session?.pubkey;
    if (!pubkey) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const filePath = prefsPath(pubkey);
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Invalid pubkey' });
    }

    if (!fs.existsSync(filePath)) {
      return res.json({ success: true, preferences: {} });
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json({ success: true, preferences: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function handleUpdateUserPrefs(req, res) {
  try {
    const pubkey = req.session?.pubkey;
    if (!pubkey) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const filePath = prefsPath(pubkey);
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'Invalid pubkey' });
    }

    const prefs = req.body;
    if (!prefs || typeof prefs !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid preferences object' });
    }

    ensureDir();

    // Load existing and merge
    let existing = {};
    if (fs.existsSync(filePath)) {
      try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch {}
    }

    const merged = { ...existing, ...prefs };
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), 'utf8');

    res.json({ success: true, preferences: merged });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  handleGetUserPrefs,
  handleUpdateUserPrefs,
};
