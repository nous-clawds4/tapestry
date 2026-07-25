/**
 * conceptCoreNodes — the shared, handle-keyed read for a concept's 8 core nodes + JSON.
 *
 * Per ADR tapestries/0004: node JSON is read from Tapestry LMDB (via resolveValue — an
 * `lmdb:<key>` value is fetched from the store; an inline value passes through) and the
 * core-node RELATIONSHIPS come from Neo4j. This is the read path behind both:
 *   - GET /api/concept-graph/node/:handle/core-nodes   (the tapestry per-concept views)
 *   - GET /api/firmware/concept/:slug                  (the Firmware Explorer, rewired here)
 *
 * The 8-core-node OPTIONAL MATCH is keyed on the header `$uuid` PARAM (never interpolated).
 * runCypher + resolveValue are lazy-required (or injected via `deps`) so the pure shaping
 * (shapeCoreNodes / coerceJson) is unit-testable stack-free.
 */

// Neo4j read: from a ListHeader uuid, collect the header + its 8 core nodes and each one's
// `json` tag value. Keyed on $uuid — moved verbatim from src/api/firmware/index.js.
const CORE_NODES_CYPHER = `MATCH (h:ListHeader {uuid: $uuid})
       OPTIONAL MATCH (h)-[:HAS_TAG]->(hj:NostrEventTag {type: 'json'})

       OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
       OPTIONAL MATCH (sup)-[:HAS_TAG]->(sj:NostrEventTag {type: 'json'})

       OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
       OPTIONAL MATCH (js)-[:HAS_TAG]->(jsj:NostrEventTag {type: 'json'})

       OPTIONAL MATCH (pp:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)
       OPTIONAL MATCH (pp)-[:HAS_TAG]->(ppj:NostrEventTag {type: 'json'})

       OPTIONAL MATCH (props)-[:IS_THE_PROPERTIES_SET_FOR]->(h)
       OPTIONAL MATCH (props)-[:HAS_TAG]->(prj:NostrEventTag {type: 'json'})

       OPTIONAL MATCH (ptg)-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(h)
       OPTIONAL MATCH (ptg)-[:HAS_TAG]->(ptj:NostrEventTag {type: 'json'})

       OPTIONAL MATCH (cg)-[:IS_THE_CORE_GRAPH_FOR]->(h)
       OPTIONAL MATCH (cg)-[:HAS_TAG]->(cgj:NostrEventTag {type: 'json'})

       OPTIONAL MATCH (cog)-[:IS_THE_CONCEPT_GRAPH_FOR]->(h)
       OPTIONAL MATCH (cog)-[:HAS_TAG]->(cogj:NostrEventTag {type: 'json'})

       RETURN h.uuid AS headerUuid, h.name AS headerName, head(collect(DISTINCT hj.value)) AS headerJson,
              sup.uuid AS supersetUuid, sup.name AS supersetName, head(collect(DISTINCT sj.value)) AS supersetJson,
              js.uuid AS schemaUuid, js.name AS schemaName, head(collect(DISTINCT jsj.value)) AS schemaJson,
              pp.uuid AS ppUuid, pp.name AS ppName, head(collect(DISTINCT ppj.value)) AS ppJson,
              props.uuid AS propsUuid, props.name AS propsName, head(collect(DISTINCT prj.value)) AS propsJson,
              ptg.uuid AS ptgUuid, ptg.name AS ptgName, head(collect(DISTINCT ptj.value)) AS ptgJson,
              cg.uuid AS cgUuid, cg.name AS cgName, head(collect(DISTINCT cgj.value)) AS cgJson,
              cog.uuid AS cogUuid, cog.name AS cogName, head(collect(DISTINCT cogj.value)) AS cogJson
       LIMIT 1`;

/**
 * Coerce a (possibly LMDB-resolved) json value into an object.
 * null/'' → null; a string → JSON.parse (null on failure); an object → as-is
 * (the LMDB store returns envelope.data already parsed).
 */
function coerceJson(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

/**
 * Map a Cypher row (the RETURN aliases above) into the { header, superset, schema,
 * primaryProperty, properties, ptGraph, coreGraph, conceptGraph } shape the UI expects,
 * each `{ uuid, name, json }`. `resolve` (default identity) is applied to each raw json
 * value before coercion — that is where an `lmdb:<key>` pointer becomes its stored object.
 */
function shapeCoreNodes(row, resolve = (v) => v) {
  const j = (raw) => coerceJson(resolve(raw));
  return {
    header:          { uuid: row.headerUuid,   name: row.headerName,   json: j(row.headerJson) },
    superset:        { uuid: row.supersetUuid, name: row.supersetName, json: j(row.supersetJson) },
    schema:          { uuid: row.schemaUuid,   name: row.schemaName,   json: j(row.schemaJson) },
    primaryProperty: { uuid: row.ppUuid,       name: row.ppName,       json: j(row.ppJson) },
    properties:      { uuid: row.propsUuid,    name: row.propsName,    json: j(row.propsJson) },
    ptGraph:         { uuid: row.ptgUuid,      name: row.ptgName,      json: j(row.ptgJson) },
    coreGraph:       { uuid: row.cgUuid,       name: row.cgName,       json: j(row.cgJson) },
    conceptGraph:    { uuid: row.cogUuid,      name: row.cogName,      json: j(row.cogJson) },
  };
}

/**
 * Read a concept's 8 core nodes + JSON by its header handle (uuid).
 * Relationships from Neo4j; JSON resolved through Tapestry LMDB (ADR tapestries/0004).
 * @param {string} headerUuid  the concept header handle, e.g. `39998:<TA>:dog`
 * @param {{runCypher?:Function, resolveValue?:Function}} [deps]  injectable for stack-free tests
 * @returns {Promise<{found:boolean, nodes:object}>}
 */
async function getConceptCoreNodes(headerUuid, deps = {}) {
  const runCypher = deps.runCypher || require('./neo4j-driver').runCypher;
  const resolveValue = deps.resolveValue || require('./tapestry-resolve').resolveValue;

  const rows = await runCypher(CORE_NODES_CYPHER, { uuid: headerUuid });
  const row = rows && rows[0];
  if (!row || !row.headerUuid) return { found: false, nodes: {} };
  return { found: true, nodes: shapeCoreNodes(row, resolveValue) };
}

module.exports = { CORE_NODES_CYPHER, coerceJson, shapeCoreNodes, getConceptCoreNodes };
