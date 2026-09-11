/**
 * Story dlist-item-tagging #4 — "Tagged items on the tag page".
 *
 * Story: engineering-team/stories/dlist-item-tagging/4-tagged-items-on-the-tag-page.md
 * Design note (Light lane): in that story file. No ADR (no irreversibility trigger).
 *
 * The design's central claim is that the change is PURELY ADDITIVE: `for-tag` grows an
 * `items` group (two key spaces — `{address}` for kind-39999 list items, `{id}` for
 * non-addressable kind-9999 items) while `notes`/`members`/`fullMembers`/`total`/
 * `truncated` keep TODAY's contents byte-for-byte — because `members`/`fullMembers`
 * feed the TA-signed kind-30393 note Trusted List (refreshPinnedTags.runOneNotePin)
 * and the documented external contract.
 *
 * Test levels (handle legend, used by the story's AC→handle lines):
 *   U*  — BEHAVIORAL. `aggregateNotesTagged` / `handleForTag` are server CJS and are
 *         called for real with injected I/O: `child_process.exec` is patched (that is
 *         the module-local `strfryScan` seam), and `_shared/relaySource`,
 *         `_shared/povStatus`, `_shared/noteEnrichment` are replaced in the require
 *         cache. No stack, no Meili, no neo4j, no relay.
 *   S*  — SOURCE-CONTRACT. The UI half is ESM/JSX (not requirable from the Node
 *         runner), so those ACs are pinned by reading the source. Documented gap.
 *   R*  — REGRESSION SENTINEL. Passes TODAY and must keep passing (AC-6 / E1 / E9).
 *
 * Pre-implementation: every U- and S-test that names a NEW field or file FAILS; the R*
 * sentinels PASS. The E1 additivity expectation is written out by hand (literal
 * expected arrays below) rather than re-derived from the code under test.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const EVENT_TAGS = path.join(REPO, 'src/api/event-tags/index.js');
const RELAY_SOURCE = path.join(REPO, 'src/api/_shared/relaySource.js');
const POV_STATUS = path.join(REPO, 'src/api/_shared/povStatus.js');
const ENRICHMENT = path.join(REPO, 'src/api/_shared/noteEnrichment.js');
const REFRESH_PINNED = path.join(REPO, 'src/api/trustedList/refreshPinnedTags.js');
const TAG_PAGE = path.join(REPO, 'ui/src/pages/Tag.jsx');
const TAG_ITEMS_VIEW = path.join(REPO, 'ui/src/components/TagItemsView.jsx');
const TAG_NOTES_VIEW = path.join(REPO, 'ui/src/components/TagNotesView.jsx');
const USE_NOTES_FOR_TAG = path.join(REPO, 'ui/src/hooks/useNotesForTag.js');
const DLIST_FIELDS = path.join(REPO, 'ui/src/utils/dlistFields.js');
const DLIST_TABLE = path.join(REPO, 'ui/src/components/dlist/DListItemsTable.jsx');
const DLIST_ITEM_TAGS = path.join(REPO, 'ui/src/components/dlist/DListItemTags.jsx');
const INTEGRATION_GUIDE = path.join(REPO, 'docs/INTEGRATION_GUIDE_event-tagging-for-external-clients.md');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual); const b = JSON.stringify(expected);
  assert(a === b, `${msg}\n  expected: ${b}\n  actual:   ${a}`);
}

// ───────────────────────── fixture identities ─────────────────────────
const hex = (c) => c.repeat(64);
const AUTHORITY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const JACK      = hex('1'); // tag author
const HEADAUTH  = hex('2'); // tagging-header author
const ALICE     = hex('3'); // asserter
const BOB       = hex('4'); // asserter
const VIEWER    = hex('7'); // logged-in viewer
const OWNER     = hex('5'); // DList owner (list header + items author)
const SLUG      = 'white-hat';
const HEADER_COORD = `39999:${HEADAUTH}:tagging:${SLUG}-tagging`;

// Targets
const NOTE1  = 'a1'.repeat(32); // kind-1 note
const NOTE2  = 'a2'.repeat(32); // kind-1 note
const ITEM9  = 'a9'.repeat(32); // kind-9999 (non-addressable) DList item → id-keyed item
const ORPHAN = 'af'.repeat(32); // resolves to neither kind 1 nor kind 9999 (E2b)
const ADDR_A = `39999:${OWNER}:gh-torvalds`;   // addressable DList item, list L1
const ADDR_B = `39999:${OWNER}:gh-antirez`;    // addressable DList item, list L2
const LIST1_COORD = `39998:${OWNER}:hackers`;  // kind-39998 header coordinate (z-parent)
const LIST2_COORD = `39998:${OWNER}:legends`;
const HEADER9998_ID = 'bb'.repeat(32);         // kind-9998 header EVENT ID (e-parent)

// ───────────────────────── fixture events ─────────────────────────
function taggingHeader() {
  return {
    id: 'h0'.repeat(32), kind: 39999, pubkey: HEADAUTH, created_at: 10, content: '',
    tags: [['d', `tagging:${SLUG}-tagging`], ['a', `39999:${JACK}:${SLUG}`],
           ['z', `39998:${AUTHORITY}:tagging-with-specific-tag`]],
  };
}
let taggingSeq = 0;
function tagging({ target, pubkey, created_at, polarity = 1 }) {
  taggingSeq += 1;
  const targetTag = target.id ? ['e', target.id] : ['a', target.address];
  return {
    id: (`t${taggingSeq}`.padStart(2, '0')).repeat(32).slice(0, 64), kind: 39999, pubkey, created_at, content: '',
    tags: [['z', HEADER_COORD], targetTag, ['polarity', String(polarity)]],
  };
}
function note(id, created_at) { return { id, kind: 1, pubkey: ALICE, created_at, content: 'hi', tags: [] }; }
function item9999(id, created_at, parentEventId) {
  return { id, kind: 9999, pubkey: OWNER, created_at, content: '',
    tags: [['e', parentEventId], ['name', 'someone'], ['github', 'someone']] };
}
function item39999(address, created_at, parentCoord) {
  const d = address.split(':').slice(2).join(':');
  return { id: ('c' + d).padEnd(64, '0').slice(0, 64), kind: 39999, pubkey: OWNER, created_at, content: '',
    tags: [['d', d], ['z', parentCoord], ['name', d], ['github', d]] };
}

/** The standard mixed fixture: kind-1 notes, a kind-9999 item, two kind-39999 items, an orphan id. */
function mixedFixture() {
  const events = [taggingHeader()];
  const taggings = [
    tagging({ target: { id: NOTE1 }, pubkey: ALICE, created_at: 100 }),
    tagging({ target: { id: NOTE1 }, pubkey: BOB, created_at: 110 }),
    tagging({ target: { id: NOTE2 }, pubkey: ALICE, created_at: 90 }),
    tagging({ target: { id: NOTE2 }, pubkey: BOB, created_at: 95, polarity: -1 }),
    tagging({ target: { id: ITEM9 }, pubkey: ALICE, created_at: 120 }),
    tagging({ target: { id: ORPHAN }, pubkey: ALICE, created_at: 70 }),
    tagging({ target: { address: ADDR_A }, pubkey: ALICE, created_at: 130 }),
    tagging({ target: { address: ADDR_B }, pubkey: BOB, created_at: 80 }),
  ];
  events.push(...taggings);
  events.push(note(NOTE1, 60), note(NOTE2, 61));
  events.push(item9999(ITEM9, 62, HEADER9998_ID));
  events.push(item39999(ADDR_A, 63, LIST1_COORD));
  events.push(item39999(ADDR_B, 64, LIST2_COORD));
  return events;
}

