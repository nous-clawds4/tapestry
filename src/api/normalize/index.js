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

    // Merge extra fields from firmware conceptHeader (e.g., x-tapestry)
    const { conceptHeaderOverrides } = req.body;
    if (conceptHeaderOverrides) {
      const generated = new Set(['description', 'oNames', 'oSlugs', 'oKeys', 'oTitles']);
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
    const dTag = req.body.dTag || (req.body.random ? randomDTag() : dtag.childDTag(trimName, headerUuid, req.body.nonce));
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
  app.post('/api/normalize/prune-superset-edges', handlePruneSupersetEdges);
  app.post('/api/normalize/apply-enumerations', handleApplyEnumerations);
  app.post('/api/normalize/wire-implicit-elements', handleWireImplicitElements);

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
//     4. Saves the updated schema
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

    for (const edge of enumEdges) {
      const { sourceUuid, sourceName, sourcePath, destinationPath, schemaUuid, schemaName, targetConcept } = edge;
      const path = destinationPath; // for schema navigation
      log.push(`\n── ${sourceName} → ${schemaName} ──`);
      log.push(`  source-path: ${sourcePath || '(slug fallback)'}, destination-path: ${destinationPath}`);

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
