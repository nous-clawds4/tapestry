/**
 * Event-tagging read API (event-tagging epic, ADR 0004). Read-only, local relay.
 *
 * GET /api/event-tags/for-event?eventId=<hex> | ?address=<kind:author:d>
 *     [&wotPov=house|user&userPubkey=<hex>] [&authorities=<csv of 64-hex>]
 *   Returns the tags applied to the target event, POV-filtered, with a 3-state
 *   classification: counted (grouped tags w/ applications/disputes), illegitimate
 *   (excluded), and unverifiable (header not locally resolvable — surfaced).
 *
 * GET /api/event-tags/headers-for-tag?tagAuthor=<hex>&slug=<slug> [&authorities=<csv>]
 *   The per-tag tagging header(s) that exist for a tag — so a writer can decide
 *   whether one must be created. Empty when none.
 *
 * SOVEREIGNTY: `authorities` (which tagging-with-specific-tag namespaces define a
 * legitimate header) is a REQUEST PARAMETER, defaulting to the canonical + this
 * deployment's runtime TA — never a single hardcoded gate. The candidate scan
 * keys on the target (#e/#a), which is namespace-agnostic.
 *
 * Applicable/available tags reuse the existing GET /api/profile-tags/available-tags
 * (same shared `tag` concept) — no endpoint is added here.
 */

const { exec } = require('child_process');
const core = require('../../lib/event-tagging');
const { resolvePov } = require('../_shared/pov');
const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');

// ADR-0015 legacy literal — used ONLY as a DEFAULT honored authority (overridable
// via ?authorities=), not as a hardcoded gate. See ADR 0004 "sovereignty".
const CANONICAL_AUTHORITY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';
const DESCRIPTOR_RE = /^39999:[0-9a-f]{64}:tagging:.+-tagging$/;

function isHexPubkey(v) { return typeof v === 'string' && /^[0-9a-f]{64}$/.test(v); }
function isACoord(v) { return typeof v === 'string' && /^\d+:[0-9a-f]{64}:.+$/.test(v); }
function dTagOf(ev) { const t = (ev.tags || []).find((x) => x[0] === 'd'); return t ? t[1] : null; }

function strfryScan(filter) {
  return new Promise((resolve, reject) => {
    const safeFilter = JSON.stringify(filter).replace(/'/g, "'\\''");
    exec(`strfry scan '${safeFilter}'`, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      const events = [];
      for (const line of stdout.split('\n')) { if (!line) continue; try { events.push(JSON.parse(line)); } catch {} }
      resolve(events);
    });
  });
}

// Latest-wins per (author, d-tag) — replaceable-event semantics (mirrors profile-tags).
function dedupeReplaceable(events) {
  const byKey = new Map();
  for (const ev of events) {
    const key = `${ev.pubkey}|${dTagOf(ev) || ev.id}`;
    const existing = byKey.get(key);
    if (!existing || ev.created_at > existing.created_at) byKey.set(key, ev);
  }
  return Array.from(byKey.values());
}

