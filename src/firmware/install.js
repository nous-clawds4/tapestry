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

// ── Internal vs HTTP API ─────────────────────────────────────
// When called from within Express (handleFirmwareInstall), we use direct
// function calls to avoid self-referencing HTTP deadlocks.
// When called from CLI, we use HTTP calls.

const API_BASE = process.env.TAPESTRY_API_BASE || 'http://localhost:80';

let _internalMode = false;
let _internalHandlers = null;

function enableInternalMode(handlers) {
  _internalMode = true;
  _internalHandlers = handlers;
}

async function apiPost(endpoint, body) {
  if (_internalMode && _internalHandlers?.post) {
    return _internalHandlers.post(endpoint, body);
  }
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

async function apiGet(endpoint, params = {}) {
  if (_internalMode && _internalHandlers?.get) {
    return _internalHandlers.get(endpoint, params);
  }
  const qs = new URLSearchParams(params).toString();
  const url = qs ? `${API_BASE}${endpoint}?${qs}` : `${API_BASE}${endpoint}`;
  const resp = await fetch(url);
  return resp.json();
}

/**
 * Run a Cypher query via the POST endpoint (avoids URL length limits).
 * Returns the same shape as the GET run-query endpoint for backward compat.
 */
async function runCypherApi(cypher, params = {}) {
  return apiPost('/api/neo4j/query', { cypher, params });
}

/**
 * Parse CSV-style results from the Neo4j run-query API.
 * First line is headers, subsequent lines are values (quoted strings stripped).
 */
function parseCsvRows(csvText) {
  if (!csvText || !csvText.trim()) return [];
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i]; });
    return row;
  });
}

// ── Pass 1: Bootstrap ────────────────────────────────────────

/**
 * Create all canonical concept skeletons from firmware.
 * Each concept gets: ConceptHeader + Superset + JSON Schema (starter) +
 * Primary Property + Properties set + 3 Graphs + 7 Relationships = 11 events.
 *
 * Returns a map of slug → { headerUuid, supersetUuid, schemaUuid, ... }
 */
/**
 * Convert a manifest category key (plural) to a firmware concept slug (singular).
 * Handles irregular plurals like "properties" → "property".
 */