// The PRE-CHANGE notes track, written out by hand (NOT re-derived from the code under
// test). sort='recent' → rank by latest tagging time desc.
//   ITEM9 (120) > NOTE1 (110) > NOTE2 (95) > ORPHAN (70)
// The kind-9999 item id is STILL in the notes track — that pollution is OPEN 256, a
// pre-existing defect this story deliberately leaves alone (Design note, E1).
const EXPECTED_MEMBERS_RECENT = [
  { id: ITEM9,  applications: 1, disputes: 0, createdAt: 120, mine: null },
  { id: NOTE1,  applications: 2, disputes: 0, createdAt: 110, mine: null },
  { id: NOTE2,  applications: 1, disputes: 1, createdAt: 95,  mine: null },
  { id: ORPHAN, applications: 1, disputes: 0, createdAt: 70,  mine: null },
];
// sort='applied' → applications desc, recency tiebreak.
const EXPECTED_MEMBERS_APPLIED = [
  { id: NOTE1,  applications: 2, disputes: 0, createdAt: 110, mine: null },
  { id: ITEM9,  applications: 1, disputes: 0, createdAt: 120, mine: null },
  { id: NOTE2,  applications: 1, disputes: 1, createdAt: 95,  mine: null },
  { id: ORPHAN, applications: 1, disputes: 0, createdAt: 70,  mine: null },
];

// ───────────────────────── injected I/O harness ─────────────────────────
function matchesFilter(ev, f) {
  if (Array.isArray(f.kinds) && !f.kinds.includes(ev.kind)) return false;
  if (Array.isArray(f.ids) && !f.ids.includes(ev.id)) return false;
  if (Array.isArray(f.authors) && !f.authors.includes(ev.pubkey)) return false;
  for (const [k, vals] of Object.entries(f)) {
    if (!k.startsWith('#')) continue;
    const name = k.slice(1);
    const ok = (ev.tags || []).some((t) => t[0] === name && vals.includes(t[1]));
    if (!ok) return false;
  }
  return true;
}
function query(db, filter) {
  const out = db.filter((ev) => matchesFilter(ev, filter));
  return typeof filter.limit === 'number' ? out.slice(0, filter.limit) : out;
}

/**
 * Load src/api/event-tags/index.js with every I/O boundary faked:
 *  - child_process.exec  → the module-local `strfryScan` (headers + taggings scans)
 *  - _shared/relaySource → realScanStrfry (local kind-1 / kind-9999 / kind-39999 scans),
 *                          realQuerySync (external relay fetch), realRunCypher
 *  - _shared/povStatus   → resolvePovWithStatus (no Meili / neo4j)
 *  - _shared/noteEnrichment → identity
 */
