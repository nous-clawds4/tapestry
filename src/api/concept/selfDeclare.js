/**
 * Self-declare a concept as a Shared Concept — the `Submit as a Shared
 * Concept` affordance beside the story-#9 publish button.
 *
 * POST /api/concept/:handle/self-declare   (owner-only)
 *
 * Re-signs the local TA's ConceptHeader with a SELF-pointing b-tag appended
 * — ['b', '<kind>:<TA>:<d-tag>', 'pointer'] — publishes the new version to
 * local strfry and imports it into Neo4j, then returns the signed event so
 * the browser can broadcast it to the community relay (ADR 0004 Option A:
 * no server-side external publisher; the caller finishes the job with
 * publishToRelays).
 *
 * b-tag semantics per community-reference ADR 0029: the self-declaration is
 * pointer-typed, never inherit — a self-inherit would be a degenerate
 * deference loop and would pump the consensus signal the registry exists to
 * keep honest. Existing b-tags of ANY type are PRESERVED (append-only):
 * multi-b, mixed-type headers are ratified and expected. Idempotent: a
 * header already carrying the self-pointing b is returned as-is (result
 * 'already-declared', no re-sign), so a repeat click can re-broadcast a
 * previously declared header without minting a new version.
 */

'use strict';

const { exec } = require('child_process');
const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
const { isOwner } = require('../../middleware/auth');
const { loadTAKey, signAndFinalize, publishToStrfry, importEventDirect } = require('../normalize/helpers');
const { stripSentinel } = require('../../lib/bValueForms');

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

async function handleConceptSelfDeclare(req, res) {
  try {
    // Owner-only, loopback-operable (isOwner || localTrusted — the
    // publishEvent.js:37 pattern; ADR shared-concepts-adoption/0001's dated
    // correction extends it here so all three disposition actions share one gate).
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Self-declare requires owner authentication' });
    }
    const handle = decodeURIComponent(req.params.handle || '');
    const m = handle.match(HANDLE_RE);
    if (!m) {
      return res.status(400).json({ success: false, error: 'handle must be kind:pubkey:d-tag' });
    }
    const kind = Number(m[1]);
    const pubkey = m[2];
    const dTag = m[3];

    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'TA pubkey unavailable' });
    }
    // Provenance principle (as export-set AC-2): only this instance's own
    // headers — never re-sign another author's event under our identity.
    if (pubkey !== taPubkey) {
      return res.status(400).json({
        success: false,
        error: "Only this instance's own concept headers can be self-declared",
      });
    }

    const events = await strfryScan({ kinds: [kind], authors: [taPubkey], '#d': [dTag] });
    const header = events.reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
    if (!header) {
      return res.status(404).json({ success: false, error: `No local header event found for ${handle}` });
    }

    const selfCoord = `${kind}:${taPubkey}:${dTag}`;
    const alreadyDeclared = (header.tags || []).some(
      (t) => t[0] === 'b' && t[1] === selfCoord,
    );
    if (alreadyDeclared) {
      return res.json({ success: true, result: 'already-declared', event: header });
    }

    // Append-only: every existing REAL tag — including other b-tags — survives.
    // One carve-out (ADR shared-concepts-adoption/0001): a `b-tag-deferred`
    // sentinel is a disposition marker, not a correspondence claim, and is
    // REPLACED when a real b arrives.
    const newTags = [...stripSentinel(header.tags || []), ['b', selfCoord, 'pointer']];
    await loadTAKey();
    // Strictly newer than the replaced version — a same-second re-sign ties on
    // created_at and strfry's tie-break can drop the newer event (the
    // defer-then-declare race; ADR shared-concepts-adoption/0001).
    const signed = signAndFinalize({
      kind, content: header.content || '', tags: newTags,
      created_at: Math.max(Math.floor(Date.now() / 1000), (header.created_at || 0) + 1),
    });
    await publishToStrfry(signed);
    await importEventDirect(signed, selfCoord);

    return res.json({ success: true, result: 'declared', event: signed });
  } catch (error) {
    console.error('concept/self-declare error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { handleConceptSelfDeclare };
