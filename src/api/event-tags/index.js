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
const { resolvePovWithStatus } = require('../_shared/povStatus');
const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
// By-tag notes view (Story 8 / ADR 0008): reuse the feed/event note-read machinery
// to fetch + enrich the target kind-1 notes from the relay set.
const { resolveGeneralPurposeRelays, realQuerySync, realScanStrfry, realRunCypher } = require('../_shared/relaySource');
const { enrichNotes } = require('../_shared/noteEnrichment');

// ADR-0015 legacy literal — used ONLY as a DEFAULT honored authority (overridable
// via ?authorities=), not as a hardcoded gate. See ADR 0004 "sovereignty".
const CANONICAL_AUTHORITY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
// Cap the notes view to the most-recently-tagged N (Story 8). Bounds the relay
// `ids` fetch + the client-side per-note fan-out; pagination is a follow-up.
const NOTES_CAP = 50;
// Explicit bound on each taggings scan (ADR event-tagging/0017) — well below the ~30-40k events the
// 20MB strfryScan buffer holds, so a hot tag's scan is deterministically limited instead of silently
// overflowing. A scan returning >= this ⇒ `scanTruncated` (the durable note TL is then marked partial).
const TAGGING_SCAN_LIMIT = 20000;
// Story 15 — the note sorts for-tag accepts, at parity with the Profiles tab
// (applied/disputed/divisive) plus 'recent' (the natural note default).
const FOR_TAG_SORTS = ['recent', 'applied', 'disputed', 'divisive'];
// Short-TTL response cache for the notes-for-tag read. The dominant cost is the
// external relay round-trip (~seconds); re-visiting the same tag within the TTL
// returns instantly. Per (tag, viewer, authorities). Small staleness window — a new
// tagging may not appear for FOR_TAG_TTL_MS. Bounded size (evict-all when large).
const FOR_TAG_TTL_MS = 30000;
const FOR_TAG_CACHE_MAX = 200;
const forTagCache = new Map(); // key -> { body, expires }
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
// The asserter-trust predicate for an already-resolved POV over a candidate set. Factored out of
// buildTrustPredicate (ADR event-tagging/0016) so both the req-based read path and the observer-POV
// aggregateNotesTagged share one definition. Not WoT-filtering (no povSuffix / non-finite minRank)
// ⇒ everyone counts.
async function trustPredicateFor(povSuffix, minRank, candidatePubkeys) {
  const wotFiltering = !!povSuffix && Number.isFinite(minRank);
  if (!wotFiltering) return () => true;
  const docs = await meiliFetchProfilesByPubkey(candidatePubkeys);
  const rankField = `wot_rank_${povSuffix}`;
  return (pk) => {
    const doc = docs.get(pk);
    if (!doc) return false;
    const r = doc[rankField];
    return typeof r === 'number' && r >= minRank;
  };
}

