/**
 * Firmware API — endpoints for the Firmware Explorer UI.
 *
 * GET  /api/firmware/manifest            — active firmware version + concept list
 * GET  /api/firmware/concept/:slug       — core nodes + raw JSON for a concept
 * GET  /api/firmware/versions            — list available firmware versions
 * GET  /api/firmware/install-status      — check if firmware is installed in Neo4j
 * POST /api/firmware/install             — install firmware (pass1 + pass2)
 */

const fs = require('fs');
const path = require('path');
const firmware = require('../normalize/firmware');
const { runCypher } = require('../../lib/neo4j-driver');
const { handleFirmwareInstall } = require('../../firmware/install');

const FIRMWARE_VERSIONS_DIR = path.resolve(__dirname, '../../../firmware/versions');
const FIRMWARE_ACTIVE_LINK = path.resolve(__dirname, '../../../firmware/active');

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

    const allCategories = [...new Set(concepts.flatMap(c => c.categories))].sort();

    res.json({
      success: true,
      version: manifest.version,
      date: manifest.date,
      description: manifest.description || '',
      categories: allCategories,
      concepts,
      relationshipTypes: (manifest.relationshipTypes || []).map(rt => {
        const filePath = path.join(firmware.firmwareDir(), rt.file);
        let data = null;
        try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch {}
        return {
          slug: rt.slug,
          name: data?.relationshipType?.name || rt.slug,
          alias: data?.relationshipType?.alias || rt.slug,
          description: data?.word?.description || '',
        };
      }),
      elements: manifest.elements || {},
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

/**
 * GET /api/firmware/versions
 * Lists all available firmware versions from firmware/versions/ directory.
 * Each version includes its manifest summary.
 */
async function handleVersions(req, res) {
  try {
    const versions = [];

    if (fs.existsSync(FIRMWARE_VERSIONS_DIR)) {
      const dirs = fs.readdirSync(FIRMWARE_VERSIONS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .sort();

      for (const dir of dirs) {
        const manifestPath = path.join(FIRMWARE_VERSIONS_DIR, dir, 'manifest.json');
        if (!fs.existsSync(manifestPath)) continue;

        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          versions.push({
            dir,
            version: manifest.version,
            date: manifest.date,
            description: manifest.description || '',
            conceptCount: (manifest.concepts || []).length,
            relationshipTypeCount: (manifest.relationshipTypes || []).length,
            elementCategories: Object.keys(manifest.elements || {}),
          });
        } catch (e) {
          versions.push({ dir, error: e.message });
        }
      }
    }

    // Determine which version is active
    let activeDir = null;
    try {
      const target = fs.readlinkSync(FIRMWARE_ACTIVE_LINK);
      // target is like "versions/v0.0.1" — extract the dir name
      activeDir = path.basename(target);
    } catch {}

    res.json({ success: true, versions, activeDir });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

/**
 * GET /api/firmware/install-status
 * Checks if firmware is actually installed in Neo4j by looking for ConceptHeader nodes.
 */
async function handleInstallStatus(req, res) {
  try {
    // Count firmware concept headers in Neo4j
    const manifest = firmware.getManifest();
    const taPubkey = firmware.getTAPubkey();

    let installedCount = 0;
    let totalCount = manifest.concepts.length;
    const missing = [];
    const installed = [];

    for (const entry of manifest.concepts) {
      const expectedUuid = `39998:${taPubkey}:${entry.slug}`;
      const rows = await runCypher(
        `MATCH (h:NostrEvent {uuid: $uuid}) RETURN h.uuid AS uuid LIMIT 1`,
        { uuid: expectedUuid }
      );
      if (rows.length > 0) {
        installedCount++;
        installed.push(entry.slug);
      } else {
        missing.push(entry.slug);
      }
    }

    res.json({
      success: true,
      installed: installedCount === totalCount,
      partial: installedCount > 0 && installedCount < totalCount,
      installedCount,
      totalCount,
      missing,
      installedSlugs: installed,
      activeVersion: manifest.version,
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
}

async function handleConcept(req, res) {
  try {
    const slug = req.params.slug;
    if (!slug) return res.status(400).json({ success: false, error: 'Missing slug' });

    const manifest = firmware.getManifest();
    const entry = manifest.concepts.find(c => c.slug === slug);
    if (!entry) return res.json({ success: false, error: `"${slug}" is not a firmware concept` });

    const conceptData = firmware.getConcept(slug);
    const ch = conceptData?.conceptHeader || {};

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
  app.get('/api/firmware/versions', handleVersions);
  app.get('/api/firmware/install-status', handleInstallStatus);
  app.get('/api/firmware/concept/:slug', handleConcept);
  app.post('/api/firmware/install', handleFirmwareInstall);
}

module.exports = { registerFirmwareApiRoutes };
