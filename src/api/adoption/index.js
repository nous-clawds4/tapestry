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
const { dispositionOf } = require('../../lib/bValueForms');

const REGISTRY_SLUG = 'shared-concept';
const LEDGER_SLUG = 'adoption-disposition';

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

function registerAdoptionRoutes(app) {
  app.get('/api/adoption-queue', handleAdoptionQueue);
}

module.exports = { registerAdoptionRoutes };
