/**
 * Owner endpoints — public, no auth.
 */

const { getConfigFromFile } = require('../../utils/config');

/**
 * GET /api/owner/pubkey
 * Returns the instance owner's nostr pubkey. Public — pubkeys are not secret.
 * Mirrors the shape of /api/assistant/pubkey for the Tapestry Assistant.
 */
function handleGetOwnerPubkey(req, res) {
  const pubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY', '');
  if (!pubkey) {
    return res.status(404).json({ success: false, error: 'Owner pubkey not configured' });
  }
  return res.json({ success: true, pubkey });
}

module.exports = { handleGetOwnerPubkey };
