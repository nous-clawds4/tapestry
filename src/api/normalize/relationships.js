/**
 * Strfry-free relationship primitives — add or delete ONE typed, directed
 * relationship between two nodes that already exist in the Neo4j reference
 * graph.
 *
 * Story: engineering-team/stories/relationship-primitives/1-relationship-add-delete-primitives.md
 * ADR:   engineering-team/decisions/relationship-primitives/0001-strfry-free-relationship-primitives.md
 *
 * Direction is always (fromUuid)-[relType]->(toUuid). A self-loop
 * (fromUuid === toUuid) is not specially rejected — primitives carry no
 * policy.
 *
 * These are scalpel-grade operator tools: no strfry read or write, no event
 * signing or publication, no json-tag regeneration, no derivation. The
 * import surface of this module — the Neo4j driver, the firmware alias
 * layer, and the auth middleware, nothing else — is deliberately minimal
 * and is enforced by an automated structural test.
 *
 * ── FIRMWARE-INSTALL OVERWRITE HAZARD ────────────────────────────────────
 * A firmware install (POST /api/firmware/install) can OVERWRITE manual
 * edits made with these primitives: the install's edge-derivation pass can
 * RE-ADD a relationship you deleted, and its manifest-scoped prune can
 * DELETE a relationship you added (see src/firmware/install.js:594-634,
 * :758, :764). This hazard is documentation-only by operator decision
 * (2026-07-18): install behavior is intentionally NOT changed here. Every
 * graph-changing success response (result created or deleted) carries a
 * one-line note repeating this warning.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Whitelist: only the two class-thread membership types are admitted —
 * HAS_ELEMENT (canonical CLASS_THREAD_TERMINATION) and IS_A_SUPERSET_OF
 * (canonical CLASS_THREAD_PROPAGATION) — resolved at module load through
 * the firmware alias layer, never hardcoded as Neo4j alias literals, so an
 * alias change cannot silently orphan the whitelist. relType accepts either
 * spelling: the canonical slug or its Neo4j alias.
 *
 * The whitelist is also the Cypher injection boundary: a relationship type
 * cannot be a query parameter, so it is string-interpolated — and ONLY the
 * resolved alias of a whitelisted entry is ever interpolated into query
 * text. The caller's raw relType string never reaches Cypher.
 *
 * Owner gate (in-handler, the strfry/wipe.js pattern): isOwner OR
 * req.localTrusted. Default-deny middleware already 401s unauthenticated
 * mutations before the handler; this gate additionally 403s an
 * authenticated non-owner. A route-level session-only gate would reject the
 * trusted-local operator path this tool exists to serve.
 *
 * Operator usage (container loopback — a host-side call to :7778 is remote
 * by design, per ADR security-auth-exposure/0001):
 *
 *   docker exec tapestry curl -s -X POST \
 *     http://127.0.0.1:7778/api/normalize/add-relationship \
 *     -H 'Content-Type: application/json' \
 *     -d '{"fromUuid":"<uuid>","toUuid":"<uuid>","relType":"CLASS_THREAD_TERMINATION"}'
 *
 * (relType takes the canonical slug, as above, or the Neo4j alias, e.g.
 * HAS_ELEMENT. Same body shape for /api/normalize/delete-relationship.)
 */

const { runCypher, writeCypher } = require('../../lib/neo4j-driver');
const firmware = require('./firmware');
const { isOwner } = require('../../middleware/auth');

// Whitelisted canonical slugs (ADR decision 2: the two class-thread
// membership types only). ALLOWED maps resolved Neo4j alias -> canonical
// slug, built once at module load via the firmware alias layer.
const WHITELISTED_CANONICALS = ['CLASS_THREAD_TERMINATION', 'CLASS_THREAD_PROPAGATION'];
const ALLOWED = new Map(WHITELISTED_CANONICALS.map(c => [firmware.relAlias(c), c]));

// One-line hazard note carried on every graph-changing success — the full
// explanation is in this module's header.
const HAZARD_NOTE =
  'Manual graph edit: a firmware install can overwrite it — the install can ' +
  're-add a deleted relationship or prune an added one (see the ' +
  'src/api/normalize/relationships.js header).';

/**
 * Resolve a caller-supplied relType (canonical slug or alias) through the
 * firmware alias layer, then check the whitelist. Returns { alias } on
 * success or { error } on failure. Only the returned alias — a value from
 * ALLOWED, never the caller's string — may be interpolated into Cypher.
 */
function resolveRelType(input) {
  let alias;
  try {
    alias = firmware.relAlias(input);
  } catch (e) {
    return { error: `relType ${input} is not a known relationship type` };
  }
  if (!ALLOWED.has(alias)) {
    return { error: `relType ${input} is not allowed` };
  }
  return { alias };
}

