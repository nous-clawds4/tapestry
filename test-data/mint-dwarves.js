#!/usr/bin/env node
/**
 * Mint 34 test accounts, create a "dwarves" list, add items,
 * publish upvotes/downvotes, and output a summary.
 *
 * All events published to local strfry only.
 */

const { execSync } = require('child_process');
const http = require('http');

const API = 'http://localhost:8080';

// ── Account definitions ──────────────────────────────────────

const REAL_DWARVES = [
  { name: 'Doc',     about: 'The leader of the seven dwarves. Wears glasses and is the most intelligent.' },
  { name: 'Grumpy',  about: 'Always complaining, but has a heart of gold underneath.' },
  { name: 'Happy',   about: 'The jolliest dwarf, always smiling and laughing.' },
  { name: 'Sleepy',  about: 'Perpetually drowsy, often seen yawning.' },
  { name: 'Bashful', about: 'Shy and easily embarrassed, blushes at everything.' },
  { name: 'Sneezy',  about: 'Allergic to everything, his sneezes are legendary.' },
  { name: 'Dopey',   about: 'The youngest dwarf, silent but lovable.' },
];

const PRETENDERS = [
  { name: 'Grouchy',  about: 'Definitely a real dwarf. Definitely not a goblin in a hat.' },
  { name: 'Jolly',    about: 'So happy! Too happy? No, just the right amount of happy.' },
  { name: 'Drowsy',   about: 'Sleepy? No, Drowsy. Totally different dwarf.' },
  { name: 'Timid',    about: 'Like Bashful but... different. Trust me.' },
  { name: 'Sniffles', about: 'Has allergies just like a certain real dwarf.' },
  { name: 'Goofy',    about: 'Not to be confused with anyone. Unique dwarf.' },
  { name: 'Brainy',   about: 'The REAL smart one. Doc who?' },
];

const GOOD_ACTORS = [
  { name: 'Snow White',     about: 'Princess who lived with the seven dwarves. Knows them personally.' },
  { name: 'Prince Charming', about: 'Broke the curse. Met the real dwarves at the wedding.' },
  { name: 'Magic Mirror',   about: 'The fairest judge of all. Sees truth clearly.' },
  { name: 'Huntsman',       about: 'Saved Snow White. Visited the dwarves\' cottage.' },
  { name: 'Forest Owl',     about: 'Watches over the forest. Knows who comes and goes.' },
  { name: 'Woodland Deer',  about: 'Led Snow White to the cottage. Trusts the real dwarves.' },
  { name: 'Bluebird',       about: 'Sings with Snow White every morning. Friends with the dwarves.' },
  { name: 'Rabbit',         about: 'Lives near the diamond mine. Sees the dwarves daily.' },
  { name: 'Turtle',         about: 'Slow but observant. Has watched the dwarves for years.' },
  { name: 'Wise Owl',       about: 'Elder of the forest. Remembers when the dwarves first arrived.' },
];

const BAD_ACTORS = [
  { name: 'Evil Queen',    about: 'Wants chaos in the dwarf registry. Has her own agenda.' },
  { name: 'Poison Apple',  about: 'Looks good on the outside, rotten on the inside.' },
  { name: 'Dark Mirror',   about: 'Shows you what you want to see, not what is true.' },
  { name: 'Witch Cat',     about: 'Familiar of the Evil Queen. Does her bidding.' },
  { name: 'Shadow',        about: 'You never see Shadow coming. Manipulates from the dark.' },
  { name: 'Goblin King',   about: 'Wants his goblin friends recognized as dwarves.' },
  { name: 'Troll',         about: 'Lives under a bridge. Causes trouble for fun.' },
  { name: 'Imp',           about: 'Small, mischievous, and loves to cause confusion.' },
  { name: 'Wraith',        about: 'A ghostly presence that distorts the truth.' },
  { name: 'Specter',       about: 'Haunts the list, promoting fraudulent entries.' },
];

// ── Nous (list owner) ────────────────────────────────────────
// Using the Nous-test-1 account we already created
const NOUS_SK = '8eb83c4f6d89c1657699284a2089688e5b431052a996952591073ae35a07a165';
const NOUS_PK = 'beba5587f5e570afaf6f80d5f5565b3d19c29e82f669634ab199bf050ca375f4';

// ── Helpers ──────────────────────────────────────────────────

function generateKey() {
  const sk = execSync('nak key generate', { encoding: 'utf8' }).trim();
  const pk = execSync(`nak key public ${sk}`, { encoding: 'utf8' }).trim();
  return { sk, pk };
}

