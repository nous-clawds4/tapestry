/**
 * Trusted-dictionary arithmetic — the single owner of the S3b-with-threshold
 * semantics (ADR shared-concepts-adoption/0005; the owner's taxonomy, intake
 * 2026-08-05; scoring semantics ratified at /discuss 2026-08-07).
 *
 * computeDictionary({headers, zCarriers, qualifying, threshold, taPubkey})
 *   → { entries, metric }                   — the trusted dictionary (below)
 * computeConceptDictionary({rows, zCarriers, qualifying, taPubkey})
 *   → { entries, metric }                   — Dictionary › Concepts (its own
 *                                              doc comment, further down)
 * usageByHeader(…)                          — the counting rule both share
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
 * The General Usage Metric (handoff SPEC § 4):
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

/**
 * The counting rule, once, for both reads below. For every header coordinate
 * the z-carriers file under:
 *   items    — coord → Set of event ids, every author (the concept's size);
 *   evidence — coord → { qa, aa, ev }: the distinct authors and events once
 *              the header's own author and the TA are set aside, and those
 *              authors who are in the qualifying set (qa.size is GUM₁).
 *              A coordinate filed under only by its own author or the TA has
 *              items but no evidence entry.
 * `headers` needs only { coord, author }.
 */
function usageByHeader({ headers, zCarriers, qualifying, taPubkey } = {}) {
  const hs = new Map(); // coord → header
  for (const h of Array.isArray(headers) ? headers : []) {
    if (h && typeof h.coord === 'string' && h.coord) hs.set(h.coord, h);
  }
  const q = qualifying instanceof Set ? qualifying : new Set(Array.isArray(qualifying) ? qualifying : []);

  const evidence = new Map(); // coord → { qa:Set, aa:Set, ev:Set }
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
      let u = evidence.get(t[1]);
      if (!u) { u = { qa: new Set(), aa: new Set(), ev: new Set() }; evidence.set(t[1], u); }
      u.aa.add(ev.pubkey);
      u.ev.add(ev.id);
      if (q.has(ev.pubkey)) u.qa.add(ev.pubkey);
    }
  }
  return { items, evidence };
}

function computeDictionary({ headers, zCarriers, qualifying, threshold, taPubkey } = {}) {
  const hs = new Map(); // coord → { name, plural, description, author, isMine, isFirmware, bState }
  for (const h of Array.isArray(headers) ? headers : []) {
    if (h && typeof h.coord === 'string' && h.coord) hs.set(h.coord, h);
  }
  const n = Number.isFinite(threshold) ? threshold : 2;
  const { items, evidence: usage } = usageByHeader({ headers: [...hs.values()], zCarriers, qualifying, taPubkey });

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

/** "kind:pubkey:d" → the pubkey: an a-tag coordinate names its own author. */
const coordAuthor = (coord) => String(coord).split(':')[1];
/** The row's display name, else its d-tag. */
const sortName = (e) => (e.name || String(e.coord).split(':').slice(2).join(':')).toLowerCase();

/**
 * Dictionary › Concepts — one person's dictionary (the owner's correction of
 * 2026-09-29). Rows arrive PRE-CLASSIFIED at the handler seam: the person's
 * concept headers that carry a real b-tag, as
 * {coord, name, plural, description, author, selfDeclared, targets,
 *  scoreCoords, isFirmware}. `scoreCoords` are the shared concepts the row
 * points to by coordinate — itself when self-declared.
 *
 * Each entry's `gum` is GUM₁ of the best-scoring of its scoreCoords: the
 * number computeDictionary gives that concept (same exclusions, same
 * qualifying set), named in `sharedCoord`. A row that points only at event
 * ids scores 0 with sharedCoord null. `totalAuthorCount` / `totalEventCount`
 * are that shared concept's evidence totals. `itemCount` counts every event
 * z-filed under the row's OWN header. No threshold: the score describes an
 * entry, it does not admit one. Sorted by name.
 */
function computeConceptDictionary({ rows, zCarriers, qualifying, taPubkey } = {}) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r.coord === 'string' && r.coord);
  const coords = new Set();
  for (const r of list) {
    coords.add(r.coord);
    for (const c of Array.isArray(r.scoreCoords) ? r.scoreCoords : []) {
      if (typeof c === 'string' && c) coords.add(c);
    }
  }
  const { items, evidence } = usageByHeader({
    headers: [...coords].map((coord) => ({ coord, author: coordAuthor(coord) })),
    zCarriers,
    qualifying,
    taPubkey,
  });

  const entries = list.map((r) => {
    let best = null; // first wins a tie, so tag order decides between equals
    for (const c of Array.isArray(r.scoreCoords) ? r.scoreCoords : []) {
      if (typeof c !== 'string' || !c) continue;
      const u = evidence.get(c) || null;
      const gum = u ? u.qa.size : 0;
      if (!best || gum > best.gum) best = { coord: c, gum, u };
    }
    return {
      coord: r.coord,
      name: r.name || null,
      plural: r.plural || null,
      description: r.description || null,
      author: r.author,
      targets: Array.isArray(r.targets) ? [...r.targets] : [],
      selfDeclared: !!r.selfDeclared,
      isFirmware: !!r.isFirmware,
      itemCount: items.has(r.coord) ? items.get(r.coord).size : 0,
      sharedCoord: best ? best.coord : null,
      gum: best ? best.gum : 0, // GUM₁ of the shared concept
      totalAuthorCount: best && best.u ? best.u.aa.size : 0,
      totalEventCount: best && best.u ? best.u.ev.size : 0,
      override: null, // version 2: the owner's add-to-dictionary pinning
    };
  });
  entries.sort((a, b) => sortName(a).localeCompare(sortName(b)) || a.coord.localeCompare(b.coord));

  return { entries, metric: METRIC };
}

module.exports = { computeDictionary, computeConceptDictionary, usageByHeader };
