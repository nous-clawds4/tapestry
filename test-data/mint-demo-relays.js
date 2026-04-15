#!/usr/bin/env node
/**
 * Mint demo nostr data for the Relay Discovery WoT demo.
 *
 * This script populates *both sides* of the story we want to tell:
 *
 *   1. A cast of actors with colour-coded kind-0 profiles so every pubkey is
 *      a human-recognizable character inside Brainstorm.
 *      - Good actors → green DiceBear "adventurer" avatars
 *      - Bad  actors → red   DiceBear "bottts"     avatars
 *      - Neutral     → gray  DiceBear "notionists" avatars
 *
 *   2. A non-trivial kind-3 follow graph published by those actors. Owner
 *      follows a small SEED of direct good actors. Those good actors
 *      follow other (non-seed) good actors, creating 2-hop and 3-hop
 *      paths with some cross-confirmation. Bad actors are an isolated
 *      cluster that only follows itself.
 *
 *   3. kind-39999 relay entries endorsed by a mix of these actors, and
 *      kind-39999 tag applications from good + bad actors. Some relays
 *      are endorsed ONLY by 2- or 3-hop good actors — those will score
 *      zero under Follow-List but non-zero under trusted-assertions-rank
 *      once the GR pipeline has run. That's the headline divergence this
 *      demo is designed to produce.
 *
 * After running this script:
 *   - Log in as the owner via NIP-07 on /kg/relay-discovery.
 *   - Click "Follow all demo good actors" (publishes owner's kind 3 to
 *     the 3 SEED good actors only).
 *   - Walk the GrapeRank Pipeline panel top to bottom. After step 5
 *     (treasure map), the Aggregated table will re-rank.
 *
 * Usage:
 *   node mint-demo-relays.js               # auto-detect port from docker compose
 *   node mint-demo-relays.js 7778          # explicit port override
 *   BRAINSTORM_API=http://host:8877 node mint-demo-relays.js
 *
 * Requires: `nak` on PATH, existing dwarves-test-data.json.
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

// ── Actor roster ─────────────────────────────────────────────

// All actors draw from dwarves-test-data.json keypairs.
//
// SEED good actors (owner follows these directly → hops 1). The DemoPanel's
// "Follow all demo good actors" button publishes owner's kind 3 using
// exactly this list.
const SEED_GOOD = ['Snow White', 'Huntsman', 'Prince Charming'];

// Second-tier good actors (reachable at hops 2 from owner, via SEED_GOOD's
// kind 3 that this script publishes).
const TIER2_GOOD = ['Bluebird', 'Wise Owl', 'Forest Owl', 'Magic Mirror'];

// Deep good actor (reachable at hops 3 via tier-2 follows).
const TIER3_GOOD = ['Turtle'];

const ALL_GOOD = [...SEED_GOOD, ...TIER2_GOOD, ...TIER3_GOOD];

// Bad actors form an isolated cluster — nobody in the good graph follows
// them, so GrapeRank never reaches them and their `rank` is null.
const BAD = ['Evil Queen', 'Troll', 'Shadow', 'Wraith', 'Goblin King', 'Dark Mirror'];

// Neutral third-party (a real dwarf). Not reachable by the good graph, not
// hostile. Useful for showing "unknown" vs "bad" visually.
const NEUTRAL = ['Doc'];

// ── Follow graph ─────────────────────────────────────────────
//
// What each actor publishes as their kind 3 contact list. Owner's own
// kind 3 is NOT published here — that comes from the UI when the user
// clicks the DemoPanel follow button. The distances below assume the owner
// has followed SEED_GOOD.
//
// hops=1: SEED_GOOD
// hops=2: TIER2_GOOD (reached from SEED_GOOD)
// hops=3: TIER3_GOOD (reached from TIER2_GOOD)
// hops=∞: BAD (isolated), NEUTRAL (no one trusted follows them)
const FOLLOWS = {
  // SEED_GOOD → TIER2_GOOD, with overlap so Bluebird & Wise Owl have 2
  // incoming edges from the trusted set (cross-confirmation → higher GR).
  'Snow White':      ['Bluebird', 'Wise Owl', 'Forest Owl'],
  'Huntsman':        ['Bluebird', 'Magic Mirror'],
  'Prince Charming': ['Wise Owl', 'Magic Mirror'],
  // TIER2_GOOD → TIER3_GOOD.
  'Bluebird':        ['Turtle'],
  'Wise Owl':        ['Turtle'],
  // Bad cluster: mutual follows among themselves, no edges to anyone good.
  'Evil Queen':      ['Troll', 'Shadow', 'Goblin King'],
  'Troll':           ['Evil Queen', 'Wraith'],
  'Shadow':          ['Wraith', 'Dark Mirror'],
  'Goblin King':     ['Evil Queen', 'Dark Mirror'],
};

// ── Relay composition ────────────────────────────────────────
//
// Each relay gets a distinct endorser profile designed to land on a
// different region of (Follow-List, GrapeRank) space:
//
//   relay            FL score      GR score     insight
//   --------------   ----------    ----------   ---------------------------
//   direct-good      high (2)      high         easy case — both agree
//   two-hop-only     zero          moderate     FL is silent, GR fills in
//   deep-cross       zero          small (+)    GR can reach 3 hops w/
//                                               cross-confirmation
//   mixed            low (1)       moderate     one direct + one bad
//   pure-bad         zero          zero         no trust from anyone
//   single-two-hop   zero          small        one 2-hop endorser
const RELAYS = [
  {
    slug: 'direct-good',
    websocketUrl: 'wss://direct-good.example.com',
    httpUrl: 'https://direct-good.example.com',
    publishers: ['Snow White', 'Huntsman'],                   // 2 direct (hops=1)
  },
  {
    slug: 'two-hop-only',
    websocketUrl: 'wss://two-hop-only.example.com',
    httpUrl: 'https://two-hop-only.example.com',
    publishers: ['Bluebird', 'Wise Owl', 'Forest Owl'],       // 3 tier-2 (hops=2)
  },
  {
    slug: 'deep-cross',
    websocketUrl: 'wss://deep-cross.example.com',
    httpUrl: 'https://deep-cross.example.com',
    publishers: ['Turtle'],                                   // 1 tier-3 (hops=3)
  },
  {
    slug: 'mixed',
    websocketUrl: 'wss://mixed.example.com',
    httpUrl: 'https://mixed.example.com',
    publishers: ['Prince Charming', 'Evil Queen'],            // 1 direct + 1 bad
  },
  {
    slug: 'pure-bad',
    websocketUrl: 'wss://pure-bad.example.com',
    httpUrl: 'https://pure-bad.example.com',
    publishers: ['Troll', 'Shadow'],                          // bad only
  },
  {
    slug: 'single-two-hop',
    websocketUrl: 'wss://single-two-hop.example.com',
    httpUrl: 'https://single-two-hop.example.com',
    publishers: ['Magic Mirror'],                             // 1 tier-2 (hops=2)
  },
];

// Tag applications, per relay slug. Good actors label accurately; bad
// actors add noise. Tag IDs resolved at runtime.
const TAG_APPLICATIONS = {
  'direct-good': [
    { actor: 'Snow White',       tag: 'free' },
    { actor: 'Snow White',       tag: 'outbox' },
    { actor: 'Huntsman',         tag: 'free' },
    { actor: 'Huntsman',         tag: 'inbox' },
  ],
  'two-hop-only': [
    { actor: 'Bluebird',         tag: 'free' },
    { actor: 'Bluebird',         tag: 'media-hosting' },
    { actor: 'Wise Owl',         tag: 'free' },
    { actor: 'Forest Owl',       tag: 'outbox' },
  ],
  'deep-cross': [
    { actor: 'Turtle',           tag: 'archive' },
  ],
  mixed: [
    { actor: 'Prince Charming',  tag: 'paid' },   // accurate
    { actor: 'Evil Queen',       tag: 'free' },   // misleading
  ],
  'pure-bad': [
    { actor: 'Troll',            tag: 'free' },   // misleading
    { actor: 'Shadow',           tag: 'outbox' }, // misleading
  ],
  'single-two-hop': [
    { actor: 'Magic Mirror',     tag: 'regional' },
  ],
};

// ── Kind-0 profile data ──────────────────────────────────────

// Short bios so the profile page has something to read.
const ABOUTS = {
  'Snow White':      'Princess. Direct good-actor seed. Owner follows directly.',
  'Huntsman':        'Good-actor seed. Forest-dweller. Owner follows directly.',
  'Prince Charming': 'Good-actor seed. Met the real dwarves at the wedding.',
  'Bluebird':        'Tier-2 good actor (2 hops from owner).',
  'Wise Owl':        'Tier-2 good actor (2 hops from owner).',
  'Forest Owl':      'Tier-2 good actor (2 hops from owner).',
  'Magic Mirror':    'Tier-2 good actor (2 hops from owner).',
  'Turtle':          'Tier-3 good actor (3 hops, cross-confirmed).',
  'Evil Queen':      'Bad actor. Cluster leader. Unreachable from owner.',
  'Troll':           'Bad actor. Isolated cluster.',
  'Shadow':          'Bad actor. Isolated cluster.',
  'Wraith':          'Bad actor. Isolated cluster.',
  'Goblin King':     'Bad actor. Isolated cluster.',
  'Dark Mirror':     'Bad actor. Isolated cluster.',
  Doc:               'Real dwarf. Neutral — not followed by anyone in the good graph.',
};

function groupOf(name) {
  if (ALL_GOOD.includes(name)) return 'good';
  if (BAD.includes(name)) return 'bad';
  return 'neutral';
}

// DiceBear config per group. Green good / red bad / gray neutral, consistent
// visual palette so you can tell at a glance who's who on any profile page.
const AVATAR_CONFIG = {
  good:    { style: 'adventurer', bg: '00cc44' },
  bad:     { style: 'bottts',     bg: 'ff2222' },
  neutral: { style: 'notionists', bg: '888888' },
};

function avatarUrl(name) {
  const cfg = AVATAR_CONFIG[groupOf(name)];
  const seed = encodeURIComponent(name);
  return `https://api.dicebear.com/9.x/${cfg.style}/svg?seed=${seed}&backgroundColor=${cfg.bg}&radius=50`;
}

// ── HTTP + nak helpers ───────────────────────────────────────

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
  if (process.env.BRAINSTORM_OWNER_PUBKEY) return process.env.BRAINSTORM_OWNER_PUBKEY.replace(/^"|"$/g, '');
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
  console.log('📡  Minting Relay Discovery demo data (profiles + follow graph + relays)\n');

  const seedPath = path.join(__dirname, 'dwarves-test-data.json');
  if (!fs.existsSync(seedPath)) {
    console.error(`❌  ${seedPath} not found. Run mint-dwarves.js first.`);
    process.exit(1);
  }
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const accounts = seed.accounts;

  const ROSTER = [...ALL_GOOD, ...BAD, ...NEUTRAL];
  for (const name of ROSTER) {
    if (!accounts[name]) {
      console.error(`❌  Missing account "${name}" in dwarves-test-data.json`);
      process.exit(1);
    }
  }

  const ownerPubkey = readOwnerPubkey();
  console.log(`  Target API:   ${API}`);
  console.log(`  Owner pubkey: ${ownerPubkey || '(not found)'}\n`);

  // 1) kind 0 profiles — with colour-coded avatars.
  console.log('── Step 1: Publishing kind-0 profiles ──\n');
  for (const name of ROSTER) {
    const acc = accounts[name];
    const group = groupOf(name);
    const picture = avatarUrl(name);
    const profile = {
      name,
      display_name: name,
      about: ABOUTS[name] || `${name} (${group} actor)`,
      picture,
    };
    const event = signEvent(acc.sk, {
      kind: 0,
      pubkey: acc.pk,
      content: JSON.stringify(profile),
      tags: [],
      created_at: Math.floor(Date.now() / 1000),
    });
    const resp = await publish(event);
    const badge = group === 'good' ? '🟢' : group === 'bad' ? '🔴' : '⚪';
    console.log(`  ${badge} ${name.padEnd(18)} ${resp.success ? '✅' : '❌'}`);
  }

  // 2) Firmware tag elements — needed for tag application event IDs.
  console.log('\n── Step 2: Resolving firmware tag elements ──\n');
  const tagsResp = await httpGet('/api/relay-discovery/available-tags');
  if (!tagsResp.success) {
    console.error(`❌  Failed to fetch available-tags: ${JSON.stringify(tagsResp)}`);
    process.exit(1);
  }
  const tagEventBySlug = Object.fromEntries(tagsResp.tags.map((t) => [t.slug, t.eventId]));
  console.log(`  Found ${tagsResp.tags.length} tags\n`);

  // 3) kind 3 follow events. Published on behalf of each actor defined in
  //    FOLLOWS. Owner's kind 3 is set from the UI button, not here.
  console.log('── Step 3: Publishing kind-3 follow graph ──\n');
  for (const [followerName, followees] of Object.entries(FOLLOWS)) {
    const acc = accounts[followerName];
    const tags = followees
      .filter((n) => accounts[n])
      .map((n) => ['p', accounts[n].pk]);
    const event = signEvent(acc.sk, {
      kind: 3,
      pubkey: acc.pk,
      tags,
      content: '',
      created_at: Math.floor(Date.now() / 1000),
    });
    const resp = await publish(event);
    console.log(`  ${resp.success ? '✅' : '❌'} ${followerName.padEnd(18)} → ${followees.join(', ')}`);
  }

  // 4) kind 39999 relay entries. Imported into Neo4j right away so the
  //    aggregated endpoint has endorser authors to work with.
  console.log('\n── Step 4: Publishing relay entries ──\n');
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
      const badge = ALL_GOOD.includes(publisherName) ? '🟢' : BAD.includes(publisherName) ? '🔴' : '⚪';
      console.log(`     ${ok ? '✅' : '❌'} ${badge} ${publisherName}`);
      relayEventIdsBy[relay.slug].push({ publisher: publisherName, eventId: event.id });
    }
  }

  // 5) Tag applications.
  console.log('\n── Step 5: Publishing tag applications ──\n');
  let tagAppCount = 0;
  for (const [relaySlug, apps] of Object.entries(TAG_APPLICATIONS)) {
    console.log(`  🏷  ${relaySlug}`);
    const relayRefs = relayEventIdsBy[relaySlug];
    if (!relayRefs || relayRefs.length === 0) continue;
    for (const { actor, tag } of apps) {
      const acc = accounts[actor];
      const tagEventId = tagEventBySlug[tag];
      if (!acc || !tagEventId) continue;
      const { eventId: relayEventId } = relayRefs[0];
      const dTag = `tag-app-${tag}-${relayEventId.slice(0, 8)}-${acc.pk.slice(0, 8)}`;
      const payload = { nostrRelayTag: { relayEventId, tagEventId } };
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
      if (pubResp.success && impResp.success) tagAppCount++;
      const badge = ALL_GOOD.includes(actor) ? '🟢' : BAD.includes(actor) ? '🔴' : '⚪';
      console.log(`     ${pubResp.success ? '✅' : '❌'} ${badge} ${actor.padEnd(16)} → ${tag}`);
    }
  }

  // 6) Summary.
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  📡  RELAY DISCOVERY DEMO DATA');
  console.log('══════════════════════════════════════════════════════\n');
  console.log(`  Actors minted:       ${ROSTER.length} (${ALL_GOOD.length} good, ${BAD.length} bad, ${NEUTRAL.length} neutral)`);
  console.log(`  Follow events:       ${Object.keys(FOLLOWS).length}`);
  console.log(`  Relays published:    ${RELAYS.length}`);
  console.log(`  Relay events:        ${Object.values(relayEventIdsBy).reduce((s, a) => s + a.length, 0)}`);
  console.log(`  Tag applications:    ${tagAppCount}`);
  console.log();
  console.log('  Expected (Owner POV) ordering by scoring method:');
  console.log();
  console.log('    Follow List (count of SEED endorsers)');
  console.log('    --------------------------------------');
  console.log('    direct-good     2.00 (SW + H)');
  console.log('    mixed           1.00 (PC)');
  console.log('    two-hop-only    0.00  ← invisible');
  console.log('    deep-cross      0.00  ← invisible');
  console.log('    single-two-hop  0.00  ← invisible');
  console.log('    pure-bad        0.00');
  console.log();
  console.log('    Trusted Assertions (rank) — attenuated by hops');
  console.log('    --------------------------------------');
  console.log('    direct-good     high    (two hops=1 endorsers)');
  console.log('    two-hop-only    medium  (three hops=2 endorsers) ← GR surfaces this');
  console.log('    mixed           medium  (one hops=1 + one null)');
  console.log('    single-two-hop  low     (one hops=2 endorser)');
  console.log('    deep-cross      low     (one hops=3 endorser)      ← GR still reaches it');
  console.log('    pure-bad        zero');
  console.log();
  console.log('  Next steps:');
  console.log('    1. Open /kg/relay-discovery, log in as the owner.');
  console.log('    2. Click "Follow all demo good actors" (3 direct follows).');
  console.log('    3. Run the GrapeRank Pipeline steps 1-5 in order.');
  console.log('    4. Switch scoring method in Trust Determination to compare');
  console.log('       Follow List vs Trusted Assertions (rank).');
  if (ownerPubkey) console.log(`\n  Owner pubkey: ${ownerPubkey}`);

  const outPath = path.join(__dirname, 'demo-relays-data.json');
  fs.writeFileSync(outPath, JSON.stringify({
    seedGoodActors:   Object.fromEntries(SEED_GOOD.map((n) => [n, accounts[n].pk])),
    tier2GoodActors:  Object.fromEntries(TIER2_GOOD.map((n) => [n, accounts[n].pk])),
    tier3GoodActors:  Object.fromEntries(TIER3_GOOD.map((n) => [n, accounts[n].pk])),
    badActors:        Object.fromEntries(BAD.map((n) => [n, accounts[n].pk])),
    neutralActors:    Object.fromEntries(NEUTRAL.map((n) => [n, accounts[n].pk])),
    // Back-compat with the original demo-actors endpoint consumers — the
    // DemoPanel reads `goodActors` to populate the follow button.
    goodActors:       Object.fromEntries(SEED_GOOD.map((n) => [n, accounts[n].pk])),
    follows:          FOLLOWS,
    relays:           RELAYS.map((r) => ({
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
  console.log(`\n  📄 Demo data written to ${outPath}\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
