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
const { getConfigFromFile, getAdminPubkeys } = require('./config');
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

/**
 * The assistant pubkey for one account — the instance's single main->delegate mapping
 * (ADR author-scoped-inspection/0001).
 *
 * Deliberately returns a STRING or null, never the key object getAssistantKeys returns. That
 * object carries privkey and nsec, and a caller that forwards it forwards those too; narrowing
 * here makes the boundary structural rather than a convention every call site has to remember.
 * Do not widen the return type.
 *
 * This is the function worksheet W13 plans as `resolveProvisionedDelegate(mainPubkey)`. When
 * open-ranking story 3 is built it adopts this one rather than minting a third mapping.
 *
 * @param {string} accountPubkey - a human's main hex pubkey
 * @returns {Promise<string|null>} the delegate's hex pubkey, or null when none is provisioned
 */
async function getAssistantPubkeyFor(accountPubkey) {
    // Guard before delegating: getAssistantKeys compares against a config read that is null when
    // brainstorm.conf is absent, so a null pubkey would compare equal to a null owner and route to
    // the owner's slot.
    if (typeof accountPubkey !== 'string' || !/^[0-9a-f]{64}$/.test(accountPubkey)) return null;
    try {
        const keys = await getAssistantKeys(accountPubkey);
        return keys && typeof keys.pubkey === 'string' ? keys.pubkey : null;
    } catch {
        return null;
    }
}

/**
 * Every account this instance holds an assistant key for, with the account that controls it
 * (ADR author-scoped-inspection/0001).
 *
 * Rows are { accountPubkey, assistantPubkey, role, displayName } and nothing else. An account with
 * no assistant provisioned is reported with assistantPubkey null — present and absent, never
 * omitted and never an error (admins only get a key on request).
 *
 * Admins are included only when the caller asks, and the caller may only ask when it is the owner:
 * GET /api/admin/list is behind requireOwnerOnly and this must not route around it.
 *
 * An account appearing in more than one role is reported once, under the most privileged. That is
 * a local disambiguation, not a fix for the multi-role gap.
 *
 * @param {{includeAdmins?: boolean}} [options]
 * @returns {Promise<Array<{accountPubkey: string, assistantPubkey: string|null, role: string, displayName: string}>>}
 */
async function listInstanceAssistants({ includeAdmins = false } = {}) {
    const seen = new Set();
    const out = [];

    const add = async (accountPubkey, role, displayName) => {
        if (typeof accountPubkey !== 'string' || !accountPubkey || seen.has(accountPubkey)) return;
        seen.add(accountPubkey);
        out.push({
            accountPubkey,
            assistantPubkey: await getAssistantPubkeyFor(accountPubkey),
            role,
            displayName: displayName || '',
        });
    };

    // Most privileged first, so the dedupe above resolves a multi-role account to its highest role.
    const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
    if (ownerPubkey) await add(ownerPubkey, 'owner', 'Owner');

    if (includeAdmins) {
        let admins = [];
        try { admins = getAdminPubkeys() || []; } catch { admins = []; }
        for (const pk of admins) await add(pk, 'admin', '');
    }

    let customers = [];
    try {
        const CustomerManager = require('./customerManager');
        const cm = new CustomerManager();
        await cm.initialize();
        customers = await cm.listActiveCustomers();
    } catch {
        customers = [];
    }
    for (const c of customers || []) {
        await add(c && c.pubkey, 'customer', (c && (c.display_name || c.name)) || '');
    }

    return out;
}

module.exports = { getAssistantKeys, getOwnerAssistantKeys, getOwnerAssistantPubkey, getAssistantPubkeyFor, listInstanceAssistants };