function categoryToSlug(category) {
  // Exact overrides for irregular plurals
  const overrides = {
    'properties': 'property',
    'sets': 'set',
  };
  if (overrides[category]) return overrides[category];
  // Default: strip trailing 's'
  return category.replace(/s$/, '');
}

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
  //
  // Each category in manifest.elements has two arrays:
  //   new-nodes:      Create a new element node from a JSON file
  //   existing-nodes: Wire an existing core node as an element (by concept + core-node-type)
  //
  // Legacy format (flat array) is also supported for backward compat.

  if (manifest.elements) {
    console.log('\n── Creating elements ──\n');

    // Map category to concept name for the create-element API
    const categoryToConceptName = {
      'json-data-types': 'json data type',
      'node-types': 'node type',
      'graph-types': 'graph type',
      'validation-tool-types': 'validation tool type',
    };

    // Map core-node-type to the Neo4j relationship used to find it from the ConceptHeader
    const coreNodeTypeToRel = {
      'concept-header': null,  // the header itself — no relationship needed
      'superset': 'IS_THE_CONCEPT_FOR',
      'json-schema': 'IS_THE_JSON_SCHEMA_FOR',
      'primary-property': 'IS_THE_PRIMARY_PROPERTY_FOR',
      'properties-set': 'IS_THE_PROPERTIES_SET_FOR',
      'property-tree-graph': 'IS_THE_PROPERTY_TREE_GRAPH_FOR',
      'core-nodes-graph': 'IS_THE_CORE_GRAPH_FOR',
      'concept-graph': 'IS_THE_CONCEPT_GRAPH_FOR',
    };

    for (const [category, categoryData] of Object.entries(manifest.elements)) {
      const conceptName = categoryToConceptName[category];
      if (!conceptName) {
        console.log(`  ⚠️  Unknown category "${category}", skipping`);
        continue;
      }

      console.log(`  Category: ${category} → concept "${conceptName}"`);

      // Determine structure: new format (object with existing-nodes/new-nodes) or legacy (flat array)
      const newNodes = Array.isArray(categoryData)
        ? categoryData                       // legacy: flat array = all new-nodes
        : (categoryData['new-nodes'] || []);
      const existingNodes = Array.isArray(categoryData)
        ? []
        : (categoryData['existing-nodes'] || []);

      // ── new-nodes: create new element nodes ──
      for (const entry of newNodes) {
        const filePath = path.join(firmware.firmwareDir(), entry.file);
        if (!fs.existsSync(filePath)) {
          console.log(`    ❌ ${entry.slug}: file not found`);
          errors.push({ slug: entry.slug, error: 'element file not found' });
          continue;
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const sectionKeys = Object.keys(data).filter(k => k !== 'word');
        const conceptKey = sectionKeys[0];
        const elementName = data.word.name.includes(':')
          ? data.word.name.split(':').pop().trim()
          : data[conceptKey]?.name || data.word.slug;

        console.log(`    📝 new-node: ${entry.slug} → "${conceptName}"`);

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

      // ── existing-nodes: wire existing core nodes as elements ──
      for (const entry of existingNodes) {
        const targetConcept = entry.concept;         // firmware concept slug
        const coreNodeType = entry['core-node-type']; // e.g., "concept-header", "superset"

        console.log(`    🔗 existing-node: ${targetConcept} (${coreNodeType}) → "${conceptName}"`);

        if (dryRun) continue;

        try {
          // Find the target concept's header UUID
          const taPubkey = firmware.getTAPubkey();
          const targetHeaderUuid = `39998:${taPubkey}:${targetConcept}`;

          // Find the target node UUID based on core-node-type
          let targetNodeUuid;
          const rel = coreNodeTypeToRel[coreNodeType];

          if (rel === null) {
            // concept-header: the header IS the target node
            targetNodeUuid = targetHeaderUuid;
          } else if (rel) {
            // Find core node via relationship
            // Direction: most core nodes point TO the header (in), superset is OUT from header
            let cypher;
            if (coreNodeType === 'superset') {
              cypher = `MATCH (h:NostrEvent {uuid: $headerUuid})-[:${rel}]->(n) RETURN n.uuid AS uuid LIMIT 1`;
            } else {
              cypher = `MATCH (n)-[:${rel}]->(h:NostrEvent {uuid: $headerUuid}) RETURN n.uuid AS uuid LIMIT 1`;
            }
            const rows = await runCypherApi(cypher, { headerUuid: targetHeaderUuid });
            const dataRows = rows.data || [];
            if (dataRows.length === 0) {
              console.log(`       ⚠️  Core node "${coreNodeType}" not found for concept "${targetConcept}"`);
              continue;
            }
            targetNodeUuid = dataRows[0].uuid;
          } else {
            console.log(`       ⚠️  Unknown core-node-type: "${coreNodeType}"`);
            continue;
          }

          // Find the parent concept's header UUID (the concept that gains the element)
          // Category "json-data-types" → concept slug "json-data-type", etc.
          const parentConceptSlug = categoryToSlug(category);
          const parentHeaderUuid = `39998:${taPubkey}:${parentConceptSlug}`;

          // Use the add-node-as-element API
          const result = await apiPost('/api/normalize/add-node-as-element', {
            conceptUuid: parentHeaderUuid,
            nodeUuid: targetNodeUuid,
          });

          if (result.success) {
            console.log(`       ✅ Wired as element`);
          } else {
            console.log(`       ⚠️  ${result.error}`);
          }
        } catch (err) {
          console.log(`       ❌ ${err.message}`);
          errors.push({ slug: `${targetConcept}:${coreNodeType}`, error: err.message });
        }
      }
    }
  }

  // ── 1c. Create relationship types as elements ─────────

  if (manifest.relationshipTypes && manifest.relationshipTypes.length > 0) {
    console.log('\n── Creating relationship type elements ──\n');

    for (const entry of manifest.relationshipTypes) {
      const filePath = path.join(firmware.firmwareDir(), entry.file);
      if (!fs.existsSync(filePath)) {
        console.log(`    ❌ ${entry.slug}: file not found`);
        errors.push({ slug: entry.slug, error: 'relationship type file not found' });
        continue;
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const elementName = data.relationshipType?.name || data.word?.name || entry.slug;

      console.log(`    📝 ${entry.slug} → "relationship type"`);

      if (dryRun) continue;

      try {
        const result = await apiPost('/api/normalize/create-element', {
          concept: 'relationship type',
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

  // ── 1c½. Create sets ──────────────────────────────────────
  //
  // Each category in manifest.sets has:
  //   new-sets:      Create a new Set from a JSON file, attach to parent concept's Superset
  //   existing-sets: Wire an existing node as a Set (not yet implemented)

  if (manifest.sets) {
    console.log('\n── Creating sets ──\n');

    for (const [category, categoryData] of Object.entries(manifest.sets)) {
      // Category "relationship-types" → concept slug "relationship-type"
      const conceptSlug = categoryToSlug(category);
      const taPubkey = firmware.getTAPubkey();
      const conceptHeaderUuid = `39998:${taPubkey}:${conceptSlug}`;

      console.log(`  Category: ${category} → concept "${conceptSlug}"`);

      const newSets = categoryData['new-sets'] || [];
      const existingSets = categoryData['existing-sets'] || [];

      // ── new-sets: create new Set nodes ──
      for (const entry of newSets) {
        const filePath = path.join(firmware.firmwareDir(), entry.file);
        if (!fs.existsSync(filePath)) {
          console.log(`    ❌ ${entry.slug}: file not found`);
          errors.push({ slug: entry.slug, error: 'set file not found' });
          continue;
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const setName = data.set?.name || data.word?.name || entry.slug;
        const setDescription = data.set?.description || '';
        const dTag = data.word?.slug || entry.slug;

        console.log(`    📝 new-set: ${entry.slug} (d-tag: ${dTag}) → "${conceptSlug}"`);

        if (dryRun) continue;

        try {
          // Find the concept's Superset UUID to use as parent
          const supersetRows = await runCypherApi(
            `MATCH (h:NostrEvent {uuid: $headerUuid})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
             RETURN sup.uuid AS uuid LIMIT 1`,
            { headerUuid: conceptHeaderUuid }
          );
          const supersetData = supersetRows.data || [];
          if (supersetData.length === 0) {
            console.log(`       ⚠️  Superset not found for concept "${conceptSlug}"`);
            continue;
          }
          const parentSupersetUuid = supersetData[0].uuid;

          const result = await apiPost('/api/normalize/create-set', {
            name: setName,
            description: setDescription || undefined,
            parentUuid: parentSupersetUuid,
            dTag: dTag,
          });

          if (result.success) {
            if (result.set?.alreadyExisted) {
              console.log(`       ✅ Already exists`);
            } else {
              console.log(`       ✅ Created`);
            }
          } else {
            console.log(`       ⚠️  ${result.error}`);
          }
        } catch (err) {
          console.log(`       ❌ ${err.message}`);
          errors.push({ slug: entry.slug, error: err.message });
        }
      }

      // ── existing-sets: wire existing concept Supersets as subsets ──
      for (const entry of existingSets) {
        const childConceptSlug = entry.concept;

        console.log(`    🔗 existing-set: ${childConceptSlug} superset → under "${conceptSlug}"`);

        if (dryRun) continue;

        try {
          const taPk = firmware.getTAPubkey();

          // Find the parent concept's Superset
          const parentHeaderUuid = `39998:${taPk}:${conceptSlug}`;
          const parentRows = await runCypherApi(
            `MATCH (h:NostrEvent {uuid: $headerUuid})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
             RETURN sup.uuid AS uuid LIMIT 1`,
            { headerUuid: parentHeaderUuid }
          );
          const parentData = parentRows.data || [];
          if (parentData.length === 0) {
            console.log(`       ⚠️  Parent superset not found for concept "${conceptSlug}"`);
            continue;
          }
          const parentSupersetUuid = parentData[0].uuid;

          // Find the child concept's Superset
          const childHeaderUuid = `39998:${taPk}:${childConceptSlug}`;
          const childRows = await runCypherApi(
            `MATCH (h:NostrEvent {uuid: $headerUuid})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
             RETURN sup.uuid AS uuid LIMIT 1`,
            { headerUuid: childHeaderUuid }
          );
          const childData = childRows.data || [];
          if (childData.length === 0) {
            console.log(`       ⚠️  Child superset not found for concept "${childConceptSlug}"`);
            continue;
          }
          const childSupersetUuid = childData[0].uuid;

          // Create IS_A_SUPERSET_OF: parent superset → child superset
          await runCypherApi(
            `MATCH (a:NostrEvent {uuid: $from}), (b:NostrEvent {uuid: $to})
             MERGE (a)-[:IS_A_SUPERSET_OF]->(b)`,
            { from: parentSupersetUuid, to: childSupersetUuid }
          );

          console.log(`       ✅ Wired IS_A_SUPERSET_OF`);
        } catch (err) {
          console.log(`       ❌ ${err.message}`);
          errors.push({ slug: `existing-set:${childConceptSlug}`, error: err.message });
        }
      }
    }
  }

  // ── 1d. Wire HAS_ELEMENT for core nodes via z-tag matching ─────────
  // Each core node has z-tags for its type hierarchy (e.g., superset → superset, set, word).
  // We add HAS_ELEMENT edges from each concept's superset to all nodes with matching z-tags.
  // Exception: skip "word" — would add 168+ edges with minimal benefit.

  console.log('\n── Wiring HAS_ELEMENT for core node elements ──\n');

  const SKIP_CONCEPTS = ['word'];

  const conceptsRes = await runCypherApi(
    `MATCH (h:ListHeader:ConceptHeader)-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
     RETURN h.name AS name, h.uuid AS headerUuid, sup.uuid AS supersetUuid`
  );

  const conceptRows = conceptsRes.data || parseCsvRows(conceptsRes.cypherResults || '');

  let hasElementCount = 0;

  for (const row of conceptRows) {
    const name = row.name;
    const headerUuid = row.headerUuid;
    const supersetUuid = row.supersetUuid;

    if (SKIP_CONCEPTS.includes(name)) {
      console.log(`    ⏭️  ${name} (skipped — too many elements)`);
      continue;
    }

    // Find all nodes with a z-tag pointing to this concept (excluding the concept's own superset)
    const elemRes = await runCypherApi(
      `MATCH (n:NostrEvent)-[:HAS_TAG]->(z:NostrEventTag {type: 'z'})
       WHERE z.value = $headerUuid
         AND n.uuid <> $supersetUuid
       RETURN n.uuid AS uuid`,
      { headerUuid, supersetUuid }
    );

    const elemRows = elemRes.data || parseCsvRows(elemRes.cypherResults || '');

    if (elemRows.length === 0) continue;

    // Add HAS_ELEMENT edges (unwrapped — Neo4j only, no nostr events)
    for (const elem of elemRows) {
      await runCypherApi(
        `MATCH (sup:NostrEvent {uuid: $supersetUuid}), (elem:NostrEvent {uuid: $elemUuid})
         MERGE (sup)-[:HAS_ELEMENT]->(elem)`,
        { supersetUuid, elemUuid: elem.uuid }
      );
      hasElementCount++;
    }

    console.log(`    📎 ${name}: ${elemRows.length} elements wired`);
  }

  console.log(`\n  Total HAS_ELEMENT edges added: ${hasElementCount}`);

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

      const queryResult = await runCypherApi(
        `MATCH (s:JSONSchema)-[:${schemaRel}]->(h:ListHeader {name: $name})
         RETURN h.uuid AS headerUuid, s.uuid AS schemaUuid
         LIMIT 1`,
        { name: conceptNameLower }
      );

      // Use data array from POST endpoint, fall back to CSV parsing
      const dataRows = queryResult.data || [];

      if (dataRows.length === 0) {
        // Try CSV fallback
        const csvText = (queryResult.cypherResults) || '';
        const csvLines = csvText.trim().split('\n').filter(l => l.trim());
        if (csvLines.length >= 2) {
          const dataLine = csvLines[1];
          const values = dataLine.match(/"([^"]*)"/g)?.map(v => v.replace(/"/g, '')) || [];
          if (values[0] && values[1]) {
            dataRows.push({ headerUuid: values[0], schemaUuid: values[1] });
          }
        }
      }

      if (dataRows.length === 0) {
        console.log(`     ⚠️  Concept "${conceptName}" not found in graph — run Pass 1 first`);
        skipped.push(slug);
        continue;
      }

      const headerUuid = dataRows[0].headerUuid;
      const schemaUuid = dataRows[0].schemaUuid;

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

/**
 * Create an internal API bridge that calls Express route handlers directly,
 * avoiding self-referencing HTTP calls that deadlock the single-threaded server.
 */
function createInternalBridge(app) {
  function callRoute(method, endpoint, bodyOrParams) {
    return new Promise((resolve, reject) => {
      // Build a minimal mock req/res
      const url = new URL(endpoint, 'http://localhost');
      if (method === 'GET' && bodyOrParams) {
        for (const [k, v] of Object.entries(bodyOrParams)) {
          url.searchParams.set(k, v);
        }
      }

      const req = {
        method: method.toUpperCase(),
        url: url.pathname + url.search,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        params: {},
        body: method === 'POST' ? bodyOrParams : {},
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
        get: (h) => {
          const key = h.toLowerCase();
          if (key === 'content-type') return 'application/json';
          if (key === 'x-forwarded-for') return '127.0.0.1';
          return undefined;
        },
        connection: { remoteAddress: '127.0.0.1' },
        socket: { remoteAddress: '127.0.0.1' },
        ip: '127.0.0.1',
        session: {},
      };

      // Extract route params (e.g., :slug) — simple pattern matching
      const pathParts = url.pathname.split('/');
      req.params = {};

      const res = {
        statusCode: 200,
        _headers: {},
        status(code) { this.statusCode = code; return this; },
        json(data) { resolve(data); },
        setHeader(k, v) { this._headers[k] = v; },
        getHeader(k) { return this._headers[k]; },
      };

      // Use Express's internal routing
      app.handle(req, res, (err) => {
        if (err) reject(err);
        else reject(new Error(`No handler found for ${method} ${endpoint}`));
      });
    });
  }

  return {
    get: (endpoint, params) => callRoute('GET', endpoint, params),
    post: (endpoint, body) => callRoute('POST', endpoint, body),
  };
}

async function handleFirmwareInstall(req, res) {
  try {
    const { pass1 = true, pass2 = true, dryRun = false } = req.body || {};

    // Enable internal mode to bypass HTTP self-calls
    if (req.app) {
      enableInternalMode(createInternalBridge(req.app));
    }

    const result = await install({ pass1, pass2, dryRun });

    // Reset to HTTP mode
    _internalMode = false;
    _internalHandlers = null;

    res.json({ success: true, ...result });
  } catch (err) {
    _internalMode = false;
    _internalHandlers = null;
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