function loadEventTags({ db = [], scanImpl, querySyncImpl } = {}) {
  const cp = require('child_process');
  const realExec = cp.exec;
  const savedCache = {};
  const stubPaths = [RELAY_SOURCE, POV_STATUS, ENRICHMENT];
  for (const p of stubPaths) savedCache[p] = require.cache[p];

  const calls = { strfry: [], scan: [], querySync: [] };

  cp.exec = (cmd, opts, cb) => {
    const done = typeof opts === 'function' ? opts : cb;
    const m = /^strfry scan '([\s\S]*)'$/.exec(cmd);
    if (!m) return done(new Error(`unexpected command: ${cmd}`));
    let filter;
    try { filter = JSON.parse(m[1].replace(/'\\''/g, "'")); }
    catch (e) { return done(e); }
    calls.strfry.push(filter);
    const ndjson = query(db, filter).map((e) => JSON.stringify(e)).join('\n');
    return done(null, ndjson, '');
  };

  const scan = scanImpl || ((filter) => query(db, filter));
  const stub = (p, exports) => { require.cache[p] = { id: p, filename: p, loaded: true, exports, children: [], paths: [] }; };
  stub(RELAY_SOURCE, {
    realScanStrfry: (filter) => { calls.scan.push(filter); return scan(filter); },
    realQuerySync: async (relays, filter) => {
      calls.querySync.push({ relays, filter });
      return querySyncImpl ? querySyncImpl(relays, filter) : [];
    },
    realRunCypher: async () => [],
    resolveGeneralPurposeRelays: async () => ({ relays: ['wss://fake.example'], fallback: true }),
    FALLBACK_RELAYS: ['wss://fake.example'],
  });
  stub(POV_STATUS, {
    resolvePovWithStatus: async () => ({ povSuffix: null, minRank: null, povResolution: { mode: 'unfiltered', requested: 'house' } }),
    computePovStatus: () => ({ mode: 'unfiltered' }),
  });
  stub(ENRICHMENT, { enrichNotes: async (notes) => notes });

  let mod = null; let loadError = null;
  try { delete require.cache[EVENT_TAGS]; } catch { /* */ }
  try { mod = require(EVENT_TAGS); } catch (e) { loadError = e; }

  cp.exec = realExec;
  for (const p of stubPaths) { if (savedCache[p] === undefined) delete require.cache[p]; else require.cache[p] = savedCache[p]; }
  try { delete require.cache[EVENT_TAGS]; } catch { /* */ }

  if (loadError) throw loadError;
  return { mod, calls };
}

async function aggregate(opts = {}, harness = {}) {
  const { mod, calls } = loadEventTags({ db: opts.db || mixedFixture(), ...harness });
  assert(mod && typeof mod.aggregateNotesTagged === 'function',
    'src/api/event-tags/index.js must export aggregateNotesTagged.');
  const out = await mod.aggregateNotesTagged({
    tagAuthor: JACK, slug: SLUG, authorities: [AUTHORITY],
    povSuffix: null, minRank: null, viewerPubkey: opts.viewerPubkey, sort: opts.sort || 'recent',
  });
  return { out, calls };
}

function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
async function callForTag(opts = {}, harness = {}) {
  const { mod, calls } = loadEventTags({ db: opts.db || mixedFixture(), ...harness });
  assert(mod && typeof mod.handleForTag === 'function', 'event-tags must export handleForTag.');
  const req = { query: { tagAuthor: JACK, slug: SLUG, nocache: '1', ...(opts.query || {}) } };
  const res = fakeRes();
  await mod.handleForTag(req, res);
  return { res, calls };
}

// ===========================================================================
// R* — regression sentinels (PASS today, must keep passing)
// ===========================================================================

test('R1: today, the notes track ranks and counts the mixed fixture exactly as the hand-written expectation (sort=recent)', async () => {
  const { out } = await aggregate();
  eq(out.members, EXPECTED_MEMBERS_RECENT, 'members must equal the hand-written pre-change expectation.');
  eq(out.fullMembers, EXPECTED_MEMBERS_RECENT, 'fullMembers must equal the hand-written pre-change expectation.');
  assert(out.total === 4, `total must be 4 (ITEM9, NOTE1, NOTE2, ORPHAN); got ${out.total}`);
  assert(out.truncated === false, 'truncated must be false for a 4-member fixture.');
});

test('R2: today, the notes track ranks the mixed fixture exactly as the hand-written expectation (sort=applied)', async () => {
  const { out } = await aggregate({ sort: 'applied' });
  eq(out.members, EXPECTED_MEMBERS_APPLIED, 'applied-sorted members must equal the hand-written expectation.');
});

test('R3: refreshPinnedTags.js still destructures only { fullMembers, scanTruncated, total } from the aggregation (declared non-consumer)', () => {
  const src = safeRead(REFRESH_PINNED);
  assert(src.length > 0, 'src/api/trustedList/refreshPinnedTags.js must exist.');
  const m = /const\s*\{([^}]*)\}\s*=\s*await\s+aggregateNotesTagged\(/.exec(src);
  assert(m, 'runOneNotePin must still destructure the aggregation result (refreshPinnedTags.js ~:351).');
  const keys = m[1].split(',').map((s) => s.trim()).filter(Boolean).sort();
  eq(keys, ['fullMembers', 'scanTruncated', 'total'],
    'The note-TL path must read NEITHER itemMembers NOR fullItemMembers — it is a declared non-consumer.');
});

test('R4: TagNotesView and the story-1/3 DList components are present and untouched by this story', () => {
  assert(safeRead(TAG_NOTES_VIEW).length > 0, 'ui/src/components/TagNotesView.jsx must still exist (AC-6).');
  assert(safeRead(DLIST_TABLE).length > 0, 'ui/src/components/dlist/DListItemsTable.jsx (story 1) must exist — the Items view reuses it.');
  assert(safeRead(DLIST_ITEM_TAGS).length > 0, 'ui/src/components/dlist/DListItemTags.jsx (story 3) must exist — the row tag affordance.');
  const fields = safeRead(DLIST_FIELDS);
  for (const fn of ['parseListRef', 'parseFieldDecls', 'headerNames', 'itemCoord']) {
    assert(new RegExp(`export function ${fn}\\b`).test(fields), `ui/src/utils/dlistFields.js must still export ${fn} (reused, not forked).`);
  }
});

test('R5: the for-tag cache key still includes the POV params, so one POV\'s items can never be served to another (E7)', () => {
  const src = safeRead(EVENT_TAGS);
  const m = /const cacheKey = `([^`]*)`/.exec(src);
  assert(m, 'handleForTag must still build a cacheKey template literal.');
  for (const part of ['wotPov', 'userPubkey', 'authorities', 'sort', 'viewerPubkey']) {
    assert(m[1].includes(`\${${part}`), `the for-tag cache key must still include ${part} (POV-safe caching).`);
  }
});

test('R6: the for-tag response still carries every field it publishes today (AC-6 / E9)', async () => {
  const { res } = await callForTag();
  assert(res.statusCode === 200, `for-tag must answer 200; got ${res.statusCode} (${res.body && res.body.error})`);
  for (const k of ['success', 'tagAuthor', 'slug', 'authorities', 'povSuffix', 'minRank', 'povResolution',
                   'sort', 'notes', 'members', 'mine', 'total', 'truncated', 'limit']) {
    assert(k in res.body, `for-tag response lost the existing field \`${k}\` — the change must be purely additive.`);
  }
  assert(!('rawEvents' in res.body), 'the byte channel must stay out of for-tag (R-http-1 envelope hygiene).');
});

