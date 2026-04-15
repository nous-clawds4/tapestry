#!/usr/bin/env node
/**
 * Mint a "foreign" Tapestry concept for the Concept Discovery demo.
 *
 * Uses one of the dwarves keypairs as the foreign Tapestry Assistant (TA)
 * pubkey and publishes a minimal but realistic `nostr-relay-v2` concept
 * bundle (kind-39998 ConceptHeader + kind-39999 JSONSchema) to local
 * strfry. The schema deliberately differs from our own `nostr-relay`
 * concept — it adds `country` and `language` fields — so importing it
 * produces a second installed concept under the same abstract idea,
 * demonstrating schema-level divergence between instances.
 *
 * After running this script:
 *   1. /api/concept-discovery/suggested-authors lists the foreign TA
 *      (appended to config/suggested-concept-authors.json if --seed-config
 *      is passed).
 *   2. /api/concept-discovery/concepts-by-pubkey?pubkey=<foreign-TA>
 *      returns the nostr-relay-v2 ConceptHeader.
 *   3. A user can preview + import it via the /kg/concept-discovery UI.
 *
 * Usage:
 *   node mint-foreign-concept.js               # publish only
 *   node mint-foreign-concept.js --seed-config # also add to the
 *                                              # suggested-authors config
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

// nostr-tools isn't reliably available on the host (lives only inside the
// container's named volume). For the npub encoding we shell out to `nak`
// which the dev environment already requires.
function encodeNpub(hex) {
  try {
    return execSync(`nak encode npub ${hex}`, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

// ── Port resolution (matches mint-demo-relays.js) ────────────

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
const FOREIGN_TA_NAME = 'Magic Mirror'; // arbitrary good-actor keypair from dwarves-test-data.json

// ── Concept definition — nostr-relay-v2 ──────────────────────

const CONCEPT_SLUG = 'nostr-relay-v2';
const CONCEPT_HUMAN = 'Nostr Relay (v2)';

// Note: `oKeys.singular` is used as the top-level property key in the schema.
// For cross-concept compatibility with user-published kind-39999s we keep it
// as `nostrRelay` (same key our canonical concept uses). Only the SHAPE
// inside that object diverges — new optional `country` and `language`.
const CONCEPT_HEADER_PAYLOAD = {
  word: {
    slug: `concept-header-for-the-concept-of-${CONCEPT_SLUG}`,
    name: `concept header for the concept of ${CONCEPT_HUMAN}`,
    title: `Concept Header for the Concept of ${CONCEPT_HUMAN}`,
    wordTypes: ['word', 'conceptHeader'],
  },
  conceptHeader: {
    description:
      'A Nostr relay (v2). Same idea as the canonical nostr-relay concept but with optional geographic + language metadata. Minted by a foreign TA for the Concept Discovery demo.',
    oNames: { singular: 'nostr relay v2', plural: 'nostr relays v2' },
    oSlugs: { singular: CONCEPT_SLUG, plural: `${CONCEPT_SLUG}s` },
    oKeys: { singular: 'nostrRelay', plural: 'nostrRelays' },
    oTitles: { singular: CONCEPT_HUMAN, plural: `${CONCEPT_HUMAN}s` },
    oLabels: { singular: 'NostrRelay', plural: 'NostrRelays' },
    'x-tapestry': { neo4j: { nodeLabelRequired: true } },
  },
};

const SCHEMA_PAYLOAD = {
  word: {
    slug: `json-schema-for-the-concept-of-${CONCEPT_SLUG}`,
    name: `JSON schema for the concept of ${CONCEPT_HUMAN}`,
    title: `JSON Schema for the Concept of ${CONCEPT_HUMAN}`,
    description: `JSON schema for the concept of ${CONCEPT_HUMAN}`,
    wordTypes: ['word', 'jsonSchema'],
    // coreMemberOf uuid is filled in after we know the foreign-TA-keyed header coordinate
  },
  jsonSchema: {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    name: CONCEPT_HUMAN.toLowerCase(),
    title: CONCEPT_HUMAN,
    description: `JSON Schema for ${CONCEPT_HUMAN}`,
    required: ['nostrRelay'],
    definitions: {},
    properties: {
      nostrRelay: {
        type: 'object',
        name: CONCEPT_HUMAN.toLowerCase(),
        title: CONCEPT_HUMAN,
        slug: CONCEPT_SLUG,
        description: `data about this ${CONCEPT_HUMAN}`,
        required: ['slug', 'websocketUrl'],
        properties: {
          slug: {
            type: 'string', name: 'slug', title: 'Slug', slug: 'slug',
            description: 'A unique kebab-case identifier for this relay',
          },
          websocketUrl: {
            type: 'string', name: 'websocketUrl', title: 'Websocket URL', slug: 'websocket-url',
            description: 'The websocket URL',
          },
          httpUrl: {
            type: 'string', name: 'httpUrl', title: 'HTTP URL', slug: 'http-url',
            description: 'The HTTP URL (optional)',
          },
          // NEW FIELDS — the visible "schema divergence" for the demo
          country: {
            type: 'string', name: 'country', title: 'Country', slug: 'country',
            description: 'ISO 3166-1 alpha-2 country code where this relay is hosted',
          },
          language: {
            type: 'string', name: 'language', title: 'Language', slug: 'language',
            description: 'BCP 47 language tag for the relay\'s primary community',
          },
        },
        'x-tapestry': { unique: ['slug', 'websocketUrl'] },
      },
    },
  },
};

// ── Helpers ──────────────────────────────────────────────────

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

async function publish(event) {
  return httpPost('/api/strfry/publish', { event, signAs: 'client' });
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('🧪  Minting a foreign Tapestry concept for Concept Discovery demo\n');

  const seedPath = path.join(__dirname, 'dwarves-test-data.json');
  if (!fs.existsSync(seedPath)) {
    console.error(`❌  ${seedPath} not found. Run mint-dwarves.js first.`);
    process.exit(1);
  }
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const ta = seed.accounts?.[FOREIGN_TA_NAME];
  if (!ta) {
    console.error(`❌  Missing account "${FOREIGN_TA_NAME}" in dwarves-test-data.json`);
    process.exit(1);
  }

  console.log(`  API:           ${API}`);
  console.log(`  Foreign TA:    ${FOREIGN_TA_NAME}`);
  console.log(`  Foreign pubkey: ${ta.pk}`);
  console.log(`  Concept slug:  ${CONCEPT_SLUG}\n`);

  // 1. ConceptHeader — kind 39998 ────────────────────────────
  console.log('── Step 1: publishing ConceptHeader (kind 39998) ──');
  const headerEvent = signEvent(ta.sk, {
    kind: 39998,
    pubkey: ta.pk,
    created_at: Math.floor(Date.now() / 1000),
    content: '',
    tags: [
      ['d', CONCEPT_SLUG],
      ['names', 'nostr relay v2', 'nostr relays v2'],
      ['slug', CONCEPT_SLUG],
      ['json', JSON.stringify(CONCEPT_HEADER_PAYLOAD)],
      ['description', CONCEPT_HEADER_PAYLOAD.conceptHeader.description],
    ],
  });
  const headerResp = await publish(headerEvent);
  const headerCoordinate = `39998:${ta.pk}:${CONCEPT_SLUG}`;
  console.log(`   ${headerResp.success ? '✅' : '❌'} ${headerCoordinate} (event ${headerEvent.id.slice(0, 16)}…)\n`);

  // 2. JSONSchema — kind 39999 z-tagged to the header ─────────
  console.log('── Step 2: publishing JSONSchema (kind 39999) ──');
  // Fill in the coreMemberOf reference now that we know the header coord.
  SCHEMA_PAYLOAD.word.coreMemberOf = [
    { slug: `concept-header-for-the-concept-of-${CONCEPT_SLUG}`, uuid: headerCoordinate },
  ];
  const schemaEvent = signEvent(ta.sk, {
    kind: 39999,
    pubkey: ta.pk,
    created_at: Math.floor(Date.now() / 1000),
    content: '',
    tags: [
      ['d', `${CONCEPT_SLUG}-schema`],
      ['name', `JSON schema for the concept of ${CONCEPT_HUMAN}`],
      ['description', `the json schema for the concept of ${CONCEPT_HUMAN}`],
      // z-tag points at the foreign TA's own json-schema concept. On this
      // install that won't resolve (we only have it under our own TA), so
      // Neo4j's derive pass will leave the edge unresolved. That's
      // acceptable for the demo — the schema still imports as a standalone
      // node with JSONSchema label.
      ['z', `39998:${ta.pk}:json-schema`],
      ['z', `39998:${ta.pk}:word`],
      ['json', JSON.stringify(SCHEMA_PAYLOAD)],
    ],
  });
  const schemaResp = await publish(schemaEvent);
  console.log(`   ${schemaResp.success ? '✅' : '❌'} ${CONCEPT_SLUG}-schema (event ${schemaEvent.id.slice(0, 16)}…)\n`);

  // 3. Optional — seed the suggested-authors config so the UI shows this TA
  if (SEED_CONFIG) {
    console.log('── Step 3: seeding config/suggested-concept-authors.json ──');
    const configPath = path.resolve(__dirname, '../config/suggested-concept-authors.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    config.authors = Array.isArray(config.authors) ? config.authors : [];
    if (!config.authors.some((a) => a.pubkey === ta.pk)) {
      config.authors.push({
        pubkey: ta.pk,
        name: `Demo foreign TA (${FOREIGN_TA_NAME})`,
        description: `Foreign Tapestry Assistant for the Concept Discovery demo — publishes the ${CONCEPT_SLUG} concept with country + language fields.`,
        relays: ['ws://localhost:7777'],
      });
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`   ✅ appended ${ta.pk.slice(0, 12)}… to authors\n`);
    } else {
      console.log(`   ⏭  ${ta.pk.slice(0, 12)}… already in config\n`);
    }
  }

  // 4. Persist demo metadata
  const outPath = path.join(__dirname, 'demo-foreign-concept.json');
  fs.writeFileSync(outPath, JSON.stringify({
    taName: FOREIGN_TA_NAME,
    taPubkey: ta.pk,
    taNpub: encodeNpub(ta.pk),
    conceptSlug: CONCEPT_SLUG,
    conceptCoordinate: headerCoordinate,
    headerEventId: headerEvent.id,
    schemaEventId: schemaEvent.id,
  }, null, 2));
  console.log(`  📄 Wrote demo metadata to ${outPath}`);

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  ✨  FOREIGN CONCEPT MINTED');
  console.log('══════════════════════════════════════════════════════\n');
  console.log(`  Foreign TA pubkey: ${ta.pk}`);
  console.log(`  Coordinate:        ${headerCoordinate}`);
  console.log();
  console.log('  Next:');
  console.log('    curl "$API/api/concept-discovery/concepts-by-pubkey?pubkey=' + ta.pk + '&relays=ws://localhost:7777"');
  console.log('    Navigate to /kg/concept-discovery and click the card to import.');
  console.log();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
