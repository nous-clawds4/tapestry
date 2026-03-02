/**
 * Settings API endpoints (owner-only).
 *
 * GET  /api/settings           — merged settings (defaults + overrides)
 * GET  /api/settings/defaults  — shipped defaults only
 * GET  /api/settings/overrides — user overrides only
 * PUT  /api/settings           — update overrides (deep merge)
 * DELETE /api/settings/:keyPath — reset a key back to default
 *
 * All endpoints require owner auth (checked via session).
 */

const {
  getSettings,
  getDefaults,
  getOverrides,
  updateOverrides,
  resetOverride,
  getSettingsPath,
} = require('../../config/settings');

/**
 * Validate relay URLs: must be wss:// or ws://
 */
function validateRelayUrls(obj, path = '') {
  const errors = [];
  if (Array.isArray(obj)) {
    obj.forEach((url, i) => {
      if (typeof url === 'string' && !url.match(/^wss?:\/\//)) {
        errors.push(`${path}[${i}]: "${url}" must start with wss:// or ws://`);
      }
    });
  } else if (obj && typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj)) {
      const childPath = path ? `${path}.${key}` : key;
      errors.push(...validateRelayUrls(val, childPath));
    }
  }
  return errors;
}

/**
 * Middleware: require owner role.
 * Classification is computed from session pubkey vs BRAINSTORM_OWNER_PUBKEY.
 */
function requireOwner(req, res, next) {
  if (!req.session?.pubkey) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  const { getConfigFromFile } = require('../../utils/config');
  const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
  if (!ownerPubkey || req.session.pubkey !== ownerPubkey) {
    return res.status(403).json({ success: false, error: 'Owner access required' });
  }
  next();
}

function handleGetSettings(req, res) {
  try {
    res.json({
      success: true,
      settings: getSettings(),
      overrides: getOverrides(),
      defaults: getDefaults(),
      settingsPath: getSettingsPath(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function handleGetDefaults(req, res) {
  try {
    res.json({ success: true, defaults: getDefaults() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function handleGetOverrides(req, res) {
  try {
    res.json({ success: true, overrides: getOverrides() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function handleUpdateSettings(req, res) {
  try {
    const patch = req.body;
    if (!patch || typeof patch !== 'object') {
      return res.status(400).json({ success: false, error: 'Request body must be a JSON object' });
    }

    // Validate relay URLs if aRelays section is being updated
    if (patch.aRelays) {
      const errors = validateRelayUrls(patch.aRelays, 'aRelays');
      if (errors.length > 0) {
        return res.status(400).json({ success: false, error: 'Invalid relay URLs', details: errors });
      }
    }

    const updated = updateOverrides(patch);
    res.json({
      success: true,
      overrides: updated,
      settings: getSettings(),
      needsRestart: hasRestartRequired(patch),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function handleResetSetting(req, res) {
  try {
    const keyPath = req.params.keyPath || req.params[0];
    if (!keyPath) {
      return res.status(400).json({ success: false, error: 'keyPath required' });
    }
    const updated = resetOverride(keyPath);
    res.json({
      success: true,
      overrides: updated,
      settings: getSettings(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Determine if a patch contains changes that require a restart.
 * Currently: conceptUUIDs and relationshipTypeUUIDs changes need restart.
 * Relay changes take effect on next fetch (no restart).
 */
function hasRestartRequired(patch) {
  return !!(patch.conceptUUIDs || patch.relationshipTypeUUIDs || patch.neo4jCypherQueryUrl);
}

module.exports = {
  requireOwner,
  handleGetSettings,
  handleGetDefaults,
  handleGetOverrides,
  handleUpdateSettings,
  handleResetSetting,
};