/**
 * Shared gate + validation for both handlers. Order matters: (1) owner gate,
 * (2) required body fields, (3) relType whitelist. Returns { status, body }
 * on failure or { alias, fromUuid, toUuid } on success.
 */
function gateAndValidate(req) {
  if (!isOwner(req) && !req.localTrusted) {
    return {
      status: 403,
      body: { success: false, error: 'Editing relationships requires owner authentication' },
    };
  }
  const body = req.body || {};
  for (const field of ['fromUuid', 'toUuid', 'relType']) {
    if (typeof body[field] !== 'string' || body[field].length === 0) {
      return {
        status: 400,
        body: { success: false, error: `Missing required field: ${field}` },
      };
    }
  }
  const resolved = resolveRelType(body.relType);
  if (resolved.error) {
    return {
      status: 400,
      body: { success: false, error: resolved.error, allowed: [...ALLOWED.keys()] },
    };
  }
  return { alias: resolved.alias, fromUuid: body.fromUuid, toUuid: body.toUuid };
}

/**
 * The main query returned zero rows, meaning at least one endpoint node is
 * missing. Name exactly the missing uuid(s) — preconditions fail loudly.
 */
async function respondMissingNodes(res, fromUuid, toUuid) {
  const rows = await runCypher(
    'MATCH (n) WHERE n.uuid IN [$fromUuid, $toUuid] RETURN n.uuid AS uuid',
    { fromUuid, toUuid }
  );
  const present = new Set(rows.map(r => r.uuid));
  const missing = [...new Set([fromUuid, toUuid])].filter(u => !present.has(u));
  return res.status(404).json({
    success: false,
    error: `Node not found: ${missing.join(', ')}`,
    missing,
  });
}

/**
 * POST /api/normalize/add-relationship
 * Body: { fromUuid, toUuid, relType }
 * Idempotent: 200 result created | already-existed (ADR decision 5).
 */
async function handleAddRelationship(req, res) {
  const v = gateAndValidate(req);
  if (v.status) return res.status(v.status).json(v.body);
  const { alias, fromUuid, toUuid } = v;
  try {
    const rows = await writeCypher(
      'MATCH (a {uuid: $fromUuid})\n' +
      'MATCH (b {uuid: $toUuid})\n' +
      'OPTIONAL MATCH (a)-[e:`' + alias + '`]->(b)\n' +
      'WITH a, b, count(e) AS existing\n' +
      'MERGE (a)-[r:`' + alias + '`]->(b)\n' +
      'RETURN existing > 0 AS alreadyExisted, labels(a) AS fromLabels, labels(b) AS toLabels',
      { fromUuid, toUuid }
    );
    if (rows.length === 0) return respondMissingNodes(res, fromUuid, toUuid);
    const row = rows[0];
    const body = {
      success: true,
      operation: 'add',
      result: row.alreadyExisted ? 'already-existed' : 'created',
      relType: alias,
      from: { uuid: fromUuid, labels: row.fromLabels || [] },
      to: { uuid: toUuid, labels: row.toLabels || [] },
    };
    if (body.result === 'created') body.note = HAZARD_NOTE;
    return res.json(body);
  } catch (err) {
    console.error('normalize/add-relationship error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/normalize/delete-relationship
 * Body: { fromUuid, toUuid, relType }
 * Targeted: removes only the named type between the named pair in the named
 * direction. Idempotent: 200 result deleted | not-found (ADR decision 5).
 */
async function handleDeleteRelationship(req, res) {
  const v = gateAndValidate(req);
  if (v.status) return res.status(v.status).json(v.body);
  const { alias, fromUuid, toUuid } = v;
  try {
    const rows = await writeCypher(
      'MATCH (a {uuid: $fromUuid})\n' +
      'MATCH (b {uuid: $toUuid})\n' +
      'OPTIONAL MATCH (a)-[r:`' + alias + '`]->(b)\n' +
      'DELETE r\n' +
      'RETURN count(r) AS deletedCount, labels(a) AS fromLabels, labels(b) AS toLabels',
      { fromUuid, toUuid }
    );
    if (rows.length === 0) return respondMissingNodes(res, fromUuid, toUuid);
    const row = rows[0];
    const deletedCount = row.deletedCount || 0;
    const body = {
      success: true,
      operation: 'delete',
      result: deletedCount > 0 ? 'deleted' : 'not-found',
      deletedCount,
      relType: alias,
      from: { uuid: fromUuid, labels: row.fromLabels || [] },
      to: { uuid: toUuid, labels: row.toLabels || [] },
    };
    if (body.result === 'deleted') body.note = HAZARD_NOTE;
    return res.json(body);
  } catch (err) {
    console.error('normalize/delete-relationship error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleAddRelationship, handleDeleteRelationship };
