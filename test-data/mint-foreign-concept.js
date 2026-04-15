#!/usr/bin/env node
/**
 * Mint a fully-formed "foreign" Tapestry concept for the Concept Discovery
 * demo.
 *
 * Uses a dwarves keypair as the foreign Tapestry Assistant (TA) and
 * publishes a complete `nostr-relay-v2` concept to local strfry, matching
 * the 8-event shape our own firmware install produces for any concept:
 *
 *   1. ConceptHeader            (kind 39998, d-tag = <slug>)
 *   2. JSONSchema               (kind 39999, d-tag = <slug>-schema)
 *   3. Primary Property         (kind 39999, d-tag = <slug>-primary-property)
 *   4. Properties Set           (kind 39999, d-tag = <slug>-properties)
 *   5. Superset                 (kind 39999, d-tag = <slug>-superset)
 *   6. Core Nodes Graph         (kind 39999, d-tag = <slug>-core-nodes-graph)
 *   7. Concept Graph            (kind 39999, d-tag = <slug>-concept-graph)
 *   8. Property Tree Graph      (kind 39999, d-tag = <slug>-property-tree-graph)
 *
 * Plus 3 seed relay elements published by various dwarves keypairs, each
 * carrying the v2-only fields (`country`, `language`) so the Concept
 * Discovery demo has visible schema-divergence content to render.
 *
 * The foreign TA's z-tags reference its OWN pubkey for the firmware-level
 * concepts (`word`, `set`, `json-schema`, etc.). Those references are
 * dangling on this install — that's correct; in the real world the
 * foreign TA would have its own full firmware. Locally, derive Pass 3
 * just leaves those edges unresolved, which is the realistic "I see your
 * concept's shape but not your full ontology" behavior we want to model.
 *
 * Usage:
 *   node mint-foreign-concept.js               # publish only
 *   node mint-foreign-concept.js --seed-config # also add to suggested-authors
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

function encodeNpub(hex) {
  try { return execSync(`nak encode npub ${hex}`, { encoding: 'utf8' }).trim(); }
  catch { return null; }
}

function resolveApi() {
  if (process.env.BRAINSTORM_API) return process.env.BRAINSTORM_API;
  const argPort = process.argv.find((a) => /^\d+$/.test(a));
  if (argPort) return `http://localhost:${argPort}`;
  try {
    const raw = execSync(
      "docker inspect tapestry --format '{{(index (index .NetworkSettings.Ports \"7778/tcp\") 0).HostPort}}'",
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (/^\d+$/.test(raw)) return `http://localhost:${raw}`;
  } catch {}
  return 'http://localhost:7778';
}

const API = resolveApi();
const SEED_CONFIG = process.argv.includes('--seed-config');
const FOREIGN_TA_NAME = 'Magic Mirror';

const CONCEPT_SLUG = 'nostr-relay-v2';
const CONCEPT_PLURAL = `${CONCEPT_SLUG}s`;
const NAMES = {
  singular: 'nostr relay v2',
  plural: 'nostr relays v2',
};
const TITLES = {
  singular: 'Nostr Relay v2',
  plural: 'Nostr Relays v2',
};
const KEYS = {
  singular: 'nostrRelay',
  plural: 'nostrRelays',
};
const LABELS = {
  singular: 'NostrRelay',
  plural: 'NostrRelays',
};

// Three seed elements: each from a different dwarves account so the
// aggregated relay-discovery view sees distinct endorsers under the v2
// coordinate.
const SEED_ELEMENTS = [
  {
    publisher: 'Snow White',
    slug: 'relay-tokyo',
    websocketUrl: 'wss://relay-tokyo.example.com',
    httpUrl: 'https://relay-tokyo.example.com',
    country: 'JP',
    language: 'ja',
  },
  {
    publisher: 'Huntsman',
    slug: 'relay-berlin',
    websocketUrl: 'wss://relay-berlin.example.com',
    httpUrl: 'https://relay-berlin.example.com',
    country: 'DE',
    language: 'de',
  },
  {
    publisher: FOREIGN_TA_NAME, // self-endorsement from the foreign TA
    slug: 'relay-mirror',
    websocketUrl: 'wss://relay-mirror.example.com',
    httpUrl: 'https://relay-mirror.example.com',
    country: 'US',
    language: 'en',
  },
];

// ── HTTP / nak helpers ───────────────────────────────────────

function httpPost(pathname, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, API);
    const data = JSON.stringify(body);
    const req = http.request(
      url,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try { resolve(JSON.parse(buf)); } catch { resolve({ raw: buf, status: res.statusCode }); }
        });
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function signEvent(sk, eventJson) {
  const result = execSync(
    `echo '${JSON.stringify(eventJson).replace(/'/g, "'\\''")}' | nak event --sec ${sk}`,
    { encoding: 'utf8' },
  ).trim();
  return JSON.parse(result);
}

async function publish(event) { return httpPost('/api/strfry/publish', { event, signAs: 'client' }); }
async function importToNeo4j(uuid) { return httpPost('/api/neo4j/event-update', { uuid }); }

// ── Concept event builders ───────────────────────────────────

const NOW = () => Math.floor(Date.now() / 1000);

function mintHeader(taPk, taSk) {
  const description = `A Nostr relay (v2). Same shape as the canonical nostr-relay concept but with optional country + language metadata. Authored by foreign TA ${FOREIGN_TA_NAME} for the Concept Discovery demo.`;
  const json = {
    word: {
      slug: `concept-header-for-the-concept-of-${CONCEPT_SLUG}`,
      name: `concept header for the concept of ${NAMES.singular}`,
      title: `Concept Header for the Concept of ${TITLES.singular}`,
      wordTypes: ['word', 'conceptHeader'],
    },
    conceptHeader: {
      description,
      oNames: NAMES,
      oSlugs: { singular: CONCEPT_SLUG, plural: CONCEPT_PLURAL },
      oKeys: KEYS,
      oTitles: TITLES,
      oLabels: LABELS,
      'x-tapestry': { neo4j: { nodeLabelRequired: true } },
    },
  };
  const event = signEvent(taSk, {
    kind: 39998,
    pubkey: taPk,
    created_at: NOW(),
    content: '',
    tags: [
      ['d', CONCEPT_SLUG],
      ['names', NAMES.singular, NAMES.plural],
      ['slug', CONCEPT_SLUG],
      ['json', JSON.stringify(json)],
      ['description', description],
    ],
  });
  return { event, uuid: `39998:${taPk}:${CONCEPT_SLUG}` };
}

/**
 * Generic builder for the 7 supporting kind-39999 events. Each one
 * z-tags its conceptual parents under the FOREIGN TA's pubkey so this
 * looks like a fully-formed concept from the foreign instance's
 * perspective. Locally, those z-tag references are dangling — that's
 * realistic.
 */
