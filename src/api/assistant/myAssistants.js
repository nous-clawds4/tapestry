/**
 * GET /api/assistant/my-assistants — the signed-in viewer's Assistants: every profile they have tagged My Brainstorm
 * Assistant or My Tapestry Assistant, and the Assistant this instance holds for them (my-assistants #1, ADR
 * my-assistants/0001).
 *
 * Session-shaped, like /api/assistant/attention: the viewer comes from the session only, and no request parameter can
 * change whose taggings are read. The taggings are read from the relays every tag page reads — this instance's strfry
 * and the operator's opt-in tag-federation relays (profile-tags' federatedScan, ADR tag-federation/0001) — and the
 * rule that decides which count is myAssistantRows, below (ADR sub-decision 2):
 *
 *   - the viewer's own kind 39999 taggings carrying the canonical nostr-user-tag z;
 *   - which tag: the slug of its `a` (any definition author counts), else of the publisher's d
 *     (profile-tag-<slug>-<target8>-<signer8>, whose signer segment must be the viewer's);
 *   - the newest per (tag, profile) decides, the lowest id breaking a tie (NIP-01);
 *   - a newest the viewer retracted (NIP-09: a kind 5 naming its id, or its address at or after it) is dropped;
 *   - only an apply counts.
 *
 * One row per profile, with its tags in the list's order; the viewer's Assistant here is marked `local`, and added
 * untagged when they have not tagged it (book decision 5).
 *
 * Read-only: relays are only read, and nothing is signed, published or stored.
 *
 *   no session       → { success: true, signedIn: false }
 *   a session        → { success: true, signedIn: true, local: <hex>|null, rows: [{ pubkey, local, tags: [{ key, name }] }] }
 *   the local read throws → 500 { success: false, error: 'Could not load your Assistants' }
 */

const { readPolarity, polarityBucket } = require('../../lib/identification-tags');
const { MY_ASSISTANT_TAGS, slugKey } = require('../../lib/my-assistant-tags');

const HEX64 = /^[0-9a-f]{64}$/i;
const TAG_ADDRESS = /^39999:([0-9a-f]{64}):(.+)$/i;
const PUBLISHER_D = /^profile-tag-(.+)-([0-9a-f]{8})-([0-9a-f]{8})$/;

/** The real dependencies, required lazily so the module loads in a bare checkout. */
function defaultDeps() {
  return {
    getAssistantPubkeyFor: (pubkey) => require('../../utils/assistantKeys').getAssistantPubkeyFor(pubkey),
    scan: (filter) => require('../profile-tags').federatedScan(filter),
    zTag: () => require('../profile-tags').NOSTR_USER_TAG_Z_TAG,
  };
}

function tagValue(event, name) {
  const tags = event && Array.isArray(event.tags) ? event.tags : [];
  const t = tags.find((x) => Array.isArray(x) && x[0] === name);
  return t ? t[1] : null;
}

/** The slug of the tag a tagging applies: its `a` first, else the publisher's d with the viewer's signer segment. */
function slugOf(event, viewer) {
  const a = tagValue(event, 'a');
  const byAddress = typeof a === 'string' ? a.match(TAG_ADDRESS) : null;
  if (byAddress) return byAddress[2];
  const d = tagValue(event, 'd');
  const byD = typeof d === 'string' ? d.match(PUBLISHER_D) : null;
  if (byD && byD[3] === String(viewer).slice(0, 8)) return byD[1];
  return null;
}

/** Did the viewer retract this tagging: a kind 5 naming its id, or its address at or after it (NIP-09)? */
function isRetracted(event, deletions, viewer) {
  const address = `39999:${viewer}:${tagValue(event, 'd')}`;
  return (Array.isArray(deletions) ? deletions : []).some((del) => del && del.kind === 5 && del.pubkey === viewer
    && (del.tags || []).some((t) => Array.isArray(t)
      && ((t[0] === 'e' && t[1] === event.id)
        || (t[0] === 'a' && t[1] === address && (del.created_at || 0) >= (event.created_at || 0)))));
}

