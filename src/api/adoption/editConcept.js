/**
 * POST /api/dictionaries/concepts/edit — edit a Dictionary concept: the caller's own Assistant
 * publishes a new version of a header it wrote (the owner's request of 2026-10-02).
 *
 *   body: { coord, basedOn, singular, plural, description?, properties? }  (an omitted description or
 *   property list is removed, as an empty one is: the edit page always sends both)
 *
 * `coord` is the header's address (39998:<the caller's Assistant>:<d>). `basedOn` is the id of the
 * version the edit page loaded. `properties` is the Item Property Tags, whole (src/lib/conceptHeaderEdit.js
 * says what an edit changes and what it keeps; the d-tag and the b-tags are always kept).
 *
 * The rules of Create New Concept (./newConcept.js) and the My Assistant disposition endpoints, in order:
 * the same host, a verified session, the CALLER's own Assistant keys (none: refused, never the owner's),
 * the header must be that Assistant's, then the fields. Then the header's latest version: every match on
 * this instance's relay that is verifiably the Assistant's header at exactly this address (strfry places
 * an event by its first d tag but matches #d on any, and the relay can hold unverified imports), the
 * newest of them. None: 404 (409 `unverified` when the relay holds one there that doesn't verify). Not the
 * one the page loaded: 409 `changed`, with the latest, so the page can start again from it rather than
 * overwrite it. A rename is refused for a concept the server finds by its name (NAME_KEYED_CONCEPTS:
 * 400 `name-keyed`), and when another of the Assistant's headers already has that singular name (409
 * `name-taken`, with its address), because the server's name lookups would then find either one. No
 * change: answered without signing. Then sign with those
 * keys, the local relay, and a read-back by id. Last, the graph: if this instance's graph has a node for
 * the header, the new version is imported over it (BIBLE §30: the graph is the definitive self, so it
 * must not keep the old names); a header with no node gets none. Nothing is broadcast here; the browser
 * sends the new version to the community relay.
 *
 * Firmware headers can be edited (owner, 2026-10-02); the page warns that a firmware reinstall rebuilds
 * them from their built-in definitions (OPEN.md row 8). Every side effect is injected through
 * createEditConceptHandler(deps) (test/dictionary-edit-concept.test.js).
 */

'use strict';

const { checkEditFields, composeEdit, changesTags, nameKeyed } = require('../../lib/conceptHeaderEdit');
const { sameHost, firstD, defaultDeps: dispositionDeps } = require('../list-headers/myAssistantDisposition');

const ROUTE = '/api/dictionaries/concepts/edit';
const HEADER_KIND = 39998;
const LIST_HEADER_ADDRESS_RE = /^39998:([0-9a-f]{64}):(.+)$/;
// strfry looks up tag values of at most 255 bytes (MAX_INDEXED_TAG_VAL_SIZE): the header is read by its d-tag.
const MAX_FILTER_VALUE_BYTES = 255;
const EVENT_ID_RE = /^[0-9a-f]{64}$/;

function defaultDeps() {
  const d = dispositionDeps();
  return {
    requireAuth: d.requireAuth,
    getAssistantKeys: d.getAssistantKeys,
    scanAll: (filter) => require('../concept/bDisposition').strfryScanStream(filter),
    sign: d.sign,
    publishLocal: d.publishLocal,
    isStored: d.isStored,
    verify: d.verify,
    // Does this instance's graph hold a node for the header? Read only; an edit never creates one.
    graphHas: async (uuid) => {
      const rows = await require('../../lib/neo4j-driver').runCypher(
        'MATCH (e:NostrEvent {uuid: $uuid}) RETURN count(e) > 0 AS has', { uuid },
      );
      return Boolean(rows && rows[0] && rows[0].has);
    },
    importToGraph: d.importToGraph,
    now: d.now,
  };
}

/**
 * The caller's Assistant's keys and the header's address from the body, checked: { keys, coord, dTag } or
 * { status, body } to answer with. Shared by Edit and Re-Sync (./resyncConcept.js).
 */
