/**
 * Adoption queue — the server-assembled read for the whole adoption loop
 * (ADRs shared-concepts-adoption/0002 + 0003).
 *
 * GET /api/adoption-queue  (public read, the sibling-instrument posture)
 *   → { success,
 *       nominations, declined,                  — F1: theirs to adopt (byte-compatible)
 *       publishCandidates, deferredInUse }      — F2: mine to publish (additive)
 *
 * Assembly: streaming strfry scans with slim per-event projections (the #500
 * corpus-scale fix — memory follows the projection, never the corpus), piped
 * through the pure arithmetic cores (src/lib/adoptionQueue.js). My headers are
 * classified at THIS seam via bValueForms.dispositionOf (the b-semantics
 * single owner), so the cores stay zero-require. The endpoint never writes.
 */

'use strict';

const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
const { strfryScanStream } = require('../concept/bDisposition');
const { computeQueue, computePublishCandidates, bestName } = require('../../lib/adoptionQueue');
const { computeDictionary } = require('../../lib/trustedDictionary');
const { dispositionOf } = require('../../lib/bValueForms');
const { runCypher } = require('../../lib/neo4j-driver');
const { getConfigFromFile } = require('../../utils/config');

const REGISTRY_SLUG = 'shared-concept';
const LEDGER_SLUG = 'adoption-disposition';
const DICTIONARY_SNAPSHOT_SLUG = 'trusted-dictionary-snapshot';

const keepTags = (ev, names) => (ev.tags || []).filter((t) => t && names.includes(t[0]));

