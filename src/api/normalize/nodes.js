/**
 * Event-less node primitives — `add-subset` creates a Set in Neo4j with NO
 * nostr event behind it: nothing is signed, nothing is stored in strfry, and no
 * relationship descriptor is emitted. Neo4j is the definitive self (BIBLE §30);
 * the set is a private thought until a letter is written for it.
 *
 * Story: engineering-team/stories/node-primitives/1-event-less-create-set.md
 * ADR:   engineering-team/decisions/node-primitives/0001-event-less-add-subset-primitive.md
 *
 * The node is exactly what create-set + importEventDirect would leave in Neo4j
 * for the same name and parent — the same address
 * (39999:<TA>:<slug(name)>-<hash8(parentUuid)>), labels (NostrEvent, ListItem,
 * Set), properties, would-be tag nodes (d, name, z, s, then description) and
 * parent edge — minus the event: it has no `id` property. Every read path that
 * works for a lettered set works for it; the publish traversal skips it (no
 * `id`); and a letter minted later for the same address lands on this node and
 * replaces the would-be tags with identical ones. The set is also registered as
 * an element of the `set` concept.
 *
 * DURABILITY: an event-less set exists only in Neo4j. Only a Neo4j backup
 * preserves it — no rebuild from strfry can bring it back (BIBLE §30: unpublished
 * state is mortal and box-bound). Every `created` answer says so in its `note`.
 *
 * DANGLING LETTERS: a lettered write that points at an event-less set — an
 * add-to-set targeting it, a lettered create-set beneath it, or publishing a
 * concept with lettered children under it — puts a reference on the wire to a
 * node that has no letter. Keep event-less trees event-less, and wire members
 * with add-relationship, which is Neo4j-only too.
 *
 * Owner gate (in-handler, the strfry/wipe.js pattern): isOwner OR
 * req.localTrusted; default-deny middleware already 401s unauthenticated
 * mutations. The operator path is container loopback:
 *
 *   docker exec tapestry curl -s -X POST http://127.0.0.1:7778/api/normalize/add-subset \
 *     -H 'Content-Type: application/json' \
 *     -d '{"parentUuid":"<superset or set uuid>","name":"<set name>","description":"<optional>"}'
 *
 * The import surface — crypto, the Neo4j driver, the firmware alias layer, the
 * auth middleware and the d-tag helper, nothing else — is the structural
 * guarantee that this module cannot sign or store an event; it is enforced by
 * test/event-less-create-set.test.js.
 */

const crypto = require('crypto');
const { runCypher, writeCypher } = require('../../lib/neo4j-driver');
const firmware = require('./firmware');
const { isOwner } = require('../../middleware/auth');
const { childDTag } = require('../../lib/dtag');

// Class-thread relationship types, resolved through the firmware alias layer
// (as relationships.js does), so an alias change cannot silently orphan these
// writes. Only these firmware-derived values are interpolated into Cypher.
const REL = {
  INITIATION: firmware.relAlias('CLASS_THREAD_INITIATION'),
  PROPAGATION: firmware.relAlias('CLASS_THREAD_PROPAGATION'),
  TERMINATION: firmware.relAlias('CLASS_THREAD_TERMINATION'),
};

const SET_KIND = 39999;

const EVENT_LESS_NOTE =
  'Event-less set: it exists only in Neo4j — no event backs it, so only a Neo4j backup preserves it (BIBLE §30).';

/**
 * The would-be tags of an event-less set, in create-set's order — d, name, z
 * (the `set` concept), s (the parent: ADR community-reference/0011's
 * child-claims-parent claim), then description when given — each with the
 * tag-node uuid importEventDirect derives for the same address:
 * sha256("<uuid>:<tag.join(',')>:<index>") (src/api/normalize/index.js:165).
 */
function buildSubsetTags(uuid, name, parentUuid, setConceptUuid, description) {
  const dTag = uuid.split(':').slice(2).join(':');
  const tags = [['d', dTag], ['name', name], ['z', setConceptUuid], ['s', parentUuid]];
  if (typeof description === 'string' && description.length > 0) tags.push(['description', description]);
  return tags.map((tag, i) => ({
    uuid: crypto.createHash('sha256').update(`${uuid}:${tag.join(',')}:${i}`).digest('hex'),
    type: tag[0],
    value: tag[1],
  }));
}

function fail(res, status, error, extra = {}) {
  return res.status(status).json({ success: false, error, ...extra });
}

/**
 * POST /api/normalize/add-subset
 * Body: { parentUuid, name, description? }
 * Answers 200 created | already-existed; 400 / 403 / 404 / 409 / 500 otherwise
 * (ADR node-primitives/0001 decision 9).
 */
