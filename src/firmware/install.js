/**
 * Firmware Install Script
 *
 * Two-pass installation of tapestry firmware into a running tapestry instance.
 *
 * Pass 1 — Bootstrap: Create all canonical concepts (skeleton + elements)
 *   Uses POST /api/normalize/create-concept and /api/normalize/create-element
 *   After this pass, every concept exists with a generic starter JSON Schema.
 *
 * Pass 2 — Enrich: Replace each starter JSON Schema with the real one from firmware
 *   Uses POST /api/normalize/save-schema
 *   After this pass, each concept has its detailed, validated JSON Schema.
 *
 * Usage:
 *   Called via POST /api/firmware/install
 *   Or directly: node src/firmware/install.js [--pass1] [--pass2] [--dry-run]
 *
 * Prerequisites:
 *   - Tapestry server running (for API calls)
 *   - firmware/active symlink pointing to a valid firmware version
 *   - TA key available for signing
 */

const fs = require('fs');
const path = require('path');
const firmware = require('../api/normalize/firmware');

// ── Config ───────────────────────────────────────────────────

const API_BASE = process.env.TAPESTRY_API_BASE || 'http://localhost:8080';

// ── HTTP helpers ─────────────────────────────────────────────

async function apiPost(endpoint, body) {
  const url = `${API_BASE}${endpoint}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await resp.json();
  if (!resp.ok && !json.success) {
    throw new Error(json.error || `API ${endpoint} failed: ${resp.status}`);
  }
  return json;
}

async function apiGet(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  const resp = await fetch(url);
  return resp.json();
}

// ── Pass 1: Bootstrap ────────────────────────────────────────

/**
 * Create all canonical concept skeletons from firmware.
 * Each concept gets: ConceptHeader + Superset + JSON Schema (starter) +
 * Primary Property + Properties set + 3 Graphs + 7 Relationships = 11 events.
 *
 * Returns a map of slug → { headerUuid, supersetUuid, schemaUuid, ... }
 */
async function pass1_bootstrap(opts = {}) {
  const { dryRun = false } = opts;
  const manifest = firmware.getManifest();
  const results = {};
  const errors = [];

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          FIRMWARE INSTALL — Pass 1: Bootstrap           ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`  Firmware version: ${manifest.version}`);
  console.log(`  Concepts to create: ${manifest.concepts.length}`);
  console.log(`  Dry run: ${dryRun}\n`);

  // ── 1a. Create all concept skeletons ─────────────────────

  for (const entry of manifest.concepts) {
    const slug = entry.slug;
    const conceptDir = path.join(firmware.firmwareDir(), entry.dir);
    const headerPath = path.join(conceptDir, entry.conceptHeader);

    if (!fs.existsSync(headerPath)) {
      console.log(`  ❌ ${slug}: concept-header.json not found at ${headerPath}`);
      errors.push({ slug, error: 'concept-header.json not found' });
      continue;
    }

    const header = JSON.parse(fs.readFileSync(headerPath, 'utf8'));
    const ch = header.conceptHeader;

    console.log(`  📝 ${slug}: "${ch.oNames.singular}" / "${ch.oNames.plural}"`);

    if (dryRun) {
      results[slug] = { dryRun: true };
      continue;
    }

    try {
      const result = await apiPost('/api/normalize/create-concept', {
        name: ch.oNames.singular,
        plural: ch.oNames.plural,
        description: ch.description,
        dTag: slug,  // deterministic d-tag for firmware concepts
      });

      if (result.success) {
        results[slug] = result.concept;
        console.log(`     ✅ Created (header: ${result.concept.uuid})`);
      } else {
        // Concept might already exist — that's ok
        console.log(`     ⚠️  ${result.error}`);
        results[slug] = { existing: true, error: result.error };
      }
    } catch (err) {
      console.log(`     ❌ ${err.message}`);
      errors.push({ slug, error: err.message });
    }
  }

  // ── 1b. Create elements ──────────────────────────────────

  if (manifest.elements) {
    console.log('\n── Creating elements ──\n');

    for (const [category, entries] of Object.entries(manifest.elements)) {
      console.log(`  Category: ${category}`);

      for (const entry of entries) {
        const filePath = path.join(firmware.firmwareDir(), entry.file);
        if (!fs.existsSync(filePath)) {
          console.log(`    ❌ ${entry.slug}: file not found`);
          errors.push({ slug: entry.slug, error: 'element file not found' });
          continue;
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Determine the parent concept name from the element's word wrapper
        // The element's primary section key tells us the concept
        const sectionKeys = Object.keys(data).filter(k => k !== 'word');
        const conceptKey = sectionKeys[0]; // e.g., "jsonDataType", "nodeType"
        const elementName = data.word.name.includes(':')
          ? data.word.name.split(':').pop().trim()
          : data[conceptKey]?.name || data.word.slug;

        // Map category to concept name for the create-element API
        // Names must match what handleCreateConcept stores (lowercased via deriveAllNames)
        const categoryToConceptName = {
          'json-data-types': 'json data type',
          'node-types': 'node type',
          'graph-types': 'graph type',
          'validation-tool-types': 'validation tool type',
        };
        const conceptName = categoryToConceptName[category];

        if (!conceptName) {
          console.log(`    ⚠️  Unknown category ${category}, skipping`);
          continue;
        }

        console.log(`    📝 ${entry.slug} → "${conceptName}"`);

        if (dryRun) continue;

        try {
          const result = await apiPost('/api/normalize/create-element', {
            concept: conceptName,
            name: elementName,
          });
          if (result.success) {
            console.log(`       ✅ Created`);
          } else {
            console.log(`       ⚠️  ${result.error}`);
          }
        } catch (err) {
          console.log(`       ❌ ${err.message}`);
          errors.push({ slug: entry.slug, error: err.message });
        }
      }
    }
  }

  console.log(`\n  Pass 1 complete: ${Object.keys(results).length} concepts, ${errors.length} errors\n`);
  return { results, errors };
}

// ── Pass 2: Enrich ───────────────────────────────────────────

/**
 * Replace each concept's starter JSON Schema with the real one from firmware.
 *
 * For each concept that has a json-schema.json in firmware:
 *   1. Load the firmware schema (word + jsonSchema sections)
 *   2. Look up the concept's schema node UUID from Neo4j
 *   3. Inject the correct coreMemberOf UUID
 *   4. Call save-schema to overwrite the starter
 */
async function pass2_enrich(opts = {}) {
  const { dryRun = false } = opts;
  const manifest = firmware.getManifest();
  const updated = [];
  const skipped = [];
  const errors = [];

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          FIRMWARE INSTALL — Pass 2: Enrich              ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
  console.log(`  Firmware version: ${manifest.version}`);
  console.log(`  Dry run: ${dryRun}\n`);

  for (const entry of manifest.concepts) {
    const slug = entry.slug;
    const conceptDir = path.join(firmware.firmwareDir(), entry.dir);
    const schemaPath = path.join(conceptDir, entry.jsonSchema);

    if (!fs.existsSync(schemaPath)) {
      console.log(`  ⏭️  ${slug}: no json-schema.json in firmware`);
      skipped.push(slug);
      continue;
    }

    // Load the firmware schema template
    const firmwareSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    // Look up the concept's header UUID and schema UUID from Neo4j
    // We need the concept header's naming forms to find it
    const headerPath = path.join(conceptDir, entry.conceptHeader);
    const header = JSON.parse(fs.readFileSync(headerPath, 'utf8'));
    const conceptName = header.conceptHeader.oNames.singular;

    console.log(`  🔧 ${slug}: enriching JSON Schema for "${conceptName}"`);

    if (dryRun) {
      updated.push(slug);
      continue;
    }

    try {
      // Find the concept's schema node UUID via Neo4j
      // Use the relationship alias from firmware for the schema relationship
      const schemaRel = firmware.relAlias('CORE_NODE_JSON_SCHEMA');
      const conceptNameLower = conceptName.toLowerCase();

      const rows = await apiGet(
        `/api/neo4j/run-query?cypher=${encodeURIComponent(
          `MATCH (s:JSONSchema)-[:${schemaRel}]->(h:ListHeader {name: '${conceptNameLower}'})
           RETURN h.uuid AS headerUuid, s.uuid AS schemaUuid
           LIMIT 1`
        )}`
      );

      // Parse CSV response from Neo4j API
      const csvText = (rows && rows.cypherResults) || '';
      const csvLines = csvText.trim().split('\n').filter(l => l.trim());

      if (csvLines.length < 2) {
        console.log(`     ⚠️  Concept "${conceptName}" not found in graph — run Pass 1 first`);
        skipped.push(slug);
        continue;
      }

      // Parse header + first data row (CSV with quoted values)
      const dataLine = csvLines[1];
      const values = dataLine.match(/"([^"]*)"/g)?.map(v => v.replace(/"/g, '')) || [];
      const headerUuid = values[0];
      const schemaUuid = values[1];

      if (!headerUuid || !schemaUuid) {
        console.log(`     ⚠️  Could not parse UUIDs for "${conceptName}"`);
        skipped.push(slug);
        continue;
      }

      // Inject coreMemberOf with the real UUID
      if (firmwareSchema.word && firmwareSchema.word.coreMemberOf) {
        for (const ref of firmwareSchema.word.coreMemberOf) {
          if (ref.uuid === '<uuid>') {
            ref.uuid = headerUuid;
          }
        }
      }

      // Call save-schema to overwrite the starter
      // save-schema expects { concept: name, schema: jsonSchema section }
      const saveResult = await apiPost('/api/normalize/save-schema', {
        concept: conceptNameLower,
        schema: firmwareSchema.jsonSchema,
      });

      if (saveResult.success) {
        console.log(`     ✅ Schema enriched (${schemaUuid})`);
        updated.push(slug);
      } else {
        console.log(`     ⚠️  ${saveResult.error}`);
        errors.push({ slug, error: saveResult.error });
      }
    } catch (err) {
      console.log(`     ❌ ${err.message}`);
      errors.push({ slug, error: err.message });
    }
  }

  console.log(`\n  Pass 2 complete: ${updated.length} enriched, ${skipped.length} skipped, ${errors.length} errors\n`);
  return { updated, skipped, errors };
}

// ── Full install ─────────────────────────────────────────────

async function install(opts = {}) {
  const { pass1 = true, pass2 = true, dryRun = false } = opts;

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              TAPESTRY FIRMWARE INSTALL                  ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const manifest = firmware.getManifest();
  console.log(`  Version:  ${manifest.version}`);
  console.log(`  Date:     ${manifest.date}`);
  console.log(`  Concepts: ${manifest.concepts.length}`);
  console.log(`  Rel types: ${manifest.relationshipTypes.length}`);
  console.log(`  Pass 1:   ${pass1 ? 'yes' : 'skip'}`);
  console.log(`  Pass 2:   ${pass2 ? 'yes' : 'skip'}`);
  console.log(`  Dry run:  ${dryRun}`);

  let p1Result = null;
  let p2Result = null;

  if (pass1) {
    p1Result = await pass1_bootstrap({ dryRun });
  }

  if (pass2) {
    p2Result = await pass2_enrich({ dryRun });
  }

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║              FIRMWARE INSTALL COMPLETE ✨               ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  if (p1Result) {
    console.log(`  Pass 1: ${Object.keys(p1Result.results).length} concepts, ${p1Result.errors.length} errors`);
  }
  if (p2Result) {
    console.log(`  Pass 2: ${p2Result.updated.length} enriched, ${p2Result.skipped.length} skipped, ${p2Result.errors.length} errors`);
  }

  console.log('\n  Next steps:');
  console.log('    1. Run `tapestry normalize check` to verify graph health');
  console.log('    2. Run `tapestry normalize fix-supersets` if needed');
  console.log('');

  return { pass1: p1Result, pass2: p2Result };
}

// ── Express handler ──────────────────────────────────────────

async function handleFirmwareInstall(req, res) {
  try {
    const { pass1 = true, pass2 = true, dryRun = false } = req.body || {};
    const result = await install({ pass1, pass2, dryRun });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[firmware-install]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── CLI entry point ──────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const pass1Only = args.includes('--pass1');
  const pass2Only = args.includes('--pass2');

  const opts = {
    dryRun,
    pass1: pass2Only ? false : true,
    pass2: pass1Only ? false : true,
  };

  install(opts).then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { install, pass1_bootstrap, pass2_enrich, handleFirmwareInstall };