async function handleAdoptionQueue(req, res) {
  try {
    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'TA pubkey unavailable' });
    }

    // 1. All local kind-39998 headers, projected slim — BOTH populations
    //    (ADR 0003: the TA-authored ones, once discarded, are F2's input).
    const allHeaders = await strfryScanStream({ kinds: [39998] }, (ev) => ({
      kind: ev.kind, pubkey: ev.pubkey, created_at: ev.created_at, id: ev.id,
      tags: keepTags(ev, ['d', 'names', 'name', 'b']),
    }));
    const foreignHeaders = [];
    const mineNewest = new Map(); // d-tag → newest slim header
    for (const ev of allHeaders) {
      if (ev.pubkey !== taPubkey) { foreignHeaders.push(ev); continue; }
      const d = ev.tags.find((t) => t[0] === 'd')?.[1];
      if (d == null) continue;
      const prev = mineNewest.get(d);
      if (!prev || (ev.created_at || 0) > (prev.created_at || 0)) mineNewest.set(d, ev);
    }

    const foreignCoords = [];
    for (const ev of foreignHeaders) {
      const d = ev.tags.find((t) => t[0] === 'd')?.[1];
      if (d != null) foreignCoords.push(`${ev.kind}:${ev.pubkey}:${d}`);
    }

    // Classification at the seam (ADR 0003): my headers → {coord, name, bState}.
    const myHeaders = [];
    const myCoords = [];
    for (const [d, ev] of mineNewest) {
      const coord = `39998:${taPubkey}:${d}`;
      const bValues = ev.tags.filter((t) => t[0] === 'b').map((t) => t[1]);
      const disp = dispositionOf(bValues, coord);
      const bState = (disp.wired || disp.selfDeclared) ? 'real' : (disp.deferred ? 'deferred' : 'none');
      myHeaders.push({ coord, name: bestName(ev), bState });
      myCoords.push(coord);
    }

    // 2–6. Union #z carriers; my b-values (S2a); foreign #b affiliations on my
    //      coords; registry; ledger.
    const zScanCoords = [...foreignCoords, ...myCoords];
    const [zCarriers, myBTargetArrays, bCarriers, registryRecords, dispositionRecords] = await Promise.all([
      zScanCoords.length
        ? strfryScanStream({ '#z': zScanCoords }, (ev) => {
          const z = keepTags(ev, ['z']);
          return z.length ? { pubkey: ev.pubkey, id: ev.id, tags: z } : null;
        })
        : Promise.resolve([]),
      strfryScanStream({ authors: [taPubkey], kinds: [39998, 39999] }, (ev) => {
        const bs = (ev.tags || []).filter((t) => t && t[0] === 'b' && typeof t[1] === 'string' && t[1]).map((t) => t[1]);
        return bs.length ? bs : null;
      }),
      myCoords.length
        ? strfryScanStream({ '#b': myCoords }, (ev) => {
          const bs = keepTags(ev, ['b']);
          return bs.length ? { pubkey: ev.pubkey, id: ev.id, tags: bs } : null;
        })
        : Promise.resolve([]),
      strfryScanStream({ kinds: [39999], '#z': [`39998:${taPubkey}:${REGISTRY_SLUG}`] }, (ev) => ({
        pubkey: ev.pubkey, created_at: ev.created_at, tags: keepTags(ev, ['json']),
      })),
      strfryScanStream({ kinds: [39999], '#z': [`39998:${taPubkey}:${LEDGER_SLUG}`] }, (ev) => ({
        pubkey: ev.pubkey, created_at: ev.created_at, tags: keepTags(ev, ['json']),
      })),
    ]);

    const myBTargets = myBTargetArrays.flat();

    const adopt = computeQueue({ foreignHeaders, zCarriers, myBTargets, registryRecords, dispositionRecords, taPubkey });
    const publish = computePublishCandidates({ myHeaders, zCarriers, bCarriers, taPubkey });

    return res.json({
      success: true,
      ...adopt,
      publishCandidates: publish.candidates,
      deferredInUse: publish.deferredInUse,
    });
  } catch (error) {
    console.error('adoption-queue error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * The trusted dictionary (ADR shared-concepts-adoption/0005) — S3b with a
 * minimum-trusted-users threshold, computed at read time from the active POV.
 *
 * The qualifying set resolves against Neo4j at THIS seam (house:
 * NostrUser.influence; personalized: the observer's NostrUserWotMetricsCard
 * rows — main-pubkey identity, deliberately NOT the Meili suffix world, W13);
 * the arithmetic stays in the pure core (src/lib/trustedDictionary.js).
 * Shared by the GET below and the snapshot mint in src/api/normalize
 * (which recomputes server-side — a client-posted member list is never
 * trusted).
 */
async function assembleTrustedDictionary({ wotPov, userPubkey } = {}) {
  const taPubkey = getOwnerAssistantPubkey();
  if (!taPubkey) throw new Error('TA pubkey unavailable');

  const cutoff = parseFloat(getConfigFromFile('VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF', 0.01));
  const threshold = parseInt(getConfigFromFile('TRUSTED_DICTIONARY_MIN_USERS', 2), 10);

  // Both header populations, slim, newest per coordinate (defensive against
  // replaceable-version residue — the handleAdoptionQueue idiom).
  const allHeaders = await strfryScanStream({ kinds: [39998] }, (ev) => ({
    kind: ev.kind, pubkey: ev.pubkey, created_at: ev.created_at,
    tags: keepTags(ev, ['d', 'names', 'name', 'b']),
  }));
  const newest = new Map(); // coord → slim header
  for (const ev of allHeaders) {
    const d = ev.tags.find((t) => t[0] === 'd')?.[1];
    if (d == null) continue;
    const coord = `${ev.kind}:${ev.pubkey}:${d}`;
    const prev = newest.get(coord);
    if (!prev || (ev.created_at || 0) > (prev.created_at || 0)) newest.set(coord, ev);
  }
  const headers = [];
  for (const [coord, ev] of newest) {
    const isMine = ev.pubkey === taPubkey;
    let bState = 'none';
    if (isMine) {
      const bValues = ev.tags.filter((t) => t[0] === 'b').map((t) => t[1]);
      const disp = dispositionOf(bValues, coord);
      bState = (disp.wired || disp.selfDeclared) ? 'real' : (disp.deferred ? 'deferred' : 'none');
    }
    headers.push({ coord, name: bestName(ev), author: ev.pubkey, isMine, bState });
  }

  const coords = headers.map((h) => h.coord);
  const zCarriers = coords.length
    ? await strfryScanStream({ '#z': coords }, (ev) => {
      const z = keepTags(ev, ['z']);
      return z.length ? { pubkey: ev.pubkey, id: ev.id, tags: z } : null;
    })
    : [];

  // Distinct carrier authors → the bounded qualifying-set query. The
  // per-header exclusions (own author, the TA) live in the core; including
  // them here is harmless.
  const authors = [...new Set(zCarriers.map((ev) => ev.pubkey))].filter((p) => p && p !== taPubkey);

  const wantPersonalized = wotPov === 'user' && typeof userPubkey === 'string' && /^[0-9a-f]{64}$/.test(userPubkey);
  let branch = 'house';
  let fellBackToHouse = false;
  let observer = null;
  let qualifying = new Set();
  if (wantPersonalized) {
    // Availability probe: personalized scoring exists only for observers this
    // instance holds metrics cards for (W12's stance) — else house, disclosed.
    const probe = await runCypher(
      'MATCH (c:NostrUserWotMetricsCard {observer_pubkey: $observer}) RETURN count(c) AS n',
      { observer: userPubkey },
    );
    if (probe.length && Number(probe[0].n) > 0) {
      branch = 'personalized';
      observer = userPubkey;
    } else {
      fellBackToHouse = true; // requested own POV; this instance has no cards for it
    }
  }
  if (authors.length) {
    const rows = branch === 'personalized'
      ? await runCypher(
        'MATCH (c:NostrUserWotMetricsCard {observer_pubkey: $observer}) WHERE c.observee_pubkey IN $authors AND c.influence > $cutoff RETURN c.observee_pubkey AS pubkey',
        { observer: userPubkey, authors, cutoff },
      )
      : await runCypher(
        'MATCH (u:NostrUser) WHERE u.pubkey IN $authors AND u.influence > $cutoff RETURN u.pubkey AS pubkey',
        { authors, cutoff },
      );
    qualifying = new Set(rows.map((r) => r.pubkey));
  }

  const { entries } = computeDictionary({ headers, zCarriers, qualifying, threshold, taPubkey });

  return {
    entries,
    cutoff,
    threshold,
    taPubkey,
    pov: {
      branch,
      observer,
      fellBackToHouse,
      cutoff,
      threshold,
      computedAt: new Date().toISOString(),
    },
  };
}

async function handleTrustedDictionary(req, res) {
  try {
    const { wotPov, userPubkey } = req.query || {};
    const out = await assembleTrustedDictionary({ wotPov, userPubkey });

    // The dated ledger of published snapshots (slim strip; newest first).
    const snapshots = (await strfryScanStream(
      { kinds: [39999], '#z': [`39998:${out.taPubkey}:${DICTIONARY_SNAPSHOT_SLUG}`] },
      (ev) => {
        const jsonTag = (ev.tags || []).find((t) => t[0] === 'json');
        let sec = null;
        if (jsonTag && typeof jsonTag[1] === 'string') {
          try { sec = JSON.parse(jsonTag[1]).trustedDictionarySnapshot || null; } catch { sec = null; }
        }
        return {
          id: ev.id,
          created_at: ev.created_at,
          computedAt: sec ? sec.computedAt || null : null,
          memberCount: sec && Number.isFinite(sec.memberCount) ? sec.memberCount : null,
          pov: sec && sec.pov ? sec.pov.branch || null : null,
        };
      },
    )).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    return res.json({ success: true, entries: out.entries, snapshots, pov: out.pov });
  } catch (error) {
    console.error('trusted-dictionary error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

function registerAdoptionRoutes(app) {
  app.get('/api/adoption-queue', handleAdoptionQueue);
  app.get('/api/trusted-dictionary', handleTrustedDictionary);
}

module.exports = { registerAdoptionRoutes, assembleTrustedDictionary };