async function callerAndAddress(d, req, res, verb) {
  if (!sameHost(req)) return { status: 403, body: { success: false, error: 'a request from another site is refused' } };
  const sessionPubkey = d.requireAuth(req, res);
  if (!sessionPubkey) return { answered: true }; // requireAuth has answered 401
  const keys = await d.getAssistantKeys(sessionPubkey);
  if (!keys || !keys.pubkey || !keys.privkey) {
    return { status: 403, body: { success: false, code: 'no-assistant', error: `You have no Tapestry Assistant on this instance, so there is no key to ${verb} with` } };
  }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const coord = typeof body.coord === 'string' ? body.coord : '';
  const m = coord.match(LIST_HEADER_ADDRESS_RE);
  if (!m) return { status: 400, body: { success: false, error: "coord must be a list header's address (39998:pubkey:d-tag)" } };
  if (m[1] !== keys.pubkey) {
    return { status: 403, body: { success: false, code: 'not-yours', error: `Only the Assistant that published this header can ${verb} it, and yours didn’t` } };
  }
  if (Buffer.byteLength(coord, 'utf8') > MAX_FILTER_VALUE_BYTES) {
    return { status: 400, body: { success: false, error: `This header's address is longer than this relay can look up (${MAX_FILTER_VALUE_BYTES} bytes)` } };
  }
  const basedOn = typeof body.basedOn === 'string' ? body.basedOn : '';
  if (!EVENT_ID_RE.test(basedOn)) return { status: 400, body: { success: false, error: `basedOn must be the id of the version being ${verb === 'edit' ? 'edited' : 're-synced'}` } };
  return { keys, coord, dTag: m[2], basedOn, body };
}

/**
 * The header's latest version: the newest verified header of the Assistant's at exactly this address, and
 * it must be the one the page loaded. { latest } or { status, body }.
 */
async function latestVersion(d, keys, coord, dTag, basedOn, verb) {
  const matches = await d.scanAll({ kinds: [HEADER_KIND], authors: [keys.pubkey], '#d': [dTag] });
  const atThisAddress = (ev) => ev && ev.pubkey === keys.pubkey && ev.kind === HEADER_KIND && firstD(ev) === dTag && d.verify(ev);
  const found = Array.isArray(matches) ? matches : [];
  const latest = found.filter(atThisAddress)
    .reduce((a, b) => (!a || (b.created_at || 0) > (a.created_at || 0) ? b : a), null);
  if (!latest) {
    const unverified = found.some((ev) => ev && ev.pubkey === keys.pubkey && ev.kind === HEADER_KIND && firstD(ev) === dTag);
    if (unverified) {
      return { status: 409, body: {
        success: false, code: 'unverified',
        error: `This instance's relay holds a header at this address that doesn't verify as your Assistant's, so it can't be ${verb === 'edit' ? 'edited' : 're-synced'} here`,
      } };
    }
    return { status: 404, body: { success: false, error: `Your Assistant has no header ${coord} on this instance` } };
  }
  if (latest.id !== basedOn) {
    return { status: 409, body: {
      success: false, code: 'changed', event: latest,
      error: `This concept changed after the ${verb === 'edit' ? 'edit page' : 'page'} loaded it, so nothing was saved`,
    } };
  }
  return { latest };
}

/**
 * A rename's refusal, or null: never of a concept the server finds by name, never onto such a name, and
 * never onto another of the Assistant's concepts' names (in any case). { status, body } or null.
 */
