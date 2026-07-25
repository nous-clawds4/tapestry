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
const { getConceptCoreNodes } = require('../../lib/conceptCoreNodes');
const { handleFirmwareInstall } = require('../../firmware/install');

const FIRMWARE_VERSIONS_DIR = path.resolve(__dirname, '../../../firmware/versions');
const FIRMWARE_ACTIVE_LINK = path.resolve(__dirname, '../../../firmware/active');

// The 8 core-node roles + their Neo4j relationships now live in the shared read helper
// (src/lib/conceptCoreNodes.js) — the single source of that query, per ADR tapestries/0004.

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
            pluralSlug: data.conceptHeader.oSlugs?.plural || c.slug + 's',
            description: data.conceptHeader.description || '',
          };
        }
        return { name: c.slug, plural: c.slug + 's', pluralSlug: c.slug + 's', description: '' };
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
      enumerations: manifest.enumerations || {},
      sets: manifest.sets || {},
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

    // Core nodes + JSON via the shared Neo4j+LMDB read helper (ADR tapestries/0004).
    // The header lookup above stays firmware-specific (slug → manifest → name → uuid);
    // the core-node traversal + LMDB-resolved JSON is now one shared implementation.
    const { nodes } = await getConceptCoreNodes(headerUuid);

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
