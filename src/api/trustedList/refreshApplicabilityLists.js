/**
 * Tag-applicability derivation (Story 1 / ADR tag-applicability/0001).
 *
 * Derives the two applicability lists — "Tags for Nostr Pubkeys" / "Tags for Nostr Events" —
 * with membership = HINT ∪ USAGE, and publishes each as a TA-signed **kind-30394** Trusted List
 * whose members are tag a-coordinates (39999:<author>:<slug>). kind-30394 is the addressable-member
 * Trusted List kind (protocols/drafts/trusted-lists.md — the +10 list analog of NIP-85's kind-30384
 * addressable Trusted Assertion). The lists shipped on 30393 first and were migrated here; the
 * legacy 30393 lists are retracted in place (see `retractLegacyKind`).
 *   - USAGE  = house-POV trusted taggings, from the tag-index byType computation
 *              (reuses `computeTagUsageRows` — builds on the machinery, no fresh scan of logic).
 *   - HINT   = tag-elements carrying the pubkey-free type z (`tag-for-nostr-pubkey` /
 *              `tag-for-nostr-event`), for brand-new usage-less tags (cold-start).
 *
 * Injectable deps (defaults are the real helpers) so the union/dedup/ordering/shape are testable
 * with no live strfry / TA key:
 *   - loadUsageRows() → tag-index rows [{ tag:{authorPubkey,slug}, byType:{profile?,event?} }]
 *   - scanStrfry(filter) → events[]           (the `#z` hint scans)
 *   - publishTL({kind,dTag,title,metric,items,content}) → { uuid }
 */

const { TAG_FOR_NOSTR_PUBKEY_Z, TAG_FOR_NOSTR_EVENT_Z, buildMembers } = require('../../lib/event-tagging');

const KIND = 30394; // addressable-member TL (NIP-85 30384 +10); protocols/drafts/trusted-lists.md
const LEGACY_KIND = 30393; // where the applicability lists shipped first; retracted in place on migration
const METRIC = 'tag-applicability';
const D_PUBKEY = 'tag-applicability-nostr-pubkey';
const D_EVENT = 'tag-applicability-nostr-event';
const TITLE_PUBKEY = 'Tags for Nostr Pubkeys';
const TITLE_EVENT = 'Tags for Nostr Events';

// ── Real dep defaults ───────────────────────────────────────────────────────────
function realLoadUsageRows() {
  const { computeTagUsageRows } = require('../event-tags');
  return computeTagUsageRows({ wotPov: 'house' });
}
function realScanStrfry(filter) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    const safe = JSON.stringify(filter).replace(/'/g, "'\\''");
    exec(`strfry scan '${safe}'`, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      const events = [];
      for (const line of (stdout || '').split('\n')) { if (!line) continue; try { events.push(JSON.parse(line)); } catch { /* skip */ } }
      resolve(events);
    });
  });
}
function realPublishTL(args) {
  const { buildAndPublishTL } = require('./index');
  return buildAndPublishTL(args);
}

// `buildMembers` (the HINT ∪ USAGE union) now lives in the portable core
// (src/lib/event-tagging/applicability.js) so a third-party kind-1 client derives compatible
// context lists; imported above and re-exported below for API stability.

/**
 * Migration (protocols/drafts/trusted-lists.md): the applicability lists shipped on kind-30393 (the
 * event/e-tag kind) before the addressable-member kind existed. They now live on kind-30394; retract
 * the legacy 30393 lists **in place** — an empty-membership replacement carrying ["status","retracted"]
 * at the same d-tags — so no stale wrong-kind a-tag list lingers for federating readers. Idempotent:
 * a d-tag with no legacy list, or one already retracted, is skipped.
 */
async function retractLegacyKind({ scanStrfry, publishTL }) {
  const retracted = [];
  for (const s of [{ dTag: D_EVENT, title: TITLE_EVENT }, { dTag: D_PUBKEY, title: TITLE_PUBKEY }]) {
    let existing = [];
    try { existing = (await scanStrfry({ kinds: [LEGACY_KIND], '#d': [s.dTag] })) || []; } catch { existing = []; }
    const live = existing.find((e) => !(e.tags || []).some((t) => t[0] === 'status' && t[1] === 'retracted'));
    if (!live) continue; // absent or already retracted
    try {
      await publishTL({ kind: LEGACY_KIND, dTag: s.dTag, title: s.title, metric: METRIC, items: [], extraTags: [['status', 'retracted']], content: '' });
      retracted.push(s.dTag);
    } catch { /* best-effort; a failed retraction retries next run */ }
  }
  return retracted;
}

