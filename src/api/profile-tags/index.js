/**
 * Profile Tags API.
 *
 * GET /api/profile-tags/available-tags
 *   List tag elements (kind 39999 z-tagged to the firmware tag concept)
 *   from local strfry. Returns { success, tags: [{ eventId, slug, name, description }] }.
 *
 * GET /api/profile-tags/tags-for-profile?pubkey=<hex>
 *   List nostr-user-tag assertions on a target pubkey from local strfry.
 *   Returns { success, applications: [...], disputes: [...] }, where polarity
 *   comes from the ["polarity", ...] event-tag (default 1 / applied if absent).
 *
 * GET /api/profile-tags/wot-tags?viewer=<hex>
 *   Returns the union of tagEventIds referenced by nostr-user-tag assertions
 *   on local strfry. Currently does not filter by the viewer's WoT — returns
 *   every tagEventId referenced by any assertion on the relay.
 *
 * Polarity is read from the ["polarity", ...] event-tag and bucketed:
 *   >=  0.5 → applied
 *   <= -0.5 → disputed
 *   in between → neutral (dropped, not counted in either list)
 * Absent polarity tag defaults to 1 (applied).
 */

const { exec } = require('child_process');

const TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const TAG_Z_TAG = `39998:${TA_PUBKEY}:tag`;
const NOSTR_USER_TAG_Z_TAG = `39998:${TA_PUBKEY}:nostr-user-tag`;
const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';

function isHexPubkey(v) {
  return typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
}

function strfryScan(filter) {
  return new Promise((resolve, reject) => {
    const safeFilter = JSON.stringify(filter).replace(/'/g, "'\\''");
    const cmd = `strfry scan '${safeFilter}'`;
    exec(cmd, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      const events = [];
      for (const line of stdout.split('\n')) {
        if (!line) continue;
        try { events.push(JSON.parse(line)); } catch {}
      }
      resolve(events);
    });
  });
}

function readPolarity(event) {
  const t = (event.tags || []).find((x) => x[0] === 'polarity');
  if (!t || t[1] == null) return 1;
  const n = Number(t[1]);
  return Number.isFinite(n) ? n : 1;
}

function bucketize(polarity) {
  if (polarity >= 0.5) return 'apply';
  if (polarity <= -0.5) return 'dispute';
  return 'neutral';
}

function dTagOf(event) {
  const t = (event.tags || []).find((x) => x[0] === 'd');
  return t ? t[1] : null;
}

// Keep only the latest event per (author, d-tag) pair to enforce
// replaceable-event semantics defensively, in case strfry's index returns
// duplicates for any reason.
function dedupeReplaceable(events) {
  const byKey = new Map();
  for (const ev of events) {
    const d = dTagOf(ev);
    const key = `${ev.pubkey}|${d || ev.id}`;
    const existing = byKey.get(key);
    if (!existing || ev.created_at > existing.created_at) {
      byKey.set(key, ev);
    }
  }
  return Array.from(byKey.values());
}