function signEvent(sk, eventJson) {
  const result = execSync(`echo '${JSON.stringify(eventJson).replace(/'/g, "'\\''")}' | nak event --sec ${sk}`, {
    encoding: 'utf8',
    shell: '/bin/zsh',
  }).trim();
  return JSON.parse(result);
}

function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API);
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
  return apiPost('/api/strfry/publish', { event, signAs: 'client' });
}

async function importToNeo4j(uuid) {
  return apiPost('/api/neo4j/event-update', { uuid });
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('🏔️  Minting the Seven Dwarves Test Data\n');

  const accounts = {};
  const allGroups = [
    { group: 'real-dwarves', list: REAL_DWARVES, emoji: '⛏️' },
    { group: 'pretenders', list: PRETENDERS, emoji: '👺' },
    { group: 'good-actors', list: GOOD_ACTORS, emoji: '😇' },
    { group: 'bad-actors', list: BAD_ACTORS, emoji: '😈' },
  ];

  // 1. Generate keypairs and publish profiles
  console.log('── Step 1: Generating keypairs and publishing profiles ──\n');

  for (const { group, list, emoji } of allGroups) {
    console.log(`${emoji} ${group}:`);
    for (const entry of list) {
      const { sk, pk } = generateKey();
      accounts[entry.name] = { sk, pk, group, ...entry };

      const profile = {
        name: entry.name,
        display_name: entry.name,
        about: entry.about,
      };

      const profileEvent = signEvent(sk, {
        kind: 0,
        tags: [],
        content: JSON.stringify(profile),
        created_at: Math.floor(Date.now() / 1000),
      });

      const result = await publishEvent(profileEvent);
      console.log(`   ${result.success ? '✅' : '❌'} ${entry.name} (${pk.slice(0, 12)}…)`);
    }
    console.log();
  }

  // 2. Create the "dwarves" list header (as Nous-test-1)
  console.log('── Step 2: Creating "dwarves" list header ──\n');

  const listHeaderEvent = signEvent(NOUS_SK, {
    kind: 39998,
    tags: [
      ['d', 'dwarf'],
      ['names', 'dwarf', 'dwarves'],
      ['description', 'The Seven Dwarves of Snow White fame. Curated by the community.'],
    ],
    content: '',
    created_at: Math.floor(Date.now() / 1000),
  });

  const listResult = await publishEvent(listHeaderEvent);
  const listUuid = `39998:${NOUS_PK}:dwarf`;
  console.log(`   ${listResult.success ? '✅' : '❌'} List header published (uuid: ${listUuid})`);

  await importToNeo4j(listUuid);
  console.log(`   ✅ Imported to Neo4j\n`);

  // 3. Add all 14 candidates as list items (as Nous-test-1)
  console.log('── Step 3: Adding 14 dwarf candidates as list items ──\n');

  const itemEvents = {};
  const allCandidates = [...REAL_DWARVES, ...PRETENDERS];

  for (const candidate of allCandidates) {
    const acc = accounts[candidate.name];
    const isReal = REAL_DWARVES.some(d => d.name === candidate.name);
    const emoji = isReal ? '⛏️' : '👺';

    // Deterministic d-tag: slug(name)-hash8(parentUuid)
    const slug = candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // We'll use a simple d-tag for readability: just the slug
    // (since all items have the same parent, collisions won't happen with unique names)
    const crypto = require('crypto');
    const hash8 = crypto.createHash('sha256').update(listUuid).digest('hex').slice(0, 8);
    const dTag = `${slug}-${hash8}`;

    const itemEvent = signEvent(NOUS_SK, {
      kind: 39999,
      tags: [
        ['d', dTag],
        ['name', candidate.name],
        ['z', listUuid],
        ['description', candidate.about],
        ['p', acc.pk],  // tag the candidate's pubkey for reference
      ],
      content: '',
      created_at: Math.floor(Date.now() / 1000),
    });

    const result = await publishEvent(itemEvent);
    itemEvents[candidate.name] = itemEvent;
    const itemUuid = `39999:${NOUS_PK}:${dTag}`;
    await importToNeo4j(itemUuid);
    console.log(`   ${emoji} ${result.success ? '✅' : '❌'} ${candidate.name} (${itemEvent.id.slice(0, 12)}…)`);
  }

  console.log();

  // 4. Good actors: upvote real dwarves, downvote pretenders
  console.log('── Step 4: Good actors voting ──\n');

  for (const actor of GOOD_ACTORS) {
    const acc = accounts[actor.name];
    let ups = 0, downs = 0;

    for (const dwarf of REAL_DWARVES) {
      const targetEvent = itemEvents[dwarf.name];
      const voteEvent = signEvent(acc.sk, {
        kind: 7,
        tags: [['e', targetEvent.id], ['p', NOUS_PK]],
        content: '+',
        created_at: Math.floor(Date.now() / 1000),
      });
      await publishEvent(voteEvent);
      ups++;
    }

    for (const pretender of PRETENDERS) {
      const targetEvent = itemEvents[pretender.name];
      const voteEvent = signEvent(acc.sk, {
        kind: 7,
        tags: [['e', targetEvent.id], ['p', NOUS_PK]],
        content: '-',
        created_at: Math.floor(Date.now() / 1000),
      });
      await publishEvent(voteEvent);
      downs++;
    }

    console.log(`   😇 ${actor.name}: +${ups} real, -${downs} pretenders`);
  }

  console.log();

  // 5. Bad actors: upvote pretenders, downvote real dwarves
  console.log('── Step 5: Bad actors voting ──\n');

  for (const actor of BAD_ACTORS) {
    const acc = accounts[actor.name];
    let ups = 0, downs = 0;

    for (const pretender of PRETENDERS) {
      const targetEvent = itemEvents[pretender.name];
      const voteEvent = signEvent(acc.sk, {
        kind: 7,
        tags: [['e', targetEvent.id], ['p', NOUS_PK]],
        content: '+',
        created_at: Math.floor(Date.now() / 1000),
      });
      await publishEvent(voteEvent);
      ups++;
    }

    for (const dwarf of REAL_DWARVES) {
      const targetEvent = itemEvents[dwarf.name];
      const voteEvent = signEvent(acc.sk, {
        kind: 7,
        tags: [['e', targetEvent.id], ['p', NOUS_PK]],
        content: '-',
        created_at: Math.floor(Date.now() / 1000),
      });
      await publishEvent(voteEvent);
      downs++;
    }

    console.log(`   😈 ${actor.name}: +${ups} pretenders, -${downs} real`);
  }

  console.log();

  // 6. Create Nous-test-1's follow list (kind 3) — follows only good actors
  console.log('── Step 6: Nous-test-1 follows the good actors ──\n');

  const followTags = GOOD_ACTORS.map(actor => ['p', accounts[actor.name].pk]);
  const followEvent = signEvent(NOUS_SK, {
    kind: 3,
    tags: followTags,
    content: '',
    created_at: Math.floor(Date.now() / 1000),
  });

  const followResult = await publishEvent(followEvent);
  console.log(`   ${followResult.success ? '✅' : '❌'} Follow list published (${followTags.length} follows)\n`);

  // 7. Summary
  console.log('══════════════════════════════════════════════════════');
  console.log('  🏔️  TEST DATA SUMMARY');
  console.log('══════════════════════════════════════════════════════\n');
  console.log(`  List owner:   Nous-test-1 (${NOUS_PK.slice(0, 16)}…)`);
  console.log(`  List UUID:    ${listUuid}`);
  console.log(`  List d-tag:   dwarf`);
  console.log(`  Items:        14 (7 real + 7 pretenders)`);
  console.log(`  Reactions:    ${20 * 14} kind 7 events (20 voters × 14 items)`);
  console.log(`  Good actors:  ${GOOD_ACTORS.length} (followed by Nous-test-1)`);
  console.log(`  Bad actors:   ${BAD_ACTORS.length} (NOT followed)`);
  console.log();
  console.log('  Expected results with Follow method (PoV = Nous-test-1):');
  console.log('    Real dwarves:  trust score ≈ +10 each');
  console.log('    Pretenders:    trust score ≈ -10 each');
  console.log();

  // Save account data for reference
  const summary = {
    listOwner: { name: 'Nous-test-1', pk: NOUS_PK, sk: NOUS_SK },
    listUuid,
    accounts: Object.fromEntries(
      Object.entries(accounts).map(([name, acc]) => [name, { pk: acc.pk, sk: acc.sk, group: acc.group }])
    ),
    items: Object.fromEntries(
      Object.entries(itemEvents).map(([name, ev]) => [name, { eventId: ev.id }])
    ),
  };

  require('fs').writeFileSync(
    require('path').join(__dirname, 'dwarves-test-data.json'),
    JSON.stringify(summary, null, 2)
  );
  console.log('  📄 Account data saved to test-data/dwarves-test-data.json\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
