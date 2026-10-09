/**
 * POST /api/dictionaries/concepts/new — Create New Concept on /dictionary, signed by the caller's own
 * Assistant (the owner's decision of 2026-10-02).
 *
 *   body: { singular, plural, description?, target?, copyFrom? }
 *
 * A concept here is a DList header (kind 39998): d (the singular name's slug, src/lib/dtag.js
 * headerDTag), names, an optional description, and one pointer b-tag. Without `target` the b points to
 * the header itself, so it is shared as it is created. With `target` (a list header's address, from the
 * Dictionary's "Don't see what you're looking for?" finder) it points there, so the header is wired to
 * that shared concept and joins the caller's Dictionary in one step. With `copyFrom` too (the id of the
 * shared header's version the page showed), the header is a copy of that version: every tag of it but
 * the ones src/lib/conceptHeaderCopy.js leaves out or replaces (the owner's rule of 2026-10-02). That
 * version is read by its id from this instance's relay, else the community relay, and must verify and be
 * at the target's address; one that isn't there any more is refused (409 `source-missing`), and so is one
 * the community relay couldn't be asked for (502 `source-unreachable`): never guessed at. Every signed-in person (owner,
 * admin or customer) creates through here, and the header is always their own Assistant's: no
 * nostr-extension path and no fallback to another key.
 *
 * The rules of the My Assistant disposition endpoints (src/api/list-headers/myAssistantDisposition.js,
 * ADR list-headers-disposition/0003 and its Amendment 1), in order: the same host (another site is
 * refused), a verified session (requireAuth), the CALLER's own Assistant keys (none: refused, never the
 * owner's), the fields, then never replace — a verified header the Assistant already has at that d-tag on
 * this instance's relay stops it (409, with its address) — then sign with those keys, the local relay, and a
 * read-back by id (strfry import exits 0 even when it rejects an event). Nothing is broadcast here; the
 * browser sends the header to the community relay, as the disposition actions do. No graph node is made:
 * as before this endpoint, a Dictionary concept is a header, not a Neo4j concept.
 *
 * Every side effect is injected through createNewConceptHandler(deps), so the branch logic is testable
 * without the stack (test/dictionary-wired-create.test.js).
 */

'use strict';

const { headerDTag } = require('../../lib/dtag');
const { copiedHeaderTags } = require('../../lib/conceptHeaderCopy');
const { sameHost, firstD, defaultDeps: dispositionDeps } = require('../list-headers/myAssistantDisposition');

const ROUTE = '/api/dictionaries/concepts/new';
const HEADER_KIND = 39998;
// strfry looks up tag values of at most 255 bytes (MAX_INDEXED_TAG_VAL_SIZE, its src/constants.h): a filter
// carrying a longer one fails outright. The Dictionary reads every row's own address and its b-target in
// one #z filter, so either one longer than that would make the reader's whole Dictionary unreadable. Both
// are bounded here; `names` and `description` aren't looked up, so only the relay's event size bounds them.
const MAX_FILTER_VALUE_BYTES = 255;
const MAX_D_BYTES = MAX_FILTER_VALUE_BYTES - `${HEADER_KIND}:`.length - 64 - 1; // 184: the address stays lookupable
const LIST_HEADER_ADDRESS_RE = /^39998:([0-9a-f]{64}):(.+)$/;
const CONTROL_RE = /\p{Cc}/u;
// A description is typed in a text area, so it may keep its line breaks and tabs.
const DESCRIPTION_CONTROL_RE = /(?![\n\r\t])\p{Cc}/u;
const ADDRESS_FORMAT_RE = /[\p{Cc}\p{Cf}]/u;

const NO_ASSISTANT = 'You have no Tapestry Assistant on this instance, so there is no key to create the concept with';
// The community relay the finder searches (ui/src/hooks/useCommunitySharedConcepts.js COMMUNITY_RELAYS; the
// server's own constant in src/api/concept/sharingState.js).
const COMMUNITY_RELAY = 'wss://dcosl.brainstorm.world';
const EVENT_ID_RE = /^[0-9a-f]{64}$/;

/**
 * The unsigned header, exactly as Create New Concept's preview shows it (ui/src/pages/dictionary/
 * newConceptDraft.js conceptHeaderDraft, and with a `source` the shared copiedHeaderTags; the suite holds
 * them equal). `fields` are already checked.
 */
