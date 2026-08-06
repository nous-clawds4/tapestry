/**
 * b-disposition endpoints — the wire-external and keep-private halves of the
 * three-action coverage discipline (ADR shared-concepts-adoption/0001; the
 * third action is the sibling selfDeclare.js).
 *
 * POST /api/concept/:handle/b-append  { target }   (owner-only)
 *   Appends ['b', <target-a-tag>, 'pointer'] to the instance's own header —
 *   the generalized form of selfDeclare's self-pointing append; F1's adoption
 *   queue consumes this primitive. Append-only for real tags; any sentinel is
 *   REPLACED (re-disposition rule); idempotent on a repeated target. Returns
 *   the signed event so the browser can broadcast it to the community relay.
 *
 * POST /api/concept/:handle/b-defer   {}           (owner-only)
 *   Appends the reserved sentinel ['b', 'b-tag-deferred'] — "deliberately no
 *   shared affiliation" — ONLY when the header carries no real b (a real
 *   claim always beats deferral; domain refusal otherwise, HTTP 200
 *   {success:false} per the house contract). Idempotent when already
 *   deferred. Never broadcast: deferral is a stance, not an announcement.
 *
 * Both re-sign as the TA (provenance: only this instance's own headers —
 * never another author's event), publish to local strfry, and import to
 * Neo4j via the normalize/helpers spine (the OPEN.md #142 "good copy").
 */

'use strict';

const { exec } = require('child_process');
const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
const { isOwner } = require('../../middleware/auth');
const { loadTAKey, signAndFinalize, publishToStrfry, importEventDirect } = require('../normalize/helpers');
const { SENTINEL, classifyBValue, stripSentinel } = require('../../lib/bValueForms');

/**
 * Owner-only gate, loopback-operable (the publishEvent.js:37 pattern; ADR
 * 0001's dated correction note): the session owner or a genuinely-direct-local
 * caller (req.localTrusted — unspoofable, ADR security-auth-exposure/0001).
 * Returns true when refused (response already sent).
 */
function refuseUnlessOwnerOrLocal(req, res) {
  if (isOwner(req) || req.localTrusted) return false;
  res.status(403).json({ success: false, error: 'Disposition requires owner authentication' });
  return true;
}

const HANDLE_RE = /^(\d+):([0-9a-f]{64}):(.+)$/;

function strfryScan(filter) {
  return new Promise((resolve, reject) => {
    const safeFilter = JSON.stringify(filter).replace(/'/g, "'\\''");
    exec(`strfry scan '${safeFilter}'`, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(error);
      const events = [];
      for (const line of String(stdout).trim().split('\n')) {
        if (!line) continue;
        try { events.push(JSON.parse(line)); } catch {}
      }
      resolve(events);
    });
  });
}

/**
 * Resolve the latest version of one of THIS instance's own headers, or answer
 * with the appropriate error. Returns null after responding on failure.
 */
async function resolveLatestOwnHeader(req, res) {
  const handle = decodeURIComponent(req.params.handle || '');
  const m = handle.match(HANDLE_RE);
  if (!m) {
    res.status(400).json({ success: false, error: 'handle must be kind:pubkey:d-tag' });
    return null;
  }
  const kind = Number(m[1]);
  const pubkey = m[2];
  const dTag = m[3];

  const taPubkey = getOwnerAssistantPubkey();
  if (!taPubkey) {
    res.status(500).json({ success: false, error: 'TA pubkey unavailable' });
    return null;
  }
  if (pubkey !== taPubkey) {
    res.status(400).json({
      success: false,
      error: "Only this instance's own concept headers can be dispositioned",
    });
    return null;
  }

  const events = await strfryScan({ kinds: [kind], authors: [taPubkey], '#d': [dTag] });
  const header = events.reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
  if (!header) {
    res.status(404).json({ success: false, error: `No local header event found for ${handle}` });
    return null;
  }
  return { kind, dTag, taPubkey, header, selfCoord: `${kind}:${taPubkey}:${dTag}` };
}

async function resignWithTags(kind, content, newTags, selfCoord, prevCreatedAt) {
  await loadTAKey();
  // Strictly newer than the version being replaced: two re-signs in the same
  // second would otherwise tie on created_at and strfry's replaceable-event
  // tie-break (lowest id wins) can DROP the newer version — a real race when
  // the owner re-dispositions immediately (defer → wire in one panel visit).
  const created_at = Math.max(Math.floor(Date.now() / 1000), (prevCreatedAt || 0) + 1);
  const signed = signAndFinalize({ kind, content: content || '', tags: newTags, created_at });
  await publishToStrfry(signed);
  await importEventDirect(signed, selfCoord);
  return signed;
}

async function handleBAppend(req, res) {
  try {
    if (refuseUnlessOwnerOrLocal(req, res)) return;
    const resolved = await resolveLatestOwnHeader(req, res);
    if (!resolved) return;
    const { kind, header, selfCoord } = resolved;

    const target = (req.body && req.body.target || '').trim();
    if (classifyBValue(target) !== 'a-tag') {
      return res.status(400).json({ success: false, error: 'target must be an a-tag coordinate (kind:pubkey:d-tag)' });
    }
    if (target === selfCoord) {
      return res.status(400).json({ success: false, error: 'the self-pointing b is self-declare\'s lane — use /self-declare' });
    }

    const alreadyWired = (header.tags || []).some((t) => t[0] === 'b' && t[1] === target);
    if (alreadyWired) {
      return res.json({ success: true, result: 'already-wired', event: header });
    }

    // Append-only for real tags; a stale sentinel is replaced (ADR 0001).
    const newTags = [...stripSentinel(header.tags || []), ['b', target, 'pointer']];
    const signed = await resignWithTags(kind, header.content, newTags, selfCoord, header.created_at);
    return res.json({ success: true, result: 'wired', event: signed });
  } catch (error) {
    console.error('concept/b-append error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function handleBDefer(req, res) {
  try {
    if (refuseUnlessOwnerOrLocal(req, res)) return;
    const resolved = await resolveLatestOwnHeader(req, res);
    if (!resolved) return;
    const { kind, header, selfCoord } = resolved;

    const bValues = (header.tags || []).filter((t) => t[0] === 'b').map((t) => t[1]);
    const hasReal = bValues.some((v) => ['a-tag', 'event-id'].includes(classifyBValue(v)));
    if (hasReal) {
      // Domain refusal (HTTP 200, the house contract): a real affiliation
      // stands; deferral never removes a real b.
      return res.json({ success: false, error: 'this header already carries a real b — deferral applies only to unaffiliated headers' });
    }
    if (bValues.includes(SENTINEL)) {
      return res.json({ success: true, result: 'already-deferred', event: header });
    }

    const newTags = [...(header.tags || []), ['b', SENTINEL]];
    const signed = await resignWithTags(kind, header.content, newTags, selfCoord, header.created_at);
    return res.json({ success: true, result: 'deferred', event: signed });
  } catch (error) {
    console.error('concept/b-defer error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { handleBAppend, handleBDefer };
