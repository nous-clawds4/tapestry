/**
 * Unified assistant key access.
 *
 * Routes to the correct SecureKeyStorage key based on pubkey:
 *   - owner pubkey  → 'tapestry-assistant' key
 *   - anyone else   → customer relay key (keyed by their pubkey)
 *
 * Returns { privkey, pubkey, npub, nsec } or null.
 */

const { SecureKeyStorage } = require('./secureKeyStorage');
const { getConfigFromFile } = require('./config');
const { getCustomerRelayKeys } = require('./customerRelayKeys');

/**
 * Get assistant keys for any role (owner, admin, or customer).
 * @param {string} pubkey - The user's hex pubkey
 * @returns {Promise<{privkey: string, pubkey: string, npub: string, nsec: string}|null>}
 */
async function getAssistantKeys(pubkey) {
  const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
  if (pubkey === ownerPubkey) {
    return getOwnerAssistantKeys();
  }
  return getCustomerRelayKeys(pubkey);
}

/**
 * Get the owner's Tapestry Assistant keys from SecureKeyStorage.
 * @returns {Promise<{privkey: string, pubkey: string, npub: string, nsec: string}|null>}
 */
async function getOwnerAssistantKeys() {
  try {
    const storage = new SecureKeyStorage({ storagePath: '/var/lib/brainstorm/secure-keys' });
    return await storage.getRelayKeys('tapestry-assistant');
  } catch {
    return null;
  }
}

/**
 * Get the owner's TA pubkey (sync, cached).
 * Reads from brainstorm.conf (pubkey only — no private key needed)
 * or falls back to SecureKeyStorage JSON file.
 * @returns {string|null}
 */
let _taPubkeyCache = null;

function getOwnerAssistantPubkey() {
  if (_taPubkeyCache) return _taPubkeyCache;

  // 1. Environment variable
  if (process.env.TA_PUBKEY) {
    _taPubkeyCache = process.env.TA_PUBKEY;
    return _taPubkeyCache;
  }

  // 2. brainstorm.conf (pubkey only — privkey is NOT in conf)
  const pubkey = getConfigFromFile('BRAINSTORM_RELAY_PUBKEY');
  if (pubkey && /^[0-9a-f]{64}$/.test(pubkey)) {
    _taPubkeyCache = pubkey;
    return _taPubkeyCache;
  }

  // 3. SecureKeyStorage file (sync read)
  try {
    const fs = require('fs');
    const path = require('path');
    const keysPath = path.join('/var/lib/brainstorm/secure-keys', 'tapestry-assistant.json');
    if (fs.existsSync(keysPath)) {
      const keys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
      if (keys.pubkey) {
        _taPubkeyCache = keys.pubkey;
        return _taPubkeyCache;
      }
    }
  } catch {
    // Fall through
  }

  return null;
}

module.exports = { getAssistantKeys, getOwnerAssistantKeys, getOwnerAssistantPubkey };
