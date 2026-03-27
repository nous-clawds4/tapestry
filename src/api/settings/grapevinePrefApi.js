/**
 * Public Grapevine preferences endpoints.
 *
 * GET  /api/grapevine/preferences  — read current search preferences
 * PUT  /api/grapevine/preferences  — save search preferences
 *
 * These are public (no auth required) since they're part of the
 * search UI flow. Stored under settings.grapevine.searchPreferences.
 */

const { getSettings, updateOverrides } = require('../../config/settings');

function handleGetGrapevinePreferences(req, res) {
  try {
    const settings = getSettings();
    const prefs = settings.grapevine?.searchPreferences || {
      povPubkey: null,
      metrics: [],
      delegatedPubkey: null,
      nip85Relay: null,
    };
    res.json({ success: true, preferences: prefs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function handleUpdateGrapevinePreferences(req, res) {
  try {
    const prefs = req.body;
    if (!prefs || typeof prefs !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid preferences object' });
    }

    // Only allow known fields
    const allowed = ['povPubkey', 'metrics', 'delegatedPubkey', 'nip85Relay', 'filters', 'sort'];
    const cleaned = {};
    for (const key of allowed) {
      if (key in prefs) cleaned[key] = prefs[key];
    }

    updateOverrides({ grapevine: { searchPreferences: cleaned } });
    res.json({ success: true, preferences: cleaned });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  handleGetGrapevinePreferences,
  handleUpdateGrapevinePreferences,
};
