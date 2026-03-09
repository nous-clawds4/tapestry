/**
 * Tapestry Audit API — single source of truth for all audit queries.
 *
 * Both the CLI (`tapestry audit`) and the front end call these endpoints.
 * All endpoints are read-only (GET).
 *
 * Uses the Neo4j Bolt driver for native typed results — no more CSV
 * parsing, boolean case bugs, or shell escaping issues.
 *
 * Endpoints:
 *   GET /api/audit/stats
 *   GET /api/audit/skeletons?concept=<name>
 *   GET /api/audit/orphans
 *   GET /api/audit/wiring
 *   GET /api/audit/labels
 *   GET /api/audit/bios
 *   GET /api/audit/threads?concept=<name>&mode=<elements|sets|paths>&through=<set>&depth=<n>
 */

const { runCypher } = require('../../lib/neo4j-driver');
const Ajv = require('ajv');
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
const firmware = require('../normalize/firmware');

// ─── Config: firmware concept UUIDs ───────────────────────────────
// Concept UUIDs are now computed from firmware slugs + TA pubkey.
// The old FIRMWARE_CONCEPTS array with hardcoded d-tags is no longer needed.

function firmwareConceptUuid(slug) {
  return firmware.conceptUuid(slug);
}

// Firmware concepts that the BIOS/firmware audit checks
const FIRMWARE_CONCEPTS = [
  { name: 'node type', slug: 'node-type' },
  { name: 'superset', slug: 'superset' },
  { name: 'set', slug: 'set' },
  { name: 'relationship', slug: 'relationship' },
  { name: 'relationship type', slug: 'relationship-type' },
  { name: 'property', slug: 'property' },
  { name: 'JSON schema', slug: 'json-schema' },
  { name: 'list', slug: 'list' },
  { name: 'JSON data type', slug: 'json-data-type' },
  { name: 'graph type', slug: 'graph-type' },
  { name: 'graph', slug: 'graph' },
  { name: 'primary property', slug: 'primary-property' },
];

const LABEL_CHECKS = [
  { concept: 'superset', label: 'Superset', slug: 'superset' },
  { concept: 'set', label: 'Set', slug: 'set' },
  { concept: 'property', label: 'Property', slug: 'property' },
  { concept: 'jsonSchema', label: 'JSONSchema', slug: 'json-schema' },
  { concept: 'relationship', label: 'Relationship', slug: 'relationship' },
];