// ===========================================================================
// U* — behavioral: the new items track
// ===========================================================================

test('U1 (AC-1): a-target taggings come back as a distinct items group instead of being dropped', async () => {
  const { out } = await aggregate();
  assert(Array.isArray(out.itemMembers), 'aggregateNotesTagged must return an `itemMembers` array (AC-1).');
  const addresses = out.itemMembers.filter((m) => m.address).map((m) => m.address);
  assert(addresses.includes(ADDR_A) && addresses.includes(ADDR_B),
    `both a-targets must appear in itemMembers; got ${JSON.stringify(addresses)}`);
});

test('U2 (AC-1): item members carry counted applications/disputes and the viewer\'s own stance', async () => {
  const db = mixedFixture();
  db.push(tagging({ target: { address: ADDR_A }, pubkey: VIEWER, created_at: 140, polarity: -1 }));
  db.push(tagging({ target: { address: ADDR_B }, pubkey: ALICE, created_at: 85, polarity: -1 }));
  const { out } = await aggregate({ db, viewerPubkey: VIEWER });
  const a = (out.itemMembers || []).find((m) => m.address === ADDR_A);
  const b = (out.itemMembers || []).find((m) => m.address === ADDR_B);
  assert(a, 'ADDR_A must be an item member.');
  eq({ applications: a.applications, disputes: a.disputes, mine: a.mine },
     { applications: 1, disputes: 1, mine: 'dispute' },
     'ADDR_A: one trusted apply, the viewer\'s own dispute counted + surfaced as `mine`.');
  assert(b && b.disputes === 1 && b.applications === 1,
    `ADDR_B must bucket its dispute like a note does (AC-5); got ${JSON.stringify(b)}`);
});

test('U3 (AC-1): the two key spaces are distinct — an address-keyed member has no id, an id-keyed member has no address', async () => {
  const { out } = await aggregate();
  const members = out.itemMembers || [];
  assert(members.length > 0, 'itemMembers must not be empty for this fixture.');
  for (const m of members) {
    const isAddr = Object.prototype.hasOwnProperty.call(m, 'address') && m.address;
    if (isAddr) {
      assert(!('id' in m), `address-keyed item member must NOT carry an \`id\` field: ${JSON.stringify(m)}`);
      eq(Object.keys(m).sort(), ['address', 'applications', 'createdAt', 'disputes', 'mine'],
        'address-keyed item member shape is { address, applications, disputes, createdAt, mine }.');
    } else {
      assert(!('address' in m), `id-keyed item member must NOT carry an \`address\` field: ${JSON.stringify(m)}`);
      eq(Object.keys(m).sort(), ['applications', 'createdAt', 'disputes', 'id', 'mine'],
        'id-keyed item member shape is { id, applications, disputes, createdAt, mine }.');
    }
  }
});

