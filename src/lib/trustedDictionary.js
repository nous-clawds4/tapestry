/**
 * Trusted-dictionary arithmetic — the single owner of the S3b-with-threshold
 * semantics (ADR shared-concepts-adoption/0005; the owner's taxonomy, intake
 * 2026-08-05; scoring semantics ratified at /discuss 2026-08-07).
 *
 * computeDictionary({headers, zCarriers, qualifying, threshold, taPubkey})
 *   → { entries }
 *
 * Headers arrive PRE-CLASSIFIED at the handler seam
 * ({coord, name, author, isMine, bState}) and the qualifying set — the
 * carrier authors whose influence clears the verified cutoff from the active
 * POV — is resolved at the same seam, so this core never touches Neo4j or b
 * semantics (the ADR 0003 pattern).
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
 * Pure CJS, zero requires. The UI never re-derives this — it renders the
 * server-assembled result.
 */

'use strict';

function computeDictionary({ headers, zCarriers, qualifying, threshold, taPubkey } = {}) {
  const hs = new Map(); // coord → { name, author, isMine, bState }
  for (const h of Array.isArray(headers) ? headers : []) {
    if (h && typeof h.coord === 'string' && h.coord) hs.set(h.coord, h);
  }
  const q = qualifying instanceof Set ? qualifying : new Set(Array.isArray(qualifying) ? qualifying : []);
  const n = Number.isFinite(threshold) ? threshold : 2;

  const usage = new Map(); // coord → { qa:Set, aa:Set, ev:Set }
  for (const ev of Array.isArray(zCarriers) ? zCarriers : []) {
    if (!ev || typeof ev.pubkey !== 'string') continue;
    for (const t of ev.tags || []) {
      if (!t || t[0] !== 'z' || !hs.has(t[1])) continue;
      const h = hs.get(t[1]);
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
      author: h.author,
      isMine: !!h.isMine,
      sentinelDeferred: h.bState === 'deferred',
      qualifyingAuthorCount: u.qa.size,
      totalAuthorCount: u.aa.size,
      totalEventCount: u.ev.size,
    });
  }
  entries.sort((a, b) => b.qualifyingAuthorCount - a.qualifyingAuthorCount
    || b.totalEventCount - a.totalEventCount);

  return { entries };
}

module.exports = { computeDictionary };