async function renameRefusal(d, keys, dTag, latest, singular) {
  const oldSingular = ((latest.tags || []).find((t) => Array.isArray(t) && t[0] === 'names') || [])[1];
  const was = typeof oldSingular === 'string' ? oldSingular.trim() : '';
  if (singular === was) return null;
  if (nameKeyed(was)) {
    return { status: 400, body: {
      success: false, code: 'name-keyed',
      error: `The server finds "${was}" by its name, so renaming it would break what uses it. Its plural, description and Item Property Tags can still be changed`,
    } };
  }
  // Nor onto a name the server would then take for one of its own concepts (one not created yet).
  if (nameKeyed(singular)) {
    return { status: 400, body: {
      success: false, code: 'name-keyed',
      error: `This instance finds a concept named "${singular}" by that name for its own features, so no other concept can take it`,
    } };
  }
  const wanted = singular.toLowerCase();
  const others = await d.scanAll({ kinds: [HEADER_KIND], authors: [keys.pubkey] });
  const singularOf = (ev) => String(((ev.tags || []).find((t) => Array.isArray(t) && t[0] === 'names') || [])[1] || '').trim().toLowerCase();
  // The name first, then the signature, so only a match is verified.
  const taken = (Array.isArray(others) ? others : []).find((ev) => ev && ev.pubkey === keys.pubkey && ev.kind === HEADER_KIND
    && firstD(ev) !== dTag && singularOf(ev) === wanted && d.verify(ev));
  if (taken) {
    return { status: 409, body: {
      success: false, code: 'name-taken', coord: `${HEADER_KIND}:${keys.pubkey}:${firstD(taken)}`,
      error: `Your Assistant already has a concept named "${singular}", and the server finds concepts by name, so two would be ambiguous`,
    } };
  }
  return null;
}

/**
 * Sign, the local relay, the read-back, then the graph where it holds the header: { status, body }.
 */
async function signAndFollow(d, keys, template, coord, label) {
  const signed = d.sign(template, keys.privkey);
  if (!signed || signed.pubkey !== keys.pubkey) {
    return { status: 500, body: { success: false, error: "The Assistant's key didn't sign as its own pubkey, so nothing was published" } };
  }
  await d.publishLocal(signed);
  let stored;
  try {
    stored = await d.isStored(signed.id);
  } catch {
    return { status: 502, body: { success: false, error: "Sent to the relay, but couldn't confirm it was kept — the graph wasn't changed" } };
  }
  if (!stored) return { status: 502, body: { success: false, error: "The relay didn't keep the new version, so nothing was saved" } };

  // The graph follows the relay only where it already holds the header.
  let graph = 'none';
  try {
    if (await d.graphHas(coord)) {
      await d.importToGraph(signed, coord);
      graph = 'updated';
    }
  } catch (err) {
    console.error(`${label}: graph update failed:`, err.message);
    graph = 'failed';
  }
  return { status: 200, body: { success: true, event: signed, coord, graph } };
}

function createEditConceptHandler(deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  return async function handleEditConcept(req, res) {
    try {
      const who = await callerAndAddress(d, req, res, 'edit');
      if (who.answered) return;
      if (who.status) return res.status(who.status).json(who.body);
      const { keys, coord, dTag, basedOn, body } = who;

      const { fields, error } = checkEditFields(body);
      if (error) return res.status(400).json({ success: false, error });

      const v = await latestVersion(d, keys, coord, dTag, basedOn, 'edit');
      if (!v.latest) return res.status(v.status).json(v.body);
      const { latest } = v;

      const refused = await renameRefusal(d, keys, dTag, latest, fields.singular);
      if (refused) return res.status(refused.status).json(refused.body);

      const template = composeEdit(latest, fields, d.now());
      if (!changesTags(latest, template)) return res.json({ success: true, unchanged: true, event: latest, coord });

      const out = await signAndFollow(d, keys, template, coord, 'dictionaries/concepts/edit');
      return res.status(out.status).json(out.body);
    } catch (err) {
      console.error('dictionaries/concepts/edit error:', err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  };
}

function register(app) {
  app.post(ROUTE, createEditConceptHandler());
}

module.exports = {
  ROUTE, createEditConceptHandler, register, defaultDeps, callerAndAddress, latestVersion, renameRefusal, signAndFollow, HEADER_KIND,
};
