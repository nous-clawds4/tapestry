#!/usr/bin/env node
/**
 * Mint the Seven Dwarves v2 — "dwarf~1"
 *
 * Key difference from v1: list items are contributed by the community,
 * not all by the list owner.
 *   - Good actors contribute real dwarf items
 *   - Bad actors contribute pretender items
 *   - Nous-test-1 creates the list header but no items
 *
 * Reuses the 34 accounts from v1 (reads dwarves-test-data.json).
 * All events published to local strfry only.
 */

const { execSync } = require('child_process');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:8080';

// ── Load existing account data ───────────────────────────────

const dataPath = path.join(__dirname, 'dwarves-test-data.json');
if (!fs.existsSync(dataPath)) {
  console.error('❌ dwarves-test-data.json not found. Run mint-dwarves.js first.');
  process.exit(1);
}
const v1Data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const { listOwner, accounts: v1Accounts } = v1Data;

const NOUS_SK = listOwner.sk;
const NOUS_PK = listOwner.pk;

// ── Dwarf/actor definitions (same as v1) ─────────────────────

const REAL_DWARVES = ['Doc', 'Grumpy', 'Happy', 'Sleepy', 'Bashful', 'Sneezy', 'Dopey'];
const PRETENDERS = ['Grouchy', 'Jolly', 'Drowsy', 'Timid', 'Sniffles', 'Goofy', 'Brainy'];

const GOOD_ACTORS = [
  'Snow White', 'Prince Charming', 'Magic Mirror', 'Huntsman',
  'Forest Owl', 'Woodland Deer', 'Bluebird', 'Rabbit', 'Turtle', 'Wise Owl',
];
const BAD_ACTORS = [
  'Evil Queen', 'Poison Apple', 'Dark Mirror', 'Witch Cat',
  'Shadow', 'Goblin King', 'Troll', 'Imp', 'Wraith', 'Specter',
];

// ── Helpers ──────────────────────────────────────────────────

function signEvent(sk, eventJson) {
  const result = execSync(
    `echo '${JSON.stringify(eventJson).replace(/'/g, "'\\''")}' | nak event --sec ${sk}`,
    { encoding: 'utf8', shell: '/bin/zsh' }
  ).trim();
  return JSON.parse(result);
}

