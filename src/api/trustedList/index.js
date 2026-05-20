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

const { getOwnerAssistantKeys } = require('../../utils/assistantKeys');

let _nt = null;
function nt() {
  if (!_nt) _nt = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools');
  return _nt;
}

// ── TA private key cache (same pattern as normalize) ──────────
let _cachedPrivkey = null;

async function loadTAKey() {
  const keys = await getOwnerAssistantKeys();
  if (keys && keys.privkey) {
    _cachedPrivkey = Uint8Array.from(Buffer.from(keys.privkey, 'hex'));
    console.log(`[trusted-list] TA key loaded from secure storage`);
    return;
  }
  throw new Error('TA key not configured — store it in SecureKeyStorage');
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

/**
 * ADR 0010: extracted pure builder/publisher. Both the HTTP handler and
 * Story-11's pinned-tag refresh module call this. `extraTags` is an array
 * of pre-built tag arrays appended to the event before signing (used by
 * Story 11 for ['observer'], ['source-tag'], ['cutoff'], ['min-rank'],
 * and the optional ['status','retracted'] marker). `content` is the JSON
 * body string (used by Story 11 for per-member endorsement/dispute counts).
 */
async function buildAndPublishTL({ kind, dTag, title, metric, items, extraTags = [], content = '' }) {
  if (!_cachedPrivkey) await loadTAKey();

  if (!kind || ![30392, 30393, 30394, 30395].includes(kind)) {
    throw new Error('kind must be 30392-30395');
  }
  if (!dTag) throw new Error('dTag is required');
  // items can be an empty array — Story 11's retraction publishes an
  // empty-membership replacement. Only reject non-array inputs.
  if (!Array.isArray(items)) throw new Error('items must be an array');

  const tags = [['d', dTag]];
  if (title) tags.push(['title', title]);
  if (metric) tags.push(['metric', metric]);
  for (const t of extraTags) {
    if (Array.isArray(t) && t.length > 0) tags.push(t);
  }

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

  const event = signAndFinalize({ kind, tags, content });
  await publishToStrfry(event);
  const uuid = `${kind}:${event.pubkey}:${dTag}`;
  return { event, uuid };
}

async function handlePublishTrustedList(req, res) {
  try {
    const { kind, dTag, title, metric, items } = req.body || {};
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items array is required and must not be empty' });
    }
    const { event, uuid } = await buildAndPublishTL({ kind, dTag, title, metric, items });
    return res.json({
      success: true,
      event,
      uuid,
      message: `Trusted List published with ${items.length} items`,
    });
  } catch (err) {
    console.error('trusted-list/publish error:', err);
    // Validation errors from buildAndPublishTL surface as 400; anything
    // else (key loading, strfry publish) bubbles to 500.
    const isValidationErr = /^(kind must|dTag is required|items must)/.test(err.message || '');
    return res.status(isValidationErr ? 400 : 500).json({ success: false, error: err.message });
  }
}

/* ── Story 11: refresh-pinned-tag endpoints (ADR 0010) ─────────────────── */

function requireAuth(req, res) {
  const pubkey = req.session?.pubkey;
  if (!pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) {
    res.status(401).json({ success: false, error: 'authentication required' });
    return null;
  }
  return pubkey;
}

async function handleRefreshAllPinnedTags(req, res) {
  // No auth gate: cron-side endpoint, expected to be called from loopback
  // by the orchestrator script (same convention as updateAllScoresForOwner
  // and refreshSearchIndex's underlying API calls).
  try {
    const { refreshAllPinnedTags } = require('./refreshPinnedTags');
    const result = await refreshAllPinnedTags();
    return res.json({ success: true, pins: result.pins });
  } catch (err) {
    console.error('trusted-list/refresh-all-pinned-tags error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function handleRefreshOnePinnedTag(req, res) {
  const sessionPubkey = requireAuth(req, res);
  if (!sessionPubkey) return;
  const { pinEventId } = req.body || {};
  if (!pinEventId || !/^[0-9a-f]{64}$/.test(pinEventId)) {
    return res.status(400).json({ success: false, error: 'pinEventId is required (64-char lowercase hex)' });
  }
  try {
    const { refreshOnePinnedTagById } = require('./refreshPinnedTags');
    const result = await refreshOnePinnedTagById({ pinEventId, sessionPubkey });
    if (result.error === 'not-found') {
      return res.status(404).json({ success: false, error: 'pin event not found' });
    }
    if (result.error === 'forbidden') {
      return res.status(403).json({ success: false, error: 'pin event author does not match session pubkey' });
    }
    return res.json({ success: true, status: result.status, tlEventId: result.tlEventId || null, error: result.errorReason || null });
  } catch (err) {
    console.error('trusted-list/refresh-pinned-tag error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function handleRefreshForViewer(req, res) {
  const sessionPubkey = requireAuth(req, res);
  if (!sessionPubkey) return;
  const { viewerPubkey } = req.query || {};
  if (!viewerPubkey || !/^[0-9a-f]{64}$/.test(viewerPubkey)) {
    return res.status(400).json({ success: false, error: 'viewerPubkey is required (64-char lowercase hex)' });
  }
  if (viewerPubkey !== sessionPubkey) {
    return res.status(403).json({ success: false, error: 'viewerPubkey must match session pubkey' });
  }
  try {
    const { refreshPinnedTagsForViewer } = require('./refreshPinnedTags');
    const result = await refreshPinnedTagsForViewer(viewerPubkey);
    return res.json({ success: true, pins: result.pins });
  } catch (err) {
    console.error('trusted-list/refresh-pinned-tags-for-viewer error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

function register(app) {
  app.post('/api/trusted-list/publish', handlePublishTrustedList);
  app.post('/api/trusted-list/refresh-all-pinned-tags', handleRefreshAllPinnedTags);
  app.post('/api/trusted-list/refresh-pinned-tag', handleRefreshOnePinnedTag);
  app.post('/api/trusted-list/refresh-pinned-tags-for-viewer', handleRefreshForViewer);
}

module.exports = { register, buildAndPublishTL };
