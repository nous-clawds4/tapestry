/**
 * Trusted List API — sign and publish kind 30392-30395 Trusted List events.
 *
 * POST /api/trusted-list/publish
 *   Body: {
 *     kind: 30392 | 30393,
 *     dTag: string,
 *     title: string,
 *     metric?: string,
 *     items: [{ tag, value, relay?, author?, score? }]
 *   }
 *
 * Signs with the Tapestry Assistant key and publishes to local strfry.
 */

const { getConfigFromFile } = require('../../utils/config');
const { SecureKeyStorage } = require('../../utils/secureKeyStorage');

let _nt = null;
function nt() {
  if (!_nt) _nt = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools');
  return _nt;
}

// ── TA private key cache (same pattern as normalize) ──────────
let _cachedPrivkey = null;

async function loadTAKey() {
  try {
    const storage = new SecureKeyStorage({
      storagePath: '/var/lib/brainstorm/secure-keys'
    });
    const keys = await storage.getRelayKeys('tapestry-assistant');
    if (keys && keys.privkey) {
      _cachedPrivkey = Uint8Array.from(Buffer.from(keys.privkey, 'hex'));
      console.log(`[trusted-list] TA key loaded from secure storage`);
      return;
    }
  } catch (e) {
    console.warn(`[trusted-list] Secure storage unavailable: ${e.message}`);
  }

  // Fallback to brainstorm.conf
  const hex = getConfigFromFile('BRAINSTORM_RELAY_PRIVKEY');
  if (hex) {
    _cachedPrivkey = Uint8Array.from(Buffer.from(hex, 'hex'));
    console.warn('[trusted-list] TA key loaded from brainstorm.conf (fallback)');
    return;
  }

  throw new Error('TA key not configured');
}

function getPrivkey() {
  if (!_cachedPrivkey) throw new Error('TA key not loaded yet');
  return _cachedPrivkey;
}

function signAndFinalize(template) {
  const privBytes = getPrivkey();
  const pubkey = Buffer.from(nt().getPublicKey(privBytes)).toString('hex');
  const event = {
    kind: template.kind,
    created_at: Math.floor(Date.now() / 1000),
    tags: template.tags,
    content: template.content || '',
    pubkey,
  };
  return nt().finalizeEvent(event, privBytes);
}

async function publishToStrfry(event) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    const escaped = JSON.stringify(event).replace(/'/g, "'\\''");
    const child = exec(
      `echo '${escaped}' | /usr/local/bin/strfry import --no-verify`,
      { timeout: 5000 },
      (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout);
      }
    );
  });
}

async function handlePublishTrustedList(req, res) {
  try {
    // Ensure key is loaded
    if (!_cachedPrivkey) await loadTAKey();

    const { kind, dTag, title, metric, items } = req.body || {};

    if (!kind || ![30392, 30393, 30394, 30395].includes(kind)) {
      return res.status(400).json({ success: false, error: 'kind must be 30392-30395' });
    }
    if (!dTag) {
      return res.status(400).json({ success: false, error: 'dTag is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items array is required and must not be empty' });
    }

    // Build tags
    const tags = [['d', dTag]];
    if (title) tags.push(['title', title]);
    if (metric) tags.push(['metric', metric]);

    for (const item of items) {
      if (item.tag === 'p') {
        const pTag = ['p', item.value];
        if (item.relay) pTag.push(item.relay);
        else if (item.score != null) pTag.push('');
        if (item.score != null) pTag.push(String(item.score));
        tags.push(pTag);
      } else if (item.tag === 'e') {
        const eTag = ['e', item.value];
        if (item.relay) eTag.push(item.relay);
        else if (item.author || item.score != null) eTag.push('');
        if (item.author) eTag.push(item.author);
        else if (item.score != null) eTag.push('');
        if (item.score != null) eTag.push(String(item.score));
        tags.push(eTag);
      }
    }

    const event = signAndFinalize({ kind, tags, content: '' });
    await publishToStrfry(event);

    const uuid = `${kind}:${event.pubkey}:${dTag}`;

    return res.json({
      success: true,
      event,
      uuid,
      message: `Trusted List published with ${items.length} items`,
    });
  } catch (err) {
    console.error('trusted-list/publish error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

function register(app) {
  app.post('/api/trusted-list/publish', handlePublishTrustedList);
}

module.exports = { register };
