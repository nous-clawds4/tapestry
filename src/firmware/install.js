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
// Relationship type aliases used by concept manifests
const REL = {
  CLASS_THREAD_INITIATION: firmware.relAlias('CLASS_THREAD_INITIATION') || 'IS_THE_CONCEPT_FOR',
  CLASS_THREAD_TERMINATION: firmware.relAlias('CLASS_THREAD_TERMINATION') || 'HAS_ELEMENT',
  CLASS_THREAD_PROPAGATION: firmware.relAlias('CLASS_THREAD_PROPAGATION') || 'IS_A_SUPERSET_OF',
};

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
        conceptHeaderOverrides: ch,  // pass full firmware conceptHeader for extra fields (e.g., x-tapestry)
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

  // ── 1b. Auto-discover and create elements ─────────────────
  //
  // Scans concepts/<slug>/elements/*.json for each concept in the manifest.
  // Each JSON file is a full word-wrapper element passed to create-element.
  // This replaces both the old manifest.elements new-nodes and the
  // separate relationshipTypes element creation.
  //
  // Collects filename → uuid mapping per concept for manifest wiring later.

  // nodeMap[conceptSlug][filename] = uuid  (for elements and sets)
  const nodeMap = {};

  {
    console.log('\n── Creating elements (auto-discovered) ──\n');

    for (const entry of manifest.concepts) {
      const slug = entry.slug;
      const conceptDir = path.join(firmware.firmwareDir(), entry.dir);
      const elemDir = path.join(conceptDir, 'elements');

      if (!fs.existsSync(elemDir)) continue;

      const files = fs.readdirSync(elemDir).filter(f => f.endsWith('.json')).sort();
      if (files.length === 0) continue;

      if (!nodeMap[slug]) nodeMap[slug] = {};

      // Derive the concept's human name from its concept-header
      // Neo4j stores names lowercase, so we must match that
      const headerPath = path.join(conceptDir, entry.conceptHeader);
      const header = JSON.parse(fs.readFileSync(headerPath, 'utf8'));
      const conceptName = header.conceptHeader.oNames.singular.toLowerCase();

      console.log(`  ${slug}/ (${files.length} elements) → "${conceptName}"`);

      for (const file of files) {
        const filePath = path.join(elemDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // Derive element name from word-wrapper JSON
        const sectionKeys = Object.keys(data).filter(k => k !== 'word');
        const conceptKey = sectionKeys[0];
        const elementName = data.word.name.includes(':')
          ? data.word.name.split(':').pop().trim()
          : data[conceptKey]?.name || data.word.slug;

        const elemSlug = file.replace(/\.json$/, '');
        console.log(`    📝 ${elemSlug} → "${conceptName}"`);

        if (dryRun) continue;

        try {
          const result = await apiPost('/api/normalize/create-element', {
            concept: conceptName,
            name: elementName,
            json: data,
          });
          if (result.success) {
            console.log(`       ✅ Created`);
            if (result.element?.uuid) {
              nodeMap[slug][elemSlug] = result.element.uuid;
            }
          } else {
            console.log(`       ⚠️  ${result.error}`);
          }
        } catch (err) {
          console.log(`       ❌ ${err.message}`);
          errors.push({ slug: elemSlug, error: err.message });
        }
      }
    }
  }

  // ── 1c. Wire existing nodes as elements ───────────────────
  //
  // manifest.elements existing-nodes: wire a concept's core node as an
  // element of another concept (e.g., word's concept-header as a node-type).

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

  if (manifest.elements) {
    console.log('\n── Wiring existing nodes as elements ──\n');

    for (const [category, categoryData] of Object.entries(manifest.elements)) {
      if (Array.isArray(categoryData)) continue; // legacy flat array — skip
      const existingNodes = categoryData['existing-nodes'] || [];
      if (existingNodes.length === 0) continue;

      const parentConceptSlug = categoryToSlug(category);
      console.log(`  Category: ${category} → concept "${parentConceptSlug}"`);

      for (const entry of existingNodes) {
        const targetConcept = entry.concept;
        const coreNodeType = entry['core-node-type'];

        console.log(`    🔗 existing-node: ${targetConcept} (${coreNodeType})`);

        if (dryRun) continue;

        try {
          const taPubkey = firmware.getTAPubkey();
          const targetHeaderUuid = `39998:${taPubkey}:${targetConcept}`;

          let targetNodeUuid;
          const rel = coreNodeTypeToRel[coreNodeType];

          if (rel === null) {
            targetNodeUuid = targetHeaderUuid;
          } else if (rel) {
            let cypher;
            if (coreNodeType === 'superset') {
              cypher = `MATCH (h:NostrEvent {uuid: $headerUuid})-[:${rel}]->(n) RETURN n.uuid AS uuid LIMIT 1`;
            } else {
              cypher = `MATCH (n)-[:${rel}]->(h:NostrEvent {uuid: $headerUuid}) RETURN n.uuid AS uuid LIMIT 1`;
            }
            const rows = await runCypherApi(cypher, { headerUuid: targetHeaderUuid });
            const dataRows = rows.data || [];
            if (dataRows.length === 0) {
              console.log(`       ⚠️  Core node "${coreNodeType}" not found for "${targetConcept}"`);
              continue;
            }
            targetNodeUuid = dataRows[0].uuid;
          } else {
            console.log(`       ⚠️  Unknown core-node-type: "${coreNodeType}"`);
            continue;
          }

          const parentHeaderUuid = `39998:${taPubkey}:${parentConceptSlug}`;
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

  // ── 1c½. Create sets ──────────────────────────────────────
  //
  // Auto-discovers concepts/<slug>/sets/*.json for new sets.
  // manifest.sets existing-sets still wire existing Supersets as subsets.

  {
    console.log('\n── Creating sets (auto-discovered) ──\n');

    for (const conceptEntry of manifest.concepts) {
      const slug = conceptEntry.slug;
      const conceptDir = path.join(firmware.firmwareDir(), conceptEntry.dir);
      const setsDir = path.join(conceptDir, 'sets');

      if (!fs.existsSync(setsDir)) continue;

      const files = fs.readdirSync(setsDir).filter(f => f.endsWith('.json')).sort();
      if (files.length === 0) continue;

      const taPubkey = firmware.getTAPubkey();
      const conceptHeaderUuid = `39998:${taPubkey}:${slug}`;

      if (!nodeMap[slug]) nodeMap[slug] = {};

      console.log(`  ${slug}/ (${files.length} sets)`);

      for (const file of files) {
        const filePath = path.join(setsDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const setName = data.set?.name || data.word?.name || file.replace(/\.json$/, '');
        const setDescription = data.set?.description || '';
        const dTag = data.word?.slug || file.replace(/\.json$/, '');
        const fileSlug = file.replace(/\.json$/, '');

        console.log(`    📝 ${fileSlug} (d-tag: ${dTag}) → "${slug}"`);

        if (dryRun) continue;

        try {
          const supersetRows = await runCypherApi(
            `MATCH (h:NostrEvent {uuid: $headerUuid})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
             RETURN sup.uuid AS uuid LIMIT 1`,
            { headerUuid: conceptHeaderUuid }
          );
          const supersetData = supersetRows.data || [];
          if (supersetData.length === 0) {
            console.log(`       ⚠️  Superset not found for concept "${slug}"`);
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
            if (result.set?.uuid) {
              nodeMap[slug][fileSlug] = result.set.uuid;
            }
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
          errors.push({ slug: dTag, error: err.message });
        }
      }
    }
  }

  // ── Wire existing-sets from manifest ──────────────────────

  if (manifest.sets) {
    console.log('\n── Wiring existing sets ──\n');

    for (const [category, categoryData] of Object.entries(manifest.sets)) {
      const conceptSlug = categoryToSlug(category);
      const existingSets = categoryData['existing-sets'] || [];
      if (existingSets.length === 0) continue;

      console.log(`  Category: ${category} → concept "${conceptSlug}"`);

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

  // ── 1c¾. Wire relationships from concept manifests ─────────────
  //
  // Each concept dir may have a manifest.json defining internal graph structure:
  //   HAS_ELEMENT:       [ { nodeFrom: "<filename>", nodeTo: "<filename>" }, ... ]
  //   IS_A_SUPERSET_OF:  [ { nodeFrom: "<filename>", nodeTo: "<filename>" }, ... ]
  //
  // Filenames reference elements/ or sets/ files (without .json).
  // Resolution: filename → word.slug from the file → uuid from nodeMap.

  {
    console.log('\n── Wiring concept manifest relationships ──\n');

    for (const entry of manifest.concepts) {
      const slug = entry.slug;
      const conceptDir = path.join(firmware.firmwareDir(), entry.dir);
      const manifestPath = path.join(conceptDir, 'manifest.json');

      if (!fs.existsSync(manifestPath)) {
        continue;
      }

      console.log(`  Found concept manifest for ${slug}`);
      const conceptManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const map = nodeMap[slug] || {};
      console.log(`    map keys: [${Object.keys(map).join(', ')}]`);

      const relTypes = {
        'HAS_ELEMENT': REL.CLASS_THREAD_TERMINATION,
        'IS_A_SUPERSET_OF': REL.CLASS_THREAD_PROPAGATION,
      };

      for (const [relName, edges] of Object.entries(conceptManifest)) {
        const neoRel = relTypes[relName];
        if (!neoRel) {
          console.log(`  ⚠️  ${slug}: unknown relationship type "${relName}", skipping`);
          continue;
        }
        if (!Array.isArray(edges) || edges.length === 0) continue;

        console.log(`  ${slug}: ${relName} (${edges.length} edges)`);

        for (const edge of edges) {
          let fromUuid = map[edge.nodeFrom];
          let toUuid = map[edge.nodeTo];

          // Fall back to Neo4j lookup for cross-concept references.
          // Try slug first, then derive a name from the slug (kebab-case → spaces).
          if (!fromUuid) {
            const result = await runCypherApi(
              `MATCH (n:NostrEvent) WHERE n.slug = $slug OR n.name = $name RETURN n.uuid AS uuid LIMIT 1`,
              { slug: edge.nodeFrom, name: edge.nodeFrom.replace(/-/g, ' ') }
            );
            fromUuid = result?.data?.[0]?.uuid;
            if (fromUuid) console.log(`    📎 Resolved "${edge.nodeFrom}" via Neo4j lookup`);
          }
          if (!toUuid) {
            const result = await runCypherApi(
              `MATCH (n:NostrEvent) WHERE n.slug = $slug OR n.name = $name RETURN n.uuid AS uuid LIMIT 1`,
              { slug: edge.nodeTo, name: edge.nodeTo.replace(/-/g, ' ') }
            );
            toUuid = result?.data?.[0]?.uuid;
            if (toUuid) console.log(`    📎 Resolved "${edge.nodeTo}" via Neo4j lookup`);
          }

          if (!fromUuid) {
            console.log(`    ⚠️  nodeFrom "${edge.nodeFrom}" not found in nodeMap or Neo4j for ${slug}`);
            continue;
          }
          if (!toUuid) {
            console.log(`    ⚠️  nodeTo "${edge.nodeTo}" not found in nodeMap or Neo4j for ${slug}`);
            continue;
          }

          console.log(`    🔗 ${edge.nodeFrom} → ${edge.nodeTo} (${relName})`);

          if (dryRun) continue;

          try {
            await runCypherApi(
              `MATCH (a:NostrEvent {uuid: $from}), (b:NostrEvent {uuid: $to})
               MERGE (a)-[:${neoRel}]->(b)`,
              { from: fromUuid, to: toUuid }
            );
            console.log(`       ✅ Wired`);
          } catch (err) {
            console.log(`       ❌ ${err.message}`);
            errors.push({ slug: `${slug}:${relName}:${edge.nodeFrom}->${edge.nodeTo}`, error: err.message });
          }
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

  // ── 1d½. Wire ConceptHeaders as elements of the "concept-header" concept ──
  // ConceptHeaders are ListHeaders (kind 39998) and don't carry z-tags,
  // so the z-tag wiring in step 1d doesn't pick them up. We wire them
  // explicitly as elements of the "concept-header" concept.
  {
    console.log('\n── Wiring ConceptHeaders as elements ──\n');

    const chSupRes = await runCypherApi(
      `MATCH (h:ConceptHeader {name: 'concept header'})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
       RETURN sup.uuid AS supersetUuid`,
    );
    const chSupersetUuid = (chSupRes.data || [])[0]?.supersetUuid;

    if (chSupersetUuid) {
      const allHeaders = await runCypherApi(
        `MATCH (ch:ConceptHeader)
         WHERE ch.uuid <> $supersetUuid
         RETURN ch.uuid AS uuid, ch.name AS name`,
        { supersetUuid: chSupersetUuid }
      );
      const headers = allHeaders.data || [];
      for (const h of headers) {
        await runCypherApi(
          `MATCH (sup:NostrEvent {uuid: $supersetUuid}), (ch:NostrEvent {uuid: $chUuid})
           MERGE (sup)-[:HAS_ELEMENT]->(ch)`,
          { supersetUuid: chSupersetUuid, chUuid: h.uuid }
        );
      }
      console.log(`    📎 concept header: ${headers.length} elements wired`);
    } else {
      console.log(`    ⚠️  "concept header" concept not found or has no Superset`);
    }
  }

  // ── 1d¾. Wire ENUMERATES relationships from manifest ──────────
  // Each entry in manifest.enumerations declares that the elements of one concept
  // enumerate the allowed values at a given path in another concept's JSON Schema.
  // Creates: (enumerating concept's Superset)-[:ENUMERATES {path}]->(target concept's JSONSchema)

  if (manifest.enumerations) {
    console.log('\n── Wiring ENUMERATES relationships ──\n');

    let enumCount = 0;

    for (const [enumeratingPlural, data] of Object.entries(manifest.enumerations)) {
      const entries = data['existing-nodes'] || [];
      if (entries.length === 0) continue;

      // Find the enumerating concept's superset (key is plural, derive singular)
      const enumeratingSlug = categoryToSlug(enumeratingPlural);
      const enumeratingName = enumeratingSlug.replace(/-/g, ' ');
      const enumeratingRes = await runCypherApi(
        `MATCH (h:ConceptHeader)-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
         WHERE h.name = $name
         RETURN sup.uuid AS supersetUuid, h.name AS conceptName`,
        { name: enumeratingName }
      );
      const enumeratingRow = (enumeratingRes.data || [])[0];
      if (!enumeratingRow) {
        console.log(`    ⚠️  Enumerating concept "${enumeratingName}" (from "${enumeratingPlural}") not found — skipping`);
        continue;
      }

      for (const entry of entries) {
        const targetConceptName = entry.concept;
        // Support both old format (path) and new format (source-path + destination-path)
        const sourcePath = entry['source-path'] || null;
        const destinationPath = entry['destination-path'] || entry.path;

        // Find the target concept's JSON Schema
        const targetRes = await runCypherApi(
          `MATCH (h:ConceptHeader {name: $name})
           OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
           RETURN js.uuid AS schemaUuid, h.name AS conceptName`,
          { name: targetConceptName }
        );
        const targetRow = (targetRes.data || [])[0];
        if (!targetRow?.schemaUuid) {
          console.log(`    ⚠️  Target concept "${targetConceptName}" or its JSON Schema not found — skipping`);
          continue;
        }

        if (dryRun) {
          console.log(`    🔗 ${enumeratingRow.conceptName} superset → ENUMERATES → ${targetConceptName} schema`);
          console.log(`        source: ${sourcePath || '(slug fallback)'}, dest: ${destinationPath}`);
          continue;
        }

        // Create the ENUMERATES relationship with sourcePath and destinationPath
        await runCypherApi(
          `MATCH (sup:NostrEvent {uuid: $fromUuid}), (js:NostrEvent {uuid: $toUuid})
           MERGE (sup)-[r:ENUMERATES]->(js)
           SET r.sourcePath = $sourcePath, r.destinationPath = $destinationPath`,
          { fromUuid: enumeratingRow.supersetUuid, toUuid: targetRow.schemaUuid, sourcePath, destinationPath }
        );
        console.log(`    🔗 ${enumeratingRow.conceptName} → ENUMERATES → ${targetConceptName} schema`);
        console.log(`        source: ${sourcePath || '(slug fallback)'}, dest: ${destinationPath}`);
        enumCount++;
      }
    }

    console.log(`\n  Total ENUMERATES edges added: ${enumCount}`);
  }

  // ── 1e. Prune redundant Superset edges ─────────────────────
  //
  // Now that ALL edges are created (manifest + z-tag wiring), prune direct
  // edges from each concept's Superset that are redundant — i.e., the target
  // node is reachable via a longer class-thread path.
  //
  // Two passes per concept:
  //   1. Prune HAS_ELEMENT: remove Superset→element if reachable via sets
  //   2. Prune IS_A_SUPERSET_OF: remove Superset→set if reachable via other sets

  {
    console.log('\n── Pruning redundant Superset edges ──\n');

    for (const entry of manifest.concepts) {
      const slug = entry.slug;
      const conceptDir = path.join(firmware.firmwareDir(), entry.dir);
      const manifestPath = path.join(conceptDir, 'manifest.json');

      // Only prune concepts that have a manifest (explicit graph structure)
      if (!fs.existsSync(manifestPath)) continue;
      if (dryRun) continue;

      const taPubkey = firmware.getTAPubkey();
      const headerUuid = `39998:${taPubkey}:${slug}`;

      // Find the concept's Superset
      const supRows = await runCypherApi(
        `MATCH (h:NostrEvent {uuid: $headerUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
         RETURN sup.uuid AS uuid LIMIT 1`,
        { headerUuid }
      );
      const supData = supRows.data || [];
      if (supData.length === 0) continue;
      const supersetUuid = supData[0].uuid;

      // ── Pass 1: Prune HAS_ELEMENT from Superset ──
      const directElements = await runCypherApi(
        `MATCH (sup:NostrEvent {uuid: $supersetUuid})-[:${REL.CLASS_THREAD_TERMINATION}]->(elem)
         RETURN elem.uuid AS uuid, elem.name AS name`,
        { supersetUuid }
      );
      const elemRows = directElements.data || [];

      let prunedHE = 0;
      for (const elem of elemRows) {
        const altPath = await runCypherApi(
          `MATCH p = (sup:NostrEvent {uuid: $supersetUuid})-[:${REL.CLASS_THREAD_PROPAGATION}|${REL.CLASS_THREAD_TERMINATION}*2..12]->(elem:NostrEvent {uuid: $elemUuid})
           RETURN count(p) AS cnt`,
          { supersetUuid, elemUuid: elem.uuid }
        );
        const cnt = (altPath.data || [])[0]?.cnt || 0;
        if (cnt > 0) {
          await runCypherApi(
            `MATCH (sup:NostrEvent {uuid: $supersetUuid})-[r:${REL.CLASS_THREAD_TERMINATION}]->(elem:NostrEvent {uuid: $elemUuid})
             DELETE r`,
            { supersetUuid, elemUuid: elem.uuid }
          );
          prunedHE++;
        }
      }

      // ── Pass 2: Prune IS_A_SUPERSET_OF from Superset ──
      const directSets = await runCypherApi(
        `MATCH (sup:NostrEvent {uuid: $supersetUuid})-[:${REL.CLASS_THREAD_PROPAGATION}]->(s)
         RETURN s.uuid AS uuid, s.name AS name`,
        { supersetUuid }
      );
      const setRows = directSets.data || [];

      let prunedSO = 0;
      for (const set of setRows) {
        const altPath = await runCypherApi(
          `MATCH (sup:NostrEvent {uuid: $supersetUuid})-[:${REL.CLASS_THREAD_PROPAGATION}]->(mid)
                -[:${REL.CLASS_THREAD_PROPAGATION}*1..10]->(s:NostrEvent {uuid: $setUuid})
           WHERE mid.uuid <> $setUuid
           RETURN count(*) AS cnt`,
          { supersetUuid, setUuid: set.uuid }
        );
        const cnt = (altPath.data || [])[0]?.cnt || 0;
        if (cnt > 0) {
          await runCypherApi(
            `MATCH (sup:NostrEvent {uuid: $supersetUuid})-[r:${REL.CLASS_THREAD_PROPAGATION}]->(s:NostrEvent {uuid: $setUuid})
             DELETE r`,
            { supersetUuid, setUuid: set.uuid }
          );
          prunedSO++;
        }
      }

      if (prunedHE > 0 || prunedSO > 0) {
        console.log(`  ${slug}: pruned ${prunedHE} HAS_ELEMENT + ${prunedSO} IS_A_SUPERSET_OF from Superset`);
      }
    }
  }

  // ── 1f. Assign tapestryKeys to all nodes ─────────────────────
  if (!dryRun) {
    console.log('\n── Assigning tapestryKeys ──\n');
    try {
      const initRes = await apiPost('/api/tapestry-key/initialize', {});
      const count = initRes?.data?.initialized || 0;
      console.log(`  📎 ${count} nodes initialized with tapestryKeys`);
    } catch (err) {
      console.log(`  ⚠️  tapestryKey initialization failed: ${err.message}`);
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

  // ── Pass 3: Derive + Apply Enumerations + Wire Implicit Elements ──
  let p3Result = null;
  if (!dryRun) {
    console.log('\n── Pass 3: Derive, Apply Enumerations, Wire Implicit Elements ──\n');
    p3Result = { derived: 0, enumerationsApplied: 0, implicitWired: 0 };

    // 3a. Derive all — ListItem first so Set/Superset can resolve slugs
    const deriveLabels = ['ListItem', 'ListHeader', 'ConceptHeader', 'JSONSchema', 'Property', 'Set', 'Superset'];
    for (const label of deriveLabels) {
      try {
        const res = await apiPost(`/api/tapestry-key/derive-all/${label}`, {});
        console.log(`  🔄 Derived ${label}: ${res.success ? 'OK' : res.error}`);
      } catch (err) {
        console.log(`  ⚠️  Derive ${label} failed: ${err.message}`);
      }
    }
    // Get total derived count
    try {
      const statusRes = await apiGet('/api/tapestry-key/derive-status');
      if (statusRes.success) {
        p3Result.derived = statusRes.data.reduce((sum, l) => sum + l.derived, 0);
      }
    } catch {}
    console.log(`  📊 Total derived: ${p3Result.derived}`);

    // 3b. Apply enumerations (needs derived Superset data in LMDB for slug resolution)
    try {
      const enumRes = await apiPost('/api/normalize/apply-enumerations', {});
      p3Result.enumerationsApplied = enumRes.updated || 0;
      console.log(`  🔗 Enumerations applied: ${p3Result.enumerationsApplied}`);
    } catch (err) {
      console.log(`  ⚠️  Apply enumerations failed: ${err.message}`);
    }

    // 3c. Wire implicit elements (so schema lookups via HAS_ELEMENT work)
    try {
      const wireRes = await apiPost('/api/normalize/wire-implicit-elements', {});
      p3Result.implicitWired = wireRes.wired || 0;
      console.log(`  📎 Implicit elements wired: ${p3Result.implicitWired}`);
    } catch (err) {
      console.log(`  ⚠️  Wire implicit elements failed: ${err.message}`);
    }

    console.log('');
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
  if (p3Result) {
    console.log(`  Pass 3: ${p3Result.derived} derived, ${p3Result.enumerationsApplied} enumerations, ${p3Result.implicitWired} implicit elements`);
  }

  console.log('');

  return { pass1: p1Result, pass2: p2Result, pass3: p3Result };
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
