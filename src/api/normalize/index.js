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
const { SecureKeyStorage } = require('../../utils/secureKeyStorage');
const { exec } = require('child_process');
const crypto = require('crypto');
const firmware = require('./firmware');

// ── Relationship type aliases from firmware ──────────────────
// Use REL.XXX instead of hardcoded strings. These resolve to the
// Neo4j alias (e.g., REL.CLASS_THREAD_INITIATION → REL.CLASS_THREAD_INITIATION).
const REL = {
  CLASS_THREAD_INITIATION:      firmware.relAlias('CLASS_THREAD_INITIATION'),
  CLASS_THREAD_PROPAGATION:     firmware.relAlias('CLASS_THREAD_PROPAGATION'),
  CLASS_THREAD_TERMINATION:     firmware.relAlias('CLASS_THREAD_TERMINATION'),
  CORE_NODE_JSON_SCHEMA:        firmware.relAlias('CORE_NODE_JSON_SCHEMA'),
  CORE_NODE_PRIMARY_PROPERTY:   firmware.relAlias('CORE_NODE_PRIMARY_PROPERTY'),
  CORE_NODE_PROPERTIES:         firmware.relAlias('CORE_NODE_PROPERTIES'),
  CORE_NODE_PROPERTY_TREE_GRAPH: firmware.relAlias('CORE_NODE_PROPERTY_TREE_GRAPH'),
  CORE_NODE_CORE_GRAPH:         firmware.relAlias('CORE_NODE_CORE_GRAPH'),
  CORE_NODE_CONCEPT_GRAPH:      firmware.relAlias('CORE_NODE_CONCEPT_GRAPH'),
  PROPERTY_MEMBERSHIP:          firmware.relAlias('PROPERTY_MEMBERSHIP'),
  PROPERTY_ENUMERATION:         firmware.relAlias('PROPERTY_ENUMERATION'),
};

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

