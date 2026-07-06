/**
 * Tag-applicability derivation (Story 1 / ADR tag-applicability/0001).
 *
 * Derives the two applicability lists — "Tags for Nostr Pubkeys" / "Tags for Nostr Events" —
 * with membership = HINT ∪ USAGE, and publishes each as a TA-signed kind-30393 Trusted List
 * whose members are tag a-coordinates (39999:<author>:<slug>):
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

const { TAG_FOR_NOSTR_PUBKEY_Z, TAG_FOR_NOSTR_EVENT_Z } = require('../../lib/event-tagging');

const KIND = 30393;
const METRIC = 'tag-applicability';
const D_PUBKEY = 'tag-applicability-nostr-pubkey';
const D_EVENT = 'tag-applicability-nostr-event';
const TITLE_PUBKEY = 'Tags for Nostr Pubkeys';
const TITLE_EVENT = 'Tags for Nostr Events';

function aCoord(authorPubkey, slug) { return `39999:${authorPubkey}:${slug}`; }

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

function dTagOf(ev) { const t = (ev.tags || []).find((x) => x[0] === 'd'); return t ? t[1] : null; }

/**
 * Build one type's ordered, deduped a-coordinate member set from usage rows + hint elements.
 * @param usageRows rows whose `byType[type].applications > 0` count as USAGE for this type.
 * @param hintEls   tag-elements carrying this type's hint z (the HINT half).
 * @returns [{ a, applications }] ordered by usage desc (hint-only, zero-usage, last).
 */
function buildMembers(usageRows, hintEls, type) {
  const byCoord = new Map(); // aCoord → applications
  for (const r of usageRows || []) {
    const apps = r && r.byType && r.byType[type] && r.byType[type].applications;
    if (apps > 0) byCoord.set(aCoord(r.tag.authorPubkey, r.tag.slug), apps);
  }
  for (const el of hintEls || []) {
    const d = dTagOf(el);
    if (!el || !el.pubkey || !d) continue;
    const coord = aCoord(el.pubkey, d);
    if (!byCoord.has(coord)) byCoord.set(coord, 0); // hint-only → zero usage, listed last
  }
  return Array.from(byCoord.entries())
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([a, applications]) => ({ a, applications }));
}

/**
 * Derive and publish both applicability lists. Returns { lists: [{ type, dTag, memberCount, uuid }] }.
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
  return { lists: out };
}

module.exports = { refreshApplicabilityLists, buildMembers, KIND, D_PUBKEY, D_EVENT };