test('U4 (AC-1 / E1): a kind-9999 tagged id is classified into items via ONE bounded local kinds:[9999] id scan', async () => {
  const { out, calls } = await aggregate();
  const ids = (out.itemMembers || []).filter((m) => m.id).map((m) => m.id);
  assert(ids.includes(ITEM9), `the kind-9999 DList item id must appear in itemMembers; got ${JSON.stringify(ids)}`);
  const classScans = calls.scan.filter((f) => Array.isArray(f.kinds) && f.kinds.includes(9999) && Array.isArray(f.ids));
  assert(classScans.length === 1,
    `exactly one bounded kinds:[9999] id-classification scan is expected inside the aggregation; saw ${classScans.length}`);
  assert(classScans[0].ids.includes(ITEM9) && classScans[0].ids.includes(NOTE1),
    'the classification scan must be bounded to the tagged ids (all of them, resolved by kind — E2).');
});

test('R7 (E2b): an id that resolves to neither kind 1 nor kind 9999 stays in members but never leaks into items', async () => {
  const { out } = await aggregate();
  const itemKeys = (out.itemMembers || []).map((m) => m.id || m.address);
  assert(!itemKeys.includes(ORPHAN), 'an unresolvable tagged id must not appear in the items group.');
  assert(out.members.some((m) => m.id === ORPHAN), 'it must still appear in members — today\'s behavior, unchanged.');
});

test('R8 (E1, additivity): building the items track leaves members / fullMembers / total / truncated byte-identical', async () => {
  const { out } = await aggregate();
  eq(out.members, EXPECTED_MEMBERS_RECENT, 'members must be byte-identical to the pre-change expectation (feeds the kind-30393 note TL).');
  eq(out.fullMembers, EXPECTED_MEMBERS_RECENT, 'fullMembers must be byte-identical to the pre-change expectation.');
  assert(out.total === 4, `total must still be 4 (kind-9999 ids still present — OPEN 256 left alone); got ${out.total}`);
  assert(out.truncated === false, 'truncated must still be false.');
  for (const m of out.members) {
    assert(!('address' in m), `no a-coordinate may leak into members: ${JSON.stringify(m)}`);
    assert(typeof m.id === 'string' && /^[0-9a-f]{64}$/.test(m.id), `members must stay id-keyed: ${JSON.stringify(m)}`);
  }
});

test('U7 (E1 / comparator generalization): the generalized comparators preserve note-side ordering under every sort', async () => {
  for (const sort of ['recent', 'applied', 'disputed', 'divisive']) {
    const { out } = await aggregate({ sort });
    const expected = sort === 'applied' ? EXPECTED_MEMBERS_APPLIED
      : sort === 'recent' ? EXPECTED_MEMBERS_RECENT : null;
    if (expected) eq(out.members, expected, `sort=${sort}: note-side ordering must be unchanged.`);
    // disputed: NOTE2 (1 dispute) first, then the 0-dispute ids by recency.
    if (sort === 'disputed') {
      eq(out.members.map((m) => m.id), [NOTE2, ITEM9, NOTE1, ORPHAN], 'sort=disputed: note ordering must be unchanged.');
    }
    if (sort === 'divisive') {
      eq(out.members.map((m) => m.id), [NOTE2, NOTE1, ITEM9, ORPHAN], 'sort=divisive: note ordering must be unchanged.');
    }
  }
});

test('U8 (AC-5): the merged item key space is ranked by the same comparators as notes', async () => {
  const recent = (await aggregate({ sort: 'recent' })).out;
  eq((recent.itemMembers || []).map((m) => m.address || m.id), [ADDR_A, ITEM9, ADDR_B],
    'sort=recent: items rank by latest tagging time across BOTH key spaces (130, 120, 80).');
  const db = mixedFixture();
  db.push(tagging({ target: { address: ADDR_B }, pubkey: ALICE, created_at: 81 }));
  const applied = (await aggregate({ db, sort: 'applied' })).out;
  eq((applied.itemMembers || []).map((m) => m.address || m.id), [ADDR_B, ADDR_A, ITEM9],
    'sort=applied: 2 applications outrank 1, recency breaks the tie — one ranking, not a copied one.');
});

test('U9 (E10): itemTotal / itemTruncated report the items cap on their OWN track, independent of the notes cap', async () => {
  const db = mixedFixture();
  for (let i = 0; i < 60; i += 1) {
    db.push(tagging({ target: { address: `39999:${OWNER}:bulk-${i}` }, pubkey: ALICE, created_at: 200 + i }));
  }
  const { out } = await aggregate({ db });
  assert(out.itemTotal === 63, `itemTotal must count the whole item universe (60 bulk + ADDR_A + ADDR_B + ITEM9 = 63); got ${out.itemTotal}`);
  assert(out.itemMembers.length === 50, `itemMembers must be capped at the NOTES_CAP value (50); got ${out.itemMembers.length}`);
  assert(out.itemTruncated === true, 'itemTruncated must be true when itemTotal exceeds the cap — never silent.');
  assert(out.total === 4 && out.truncated === false,
    `the NOTES track must be untouched by item clipping; got total=${out.total} truncated=${out.truncated}`);
});

