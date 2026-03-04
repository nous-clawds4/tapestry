/**
 * Normalize API — mutation endpoints for fixing concept graph issues.
 *
 * POST /api/normalize/skeleton
 *   Body: { concept: "<name>", node?: "superset"|"schema"|"core-graph"|"class-graph"|"property-graph" }
 *   If node is omitted, creates all missing skeleton nodes.
 *   Returns list of created events.
 */
const { runCypher, writeCypher } = require('../../lib/neo4j-driver');
const { getConfigFromFile } = require('../../utils/config');
const { exec } = require('child_process');
const crypto = require('crypto');

// ── Lazy-load nostr-tools ─────────────────────────────────────
let _nt = null;
function nt() {
  if (!_nt) _nt = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools');
  return _nt;
}

// ── Helpers ───────────────────────────────────────────────────
function randomDTag() {
  return crypto.randomBytes(4).toString('hex');
}

function deriveSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Shared: regenerate JSON tag on an event and re-publish ────
async function regenerateJson(uuid, jsonValue) {
  const tagRows = await runCypher(`
    MATCH (e:NostrEvent {uuid: $uuid})-[:HAS_TAG]->(t:NostrEventTag)
    RETURN t.type AS type, t.value AS value, t.value1 AS value1, t.value2 AS value2
    ORDER BY t.uuid
  `, { uuid });

  const tags = [];
  let hasJson = false;
  for (const t of tagRows) {
    const tag = [t.type, t.value];
    if (t.value1) tag.push(t.value1);
    if (t.value2) tag.push(t.value2);
    if (t.type === 'json') {
      tags.push(['json', JSON.stringify(jsonValue)]);
      hasJson = true;
    } else {
      tags.push(tag);
    }
  }
  if (!hasJson) {
    tags.push(['json', JSON.stringify(jsonValue)]);
  }

  const kind = uuid.startsWith('39998:') ? 39998 : 39999;
  const evt = signAndFinalize({ kind, tags, content: '' });
  await publishToStrfry(evt);
  await importEventDirect(evt, uuid);
  return evt;
}