function apiPost(apiPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(apiPath, API);
    const data = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch { resolve({ raw: buf }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function publishEvent(event) {
  // Direct strfry import — bypass API publish restrictions on unknown pubkeys
  try {
    const escaped = JSON.stringify(event).replace(/'/g, "'\\''");
    execSync(`echo '${escaped}' | docker exec -i tapestry /usr/local/bin/strfry import --no-verify 2>/dev/null`, {
      encoding: 'utf8', shell: '/bin/zsh', timeout: 5000,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function importToNeo4j(uuid) {
  return apiPost('/api/neo4j/event-update', { uuid });
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('🏔️  Minting Seven Dwarves v2 (dwarf~1)\n');
  console.log('  Good actors contribute real dwarves');
  console.log('  Bad actors contribute pretenders\n');

  const LIST_DTAG = 'dwarf~1';
  const LIST_UUID = `39998:${NOUS_PK}:${LIST_DTAG}`;

  // 1. Create the list header (as Nous-test-1)
  console.log('── Step 1: Creating "dwarf~1" list header ──\n');

  const listHeaderEvent = signEvent(NOUS_SK, {
    kind: 39998,
    tags: [
      ['d', LIST_DTAG],
      ['names', 'dwarf', 'dwarves'],
      ['description', 'The Seven Dwarves of Snow White fame. Items contributed by the community.'],
    ],
    content: '',
    created_at: Math.floor(Date.now() / 1000),
  });

  const listResult = await publishEvent(listHeaderEvent);
  console.log(`   ${listResult.success ? '✅' : '❌'} List header published (uuid: ${LIST_UUID})`);
  await importToNeo4j(LIST_UUID);
  console.log(`   ✅ Imported to Neo4j\n`);

  // 2. Good actors contribute real dwarf items
  console.log('── Step 2: Good actors contribute real dwarf items ──\n');

  const itemEvents = {};
  const hash8 = crypto.createHash('sha256').update(LIST_UUID).digest('hex').slice(0, 8);

  for (let i = 0; i < REAL_DWARVES.length; i++) {
    const dwarfName = REAL_DWARVES[i];
    const actorName = GOOD_ACTORS[i]; // First 7 good actors each contribute one dwarf
    const actor = v1Accounts[actorName];
    const dwarf = v1Accounts[dwarfName];

    const slug = dwarfName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const dTag = `${slug}-${hash8}`;
    const itemUuid = `39999:${actor.pk}:${dTag}`;

    const itemEvent = signEvent(actor.sk, {
      kind: 39999,
      tags: [
        ['d', dTag],
        ['name', dwarfName],
        ['z', LIST_UUID],
        ['description', `${dwarfName} — a real dwarf. Contributed by ${actorName}.`],
        ['p', dwarf.pk],
      ],
      content: '',
      created_at: Math.floor(Date.now() / 1000),
    });

    const result = await publishEvent(itemEvent);
    itemEvents[dwarfName] = { event: itemEvent, author: actorName, authorPk: actor.pk, uuid: itemUuid };
    await importToNeo4j(itemUuid);
    console.log(`   ⛏️ ${result.success ? '✅' : '❌'} ${dwarfName} — contributed by ${actorName} (${actor.pk.slice(0, 12)}…)`);
  }

  console.log();

  // 3. Bad actors contribute pretender items
  console.log('── Step 3: Bad actors contribute pretender items ──\n');

  for (let i = 0; i < PRETENDERS.length; i++) {
    const pretenderName = PRETENDERS[i];
    const actorName = BAD_ACTORS[i]; // First 7 bad actors each contribute one pretender
    const actor = v1Accounts[actorName];
    const pretender = v1Accounts[pretenderName];

    const slug = pretenderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const dTag = `${slug}-${hash8}`;
    const itemUuid = `39999:${actor.pk}:${dTag}`;

    const itemEvent = signEvent(actor.sk, {
      kind: 39999,
      tags: [
        ['d', dTag],
        ['name', pretenderName],
        ['z', LIST_UUID],
        ['description', `${pretenderName} — definitely a real dwarf! Contributed by ${actorName}.`],
        ['p', pretender.pk],
      ],
      content: '',
      created_at: Math.floor(Date.now() / 1000),
    });

    const result = await publishEvent(itemEvent);
    itemEvents[pretenderName] = { event: itemEvent, author: actorName, authorPk: actor.pk, uuid: itemUuid };
    await importToNeo4j(itemUuid);
    console.log(`   👺 ${result.success ? '✅' : '❌'} ${pretenderName} — contributed by ${actorName} (${actor.pk.slice(0, 12)}…)`);
  }

  console.log();

  // 4. Good actors: upvote real dwarves, downvote pretenders
  console.log('── Step 4: Good actors voting ──\n');

  for (const actorName of GOOD_ACTORS) {
    const actor = v1Accounts[actorName];
    let ups = 0, downs = 0;

    for (const dwarfName of REAL_DWARVES) {
      const { event: targetEvent, authorPk } = itemEvents[dwarfName];
      const voteEvent = signEvent(actor.sk, {
        kind: 7,
        tags: [['e', targetEvent.id], ['p', authorPk]],
        content: '+',
        created_at: Math.floor(Date.now() / 1000),
      });
      await publishEvent(voteEvent);
      ups++;
    }

    for (const pretenderName of PRETENDERS) {
      const { event: targetEvent, authorPk } = itemEvents[pretenderName];
      const voteEvent = signEvent(actor.sk, {
        kind: 7,
        tags: [['e', targetEvent.id], ['p', authorPk]],
        content: '-',
        created_at: Math.floor(Date.now() / 1000),
      });
      await publishEvent(voteEvent);
      downs++;
    }

    console.log(`   😇 ${actorName}: +${ups} real, -${downs} pretenders`);
  }

  console.log();

  // 5. Bad actors: upvote pretenders, downvote real dwarves
  console.log('── Step 5: Bad actors voting ──\n');

  for (const actorName of BAD_ACTORS) {
    const actor = v1Accounts[actorName];
    let ups = 0, downs = 0;

    for (const pretenderName of PRETENDERS) {
      const { event: targetEvent, authorPk } = itemEvents[pretenderName];
      const voteEvent = signEvent(actor.sk, {
        kind: 7,
        tags: [['e', targetEvent.id], ['p', authorPk]],
        content: '+',
        created_at: Math.floor(Date.now() / 1000),
      });
      await publishEvent(voteEvent);
      ups++;
    }

    for (const dwarfName of REAL_DWARVES) {
      const { event: targetEvent, authorPk } = itemEvents[dwarfName];
      const voteEvent = signEvent(actor.sk, {
        kind: 7,
        tags: [['e', targetEvent.id], ['p', authorPk]],
        content: '-',
        created_at: Math.floor(Date.now() / 1000),
      });
      await publishEvent(voteEvent);
      downs++;
    }

    console.log(`   😈 ${actorName}: +${ups} pretenders, -${downs} real`);
  }

  console.log();

  // 6. Summary
  console.log('══════════════════════════════════════════════════════');
  console.log('  🏔️  TEST DATA v2 SUMMARY');
  console.log('══════════════════════════════════════════════════════\n');
  console.log(`  List owner:   Nous-test-1 (${NOUS_PK.slice(0, 16)}…)`);
  console.log(`  List UUID:    ${LIST_UUID}`);
  console.log(`  List d-tag:   ${LIST_DTAG}`);
  console.log(`  Items:        14 (7 real + 7 pretenders)`);
  console.log(`  Item authors: Good actors → real dwarves, Bad actors → pretenders`);
  console.log(`  Reactions:    ${20 * 14} kind 7 events (20 voters × 14 items)`);
  console.log(`  Good actors:  ${GOOD_ACTORS.length} (followed by Nous-test-1)`);
  console.log(`  Bad actors:   ${BAD_ACTORS.length} (NOT followed)`);
  console.log();
  console.log('  Scoring with Follow method (PoV = Nous-test-1):');
  console.log('    Real dwarves:  implicit +1 (author is good actor) + 9 upvotes = +10');
  console.log('                   BUT author\'s own explicit upvote ignored (no double count)');
  console.log('    Pretenders:    implicit +1 (author is bad actor, TW=0) → 0');
  console.log('                   + 10 bad actor upvotes (TW=0) → 0');
  console.log('                   + 10 good actor downvotes → -10');
  console.log('                   Net: -10');
  console.log();

  // Save v2 account data
  const summary = {
    version: 2,
    listOwner: { name: 'Nous-test-1', pk: NOUS_PK, sk: NOUS_SK },
    listDTag: LIST_DTAG,
    listUuid: LIST_UUID,
    items: Object.fromEntries(
      Object.entries(itemEvents).map(([name, data]) => [
        name,
        { eventId: data.event.id, author: data.author, authorPk: data.authorPk, uuid: data.uuid },
      ])
    ),
    itemContributors: {
      realDwarves: REAL_DWARVES.map((d, i) => ({ dwarf: d, contributor: GOOD_ACTORS[i] })),
      pretenders: PRETENDERS.map((p, i) => ({ pretender: p, contributor: BAD_ACTORS[i] })),
    },
  };

  const outPath = path.join(__dirname, 'dwarves-v2-test-data.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`  📄 Data saved to test-data/dwarves-v2-test-data.json\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