test('U10 (story-5 contract): fullItemMembers is the COMPLETE uncapped item membership', async () => {
  const db = mixedFixture();
  for (let i = 0; i < 60; i += 1) {
    db.push(tagging({ target: { address: `39999:${OWNER}:bulk-${i}` }, pubkey: ALICE, created_at: 200 + i }));
  }
  const { out } = await aggregate({ db });
  assert(Array.isArray(out.fullItemMembers), 'aggregateNotesTagged must return `fullItemMembers` (story-5 contract).');
  assert(out.fullItemMembers.length === out.itemTotal,
    `fullItemMembers must be uncapped (${out.itemTotal} expected); got ${out.fullItemMembers.length}`);
  eq(out.fullItemMembers.slice(0, 50), out.itemMembers, 'itemMembers must be exactly the capped prefix of fullItemMembers.');
});

test('U11 (story-5 eligibility): only address-keyed item members are eligible for a kind-30394 a-member list', async () => {
  const { out } = await aggregate();
  const eligible = (out.fullItemMembers || []).filter((m) => m.address);
  const ineligible = (out.fullItemMembers || []).filter((m) => !m.address);
  eq(eligible.map((m) => m.address).sort(), [ADDR_B, ADDR_A].sort(), 'the addressable items are the eligible ones.');
  eq(ineligible.map((m) => m.id), [ITEM9], 'the non-addressable kind-9999 item is present but NOT a-list eligible.');
  for (const m of eligible) assert(/^39999:[0-9a-f]{64}:.+$/.test(m.address), `an eligible member's address must be a valid a-coordinate: ${m.address}`);
});

test('U12 (E6): an uppercase pubkey and a colon-bearing d in an a-target still resolve and match', async () => {
  const weirdD = 'gh:some:one';
  const weird = `39999:${OWNER.toUpperCase()}:${weirdD}`;
  const db = mixedFixture();
  db.push(tagging({ target: { address: weird }, pubkey: ALICE, created_at: 150 }));
  db.push(item39999(`39999:${OWNER}:${weirdD}`, 65, LIST1_COORD));
  const { out } = await aggregate({ db });
  const found = (out.itemMembers || []).find((m) => (m.address || '').toLowerCase() === weird.toLowerCase());
  assert(found, `the uppercase-pubkey a-target must survive as an item member; got ${JSON.stringify((out.itemMembers || []).map((m) => m.address))}`);
});

// ===========================================================================
// U* — behavioral: the HTTP body (handleForTag)
// ===========================================================================

test('U13 (AC-1): the for-tag body gains items / itemTotal / itemTruncated, purely additively', async () => {
  const { res } = await callForTag();
  const b = res.body;
  assert(Array.isArray(b.items), 'the for-tag response must carry an `items` array.');
  assert(typeof b.itemTotal === 'number', 'the for-tag response must carry `itemTotal`.');
  assert(typeof b.itemTruncated === 'boolean', 'the for-tag response must carry `itemTruncated`.');
  eq(b.members, EXPECTED_MEMBERS_RECENT, 'members in the HTTP body must be byte-identical to the pre-change expectation.');
  assert(b.total === 4 && b.truncated === false, 'total/truncated in the HTTP body must be unchanged.');
});

test('U14 (AC-3): each resolved item carries its list parent as listCoord — z-coordinate for kind-39999, e-event-id for kind-9999', async () => {
  const { res } = await callForTag();
  const items = res.body.items || [];
  const byKey = (k) => items.find((i) => i.address === k || i.id === k);
  const a = byKey(ADDR_A);
  assert(a, `the kind-39999 item ${ADDR_A} must be resolved into items; got ${JSON.stringify(items.map((i) => i.address || i.id))}`);
  assert(a.listCoord === LIST1_COORD, `a kind-39999 item's listCoord is its z header coordinate; got ${a.listCoord}`);
  assert(a.kind === 39999 && a.pubkey === OWNER && Array.isArray(a.tags),
    'a resolved item carries kind / pubkey / created_at / tags / content for client-side field rendering.');
  const nine = byKey(ITEM9);
  assert(nine, 'the kind-9999 item must be resolved into items too.');
  assert(nine.listCoord === HEADER9998_ID, `a kind-9999 item's listCoord is its e-tag header EVENT ID; got ${nine.listCoord}`);
  assert(nine.address === null || nine.address === undefined, 'a non-addressable item has no address.');
  assert(typeof nine.applications === 'number' && 'mine' in nine, 'resolved items carry the counts + the viewer stance.');
});

test('U15 (AC-3 / E5): a second list\'s item is present with its own listCoord, so the client can group per list', async () => {
  const { res } = await callForTag();
  const b = (res.body.items || []).find((i) => i.address === ADDR_B);
  assert(b, 'the second list\'s item must be present.');
  assert(b.listCoord === LIST2_COORD, `it must name ITS OWN list; got ${b.listCoord}`);
  const coords = new Set((res.body.items || []).map((i) => i.listCoord));
  assert(coords.size >= 2, 'items from different lists must be distinguishable by listCoord (grouped client-side).');
});

