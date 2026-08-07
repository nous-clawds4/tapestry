/**
 * Normalize API — mutation endpoints for fixing concept graph issues.
 *
 * POST /api/normalize/skeleton
 *   Body: { concept: "<name>", node?: "superset"|"schema"|"core-graph"|"class-graph"|"property-graph" }
 *   If node is omitted, creates all missing skeleton nodes.
 *   Returns list of created events.
 */
const { runCypher, writeCypher } = require('../../lib/neo4j-driver');
const { getOwnerAssistantKeys } = require('../../utils/assistantKeys');
const { exec } = require('child_process');
const crypto = require('crypto');
const firmware = require('./firmware');
const dtag = require('../../lib/dtag');

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
  const keys = await getOwnerAssistantKeys();
  if (keys && keys.privkey) {
    _cachedPrivkey = Uint8Array.from(Buffer.from(keys.privkey, 'hex'));
    console.log(`[normalize] TA key loaded from secure storage`);
    return;
  }
  throw new Error('Tapestry Assistant key not configured. Store it in SecureKeyStorage.');
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

    // Derived naming used across multiple sections
    const slugPlural = deriveSlug(plural);
    const titlePlural = plural.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

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
      const supersetWord = {
        word: {
          slug: `superset-for-the-concept-of-${slugPlural}`,
          name: `superset for the concept of ${plural.toLowerCase()}`,
          title: `Superset for the Concept of ${titlePlural}`,
          wordTypes: ['word', 'set', 'superset'],
          coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid }],
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
      const supersetJson = JSON.stringify(supersetWord);
      const evt = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', supersetName],
          ['z', firmware.conceptUuid('superset')],
          ['description', supersetWord.superset.description],
          ['json', supersetJson],
        ],
        content: '',
      });
      evt._uuid = `39999:${evt.pubkey}:${dTag}`;
      supersetATag = evt._uuid;

      // Superset gets Superset label
      await createNode('Superset', evt, REL.CLASS_THREAD_INITIATION, 'from-header');
      await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:Superset`, { uuid: supersetATag });

      // Also set ConceptHeader label on the header if missing
      await writeCypher(`
        MATCH (h:NostrEvent {uuid: $uuid})
        WHERE NOT h:ConceptHeader
        SET h:ConceptHeader
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
              'x-tapestry': { unique: ['name', 'slug'] },
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
      const ppWord = {
        word: {
          slug: `primary-property-for-the-concept-of-${slugPlural}`,
          name: `primary property for the concept of ${plural.toLowerCase()}`,
          description: `the primary property for the concept of ${plural.toLowerCase()}`,
          wordTypes: ['word', 'property', 'primaryProperty'],
          coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid }],
        },
        property: {
          key: ppKey,
          title: toTitleName(name),
          type: 'object',
          required: ['name', 'slug', 'description'],
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
          },
        },
        primaryProperty: {
          description: `the primary property for the concept of ${plural.toLowerCase()}`,
        },
      };
      const ppName = ppWord.word.name;
      const ppJson = JSON.stringify(ppWord);
      const evt = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', ppName],
          ['z', firmware.conceptUuid('primary-property')],
          ['description', ppWord.word.description],
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
          wordTypes: ['word', 'set', 'propertiesSet'],
          coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slug}`, uuid: headerUuid }],
        },
        set: {
          slug: `properties-for-the-concept-of-${slug}`,
          name: `properties for the concept of ${name}`,
        },
        propertiesSet: {},
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

      const coreGraphWord = {
        word: {
          slug: `core-nodes-graph-for-the-concept-of-${slugPlural}`,
          name: `core nodes graph for the concept of ${plural.toLowerCase()}`,
          title: `Core Nodes Graph for the Concept of ${titlePlural}`,
          wordTypes: ['word', 'graph', 'coreNodesGraph'],
          coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid }],
        },
        graph: {
          nodes: [
            { slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid },
            ...(supersetATag ? [{ slug: `superset-for-the-concept-of-${slugPlural}`, uuid: supersetATag }] : []),
            ...(schemaATag ? [{ slug: `json-schema-for-the-concept-of-${slugPlural}`, uuid: schemaATag }] : []),
            ...(primaryPropATag ? [{ slug: `primary-property-for-the-concept-of-${slugPlural}`, uuid: primaryPropATag }] : []),
            ...(propGraphATag ? [{ slug: `property-tree-graph-for-the-concept-of-${slugPlural}`, uuid: propGraphATag }] : []),
            ...(classGraphATag ? [{ slug: `concept-graph-for-the-concept-of-${slugPlural}`, uuid: classGraphATag }] : []),
            { slug: `core-nodes-graph-for-the-concept-of-${slugPlural}`, uuid: coreGraphATag },
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
            ...(supersetATag ? [{ nodeFrom: { slug: `concept-header-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CLASS_THREAD_INITIATION }, nodeTo: { slug: `superset-for-the-concept-of-${slugPlural}` } }] : []),
            ...(schemaATag ? [{ nodeFrom: { slug: `json-schema-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CORE_NODE_JSON_SCHEMA }, nodeTo: { slug: `concept-header-for-the-concept-of-${slugPlural}` } }] : []),
            ...(primaryPropATag ? [{ nodeFrom: { slug: `primary-property-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CORE_NODE_PRIMARY_PROPERTY }, nodeTo: { slug: `concept-header-for-the-concept-of-${slugPlural}` } }] : []),
            ...(propGraphATag ? [{ nodeFrom: { slug: `property-tree-graph-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CORE_NODE_PROPERTY_TREE_GRAPH }, nodeTo: { slug: `concept-header-for-the-concept-of-${slugPlural}` } }] : []),
            { nodeFrom: { slug: `core-nodes-graph-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CORE_NODE_CORE_GRAPH }, nodeTo: { slug: `concept-header-for-the-concept-of-${slugPlural}` } },
            ...(classGraphATag ? [{ nodeFrom: { slug: `concept-graph-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CORE_NODE_CONCEPT_GRAPH }, nodeTo: { slug: `concept-header-for-the-concept-of-${slugPlural}` } }] : []),
          ],
          imports: [],
        },
        coreNodesGraph: {
          description: `the set of core nodes for the concept of ${plural.toLowerCase()}`,
          constituents: {
            conceptHeader: headerUuid,
            ...(supersetATag && { superset: supersetATag }),
            ...(schemaATag && { jsonSchema: schemaATag }),
            ...(primaryPropATag && { primaryProperty: primaryPropATag }),
            ...(propGraphATag && { propertyTreeGraph: propGraphATag }),
            ...(classGraphATag && { conceptGraph: classGraphATag }),
            coreNodesGraph: coreGraphATag,
          },
        },
      };

      // Re-publish with JSON
      const evt2 = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', coreGraphWord.word.name],
          ['z', firmware.conceptUuid('core-nodes-graph')],
          ['z', firmware.conceptUuid('graph')],
          ['z', firmware.conceptUuid('word')],
          ['description', coreGraphWord.coreNodesGraph.description],
          ['json', JSON.stringify(coreGraphWord)],
        ],
        content: '',
      });
      await publishToStrfry(evt2);
      await importEventDirect(evt2, coreGraphATag);
    }

    // ── Concept Graph ──
    if (missing.includes('concept-graph')) {
      const dTag = `${slug}-concept-graph`;
      const conceptGraphWord = {
        word: {
          slug: `concept-graph-for-the-concept-of-${slugPlural}`,
          name: `concept graph for the concept of ${plural.toLowerCase()}`,
          title: `Concept Graph for the Concept of ${titlePlural}`,
          wordTypes: ['word', 'graph', 'conceptGraph'],
          coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid }],
        },
        graph: {
          nodes: [
            { slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid },
            ...(supersetATag ? [{ slug: `superset-for-the-concept-of-${slugPlural}`, uuid: supersetATag }] : []),
          ],
          relationshipTypes: [
            { slug: REL.CLASS_THREAD_INITIATION, uuid: '' },
            { slug: REL.CLASS_THREAD_PROPAGATION, uuid: '' },
            { slug: REL.CLASS_THREAD_TERMINATION, uuid: '' },
          ],
          relationships: supersetATag ? [{
            nodeFrom: { slug: `concept-header-for-the-concept-of-${slugPlural}` },
            relationshipType: { slug: REL.CLASS_THREAD_INITIATION },
            nodeTo: { slug: `superset-for-the-concept-of-${slugPlural}` },
          }] : [],
          imports: [
            ...(propGraphATag ? [{ slug: `property-tree-graph-for-the-concept-of-${slugPlural}`, uuid: propGraphATag }] : []),
          ],
        },
        conceptGraph: {
          description: `The concept graph for the concept of ${plural.toLowerCase()}`,
          cypher: `MATCH classPath = (conceptHeader)-[:${REL.CLASS_THREAD_INITIATION}]->(superset:Superset)-[:${REL.CLASS_THREAD_PROPAGATION} *0..5]->()-[:${REL.CLASS_THREAD_TERMINATION}]->() WHERE conceptHeader.uuid = '${headerUuid}' RETURN classPath`,
        },
      };
      const evt = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', conceptGraphWord.word.name],
          ['z', firmware.conceptUuid('concept-graph')],
          ['z', firmware.conceptUuid('graph')],
          ['z', firmware.conceptUuid('word')],
          ['description', conceptGraphWord.conceptGraph.description],
          ['json', JSON.stringify(conceptGraphWord)],
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
      const ptWord = {
        word: {
          slug: `property-tree-graph-for-the-concept-of-${slugPlural}`,
          name: `property tree graph for the concept of ${plural.toLowerCase()}`,
          title: `Property Tree Graph for the Concept of ${titlePlural}`,
          wordTypes: ['word', 'graph', 'propertyTreeGraph'],
          coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid }],
        },
        graph: {
          nodes: [
            ...(schemaATag ? [{ slug: `json-schema-for-the-concept-of-${slugPlural}`, uuid: schemaATag }] : []),
            ...(primaryPropATag ? [{ slug: `primary-property-for-the-concept-of-${slugPlural}`, uuid: primaryPropATag }] : []),
          ],
          relationshipTypes: [{ slug: REL.PROPERTY_MEMBERSHIP }],
          relationships: (primaryPropATag && schemaATag) ? [{
            nodeFrom: { slug: `primary-property-for-the-concept-of-${slugPlural}` },
            relationshipType: { slug: REL.PROPERTY_MEMBERSHIP },
            nodeTo: { slug: `json-schema-for-the-concept-of-${slugPlural}` },
          }] : [],
          imports: [],
        },
        propertyTreeGraph: {
          description: `the collection of the JSON schema node, all property nodes and all of their connections for the concept of ${plural.toLowerCase()}`,
        },
      };
      const evt = signAndFinalize({
        kind: 39999,
        tags: [
          ['d', dTag],
          ['name', ptWord.word.name],
          ['z', firmware.conceptUuid('property-tree-graph')],
          ['z', firmware.conceptUuid('graph')],
          ['z', firmware.conceptUuid('word')],
          ['description', ptWord.propertyTreeGraph.description],
          ['json', JSON.stringify(ptWord)],
        ],
        content: '',
      });
      evt._uuid = `39999:${evt.pubkey}:${dTag}`;
      propGraphATag = evt._uuid;

      await createNode('Property Tree Graph', evt, REL.CORE_NODE_PROPERTY_TREE_GRAPH, 'to-header');
    }

    // ── Wire each newly created node as an element of its firmware concept ──
    const skeletonRoleToFirmwareSlug = {
      'Superset': 'superset',
      'JSON Schema': 'json-schema',
      'Primary Property': 'primary-property',
      'Properties': 'properties-set',
      'Core Nodes Graph': 'core-nodes-graph',
      'Concept Graph': 'concept-graph',
      'Property Tree Graph': 'property-tree-graph',
    };

    for (const item of created) {
      const fwSlug = skeletonRoleToFirmwareSlug[item.role];
      if (!fwSlug) continue;

      const fwConceptUuid = firmware.conceptUuid(fwSlug);
      if (!fwConceptUuid) continue;

      const fwRows = await runCypher(`
        MATCH (h:NostrEvent {uuid: $fwConceptUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
        RETURN sup.uuid AS supersetUuid
        LIMIT 1
      `, { fwConceptUuid });

      if (fwRows.length > 0 && fwRows[0].supersetUuid) {
        await writeCypher(`
          MATCH (sup:NostrEvent {uuid: $supersetUuid}), (node:NostrEvent {uuid: $nodeUuid})
          MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(node)
        `, { supersetUuid: fwRows[0].supersetUuid, nodeUuid: item.uuid });
      }
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
      OPTIONAL MATCH (ctg)-[:${REL.CORE_NODE_CONCEPT_GRAPH}]->(h)
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
        const names = deriveAllNames(name, plural);
        const headerJson = {
          word: {
            slug: `concept-header-for-the-concept-of-${names.oSlugs.plural}`,
            name: `concept header for the concept of ${names.oNames.plural}`,
            title: `Concept Header for the Concept of ${names.oTitles.plural}`,
            wordTypes: ['word', 'conceptHeader'],
          },
          conceptHeader: {
            description: h.description || `${names.oTitles.singular} is a concept.`,
            oNames: names.oNames,
            oSlugs: names.oSlugs,
            oKeys: names.oKeys,
            oTitles: names.oTitles,
            oLabels: names.oLabels,
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
      const ngSlugPlural = deriveSlug(plural);
      const ngTitlePlural = plural.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      const graphJson = {
        word: {
          slug: `core-nodes-graph-for-the-concept-of-${ngSlugPlural}`,
          name: `core nodes graph for the concept of ${plural.toLowerCase()}`,
          title: `Core Nodes Graph for the Concept of ${ngTitlePlural}`,
          wordTypes: ['word', 'graph', 'coreNodesGraph'],
          coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${ngSlugPlural}`, uuid: h.headerUuid }],
        },
        graph: {
          nodes: [
            { slug: `concept-header-for-the-concept-of-${ngSlugPlural}`, uuid: h.headerUuid },
            ...(h.supersetUuid ? [{ slug: `superset-for-the-concept-of-${ngSlugPlural}`, uuid: h.supersetUuid }] : []),
            ...(h.schemaUuid ? [{ slug: `json-schema-for-the-concept-of-${ngSlugPlural}`, uuid: h.schemaUuid }] : []),
            ...(h.primaryPropUuid ? [{ slug: `primary-property-for-the-concept-of-${ngSlugPlural}`, uuid: h.primaryPropUuid }] : []),
            ...(h.propGraphUuid ? [{ slug: `property-tree-graph-for-the-concept-of-${ngSlugPlural}`, uuid: h.propGraphUuid }] : []),
            ...(h.classGraphUuid ? [{ slug: `concept-graph-for-the-concept-of-${ngSlugPlural}`, uuid: h.classGraphUuid }] : []),
            { slug: `core-nodes-graph-for-the-concept-of-${ngSlugPlural}`, uuid: h.coreGraphUuid },
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
            ...(h.supersetUuid ? [{ nodeFrom: { slug: `concept-header-for-the-concept-of-${ngSlugPlural}` }, relationshipType: { slug: REL.CLASS_THREAD_INITIATION }, nodeTo: { slug: `superset-for-the-concept-of-${ngSlugPlural}` } }] : []),
            ...(h.schemaUuid ? [{ nodeFrom: { slug: `json-schema-for-the-concept-of-${ngSlugPlural}` }, relationshipType: { slug: REL.CORE_NODE_JSON_SCHEMA }, nodeTo: { slug: `concept-header-for-the-concept-of-${ngSlugPlural}` } }] : []),
            ...(h.primaryPropUuid ? [{ nodeFrom: { slug: `primary-property-for-the-concept-of-${ngSlugPlural}` }, relationshipType: { slug: REL.CORE_NODE_PRIMARY_PROPERTY }, nodeTo: { slug: `concept-header-for-the-concept-of-${ngSlugPlural}` } }] : []),
            ...(h.propGraphUuid ? [{ nodeFrom: { slug: `property-tree-graph-for-the-concept-of-${ngSlugPlural}` }, relationshipType: { slug: REL.CORE_NODE_PROPERTY_TREE_GRAPH }, nodeTo: { slug: `concept-header-for-the-concept-of-${ngSlugPlural}` } }] : []),
            { nodeFrom: { slug: `core-nodes-graph-for-the-concept-of-${ngSlugPlural}` }, relationshipType: { slug: REL.CORE_NODE_CORE_GRAPH }, nodeTo: { slug: `concept-header-for-the-concept-of-${ngSlugPlural}` } },
            ...(h.classGraphUuid ? [{ nodeFrom: { slug: `concept-graph-for-the-concept-of-${ngSlugPlural}` }, relationshipType: { slug: REL.CORE_NODE_CONCEPT_GRAPH }, nodeTo: { slug: `concept-header-for-the-concept-of-${ngSlugPlural}` } }] : []),
          ],
          imports: [],
        },
        coreNodesGraph: {
          description: `the set of core nodes for the concept of ${plural.toLowerCase()}`,
          constituents: {
            conceptHeader: h.headerUuid,
            ...(h.supersetUuid && { superset: h.supersetUuid }),
            ...(h.schemaUuid && { jsonSchema: h.schemaUuid }),
            ...(h.primaryPropUuid && { primaryProperty: h.primaryPropUuid }),
            ...(h.propGraphUuid && { propertyTreeGraph: h.propGraphUuid }),
            ...(h.classGraphUuid && { conceptGraph: h.classGraphUuid }),
            coreNodesGraph: h.coreGraphUuid,
          },
        },
      };
      await regenerateJson(h.coreGraphUuid, graphJson);
      updated.push({ role: 'Core Nodes Graph', uuid: h.coreGraphUuid });
    }

    // ── Class Threads Graph JSON ──
    if ((!node || node === 'class-graph') && h.classGraphUuid) {
      const cgSlugPlural = deriveSlug(plural);
      const cgTitlePlural = plural.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

      // Include superset + any intermediate sets
      const setRows = await runCypher(`
        MATCH (h:NostrEvent {uuid: $headerUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
        OPTIONAL MATCH (sup)-[:${REL.CLASS_THREAD_PROPAGATION}*0..10]->(s)
        WHERE s:Superset OR s:NostrEvent
        RETURN DISTINCT s.uuid AS uuid, s.name AS name
      `, { headerUuid: h.headerUuid });

      const graphJson = {
        word: {
          slug: `concept-graph-for-the-concept-of-${cgSlugPlural}`,
          name: `concept graph for the concept of ${plural.toLowerCase()}`,
          title: `Concept Graph for the Concept of ${cgTitlePlural}`,
          wordTypes: ['word', 'graph', 'conceptGraph'],
          coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${cgSlugPlural}`, uuid: h.headerUuid }],
        },
        graph: {
          nodes: [
            { slug: `concept-header-for-the-concept-of-${cgSlugPlural}`, uuid: h.headerUuid },
            ...setRows.filter(r => r.uuid).map(r => ({ uuid: r.uuid, name: r.name })),
          ],
          relationshipTypes: [
            { slug: REL.CLASS_THREAD_INITIATION, uuid: '' },
            { slug: REL.CLASS_THREAD_PROPAGATION, uuid: '' },
            { slug: REL.CLASS_THREAD_TERMINATION, uuid: '' },
          ],
          relationships: h.supersetUuid ? [{
            nodeFrom: { slug: `concept-header-for-the-concept-of-${cgSlugPlural}` },
            relationshipType: { slug: REL.CLASS_THREAD_INITIATION },
            nodeTo: { slug: `superset-for-the-concept-of-${cgSlugPlural}` },
          }] : [],
          imports: [
            ...(h.propGraphUuid ? [{ slug: `property-tree-graph-for-the-concept-of-${cgSlugPlural}`, uuid: h.propGraphUuid }] : []),
          ],
        },
        conceptGraph: {
          description: `The concept graph for the concept of ${plural.toLowerCase()}`,
          cypher: `MATCH classPath = (conceptHeader)-[:${REL.CLASS_THREAD_INITIATION}]->(superset:Superset)-[:${REL.CLASS_THREAD_PROPAGATION} *0..5]->()-[:${REL.CLASS_THREAD_TERMINATION}]->() WHERE conceptHeader.uuid = '${h.headerUuid}' RETURN classPath`,
        },
      };
      await regenerateJson(h.classGraphUuid, graphJson);
      updated.push({ role: 'Class Threads Graph', uuid: h.classGraphUuid });
    }

    // ── Property Tree Graph JSON ──
    if ((!node || node === 'property-graph') && h.propGraphUuid) {
      const ptSlugPlural = deriveSlug(plural);
      const ptTitlePlural = plural.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      const graphJson = {
        word: {
          slug: `property-tree-graph-for-the-concept-of-${ptSlugPlural}`,
          name: `property tree graph for the concept of ${plural.toLowerCase()}`,
          title: `Property Tree Graph for the Concept of ${ptTitlePlural}`,
          wordTypes: ['word', 'graph', 'propertyTreeGraph'],
          coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${ptSlugPlural}`, uuid: h.headerUuid }],
        },
        graph: {
          nodes: [
            ...(h.schemaUuid ? [{ slug: `json-schema-for-the-concept-of-${ptSlugPlural}`, uuid: h.schemaUuid }] : []),
            ...(h.primaryPropUuid ? [{ slug: `primary-property-for-the-concept-of-${ptSlugPlural}`, uuid: h.primaryPropUuid }] : []),
          ],
          relationshipTypes: [{ slug: REL.PROPERTY_MEMBERSHIP }],
          relationships: (h.primaryPropUuid && h.schemaUuid) ? [{
            nodeFrom: { slug: `primary-property-for-the-concept-of-${ptSlugPlural}` },
            relationshipType: { slug: REL.PROPERTY_MEMBERSHIP },
            nodeTo: { slug: `json-schema-for-the-concept-of-${ptSlugPlural}` },
          }] : [],
          imports: [],
        },
        propertyTreeGraph: {
          description: `the collection of the JSON schema node, all property nodes and all of their connections for the concept of ${plural.toLowerCase()}`,
        },
      };
      await regenerateJson(h.propGraphUuid, graphJson);
      updated.push({ role: 'Property Tree Graph', uuid: h.propGraphUuid });
    }

    // ── Primary Property JSON ──
    if ((!node || node === 'primary-property') && h.primaryPropUuid) {
      const ppKey = toCamelCase(name);
      const ppSlugPlural = deriveSlug(plural);
      const ppJson = {
        word: {
          slug: `primary-property-for-the-concept-of-${ppSlugPlural}`,
          name: `primary property for the concept of ${plural.toLowerCase()}`,
          description: `the primary property for the concept of ${plural.toLowerCase()}`,
          wordTypes: ['word', 'property', 'primaryProperty'],
          coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${ppSlugPlural}`, uuid: h.headerUuid }],
        },
        property: {
          key: ppKey,
          title: toTitleName(name),
          type: 'object',
          required: ['name', 'slug', 'description'],
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
          },
        },
        primaryProperty: {
          description: `the primary property for the concept of ${plural.toLowerCase()}`,
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
    const headerDTag = req.body.dTag || (req.body.random ? randomDTag() : dtag.headerDTag(trimName, req.body.nonce));

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

    // Merge extra fields from firmware conceptHeader (e.g., x-tapestry).
    // `headerTags` is excluded here — it is emitted as literal header event tags
    // below (event-tagging ADR 0003), not folded into the json blob.
    const { conceptHeaderOverrides } = req.body;
    if (conceptHeaderOverrides) {
      const generated = new Set(['description', 'oNames', 'oSlugs', 'oKeys', 'oTitles', 'headerTags']);
      for (const [key, value] of Object.entries(conceptHeaderOverrides)) {
        if (!generated.has(key)) {
          headerWord.conceptHeader[key] = value;
        }
      }
    }

    const headerTags = [
      ['d', headerDTag],
      ['names', names.oNames.singular, names.oNames.plural],
      ['slug', slug],
      // ADR 0007 — self-describing pointer to this concept's Concept Graph
      // node. Value COMPUTED from the header's own (signing) pubkey + d-tag,
      // not Neo4j-looked-up, so it is correct even before the concept-graph
      // node exists. Resolution contract (consumed by stream #5, not here):
      // tag-if-present else compute the same deterministic a-tag.
      // NOTE: use nt().getPublicKey directly — it already returns 64-char
      // hex in this nostr-tools build. The `pubkey` var (:1198) wraps it in
      // Buffer.from(...).toString('hex'), which DOUBLE-ENCODES (story #10
      // cycle-local smoke caught this). Scoped to this tag; the shared
      // `pubkey` var double-encode is a separate pre-existing finding.
      ['concept-graph', `39999:${nt().getPublicKey(privBytes)}:${headerDTag}-concept-graph`],
      ['json', JSON.stringify(headerWord)],
    ];
    if (description) headerTags.push(['description', description.trim()]);

    // event-tagging ADR 0003 — emit a concept's declared literal header tags on the
    // wire (spec fidelity), e.g. tagging-with-specific-tag's recommended/allowed.
    // Generic: any firmware concept may declare `headerTags: [[name, ...values], …]`.
    const declaredHeaderTags = (conceptHeaderOverrides && conceptHeaderOverrides.headerTags) || [];
    for (const tag of declaredHeaderTags) {
      if (Array.isArray(tag) && tag.length >= 2 && typeof tag[0] === 'string') headerTags.push(tag);
    }

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
            'x-tapestry': { unique: ['name', 'slug'] },
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
        wordTypes: ['word', 'set', 'propertiesSet'],
        coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slugPlural}`, uuid: headerUuid }],
      },
      set: {
        slug: `properties-for-the-concept-of-${slugPlural}`,
        name: `properties for the concept of ${names.oNames.plural}`,
      },
      propertiesSet: {
        description: `the set of all properties for the concept of ${names.oNames.plural}`,
      },
    };

    const propsEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', propsDTag], ['name', propsWord.word.name],
        ['z', firmware.conceptUuid('properties-set')],
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
        description: `The concept graph for the concept of ${names.oNames.plural}`,
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
          { slug: REL.CORE_NODE_PROPERTIES },
          { slug: REL.CORE_NODE_PROPERTY_TREE_GRAPH },
          { slug: REL.CORE_NODE_CORE_GRAPH },
          { slug: REL.CORE_NODE_CONCEPT_GRAPH },
        ],
        relationships: [
          { nodeFrom: { slug: `concept-header-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CLASS_THREAD_INITIATION }, nodeTo: { slug: `superset-for-the-concept-of-${slugPlural}` } },
          { nodeFrom: { slug: `json-schema-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CORE_NODE_JSON_SCHEMA }, nodeTo: { slug: `concept-header-for-the-concept-of-${slugPlural}` } },
          { nodeFrom: { slug: `primary-property-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CORE_NODE_PRIMARY_PROPERTY }, nodeTo: { slug: `concept-header-for-the-concept-of-${slugPlural}` } },
          { nodeFrom: { slug: `the-set-of-properties-for-the-concept-of-${slugPlural}` }, relationshipType: { slug: REL.CORE_NODE_PROPERTIES }, nodeTo: { slug: `concept-header-for-the-concept-of-${slugPlural}` } },
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

    // ── 11. Wire each core node as an element of its firmware concept ──
    // Each core node's most-specific z-tag identifies which firmware concept
    // it belongs to. Create CLASS_THREAD_TERMINATION from that concept's
    // superset to the new node.
    const coreNodeFirmwareMappings = [
      { uuid: supersetUuid, slug: 'superset' },
      { uuid: schemaUuid,   slug: 'json-schema' },
      { uuid: ppUuid,       slug: 'primary-property' },
      { uuid: propsUuid,    slug: 'properties-set' },
      { uuid: ptUuid,       slug: 'property-tree-graph' },
      { uuid: cgUuid,       slug: 'concept-graph' },
      { uuid: coreUuid,     slug: 'core-nodes-graph' },
    ];

    for (const mapping of coreNodeFirmwareMappings) {
      const fwConceptUuid = firmware.conceptUuid(mapping.slug);
      if (!fwConceptUuid) continue;

      // Find the firmware concept's superset
      const fwRows = await runCypher(`
        MATCH (h:NostrEvent {uuid: $fwConceptUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
        RETURN sup.uuid AS supersetUuid
        LIMIT 1
      `, { fwConceptUuid });

      if (fwRows.length > 0 && fwRows[0].supersetUuid) {
        await writeCypher(`
          MATCH (sup:NostrEvent {uuid: $supersetUuid}), (node:NostrEvent {uuid: $nodeUuid})
          MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(node)
        `, { supersetUuid: fwRows[0].supersetUuid, nodeUuid: mapping.uuid });
      }
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
      OPTIONAL MATCH (h)-[:HAS_TAG]->(bt:NostrEventTag {type: 'b'})
      RETURN h.uuid AS headerUuid, h.name AS headerName,
             sup.uuid AS supersetUuid,
             collect({value: bt.value, type: bt.value1}) AS bRows
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

    // Create the element event. The z list is the ratified stamping floor
    // (ADR shared-concepts-adoption/0004): the personal handle plus the
    // header's declared affiliation (pointer-b targets via the selector —
    // unwired/deferred concepts yield exactly the single personal z).
    const { selectPointerTargets } = require('../../lib/bValueForms');
    const bRows = (rows[0].bRows || []).filter((r) => r && r.value != null);
    const sharedStamps = selectPointerTargets(bRows, headerUuid);
    const dTag = req.body.dTag || (req.body.random ? randomDTag() : dtag.childDTag(trimName, headerUuid, req.body.nonce));
    const tags = [
      ['d', dTag],
      ['name', trimName],
      ...[headerUuid, ...sharedStamps].map((h) => ['z', h]),
      ['json', typeof finalJson === 'string' ? finalJson : JSON.stringify(finalJson)],
    ];

    const evt = signAndFinalize({ kind: 39999, tags, content: '' });
    const elemUuid = `39999:${evt.pubkey}:${dTag}`;

    await publishToStrfry(evt);
    await importEventDirect(evt, elemUuid);

    // Set ListItem label + slug from JSON if available
    const elemSlug = (typeof finalJson === 'object' && finalJson)
      ? (finalJson.word?.slug || finalJson[Object.keys(finalJson).find(k => k !== 'word')]?.slug || null)
      : null;
    if (elemSlug) {
      await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:ListItem, n.slug = $slug`, { uuid: elemUuid, slug: elemSlug });
    } else {
      await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:ListItem`, { uuid: elemUuid });
    }

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

    // Fold (second-brain #3, ADR 0003 d8 — ADR 0002's Option C lands): a
    // schema write regenerates only the schema node, so reconcile the
    // primary-property record in the same call and report the outcome as
    // `primaryProperty`. Structural non-fits (no pp node, unconventional
    // schema shape, unreadable pp json) map to 'not-applicable' — this path
    // also runs for every firmware concept during install pass 2 and must
    // not turn unconventional concepts into noise. A fold failure after the
    // successful schema write is surfaced loudly here (no rollback exists;
    // the hygiene check stands guard).
    let primaryProperty;
    try {
      const rec = await reconcilePrimaryPropertyForConcept(concept);
      if (rec.success) {
        primaryProperty = { result: rec.result, ...(rec.properties ? { properties: rec.properties } : {}) };
      } else if (rec.code === 'no-primary-property' || rec.code === 'schema-shape' || rec.code === 'pp-unreadable') {
        primaryProperty = { result: 'not-applicable', detail: rec.error };
      } else {
        primaryProperty = { result: 'error', detail: rec.error };
      }
    } catch (foldErr) {
      primaryProperty = { result: 'error', detail: foldErr.message };
    }

    return res.json({
      success: true,
      message: `JSON Schema for "${concept}" updated.`,
      schemaUuid,
      primaryProperty,
    });

  } catch (error) {
    console.error('normalize/save-schema error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// POST /api/normalize/reconcile-primary-property
//   Body: { concept: "<name>" }
//   Derives the primary-property node's property section from the concept's
//   CURRENT json schema and re-publishes it when they disagree (second-brain
//   ADR 0002 decision 4). save-schema regenerates only the schema node, so
//   every schema extension leaves the property record lagging until this runs.
//   Idempotent: 'reconciled' | 'already-consistent'. Consistency is judged by
//   the same comparison the hygiene check uses (lib/brain/hygiene) — the two
//   surfaces can never disagree about "consistent".
//   NOTE: for firmware-seeded concepts a firmware reinstall overwrites the
//   reconciled node from the firmware definition (install hazard, documented
//   at point of use; installer untouched — operator decision 2026-07-18).
// ══════════════════════════════════════════════════════════════

// The reconcile mechanism, extracted from the route handler (second-brain #3,
// ADR 0003 d8) so handleSaveSchema can fold it in. Behavior is byte-equivalent
// for the endpoint; failures carry a discriminated `code` so the fold can map
// structural non-fits to a non-alarming result while the standalone endpoint
// keeps its loud named refusals.
async function reconcilePrimaryPropertyForConcept(concept) {
  // The save-schema lookup idiom, extended to the primary-property node.
  const rows = await runCypher(`
    MATCH (h:NostrEvent)
    WHERE (h:ListHeader OR h:ClassThreadHeader OR h:ConceptHeader) AND h.kind IN [9998, 39998]
      AND h.name = $concept
    OPTIONAL MATCH (js:JSONSchema)-[:${REL.CORE_NODE_JSON_SCHEMA}]->(h)
    OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    OPTIONAL MATCH (pp:Property)-[:${REL.CORE_NODE_PRIMARY_PROPERTY}]->(h)
    OPTIONAL MATCH (pp)-[:HAS_TAG]->(pt:NostrEventTag {type: 'json'})
    RETURN h.uuid AS headerUuid, js.uuid AS schemaUuid, head(collect(DISTINCT jt.value)) AS schemaJson,
           pp.uuid AS ppUuid, head(collect(DISTINCT pt.value)) AS ppJson
    LIMIT 1
  `, { concept });

  if (rows.length === 0) {
    return { success: false, code: 'not-found', error: `Concept "${concept}" not found` };
  }
  const { schemaUuid, ppUuid, schemaJson, ppJson } = rows[0];
  if (!schemaUuid) {
    return { success: false, code: 'no-schema', error: `Concept "${concept}" has no JSON Schema node — nothing to reconcile against.` };
  }
  if (!ppUuid) {
    return { success: false, code: 'no-primary-property', error: `Concept "${concept}" has no Primary Property node to reconcile.` };
  }

  let schemaWrapper, ppWrapper;
  try { schemaWrapper = JSON.parse(schemaJson); } catch { schemaWrapper = null; }
  try { ppWrapper = JSON.parse(ppJson); } catch { ppWrapper = null; }
  const jsonSchema = schemaWrapper && schemaWrapper.jsonSchema;
  const topProps = jsonSchema && jsonSchema.properties;
  const topKeys = topProps ? Object.keys(topProps) : [];
  if (topKeys.length !== 1 || !topProps[topKeys[0]] || typeof topProps[topKeys[0]] !== 'object') {
    return {
      success: false,
      code: 'schema-shape',
      error: `Concept "${concept}" has an unexpected schema shape (expected exactly one top-level property object; found ${topKeys.length}) — refusing to reconcile.`,
    };
  }
  if (!ppWrapper || typeof ppWrapper !== 'object') {
    return { success: false, code: 'pp-unreadable', error: `Concept "${concept}"'s Primary Property node ${ppUuid} has no readable json tag — refusing to reconcile.` };
  }
  const key = topKeys[0];
  const schemaObject = topProps[key];

  // Consistent already? Judged by the hygiene check's own comparison.
  const { comparePropertyRecord } = require('../../lib/brain/hygiene');
  const current = ppWrapper.property && typeof ppWrapper.property === 'object' ? ppWrapper.property : null;
  if (comparePropertyRecord({ concept, schemaObject, propertySection: current }).length === 0) {
    return { success: true, result: 'already-consistent', concept, ppUuid };
  }

  // Derive the target property section per the create-concept convention:
  // per-property definitions stripped to { type }, required mirrored.
  const targetProps = {};
  for (const [k, v] of Object.entries(schemaObject.properties || {})) {
    targetProps[k] = { type: v && v.type };
  }
  const target = {
    key,
    title: (current && current.title) || schemaObject.title || key,
    type: 'object',
    required: [...(schemaObject.required || [])],
    properties: targetProps,
  };
  const before = current && current.properties ? Object.keys(current.properties) : [];
  const wrapper = { ...ppWrapper, property: target };

  await regenerateJson(ppUuid, wrapper);

  return {
    success: true,
    result: 'reconciled',
    concept,
    ppUuid,
    properties: { before, after: Object.keys(targetProps) },
    note: 'A firmware install overwrites primary-property nodes of firmware-seeded concepts from their firmware definitions; runtime-created concepts are untouched.',
  };
}

async function handleReconcilePrimaryProperty(req, res) {
  try {
    const { isOwner } = require('../../middleware/auth');
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    const { concept } = req.body || {};
    if (!concept) return res.status(400).json({ success: false, error: 'Missing concept name' });
    return res.json(await reconcilePrimaryPropertyForConcept(concept));
  } catch (error) {
    console.error('normalize/reconcile-primary-property error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ══════════════════════════════════════════════════════════════
// Second Brain decomposition writes (second-brain #3, ADR 0003 d6/d7)
//   POST /api/normalize/create-child-goal   { parent, name, statement, deliverable?, boundary?, origin?, capturedOn? }
//   POST /api/normalize/update-goal-intent  { goal, deliverable?, boundary?, parent? }
//   Validated goal writes: all checks precede all writes; refusals are loud,
//   named, and leave nothing written. Both ride the module's own machinery
//   (signAndFinalize → publishToStrfry → importEventDirect / regenerateJson —
//   local-only, never publishEverywhere).
// ══════════════════════════════════════════════════════════════

// Serialization (ADR 0003 d7): both primitives are read-validate-write; two
// concurrent adoptions could otherwise commit a decomposition cycle that has
// no in-contract repair (re-parenting is out of scope). The module is a
// process singleton, so a promise-queue mutex serializes the write bodies.
let _goalWriteChain = Promise.resolve();
function serializeGoalWrite(task) {
  const run = _goalWriteChain.then(task, task);
  _goalWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

// The goal concept is runtime-created under this fixed name (second-brain
// ADR 0001 d1; slug/name constants are legitimate — the TA pubkey is not).
const GOAL_CONCEPT_NAME = 'tapestry owner goal';

// Fetch the concept's goal rows (explicit walk ∪ implicit z-tag members —
// the brain read's union shape) and parse them through the shared core.
async function fetchGoalRecords(headerUuid) {
  const { parseGoalRow } = require('../../lib/brain/goals');
  const [explicitRows, implicitRows] = await Promise.all([
    runCypher(`
      MATCH (h:NostrEvent {uuid: $headerUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(s:Superset)
      MATCH (s)-[:${REL.CLASS_THREAD_PROPAGATION}*0..10]->(ss)-[:${REL.CLASS_THREAD_TERMINATION}]->(e:NostrEvent)
      WHERE e.kind = 39999
      OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
      WITH DISTINCT e, head(collect(j.value)) AS json
      RETURN e.uuid AS uuid, e.name AS name, e.created_at AS createdAt, json AS json
    `, { headerUuid }),
    runCypher(`
      MATCH (e:NostrEvent)-[:HAS_TAG]->(:NostrEventTag {type: 'z', value: $headerUuid})
      WHERE e.kind = 39999
      OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
      WITH DISTINCT e, head(collect(j.value)) AS json
      RETURN e.uuid AS uuid, e.name AS name, e.created_at AS createdAt, json AS json
    `, { headerUuid }),
  ]);
  const rowByUuid = new Map();
  for (const row of [...explicitRows, ...implicitRows]) {
    if (row && row.uuid && !rowByUuid.has(row.uuid)) rowByUuid.set(row.uuid, row);
  }
  const records = [...rowByUuid.values()].map(parseGoalRow).filter(Boolean);
  return { rowByUuid, records };
}

async function resolveGoalConcept() {
  const rows = await runCypher(`
    MATCH (h:NostrEvent)
    WHERE (h:ListHeader OR h:ClassThreadHeader) AND h.kind IN [9998, 39998]
      AND h.name = $concept
    OPTIONAL MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
    RETURN h.uuid AS headerUuid, sup.uuid AS supersetUuid
    LIMIT 1
  `, { concept: GOAL_CONCEPT_NAME });
  if (rows.length === 0) return { error: `Concept "${GOAL_CONCEPT_NAME}" not found` };
  if (!rows[0].supersetUuid) return { error: `Concept "${GOAL_CONCEPT_NAME}" has no Superset node.` };
  return { headerUuid: rows[0].headerUuid, supersetUuid: rows[0].supersetUuid };
}

async function handleCreateChildGoal(req, res) {
  try {
    const { isOwner } = require('../../middleware/auth');
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    const { parent, name, statement, deliverable, boundary, origin, capturedOn } = req.body || {};
    if (!parent || typeof parent !== 'string' || !parent.trim()) {
      return res.status(400).json({ success: false, error: 'Missing parent slug' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Goal name is required' });
    }
    if (!statement || typeof statement !== 'string' || !statement.trim()) {
      return res.status(400).json({ success: false, error: 'Goal statement is required' });
    }
    // Refusal contract (ADR 0003 d6), passed through from the shared core or
    // built here: parent-not-found | ambiguous-slug | name-collides — each
    // answers success:false with the named refusal and writes NOTHING.

    // The four intent properties, whitelisted at the handler — the trust
    // boundary — so no raw body object reaches the core (ADR 0001 d3).
    const { pickIntentFields } = require('../../lib/brain/goals');
    const intent = pickIntentFields(req.body || {});
    const result = await serializeGoalWrite(() => createChildGoal({
      parentSlug: parent.trim(),
      name: name.trim(),
      statement: statement.trim(),
      deliverable: typeof deliverable === 'string' && deliverable.trim() ? deliverable.trim() : null,
      boundary: typeof boundary === 'string' && boundary.trim() ? boundary.trim() : null,
      origin: typeof origin === 'string' && origin.trim() ? origin.trim() : null,
      capturedOn: typeof capturedOn === 'string' && capturedOn.trim() ? capturedOn.trim() : null,
      intent,
    }));
    return res.json(result);
  } catch (error) {
    console.error('normalize/create-child-goal error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function createChildGoal({ parentSlug, name, statement, deliverable, boundary, origin, capturedOn, intent }) {
  const { validateDecompositionOp } = require('../../lib/brain/goals');
  const concept = await resolveGoalConcept();
  if (concept.error) return { success: false, error: concept.error };
  const { headerUuid, supersetUuid } = concept;
  const { records } = await fetchGoalRecords(headerUuid);

  const v = validateDecompositionOp(records, { type: 'create-child', parentSlug });
  if (!v.ok) return { success: false, refusal: v.refusal, error: v.detail };

  // Collision refusal (ADR 0003 d2/d6): the json slug and the d-tag both
  // derive from the name, and a colliding d-tag would make importEventDirect
  // MERGE over the existing goal — a silent overwrite. Refuse loudly instead.
  const derivedSlug = dtag.slug(name);
  const dTag = dtag.childDTag(name, headerUuid);
  const collision = records.find((r) => r.name === name
    || r.slug === derivedSlug
    || (r.uuid.split(':').pop() || '') === dTag);
  if (collision) {
    return {
      success: false,
      refusal: 'name-collides',
      error: `the name "${name}" collides with the existing goal "${collision.name}" (shared name, slug '${derivedSlug}', ` +
        'or replaceable-event d-tag) — creating it would silently overwrite. Pick a different name.',
    };
  }

  const section = { name, slug: derivedSlug, description: statement };
  if (origin) section.origin = origin;
  if (capturedOn) section.capturedOn = capturedOn;
  if (deliverable) section.deliverable = deliverable;
  if (boundary) section.boundary = boundary;
  section.parent = parentSlug;
  // Only the fields the owner actually supplied (ADR 0001 d2/d3) — the rest
  // stay absent from the record, which is what "unset" means here.
  Object.assign(section, intent);

  const tags = [
    ['d', dTag],
    ['name', name],
    ['z', headerUuid],
    ['json', JSON.stringify({ tapestryOwnerGoal: section })],
  ];
  const evt = signAndFinalize({ kind: 39999, tags, content: '' });
  const elemUuid = `39999:${evt.pubkey}:${dTag}`;
  await publishToStrfry(evt);
  await importEventDirect(evt, elemUuid);
  await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:ListItem, n.slug = $slug`, { uuid: elemUuid, slug: derivedSlug });
  await writeCypher(`
    MATCH (sup:NostrEvent {uuid: $supersetUuid}), (elem:NostrEvent {uuid: $elemUuid})
    MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(elem)
  `, { supersetUuid, elemUuid });

  return {
    success: true,
    result: 'created',
    element: { uuid: elemUuid, name, slug: derivedSlug, parent: parentSlug },
  };
}

async function handleUpdateGoalIntent(req, res) {
  try {
    const { isOwner } = require('../../middleware/auth');
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    const { goal, deliverable, boundary, parent } = req.body || {};
    if (!goal || typeof goal !== 'string' || !goal.trim()) {
      return res.status(400).json({ success: false, error: 'Missing goal slug' });
    }
    // TWO field lists, deliberately (goal-intent-fields ADR 0001 d4) — do NOT
    // collapse them into one. `provided` stays exactly the three string fields
    // the empty-value refusal and the .trim() calls below were written for.
    // The four intent properties are whitelisted separately and copied
    // verbatim. Appending them to `provided` is a one-line change that looks
    // like tidying and silently creates a rule the story forbids: that loop
    // rejects any non-string and any empty-after-trim value, so
    // `chanceOfSuccess: 75` would be refused for what it CONTAINS (AC5), and
    // the trim would break AC3's byte-identical prompt. Hence the refusal
    // below is a PRESENCE test across both lists, never a content test.
    const { pickIntentFields } = require('../../lib/brain/goals');
    const intent = pickIntentFields(req.body || {});
    const provided = [['deliverable', deliverable], ['boundary', boundary], ['parent', parent]]
      .filter(([, value]) => value !== undefined);
    if (provided.length === 0 && Object.keys(intent).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one of deliverable, boundary, parent, prompt, chanceOfSuccess, needsHumanInput, needsBreakdown is required',
      });
    }
    // Refusal contract (ADR 0003 d7): goal-not-found | ambiguous-slug |
    // self-parent | already-has-parent | cycle | empty-value — loud, named,
    // nothing written. Supplied values must be the owner's words: an empty
    // string would function as a clear, and clearing is out of scope.
    for (const [field, value] of provided) {
      if (typeof value !== 'string' || !value.trim()) {
        return res.json({
          success: false,
          refusal: 'empty-value',
          error: `empty value for ${field} — a blank would silently clear durable intent, and clearing is out of scope.`,
        });
      }
    }
    const result = await serializeGoalWrite(() => updateGoalIntent({
      goalSlug: goal.trim(),
      deliverable: deliverable !== undefined ? deliverable.trim() : undefined,
      boundary: boundary !== undefined ? boundary.trim() : undefined,
      parentSlug: parent !== undefined ? parent.trim() : undefined,
      intent,
    }));
    return res.json(result);
  } catch (error) {
    console.error('normalize/update-goal-intent error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function updateGoalIntent({ goalSlug, deliverable, boundary, parentSlug, intent }) {
  const { validateDecompositionOp, resolveCaptureDate } = require('../../lib/brain/goals');
  const concept = await resolveGoalConcept();
  if (concept.error) return { success: false, error: concept.error };
  const { rowByUuid, records } = await fetchGoalRecords(concept.headerUuid);

  const matches = records.filter((r) => r.slug === goalSlug);
  if (matches.length === 0) {
    return { success: false, refusal: 'goal-not-found', error: `no goal has the slug '${goalSlug}' — the goal was not found.` };
  }
  if (matches.length > 1) {
    return { success: false, refusal: 'ambiguous-slug', error: `${matches.length} goals share the slug '${goalSlug}' — refusing to guess which is meant.` };
  }
  const target = matches[0];

  if (parentSlug !== undefined) {
    const v = validateDecompositionOp(records, { type: 'set-parent', goalSlug, parentSlug });
    if (!v.ok) return { success: false, refusal: v.refusal, error: v.detail };
  }

  const row = rowByUuid.get(target.uuid);
  let wrapper;
  try { wrapper = JSON.parse(row.json); } catch { wrapper = null; }
  const section = wrapper && wrapper.tapestryOwnerGoal;
  if (!section || typeof section !== 'object' || Array.isArray(section)) {
    return { success: false, error: `goal ${target.uuid} has no readable goal record — refusing to rewrite it.` };
  }

  // capturedOn backfill (ADR 0003 d7): regenerateJson re-signs with a fresh
  // created_at, and legacy goals resolve their capture date FROM created_at —
  // pin the true date into the record before the first re-sign moves it.
  if (section.capturedOn == null || section.capturedOn === '') {
    const pinned = resolveCaptureDate({ capturedOn: null, createdAt: typeof row.createdAt === 'number' ? row.createdAt : null });
    if (pinned) section.capturedOn = pinned;
  }

  const fields = [];
  if (deliverable !== undefined) { section.deliverable = deliverable; fields.push('deliverable'); }
  if (boundary !== undefined) { section.boundary = boundary; fields.push('boundary'); }
  if (parentSlug !== undefined) { section.parent = parentSlug; fields.push('parent'); }
  // The four are merged verbatim (ADR 0001 d4) — the three the caller did not
  // supply, and every other field already on the goal (including
  // out-of-contract riders), pass through untouched.
  Object.assign(section, intent);
  fields.push(...Object.keys(intent || {}));

  await regenerateJson(target.uuid, { ...wrapper, tapestryOwnerGoal: section });
  return { success: true, result: 'updated', fields, goal: { uuid: target.uuid, slug: goalSlug } };
}

// ══════════════════════════════════════════════════════════════
// External Resource pointers (second-brain #4, ADR 0004 d6/d7/d8).
//   POST /api/normalize/create-resource — attach a resource to a goal.
//   POST /api/normalize/verify-resource — an asserted re-check (no egress).
// Both ride the goal-write machinery: gated (owner/loopback), validated before
// any write, serialized through serializeGoalWrite, local-only (publishToStrfry
// + importEventDirect — never publishEverywhere). The concept self-bootstraps
// on the first attach (ADR 0004 d8; never firmware-seeded).
// ══════════════════════════════════════════════════════════════

const RESOURCE_CONCEPT_NAME = 'tapestry external resource';
const RESOURCE_KINDS = ['file', 'vault-note', 'nostr-event', 'repository', 'web-address'];

// The External Resource schema (ADR 0004 d1) — a single concept-object wrapper
// so the save-schema primary-property fold (ADR 0003 d8) has its one top-level
// properties key; `required` is mirrored into the primary-property node.
const RESOURCE_SCHEMA = {
  type: 'object',
  properties: {
    externalResource: {
      type: 'object',
      title: 'External Resource',
      required: ['name', 'slug', 'description', 'locatorKind', 'locator', 'goal'],
      properties: {
        name: { type: 'string', description: 'the resource title, in plain words' },
        slug: { type: 'string', description: 'stable identity derived from the goal and the locator' },
        description: { type: 'string', description: 'a short description (defaults to the title)' },
        locatorKind: { type: 'string', enum: RESOURCE_KINDS, description: 'what kind of resource this points at' },
        locator: { type: 'string', description: 'where the resource lives: a path, address, event id, or repository' },
        goal: { type: 'string', description: 'the slug of the goal this resource is attached to' },
        whyKept: { type: 'string', description: 'why this resource is worth keeping (optional)' },
        keywords: { type: 'array', items: { type: 'string' }, description: 'optional keywords for finding it later' },
        notedOn: { type: 'string', description: 'the date this resource was attached' },
        lastVerified: { type: 'string', description: 'the date this resource was last verified' },
        lastVerifyStatus: { type: 'string', enum: ['reachable', 'unreachable'], description: 'the outcome of the last verification' },
      },
      'x-tapestry': { unique: ['slug'] },
    },
  },
  required: ['externalResource'],
};

// Resolve the runtime-created External Resource concept's header + superset
// (mirrors resolveGoalConcept; the header match is broad to tolerate a
// freshly-created concept's labels).
async function resolveResourceConcept() {
  const rows = await runCypher(`
    MATCH (h:NostrEvent)
    WHERE (h:ListHeader OR h:ClassThreadHeader OR h:ConceptHeader) AND h.kind IN [9998, 39998]
      AND h.name = $concept
    OPTIONAL MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
    RETURN h.uuid AS headerUuid, sup.uuid AS supersetUuid
    LIMIT 1
  `, { concept: RESOURCE_CONCEPT_NAME });
  if (rows.length === 0) return { error: `Concept "${RESOURCE_CONCEPT_NAME}" not found` };
  if (!rows[0].supersetUuid) return { error: `Concept "${RESOURCE_CONCEPT_NAME}" has no Superset node.` };
  return { headerUuid: rows[0].headerUuid, supersetUuid: rows[0].supersetUuid };
}

// Fetch the resource rows (explicit walk ∪ implicit z-tag members — the brain
// read's union shape) and parse them through the shared core.
async function fetchResourceRecords(headerUuid) {
  const { parseResourceRow } = require('../../lib/brain/resources');
  const [explicitRows, implicitRows] = await Promise.all([
    runCypher(`
      MATCH (h:NostrEvent {uuid: $headerUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(s:Superset)
      MATCH (s)-[:${REL.CLASS_THREAD_PROPAGATION}*0..10]->(ss)-[:${REL.CLASS_THREAD_TERMINATION}]->(e:NostrEvent)
      WHERE e.kind = 39999
      OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
      WITH DISTINCT e, head(collect(j.value)) AS json
      RETURN e.uuid AS uuid, e.name AS name, e.created_at AS createdAt, json AS json
    `, { headerUuid }),
    runCypher(`
      MATCH (e:NostrEvent)-[:HAS_TAG]->(:NostrEventTag {type: 'z', value: $headerUuid})
      WHERE e.kind = 39999
      OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
      WITH DISTINCT e, head(collect(j.value)) AS json
      RETURN e.uuid AS uuid, e.name AS name, e.created_at AS createdAt, json AS json
    `, { headerUuid }),
  ]);
  const rowByUuid = new Map();
  for (const row of [...explicitRows, ...implicitRows]) {
    if (row && row.uuid && !rowByUuid.has(row.uuid)) rowByUuid.set(row.uuid, row);
  }
  const records = [...rowByUuid.values()].map(parseResourceRow).filter(Boolean);
  return { rowByUuid, records };
}

// Invoke a (req,res) normalize handler internally, capturing its json response.
// Used only for the self-bootstrap: the caller is already gated, and
// create-concept/save-schema carry no in-handler gate (middleware-gated) — a
// server-side call satisfies req.localTrusted.
function invokeNormalizeHandler(handler, body) {
  return new Promise((resolve) => {
    const req = { body, localTrusted: true, params: {}, query: {} };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ statusCode: this.statusCode, body: payload }); return this; },
    };
    Promise.resolve(handler(req, res)).catch((err) =>
      resolve({ statusCode: 500, body: { success: false, error: err.message } }));
  });
}

// Self-bootstrap the External Resource concept (ADR 0004 d8): idempotent —
// create-concept ("already exists" is treated as success) + save-schema
// (idempotent; folds the primary-property reconcile) run ONLY when the concept
// is absent, so there is no per-write churn after the first attach. §5.9: a
// fresh instance self-provisions with no manual step.
async function ensureResourceConcept() {
  const existing = await resolveResourceConcept();
  if (!existing.error) return existing;
  await invokeNormalizeHandler(handleCreateConcept, {
    name: RESOURCE_CONCEPT_NAME,
    description: 'A resource a goal points at — a file, vault note, nostr event, repository, or web address. The brain organizes knowledge; it never contains it.',
  });
  await invokeNormalizeHandler(handleSaveSchema, { concept: RESOURCE_CONCEPT_NAME, schema: RESOURCE_SCHEMA });
  const provisioned = await resolveResourceConcept();
  if (provisioned.error) {
    throw new Error(`ensureResourceConcept failed to provision the concept: ${provisioned.error}`);
  }
  return provisioned;
}

async function handleCreateResource(req, res) {
  try {
    const { isOwner } = require('../../middleware/auth');
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    const { goal, title, locatorKind, locator, whyKept, keywords } = req.body || {};
    if (!goal || typeof goal !== 'string' || !goal.trim()) {
      return res.status(400).json({ success: false, error: 'Missing goal slug' });
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Resource title is required' });
    }
    if (!locator || typeof locator !== 'string' || !locator.trim()) {
      return res.status(400).json({ success: false, error: 'Resource locator is required' });
    }
    const result = await serializeGoalWrite(() => createResource({
      goalSlug: goal.trim(),
      title: title.trim(),
      locatorKind: typeof locatorKind === 'string' ? locatorKind.trim() : '',
      locator: locator.trim(),
      whyKept: typeof whyKept === 'string' && whyKept.trim() ? whyKept.trim() : null,
      keywords: Array.isArray(keywords) ? keywords.filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim()) : null,
    }));
    return res.json(result);
  } catch (error) {
    console.error('normalize/create-resource error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function createResource({ goalSlug, title, locatorKind, locator, whyKept, keywords }) {
  // Kind must be one of the five (ADR 0004 d1) — refuse an unknown kind loudly.
  if (!RESOURCE_KINDS.includes(locatorKind)) {
    return {
      success: false,
      refusal: 'unknown-kind',
      error: `unknown resource kind '${locatorKind}' — must be one of: ${RESOURCE_KINDS.join(', ')}.`,
    };
  }
  // A pointer must attach to a real goal (ADR 0004 d6).
  const goalConcept = await resolveGoalConcept();
  if (goalConcept.error) return { success: false, error: goalConcept.error };
  const { records: goalRecords } = await fetchGoalRecords(goalConcept.headerUuid);
  const goalMatches = goalRecords.filter((g) => g.slug === goalSlug);
  if (goalMatches.length === 0) {
    return { success: false, refusal: 'goal-not-found', error: `no goal has the slug '${goalSlug}' — a resource must attach to an existing goal.` };
  }
  if (goalMatches.length > 1) {
    return { success: false, refusal: 'ambiguous-slug', error: `${goalMatches.length} goals share the slug '${goalSlug}' — refusing to guess which is meant.` };
  }

  // Provision the concept if this is the first attach ever (ADR 0004 d8).
  const concept = await ensureResourceConcept();
  const { headerUuid, supersetUuid } = concept;

  // Identity = (goal, locator), title-independent + verify-stable (ADR 0004 d3):
  // the slug encodes the goal and a hash of (kind, locator), so two goals may
  // point at the same locator without colliding, and re-verifying reuses the
  // same d-tag/uuid. x-tapestry.unique is advisory — this write path enforces it.
  const identitySlug = `${goalSlug}-${dtag.hash8(`${locatorKind}\n${locator}`)}`;
  const { records: existing } = await fetchResourceRecords(headerUuid);
  if (existing.some((r) => r.goal === goalSlug && r.locator === locator)) {
    return {
      success: false,
      refusal: 'resource-exists',
      error: `this goal already points at '${locator}' — refusing to attach it twice. Verify it instead.`,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const section = {
    name: title,
    slug: identitySlug,
    description: whyKept || title,
    locatorKind,
    locator,
    goal: goalSlug,
    notedOn: today,
    lastVerified: today,
    lastVerifyStatus: 'reachable',
  };
  if (whyKept) section.whyKept = whyKept;
  if (keywords && keywords.length) section.keywords = keywords;

  const dTag = dtag.childDTag(identitySlug, headerUuid);
  const tags = [
    ['d', dTag],
    ['name', title],
    ['z', headerUuid],
    ['json', JSON.stringify({ externalResource: section })],
  ];
  const evt = signAndFinalize({ kind: 39999, tags, content: '' });
  const elemUuid = `39999:${evt.pubkey}:${dTag}`;
  await publishToStrfry(evt);
  await importEventDirect(evt, elemUuid);
  await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:ListItem, n.slug = $slug`, { uuid: elemUuid, slug: identitySlug });
  await writeCypher(`
    MATCH (sup:NostrEvent {uuid: $supersetUuid}), (elem:NostrEvent {uuid: $elemUuid})
    MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(elem)
  `, { supersetUuid, elemUuid });

  return {
    success: true,
    result: 'attached',
    resource: { uuid: elemUuid, slug: identitySlug, goal: goalSlug, title, locatorKind },
  };
}

async function handleVerifyResource(req, res) {
  try {
    const { isOwner } = require('../../middleware/auth');
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    const { goal, locator, reachable } = req.body || {};
    if (!goal || typeof goal !== 'string' || !goal.trim()) {
      return res.status(400).json({ success: false, error: 'Missing goal slug' });
    }
    if (!locator || typeof locator !== 'string' || !locator.trim()) {
      return res.status(400).json({ success: false, error: 'Missing resource locator' });
    }
    const result = await serializeGoalWrite(() => verifyResource({
      goalSlug: goal.trim(),
      locator: locator.trim(),
      reachable: reachable !== false, // default: a plain verify asserts reachable
    }));
    return res.json(result);
  } catch (error) {
    console.error('normalize/verify-resource error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// An ASSERTED re-check (ADR 0004 d7 / PRD §7.4): the owner (or a session on
// their behalf) attests to the resource's state. This handler NEVER fetches,
// crawls, or pings the locator — it only reads and re-writes the record.
async function verifyResource({ goalSlug, locator, reachable }) {
  const concept = await resolveResourceConcept();
  if (concept.error) {
    // No concept means nothing was ever attached — the resource cannot exist.
    return { success: false, refusal: 'resource-not-found', error: `no resource is attached to goal '${goalSlug}' at '${locator}'.` };
  }
  const { rowByUuid, records } = await fetchResourceRecords(concept.headerUuid);
  const match = records.find((r) => r.goal === goalSlug && r.locator === locator);
  if (!match) {
    return { success: false, refusal: 'resource-not-found', error: `no resource is attached to goal '${goalSlug}' at '${locator}'.` };
  }
  const row = rowByUuid.get(match.uuid);
  let wrapper;
  try { wrapper = JSON.parse(row.json); } catch { wrapper = null; }
  const section = wrapper && wrapper.externalResource;
  if (!section || typeof section !== 'object' || Array.isArray(section)) {
    return { success: false, error: `resource ${match.uuid} has no readable record — refusing to rewrite it.` };
  }
  section.lastVerified = new Date().toISOString().slice(0, 10);
  section.lastVerifyStatus = reachable ? 'reachable' : 'unreachable';
  await regenerateJson(match.uuid, { ...wrapper, externalResource: section });

  const { deriveFreshness } = require('../../lib/brain/resources');
  return {
    success: true,
    result: 'verified',
    resource: {
      uuid: match.uuid,
      slug: match.slug,
      freshness: deriveFreshness({ lastVerified: section.lastVerified, lastVerifyStatus: section.lastVerifyStatus }, Date.now()),
    },
  };
}

// ══════════════════════════════════════════════════════════════
// Work records + session-born ideas (second-brain #5, ADR 0005 d6/d7/d8).
//   POST /api/normalize/create-work-record — a session records `worked`.
//   POST /api/normalize/note-goal-idea — a session captures an idea + `noted`.
// Both ride the goal-write machinery: gated (owner/loopback), validated before
// any write, serialized through serializeGoalWrite, local-only (publishToStrfry
// + importEventDirect — never publishEverywhere). The concept self-bootstraps on
// first use (ADR 0005 d8; never firmware-seeded). Work records are APPEND-ONLY
// (PRD §7.2): each write mints a fresh element under a random d-tag — no dedup,
// no MERGE-over, never regenerateJson'd.
// ══════════════════════════════════════════════════════════════

const WORK_RECORD_CONCEPT_NAME = 'tapestry work record';
const MAX_QUESTIONS = 2;  // ADR 0005 d15: the ≤2-questions rule as one constant.

// The Work Record schema (ADR 0005 d1) — a single concept-object wrapper so the
// save-schema primary-property fold (ADR 0003 d8) has its one top-level
// properties key; `required` is mirrored into the primary-property node.
const WORK_RECORD_SCHEMA = {
  type: 'object',
  properties: {
    workRecord: {
      type: 'object',
      title: 'Work Record',
      required: ['name', 'slug', 'description', 'type', 'goal', 'session', 'happenedOn'],
      properties: {
        name: { type: 'string', description: 'a short label for this record, in plain words' },
        slug: { type: 'string', description: 'stable identity for this record (unique per record)' },
        description: { type: 'string', description: 'a short description (the one-sentence summary)' },
        type: { type: 'string', enum: ['worked', 'noted'], description: 'whether a session worked on the goal or noted an idea' },
        goal: { type: 'string', description: 'the slug of the goal this record is about' },
        session: { type: 'string', description: 'the session that produced this record' },
        summary: { type: 'string', description: 'a one-sentence summary of where things stand' },
        questions: { type: 'array', items: { type: 'string' }, description: 'at most two plain-language questions for the owner' },
        produced: { type: 'array', items: { type: 'string' }, description: 'locators of the resources this record produced' },
        happenedOn: { type: 'string', description: 'the date this happened' },
      },
      'x-tapestry': { unique: ['slug'] },
    },
  },
  required: ['workRecord'],
};

// Resolve the runtime-created Work Record concept's header + superset (mirrors
// resolveResourceConcept; the header match tolerates a freshly-created concept's
// labels).
async function resolveWorkRecordConcept() {
  const rows = await runCypher(`
    MATCH (h:NostrEvent)
    WHERE (h:ListHeader OR h:ClassThreadHeader OR h:ConceptHeader) AND h.kind IN [9998, 39998]
      AND h.name = $concept
    OPTIONAL MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
    RETURN h.uuid AS headerUuid, sup.uuid AS supersetUuid
    LIMIT 1
  `, { concept: WORK_RECORD_CONCEPT_NAME });
  if (rows.length === 0) return { error: `Concept "${WORK_RECORD_CONCEPT_NAME}" not found` };
  if (!rows[0].supersetUuid) return { error: `Concept "${WORK_RECORD_CONCEPT_NAME}" has no Superset node.` };
  return { headerUuid: rows[0].headerUuid, supersetUuid: rows[0].supersetUuid };
}

// Fetch the concept's work-record rows (explicit walk ∪ implicit z-tag members —
// the brain read's union shape) and parse them through the shared core.
async function fetchWorkRecords(headerUuid) {
  const { parseWorkRecordRow } = require('../../lib/brain/work-records');
  const [explicitRows, implicitRows] = await Promise.all([
    runCypher(`
      MATCH (h:NostrEvent {uuid: $headerUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(s:Superset)
      MATCH (s)-[:${REL.CLASS_THREAD_PROPAGATION}*0..10]->(ss)-[:${REL.CLASS_THREAD_TERMINATION}]->(e:NostrEvent)
      WHERE e.kind = 39999
      OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
      WITH DISTINCT e, head(collect(j.value)) AS json
      RETURN e.uuid AS uuid, e.name AS name, e.created_at AS createdAt, json AS json
    `, { headerUuid }),
    runCypher(`
      MATCH (e:NostrEvent)-[:HAS_TAG]->(:NostrEventTag {type: 'z', value: $headerUuid})
      WHERE e.kind = 39999
      OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
      WITH DISTINCT e, head(collect(j.value)) AS json
      RETURN e.uuid AS uuid, e.name AS name, e.created_at AS createdAt, json AS json
    `, { headerUuid }),
  ]);
  const rowByUuid = new Map();
  for (const row of [...explicitRows, ...implicitRows]) {
    if (row && row.uuid && !rowByUuid.has(row.uuid)) rowByUuid.set(row.uuid, row);
  }
  const records = [...rowByUuid.values()].map(parseWorkRecordRow).filter(Boolean);
  return { rowByUuid, records };
}

// Self-bootstrap the Work Record concept (ADR 0005 d8): idempotent — a byte-for-
// byte copy of ensureResourceConcept. create-concept ("already exists" → success)
// + save-schema (folds the primary-property reconcile) run ONLY when the concept
// is absent, so there is no per-write churn after the first record. §5.9: a fresh
// instance self-provisions with no manual step; never firmware-seeded.
async function ensureWorkRecordConcept() {
  const existing = await resolveWorkRecordConcept();
  if (!existing.error) return existing;
  await invokeNormalizeHandler(handleCreateConcept, {
    name: WORK_RECORD_CONCEPT_NAME,
    description: 'A dated, append-only record a session leaves on a goal — what it worked on and produced, or an idea it noted. Never edited; corrections are new records.',
  });
  await invokeNormalizeHandler(handleSaveSchema, { concept: WORK_RECORD_CONCEPT_NAME, schema: WORK_RECORD_SCHEMA });
  const provisioned = await resolveWorkRecordConcept();
  if (provisioned.error) {
    throw new Error(`ensureWorkRecordConcept failed to provision the concept: ${provisioned.error}`);
  }
  return provisioned;
}

// The append-only Work Record element mint (ADR 0005 d3): a fresh RANDOM d-tag
// each call, so a record can never MERGE over a prior one and is never re-signed
// (createWorkRecord and noteGoalIdea each inline it — the createResource /
// createChildGoal element-mint idiom). Builds the json section from the caller's
// fields plus the derived unique slug; returns the minted element's uuid + slug.
async function mintWorkRecordElement({ headerUuid, supersetUuid, label, section }) {
  const nonce = randomDTag();
  const dTag = dtag.childDTag(label, headerUuid, nonce);
  const slug = `${dtag.slug(label)}-${nonce}`;
  const recordSection = { name: `${section.type}: ${section.goal}`, slug, description: section.summary, ...section };
  const tags = [
    ['d', dTag],
    ['name', recordSection.name],
    ['z', headerUuid],
    ['json', JSON.stringify({ workRecord: recordSection })],
  ];
  const evt = signAndFinalize({ kind: 39999, tags, content: '' });
  const elemUuid = `39999:${evt.pubkey}:${dTag}`;
  await publishToStrfry(evt);
  await importEventDirect(evt, elemUuid);
  await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:ListItem, n.slug = $slug`, { uuid: elemUuid, slug });
  await writeCypher(`
    MATCH (sup:NostrEvent {uuid: $supersetUuid}), (elem:NostrEvent {uuid: $elemUuid})
    MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(elem)
  `, { supersetUuid, elemUuid });
  return { uuid: elemUuid, slug };
}

async function handleCreateWorkRecord(req, res) {
  try {
    const { isOwner } = require('../../middleware/auth');
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    const { goal, session, summary, questions, produced } = req.body || {};
    if (!goal || typeof goal !== 'string' || !goal.trim()) {
      return res.status(400).json({ success: false, error: 'Missing goal slug' });
    }
    if (!session || typeof session !== 'string' || !session.trim()) {
      return res.status(400).json({ success: false, error: 'A session is required to attribute the record' });
    }
    if (!summary || typeof summary !== 'string' || !summary.trim()) {
      return res.status(400).json({ success: false, error: 'A one-sentence summary is required' });
    }
    const qs = Array.isArray(questions) ? questions.filter((q) => typeof q === 'string' && q.trim()).map((q) => q.trim()) : [];
    if (qs.length > MAX_QUESTIONS) {
      return res.json({
        success: false,
        refusal: 'too-many-questions',
        error: `a session hand-off asks at most ${MAX_QUESTIONS} questions — got ${qs.length}. Keep the two that matter.`,
      });
    }
    const prod = Array.isArray(produced) ? produced.filter((p) => p && typeof p === 'object') : [];
    const result = await serializeGoalWrite(() => createWorkRecord({
      goalSlug: goal.trim(), session: session.trim(), summary: summary.trim(), questions: qs, produced: prod,
    }));
    return res.json(result);
  } catch (error) {
    console.error('normalize/create-work-record error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function createWorkRecord({ goalSlug, session, summary, questions, produced }) {
  // A record must attach to a real goal (ADR 0005 d6).
  const goalConcept = await resolveGoalConcept();
  if (goalConcept.error) return { success: false, error: goalConcept.error };
  const { records: goalRecords } = await fetchGoalRecords(goalConcept.headerUuid);
  const goalMatches = goalRecords.filter((g) => g.slug === goalSlug);
  if (goalMatches.length === 0) {
    return { success: false, refusal: 'goal-not-found', error: `no goal has the slug '${goalSlug}' — a work record must attach to an existing goal.` };
  }
  if (goalMatches.length > 1) {
    return { success: false, refusal: 'ambiguous-slug', error: `${goalMatches.length} goals share the slug '${goalSlug}' — refusing to guess which is meant.` };
  }

  // Ensure each produced resource is attached to the goal (ADR 0005 d4:
  // ensure-and-reference). The createResource CORE is unserialized (its mutex is
  // at handleCreateResource), so composing it inside this already-serialized body
  // does not nest the mutex. An already-attached resource (resource-exists) is
  // referenced, not re-attached; a genuine refusal (unknown-kind…) fails the call.
  const producedLocators = [];
  for (const spec of produced) {
    const attach = await createResource({
      goalSlug,
      title: typeof spec.title === 'string' ? spec.title : spec.locator,
      locatorKind: typeof spec.locatorKind === 'string' ? spec.locatorKind.trim() : '',
      locator: typeof spec.locator === 'string' ? spec.locator.trim() : '',
      whyKept: typeof spec.whyKept === 'string' && spec.whyKept.trim() ? spec.whyKept.trim() : null,
      keywords: Array.isArray(spec.keywords) ? spec.keywords : null,
    });
    if (!attach.success && attach.refusal !== 'resource-exists') {
      return attach; // named refusal, nothing further written
    }
    if (typeof spec.locator === 'string' && spec.locator.trim()) producedLocators.push(spec.locator.trim());
  }

  // Provision the concept if this is the first record ever (ADR 0005 d8).
  const concept = await ensureWorkRecordConcept();
  const today = new Date().toISOString().slice(0, 10);
  const section = { type: 'worked', goal: goalSlug, session, summary, happenedOn: today };
  if (questions && questions.length) section.questions = questions;
  if (producedLocators.length) section.produced = producedLocators;

  const { uuid, slug } = await mintWorkRecordElement({
    headerUuid: concept.headerUuid, supersetUuid: concept.supersetUuid, label: `worked-${goalSlug}`, section,
  });
  return { success: true, result: 'recorded', record: { uuid, slug, goal: goalSlug, type: 'worked' } };
}

async function handleNoteGoalIdea(req, res) {
  try {
    const { isOwner } = require('../../middleware/auth');
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    // servingGoal is accepted in the contract for forward-compat (traceability);
    // v1 records the idea's own statement as the summary (no raw slug in copy).
    const { name, statement, session } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'An idea name is required' });
    }
    if (!statement || typeof statement !== 'string' || !statement.trim()) {
      return res.status(400).json({ success: false, error: 'A statement is required to capture the idea' });
    }
    if (!session || typeof session !== 'string' || !session.trim()) {
      return res.status(400).json({ success: false, error: 'A session is required to attribute the capture' });
    }
    // The four intent properties ride along on the existing contract
    // (goal-intent-fields ADR 0001 d3). Whitelisted HERE — the handler is the
    // trust boundary — so no raw body object ever reaches the core.
    const { pickIntentFields } = require('../../lib/brain/goals');
    const intent = pickIntentFields(req.body || {});
    const result = await serializeGoalWrite(() => noteGoalIdea({
      name: name.trim(), statement: statement.trim(), session: session.trim(), intent,
    }));
    return res.json(result);
  } catch (error) {
    console.error('normalize/note-goal-idea error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function noteGoalIdea({ name, statement, session, intent }) {
  // Capture a NEW root goal (no parent), attributed to the session, with the
  // createChildGoal collision guard (ADR 0005 d7). This launches nothing — it
  // only writes facts (a goal + a noted record); the v1 launcher is the owner.
  const concept = await resolveGoalConcept();
  if (concept.error) return { success: false, error: concept.error };
  const { headerUuid, supersetUuid } = concept;
  const { records } = await fetchGoalRecords(headerUuid);

  const derivedSlug = dtag.slug(name);
  const dTag = dtag.childDTag(name, headerUuid);
  const collision = records.find((r) => r.name === name
    || r.slug === derivedSlug
    || (r.uuid.split(':').pop() || '') === dTag);
  if (collision) {
    return {
      success: false,
      refusal: 'name-collides',
      error: `the name "${name}" collides with the existing goal "${collision.name}" (shared name, slug '${derivedSlug}', ` +
        'or replaceable-event d-tag) — creating it would silently overwrite. Pick a different name.',
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const goalSection = { name, slug: derivedSlug, description: statement, origin: 'noted in an assistant session', capturedOn: today };
  // Only the fields the owner actually supplied (ADR 0001 d2/d3) — the rest
  // stay absent from the record, which is what "unset" means here.
  Object.assign(goalSection, intent);
  const goalTags = [
    ['d', dTag],
    ['name', name],
    ['z', headerUuid],
    ['json', JSON.stringify({ tapestryOwnerGoal: goalSection })],
  ];
  const goalEvt = signAndFinalize({ kind: 39999, tags: goalTags, content: '' });
  const goalUuid = `39999:${goalEvt.pubkey}:${dTag}`;
  await publishToStrfry(goalEvt);
  await importEventDirect(goalEvt, goalUuid);
  await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:ListItem, n.slug = $slug`, { uuid: goalUuid, slug: derivedSlug });
  await writeCypher(`
    MATCH (sup:NostrEvent {uuid: $supersetUuid}), (elem:NostrEvent {uuid: $elemUuid})
    MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(elem)
  `, { supersetUuid, elemUuid: goalUuid });

  // The append-only NOTED record on the new goal — its provenance (ADR 0005 d7).
  const wr = await ensureWorkRecordConcept();
  const record = await mintWorkRecordElement({
    headerUuid: wr.headerUuid, supersetUuid: wr.supersetUuid, label: `noted-${derivedSlug}`,
    section: { type: 'noted', goal: derivedSlug, session, summary: statement, happenedOn: today },
  });

  return {
    success: true,
    result: 'noted',
    goal: { uuid: goalUuid, slug: derivedSlug, name },
    record: { uuid: record.uuid, slug: record.slug, type: 'noted' },
  };
}

// ══════════════════════════════════════════════════════════════
// Proposals + decisions (second-brain #6, ADR 0006 d6/d7/d8).
//   POST /api/normalize/make-proposal — nominate one viable goal (proposed).
//   POST /api/normalize/approve-proposal — record an approved decision.
//   POST /api/normalize/skip-proposal — record a skipped decision (reason required).
// All ride the goal-write machinery: gated (owner/loopback), validated before any
// write, serialized through serializeGoalWrite, local-only (publishToStrfry +
// importEventDirect — never published to the wider network). The concept
// self-bootstraps on the first proposal (ADR 0006 d8; never firmware-seeded). Both
// the nomination and its decisions are
// APPEND-ONLY (PRD §7.2): every write mints a fresh element under a random d-tag —
// a decision never mutates the proposal (the load-bearing (a)/(b) call: shape (b),
// append a separate decision fact; open-ness is derived at read from its absence).
// ══════════════════════════════════════════════════════════════

const PROPOSAL_CONCEPT_NAME = 'tapestry proposal';
const MAX_PASSED_OVER = 8;  // ADR 0006 d15: the legibility bound on "considered instead".

// The Proposal schema (ADR 0006 d1) — a single concept-object wrapper so the
// save-schema primary-property fold (ADR 0003 d8) has its one top-level properties
// key; `required` is mirrored into the primary-property node. type-specific fields
// (whyNow/passedOver on a nomination; proposalId/reason on a decision) vary by
// `type`, so they are not globally required — the write path is the enforcer.
const PROPOSAL_SCHEMA = {
  type: 'object',
  properties: {
    proposal: {
      type: 'object',
      title: 'Proposal',
      required: ['name', 'slug', 'description', 'type', 'goal', 'happenedOn'],
      properties: {
        name: { type: 'string', description: 'a short label for this proposal fact, in plain words' },
        slug: { type: 'string', description: 'stable identity for this fact (unique per element)' },
        description: { type: 'string', description: 'a short description (the one-line summary)' },
        summary: { type: 'string', description: 'the one-line summary shown on the goal record' },
        type: { type: 'string', enum: ['proposed', 'approved', 'skipped'], description: 'a nomination, or a decision on one' },
        goal: { type: 'string', description: 'the slug of the nominated goal this fact is about' },
        whyNow: { type: 'string', description: 'why this goal is the next thing (on a nomination)' },
        passedOver: {
          type: 'array',
          description: 'the goals passed over, each with a one-line why-not (on a nomination)',
          items: {
            type: 'object',
            properties: {
              goal: { type: 'string', description: 'the slug of a passed-over goal' },
              whyNot: { type: 'string', description: 'one line on why it was passed over' },
            },
          },
        },
        proposalId: { type: 'string', description: 'the proposed fact this decision refers to (on a decision)' },
        reason: { type: 'string', description: 'the one-line reason (required on a skip)' },
        happenedOn: { type: 'string', description: 'the date this happened' },
      },
      'x-tapestry': { unique: ['slug'] },
    },
  },
  required: ['proposal'],
};

// Resolve the runtime-created Proposal concept's header + superset (mirrors
// resolveWorkRecordConcept; the header match tolerates a freshly-created concept's
// labels).
async function resolveProposalConcept() {
  const rows = await runCypher(`
    MATCH (h:NostrEvent)
    WHERE (h:ListHeader OR h:ClassThreadHeader OR h:ConceptHeader) AND h.kind IN [9998, 39998]
      AND h.name = $concept
    OPTIONAL MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
    RETURN h.uuid AS headerUuid, sup.uuid AS supersetUuid
    LIMIT 1
  `, { concept: PROPOSAL_CONCEPT_NAME });
  if (rows.length === 0) return { error: `Concept "${PROPOSAL_CONCEPT_NAME}" not found` };
  if (!rows[0].supersetUuid) return { error: `Concept "${PROPOSAL_CONCEPT_NAME}" has no Superset node.` };
  return { headerUuid: rows[0].headerUuid, supersetUuid: rows[0].supersetUuid };
}

// Fetch the concept's proposal rows (explicit walk ∪ implicit z-tag members — the
// brain read's union shape) and parse them through the shared core.
async function fetchProposals(headerUuid) {
  const { parseProposalRow } = require('../../lib/brain/proposals');
  const [explicitRows, implicitRows] = await Promise.all([
    runCypher(`
      MATCH (h:NostrEvent {uuid: $headerUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(s:Superset)
      MATCH (s)-[:${REL.CLASS_THREAD_PROPAGATION}*0..10]->(ss)-[:${REL.CLASS_THREAD_TERMINATION}]->(e:NostrEvent)
      WHERE e.kind = 39999
      OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
      WITH DISTINCT e, head(collect(j.value)) AS json
      RETURN e.uuid AS uuid, e.name AS name, e.created_at AS createdAt, json AS json
    `, { headerUuid }),
    runCypher(`
      MATCH (e:NostrEvent)-[:HAS_TAG]->(:NostrEventTag {type: 'z', value: $headerUuid})
      WHERE e.kind = 39999
      OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
      WITH DISTINCT e, head(collect(j.value)) AS json
      RETURN e.uuid AS uuid, e.name AS name, e.created_at AS createdAt, json AS json
    `, { headerUuid }),
  ]);
  const rowByUuid = new Map();
  for (const row of [...explicitRows, ...implicitRows]) {
    if (row && row.uuid && !rowByUuid.has(row.uuid)) rowByUuid.set(row.uuid, row);
  }
  const records = [...rowByUuid.values()].map(parseProposalRow).filter(Boolean);
  return { rowByUuid, records };
}

// Self-bootstrap the Proposal concept (ADR 0006 d8): idempotent — a structural
// copy of ensureWorkRecordConcept. create-concept ("already exists" → success) +
// save-schema (folds the primary-property reconcile) run ONLY when the concept is
// absent, so there is no per-write churn after the first proposal. §5.9: a fresh
// instance self-provisions with no manual step; never firmware-seeded.
async function ensureProposalConcept() {
  const existing = await resolveProposalConcept();
  if (!existing.error) return existing;
  await invokeNormalizeHandler(handleCreateConcept, {
    name: PROPOSAL_CONCEPT_NAME,
    description: 'A dated, append-only proposal a session leaves for the owner — one viable goal nominated with why-now and the goals it passed over — and its decision (approved or skipped). Never edited; a decision is a new fact.',
  });
  await invokeNormalizeHandler(handleSaveSchema, { concept: PROPOSAL_CONCEPT_NAME, schema: PROPOSAL_SCHEMA });
  const provisioned = await resolveProposalConcept();
  if (provisioned.error) {
    throw new Error(`ensureProposalConcept failed to provision the concept: ${provisioned.error}`);
  }
  return provisioned;
}

// The append-only Proposal element mint (ADR 0006 d3): a fresh RANDOM d-tag each
// call, so a decision can never MERGE over the proposal (nor a re-proposal over a
// prior one) and nothing is re-signed (the mintWorkRecordElement idiom). Builds
// the json section from the caller's fields plus the derived unique slug; returns
// the minted element's uuid + slug.
async function mintProposalElement({ headerUuid, supersetUuid, label, section }) {
  const nonce = randomDTag();
  const dTag = dtag.childDTag(label, headerUuid, nonce);
  const slug = `${dtag.slug(label)}-${nonce}`;
  const recordSection = { name: `${section.type}: ${section.goal}`, slug, description: section.summary, ...section };
  const tags = [
    ['d', dTag],
    ['name', recordSection.name],
    ['z', headerUuid],
    ['json', JSON.stringify({ proposal: recordSection })],
  ];
  const evt = signAndFinalize({ kind: 39999, tags, content: '' });
  const elemUuid = `39999:${evt.pubkey}:${dTag}`;
  await publishToStrfry(evt);
  await importEventDirect(evt, elemUuid);
  await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:ListItem, n.slug = $slug`, { uuid: elemUuid, slug });
  await writeCypher(`
    MATCH (sup:NostrEvent {uuid: $supersetUuid}), (elem:NostrEvent {uuid: $elemUuid})
    MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(elem)
  `, { supersetUuid, elemUuid });
  return { uuid: elemUuid, slug };
}

async function handleMakeProposal(req, res) {
  try {
    const { isOwner } = require('../../middleware/auth');
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    const { goal, whyNow, passedOver } = req.body || {};
    if (!goal || typeof goal !== 'string' || !goal.trim()) {
      return res.status(400).json({ success: false, error: 'Missing nominated goal slug' });
    }
    if (!whyNow || typeof whyNow !== 'string' || !whyNow.trim()) {
      return res.status(400).json({ success: false, error: 'A why-now is required' });
    }
    const runners = Array.isArray(passedOver) ? passedOver : [];
    if (runners.length > MAX_PASSED_OVER) {
      return res.json({
        success: false,
        refusal: 'too-many-runners-up',
        error: `a proposal names at most ${MAX_PASSED_OVER} passed-over goals — got ${runners.length}. Keep the ones that matter.`,
      });
    }
    for (const r of runners) {
      if (!r || typeof r !== 'object' || typeof r.goal !== 'string' || !r.goal.trim()
        || typeof r.whyNot !== 'string' || !r.whyNot.trim()) {
        return res.json({
          success: false,
          refusal: 'runner-up-incomplete',
          error: 'each passed-over goal needs a goal and a one-line why-not.',
        });
      }
    }
    const result = await serializeGoalWrite(() => makeProposal({
      goalSlug: goal.trim(),
      whyNow: whyNow.trim(),
      passedOver: runners.map((r) => ({ goal: r.goal.trim(), whyNot: r.whyNot.trim() })),
    }));
    return res.json(result);
  } catch (error) {
    console.error('normalize/make-proposal error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function makeProposal({ goalSlug, whyNow, passedOver }) {
  const { deriveStanding, resolveDecomposition } = require('../../lib/brain/goals');
  // Viability is graph-truth: resolve goals + decomposition, then a viable leaf is
  // deriveStanding === 'viable' (a leaf with a done-means and a stays-inside; a
  // parent is 'captured', never viable — ADR 0006 d5).
  const goalConcept = await resolveGoalConcept();
  if (goalConcept.error) return { success: false, error: goalConcept.error };
  const { records: goalRecords } = await fetchGoalRecords(goalConcept.headerUuid);
  const resolved = resolveDecomposition(goalRecords);
  const bySlug = (slug) => resolved.filter((g) => g.slug === slug);
  const isViable = (g) => deriveStanding(g, { hasChildren: g.hasChildren }) === 'viable';

  // The nominee must be a single viable leaf.
  const nomMatches = bySlug(goalSlug);
  if (nomMatches.length === 0) {
    return { success: false, refusal: 'goal-not-found', error: `no goal has the slug '${goalSlug}' — a proposal must nominate an existing goal.` };
  }
  if (nomMatches.length > 1) {
    return { success: false, refusal: 'ambiguous-slug', error: `${nomMatches.length} goals share the slug '${goalSlug}' — refusing to guess which is meant.` };
  }
  if (!isViable(nomMatches[0])) {
    return { success: false, refusal: 'not-viable', error: `goal '${goalSlug}' is not viable — only a leaf goal with a done-means and a stays-inside can be proposed.` };
  }

  // Each runner-up must resolve, be viable, and be distinct from the nominee + each other.
  const seen = new Set();
  for (const r of passedOver) {
    if (r.goal === goalSlug) {
      return { success: false, refusal: 'runner-up-is-nominee', error: `the passed-over goal '${r.goal}' is the nominee itself — a runner-up must be a different goal.` };
    }
    if (seen.has(r.goal)) {
      return { success: false, refusal: 'runner-up-duplicate', error: `the passed-over goal '${r.goal}' is named twice.` };
    }
    seen.add(r.goal);
    const rm = bySlug(r.goal);
    if (rm.length === 0) {
      return { success: false, refusal: 'runner-up-unknown', error: `no goal has the slug '${r.goal}' — a passed-over goal must exist.` };
    }
    if (rm.length > 1) {
      return { success: false, refusal: 'ambiguous-slug', error: `${rm.length} goals share the slug '${r.goal}' — refusing to guess which is meant.` };
    }
    if (!isViable(rm[0])) {
      return { success: false, refusal: 'runner-up-not-viable', error: `passed-over goal '${r.goal}' is not viable — the runners-up are other viable goals.` };
    }
  }

  // Provision the concept if this is the first proposal ever (ADR 0006 d8).
  const concept = await ensureProposalConcept();
  // One OPEN proposal per goal (ADR 0006 d6) — derived from the current facts.
  const { openProposals } = require('../../lib/brain/proposals');
  const { records: proposalRecords } = await fetchProposals(concept.headerUuid);
  if (openProposals(proposalRecords).some((p) => p.goal === goalSlug)) {
    return { success: false, refusal: 'already-open', error: `goal '${goalSlug}' already has an open proposal — decide it before proposing it again.` };
  }

  const today = new Date().toISOString().slice(0, 10);
  const section = { type: 'proposed', goal: goalSlug, summary: whyNow, whyNow, happenedOn: today };
  if (passedOver.length) section.passedOver = passedOver;

  const { uuid, slug } = await mintProposalElement({
    headerUuid: concept.headerUuid, supersetUuid: concept.supersetUuid, label: `proposed-${goalSlug}`, section,
  });
  return { success: true, result: 'proposed', proposal: { uuid, slug, goal: goalSlug } };
}

async function handleApproveProposal(req, res) {
  try {
    const { isOwner } = require('../../middleware/auth');
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    const { proposalId } = req.body || {};
    if (!proposalId || typeof proposalId !== 'string' || !proposalId.trim()) {
      return res.status(400).json({ success: false, error: 'Missing proposalId' });
    }
    const result = await serializeGoalWrite(() => decideProposal({ proposalId: proposalId.trim(), decision: 'approved' }));
    return res.json(result);
  } catch (error) {
    console.error('normalize/approve-proposal error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function handleSkipProposal(req, res) {
  try {
    const { isOwner } = require('../../middleware/auth');
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    const { proposalId, reason } = req.body || {};
    if (!proposalId || typeof proposalId !== 'string' || !proposalId.trim()) {
      return res.status(400).json({ success: false, error: 'Missing proposalId' });
    }
    // The one-line reason is required before a skip can complete (AC4 — the UI
    // disables Skip until non-empty; the server enforces it too).
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.json({
        success: false,
        refusal: 'reason-required',
        error: 'a skip needs a one-line reason — why not this one, in a few words.',
      });
    }
    const result = await serializeGoalWrite(() => decideProposal({
      proposalId: proposalId.trim(), decision: 'skipped', reason: reason.trim(),
    }));
    return res.json(result);
  } catch (error) {
    console.error('normalize/skip-proposal error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// The shared decision core (ADR 0006 d7): resolve the open proposal, refuse if
// already decided (the decided-exactly-once guard — safe under serializeGoalWrite
// against a double-click), then APPEND a separate decision fact referencing the
// proposal by proposalId. Never mutates the proposed element (shape (b)).
async function decideProposal({ proposalId, decision, reason }) {
  const concept = await resolveProposalConcept();
  if (concept.error) {
    // No concept means no proposal was ever made — it cannot be decided.
    return { success: false, refusal: 'proposal-not-found', error: `no proposal has the id '${proposalId}'.` };
  }
  const { records } = await fetchProposals(concept.headerUuid);
  const proposed = records.find((r) => r.type === 'proposed' && r.slug === proposalId);
  if (!proposed) {
    return { success: false, refusal: 'proposal-not-found', error: `no proposal has the id '${proposalId}'.` };
  }
  const alreadyDecided = records.some((r) => (r.type === 'approved' || r.type === 'skipped') && r.proposalId === proposalId);
  if (alreadyDecided) {
    return { success: false, refusal: 'already-decided', error: `proposal '${proposalId}' has already been decided — a decision is final (propose it again as a new fact if needed).` };
  }
  const today = new Date().toISOString().slice(0, 10);
  const summary = decision === 'skipped' ? reason : proposed.whyNow;
  const section = { type: decision, goal: proposed.goal, proposalId, summary, happenedOn: today };
  if (decision === 'skipped') section.reason = reason;
  const { uuid, slug } = await mintProposalElement({
    headerUuid: concept.headerUuid, supersetUuid: concept.supersetUuid, label: `${decision}-${proposed.goal}`, section,
  });
  return { success: true, result: decision, decision: { uuid, slug, proposalId, goal: proposed.goal, type: decision } };
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
    const dTag = dtag.childDTag(trimName, biosPropertyUuid);
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
        MATCH (rt:NostrEvent) WHERE rt.name = 'is a property of' OR rt.name = '${REL.PROPERTY_MEMBERSHIP}'
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
//
//   IDEMPOTENT: Uses deterministic d-tags (propertyName + hash of parent UUID).
//   Re-running produces the same event IDs → strfry replaces events (kind 39999
//   is replaceable), Neo4j MERGEs on UUID. Safe to call multiple times.
//
//   Property tree root: Primary Property node (if exists), else JSON Schema node.
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
      OPTIONAL MATCH (pp:Property)-[:${REL.CORE_NODE_PRIMARY_PROPERTY}]->(h)
      RETURN h.uuid AS headerUuid, h.name AS headerName,
             js.uuid AS schemaUuid, js.name AS schemaName,
             head(collect(jt.value)) AS schemaJson,
             pg.uuid AS propGraphUuid, pg.name AS propGraphName,
             pp.uuid AS primaryUuid, pp.name AS primaryName
      LIMIT 1
    `, { concept });

    if (rows.length === 0) return res.json({ success: false, error: `Concept "${concept}" not found` });
    const { schemaUuid, schemaName, schemaJson, propGraphUuid, propGraphName, primaryUuid, primaryName } = rows[0];
    if (!schemaUuid) return res.json({ success: false, error: `Concept "${concept}" has no JSON Schema node` });

    // Parse the schema (supports word-wrapper, legacy flat, and LMDB refs)
    let schema;
    try {
      let rawSchema = schemaJson;
      // Resolve LMDB ref if needed
      if (typeof rawSchema === 'string' && rawSchema.startsWith('lmdb:')) {
        const { resolveValue } = require('../../lib/tapestry-resolve');
        rawSchema = resolveValue(rawSchema);
      }
      const parsed = typeof rawSchema === 'string' ? JSON.parse(rawSchema) : rawSchema;
      // Word-wrapper format: { word: {...}, jsonSchema: {...} }
      schema = (parsed && parsed.jsonSchema) ? parsed.jsonSchema : parsed;
    } catch {
      return res.json({ success: false, error: 'Could not parse JSON Schema' });
    }
    if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
      return res.json({ success: false, error: 'JSON Schema has no properties defined' });
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

    // Deterministic d-tag: propertyName + 8-char hash of parent UUID.
    // Makes generate-property-tree idempotent: re-running produces the same
    // d-tags → same UUIDs → strfry replaces events, Neo4j MERGEs on UUID.
    function deterministicDTag(propName, parentUuid) {
      const hash = crypto.createHash('sha256').update(parentUuid).digest('hex').slice(0, 8);
      return `${deriveSlug(propName)}-${hash}`;
    }

    async function createPropertiesRecursive(properties, requiredList, parentUuid, parentSlug) {
      for (const [propName, propDef] of Object.entries(properties)) {
        const pType = propDef.type || 'string';
        const pDesc = propDef.description || '';
        const isRequired = (requiredList || []).includes(propName);

        // Build property JSON (word-wrapper format)
        const propSlug = deriveSlug(propName);
        const propertyJson = {
          word: {
            slug: propSlug,
            name: propName,
            wordTypes: ['word', 'property'],
          },
          property: {
            name: propName,
            type: pType,
            description: pDesc,
            required: isRequired,
          },
        };

        // Deterministic d-tag: idempotent across re-runs
        const dTag = deterministicDTag(propName, parentUuid);
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

    // Use primary property as root parent if it exists, otherwise fall back to schema
    const rootParentUuid = primaryUuid || schemaUuid;
    const rootParentName = primaryName || schemaName;
    const rootParentSlug = deriveSlug(rootParentName);

    // If there's a primary property and the schema has exactly one top-level property
    // that is an object (the wrapper), skip it and wire its children to the primary property.
    const topLevelKeys = Object.keys(schema.properties);
    const singleWrapper = topLevelKeys.length === 1 && schema.properties[topLevelKeys[0]]?.type === 'object';

    if (primaryUuid && singleWrapper) {
      const wrapperDef = schema.properties[topLevelKeys[0]];
      // Wire the wrapper's children directly to the primary property
      await createPropertiesRecursive(
        wrapperDef.properties || {},
        wrapperDef.required,
        rootParentUuid,
        rootParentSlug
      );
    } else {
      await createPropertiesRecursive(schema.properties, schema.required, rootParentUuid, rootParentSlug);
    }

    // ── Unhook orphaned properties ──
    // Find all property nodes in the tree that were NOT created/updated in this run.
    // Remove their IS_A_PROPERTY_OF and HAS_ELEMENT edges (don't delete the events).
    {
      const createdUuids = new Set(created.map(c => c.uuid));
      // Also keep the primary property
      if (primaryUuid) createdUuids.add(primaryUuid);

      // Find all properties currently wired into this concept's tree
      const treeRoot = primaryUuid || schemaUuid;
      const allInTree = await runCypher(`
        MATCH (p:Property)-[:${REL.PROPERTY_MEMBERSHIP}*1..10]->(root:NostrEvent {uuid: $treeRoot})
        WHERE NOT p.uuid ENDS WITH '-primary-property'
        RETURN DISTINCT p.uuid AS uuid, p.name AS name
      `, { treeRoot });

      const orphans = allInTree.filter(p => !createdUuids.has(p.uuid));

      if (orphans.length > 0) {
        for (const orphan of orphans) {
          // Remove IS_A_PROPERTY_OF edge (unhook from tree)
          await writeCypher(`
            MATCH (p:NostrEvent {uuid: $uuid})-[r:${REL.PROPERTY_MEMBERSHIP}]->()
            DELETE r
          `, { uuid: orphan.uuid });

          // Remove HAS_ELEMENT edge from property superset (if any)
          await writeCypher(`
            MATCH ()-[r:${REL.CLASS_THREAD_TERMINATION}]->(p:NostrEvent {uuid: $uuid})
            DELETE r
          `, { uuid: orphan.uuid });
        }
        console.log(`[generate-property-tree] Unhooked ${orphans.length} orphaned properties: ${orphans.map(o => o.name).join(', ')}`);
      }
    }

    // Update property tree graph JSON
    if (propGraphUuid) {
      // Look up the IS_A_PROPERTY_OF relationship type UUID if it exists
      const relTypeRows = await runCypher(`
        MATCH (rt:NostrEvent) WHERE rt.name = 'is a property of' OR rt.name = '${REL.PROPERTY_MEMBERSHIP}'
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
//     2. Update the concept graph JSON to include the new node
// ══════════════════════════════════════════════════════════════
async function handleAddNodeAsElement(req, res) {
  try {
    const { conceptUuid, nodeUuid } = req.body || {};
    if (!conceptUuid) return res.status(400).json({ success: false, error: 'Missing conceptUuid' });
    if (!nodeUuid) return res.status(400).json({ success: false, error: 'Missing nodeUuid' });

    // Look up concept header, superset, and concept graph
    const rows = await runCypher(`
      MATCH (h:NostrEvent {uuid: $conceptUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
      OPTIONAL MATCH (ctg)-[:${REL.CORE_NODE_CONCEPT_GRAPH}]->(h)
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

    // 2. Update concept graph JSON
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
      const propertyConceptUuid = firmware.conceptUuid('property');
      const dTag = dtag.childDTag(propName, propertyConceptUuid);
      const propEvent = signAndFinalize({
        kind: 39999, content: '',
        tags: [
          ['d', dTag], ['name', propName], ['type', pType],
          ['z', propertyConceptUuid],
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
//   Body: { name, description?, parentUuid: "<uuid of parent Set or Superset>", parent?: "<concept name>" }
//   Creates a Set node + IS_A_SUPERSET_OF from the chosen parent node.
//   parentUuid takes precedence; falls back to parent (concept name) → its Superset.
// ══════════════════════════════════════════════════════════════
async function handleCreateSet(req, res) {
  try {
    const { name, description, parentUuid, parent, dTag: explicitDTag } = req.body || {};
    if (!name) return res.status(400).json({ success: false, error: 'Missing set name' });
    if (!parentUuid && !parent) return res.status(400).json({ success: false, error: 'Missing parentUuid or parent concept name' });

    // Resolve parent node
    let resolvedParentUuid, parentName;

    if (parentUuid) {
      // Direct UUID — verify it exists
      const rows = await runCypher(`
        MATCH (n:NostrEvent {uuid: $uuid})
        RETURN n.uuid AS uuid, n.name AS name
        LIMIT 1
      `, { uuid: parentUuid });
      if (!rows.length) return res.json({ success: false, error: `Parent node "${parentUuid}" not found` });
      resolvedParentUuid = rows[0].uuid;
      parentName = rows[0].name;
    } else {
      // Legacy: find concept's Superset by name
      const parentRows = await runCypher(`
        MATCH (h:ListHeader)-[:HAS_TAG]->(t:NostrEventTag {type: 'names'})
        WHERE toLower(t.value) = toLower($name)
        MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(s:Superset)
        OPTIONAL MATCH (s)-[:HAS_TAG]->(n:NostrEventTag {type: 'name'})
        RETURN s.uuid AS supersetUuid, n.value AS supersetName, t.value AS concept
        LIMIT 1
      `, { name: parent });
      if (!parentRows.length) return res.json({ success: false, error: `Concept "${parent}" not found or has no Superset` });
      resolvedParentUuid = parentRows[0].supersetUuid;
      parentName = parentRows[0].supersetName;
    }

    // Create Set event (deterministic d-tag)
    const dTag = explicitDTag || (req.body.random ? randomDTag() : dtag.childDTag(name, resolvedParentUuid, req.body.nonce));
    const setUuid = `39999:${firmware.getTAPubkey()}:${dTag}`;

    // Check if this set already exists (idempotent for firmware reinstalls)
    const existingRows = await runCypher(
      `MATCH (n:NostrEvent {uuid: $uuid}) RETURN n.uuid AS uuid LIMIT 1`,
      { uuid: setUuid }
    );
    if (existingRows.length > 0) {
      return res.json({
        success: true,
        message: `Set "${name}" already exists`,
        set: { name, uuid: setUuid, description, alreadyExisted: true },
        parent: { uuid: resolvedParentUuid, name: parentName },
      });
    }

    const tags = [
      ['d', dTag],
      ['name', name],
      ['z', firmware.conceptUuid('set') || ''],
      // ADR 0011 §"Emission in handleCreateSet": child-claims-parent canonical
      // `s` tag (IS_A_SUPERSET_OF-inverse). Single-char, relay-indexed by
      // default per NIP-01. Dual-emit policy: the relationship-descriptor
      // event below is preserved during the back-compat cycle (R2 regression-
      // guards both encodings until a future ADR ratifies the cutover).
      ['s', resolvedParentUuid],
    ];
    if (description) tags.push(['description', description]);

    const setEvent = signAndFinalize({ kind: 39999, content: '', tags });
    await publishToStrfry(setEvent);
    await importEventDirect(setEvent, setUuid);
    await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:Set`, { uuid: setUuid });

    // Create IS_A_SUPERSET_OF relationship
    const relEvent = signAndFinalize({
      kind: 39999, content: '',
      tags: [
        ['d', randomDTag()],
        ['name', `${parentName} ${REL.CLASS_THREAD_PROPAGATION} ${name}`],
        ['z', firmware.conceptUuid('relationship')],
        ['nodeFrom', resolvedParentUuid],
        ['nodeTo', setUuid],
        ['relationshipType', REL.CLASS_THREAD_PROPAGATION],
      ],
    });
    await publishToStrfry(relEvent);
    await importEventDirect(relEvent, `39999:${relEvent.pubkey}:${relEvent.tags.find(t=>t[0]==='d')[1]}`);
    await writeCypher(`
      MATCH (a:NostrEvent {uuid: $from}), (b:NostrEvent {uuid: $to})
      MERGE (a)-[:${REL.CLASS_THREAD_PROPAGATION}]->(b)
    `, { from: resolvedParentUuid, to: setUuid });

    return res.json({
      success: true,
      message: `Set "${name}" created under "${parentName}"`,
      set: { name, uuid: setUuid, description },
      parent: { uuid: resolvedParentUuid, name: parentName },
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

    // ── Dual-emit (ADR 0011 §"Emission in handleAddToSet"): re-publish the
    // item event with the canonical child-claims-parent `n` tag appended
    // (relay-indexed HAS_ELEMENT-inverse). Locally-authored items only;
    // foreign-authored items cannot be re-signed → log + skip the n-tag
    // republish (the descriptor event below still fires). Idempotency at
    // this site is guaranteed by the early-return existing-edge check
    // above (line 3013-3017) — handleAddToSet only runs for new memberships.
    const localTApubkey = firmware.getTAPubkey();
    const itemParts = item.uuid.split(':');
    const itemAuthor = itemParts.length >= 2 ? itemParts[1] : null;
    if (itemAuthor === localTApubkey) {
      try {
        const itemKind = parseInt(itemParts[0], 10);
        const itemDTag = itemParts.slice(2).join(':');
        const existingEv = await new Promise((resolve, reject) => {
          const filter = JSON.stringify({ kinds: [itemKind], authors: [itemAuthor], '#d': [itemDTag] });
          const safeFilter = filter.replace(/'/g, "'\\''");
          exec(`strfry scan '${safeFilter}'`, { maxBuffer: 4 * 1024 * 1024 }, (error, stdout) => {
            if (error) return reject(error);
            const line = String(stdout).trim().split('\n')[0];
            if (!line) return resolve(null);
            try { resolve(JSON.parse(line)); } catch (e) { reject(e); }
          });
        });
        if (existingEv) {
          // Build replacement with `n` tag appended. Preserve existing kind /
          // d-tag / content / all tags (replaceable event replaces by d-tag).
          const newTags = [...(existingEv.tags || []), ['n', s.uuid]];
          const replacement = signAndFinalize({
            kind: itemKind,
            content: existingEv.content || '',
            tags: newTags,
          });
          await publishToStrfry(replacement);
          await importEventDirect(replacement, item.uuid);
        } else {
          console.warn(`[normalize/add-to-set] item ${item.uuid} not found in strfry — skipping n-tag republish (descriptor event still emitted; ADR 0011 §"Emission in handleAddToSet")`);
        }
      } catch (err) {
        console.warn(`[normalize/add-to-set] n-tag republish failed for ${item.uuid}: ${err.message} — descriptor event still emitted (ADR 0011 dual-emit graceful)`);
      }
    } else {
      console.warn(`[normalize/add-to-set] item ${item.uuid} authored by ${itemAuthor} (not local TA ${localTApubkey}) — skipping n-tag republish per ADR 0011; descriptor event still emitted`);
    }

    // Create HAS_ELEMENT event (descriptor — ADR 0011 dual-emit policy: this
    // remains during the back-compat cycle; the cutover ADR will eventually
    // deprecate it. R2 regression-guards both descriptor literals below).
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

// ══════════════════════════════════════════════════════════════
// Priority signals (second-brain #7, ADR 0007). The owner's pairwise choices
// — "solve one today: which?" — recorded as dated, attributed, framing-tagged
// facts on a new runtime-created concept. Gated first, validated before any
// write, serialized through serializeGoalWrite, local-only (publishToStrfry +
// importEventDirect — never published to the wider network). The concept
// self-bootstraps on the first signal (ADR 0007 d9; never firmware-seeded).
// A signal is BORN FINAL (PRD §7.2): single shape, no lifecycle, no decision,
// no dedup — the same pair may be chosen again (each a new dated fact, the
// corpus accumulating, reversals included); every write mints a fresh element
// under a random d-tag and nothing on this path ever regenerates or re-signs.
// The framing is SERVER-STAMPED (ADR 0007 d8): a caller-supplied framing is
// the §7.6 swap hatch, deliberately not built in v1.
// ══════════════════════════════════════════════════════════════

const SIGNAL_CONCEPT_NAME = 'tapestry priority signal';
const SIGNAL_FRAMING_V1 = 'solve-one-today';  // ADR 0007 d8/d13: the v1 framing tag, stamped on every signal.

// The Priority Signal schema (ADR 0007 d1) — a single concept-object wrapper so
// the save-schema primary-property fold (ADR 0003 d8) has its one top-level
// properties key; `required` is mirrored into the primary-property node. The
// reason is the ONE optional field (AC2: judged-by, judged-on, and the framing
// are all present on every signal).
const SIGNAL_SCHEMA = {
  type: 'object',
  properties: {
    prioritySignal: {
      type: 'object',
      title: 'Priority Signal',
      required: ['name', 'slug', 'description', 'prefers', 'over', 'judgedBy', 'judgedOn', 'framing'],
      properties: {
        name: { type: 'string', description: 'a short label for this signal, in plain words' },
        slug: { type: 'string', description: 'stable identity for this signal (unique per element)' },
        description: { type: 'string', description: 'a short description (the choice, with both goals named)' },
        prefers: { type: 'string', description: 'the slug of the goal the owner chose' },
        over: { type: 'string', description: 'the slug of the goal passed over in this choice' },
        reason: { type: 'string', description: 'the optional one-line reason for the choice' },
        judgedBy: { type: 'string', description: 'who made the choice (the owner in v1)' },
        judgedOn: { type: 'string', description: 'the date the choice was made' },
        framing: { type: 'string', description: 'the framing that produced this signal (which question was asked)' },
      },
      'x-tapestry': { unique: ['slug'] },
    },
  },
  required: ['prioritySignal'],
};

// Resolve the runtime-created Priority Signal concept's header + superset
// (mirrors resolveProposalConcept; the header match tolerates a freshly-created
// concept's labels).
async function resolveSignalConcept() {
  const rows = await runCypher(`
    MATCH (h:NostrEvent)
    WHERE (h:ListHeader OR h:ClassThreadHeader OR h:ConceptHeader) AND h.kind IN [9998, 39998]
      AND h.name = $concept
    OPTIONAL MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
    RETURN h.uuid AS headerUuid, sup.uuid AS supersetUuid
    LIMIT 1
  `, { concept: SIGNAL_CONCEPT_NAME });
  if (rows.length === 0) return { error: `Concept "${SIGNAL_CONCEPT_NAME}" not found` };
  if (!rows[0].supersetUuid) return { error: `Concept "${SIGNAL_CONCEPT_NAME}" has no Superset node.` };
  return { headerUuid: rows[0].headerUuid, supersetUuid: rows[0].supersetUuid };
}

// Self-bootstrap the Priority Signal concept (ADR 0007 d9): idempotent — a
// structural copy of ensureProposalConcept. create-concept ("already exists" →
// success) + save-schema (folds the primary-property reconcile) run ONLY when
// the concept is absent, so there is no per-write churn after the first signal.
// §5.9: a fresh instance self-provisions with no manual step; never
// firmware-seeded.
async function ensureSignalConcept() {
  const existing = await resolveSignalConcept();
  if (!existing.error) return existing;
  await invokeNormalizeHandler(handleCreateConcept, {
    name: SIGNAL_CONCEPT_NAME,
    description: 'A dated, append-only record of the owner choosing one goal over another — who judged, when, and under which framing. Never edited; a changed mind is a new signal.',
  });
  await invokeNormalizeHandler(handleSaveSchema, { concept: SIGNAL_CONCEPT_NAME, schema: SIGNAL_SCHEMA });
  const provisioned = await resolveSignalConcept();
  if (provisioned.error) {
    throw new Error(`ensureSignalConcept failed to provision the concept: ${provisioned.error}`);
  }
  return provisioned;
}

// The append-only Priority Signal mint (ADR 0007 d2): a fresh RANDOM d-tag each
// call, so no write can ever MERGE over a prior signal (the
// mintProposalElement idiom — reversals and repeat pairs are each their own
// fact) and nothing is re-signed. Builds the json section from the caller's
// fields plus the derived unique slug; returns the minted element's uuid + slug.
async function mintSignalElement({ headerUuid, supersetUuid, label, section }) {
  const nonce = randomDTag();
  const dTag = dtag.childDTag(label, headerUuid, nonce);
  const slug = `${dtag.slug(label)}-${nonce}`;
  const recordSection = { name: `preferred: ${section.prefers} over ${section.over}`, slug, ...section };
  const tags = [
    ['d', dTag],
    ['name', recordSection.name],
    ['z', headerUuid],
    ['json', JSON.stringify({ prioritySignal: recordSection })],
  ];
  const evt = signAndFinalize({ kind: 39999, tags, content: '' });
  const elemUuid = `39999:${evt.pubkey}:${dTag}`;
  await publishToStrfry(evt);
  await importEventDirect(evt, elemUuid);
  await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:ListItem, n.slug = $slug`, { uuid: elemUuid, slug });
  await writeCypher(`
    MATCH (sup:NostrEvent {uuid: $supersetUuid}), (elem:NostrEvent {uuid: $elemUuid})
    MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(elem)
  `, { supersetUuid, elemUuid });
  return { uuid: elemUuid, slug };
}

async function handleRecordPrioritySignal(req, res) {
  try {
    const { isOwner } = require('../../middleware/auth');
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    const { prefers, over, reason } = req.body || {};
    if (!prefers || typeof prefers !== 'string' || !prefers.trim()) {
      return res.status(400).json({ success: false, error: 'Missing the chosen goal slug' });
    }
    if (!over || typeof over !== 'string' || !over.trim()) {
      return res.status(400).json({ success: false, error: 'Missing the passed-over goal slug' });
    }
    if (reason != null && typeof reason !== 'string') {
      return res.status(400).json({ success: false, error: 'The reason must be a short sentence when given' });
    }
    const result = await serializeGoalWrite(() => recordPrioritySignal({
      prefersSlug: prefers.trim(),
      overSlug: over.trim(),
      reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
    }));
    return res.json(result);
  } catch (error) {
    console.error('normalize/record-priority-signal error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function recordPrioritySignal({ prefersSlug, overSlug, reason }) {
  // A choice needs two different goals (AC1) — refused before anything is read.
  if (prefersSlug === overSlug) {
    return { success: false, refusal: 'same-goal', error: `a choice needs two different goals — '${prefersSlug}' is on both sides.` };
  }
  const { resolveDecomposition } = require('../../lib/brain/goals');
  // Both goals must resolve to existing, unambiguous goals. NO standing
  // requirement (ADR 0007 d4, operator-ratified): the owner is teaching
  // relative value, not certifying execution-readiness — a parent or captured
  // goal may be preferred or passed over.
  const goalConcept = await resolveGoalConcept();
  if (goalConcept.error) return { success: false, error: goalConcept.error };
  const { records: goalRecords } = await fetchGoalRecords(goalConcept.headerUuid);
  const resolved = resolveDecomposition(goalRecords);
  const bySlug = (slug) => resolved.filter((g) => g.slug === slug);
  let prefersGoal = null;
  let overGoal = null;
  for (const [slug, which] of [[prefersSlug, 'prefers'], [overSlug, 'over']]) {
    const matches = bySlug(slug);
    if (matches.length === 0) {
      return { success: false, refusal: 'goal-not-found', error: `no goal has the slug '${slug}' — a choice must name existing goals.` };
    }
    if (matches.length > 1) {
      return { success: false, refusal: 'ambiguous-slug', error: `${matches.length} goals share the slug '${slug}' — refusing to guess which is meant.` };
    }
    if (which === 'prefers') prefersGoal = matches[0]; else overGoal = matches[0];
  }

  // Provision the concept if this is the first signal ever (ADR 0007 d9).
  const concept = await ensureSignalConcept();
  const today = new Date().toISOString().slice(0, 10);
  const section = {
    description: `chose "${prefersGoal.name || prefersSlug}" over "${overGoal.name || overSlug}"`,
    prefers: prefersSlug,
    over: overSlug,
    judgedBy: 'owner',              // ADR 0007 d7: v1's single judge, instance-relative.
    judgedOn: today,
    framing: SIGNAL_FRAMING_V1,     // ADR 0007 d8: server-stamped, never caller-supplied.
  };
  if (reason) section.reason = reason;

  const { uuid, slug } = await mintSignalElement({
    headerUuid: concept.headerUuid, supersetUuid: concept.supersetUuid, label: `preferred-${prefersSlug}`, section,
  });
  return { success: true, result: 'recorded', signal: { uuid, slug, prefers: prefersSlug, over: overSlug } };
}

// ══════════════════════════════════════════════════════════════
// Second Brain export/restore (second-brain #8, ADR 0008)
//   POST /api/normalize/restore-brain         { artifact }
//   POST /api/normalize/record-restore-drill  { exportTakenOn, outcome, target? }
//   Restore re-mints an export artifact's sections VERBATIM under THIS
//   instance's own identity: goals under name-derived d-tags (the
//   createChildGoal idiom), records under fresh nonce d-tags (the
//   mint*Element idiom) — every slug-based cross-record link survives
//   byte-for-byte. ALL collision checks precede ALL writes (the pure
//   planRestore core); a refusal is loud, named, and writes NOTHING.
//   The drill journal is the FIFTH runtime-created append-only concept
//   (born final, the signal precedent). Writes ride the module's own
//   local-only machinery — nothing publishes outward (§7.4).
// ══════════════════════════════════════════════════════════════

// The goal concept's schema for ensureGoalConcept (ADR 0008 d8) — the live
// concept's field set (ADR 0001/0003), carried here so a truly fresh target
// (which lacks ALL five brain concepts — the ADR 0001 recon correction) can
// self-provision before the first restored goal mints. On the reference
// instance the concept already exists and the ensure is a no-op.
const GOAL_SCHEMA = {
  type: 'object',
  properties: {
    tapestryOwnerGoal: {
      type: 'object',
      title: 'Tapestry Owner Goal',
      required: ['name', 'slug', 'description'],
      properties: {
        name: { type: 'string', description: 'The name of the tapestry owner goal' },
        slug: { type: 'string', description: 'A unique kebab-case identifier for this tapestry owner goal' },
        description: { type: 'string', description: 'A brief description of the tapestry owner goal' },
        origin: { type: 'string', description: "where this goal came from, in plain words (e.g. 'owner, in conversation')" },
        capturedOn: { type: 'string', description: 'the date the goal was captured, ISO 8601 (YYYY-MM-DD); stable across re-signs' },
        deliverable: { type: 'string', description: "what 'done' produces, in the owner's words" },
        boundary: { type: 'string', description: "what pursuing this goal may not touch, in the owner's words" },
        parent: { type: 'string', description: 'the slug of the parent goal this goal is part of (one parent at most)' },
        prompt: { type: 'string', description: 'A markdown file that is intended to serve as the prompt given to an agent at the start of a session, the goal of which is to achieve the stated goal.' },
        chanceOfSuccess: { type: 'number', description: 'A number between 0 and 100 which indicates the estimated probability of success if an agent were to attempt to complete this goal without any human input. The default is 0, if not otherwise estimated.' },
        needsHumanInput: { type: 'boolean', default: false, description: 'Whether this goal cannot be carried forward without the owner answering something. Absent means false.' },
        needsBreakdown: { type: 'boolean', default: false, description: 'Whether this goal is judged too large to work on as it stands and should be broken into smaller goals. Absent means false.' },
      },
      'x-tapestry': { unique: ['name', 'slug'] },
    },
  },
  required: ['tapestryOwnerGoal'],
};

// Self-bootstrap the goal concept (ADR 0008 d8) — closing the ADR 0001
// bootstrap gap: idempotent, a structural copy of ensureSignalConcept.
// create-concept ("already exists" → success) + save-schema run ONLY when the
// concept is absent. §5.9: a fresh instance self-provisions with no manual
// step; never firmware-seeded.
async function ensureGoalConcept() {
  const existing = await resolveGoalConcept();
  if (!existing.error) return existing;
  await invokeNormalizeHandler(handleCreateConcept, {
    name: GOAL_CONCEPT_NAME,
    description: 'A goal the owner captured in plain words — its name, statement, origin, capture date, its place in the decomposition, and (for viable leaves) the deliverable and boundary. Standing is derived from dated facts, never stored.',
  });
  await invokeNormalizeHandler(handleSaveSchema, { concept: GOAL_CONCEPT_NAME, schema: GOAL_SCHEMA });
  const provisioned = await resolveGoalConcept();
  if (provisioned.error) {
    throw new Error(`ensureGoalConcept failed to provision the concept: ${provisioned.error}`);
  }
  return provisioned;
}

// One family's CURRENT records on this instance (the explicit ∪ implicit
// union, parsed through the family's own core) — the restore pre-check's
// input. Tolerant of an absent concept (no header ⇒ no rows ⇒ []). These
// have a real consumer here (the 0007 review's fetchSignals lesson).
async function fetchFamilyRecords(headerUuid, parseRow) {
  const [explicitRows, implicitRows] = await Promise.all([
    runCypher(`
      MATCH (h:NostrEvent {uuid: $headerUuid})-[:${REL.CLASS_THREAD_INITIATION}]->(s:Superset)
      MATCH (s)-[:${REL.CLASS_THREAD_PROPAGATION}*0..10]->(ss)-[:${REL.CLASS_THREAD_TERMINATION}]->(e:NostrEvent)
      WHERE e.kind = 39999
      OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
      WITH DISTINCT e, head(collect(j.value)) AS json
      RETURN e.uuid AS uuid, e.name AS name, e.created_at AS createdAt, json AS json
    `, { headerUuid }),
    runCypher(`
      MATCH (e:NostrEvent)-[:HAS_TAG]->(:NostrEventTag {type: 'z', value: $headerUuid})
      WHERE e.kind = 39999
      OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
      WITH DISTINCT e, head(collect(j.value)) AS json
      RETURN e.uuid AS uuid, e.name AS name, e.created_at AS createdAt, json AS json
    `, { headerUuid }),
  ]);
  const rowByUuid = new Map();
  for (const row of [...explicitRows, ...implicitRows]) {
    if (row && row.uuid && !rowByUuid.has(row.uuid)) rowByUuid.set(row.uuid, row);
  }
  return [...rowByUuid.values()].map(parseRow).filter(Boolean);
}

// Mint one RESTORED goal (ADR 0008 d7): the artifact's section VERBATIM —
// capturedOn is NOT restamped, out-of-contract fields ride along — under the
// NAME-DERIVED d-tag (the createChildGoal idiom; deterministic per instance).
// The planRestore pre-check already refused every collision, so the MERGE
// hazard the createChildGoal guard names cannot occur here.
async function mintRestoredGoal({ headerUuid, supersetUuid, name, section }) {
  const dTag = dtag.childDTag(name, headerUuid);
  const tags = [
    ['d', dTag],
    ['name', name],
    ['z', headerUuid],
    ['json', JSON.stringify({ tapestryOwnerGoal: section })],
  ];
  const evt = signAndFinalize({ kind: 39999, tags, content: '' });
  const elemUuid = `39999:${evt.pubkey}:${dTag}`;
  await publishToStrfry(evt);
  await importEventDirect(evt, elemUuid);
  await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:ListItem, n.slug = $slug`, { uuid: elemUuid, slug: section.slug });
  await writeCypher(`
    MATCH (sup:NostrEvent {uuid: $supersetUuid}), (elem:NostrEvent {uuid: $elemUuid})
    MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(elem)
  `, { supersetUuid, elemUuid });
  return { uuid: elemUuid, slug: section.slug };
}

// Mint one RESTORED record element (ADR 0008 d7): the artifact's section
// VERBATIM under a fresh RANDOM d-tag (the mint*Element idiom — no write can
// ever MERGE over an existing record) with this instance's own signature.
async function mintRestoredElement({ headerUuid, supersetUuid, familyKey, name, section }) {
  const nonce = randomDTag();
  const dTag = dtag.childDTag(name, headerUuid, nonce);
  const tags = [
    ['d', dTag],
    ['name', name],
    ['z', headerUuid],
    ['json', JSON.stringify({ [familyKey]: section })],
  ];
  const evt = signAndFinalize({ kind: 39999, tags, content: '' });
  const elemUuid = `39999:${evt.pubkey}:${dTag}`;
  await publishToStrfry(evt);
  await importEventDirect(evt, elemUuid);
  await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:ListItem, n.slug = $slug`, { uuid: elemUuid, slug: section.slug });
  await writeCypher(`
    MATCH (sup:NostrEvent {uuid: $supersetUuid}), (elem:NostrEvent {uuid: $elemUuid})
    MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(elem)
  `, { supersetUuid, elemUuid });
  return { uuid: elemUuid, slug: section.slug };
}

async function handleRestoreBrain(req, res) {
  try {
    const { isOwner } = require('../../middleware/auth');
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    const { artifact } = req.body || {};
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
      return res.status(400).json({ success: false, error: 'Missing artifact' });
    }
    // Shape problems are 400s (ADR 0008 d6); domain refusals come back from
    // the core as HTTP-200 {success:false, refusal, ...} — the epic contract.
    const { validateArtifact } = require('../../lib/brain/export');
    const shape = validateArtifact(artifact);
    if (!shape.ok) {
      return res.status(400).json({ success: false, error: shape.error });
    }
    const result = await serializeGoalWrite(() => restoreBrain({ artifact }));
    return res.json(result);
  } catch (error) {
    console.error('normalize/restore-brain error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function restoreBrain({ artifact }) {
  const { parseGoalRow } = require('../../lib/brain/goals');
  const { parseResourceRow } = require('../../lib/brain/resources');
  const { parseWorkRecordRow } = require('../../lib/brain/work-records');
  const { parseProposalRow } = require('../../lib/brain/proposals');
  const { parseSignalRow } = require('../../lib/brain/signals');
  const { planRestore } = require('../../lib/brain/restore');
  const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
  const ta = getOwnerAssistantPubkey();
  if (!ta) return { success: false, error: 'Assistant identity unavailable' };

  // The target's CURRENT families — absence-tolerant (a fresh target answers
  // [] everywhere). Header handles are constructible from slugs; nothing here
  // requires the concepts to exist yet.
  const goalHeaderUuid = `39998:${ta}:tapestry-owner-goal`;
  const existing = {
    goals: await fetchFamilyRecords(goalHeaderUuid, parseGoalRow),
    resources: await fetchFamilyRecords(`39998:${ta}:tapestry-external-resource`, parseResourceRow),
    workRecords: await fetchFamilyRecords(`39998:${ta}:tapestry-work-record`, parseWorkRecordRow),
    proposals: await fetchFamilyRecords(`39998:${ta}:tapestry-proposal`, parseProposalRow),
    signals: await fetchFamilyRecords(`39998:${ta}:tapestry-priority-signal`, parseSignalRow),
  };

  // ALL checks precede ALL writes (ADR 0008 d5): the pure core computes every
  // collision — the goal triple (name/slug/derived-d-tag) plus family-scoped
  // record slugs — and a refusal lists every one of them.
  const plan = planRestore(artifact, existing, {
    deriveGoalDTag: (name) => dtag.childDTag(name, goalHeaderUuid),
  });
  if (!plan.ok) {
    // The named refusals (ADR 0008 d5): 'goal-collides' | 'record-collides'.
    const kind = plan.refusal === 'record-collides' ? 'record' : 'goal';
    return {
      success: false,
      refusal: plan.refusal,
      collisions: plan.collisions,
      error: `the artifact collides with ${plan.collisions.length} existing ${kind}${plan.collisions.length === 1 ? '' : 's'} on this instance — nothing was restored. Remove the colliding entries or use a different target.`,
    };
  }

  // Ensure concepts lazily — only families that actually mint (ADR 0008 d8:
  // the self-provision-on-first-content semantic; ensureGoalConcept closes
  // the ADR 0001 gap for truly fresh targets).
  const FAMILY_TO_KEY = {
    goals: 'tapestryOwnerGoal',
    resources: 'externalResource',
    workRecords: 'workRecord',
    proposals: 'proposal',
    signals: 'prioritySignal',
  };
  const FAMILY_ENSURE = {
    goals: ensureGoalConcept,
    resources: ensureResourceConcept,
    workRecords: ensureWorkRecordConcept,
    proposals: ensureProposalConcept,
    signals: ensureSignalConcept,
  };
  const concepts = {};
  const restored = { goals: 0, resources: 0, workRecords: 0, proposals: 0, signals: 0 };
  for (const mint of plan.mints) {
    if (!concepts[mint.family]) concepts[mint.family] = await FAMILY_ENSURE[mint.family]();
    const { headerUuid, supersetUuid } = concepts[mint.family];
    if (mint.family === 'goals') {
      await mintRestoredGoal({ headerUuid, supersetUuid, name: mint.name, section: mint.section });
    } else {
      await mintRestoredElement({
        headerUuid, supersetUuid, familyKey: FAMILY_TO_KEY[mint.family], name: mint.name, section: mint.section,
      });
    }
    restored[mint.family] += 1;
  }
  return { success: true, result: 'restored', restored };
}

// ── The drill journal — the FIFTH runtime-created append-only concept ────
// (ADR 0008 d9). Born final, the signal precedent: a drill record has no
// lifecycle, no dedup, no natural key; BOTH outcomes are journaled.

const DRILL_CONCEPT_NAME = 'tapestry restore drill';
const DRILL_OUTCOMES = ['matched', 'did-not-match'];
const DEFAULT_DRILL_TARGET = 'a fresh scratch instance';

const DRILL_SCHEMA = {
  type: 'object',
  properties: {
    restoreDrill: {
      type: 'object',
      title: 'Restore Drill',
      required: ['name', 'slug', 'description', 'exportTakenOn', 'drilledOn', 'outcome', 'target', 'performedBy'],
      properties: {
        name: { type: 'string', description: 'a short label for this drill record, in plain words' },
        slug: { type: 'string', description: 'stable identity for this drill record (unique per record)' },
        description: { type: 'string', description: 'one plain sentence: which export was drilled, where, and how it came out' },
        exportTakenOn: { type: 'string', description: 'the date of the export that was drilled' },
        drilledOn: { type: 'string', description: 'the date the drill ran' },
        outcome: { type: 'string', description: "how the drill came out — 'matched' or 'did-not-match'" },
        target: { type: 'string', description: 'the scratch environment the export was restored to, in plain words' },
        performedBy: { type: 'string', description: 'who performed the drill (the owner in v1)' },
      },
      'x-tapestry': { unique: ['slug'] },
    },
  },
  required: ['restoreDrill'],
};

// Resolve the runtime-created Restore Drill concept's header + superset
// (mirrors resolveSignalConcept).
async function resolveRestoreDrillConcept() {
  const rows = await runCypher(`
    MATCH (h:NostrEvent)
    WHERE (h:ListHeader OR h:ClassThreadHeader OR h:ConceptHeader) AND h.kind IN [9998, 39998]
      AND h.name = $concept
    OPTIONAL MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
    RETURN h.uuid AS headerUuid, sup.uuid AS supersetUuid
    LIMIT 1
  `, { concept: DRILL_CONCEPT_NAME });
  if (rows.length === 0) return { error: `Concept "${DRILL_CONCEPT_NAME}" not found` };
  if (!rows[0].supersetUuid) return { error: `Concept "${DRILL_CONCEPT_NAME}" has no Superset node.` };
  return { headerUuid: rows[0].headerUuid, supersetUuid: rows[0].supersetUuid };
}

// Self-bootstrap the Restore Drill concept (ADR 0008 d9): idempotent — a
// structural copy of ensureSignalConcept. create-concept ("already exists" →
// success) + save-schema run ONLY when the concept is absent. §5.9: a fresh
// instance self-provisions with no manual step; never firmware-seeded.
async function ensureRestoreDrillConcept() {
  const existing = await resolveRestoreDrillConcept();
  if (!existing.error) return existing;
  await invokeNormalizeHandler(handleCreateConcept, {
    name: DRILL_CONCEPT_NAME,
    description: 'A dated, append-only record that a restore drill ran — which export was drilled, where, when, who performed it, and whether the restored content matched. Never edited; every drill is a new record.',
  });
  await invokeNormalizeHandler(handleSaveSchema, { concept: DRILL_CONCEPT_NAME, schema: DRILL_SCHEMA });
  const provisioned = await resolveRestoreDrillConcept();
  if (provisioned.error) {
    throw new Error(`ensureRestoreDrillConcept failed to provision the concept: ${provisioned.error}`);
  }
  return provisioned;
}

// The append-only drill-record mint (ADR 0008 d9): a fresh RANDOM d-tag each
// call (the mintSignalElement idiom) and nothing on this path is re-signed.
async function mintRestoreDrillElement({ headerUuid, supersetUuid, label, section }) {
  const nonce = randomDTag();
  const dTag = dtag.childDTag(label, headerUuid, nonce);
  const slug = `${dtag.slug(label)}-${nonce}`;
  const recordSection = { name: label, slug, ...section };
  const tags = [
    ['d', dTag],
    ['name', recordSection.name],
    ['z', headerUuid],
    ['json', JSON.stringify({ restoreDrill: recordSection })],
  ];
  const evt = signAndFinalize({ kind: 39999, tags, content: '' });
  const elemUuid = `39999:${evt.pubkey}:${dTag}`;
  await publishToStrfry(evt);
  await importEventDirect(evt, elemUuid);
  await writeCypher(`MATCH (n:NostrEvent {uuid: $uuid}) SET n:ListItem, n.slug = $slug`, { uuid: elemUuid, slug });
  await writeCypher(`
    MATCH (sup:NostrEvent {uuid: $supersetUuid}), (elem:NostrEvent {uuid: $elemUuid})
    MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(elem)
  `, { supersetUuid, elemUuid });
  return { uuid: elemUuid, slug };
}

async function handleRecordRestoreDrill(req, res) {
  try {
    const { isOwner } = require('../../middleware/auth');
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    const { exportTakenOn, outcome, target } = req.body || {};
    if (!exportTakenOn || typeof exportTakenOn !== 'string' || !exportTakenOn.trim()) {
      return res.status(400).json({ success: false, error: 'Missing the drilled export\'s taken-on date' });
    }
    if (typeof outcome !== 'string' || !DRILL_OUTCOMES.includes(outcome)) {
      return res.status(400).json({ success: false, error: `The outcome must be one of: ${DRILL_OUTCOMES.join(', ')}` });
    }
    if (target != null && typeof target !== 'string') {
      return res.status(400).json({ success: false, error: 'The target must be a short plain-words description when given' });
    }
    const result = await serializeGoalWrite(() => recordRestoreDrill({
      exportTakenOn: exportTakenOn.trim(),
      outcome,
      target: typeof target === 'string' && target.trim() ? target.trim() : DEFAULT_DRILL_TARGET,
    }));
    return res.json(result);
  } catch (error) {
    console.error('normalize/record-restore-drill error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function recordRestoreDrill({ exportTakenOn, outcome, target }) {
  // Provision the concept if this is the first drill ever (ADR 0008 d9).
  const concept = await ensureRestoreDrillConcept();
  const drilledOn = new Date().toISOString().slice(0, 10);
  const worded = outcome === 'matched' ? 'matched the export' : 'did not match the export';
  const section = {
    description: `restore drill: the export taken ${exportTakenOn} was restored to ${target} and ${worded}.`,
    exportTakenOn,
    drilledOn,
    outcome,
    target,
    performedBy: 'owner',   // ADR 0008 d9 — the d7 precedent, instance-relative.
  };
  const { uuid, slug } = await mintRestoreDrillElement({
    headerUuid: concept.headerUuid, supersetUuid: concept.supersetUuid,
    label: `restore drill ${drilledOn}`, section,
  });
  return { success: true, result: 'journaled', drill: { uuid, slug, drilledOn, outcome } };
}

// ══════════════════════════════════════════════════════════════
// Adoption disposition — the instance-private ledger of stances about
// FOREIGN shared concepts (ADR shared-concepts-adoption/0002). Records are
// append-only, dated, attributed; newest-per-target wins (the queue's pure
// core owns that arithmetic). Runtime-created concept — never firmware.
// ══════════════════════════════════════════════════════════════

const ADOPTION_DISPOSITION_CONCEPT_NAME = 'adoption disposition';
const ADOPTION_DISPOSITIONS = ['declined', 'requeued'];
const ADOPTION_DISPOSITION_SCHEMA = {
  type: 'object',
  properties: {
    adoptionDisposition: {
      type: 'object',
      title: 'Adoption Disposition',
      required: ['name', 'slug', 'target', 'disposition', 'decidedOn'],
      properties: {
        name: { type: 'string', description: 'the record name, dated, in plain words' },
        slug: { type: 'string', description: 'stable identity derived from the target and the moment' },
        target: { type: 'string', description: 'the foreign shared concept this stance is about (its a-tag coordinate)' },
        disposition: { type: 'string', enum: ADOPTION_DISPOSITIONS, description: 'declined (leave my queue) or requeued (bring it back)' },
        decidedOn: { type: 'string', description: 'the date the owner decided' },
      },
    },
  },
};

async function resolveAdoptionDispositionConcept() {
  const rows = await runCypher(`
    MATCH (h:NostrEvent)
    WHERE (h:ListHeader OR h:ClassThreadHeader OR h:ConceptHeader) AND h.kind IN [9998, 39998]
      AND h.name = $concept
    OPTIONAL MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
    RETURN h.uuid AS headerUuid, sup.uuid AS supersetUuid
    LIMIT 1
  `, { concept: ADOPTION_DISPOSITION_CONCEPT_NAME });
  if (rows.length === 0) return { error: `Concept "${ADOPTION_DISPOSITION_CONCEPT_NAME}" not found` };
  if (!rows[0].supersetUuid) return { error: `Concept "${ADOPTION_DISPOSITION_CONCEPT_NAME}" has no Superset node.` };
  return { headerUuid: rows[0].headerUuid, supersetUuid: rows[0].supersetUuid };
}

// Self-bootstrap (the ensure idiom — ADR second-brain/0004 d8 lineage):
// idempotent create-concept + save-schema, run only when absent.
async function ensureAdoptionDispositionConcept() {
  const existing = await resolveAdoptionDispositionConcept();
  if (!existing.error) return existing;
  await invokeNormalizeHandler(handleCreateConcept, {
    name: ADOPTION_DISPOSITION_CONCEPT_NAME,
    description: 'A dated record of the owner declining (or re-queueing) a foreign shared concept nominated for adoption. Instance-private stance history — never published outward, never firmware-seeded.',
  });
  await invokeNormalizeHandler(handleSaveSchema, { concept: ADOPTION_DISPOSITION_CONCEPT_NAME, schema: ADOPTION_DISPOSITION_SCHEMA });
  const provisioned = await resolveAdoptionDispositionConcept();
  if (provisioned.error) {
    throw new Error(`ensureAdoptionDispositionConcept failed to provision the concept: ${provisioned.error}`);
  }
  return provisioned;
}

async function handleAdoptionDisposition(req, res) {
  try {
    const { isOwner } = require('../../middleware/auth');
    if (!isOwner(req) && !req.localTrusted) {
      return res.status(403).json({ success: false, error: 'Owner access required' });
    }
    const { target, disposition } = req.body || {};
    const { classifyBValue } = require('../../lib/bValueForms');
    if (typeof target !== 'string' || classifyBValue(target.trim()) !== 'a-tag') {
      return res.status(400).json({ success: false, error: 'target must be an a-tag coordinate (kind:pubkey:d-tag)' });
    }
    if (typeof disposition !== 'string' || !ADOPTION_DISPOSITIONS.includes(disposition)) {
      return res.json({ success: false, error: `disposition must be one of: ${ADOPTION_DISPOSITIONS.join(', ')}` });
    }
    const trimmedTarget = target.trim();

    await ensureAdoptionDispositionConcept();

    const now = new Date();
    const decidedOn = now.toISOString().slice(0, 10);
    const stamp = now.toISOString().slice(0, 19).replace('T', ' ');
    const targetDTag = trimmedTarget.split(':').slice(2).join(':');
    const name = `adoption: ${targetDTag} — ${disposition} ${stamp}`;
    const slug = `adoption-${targetDTag}-${disposition}-${now.getTime()}`
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const minted = await invokeNormalizeHandler(handleCreateElement, {
      concept: ADOPTION_DISPOSITION_CONCEPT_NAME,
      name,
      random: true,
      json: { adoptionDisposition: { name, slug, target: trimmedTarget, disposition, decidedOn } },
    });
    if (!minted.body || minted.body.success !== true) {
      return res.status(minted.statusCode >= 400 ? minted.statusCode : 500)
        .json({ success: false, error: (minted.body && minted.body.error) || 'ledger mint failed' });
    }
    return res.json({ success: true, result: disposition, element: minted.body.element });
  } catch (error) {
    console.error('normalize/adoption-disposition error:', error);
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
  app.post('/api/normalize/reconcile-primary-property', handleReconcilePrimaryProperty);
  app.post('/api/normalize/create-child-goal', handleCreateChildGoal);
  app.post('/api/normalize/update-goal-intent', handleUpdateGoalIntent);
  app.post('/api/normalize/create-resource', handleCreateResource);
  app.post('/api/normalize/verify-resource', handleVerifyResource);
  app.post('/api/normalize/create-work-record', handleCreateWorkRecord);
  app.post('/api/normalize/note-goal-idea', handleNoteGoalIdea);
  app.post('/api/normalize/make-proposal', handleMakeProposal);
  app.post('/api/normalize/approve-proposal', handleApproveProposal);
  app.post('/api/normalize/skip-proposal', handleSkipProposal);
  app.post('/api/normalize/record-priority-signal', handleRecordPrioritySignal);
  app.post('/api/normalize/restore-brain', handleRestoreBrain);
  app.post('/api/normalize/record-restore-drill', handleRecordRestoreDrill);
  app.post('/api/normalize/adoption-disposition', handleAdoptionDisposition);
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
  app.post('/api/normalize/prune-superset-edges', handlePruneSupersetEdges);
  app.post('/api/normalize/apply-enumerations', handleApplyEnumerations);
  app.post('/api/normalize/wire-implicit-elements', handleWireImplicitElements);

  // Relationship primitives — strfry-free add/delete of a single typed edge
  // (ADR relationship-primitives/0001; separate module so its import surface
  // stays auditable)
  const { handleAddRelationship, handleDeleteRelationship } = require('./relationships');
  app.post('/api/normalize/add-relationship', handleAddRelationship);
  app.post('/api/normalize/delete-relationship', handleDeleteRelationship);

  // Read-only deployment probe for the relationship-primitives surface
  // (ADR relationship-primitives/0002; evidence-only — NOT a health endpoint)
  const { handleRelationshipPrimitivesProbe } = require('./probe');
  app.get('/api/normalize/relationship-primitives', handleRelationshipPrimitivesProbe);

  // Firmware install
  const { handleFirmwareInstall } = require('../../firmware/install');
  app.post('/api/firmware/install', handleFirmwareInstall);
}

module.exports = { registerNormalizeRoutes };


// POST /api/normalize/prune-superset-edges
//   Body: { concept: "<name>", relType: "HAS_ELEMENT" | "IS_A_SUPERSET_OF" }
//   Prunes redundant direct edges from the concept's Superset.
//   Returns detailed log of checks and actions.
// ══════════════════════════════════════════════════════════════

async function handlePruneSupersetEdges(req, res) {
  try {
    const { concept, relType } = req.body;
    if (!concept) return res.status(400).json({ success: false, error: 'Missing concept name' });
    if (!['HAS_ELEMENT', 'IS_A_SUPERSET_OF'].includes(relType)) {
      return res.status(400).json({ success: false, error: 'relType must be HAS_ELEMENT or IS_A_SUPERSET_OF' });
    }

    const log = [];
    const neoRel = relType === 'HAS_ELEMENT' ? REL.CLASS_THREAD_TERMINATION : REL.CLASS_THREAD_PROPAGATION;

    log.push(`Pruning ${relType} for concept "${concept}"`);
    log.push(`Neo4j relationship type: ${neoRel}`);

    // Find concept header + superset
    const rows = await runCypher(`
      MATCH (h:NostrEvent)
      WHERE (h:ListHeader OR h:ClassThreadHeader) AND h.kind IN [9998, 39998]
        AND h.name = $concept
      OPTIONAL MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
      RETURN h.uuid AS headerUuid, sup.uuid AS supersetUuid
      LIMIT 1
    `, { concept });

    if (rows.length === 0) {
      log.push(`ERROR: Concept "${concept}" not found`);
      return res.json({ success: false, error: `Concept "${concept}" not found`, log });
    }

    const { headerUuid, supersetUuid } = rows[0];
    if (!supersetUuid) {
      log.push(`ERROR: No Superset node found for "${concept}"`);
      return res.json({ success: false, error: 'No Superset node', log });
    }

    log.push(`Header UUID: ${headerUuid}`);
    log.push(`Superset UUID: ${supersetUuid}`);

    // Find all direct connections from Superset
    const directRows = await runCypher(`
      MATCH (sup:NostrEvent {uuid: $supersetUuid})-[:${neoRel}]->(target)
      RETURN target.uuid AS uuid, target.name AS name
    `, { supersetUuid });

    log.push(`Direct ${relType} edges from Superset: ${directRows.length}`);

    const pruned = [];
    const kept = [];

    for (const target of directRows) {
      // Check for alternate path (length ≥ 2)
      let checkCypher;
      if (relType === 'HAS_ELEMENT') {
        checkCypher = `
          MATCH p = (sup:NostrEvent {uuid: $supersetUuid})
                -[:${REL.CLASS_THREAD_PROPAGATION}|${REL.CLASS_THREAD_TERMINATION}*2..12]->
                (target:NostrEvent {uuid: $targetUuid})
          RETURN count(p) AS cnt`;
      } else {
        checkCypher = `
          MATCH (sup:NostrEvent {uuid: $supersetUuid})-[:${REL.CLASS_THREAD_PROPAGATION}]->(mid)
                -[:${REL.CLASS_THREAD_PROPAGATION}*1..10]->(target:NostrEvent {uuid: $targetUuid})
          WHERE mid.uuid <> $targetUuid
          RETURN count(*) AS cnt`;
      }

      log.push(`  Checking "${target.name}" (${target.uuid}):`);
      log.push(`    Query: ${checkCypher.replace(/\n\s*/g, ' ').trim()}`);

      const altRows = await runCypher(checkCypher, { supersetUuid, targetUuid: target.uuid });
      const cnt = altRows[0]?.cnt || 0;

      log.push(`    Alternate paths found: ${cnt}`);

      if (cnt > 0) {
        // Prune
        await writeCypher(`
          MATCH (sup:NostrEvent {uuid: $supersetUuid})-[r:${neoRel}]->(target:NostrEvent {uuid: $targetUuid})
          DELETE r
        `, { supersetUuid, targetUuid: target.uuid });
        log.push(`    ✅ PRUNED`);
        pruned.push({ name: target.name, uuid: target.uuid });
      } else {
        log.push(`    ⏭️  KEPT (no alternate path)`);
        kept.push({ name: target.name, uuid: target.uuid });
      }
    }

    log.push(`\nSummary: pruned ${pruned.length}, kept ${kept.length}`);

    return res.json({ success: true, pruned, kept, log });
  } catch (error) {
    console.error('normalize/prune-superset-edges error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}


// ══════════════════════════════════════════════════════════════
// POST /api/normalize/wire-implicit-elements
//   Body: { concept?: "<name>" }  — if omitted, processes ALL concepts
//   For each concept, finds nodes with a z-tag pointing to that concept's header
//   but no explicit HAS_ELEMENT path. Wires them to the concept's Superset.
//   Optionally prunes redundant edges afterward.
// ══════════════════════════════════════════════════════════════

async function handleWireImplicitElements(req, res) {
  try {
    const { concept: conceptFilter, prune = true } = req.body || {};
    const log = [];
    let totalWired = 0;
    let totalAlreadyExplicit = 0;
    let totalPruned = 0;

    // Find concepts to process
    let conceptRows;
    if (conceptFilter) {
      conceptRows = await runCypher(`
        MATCH (h:ConceptHeader)
        WHERE h.name = $name
        OPTIONAL MATCH (h)-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
        RETURN h.uuid AS headerUuid, h.name AS conceptName, sup.uuid AS supersetUuid
        LIMIT 1
      `, { name: conceptFilter });
    } else {
      conceptRows = await runCypher(`
        MATCH (h:ConceptHeader)-[:${REL.CLASS_THREAD_INITIATION}]->(sup:Superset)
        RETURN h.uuid AS headerUuid, h.name AS conceptName, sup.uuid AS supersetUuid
        ORDER BY h.name
      `);
    }

    if (conceptRows.length === 0) {
      const msg = conceptFilter
        ? `Concept "${conceptFilter}" not found or has no Superset`
        : 'No concepts with Superset nodes found';
      return res.json({ success: false, error: msg, log: [msg] });
    }

    log.push(`Processing ${conceptRows.length} concept(s)...`);

    for (const { headerUuid, conceptName, supersetUuid } of conceptRows) {
      log.push(`\n── ${conceptName} ──`);
      log.push(`  Header: ${headerUuid}`);
      log.push(`  Superset: ${supersetUuid}`);

      // Find all nodes with a z-tag pointing to this concept header
      const implicitNodes = await runCypher(`
        MATCH (n:NostrEvent)-[:HAS_TAG]->(zt:NostrEventTag {type: 'z', value: $headerUuid})
        RETURN n.uuid AS uuid, n.name AS name
        ORDER BY n.name
      `, { headerUuid });

      log.push(`  Implicit elements (via z-tag): ${implicitNodes.length}`);

      if (implicitNodes.length === 0) continue;

      for (const node of implicitNodes) {
        // Check if this node already has an explicit HAS_ELEMENT path
        // from any Set/Superset in this concept's class thread
        const explicitCheck = await runCypher(`
          MATCH (sup:Superset {uuid: $supersetUuid})
                -[:${REL.CLASS_THREAD_PROPAGATION}|${REL.CLASS_THREAD_TERMINATION}*0..12]->
                (parent)-[:${REL.CLASS_THREAD_TERMINATION}]->(n {uuid: $nodeUuid})
          RETURN count(*) AS cnt
        `, { supersetUuid, nodeUuid: node.uuid });

        const alreadyExplicit = (explicitCheck[0]?.cnt || 0) > 0;

        if (alreadyExplicit) {
          log.push(`  ⏭️  "${node.name}" — already explicit`);
          totalAlreadyExplicit++;
        } else {
          // Wire HAS_ELEMENT from Superset → node
          await writeCypher(`
            MATCH (sup:Superset {uuid: $supersetUuid}), (n:NostrEvent {uuid: $nodeUuid})
            MERGE (sup)-[:${REL.CLASS_THREAD_TERMINATION}]->(n)
          `, { supersetUuid, nodeUuid: node.uuid });
          log.push(`  ✅ "${node.name}" — wired to Superset`);
          totalWired++;
        }
      }

      // Prune redundant edges if requested.
      // Only prune if there's an alternate path WITHIN THIS CONCEPT's class thread:
      // Superset → IS_A_SUPERSET_OF+ → childSet → HAS_ELEMENT → target
      if (prune && totalWired > 0) {
        const directEdges = await runCypher(`
          MATCH (sup:Superset {uuid: $supersetUuid})-[:${REL.CLASS_THREAD_TERMINATION}]->(target)
          RETURN target.uuid AS uuid, target.name AS name
        `, { supersetUuid });

        for (const target of directEdges) {
          // Check: is there a path Superset →IS_A_SUPERSET_OF+→ childSet →HAS_ELEMENT→ target?
          const altPaths = await runCypher(`
            MATCH (sup:Superset {uuid: $supersetUuid})
                  -[:${REL.CLASS_THREAD_PROPAGATION}*1..10]->(childSet)
                  -[:${REL.CLASS_THREAD_TERMINATION}]->(target:NostrEvent {uuid: $targetUuid})
            RETURN count(*) AS cnt
          `, { supersetUuid, targetUuid: target.uuid });

          if ((altPaths[0]?.cnt || 0) > 0) {
            await writeCypher(`
              MATCH (sup:Superset {uuid: $supersetUuid})-[r:${REL.CLASS_THREAD_TERMINATION}]->(target:NostrEvent {uuid: $targetUuid})
              DELETE r
            `, { supersetUuid, targetUuid: target.uuid });
            log.push(`  🔄 "${target.name}" — pruned redundant edge`);
            totalPruned++;
          }
        }
      }
    }

    log.push(`\n── Summary ──`);
    log.push(`Wired: ${totalWired}`);
    log.push(`Already explicit: ${totalAlreadyExplicit}`);
    if (prune) log.push(`Pruned redundant: ${totalPruned}`);

    return res.json({
      success: true,
      wired: totalWired,
      alreadyExplicit: totalAlreadyExplicit,
      pruned: totalPruned,
      log,
    });
  } catch (error) {
    console.error('normalize/wire-implicit-elements error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}


// ══════════════════════════════════════════════════════════════
// POST /api/normalize/apply-enumerations
//   Body: { concept?: "<name>" } — if omitted, processes ALL ENUMERATES edges
//   For each ENUMERATES relationship:
//     1. Collects element slugs (or names) from the source Set/Superset
//     2. Navigates to the target field in the JSON Schema using the path
//     3. Injects enum values: directly if type=string, into items if type=array
//     4. If enforce-wordType-conditionals is true in the manifest, generates
//        biconditional allOf if/then blocks linking the property value to
//        word.wordTypes entries
//     5. Saves the updated schema
// ══════════════════════════════════════════════════════════════

async function handleApplyEnumerations(req, res) {
  try {
    const { concept: conceptFilter } = req.body || {};
    const log = [];
    let updated = 0;

    // Find all ENUMERATES relationships (optionally filtered)
    let cypher = `
      MATCH (source)-[r:ENUMERATES]->(targetSchema:JSONSchema)
      MATCH (targetSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(targetHeader:ConceptHeader)
    `;
    const params = {};
    if (conceptFilter) {
      cypher += `WHERE targetHeader.name = $concept `;
      params.concept = conceptFilter;
    }
    cypher += `
      RETURN source.uuid AS sourceUuid, source.name AS sourceName,
             r.sourcePath AS sourcePath, r.destinationPath AS destinationPath,
             targetSchema.uuid AS schemaUuid, targetSchema.name AS schemaName,
             targetHeader.name AS targetConcept
    `;

    const enumEdges = await runCypher(cypher, params);
    log.push(`Found ${enumEdges.length} ENUMERATES relationship(s)`);

    const store = require('../../lib/tapestry-store');

    // Load manifest enumerations to look up enforce-wordType-conditionals
    const manifest = firmware.getManifest();
    const manifestEnumerations = manifest.enumerations || {};

    /** Navigate a dotted path into an object. Returns undefined if path doesn't resolve. */
    function getByPath(obj, dotPath) {
      if (!obj || !dotPath) return undefined;
      const parts = dotPath.split('.');
      let current = obj;
      for (const part of parts) {
        if (current == null || typeof current !== 'object') return undefined;
        current = current[part];
      }
      return current;
    }

    /**
     * Look up enforce-wordType-conditionals from the manifest for a given
     * target concept name and destination path.
     */
    function shouldEnforceWordTypeConditionals(targetConceptName, destPath) {
      for (const [, enumDef] of Object.entries(manifestEnumerations)) {
        for (const node of (enumDef['existing-nodes'] || [])) {
          if (node.concept === targetConceptName && node['destination-path'] === destPath) {
            return node['enforce-wordType-conditionals'] === true;
          }
        }
      }
      return false;
    }

    /**
     * Generate biconditional allOf if/then entries for wordType enforcement.
     * For each enum value, creates:
     *   - Forward: if property = value → word.wordTypes must contain value
     *   - Reverse: if word.wordTypes contains value → property must = value
     */
    function generateWordTypeConditionals(enumValues, destinationPath) {
      const pathParts = destinationPath.split('.');
      const entries = [];

      for (const val of enumValues) {
        // Build nested property path for the if/then targeting the concept-specific field
        // e.g., destinationPath "dog.breed" → { properties: { dog: { properties: { breed: { const: val } }, required: ["breed"] } } }
        function buildPropertyPath(parts, leaf) {
          if (parts.length === 0) return leaf;
          const [head, ...rest] = parts;
          const inner = buildPropertyPath(rest, leaf);
          const obj = { properties: { [head]: inner } };
          // Add required on the innermost object property
          if (rest.length === 0) {
            obj.properties[head] = { ...inner, required: [parts[parts.length - 1]] };
            // Actually required should be on the parent, specifying the child key
            // For "dog.breed": { properties: { dog: { properties: { breed: { const: X } }, required: ["breed"] } } }
          }
          return obj;
        }

        // Build the forward condition: if concept property = value
        const forwardIf = {};
        let currentIf = forwardIf;
        for (let i = 0; i < pathParts.length; i++) {
          currentIf.properties = { [pathParts[i]]: {} };
          if (i === pathParts.length - 1) {
            // Leaf: set the const and required
            currentIf.properties[pathParts[i]] = {
              properties: { [pathParts[i]]: { const: val } },
              required: [pathParts[i]],
            };
            // Actually we need the leaf directly
          }
          currentIf = currentIf.properties[pathParts[i]];
        }

        // Simpler approach: build from inside out
        let forwardIfSchema = { const: val };
        for (let i = pathParts.length - 1; i >= 0; i--) {
          const part = pathParts[i];
          const wrapper = { properties: { [part]: forwardIfSchema } };
          if (i === pathParts.length - 1 && pathParts.length > 1) {
            // Add required for the leaf property on its parent object
            wrapper.required = [part];
          } else if (pathParts.length === 1) {
            wrapper.required = [part];
          }
          forwardIfSchema = wrapper;
        }

        // Build the reverse condition: if word.wordTypes contains value
        const reverseIfSchema = {
          properties: {
            word: {
              properties: {
                wordTypes: {
                  contains: { const: val },
                },
              },
            },
          },
        };

        // Build the forward then: word.wordTypes must contain value
        const forwardThenSchema = { ...reverseIfSchema };

        // Build the reverse then: concept property must = value (same structure as forward if)
        let reverseThenSchema = { const: val };
        for (let i = pathParts.length - 1; i >= 0; i--) {
          const part = pathParts[i];
          const wrapper = { properties: { [part]: reverseThenSchema } };
          if (i === pathParts.length - 1 && pathParts.length > 1) {
            wrapper.required = [part];
          } else if (pathParts.length === 1) {
            wrapper.required = [part];
          }
          reverseThenSchema = wrapper;
        }

        entries.push(
          {
            $comment: `Forward: if ${destinationPath} is ${val}, wordTypes must contain it`,
            if: forwardIfSchema,
            then: forwardThenSchema,
          },
          {
            $comment: `Reverse: if wordTypes contains ${val}, ${destinationPath} must be ${val}`,
            if: reverseIfSchema,
            then: reverseThenSchema,
          }
        );
      }

      return entries;
    }

    for (const edge of enumEdges) {
      const { sourceUuid, sourceName, sourcePath, destinationPath, schemaUuid, schemaName, targetConcept } = edge;
      const path = destinationPath; // for schema navigation
      log.push(`\n── ${sourceName} → ${schemaName} ──`);
      log.push(`  source-path: ${sourcePath || '(slug fallback)'}, destination-path: ${destinationPath}`);

      // Check manifest for wordType conditional enforcement
      const enforceConditionals = shouldEnforceWordTypeConditionals(targetConcept, destinationPath);
      log.push(`  enforce-wordType-conditionals: ${enforceConditionals}`);

      // 1. Collect enum values from each element's tapestryJSON
      const elements = await runCypher(`
        MATCH (source { uuid: $sourceUuid })-[:IS_A_SUPERSET_OF*0..10]->(s)-[:HAS_ELEMENT]->(e)
        RETURN DISTINCT e.tapestryKey AS tapestryKey, e.name AS name
      `, { sourceUuid });

      const enumValues = elements.map(e => {
        const entry = store.get(e.tapestryKey);
        const data = entry?.data;
        if (data && sourcePath) {
          // Use source-path to extract the value
          const val = getByPath(data, sourcePath);
          if (val != null) return String(val);
        }
        if (data) {
          // Fallback: concept-scoped slug
          for (const key of Object.keys(data)) {
            if (key === 'word' || key === 'graphContext') continue;
            if (data[key]?.slug) return data[key].slug;
          }
        }
        // Last resort: name
        return e.name;
      }).filter(Boolean).sort();
      log.push(`  Elements: ${enumValues.length} → [${enumValues.slice(0, 8).join(', ')}${enumValues.length > 8 ? '...' : ''}]`);

      if (enumValues.length === 0) {
        log.push(`  ⚠️  No elements found — skipping`);
        continue;
      }

      // 2. Load the target schema JSON
      const schemaRows = await runCypher(`
        MATCH (js:JSONSchema { uuid: $schemaUuid })-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
        RETURN jt.value AS json
        LIMIT 1
      `, { schemaUuid });

      let schemaWrapper = schemaRows[0]?.json;
      if (!schemaWrapper) {
        log.push(`  ⚠️  No JSON found on schema node — skipping`);
        continue;
      }

      // Resolve LMDB ref if needed
      if (typeof schemaWrapper === 'string' && schemaWrapper.startsWith('lmdb:')) {
        const { resolveValue } = require('../../lib/tapestry-resolve');
        schemaWrapper = resolveValue(schemaWrapper);
      }
      if (typeof schemaWrapper === 'string') {
        try { schemaWrapper = JSON.parse(schemaWrapper); } catch {
          log.push(`  ❌ Could not parse schema JSON — skipping`);
          continue;
        }
      }

      // Extract the jsonSchema section (word-wrapper format)
      const schema = schemaWrapper?.jsonSchema || schemaWrapper;
      if (!schema?.properties) {
        log.push(`  ❌ Schema has no properties — skipping`);
        continue;
      }

      // 3. Navigate to the target field using the path
      // path "property.type" → schema.properties.property.properties.type
      const pathParts = path.split('.');
      let target = schema;
      const breadcrumb = ['schema'];

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        if (!target.properties || !target.properties[part]) {
          log.push(`  ❌ Could not navigate to "${breadcrumb.join('.')}.properties.${part}" — skipping`);
          target = null;
          break;
        }
        target = target.properties[part];
        breadcrumb.push(part);
      }

      if (!target) continue;

      // 4. Inject enum values
      if (target.type === 'array' && target.items) {
        // Array field — put enum in items
        target.items.enum = enumValues;
        log.push(`  ✅ Injected ${enumValues.length} enum values into ${path}.items.enum`);
      } else if (target.type === 'string') {
        // String field — put enum directly
        target.enum = enumValues;
        log.push(`  ✅ Injected ${enumValues.length} enum values into ${path}.enum`);
      } else {
        log.push(`  ⚠️  Target field type is "${target.type}" — unsupported, skipping`);
        continue;
      }

      // 4b. Generate biconditional wordType conditionals if enabled
      if (enforceConditionals) {
        // Ensure "word" is in the schema's required array
        if (!schema.required) schema.required = [];
        if (!schema.required.includes('word')) {
          schema.required.push('word');
          log.push(`  ✅ Added "word" to schema required array`);
        }

        // Ensure the schema has a word property stub for conditionals to reference
        if (!schema.properties.word) {
          schema.properties.word = {
            type: 'object',
            properties: {
              wordTypes: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
              },
            },
          };
          log.push(`  ✅ Added word property stub to schema`);
        }

        // Generate and inject the allOf conditional blocks
        const conditionals = generateWordTypeConditionals(enumValues, destinationPath);

        // Replace any existing auto-generated conditionals (idempotent)
        // Keep allOf entries that are NOT from enumeration (no Forward:/Reverse: comment)
        const existingAllOf = schema.allOf || [];
        const preserved = existingAllOf.filter(entry =>
          !entry.$comment || (!entry.$comment.startsWith('Forward:') && !entry.$comment.startsWith('Reverse:'))
        );
        schema.allOf = [...preserved, ...conditionals];

        log.push(`  ✅ Generated ${conditionals.length} biconditional wordType entries (${enumValues.length} values × 2)`);
      }

      // 5. Save the updated schema
      // Re-wrap in word-wrapper if it was wrapped
      if (schemaWrapper.jsonSchema) {
        schemaWrapper.jsonSchema = schema;
      }

      try {
        const saveRes = await new Promise((resolve, reject) => {
          const mockReq = { body: { concept: targetConcept, schema } };
          const mockRes = {
            json: (data) => resolve(data),
            status: () => ({ json: (data) => resolve(data) }),
          };
          handleSaveSchema(mockReq, mockRes);
        });
        if (saveRes.success) {
          log.push(`  💾 Schema saved`);
          updated++;
        } else {
          log.push(`  ❌ Save failed: ${saveRes.error}`);
        }
      } catch (e) {
        log.push(`  ❌ Save error: ${e.message}`);
      }
    }

    log.push(`\n── Summary: ${updated} schema(s) updated ──`);
    return res.json({ success: true, updated, log });
  } catch (error) {
    console.error('normalize/apply-enumerations error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