function toCamelCase(name) {
  return name.trim().split(/\s+/).map((w, i) =>
    i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join('');
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

// ── TA private key cache (loaded once from secure storage) ────
let _cachedPrivkey = null;

async function loadTAKey() {
  try {
    const storage = new SecureKeyStorage({
      storagePath: '/var/lib/brainstorm/secure-keys'
    });
    const keys = await storage.getRelayKeys('tapestry-assistant');
    if (keys && keys.privkey) {
      _cachedPrivkey = Uint8Array.from(Buffer.from(keys.privkey, 'hex'));
      console.log(`[normalize] TA key loaded from secure storage (pubkey: ${keys.pubkey})`);
      return;
    }
  } catch (e) {
    console.warn(`[normalize] Secure storage unavailable: ${e.message}`);
  }

  // Fallback to brainstorm.conf for backward compatibility
  const hex = getConfigFromFile('BRAINSTORM_RELAY_PRIVKEY');
  if (hex) {
    _cachedPrivkey = Uint8Array.from(Buffer.from(hex, 'hex'));
    console.warn('[normalize] TA key loaded from brainstorm.conf (DEPRECATED — migrate to secure storage)');
    return;
  }

  throw new Error('Tapestry Assistant key not configured. Store it in secure storage or set BRAINSTORM_RELAY_PRIVKEY.');
}

function getPrivkey() {
  if (!_cachedPrivkey) throw new Error('TA key not loaded yet — call loadTAKey() at startup');
  return _cachedPrivkey;
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

// ── UUID lookups (via firmware) ───────────────────────────────
// Concept UUIDs are computed from firmware slug + TA pubkey via firmware.conceptUuid().
// Reverse lookup via firmware.conceptSlugFromUuid().

// Reverse lookup: z-tag UUID → role name
// Uses firmware.conceptSlugFromUuid() with a compatibility map for legacy role names
function roleFromZTag(zTagValue) {
  const slug = firmware.conceptSlugFromUuid(zTagValue);
  if (!slug) return null;
  // Map firmware slugs to legacy role names used in the codebase
  const slugToRole = {
    'superset': 'superset',
    'json-schema': 'schema',
    'graph': 'graph',
    'relationship': 'relationship',
    'set': 'set',
    'property': 'property',
    'primary-property': 'primaryProperty',
    'node-type': 'nodeType',
    'relationship-type': 'relationshipType',
    'list': 'list',
    'json-data-type': 'jsonDataType',
    'graph-type': 'graphType',
  };
  return slugToRole[slug] || slug;
}

// ── Node role definitions ────────────────────────────────────
const NODE_ROLES = ['superset', 'schema', 'primary-property', 'properties', 'core-graph', 'concept-graph', 'property-graph'];

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
      OPTIONAL MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
      OPTIONAL MATCH (js:JSONSchema)-[:${REL.CORE_NODE_JSON_SCHEMA}]->(h)
      OPTIONAL MATCH (cg)-[:${REL.CORE_NODE_CORE_GRAPH}]->(h)
      OPTIONAL MATCH (ctg)-[:${REL.CORE_NODE_CONCEPT_GRAPH}]->(h)
      OPTIONAL MATCH (ptg)-[:${REL.CORE_NODE_PROPERTY_TREE_GRAPH}]->(h)
      OPTIONAL MATCH (pp:Property)-[:${REL.CORE_NODE_PRIMARY_PROPERTY}]->(h)
      OPTIONAL MATCH (props)-[:${REL.CORE_NODE_PROPERTIES}]->(h)
      RETURN sup.uuid AS supersetUuid, js.uuid AS schemaUuid,
             cg.uuid AS coreGraphUuid, ctg.uuid AS conceptGraphUuid, ptg.uuid AS propGraphUuid,
             pp.uuid AS primaryPropUuid, pp.name AS primaryPropName,
             props.uuid AS propsUuid
    `, { uuid: headerUuid });

    const ex = existing[0] || {};
    const missing = [];
    if (!ex.supersetUuid && (!node || node === 'superset')) missing.push('superset');
    if (!ex.schemaUuid && (!node || node === 'schema')) missing.push('schema');
    if (!ex.primaryPropUuid && (!node || node === 'primary-property')) missing.push('primary-property');
    if (!ex.propsUuid && (!node || node === 'properties')) missing.push('properties');
    if (!ex.coreGraphUuid && (!node || node === 'core-graph')) missing.push('core-graph');
    if (!ex.conceptGraphUuid && (!node || node === 'concept-graph')) missing.push('concept-graph');
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
    let primaryPropATag = ex.primaryPropUuid;
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
          ['z', firmware.conceptUuid('relationship')],
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
          ['z', firmware.conceptUuid('superset')],
          ['description', `The superset node for the ${name} concept.`],
          ['json', supersetJson],
        ],
        content: '',
      });
      evt._uuid = `39999:${evt.pubkey}:${dTag}`;
      supersetATag = evt._uuid;

      // Superset gets Superset label
      await createNode('Superset', evt, REL.CLASS_THREAD_INITIATION, 'from-header');
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
      const ppKey = toKeyName(name);       // e.g. "coffeeHouse"
      const ppSlug = toSlugName(name);     // e.g. "coffee-house"
      const ppTitle = toTitleName(name);   // e.g. "Coffee House"
      const schemaJson = JSON.stringify({
        word: {
          slug: `json-schema-for-the-concept-of-${slug}`,
          name: schemaName,
          title: `JSON Schema for the Concept of ${name}`,
          description: `the json schema for the concept of ${name}`,
          wordTypes: ['word', 'jsonSchema'],
          coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slug}`, uuid: headerUuid }],
        },
        jsonSchema: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          type: 'object',
          name: name.toLowerCase(),
          title: ppTitle,
          description: `JSON Schema for the concept of ${plural.toLowerCase()}`,
          required: [ppKey],
          definitions: {},
          properties: {
            [ppKey]: {
              type: 'object',
              name: name.toLowerCase(),
              title: ppTitle,
              slug: ppSlug,
              description: `data about this ${name.toLowerCase()}`,
              required: ['name', 'slug', 'description'],
              unique: ['name', 'slug'],
              properties: {
                name: { type: 'string', name: 'name', slug: 'name', title: 'Name', description: `The name of the ${name.toLowerCase()}` },
                slug: { type: 'string', name: 'slug', slug: 'slug', title: 'Slug', description: `A unique kebab-case identifier for this ${name.toLowerCase()}` },
                description: { type: 'string', name: 'description', slug: 'description', title: 'Description', description: `A brief description of the ${name.toLowerCase()}` },
              },
            },
          },
        },
      });
      const evt = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', schemaName],
          ['z', firmware.conceptUuid('json-schema')],
          ['description', `The JSON Schema defining the horizontal structure of the ${name} concept.`],
          ['json', schemaJson],
        ],
        content: '',
      });
      evt._uuid = `39999:${evt.pubkey}:${dTag}`;
      schemaATag = evt._uuid;

      await createNode('JSON Schema', evt, REL.CORE_NODE_JSON_SCHEMA, 'to-header');
      await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:JSONSchema`, { uuid: schemaATag });
    }

    // ── Primary Property ──
    if (missing.includes('primary-property')) {
      const dTag = `${slug}-primary-property`;
      const ppKey = toCamelCase(name);
      const ppName = `primary property for the ${name} concept`;
      const ppJson = JSON.stringify({
        property: {
          name: ppName,
          key: ppKey,
          role: 'primaryProperty',
          conceptName: name,
          description: `Primary property for the ${name} concept. Elements of ${name} use "${ppKey}" as their top-level JSON key.`,
        },
      });
      const evt = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', ppName],
          ['z', firmware.conceptUuid('primary-property')],
          ['description', `Primary property for the ${name} concept. Elements of ${name} use "${ppKey}" as their top-level JSON key.`],
          ['json', ppJson],
        ],
        content: '',
      });
      evt._uuid = `39999:${evt.pubkey}:${dTag}`;
      primaryPropATag = evt._uuid;

      await createNode('Primary Property', evt, REL.CORE_NODE_PRIMARY_PROPERTY, 'to-header');
      await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:Property`, { uuid: primaryPropATag });

      // Also wire IS_A_PROPERTY_OF → schema if schema exists
      if (schemaATag) {
        const relDTag = randomDTag();
        const relEvent = signAndFinalize({
          kind: 39999, content: '',
          tags: [
            ['d', relDTag], ['name', `${name} ${REL.PROPERTY_MEMBERSHIP}`],
            ['z', firmware.conceptUuid('relationship')],
            ['nodeFrom', primaryPropATag], ['nodeTo', schemaATag], ['relationshipType', REL.PROPERTY_MEMBERSHIP],
          ],
        });
        const relUuid = `39999:${relEvent.pubkey}:${relDTag}`;
        await publishToStrfry(relEvent);
        await importEventDirect(relEvent, relUuid);
        allEvents.push(relEvent);
        await writeCypher(`
          MATCH (a:NostrEvent {uuid: $from}), (b:NostrEvent {uuid: $to})
          MERGE (a)-[:${REL.PROPERTY_MEMBERSHIP}]->(b)
        `, { from: primaryPropATag, to: schemaATag });
      }
    }

    // ── Properties (set) ──
    if (missing.includes('properties')) {
      const dTag = `${slug}-properties`;
      const propsName = `the set of properties for the ${name} concept`;
      const propsJson = JSON.stringify({
        word: {
          slug: `the-set-of-properties-for-the-concept-of-${slug}`,
          name: propsName,
          wordTypes: ['word', 'set', 'properties'],
          coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slug}`, uuid: headerUuid }],
        },
        set: {
          slug: `properties-for-the-concept-of-${slug}`,
          name: `properties for the concept of ${name}`,
        },
        properties: {},
      });
      const evt = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag], ['name', propsName],
          ['z', firmware.conceptUuid('set')],
          ['json', propsJson],
        ],
        content: '',
      });
      evt._uuid = `39999:${evt.pubkey}:${dTag}`;

      await createNode('Properties', evt, REL.CORE_NODE_PROPERTIES, 'to-header');
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
          ['z', firmware.conceptUuid('graph')],
          ['description', `Core infrastructure nodes for ${name}: header, superset, schema, and three canonical graphs.`],
        ],
        content: '',
      });
      evt._uuid = `39999:${evt.pubkey}:${dTag}`;
      coreGraphATag = evt._uuid;

      await createNode('Core Nodes Graph', evt, REL.CORE_NODE_CORE_GRAPH, 'to-header');
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
            ...(primaryPropATag ? [{ slug: `${slug}_primaryProperty`, uuid: primaryPropATag, name: `primary property for the ${name} concept` }] : []),
            { slug: `${slug}_coreNodesGraph`, uuid: coreGraphATag, name: graphName },
            ...(classGraphATag ? [{ slug: `${slug}_classThreadsGraph`, uuid: classGraphATag, name: `class threads graph for the ${name} concept` }] : []),
            ...(propGraphATag ? [{ slug: `${slug}_propertyTreeGraph`, uuid: propGraphATag, name: `property tree graph for the ${name} concept` }] : []),
          ],
          relationshipTypes: [
            { slug: REL.CLASS_THREAD_INITIATION, name: 'class thread initiation' },
            { slug: REL.CORE_NODE_JSON_SCHEMA, name: 'is the JSON schema for' },
            { slug: REL.CORE_NODE_PRIMARY_PROPERTY, name: 'is the primary property for' },
            { slug: REL.CORE_NODE_CORE_GRAPH, name: REL.CORE_NODE_CORE_GRAPH },
            { slug: 'IS_THE_CLASS_THREADS_GRAPH_FOR', name: 'IS_THE_CLASS_THREADS_GRAPH_FOR' },
            { slug: REL.CORE_NODE_PROPERTY_TREE_GRAPH, name: REL.CORE_NODE_PROPERTY_TREE_GRAPH },
          ],
          relationships: [
            { nodeFrom: { slug: `${slug}_header` }, relationshipType: { slug: REL.CLASS_THREAD_INITIATION }, nodeTo: { slug: `${slug}_superset` } },
            { nodeFrom: { slug: `${slug}_schema` }, relationshipType: { slug: REL.CORE_NODE_JSON_SCHEMA }, nodeTo: { slug: `${slug}_header` } },
            ...(primaryPropATag ? [{ nodeFrom: { slug: `${slug}_primaryProperty` }, relationshipType: { slug: REL.CORE_NODE_PRIMARY_PROPERTY }, nodeTo: { slug: `${slug}_header` } }] : []),
            { nodeFrom: { slug: `${slug}_coreNodesGraph` }, relationshipType: { slug: REL.CORE_NODE_CORE_GRAPH }, nodeTo: { slug: `${slug}_header` } },
            { nodeFrom: { slug: `${slug}_classThreadsGraph` }, relationshipType: { slug: 'IS_THE_CLASS_THREADS_GRAPH_FOR' }, nodeTo: { slug: `${slug}_header` } },
            { nodeFrom: { slug: `${slug}_propertyTreeGraph` }, relationshipType: { slug: REL.CORE_NODE_PROPERTY_TREE_GRAPH }, nodeTo: { slug: `${slug}_header` } },
          ],
        },
      });

      // Re-publish with JSON
      const evt2 = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', graphName],
          ['z', firmware.conceptUuid('graph')],
          ['description', `Core infrastructure nodes for ${name}: header, superset, schema, and three canonical graphs.`],
          ['json', graphJson],
        ],
        content: '',
      });
      await publishToStrfry(evt2);
      await importEventDirect(evt2, coreGraphATag);
    }

    // ── Concept Graph ──
    if (missing.includes('concept-graph')) {
      const dTag = `${slug}-concept-graph`;
      const graphName = `concept graph for the ${name} concept`;
      const graphJson = JSON.stringify({
        graph: {
          nodes: supersetATag ? [{ slug: `${slug}_superset`, uuid: supersetATag, name: `the superset of all ${plural}` }] : [],
          relationshipTypes: [
            { slug: REL.CLASS_THREAD_PROPAGATION, name: 'class thread propagation' },
            { slug: REL.CLASS_THREAD_TERMINATION, name: 'class thread termination' },
          ],
          relationships: [],
        },
      });
      const evt = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', graphName],
          ['z', firmware.conceptUuid('graph')],
          ['description', `Concept graph for ${name}: superset hierarchy and elements.`],
          ['json', graphJson],
        ],
        content: '',
      });
      evt._uuid = `39999:${evt.pubkey}:${dTag}`;
      classGraphATag = evt._uuid;

      await createNode('Concept Graph', evt, REL.CORE_NODE_CONCEPT_GRAPH, 'to-header');
    }

    // ── Property Tree Graph ──
    if (missing.includes('property-graph')) {
      const dTag = `${slug}-property-tree-graph`;
      const graphName = `property tree graph for the ${name} concept`;
      const ptNodes = [];
      if (schemaATag) ptNodes.push({ slug: `${slug}_schema`, uuid: schemaATag, name: `JSON schema for ${name}` });
      if (primaryPropATag) ptNodes.push({ slug: `${slug}_primaryProperty`, uuid: primaryPropATag, name: `primary property for the ${name} concept` });
      const ptRels = [];
      if (primaryPropATag && schemaATag) {
        ptRels.push({ nodeFrom: { slug: `${slug}_primaryProperty` }, relationshipType: { slug: REL.PROPERTY_MEMBERSHIP }, nodeTo: { slug: `${slug}_schema` } });
      }
      const graphJson = JSON.stringify({
        graph: {
          nodes: ptNodes,
          relationshipTypes: [
            { slug: REL.PROPERTY_MEMBERSHIP, name: 'is a property of' },
            { slug: REL.PROPERTY_ENUMERATION, name: 'enumerates' },
          ],
          relationships: ptRels,
        },
      });
      const evt = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', graphName],
          ['z', firmware.conceptUuid('graph')],
          ['description', `Property tree graph for ${name}: schema and properties.`],
          ['json', graphJson],
        ],
        content: '',
      });
      evt._uuid = `39999:${evt.pubkey}:${dTag}`;
      propGraphATag = evt._uuid;

      await createNode('Property Tree Graph', evt, REL.CORE_NODE_PROPERTY_TREE_GRAPH, 'to-header');
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

    const validNodes = ['header', 'superset', 'schema', 'primary-property', 'core-graph', 'class-graph', 'property-graph'];
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
      OPTIONAL MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
      OPTIONAL MATCH (js:JSONSchema)-[:${REL.CORE_NODE_JSON_SCHEMA}]->(h)
      OPTIONAL MATCH (cg)-[:${REL.CORE_NODE_CORE_GRAPH}]->(h)
      OPTIONAL MATCH (ctg)-[:IS_THE_CLASS_THREADS_GRAPH_FOR]->(h)
      OPTIONAL MATCH (ptg)-[:${REL.CORE_NODE_PROPERTY_TREE_GRAPH}]->(h)
      OPTIONAL MATCH (pp:Property)-[:${REL.CORE_NODE_PRIMARY_PROPERTY}]->(h)
      RETURN h.uuid AS headerUuid, h.name AS headerName, h.pubkey AS pubkey, h.kind AS kind,
             nt.value AS nameTag, nt.value1 AS plural, st.value AS slug, dt.value AS dTag,
             desc.value AS description,
             sup.uuid AS supersetUuid, sup.name AS supersetName,
             js.uuid AS schemaUuid, js.name AS schemaName,
             cg.uuid AS coreGraphUuid, cg.name AS coreGraphName,
             ctg.uuid AS classGraphUuid, ctg.name AS classGraphName,
             ptg.uuid AS propGraphUuid, ptg.name AS propGraphName,
             pp.uuid AS primaryPropUuid, pp.name AS primaryPropName
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
            ...(slug && { primaryProperty: toCamelCase(name) }),
            constituents: {
              ...(h.supersetUuid && { superset: h.supersetUuid }),
              ...(h.schemaUuid && { jsonSchema: h.schemaUuid }),
              ...(h.primaryPropUuid && { primaryProperty: h.primaryPropUuid }),
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
      const slugPlural = deriveSlug(plural);
      const titlePlural = plural.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      const supersetJson = {
        word: {
          slug: `superset-for-the-concept-of-${slugPlural}`,
          name: `superset for the concept of ${plural.toLowerCase()}`,
          title: `Superset for the Concept of ${titlePlural}`,
          wordTypes: ['word', 'set', 'superset'],
          coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: h.headerUuid }],
        },
        set: {
          slug: slugPlural,
          name: plural.toLowerCase(),
          title: titlePlural,
          description: `This is a set of ${plural.toLowerCase()}.`,
        },
        superset: {
          slug: slugPlural,
          name: plural.toLowerCase(),
          title: titlePlural,
          description: `This is the superset of all known ${plural.toLowerCase()}.`,
        },
      };
      await regenerateJson(h.supersetUuid, supersetJson);
      updated.push({ role: 'Superset', uuid: h.supersetUuid });
    }

    // ── JSON Schema JSON ──
    if ((!node || node === 'schema') && h.schemaUuid) {
      // Fetch existing json to preserve user-defined jsonSchema section
      const existingJsonRows = await runCypher(`
        MATCH (e:NostrEvent {uuid: $uuid})-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
        RETURN t.value AS json
      `, { uuid: h.schemaUuid });

      let wordWrapper;
      if (existingJsonRows.length > 0 && existingJsonRows[0].json) {
        try {
          const parsed = JSON.parse(existingJsonRows[0].json);
          if (parsed.word && parsed.jsonSchema !== undefined) {
            // Already in word-wrapper format — preserve jsonSchema section
            wordWrapper = parsed;
          } else {
            // Legacy flat schema — migrate into word wrapper
            wordWrapper = {
              word: {
                slug: `json-schema-for-the-concept-of-${slug}`,
                name: `JSON schema for the concept of ${name}`,
                title: `JSON Schema for the Concept of ${name}`,
                description: `the json schema for the concept of ${name}`,
                wordTypes: ['word', 'jsonSchema'],
                coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slug}`, uuid: h.headerUuid }],
              },
              jsonSchema: parsed,
            };
          }
        } catch (e) {
          wordWrapper = null;
        }
      }
      if (!wordWrapper) {
        wordWrapper = {
          word: {
            slug: `json-schema-for-the-concept-of-${slug}`,
            name: `JSON schema for the concept of ${name}`,
            title: `JSON Schema for the Concept of ${name}`,
            description: `the json schema for the concept of ${name}`,
            wordTypes: ['word', 'jsonSchema'],
            coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slug}`, uuid: h.headerUuid }],
          },
          jsonSchema: {},
        };
      }
      // Ensure word section is up to date
      wordWrapper.word.slug = wordWrapper.word.slug || `json-schema-for-the-concept-of-${slug}`;
      wordWrapper.word.name = wordWrapper.word.name || `JSON schema for the concept of ${name}`;
      wordWrapper.word.wordTypes = wordWrapper.word.wordTypes || ['word', 'jsonSchema'];
      await regenerateJson(h.schemaUuid, wordWrapper);
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
            ...(h.primaryPropUuid ? [{ slug: `${slug}_primaryProperty`, uuid: h.primaryPropUuid, name: h.primaryPropName }] : []),
            { slug: `${slug}_coreNodesGraph`, uuid: h.coreGraphUuid, name: h.coreGraphName },
            ...(h.classGraphUuid ? [{ slug: `${slug}_classThreadsGraph`, uuid: h.classGraphUuid, name: h.classGraphName }] : []),
            ...(h.propGraphUuid ? [{ slug: `${slug}_propertyTreeGraph`, uuid: h.propGraphUuid, name: h.propGraphName }] : []),
          ],
          relationshipTypes: [
            { slug: REL.CLASS_THREAD_INITIATION, name: 'class thread initiation' },
            { slug: REL.CORE_NODE_JSON_SCHEMA, name: 'is the JSON schema for' },
            { slug: REL.CORE_NODE_PRIMARY_PROPERTY, name: 'is the primary property for' },
            { slug: REL.CORE_NODE_CORE_GRAPH, name: REL.CORE_NODE_CORE_GRAPH },
            { slug: 'IS_THE_CLASS_THREADS_GRAPH_FOR', name: 'IS_THE_CLASS_THREADS_GRAPH_FOR' },
            { slug: REL.CORE_NODE_PROPERTY_TREE_GRAPH, name: REL.CORE_NODE_PROPERTY_TREE_GRAPH },
          ],
          relationships: [
            { nodeFrom: { slug: `${slug}_header` }, relationshipType: { slug: REL.CLASS_THREAD_INITIATION }, nodeTo: { slug: `${slug}_superset` } },
            { nodeFrom: { slug: `${slug}_schema` }, relationshipType: { slug: REL.CORE_NODE_JSON_SCHEMA }, nodeTo: { slug: `${slug}_header` } },
            ...(h.primaryPropUuid ? [{ nodeFrom: { slug: `${slug}_primaryProperty` }, relationshipType: { slug: REL.CORE_NODE_PRIMARY_PROPERTY }, nodeTo: { slug: `${slug}_header` } }] : []),
            { nodeFrom: { slug: `${slug}_coreNodesGraph` }, relationshipType: { slug: REL.CORE_NODE_CORE_GRAPH }, nodeTo: { slug: `${slug}_header` } },
            { nodeFrom: { slug: `${slug}_classThreadsGraph` }, relationshipType: { slug: 'IS_THE_CLASS_THREADS_GRAPH_FOR' }, nodeTo: { slug: `${slug}_header` } },
            { nodeFrom: { slug: `${slug}_propertyTreeGraph` }, relationshipType: { slug: REL.CORE_NODE_PROPERTY_TREE_GRAPH }, nodeTo: { slug: `${slug}_header` } },
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
        MATCH (h:NostrEvent {uuid: $headerUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
        OPTIONAL MATCH (sup)-[:${REL.CLASS_THREAD_PROPAGATION}*0..10]->(s)
        WHERE s:Superset OR s:NostrEvent
        RETURN DISTINCT s.uuid AS uuid, s.name AS name
      `, { headerUuid: h.headerUuid });

      const graphJson = {
        graph: {
          nodes: setRows.filter(r => r.uuid).map(r => ({ uuid: r.uuid, name: r.name })),
          relationshipTypes: [
            { slug: REL.CLASS_THREAD_PROPAGATION, name: 'class thread propagation' },
            { slug: REL.CLASS_THREAD_TERMINATION, name: 'class thread termination' },
          ],
          relationships: [],
        },
      };
      await regenerateJson(h.classGraphUuid, graphJson);
      updated.push({ role: 'Class Threads Graph', uuid: h.classGraphUuid });
    }

    // ── Property Tree Graph JSON ──
    if ((!node || node === 'property-graph') && h.propGraphUuid) {
      const ptNodes = [];
      if (h.schemaUuid) ptNodes.push({ slug: `${slug}_schema`, uuid: h.schemaUuid, name: h.schemaName });
      if (h.primaryPropUuid) ptNodes.push({ slug: `${slug}_primaryProperty`, uuid: h.primaryPropUuid, name: h.primaryPropName });
      const ptRels = [];
      if (h.primaryPropUuid && h.schemaUuid) {
        ptRels.push({ nodeFrom: { slug: `${slug}_primaryProperty` }, relationshipType: { slug: REL.PROPERTY_MEMBERSHIP }, nodeTo: { slug: `${slug}_schema` } });
      }
      const graphJson = {
        graph: {
          nodes: ptNodes,
          relationshipTypes: [
            { slug: REL.PROPERTY_MEMBERSHIP, name: 'is a property of' },
            { slug: REL.PROPERTY_ENUMERATION, name: 'enumerates' },
          ],
          relationships: ptRels,
        },
      };
      await regenerateJson(h.propGraphUuid, graphJson);
      updated.push({ role: 'Property Tree Graph', uuid: h.propGraphUuid });
    }

    // ── Primary Property JSON ──
    if ((!node || node === 'primary-property') && h.primaryPropUuid) {
      const ppKey = toCamelCase(name);
      const ppJson = {
        property: {
          name: h.primaryPropName,
          key: ppKey,
          role: 'primaryProperty',
          conceptName: name,
          description: `Primary property for the ${name} concept. Elements of ${name} use "${ppKey}" as their top-level JSON key.`,
        },
      };
      await regenerateJson(h.primaryPropUuid, ppJson);
      updated.push({ role: 'Primary Property', uuid: h.primaryPropUuid });
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
//   Creates a full concept skeleton matching tapestry-cli concept-header.md spec:
//   ConceptHeader + Superset + JSON Schema + Primary Property + Properties (set)
//   + Property Tree Graph + Concept Graph + Core Nodes Graph + 7 relationship events.
//
//   Word JSON follows the new naming convention structure with oNames, oSlugs,
//   oKeys, oTitles, oLabels — kept in sync with tapestry-cli/src/lib/concept.js.
// ══════════════════════════════════════════════════════════════

function toSlugName(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function toKeyName(name) {
  const words = name.split(/\s+/);
  return words.map((w, i) => {
    const lower = w.toLowerCase();
    if (i === 0) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join('');
}

function toTitleName(name) {
  return name.split(/\s+/).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(' ');
}

function toLabelName(name) {
  return name.split(/\s+/).map(w =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join('');
}

function deriveAllNames(singular, plural) {
  return {
    oNames:  { singular: singular.toLowerCase(), plural: plural.toLowerCase() },
    oSlugs:  { singular: toSlugName(singular), plural: toSlugName(plural) },
    oKeys:   { singular: toKeyName(singular), plural: toKeyName(plural) },
    oTitles: { singular: toTitleName(singular), plural: toTitleName(plural) },
    oLabels: { singular: toLabelName(singular), plural: toLabelName(plural) },
  };
}

async function handleCreateConcept(req, res) {
  try {
    const { name, plural, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Concept name is required' });
    }

    const trimName = name.trim();
    const trimPlural = (plural || '').trim() || trimName + 's';
    const names = deriveAllNames(trimName, trimPlural);
    const slug = names.oSlugs.singular;
    const slugPlural = names.oSlugs.plural;

    // Check for duplicate
    const privBytes = getPrivkey();
    const pubkey = Buffer.from(nt().getPublicKey(privBytes)).toString('hex');

    const dupes = await runCypher(`
      MATCH (h:NostrEvent)
      WHERE (h:ListHeader OR h:ConceptHeader) AND h.kind IN [9998, 39998]
        AND h.name = $name AND h.pubkey = $pubkey
      RETURN h.uuid AS uuid
      LIMIT 1
    `, { name: trimName, pubkey });

    if (dupes.length > 0) {
      return res.json({ success: false, error: `Concept "${trimName}" already exists (uuid: ${dupes[0].uuid})` });
    }

    const allEvents = [];
    const headerDTag = req.body.dTag || randomDTag();

    // ── 1. Concept Header / ListHeader (kind 39998) ──
    const headerWord = {
      word: {
        slug: `concept-header-for-the-concept-of-${slugPlural}`,
        name: `concept header for the concept of ${names.oNames.plural}`,
        title: `Concept Header for the Concept of ${names.oTitles.plural}`,
        wordTypes: ['word', 'conceptHeader'],
      },
      conceptHeader: {
        description: description || `${names.oTitles.singular} is a concept.`,
        oNames: names.oNames,
        oSlugs: names.oSlugs,
        oKeys: names.oKeys,
        oTitles: names.oTitles,
        oLabels: names.oLabels,
      },
    };

    const headerTags = [
      ['d', headerDTag],
      ['names', names.oNames.singular, names.oNames.plural],
      ['slug', slug],
      ['json', JSON.stringify(headerWord)],
    ];
    if (description) headerTags.push(['description', description.trim()]);

    const headerEvent = signAndFinalize({ kind: 39998, tags: headerTags, content: '' });
    const headerUuid = `39998:${headerEvent.pubkey}:${headerDTag}`;
    await publishToStrfry(headerEvent);
    await importEventDirect(headerEvent, headerUuid);
    allEvents.push(headerEvent);

    // Set ListHeader + ConceptHeader labels
    await writeCypher(`
      MATCH (h:NostrEvent {uuid: $uuid})
      SET h:ListHeader, h:ConceptHeader
    `, { uuid: headerUuid });

    // ── 2. Superset ──
    const supersetDTag = `${slug}-superset`;
    const supersetWord = {
      word: {
        slug: `superset-for-the-concept-of-${slugPlural}`,
        name: `superset for the concept of ${names.oNames.plural}`,
        title: `Superset for the Concept of ${names.oTitles.plural}`,
        wordTypes: ['word', 'set', 'superset'],
        coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid }],
      },
      set: {
        slug: names.oSlugs.plural,
        name: names.oNames.plural,
        title: names.oTitles.plural,
        description: `This is a set of ${names.oNames.plural}.`,
      },
      superset: {
        slug: names.oSlugs.plural,
        name: names.oNames.plural,
        title: names.oTitles.plural,
        description: `This is the superset of all known ${names.oNames.plural}.`,
      },
    };

    const supersetEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', supersetDTag],
        ['name', supersetWord.word.name],
        ['z', firmware.conceptUuid('superset')],
        ['z', firmware.conceptUuid('set')],
        ['z', firmware.conceptUuid('word')],
        ['description', supersetWord.superset.description],
        ['json', JSON.stringify(supersetWord)],
      ],
    });
    const supersetUuid = `39999:${supersetEvent.pubkey}:${supersetDTag}`;
    await publishToStrfry(supersetEvent);
    await importEventDirect(supersetEvent, supersetUuid);
    await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:Superset`, { uuid: supersetUuid });
    allEvents.push(supersetEvent);

    // ── 3. JSON Schema ──
    const schemaDTag = `${slug}-schema`;
    const ppKey = names.oKeys.singular;       // e.g. "coffeeHouse"
    const ppSlug = names.oSlugs.singular;     // e.g. "coffee-house"
    const schemaWord = {
      word: {
        slug: `json-schema-for-the-concept-of-${slugPlural}`,
        name: `JSON schema for the concept of ${names.oNames.plural}`,
        title: `JSON Schema for the Concept of ${names.oTitles.plural}`,
        description: `the json schema for the concept of ${names.oNames.plural}`,
        wordTypes: ['word', 'jsonSchema'],
        coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid }],
      },
      jsonSchema: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        name: names.oNames.singular,
        title: names.oTitles.singular,
        description: `JSON Schema for the concept of ${names.oNames.plural}`,
        required: [ppKey],
        definitions: {},
        properties: {
          [ppKey]: {
            type: 'object',
            name: names.oNames.singular,
            title: names.oTitles.singular,
            slug: ppSlug,
            description: `data about this ${names.oNames.singular}`,
            required: ['name', 'slug', 'description'],
            unique: ['name', 'slug'],
            properties: {
              name: {
                type: 'string', name: 'name', slug: 'name',
                title: 'Name', description: `The name of the ${names.oNames.singular}`,
              },
              slug: {
                type: 'string', name: 'slug', slug: 'slug',
                title: 'Slug', description: `A unique kebab-case identifier for this ${names.oNames.singular}`,
              },
              description: {
                type: 'string', name: 'description', slug: 'description',
                title: 'Description', description: `A brief description of the ${names.oNames.singular}`,
              },
            },
          },
        },
      },
    };

    const schemaEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', schemaDTag],
        ['name', schemaWord.word.name],
        ['z', firmware.conceptUuid('json-schema')],
        ['z', firmware.conceptUuid('word')],
        ['description', schemaWord.word.description],
        ['json', JSON.stringify(schemaWord)],
      ],
    });
    const schemaUuid = `39999:${schemaEvent.pubkey}:${schemaDTag}`;
    await publishToStrfry(schemaEvent);
    await importEventDirect(schemaEvent, schemaUuid);
    await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:JSONSchema`, { uuid: schemaUuid });
    allEvents.push(schemaEvent);

    // ── 4. Primary Property ──
    const ppDTag = `${slug}-primary-property`;
    const ppWord = {
      word: {
        slug: `primary-property-for-the-concept-of-${slugPlural}`,
        name: `primary property for the concept of ${names.oNames.plural}`,
        description: `the primary property for the concept of ${names.oNames.plural}`,
        wordTypes: ['word', 'property', 'primaryProperty'],
        coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid }],
      },
      property: {
        key: names.oKeys.singular,
        title: names.oTitles.singular,
        type: 'object',
        required: ['name', 'slug', 'description'],
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
        },
      },
      primaryProperty: {
        description: `the primary property for the concept of ${names.oNames.plural}`,
      },
    };

    const ppEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', ppDTag], ['name', ppWord.word.name],
        ['z', firmware.conceptUuid('primary-property')],
        ['z', firmware.conceptUuid('property')],
        ['z', firmware.conceptUuid('word')],
        ['description', ppWord.word.description],
        ['json', JSON.stringify(ppWord)],
      ],
    });
    const ppUuid = `39999:${ppEvent.pubkey}:${ppDTag}`;
    await publishToStrfry(ppEvent);
    await importEventDirect(ppEvent, ppUuid);
    await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:Property`, { uuid: ppUuid });
    allEvents.push(ppEvent);

    // ── 5. Properties (set) ──
    const propsDTag = `${slug}-properties`;
    const propsWord = {
      word: {
        slug: `the-set-of-properties-for-the-concept-of-${slugPlural}`,
        name: `the set of properties for the concept of ${names.oNames.plural}`,
        title: `The Set of Properties for the Concept of ${names.oTitles.plural}`,
        wordTypes: ['word', 'set', 'properties'],
        coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid }],
      },
      set: {
        slug: `properties-for-the-concept-of-${slugPlural}`,
        name: `properties for the concept of ${names.oNames.plural}`,
      },
      properties: {
        description: `the set of all properties for the concept of ${names.oNames.plural}`,
      },
    };

    const propsEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', propsDTag], ['name', propsWord.word.name],
        ['z', firmware.conceptUuid('properties')],
        ['z', firmware.conceptUuid('set')],
        ['z', firmware.conceptUuid('word')],
        ['json', JSON.stringify(propsWord)],
      ],
    });
    const propsUuid = `39999:${propsEvent.pubkey}:${propsDTag}`;
    await publishToStrfry(propsEvent);
    await importEventDirect(propsEvent, propsUuid);
    allEvents.push(propsEvent);

    // ── 6. Property Tree Graph ──
    const ptDTag = `${slug}-property-tree-graph`;
    const ptWord = {
      word: {
        slug: `property-tree-graph-for-the-concept-of-${slugPlural}`,
        name: `property tree graph for the concept of ${names.oNames.plural}`,
        title: `Property Tree Graph for the Concept of ${names.oTitles.plural}`,
        wordTypes: ['word', 'graph', 'propertyTreeGraph'],
        coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid }],
      },
      graph: {
        nodes: [
          { slug: `json-schema-for-the-concept-of-${slugPlural}`, uuid: schemaUuid },
          { slug: `primary-property-for-the-concept-of-${slugPlural}`, uuid: ppUuid },
          { slug: `the-set-of-properties-for-the-concept-of-${slugPlural}`, uuid: propsUuid },
        ],
        relationshipTypes: [{ slug: REL.PROPERTY_MEMBERSHIP }],
        relationships: [{
          nodeFrom: { slug: `primary-property-for-the-concept-of-${slugPlural}` },
          relationshipType: { slug: REL.PROPERTY_MEMBERSHIP },
          nodeTo: { slug: `json-schema-for-the-concept-of-${slugPlural}` },
        }],
        imports: [],
      },
      propertyTreeGraph: {
        description: `the collection of the JSON schema node, all property nodes and all of their connections for the concept of ${names.oNames.plural}`,
      },
    };

    const ptEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', ptDTag], ['name', ptWord.word.name],
        ['z', firmware.conceptUuid('property-tree-graph')],
        ['z', firmware.conceptUuid('graph')],
        ['z', firmware.conceptUuid('word')],
        ['description', ptWord.propertyTreeGraph.description],
        ['json', JSON.stringify(ptWord)],
      ],
    });
    const ptUuid = `39999:${ptEvent.pubkey}:${ptDTag}`;
    await publishToStrfry(ptEvent);
    await importEventDirect(ptEvent, ptUuid);
    allEvents.push(ptEvent);

    // ── 7. Concept Graph ──
    const cgDTag = `${slug}-concept-graph`;
    const cgWord = {
      word: {
        slug: `concept-graph-for-the-concept-of-${slugPlural}`,
        name: `concept graph for the concept of ${names.oNames.plural}`,
        title: `Concept Graph for the Concept of ${names.oTitles.plural}`,
        wordTypes: ['word', 'graph', 'conceptGraph'],
        coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid }],
      },
      graph: {
        nodes: [
          { slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid },
          { slug: `superset-for-the-concept-of-${slugPlural}`, uuid: supersetUuid },
        ],
        relationshipTypes: [
          { slug: REL.CLASS_THREAD_INITIATION, uuid: '' },
          { slug: REL.CLASS_THREAD_PROPAGATION, uuid: '' },
          { slug: REL.CLASS_THREAD_TERMINATION, uuid: '' },
        ],
        relationships: [{
          nodeFrom: { slug: `concept-header-for-the-concept-of-${slugPlural}` },
          relationshipType: { slug: REL.CLASS_THREAD_INITIATION },
          nodeTo: { slug: `superset-for-the-concept-of-${slugPlural}` },
        }],
        imports: [
          { slug: `property-tree-graph-for-the-concept-of-${slugPlural}`, uuid: ptUuid },
        ],
      },
      conceptGraph: {
        description: `The collection of all nodes and edges traversed by the class threads of the concept of ${names.oNames.plural}`,
        cypher: `MATCH classPath = (conceptHeader)-[:${REL.CLASS_THREAD_INITIATION}]->(superset:Superset)-[:${REL.CLASS_THREAD_PROPAGATION} *0..5]->()-[:${REL.CLASS_THREAD_TERMINATION}]->() WHERE conceptHeader.uuid = '${headerUuid}' RETURN classPath`,
      },
    };

    const cgEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', cgDTag], ['name', cgWord.word.name],
        ['z', firmware.conceptUuid('concept-graph')],
        ['z', firmware.conceptUuid('graph')],
        ['z', firmware.conceptUuid('word')],
        ['description', cgWord.conceptGraph.description],
        ['json', JSON.stringify(cgWord)],
      ],
    });
    const cgUuid = `39999:${cgEvent.pubkey}:${cgDTag}`;
    await publishToStrfry(cgEvent);
    await importEventDirect(cgEvent, cgUuid);
    allEvents.push(cgEvent);

    // ── 8. Core Nodes Graph ──
    const coreDTag = `${slug}-core-nodes-graph`;
    const coreWord = {
      word: {
        slug: `core-nodes-graph-for-the-concept-of-${slugPlural}`,
        name: `core nodes graph for the concept of ${names.oNames.plural}`,
        title: `Core Nodes Graph for the Concept of ${names.oTitles.plural}`,
        wordTypes: ['word', 'graph', 'coreNodesGraph'],
        coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid }],
      },
      graph: {
        nodes: [
          { slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid },
          { slug: `superset-for-the-concept-of-${slugPlural}`, uuid: supersetUuid },
          { slug: `json-schema-for-the-concept-of-${slugPlural}`, uuid: schemaUuid },
          { slug: `primary-property-for-the-concept-of-${slugPlural}`, uuid: ppUuid },
          { slug: `the-set-of-properties-for-the-concept-of-${slugPlural}`, uuid: propsUuid },
          { slug: `property-tree-graph-for-the-concept-of-${slugPlural}`, uuid: ptUuid },
          { slug: `concept-graph-for-the-concept-of-${slugPlural}`, uuid: cgUuid },
        ],
        relationshipTypes: [
          { slug: REL.CLASS_THREAD_INITIATION },
          { slug: REL.CORE_NODE_JSON_SCHEMA },
          { slug: REL.CORE_NODE_PRIMARY_PROPERTY },
          { slug: REL.CORE_NODE_PROPERTY_TREE_GRAPH },
          { slug: REL.CORE_NODE_CORE_GRAPH },
          { slug: REL.CORE_NODE_CONCEPT_GRAPH },
        ],
        relationships: [
          { nodeFrom: { slug: `concept-header-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CLASS_THREAD_INITIATION }, nodeTo: { slug: `superset-for-the-concept-of-${slugPlural}` } },
          { nodeFrom: { slug: `json-schema-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CORE_NODE_JSON_SCHEMA }, nodeTo: { slug: `concept-header-for-the-concept-of-${slugPlural}` } },
          { nodeFrom: { slug: `primary-property-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CORE_NODE_PRIMARY_PROPERTY }, nodeTo: { slug: `concept-header-for-the-concept-of-${slugPlural}` } },
          { nodeFrom: { slug: `property-tree-graph-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CORE_NODE_PROPERTY_TREE_GRAPH }, nodeTo: { slug: `concept-header-for-the-concept-of-${slugPlural}` } },
          { nodeFrom: { slug: `core-nodes-graph-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CORE_NODE_CORE_GRAPH }, nodeTo: { slug: `concept-header-for-the-concept-of-${slugPlural}` } },
          { nodeFrom: { slug: `concept-graph-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CORE_NODE_CONCEPT_GRAPH }, nodeTo: { slug: `concept-header-for-the-concept-of-${slugPlural}` } },
        ],
        imports: [],
      },
      coreNodesGraph: {
        description: `the set of core nodes for the concept of ${names.oNames.plural}`,
        constituents: {
          conceptHeader: headerUuid,
          superset: supersetUuid,
          jsonSchema: schemaUuid,
          primaryProperty: ppUuid,
          properties: propsUuid,
          propertyTreeGraph: ptUuid,
          conceptGraph: cgUuid,
          coreNodesGraph: '',
        },
      },
    };

    const coreEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', coreDTag], ['name', coreWord.word.name],
        ['z', firmware.conceptUuid('core-nodes-graph')],
        ['z', firmware.conceptUuid('graph')],
        ['z', firmware.conceptUuid('word')],
        ['description', coreWord.coreNodesGraph.description],
        ['json', JSON.stringify(coreWord)],
      ],
    });
    const coreUuid = `39999:${coreEvent.pubkey}:${coreDTag}`;
    await publishToStrfry(coreEvent);
    await importEventDirect(coreEvent, coreUuid);
    allEvents.push(coreEvent);

    // ── 9. Update Core Nodes Graph & Concept Graph with final UUIDs ──
    // Core Nodes Graph: add self-reference
    coreWord.graph.nodes.push(
      { slug: `core-nodes-graph-for-the-concept-of-${slugPlural}`, uuid: coreUuid }
    );
    coreWord.coreNodesGraph.constituents.coreNodesGraph = coreUuid;

    const coreEventV2 = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', coreDTag], ['name', coreWord.word.name],
        ['z', firmware.conceptUuid('core-nodes-graph')],
        ['z', firmware.conceptUuid('graph')],
        ['z', firmware.conceptUuid('word')],
        ['description', coreWord.coreNodesGraph.description],
        ['json', JSON.stringify(coreWord)],
      ],
    });
    await publishToStrfry(coreEventV2);
    await importEventDirect(coreEventV2, coreUuid);

    // Concept Graph: add core nodes graph import
    cgWord.graph.imports.push(
      { slug: `core-nodes-graph-for-the-concept-of-${slugPlural}`, uuid: coreUuid }
    );

    const cgEventV2 = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', cgDTag], ['name', cgWord.word.name],
        ['z', firmware.conceptUuid('concept-graph')],
        ['z', firmware.conceptUuid('graph')],
        ['z', firmware.conceptUuid('word')],
        ['description', cgWord.conceptGraph.description],
        ['json', JSON.stringify(cgWord)],
      ],
    });
    await publishToStrfry(cgEventV2);
    await importEventDirect(cgEventV2, cgUuid);

    // ── 10. Wiring relationships ──
    const relDefs = [
      { from: headerUuid, to: supersetUuid, type: REL.CLASS_THREAD_INITIATION },
      { from: schemaUuid, to: headerUuid, type: REL.CORE_NODE_JSON_SCHEMA },
      { from: ppUuid, to: headerUuid, type: REL.CORE_NODE_PRIMARY_PROPERTY },
      { from: ppUuid, to: schemaUuid, type: REL.PROPERTY_MEMBERSHIP },
      { from: propsUuid, to: headerUuid, type: REL.CORE_NODE_PROPERTIES },
      { from: coreUuid, to: headerUuid, type: REL.CORE_NODE_CORE_GRAPH },
      { from: cgUuid, to: headerUuid, type: REL.CORE_NODE_CONCEPT_GRAPH },
      { from: ptUuid, to: headerUuid, type: REL.CORE_NODE_PROPERTY_TREE_GRAPH },
    ];

    for (const rel of relDefs) {
      // Relationships between core nodes are unwrapped — Neo4j edges only, no nostr events.
      // See glossary: "wrapped data" for rationale.
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
        primaryPropertyKey: names.oKeys.singular,
        uuid: headerUuid,
        superset: supersetUuid,
        schema: schemaUuid,
        primaryProperty: ppUuid,
        properties: propsUuid,
        propertyTreeGraph: ptUuid,
        conceptGraph: cgUuid,
        coreGraph: coreUuid,
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
      OPTIONAL MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
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
      MATCH (sup:Superset {uuid: $supersetUuid})-[:${REL.CLASS_THREAD_PROPAGATION}*0..5]->(s)-[:${REL.CLASS_THREAD_TERMINATION}]->(e:NostrEvent)
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
        OPTIONAL MATCH (js:JSONSchema)-[:${REL.CORE_NODE_JSON_SCHEMA}]->(h)
        OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
        RETURN head(collect(jt.value)) AS schemaJson
      `, { headerUuid });

      let schema = null;
      const raw = schemaRows[0]?.schemaJson;
      if (raw) {
        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          // Word-wrapper format: { word: {...}, jsonSchema: {...} }
          schema = (parsed && parsed.jsonSchema) ? parsed.jsonSchema : parsed;
        } catch {}
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
      MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(elem)
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

    // Find the concept's JSON Schema node + existing json
    const rows = await runCypher(`
      MATCH (h:NostrEvent)
      WHERE (h:ListHeader OR h:ClassThreadHeader OR h:ConceptHeader) AND h.kind IN [9998, 39998]
        AND h.name = $concept
      OPTIONAL MATCH (js:JSONSchema)-[:${REL.CORE_NODE_JSON_SCHEMA}]->(h)
      OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
      OPTIONAL MATCH (h)-[:HAS_TAG]->(st:NostrEventTag {type: 'slug'})
      RETURN h.uuid AS headerUuid, js.uuid AS schemaUuid,
             head(collect(jt.value)) AS existingJson, st.value AS slug
      LIMIT 1
    `, { concept });

    if (rows.length === 0) {
      return res.json({ success: false, error: `Concept "${concept}" not found` });
    }

    const { schemaUuid, headerUuid, slug: conceptSlug } = rows[0];
    if (!schemaUuid) {
      return res.json({ success: false, error: `Concept "${concept}" has no JSON Schema node. Create one first via normalize skeleton.` });
    }

    // Ensure minimum schema fields
    const finalSchema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      ...schema,
    };

    // Read existing word wrapper or build one
    let wordWrapper;
    const raw = rows[0].existingJson;
    if (raw) {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed.word && parsed.jsonSchema !== undefined) {
          wordWrapper = parsed;
        }
      } catch {}
    }
    const cSlug = conceptSlug || deriveSlug(concept);
    if (!wordWrapper) {
      wordWrapper = {
        word: {
          slug: `json-schema-for-the-concept-of-${cSlug}`,
          name: `JSON schema for the concept of ${concept}`,
          title: `JSON Schema for the Concept of ${concept}`,
          description: `the json schema for the concept of ${concept}`,
          wordTypes: ['word', 'jsonSchema'],
          coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${cSlug}`, uuid: headerUuid }],
        },
        jsonSchema: {},
      };
    }
    wordWrapper.jsonSchema = finalSchema;

    await regenerateJson(schemaUuid, wordWrapper);

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
        OPTIONAL MATCH (js:JSONSchema)-[:${REL.CORE_NODE_JSON_SCHEMA}]->(h)
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
      MATCH (p:NostrEvent)-[:${REL.PROPERTY_MEMBERSHIP}]->(target:NostrEvent {uuid: $targetUuid})
      WHERE p.name = $name
      RETURN p.uuid AS uuid
      LIMIT 1
    `, { targetUuid, name: trimName });
    if (dupes.length > 0) {
      return res.json({ success: false, error: `Property "${trimName}" already exists on "${targetName}" (uuid: ${dupes[0].uuid})` });
    }

    // Get property concept header UUID for z-tag
    const biosPropertyUuid = firmware.conceptUuid('property');

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
      MERGE (prop)-[:${REL.PROPERTY_MEMBERSHIP}]->(target)
    `, { propUuid, targetUuid });

    // Wire HAS_ELEMENT from BIOS property superset
    const biosSupersetRows = await runCypher(`
      MATCH (h:NostrEvent {uuid: $biosPropertyUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
      RETURN sup.uuid AS supersetUuid
      LIMIT 1
    `, { biosPropertyUuid });
    if (biosSupersetRows.length > 0) {
      await writeCypher(`
        MATCH (sup:NostrEvent {uuid: $supersetUuid}), (prop:NostrEvent {uuid: $propUuid})
        MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(prop)
      `, { supersetUuid: biosSupersetRows[0].supersetUuid, propUuid });
    }

    // Update the property tree graph for this concept
    // Walk up IS_A_PROPERTY_OF chain to find the JSONSchema, then the concept header
    const graphRows = await runCypher(`
      MATCH (prop:NostrEvent {uuid: $propUuid})-[:${REL.PROPERTY_MEMBERSHIP} *1..]->(js:JSONSchema)
      MATCH (js)-[:${REL.CORE_NODE_JSON_SCHEMA}]->(h:NostrEvent)
      OPTIONAL MATCH (pg:NostrEvent)-[:${REL.CORE_NODE_PROPERTY_TREE_GRAPH}]->(h)
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
        MATCH (p:Property)-[:${REL.PROPERTY_MEMBERSHIP} *1..]->(js)
        MATCH (p)-[:${REL.PROPERTY_MEMBERSHIP}]->(directParent)
        RETURN p.uuid AS uuid, p.name AS name, directParent.uuid AS parentUuid
      `, { jsUuid });

      const graphNodes = [{ slug: deriveSlug(jsName), uuid: jsUuid, name: jsName }];
      const graphRelationships = [];

      for (const row of allProps) {
        graphNodes.push({ slug: deriveSlug(row.name), uuid: row.uuid, name: row.name });
        graphRelationships.push({
          nodeFrom: { slug: deriveSlug(row.name) },
          relationshipType: { slug: REL.PROPERTY_MEMBERSHIP },
          nodeTo: { slug: row.parentUuid === jsUuid ? deriveSlug(jsName) : deriveSlug(allProps.find(p => p.uuid === row.parentUuid)?.name || '') },
        });
      }

      // Look up IS_A_PROPERTY_OF relationship type UUID
      const relTypeRows = await runCypher(`
        MATCH (rt:NostrEvent) WHERE rt.name = 'is a property of' OR rt.name = REL.PROPERTY_MEMBERSHIP
        RETURN rt.uuid AS uuid LIMIT 1
      `, {});

      const graphJson = {
        graph: {
          nodes: graphNodes,
          relationshipTypes: [
            { slug: REL.PROPERTY_MEMBERSHIP, name: 'is a property of', ...(relTypeRows[0]?.uuid ? { uuid: relTypeRows[0].uuid } : {}) },
            { slug: REL.PROPERTY_ENUMERATION, name: 'enumerates' },
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
      OPTIONAL MATCH (js:JSONSchema)-[:${REL.CORE_NODE_JSON_SCHEMA}]->(h)
      OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
      OPTIONAL MATCH (pg:NostrEvent)-[:${REL.CORE_NODE_PROPERTY_TREE_GRAPH}]->(h)
      RETURN h.uuid AS headerUuid, h.name AS headerName,
             js.uuid AS schemaUuid, js.name AS schemaName,
             head(collect(jt.value)) AS schemaJson,
             pg.uuid AS propGraphUuid, pg.name AS propGraphName
      LIMIT 1
    `, { concept });

    if (rows.length === 0) return res.json({ success: false, error: `Concept "${concept}" not found` });
    const { schemaUuid, schemaName, schemaJson, propGraphUuid, propGraphName } = rows[0];
    if (!schemaUuid) return res.json({ success: false, error: `Concept "${concept}" has no JSON Schema node` });

    // Parse the schema (supports word-wrapper and legacy flat formats)
    let schema;
    try {
      const parsed = typeof schemaJson === 'string' ? JSON.parse(schemaJson) : schemaJson;
      // Word-wrapper format: { word: {...}, jsonSchema: {...} }
      schema = (parsed && parsed.jsonSchema) ? parsed.jsonSchema : parsed;
    } catch {
      return res.json({ success: false, error: 'Could not parse JSON Schema' });
    }
    if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
      return res.json({ success: false, error: 'JSON Schema has no properties defined' });
    }

    // Check for existing properties
    const existing = await runCypher(`
      MATCH (p:NostrEvent)-[:${REL.PROPERTY_MEMBERSHIP}]->(js:NostrEvent {uuid: $schemaUuid})
      RETURN count(p) AS count
    `, { schemaUuid });
    if (existing[0]?.count > 0) {
      return res.json({ success: false, error: `Concept already has ${existing[0].count} properties. Property tree generation from scratch only — use create-property for incremental changes.` });
    }

    // Get property concept info
    const biosPropertyUuid = firmware.conceptUuid('property');
    const biosSupersetRows = await runCypher(`
      MATCH (h:NostrEvent {uuid: $biosPropertyUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
      RETURN sup.uuid AS supersetUuid
      LIMIT 1
    `, { biosPropertyUuid });
    const biosSupersetUuid = biosSupersetRows[0]?.supersetUuid;

    // Recursively create properties
    const created = [];
    const graphNodes = [{ slug: deriveSlug(schemaName), uuid: schemaUuid, name: schemaName }];
    const graphRelationships = [];
    const relTypeSlug = REL.PROPERTY_MEMBERSHIP;

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
          MERGE (prop)-[:${REL.PROPERTY_MEMBERSHIP}]->(target)
        `, { propUuid, parentUuid });

        // Wire HAS_ELEMENT from BIOS property superset
        if (biosSupersetUuid) {
          await writeCypher(`
            MATCH (sup:NostrEvent {uuid: $supersetUuid}), (prop:NostrEvent {uuid: $propUuid})
            MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(prop)
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
        MATCH (rt:NostrEvent) WHERE rt.name = 'is a property of' OR rt.name = REL.PROPERTY_MEMBERSHIP
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
            { slug: REL.PROPERTY_ENUMERATION, name: 'enumerates' },
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

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/add-node-as-element
//   Body: { conceptUuid: "<header uuid>", nodeUuid: "<node uuid>" }
//   Actions:
//     1. Create HAS_ELEMENT from concept's Superset → target node
//     2. Update the class threads graph JSON to include the new node
// ══════════════════════════════════════════════════════════════
async function handleAddNodeAsElement(req, res) {
  try {
    const { conceptUuid, nodeUuid } = req.body || {};
    if (!conceptUuid) return res.status(400).json({ success: false, error: 'Missing conceptUuid' });
    if (!nodeUuid) return res.status(400).json({ success: false, error: 'Missing nodeUuid' });

    // Look up concept header, superset, and class threads graph
    const rows = await runCypher(`
      MATCH (h:NostrEvent {uuid: $conceptUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
      OPTIONAL MATCH (ctg)-[:IS_THE_CLASS_THREADS_GRAPH_FOR]->(h)
      RETURN h.name AS conceptName, h.uuid AS headerUuid,
             sup.uuid AS supersetUuid, sup.name AS supersetName,
             ctg.uuid AS classGraphUuid
    `, { conceptUuid });

    if (!rows.length) return res.status(404).json({ success: false, error: 'Concept not found or missing superset' });
    const { conceptName, supersetUuid, supersetName, classGraphUuid } = rows[0];

    // Look up the target node
    const nodeRows = await runCypher(`
      MATCH (n:NostrEvent {uuid: $nodeUuid})
      RETURN n.name AS name, n.uuid AS uuid, labels(n) AS labels
    `, { nodeUuid });
    if (!nodeRows.length) return res.status(404).json({ success: false, error: 'Target node not found' });
    const targetNode = nodeRows[0];

    // Check if HAS_ELEMENT already exists
    const existingRel = await runCypher(`
      MATCH (sup:NostrEvent {uuid: $supersetUuid})-[:${REL.CLASS_THREAD_TERMINATION}]->(n:NostrEvent {uuid: $nodeUuid})
      RETURN count(*) AS cnt
    `, { supersetUuid, nodeUuid });
    if (existingRel[0]?.cnt > 0) {
      return res.status(409).json({ success: false, error: `${targetNode.name} is already an element of ${conceptName}` });
    }

    // 1. Create HAS_ELEMENT relationship
    await writeCypher(`
      MATCH (sup:NostrEvent {uuid: $supersetUuid}), (node:NostrEvent {uuid: $nodeUuid})
      MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(node)
    `, { supersetUuid, nodeUuid });

    // 2. Update class threads graph JSON
    if (classGraphUuid) {
      const slug = deriveSlug(conceptName);

      // Fetch current sets in the class thread
      const setRows = await runCypher(`
        MATCH (h:NostrEvent {uuid: $conceptUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
        OPTIONAL MATCH (sup)-[:${REL.CLASS_THREAD_PROPAGATION}*0..10]->(s)
        WHERE s:Superset OR s:NostrEvent
        RETURN DISTINCT s.uuid AS uuid, s.name AS name
      `, { conceptUuid });

      const graphJson = {
        graph: {
          nodes: setRows.filter(r => r.uuid).map(r => ({ uuid: r.uuid, name: r.name })),
          relationshipTypes: [
            { slug: REL.CLASS_THREAD_PROPAGATION, name: 'class thread propagation' },
            { slug: REL.CLASS_THREAD_TERMINATION, name: 'class thread termination' },
          ],
          relationships: [],
        },
      };
      await regenerateJson(classGraphUuid, graphJson);
    }

    return res.json({
      success: true,
      message: `Added "${targetNode.name}" as element of "${conceptName}"`,
      element: { name: targetNode.name, uuid: nodeUuid },
      concept: { name: conceptName, uuid: conceptUuid, supersetUuid },
      classGraphUpdated: !!classGraphUuid,
    });
  } catch (error) {
    console.error('normalize/add-node-as-element error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// POST /api/normalize/migrate-primary-property-ztags
// Re-signs primary property events with z-tag pointing to the "primary property" concept
async function handleMigratePrimaryPropertyZTags(req, res) {
  try {
    const newZTag = firmware.conceptUuid('primary-property');
    if (!newZTag) {
      return res.status(500).json({ success: false, error: 'primaryProperty concept UUID not available — check firmware configuration' });
    }

    // Find all primary property nodes
    const ppNodes = await runCypher(`
      MATCH (n:Property)-[:${REL.CORE_NODE_PRIMARY_PROPERTY}]->(h:ListHeader)
      MATCH (n)-[:HAS_TAG]->(z:NostrEventTag {type: 'z'})
      WHERE z.value <> $newZTag
      RETURN n.uuid AS uuid, n.name AS name, z.value AS oldZTag
    `, { newZTag });

    if (ppNodes.length === 0) {
      return res.json({ success: true, message: 'All primary property nodes already have correct z-tags.', migrated: [] });
    }

    const migrated = [];
    for (const pp of ppNodes) {
      // Read existing tags
      const tagRows = await runCypher(`
        MATCH (e:NostrEvent {uuid: $uuid})-[:HAS_TAG]->(t:NostrEventTag)
        RETURN t.type AS type, t.value AS value, t.value1 AS value1, t.value2 AS value2
        ORDER BY t.uuid
      `, { uuid: pp.uuid });

      // Rebuild tags with corrected z-tag
      const tags = tagRows.map(t => {
        const tag = [t.type];
        if (t.type === 'z') {
          tag.push(newZTag);
        } else {
          tag.push(t.value);
        }
        if (t.value1) tag.push(t.value1);
        if (t.value2) tag.push(t.value2);
        return tag;
      });

      const kind = pp.uuid.startsWith('39998:') ? 39998 : 39999;
      const evt = signAndFinalize({ kind, tags, content: '' });
      await publishToStrfry(evt);
      await importEventDirect(evt, pp.uuid);
      migrated.push({ uuid: pp.uuid, name: pp.name, oldZTag: pp.oldZTag });
    }

    return res.json({
      success: true,
      message: `Migrated ${migrated.length} primary property node(s) to new z-tag.`,
      newZTag,
      migrated,
    });
  } catch (error) {
    console.error('normalize/migrate-primary-property-ztags error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/link-concepts
//   Body: { parent: "<concept name>", child: "<concept name>" }
//   Creates IS_A_SUPERSET_OF between parent's Superset → child's Superset.
// ══════════════════════════════════════════════════════════════
async function handleLinkConcepts(req, res) {
  try {
    const { parent, child } = req.body || {};
    if (!parent) return res.status(400).json({ success: false, error: 'Missing parent concept name' });
    if (!child) return res.status(400).json({ success: false, error: 'Missing child concept name' });

    // Find parent superset
    const parentRows = await runCypher(`
      MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
      WHERE toLower(t.value) = toLower($name)
      MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(s:Superset)
      OPTIONAL MATCH (s)-[:HAS_TAG]->(n:NostrEventTag {type: 'name'})
      RETURN s.uuid AS supersetUuid, n.value AS supersetName, t.value AS concept
      LIMIT 1
    `, { name: parent });
    if (!parentRows.length) return res.json({ success: false, error: `Concept "${parent}" not found or has no Superset` });

    // Find child superset
    const childRows = await runCypher(`
      MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
      WHERE toLower(t.value) = toLower($name)
      MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(s:Superset)
      OPTIONAL MATCH (s)-[:HAS_TAG]->(n:NostrEventTag {type: 'name'})
      RETURN s.uuid AS supersetUuid, n.value AS supersetName, t.value AS concept
      LIMIT 1
    `, { name: child });
    if (!childRows.length) return res.json({ success: false, error: `Concept "${child}" not found or has no Superset` });

    const p = parentRows[0], c = childRows[0];

    // Check if already linked
    const existing = await runCypher(`
      MATCH (a:NostrEvent {uuid: $from})-[:${REL.CLASS_THREAD_PROPAGATION}]->(b:NostrEvent {uuid: $to})
      RETURN count(*) AS cnt
    `, { from: p.supersetUuid, to: c.supersetUuid });
    if (existing[0]?.cnt > 0) {
      return res.json({ success: false, error: `"${p.concept}" is already a superset of "${c.concept}"` });
    }

    // Create relationship event
    const relEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', randomDTag()],
        ['name', `${p.supersetName} ${REL.CLASS_THREAD_PROPAGATION} ${c.supersetName}`],
        ['z', firmware.conceptUuid('relationship')],
        ['nodeFrom', p.supersetUuid],
        ['nodeTo', c.supersetUuid],
        ['relationshipType', REL.CLASS_THREAD_PROPAGATION],
      ],
    });
    await publishToStrfry(relEvent);
    await importEventDirect(relEvent, `39999:${relEvent.pubkey}:${relEvent.tags.find(t=>t[0]==='d')[1]}`);

    // Wire in Neo4j
    await writeCypher(`
      MATCH (a:NostrEvent {uuid: $from}), (b:NostrEvent {uuid: $to})
      MERGE (a)-[:${REL.CLASS_THREAD_PROPAGATION}]->(b)
    `, { from: p.supersetUuid, to: c.supersetUuid });

    return res.json({
      success: true,
      message: `Linked: "${p.concept}" is a superset of "${c.concept}"`,
      parent: { concept: p.concept, supersetUuid: p.supersetUuid },
      child: { concept: c.concept, supersetUuid: c.supersetUuid },
    });
  } catch (error) {
    console.error('normalize/link-concepts error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/enumerate
//   Body: { enumeratingConcept, property, targetConcept, propertyType?, createProperty? }
//   Creates ENUMERATES relationship + optionally creates Property + IS_A_PROPERTY_OF.
// ══════════════════════════════════════════════════════════════
async function handleEnumerate(req, res) {
  try {
    const { enumeratingConcept, property: propName, targetConcept, propertyType, createProperty } = req.body || {};
    if (!enumeratingConcept) return res.status(400).json({ success: false, error: 'Missing enumeratingConcept' });
    if (!propName) return res.status(400).json({ success: false, error: 'Missing property name' });
    if (!targetConcept) return res.status(400).json({ success: false, error: 'Missing targetConcept' });

    const pType = propertyType || 'string';

    // Find enumerating concept's superset
    const enumRows = await runCypher(`
      MATCH (h)-[:HAS_TAG]->(t:NostrEventTag)
      WHERE (t.type = 'names' OR t.type = 'name') AND toLower(t.value) = toLower($name)
      AND (h:ListHeader OR h:ListItem)
      MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(s:Superset)
      OPTIONAL MATCH (s)-[:HAS_TAG]->(n:NostrEventTag {type: 'name'})
      RETURN s.uuid AS supersetUuid, n.value AS supersetName, t.value AS concept
      LIMIT 1
    `, { name: enumeratingConcept });
    if (!enumRows.length) return res.json({ success: false, error: `Concept "${enumeratingConcept}" not found or has no Superset` });
    const enumer = enumRows[0];

    // Find or create property
    let propRows = await runCypher(`
      MATCH (p:Property)-[:HAS_TAG]->(n:NostrEventTag {type: 'name'})
      WHERE toLower(n.value) = toLower($name)
      RETURN p.uuid AS uuid, n.value AS name
      LIMIT 1
    `, { name: propName });

    let propUuid, propDisplayName;
    if (propRows.length > 0) {
      propUuid = propRows[0].uuid;
      propDisplayName = propRows[0].name;
    } else if (createProperty) {
      const dTag = randomDTag();
      const propEvent = signAndFinalize({
        kind: 39999, content: '',
        tags: [
          ['d', dTag], ['name', propName], ['type', pType],
          ['z', firmware.conceptUuid('property')],
        ],
      });
      propUuid = `39999:${propEvent.pubkey}:${dTag}`;
      propDisplayName = propName;
      await publishToStrfry(propEvent);
      await importEventDirect(propEvent, propUuid);
      await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:Property`, { uuid: propUuid });
    } else {
      return res.json({ success: false, error: `Property "${propName}" not found. Set createProperty: true to create it.` });
    }

    // Check if ENUMERATES already exists
    const existingEnum = await runCypher(`
      MATCH (s:NostrEvent {uuid: $from})-[:${REL.PROPERTY_ENUMERATION}]->(p:NostrEvent {uuid: $to})
      RETURN count(*) AS cnt
    `, { from: enumer.supersetUuid, to: propUuid });
    if (existingEnum[0]?.cnt > 0) {
      return res.json({ success: false, error: `ENUMERATES relationship already exists` });
    }

    // Create ENUMERATES relationship event
    const enumEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', randomDTag()],
        ['name', `${enumer.supersetName} ${REL.PROPERTY_ENUMERATION} ${propDisplayName}`],
        ['z', firmware.conceptUuid('relationship')],
        ['nodeFrom', enumer.supersetUuid],
        ['nodeTo', propUuid],
        ['relationshipType', REL.PROPERTY_ENUMERATION],
      ],
    });
    await publishToStrfry(enumEvent);
    await importEventDirect(enumEvent, `39999:${enumEvent.pubkey}:${enumEvent.tags.find(t=>t[0]==='d')[1]}`);
    await writeCypher(`
      MATCH (a:NostrEvent {uuid: $from}), (b:NostrEvent {uuid: $to})
      MERGE (a)-[:${REL.PROPERTY_ENUMERATION}]->(b)
    `, { from: enumer.supersetUuid, to: propUuid });

    // Wire IS_A_PROPERTY_OF to target concept's schema if not already wired
    let schemaWired = false;
    const schemaRows = await runCypher(`
      MATCH (h)-[:HAS_TAG]->(t:NostrEventTag)
      WHERE (t.type = 'names' OR t.type = 'name') AND toLower(t.value) = toLower($name)
      MATCH (js:JSONSchema)-[:${REL.CORE_NODE_JSON_SCHEMA}]->(h)
      RETURN js.uuid AS schemaUuid, js.name AS schemaName
      LIMIT 1
    `, { name: targetConcept });

    if (schemaRows.length > 0) {
      const existingProp = await runCypher(`
        MATCH (p:NostrEvent {uuid: $from})-[:${REL.PROPERTY_MEMBERSHIP}]->(s:NostrEvent {uuid: $to})
        RETURN count(*) AS cnt
      `, { from: propUuid, to: schemaRows[0].schemaUuid });
      if (existingProp[0]?.cnt === 0) {
        const propOfEvent = signAndFinalize({
          kind: 39999, content: '',
          tags: [
            ['d', randomDTag()],
            ['name', `${propDisplayName} ${REL.PROPERTY_MEMBERSHIP} ${schemaRows[0].schemaName}`],
            ['z', firmware.conceptUuid('relationship')],
            ['nodeFrom', propUuid],
            ['nodeTo', schemaRows[0].schemaUuid],
            ['relationshipType', REL.PROPERTY_MEMBERSHIP],
          ],
        });
        await publishToStrfry(propOfEvent);
        await importEventDirect(propOfEvent, `39999:${propOfEvent.pubkey}:${propOfEvent.tags.find(t=>t[0]==='d')[1]}`);
        await writeCypher(`
          MATCH (a:NostrEvent {uuid: $from}), (b:NostrEvent {uuid: $to})
          MERGE (a)-[:${REL.PROPERTY_MEMBERSHIP}]->(b)
        `, { from: propUuid, to: schemaRows[0].schemaUuid });
        schemaWired = true;
      }
    }

    return res.json({
      success: true,
      message: `${enumer.concept} ${REL.PROPERTY_ENUMERATION} ${propDisplayName}`,
      enumerating: { concept: enumer.concept, supersetUuid: enumer.supersetUuid },
      property: { name: propDisplayName, uuid: propUuid },
      schemaWired,
    });
  } catch (error) {
    console.error('normalize/enumerate error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/set-slug
//   Body: { concept: "<name>", slug: "<slug-value>" }
//   Updates the slug tag on a concept's header event.
// ══════════════════════════════════════════════════════════════
async function handleSetSlug(req, res) {
  try {
    const { concept, slug } = req.body || {};
    if (!concept) return res.status(400).json({ success: false, error: 'Missing concept name' });
    if (!slug) return res.status(400).json({ success: false, error: 'Missing slug value' });

    // Find the concept header
    const rows = await runCypher(`
      MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
      WHERE toLower(t.value) = toLower($name)
      RETURN h.uuid AS uuid, t.value AS name
      LIMIT 1
    `, { name: concept });
    if (!rows.length) return res.json({ success: false, error: `Concept "${concept}" not found` });

    const headerUuid = rows[0].uuid;

    // Check uniqueness
    const dupes = await runCypher(`
      MATCH (h:ListHeader)-[:HAS_TAG]->(s:NostrEventTag {type: 'slug'})
      WHERE s.value = $slug AND h.uuid <> $uuid
      RETURN h.uuid AS uuid LIMIT 1
    `, { slug, uuid: headerUuid });
    if (dupes.length > 0) return res.json({ success: false, error: `Slug "${slug}" is already used by another concept` });

    // Get existing tags and rebuild with slug
    const tagRows = await runCypher(`
      MATCH (e:NostrEvent {uuid: $uuid})-[:HAS_TAG]->(t:NostrEventTag)
      RETURN t.type AS type, t.value AS value, t.value1 AS value1, t.value2 AS value2
      ORDER BY t.uuid
    `, { uuid: headerUuid });

    let hasSlug = false;
    const tags = [];
    for (const t of tagRows) {
      const tag = [t.type, t.value];
      if (t.value1) tag.push(t.value1);
      if (t.value2) tag.push(t.value2);
      if (t.type === 'slug') {
        tags.push(['slug', slug]);
        hasSlug = true;
      } else {
        tags.push(tag);
      }
    }
    if (!hasSlug) tags.push(['slug', slug]);

    const evt = signAndFinalize({ kind: 39998, tags, content: '' });
    await publishToStrfry(evt);
    await importEventDirect(evt, headerUuid);

    return res.json({
      success: true,
      message: `Slug "${slug}" set for concept "${rows[0].name}"`,
      uuid: headerUuid,
      slug,
    });
  } catch (error) {
    console.error('normalize/set-slug error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/create-set
//   Body: { name, parent: "<concept name>" }
//   Creates a Set node + IS_A_SUPERSET_OF from parent's Superset.
// ══════════════════════════════════════════════════════════════
async function handleCreateSet(req, res) {
  try {
    const { name, parent } = req.body || {};
    if (!name) return res.status(400).json({ success: false, error: 'Missing set name' });
    if (!parent) return res.status(400).json({ success: false, error: 'Missing parent concept name' });

    // Find parent superset
    const parentRows = await runCypher(`
      MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
      WHERE toLower(t.value) = toLower($name)
      MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(s:Superset)
      OPTIONAL MATCH (s)-[:HAS_TAG]->(n:NostrEventTag {type: 'name'})
      RETURN s.uuid AS supersetUuid, n.value AS supersetName, t.value AS concept
      LIMIT 1
    `, { name: parent });
    if (!parentRows.length) return res.json({ success: false, error: `Concept "${parent}" not found or has no Superset` });
    const p = parentRows[0];

    // Create Set event
    const dTag = randomDTag();
    const setEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [['d', dTag], ['name', name], ['z', firmware.conceptUuid('set') || '']],
    });
    const setUuid = `39999:${setEvent.pubkey}:${dTag}`;
    await publishToStrfry(setEvent);
    await importEventDirect(setEvent, setUuid);
    await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:Set`, { uuid: setUuid });

    // Create IS_A_SUPERSET_OF relationship
    const relEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', randomDTag()],
        ['name', `${p.supersetName} ${REL.CLASS_THREAD_PROPAGATION} ${name}`],
        ['z', firmware.conceptUuid('relationship')],
        ['nodeFrom', p.supersetUuid],
        ['nodeTo', setUuid],
        ['relationshipType', REL.CLASS_THREAD_PROPAGATION],
      ],
    });
    await publishToStrfry(relEvent);
    await importEventDirect(relEvent, `39999:${relEvent.pubkey}:${relEvent.tags.find(t=>t[0]==='d')[1]}`);
    await writeCypher(`
      MATCH (a:NostrEvent {uuid: $from}), (b:NostrEvent {uuid: $to})
      MERGE (a)-[:${REL.CLASS_THREAD_PROPAGATION}]->(b)
    `, { from: p.supersetUuid, to: setUuid });

    return res.json({
      success: true,
      message: `Set "${name}" created under "${p.concept}"`,
      set: { name, uuid: setUuid },
      parent: { concept: p.concept, supersetUuid: p.supersetUuid },
    });
  } catch (error) {
    console.error('normalize/create-set error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/add-to-set
//   Body: { setName, itemName }
//   Creates HAS_ELEMENT from Set → item.
// ══════════════════════════════════════════════════════════════
async function handleAddToSet(req, res) {
  try {
    const { setName, itemName } = req.body || {};
    if (!setName) return res.status(400).json({ success: false, error: 'Missing setName' });
    if (!itemName) return res.status(400).json({ success: false, error: 'Missing itemName' });

    // Find the Set
    const setRows = await runCypher(`
      MATCH (s:Set)-[:HAS_TAG]->(n:NostrEventTag {type: 'name'})
      WHERE toLower(n.value) = toLower($name)
      RETURN s.uuid AS uuid, n.value AS name LIMIT 1
    `, { name: setName });
    if (!setRows.length) return res.json({ success: false, error: `Set "${setName}" not found` });

    // Find the item (try ListHeader then ListItem)
    let itemRows = await runCypher(`
      MATCH (h:ListHeader)-[:HAS_TAG]->(n:NostrEventTag {type: 'names'})
      WHERE toLower(n.value) = toLower($name)
      RETURN h.uuid AS uuid, n.value AS name LIMIT 1
    `, { name: itemName });
    if (!itemRows.length) {
      itemRows = await runCypher(`
        MATCH (i:ListItem)-[:HAS_TAG]->(n:NostrEventTag {type: 'name'})
        WHERE toLower(n.value) = toLower($name)
        RETURN i.uuid AS uuid, n.value AS name LIMIT 1
      `, { name: itemName });
    }
    if (!itemRows.length) return res.json({ success: false, error: `Item "${itemName}" not found` });

    const s = setRows[0], item = itemRows[0];

    // Check existing
    const existing = await runCypher(`
      MATCH (s:NostrEvent {uuid: $from})-[:${REL.CLASS_THREAD_TERMINATION}]->(i:NostrEvent {uuid: $to})
      RETURN count(*) AS cnt
    `, { from: s.uuid, to: item.uuid });
    if (existing[0]?.cnt > 0) return res.json({ success: false, error: `"${item.name}" is already in set "${s.name}"` });

    // Create HAS_ELEMENT event
    const relEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', randomDTag()],
        ['name', `${s.name} ${REL.CLASS_THREAD_TERMINATION} ${item.name}`],
        ['z', firmware.conceptUuid('relationship')],
        ['nodeFrom', s.uuid],
        ['nodeTo', item.uuid],
        ['relationshipType', REL.CLASS_THREAD_TERMINATION],
      ],
    });
    await publishToStrfry(relEvent);
    await importEventDirect(relEvent, `39999:${relEvent.pubkey}:${relEvent.tags.find(t=>t[0]==='d')[1]}`);
    await writeCypher(`
      MATCH (a:NostrEvent {uuid: $from}), (b:NostrEvent {uuid: $to})
      MERGE (a)-[:${REL.CLASS_THREAD_TERMINATION}]->(b)
    `, { from: s.uuid, to: item.uuid });

    return res.json({
      success: true,
      message: `Added "${item.name}" to set "${s.name}"`,
      set: { name: s.name, uuid: s.uuid },
      item: { name: item.name, uuid: item.uuid },
    });
  } catch (error) {
    console.error('normalize/add-to-set error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/fork-node
//   Body: { name, editTags?, addTags?, removeTags? }
//   Forks a node: copies with new d-tag, swaps relationships, creates provenance link.
// ══════════════════════════════════════════════════════════════
async function handleForkNode(req, res) {
  try {
    const { name, editTags, addTags, removeTags } = req.body || {};
    if (!name) return res.status(400).json({ success: false, error: 'Missing node name' });

    // Find the node
    let nodeRows = await runCypher(`
      MATCH (n:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
      WHERE toLower(t.value) = toLower($name)
      RETURN n.uuid AS uuid, t.value AS name, n.kind AS kind, n.pubkey AS pubkey LIMIT 1
    `, { name });
    if (!nodeRows.length) {
      nodeRows = await runCypher(`
        MATCH (n:ListItem)-[:HAS_TAG]->(t:NostrEventTag {type: 'name'})
        WHERE toLower(t.value) = toLower($name)
        RETURN n.uuid AS uuid, t.value AS name, n.kind AS kind, n.pubkey AS pubkey LIMIT 1
      `, { name });
    }
    if (!nodeRows.length) return res.json({ success: false, error: `Node "${name}" not found` });
    const node = nodeRows[0];

    // Get all tags from the original
    const tagRows = await runCypher(`
      MATCH (e:NostrEvent {uuid: $uuid})-[:HAS_TAG]->(t:NostrEventTag)
      RETURN t.type AS type, t.value AS value, t.value1 AS value1, t.value2 AS value2
      ORDER BY t.uuid
    `, { uuid: node.uuid });

    const newDTag = randomDTag();
    let newTags = tagRows.map(t => {
      const tag = [t.type, t.value];
      if (t.value1) tag.push(t.value1);
      if (t.value2) tag.push(t.value2);
      return tag;
    });

    // Replace d-tag
    const dIdx = newTags.findIndex(t => t[0] === 'd');
    if (dIdx >= 0) newTags[dIdx] = ['d', newDTag];
    else newTags.unshift(['d', newDTag]);

    // Apply edits
    if (editTags) {
      for (const [key, val] of Object.entries(editTags)) {
        const idx = newTags.findIndex(t => t[0] === key);
        if (idx >= 0) newTags[idx][1] = val;
        else newTags.push([key, val]);
      }
    }
    if (addTags) {
      for (const [key, val] of Object.entries(addTags)) {
        newTags.push([key, val]);
      }
    }
    if (removeTags && Array.isArray(removeTags)) {
      newTags = newTags.filter(t => !removeTags.includes(t[0]));
    }

    // Create forked event
    const forkedEvent = signAndFinalize({ kind: node.kind || 39999, tags: newTags, content: '' });
    const forkedUuid = `${forkedEvent.kind}:${forkedEvent.pubkey}:${newDTag}`;
    await publishToStrfry(forkedEvent);
    await importEventDirect(forkedEvent, forkedUuid);

    // Find relationships to swap (exclude AUTHORS, PROVIDED_THE_TEMPLATE_FOR, HAS_TAG)
    const rels = await runCypher(`
      MATCH (r:Relationship)-[:HAS_TAG]->(nf:NostrEventTag {type: 'nodeFrom'}),
            (r)-[:HAS_TAG]->(nt:NostrEventTag {type: 'nodeTo'}),
            (r)-[:HAS_TAG]->(rt:NostrEventTag {type: 'relationshipType'})
      WHERE nf.value = $uuid OR nt.value = $uuid
      RETURN DISTINCT r.uuid AS uuid, nf.value AS nodeFrom, nt.value AS nodeTo, rt.value AS relType
    `, { uuid: node.uuid });

    const excluded = ['AUTHORS', 'PROVIDED_THE_TEMPLATE_FOR', 'HAS_TAG'];
    const swappable = rels.filter(r => !excluded.includes(r.relType));
    const swapped = [];

    for (const r of swappable) {
      const newFrom = r.nodeFrom === node.uuid ? forkedUuid : r.nodeFrom;
      const newTo = r.nodeTo === node.uuid ? forkedUuid : r.nodeTo;

      const relEvent = signAndFinalize({
        kind: 39999, content: '',
        tags: [
          ['d', randomDTag()],
          ['name', `${newFrom} ${r.relType} ${newTo}`],
          ['z', firmware.conceptUuid('relationship')],
          ['nodeFrom', newFrom], ['nodeTo', newTo],
          ['relationshipType', r.relType],
        ],
      });
      await publishToStrfry(relEvent);
      await importEventDirect(relEvent, `39999:${relEvent.pubkey}:${relEvent.tags.find(t=>t[0]==='d')[1]}`);
      await writeCypher(`
        MATCH (a:NostrEvent {uuid: $from}), (b:NostrEvent {uuid: $to})
        MERGE (a)-[:${r.relType}]->(b)
      `, { from: newFrom, to: newTo });
      swapped.push({ relType: r.relType, from: newFrom, to: newTo });
    }

    // Create PROVIDED_THE_TEMPLATE_FOR
    const provEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', randomDTag()],
        ['name', `${node.name} PROVIDED_THE_TEMPLATE_FOR fork`],
        ['z', firmware.conceptUuid('relationship')],
        ['nodeFrom', node.uuid], ['nodeTo', forkedUuid],
        ['relationshipType', 'PROVIDED_THE_TEMPLATE_FOR'],
      ],
    });
    await publishToStrfry(provEvent);
    await importEventDirect(provEvent, `39999:${provEvent.pubkey}:${provEvent.tags.find(t=>t[0]==='d')[1]}`);
    await writeCypher(`
      MATCH (a:NostrEvent {uuid: $from}), (b:NostrEvent {uuid: $to})
      MERGE (a)-[:PROVIDED_THE_TEMPLATE_FOR]->(b)
    `, { from: node.uuid, to: forkedUuid });

    return res.json({
      success: true,
      message: `Forked "${node.name}" → ${forkedUuid}`,
      original: { name: node.name, uuid: node.uuid },
      fork: { uuid: forkedUuid },
      swappedRelationships: swapped.length,
    });
  } catch (error) {
    console.error('normalize/fork-node error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/set-json-tag
//   Body: { uuid, json? (object or string), remove? (bool) }
//   Updates the json tag on a replaceable event.
// ══════════════════════════════════════════════════════════════
async function handleSetJsonTag(req, res) {
  try {
    const { uuid, json, remove } = req.body || {};
    if (!uuid) return res.status(400).json({ success: false, error: 'Missing uuid' });
    if (!remove && json === undefined) return res.status(400).json({ success: false, error: 'Missing json or remove flag' });

    // Get existing tags
    const tagRows = await runCypher(`
      MATCH (e:NostrEvent {uuid: $uuid})-[:HAS_TAG]->(t:NostrEventTag)
      RETURN t.type AS type, t.value AS value, t.value1 AS value1, t.value2 AS value2
      ORDER BY t.uuid
    `, { uuid });
    if (!tagRows.length) return res.json({ success: false, error: `Event "${uuid}" not found` });

    const jsonStr = typeof json === 'string' ? json : JSON.stringify(json);
    let newTags;
    if (remove) {
      newTags = tagRows.filter(t => t.type !== 'json').map(t => {
        const tag = [t.type, t.value];
        if (t.value1) tag.push(t.value1);
        if (t.value2) tag.push(t.value2);
        return tag;
      });
    } else {
      let hasJson = false;
      newTags = tagRows.map(t => {
        const tag = [t.type, t.value];
        if (t.value1) tag.push(t.value1);
        if (t.value2) tag.push(t.value2);
        if (t.type === 'json') { hasJson = true; return ['json', jsonStr]; }
        return tag;
      });
      if (!hasJson) newTags.push(['json', jsonStr]);
    }

    const kind = uuid.startsWith('39998:') ? 39998 : 39999;
    const evt = signAndFinalize({ kind, tags: newTags, content: '' });
    await publishToStrfry(evt);
    await importEventDirect(evt, uuid);

    return res.json({
      success: true,
      message: `JSON tag ${remove ? 'removed from' : 'updated on'} ${uuid}`,
      uuid,
    });
  } catch (error) {
    console.error('normalize/set-json-tag error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function registerNormalizeRoutes(app) {
  // Load TA signing key from secure storage at startup
  await loadTAKey();

  app.post('/api/normalize/skeleton', handleNormalizeSkeleton);
  app.post('/api/normalize/json', handleNormalizeJson);
  app.post('/api/normalize/create-concept', handleCreateConcept);
  app.post('/api/normalize/create-element', handleCreateElement);
  app.post('/api/normalize/save-schema', handleSaveSchema);
  app.post('/api/normalize/save-element-json', handleSaveElementJson);
  app.post('/api/normalize/create-property', handleCreateProperty);
  app.post('/api/normalize/generate-property-tree', handleGeneratePropertyTree);
  app.post('/api/normalize/add-node-as-element', handleAddNodeAsElement);
  app.post('/api/normalize/migrate-primary-property-ztags', handleMigratePrimaryPropertyZTags);
  // Phase 2 endpoints
  app.post('/api/normalize/link-concepts', handleLinkConcepts);
  app.post('/api/normalize/enumerate', handleEnumerate);
  app.post('/api/normalize/set-slug', handleSetSlug);
  app.post('/api/normalize/create-set', handleCreateSet);
  app.post('/api/normalize/add-to-set', handleAddToSet);
  app.post('/api/normalize/fork-node', handleForkNode);
  app.post('/api/normalize/set-json-tag', handleSetJsonTag);

  // Firmware install
  const { handleFirmwareInstall } = require('../../firmware/install');
  app.post('/api/firmware/install', handleFirmwareInstall);
}

module.exports = { registerNormalizeRoutes };