/**
 * Derive and publish both applicability lists (kind-30394). Returns
 * { lists: [{ type, dTag, memberCount, uuid }], retractedLegacy: [dTag] }.
 */
async function refreshApplicabilityLists({ deps } = {}) {
  const loadUsageRows = deps?.loadUsageRows ?? realLoadUsageRows;
  const scanStrfry = deps?.scanStrfry ?? realScanStrfry;
  const publishTL = deps?.publishTL ?? realPublishTL;

  const usageRows = (await loadUsageRows()) || [];
  const eventHintEls = (await scanStrfry({ kinds: [39999], '#z': [TAG_FOR_NOSTR_EVENT_Z] })) || [];
  const pubkeyHintEls = (await scanStrfry({ kinds: [39999], '#z': [TAG_FOR_NOSTR_PUBKEY_Z] })) || [];

  const eventMembers = buildMembers(usageRows, eventHintEls, 'event');
  const pubkeyMembers = buildMembers(usageRows, pubkeyHintEls, 'profile');

  const out = [];
  for (const spec of [
    { type: 'event', dTag: D_EVENT, title: TITLE_EVENT, members: eventMembers },
    { type: 'pubkey', dTag: D_PUBKEY, title: TITLE_PUBKEY, members: pubkeyMembers },
  ]) {
    const items = spec.members.map((m) => ({ tag: 'a', value: m.a }));
    const content = JSON.stringify({ members: spec.members });
    const r = await publishTL({ kind: KIND, dTag: spec.dTag, title: spec.title, metric: METRIC, items, content });
    out.push({ type: spec.type, dTag: spec.dTag, memberCount: items.length, uuid: r && r.uuid });
  }
  // Migrate off the legacy kind: retract the old 30393 a-tag lists in place.
  const retractedLegacy = await retractLegacyKind({ scanStrfry, publishTL });
  return { lists: out, retractedLegacy };
}

/**
 * LIVE picker read (Story 2 / ADR tag-applicability/0002): compute one context's HINT ∪ USAGE
 * members fresh — the same union `refreshApplicabilityLists` publishes, but served live (no wait
 * on the published snapshot) and viewer-inclusive (the viewer's own usage counts, via alsoTrust),
 * so a just-applied tag graduates into that context's browse immediately.
 *
 * @param {Object} o
 * @param {'pubkey'|'event'} o.type
 * @param {string} [o.viewerPubkey]  hex; when set, the viewer's own usage is always trusted.
 * @param {Object} [o.deps]  { computeUsageRows({wotPov,alsoTrust}) → rows, scanStrfry(filter) → events[] }
 * @returns {Promise<{type, viewerIncluded, members:[{authorPubkey, slug, applications}]}>}
 */
const A_COORD_RE = /^39999:([0-9a-f]{64}):(.+)$/;
async function applicabilityMembers(o = {}) {
  const { type, viewerPubkey, deps } = o;
  const computeUsageRows = deps?.computeUsageRows ?? o.computeUsageRows ?? (async () => {
    const { computeTagUsageRows } = require('../event-tags');
    return computeTagUsageRows({ wotPov: 'house', alsoTrust: viewerPubkey || null });
  });
  const scanStrfry = deps?.scanStrfry ?? o.scanStrfry ?? realScanStrfry;

  const byTypeKey = type === 'pubkey' ? 'profile' : 'event';
  const hintZ = type === 'pubkey' ? TAG_FOR_NOSTR_PUBKEY_Z : TAG_FOR_NOSTR_EVENT_Z;

  const usageRows = (await computeUsageRows({ wotPov: 'house', alsoTrust: viewerPubkey || undefined })) || [];
  const hintEls = (await scanStrfry({ kinds: [39999], '#z': [hintZ] })) || [];

  // Reuse Story 1's exact union+dedup+order (one definition of the rule), then split the
  // a-coordinate back into { authorPubkey, slug }.
  const members = buildMembers(usageRows, hintEls, byTypeKey)
    .map((m) => {
      const mt = A_COORD_RE.exec(m.a);
      return mt ? { authorPubkey: mt[1], slug: mt[2], applications: m.applications } : null;
    })
    .filter(Boolean);

  return { type, viewerIncluded: !!viewerPubkey, members };
}

module.exports = { refreshApplicabilityLists, retractLegacyKind, buildMembers, applicabilityMembers, KIND, LEGACY_KIND, D_PUBKEY, D_EVENT };
