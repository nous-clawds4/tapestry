/**
 * Adoption queue — the server-assembled read (ADR shared-concepts-adoption/0002).
 *
 * GET /api/adoption-queue  (public read, the sibling-instrument posture)
 *   → { success, nominations: [{coord, name, author, eventCount, authorCount,
 *      usedByMe}], declined: [{target, name, author, decidedOn}] }
 *
 * Assembly: five direct strfry scans (no chunking — the CLI has no URI limit,
 * unlike the browser's GET-query path that ActiveZTags works around), piped
 * through the pure arithmetic core (src/lib/adoptionQueue.js). The endpoint
 * never writes; actions live on the F5 primitive (b-append), the registry's
 * create-element, and the adoption-disposition producer.
 */

'use strict';

const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
const { strfryScan } = require('../concept/bDisposition');
const { computeQueue } = require('../../lib/adoptionQueue');

const REGISTRY_SLUG = 'shared-concept';
const LEDGER_SLUG = 'adoption-disposition';

async function handleAdoptionQueue(req, res) {
  try {
    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'TA pubkey unavailable' });
    }

    // 1. All local kind-39998 headers; foreign = author ≠ TA.
    const allHeaders = await strfryScan({ kinds: [39998] });
    const foreignHeaders = allHeaders.filter((ev) => ev.pubkey !== taPubkey);
    const coords = [];
    for (const ev of foreignHeaders) {
      const d = (ev.tags || []).find((t) => t[0] === 'd')?.[1];
      if (d != null) coords.push(`${ev.kind}:${ev.pubkey}:${d}`);
    }

    // 2–5. Carriers for those coords; my b-carriers (S2a); registry; ledger.
    const [zCarriers, myEvents, registryRecords, dispositionRecords] = await Promise.all([
      coords.length ? strfryScan({ '#z': coords }) : Promise.resolve([]),
      strfryScan({ authors: [taPubkey], kinds: [39998, 39999] }),
      strfryScan({ kinds: [39999], '#z': [`39998:${taPubkey}:${REGISTRY_SLUG}`] }),
      strfryScan({ kinds: [39999], '#z': [`39998:${taPubkey}:${LEDGER_SLUG}`] }),
    ]);

    const myBTargets = [];
    for (const ev of myEvents) {
      for (const t of ev.tags || []) {
        if (t && t[0] === 'b' && typeof t[1] === 'string' && t[1]) myBTargets.push(t[1]);
      }
    }

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
