/**
 * Public relay-list endpoint — no auth.
 * Surfaces settings.aRelays so UI components don't have to hardcode relay arrays.
 */

const { getSettings } = require('../../config/settings');

/**
 * GET /api/relays
 * Returns the configured aRelays object from settings. Public — relay URLs
 * are not sensitive.
 */
function handleGetRelays(req, res) {
  try {
    const settings = getSettings();
    const aRelays = settings?.aRelays || {};
    return res.json({ success: true, aRelays });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleGetRelays };
