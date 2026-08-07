/**
 * Brainstorm Assistant API
 *
 * Endpoints for managing an assistant's kind 0 nostr profile. The "assistant"
 * is a server-side nostr identity:
 *   - For the owner: the Tapestry Assistant (TA) key.
 *   - For a customer: their Customer Relay Key.
 *
 * The key is selected by getAssistantKeys(pubkey). The kind 0 event is signed
 * server-side with that key and published to local strfry plus the external
 * relays in EXTERNAL_RELAYS.
 *
 * POST /api/assistant/publish-profile accepts an optional `content` object so
 * the caller can pass user-edited fields; when omitted, instance-branded
 * defaults are used (legacy behavior for older callers).
 */

const { exec } = require('child_process');
const nostrTools = require('nostr-tools');
const { getAssistantKeys } = require('../../utils/assistantKeys');
const { getConfigFromFile, getAdminPubkeys } = require('../../utils/config');
const { SecureKeyStorage } = require('../../utils/secureKeyStorage');
const { getSettings, updateOverrides, resetOverride } = require('../../config/settings');
const WebSocket = require('ws');

const EXTERNAL_RELAYS = [
  'wss://relay.primal.net',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://wot.grapevine.network',
  'wss://purplepag.es',
];

/**
 * Publish a signed event to an external relay via WebSocket.
 * Returns a promise that resolves with success/failure.
 */
function publishToRelay(relayUrl, signedEvent, timeoutMs = 10000) {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(relayUrl);
      const timer = setTimeout(() => {
        try { ws.close(); } catch {}
        resolve({ relay: relayUrl, success: false, error: 'timeout' });
      }, timeoutMs);

      ws.on('open', () => {
        ws.send(JSON.stringify(['EVENT', signedEvent]));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg[0] === 'OK') {
            clearTimeout(timer);
            ws.close();
            resolve({ relay: relayUrl, success: msg[2] !== false, message: msg[3] || '' });
          }
        } catch {}
      });

      ws.on('error', (err) => {
        clearTimeout(timer);
        resolve({ relay: relayUrl, success: false, error: err.message });
      });
    } catch (err) {
      resolve({ relay: relayUrl, success: false, error: err.message });
    }
  });
}

// NIP-05 (`nip05`) is server-computed and deterministic — see
// computeAssistantLocalPart — so we intentionally exclude it from the list
// of user-editable kind 0 fields. If a client sends one, sanitizeProfileContent
// drops it; the publish handler always sets nip05 itself.
const PROFILE_FIELDS = ['name', 'display_name', 'about', 'picture', 'banner', 'website', 'lud16'];

/**
 * Fetch a nostr kind 0 display name for a pubkey from local strfry.
 * Used to derive the customer name for an assistant's default profile.
 */
