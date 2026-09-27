/**
 * Trusted-dictionary arithmetic — the single owner of the S3b-with-threshold
 * semantics (ADR shared-concepts-adoption/0005; the owner's taxonomy, intake
 * 2026-08-05; scoring semantics ratified at /discuss 2026-08-07).
 *
 * computeDictionary({headers, zCarriers, qualifying, threshold, taPubkey})
 *   → { entries, metric }
 *
 * Headers arrive PRE-CLASSIFIED at the handler seam
 * ({coord, name, plural, description, author, isMine, isFirmware, bState})
 * and the qualifying set — the carrier authors whose influence clears the
 * verified cutoff from the active POV — is resolved at the same seam, so
 * this core never touches Neo4j, b semantics or the firmware manifest (the
 * ADR 0003 pattern).
 *
 * Membership: ≥ threshold DISTINCT qualifying authors. A carrier author
 * never counts — for the threshold OR the context totals — when it is the
 * header's own author (cross-author rule, PR #494) or the instance's TA
 * (self-evidence is not community evidence), even when nominally in the
 * qualifying set. Sentinel-deferred headers stay IN the view, marked
 * (the snapshot mint drops them); real-b headers are ordinary members —
 * the dictionary is not the worklist. Declined stances are never read:
 * decline governs adoption, not usage observability. Sorted by qualifying
 * count desc, then total events desc.
 *
 * The General Usage Metric (Dictionary › Concepts v1; handoff SPEC § 4):
 * every entry carries `gum`, the value of the metric the result names in
 * `metric`, so later metrics can arrive without changing the shape. Version
 * 1 has one — GUM₁, the qualifying-author count above — so `gum` equals
 * `qualifyingAuthorCount`. `itemCount` is the concept's size: distinct
 * events z-filed under the header by ANYONE, the header's own author and
 * the TA included. It is not usage evidence and never touches membership.
 * `override` (Added / Vetoed by the owner) is always null in version 1.
 *
 * Pure CJS, zero requires. The UI never re-derives this — it renders the
 * server-assembled result.
 */

'use strict';

// TODO(GUM₂ / GUM₃ — handoff SPEC § 4, version 2): add them here, still
// server-side, each with its inputs resolved at the handler seam (as the
// qualifying set is) and its own cutoff (default 1.50) as the membership test:
//   gum2 — the sum of rank scores (Trusted Assertions, active POV) of trusted
//          users whose Assistants' headers b-point to the shared concept;
//   gum3 — the rank-weighted sum of `add-to-dictionary` pinnings (apply +,
//          dispute −), once the Pins wire format lands.
// The owner picks the metric and cutoff (Automated Assistant Tasks); `metric`
// then reports the choice and `gum` carries that metric's value.
const METRIC = 'gum1';

function computeDictionary({ headers, zCarriers, qualifying, threshold, taPubkey } = {}) {
  const hs = new Map(); // coord → { name, plural, description, author, isMine, isFirmware, bState }
  for (const h of Array.isArray(headers) ? headers : []) {
    if (h && typeof h.coord === 'string' && h.coord) hs.set(h.coord, h);
  }
  const q = qualifying instanceof Set ? qualifying : new Set(Array.isArray(qualifying) ? qualifying : []);
  const n = Number.isFinite(threshold) ? threshold : 2;

  const usage = new Map(); // coord → { qa:Set, aa:Set, ev:Set }
  const items = new Map(); // coord → Set of event ids, every author (the concept's size)
  for (const ev of Array.isArray(zCarriers) ? zCarriers : []) {
    if (!ev || typeof ev.pubkey !== 'string') continue;
    for (const t of ev.tags || []) {
      if (!t || t[0] !== 'z' || !hs.has(t[1])) continue;
      const h = hs.get(t[1]);
      let it = items.get(t[1]);
      if (!it) { it = new Set(); items.set(t[1], it); }
      it.add(ev.id);
      if (ev.pubkey === h.author) continue; // self-filed: internal filing, never usage
      if (taPubkey && ev.pubkey === taPubkey) continue; // the TA never counts
      let u = usage.get(t[1]);
      if (!u) { u = { qa: new Set(), aa: new Set(), ev: new Set() }; usage.set(t[1], u); }
      u.aa.add(ev.pubkey);
      u.ev.add(ev.id);
      if (q.has(ev.pubkey)) u.qa.add(ev.pubkey);
    }
  }

  const entries = [];
  for (const [coord, u] of usage) {
    if (u.qa.size < n) continue;
    const h = hs.get(coord);
    entries.push({
      coord,
      name: h.name || null,
      plural: h.plural || null,
      description: h.description || null,
      author: h.author,
      isMine: !!h.isMine,
      isFirmware: !!h.isFirmware,
      sentinelDeferred: h.bState === 'deferred',
      qualifyingAuthorCount: u.qa.size,
      totalAuthorCount: u.aa.size,
      totalEventCount: u.ev.size,
      itemCount: items.get(coord).size,
      gum: u.qa.size, // GUM₁
      override: null, // version 2: the owner's add-to-dictionary pinning (Pins § 6, owner over community)
    });
  }
  entries.sort((a, b) => b.qualifyingAuthorCount - a.qualifyingAuthorCount
    || b.totalEventCount - a.totalEventCount);

  return { entries, metric: METRIC };
}

module.exports = { computeDictionary };
