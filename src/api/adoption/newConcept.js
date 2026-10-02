/**
 * POST /api/dictionaries/concepts/new — Create New Concept on /dictionary, signed by the caller's own
 * Assistant (the owner's decision of 2026-10-02).
 *
 *   body: { singular, plural, description?, target? }
 *
 * A concept here is a DList header (kind 39998): d (the singular name's slug, src/lib/dtag.js
 * headerDTag), names, an optional description, and one pointer b-tag. Without `target` the b points to
 * the header itself, so it is shared as it is created. With `target` (a list header's address, from the
 * Dictionary's "Don't see what you're looking for?" finder) it points there, so the header is wired to
 * that shared concept and joins the caller's Dictionary in one step. Every signed-in person (owner,
 * admin or customer) creates through here, and the header is always their own Assistant's: no
 * nostr-extension path and no fallback to another key.
 *
 * The rules of the My Assistant disposition endpoints (src/api/list-headers/myAssistantDisposition.js,
 * ADR list-headers-disposition/0003 and its Amendment 1), in order: the same host (another site is
 * refused), a verified session (requireAuth), the CALLER's own Assistant keys (none: refused, never the
 * owner's), the fields, then never replace — any header the Assistant already has at that d-tag on this
 * instance's relay stops it (409, with its address) — then sign with those keys, the local relay, and a
 * read-back by id (strfry import exits 0 even when it rejects an event). Nothing is broadcast here; the
 * browser sends the header to the community relay, as the disposition actions do. No graph node is made:
 * as before this endpoint, a Dictionary concept is a header, not a Neo4j concept.
 *
 * Every side effect is injected through createNewConceptHandler(deps), so the branch logic is testable
 * without the stack (test/dictionary-wired-create.test.js).
 */

'use strict';

const { headerDTag } = require('../../lib/dtag');
const { sameHost, defaultDeps: dispositionDeps } = require('../list-headers/myAssistantDisposition');

const ROUTE = '/api/dictionaries/concepts/new';
const HEADER_KIND = 39998;
// The relay keeps tag values of at most 1024 bytes (maxTagValSize), and its import exits 0 when it rejects
// one, so every value is bounded here (ADR list-headers-disposition/0004, Amendment 1).
const MAX_VALUE_BYTES = 1024;
const LIST_HEADER_ADDRESS_RE = /^39998:([0-9a-f]{64}):(.+)$/;
const CONTROL_RE = /\p{Cc}/u;
// A description is typed in a text area, so it may keep its line breaks and tabs.
const DESCRIPTION_CONTROL_RE = /(?![\n\r\t])\p{Cc}/u;
const ADDRESS_FORMAT_RE = /[\p{Cc}\p{Cf}]/u;

const NO_ASSISTANT = 'You have no Tapestry Assistant on this instance, so there is no key to create the concept with';

/**
 * The unsigned header, exactly as Create New Concept's preview shows it (ui/src/pages/dictionary/
 * newConceptDraft.js conceptHeaderDraft; the suite holds the two equal). `fields` are already checked.
 */
function composeConceptHeader({ singular, plural, description, signer, target, now }) {
  const d = headerDTag(singular);
  const tags = [['d', d], ['names', singular, plural]];
  if (description) tags.push(['description', description]);
  tags.push(['b', target || `${HEADER_KIND}:${signer}:${d}`, 'pointer']);
  return { kind: HEADER_KIND, created_at: now, content: '', tags };
}

const bytes = (s) => Buffer.byteLength(s, 'utf8');

/** The body's fields, trimmed and checked: { fields } or { error }. */
function readFields(body) {
  const b = body && typeof body === 'object' ? body : {};
  const text = (v) => (typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : null);
  const singular = text(b.singular);
  const plural = text(b.plural);
  const description = text(b.description);
  const target = text(b.target);
  if (singular === null || plural === null || description === null || target === null) {
    return { error: 'singular, plural, description and target must be text' };
  }
  if (!singular || !plural) return { error: 'Both the singular and the plural name are needed' };
  for (const [label, v] of [['singular name', singular], ['plural name', plural], ['description', description]]) {
    if (bytes(v) > MAX_VALUE_BYTES) return { error: `The ${label} is too long — the relay keeps tag values of at most 1024 bytes` };
  }
  if (CONTROL_RE.test(singular) || CONTROL_RE.test(plural)) return { error: "A name can't contain control characters" };
  if (DESCRIPTION_CONTROL_RE.test(description)) return { error: "The description can't contain control characters" };
  if (!headerDTag(singular)) return { error: 'The singular name needs at least one Latin letter or digit, which make its header’s d-tag' };
  if (target) {
    if (ADDRESS_FORMAT_RE.test(target)) return { error: "The shared concept's address contains characters an address can't have" };
    if (bytes(target) > MAX_VALUE_BYTES) return { error: "The shared concept's address is too long — the relay keeps tag values of at most 1024 bytes" };
    if (!LIST_HEADER_ADDRESS_RE.test(target)) return { error: "The shared concept must be a list header's address (39998:pubkey:d-tag)" };
  }
  return { fields: { singular, plural, description, target: target || null } };
}

function defaultDeps() {
  const d = dispositionDeps();
  return {
    requireAuth: d.requireAuth,
    getAssistantKeys: d.getAssistantKeys,
    scanLatest: d.scanLatest,
    sign: d.sign,
    publishLocal: d.publishLocal,
    isStored: d.isStored,
    now: d.now,
  };
}

function createNewConceptHandler(deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  return async function handleNewConcept(req, res) {
    try {
      if (!sameHost(req)) return res.status(403).json({ success: false, error: 'a request from another site is refused' });

      const sessionPubkey = d.requireAuth(req, res);
      if (!sessionPubkey) return; // requireAuth has answered 401

      const keys = await d.getAssistantKeys(sessionPubkey);
      if (!keys || !keys.pubkey || !keys.privkey) {
        return res.status(403).json({ success: false, code: 'no-assistant', error: NO_ASSISTANT });
      }

      const { fields, error } = readFields(req.body);
      if (error) return res.status(400).json({ success: false, error });

      const template = composeConceptHeader({ ...fields, signer: keys.pubkey, now: d.now() });
      const dTag = template.tags[0][1];
      const coord = `${HEADER_KIND}:${keys.pubkey}:${dTag}`;

      // Never replace: a kind-39998 event at the same d-tag would.
      const existing = await d.scanLatest({ kinds: [HEADER_KIND], authors: [keys.pubkey], '#d': [dTag] });
      if (existing) {
        return res.status(409).json({
          success: false, code: 'exists', coord,
          error: 'Your Assistant already has a concept header at this name on this instance, so creating it would replace it',
        });
      }

      const signed = d.sign(template, keys.privkey);
      if (!signed || signed.pubkey !== keys.pubkey) {
        return res.status(500).json({ success: false, error: "The Assistant's key didn't sign as its own pubkey, so nothing was published" });
      }
      await d.publishLocal(signed);
      let stored;
      try {
        stored = await d.isStored(signed.id);
      } catch {
        return res.status(502).json({ success: false, error: "Sent to the relay, but couldn't confirm it was kept" });
      }
      if (!stored) return res.status(502).json({ success: false, error: "The relay didn't keep the new header, so nothing was saved" });
      return res.json({ success: true, event: signed, coord });
    } catch (err) {
      console.error('dictionaries/concepts/new error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  };
}

function register(app) {
  app.post(ROUTE, createNewConceptHandler());
}

module.exports = { ROUTE, composeConceptHeader, readFields, createNewConceptHandler, register };