function getPrivkey() {
  const hex = getConfigFromFile('BRAINSTORM_RELAY_PRIVKEY');
  if (!hex) throw new Error('Tapestry Assistant key not configured (BRAINSTORM_RELAY_PRIVKEY)');
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

function signAndFinalize(template) {
  const privBytes = getPrivkey();
  return nt().finalizeEvent({
    kind: template.kind,
    created_at: template.created_at || Math.floor(Date.now() / 1000),
    tags: template.tags || [],
    content: template.content || '',
  }, privBytes);
}

function publishToStrfry(event) {
  return new Promise((resolve, reject) => {
    const child = exec('strfry import', { timeout: 10000 }, (err) => {
      if (err) reject(new Error(`strfry import failed: ${err.message}`));
      else resolve();
    });
    child.stdin.write(JSON.stringify(event) + '\n');
    child.stdin.end();
  });
}

async function importEventToNeo4j(event, apiBase = '') {
  // Use the event-update endpoint internally
  const uuid = event.kind >= 30000
    ? `${event.kind}:${event.pubkey}:${(event.tags.find(t => t[0] === 'd') || [])[1] || ''}`
    : event.id;
  // Direct Bolt import — create the node + tags
  await importEventDirect(event, uuid);
}

async function importEventDirect(event, uuid) {
  const dTag = (event.tags.find(t => t[0] === 'd') || [])[1] || '';
  const nameTag = event.tags.find(t => t[0] === 'name');
  const namesTag = event.tags.find(t => t[0] === 'names');
  const name = nameTag?.[1] || namesTag?.[1] || '';

  // MERGE the event node
  await writeCypher(`
    MERGE (e:NostrEvent {uuid: $uuid})
    SET e.id = $id, e.kind = $kind, e.pubkey = $pubkey, e.name = $name,
        e.created_at = $created_at
    WITH e
    // Set labels based on kind
    FOREACH (_ IN CASE WHEN $kind = 39998 THEN [1] ELSE [] END |
      SET e:ListHeader
    )
    FOREACH (_ IN CASE WHEN $kind = 39999 THEN [1] ELSE [] END |
      SET e:ListItem
    )
  `, { uuid, id: event.id, kind: event.kind, pubkey: event.pubkey, name, created_at: event.created_at });

  // Delete old tags for this event, then re-create
  await writeCypher(`
    MATCH (e:NostrEvent {uuid: $uuid})-[r:HAS_TAG]->(t:NostrEventTag)
    DELETE r, t
  `, { uuid });

  // Create tags
  for (let i = 0; i < event.tags.length; i++) {
    const tag = event.tags[i];
    const tagUuid = crypto.createHash('sha256').update(`${uuid}:${tag.join(',')}:${i}`).digest('hex');
    const props = { tagUuid, eventUuid: uuid, type: tag[0], value: tag[1] || '' };
    let setClauses = 't.type = $type, t.value = $value';
    if (tag[2]) { props.value1 = tag[2]; setClauses += ', t.value1 = $value1'; }
    if (tag[3]) { props.value2 = tag[3]; setClauses += ', t.value2 = $value2'; }

    await writeCypher(`
      MATCH (e:NostrEvent {uuid: $eventUuid})
      CREATE (e)-[:HAS_TAG]->(t:NostrEventTag {uuid: $tagUuid})
      SET ${setClauses}
    `, props);
  }
}

// ── UUID config lookup (BIOS concept UUIDs) ──────────────────
// These are the canonical z-tag UUIDs for skeleton node types
let _defaults = null;
function getDefaults() {
  if (!_defaults) {
    _defaults = require('../../concept-graph/parameters/defaults.json');
  }
  return _defaults;
}

function configUuid(key) {
  const d = getDefaults();
  const uuids = d.conceptUUIDs || {};
  const map = {
    superset: uuids.superset,
    jsonSchema: uuids.JSONSchema,
    graph: uuids.graph,
    relationship: uuids.relationship,
  };
  return map[key];
}

// Reverse lookup: z-tag UUID → role name
function roleFromZTag(zTagValue) {
  const d = getDefaults();
  const uuids = d.conceptUUIDs || {};
  if (zTagValue === uuids.superset) return 'superset';
  if (zTagValue === uuids.JSONSchema) return 'schema';
  if (zTagValue === uuids.graph) return 'graph';
  if (zTagValue === uuids.relationship) return 'relationship';
  if (zTagValue === uuids.set) return 'set';
  if (zTagValue === uuids.property) return 'property';
  if (zTagValue === uuids.nodeType) return 'nodeType';
  if (zTagValue === uuids.relationshipType) return 'relationshipType';
  if (zTagValue === uuids.list) return 'list';
  if (zTagValue === uuids.jsonDataType) return 'jsonDataType';
  if (zTagValue === uuids.graphType) return 'graphType';
  return null;
}

// ── Node role definitions ────────────────────────────────────
const NODE_ROLES = ['superset', 'schema', 'core-graph', 'class-graph', 'property-graph'];

// ── Main handler ─────────────────────────────────────────────
async function handleNormalizeSkeleton(req, res) {
  try {
    const { concept, node, dryRun } = req.body;
    if (!concept) {
      return res.status(400).json({ success: false, error: 'Missing concept name' });
    }
    if (node && !NODE_ROLES.includes(node)) {
      return res.status(400).json({ success: false, error: `Invalid node role: ${node}. Valid: ${NODE_ROLES.join(', ')}` });
    }

    // 1. Find the ListHeader
    const headers = await runCypher(`
      MATCH (h:NostrEvent)
      WHERE (h:ListHeader OR h:ClassThreadHeader) AND h.kind IN [9998, 39998]
        AND h.name = $name
      OPTIONAL MATCH (h)-[:HAS_TAG]->(nt:NostrEventTag {type: 'names'})
      OPTIONAL MATCH (h)-[:HAS_TAG]->(st:NostrEventTag {type: 'slug'})
      RETURN h.uuid AS uuid, h.name AS name, h.pubkey AS pubkey, h.kind AS kind,
             nt.value AS nameTag, nt.value1 AS plural, st.value AS slug
      LIMIT 1
    `, { name: concept });

    if (headers.length === 0) {
      return res.json({ success: false, error: `Concept "${concept}" not found` });
    }

    const header = headers[0];
    const headerUuid = header.uuid;
    const name = header.nameTag || header.name || concept;
    const plural = header.plural || name + 's';
    const slug = header.slug || deriveSlug(name);

    // 2. Check what already exists
    const existing = await runCypher(`
      MATCH (h:NostrEvent {uuid: $uuid})
      OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
      OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
      OPTIONAL MATCH (cg)-[:IS_THE_CORE_GRAPH_FOR]->(h)
      OPTIONAL MATCH (ctg)-[:IS_THE_CLASS_THREADS_GRAPH_FOR]->(h)
      OPTIONAL MATCH (ptg)-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(h)
      RETURN sup.uuid AS supersetUuid, js.uuid AS schemaUuid,
             cg.uuid AS coreGraphUuid, ctg.uuid AS classGraphUuid, ptg.uuid AS propGraphUuid
    `, { uuid: headerUuid });

    const ex = existing[0] || {};
    const missing = [];
    if (!ex.supersetUuid && (!node || node === 'superset')) missing.push('superset');
    if (!ex.schemaUuid && (!node || node === 'schema')) missing.push('schema');
    if (!ex.coreGraphUuid && (!node || node === 'core-graph')) missing.push('core-graph');
    if (!ex.classGraphUuid && (!node || node === 'class-graph')) missing.push('class-graph');
    if (!ex.propGraphUuid && (!node || node === 'property-graph')) missing.push('property-graph');

    if (missing.length === 0) {
      const target = node ? `"${node}" node` : 'skeleton nodes';
      return res.json({ success: true, message: `Nothing to fix — ${target} already exist.`, created: [] });
    }

    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        message: `Would create: ${missing.join(', ')}`,
        missing,
      });
    }

    // 3. Create missing nodes
    const created = [];
    const allEvents = [];

    // Track UUIDs (existing or newly created) for cross-references
    let supersetATag = ex.supersetUuid;
    let schemaATag = ex.schemaUuid;
    let coreGraphATag = ex.coreGraphUuid;
    let classGraphATag = ex.classGraphUuid;
    let propGraphATag = ex.propGraphUuid;

    // Helper: create node + wiring relationship + publish + import
    async function createNode(role, nodeEvent, relType, relDirection) {
      await publishToStrfry(nodeEvent);
      await importEventDirect(nodeEvent, nodeEvent._uuid);
      allEvents.push(nodeEvent);

      // Create wiring relationship event
      const relDTag = randomDTag();
      const [from, to] = relDirection === 'from-header'
        ? [headerUuid, nodeEvent._uuid]
        : [nodeEvent._uuid, headerUuid];

      const relEvent = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', relDTag],
          ['name', `${name} ${relType}`],
          ['z', configUuid('relationship')],
          ['nodeFrom', from],
          ['nodeTo', to],
          ['relationshipType', relType],
        ],
        content: '',
      });
      const relUuid = `39999:${relEvent.pubkey}:${relDTag}`;
      await publishToStrfry(relEvent);
      await importEventDirect(relEvent, relUuid);
      allEvents.push(relEvent);

      // Wire in Neo4j
      await writeCypher(`
        MATCH (a:NostrEvent {uuid: $from}), (b:NostrEvent {uuid: $to})
        MERGE (a)-[:${relType}]->(b)
      `, { from, to });

      created.push({ role, uuid: nodeEvent._uuid, relType });
    }

    // ── Superset ──
    if (missing.includes('superset')) {
      const dTag = `${slug}-superset`;
      const supersetName = `the superset of all ${plural}`;
      const supersetJson = JSON.stringify({
        supersetOf: name,
        role: 'superset',
        description: `The superset node for the ${name} concept.`,
      });
      const evt = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', supersetName],
          ['z', configUuid('superset')],
          ['description', `The superset node for the ${name} concept.`],
          ['json', supersetJson],
        ],
        content: '',
      });
      evt._uuid = `39999:${evt.pubkey}:${dTag}`;
      supersetATag = evt._uuid;

      // Superset gets Superset label
      await createNode('Superset', evt, 'IS_THE_CONCEPT_FOR', 'from-header');
      await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:Superset`, { uuid: supersetATag });

      // Also set ClassThreadHeader label on the header if missing
      await writeCypher(`
        MATCH (h:NostrEvent {uuid: $uuid})
        WHERE NOT h:ClassThreadHeader
        SET h:ClassThreadHeader
      `, { uuid: headerUuid });
    }

    // ── JSON Schema ──
    if (missing.includes('schema')) {
      const dTag = `${slug}-schema`;
      const schemaName = `JSON schema for ${name}`;
      const schemaJson = JSON.stringify({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        title: name,
        description: `JSON Schema for ${name}`,
        properties: {},
        required: [],
      });
      const evt = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', schemaName],
          ['z', configUuid('jsonSchema')],
          ['description', `The JSON Schema defining the horizontal structure of the ${name} concept.`],
          ['json', schemaJson],
        ],
        content: '',
      });
      evt._uuid = `39999:${evt.pubkey}:${dTag}`;
      schemaATag = evt._uuid;

      await createNode('JSON Schema', evt, 'IS_THE_JSON_SCHEMA_FOR', 'to-header');
      await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:JSONSchema`, { uuid: schemaATag });
    }

    // ── Core Nodes Graph ──
    // Created without JSON first; JSON is added after all nodes exist (needs all UUIDs)
    if (missing.includes('core-graph')) {
      const dTag = `${slug}-core-nodes-graph`;
      const graphName = `core nodes graph for the ${name} concept`;
      const evt = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', graphName],
          ['z', configUuid('graph')],
          ['description', `Core infrastructure nodes for ${name}: header, superset, schema, and three canonical graphs.`],
        ],
        content: '',
      });
      evt._uuid = `39999:${evt.pubkey}:${dTag}`;
      coreGraphATag = evt._uuid;

      await createNode('Core Nodes Graph', evt, 'IS_THE_CORE_GRAPH_FOR', 'to-header');
    }

    // ── Finalize Core Nodes Graph JSON (needs all UUIDs) ──
    if (coreGraphATag && missing.includes('core-graph')) {
      const dTag = `${slug}-core-nodes-graph`;
      const graphName = `core nodes graph for the ${name} concept`;
      const supersetName = `the superset of all ${plural}`;
      const schemaName = `JSON schema for ${name}`;

      const graphJson = JSON.stringify({
        graph: {
          nodes: [
            { slug: `${slug}_header`, uuid: headerUuid, name },
            ...(supersetATag ? [{ slug: `${slug}_superset`, uuid: supersetATag, name: supersetName }] : []),
            ...(schemaATag ? [{ slug: `${slug}_schema`, uuid: schemaATag, name: schemaName }] : []),
            { slug: `${slug}_coreNodesGraph`, uuid: coreGraphATag, name: graphName },
            ...(classGraphATag ? [{ slug: `${slug}_classThreadsGraph`, uuid: classGraphATag, name: `class threads graph for the ${name} concept` }] : []),
            ...(propGraphATag ? [{ slug: `${slug}_propertyTreeGraph`, uuid: propGraphATag, name: `property tree graph for the ${name} concept` }] : []),
          ],
          relationshipTypes: [
            { slug: 'IS_THE_CONCEPT_FOR', name: 'class thread initiation' },
            { slug: 'IS_THE_JSON_SCHEMA_FOR', name: 'is the JSON schema for' },
            { slug: 'IS_THE_CORE_GRAPH_FOR', name: 'IS_THE_CORE_GRAPH_FOR' },
            { slug: 'IS_THE_CLASS_THREADS_GRAPH_FOR', name: 'IS_THE_CLASS_THREADS_GRAPH_FOR' },
            { slug: 'IS_THE_PROPERTY_TREE_GRAPH_FOR', name: 'IS_THE_PROPERTY_TREE_GRAPH_FOR' },
          ],
          relationships: [
            { nodeFrom: { slug: `${slug}_header` }, relationshipType: { slug: 'IS_THE_CONCEPT_FOR' }, nodeTo: { slug: `${slug}_superset` } },
            { nodeFrom: { slug: `${slug}_schema` }, relationshipType: { slug: 'IS_THE_JSON_SCHEMA_FOR' }, nodeTo: { slug: `${slug}_header` } },
            { nodeFrom: { slug: `${slug}_coreNodesGraph` }, relationshipType: { slug: 'IS_THE_CORE_GRAPH_FOR' }, nodeTo: { slug: `${slug}_header` } },
            { nodeFrom: { slug: `${slug}_classThreadsGraph` }, relationshipType: { slug: 'IS_THE_CLASS_THREADS_GRAPH_FOR' }, nodeTo: { slug: `${slug}_header` } },
            { nodeFrom: { slug: `${slug}_propertyTreeGraph` }, relationshipType: { slug: 'IS_THE_PROPERTY_TREE_GRAPH_FOR' }, nodeTo: { slug: `${slug}_header` } },
          ],
        },
      });

      // Re-publish with JSON
      const evt2 = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', graphName],
          ['z', configUuid('graph')],
          ['description', `Core infrastructure nodes for ${name}: header, superset, schema, and three canonical graphs.`],
          ['json', graphJson],
        ],
        content: '',
      });
      await publishToStrfry(evt2);
      await importEventDirect(evt2, coreGraphATag);
    }

    // ── Class Threads Graph ──
    if (missing.includes('class-graph')) {
      const dTag = `${slug}-class-threads-graph`;
      const graphName = `class threads graph for the ${name} concept`;
      const graphJson = JSON.stringify({
        graph: {
          nodes: supersetATag ? [{ slug: `${slug}_superset`, uuid: supersetATag, name: `the superset of all ${plural}` }] : [],
          relationshipTypes: [
            { slug: 'IS_A_SUPERSET_OF', name: 'class thread propagation' },
            { slug: 'HAS_ELEMENT', name: 'class thread termination' },
          ],
          relationships: [],
        },
      });
      const evt = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', graphName],
          ['z', configUuid('graph')],
          ['description', `Class thread graph for ${name}: superset hierarchy and elements.`],
          ['json', graphJson],
        ],
        content: '',
      });
      evt._uuid = `39999:${evt.pubkey}:${dTag}`;
      classGraphATag = evt._uuid;

      await createNode('Class Threads Graph', evt, 'IS_THE_CLASS_THREADS_GRAPH_FOR', 'to-header');
    }

    // ── Property Tree Graph ──
    if (missing.includes('property-graph')) {
      const dTag = `${slug}-property-tree-graph`;
      const graphName = `property tree graph for the ${name} concept`;
      const graphJson = JSON.stringify({
        graph: {
          nodes: schemaATag ? [{ slug: `${slug}_schema`, uuid: schemaATag, name: `JSON schema for ${name}` }] : [],
          relationshipTypes: [
            { slug: 'IS_A_PROPERTY_OF', name: 'is a property of' },
            { slug: 'ENUMERATES', name: 'enumerates' },
          ],
          relationships: [],
        },
      });
      const evt = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', graphName],
          ['z', configUuid('graph')],
          ['description', `Property tree graph for ${name}: schema and properties.`],
          ['json', graphJson],
        ],
        content: '',
      });
      evt._uuid = `39999:${evt.pubkey}:${dTag}`;
      propGraphATag = evt._uuid;

      await createNode('Property Tree Graph', evt, 'IS_THE_PROPERTY_TREE_GRAPH_FOR', 'to-header');
    }

    return res.json({
      success: true,
      message: `Created ${created.length} node(s) with wiring.`,
      created,
    });

  } catch (error) {
    console.error('normalize/skeleton error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/json
//   Body: { concept: "<name>", node?: "<role>" }
//   Regenerates JSON tags for skeleton nodes of a concept.
//   If node is omitted, regenerates all skeleton nodes.
// ══════════════════════════════════════════════════════════════

async function handleNormalizeJson(req, res) {
  try {
    const { concept, node } = req.body;
    if (!concept) {
      return res.status(400).json({ success: false, error: 'Missing concept name' });
    }

    const validNodes = ['header', 'superset', 'schema', 'core-graph', 'class-graph', 'property-graph'];
    if (node && !validNodes.includes(node)) {
      return res.status(400).json({ success: false, error: `Invalid node: ${node}. Valid: ${validNodes.join(', ')}` });
    }

    // 1. Find the header and all skeleton nodes
    const rows = await runCypher(`
      MATCH (h:NostrEvent)
      WHERE (h:ListHeader OR h:ClassThreadHeader) AND h.kind IN [9998, 39998]
        AND h.name = $name
      OPTIONAL MATCH (h)-[:HAS_TAG]->(nt:NostrEventTag {type: 'names'})
      OPTIONAL MATCH (h)-[:HAS_TAG]->(st:NostrEventTag {type: 'slug'})
      OPTIONAL MATCH (h)-[:HAS_TAG]->(dt:NostrEventTag {type: 'd'})
      OPTIONAL MATCH (h)-[:HAS_TAG]->(desc:NostrEventTag {type: 'description'})
      OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
      OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
      OPTIONAL MATCH (cg)-[:IS_THE_CORE_GRAPH_FOR]->(h)
      OPTIONAL MATCH (ctg)-[:IS_THE_CLASS_THREADS_GRAPH_FOR]->(h)
      OPTIONAL MATCH (ptg)-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(h)
      RETURN h.uuid AS headerUuid, h.name AS headerName, h.pubkey AS pubkey, h.kind AS kind,
             nt.value AS nameTag, nt.value1 AS plural, st.value AS slug, dt.value AS dTag,
             desc.value AS description,
             sup.uuid AS supersetUuid, sup.name AS supersetName,
             js.uuid AS schemaUuid, js.name AS schemaName,
             cg.uuid AS coreGraphUuid, cg.name AS coreGraphName,
             ctg.uuid AS classGraphUuid, ctg.name AS classGraphName,
             ptg.uuid AS propGraphUuid, ptg.name AS propGraphName
      LIMIT 1
    `, { name: concept });

    if (rows.length === 0) {
      return res.json({ success: false, error: `Concept "${concept}" not found` });
    }

    const h = rows[0];
    const name = h.nameTag || h.headerName || concept;
    const plural = h.plural || name + 's';
    const slug = h.slug || deriveSlug(name);
    const updated = [];

    // ── Header JSON ──
    if (!node || node === 'header') {
      if (h.headerUuid) {
        const headerJson = {
          concept: {
            name,
            plural,
            slug,
            constituents: {
              ...(h.supersetUuid && { superset: h.supersetUuid }),
              ...(h.schemaUuid && { jsonSchema: h.schemaUuid }),
              ...(h.coreGraphUuid && { coreNodesGraph: h.coreGraphUuid }),
              ...(h.classGraphUuid && { classThreadsGraph: h.classGraphUuid }),
              ...(h.propGraphUuid && { propertyTreeGraph: h.propGraphUuid }),
            },
          },
        };
        await regenerateJson(h.headerUuid, headerJson);
        updated.push({ role: 'ListHeader', uuid: h.headerUuid });
      }
    }

    // ── Superset JSON ──
    if ((!node || node === 'superset') && h.supersetUuid) {
      const supersetJson = {
        supersetOf: name,
        role: 'superset',
        description: `The superset node for the ${name} concept. All ${plural} are elements of this set.`,
      };
      await regenerateJson(h.supersetUuid, supersetJson);
      updated.push({ role: 'Superset', uuid: h.supersetUuid });
    }

    // ── JSON Schema JSON ──
    if ((!node || node === 'schema') && h.schemaUuid) {
      // Fetch existing json to preserve user-defined properties/required
      const existingJsonRows = await runCypher(`
        MATCH (e:NostrEvent {uuid: $uuid})-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
        RETURN t.value AS json
      `, { uuid: h.schemaUuid });

      let schemaJson;
      if (existingJsonRows.length > 0 && existingJsonRows[0].json) {
        try {
          schemaJson = JSON.parse(existingJsonRows[0].json);
          // Ensure required fields are present
          schemaJson.$schema = schemaJson.$schema || 'https://json-schema.org/draft/2020-12/schema';
          schemaJson.type = schemaJson.type || 'object';
          schemaJson.title = schemaJson.title || name;
        } catch (e) {
          schemaJson = null;
        }
      }
      if (!schemaJson) {
        schemaJson = {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
          title: name,
          description: `JSON Schema for ${name}`,
          properties: {},
          required: [],
        };
      }
      await regenerateJson(h.schemaUuid, schemaJson);
      updated.push({ role: 'JSON Schema', uuid: h.schemaUuid });
    }

    // ── Core Nodes Graph JSON ──
    if ((!node || node === 'core-graph') && h.coreGraphUuid) {
      const graphJson = {
        graph: {
          nodes: [
            { slug: `${slug}_header`, uuid: h.headerUuid, name },
            ...(h.supersetUuid ? [{ slug: `${slug}_superset`, uuid: h.supersetUuid, name: h.supersetName }] : []),
            ...(h.schemaUuid ? [{ slug: `${slug}_schema`, uuid: h.schemaUuid, name: h.schemaName }] : []),
            { slug: `${slug}_coreNodesGraph`, uuid: h.coreGraphUuid, name: h.coreGraphName },
            ...(h.classGraphUuid ? [{ slug: `${slug}_classThreadsGraph`, uuid: h.classGraphUuid, name: h.classGraphName }] : []),
            ...(h.propGraphUuid ? [{ slug: `${slug}_propertyTreeGraph`, uuid: h.propGraphUuid, name: h.propGraphName }] : []),
          ],
          relationshipTypes: [
            { slug: 'IS_THE_CONCEPT_FOR', name: 'class thread initiation' },
            { slug: 'IS_THE_JSON_SCHEMA_FOR', name: 'is the JSON schema for' },
            { slug: 'IS_THE_CORE_GRAPH_FOR', name: 'IS_THE_CORE_GRAPH_FOR' },
            { slug: 'IS_THE_CLASS_THREADS_GRAPH_FOR', name: 'IS_THE_CLASS_THREADS_GRAPH_FOR' },
            { slug: 'IS_THE_PROPERTY_TREE_GRAPH_FOR', name: 'IS_THE_PROPERTY_TREE_GRAPH_FOR' },
          ],
          relationships: [
            { nodeFrom: { slug: `${slug}_header` }, relationshipType: { slug: 'IS_THE_CONCEPT_FOR' }, nodeTo: { slug: `${slug}_superset` } },
            { nodeFrom: { slug: `${slug}_schema` }, relationshipType: { slug: 'IS_THE_JSON_SCHEMA_FOR' }, nodeTo: { slug: `${slug}_header` } },
            { nodeFrom: { slug: `${slug}_coreNodesGraph` }, relationshipType: { slug: 'IS_THE_CORE_GRAPH_FOR' }, nodeTo: { slug: `${slug}_header` } },
            { nodeFrom: { slug: `${slug}_classThreadsGraph` }, relationshipType: { slug: 'IS_THE_CLASS_THREADS_GRAPH_FOR' }, nodeTo: { slug: `${slug}_header` } },
            { nodeFrom: { slug: `${slug}_propertyTreeGraph` }, relationshipType: { slug: 'IS_THE_PROPERTY_TREE_GRAPH_FOR' }, nodeTo: { slug: `${slug}_header` } },
          ],
        },
      };
      await regenerateJson(h.coreGraphUuid, graphJson);
      updated.push({ role: 'Core Nodes Graph', uuid: h.coreGraphUuid });
    }

    // ── Class Threads Graph JSON ──
    if ((!node || node === 'class-graph') && h.classGraphUuid) {
      // Include superset + any intermediate sets
      const setRows = await runCypher(`
        MATCH (h:NostrEvent {uuid: $headerUuid})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
        OPTIONAL MATCH (sup)-[:IS_A_SUPERSET_OF*0..10]->(s)
        WHERE s:Superset OR s:NostrEvent
        RETURN DISTINCT s.uuid AS uuid, s.name AS name
      `, { headerUuid: h.headerUuid });

      const graphJson = {
        graph: {
          nodes: setRows.filter(r => r.uuid).map(r => ({ uuid: r.uuid, name: r.name })),
          relationshipTypes: [
            { slug: 'IS_A_SUPERSET_OF', name: 'class thread propagation' },
            { slug: 'HAS_ELEMENT', name: 'class thread termination' },
          ],
          relationships: [],
        },
      };
      await regenerateJson(h.classGraphUuid, graphJson);
      updated.push({ role: 'Class Threads Graph', uuid: h.classGraphUuid });
    }

    // ── Property Tree Graph JSON ──
    if ((!node || node === 'property-graph') && h.propGraphUuid) {
      const graphJson = {
        graph: {
          nodes: h.schemaUuid ? [{ slug: `${slug}_schema`, uuid: h.schemaUuid, name: h.schemaName }] : [],
          relationshipTypes: [
            { slug: 'IS_A_PROPERTY_OF', name: 'is a property of' },
            { slug: 'ENUMERATES', name: 'enumerates' },
          ],
          relationships: [],
        },
      };
      await regenerateJson(h.propGraphUuid, graphJson);
      updated.push({ role: 'Property Tree Graph', uuid: h.propGraphUuid });
    }

    if (updated.length === 0) {
      const target = node ? `"${node}" node` : 'skeleton nodes';
      return res.json({ success: true, message: `No ${target} found to update.`, updated: [] });
    }

    return res.json({
      success: true,
      message: `Regenerated JSON for ${updated.length} node(s).`,
      updated,
    });

  } catch (error) {
    console.error('normalize/json error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/create-concept
//   Body: { name, plural?, description? }
//   Creates a full concept skeleton: ListHeader + 5 nodes + wiring + JSON
// ══════════════════════════════════════════════════════════════

async function handleCreateConcept(req, res) {
  try {
    const { name, plural, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Concept name is required' });
    }

    const trimName = name.trim();
    const trimPlural = (plural || '').trim() || trimName + 's';
    const slug = deriveSlug(trimName);

    // Check for duplicate name (same name, same signer)
    const privBytes = getPrivkey();
    const pubkey = Buffer.from(nt().getPublicKey(privBytes)).toString('hex');

    const dupes = await runCypher(`
      MATCH (h:NostrEvent)
      WHERE (h:ListHeader OR h:ClassThreadHeader) AND h.kind IN [9998, 39998]
        AND h.name = $name AND h.pubkey = $pubkey
      RETURN h.uuid AS uuid
      LIMIT 1
    `, { name: trimName, pubkey });

    if (dupes.length > 0) {
      return res.json({ success: false, error: `Concept "${trimName}" already exists (uuid: ${dupes[0].uuid})` });
    }

    const allEvents = [];
    const headerDTag = randomDTag();

    // ── 1. ListHeader ──
    const headerTags = [
      ['d', headerDTag],
      ['names', trimName, trimPlural],
      ['slug', slug],
    ];
    if (description) headerTags.push(['description', description.trim()]);

    const headerEvent = signAndFinalize({ kind: 39998, tags: headerTags, content: '' });
    const headerUuid = `39998:${headerEvent.pubkey}:${headerDTag}`;
    await publishToStrfry(headerEvent);
    await importEventDirect(headerEvent, headerUuid);
    allEvents.push(headerEvent);

    // Set ListHeader + ClassThreadHeader labels
    await writeCypher(`
      MATCH (h:NostrEvent {uuid: $uuid})
      SET h:ListHeader, h:ClassThreadHeader
    `, { uuid: headerUuid });

    // ── 2. Superset ──
    const supersetDTag = `${slug}-superset`;
    const supersetName = `the superset of all ${trimPlural}`;
    const supersetJson = JSON.stringify({
      supersetOf: trimName, role: 'superset',
      description: `The superset node for the ${trimName} concept.`,
    });
    const supersetEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', supersetDTag], ['name', supersetName],
        ['z', configUuid('superset')],
        ['description', `The superset node for the ${trimName} concept.`],
        ['json', supersetJson],
      ],
    });
    const supersetUuid = `39999:${supersetEvent.pubkey}:${supersetDTag}`;
    await publishToStrfry(supersetEvent);
    await importEventDirect(supersetEvent, supersetUuid);
    await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:Superset`, { uuid: supersetUuid });
    allEvents.push(supersetEvent);

    // ── 3. JSON Schema ──
    const schemaDTag = `${slug}-schema`;
    const schemaName = `JSON schema for ${trimName}`;
    const schemaJson = JSON.stringify({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object', title: trimName,
      description: `JSON Schema for ${trimName}`,
      properties: {}, required: [],
    });
    const schemaEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', schemaDTag], ['name', schemaName],
        ['z', configUuid('jsonSchema')],
        ['description', `The JSON Schema defining the horizontal structure of the ${trimName} concept.`],
        ['json', schemaJson],
      ],
    });
    const schemaUuid = `39999:${schemaEvent.pubkey}:${schemaDTag}`;
    await publishToStrfry(schemaEvent);
    await importEventDirect(schemaEvent, schemaUuid);
    await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:JSONSchema`, { uuid: schemaUuid });
    allEvents.push(schemaEvent);

    // ── 4. Class Threads Graph ──
    const ctDTag = `${slug}-class-threads-graph`;
    const ctName = `class threads graph for the ${trimName} concept`;
    const ctJson = JSON.stringify({ graph: {
      nodes: [{ slug: `${slug}_superset`, uuid: supersetUuid, name: supersetName }],
      relationshipTypes: [
        { slug: 'IS_A_SUPERSET_OF', name: 'class thread propagation' },
        { slug: 'HAS_ELEMENT', name: 'class thread termination' },
      ],
      relationships: [],
    }});
    const ctEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [['d', ctDTag], ['name', ctName], ['z', configUuid('graph')],
        ['description', `Class thread graph for ${trimName}.`], ['json', ctJson]],
    });
    const ctUuid = `39999:${ctEvent.pubkey}:${ctDTag}`;
    await publishToStrfry(ctEvent);
    await importEventDirect(ctEvent, ctUuid);
    allEvents.push(ctEvent);

    // ── 5. Property Tree Graph ──
    const ptDTag = `${slug}-property-tree-graph`;
    const ptName = `property tree graph for the ${trimName} concept`;
    const ptJson = JSON.stringify({ graph: {
      nodes: [{ slug: `${slug}_schema`, uuid: schemaUuid, name: schemaName }],
      relationshipTypes: [
        { slug: 'IS_A_PROPERTY_OF', name: 'is a property of' },
        { slug: 'ENUMERATES', name: 'enumerates' },
      ],
      relationships: [],
    }});
    const ptEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [['d', ptDTag], ['name', ptName], ['z', configUuid('graph')],
        ['description', `Property tree graph for ${trimName}.`], ['json', ptJson]],
    });
    const ptUuid = `39999:${ptEvent.pubkey}:${ptDTag}`;
    await publishToStrfry(ptEvent);
    await importEventDirect(ptEvent, ptUuid);
    allEvents.push(ptEvent);

    // ── 6. Core Nodes Graph (needs all UUIDs) ──
    const cgDTag = `${slug}-core-nodes-graph`;
    const cgName = `core nodes graph for the ${trimName} concept`;
    const cgJson = JSON.stringify({ graph: {
      nodes: [
        { slug: `${slug}_header`, uuid: headerUuid, name: trimName },
        { slug: `${slug}_superset`, uuid: supersetUuid, name: supersetName },
        { slug: `${slug}_schema`, uuid: schemaUuid, name: schemaName },
        { slug: `${slug}_coreNodesGraph`, uuid: `39999:${headerEvent.pubkey}:${cgDTag}`, name: cgName },
        { slug: `${slug}_classThreadsGraph`, uuid: ctUuid, name: ctName },
        { slug: `${slug}_propertyTreeGraph`, uuid: ptUuid, name: ptName },
      ],
      relationshipTypes: [
        { slug: 'IS_THE_CONCEPT_FOR', name: 'class thread initiation' },
        { slug: 'IS_THE_JSON_SCHEMA_FOR', name: 'is the JSON schema for' },
        { slug: 'IS_THE_CORE_GRAPH_FOR', name: 'IS_THE_CORE_GRAPH_FOR' },
        { slug: 'IS_THE_CLASS_THREADS_GRAPH_FOR', name: 'IS_THE_CLASS_THREADS_GRAPH_FOR' },
        { slug: 'IS_THE_PROPERTY_TREE_GRAPH_FOR', name: 'IS_THE_PROPERTY_TREE_GRAPH_FOR' },
      ],
      relationships: [
        { nodeFrom: { slug: `${slug}_header` }, relationshipType: { slug: 'IS_THE_CONCEPT_FOR' }, nodeTo: { slug: `${slug}_superset` } },
        { nodeFrom: { slug: `${slug}_schema` }, relationshipType: { slug: 'IS_THE_JSON_SCHEMA_FOR' }, nodeTo: { slug: `${slug}_header` } },
        { nodeFrom: { slug: `${slug}_coreNodesGraph` }, relationshipType: { slug: 'IS_THE_CORE_GRAPH_FOR' }, nodeTo: { slug: `${slug}_header` } },
        { nodeFrom: { slug: `${slug}_classThreadsGraph` }, relationshipType: { slug: 'IS_THE_CLASS_THREADS_GRAPH_FOR' }, nodeTo: { slug: `${slug}_header` } },
        { nodeFrom: { slug: `${slug}_propertyTreeGraph` }, relationshipType: { slug: 'IS_THE_PROPERTY_TREE_GRAPH_FOR' }, nodeTo: { slug: `${slug}_header` } },
      ],
    }});
    const cgEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [['d', cgDTag], ['name', cgName], ['z', configUuid('graph')],
        ['description', `Core infrastructure nodes for ${trimName}.`], ['json', cgJson]],
    });
    const cgUuid = `39999:${cgEvent.pubkey}:${cgDTag}`;
    await publishToStrfry(cgEvent);
    await importEventDirect(cgEvent, cgUuid);
    allEvents.push(cgEvent);

    // ── 7. Update ListHeader with constituent JSON ──
    const headerJson = JSON.stringify({ concept: {
      name: trimName, plural: trimPlural, slug,
      constituents: {
        superset: supersetUuid, jsonSchema: schemaUuid,
        coreNodesGraph: cgUuid, classThreadsGraph: ctUuid, propertyTreeGraph: ptUuid,
      },
    }});
    const headerTagsV2 = [
      ['d', headerDTag], ['names', trimName, trimPlural], ['slug', slug], ['json', headerJson],
    ];
    if (description) headerTagsV2.push(['description', description.trim()]);
    const headerEventV2 = signAndFinalize({ kind: 39998, tags: headerTagsV2, content: '' });
    await publishToStrfry(headerEventV2);
    await importEventDirect(headerEventV2, headerUuid);

    // ── 8. Wiring relationships ──
    const relDefs = [
      { from: headerUuid, to: supersetUuid, type: 'IS_THE_CONCEPT_FOR' },
      { from: schemaUuid, to: headerUuid, type: 'IS_THE_JSON_SCHEMA_FOR' },
      { from: cgUuid, to: headerUuid, type: 'IS_THE_CORE_GRAPH_FOR' },
      { from: ctUuid, to: headerUuid, type: 'IS_THE_CLASS_THREADS_GRAPH_FOR' },
      { from: ptUuid, to: headerUuid, type: 'IS_THE_PROPERTY_TREE_GRAPH_FOR' },
    ];

    for (const rel of relDefs) {
      const relDTag = randomDTag();
      const relEvent = signAndFinalize({
        kind: 39999, content: '',
        tags: [
          ['d', relDTag], ['name', `${trimName} ${rel.type}`],
          ['z', configUuid('relationship')],
          ['nodeFrom', rel.from], ['nodeTo', rel.to], ['relationshipType', rel.type],
        ],
      });
      const relUuid = `39999:${relEvent.pubkey}:${relDTag}`;
      await publishToStrfry(relEvent);
      await importEventDirect(relEvent, relUuid);
      allEvents.push(relEvent);

      // Wire in Neo4j
      await writeCypher(`
        MATCH (a:NostrEvent {uuid: $from}), (b:NostrEvent {uuid: $to})
        MERGE (a)-[:${rel.type}]->(b)
      `, { from: rel.from, to: rel.to });
    }

    return res.json({
      success: true,
      message: `Concept "${trimName}" created with ${allEvents.length} events.`,
      concept: {
        name: trimName, plural: trimPlural, slug,
        uuid: headerUuid,
        superset: supersetUuid,
        schema: schemaUuid,
        coreGraph: cgUuid,
        classGraph: ctUuid,
        propGraph: ptUuid,
      },
    });

  } catch (error) {
    console.error('normalize/create-concept error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/create-element
//   Body: { concept: "<name>", name: "<element name>", json?: object }
//   Creates an element (kind 39999 ListItem) wired to the concept's superset.
// ══════════════════════════════════════════════════════════════

async function handleCreateElement(req, res) {
  try {
    const { concept, name: elemName, json: elemJson } = req.body;
    if (!concept) return res.status(400).json({ success: false, error: 'Missing concept name' });
    if (!elemName || !elemName.trim()) return res.status(400).json({ success: false, error: 'Element name is required' });

    const trimName = elemName.trim();

    // Find the concept header + superset
    const rows = await runCypher(`
      MATCH (h:NostrEvent)
      WHERE (h:ListHeader OR h:ClassThreadHeader) AND h.kind IN [9998, 39998]
        AND h.name = $concept
      OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
      RETURN h.uuid AS headerUuid, h.name AS headerName,
             sup.uuid AS supersetUuid
      LIMIT 1
    `, { concept });

    if (rows.length === 0) {
      return res.json({ success: false, error: `Concept "${concept}" not found` });
    }

    const { headerUuid, supersetUuid } = rows[0];
    if (!supersetUuid) {
      return res.json({ success: false, error: `Concept "${concept}" has no Superset node. Create one first via normalize skeleton.` });
    }

    // Check for duplicate element name under same superset
    const dupes = await runCypher(`
      MATCH (sup:Superset {uuid: $supersetUuid})-[:IS_A_SUPERSET_OF*0..5]->(s)-[:HAS_ELEMENT]->(e:NostrEvent)
      WHERE e.name = $name
      RETURN e.uuid AS uuid
      LIMIT 1
    `, { supersetUuid, name: trimName });

    if (dupes.length > 0) {
      return res.json({ success: false, error: `Element "${trimName}" already exists in this concept (uuid: ${dupes[0].uuid})` });
    }

    // ── Resolve JSON data ──
    // If caller provided explicit JSON, use it. Otherwise auto-generate from
    // the concept's JSON Schema (populate name, defaults for other properties).
    let finalJson = elemJson;
    if (!finalJson) {
      // Look up the concept's JSON Schema json tag
      const schemaRows = await runCypher(`
        MATCH (h:NostrEvent {uuid: $headerUuid})
        OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
        OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
        RETURN head(collect(jt.value)) AS schemaJson
      `, { headerUuid });

      let schema = null;
      const raw = schemaRows[0]?.schemaJson;
      if (raw) {
        try { schema = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch {}
      }

      if (schema && schema.properties && Object.keys(schema.properties).length > 0) {
        // Build conforming object with type-appropriate defaults
        finalJson = {};
        for (const [prop, def] of Object.entries(schema.properties)) {
          if (prop === 'name' || prop === 'title') {
            finalJson[prop] = trimName;
          } else if (prop === 'slug') {
            finalJson[prop] = trimName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          } else if (prop === 'description') {
            finalJson[prop] = '';
          } else {
            // Type-based defaults
            const t = def.type;
            if (t === 'string')       finalJson[prop] = '';
            else if (t === 'number' || t === 'integer') finalJson[prop] = 0;
            else if (t === 'boolean') finalJson[prop] = false;
            else if (t === 'array')   finalJson[prop] = [];
            else if (t === 'object')  finalJson[prop] = {};
            else                      finalJson[prop] = null;
          }
        }
      } else {
        // No schema — minimal JSON with just the name
        finalJson = { name: trimName };
      }
    }

    // Create the element event
    const dTag = randomDTag();
    const tags = [
      ['d', dTag],
      ['name', trimName],
      ['z', headerUuid],
      ['json', typeof finalJson === 'string' ? finalJson : JSON.stringify(finalJson)],
    ];

    const evt = signAndFinalize({ kind: 39999, tags, content: '' });
    const elemUuid = `39999:${evt.pubkey}:${dTag}`;

    await publishToStrfry(evt);
    await importEventDirect(evt, elemUuid);

    // Set ListItem label
    await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:ListItem`, { uuid: elemUuid });

    // Wire HAS_ELEMENT from superset
    await writeCypher(`
      MATCH (sup:NostrEvent {uuid: $supersetUuid}), (elem:NostrEvent {uuid: $elemUuid})
      MERGE (sup)-[:HAS_ELEMENT]->(elem)
    `, { supersetUuid, elemUuid });

    return res.json({
      success: true,
      message: `Element "${trimName}" created and wired to concept.`,
      element: { name: trimName, uuid: elemUuid, concept, supersetUuid },
    });

  } catch (error) {
    console.error('normalize/create-element error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/save-schema
//   Body: { concept: "<name>", schema: { ... JSON Schema object } }
//   Replaces the JSON tag on the concept's JSONSchema node and re-publishes.
// ══════════════════════════════════════════════════════════════

async function handleSaveSchema(req, res) {
  try {
    const { concept, schema } = req.body;
    if (!concept) return res.status(400).json({ success: false, error: 'Missing concept name' });
    if (!schema || typeof schema !== 'object') return res.status(400).json({ success: false, error: 'Missing or invalid schema object' });

    // Find the concept's JSON Schema node
    const rows = await runCypher(`
      MATCH (h:NostrEvent)
      WHERE (h:ListHeader OR h:ClassThreadHeader) AND h.kind IN [9998, 39998]
        AND h.name = $concept
      OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
      RETURN h.uuid AS headerUuid, js.uuid AS schemaUuid
      LIMIT 1
    `, { concept });

    if (rows.length === 0) {
      return res.json({ success: false, error: `Concept "${concept}" not found` });
    }

    const { schemaUuid } = rows[0];
    if (!schemaUuid) {
      return res.json({ success: false, error: `Concept "${concept}" has no JSON Schema node. Create one first via normalize skeleton.` });
    }

    // Ensure minimum schema fields
    const finalSchema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      ...schema,
    };

    await regenerateJson(schemaUuid, finalSchema);

    return res.json({
      success: true,
      message: `JSON Schema for "${concept}" updated.`,
      schemaUuid,
    });

  } catch (error) {
    console.error('normalize/save-schema error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/save-element-json
//   Body: { uuid: "<element uuid>", json: { ... merged JSON } }
//   Replaces the JSON tag on an element and re-publishes.
// ══════════════════════════════════════════════════════════════

async function handleSaveElementJson(req, res) {
  try {
    const { uuid, json } = req.body;
    if (!uuid) return res.status(400).json({ success: false, error: 'Missing element uuid' });
    if (!json || typeof json !== 'object') return res.status(400).json({ success: false, error: 'Missing or invalid json object' });

    // Verify the element exists
    const rows = await runCypher(`
      MATCH (e:NostrEvent {uuid: $uuid})
      RETURN e.uuid AS uuid, e.name AS name
      LIMIT 1
    `, { uuid });

    if (rows.length === 0) {
      return res.json({ success: false, error: `Element "${uuid}" not found` });
    }

    await regenerateJson(uuid, json);

    return res.json({
      success: true,
      message: `JSON updated for element "${rows[0].name}".`,
      uuid,
    });

  } catch (error) {
    console.error('normalize/save-element-json error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/create-property
//   Body: { name, concept?, parentUuid?, type?, description?, required? }
//   Creates a single property event wired to the concept's JSON Schema
//   or to a parent property (for nested schemas).
//   Returns { success, property: { name, uuid, parentUuid } }
// ══════════════════════════════════════════════════════════════

async function handleCreateProperty(req, res) {
  try {
    const { name: propName, concept, parentUuid, type: propType, description: propDesc, required: propRequired } = req.body;
    if (!propName || !propName.trim()) return res.status(400).json({ success: false, error: 'Property name is required' });
    if (!concept && !parentUuid) return res.status(400).json({ success: false, error: 'Either concept or parentUuid is required' });

    const trimName = propName.trim();
    const pType = propType || 'string';
    const pDesc = propDesc || '';

    // Resolve target: JSON Schema node (for top-level) or parent property (for nested)
    let targetUuid;
    let targetName;
    if (parentUuid) {
      // Nested property — parent is another property node
      const rows = await runCypher(`
        MATCH (p:NostrEvent {uuid: $parentUuid})
        RETURN p.uuid AS uuid, p.name AS name
        LIMIT 1
      `, { parentUuid });
      if (rows.length === 0) return res.json({ success: false, error: `Parent property "${parentUuid}" not found` });
      targetUuid = rows[0].uuid;
      targetName = rows[0].name;
    } else {
      // Top-level property — target is the concept's JSON Schema node
      const rows = await runCypher(`
        MATCH (h:NostrEvent)
        WHERE (h:ListHeader OR h:ClassThreadHeader) AND h.kind IN [9998, 39998]
          AND h.name = $concept
        OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
        RETURN js.uuid AS schemaUuid, js.name AS schemaName
        LIMIT 1
      `, { concept });
      if (rows.length === 0) return res.json({ success: false, error: `Concept "${concept}" not found` });
      if (!rows[0].schemaUuid) return res.json({ success: false, error: `Concept "${concept}" has no JSON Schema node` });
      targetUuid = rows[0].schemaUuid;
      targetName = rows[0].schemaName;
    }

    // Check for duplicate property name under the same target
    const dupes = await runCypher(`
      MATCH (p:NostrEvent)-[:IS_A_PROPERTY_OF]->(target:NostrEvent {uuid: $targetUuid})
      WHERE p.name = $name
      RETURN p.uuid AS uuid
      LIMIT 1
    `, { targetUuid, name: trimName });
    if (dupes.length > 0) {
      return res.json({ success: false, error: `Property "${trimName}" already exists on "${targetName}" (uuid: ${dupes[0].uuid})` });
    }

    // Get BIOS property concept header UUID for z-tag
    const defaults = require('../../concept-graph/parameters/defaults.json');
    const biosPropertyUuid = defaults.conceptUUIDs.property;

    // Build property JSON
    const propertyJson = {
      property: {
        name: trimName,
        type: pType,
        description: pDesc,
        required: !!propRequired,
      },
    };

    // Create the property event
    const dTag = randomDTag();
    const tags = [
      ['d', dTag],
      ['name', trimName],
      ['description', pDesc],
      ['type', pType],
      ['z', biosPropertyUuid],
      ['json', JSON.stringify(propertyJson)],
    ];

    const evt = signAndFinalize({ kind: 39999, tags, content: '' });
    const propUuid = `39999:${evt.pubkey}:${dTag}`;

    await publishToStrfry(evt);
    await importEventDirect(evt, propUuid);

    // Set ListItem + Property labels
    await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:ListItem:Property`, { uuid: propUuid });

    // Wire IS_A_PROPERTY_OF → target
    await writeCypher(`
      MATCH (prop:NostrEvent {uuid: $propUuid}), (target:NostrEvent {uuid: $targetUuid})
      MERGE (prop)-[:IS_A_PROPERTY_OF]->(target)
    `, { propUuid, targetUuid });

    // Wire HAS_ELEMENT from BIOS property superset
    const biosSupersetRows = await runCypher(`
      MATCH (h:NostrEvent {uuid: $biosPropertyUuid})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
      RETURN sup.uuid AS supersetUuid
      LIMIT 1
    `, { biosPropertyUuid });
    if (biosSupersetRows.length > 0) {
      await writeCypher(`
        MATCH (sup:NostrEvent {uuid: $supersetUuid}), (prop:NostrEvent {uuid: $propUuid})
        MERGE (sup)-[:HAS_ELEMENT]->(prop)
      `, { supersetUuid: biosSupersetRows[0].supersetUuid, propUuid });
    }

    // Update the property tree graph for this concept
    // Walk up IS_A_PROPERTY_OF chain to find the JSONSchema, then the concept header
    const graphRows = await runCypher(`
      MATCH (prop:NostrEvent {uuid: $propUuid})-[:IS_A_PROPERTY_OF *1..]->(js:JSONSchema)
      MATCH (js)-[:IS_THE_JSON_SCHEMA_FOR]->(h:NostrEvent)
      OPTIONAL MATCH (pg:NostrEvent)-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(h)
      RETURN js.uuid AS schemaUuid, js.name AS schemaName,
             h.uuid AS headerUuid,
             pg.uuid AS propGraphUuid
      LIMIT 1
    `, { propUuid });

    let graphUpdated = false;
    if (graphRows.length > 0 && graphRows[0].propGraphUuid) {
      const { schemaUuid: jsUuid, schemaName: jsName, propGraphUuid } = graphRows[0];

      // Rebuild the full property tree graph from current Neo4j state
      const allProps = await runCypher(`
        MATCH (js:JSONSchema {uuid: $jsUuid})
        MATCH (p:Property)-[:IS_A_PROPERTY_OF *1..]->(js)
        MATCH (p)-[:IS_A_PROPERTY_OF]->(directParent)
        RETURN p.uuid AS uuid, p.name AS name, directParent.uuid AS parentUuid
      `, { jsUuid });

      const graphNodes = [{ slug: deriveSlug(jsName), uuid: jsUuid, name: jsName }];
      const graphRelationships = [];

      for (const row of allProps) {
        graphNodes.push({ slug: deriveSlug(row.name), uuid: row.uuid, name: row.name });
        graphRelationships.push({
          nodeFrom: { slug: deriveSlug(row.name) },
          relationshipType: { slug: 'IS_A_PROPERTY_OF' },
          nodeTo: { slug: row.parentUuid === jsUuid ? deriveSlug(jsName) : deriveSlug(allProps.find(p => p.uuid === row.parentUuid)?.name || '') },
        });
      }

      // Look up IS_A_PROPERTY_OF relationship type UUID
      const relTypeRows = await runCypher(`
        MATCH (rt:NostrEvent) WHERE rt.name = 'is a property of' OR rt.name = 'IS_A_PROPERTY_OF'
        RETURN rt.uuid AS uuid LIMIT 1
      `, {});

      const graphJson = {
        graph: {
          nodes: graphNodes,
          relationshipTypes: [
            { slug: 'IS_A_PROPERTY_OF', name: 'is a property of', ...(relTypeRows[0]?.uuid ? { uuid: relTypeRows[0].uuid } : {}) },
            { slug: 'ENUMERATES', name: 'enumerates' },
          ],
          relationships: graphRelationships,
        },
      };

      await regenerateJson(propGraphUuid, graphJson);
      graphUpdated = true;
    }

    return res.json({
      success: true,
      message: `Property "${trimName}" created and wired to "${targetName}".`,
      property: { name: trimName, uuid: propUuid, type: pType, targetUuid, targetName },
      graphUpdated,
    });

  } catch (error) {
    console.error('normalize/create-property error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/generate-property-tree
//   Body: { concept: "<name>" }
//   Reads the concept's JSON Schema, creates property events for all
//   properties (recursively for nested objects), wires IS_A_PROPERTY_OF,
//   and updates the property tree graph JSON.
//   Only works from scratch (no existing properties).
// ══════════════════════════════════════════════════════════════

async function handleGeneratePropertyTree(req, res) {
  try {
    const { concept } = req.body;
    if (!concept) return res.status(400).json({ success: false, error: 'Missing concept name' });

    // Find concept header, JSON Schema, and property tree graph
    const rows = await runCypher(`
      MATCH (h:NostrEvent)
      WHERE (h:ListHeader OR h:ClassThreadHeader) AND h.kind IN [9998, 39998]
        AND h.name = $concept
      OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
      OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
      OPTIONAL MATCH (pg:NostrEvent)-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(h)
      RETURN h.uuid AS headerUuid, h.name AS headerName,
             js.uuid AS schemaUuid, js.name AS schemaName,
             head(collect(jt.value)) AS schemaJson,
             pg.uuid AS propGraphUuid, pg.name AS propGraphName
      LIMIT 1
    `, { concept });

    if (rows.length === 0) return res.json({ success: false, error: `Concept "${concept}" not found` });
    const { schemaUuid, schemaName, schemaJson, propGraphUuid, propGraphName } = rows[0];
    if (!schemaUuid) return res.json({ success: false, error: `Concept "${concept}" has no JSON Schema node` });

    // Parse the schema
    let schema;
    try {
      schema = typeof schemaJson === 'string' ? JSON.parse(schemaJson) : schemaJson;
    } catch {
      return res.json({ success: false, error: 'Could not parse JSON Schema' });
    }
    if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
      return res.json({ success: false, error: 'JSON Schema has no properties defined' });
    }

    // Check for existing properties
    const existing = await runCypher(`
      MATCH (p:NostrEvent)-[:IS_A_PROPERTY_OF]->(js:NostrEvent {uuid: $schemaUuid})
      RETURN count(p) AS count
    `, { schemaUuid });
    if (existing[0]?.count > 0) {
      return res.json({ success: false, error: `Concept already has ${existing[0].count} properties. Property tree generation from scratch only — use create-property for incremental changes.` });
    }

    // Get BIOS property concept info
    const defaults = require('../../concept-graph/parameters/defaults.json');
    const biosPropertyUuid = defaults.conceptUUIDs.property;
    const biosSupersetRows = await runCypher(`
      MATCH (h:NostrEvent {uuid: $biosPropertyUuid})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
      RETURN sup.uuid AS supersetUuid
      LIMIT 1
    `, { biosPropertyUuid });
    const biosSupersetUuid = biosSupersetRows[0]?.supersetUuid;

    // Recursively create properties
    const created = [];
    const graphNodes = [{ slug: deriveSlug(schemaName), uuid: schemaUuid, name: schemaName }];
    const graphRelationships = [];
    const relTypeSlug = 'IS_A_PROPERTY_OF';

    async function createPropertiesRecursive(properties, requiredList, parentUuid, parentSlug) {
      for (const [propName, propDef] of Object.entries(properties)) {
        const pType = propDef.type || 'string';
        const pDesc = propDef.description || '';
        const isRequired = (requiredList || []).includes(propName);

        // Build property JSON
        const propertyJson = {
          property: {
            name: propName,
            type: pType,
            description: pDesc,
            required: isRequired,
          },
        };

        // Create the event
        const dTag = randomDTag();
        const tags = [
          ['d', dTag],
          ['name', propName],
          ['description', pDesc],
          ['type', pType],
          ['z', biosPropertyUuid],
          ['json', JSON.stringify(propertyJson)],
        ];

        const evt = signAndFinalize({ kind: 39999, tags, content: '' });
        const propUuid = `39999:${evt.pubkey}:${dTag}`;

        await publishToStrfry(evt);
        await importEventDirect(evt, propUuid);

        // Labels
        await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:ListItem:Property`, { uuid: propUuid });

        // Wire IS_A_PROPERTY_OF → parent
        await writeCypher(`
          MATCH (prop:NostrEvent {uuid: $propUuid}), (target:NostrEvent {uuid: $parentUuid})
          MERGE (prop)-[:IS_A_PROPERTY_OF]->(target)
        `, { propUuid, parentUuid });

        // Wire HAS_ELEMENT from BIOS property superset
        if (biosSupersetUuid) {
          await writeCypher(`
            MATCH (sup:NostrEvent {uuid: $supersetUuid}), (prop:NostrEvent {uuid: $propUuid})
            MERGE (sup)-[:HAS_ELEMENT]->(prop)
          `, { supersetUuid: biosSupersetUuid, propUuid });
        }

        created.push({ name: propName, uuid: propUuid, type: pType, parentUuid });

        // Add to graph
        const propSlug = deriveSlug(propName);
        graphNodes.push({ slug: propSlug, uuid: propUuid, name: propName });
        graphRelationships.push({
          nodeFrom: { slug: propSlug },
          relationshipType: { slug: relTypeSlug },
          nodeTo: { slug: parentSlug },
        });

        // Recurse for nested objects
        if (pType === 'object' && propDef.properties && Object.keys(propDef.properties).length > 0) {
          await createPropertiesRecursive(propDef.properties, propDef.required, propUuid, propSlug);
        }

        // Recurse for array items that are objects
        if (pType === 'array' && propDef.items?.type === 'object' && propDef.items.properties) {
          await createPropertiesRecursive(propDef.items.properties, propDef.items.required, propUuid, propSlug);
        }
      }
    }

    const schemaSlug = deriveSlug(schemaName);
    await createPropertiesRecursive(schema.properties, schema.required, schemaUuid, schemaSlug);

    // Update property tree graph JSON
    if (propGraphUuid) {
      // Look up the IS_A_PROPERTY_OF relationship type UUID if it exists
      const relTypeRows = await runCypher(`
        MATCH (rt:NostrEvent) WHERE rt.name = 'is a property of' OR rt.name = 'IS_A_PROPERTY_OF'
        RETURN rt.uuid AS uuid, rt.name AS name LIMIT 1
      `, {});

      const graphJson = {
        graph: {
          nodes: graphNodes,
          relationshipTypes: [
            {
              slug: relTypeSlug,
              name: 'is a property of',
              ...(relTypeRows[0]?.uuid ? { uuid: relTypeRows[0].uuid } : {}),
            },
            { slug: 'ENUMERATES', name: 'enumerates' },
          ],
          relationships: graphRelationships,
        },
      };

      await regenerateJson(propGraphUuid, graphJson);
    }

    return res.json({
      success: true,
      message: `Created ${created.length} properties for "${concept}".`,
      properties: created,
      graphUpdated: !!propGraphUuid,
    });

  } catch (error) {
    console.error('normalize/generate-property-tree error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

function registerNormalizeRoutes(app) {
  app.post('/api/normalize/skeleton', handleNormalizeSkeleton);
  app.post('/api/normalize/json', handleNormalizeJson);
  app.post('/api/normalize/create-concept', handleCreateConcept);
  app.post('/api/normalize/create-element', handleCreateElement);
  app.post('/api/normalize/save-schema', handleSaveSchema);
  app.post('/api/normalize/save-element-json', handleSaveElementJson);
  app.post('/api/normalize/create-property', handleCreateProperty);
  app.post('/api/normalize/generate-property-tree', handleGeneratePropertyTree);
}

module.exports = { registerNormalizeRoutes };
