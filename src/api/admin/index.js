/**
 * Admin Management API
 *
 * Owner-only endpoints for managing instance administrators.
 * Admin list is stored in settings.json (persistent across restarts).
 * Admins cannot manage other admins — only the owner can.
 */

const { getConfigFromFile, getAdminPubkeys, isAdminPubkey } = require('../../utils/config');
const { getSettings, updateOverrides } = require('../../config/settings');
const { nip19 } = require('nostr-tools');

const NIP05_REGEX = /^(?:([\w.+-]+)@)?([\w_-]+(\.[\w_-]+)+)$/;

/**
 * Verify a NIP-05 identifier. Returns hex pubkey or null.
 */
async function verifyNip05(nip05Address) {
  const match = nip05Address.match(NIP05_REGEX);
  if (!match) return null;
  const name = match[1] || '_';
  const domain = match[2];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(
      `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!resp.ok) return null;
    const json = await resp.json();
    const pubkey = json.names?.[name] || json.names?.[name.toLowerCase()];
    if (!pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) return null;
    return pubkey;
  } catch {
    return null;
  }
}

/**
 * Resolve an identifier (npub, hex pubkey, or NIP-05) to a hex pubkey.
 */
async function resolveIdentifier(identifier) {
  if (!identifier) return { pubkey: null, error: 'No identifier provided' };
  const trimmed = identifier.trim();

  // 64-char hex pubkey
  if (/^[0-9a-f]{64}$/.test(trimmed.toLowerCase())) {
    return { pubkey: trimmed.toLowerCase() };
  }

  // npub
  if (trimmed.toLowerCase().startsWith('npub1')) {
    try {
      const decoded = nip19.decode(trimmed.toLowerCase());
      if (decoded.type === 'npub') return { pubkey: decoded.data };
    } catch {
      return { pubkey: null, error: 'Invalid npub format' };
    }
  }

  // nprofile
  if (trimmed.toLowerCase().startsWith('nprofile1')) {
    try {
      const decoded = nip19.decode(trimmed.toLowerCase());
      if (decoded.type === 'nprofile') return { pubkey: decoded.data.pubkey };
    } catch {
      return { pubkey: null, error: 'Invalid nprofile format' };
    }
  }

  // NIP-05
  if (NIP05_REGEX.test(trimmed)) {
    const pubkey = await verifyNip05(trimmed);
    if (pubkey) return { pubkey };
    return { pubkey: null, error: `NIP-05 verification failed for ${trimmed}` };
  }

  return { pubkey: null, error: 'Unrecognized identifier format. Use hex pubkey, npub, or NIP-05.' };
}

/**
 * Middleware: require owner ONLY (not admin).
 *
 * Used by endpoints where admins must not have access — specifically the
 * admin-management endpoints (/api/admin/list, /api/admin/add,
 * /api/admin/remove). Allowing admins to manage the admin list itself
 * would be a privilege-escalation surface (an admin could promote or
 * remove other admins). See story #18 / ADR 0016 §Decision.
 */
function requireOwnerOnly(req, res, next) {
  if (!req.session?.pubkey) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
  if (!ownerPubkey || req.session.pubkey !== ownerPubkey) {
    return res.status(403).json({ success: false, error: 'Owner access required' });
  }
  next();
}

/**
 * Middleware: require owner OR admin.
 *
 * Used by endpoints that trusted admins are allowed to operate — currently
 * the BullBoard mount at /admin/queues (story #18 / ADR 0016). Admin list
 * is resolved via isAdminPubkey() from utils/config, which consults
 * settings.json first and falls back to BRAINSTORM_ADMIN_PUBKEYS in
 * brainstorm.conf — the same source-of-truth used by admin checks
 * elsewhere in the app.
 *
 * Admin-management endpoints (/api/admin/add etc.) deliberately do NOT use
 * this middleware; they stay on requireOwnerOnly to preserve the
 * privilege-escalation guardrail.
 */
function requireOwnerOrAdmin(req, res, next) {
  if (!req.session?.pubkey) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  const sessionPubkey = req.session.pubkey;
  const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
  if (ownerPubkey && sessionPubkey === ownerPubkey) {
    return next();
  }
  if (isAdminPubkey(sessionPubkey)) {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Owner or admin access required' });
}

/**
 * GET /api/admin/list
 * Returns admin pubkeys with profile data.
 */
async function handleListAdmins(req, res) {
  try {
    const adminPubkeys = getAdminPubkeys();

    // Fetch profiles for each admin from local strfry
    const admins = [];
    for (const pubkey of adminPubkeys) {
      let profile = { pubkey };
      try {
        const npub = nip19.npubEncode(pubkey);
        profile.npub = npub;
      } catch {}

      // Try to fetch kind:0 profile from strfry
      try {
        const { execSync } = require('child_process');
        const filter = JSON.stringify({ kinds: [0], authors: [pubkey], limit: 1 });
        const result = execSync(`strfry scan '${filter.replace(/'/g, "'\\''")}' 2>/dev/null`, {
          encoding: 'utf8',
          timeout: 10000,
        }).trim();
        if (result) {
          const event = JSON.parse(result.split('\n')[0]);
          const content = JSON.parse(event.content);
          profile.name = content.name || content.display_name || '';
          profile.display_name = content.display_name || content.name || '';
          profile.picture = content.picture || '';
          profile.nip05 = content.nip05 || '';
          profile.about = content.about || '';
        }
      } catch { /* profile fetch failed, return pubkey only */ }

      admins.push(profile);
    }

    return res.json({ success: true, admins });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/admin/add
 * Body: { identifier: "npub1..." | "hex" | "bob@example.com" }
 */
async function handleAddAdmin(req, res) {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'identifier is required' });
    }

    // Resolve to hex pubkey
    const { pubkey, error } = await resolveIdentifier(identifier);
    if (!pubkey) {
      return res.status(400).json({ success: false, error: error || 'Could not resolve identifier' });
    }

    // Check not already an admin
    const currentAdmins = getAdminPubkeys();
    if (currentAdmins.includes(pubkey)) {
      return res.status(409).json({ success: false, error: 'This pubkey is already an administrator' });
    }

    // Check not the owner
    const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
    if (pubkey === ownerPubkey) {
      return res.status(400).json({ success: false, error: 'The owner does not need to be added as an administrator' });
    }

    // Add to settings
    const newAdmins = [...currentAdmins, pubkey];
    updateOverrides({ adminPubkeys: newAdmins });

    console.log(`[admin] Added admin: ${pubkey} (by owner ${req.session.pubkey})`);
    return res.json({ success: true, pubkey, message: `Administrator added: ${pubkey}` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/admin/remove
 * Body: { pubkey: "hex" }
 */
async function handleRemoveAdmin(req, res) {
  try {
    const { pubkey } = req.body;
    if (!pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) {
      return res.status(400).json({ success: false, error: 'Valid hex pubkey is required' });
    }

    const currentAdmins = getAdminPubkeys();
    if (!currentAdmins.includes(pubkey)) {
      return res.status(404).json({ success: false, error: 'This pubkey is not in the administrator list' });
    }

    // Remove from settings
    const newAdmins = currentAdmins.filter(p => p !== pubkey);
    updateOverrides({ adminPubkeys: newAdmins });

    console.log(`[admin] Removed admin: ${pubkey} (by owner ${req.session.pubkey})`);
    return res.json({ success: true, message: `Administrator removed: ${pubkey}` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  handleListAdmins,
  handleAddAdmin,
  handleRemoveAdmin,
  requireOwnerOnly,
  requireOwnerOrAdmin,
};
