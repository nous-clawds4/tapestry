/**
 * Adoption queue — the server-assembled read (ADR shared-concepts-adoption/0002).
 *
 * GET /api/adoption-queue  (public read, the sibling-instrument posture)
 *   → { success, nominations: [{coord, name, author, eventCount, authorCount,
 *      usedByMe}], declined: [{target, name, author, decidedOn}] }
 *
 * Assembly: five STREAMING strfry scans (fix/adoption-queue-stream-scan: a
 * deployed corpus can exceed any fixed exec buffer — staging's did at 16MB —
 * so each scan streams line-by-line and keeps only a slim projection; memory
 * follows the projected result, never the corpus), piped through the pure
 * arithmetic core (src/lib/adoptionQueue.js). The endpoint never writes.
 */

'use strict';

const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
const { strfryScanStream } = require('../concept/bDisposition');
const { computeQueue } = require('../../lib/adoptionQueue');

const REGISTRY_SLUG = 'shared-concept';
const LEDGER_SLUG = 'adoption-disposition';

const keepTags = (ev, names) => (ev.tags || []).filter((t) => t && names.includes(t[0]));

async function handleAdoptionQueue(req, res) {
  try {
    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'TA pubkey unavailable' });
    }

    // 1. All local kind-39998 headers, projected slim; foreign = author ≠ TA.
    const foreignHeaders = await strfryScanStream({ kinds: [39998] }, (ev) => (
      ev.pubkey === taPubkey ? null : {
        kind: ev.kind, pubkey: ev.pubkey, created_at: ev.created_at, id: ev.id,
        tags: keepTags(ev, ['d', 'names', 'name']),
      }
    ));
    const coords = [];
    for (const ev of foreignHeaders) {
      const d = ev.tags.find((t) => t[0] === 'd')?.[1];
      if (d != null) coords.push(`${ev.kind}:${ev.pubkey}:${d}`);
    }

    // 2–5. Carriers for those coords; my b-values (S2a); registry; ledger.
    const [zCarriers, myBTargetArrays, registryRecords, dispositionRecords] = await Promise.all([
      coords.length
        ? strfryScanStream({ '#z': coords }, (ev) => {
          const z = keepTags(ev, ['z']);
          return z.length ? { pubkey: ev.pubkey, id: ev.id, tags: z } : null;
        })
        : Promise.resolve([]),
      strfryScanStream({ authors: [taPubkey], kinds: [39998, 39999] }, (ev) => {
        const bs = (ev.tags || []).filter((t) => t && t[0] === 'b' && typeof t[1] === 'string' && t[1]).map((t) => t[1]);
        return bs.length ? bs : null;
      }),
      strfryScanStream({ kinds: [39999], '#z': [`39998:${taPubkey}:${REGISTRY_SLUG}`] }, (ev) => ({
        pubkey: ev.pubkey, created_at: ev.created_at, tags: keepTags(ev, ['json']),
      })),
      strfryScanStream({ kinds: [39999], '#z': [`39998:${taPubkey}:${LEDGER_SLUG}`] }, (ev) => ({
        pubkey: ev.pubkey, created_at: ev.created_at, tags: keepTags(ev, ['json']),
      })),
    ]);

    const myBTargets = myBTargetArrays.flat();

    const out = computeQueue({ foreignHeaders, zCarriers, myBTargets, registryRecords, dispositionRecords, taPubkey });
    return res.json({ success: true, ...out });
  } catch (error) {
    console.error('adoption-queue error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

function registerAdoptionRoutes(app) {
  app.get('/api/adoption-queue', handleAdoptionQueue);
}

module.exports = { registerAdoptionRoutes };
