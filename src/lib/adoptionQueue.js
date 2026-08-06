/**
 * Adoption-queue arithmetic — the single owner of the S3 ∖ S2a semantics
 * (ADR shared-concepts-adoption/0002; the owner's taxonomy, intake 2026-08-05).
 *
 * computeQueue({foreignHeaders, zCarriers, myBTargets, registryRecords,
 * dispositionRecords, taPubkey}) → {nominations, declined}
 *
 * The S3 base: foreign-authored headers with CROSS-AUTHOR z-usage (a carrier
 * signed by the header's own author is internal filing, never shared usage —
 * the PR #494 rule). Exclusions, each independent:
 *   wired      — any of this instance's b targets names the coord (S2a);
 *   recognized — a registry record's identifiers match by a-tag or event id;
 *   declined   — the latest disposition-ledger record for the target says so.
 * Ties on equal created_at resolve toward VISIBILITY (a wrongly-shown
 * nomination is benign; a wrongly-hidden one loses adoptions).
 *
 * Pure CJS, zero requires. The UI never re-derives this — it renders the
 * server-assembled result.
 */

'use strict';

/** Latest disposition record per target; ties prefer 'requeued' (visibility). */
function latestPerTarget(records) {
  const out = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const section = sectionOf(r, 'adoptionDisposition');
    if (!section || typeof section.target !== 'string' || !section.target) continue;
    const at = r.created_at || 0;
    const prev = out.get(section.target);
    if (!prev || at > prev.at || (at === prev.at && section.disposition === 'requeued')) {
      out.set(section.target, { at, disposition: section.disposition, decidedOn: section.decidedOn || null });
    }
  }
  return out;
}

/** The named json section of an element event, or null (read-tolerant). */
function sectionOf(ev, key) {
  const t = (ev && ev.tags ? ev.tags : []).find((x) => x && x[0] === 'json');
  if (!t || typeof t[1] !== 'string') return null;
  try {
    const parsed = JSON.parse(t[1]);
    return parsed && typeof parsed === 'object' ? parsed[key] || null : null;
  } catch { return null; }
}

/** The best display name of a header: names (singular) else name tag. */
function bestName(ev) {
  const tags = (ev && ev.tags) || [];
  const names = tags.find((x) => x && x[0] === 'names');
  if (names && typeof names[1] === 'string' && names[1].trim() !== '') return names[1];
  const name = tags.find((x) => x && x[0] === 'name');
  return name && typeof name[1] === 'string' && name[1].trim() !== '' ? name[1] : null;
}

function computeQueue({ foreignHeaders, zCarriers, myBTargets, registryRecords, dispositionRecords, taPubkey } = {}) {
  // Newest header per coordinate (replaceable events).
  const headers = new Map(); // coord → { name, author, id }
  for (const ev of Array.isArray(foreignHeaders) ? foreignHeaders : []) {
    const d = (ev.tags || []).find((t) => t && t[0] === 'd')?.[1];
    if (d == null) continue;
    const coord = `${ev.kind}:${ev.pubkey}:${d}`;
    const prev = headers.get(coord);
    if (!prev || (ev.created_at || 0) > prev.at) {
      headers.set(coord, { at: ev.created_at || 0, name: bestName(ev), author: ev.pubkey, id: ev.id });
    }
  }

  // Cross-author usage per coord.
  const usage = new Map(); // coord → { events:Set, authors:Set, mine:boolean }
  for (const ev of Array.isArray(zCarriers) ? zCarriers : []) {
    for (const t of ev.tags || []) {
      if (!t || t[0] !== 'z' || !headers.has(t[1])) continue;
      if (ev.pubkey === headers.get(t[1]).author) continue; // self-filed: internal filing
      let u = usage.get(t[1]);
      if (!u) { u = { events: new Set(), authors: new Set(), mine: false }; usage.set(t[1], u); }
      u.events.add(ev.id);
      u.authors.add(ev.pubkey);
      if (taPubkey && ev.pubkey === taPubkey) u.mine = true;
    }
  }

  const wired = new Set(Array.isArray(myBTargets) ? myBTargets : []);

  // Registry recognition: match by a-tag or by the header's event id.
  const recognizedATags = new Set();
  const recognizedEventIds = new Set();
  for (const rec of Array.isArray(registryRecords) ? registryRecords : []) {
    const ids = (sectionOf(rec, 'sharedConcept') || {}).identifiers || {};
    if (typeof ids['a-tag'] === 'string' && ids['a-tag'].trim() !== '') recognizedATags.add(ids['a-tag'].trim());
    if (typeof ids['event-id'] === 'string' && ids['event-id'].trim() !== '') recognizedEventIds.add(ids['event-id'].trim());
  }

  const dispositions = latestPerTarget(dispositionRecords);

  const nominations = [];
  const declined = [];
  for (const [coord, u] of usage) {
    const h = headers.get(coord);
    const disp = dispositions.get(coord);
    if (disp && disp.disposition === 'declined') {
      declined.push({ target: coord, name: h.name, author: h.author, decidedOn: disp.decidedOn });
      continue;
    }
    if (wired.has(coord)) continue;
    if (recognizedATags.has(coord) || (h.id && recognizedEventIds.has(h.id))) continue;
    nominations.push({
      coord,
      name: h.name,
      author: h.author,
      eventCount: u.events.size,
      authorCount: u.authors.size,
      usedByMe: u.mine,
    });
  }
  nominations.sort((a, b) => b.eventCount - a.eventCount || b.authorCount - a.authorCount);
  declined.sort((a, b) => (a.name || a.target).localeCompare(b.name || b.target));

  return { nominations, declined };
}

module.exports = { computeQueue, latestPerTarget, sectionOf, bestName };