// Escape single quotes for Cypher strings
function esc(str) {
  return String(str || '').replace(/'/g, "\\'");
}

// ─── Endpoint handlers ────────────────────────────────────────────

async function handleStats(req, res) {
  try {
    const [totals, byLabel, byRelType, concepts, signers, jsonCoverage] = await Promise.all([
      runCypher(`MATCH (n) WITH count(n) AS nodes OPTIONAL MATCH ()-[r]->() RETURN nodes, count(r) AS relationships`),
      runCypher(`MATCH (n) WITH labels(n) AS labels, count(n) AS count RETURN labels, count ORDER BY count DESC`),
      runCypher(`MATCH ()-[r]->() RETURN type(r) AS relType, count(r) AS count ORDER BY count DESC`),
      runCypher(`MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'}) OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s:Superset) OPTIONAL MATCH (s)<-[:IS_A_SUPERSET_OF*0..10]-(sub)-[:HAS_ELEMENT]->(elem) WITH t.value AS concept, s IS NOT NULL AS hasSuperset, count(DISTINCT elem) AS elements RETURN concept, elements, hasSuperset ORDER BY concept`),
      runCypher(`MATCH (n:NostrEvent) RETURN substring(n.pubkey, 0, 16) + '...' AS signer, count(n) AS events ORDER BY events DESC`),
      runCypher(`MATCH (n:NostrEvent) OPTIONAL MATCH (n)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'}) WITH CASE WHEN n:ListHeader THEN 'ListHeader' WHEN n:Superset THEN 'Superset' WHEN n:JSONSchema THEN 'JSONSchema' WHEN n:Property THEN 'Property' WHEN n:Relationship THEN 'Relationship' WHEN n:ListItem THEN 'ListItem (other)' ELSE 'Other' END AS nodeType, count(n) AS total, count(j) AS withJson RETURN nodeType, total, withJson, total - withJson AS missing ORDER BY total DESC`),
    ]);

    res.json({
      success: true,
      data: { totals: totals[0], byLabel, byRelType, concepts, signers, jsonCoverage },
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

async function handleSkeletons(req, res) {
  try {
    const conceptName = req.query.concept;
    const nameFilter = conceptName
      ? `WHERE toLower(t.value) = toLower($conceptName)`
      : '';
    const params = conceptName ? { conceptName } : {};

    const rows = await runCypher(`
      MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
      ${nameFilter}
      OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
      OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
      OPTIONAL MATCH (pp:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)
      OPTIONAL MATCH (props)-[:IS_THE_PROPERTIES_SET_FOR]->(h)
      OPTIONAL MATCH (cg)-[:IS_THE_CORE_GRAPH_FOR]->(h)
      OPTIONAL MATCH (conceptG)-[:IS_THE_CONCEPT_GRAPH_FOR]->(h)
      OPTIONAL MATCH (ptg)-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(h)
      RETURN t.value AS concept, h.uuid AS uuid,
             sup IS NOT NULL AS superset,
             js IS NOT NULL AS schema,
             pp IS NOT NULL AS primaryProp,
             props IS NOT NULL AS properties,
             cg IS NOT NULL AS coreGraph,
             conceptG IS NOT NULL AS conceptGraph,
             ptg IS NOT NULL AS ptGraph
      ORDER BY concept
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

async function handleOrphans(req, res) {
  try {
    const [brokenZ, noZ, empty] = await Promise.all([
      runCypher(`MATCH (i:ListItem)-[:HAS_TAG]->(z:NostrEventTag {type: 'z'}) WHERE NOT EXISTS { MATCH (parent:NostrEvent {uuid: z.value}) } OPTIONAL MATCH (i)-[:HAS_TAG]->(n:NostrEventTag) WHERE n.type = 'name' OR n.type = 'names' RETURN coalesce(n.value, '(unnamed)') AS item, i.uuid AS uuid, z.value AS brokenZTag ORDER BY item`),
      runCypher(`MATCH (i:ListItem) WHERE NOT EXISTS { MATCH (i)-[:HAS_TAG]->(z:NostrEventTag {type: 'z'}) } OPTIONAL MATCH (i)-[:HAS_TAG]->(n:NostrEventTag) WHERE n.type = 'name' OR n.type = 'names' RETURN coalesce(n.value, '(unnamed)') AS item, i.uuid AS uuid ORDER BY item`),
      runCypher(`MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'}) WHERE NOT EXISTS { MATCH (item:ListItem)-[:HAS_TAG]->(z:NostrEventTag {type: 'z'}) WHERE z.value = h.uuid } RETURN t.value AS concept, h.uuid AS uuid ORDER BY concept`),
    ]);

    res.json({ success: true, data: { brokenZ, noZ, empty } });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

async function handleWiring(req, res) {
  try {
    const rules = [
      { name: 'IS_THE_CONCEPT_FOR: ListHeader → Superset', cypher: `MATCH (a)-[:IS_THE_CONCEPT_FOR]->(b) WHERE NOT (a:ListHeader AND b:Superset) RETURN a.name AS fromNode, labels(a) AS fromLabels, b.name AS toNode, labels(b) AS toLabels` },
      { name: 'IS_A_SUPERSET_OF: Superset/Set → Superset/Set', cypher: `MATCH (a)-[:IS_A_SUPERSET_OF]->(b) WHERE NOT ((a:Superset OR a:Set) AND (b:Superset OR b:Set)) RETURN a.name AS fromNode, labels(a) AS fromLabels, b.name AS toNode, labels(b) AS toLabels` },
      { name: 'IS_A_PROPERTY_OF: Property → JSONSchema/Property', cypher: `MATCH (a)-[:IS_A_PROPERTY_OF]->(b) WHERE NOT (a:Property AND (b:JSONSchema OR b:Property)) RETURN a.name AS fromNode, labels(a) AS fromLabels, b.name AS toNode, labels(b) AS toLabels` },
      { name: 'IS_THE_JSON_SCHEMA_FOR: JSONSchema → ListHeader', cypher: `MATCH (a)-[:IS_THE_JSON_SCHEMA_FOR]->(b) WHERE NOT (a:JSONSchema AND b:ListHeader) RETURN a.name AS fromNode, labels(a) AS fromLabels, b.name AS toNode, labels(b) AS toLabels` },
      { name: 'IS_THE_PRIMARY_PROPERTY_FOR: Property → ListHeader', cypher: `MATCH (a)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(b) WHERE NOT (a:Property AND b:ListHeader) RETURN a.name AS fromNode, labels(a) AS fromLabels, b.name AS toNode, labels(b) AS toLabels` },
      { name: 'ENUMERATES: ListHeader → Property', cypher: `MATCH (a)-[:ENUMERATES]->(b) WHERE NOT (a:ListHeader AND b:Property) RETURN a.name AS fromNode, labels(a) AS fromLabels, b.name AS toNode, labels(b) AS toLabels` },
      { name: 'IS_THE_CORE_GRAPH_FOR: ListItem → ListHeader', cypher: `MATCH (a)-[:IS_THE_CORE_GRAPH_FOR]->(b) WHERE NOT (a:ListItem AND b:ListHeader) RETURN a.name AS fromNode, labels(a) AS fromLabels, b.name AS toNode, labels(b) AS toLabels` },
      { name: 'IS_THE_CONCEPT_GRAPH_FOR: ListItem → ListHeader', cypher: `MATCH (a)-[:IS_THE_CONCEPT_GRAPH_FOR]->(b) WHERE NOT (a:ListItem AND b:ListHeader) RETURN a.name AS fromNode, labels(a) AS fromLabels, b.name AS toNode, labels(b) AS toLabels` },
      { name: 'IS_THE_PROPERTY_TREE_GRAPH_FOR: ListItem → ListHeader', cypher: `MATCH (a)-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(b) WHERE NOT (a:ListItem AND b:ListHeader) RETURN a.name AS fromNode, labels(a) AS fromLabels, b.name AS toNode, labels(b) AS toLabels` },
    ];

    const data = [];
    for (const rule of rules) {
      const violations = await runCypher(rule.cypher);
      data.push({ rule: rule.name, violations, count: violations.length });
    }

    res.json({ success: true, data });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

async function handleLabels(req, res) {
  try {
    const results = [];

    for (const lc of LABEL_CHECKS) {
      const uuid = firmwareConceptUuid(lc.slug);
      const missing = await runCypher(
        `MATCH (i:ListItem)-[:HAS_TAG]->(z:NostrEventTag {type: 'z'})
         WHERE z.value = $uuid AND NOT i:${lc.label}
         OPTIONAL MATCH (i)-[:HAS_TAG]->(n:NostrEventTag)
         WHERE n.type = 'name' OR n.type = 'names'
         RETURN coalesce(n.value, '(unnamed)') AS item, i.uuid AS uuid
         ORDER BY item`,
        { uuid }
      );
      results.push({ label: lc.label, concept: lc.concept, missing, count: missing.length });
    }

    const missingCTH = await runCypher(
      `MATCH (h:ListHeader)-[:IS_THE_CONCEPT_FOR]->(:Superset)
       WHERE NOT h:ConceptHeader
       OPTIONAL MATCH (h)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
       RETURN coalesce(t.value, '(unnamed)') AS concept, h.uuid AS uuid
       ORDER BY concept`
    );
    results.push({ label: 'ConceptHeader', concept: 'IS_THE_CONCEPT_FOR present', missing: missingCTH, count: missingCTH.length });

    res.json({ success: true, data: results });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

async function handleBios(req, res) {
  try {
    // Batch all BIOS concepts into a single query using UNWIND
    const uuids = FIRMWARE_CONCEPTS.map(bc => ({
      name: bc.name,
      uuid: firmwareConceptUuid(bc.slug),
    }));

    const rows = await runCypher(`
      UNWIND $concepts AS c
      OPTIONAL MATCH (h:NostrEvent {uuid: c.uuid})
      RETURN c.name AS concept, c.uuid AS uuid,
             h IS NOT NULL AS exists,
             CASE WHEN h IS NULL THEN false ELSE h:ConceptHeader END AS cth,
             CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH (h)-[:IS_THE_CONCEPT_FOR]->(:Superset) } END AS superset,
             CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH (:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h) } END AS schema,
             CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH (:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h) } END AS primaryProp,
             CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH ()-[:IS_THE_PROPERTIES_SET_FOR]->(h) } END AS properties,
             CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH ()-[:IS_THE_CORE_GRAPH_FOR]->(h) } END AS coreGraph,
             CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH ()-[:IS_THE_CONCEPT_GRAPH_FOR]->(h) } END AS conceptGraph,
             CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH ()-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(h) } END AS ptGraph,
             CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH (h)-[:HAS_TAG]->(:NostrEventTag {type: 'json'}) } END AS json
    `, { concepts: uuids });

    const data = rows.map(r => ({
      ...r,
      complete: r.exists && r.cth && r.superset && r.schema && r.primaryProp && r.properties && r.coreGraph && r.conceptGraph && r.ptGraph && r.json,
    }));

    const complete = data.filter(d => d.complete).length;
    res.json({
      success: true,
      data,
      summary: { total: FIRMWARE_CONCEPTS.length, complete, partial: data.filter(d => d.exists && !d.complete).length, missing: data.filter(d => !d.exists).length },
      firmwareReady: complete === FIRMWARE_CONCEPTS.length,
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

async function handleThreads(req, res) {
  try {
    const conceptName = req.query.concept;
    const mode = req.query.mode || 'elements';
    const through = req.query.through;
    const depth = parseInt(req.query.depth) || 10;

    // No concept: return summary of all concepts
    if (!conceptName) {
      const rows = await runCypher(`
        MATCH (h:ListHeader)-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
        OPTIONAL MATCH (h)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
        OPTIONAL MATCH path = (sup)-[:IS_A_SUPERSET_OF*0..${depth}]->(mid)
        WHERE mid:Set OR mid:Superset
        WITH h, t, sup, count(DISTINCT CASE WHEN mid:Set THEN mid END) AS sets
        OPTIONAL MATCH (sup)<-[:IS_A_SUPERSET_OF*0..${depth}]-(container)-[:HAS_ELEMENT]->(elem)
        RETURN t.value AS concept, sets, count(DISTINCT elem) AS elements
        ORDER BY concept
      `);
      return res.json({ success: true, mode: 'summary', data: rows });
    }

    // Find the concept header + superset
    const headers = await runCypher(
      `MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
       WHERE toLower(t.value) = toLower($conceptName)
       MATCH (h)-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
       RETURN h.uuid AS uuid, t.value AS name, sup.uuid AS supersetUuid, sup.name AS supersetName`,
      { conceptName }
    );

    if (headers.length === 0) {
      return res.json({ success: true, mode, data: [], header: null, error: `Concept "${conceptName}" not found or has no wired Superset` });
    }

    const header = headers[0];

    let rows;
    if (mode === 'sets') {
      rows = await runCypher(
        `MATCH (h:ListHeader {uuid: $uuid})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
         MATCH (sup)-[:IS_A_SUPERSET_OF*1..${depth}]->(s:Set)
         RETURN DISTINCT s.name AS name, s.uuid AS uuid ORDER BY name`,
        { uuid: header.uuid }
      );
    } else if (mode === 'paths') {
      const throughFilter = through
        ? `WHERE ANY(node IN nodes(path) WHERE node.name =~ '(?i).*' + $through + '.*')`
        : '';
      rows = await runCypher(
        `MATCH (h:ListHeader {uuid: $uuid})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
         MATCH path = (sup)-[:IS_A_SUPERSET_OF*0..${depth}]->(mid)-[:HAS_ELEMENT]->(elem)
         ${throughFilter}
         RETURN [n IN nodes(path) | n.name] AS path ORDER BY path`,
        { uuid: header.uuid, ...(through ? { through } : {}) }
      );
    } else {
      // Default: elements
      if (through) {
        rows = await runCypher(
          `MATCH (h:ListHeader {uuid: $uuid})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
           MATCH (sup)-[:IS_A_SUPERSET_OF*0..${depth}]->(s)
           WHERE s.name =~ '(?i).*' + $through + '.*'
           MATCH (s)-[:IS_A_SUPERSET_OF*0..${depth}]->(container)-[:HAS_ELEMENT]->(elem)
           RETURN DISTINCT elem.name AS name, elem.uuid AS uuid ORDER BY name`,
          { uuid: header.uuid, through }
        );
      } else {
        rows = await runCypher(
          `MATCH (h:ListHeader {uuid: $uuid})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
           MATCH (sup)<-[:IS_A_SUPERSET_OF*0..${depth}]-(container)-[:HAS_ELEMENT]->(elem)
           RETURN DISTINCT elem.name AS name, elem.uuid AS uuid ORDER BY name`,
          { uuid: header.uuid }
        );
      }
    }

    res.json({ success: true, mode, header, data: rows });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

// ─── Health: aggregate all checks ─────────────────────────────────

async function handleHealth(req, res) {
  try {
    // Run all checks in parallel
    const [statsRows, skeletonRows, orphanData, wiringData, labelData, firmwareData] = await Promise.all([
      // Stats — just totals
      runCypher(`MATCH (n) WITH count(n) AS nodes OPTIONAL MATCH ()-[r]->() RETURN nodes, count(r) AS relationships`),

      // Skeletons — all concepts
      runCypher(`
        MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
        OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
        OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
        OPTIONAL MATCH (pp:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)
        OPTIONAL MATCH (props)-[:IS_THE_PROPERTIES_SET_FOR]->(h)
        OPTIONAL MATCH (cg)-[:IS_THE_CORE_GRAPH_FOR]->(h)
        OPTIONAL MATCH (conceptG)-[:IS_THE_CONCEPT_GRAPH_FOR]->(h)
        OPTIONAL MATCH (ptg)-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(h)
        RETURN t.value AS concept, h.uuid AS uuid,
               sup IS NOT NULL AS superset,
               js IS NOT NULL AS schema,
               pp IS NOT NULL AS primaryProp,
               props IS NOT NULL AS properties,
               cg IS NOT NULL AS coreGraph,
               conceptG IS NOT NULL AS conceptGraph,
               ptg IS NOT NULL AS ptGraph
        ORDER BY concept
      `),

      // Orphans — counts only
      Promise.all([
        runCypher(`MATCH (i:ListItem)-[:HAS_TAG]->(z:NostrEventTag {type: 'z'}) WHERE NOT EXISTS { MATCH (parent:NostrEvent {uuid: z.value}) } RETURN count(i) AS count`),
        runCypher(`MATCH (i:ListItem) WHERE NOT EXISTS { MATCH (i)-[:HAS_TAG]->(z:NostrEventTag {type: 'z'}) } RETURN count(i) AS count`),
        runCypher(`MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'}) WHERE NOT EXISTS { MATCH (item:ListItem)-[:HAS_TAG]->(z:NostrEventTag {type: 'z'}) WHERE z.value = h.uuid } RETURN count(h) AS count`),
      ]),

      // Wiring — violation counts
      Promise.all([
        runCypher(`MATCH (a)-[:IS_THE_CONCEPT_FOR]->(b) WHERE NOT (a:ListHeader AND b:Superset) RETURN count(*) AS count`),
        runCypher(`MATCH (a)-[:IS_A_SUPERSET_OF]->(b) WHERE NOT ((a:Superset OR a:Set) AND (b:Superset OR b:Set)) RETURN count(*) AS count`),
        runCypher(`MATCH (a)-[:IS_A_PROPERTY_OF]->(b) WHERE NOT (a:Property AND (b:JSONSchema OR b:Property)) RETURN count(*) AS count`),
        runCypher(`MATCH (a)-[:IS_THE_JSON_SCHEMA_FOR]->(b) WHERE NOT (a:JSONSchema AND b:ListHeader) RETURN count(*) AS count`),
        runCypher(`MATCH (a)-[:ENUMERATES]->(b) WHERE NOT (a:ListHeader AND b:Property) RETURN count(*) AS count`),
        runCypher(`MATCH (a)-[:IS_THE_CORE_GRAPH_FOR]->(b) WHERE NOT (a:ListItem AND b:ListHeader) RETURN count(*) AS count`),
        runCypher(`MATCH (a)-[:IS_THE_CONCEPT_GRAPH_FOR]->(b) WHERE NOT (a:ListItem AND b:ListHeader) RETURN count(*) AS count`),
        runCypher(`MATCH (a)-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(b) WHERE NOT (a:ListItem AND b:ListHeader) RETURN count(*) AS count`),
      ]),

      // Labels — missing label counts
      Promise.all([
        ...LABEL_CHECKS.map(lc => {
          const uuid = firmwareConceptUuid(lc.slug);
          return runCypher(
            `MATCH (i:ListItem)-[:HAS_TAG]->(z:NostrEventTag {type: 'z'})
             WHERE z.value = $uuid AND NOT i:${lc.label}
             RETURN count(i) AS count`,
            { uuid }
          );
        }),
        runCypher(`MATCH (h:ListHeader)-[:IS_THE_CONCEPT_FOR]->(:Superset) WHERE NOT h:ConceptHeader RETURN count(h) AS count`),
      ]),

      // BIOS
      (async () => {
        const uuids = FIRMWARE_CONCEPTS.map(bc => ({ name: bc.name, uuid: firmwareConceptUuid(bc.slug) }));
        return runCypher(`
          UNWIND $concepts AS c
          OPTIONAL MATCH (h:NostrEvent {uuid: c.uuid})
          RETURN c.name AS concept, c.uuid AS uuid,
                 h IS NOT NULL AS exists,
                 CASE WHEN h IS NULL THEN false ELSE h:ConceptHeader END AS cth,
                 CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH (h)-[:IS_THE_CONCEPT_FOR]->(:Superset) } END AS superset,
                 CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH (:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h) } END AS schema,
                 CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH (:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h) } END AS primaryProp,
                 CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH ()-[:IS_THE_PROPERTIES_SET_FOR]->(h) } END AS properties,
                 CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH ()-[:IS_THE_CORE_GRAPH_FOR]->(h) } END AS coreGraph,
                 CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH ()-[:IS_THE_CONCEPT_GRAPH_FOR]->(h) } END AS conceptGraph,
                 CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH ()-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(h) } END AS ptGraph,
                 CASE WHEN h IS NULL THEN false ELSE EXISTS { MATCH (h)-[:HAS_TAG]->(:NostrEventTag {type: 'json'}) } END AS json
        `, { concepts: uuids });
      })(),
    ]);

    // ── Aggregate results ──

    const stats = statsRows[0];

    // Skeletons
    const totalConcepts = skeletonRows.length;
    const completeConcepts = skeletonRows.filter(r => r.superset && r.schema && r.primaryProp && r.properties && r.coreGraph && r.conceptGraph && r.ptGraph).length;
    const incompleteConcepts = totalConcepts - completeConcepts;

    // Orphans
    const brokenZCount = orphanData[0][0]?.count || 0;
    const noZCount = orphanData[1][0]?.count || 0;
    const emptyConceptCount = orphanData[2][0]?.count || 0;
    const totalOrphans = brokenZCount + noZCount;

    // Wiring
    const totalWiringViolations = wiringData.reduce((sum, r) => sum + (r[0]?.count || 0), 0);

    // Labels
    const totalMissingLabels = labelData.reduce((sum, r) => sum + (r[0]?.count || 0), 0);

    // BIOS
    const firmwareComplete = firmwareData.filter(r => r.exists && r.cth && r.superset && r.schema && r.primaryProp && r.properties && r.coreGraph && r.conceptGraph && r.ptGraph && r.json).length;
    const firmwareTotal = FIRMWARE_CONCEPTS.length;
    const firmwareReady = firmwareComplete === firmwareTotal;

    // ── Build checks array ──
    const checks = [
      {
        name: 'BIOS',
        status: firmwareReady ? 'pass' : 'fail',
        summary: firmwareReady ? `${firmwareComplete}/${firmwareTotal} complete` : `${firmwareComplete}/${firmwareTotal} complete — ${firmwareTotal - firmwareComplete} missing/incomplete`,
      },
      {
        name: 'Skeletons',
        status: incompleteConcepts === 0 ? 'pass' : 'warn',
        summary: incompleteConcepts === 0
          ? `All ${totalConcepts} concepts have complete skeletons`
          : `${completeConcepts}/${totalConcepts} complete — ${incompleteConcepts} incomplete`,
      },
      {
        name: 'Orphans',
        status: totalOrphans === 0 ? 'pass' : 'warn',
        summary: totalOrphans === 0
          ? 'No orphaned items'
          : `${totalOrphans} orphaned items (${brokenZCount} broken z-tags, ${noZCount} missing z-tags)`,
      },
      {
        name: 'Empty Concepts',
        status: emptyConceptCount === 0 ? 'pass' : 'info',
        summary: emptyConceptCount === 0
          ? 'All concepts have at least one element'
          : `${emptyConceptCount} concepts with no elements`,
      },
      {
        name: 'Wiring',
        status: totalWiringViolations === 0 ? 'pass' : 'fail',
        summary: totalWiringViolations === 0
          ? 'All relationships have correct endpoint types'
          : `${totalWiringViolations} wiring violations`,
      },
      {
        name: 'Labels',
        status: totalMissingLabels === 0 ? 'pass' : 'warn',
        summary: totalMissingLabels === 0
          ? 'All nodes have correct labels'
          : `${totalMissingLabels} nodes missing expected labels`,
      },
    ];

    const overallStatus = checks.some(c => c.status === 'fail') ? 'fail'
      : checks.some(c => c.status === 'warn') ? 'warn'
      : 'pass';

    res.json({
      success: true,
      status: overallStatus,
      stats: { nodes: stats.nodes, relationships: stats.relationships, concepts: totalConcepts },
      checks,
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

// ─── Concepts Summary: batch status for concept list page ─────────

async function handleConceptsSummary(req, res) {
  try {
    const rows = await runCypher(`
      MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
      OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
      OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
      OPTIONAL MATCH (pp:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)
      OPTIONAL MATCH (props)-[:IS_THE_PROPERTIES_SET_FOR]->(h)
      OPTIONAL MATCH (cg)-[:IS_THE_CORE_GRAPH_FOR]->(h)
      OPTIONAL MATCH (conceptG)-[:IS_THE_CONCEPT_GRAPH_FOR]->(h)
      OPTIONAL MATCH (ptg)-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(h)
      WITH h, t,
           h:ConceptHeader AS isCTH,
           EXISTS { MATCH (h)-[:HAS_TAG]->(:NostrEventTag {type: 'json'}) } AS headerJson,
           sup IS NOT NULL AS hasSup,
           CASE WHEN sup IS NULL THEN false ELSE EXISTS { MATCH (sup)-[:HAS_TAG]->(:NostrEventTag {type: 'json'}) } END AS supJson,
           js IS NOT NULL AS hasSchema,
           CASE WHEN js IS NULL THEN false ELSE EXISTS { MATCH (js)-[:HAS_TAG]->(:NostrEventTag {type: 'json'}) } END AS schemaJson,
           pp IS NOT NULL AS hasPP,
           props IS NOT NULL AS hasProps,
           cg IS NOT NULL AS hasCG,
           conceptG IS NOT NULL AS hasConceptG,
           ptg IS NOT NULL AS hasPTG
      RETURN h.uuid AS uuid, t.value AS name,
             isCTH, headerJson,
             hasSup, supJson,
             hasSchema, schemaJson,
             hasPP, hasProps, hasCG, hasConceptG, hasPTG
      ORDER BY name
    `);

    const data = rows.map(r => {
      const skeletonParts = [true, r.hasSup, r.hasSchema, r.hasPP, r.hasProps, r.hasCG, r.hasConceptG, r.hasPTG];
      const skeletonCount = skeletonParts.filter(Boolean).length;
      const skeletonComplete = skeletonCount === 8;

      const jsonParts = [r.headerJson, r.supJson, r.schemaJson];
      const jsonCount = jsonParts.filter(Boolean).length;

      // Determine issues
      const issues = [];
      if (!skeletonComplete) issues.push(`skeleton ${skeletonCount}/8`);
      if (!r.isCTH && r.hasSup) issues.push('missing ConceptHeader label');
      if (skeletonComplete && jsonCount < 3) issues.push(`JSON ${jsonCount}/3`);

      let status;
      if (skeletonComplete && r.isCTH && jsonCount >= 3) {
        status = 'pass';
      } else if (skeletonCount >= 3) {
        status = 'warn';
      } else {
        status = 'fail';
      }

      const summary = issues.length === 0 ? 'Healthy' : issues.join(', ');

      return { uuid: r.uuid, name: r.name, status, summary };
    });

    res.json({ success: true, data });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

// ─── Concept: comprehensive single-concept audit ──────────────────

async function handleConcept(req, res) {
  try {
    const conceptName = req.query.concept;
    if (!conceptName) {
      return res.status(400).json({ success: false, error: 'Missing "concept" query parameter' });
    }

    // 1. Find the concept header
    const headers = await runCypher(
      `MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
       WHERE toLower(t.value) = toLower($conceptName)
       RETURN h.uuid AS uuid, t.value AS name, h.pubkey AS pubkey,
              h:ConceptHeader AS isCTH,
              EXISTS { MATCH (h)-[:HAS_TAG]->(:NostrEventTag {type: 'json'}) } AS hasJson`,
      { conceptName }
    );

    if (headers.length === 0) {
      return res.json({ success: true, found: false, error: `Concept "${conceptName}" not found` });
    }

    const header = headers[0];
    const uuid = header.uuid;

    // 2. Skeleton — all constituent nodes
    const skeleton = await runCypher(
      `MATCH (h:ListHeader {uuid: $uuid})
       OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
       OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
       OPTIONAL MATCH (pp:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)
       OPTIONAL MATCH (props)-[:IS_THE_PROPERTIES_SET_FOR]->(h)
       OPTIONAL MATCH (cg)-[:IS_THE_CORE_GRAPH_FOR]->(h)
       OPTIONAL MATCH (conceptG)-[:IS_THE_CONCEPT_GRAPH_FOR]->(h)
       OPTIONAL MATCH (ptg)-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(h)
       RETURN sup.uuid AS supersetUuid, sup.name AS supersetName,
              EXISTS { MATCH (sup)-[:HAS_TAG]->(:NostrEventTag {type: 'json'}) } AS supersetJson,
              js.uuid AS schemaUuid, js.name AS schemaName,
              EXISTS { MATCH (js)-[:HAS_TAG]->(:NostrEventTag {type: 'json'}) } AS schemaJson,
              pp.uuid AS primaryPropUuid, pp.name AS primaryPropName,
              EXISTS { MATCH (pp)-[:HAS_TAG]->(:NostrEventTag {type: 'json'}) } AS primaryPropJson,
              props.uuid AS propsUuid, props.name AS propsName,
              EXISTS { MATCH (props)-[:HAS_TAG]->(:NostrEventTag {type: 'json'}) } AS propsJson,
              cg.uuid AS coreGraphUuid, cg.name AS coreGraphName,
              EXISTS { MATCH (cg)-[:HAS_TAG]->(:NostrEventTag {type: 'json'}) } AS coreGraphJson,
              conceptG.uuid AS conceptGraphUuid, conceptG.name AS conceptGraphName,
              EXISTS { MATCH (conceptG)-[:HAS_TAG]->(:NostrEventTag {type: 'json'}) } AS conceptGraphJson,
              ptg.uuid AS ptGraphUuid, ptg.name AS ptGraphName,
              EXISTS { MATCH (ptg)-[:HAS_TAG]->(:NostrEventTag {type: 'json'}) } AS ptGraphJson
       LIMIT 1`,
      { uuid }
    );

    const sk = skeleton[0] || {};

    const nodes = [
      { role: 'Concept Header', uuid, name: header.name, exists: true, json: header.hasJson, cth: header.isCTH },
      { role: 'Superset', uuid: sk.supersetUuid, name: sk.supersetName, exists: !!sk.supersetUuid, json: sk.supersetJson || false },
      { role: 'JSON Schema', uuid: sk.schemaUuid, name: sk.schemaName, exists: !!sk.schemaUuid, json: sk.schemaJson || false },
      { role: 'Primary Property', uuid: sk.primaryPropUuid, name: sk.primaryPropName, exists: !!sk.primaryPropUuid, json: sk.primaryPropJson || false },
      { role: 'Properties', uuid: sk.propsUuid, name: sk.propsName, exists: !!sk.propsUuid, json: sk.propsJson || false },
      { role: 'Property Tree Graph', uuid: sk.ptGraphUuid, name: sk.ptGraphName, exists: !!sk.ptGraphUuid, json: sk.ptGraphJson || false },
      { role: 'Core Nodes Graph', uuid: sk.coreGraphUuid, name: sk.coreGraphName, exists: !!sk.coreGraphUuid, json: sk.coreGraphJson || false },
      { role: 'Concept Graph', uuid: sk.conceptGraphUuid, name: sk.conceptGraphName, exists: !!sk.conceptGraphUuid, json: sk.conceptGraphJson || false },
    ];

    const skeletonComplete = nodes.every(n => n.exists);
    const jsonComplete = nodes.every(n => n.json);

    // 2b. JSON Schema Validation — for each core node with JSON, validate against its concept's schema
    const nodesWithJson = nodes.filter(n => n.exists && n.json && n.uuid);
    if (nodesWithJson.length > 0) {
      // Batch fetch: for each node, get its JSON content and z-tags (concept UUIDs)
      const jsonRows = await runCypher(
        `UNWIND $uuids AS nodeUuid
         MATCH (n:NostrEvent {uuid: nodeUuid})
         OPTIONAL MATCH (n)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
         OPTIONAL MATCH (n)-[:HAS_TAG]->(zt:NostrEventTag {type: 'z'})
         RETURN nodeUuid AS uuid, head(collect(DISTINCT jt.value)) AS jsonText, collect(DISTINCT zt.value) AS zTags`,
        { uuids: nodesWithJson.map(n => n.uuid) }
      );

      // Collect unique z-tags (concept UUIDs) to fetch their schemas
      const zTags = [...new Set(jsonRows.flatMap(r => (r.zTags || []).filter(Boolean)))];
      let schemaMap = {}; // zTag → parsed jsonSchema section

      if (zTags.length > 0) {
        const schemaRows = await runCypher(
          `UNWIND $zTags AS conceptUuid
           MATCH (h:NostrEvent {uuid: conceptUuid})
           OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
           OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
           RETURN conceptUuid, head(collect(jt.value)) AS schemaJsonText`,
          { zTags }
        );

        for (const sr of schemaRows) {
          if (sr.schemaJsonText) {
            try {
              const parsed = JSON.parse(sr.schemaJsonText);
              if (parsed.jsonSchema) {
                schemaMap[sr.conceptUuid] = parsed.jsonSchema;
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }

      // Validate each node
      for (const jr of jsonRows) {
        const node = nodes.find(n => n.uuid === jr.uuid);
        if (!node || !jr.jsonText) continue;

        try {
          const nodeJson = JSON.parse(jr.jsonText);

          const nodeZTags = (jr.zTags || []).filter(Boolean);

          if (nodeZTags.length === 0) {
            // Fallback: if this is a kind 39998/9998 ConceptHeader, use firmware schema
            const isConceptHeader = jr.uuid.startsWith('39998:') || jr.uuid.startsWith('9998:');
            if (isConceptHeader) {
              const fwSchema = firmware.getConceptSchema('concept-header');
              if (fwSchema && fwSchema.jsonSchema) {
                const schemaCopy = { ...fwSchema.jsonSchema };
                delete schemaCopy.$schema;
                const validate = ajv.compile(schemaCopy);
                const isValid = validate(nodeJson);
                node.valid = isValid;
                node.validationNote = 'Validated via firmware fallback (concept-header)';
                if (!isValid) {
                  node.validationErrors = validate.errors.map(e => ({
                    path: e.instancePath || '/',
                    message: e.message,
                    keyword: e.keyword,
                  }));
                }
                continue;
              }
            }
            node.valid = null;
            node.validationNote = 'No z-tag — cannot determine concept';
            continue;
          }

          // Try z-tags in order — use the first one that has a schema available
          const schema = nodeZTags.map(z => schemaMap[z]).find(s => s);
          if (!schema) {
            node.valid = null; // Schema not available for any z-tag
            node.validationNote = 'Concept schema not available';
            continue;
          }

          // Validate the node's JSON against the concept's JSON Schema
          // Strip $schema meta-reference — our schemas aren't standard JSON Schema drafts
          const schemaCopy = { ...schema };
          delete schemaCopy.$schema;
          const validate = ajv.compile(schemaCopy);
          const isValid = validate(nodeJson);
          node.valid = isValid;
          if (!isValid) {
            node.validationErrors = validate.errors.map(e => ({
              path: e.instancePath || '/',
              message: e.message,
              keyword: e.keyword,
            }));
          }
        } catch (e) {
          node.valid = false;
          node.validationNote = `JSON parse error: ${e.message}`;
        }
      }
    }

    const validationComplete = nodes.every(n => !n.exists || !n.json || n.valid === true);

    // 3. Elements — count, JSON coverage, orphans
    const supersetUuid = sk.supersetUuid;
    let elements = { total: 0, withJson: 0, withoutJson: 0, orphaned: 0, items: [] };

    if (supersetUuid) {
      const elemRows = await runCypher(
        `MATCH (h:ListHeader {uuid: $uuid})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
         MATCH (sup)<-[:IS_A_SUPERSET_OF*0..10]-(container)-[:HAS_ELEMENT]->(elem)
         OPTIONAL MATCH (elem)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
         OPTIONAL MATCH (elem)-[:HAS_TAG]->(zt:NostrEventTag {type: 'z'})
         OPTIONAL MATCH (parent:NostrEvent {uuid: zt.value})
         RETURN DISTINCT elem.uuid AS uuid, elem.name AS name,
                jt IS NOT NULL AS hasJson,
                zt IS NULL AS missingZTag,
                CASE WHEN zt IS NOT NULL AND parent IS NULL THEN true ELSE false END AS brokenZTag
         ORDER BY name`,
        { uuid }
      );

      elements.total = elemRows.length;
      elements.withJson = elemRows.filter(r => r.hasJson).length;
      elements.withoutJson = elements.total - elements.withJson;
      elements.orphaned = elemRows.filter(r => r.missingZTag || r.brokenZTag).length;
      elements.items = elemRows;
    }

    // 4. Sets — intermediate set count
    let sets = { total: 0, items: [] };
    if (supersetUuid) {
      const setRows = await runCypher(
        `MATCH (h:ListHeader {uuid: $uuid})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
         MATCH (sup)-[:IS_A_SUPERSET_OF*1..10]->(s:Set)
         RETURN DISTINCT s.uuid AS uuid, s.name AS name ORDER BY name`,
        { uuid }
      );
      sets.total = setRows.length;
      sets.items = setRows;
    }

    // 5. Wiring — check all relationships involving this concept's nodes
    const conceptNodeUuids = nodes.filter(n => n.exists).map(n => n.uuid);
    let wiringViolations = [];

    if (conceptNodeUuids.length > 0) {
      wiringViolations = await runCypher(
        `UNWIND $uuids AS nodeUuid
         MATCH (a {uuid: nodeUuid})-[r]->(b)
         WHERE NOT (
           (type(r) = 'IS_THE_CONCEPT_FOR' AND a:ListHeader AND b:Superset) OR
           (type(r) = 'IS_A_SUPERSET_OF' AND (a:Superset OR a:Set) AND (b:Superset OR b:Set)) OR
           (type(r) = 'HAS_ELEMENT' AND b:ListItem) OR
           (type(r) = 'IS_THE_JSON_SCHEMA_FOR' AND a:JSONSchema AND b:ListHeader) OR
           (type(r) = 'IS_A_PROPERTY_OF' AND a:Property AND (b:JSONSchema OR b:Property)) OR
           (type(r) = 'IS_THE_PRIMARY_PROPERTY_FOR' AND a:Property AND b:ListHeader) OR
           (type(r) = 'ENUMERATES' AND a:ListHeader AND b:Property) OR
           (type(r) = 'IS_THE_PROPERTIES_SET_FOR' AND b:ListHeader) OR
           (type(r) = 'IS_THE_CORE_GRAPH_FOR' AND a:ListItem AND b:ListHeader) OR
           (type(r) = 'IS_THE_CONCEPT_GRAPH_FOR' AND a:ListItem AND b:ListHeader) OR
           (type(r) = 'IS_THE_PROPERTY_TREE_GRAPH_FOR' AND a:ListItem AND b:ListHeader) OR
           (type(r) = 'HAS_TAG') OR
           (type(r) = 'AUTHORS') OR
           (type(r) = 'REFERENCES')
         )
         RETURN a.uuid AS fromUuid, a.name AS fromName, labels(a) AS fromLabels,
                type(r) AS relType,
                b.uuid AS toUuid, b.name AS toName, labels(b) AS toLabels`,
        { uuids: conceptNodeUuids }
      );
    }

    // 6. Labels — check elements have correct label for this concept
    let missingLabels = [];
    // Find which BIOS label this concept should assign to its elements
    const labelMatch = LABEL_CHECKS.find(lc => firmwareConceptUuid(lc.slug) === uuid);
    if (labelMatch) {
      missingLabels = await runCypher(
        `MATCH (i:ListItem)-[:HAS_TAG]->(z:NostrEventTag {type: 'z'})
         WHERE z.value = $uuid AND NOT i:${labelMatch.label}
         RETURN i.uuid AS uuid, i.name AS name`,
        { uuid }
      );
    }

    // ── Build checks summary ──
    const checks = [
      {
        name: 'Skeleton',
        status: skeletonComplete ? 'pass' : 'fail',
        summary: skeletonComplete
          ? `All 8 nodes present${header.isCTH ? ', ConceptHeader label ✅' : ''}`
          : `${nodes.filter(n => n.exists).length}/8 nodes present`,
      },
      {
        name: 'ConceptHeader Label',
        status: header.isCTH ? 'pass' : (sk.supersetUuid ? 'warn' : 'info'),
        summary: header.isCTH ? 'ListHeader has ConceptHeader label'
          : sk.supersetUuid ? 'Has superset but missing ConceptHeader label' : 'No superset wired yet',
      },
      {
        name: 'JSON Tags',
        status: jsonComplete ? 'pass' : 'warn',
        summary: jsonComplete
          ? 'All skeleton nodes have JSON tags'
          : `${nodes.filter(n => n.json).length}/8 nodes have JSON tags`,
      },
      {
        name: 'JSON Validation',
        status: validationComplete ? 'pass'
          : nodes.some(n => n.valid === false) ? 'fail' : 'warn',
        summary: (() => {
          const validated = nodes.filter(n => n.valid === true).length;
          const failed = nodes.filter(n => n.valid === false).length;
          const skipped = nodes.filter(n => n.valid === null).length;
          const noJson = nodes.filter(n => n.exists && !n.json).length;
          if (validated === nodes.length) return 'All nodes validate against their concept schemas';
          const parts = [];
          if (validated > 0) parts.push(`${validated} valid`);
          if (failed > 0) parts.push(`${failed} invalid`);
          if (skipped > 0) parts.push(`${skipped} no schema`);
          if (noJson > 0) parts.push(`${noJson} no JSON`);
          return parts.join(', ');
        })(),
      },
      {
        name: 'Elements',
        status: elements.total > 0 ? 'pass' : 'info',
        summary: elements.total > 0
          ? `${elements.total} elements (${elements.withJson} with JSON, ${elements.withoutJson} without)`
          : 'No elements',
      },
      {
        name: 'Element Orphans',
        status: elements.orphaned === 0 ? 'pass' : 'warn',
        summary: elements.orphaned === 0
          ? 'No orphaned elements'
          : `${elements.orphaned} elements with broken/missing z-tags`,
      },
      {
        name: 'Sets',
        status: 'info',
        summary: sets.total > 0 ? `${sets.total} intermediate sets` : 'No intermediate sets',
      },
      {
        name: 'Wiring',
        status: wiringViolations.length === 0 ? 'pass' : 'fail',
        summary: wiringViolations.length === 0
          ? 'All relationships have correct types'
          : `${wiringViolations.length} wiring violations`,
      },
      {
        name: 'Labels',
        status: labelMatch
          ? (missingLabels.length === 0 ? 'pass' : 'warn')
          : 'info',
        summary: labelMatch
          ? (missingLabels.length === 0 ? `All elements have :${labelMatch.label} label` : `${missingLabels.length} elements missing :${labelMatch.label} label`)
          : 'Not a BIOS label-assigning concept',
      },
    ];

    const overallStatus = checks.some(c => c.status === 'fail') ? 'fail'
      : checks.some(c => c.status === 'warn') ? 'warn'
      : 'pass';

    res.json({
      success: true,
      found: true,
      status: overallStatus,
      concept: { name: header.name, uuid, pubkey: header.pubkey },
      checks,
      skeleton: { nodes, complete: skeletonComplete, jsonComplete },
      elements,
      sets,
      wiring: { violations: wiringViolations, count: wiringViolations.length },
      labels: { expected: labelMatch?.label || null, missing: missingLabels, count: missingLabels.length },
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

// ─── Register routes ──────────────────────────────────────────────

function registerAuditRoutes(app) {
  app.get('/api/audit/health', handleHealth);
  app.get('/api/audit/concepts-summary', handleConceptsSummary);
  app.get('/api/audit/concept', handleConcept);
  app.get('/api/audit/stats', handleStats);
  app.get('/api/audit/skeletons', handleSkeletons);
  app.get('/api/audit/orphans', handleOrphans);
  app.get('/api/audit/wiring', handleWiring);
  app.get('/api/audit/labels', handleLabels);
  app.get('/api/audit/bios', handleBios);     // legacy alias
  app.get('/api/audit/firmware', handleBios);  // preferred
  app.get('/api/audit/threads', handleThreads);
}

module.exports = { registerAuditRoutes };