function getKind0DisplayName(pubkey, fallback = 'My Owner') {
  return new Promise((resolve) => {
    const filter = JSON.stringify({ kinds: [0], authors: [pubkey], limit: 1 });
    exec(`strfry scan '${filter.replace(/'/g, "'\\''")}' 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 10000,
    }, (error, stdout) => {
      if (error || !stdout.trim()) {
        resolve(fallback);
        return;
      }
      try {
        const event = JSON.parse(stdout.trim().split('\n')[0]);
        const content = JSON.parse(event.content);
        resolve(content.display_name || content.name || fallback);
      } catch {
        resolve(fallback);
      }
    });
  });
}

/**
 * Derive the instance's bare hostname from configured domain or relay URL.
 * Returns e.g. "tapestry.brainstorm.world" or "localhost" if unconfigured.
 */
function getInstanceDomain() {
  const domain = getConfigFromFile('STRFRY_DOMAIN', '');
  if (domain && domain !== 'localhost') return domain;
  const relayUrl = getConfigFromFile('BRAINSTORM_RELAY_URL', '');
  if (relayUrl) {
    const host = relayUrl.replace(/^wss?:\/\//, '').replace(/\/.*$/, '');
    if (host) return host;
  }
  return 'localhost';
}

/**
 * Derive the instance's https website URL.
 * Returns e.g. "https://tapestry.brainstorm.world" or empty string if unconfigured.
 */
function getInstanceWebsite() {
  const domain = getInstanceDomain();
  return domain && domain !== 'localhost' ? `https://${domain}` : '';
}

/**
 * Could a stranger's nostr client actually fetch something from `website`?
 *
 * This is deliberately stricter than "is it set". getInstanceDomain falls back to
 * BRAINSTORM_RELAY_URL's host, so a dev instance reports `https://localhost:7777`
 * — truthy, and not equal to the string 'localhost', so an emptiness check lets it
 * through. Publishing a loopback URL in a kind 0 is worse than publishing nothing:
 * every client that fetched it would resolve it against **its own** machine.
 */
function isPubliclyReachable(website) {
  if (!website) return false;
  let hostname;
  try { hostname = new URL(website).hostname; } catch { return false; }
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || host === '0.0.0.0') return false;
  if (host.endsWith('.local') || host.endsWith('.localhost')) return false;
  if (/^127\./.test(host)) return false;
  // A bare hostname resolves only inside someone's own network, never from outside.
  if (!host.includes('.')) return false;
  return true;
}

/**
 * Compute a deterministic NIP-05 local-part for an Assistant.
 *
 * Format: `<sanitized-name>-tapestry-assistant-<6-char-suffix>`
 *   - sanitized-name: lowercase, NIP-05-legal chars only (`[a-z0-9._-]`),
 *     non-legal runs collapsed to `-`, leading/trailing separators stripped,
 *     capped at 32 chars to avoid runaway names. If empty after sanitization,
 *     the whole prefix is dropped — yielding just `tapestry-assistant-<suffix>`.
 *   - 6-char-suffix: last 6 hex chars of the assistant pubkey.
 *
 * Determinism: same caller name + same assistant pubkey → same local-part.
 * Uniqueness: 16M possible suffixes; collisions are vanishingly unlikely at
 * Brainstorm's user-base size. "Last writer wins" if it ever happens.
 */
function computeAssistantLocalPart(callerName, assistantPubkey) {
  const suffix = String(assistantPubkey || '').slice(-6).toLowerCase();
  const sanitized = String(callerName || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/[-._]{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .slice(0, 32)
    .replace(/[-._]+$/, '');
  return sanitized
    ? `${sanitized}-tapestry-assistant-${suffix}`
    : `tapestry-assistant-${suffix}`;
}

/**
 * Update the settings-backed NIP-05 names map to point `localPart` at
 * `assistantPubkey`, removing any prior entries that pointed at the same
 * pubkey under a different local-part. This is what keeps
 * `/.well-known/nostr.json` consistent with the latest published Assistant
 * profile (handled by src/api/nip05.js).
 */
function updateNip05Mapping(localPart, assistantPubkey) {
  const settings = getSettings();
  const existingNames = (settings.nip05 && settings.nip05.names) || {};
  for (const [key, val] of Object.entries(existingNames)) {
    if (val === assistantPubkey && key !== localPart) {
      try { resetOverride(`nip05.names.${key}`); } catch (e) { console.warn(`[assistant] could not remove old nip05 mapping "${key}":`, e.message); }
    }
  }
  updateOverrides({ nip05: { names: { [localPart]: assistantPubkey } } });
}

/**
 * Build instance-branded default kind 0 content for an assistant.
 * Owner assistant defaults differ from customer assistant defaults.
 */
async function buildDefaultProfileContent(pubkey, isOwner) {
  const website = getInstanceWebsite();
  // The branded avatar is committed at ui/public/ta-avatar.png and copied into
  // dist/ by the Vite build, so it is served at this instance's site root. Offer
  // it only when the instance is somewhere a third party could fetch it from;
  // otherwise offer none and let handlePublishProfile's empty-string pass drop
  // the field rather than publish a link nobody can follow.
  const hostedFrom = isPubliclyReachable(website) ? website : '';
  if (isOwner) {
    // Empty fallback, not a readable one: a placeholder like 'the owner' is
    // indistinguishable from a real name, which would make the generic branch
    // below unreachable.
    const ownerName = await getKind0DisplayName(pubkey, '');
    const assistantName = ownerName ? `${ownerName}'s Tapestry Assistant` : 'Tapestry Assistant';
    return {
      name: assistantName,
      display_name: assistantName,
      about: `Server-side Tapestry Assistant for ${ownerName || 'the owner'}. Signs firmware events, concept graph nodes, kind 30382 Trust Assertions, and other automated events on behalf of this Tapestry instance.`,
      picture: hostedFrom ? `${hostedFrom}/ta-avatar.png` : '',
      banner: '',
      website,
      nip05: '',
      lud16: '',
    };
  }
  const customerName = await getKind0DisplayName(pubkey, 'a customer');
  return {
    name: `${customerName}'s Tapestry Assistant`,
    display_name: `${customerName}'s Tapestry Assistant`,
    about: `I am the Tapestry Assistant for ${customerName}. My primary task is to publish kind 30382 Trusted Assertions so that ${customerName}'s personalized web of trust metrics are available to be utilized by any nostr client that supports NIP-85.`,
    picture: hostedFrom ? `${hostedFrom}/ta-avatar.png` : '',
    banner: '',
    website,
    nip05: '',
    lud16: '',
  };
}

/**
 * Strip any keys outside the allowed kind 0 fields and coerce values to strings.
 */
function sanitizeProfileContent(content) {
  const clean = {};
  for (const key of PROFILE_FIELDS) {
    const value = content?.[key];
    if (typeof value === 'string') {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * POST /api/assistant/publish-profile
 * Body: {
 *   customerPubkey: "hex",          // pubkey whose assistant we're publishing for
 *   content?: {                      // optional user-edited kind 0 fields
 *     name, display_name, about, picture, banner, website, nip05, lud16
 *   }
 * }
 * If `content` is omitted, instance-branded defaults are used (legacy behavior).
 */
async function handlePublishProfile(req, res) {
  try {
    const { customerPubkey, content } = req.body;
    if (!customerPubkey || !/^[0-9a-f]{64}$/.test(customerPubkey)) {
      return res.status(400).json({ success: false, error: 'Valid customerPubkey is required' });
    }

    // Verify caller is the customer or the owner
    const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
    const isOwner = customerPubkey === ownerPubkey;
    if (req.session?.pubkey !== customerPubkey && req.session?.pubkey !== ownerPubkey) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // 1. Get assistant keys (unified: owner → TA key, customer → customer relay key)
    const relayKeys = await getAssistantKeys(customerPubkey);
    if (!relayKeys || !relayKeys.privkey) {
      return res.status(400).json({ success: false, error: isOwner ? 'Tapestry Assistant keys not found.' : 'Customer relay keys not found. Set up Trusted Assertions first.' });
    }

    // Convert privkey from nsec or hex to Uint8Array
    let privkeyBytes;
    if (typeof relayKeys.privkey === 'string') {
      if (relayKeys.privkey.startsWith('nsec')) {
        privkeyBytes = nostrTools.nip19.decode(relayKeys.privkey).data;
      } else {
        privkeyBytes = Buffer.from(relayKeys.privkey, 'hex');
      }
    } else {
      privkeyBytes = relayKeys.privkey;
    }

    const assistantPubkey = nostrTools.getPublicKey(privkeyBytes);

    // 2. Pick profile content: user-supplied if present, otherwise instance defaults
    const profileContent = content && typeof content === 'object'
      ? sanitizeProfileContent(content)
      : await buildDefaultProfileContent(customerPubkey, isOwner);

    // 2a. NIP-05 is server-managed. Compute the deterministic local-part from
    // the caller's current display name and the assistant's pubkey, set it on
    // the kind 0, and update settings.nip05.names so the existing
    // /.well-known/nostr.json handler attests to it.
    const callerName = await getKind0DisplayName(customerPubkey, '');
    const localPart = computeAssistantLocalPart(callerName, assistantPubkey);
    const domain = getInstanceDomain();
    profileContent.nip05 = `${localPart}@${domain}`;

    // Drop empty-string keys so we don't pollute kind 0 with blank fields.
    // (nip05 was just set above, so it survives this pass.)
    for (const k of Object.keys(profileContent)) {
      if (profileContent[k] === '') delete profileContent[k];
    }

    const assistantName = profileContent.display_name || profileContent.name || 'Assistant';

    const event = {
      kind: 0,
      pubkey: assistantPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: JSON.stringify(profileContent),
    };

    // 4. Sign with assistant's private key
    const signedEvent = nostrTools.finalizeEvent(event, privkeyBytes);
    console.log(`[assistant] Kind 0 event signed: ${signedEvent.id.slice(0, 16)}...`);

    // 5. Publish to local strfry
    await new Promise((resolve, reject) => {
      const child = exec('strfry import', { timeout: 10000 }, (error) => {
        if (error) reject(error);
        else resolve();
      });
      child.stdin.write(JSON.stringify(signedEvent) + '\n');
      child.stdin.end();
    });

    console.log(`[assistant] Kind 0 published to strfry for ${assistantPubkey.slice(0, 8)}`);

    // 5b. Keep .well-known/nostr.json in sync. Done after the strfry publish so
    // a publish failure doesn't leave a NIP-05 record pointing at a kind 0
    // that isn't actually published.
    try {
      updateNip05Mapping(localPart, assistantPubkey);
      console.log(`[assistant] NIP-05 mapping ${localPart} → ${assistantPubkey.slice(0, 8)} written`);
    } catch (err) {
      console.warn('[assistant] NIP-05 mapping update failed (kind 0 already published):', err.message);
    }

    // 6. Publish to external relays (in parallel, non-blocking)
    const relayResults = await Promise.all(
      EXTERNAL_RELAYS.map(relay => publishToRelay(relay, signedEvent))
    );
    const relaySuccesses = relayResults.filter(r => r.success).length;
    console.log(`[assistant] Published to ${relaySuccesses}/${EXTERNAL_RELAYS.length} external relays`);
    for (const r of relayResults) {
      if (!r.success) console.warn(`[assistant] Failed: ${r.relay} — ${r.error || r.message || 'unknown'}`);
    }

    return res.json({
      success: true,
      event: signedEvent,
      assistantPubkey,
      assistantName,
      nip05: { localPart, domain, address: `${localPart}@${domain}` },
      relays: { total: EXTERNAL_RELAYS.length, success: relaySuccesses, results: relayResults },
      message: `Tapestry Assistant profile published to strfry + ${relaySuccesses}/${EXTERNAL_RELAYS.length} external relays`,
    });

  } catch (err) {
    console.error(`[assistant] Error publishing profile:`, err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/assistant/status
 * Query: ?customerPubkey=hex
 * Returns the assistant's pubkey, the current published kind 0 (if any), and
 * the instance-branded defaults the UI should prefill into the form for a
 * fresh setup.
 */
async function handleAssistantStatus(req, res) {
  try {
    const { customerPubkey } = req.query;
    if (!customerPubkey) {
      return res.status(400).json({ success: false, error: 'customerPubkey is required' });
    }

    const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
    const isOwner = customerPubkey === ownerPubkey;

    // Unified assistant key access (owner → TA key, customer → customer relay key)
    const relayKeys = await getAssistantKeys(customerPubkey);
    const defaults = await buildDefaultProfileContent(customerPubkey, isOwner);

    if (!relayKeys || !relayKeys.pubkey) {
      return res.json({ success: true, hasRelayKey: false, hasProfile: false, defaults });
    }

    // Compute the deterministic NIP-05 for this Assistant. Returned for the
    // editor's read-only display; the same value gets written into the kind 0
    // and into settings.nip05.names on the next publish.
    const callerName = await getKind0DisplayName(customerPubkey, '');
    const localPart = computeAssistantLocalPart(callerName, relayKeys.pubkey);
    const domain = getInstanceDomain();
    const computedNip05 = { localPart, domain, address: `${localPart}@${domain}` };

    // Check if kind 0 exists for the assistant pubkey
    const filter = JSON.stringify({ kinds: [0], authors: [relayKeys.pubkey], limit: 1 });
    const result = await new Promise((resolve) => {
      exec(`strfry scan '${filter.replace(/'/g, "'\\''")}' 2>/dev/null`, {
        encoding: 'utf8',
        timeout: 10000,
      }, (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve(null);
        } else {
          try {
            resolve(JSON.parse(stdout.trim().split('\n')[0]));
          } catch {
            resolve(null);
          }
        }
      });
    });

    let profile = null;
    if (result) {
      try {
        profile = JSON.parse(result.content);
      } catch {}
    }

    return res.json({
      success: true,
      hasRelayKey: true,
      assistantPubkey: relayKeys.pubkey,
      assistantNpub: relayKeys.npub,
      hasProfile: !!result,
      profile,
      defaults,
      isOwner,
      computedNip05,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/assistant/pubkey
 * Returns the owner's Tapestry Assistant pubkey (no auth required — pubkey is public).
 */
function handleGetTAPubkey(req, res) {
  const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
  const pubkey = getOwnerAssistantPubkey();
  if (!pubkey) {
    return res.status(404).json({ success: false, error: 'TA pubkey not configured' });
  }
  return res.json({ success: true, pubkey });
}

/**
 * POST /api/assistant/provision-key
 * Generates and stores a new server-side Assistant keypair for the caller's
 * session pubkey, if one doesn't already exist. Used by admins (who don't
 * get one at signup the way customers do) and as a fallback in any case
 * where a recognised user is missing their Assistant key.
 *
 * Auth: any authenticated session whose pubkey is the owner, an admin, or
 * an active customer. Storage scheme matches customer relay keys (slot is
 * the caller's pubkey), so getAssistantKeys(pubkey) will find it without
 * any extra routing.
 */
async function handleProvisionAssistantKey(req, res) {
  try {
    if (!req.session || !req.session.authenticated || !req.session.pubkey) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const sessionPubkey = req.session.pubkey;

    // Only known roles can provision: owner, admin, or active customer.
    const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
    const isOwner = sessionPubkey === ownerPubkey;
    const isAdmin = !isOwner && getAdminPubkeys().includes(sessionPubkey);
    let isCustomer = false;
    if (!isOwner && !isAdmin) {
      try {
        const CustomerManager = require('../../utils/customerManager');
        const cm = new CustomerManager();
        await cm.initialize();
        const customer = await cm.getCustomer(sessionPubkey);
        isCustomer = customer && customer.status === 'active';
      } catch {}
    }
    if (!isOwner && !isAdmin && !isCustomer) {
      return res.status(403).json({ success: false, error: 'Only the owner, an admin, or an active customer can provision an Assistant key' });
    }

    // If a key already exists, refuse — re-provisioning would lose the
    // signing identity of every event already signed by the old key.
    const existing = await getAssistantKeys(sessionPubkey);
    if (existing && existing.pubkey) {
      return res.status(409).json({
        success: false,
        error: 'Assistant key already exists for this user',
        pubkey: existing.pubkey,
        npub: existing.npub,
      });
    }

    const { generateRelayKeys } = require('../../utils/customerRelayKeys');
    const keys = generateRelayKeys();

    // Store under the caller's pubkey — same slot scheme as customer keys.
    // Owner is handled above (existing check would have returned the TA key
    // stored under 'tapestry-assistant'), so we never write the owner here.
    const storage = new SecureKeyStorage();
    await storage.storeRelayKeys(sessionPubkey, keys);

    console.log(`[assistant] Provisioned new Assistant key for ${sessionPubkey.slice(0, 8)} (role: ${isAdmin ? 'admin' : isCustomer ? 'customer' : 'owner'})`);

    return res.json({
      success: true,
      pubkey: keys.pubkey,
      npub: keys.npub,
    });
  } catch (err) {
    console.error('[assistant] provision-key error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// buildDefaultProfileContent is exported for tests: it is the sole producer of the
// defaults the editor offers and a content-less publish signs, so asserting on it
// directly is the only stack-free handle on that contract.
module.exports = { handlePublishProfile, handleAssistantStatus, handleGetTAPubkey, handleProvisionAssistantKey, buildDefaultProfileContent };
