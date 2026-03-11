/**
 * Shared helpers for normalize and property APIs.
 * Extracted from normalize/index.js to avoid circular dependencies.
 */
const { runCypher, writeCypher } = require('../../lib/neo4j-driver');
const { getConfigFromFile } = require('../../utils/config');
const { exec } = require('child_process');
const crypto = require('crypto');

// ── Lazy-load nostr-tools ─────────────────────────────────────
let _nt = null;
function nt() {
  if (!_nt) _nt = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools');
  return _nt;
}

function randomDTag() {
  return crypto.randomBytes(4).toString('hex');
}

function deriveSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── TA private key cache (loaded once from secure storage) ────
let _cachedPrivkey = null;

async function loadTAKey() {
  if (_cachedPrivkey) return;
  try {
    const { SecureKeyStorage } = require('../../utils/secureKeyStorage');
    const storage = new SecureKeyStorage({
      storagePath: '/var/lib/brainstorm/secure-keys'
    });
    const keys = await storage.getRelayKeys('tapestry-assistant');
    if (keys && keys.privkey) {
      _cachedPrivkey = Uint8Array.from(Buffer.from(keys.privkey, 'hex'));
      return;
    }
  } catch (e) {
    // Secure storage unavailable — fall through to legacy
  }

  // Fallback to brainstorm.conf
  const hex = getConfigFromFile('BRAINSTORM_RELAY_PRIVKEY');
  if (hex) {
    _cachedPrivkey = Uint8Array.from(Buffer.from(hex, 'hex'));
    return;
  }

  throw new Error('Tapestry Assistant key not configured. Store it in secure storage or set BRAINSTORM_RELAY_PRIVKEY.');
}

function getPrivkey() {
  if (!_cachedPrivkey) throw new Error('TA key not loaded yet — call loadTAKey() at startup');
  return _cachedPrivkey;
}

function signAndFinalize(template) {
  const privBytes = getPrivkey();
  return nt().finalizeEvent({
    kind: template.kind,
    created_at: template.created_at || Math.floor(Date.now() / 1000),
    tags: template.tags || [],
    content: template.content || '',
  }, privBytes);
}

function publishToStrfry(event) {
  return new Promise((resolve, reject) => {
    const child = exec('strfry import', { timeout: 10000 }, (err) => {
      if (err) reject(new Error(`strfry import failed: ${err.message}`));
      else resolve();
    });
    child.stdin.write(JSON.stringify(event) + '\n');
    child.stdin.end();
  });
}

async function importEventDirect(event, uuid) {
  const dTag = (event.tags.find(t => t[0] === 'd') || [])[1] || '';
  const nameTag = event.tags.find(t => t[0] === 'name');
  const name = nameTag ? nameTag[1] : '';

  // Merge the main event node
  await writeCypher(`
    MERGE (e:NostrEvent {uuid: $uuid})
    SET e.id = $id, e.pubkey = $pubkey, e.kind = $kind,
        e.created_at = $created_at, e.content = $content,
        e.name = $name
  `, {
    uuid, id: event.id, pubkey: event.pubkey,
    kind: event.kind, created_at: event.created_at,
    content: event.content || '', name,
  });

  // Delete old tags for this event
  await writeCypher(`
    MATCH (e:NostrEvent {uuid: $uuid})-[r:HAS_TAG]->(t:NostrEventTag)
    DELETE r, t
  `, { uuid });

  // Create new tags
  for (let i = 0; i < event.tags.length; i++) {
    const tag = event.tags[i];
    const tagUuid = crypto.createHash('sha256')
      .update(`${uuid}:${tag[0]}:${i}`)
      .digest('hex')
      .slice(0, 16);
    const params = {
      uuid, tagUuid,
      type: tag[0], value: tag[1] || '',
      value1: tag[2] || null, value2: tag[3] || null,
    };
    await writeCypher(`
      MATCH (e:NostrEvent {uuid: $uuid})
      CREATE (t:NostrEventTag {
        uuid: $tagUuid, type: $type, value: $value,
        value1: $value1, value2: $value2
      })
      CREATE (e)-[:HAS_TAG]->(t)
    `, params);
  }
}

async function regenerateJson(uuid, jsonValue) {
  await loadTAKey();
  const tagRows = await runCypher(`
    MATCH (e:NostrEvent {uuid: $uuid})-[:HAS_TAG]->(t:NostrEventTag)
    RETURN t.type AS type, t.value AS value, t.value1 AS value1, t.value2 AS value2
    ORDER BY t.uuid
  `, { uuid });

  const tags = [];
  let hasJson = false;
  for (const t of tagRows) {
    const tag = [t.type, t.value];
    if (t.value1) tag.push(t.value1);
    if (t.value2) tag.push(t.value2);
    if (t.type === 'json') {
      tags.push(['json', JSON.stringify(jsonValue)]);
      hasJson = true;
    } else {
      tags.push(tag);
    }
  }
  if (!hasJson) {
    tags.push(['json', JSON.stringify(jsonValue)]);
  }

  const kind = uuid.startsWith('39998:') ? 39998 : 39999;
  const evt = signAndFinalize({ kind, tags, content: '' });
  await publishToStrfry(evt);
  await importEventDirect(evt, uuid);
  return evt;
}

module.exports = {
  randomDTag,
  deriveSlug,
  loadTAKey,
  signAndFinalize,
  publishToStrfry,
  importEventDirect,
  regenerateJson,
};
