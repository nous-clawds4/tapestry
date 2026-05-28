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
const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
const { getViewerWriteRelays } = require('../_shared/userRelays');

/**
 * Legacy z-tag-composition pubkey — see ADR 0015.
 *
 * Historical kind-39999 events on every Brainstorm/Tapestry
 * deployment have z-tags composed with this literal value,
 * including events that pre-date any deployment realizing the
 * literal didn't match the on-disk TA. The literal is wire-binding:
 * changing it orphans historical data on non-dev deployments
 * (this is exactly the d3a2640a / "lost tags" incident).
 *
 * This constant is used ONLY for z-tag composition. For any other
 * use of "the TA pubkey" (signer reads, kind-30392 author
 * filtering, signing operations), use the runtime `TA_PUBKEY`
 * constant below — it resolves via `getOwnerAssistantPubkey()`
 * per CLAUDE.md "Per-deployment TA pubkey".
 *
 * See ADR 0015
 * (engineering-team/decisions/0015-restore-historical-data-and-fix-tl-author-filter.md)
 * and engineering-team/stories/16-runtime-ta-pubkey-migration.md
 * for the incident history that produced this exception.
 */
const LEGACY_Z_TAG_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';

// Runtime TA pubkey — used for kind-30392 author filtering (TLs
// signed by the on-disk TA key). NEVER substitute the legacy
// literal here; the bug we're fixing is exactly that mismatch.
// For z-tag composition, see LEGACY_Z_TAG_PUBKEY above.
const TA_PUBKEY = getOwnerAssistantPubkey();
if (!TA_PUBKEY) {
  console.warn('[profile-tags] TA pubkey not resolved at module load — pin/TL features will be broken until keys are provisioned');
}
const TAG_Z_TAG = `39998:${LEGACY_Z_TAG_PUBKEY}:tag`;
const NOSTR_USER_TAG_Z_TAG = `39998:${LEGACY_Z_TAG_PUBKEY}:nostr-user-tag`;
const TAG_PINNING_Z_TAG = `39998:${LEGACY_Z_TAG_PUBKEY}:tag-pinning`;
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
    // POV resolution per ADR-0006: optional wotPov + userPubkey query params.
    // When a POV is configured, the WoT filter keeps only assertions whose
    // author has wot_rank_<suffix> >= minRank. When no POV is configured,
    // the filter is a no-op (backward-compat).
    const { resolvePov } = require('../_shared/pov');
    const { povSuffix, minRank } = resolvePov({
      wotPov: req.query.wotPov || 'house',
      userPubkey: req.query.userPubkey || null,
    });
    const wotFiltering = !!povSuffix && Number.isFinite(minRank);

    const events = await strfryScan({
      kinds: [39999],
      '#z': [NOSTR_USER_TAG_Z_TAG],
      '#p': [pubkey],
    });

    const deduped = dedupeReplaceable(events);

    let authorAllowed = () => true;
    if (wotFiltering) {
      const authorPubkeys = Array.from(new Set(deduped.map((ev) => ev.pubkey)));
      const authorDocs = await meiliFetchProfilesByPubkey(authorPubkeys);
      const rankField = `wot_rank_${povSuffix}`;
      authorAllowed = (authorPk) => {
        const doc = authorDocs.get(authorPk);
        if (!doc) return false;
        const r = doc[rankField];
        return typeof r === 'number' && r >= minRank;
      };
    }

    const applications = [];
    const disputes = [];
    for (const ev of deduped) {
      if (!authorAllowed(ev.pubkey)) continue;
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

    res.json({
      success: true,
      pubkey,
      povSuffix: povSuffix || null,
      minRank: Number.isFinite(minRank) ? minRank : null,
      applications,
      disputes,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function handleWotTags(req, res) {
  // POV-param contract per ADR-0006. The legacy `viewer` query param is
  // replaced by the standard wotPov + userPubkey pair used by the rest of
  // the read stack. Endpoint has no current consumers; the swap is for
  // symmetry with the other POV-aware endpoints.
  try {
    const { resolvePov } = require('../_shared/pov');
    const { povSuffix, minRank } = resolvePov({
      wotPov: req.query.wotPov || 'house',
      userPubkey: req.query.userPubkey || null,
    });
    const wotFiltering = !!povSuffix && Number.isFinite(minRank);

    const events = await strfryScan({
      kinds: [39999],
      '#z': [NOSTR_USER_TAG_Z_TAG],
    });
    const deduped = dedupeReplaceable(events);

    let authorAllowed = () => true;
    if (wotFiltering) {
      const authorPubkeys = Array.from(new Set(deduped.map((ev) => ev.pubkey)));
      const authorDocs = await meiliFetchProfilesByPubkey(authorPubkeys);
      const rankField = `wot_rank_${povSuffix}`;
      authorAllowed = (authorPk) => {
        const doc = authorDocs.get(authorPk);
        if (!doc) return false;
        const r = doc[rankField];
        return typeof r === 'number' && r >= minRank;
      };
    }

    const tagEventIds = new Set();
    for (const ev of deduped) {
      if (!authorAllowed(ev.pubkey)) continue;
      const eTag = (ev.tags || []).find((t) => t[0] === 'e');
      if (eTag && eTag[1]) tagEventIds.add(eTag[1]);
    }

    res.json({
      success: true,
      povSuffix: povSuffix || null,
      minRank: Number.isFinite(minRank) ? minRank : null,
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

/**
 * Parse the tag JSON payload from a kind-39999 tag-element event. Firmware
 * elements carry the payload in a ["json", ...] event-tag; client-published
 * elements may use event.content. Accept either; return null when neither
 * carries a parseable {tag: {slug, ...}} payload.
 */
function parseTagPayload(ev) {
  const jsonTag = (ev.tags || []).find((t) => t[0] === 'json');
  const raw = (jsonTag && jsonTag[1]) || ev.content;
  if (!raw) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return null; }
  const t = parsed?.tag;
  if (!t || !t.slug) return null;
  return t;
}

/**
 * Extract the curation-method JSON payload from a Pin event (ADR 0009).
 * Prefers the `curation-method` event-tag (which Story 12's TA cron will
 * index against); falls back to `content.tagPinning.curationMethod`.
 */
function parseCurationMethod(ev) {
  const cmTag = (ev.tags || []).find((t) => t[0] === 'curation-method');
  if (cmTag && cmTag[1]) {
    try { return JSON.parse(cmTag[1]); } catch { /* fall through */ }
  }
  if (ev.content) {
    try {
      const parsed = JSON.parse(ev.content);
      const cm = parsed?.tagPinning?.curationMethod;
      if (cm && typeof cm === 'object') return cm;
    } catch { /* ignore */ }
  }
  return null;
}

/**
 * Extract the pinned tag's event id from a Pin event. Prefers the `e` tag;
 * falls back to `content.tagPinning.tagEventId`.
 */
function parsePinTagEventId(ev) {
  const eTag = (ev.tags || []).find((t) => t[0] === 'e');
  if (eTag && eTag[1] && /^[0-9a-f]{64}$/.test(eTag[1])) return eTag[1];
  if (ev.content) {
    try {
      const parsed = JSON.parse(ev.content);
      const id = parsed?.tagPinning?.tagEventId;
      if (typeof id === 'string' && /^[0-9a-f]{64}$/.test(id)) return id;
    } catch { /* ignore */ }
  }
  return null;
}

/**
 * ADR 0010: pure aggregator for per-target endorsement/dispute counts on a
 * tag, under an active POV's WoT-author filter. Shared by handleProfilesTagged
 * (Story 3) and Story-11's refreshPinnedTags membership compute.
 *
 * Returns:
 *   - byTarget: Map<targetPubkey, { pubkey, applications, disputes }>
 *   - deduped: the replaceable-collapsed scan, so callers (handleProfilesTagged)
 *     can reuse it for the viewer-union pre-pass without re-scanning strfry.
 *   - wotFiltering: boolean indicating whether the WoT-author filter was applied.
 *
 * No response-shape enrichment (no displayName/picture, no sort, no viewer-union)
 * — that's the caller's job.
 */
async function aggregateProfilesTagged({ tagEventId, povSuffix, minRank }) {
  const wotFiltering = !!povSuffix && Number.isFinite(minRank);

  const events = await strfryScan({
    kinds: [39999],
    '#z': [NOSTR_USER_TAG_Z_TAG],
    '#e': [tagEventId],
  });
  const deduped = dedupeReplaceable(events);

  let authorAllowed = () => true;
  if (wotFiltering) {
    const authorPubkeys = Array.from(new Set(deduped.map((ev) => ev.pubkey)));
    const authorDocs = await meiliFetchProfilesByPubkey(authorPubkeys);
    const rankField = `wot_rank_${povSuffix}`;
    authorAllowed = (authorPk) => {
      const doc = authorDocs.get(authorPk);
      if (!doc) return false;
      const r = doc[rankField];
      return typeof r === 'number' && r >= minRank;
    };
  }

  const byTarget = new Map();
  for (const ev of deduped) {
    if (!authorAllowed(ev.pubkey)) continue;
    const pTag = (ev.tags || []).find((t) => t[0] === 'p');
    if (!pTag?.[1]) continue;
    const polarity = readPolarity(ev);
    const bucket = bucketize(polarity);
    if (bucket === 'neutral') continue;

    const targetPk = pTag[1];
    let entry = byTarget.get(targetPk);
    if (!entry) {
      entry = { pubkey: targetPk, applications: 0, disputes: 0 };
      byTarget.set(targetPk, entry);
    }
    if (bucket === 'apply') entry.applications += 1;
    else if (bucket === 'dispute') entry.disputes += 1;
  }

  return { byTarget, deduped, wotFiltering };
}

/**
 * ADR 0012: pure aggregator for per-tag pin counts under an active POV's
 * WoT-author filter, plus the viewer's own-pin set. Mirrors the shape of
 * aggregateProfilesTagged but groups pins by referenced tagEventId.
 *
 * Returns:
 *   - pinCountByTagEventId: Map<tagEventId, number> — distinct WoT-trusted
 *     authors who have published a Pin event for that tag.
 *   - viewerPinnedSet: Set<tagEventId> — tags the viewer has personally
 *     pinned (independent of the WoT filter; per-viewer, not per-POV).
 *
 * Dedupe: dedupeReplaceable collapses pin events by (author, d-tag), so
 * one surviving event per (author, tag) means the count equals "distinct
 * WoT-trusted pinners" automatically.
 */
async function aggregateTagPins({ povSuffix, minRank, viewerPubkey }) {
  const wotFiltering = !!povSuffix && Number.isFinite(minRank);

  const pinEvents = await strfryScan({
    kinds: [39999],
    '#z': [TAG_PINNING_Z_TAG],
  });
  const deduped = dedupeReplaceable(pinEvents);

  let authorAllowed = () => true;
  if (wotFiltering) {
    const authorPubkeys = Array.from(new Set(deduped.map((ev) => ev.pubkey)));
    const authorDocs = await meiliFetchProfilesByPubkey(authorPubkeys);
    const rankField = `wot_rank_${povSuffix}`;
    authorAllowed = (authorPk) => {
      const doc = authorDocs.get(authorPk);
      if (!doc) return false;
      const r = doc[rankField];
      return typeof r === 'number' && r >= minRank;
    };
  }

  const pinCountByTagEventId = new Map();
  const viewerPinnedSet = new Set();
  for (const ev of deduped) {
    const tagEventId = parsePinTagEventId(ev);
    if (!tagEventId) continue;
    // Own-pin indicator is per-viewer, not per-POV. The viewer's own pin
    // counts toward viewerPinnedSet regardless of the WoT filter on this
    // request's POV.
    if (viewerPubkey && ev.pubkey === viewerPubkey) {
      viewerPinnedSet.add(tagEventId);
    }
    if (!authorAllowed(ev.pubkey)) continue;
    pinCountByTagEventId.set(
      tagEventId,
      (pinCountByTagEventId.get(tagEventId) || 0) + 1
    );
  }

  return { pinCountByTagEventId, viewerPinnedSet };
}

/**
 * GET /api/profile-tags/by-id?tagEventId=<id>
 *
 * Fetch a single kind-39999 tag-element by event id. Returns the tag's
 * slug/name/description/authorPubkey/createdAt plus an enriched author
 * block ({displayName, picture}) when the author has a Meili profile doc.
 * Author degrades to null when Meili lacks the doc; degrades to null when
 * Meili is unreachable (does not fail the whole request).
 */
async function handleTagById(req, res) {
  const { tagEventId, viewerPubkey } = req.query;
  if (!tagEventId || !/^[0-9a-f]{64}$/.test(tagEventId)) {
    return res.status(400).json({
      success: false,
      error: 'tagEventId is required (64-char lowercase hex)',
    });
  }
  try {
    const events = await strfryScan({ kinds: [39999], ids: [tagEventId] });
    if (events.length === 0) {
      return res.status(404).json({ success: false, error: 'tag not found' });
    }
    const ev = events[0];
    const tagPayload = parseTagPayload(ev);
    if (!tagPayload) {
      return res.status(404).json({ success: false, error: 'tag payload malformed' });
    }

    let author = null;
    try {
      const docs = await meiliFetchProfilesByPubkey([ev.pubkey]);
      const doc = docs.get(ev.pubkey);
      if (doc) {
        author = {
          displayName: doc.display_name || doc.name || null,
          picture: doc.picture || null,
        };
      }
    } catch { /* meili unreachable → author stays null */ }

    // ADR 0009: optional viewerPubkey threads a `viewerPin` field onto the
    // response. Malformed viewerPubkey is silently treated as absent (read
    // contract preserved for clients that send junk).
    let viewerPin = null;
    if (isHexPubkey(viewerPubkey)) {
      try {
        const pinEvents = await strfryScan({
          kinds: [39999],
          '#z': [TAG_PINNING_Z_TAG],
          authors: [viewerPubkey],
          '#e': [tagEventId],
        });
        const survivor = dedupeReplaceable(pinEvents)[0] || null;
        if (survivor) {
          viewerPin = {
            pinEventId: survivor.id,
            createdAt: survivor.created_at,
            curationMethod: parseCurationMethod(survivor),
          };
        }
      } catch { /* strfry failure on the pin scan must not break the read */ }
    }

    res.json({
      success: true,
      tag: {
        eventId: ev.id,
        slug: tagPayload.slug,
        name: tagPayload.name || tagPayload.slug,
        description: tagPayload.description || '',
        authorPubkey: ev.pubkey,
        createdAt: ev.created_at,
      },
      author,
      viewerPin,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

const PROFILES_TAGGED_VALID_SORTS = ['applied', 'disputed', 'divisive'];

const PROFILES_TAGGED_SORTERS = {
  applied: (a, b) =>
    (b.applications - a.applications)
    || (b.disputes - a.disputes)
    || a.pubkey.localeCompare(b.pubkey),
  disputed: (a, b) =>
    (b.disputes - a.disputes)
    || (b.applications - a.applications)
    || a.pubkey.localeCompare(b.pubkey),
  divisive: (a, b) =>
    (Math.min(b.applications, b.disputes) - Math.min(a.applications, a.disputes))
    || ((b.applications + b.disputes) - (a.applications + a.disputes))
    || a.pubkey.localeCompare(b.pubkey),
};

/**
 * GET /api/profile-tags/profiles-tagged
 *   ?tagEventId=<id>
 *   &wotPov=<house|user>
 *   &userPubkey=<hex>
 *   &sort=<applied|disputed|divisive>
 *
 * Aggregates per-target application/dispute counts for the tag, filtered to
 * authors who pass the active POV's WoT threshold (wot_rank_<suffix> >=
 * minRank). When no POV is configured (suffix or minRank null), all bucketed
 * assertions count — same fallback as computeTagMatches.
 *
 * Counts are derived per-request from raw assertions (CLAUDE.md "filter at
 * view time, not write time"). No persistent per-POV aggregate column.
 *
 * Sort is server-side so the contract is correct from day one and pagination
 * (Story 4 follow-up) drops in cleanly without partial-set sort risk.
 */
async function handleProfilesTagged(req, res) {
  const { tagEventId } = req.query;
  const sort = req.query.sort || 'applied';

  if (!tagEventId || !/^[0-9a-f]{64}$/.test(tagEventId)) {
    return res.status(400).json({
      success: false,
      error: 'tagEventId is required (64-char lowercase hex)',
    });
  }
  if (!PROFILES_TAGGED_VALID_SORTS.includes(sort)) {
    return res.status(400).json({
      success: false,
      error: `sort must be one of: ${PROFILES_TAGGED_VALID_SORTS.join(', ')}`,
    });
  }

  // Optional viewerPubkey for the viewer-union (Story 3 / ADR-0004). Malformed
  // values are silently treated as absent so a junk client value doesn't
  // break the read-only contract.
  const viewerPubkeyRaw = typeof req.query.viewerPubkey === 'string' ? req.query.viewerPubkey : '';
  const viewerPubkey = /^[0-9a-f]{64}$/.test(viewerPubkeyRaw) ? viewerPubkeyRaw : null;

  try {
    const { resolvePov } = require('../_shared/pov');
    const { povSuffix, minRank } = resolvePov({
      wotPov: req.query.wotPov || 'house',
      userPubkey: req.query.userPubkey || null,
    });

    // ADR 0010: extracted pure helper. Returns the per-target endorsement/
    // dispute aggregation under the active POV's WoT filter, plus the
    // deduped scan (so the viewer-union below can reuse it without a
    // second strfry round-trip).
    const { byTarget, deduped, wotFiltering } = await aggregateProfilesTagged({
      tagEventId, povSuffix, minRank,
    });

    // Viewer-union pre-pass: build a map of the viewer's per-target polarity
    // from the same scan, before the WoT filter runs (the viewer's own
    // assertion needn't pass the WoT filter — that's the whole point).
    const viewerAssertions = {};
    if (viewerPubkey) {
      for (const ev of deduped) {
        if (ev.pubkey !== viewerPubkey) continue;
        const pTag = (ev.tags || []).find((t) => t[0] === 'p');
        if (!pTag?.[1]) continue;
        const bucket = bucketize(readPolarity(ev));
        if (bucket === 'apply') viewerAssertions[pTag[1]] = 'applied';
        else if (bucket === 'dispute') viewerAssertions[pTag[1]] = 'disputed';
      }
    }

    // Viewer-union: ensure every target the viewer asserted on has a row,
    // even if the WoT filter excluded the viewer's author.
    for (const targetPk of Object.keys(viewerAssertions)) {
      if (!byTarget.has(targetPk)) {
        byTarget.set(targetPk, { pubkey: targetPk, applications: 0, disputes: 0 });
      }
    }

    // Enrich each row with target Meili doc (displayName, picture). Targets
    // without a Meili doc surface with both fields null.
    const targetPubkeys = Array.from(byTarget.keys());
    const targetDocs = await meiliFetchProfilesByPubkey(targetPubkeys);
    for (const entry of byTarget.values()) {
      const doc = targetDocs.get(entry.pubkey);
      entry.displayName = doc ? (doc.display_name || doc.name || null) : null;
      entry.picture = doc ? (doc.picture || null) : null;
      // Story 17 / ADR 0014 Decision 12 — passthrough fields that feed the
      // tag-detail page's client-side filter input. Always present so the
      // client can read unconditionally; values default to null.
      entry.nip05 = doc ? (doc.nip05 || null) : null;
      entry.about = doc ? (doc.about || null) : null;
      entry.website = doc ? (doc.website || null) : null;
      // onlyViewerVisible is true when the only thing making this row appear
      // is the viewer's own assertion (WoT-filtered counts are zero AND the
      // viewer has a non-neutral assertion on this target). Always present
      // (defaults to false) so the UI's row component can read it
      // unconditionally.
      entry.onlyViewerVisible = !!viewerAssertions[entry.pubkey]
        && entry.applications === 0 && entry.disputes === 0;
    }

    const rows = Array.from(byTarget.values());
    rows.sort(PROFILES_TAGGED_SORTERS[sort]);

    res.json({
      success: true,
      povSuffix: povSuffix || null,
      minRank: Number.isFinite(minRank) ? minRank : null,
      sort,
      viewerAssertions,
      rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

const TAG_INDEX_VALID_SORTS = ['used', 'endorsed', 'divisive', 'most-pinned'];

const TAG_INDEX_SORTERS = {
  used: (a, b) =>
    ((b.applications + b.disputes) - (a.applications + a.disputes))
    || a.tagEventId.localeCompare(b.tagEventId),
  endorsed: (a, b) =>
    (b.applications - a.applications)
    || (b.disputes - a.disputes)
    || a.tagEventId.localeCompare(b.tagEventId),
  divisive: (a, b) =>
    (Math.min(b.applications, b.disputes) - Math.min(a.applications, a.disputes))
    || ((b.applications + b.disputes) - (a.applications + a.disputes))
    || a.tagEventId.localeCompare(b.tagEventId),
  // ADR 0012 — sort by distinct WoT-trusted pinners desc, ties on tagEventId.
  'most-pinned': (a, b) =>
    ((b.pinnedCount || 0) - (a.pinnedCount || 0))
    || a.tagEventId.localeCompare(b.tagEventId),
};

/**
 * GET /api/profile-tags/index
 *   ?wotPov=<house|user>&userPubkey=<hex>
 *   &sort=<used|endorsed|divisive>
 *   &q=<substring>
 *   &limit=<int>&offset=<int>
 *
 * The tag-index endpoint (Story 4 / ADR-0003). Returns every tag with at
 * least one assertion authored by someone in the active POV's WoT, sorted
 * server-side, optionally narrowed by a case-insensitive substring on name
 * or description, and paginated via offset+limit. Counts are derived
 * per-request from raw assertions — no persistent per-POV aggregate
 * (CLAUDE.md "filter at view time, not write time").
 */
async function handleTagIndex(req, res) {
  const sort = req.query.sort || 'used';
  if (!TAG_INDEX_VALID_SORTS.includes(sort)) {
    return res.status(400).json({
      success: false,
      error: `sort must be one of: ${TAG_INDEX_VALID_SORTS.join(', ')}`,
    });
  }

  const limitRaw = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 50;
  const offsetRaw = parseInt(req.query.offset, 10);
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;
  const q = (typeof req.query.q === 'string' ? req.query.q : '').trim();
  const qLower = q.toLowerCase();

  // Optional "show only tags authored by this pubkey" filter — used by the
  // tag-index UI's "Only show mine" toggle. Silently ignored when malformed.
  const authoredByRaw = typeof req.query.authoredBy === 'string' ? req.query.authoredBy : '';
  const authoredBy = /^[0-9a-f]{64}$/.test(authoredByRaw) ? authoredByRaw : null;

  // ADR 0012 — pin-aware fields. viewerPubkey drives own-pin marking;
  // pinnedByMe narrows the listing to the viewer's pinned set. Malformed
  // viewerPubkey is silently treated as absent (matches the authoredBy
  // pattern). pinnedByMe is only honored when viewerPubkey is also valid.
  const viewerPubkeyRaw = typeof req.query.viewerPubkey === 'string' ? req.query.viewerPubkey : '';
  const viewerPubkey = /^[0-9a-f]{64}$/.test(viewerPubkeyRaw) ? viewerPubkeyRaw : null;
  const pinnedByMeRaw = typeof req.query.pinnedByMe === 'string' ? req.query.pinnedByMe : '';
  const pinnedByMe = pinnedByMeRaw === 'true' && !!viewerPubkey;

  try {
    const { resolvePov } = require('../_shared/pov');
    const { povSuffix, minRank } = resolvePov({
      wotPov: req.query.wotPov || 'house',
      userPubkey: req.query.userPubkey || null,
    });
    const wotFiltering = !!povSuffix && Number.isFinite(minRank);

    const assertions = await strfryScan({
      kinds: [39999],
      '#z': [NOSTR_USER_TAG_Z_TAG],
    });
    const deduped = dedupeReplaceable(assertions);

    let authorAllowed = () => true;
    if (wotFiltering) {
      const authorPubkeys = Array.from(new Set(deduped.map((ev) => ev.pubkey)));
      const authorDocs = await meiliFetchProfilesByPubkey(authorPubkeys);
      const rankField = `wot_rank_${povSuffix}`;
      authorAllowed = (authorPk) => {
        const doc = authorDocs.get(authorPk);
        if (!doc) return false;
        const r = doc[rankField];
        return typeof r === 'number' && r >= minRank;
      };
    }

    // Group surviving assertions by referenced tagEventId.
    const byTag = new Map();
    for (const ev of deduped) {
      if (!authorAllowed(ev.pubkey)) continue;
      const eTag = (ev.tags || []).find((t) => t[0] === 'e');
      if (!eTag?.[1]) continue;
      const polarity = readPolarity(ev);
      const bucket = bucketize(polarity);
      if (bucket === 'neutral') continue;

      const tagEventId = eTag[1];
      let entry = byTag.get(tagEventId);
      if (!entry) {
        entry = { tagEventId, applications: 0, disputes: 0 };
        byTag.set(tagEventId, entry);
      }
      if (bucket === 'apply') entry.applications += 1;
      else if (bucket === 'dispute') entry.disputes += 1;
    }

    // ADR 0012 — pin aggregation under the same POV's WoT-author filter,
    // plus the viewer's own-pin set. Union the result into byTag so tags
    // that have pins-but-no-assertions still appear in the listing.
    const { pinCountByTagEventId, viewerPinnedSet } = await aggregateTagPins({
      povSuffix, minRank, viewerPubkey,
    });
    for (const tagEventId of pinCountByTagEventId.keys()) {
      if (!byTag.has(tagEventId)) {
        byTag.set(tagEventId, { tagEventId, applications: 0, disputes: 0 });
      }
    }

    if (byTag.size === 0) {
      return res.json({
        success: true,
        povSuffix: povSuffix || null,
        minRank: Number.isFinite(minRank) ? minRank : null,
        sort,
        q,
        authoredBy: authoredBy || null,
        viewerPubkey: viewerPubkey || null,
        pinnedByMe,
        total: 0,
        limit,
        offset,
        rows: [],
      });
    }

    // Batch-scan tag-elements for every referenced tagEventId.
    const tagEventIds = Array.from(byTag.keys());
    const tagEvents = await strfryScan({ kinds: [39999], ids: tagEventIds });
    const tagByEventId = new Map();
    for (const ev of tagEvents) {
      const payload = parseTagPayload(ev);
      if (!payload) continue;
      tagByEventId.set(ev.id, { event: ev, payload });
    }

    // Combine counts + tag metadata. Drop tagEventIds whose tag-element isn't
    // locally available (assertions reference a tag we don't have).
    const enriched = [];
    for (const [tagEventId, counts] of byTag) {
      const tag = tagByEventId.get(tagEventId);
      if (!tag) continue;
      enriched.push({
        tagEventId,
        slug: tag.payload.slug,
        name: tag.payload.name || tag.payload.slug,
        description: tag.payload.description || '',
        authorPubkey: tag.event.pubkey,
        applications: counts.applications,
        disputes: counts.disputes,
        // ADR 0012 — pin-aware fields. Always present so the UI can read
        // them unconditionally. pinnedCount defaults to 0; viewerPinned
        // defaults to false (no viewer or viewer hasn't pinned).
        pinnedCount: pinCountByTagEventId.get(tagEventId) || 0,
        viewerPinned: viewerPinnedSet.has(tagEventId),
      });
    }

    // Apply q filter (case-insensitive substring on name or description).
    let filtered = qLower
      ? enriched.filter((r) => `${r.name} ${r.description}`.toLowerCase().includes(qLower))
      : enriched;
    // Apply authoredBy filter (exact pubkey match on tag-element signer).
    if (authoredBy) {
      filtered = filtered.filter((r) => r.authorPubkey === authoredBy);
    }
    // ADR 0012 — pinnedByMe filter: only rows the viewer has personally pinned.
    if (pinnedByMe) {
      filtered = filtered.filter((r) => r.viewerPinned);
    }

    filtered.sort(TAG_INDEX_SORTERS[sort]);
    const total = filtered.length;
    const slice = filtered.slice(offset, offset + limit);

    // Enrich each row with its tag-author's Meili profile doc.
    const authorPubkeys = Array.from(new Set(slice.map((r) => r.authorPubkey)));
    const authorDocs = await meiliFetchProfilesByPubkey(authorPubkeys);
    for (const row of slice) {
      const doc = authorDocs.get(row.authorPubkey);
      row.displayName = doc ? (doc.display_name || doc.name || null) : null;
      row.picture = doc ? (doc.picture || null) : null;
    }

    res.json({
      success: true,
      povSuffix: povSuffix || null,
      minRank: Number.isFinite(minRank) ? minRank : null,
      sort,
      q,
      authoredBy: authoredBy || null,
      viewerPubkey: viewerPubkey || null,
      pinnedByMe,
      total,
      limit,
      offset,
      rows: slice,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

const AUTHORED_BY_VALID_SORTS = ['recent', 'applied', 'disputed', 'most-backed', 'divisive'];

// "Most-backed" uses the polarity-matched peer count: applied rows compete
// on peerApplications, disputed rows compete on peerDisputes. Across the
// two polarities the same numeric key intermixes them naturally.
function backedKey(r) {
  return r.polarity === 'applied' ? r.peerApplications : r.peerDisputes;
}

const AUTHORED_BY_SORTERS = {
  recent: (a, b) =>
    (b.createdAt - a.createdAt)
    || a.assertionEventId.localeCompare(b.assertionEventId),
  applied: (a, b) =>
    (b.parentApplications - a.parentApplications)
    || (b.createdAt - a.createdAt)
    || a.assertionEventId.localeCompare(b.assertionEventId),
  disputed: (a, b) =>
    (b.parentDisputes - a.parentDisputes)
    || (b.createdAt - a.createdAt)
    || a.assertionEventId.localeCompare(b.assertionEventId),
  'most-backed': (a, b) =>
    (backedKey(b) - backedKey(a))
    || (b.createdAt - a.createdAt)
    || a.assertionEventId.localeCompare(b.assertionEventId),
  divisive: (a, b) =>
    (Math.min(b.parentApplications, b.parentDisputes) - Math.min(a.parentApplications, a.parentDisputes))
    || ((b.parentApplications + b.parentDisputes) - (a.parentApplications + a.parentDisputes))
    || (b.createdAt - a.createdAt)
    || a.assertionEventId.localeCompare(b.assertionEventId),
};

/**
 * GET /api/profile-tags/authored-by
 *   ?authorPubkey=<hex>            (required, 64-char lowercase hex)
 *   &wotPov=<house|user>&userPubkey=<hex>
 *   &sort=<recent|applied|disputed|most-backed|divisive>
 *
 * Story 5 / ADR-0005. Returns the tagging activity the given pubkey has
 * authored, filtered to rows whose TARGET is in the viewer's active POV
 * WoT. Each row carries both Reading-A parent-tag aggregate counts (the
 * tag's global WoT applications/disputes) AND Reading-B peer counts (other
 * WoT-allowed authors who asserted the same (tag, target) pair, excluding
 * the profile owner). Counts are derived per-request from raw assertions —
 * no persistent per-POV aggregate (CLAUDE.md "filter at view time").
 */
async function handleAuthoredBy(req, res) {
  const { authorPubkey } = req.query;
  if (!authorPubkey || !/^[0-9a-f]{64}$/.test(authorPubkey)) {
    return res.status(400).json({
      success: false,
      error: 'authorPubkey is required (64-char lowercase hex)',
    });
  }
  const sort = req.query.sort || 'recent';
  if (!AUTHORED_BY_VALID_SORTS.includes(sort)) {
    return res.status(400).json({
      success: false,
      error: `sort must be one of: ${AUTHORED_BY_VALID_SORTS.join(', ')}`,
    });
  }

  try {
    const { resolvePov } = require('../_shared/pov');
    const { povSuffix, minRank } = resolvePov({
      wotPov: req.query.wotPov || 'house',
      userPubkey: req.query.userPubkey || null,
    });
    const wotFiltering = !!povSuffix && Number.isFinite(minRank);

    // Step 1: pull every nostr-user-tag assertion authored by the profile owner.
    const ownerEvents = await strfryScan({
      kinds: [39999],
      '#z': [NOSTR_USER_TAG_Z_TAG],
      authors: [authorPubkey],
    });
    const ownerDeduped = dedupeReplaceable(ownerEvents);

    // Step 2: bucket polarity, capture candidate rows.
    const candidates = [];
    for (const ev of ownerDeduped) {
      const pTag = (ev.tags || []).find((t) => t[0] === 'p');
      const eTag = (ev.tags || []).find((t) => t[0] === 'e');
      if (!pTag?.[1] || !eTag?.[1]) continue;
      const polarity = readPolarity(ev);
      const bucket = bucketize(polarity);
      if (bucket === 'neutral') continue;
      candidates.push({
        assertionEventId: ev.id,
        targetPubkey: pTag[1],
        tagEventId: eTag[1],
        polarity: bucket === 'apply' ? 'applied' : 'disputed',
        createdAt: ev.created_at,
      });
    }

    if (candidates.length === 0) {
      return res.json({
        success: true,
        povSuffix: povSuffix || null,
        minRank: Number.isFinite(minRank) ? minRank : null,
        sort,
        authorPubkey,
        rows: [],
      });
    }

    // Step 3: target-WoT filter. Drop rows whose target's rank doesn't clear
    // the threshold. No-op when no POV is configured (graceful degradation,
    // matches existing endpoints).
    const targetPubkeys = Array.from(new Set(candidates.map((c) => c.targetPubkey)));
    const targetDocs = await meiliFetchProfilesByPubkey(targetPubkeys);
    let targetAllowed = () => true;
    if (wotFiltering) {
      const rankField = `wot_rank_${povSuffix}`;
      targetAllowed = (pk) => {
        const doc = targetDocs.get(pk);
        if (!doc) return false;
        const r = doc[rankField];
        return typeof r === 'number' && r >= minRank;
      };
    }
    const surviving = candidates.filter((c) => targetAllowed(c.targetPubkey));

    if (surviving.length === 0) {
      return res.json({
        success: true,
        povSuffix: povSuffix || null,
        minRank: Number.isFinite(minRank) ? minRank : null,
        sort,
        authorPubkey,
        rows: [],
      });
    }

    // Step 4: parent-tag enrichment. Drop rows whose parent tag-element isn't
    // locally available or fails to parse.
    const tagEventIds = Array.from(new Set(surviving.map((c) => c.tagEventId)));
    const tagElementEvents = await strfryScan({ kinds: [39999], ids: tagEventIds });
    const tagByEventId = new Map();
    for (const ev of tagElementEvents) {
      const payload = parseTagPayload(ev);
      if (!payload) continue;
      tagByEventId.set(ev.id, payload);
    }
    const surviving2 = surviving.filter((c) => tagByEventId.has(c.tagEventId));

    if (surviving2.length === 0) {
      return res.json({
        success: true,
        povSuffix: povSuffix || null,
        minRank: Number.isFinite(minRank) ? minRank : null,
        sort,
        authorPubkey,
        rows: [],
      });
    }

    // Step 5: parent-tag scan — yields BOTH parent-tag aggregate counts
    // (Reading A) AND per-(tag, target) peer counts (Reading B) in one walk.
    const remainingTagIds = Array.from(new Set(surviving2.map((c) => c.tagEventId)));
    const parentAssertions = await strfryScan({
      kinds: [39999],
      '#z': [NOSTR_USER_TAG_Z_TAG],
      '#e': remainingTagIds,
    });
    const parentDeduped = dedupeReplaceable(parentAssertions);

    let parentAuthorAllowed = () => true;
    if (wotFiltering) {
      const parentAuthors = Array.from(new Set(parentDeduped.map((ev) => ev.pubkey)));
      const parentAuthorDocs = await meiliFetchProfilesByPubkey(parentAuthors);
      const rankField = `wot_rank_${povSuffix}`;
      parentAuthorAllowed = (pk) => {
        const doc = parentAuthorDocs.get(pk);
        if (!doc) return false;
        const r = doc[rankField];
        return typeof r === 'number' && r >= minRank;
      };
    }

    const parentCounts = new Map(); // tagEventId → { applications, disputes }
    const peerCounts = new Map();   // `${tagEventId}|${targetPubkey}` → { applications, disputes }
    for (const ev of parentDeduped) {
      if (!parentAuthorAllowed(ev.pubkey)) continue;
      const eTag = (ev.tags || []).find((t) => t[0] === 'e');
      if (!eTag?.[1]) continue;
      const pTag = (ev.tags || []).find((t) => t[0] === 'p');
      const bucket = bucketize(readPolarity(ev));
      if (bucket === 'neutral') continue;

      // Parent-tag aggregate (Reading A) — include all WoT-allowed authors.
      let pEntry = parentCounts.get(eTag[1]);
      if (!pEntry) {
        pEntry = { applications: 0, disputes: 0 };
        parentCounts.set(eTag[1], pEntry);
      }
      if (bucket === 'apply') pEntry.applications += 1;
      else if (bucket === 'dispute') pEntry.disputes += 1;

      // Peer count (Reading B) — exclude the profile owner from their own
      // peer count; the owner doesn't count themselves as a peer.
      if (ev.pubkey === authorPubkey) continue;
      if (!pTag?.[1]) continue;
      const peerKey = `${eTag[1]}|${pTag[1]}`;
      let peerEntry = peerCounts.get(peerKey);
      if (!peerEntry) {
        peerEntry = { applications: 0, disputes: 0 };
        peerCounts.set(peerKey, peerEntry);
      }
      if (bucket === 'apply') peerEntry.applications += 1;
      else if (bucket === 'dispute') peerEntry.disputes += 1;
    }

    // Step 6: compose rows.
    const rows = surviving2.map((c) => {
      const tagInfo = tagByEventId.get(c.tagEventId);
      const targetDoc = targetDocs.get(c.targetPubkey);
      const parent = parentCounts.get(c.tagEventId);
      const peer = peerCounts.get(`${c.tagEventId}|${c.targetPubkey}`);
      return {
        assertionEventId: c.assertionEventId,
        polarity: c.polarity,
        createdAt: c.createdAt,
        targetPubkey: c.targetPubkey,
        targetDisplayName: targetDoc ? (targetDoc.display_name || targetDoc.name || null) : null,
        targetPicture: targetDoc ? (targetDoc.picture || null) : null,
        tagEventId: c.tagEventId,
        tagSlug: tagInfo.slug,
        tagName: tagInfo.name || tagInfo.slug,
        parentApplications: parent?.applications ?? 0,
        parentDisputes: parent?.disputes ?? 0,
        peerApplications: peer?.applications ?? 0,
        peerDisputes: peer?.disputes ?? 0,
      };
    });

    // Step 7: server-side sort.
    rows.sort(AUTHORED_BY_SORTERS[sort]);

    res.json({
      success: true,
      povSuffix: povSuffix || null,
      minRank: Number.isFinite(minRank) ? minRank : null,
      sort,
      authorPubkey,
      rows,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/profile-tags/pins?viewerPubkey=<hex>
 *
 * List a single viewer's tag-pinning records, joined to each pinned tag's
 * current metadata. Per ADR 0009:
 *   - Strfry scan for Pin events authored by the viewer carrying the
 *     `tag-pinning` z-tag, dedupe-replaceable.
 *   - Bulk-fetch the referenced tag events (one extra strfry scan).
 *   - Drop pins whose referenced tag event is missing or has a malformed
 *     payload (dangling-pin filter).
 *   - Sort by createdAt desc (most-recently-pinned first).
 */
async function handlePins(req, res) {
  const { viewerPubkey } = req.query;
  if (!isHexPubkey(viewerPubkey)) {
    return res.status(400).json({
      success: false,
      error: 'viewerPubkey is required (64-char lowercase hex)',
    });
  }
  try {
    const pinEvents = await strfryScan({
      kinds: [39999],
      '#z': [TAG_PINNING_Z_TAG],
      authors: [viewerPubkey],
    });
    const dedupedPins = dedupeReplaceable(pinEvents);

    // Map each pin to its referenced tag event id; drop pins with no
    // resolvable tagEventId.
    const pinsWithTagIds = [];
    for (const pin of dedupedPins) {
      const tagEventId = parsePinTagEventId(pin);
      if (!tagEventId) continue;
      pinsWithTagIds.push({ pin, tagEventId });
    }

    // Bulk-fetch referenced tag events.
    const uniqueTagIds = [...new Set(pinsWithTagIds.map((p) => p.tagEventId))];
    let tagEventsById = new Map();
    if (uniqueTagIds.length > 0) {
      const tagEvents = await strfryScan({ kinds: [39999], ids: uniqueTagIds });
      for (const ev of tagEvents) tagEventsById.set(ev.id, ev);
    }

    const pins = [];
    for (const { pin, tagEventId } of pinsWithTagIds) {
      const tagEv = tagEventsById.get(tagEventId);
      if (!tagEv) continue; // dangling pin — referenced tag missing
      const tagPayload = parseTagPayload(tagEv);
      if (!tagPayload) continue; // malformed payload
      const curationMethod = parseCurationMethod(pin);
      pins.push({
        pinEventId: pin.id,
        createdAt: pin.created_at,
        curationMethod,
        tag: {
          eventId: tagEv.id,
          slug: tagPayload.slug,
          name: tagPayload.name || tagPayload.slug,
          description: tagPayload.description || '',
          authorPubkey: tagEv.pubkey,
          createdAt: tagEv.created_at,
        },
      });
    }

    pins.sort((a, b) => b.createdAt - a.createdAt);

    // ADR 0010: enrich each row with tlStatus derived from strfry (no
    // on-disk persistence). One batched scan covers all pins' d-tags;
    // results are mapped back to per-row tlStatus objects.
    const { tlByDTag, wantedDTags } = await enrichRowsWithTLStatus(pins);
    // ADR 0017: also enrich each row with nip51ExportStatus (Story 19).
    // Re-uses the d-tags + kind-30392 scan results from the previous call
    // to avoid double-scanning strfry. writeRelays read once for the viewer
    // and shared across all their rows.
    await enrichRowsWithNip51ExportStatus(pins, viewerPubkey, { tlByDTag, wantedDTags });

    res.json({ success: true, pins });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * ADR 0010: per-pin tlStatus derived live from strfry. No status file.
 *
 * For each pin:
 *   - If curationMethod.method !== 'nip85:rank' → status='unsupported'.
 *   - Else compute the TL d-tag from (observer, tagAuthor, tagSlug) and
 *     look up the latest kind-30392 with that d-tag signed by the TA. If
 *     missing → status='never'. If present with ['status','retracted']
 *     marker → status='retracted'. Otherwise → status='ok'.
 */
async function enrichRowsWithTLStatus(pins) {
  // Default status on every row before we begin (so even on a strfry-scan
  // failure the rows carry the field — the read contract stays uniform).
  for (const row of pins) {
    row.tlStatus = { status: 'never', lastRefreshAt: null, tlEventId: null, memberCount: null };
  }

  // Mark unsupported method rows; collect d-tags for the rest.
  const wantedDTags = [];
  for (const row of pins) {
    const method = row.curationMethod?.method;
    if (method !== 'nip85:rank') {
      row.tlStatus = { status: 'unsupported', lastRefreshAt: null, tlEventId: null, memberCount: null };
      row._tlDTag = null;
      continue;
    }
    const observer = row.curationMethod?.observer;
    if (!observer || !isHexPubkey(observer)) {
      // Malformed observer → leave as 'never'; no d-tag to look up.
      row._tlDTag = null;
      continue;
    }
    const dTag = `tl-pin-${observer.slice(0, 8)}-${row.tag.authorPubkey.slice(0, 8)}-${row.tag.slug}`;
    row._tlDTag = dTag;
    wantedDTags.push(dTag);
  }

  // Latest per d-tag wins (kind-30392 is addressable replaceable; defensive).
  // Returned to the caller so Story-19's nip51-export-status enricher can
  // reuse the same scan results without round-tripping strfry again.
  const tlByDTag = new Map();
  if (wantedDTags.length === 0) {
    return { tlByDTag, wantedDTags };
  }

  let tls = [];
  try {
    tls = await strfryScan({
      kinds: [30392],
      authors: [TA_PUBKEY],
      '#d': wantedDTags,
    });
  } catch {
    // strfry scan failed — leave default 'never' on each row.
    return { tlByDTag, wantedDTags };
  }

  for (const ev of tls) {
    const d = (ev.tags || []).find((t) => t[0] === 'd')?.[1];
    if (!d) continue;
    const cur = tlByDTag.get(d);
    if (!cur || ev.created_at > cur.created_at) tlByDTag.set(d, ev);
  }

  for (const row of pins) {
    const dTag = row._tlDTag;
    if (!dTag) continue;
    const tl = tlByDTag.get(dTag);
    if (!tl) continue; // leave 'never'
    const retracted = (tl.tags || []).some((t) => t[0] === 'status' && t[1] === 'retracted');
    row.tlStatus = {
      status: retracted ? 'retracted' : 'ok',
      lastRefreshAt: tl.created_at,
      tlEventId: tl.id,
      memberCount: (tl.tags || []).filter((t) => t[0] === 'p').length,
    };
  }

  return { tlByDTag, wantedDTags };
}

/**
 * Story 19 / ADR 0017: per-pin nip51ExportStatus derived live from strfry
 * + the user's NIP-65 write relays. Mirrors enrichRowsWithTLStatus's
 * derive-from-strfry-on-read pattern (no on-disk state).
 *
 * For each pin row:
 *   - If unsupported method (per enrichRowsWithTLStatus) → nip51ExportStatus
 *     status='never-exported', writeRelays still populated.
 *   - Else fetch the user's latest kind-30000 with the same d-tag (signed
 *     by viewerPubkey, NOT the TA). If absent → status='never-exported'.
 *     If present → compare its p-tag set with the current kind-30392's
 *     p-tag set (passed in via tlByDTag):
 *       - same set → status='ok-fresh', diffVsTL={added:0, removed:0}
 *       - differs   → status='stale',     diffVsTL={added:N, removed:M}
 *   - writeRelays = viewer's NIP-65 write-relay list (or [] if no kind-10002).
 *
 * Must be called AFTER enrichRowsWithTLStatus (which stashes row._tlDTag
 * and we read tlByDTag from its return).
 */
async function enrichRowsWithNip51ExportStatus(pins, viewerPubkey, { tlByDTag = new Map(), wantedDTags = [] } = {}) {
  // Default: every row carries a populated nip51ExportStatus object so
  // the UI doesn't have to null-check the field; the writeRelays array
  // (computed once below) is shared across all rows for the same viewer.
  let writeRelays = [];
  if (isHexPubkey(viewerPubkey)) {
    try { writeRelays = await getViewerWriteRelays(viewerPubkey); }
    catch { writeRelays = []; }
  }

  for (const row of pins) {
    row.nip51ExportStatus = {
      status: 'never-exported',
      exportedAt: null,
      exportEventId: null,
      memberCount: null,
      diffVsTL: null,
      writeRelays,
      currentTitle: null,
    };
  }

  // Cleanup: row._tlDTag was stashed by enrichRowsWithTLStatus; remove
  // it after we've used it here.
  const rowsByDTag = new Map();
  for (const row of pins) {
    if (row._tlDTag) rowsByDTag.set(row._tlDTag, row);
  }

  if (rowsByDTag.size === 0 || !isHexPubkey(viewerPubkey)) {
    for (const row of pins) delete row._tlDTag;
    return;
  }

  // One batched scan: viewer's kind-30000 events whose d-tag matches any
  // of the wanted d-tags. (kind 30000 is parameterized-replaceable; the
  // (kind, pubkey, d) coordinate carries the latest by created_at.)
  let exports = [];
  try {
    exports = await strfryScan({
      kinds: [30000],
      authors: [viewerPubkey],
      '#d': wantedDTags,
    });
  } catch {
    for (const row of pins) delete row._tlDTag;
    return;
  }

  // Latest per d-tag wins.
  const exportByDTag = new Map();
  for (const ev of exports) {
    const d = (ev.tags || []).find((t) => t[0] === 'd')?.[1];
    if (!d) continue;
    const cur = exportByDTag.get(d);
    if (!cur || ev.created_at > cur.created_at) exportByDTag.set(d, ev);
  }

  for (const row of pins) {
    const dTag = row._tlDTag;
    delete row._tlDTag;
    if (!dTag) continue;
    const exportEv = exportByDTag.get(dTag);
    if (!exportEv) continue; // leave 'never-exported'

    const exportMembers = (exportEv.tags || []).filter((t) => t[0] === 'p').map((t) => t[1]);
    const exportTitle = (exportEv.tags || []).find((t) => t[0] === 'title')?.[1] || null;

    // Compare against the current kind-30392's p-tag set, if one exists.
    // If no kind-30392, treat diff as zero (the export reflects "nothing
    // in the TL yet" — not stale, not behind).
    const tl = tlByDTag.get(dTag);
    let added = 0, removed = 0;
    if (tl) {
      const tlMembers = (tl.tags || []).filter((t) => t[0] === 'p').map((t) => t[1]);
      const exportSet = new Set(exportMembers);
      const tlSet = new Set(tlMembers);
      for (const m of tlMembers) if (!exportSet.has(m)) added++;
      for (const m of exportMembers) if (!tlSet.has(m)) removed++;
    }
    const status = (added + removed) === 0 ? 'ok-fresh' : 'stale';

    row.nip51ExportStatus = {
      status,
      exportedAt: exportEv.created_at,
      exportEventId: exportEv.id,
      memberCount: exportMembers.length,
      diffVsTL: { added, removed },
      writeRelays,
      currentTitle: exportTitle,
    };
  }
}

function registerProfileTagsRoutes(app) {
  app.get('/api/profile-tags/available-tags', handleAvailableTags);
  app.get('/api/profile-tags/tags-for-profile', handleTagsForProfile);
  app.get('/api/profile-tags/wot-tags', handleWotTags);
  app.get('/api/profile-tags/match', handleMatch);
  app.get('/api/profile-tags/by-id', handleTagById);
  app.get('/api/profile-tags/profiles-tagged', handleProfilesTagged);
  app.get('/api/profile-tags/index', handleTagIndex);
  app.get('/api/profile-tags/authored-by', handleAuthoredBy);
  app.get('/api/profile-tags/pins', handlePins);
}

module.exports = {
  handleAvailableTags,
  handleTagsForProfile,
  handleWotTags,
  handleMatch,
  handleTagById,
  handleProfilesTagged,
  handleTagIndex,
  handleAuthoredBy,
  handlePins,
  computeTagMatches,
  findTagsByNameSubstring,
  meiliFetchProfilesByPubkey,
  aggregateProfilesTagged,
  aggregateTagPins,
  parseTagPayload,
  parseCurationMethod,
  parsePinTagEventId,
  TAG_PINNING_Z_TAG,
  NOSTR_USER_TAG_Z_TAG,
  TA_PUBKEY,
  registerProfileTagsRoutes,
};
