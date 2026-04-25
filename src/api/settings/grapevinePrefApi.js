/**
 * Grapevine preferences endpoints — house-wide search defaults.
 *
 * GET  /api/grapevine/preferences  — read current house search preferences (public)
 * PUT  /api/grapevine/preferences  — update house search preferences (owner/admin only,
 *                                    gated by requireOwner middleware in src/api/index.js)
 *
 * Stored under settings.grapevine.searchPreferences. These are SITE-WIDE defaults that
 * cascade to all users who haven't set their own per-user override (per-user overrides
 * live in /var/lib/brainstorm/user-prefs/<pubkey>.json via /api/user-prefs).
 *
 * The Meilisearch proxy resolves: user prefs → house prefs (these) → text-relevance.
 *
 * GET stays public because unauthenticated visitors (and the inline picker) need to
 * be able to read the resolved house defaults to render hints / display the active
 * sort. Only the write path is gated.
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