async function handleAddSubset(req, res) {
  // (1) Owner gate — before anything touches the graph.
  if (!isOwner(req) && !req.localTrusted) {
    return fail(res, 403, 'Creating sets requires owner authentication');
  }

  // (2) Body fields.
  const { parentUuid, name, description } = req.body || {};
  if (typeof parentUuid !== 'string' || parentUuid.length === 0) {
    return fail(res, 400, 'Missing required field: parentUuid');
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    return fail(res, 400, 'Missing required field: name (a non-blank string)');
  }
  if (description !== undefined && typeof description !== 'string') {
    return fail(res, 400, 'Field description must be a string when present');
  }
  const setName = name.trim();

  // (3) Instance preconditions: the TA pubkey (the set's address and author)
  // and the `set` concept (its registration).
  const ta = firmware.getTAPubkey();
  if (!ta) {
    return fail(res, 500, 'The Tapestry Assistant pubkey is unavailable, so the set can have no address or author');
  }
  const setConceptUuid = firmware.conceptUuid('set');
  if (!setConceptUuid) {
    return fail(res, 500, 'The `set` concept is not in this instance\'s firmware — run firmware install');
  }

  try {
    const supRows = await runCypher(
      `MATCH (:NostrEvent {uuid: $h})-[:${REL.INITIATION}]->(s:Superset) RETURN s.uuid AS uuid LIMIT 1`,
      { h: setConceptUuid }
    );
    if (supRows.length === 0) {
      return fail(res, 500, 'The `set` concept has no superset in Neo4j — run firmware install');
    }

    // (4) The parent must exist and be a Superset or a Set.
    const parentRows = await runCypher(
      'MATCH (p:NostrEvent {uuid: $u}) RETURN labels(p) AS labels LIMIT 1',
      { u: parentUuid }
    );
    if (parentRows.length === 0) {
      return fail(res, 404, `Node not found: ${parentUuid}`, { missing: [parentUuid] });
    }
    const parentLabels = parentRows[0].labels || [];
    if (!parentLabels.includes('Superset') && !parentLabels.includes('Set')) {
      return fail(res, 400,
        `The parent must be a Superset or a Set — ${parentUuid} carries [${parentLabels.join(', ')}]`,
        { labels: parentLabels });
    }
    const parent = { uuid: parentUuid, labels: parentLabels };

    // (5) The address create-set gives the same name and parent.
    const uuid = `${SET_KIND}:${ta}:${childDTag(setName, parentUuid)}`;

    // (6a) A set of this name already under this parent — lettered or not.
    const same = await runCypher(
      `MATCH (:NostrEvent {uuid: $p})-[:${REL.PROPAGATION}]->(s:Set)
       WHERE toLower(trim(s.name)) = toLower($name)
       RETURN s.uuid AS uuid, s.name AS name, s.id IS NOT NULL AS hasEvent
       LIMIT 1`,
      { p: parentUuid, name: setName }
    );
    if (same.length > 0) {
      return res.json({
        success: true,
        operation: 'add',
        result: 'already-existed',
        set: { uuid: same[0].uuid, name: same[0].name, hasEvent: same[0].hasEvent === true },
        parent,
      });
    }

    // (6b) The address is held by something else: loud, never re-linked.
    const held = await runCypher(
      'MATCH (n:NostrEvent {uuid: $u}) RETURN labels(n) AS labels LIMIT 1',
      { u: uuid }
    );
    if (held.length > 0) {
      return fail(res, 409,
        `Address ${uuid} is already held by a node that is not a set named "${setName}" under ${parentUuid}`,
        { uuid, labels: held[0].labels || [] });
    }

    // (7) The write — one statement, idempotent by construction: MERGE by
    // address, would-be tag nodes by their deterministic uuids, both edges.
    const tags = buildSubsetTags(uuid, setName, parentUuid, setConceptUuid, description);
    const rows = await writeCypher(
      `MATCH (p:NostrEvent {uuid: $parentUuid})
       MATCH (:NostrEvent {uuid: $setConceptUuid})-[:${REL.INITIATION}]->(setSup:Superset)
       OPTIONAL MATCH (pre:NostrEvent {uuid: $uuid})
       WITH p, setSup, pre IS NULL AS created
       MERGE (s:NostrEvent {uuid: $uuid})
         ON CREATE SET s:ListItem:Set, s.name = $name, s.kind = $kind,
                       s.pubkey = $pubkey, s.created_at = $createdAt
       WITH p, setSup, s, created
       UNWIND $tags AS t
       MERGE (tn:NostrEventTag {uuid: t.uuid})
         ON CREATE SET tn.type = t.type, tn.value = t.value
       MERGE (s)-[:HAS_TAG]->(tn)
       WITH DISTINCT p, setSup, s, created
       MERGE (p)-[:${REL.PROPAGATION}]->(s)
       MERGE (setSup)-[:${REL.TERMINATION}]->(s)
       RETURN created, labels(s) AS labels, setSup.uuid AS setSupersetUuid, s.id IS NOT NULL AS hasEvent`,
      {
        parentUuid,
        setConceptUuid,
        uuid,
        name: setName,
        kind: SET_KIND,
        pubkey: ta,
        createdAt: Math.floor(Date.now() / 1000),
        tags,
      }
    );
    if (rows.length === 0) {
      // A node checked above vanished before the write. Never report success
      // for a write that did not happen.
      return fail(res, 500, 'The set was not written: a node checked above disappeared before the write');
    }

    const row = rows[0];
    const set = { uuid, name: setName, labels: row.labels || [] };
    if (typeof description === 'string' && description.length > 0) set.description = description;
    if (!row.created) {
      set.hasEvent = row.hasEvent === true;
      return res.json({ success: true, operation: 'add', result: 'already-existed', set, parent });
    }
    return res.json({
      success: true,
      operation: 'add',
      result: 'created',
      set,
      parent,
      registeredUnder: row.setSupersetUuid,
      note: EVENT_LESS_NOTE,
    });
  } catch (err) {
    console.error('normalize/add-subset error:', err);
    return fail(res, 500, err.message);
  }
}

module.exports = { handleAddSubset, buildSubsetTags };