function mintSupport({ taPk, taSk, headerUuid, role, parentSlugs, wordTypes, payloadKey, payload, description }) {
  const dTag = `${CONCEPT_SLUG}-${role}`;
  const wordSlug = `${role.replace(/-/g, '-')}-for-the-concept-of-${CONCEPT_SLUG}`;
  const json = {
    word: {
      slug: wordSlug,
      name: `${role.replace(/-/g, ' ')} for the concept of ${NAMES.singular}`,
      title: `${role.replace(/(^|-)\w/g, (m) => m.toUpperCase()).replace(/-/g, ' ')} for the Concept of ${TITLES.singular}`,
      wordTypes: ['word', ...wordTypes],
      coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${CONCEPT_SLUG}`, uuid: headerUuid }],
    },
    [payloadKey]: payload,
  };
  const tags = [
    ['d', dTag],
    ['name', `${role.replace(/-/g, ' ')} for the concept of ${NAMES.singular}`],
  ];
  for (const ps of parentSlugs) {
    tags.push(['z', `39998:${taPk}:${ps}`]);
  }
  if (description) tags.push(['description', description]);
  tags.push(['json', JSON.stringify(json)]);

  const event = signEvent(taSk, {
    kind: 39999,
    pubkey: taPk,
    created_at: NOW(),
    content: '',
    tags,
  });
  return { event, uuid: `39999:${taPk}:${dTag}` };
}

function mintSchema(taPk, taSk, headerUuid) {
  return mintSupport({
    taPk, taSk, headerUuid,
    role: 'schema',
    parentSlugs: ['json-schema', 'word'],
    wordTypes: ['jsonSchema'],
    payloadKey: 'jsonSchema',
    description: `the json schema for the concept of ${NAMES.singular}`,
    payload: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      name: NAMES.singular,
      title: TITLES.singular,
      description: `JSON Schema for the concept of ${NAMES.singular}`,
      required: [KEYS.singular],
      definitions: {},
      properties: {
        [KEYS.singular]: {
          type: 'object',
          name: NAMES.singular,
          title: TITLES.singular,
          slug: CONCEPT_SLUG,
          description: `data about this ${NAMES.singular}`,
          required: ['slug', 'websocketUrl'],
          properties: {
            slug: { type: 'string', name: 'slug', title: 'Slug', slug: 'slug', description: 'A unique kebab-case identifier for this relay' },
            websocketUrl: { type: 'string', name: 'websocketUrl', title: 'Websocket URL', slug: 'websocket-url', description: 'The websocket URL' },
            httpUrl: { type: 'string', name: 'httpUrl', title: 'HTTP URL', slug: 'http-url', description: 'The HTTP URL (optional)' },
            country: { type: 'string', name: 'country', title: 'Country', slug: 'country', description: 'ISO 3166-1 alpha-2 country code where this relay is hosted' },
            language: { type: 'string', name: 'language', title: 'Language', slug: 'language', description: "BCP 47 language tag for the relay's primary community" },
          },
          'x-tapestry': { unique: ['slug', 'websocketUrl'] },
        },
      },
    },
  });
}

function mintPrimaryProperty(taPk, taSk, headerUuid) {
  return mintSupport({
    taPk, taSk, headerUuid,
    role: 'primary-property',
    parentSlugs: ['primary-property', 'property', 'word'],
    wordTypes: ['property', 'primaryProperty'],
    payloadKey: 'primaryProperty',
    description: `the primary property for the concept of ${NAMES.singular}`,
    payload: {
      slug: KEYS.singular,
      name: KEYS.singular,
      title: TITLES.singular,
      type: 'object',
      description: `the primary property for the concept of ${NAMES.singular}`,
    },
  });
}

function mintPropertiesSet(taPk, taSk, headerUuid) {
  return mintSupport({
    taPk, taSk, headerUuid,
    role: 'properties',
    parentSlugs: ['properties-set', 'set', 'word'],
    wordTypes: ['set', 'propertiesSet'],
    payloadKey: 'set',
    payload: {
      slug: `properties-for-the-concept-of-${CONCEPT_SLUG}`,
      name: `the set of properties for the concept of ${NAMES.singular}`,
      title: `The Set of Properties for the Concept of ${TITLES.singular}`,
    },
  });
}

function mintSuperset(taPk, taSk, headerUuid) {
  return mintSupport({
    taPk, taSk, headerUuid,
    role: 'superset',
    parentSlugs: ['superset', 'set', 'word'],
    wordTypes: ['set', 'superset'],
    payloadKey: 'set',
    description: `This is the superset of all known ${NAMES.plural}.`,
    payload: {
      slug: CONCEPT_PLURAL,
      name: NAMES.plural,
      title: TITLES.plural,
    },
  });
}

function mintCoreNodesGraph(taPk, taSk, headerUuid) {
  return mintSupport({
    taPk, taSk, headerUuid,
    role: 'core-nodes-graph',
    parentSlugs: ['core-nodes-graph', 'graph', 'word'],
    wordTypes: ['graph', 'coreNodesGraph'],
    payloadKey: 'graph',
    description: `the set of core nodes for the concept of ${NAMES.singular}`,
    payload: { slug: `core-nodes-graph-for-the-concept-of-${CONCEPT_SLUG}` },
  });
}

function mintConceptGraph(taPk, taSk, headerUuid) {
  return mintSupport({
    taPk, taSk, headerUuid,
    role: 'concept-graph',
    parentSlugs: ['concept-graph', 'graph', 'word'],
    wordTypes: ['graph', 'conceptGraph'],
    payloadKey: 'graph',
    description: `The concept graph for the concept of ${NAMES.singular}`,
    payload: { slug: `concept-graph-for-the-concept-of-${CONCEPT_SLUG}` },
  });
}

function mintPropertyTreeGraph(taPk, taSk, headerUuid) {
  return mintSupport({
    taPk, taSk, headerUuid,
    role: 'property-tree-graph',
    parentSlugs: ['property-tree-graph', 'graph', 'word'],
    wordTypes: ['graph', 'propertyTreeGraph'],
    payloadKey: 'graph',
    description: `the collection of the JSON schema node, all property nodes and all of their connections for the concept of ${NAMES.singular}`,
    payload: { slug: `property-tree-graph-for-the-concept-of-${CONCEPT_SLUG}` },
  });
}

// ── Element minting ────────────────────────────────────────

function mintElement(elem, accounts, headerUuid) {
  const acc = accounts[elem.publisher];
  if (!acc) throw new Error(`No keypair for ${elem.publisher}`);
  const dTag = `${elem.slug}-${acc.pk.slice(0, 8)}`;
  const payload = {
    nostrRelay: {
      slug: elem.slug,
      websocketUrl: elem.websocketUrl,
      httpUrl: elem.httpUrl,
      country: elem.country,
      language: elem.language,
    },
  };
  const event = signEvent(acc.sk, {
    kind: 39999,
    pubkey: acc.pk,
    created_at: NOW(),
    content: '',
    tags: [
      ['d', dTag],
      ['name', elem.slug],
      ['z', headerUuid],
      ['json', JSON.stringify(payload)],
    ],
  });
  return { event, uuid: `39999:${acc.pk}:${dTag}`, publisher: elem.publisher };
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log('🧪  Minting a fully-formed foreign Tapestry concept\n');

  const seedPath = path.join(__dirname, 'dwarves-test-data.json');
  if (!fs.existsSync(seedPath)) {
    console.error(`❌  ${seedPath} not found. Run mint-dwarves.js first.`);
    process.exit(1);
  }
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const accounts = seed.accounts;
  const ta = accounts?.[FOREIGN_TA_NAME];
  if (!ta) {
    console.error(`❌  Missing account "${FOREIGN_TA_NAME}" in dwarves-test-data.json`);
    process.exit(1);
  }

  console.log(`  API:           ${API}`);
  console.log(`  Foreign TA:    ${FOREIGN_TA_NAME}`);
  console.log(`  Foreign pubkey: ${ta.pk}`);
  console.log(`  Concept slug:  ${CONCEPT_SLUG}\n`);

  // 1. ConceptHeader
  console.log('── Step 1/3: Publishing 8-event concept bundle ──');
  const header = mintHeader(ta.pk, ta.sk);
  let r = await publish(header.event);
  await importToNeo4j(header.uuid);
  console.log(`   ${r.success ? '✅' : '❌'} ConceptHeader        ${header.uuid}`);

  // 2-8. Supporting events
  const supports = [
    { fn: mintSchema,            label: 'JSONSchema' },
    { fn: mintPrimaryProperty,   label: 'PrimaryProperty' },
    { fn: mintPropertiesSet,     label: 'PropertiesSet' },
    { fn: mintSuperset,          label: 'Superset' },
    { fn: mintCoreNodesGraph,    label: 'CoreNodesGraph' },
    { fn: mintConceptGraph,      label: 'ConceptGraph' },
    { fn: mintPropertyTreeGraph, label: 'PropertyTreeGraph' },
  ];
  const supportRefs = [];
  for (const { fn, label } of supports) {
    const built = fn(ta.pk, ta.sk, header.uuid);
    const pubResp = await publish(built.event);
    const impResp = await importToNeo4j(built.uuid);
    console.log(`   ${pubResp.success && impResp.success ? '✅' : '❌'} ${label.padEnd(20)} ${built.uuid}`);
    supportRefs.push({ role: label, uuid: built.uuid, eventId: built.event.id });
  }

  // 3. Seed elements
  console.log('\n── Step 2/3: Publishing 3 seed relay elements (v2-shape) ──');
  const elementRefs = [];
  for (const elem of SEED_ELEMENTS) {
    const built = mintElement(elem, accounts, header.uuid);
    const pubResp = await publish(built.event);
    const impResp = await importToNeo4j(built.uuid);
    const ok = pubResp.success && impResp.success;
    console.log(`   ${ok ? '✅' : '❌'} ${built.publisher.padEnd(16)} → ${elem.slug.padEnd(14)} (${elem.country}/${elem.language})`);
    elementRefs.push({ ...elem, eventId: built.event.id, publisherPubkey: accounts[elem.publisher].pk });
  }

  // 4. Optionally seed config
  if (SEED_CONFIG) {
    console.log('\n── Step 3/3: Seeding config/suggested-concept-authors.json ──');
    const configPath = path.resolve(__dirname, '../config/suggested-concept-authors.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.authors = Array.isArray(config.authors) ? config.authors : [];
    if (!config.authors.some((a) => a.pubkey === ta.pk)) {
      config.authors.push({
        pubkey: ta.pk,
        name: `Demo foreign TA (${FOREIGN_TA_NAME})`,
        description: `Foreign Tapestry Assistant for the Concept Discovery demo — publishes the ${CONCEPT_SLUG} concept with country + language fields and 3 seed relays.`,
        relays: ['ws://localhost:7777'],
      });
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`   ✅ appended ${ta.pk.slice(0, 12)}… to authors`);
    } else {
      console.log(`   ⏭  ${ta.pk.slice(0, 12)}… already in config`);
    }
  } else {
    console.log('\n── Step 3/3: skipped (pass --seed-config to update suggested-authors)');
  }

  // 5. Persist demo metadata
  const outPath = path.join(__dirname, 'demo-foreign-concept.json');
  fs.writeFileSync(outPath, JSON.stringify({
    taName: FOREIGN_TA_NAME,
    taPubkey: ta.pk,
    taNpub: encodeNpub(ta.pk),
    conceptSlug: CONCEPT_SLUG,
    conceptCoordinate: header.uuid,
    headerEventId: header.event.id,
    supports: supportRefs,
    elements: elementRefs,
  }, null, 2));

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  ✨  FOREIGN CONCEPT MINTED');
  console.log('══════════════════════════════════════════════════════');
  console.log();
  console.log(`  Foreign TA pubkey: ${ta.pk}`);
  console.log(`  Coordinate:        ${header.uuid}`);
  console.log(`  Bundle:            8 events  (header + 7 supports)`);
  console.log(`  Seed elements:     ${SEED_ELEMENTS.length} (Tokyo, Berlin, US Mirror)`);
  console.log();
  console.log('  Next:');
  console.log('    Visit /kg/concept-discovery → import the foreign concept');
  console.log('    Then /kg/concepts/<uuid>/elements should show the 3 seeds');
  console.log();
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