async function meiliFetchProfilesByPubkey(pubkeys) {
  const out = new Map();
  const unique = Array.from(new Set(pubkeys || []));
  const CHUNK = 100;
  for (let i = 0; i < unique.length; i += CHUNK) {
    await Promise.all(unique.slice(i, i + CHUNK).map(async (pk) => {
      try {
        const r = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/documents/${pk}`);
        if (r.ok) { const doc = await r.json(); if (doc && (doc.id || doc.pubkey)) out.set(pk, doc); }
      } catch { /* tolerate Meili unreachable in dev */ }
    }));
  }
  return out;
}

/** Honored legitimacy authorities: ?authorities= override, else [canonical, runtime TA]. */
function resolveAuthorities(req) {
  const raw = typeof req.query.authorities === 'string' ? req.query.authorities.trim() : '';
  if (raw) {
    const list = raw.split(',').map((s) => s.trim().toLowerCase()).filter(isHexPubkey);
    if (list.length) return Array.from(new Set(list));
  }
  const localTA = getOwnerAssistantPubkey();
  return Array.from(new Set([CANONICAL_AUTHORITY, ...(isHexPubkey(localTA) ? [localTA] : [])]));
}

/** Build the POV trust predicate from wotPov/userPubkey (mirrors profile-tags). */
async function buildTrustPredicate(req, candidatePubkeys) {
  const { povSuffix, minRank } = resolvePov({
    wotPov: req.query.wotPov || 'house',
    userPubkey: req.query.userPubkey || null,
  });
  const wotFiltering = !!povSuffix && Number.isFinite(minRank);
  if (!wotFiltering) return { isAsserterTrusted: () => true, povSuffix: povSuffix || null, minRank: null };
  const docs = await meiliFetchProfilesByPubkey(candidatePubkeys);
  const rankField = `wot_rank_${povSuffix}`;
  const isAsserterTrusted = (pk) => {
    const doc = docs.get(pk);
    if (!doc) return false;
    const r = doc[rankField];
    return typeof r === 'number' && r >= minRank;
  };
  return { isAsserterTrusted, povSuffix, minRank };
}

async function handleForEvent(req, res) {
  try {
    const eventId = typeof req.query.eventId === 'string' ? req.query.eventId.trim() : '';
    const address = typeof req.query.address === 'string' ? req.query.address.trim() : '';
    let target;
    if (eventId && address) return res.status(400).json({ success: false, error: 'Provide eventId OR address, not both.' });
    if (eventId) {
      if (!isHexPubkey(eventId)) return res.status(400).json({ success: false, error: 'eventId must be a 64-char hex event id.' });
      target = { id: eventId };
    } else if (address) {
      if (!isACoord(address)) return res.status(400).json({ success: false, error: 'address must be an a-coordinate <kind>:<author>:<d>.' });
      target = { address };
    } else {
      return res.status(400).json({ success: false, error: 'Provide a target: eventId or address.' });
    }

    const authorities = resolveAuthorities(req);

    // 1. Namespace-agnostic candidate scan, keyed on the target (#e / #a).
    const candidates = dedupeReplaceable(await strfryScan(core.filterTagsAppliedToEvent({ target })));

    // 2. Resolve each DISTINCT descriptor header once.
    const descriptors = new Set();
    for (const c of candidates) {
      for (const t of c.tags || []) if (t[0] === 'z' && DESCRIPTOR_RE.test(t[1] || '')) descriptors.add(t[1]);
    }
    const headers = [];
    for (const coord of descriptors) {
      const m = /^39999:([0-9a-f]{64}):(.+)$/.exec(coord);
      if (!m) continue;
      headers.push(...await strfryScan({ kinds: [39999], authors: [m[1]], '#d': [m[2]] }));
    }
    const dedupedHeaders = dedupeReplaceable(headers);

    // 3. POV trust predicate, then classify. `viewerPubkey` (hex-validated;
    //    malformed → absent) surfaces the viewer's OWN stance in `mine`,
    //    trust-unfiltered, without affecting the counted `tags` (ADR 0007).
    const viewerPubkey = isHexPubkey(req.query.viewerPubkey) ? req.query.viewerPubkey : undefined;
    const { isAsserterTrusted, povSuffix, minRank } = await buildTrustPredicate(req, candidates.map((c) => c.pubkey));
    const { tags, unverifiable, mine } = core.classifyEventTaggings({
      candidates, headers: dedupedHeaders, honoredAuthorities: authorities, isAsserterTrusted, viewerPubkey,
    });

    return res.json({ success: true, target, povSuffix, minRank, authorities, tags, unverifiable, mine });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function handleHeadersForTag(req, res) {
  try {
    const tagAuthor = typeof req.query.tagAuthor === 'string' ? req.query.tagAuthor.trim() : '';
    const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
    if (!isHexPubkey(tagAuthor)) return res.status(400).json({ success: false, error: 'tagAuthor must be a 64-char hex pubkey.' });
    if (!slug) return res.status(400).json({ success: false, error: 'slug is required.' });

    const authorities = resolveAuthorities(req);
    const found = [];
    for (const authority of authorities) {
      const filter = core.filterTaggingHeadersForTag({ tagAuthorPubkey: tagAuthor, slug, taPubkey: authority });
      found.push(...await strfryScan(filter));
    }
    const headers = dedupeReplaceable(found).map((h) => ({
      author: h.pubkey,
      headerCoord: `39999:${h.pubkey}:${dTagOf(h)}`,
      eventId: h.id,
    }));
    return res.json({ success: true, tagAuthor, slug, authorities, headers });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleForEvent, handleHeadersForTag };