async function handleAvailableTags(req, res) {
  try {
    const events = await strfryScan({
      kinds: [39999],
      '#z': [TAG_Z_TAG],
    });

    const deduped = dedupeReplaceable(events);
    const tags = [];
    for (const ev of deduped) {
      // Firmware-published list elements carry their JSON payload in a
      // ["json", ...] event-tag; user-published events conventionally use
      // event.content. Accept either.
      const jsonTag = (ev.tags || []).find((t) => t[0] === 'json');
      const raw = (jsonTag && jsonTag[1]) || ev.content;
      if (!raw) continue;
      let parsed;
      try { parsed = JSON.parse(raw); } catch { continue; }
      const t = parsed?.tag;
      if (!t || !t.slug) continue;
      tags.push({
        eventId: ev.id,
        slug: t.slug,
        name: t.name || t.slug,
        description: t.description || '',
      });
    }
    tags.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ success: true, tags, count: tags.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function handleTagsForProfile(req, res) {
  const { pubkey } = req.query;
  if (!pubkey || !isHexPubkey(pubkey)) {
    return res.status(400).json({
      success: false,
      error: 'pubkey is required (64-char lowercase hex)',
    });
  }

  try {
    const events = await strfryScan({
      kinds: [39999],
      '#z': [NOSTR_USER_TAG_Z_TAG],
      '#p': [pubkey],
    });

    const deduped = dedupeReplaceable(events);
    const applications = [];
    const disputes = [];
    for (const ev of deduped) {
      const eTag = (ev.tags || []).find((t) => t[0] === 'e');
      const tagEventId = eTag ? eTag[1] : null;
      if (!tagEventId) continue;

      const polarity = readPolarity(ev);
      const bucket = bucketize(polarity);
      const entry = {
        eventId: ev.id,
        authorPubkey: ev.pubkey,
        tagEventId,
        polarity,
        createdAt: ev.created_at,
      };
      if (bucket === 'apply') applications.push(entry);
      else if (bucket === 'dispute') disputes.push(entry);
      // neutral polarity (between -0.5 and 0.5) is intentionally dropped
    }

    res.json({ success: true, pubkey, applications, disputes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function handleWotTags(req, res) {
  const { viewer } = req.query;
  if (!viewer || !isHexPubkey(viewer)) {
    return res.status(400).json({
      success: false,
      error: 'viewer is required (64-char lowercase hex)',
    });
  }

  try {
    const events = await strfryScan({
      kinds: [39999],
      '#z': [NOSTR_USER_TAG_Z_TAG],
    });
    const deduped = dedupeReplaceable(events);
    const tagEventIds = new Set();
    for (const ev of deduped) {
      const eTag = (ev.tags || []).find((t) => t[0] === 'e');
      if (eTag && eTag[1]) tagEventIds.add(eTag[1]);
    }

    res.json({
      success: true,
      viewer,
      tagEventIds: Array.from(tagEventIds),
      count: tagEventIds.size,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Find tag-element events whose tag.name contains `query` as a case-insensitive
 * substring. Returns minimal metadata for each match.
 */
async function findTagsByNameSubstring(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim().toLowerCase();
  const events = await strfryScan({ kinds: [39999], '#z': [TAG_Z_TAG] });
  const deduped = dedupeReplaceable(events);
  const out = [];
  for (const ev of deduped) {
    const jsonTag = (ev.tags || []).find((t) => t[0] === 'json');
    const raw = (jsonTag && jsonTag[1]) || ev.content;
    if (!raw) continue;
    let parsed;
    try { parsed = JSON.parse(raw); } catch { continue; }
    const t = parsed?.tag;
    if (!t || !t.slug) continue;
    const name = t.name || t.slug;
    if (!name.toLowerCase().includes(q)) continue;
    out.push({ eventId: ev.id, slug: t.slug, name, description: t.description || '' });
  }
  return out;
}

/**
 * Fetch profile docs from Meilisearch by primary key. Returns a Map of
 * pubkey → document; pubkeys with no Meili doc are absent from the map.
 *
 * Uses per-key GETs (`GET /indexes/profiles/documents/<pubkey>`), batched
 * into chunks of `CHUNK` concurrent requests. Filter-based bulk fetch is
 * not used because the `id` field is not declared filterable on the index.
 */
async function meiliFetchProfilesByPubkey(pubkeys) {
  const out = new Map();
  if (!pubkeys || pubkeys.length === 0) return out;
  const unique = Array.from(new Set(pubkeys));
  const CHUNK = 100;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const batch = unique.slice(i, i + CHUNK);
    await Promise.all(
      batch.map(async (pk) => {
        try {
          const r = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/documents/${pk}`);
          if (r.ok) {
            const doc = await r.json();
            if (doc && (doc.id || doc.pubkey)) out.set(pk, doc);
          }
        } catch {
          /* tolerate Meili unreachable in dev */
        }
      })
    );
  }
  return out;
}

/**
 * Pure tag-match computation. For each tag whose name contains `q` as a
 * case-insensitive substring, enumerate positive-polarity assertions from
 * local strfry. If `povSuffix` AND a finite `minRank` are provided, filter
 * assertions to authors whose `wot_rank_<povSuffix>` >= `minRank` (looked
 * up against Meili profile docs). Otherwise (no POV configured) all
 * positive assertions count.
 *
 * Exposed via `GET /api/profile-tags/match` (handleMatch) for direct
 * callers, and consumed in-process by the meili search proxy.
 *
 * @param {object} opts
 * @param {string} opts.q                Search query
 * @param {string|null} opts.povSuffix   8-char POV suffix, or null/empty for no WoT filter
 * @param {number|null} opts.minRank     Min `wot_rank_<suffix>` to count, or null/NaN for no filter
 * @returns {Promise<{query, povSuffix, minRank, matches: Array<{pubkey, matchedTags}>}>}
 */
async function computeTagMatches({ q, povSuffix, minRank }) {
  if (!q || !q.trim()) {
    return { query: '', povSuffix: povSuffix || null, minRank: null, matches: [] };
  }
  const suffix = (povSuffix && /^[0-9a-f]{8}$/.test(povSuffix)) ? povSuffix : null;
  const minRankN = (suffix && Number.isFinite(Number(minRank))) ? Number(minRank) : null;
  const wotFiltering = suffix && Number.isFinite(minRankN);

  const tagMatches = await findTagsByNameSubstring(q);
  if (tagMatches.length === 0) {
    return { query: q, povSuffix: suffix, minRank: minRankN, matches: [] };
  }
  const tagById = new Map(tagMatches.map((t) => [t.eventId, t]));

  const assertionEvents = await strfryScan({
    kinds: [39999],
    '#z': [NOSTR_USER_TAG_Z_TAG],
    '#e': tagMatches.map((t) => t.eventId),
  });
  const deduped = dedupeReplaceable(assertionEvents);
  const positive = deduped.filter((ev) => bucketize(readPolarity(ev)) === 'apply');

  let authorAllowed = () => true;
  if (wotFiltering) {
    const authorPubkeys = Array.from(new Set(positive.map((ev) => ev.pubkey)));
    const authorDocs = await meiliFetchProfilesByPubkey(authorPubkeys);
    const rankField = `wot_rank_${suffix}`;
    authorAllowed = (authorPk) => {
      const doc = authorDocs.get(authorPk);
      if (!doc) return false;
      const r = doc[rankField];
      return typeof r === 'number' && r >= minRankN;
    };
  }

  const byTarget = new Map();
  for (const ev of positive) {
    if (!authorAllowed(ev.pubkey)) continue;
    const pTag = (ev.tags || []).find((t) => t[0] === 'p');
    const eTag = (ev.tags || []).find((t) => t[0] === 'e');
    if (!pTag?.[1] || !eTag?.[1]) continue;
    const targetPk = pTag[1];
    const tagInfo = tagById.get(eTag[1]);
    if (!tagInfo) continue;
    let entry = byTarget.get(targetPk);
    if (!entry) {
      entry = { pubkey: targetPk, matchedTags: new Map() };
      byTarget.set(targetPk, entry);
    }
    const prev = entry.matchedTags.get(tagInfo.eventId) || { ...tagInfo, count: 0 };
    prev.count += 1;
    entry.matchedTags.set(tagInfo.eventId, prev);
  }

  const matches = Array.from(byTarget.values()).map((m) => ({
    pubkey: m.pubkey,
    matchedTags: Array.from(m.matchedTags.values()),
  }));

  return { query: q, povSuffix: suffix, minRank: minRankN, matches };
}

async function handleMatch(req, res) {
  try {
    const result = await computeTagMatches({
      q: req.query.q,
      povSuffix: req.query.povSuffix,
      minRank: req.query.minRank,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

function registerProfileTagsRoutes(app) {
  app.get('/api/profile-tags/available-tags', handleAvailableTags);
  app.get('/api/profile-tags/tags-for-profile', handleTagsForProfile);
  app.get('/api/profile-tags/wot-tags', handleWotTags);
  app.get('/api/profile-tags/match', handleMatch);
}

module.exports = {
  handleAvailableTags,
  handleTagsForProfile,
  handleWotTags,
  handleMatch,
  computeTagMatches,
  meiliFetchProfilesByPubkey,
  registerProfileTagsRoutes,
};
