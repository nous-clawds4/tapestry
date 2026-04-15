#!/usr/bin/env node
/**
 * Mint demo nostr relay data for the Relay Discovery WoT demo.
 *
 * Reuses the keypairs minted by `mint-dwarves.js` (loaded from
 * dwarves-test-data.json) and publishes:
 *   - kind 39999 relay entries (nostr-relay concept) from a mix of
 *     good-actor and bad-actor pubkeys
 *   - kind 39999 nostr-relay-tag applications — good actors label
 *     relays accurately, bad actors miscategorize
 *
 * Every published event is imported into Neo4j so the relay discovery
 * aggregated view can surface endorser and tag-application counts.
 *
 * The demo narrative this enables:
 *
 *   1. The owner (whoever is logged into Brainstorm now) follows the
 *      demo good actors via NIP-07. (A "Follow all demo good actors"
 *      button is available on /kg/relay-discovery.)
 *   2. A fresh npub with no follows of its own visits the same page.
 *   3. They set their POV in Trust Determination to the owner pubkey.
 *   4. In the WoT Aggregated tab (with follow-list or GrapeRank
 *      scoring), relays endorsed by accounts the owner follows — the
 *      "good relays" — bubble to the top; bad-actor-endorsed relays
 *      are down-weighted.
 *
 * Usage (from tapestry/ root or test-data/):
 *
 *   node mint-demo-relays.js              # auto-detect port from docker compose
 *   node mint-demo-relays.js 7778         # explicit port override
 *   BRAINSTORM_API=http://host:8877 node mint-demo-relays.js
 *
 * Port resolution precedence (highest first):
 *   1. BRAINSTORM_API env var (full URL)
 *   2. First CLI argument (a port number)
 *   3. Derived from `docker inspect tapestry` (the mapped host port for
 *      container :7778, direct express — stable regardless of the nginx
 *      override port)
 *   4. Fallback to http://localhost:7778
 *
 * Requires: `nak` on PATH, existing dwarves-test-data.json, and — unless
 * BRAINSTORM_API is set — the tapestry container running under docker.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

function resolveApi() {
  if (process.env.BRAINSTORM_API) return process.env.BRAINSTORM_API;
  const argPort = process.argv[2];
  if (argPort && /^\d+$/.test(argPort)) return `http://localhost:${argPort}`;
  try {
    // Ask docker for the host-side port that maps to container :7778 (direct
    // express). This respects whatever the user has in docker-compose.yml +
    // any override file, without us having to parse yaml.
    const raw = execSync(
      "docker inspect tapestry --format '{{(index (index .NetworkSettings.Ports \"7778/tcp\") 0).HostPort}}'",
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (/^\d+$/.test(raw)) return `http://localhost:${raw}`;
  } catch {}
  return 'http://localhost:7778';
}

const API = resolveApi();
const TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const NOSTR_RELAY_Z_TAG = `39998:${TA_PUBKEY}:nostr-relay`;
const NOSTR_RELAY_TAG_Z_TAG = `39998:${TA_PUBKEY}:nostr-relay-tag`;

// ── Demo composition ─────────────────────────────────────────

// Subset of dwarves accounts we draw from. Names must exactly match
// entries in dwarves-test-data.json.
const GOOD_NAMES = ['Snow White', 'Huntsman', 'Bluebird', 'Prince Charming', 'Wise Owl'];
const BAD_NAMES  = ['Evil Queen', 'Troll', 'Shadow', 'Wraith', 'Goblin King'];
const NEUTRAL_NAMES = ['Doc']; // neutral third-party endorser (a real dwarf)

// Relays to mint. Each relay is published as kind 39999 by one or more
// accounts. The resulting endorser list drives the "By Account"/"WoT"
// views.
const RELAYS = [
  {
    slug: 'goodrelay-one',
    websocketUrl: 'wss://goodrelay-one.example.com',
    httpUrl: 'https://goodrelay-one.example.com',
    publishers: ['Snow White', 'Huntsman'],
    description: 'Well-regarded general-purpose relay endorsed by reputable actors.',
  },
  {
    slug: 'goodrelay-two',
    websocketUrl: 'wss://goodrelay-two.example.com',
    httpUrl: 'https://goodrelay-two.example.com',
    publishers: ['Bluebird'],
    description: 'Media-hosting relay endorsed by a reputable actor.',
  },
  {
    slug: 'badrelay-spam',
    websocketUrl: 'wss://spam.example.com',
    httpUrl: 'https://spam.example.com',
    publishers: ['Evil Queen', 'Troll'],
    description: 'Spam / low-quality relay endorsed only by bad actors.',
  },
  {
    slug: 'shady-relay',
    websocketUrl: 'wss://shady.example.com',
    httpUrl: 'https://shady.example.com',
    publishers: ['Shadow', 'Wraith'],
    description: 'Opaque paid relay pushed by bad actors.',
  },
  {
    slug: 'disputed-relay',
    websocketUrl: 'wss://disputed.example.com',
    httpUrl: 'https://disputed.example.com',
    publishers: ['Prince Charming', 'Goblin King'],
    description: 'Relay with one endorsement from each camp — should resolve by trust weight.',
  },
  {
    slug: 'neutral-relay',
    websocketUrl: 'wss://neutral.example.com',
    httpUrl: 'https://neutral.example.com',
    publishers: ['Doc'],
    description: 'A neutral endorsement from a real dwarf.',
  },
];

// Tag applications. Keys reference relays by slug; values are lists of
// { actor, tag } pairs. Good actors produce accurate labels; bad actors
// push misleading labels (e.g. marking the spam relay as "free").
const TAG_APPLICATIONS = {
  'goodrelay-one': [
    { actor: 'Snow White', tag: 'free' },
    { actor: 'Snow White', tag: 'outbox' },
    { actor: 'Huntsman', tag: 'free' },
    { actor: 'Huntsman', tag: 'inbox' },
    { actor: 'Wise Owl', tag: 'free' },
  ],
  'goodrelay-two': [
    { actor: 'Bluebird', tag: 'free' },
    { actor: 'Bluebird', tag: 'media-hosting' },
    { actor: 'Snow White', tag: 'media-hosting' },
  ],
  'badrelay-spam': [
    { actor: 'Evil Queen', tag: 'free' },   // misleading
    { actor: 'Troll', tag: 'outbox' },      // misleading
    { actor: 'Snow White', tag: 'nsfw' },   // accurate
  ],
  'shady-relay': [
    { actor: 'Shadow', tag: 'free' },       // misleading
    { actor: 'Wraith', tag: 'archive' },    // misleading
    { actor: 'Huntsman', tag: 'paid' },     // accurate
  ],
  'disputed-relay': [
    { actor: 'Prince Charming', tag: 'free' },
    { actor: 'Prince Charming', tag: 'outbox' },
    { actor: 'Goblin King', tag: 'archive' },  // wrong
    { actor: 'Goblin King', tag: 'nsfw' },     // wrong
  ],
  'neutral-relay': [
    { actor: 'Doc', tag: 'free' },
  ],
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

function httpGet(pathname) {
  return new Promise((resolve, reject) => {
    http.get(new URL(pathname, API), (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch { resolve({ raw: buf, status: res.statusCode }); }
      });
    }).on('error', reject);
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

async function importToNeo4j(uuid) {
  return httpPost('/api/neo4j/event-update', { uuid });
}

function readOwnerPubkey() {
  // Prefer env var so this works when run outside docker too.
  if (process.env.BRAINSTORM_OWNER_PUBKEY) {
    return process.env.BRAINSTORM_OWNER_PUBKEY.replace(/^"|"$/g, '');
  }
  try {
    const raw = execSync('docker exec tapestry cat /etc/brainstorm.conf', { encoding: 'utf8' });
    const m = raw.match(/^(?:export\s+)?BRAINSTORM_OWNER_PUBKEY=\"?([0-9a-f]{64})\"?/m);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('📡  Minting Relay Discovery demo data\n');

  // Load dwarves keypairs
  const seedPath = path.join(__dirname, 'dwarves-test-data.json');
  if (!fs.existsSync(seedPath)) {
    console.error(`❌  ${seedPath} not found. Run mint-dwarves.js first.`);
    process.exit(1);
  }
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const accounts = seed.accounts;

  // Sanity check all required names are present
  for (const name of [...GOOD_NAMES, ...BAD_NAMES, ...NEUTRAL_NAMES]) {
    if (!accounts[name]) {
      console.error(`❌  Missing account "${name}" in dwarves-test-data.json`);
      process.exit(1);
    }
  }

  const ownerPubkey = readOwnerPubkey();
  console.log(`  Target API:   ${API}`);
  console.log(`  Owner pubkey: ${ownerPubkey || '(not found)'}`);
  console.log();

  // Resolve tag event IDs (firmware-seeded kind 39999 tag elements)
  console.log('── Resolving firmware tag elements ──\n');
  const tagsResp = await httpGet('/api/relay-discovery/available-tags');
  if (!tagsResp.success) {
    console.error(`❌  Failed to fetch available-tags: ${JSON.stringify(tagsResp)}`);
    process.exit(1);
  }
  const tagEventBySlug = Object.fromEntries(tagsResp.tags.map((t) => [t.slug, t.eventId]));
  console.log(`  Found ${tagsResp.tags.length} tags: ${tagsResp.tags.map((t) => t.slug).join(', ')}\n`);

  // 1) Publish the relay entries
  console.log('── Step 1: Publishing relay entries ──\n');

  // relayEventIdsBy[slug] = [{ publisher, eventId }]
  const relayEventIdsBy = {};

  for (const relay of RELAYS) {
    relayEventIdsBy[relay.slug] = [];
    console.log(`  📡 ${relay.slug} (${relay.websocketUrl})`);
    for (const publisherName of relay.publishers) {
      const acc = accounts[publisherName];
      const dTag = `${relay.slug}-${acc.pk.slice(0, 8)}`;
      const payload = {
        nostrRelay: {
          slug: relay.slug,
          websocketUrl: relay.websocketUrl,
          httpUrl: relay.httpUrl,
        },
      };
      const event = signEvent(acc.sk, {
        kind: 39999,
        pubkey: acc.pk,
        tags: [
          ['d', dTag],
          ['name', relay.slug],
          ['z', NOSTR_RELAY_Z_TAG],
          ['json', JSON.stringify(payload)],
        ],
        content: '',
        created_at: Math.floor(Date.now() / 1000),
      });
      const pubResp = await publish(event);
      const uuid = `39999:${acc.pk}:${dTag}`;
      const impResp = await importToNeo4j(uuid);
      const ok = pubResp.success && impResp.success;
      console.log(`     ${ok ? '✅' : '❌'} by ${publisherName} (${acc.pk.slice(0, 12)}…)  pub:${!!pubResp.success} imp:${!!impResp.success}`);
      relayEventIdsBy[relay.slug].push({ publisher: publisherName, eventId: event.id });
    }
  }

  // 2) Publish tag applications
  console.log('\n── Step 2: Publishing tag applications ──\n');
  let tagAppCount = 0;
  for (const [relaySlug, apps] of Object.entries(TAG_APPLICATIONS)) {
    console.log(`  🏷  ${relaySlug}`);
    const relayRefs = relayEventIdsBy[relaySlug];
    if (!relayRefs || relayRefs.length === 0) {
      console.log(`     (no relay events for ${relaySlug}, skipping)`);
      continue;
    }
    for (const { actor, tag } of apps) {
      const acc = accounts[actor];
      if (!acc) {
        console.log(`     ⚠  missing actor "${actor}"`);
        continue;
      }
      const tagEventId = tagEventBySlug[tag];
      if (!tagEventId) {
        console.log(`     ⚠  unknown tag "${tag}"`);
        continue;
      }
      // Apply the tag against the first relay event we have for this slug.
      // That keeps the tag→relay graph simple even when multiple actors
      // published the same URL.
      const { eventId: relayEventId } = relayRefs[0];

      const dTag = `tag-app-${tag}-${relayEventId.slice(0, 8)}-${acc.pk.slice(0, 8)}`;
      const payload = {
        nostrRelayTag: {
          relayEventId,
          tagEventId,
        },
      };
      const event = signEvent(acc.sk, {
        kind: 39999,
        pubkey: acc.pk,
        tags: [
          ['d', dTag],
          ['name', `${relaySlug} is ${tag}`],
          ['z', NOSTR_RELAY_TAG_Z_TAG],
          ['json', JSON.stringify(payload)],
        ],
        content: '',
        created_at: Math.floor(Date.now() / 1000),
      });
      const pubResp = await publish(event);
      const uuid = `39999:${acc.pk}:${dTag}`;
      const impResp = await importToNeo4j(uuid);
      const ok = pubResp.success && impResp.success;
      console.log(`     ${ok ? '✅' : '❌'} ${actor.padEnd(16)} → ${tag}`);
      if (ok) tagAppCount++;
    }
  }

  // 3) Summary
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  📡  RELAY DISCOVERY DEMO DATA');
  console.log('══════════════════════════════════════════════════════\n');
  console.log(`  Relays published:    ${RELAYS.length}`);
  console.log(`  Relay events:        ${Object.values(relayEventIdsBy).reduce((s, a) => s + a.length, 0)}`);
  console.log(`  Tag applications:    ${tagAppCount}`);
  console.log();
  console.log('  Good actors (reputable) — owner should follow these:');
  for (const name of GOOD_NAMES) {
    console.log(`    ${name.padEnd(18)} ${accounts[name].pk}`);
  }
  console.log();
  console.log('  Bad actors (unreliable) — owner should NOT follow these:');
  for (const name of BAD_NAMES) {
    console.log(`    ${name.padEnd(18)} ${accounts[name].pk}`);
  }
  console.log();
  console.log('  Next steps:');
  console.log('    1. Open /kg/relay-discovery in the browser.');
  console.log('    2. Log in with the owner NIP-07 key.');
  console.log('    3. Click "Follow all demo good actors" (on the WoT Aggregated tab).');
  console.log('    4. Log in from a fresh npub, set POV in Trust Determination to');
  if (ownerPubkey) console.log(`       the owner pubkey: ${ownerPubkey}`);
  console.log('    5. Switch scoring method to "Follow List" and revisit the aggregated tab.');
  console.log();

  // Persist so other scripts / the UI can find demo actor pubkeys
  const outPath = path.join(__dirname, 'demo-relays-data.json');
  fs.writeFileSync(outPath, JSON.stringify({
    goodActors: Object.fromEntries(GOOD_NAMES.map((n) => [n, accounts[n].pk])),
    badActors: Object.fromEntries(BAD_NAMES.map((n) => [n, accounts[n].pk])),
    neutralActors: Object.fromEntries(NEUTRAL_NAMES.map((n) => [n, accounts[n].pk])),
    relays: RELAYS.map((r) => ({
      slug: r.slug,
      websocketUrl: r.websocketUrl,
      httpUrl: r.httpUrl,
      publishers: r.publishers,
      publisherPubkeys: r.publishers.map((n) => accounts[n].pk),
      events: relayEventIdsBy[r.slug],
    })),
    tagApplicationsByRelay: TAG_APPLICATIONS,
    ownerPubkey,
  }, null, 2));
  console.log(`  📄 Demo data written to ${outPath}\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