test('U16 (E3): an a-target whose item event is on no reachable relay still appears as a row from its coordinate', async () => {
  const db = mixedFixture().filter((e) => !(e.kind === 39999 && (e.tags || []).some((t) => t[0] === 'd' && t[1] === 'gh-torvalds')));
  const { res } = await callForTag({ db });
  assert(res.statusCode === 200, 'an unresolvable item must not break the read.');
  const row = (res.body.items || []).find((i) => i.address === ADDR_A);
  assert(row, `the unresolved coordinate must still be rendered as a row; got ${JSON.stringify((res.body.items || []).map((i) => i.address || i.id))}`);
  assert(row.pubkey === OWNER, 'the row carries the author derived from the coordinate.');
});

test('U17 (E11): if the external relay round-trip throws, the notes half still answers 200 and the items group survives', async () => {
  const { res } = await callForTag({}, { querySyncImpl: async () => { throw new Error('relay exploded'); } });
  assert(res.statusCode === 200, `for-tag must degrade, not 500, when the external relay fetch throws; got ${res.statusCode} (${res.body && res.body.error})`);
  assert(Array.isArray(res.body.items) && res.body.items.length > 0, 'the locally-resolvable items must still be returned.');
  assert(Array.isArray(res.body.notes), 'the notes half must still be an array.');
});

test('U18 (E2): a local strfry failure during item classification degrades instead of throwing', async () => {
  const boom = (filter) => {
    if (Array.isArray(filter.kinds) && filter.kinds.includes(9999) && Array.isArray(filter.ids)) throw new Error('strfry down');
    return query(mixedFixture(), filter);
  };
  const { res } = await callForTag({}, { scanImpl: boom });
  assert(res.statusCode === 200, `a failing local classification scan must not 500 the read; got ${res.statusCode} (${res.body && res.body.error})`);
  assert(Array.isArray(res.body.items), 'the items group must still be present (empty or address-only) when the id-classification scan fails.');
  eq(res.body.members, EXPECTED_MEMBERS_RECENT, 'and the notes track must be unaffected by that failure.');
});

test('U19 (E9): a tag with zero item taggings returns an empty items group and an unchanged notes group', async () => {
  const db = mixedFixture().filter((e) => {
    if (e.kind !== 39999) return true;
    const isTagging = (e.tags || []).some((t) => t[0] === 'z' && t[1] === HEADER_COORD);
    if (!isTagging) return true;
    const target = (e.tags || []).find((t) => t[0] === 'a' || t[0] === 'e');
    return !(target[0] === 'a' || target[1] === ITEM9);
  });
  const { res } = await callForTag({ db });
  eq(res.body.items, [], 'no item taggings → an empty items array (the Items switch reads "(0)").');
  assert(res.body.itemTotal === 0 && res.body.itemTruncated === false, 'itemTotal 0, itemTruncated false.');
  assert(res.body.total === 3, `the notes track is unaffected (NOTE1, NOTE2, ORPHAN); got ${res.body.total}`);
});

test('U20 (Gate B finding 1): a non-39999 `a` target keeps its own kind — never relabelled 39999', async () => {
  // classify.js admits ANY a-coordinate, but the resolution scan only looks for
  // kind 39999. An unresolved long-form (30023) target must therefore report the
  // kind from its own coordinate; assuming 39999 both mislabels it on the
  // guide-documented items[].kind and, client-side, would make itemCoord mint a
  // 39999 coordinate that does not exist — so the row's tag affordance would
  // target the wrong event.
  const LONGFORM = `30023:${OWNER}:my-article`;
  const db = mixedFixture();
  db.push(tagging({ target: { address: LONGFORM }, pubkey: ALICE, created_at: 500 }));
  const { res } = await callForTag({ db });
  const row = res.body.items.find((m) => m.address === LONGFORM);
  assert(row, 'the long-form a-target must appear in the items group');
  assert(row.kind === 30023, `kind must come from the coordinate, got ${row.kind}`);
  const nine = res.body.items.find((m) => m.address === ADDR_A);
  assert(!nine || nine.kind === 39999, 'a real 39999 item still reports 39999');
});

// ===========================================================================
// S* — source contract (the ESM/JSX half, not requirable from the Node runner)
// ===========================================================================

test('S1 (AC-2): Tag.jsx gains an `items` value on the existing notesMode switch, with an Items button, inside the default tab', () => {
  const src = safeRead(TAG_PAGE);
  assert(src.length > 0, 'ui/src/pages/Tag.jsx must exist.');
  assert(/notesMode\s*===\s*'items'|notesMode\s*!==\s*'items'/.test(src),
    'Tag.jsx must add an `items` value to the existing notesMode switch (a third value, not a new tab).');
  assert(/setNotesMode\(\s*'items'\s*\)/.test(src), 'an Items switch button must set notesMode to \'items\'.');
  assert(/>\s*Items\b/.test(src), 'an "Items" label must appear beside Profiles|Notes.');
  assert(/TagItemsView/.test(src), 'Tag.jsx must mount TagItemsView.');
  assert(/const \[notesMode, setNotesMode\] = useState\('profiles'\)/.test(src),
    'the existing notesMode state and its default must be unchanged (AC-6).');
});

test('S2 (AC-2): TagItemsView is mounted eagerly-hidden and reports its count up, so the switch shows a count before the click', () => {
  const src = safeRead(TAG_PAGE);
  assert(/<TagItemsView[\s\S]{0,400}onCount=/.test(src),
    'TagItemsView must report its total through an onCount callback (the count must exist BEFORE the Items click).');
  assert(/hidden=\{notesMode !== 'items'\}/.test(src),
    'the Items view must be mounted eagerly and merely hidden (not lazily like notesOpened) so its count is available.');
});

