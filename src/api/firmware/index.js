/**
 * Firmware API — read-only endpoints for the Firmware Explorer UI.
 *
 * GET /api/firmware/manifest        — firmware version + concept list
 * GET /api/firmware/concept/:slug   — core nodes + raw JSON for a concept
 */

const firmware = require('../normalize/firmware');
const { runCypher } = require('../../lib/neo4j-driver');

// Core node roles and the Neo4j relationship used to find them
const CORE_NODE_ROLES = [
  { key: 'header',         label: 'Concept Header',     rel: null },
  { key: 'superset',       label: 'Superset',           rel: 'IS_THE_CONCEPT_FOR', direction: 'out' },
  { key: 'schema',         label: 'JSON Schema',        rel: 'IS_THE_JSON_SCHEMA_FOR', direction: 'in' },
  { key: 'primaryProperty',label: 'Primary Property',   rel: 'IS_THE_PRIMARY_PROPERTY_FOR', direction: 'in' },
  { key: 'properties',     label: 'Properties',         rel: 'IS_THE_PROPERTIES_SET_FOR', direction: 'in' },
  { key: 'ptGraph',        label: 'Property Tree Graph', rel: 'IS_THE_PROPERTY_TREE_GRAPH_FOR', direction: 'in' },
  { key: 'coreGraph',      label: 'Core Nodes Graph',   rel: 'IS_THE_CORE_GRAPH_FOR', direction: 'in' },
  { key: 'conceptGraph',   label: 'Concept Graph',      rel: 'IS_THE_CONCEPT_GRAPH_FOR', direction: 'in' },
];

async function handleManifest(req, res) {
  try {
    const manifest = firmware.getManifest();
    const concepts = manifest.concepts.map(c => ({
      slug: c.slug,
      categories: c.categories || [],
      // Load naming info from firmware
      ...((() => {
        const data = firmware.getConcept(c.slug);
        if (data && data.conceptHeader) {
          return {
            name: data.conceptHeader.oNames?.singular || c.slug,
            plural: data.conceptHeader.oNames?.plural || c.slug + 's',
            description: data.conceptHeader.description || '',
          };
        }
        return { name: c.slug, plural: c.slug + 's', description: '' };
      })()),
    }));

    // Collect unique categories
    const allCategories = [...new Set(concepts.flatMap(c => c.categories))].sort();

    res.json({
      success: true,
      version: manifest.version,
      date: manifest.date,
      categories: allCategories,
      concepts,
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

async function handleConcept(req, res) {
  try {
    const slug = req.params.slug;
    if (!slug) return res.status(400).json({ success: false, error: 'Missing slug' });

    // Verify it's a firmware concept
    const manifest = firmware.getManifest();
    const entry = manifest.concepts.find(c => c.slug === slug);
    if (!entry) return res.json({ success: false, error: `"${slug}" is not a firmware concept` });

    // Get naming info from firmware
    const conceptData = firmware.getConcept(slug);
    const ch = conceptData?.conceptHeader || {};

    // Find the concept header in the graph
    const conceptName = (ch.oNames?.singular || slug).toLowerCase();
    const headers = await runCypher(
      `MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
       WHERE toLower(t.value) = $name
       RETURN h.uuid AS uuid, h.name AS name
       LIMIT 1`,
      { name: conceptName }
    );

    if (headers.length === 0) {
      return res.json({
        success: true,
        slug,
        name: ch.oNames?.singular || slug,
        description: ch.description || '',
        installed: false,
        nodes: {},
      });
    }

    const headerUuid = headers[0].uuid;

    // Fetch all core nodes + their JSON in one query
    const rows = await runCypher(
      `MATCH (h:ListHeader {uuid: $uuid})
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
       LIMIT 1`,
      { uuid: headerUuid }
    );

    const r = rows[0] || {};

    // Parse JSON strings into objects
    function parseJson(str) {
      if (!str) return null;
      try { return JSON.parse(str); } catch { return null; }
    }

    const nodes = {
      header:          { uuid: r.headerUuid, name: r.headerName, json: parseJson(r.headerJson) },
      superset:        { uuid: r.supersetUuid, name: r.supersetName, json: parseJson(r.supersetJson) },
      schema:          { uuid: r.schemaUuid, name: r.schemaName, json: parseJson(r.schemaJson) },
      primaryProperty: { uuid: r.ppUuid, name: r.ppName, json: parseJson(r.ppJson) },
      properties:      { uuid: r.propsUuid, name: r.propsName, json: parseJson(r.propsJson) },
      ptGraph:         { uuid: r.ptgUuid, name: r.ptgName, json: parseJson(r.ptgJson) },
      coreGraph:       { uuid: r.cgUuid, name: r.cgName, json: parseJson(r.cgJson) },
      conceptGraph:    { uuid: r.cogUuid, name: r.cogName, json: parseJson(r.cogJson) },
    };

    res.json({
      success: true,
      slug,
      name: ch.oNames?.singular || slug,
      title: ch.oTitles?.singular || slug,
      plural: ch.oNames?.plural || '',
      description: ch.description || '',
      installed: true,
      nodes,
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

function registerFirmwareApiRoutes(app) {
  app.get('/api/firmware/manifest', handleManifest);
  app.get('/api/firmware/concept/:slug', handleConcept);
}

module.exports = { registerFirmwareApiRoutes };