function composeConceptHeader({ singular, plural, description, signer, target, now, source }) {
  const d = headerDTag(singular);
  if (source && target) {
    return { kind: HEADER_KIND, created_at: now, content: '', tags: copiedHeaderTags({ source, d, singular, plural, description, target }) };
  }
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
  const copyFrom = text(b.copyFrom);
  if (singular === null || plural === null || description === null || target === null || copyFrom === null) {
    return { error: 'singular, plural, description, target and copyFrom must be text' };
  }
  if (copyFrom && !target) return { error: 'copyFrom names the shared header to copy, so it needs a target' };
  if (copyFrom && !EVENT_ID_RE.test(copyFrom)) return { error: "copyFrom must be the shared header's event id" };
  if (!singular || !plural) return { error: 'Both the singular and the plural name are needed' };
  if (CONTROL_RE.test(singular) || CONTROL_RE.test(plural)) return { error: "A name can't contain control characters" };
  if (DESCRIPTION_CONTROL_RE.test(description)) return { error: "The description can't contain control characters" };
  const d = headerDTag(singular);
  if (!d) return { error: 'The singular name needs at least one Latin letter or digit, which make its header’s d-tag' };
  if (bytes(d) > MAX_D_BYTES) {
    return { error: `The singular name is too long: its d-tag would be ${bytes(d)} characters, and this relay can look up at most ${MAX_D_BYTES}` };
  }
  if (target) {
    if (ADDRESS_FORMAT_RE.test(target)) return { error: "The shared concept's address contains characters an address can't have" };
    if (bytes(target) > MAX_FILTER_VALUE_BYTES) {
      return { error: `The shared concept's address is longer than this relay can look up (${MAX_FILTER_VALUE_BYTES} bytes), so a concept wired to it couldn't be read back` };
    }
    if (!LIST_HEADER_ADDRESS_RE.test(target)) return { error: "The shared concept must be a list header's address (39998:pubkey:d-tag)" };
  }
  return { fields: { singular, plural, description, target: target || null, copyFrom: copyFrom || null } };
}

function defaultDeps() {
  const d = dispositionDeps();
  return {
    requireAuth: d.requireAuth,
    getAssistantKeys: d.getAssistantKeys,
    // Every match, not the newest: #d matches any d tag, so the newest match can live at another address.
    scanAll: (filter) => require('../concept/bDisposition').strfryScanStream(filter),
    sign: d.sign,
    publishLocal: d.publishLocal,
    isStored: d.isStored,
    verify: d.verify,
    readCommunity,
    now: d.now,
  };
}

/**
 * The community relay, read strictly: every event it serves for the filter, signatures re-checked
 * (relaySource). { status: 'ok' | 'unreachable', events }: a relay that couldn't be read is never an
 * empty answer.
 */
async function readCommunity(filter) {
  const r = await require('../_shared/relaySource').readRelayEvents(COMMUNITY_RELAY, filter);
  return { status: r && r.status === 'ok' ? 'ok' : 'unreachable', events: (r && r.events) || [] };
}

/**
 * The shared header's version `id`, at `target`, verified: from this instance's relay, else the community
 * relay. { event } or { code, error }.
 */
async function readSource(d, id, target) {
  const pubkey = target.split(':')[1];
  const pick = (events) => (Array.isArray(events) ? events : []).find((ev) => ev && ev.id === id) || null;
  let ev = pick(await d.scanAll({ ids: [id] }));
  if (!ev) {
    let read;
    try { read = await d.readCommunity({ ids: [id], kinds: [HEADER_KIND], authors: [pubkey] }); } catch { read = null; }
    if (!read || read.status !== 'ok') {
      return { code: 'source-unreachable', error: "Couldn't reach the community relay to read the shared concept's header, so nothing was created. Try again" };
    }
    ev = pick(read.events);
  }
  if (!ev) {
    return { code: 'source-missing', error: "The shared concept's header the page showed isn't on this instance's relay or the community relay now, so it can't be copied" };
  }
  if (ev.kind !== HEADER_KIND || `${HEADER_KIND}:${ev.pubkey}:${firstD(ev)}` !== target || !d.verify(ev)) {
    return { code: 'source-mismatch', error: "The header named to copy isn't a verified version of the shared concept's header" };
  }
  return { event: ev };
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

      const dTag = headerDTag(fields.singular);
      const coord = `${HEADER_KIND}:${keys.pubkey}:${dTag}`;
      if (fields.target === coord) {
        return res.status(400).json({ success: false, error: "That's your Assistant's own concept at this name, so there's nothing to wire it to" });
      }

      // Never replace: a kind-39998 event at the same d-tag would. Any match that is verifiably the Assistant's
      // header at exactly this address stops it. strfry places an event by its first d tag but matches #d on
      // every d tag, and the relay can hold unverified imports, so each match is checked, not just the newest.
      const matches = await d.scanAll({ kinds: [HEADER_KIND], authors: [keys.pubkey], '#d': [dTag] });
      const atThisAddress = (ev) => ev && ev.pubkey === keys.pubkey && ev.kind === HEADER_KIND && firstD(ev) === dTag && d.verify(ev);
      if ((Array.isArray(matches) ? matches : []).some(atThisAddress)) {
        return res.status(409).json({
          success: false, code: 'exists', coord,
          error: 'Your Assistant already has a concept header at this name on this instance, so creating it would replace it',
        });
      }

      let source = null;
      if (fields.copyFrom) {
        const read = await readSource(d, fields.copyFrom, fields.target);
        if (!read.event) {
          const status = read.code === 'source-missing' ? 409 : read.code === 'source-unreachable' ? 502 : 400;
          return res.status(status).json({ success: false, code: read.code, error: read.error });
        }
        source = read.event;
      }
      const template = composeConceptHeader({ ...fields, signer: keys.pubkey, now: d.now(), source });

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

module.exports = {
  ROUTE, MAX_FILTER_VALUE_BYTES, MAX_D_BYTES, composeConceptHeader, readFields, createNewConceptHandler, register, readSource, readCommunity,
};