test('S3 (AC-3): TagItemsView exists, renders one DListItemsTable per list group with the story-3 row tag affordance', () => {
  const src = safeRead(TAG_ITEMS_VIEW);
  assert(src.length > 0, 'ui/src/components/TagItemsView.jsx does not exist yet — the Items view component.');
  assert(/DListItemsTable/.test(src), 'TagItemsView must reuse the story-1 DListItemsTable (header-driven columns), not a new table.');
  assert(/renderExtra=/.test(src) && /DListItemTags/.test(src),
    'each row must carry the story-3 tag affordance via renderExtra={(item) => <DListItemTags … />}.');
  assert(/parseFieldDecls/.test(src) && /parseListRef/.test(src),
    'field declarations must be derived with the EXISTING pure parsers from utils/dlistFields (no server-side fork).');
  assert(/queryRelay/.test(src), 'headers must be batch-fetched client-side via ui/src/api/relay.js queryRelay.');
  assert(/9998/.test(src) && /39998/.test(src), 'the header batch must cover both parent forms: kind-9998 ids and kind-39998 coordinates.');
});

test('S4 (AC-3): each list group heading links to /list/<listCoord>', () => {
  const src = safeRead(TAG_ITEMS_VIEW);
  assert(/\/list\/\$\{|`\/list\/|to=\{`\/list\//.test(src) || /'\/list\/'\s*\+/.test(src),
    'each group heading must link to /list/<coord> so the item is traceable back to its list.');
  assert(/listCoord/.test(src), 'grouping must key on the server-provided listCoord.');
});

test('S5 (AC-4 / E4): an unresolvable list header renders a "list not on this relay" group that still shows coordinate + author', () => {
  const src = safeRead(TAG_ITEMS_VIEW);
  assert(/list not on this relay/i.test(src),
    'AC-4: a group whose header query returns nothing must be marked "list not on this relay".');
  assert(/fieldDecls/.test(src),
    'the degraded group must pass empty fieldDecls so DListItemsTable falls back to Added-by / Age / Other fields / Votes.');
});

test('S6 (AC-5): TagItemsView reuses TagViewControls with the same sort keys and POV disclosure as the Notes view', () => {
  const src = safeRead(TAG_ITEMS_VIEW);
  assert(/TagViewControls/.test(src), 'the Items view must reuse TagViewControls (identical sort/curated/expanded semantics).');
  const notes = safeRead(TAG_NOTES_VIEW);
  const sortsIn = (s) => ['recent', 'applied', 'disputed', 'divisive'].filter((k) => s.includes(`'${k}'`));
  eq(sortsIn(src).sort(), sortsIn(notes).sort(), 'the Items view must offer exactly the Notes view\'s sort keys (AC-5).');
});

test('S7: useNotesForTag returns items/itemTotal/itemTruncated ADDITIVELY — existing return keys untouched', () => {
  const src = safeRead(USE_NOTES_FOR_TAG);
  const m = /return\s*\{([^}]*)\}\s*;\s*\n\}/.exec(src) || /return\s*\{([^}]*)\}/.exec(src.split('\n').slice(-12).join('\n'));
  assert(m, 'useNotesForTag must return an object literal.');
  const keys = m[1].split(',').map((s) => s.trim().split(':')[0].trim()).filter(Boolean);
  for (const k of ['notes', 'total', 'truncated', 'loading', 'error', 'refetch']) {
    assert(keys.includes(k), `useNotesForTag must still return \`${k}\` (TagNotesView must compile untouched).`);
  }
  for (const k of ['items', 'itemTotal', 'itemTruncated']) {
    assert(keys.includes(k), `useNotesForTag must additionally return \`${k}\` (extend, don't fork the hook).`);
  }
  assert(!fs.existsSync(path.join(REPO, 'ui/src/hooks/useItemsForTag.js')),
    'no second hook file — the design rejects forking the POV/nocache/nonce logic.');
});

test('S8: the external integration guide documents the new fields additively and un-staleifies the single-cap line', () => {
  const src = safeRead(INTEGRATION_GUIDE);
  assert(src.length > 0, 'docs/INTEGRATION_GUIDE_event-tagging-for-external-clients.md must exist.');
  for (const k of ['items', 'itemTotal', 'itemTruncated']) {
    assert(src.includes(k), `the integration guide must document the new \`${k}\` field (cross-repo readers).`);
  }
  assert(!/caps at 50 most-recent notes per tag`?\s*$/m.test(src) || /itemTruncated/.test(src),
    'the stale "for-tag caps at 50 most-recent notes per tag" checklist line must be corrected to describe two independent caps.');
});

// ───────────────────────── runner ─────────────────────────
async function run() {
  let pass = 0; let fail = 0; const skipped = 0;
  for (const t of tests) {
    try { await t.fn(); pass += 1; console.log(`  ✓ ${t.name}`); }
    catch (e) { fail += 1; console.log(`  ✗ ${t.name}\n      ${e.message}`); }
  }
  return { pass, fail, skipped };
}

module.exports = { run };