async function buildTrustPredicate(req, candidatePubkeys) {
  const { povSuffix, minRank, povResolution } = await resolvePovWithStatus({
    wotPov: req.query.wotPov || 'house',
    userPubkey: req.query.userPubkey || null,
  });
  const wotFiltering = !!povSuffix && Number.isFinite(minRank);
  const isAsserterTrusted = await trustPredicateFor(povSuffix, minRank, candidatePubkeys);
  return { isAsserterTrusted, povSuffix: povSuffix || null, minRank: wotFiltering ? minRank : null, povResolution };
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
    const { isAsserterTrusted, povSuffix, minRank, povResolution } = await buildTrustPredicate(req, candidates.map((c) => c.pubkey));
    const { tags, unverifiable, mine } = core.classifyEventTaggings({
      candidates, headers: dedupedHeaders, honoredAuthorities: authorities, isAsserterTrusted, viewerPubkey,
    });

    return res.json({ success: true, target, povSuffix, minRank, povResolution, authorities, tags, unverifiable, mine });
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

/**
 * Shared note-tagging aggregation (event-tagging #17 / ADR 0016). Scan a tag's legitimate headers
 * (across honored authorities) → scan the taggings referencing each → POV-filter → produce the
 * deterministic per-note membership `{ id, applications, disputes, createdAt, mine }`, ranked by
 * `sort` and capped to NOTES_CAP. Pure of req/res.
 *
 * Used by BOTH `handleForTag` (the for-tag read) and `runOneNotePin` (the TA-signed note TL), so a
 * tag's trusted-note set is computed one way. Returns the full computed state (counts maps, `mine`,
 * `candidates`, totals, normalized POV) so `handleForTag`'s kind-1 resolution + response stay
 * byte-identical after the extraction; the note TL uses only `.members`.
 *
 * @param {Object} o
 * @param {string} o.tagAuthor  tag author hex pubkey
 * @param {string} o.slug       tag slug
 * @param {string[]} o.authorities  honored authorities (TA pubkeys)
 * @param {string|null} o.povSuffix  resolved POV suffix (raw resolvePov output)
 * @param {number|null} o.minRank    resolved POV min-rank (raw resolvePov output)
 * @param {string} [o.viewerPubkey]  the viewer, for the trust-unfiltered `mine` channel
 * @param {'recent'|'applied'|'disputed'|'divisive'} [o.sort='recent']  cap ranking
 */
async function aggregateNotesTagged({ tagAuthor, slug, authorities, povSuffix, minRank, viewerPubkey, sort = 'recent' }) {
  // 1. Discover the tag's legitimate headers (any author, per honored authority).
  const foundHeaders = [];
  for (const authority of authorities) {
    foundHeaders.push(...await strfryScan(core.filterTaggingHeadersForTag({ tagAuthorPubkey: tagAuthor, slug, taPubkey: authority })));
  }
  const headers = dedupeReplaceable(foundHeaders);

  // 2. Scan the taggings referencing each header; union (multi-header — ADR Q1). Each scan carries an
  //    explicit limit (ADR event-tagging/0017) so it is deterministically bounded and never silently
  //    overflows the 20MB process buffer. A scan that returns >= its limit ⇒ the taggings (hence the
  //    membership) may be incomplete → surfaced as `scanTruncated` for the durable note-TL partial signal.
  const candidateEvents = [];
  let scanTruncated = false;
  for (const h of headers) {
    const scanned = await strfryScan({ ...core.filterTaggingsUsingTag({ headerAuthorPubkey: h.pubkey, slug }), limit: TAGGING_SCAN_LIMIT });
    if (scanned.length >= TAGGING_SCAN_LIMIT) scanTruncated = true;
    candidateEvents.push(...scanned);
  }
  const candidates = dedupeReplaceable(candidateEvents);

  // 3. Group by target note: POV-filtered counted set + trust-unfiltered `mine`.
  const isAsserterTrusted = await trustPredicateFor(povSuffix, minRank, candidates.map((c) => c.pubkey));
  const { targets, mine } = core.groupTaggingsByTarget({
    candidates, headers, honoredAuthorities: authorities, isAsserterTrusted, viewerPubkey,
    tag: { authorPubkey: tagAuthor, slug },
  });

  // 4. Resolve target note ids (`e`-targets), bounded to the most-recently-tagged
  //    NOTES_CAP. The bound is REQUIRED: an unbounded `ids` filter would be rejected
  //    by relays / time out (→ silent empty), and an unbounded result would spawn
  //    one Story-6 per-note read per card client-side. Pagination is a follow-up.
  const countByTarget = new Map(targets.map((t) => [t.target.id, t]).filter(([id]) => id));
  const mineByTarget = new Map(mine.map((m) => [m.target.id, m]).filter(([id]) => id));
  // Per-note latest tagging time (union counted + mine) → recency cap key.
  const latestByNote = new Map();
  const bump = (id, ts) => { if (id) latestByNote.set(id, Math.max(latestByNote.get(id) || 0, ts || 0)); };
  for (const t of targets) {
    if (!t.target.id) continue;
    for (const e of t.applications) bump(t.target.id, e.createdAt);
    for (const e of t.disputes) bump(t.target.id, e.createdAt);
  }
  for (const m of mine) bump(m.target.id, m.createdAt);

  // Rank ALL tagged notes by the requested sort, THEN cap — so the top-N
  // reflects the whole set (Story 15). Per-note trusted counts already exist
  // in countByTarget (mine-only notes have no trusted backers → 0/0). recency
  // is the universal tiebreak (and the whole key for 'recent').
  const appliedOf  = (id) => (countByTarget.get(id)?.applications || []).length;
  const disputedOf = (id) => (countByTarget.get(id)?.disputes || []).length;
  const recencyOf  = (id) => latestByNote.get(id) || 0;
  const idComparators = {
    recent:   (a, b) => recencyOf(b) - recencyOf(a),
    applied:  (a, b) => (appliedOf(b) - appliedOf(a)) || (recencyOf(b) - recencyOf(a)),
    disputed: (a, b) => (disputedOf(b) - disputedOf(a)) || (recencyOf(b) - recencyOf(a)),
    divisive: (a, b) => (Math.min(appliedOf(b), disputedOf(b)) - Math.min(appliedOf(a), disputedOf(a)))
                        || (appliedOf(b) - appliedOf(a)) || (recencyOf(b) - recencyOf(a)),
  };
  const rankedIds = Array.from(latestByNote.keys()).sort(idComparators[sort] || idComparators.recent);
  const total = rankedIds.length;
  const noteIds = rankedIds.slice(0, NOTES_CAP);
  const truncated = total > noteIds.length;

  // Deterministic membership (ids + counts), computed from the taggings BEFORE
  // any kind-1 resolution. Consumers that need a stable set — e.g. pin curation,
  // the note TL, and the pinned-notes drift — must use THIS, not the resolved
  // `notes` array (whose contents depend on flaky external relay fetches).
  const memberOf = (id) => ({
    id,
    applications: (countByTarget.get(id)?.applications || []).length,
    disputes: (countByTarget.get(id)?.disputes || []).length,
    createdAt: latestByNote.get(id) || 0,
    mine: mineByTarget.has(id) ? mineByTarget.get(id).stance : null,
  });
  const members = noteIds.map(memberOf);
  // `fullMembers` is the COMPLETE trusted-tagged set (all ranked ids + counts) — no NOTES_CAP slice.
  // The durable note TL (runOneNotePin) publishes this; the UI read keeps the capped `members`/`noteIds`.
  // Bounded only by the explicit tagging-scan limit above (→ scanTruncated when hit).
  const fullMembers = rankedIds.map(memberOf);

  const wotFiltering = !!povSuffix && Number.isFinite(minRank);
  return {
    members, fullMembers, scanTruncated, mine, candidates, countByTarget, mineByTarget, latestByNote,
    noteIds, total, truncated, povSuffix: povSuffix || null, minRank: wotFiltering ? minRank : null,
  };
}

/**
 * GET /api/event-tags/for-tag?tagAuthor=<hex>&slug=<slug>
 *   [&viewerPubkey=<hex>] [&authorities=<csv>] [&wotPov=…&userPubkey=…]
 *
 * The notes tagged with a tag (the forward direction; Story 8 / ADR 0008). Composes the shared
 * `aggregateNotesTagged` (deterministic membership) → fetch + enrich the target kind-1 notes from
 * the relay set. Returns NoteCard-ready items (union of counted + mine), newest first, each
 * annotated with apply/dispute counts + the viewer's stance.
 */
async function handleForTag(req, res) {
  try {
    const tagAuthor = typeof req.query.tagAuthor === 'string' ? req.query.tagAuthor.trim() : '';
    const slug = typeof req.query.slug === 'string' ? req.query.slug.trim() : '';
    if (!isHexPubkey(tagAuthor)) return res.status(400).json({ success: false, error: 'tagAuthor must be a 64-char hex pubkey.' });
    if (!slug) return res.status(400).json({ success: false, error: 'slug is required.' });

    const authorities = resolveAuthorities(req);
    const viewerPubkey = isHexPubkey(req.query.viewerPubkey) ? req.query.viewerPubkey : undefined;
    // Story 15 / ADR: server-side note sort at parity with the Profiles tab. The
    // ranking runs over the FULL candidate set BEFORE the NOTES_CAP, so a
    // non-recency sort reflects the whole tagged universe, not just the 50
    // most-recently-tagged. 'recent' is the natural default for notes.
    const sort = FOR_TAG_SORTS.includes(req.query.sort) ? req.query.sort : 'recent';

    // Short-TTL cache: re-visiting the same tag skips the slow relay fetch.
    // `nocache=1` skips the READ (used right after a publish so the just-tagged
    // note appears live instead of waiting out the TTL); the fresh result is
    // still written back, so subsequent normal reads are warm.
    const noCache = req.query.nocache === '1' || req.query.nocache === 'true';
    // Normalized POV params — MUST be in the key so a cached povResolution can never
    // describe another POV's read (ADR 0002; behavior-preserving for current callers).
    const wotPov = req.query.wotPov || 'house';
    const userPubkey = req.query.userPubkey || '';
    const cacheKey = `${tagAuthor}|${slug}|${viewerPubkey || ''}|${authorities.join(',')}|${sort}|${wotPov}|${userPubkey}`;
    const cached = forTagCache.get(cacheKey);
    if (!noCache && cached && cached.expires > Date.now()) return res.json(cached.body);

    // Aggregate the tag's taggings into deterministic per-note membership (ADR event-tagging/0016
    // — the SAME aggregation the TA-signed note TL uses). resolvePov here so the response reports
    // the identical POV; aggregateNotesTagged returns the full computed state so the kind-1
    // resolution + response body below stay byte-identical to before the extraction.
    const { povSuffix: rawPovSuffix, minRank: rawMinRank, povResolution } = await resolvePovWithStatus({
      wotPov,
      userPubkey: userPubkey || null,
    });
    const {
      members, mine, candidates, countByTarget, mineByTarget, latestByNote, noteIds, total, truncated,
      povSuffix, minRank,
    } = await aggregateNotesTagged({ tagAuthor, slug, authorities, povSuffix: rawPovSuffix, minRank: rawMinRank, viewerPubkey, sort });

    let notes = [];
    if (noteIds.length) {
      // Local-first: scan local strfry for the target notes; only pay the slow
      // external relay round-trip for the ones still missing.
      let localNotes = [];
      try { localNotes = realScanStrfry({ kinds: [1], ids: noteIds }); } catch { localNotes = []; }
      const haveIds = new Set(localNotes.map((n) => n.id));
      const missing = noteIds.filter((id) => !haveIds.has(id));
      let externalNotes = [];
      if (missing.length) {
        const { relays } = await resolveGeneralPurposeRelays(realRunCypher);
        // NIP-01 relay hints: an external target note (e.g. a fiatjaf post) won't
        // be on our general-purpose relays. Collect the `["e", id, relay]` hints
        // the taggings carry and fetch the missing notes from THERE too — a
        // view-time fetch, nothing persisted (Story 12 follow-up).
        const hintRelays = new Set();
        const missingSet = new Set(missing);
        for (const c of candidates) {
          for (const t of (c.tags || [])) {
            if (t[0] === 'e' && missingSet.has(t[1]) && typeof t[2] === 'string' && /^wss?:\/\//.test(t[2])) {
              hintRelays.add(t[2]);
            }
          }
        }
        const fetchRelays = Array.from(new Set([...relays, ...hintRelays]));
        externalNotes = (await realQuerySync(fetchRelays, { kinds: [1], ids: missing })) || [];
      }
      const rawNotes = [...localNotes, ...externalNotes];
      const enriched = await enrichNotes(rawNotes, realScanStrfry);
      notes = enriched
        .map((n) => ({
          ...n,
          applications: (countByTarget.get(n.id)?.applications || []).length,
          disputes: (countByTarget.get(n.id)?.disputes || []).length,
          mine: mineByTarget.has(n.id) ? mineByTarget.get(n.id).stance : null,
        }))
        // Order the resolved page by the same sort used for the cap (Story 15).
        .sort((a, b) => {
          const rec = (latestByNote.get(b.id) || 0) - (latestByNote.get(a.id) || 0);
          if (sort === 'applied') return (b.applications - a.applications) || rec;
          if (sort === 'disputed') return (b.disputes - a.disputes) || rec;
          if (sort === 'divisive') {
            return (Math.min(b.applications, b.disputes) - Math.min(a.applications, a.disputes))
              || (b.applications - a.applications) || rec;
          }
          return rec;
        });
    }

    const body = { success: true, tagAuthor, slug, authorities, povSuffix, minRank, povResolution, sort, notes, members, mine, total, truncated, limit: NOTES_CAP };
    if (forTagCache.size >= FOR_TAG_CACHE_MAX) forTagCache.clear();
    forTagCache.set(cacheKey, { body, expires: Date.now() + FOR_TAG_TTL_MS });
    return res.json(body);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/tags/index — the UNIFIED tag directory (Story 9 / ADR 0009).
 *   [?viewerPubkey=<hex>] [?authorities=<csv>] [?q=<substr>] [?limit=&offset=] [?wotPov=&userPubkey=]
 *
 * One tag universe: scans every family member's assertions (nostr-user-tag +
 * nostr-event-tag + any future members) under honored authorities, normalizes them
 * to the unified stream (read-only; no wire/write change), and groups BY TAG across
 * ALL target types — so a note-only tag appears and a shared tag reflects both. POV-
 * filtered counted totals + per-target-type breakdown + the viewer's own `mine`.
 * The live per-type endpoints are untouched (ADR 0009 Phase 1).
 */
/**
 * Compute the core per-tag USAGE rows for a POV — the scan + normalize + POV-trust index that
 * `handleTagIndex` builds on, WITHOUT the display/pin enrichment or sort. Reused by the
 * tag-applicability derivation (ADR tag-applicability/0001) so the applicability lists build on
 * the tag-index machinery rather than re-deriving. Each row: { tag:{authorPubkey,slug},
 * applications, disputes, byType:{ profile?:{applications,disputes}, event?:{…} } }.
 */
async function computeTagUsageRows({ wotPov = 'house', userPubkey = null, alsoTrust = null } = {}) {
  const req = { query: { wotPov, ...(userPubkey ? { userPubkey } : {}) } };
  const authorities = resolveAuthorities(req);
  const memberZs = [];
  for (const a of authorities) for (const m of core.taggingMembers) memberZs.push(m.conceptZ(a));
  const assertions = dedupeReplaceable(await strfryScan({ kinds: [39999], '#z': memberZs }));
  const descriptors = new Set();
  for (const c of assertions) for (const t of (c.tags || [])) if (t[0] === 'z' && DESCRIPTOR_RE.test(t[1] || '')) descriptors.add(t[1]);
  const headerEvents = [];
  for (const coord of descriptors) {
    const m = /^39999:([0-9a-f]{64}):(.+)$/.exec(coord);
    if (m) headerEvents.push(...await strfryScan({ kinds: [39999], authors: [m[1]], '#d': [m[2]] }));
  }
  const headers = dedupeReplaceable(headerEvents);
  const { isAsserterTrusted } = await buildTrustPredicate(req, assertions.map((c) => c.pubkey));
  // Viewer-inclusive (tag-applicability/0002): the viewer's OWN taggings always count, so a tag
  // they just applied graduates into that context's picker immediately, regardless of WoT rank.
  const trusted = (isHexPubkey(alsoTrust))
    ? (pk) => pk === alsoTrust || isAsserterTrusted(pk)
    : isAsserterTrusted;
  const taggings = core.normalizeTaggings({ assertions, headers, honoredAuthorities: authorities });
  const { rows } = core.indexByTag(taggings, { isAsserterTrusted: trusted });
  return rows;
}

/**
 * GET /api/tags/applicability?type=pubkey|event&viewerPubkey= — the type-aware picker's LIVE
 * context list (tag-applicability/0002). Delegates to the shared `applicabilityMembers`.
 */
async function handleTagApplicability(req, res) {
  try {
    const type = req.query.type;
    if (type !== 'pubkey' && type !== 'event') {
      return res.status(400).json({ success: false, error: "type must be 'pubkey' or 'event'" });
    }
    const viewerPubkey = isHexPubkey(req.query.viewerPubkey) ? req.query.viewerPubkey : undefined;
    const { applicabilityMembers } = require('../trustedList/refreshApplicabilityLists');
    const r = await applicabilityMembers({
      type,
      viewerPubkey,
      deps: { computeUsageRows: ({ wotPov = 'house', alsoTrust } = {}) => computeTagUsageRows({ wotPov, alsoTrust }) },
    });
    return res.json({ success: true, source: 'live', ...r });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function handleTagIndex(req, res) {
  try {
    const authorities = resolveAuthorities(req);
    const viewerPubkey = isHexPubkey(req.query.viewerPubkey) ? req.query.viewerPubkey : undefined;
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim().toLowerCase();
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 100, 200));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const VALID_SORTS = ['used', 'endorsed', 'divisive', 'most-pinned'];
    const sort = VALID_SORTS.includes(req.query.sort) ? req.query.sort : 'used';
    const authoredBy = isHexPubkey(req.query.authoredBy) ? req.query.authoredBy : null;
    const pinnedByMe = req.query.pinnedByMe === 'true' && !!viewerPubkey;

    // 1. Scan every family member's assertions under the honored authorities.
    const memberZs = [];
    for (const a of authorities) for (const m of core.taggingMembers) memberZs.push(m.conceptZ(a));
    const assertions = dedupeReplaceable(await strfryScan({ kinds: [39999], '#z': memberZs }));

    // 2. Resolve the tagging headers the event-tag members need.
    const descriptors = new Set();
    for (const c of assertions) for (const t of (c.tags || [])) if (t[0] === 'z' && DESCRIPTOR_RE.test(t[1] || '')) descriptors.add(t[1]);
    const headerEvents = [];
    for (const coord of descriptors) {
      const m = /^39999:([0-9a-f]{64}):(.+)$/.exec(coord);
      if (m) headerEvents.push(...await strfryScan({ kinds: [39999], authors: [m[1]], '#d': [m[2]] }));
    }
    const headers = dedupeReplaceable(headerEvents);

    // 3. Normalize → POV predicate → index by tag coordinate.
    const { isAsserterTrusted, povSuffix, minRank, povResolution } = await buildTrustPredicate(req, assertions.map((c) => c.pubkey));
    const taggings = core.normalizeTaggings({ assertions, headers, honoredAuthorities: authorities });
    let { rows } = core.indexByTag(taggings, { isAsserterTrusted, viewerPubkey });

    // 4. Enrich tag display (name/description/eventId) from the shared tag-elements; optional q filter.
    const tagEls = dedupeReplaceable(await strfryScan({ kinds: [39999], '#z': authorities.map((a) => core.conceptTag(a)) }));
    const meta = new Map();
    for (const el of tagEls) {
      const d = dTagOf(el);
      if (!d) continue;
      let name = d; let description = '';
      try { const c = JSON.parse(el.content || '{}'); if (c.tag) { name = c.tag.name || d; description = c.tag.description || ''; } } catch { /* slug fallback */ }
      meta.set(`${el.pubkey}:${d}`, { name, description, eventId: el.id });
    }
    rows = rows.map((r) => {
      const md = meta.get(`${r.tag.authorPubkey}:${r.tag.slug}`) || {};
      return { ...r, authorPubkey: r.tag.authorPubkey, slug: r.tag.slug, name: md.name || r.tag.slug, description: md.description || '', tagEventId: md.eventId || null };
    });

    // Pins (Story 13 / ADR 0012) — reuse the profile-curation aggregate, joined on
    // tagEventId. Read-only; a note-pin affordance is Story 12.
    try {
      const { aggregateTagPins } = require('../profile-tags');
      const { pinCountByTagEventId, viewerPinnedSet } = await aggregateTagPins({ povSuffix, minRank, viewerPubkey });
      rows = rows.map((r) => ({ ...r, pinnedCount: r.tagEventId ? (pinCountByTagEventId.get(r.tagEventId) || 0) : 0, viewerPinned: r.tagEventId ? viewerPinnedSet.has(r.tagEventId) : false }));
    } catch { rows = rows.map((r) => ({ ...r, pinnedCount: 0, viewerPinned: false })); }

    if (q) rows = rows.filter((r) => (r.name || '').toLowerCase().includes(q) || r.slug.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
    if (authoredBy) rows = rows.filter((r) => r.authorPubkey === authoredBy);
    if (pinnedByMe) rows = rows.filter((r) => r.viewerPinned);

    const SORTERS = {
      used: (a, b) => ((b.applications + b.disputes) - (a.applications + a.disputes)) || (b.applications - a.applications),
      endorsed: (a, b) => (b.applications - a.applications) || (b.disputes - a.disputes),
      divisive: (a, b) => (Math.min(b.applications, b.disputes) - Math.min(a.applications, a.disputes)) || (b.applications - a.applications),
      'most-pinned': (a, b) => ((b.pinnedCount || 0) - (a.pinnedCount || 0)) || (b.applications - a.applications),
    };
    rows.sort(SORTERS[sort]);

    const total = rows.length;
    return res.json({ success: true, authorities, povSuffix, minRank, povResolution, sort, rows: rows.slice(offset, offset + limit), total, offset, limit });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/event-tags/notes-by-author?authorPubkey=<hex> [&viewerPubkey=][&authorities=]
 *   [&wotPov=&userPubkey=]
 *
 * A profile's NOTE-taggings (Story 11 / ADR 0010): the kind-1 notes this author has
 * tagged, each with the tag(s) they applied — an asserter-filtered view over the
 * normalized stream, enriched for NoteCard (reuses the for-tag note-read: local-first
 * + relay + NOTES_CAP). The live profiles-side /api/profile-tags/authored-by is
 * untouched (ADR 0009 Phase 1).
 */
async function handleNotesByAuthor(req, res) {
  try {
    const authorPubkey = typeof req.query.authorPubkey === 'string' ? req.query.authorPubkey.trim() : '';
    if (!isHexPubkey(authorPubkey)) return res.status(400).json({ success: false, error: 'authorPubkey must be a 64-char hex pubkey.' });
    const authorities = resolveAuthorities(req);

    // Scan this author's event-taggings, resolve their headers, normalize.
    const memberZs = authorities.map((a) => core.conceptNostrEventTag(a));
    const assertions = dedupeReplaceable(await strfryScan({ kinds: [39999], authors: [authorPubkey], '#z': memberZs }));
    const descriptors = new Set();
    for (const c of assertions) for (const tg of (c.tags || [])) if (tg[0] === 'z' && DESCRIPTOR_RE.test(tg[1] || '')) descriptors.add(tg[1]);
    const headerEvents = [];
    for (const coord of descriptors) { const m = /^39999:([0-9a-f]{64}):(.+)$/.exec(coord); if (m) headerEvents.push(...await strfryScan({ kinds: [39999], authors: [m[1]], '#d': [m[2]] })); }
    const headers = dedupeReplaceable(headerEvents);

    const mine = core.taggingsByAsserter(core.normalizeTaggings({ assertions, headers, honoredAuthorities: authorities }), authorPubkey)
      .filter((tg) => tg.target.type === 'event');

    // Group by target note, most-recently-tagged first, capped.
    const byNote = new Map();
    for (const tg of mine) {
      const id = tg.target.ref;
      if (!id) continue;
      let e = byNote.get(id);
      if (!e) { e = { id, taggedWith: [], latest: 0 }; byNote.set(id, e); }
      e.taggedWith.push({ authorPubkey: tg.tag.authorPubkey, slug: tg.tag.slug, stance: tg.stance });
      if (tg.createdAt > e.latest) e.latest = tg.createdAt;
    }
    const ranked = Array.from(byNote.values()).sort((a, b) => b.latest - a.latest);
    const total = ranked.length;
    const capped = ranked.slice(0, NOTES_CAP);

    let notes = [];
    const noteIds = capped.map((n) => n.id);
    if (noteIds.length) {
      let local = [];
      try { local = realScanStrfry({ kinds: [1], ids: noteIds }); } catch { local = []; }
      const have = new Set(local.map((n) => n.id));
      const missing = noteIds.filter((id) => !have.has(id));
      let ext = [];
      if (missing.length) {
        const { relays } = await resolveGeneralPurposeRelays(realRunCypher);
        // NIP-01 relay hints from the author's taggings → fetch external targets
        // on-demand (view-time), nothing persisted. Mirrors handleForTag.
        const missingSet = new Set(missing);
        const hintRelays = new Set();
        for (const c of assertions) {
          for (const t of (c.tags || [])) {
            if (t[0] === 'e' && missingSet.has(t[1]) && typeof t[2] === 'string' && /^wss?:\/\//.test(t[2])) hintRelays.add(t[2]);
          }
        }
        ext = (await realQuerySync(Array.from(new Set([...relays, ...hintRelays])), { kinds: [1], ids: missing })) || [];
      }
      const enriched = await enrichNotes([...local, ...ext], realScanStrfry);
      const twById = new Map(capped.map((n) => [n.id, n.taggedWith]));
      const latestById = new Map(capped.map((n) => [n.id, n.latest]));
      notes = enriched.map((n) => ({ ...n, taggedWith: twById.get(n.id) || [], taggedAt: latestById.get(n.id) || 0 })).sort((a, b) => (latestById.get(b.id) || 0) - (latestById.get(a.id) || 0));
    }
    return res.json({ success: true, authorPubkey, notes, total, truncated: total > capped.length, limit: NOTES_CAP });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleForEvent, handleHeadersForTag, handleForTag, handleTagIndex, handleNotesByAuthor, computeTagUsageRows, handleTagApplicability, aggregateNotesTagged };