/** Is `a` newer than `b` (NIP-01: later created_at, then the lowest id)? */
function isNewer(a, b) {
  if (!b) return true;
  const ta = a.created_at || 0;
  const tb = b.created_at || 0;
  if (ta !== tb) return ta > tb;
  return String(a.id) < String(b.id);
}

/** The viewer's newest tagging per (tag key, target), for the two tags only. */
function newestStances({ viewer, taggings }) {
  const newest = new Map();
  for (const event of Array.isArray(taggings) ? taggings : []) {
    if (!event || event.kind !== 39999 || event.pubkey !== viewer) continue;
    const key = slugKey(slugOf(event, viewer));
    const target = tagValue(event, 'p');
    if (!key || typeof target !== 'string' || !HEX64.test(target)) continue;
    const pair = `${key}|${target.toLowerCase()}`;
    if (isNewer(event, newest.get(pair))) newest.set(pair, event);
  }
  return newest;
}

/**
 * The rows, from the viewer's taggings and retractions. Pure.
 * @param {{viewer: string, local: ?string, taggings: Object[], deletions: Object[]}} input
 * @returns {Array<{pubkey: string, local: boolean, tags: Array<{key: string, name: string}>}>} in no promised order
 */
function myAssistantRows({ viewer, local, taggings, deletions }) {
  const byTarget = new Map();
  for (const [pair, event] of newestStances({ viewer, taggings })) {
    if (isRetracted(event, deletions, viewer)) continue;
    if (polarityBucket(readPolarity(event)) !== 'apply') continue;
    const [key, target] = pair.split('|');
    if (!byTarget.has(target)) byTarget.set(target, new Set());
    byTarget.get(target).add(key);
  }
  if (local && !byTarget.has(local)) byTarget.set(local, new Set());
  return [...byTarget.entries()].map(([pubkey, keys]) => ({
    pubkey,
    local: !!local && pubkey === local,
    tags: MY_ASSISTANT_TAGS.filter((t) => keys.has(t.key)).map((t) => ({ key: t.key, name: t.name })),
  }));
}

async function handleMyAssistants(req, res, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const session = req && req.session;
  const viewer = session && session.authenticated === true && typeof session.pubkey === 'string' && HEX64.test(session.pubkey)
    ? session.pubkey.toLowerCase()
    : null;
  if (!viewer) return res.json({ success: true, signedIn: false });

  try {
    const answered = await d.getAssistantPubkeyFor(viewer);
    const local = typeof answered === 'string' && HEX64.test(answered) ? answered.toLowerCase() : null;
    const taggings = await d.scan({ kinds: [39999], authors: [viewer], '#z': [d.zTag()] });
    // Retractions are read only for the taggings that could count: by id, and by address.
    const candidates = [...newestStances({ viewer, taggings }).values()];
    let deletions = [];
    if (candidates.length > 0) {
      const [byId, byAddress] = await Promise.all([
        d.scan({ kinds: [5], authors: [viewer], '#e': candidates.map((e) => e.id) }),
        d.scan({ kinds: [5], authors: [viewer], '#a': candidates.map((e) => `39999:${viewer}:${tagValue(e, 'd')}`) }),
      ]);
      deletions = [...(byId || []), ...(byAddress || [])];
    }
    return res.json({ success: true, signedIn: true, local, rows: myAssistantRows({ viewer, local, taggings, deletions }) });
  } catch (err) {
    console.error('[assistant/my-assistants] could not load the viewer\'s Assistants:', err && err.message ? err.message : err);
    return res.status(500).json({ success: false, error: 'Could not load your Assistants' });
  }
}

module.exports = {
  handleMyAssistants,
  myAssistantRows,
  slugOf,
  isRetracted,
};
