/**
 * Story live-feed #1: Live-feed read path — recent notes from the source identity's follows.
 * ADR live-feed/0001. See engineering-team/stories/live-feed/1-feed-read-path.test-plan.md
 *
 * ADR chose Option A: a self-contained module `src/api/feed/feedReadPath.js`
 * exporting an orchestrator `buildFeed({ sessionPubkey })` and an Express handler
 * `handleGetFeed`, returning a discriminated `status` union
 *   { OK, EMPTY, NO_SOURCE, FOLLOW_LIST_UNAVAILABLE }
 * plus a `relaySource` discriminator { set, fallback }, each item shaped
 *   { id, pubkey, createdAt, content, author: { displayName, avatar } }.
 *
 * WHY behavioral, not source-regex: the operator's Gate-3 obligations require
 * the four outcomes + newest-first ordering + the 50-cap + kind-1-only filtering
 * (kind-6/7 + non-followed authors excluded) + the set-vs-fallback distinction to
 * be driven as OBSERVABLE BEHAVIOR, without touching live strfry, prod-scale
 * Neo4j, or external relays. buildFeed crosses four real I/O boundaries —
 *   - House PoV   : getSettings().grapevine.searchPreferences.povPubkey
 *   - kind-3/0    : exec/execSync `strfry scan ...` (local strfry)
 *   - relay set   : runCypher(...) on the the-set-of-general-purpose-relays node
 *   - kind-1      : SimplePool.querySync(relays, filter) (external relays)
 * so the tests inject FAKES for those four boundaries via buildFeed's options
 * object (the same `{ sessionPubkey }` object the ADR already passes). This is a
 * pure test seam: Story 2 calls buildFeed({ sessionPubkey }) with no deps and
 * gets the real helpers; the tests pass deps to stay hermetic. See the test plan
 * "ADR-refinement flag" — the Architect should ratify this injectable-seam
 * contract so the Implementer is obligated to honor injected deps.
 *
 * If the Implementer hard-wires the four boundaries and ignores injected deps,
 * the behavioral assertions below fail (they would hit real I/O / throw), which
 * is the correct pressure toward the seam — not a false pass.
 *
 * T-structural (S*) : pin module existence + the discriminated union so the
 *                     pre-implementation failure reads as "feature absent",
 *                     not a require crash.
 * T-behavioral (B*) : drive the five ACs + every edge outcome + ordering + cap +
 *                     filtering + relay discriminator.
 *
 * ALL tests FAIL pre-implementation (module absent) and must PASS post.
 */

const fs = require('fs');
const path = require('path');

const MODULE_PATH = path.resolve(__dirname, '../src/api/feed/feedReadPath.js');
const API_INDEX = path.resolve(__dirname, '../src/api/index.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

/**
 * Load the not-yet-written module without letting a missing-file `require`
 * crash the whole suite. Returns the module exports, or null if absent —
 * callers then assert a legible "feature absent" message.
 */
function loadModule() {
  try {
    delete require.cache[require.resolve(MODULE_PATH)];
  } catch { /* not resolvable yet — fine */ }
  try {
    return require(MODULE_PATH);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fixtures: pubkeys, kind-3/kind-1/kind-0 events, and the four injectable fakes.
// ---------------------------------------------------------------------------

const HEX = (c) => c.repeat(64);
const SOURCE = HEX('a');        // the source identity (login or house)
const HOUSE = HEX('b');         // House PoV pubkey
const FOLLOW_1 = HEX('1');      // a followed author
const FOLLOW_2 = HEX('2');      // a followed author
const STRANGER = HEX('9');      // NOT followed by the source

// A kind-3 follow-list event for `author` whose p-tags point at `followed`.
function kind3(author, followed) {
  return {
    id: 'k3-' + author.slice(0, 6),
    kind: 3,
    pubkey: author,
    created_at: 1000,
    tags: followed.map((pk) => ['p', pk]),
    content: '',
  };
}

// A kind-1 note.
function kind1(id, author, createdAt, content) {
  return { id, kind: 1, pubkey: author, created_at: createdAt, content, tags: [] };
}

/**
 * Build the four injectable fakes. Any of these can be overridden per-test.
 *  - getSettings   : returns { grapevine: { searchPreferences: { povPubkey } } }
 *  - scanStrfry    : (filter) => events[]   (fake local strfry: kind-3 + kind-0)
 *  - runCypher     : (cypher, params) => rows[]  (fake relay-set resolution)
 *  - querySync     : (relays, filter) => events[]  (fake external kind-1 fetch)
 * The fake names mirror the boundaries; the exact option keys the Implementer
 * exposes are pinned by the test plan + S-tests below.
 */
function makeDeps(overrides = {}) {
  return {
    getSettings: () => ({ grapevine: { searchPreferences: { povPubkey: null } } }),
    // Default local strfry: SOURCE follows FOLLOW_1 + FOLLOW_2; no kind-0 profiles.
    scanStrfry: (filter) => {
      const f = typeof filter === 'string' ? JSON.parse(filter) : filter;
      if (Array.isArray(f.kinds) && f.kinds.includes(3)) {
        return [kind3(SOURCE, [FOLLOW_1, FOLLOW_2])];
      }
      return []; // kind-0: no local profiles by default
    },
    // Default relay set: resolves to a non-fallback set of two relays.
    runCypher: async () => ([
      { json: JSON.stringify({ nostrRelay: { websocketUrl: 'wss://set-relay-a.example' } }) },
      { json: JSON.stringify({ nostrRelay: { websocketUrl: 'wss://set-relay-b.example' } }) },
    ]),
    // Default external fetch: two notes from the two follows.
    querySync: async () => ([
      kind1('n1', FOLLOW_1, 200, 'hello from follow 1'),
      kind1('n2', FOLLOW_2, 100, 'hello from follow 2'),
    ]),
    ...overrides,
  };
}

/**
 * Invoke buildFeed with injected deps, tolerating the small naming latitude the
 * ADR leaves the Implementer (deps may live under `deps:` or be spread onto the
 * options object). We pass BOTH shapes; the real impl reads whichever it exposes.
 */
async function callBuildFeed(mod, { sessionPubkey = undefined, deps } = {}) {
  assert(mod && typeof mod.buildFeed === 'function',
    'src/api/feed/feedReadPath.js must export an async `buildFeed` function — the feature is not implemented yet ' +
    '(ADR live-feed/0001 §Implementation notes).');
  return mod.buildFeed({ sessionPubkey, deps, ...deps });
}

// ===========================================================================
// STRUCTURAL SENTINELS — make "feature absent" legible, pin the contract shape.
// ===========================================================================

test('S1: module src/api/feed/feedReadPath.js exists and exports buildFeed + handleGetFeed (ADR §Decision / §Implementation notes)', () => {
  const mod = loadModule();
  assert(mod !== null,
    'src/api/feed/feedReadPath.js does not exist / does not load yet — the Implementer must create the read-path ' +
    'module (ADR live-feed/0001 chose Option A: one self-contained module exporting buildFeed + handleGetFeed).');
  assert(typeof mod.buildFeed === 'function',
    'feedReadPath.js must export `buildFeed` (the orchestrator the four outcomes are asserted against).');
  assert(typeof mod.handleGetFeed === 'function',
    'feedReadPath.js must export `handleGetFeed` (the public GET /api/feed Express handler).');
});

test('S2: GET /api/feed is registered to handleGetFeed in src/api/index.js (ADR §Implementation notes)', () => {
  const src = safeRead(API_INDEX);
  assert(src.length > 0, 'src/api/index.js missing — unexpected.');
  assert(/['"]\/api\/feed['"]/.test(src),
    "src/api/index.js must register the public route '/api/feed' (alongside /api/strfry/scan, /api/profiles, /api/relay/external).");
  assert(/handleGetFeed/.test(src),
    'src/api/index.js must wire /api/feed to handleGetFeed.');
});

// ===========================================================================
// AC-1 — Resolution & content (the happy path + its sub-claims)
// ===========================================================================

test('B1 (AC-1): with a present kind-3 follow list and follows who posted kind-1 notes, status is OK and items carry the followed authors\' notes', async () => {
  const mod = loadModule();
  const deps = makeDeps();
  const r = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps });
  assert(r && r.status === 'OK',
    `expected status 'OK' for a present follow list with qualifying notes; got ${JSON.stringify(r && r.status)}.`);
  assert(Array.isArray(r.items) && r.items.length === 2,
    `expected 2 items (one per followed author's note); got ${JSON.stringify(r && r.items && r.items.length)}.`);
  const authors = r.items.map((it) => it.pubkey).sort();
  assert(JSON.stringify(authors) === JSON.stringify([FOLLOW_1, FOLLOW_2].sort()),
    `items must be authored by the source's follows (${FOLLOW_1.slice(0, 6)}.., ${FOLLOW_2.slice(0, 6)}..); got ${JSON.stringify(authors.map((a) => a.slice(0, 6)))}.`);
});

test('B2 (AC-1): each item carries the note id, author pubkey, timestamp, text, and a nested author { displayName, avatar }', async () => {
  const mod = loadModule();
  const deps = makeDeps();
  const r = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  const item = r.items.find((it) => it.id === 'n1');
  assert(item, 'expected an item for note id "n1".');
  assert(item.pubkey === FOLLOW_1, `item.pubkey must be the note's author; got ${item.pubkey}.`);
  assert(item.createdAt === 200, `item.createdAt must be the note's timestamp (created_at=200); got ${item.createdAt}.`);
  assert(item.content === 'hello from follow 1', `item.content must be the note text; got ${JSON.stringify(item.content)}.`);
  assert(item.author && typeof item.author === 'object' && 'displayName' in item.author && 'avatar' in item.author,
    'each item must carry a nested author { displayName, avatar } object (ADR item shape).');
});

test('B3 (AC-1): author displayName + avatar are drawn from LOCAL kind-0 profile data, not the external relays', async () => {
  const mod = loadModule();
  // Local strfry serves a kind-0 profile for FOLLOW_1; the external querySync
  // must NEVER be the source of profile data.
  const deps = makeDeps({
    scanStrfry: (filter) => {
      const f = typeof filter === 'string' ? JSON.parse(filter) : filter;
      if (Array.isArray(f.kinds) && f.kinds.includes(3)) return [kind3(SOURCE, [FOLLOW_1])];
      if (Array.isArray(f.kinds) && f.kinds.includes(0)) {
        return [{
          id: 'k0-1', kind: 0, pubkey: FOLLOW_1, created_at: 50, tags: [],
          content: JSON.stringify({ name: 'Alice Local', display_name: 'Alice Local', picture: 'https://local/alice.png' }),
        }];
      }
      return [];
    },
    querySync: async (relays, filter) => {
      // If the implementation tries to fetch kind-0 from external relays, fail loudly.
      const f = filter || {};
      assert(!(Array.isArray(f.kinds) && f.kinds.includes(0)),
        'profile (kind-0) data must come from LOCAL strfry/Meili, never from the external relays (story AC-1; ADR §Constraints).');
      return [kind1('n1', FOLLOW_1, 200, 'hi')];
    },
  });
  const r = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  const item = r.items.find((it) => it.id === 'n1');
  assert(item, 'expected an item for note id "n1".');
  assert(item.author.displayName === 'Alice Local',
    `author.displayName must come from the local kind-0 profile ("Alice Local"); got ${JSON.stringify(item.author.displayName)}.`);
  assert(item.author.avatar === 'https://local/alice.png',
    `author.avatar must come from the local kind-0 profile picture; got ${JSON.stringify(item.author.avatar)}.`);
});

test('B4 (AC-1): a followed author with no local kind-0 profile yields null displayName + null avatar (never an external fetch)', async () => {
  const mod = loadModule();
  // Default deps: scanStrfry returns no kind-0 → missing profile.
  const deps = makeDeps({ querySync: async () => [kind1('n1', FOLLOW_1, 200, 'hi')] });
  const r = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  const item = r.items.find((it) => it.id === 'n1');
  assert(item, 'expected an item for note id "n1".');
  assert(item.author.displayName === null, `missing local profile must give author.displayName === null; got ${JSON.stringify(item.author.displayName)}.`);
  assert(item.author.avatar === null, `missing local profile must give author.avatar === null; got ${JSON.stringify(item.author.avatar)}.`);
});

test('B5 (AC-1): items are ordered newest-first by the note timestamp', async () => {
  const mod = loadModule();
  const deps = makeDeps({
    scanStrfry: (filter) => {
      const f = typeof filter === 'string' ? JSON.parse(filter) : filter;
      if (Array.isArray(f.kinds) && f.kinds.includes(3)) return [kind3(SOURCE, [FOLLOW_1, FOLLOW_2])];
      return [];
    },
    // Deliberately out of order on arrival: oldest, newest, middle.
    querySync: async () => ([
      kind1('old', FOLLOW_1, 100, 'oldest'),
      kind1('new', FOLLOW_2, 300, 'newest'),
      kind1('mid', FOLLOW_1, 200, 'middle'),
    ]),
  });
  const r = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  const ids = r.items.map((it) => it.id);
  assert(JSON.stringify(ids) === JSON.stringify(['new', 'mid', 'old']),
    `items must be newest-first by timestamp (expected ['new','mid','old']); got ${JSON.stringify(ids)}.`);
});

test('B6 (AC-1): the feed is capped at the 50 most recent qualifying notes', async () => {
  const mod = loadModule();
  // 60 notes from a single follow, created_at 1..60; expect the newest 50 (11..60).
  const many = [];
  for (let i = 1; i <= 60; i++) many.push(kind1('e' + i, FOLLOW_1, i, 'note ' + i));
  const deps = makeDeps({
    scanStrfry: (filter) => {
      const f = typeof filter === 'string' ? JSON.parse(filter) : filter;
      if (Array.isArray(f.kinds) && f.kinds.includes(3)) return [kind3(SOURCE, [FOLLOW_1])];
      return [];
    },
    querySync: async () => many,
  });
  const r = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  assert(r.items.length === 50, `feed must be capped at 50 items; got ${r.items.length}.`);
  assert(r.items[0].createdAt === 60, `the cap must keep the MOST RECENT 50 (newest createdAt=60 first); got ${r.items[0].createdAt}.`);
  assert(r.items[r.items.length - 1].createdAt === 11,
    `the 50-cap must drop the oldest (the kept window is createdAt 11..60; tail should be 11); got ${r.items[r.items.length - 1].createdAt}.`);
});

test('B7 (AC-1): kind-6 (reposts) and kind-7 (reactions) are excluded even if a relay returns them', async () => {
  const mod = loadModule();
  const deps = makeDeps({
    scanStrfry: (filter) => {
      const f = typeof filter === 'string' ? JSON.parse(filter) : filter;
      if (Array.isArray(f.kinds) && f.kinds.includes(3)) return [kind3(SOURCE, [FOLLOW_1])];
      return [];
    },
    // A noisy relay that ignores the kind filter and also returns a repost + reaction.
    querySync: async () => ([
      kind1('note', FOLLOW_1, 300, 'a real note'),
      { id: 'repost', kind: 6, pubkey: FOLLOW_1, created_at: 400, content: '', tags: [] },
      { id: 'reaction', kind: 7, pubkey: FOLLOW_1, created_at: 500, content: '+', tags: [] },
    ]),
  });
  const r = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  const ids = r.items.map((it) => it.id);
  assert(ids.includes('note'), 'the kind-1 note must be present.');
  assert(!ids.includes('repost'), 'kind-6 reposts must be excluded (story AC-1).');
  assert(!ids.includes('reaction'), 'kind-7 reactions must be excluded (story AC-1).');
  assert(r.items.length === 1, `only the single kind-1 note should remain; got ${r.items.length} items.`);
});

test('B8 (AC-1): notes from accounts the source does NOT follow are excluded', async () => {
  const mod = loadModule();
  const deps = makeDeps({
    scanStrfry: (filter) => {
      const f = typeof filter === 'string' ? JSON.parse(filter) : filter;
      if (Array.isArray(f.kinds) && f.kinds.includes(3)) return [kind3(SOURCE, [FOLLOW_1])]; // only follows FOLLOW_1
      return [];
    },
    // A relay that returns a note from a stranger the source does not follow.
    querySync: async () => ([
      kind1('mine', FOLLOW_1, 300, 'from a follow'),
      kind1('intruder', STRANGER, 400, 'from a stranger'),
    ]),
  });
  const r = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  const ids = r.items.map((it) => it.id);
  assert(ids.includes('mine'), "the followed author's note must be present.");
  assert(!ids.includes('intruder'), 'a note from a non-followed account must be excluded (story AC-1).');
});

// ===========================================================================
// AC-2 — Relay source with fallback (the set-vs-fallback discriminator)
// ===========================================================================

test('B9 (AC-2): when the general-purpose relay set resolves to members, relaySource is "set"', async () => {
  const mod = loadModule();
  const deps = makeDeps(); // default runCypher resolves two set members
  const r = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps });
  assert(r && (r.status === 'OK' || r.status === 'EMPTY'),
    `expected OK or EMPTY; got ${JSON.stringify(r && r.status)}.`);
  assert(r.relaySource === 'set',
    `with a resolvable, non-empty relay set, relaySource must be 'set'; got ${JSON.stringify(r.relaySource)}.`);
});

test('B10 (AC-2): when the relay set cannot be resolved / is empty, relaySource is "fallback" and notes are still returned', async () => {
  const mod = loadModule();
  // runCypher returns no rows → set unresolvable/empty → fallback relays.
  const deps = makeDeps({ runCypher: async () => [] });
  const r = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps });
  assert(r && r.status === 'OK',
    `with an empty set, the fallback relays must still yield notes (status OK); got ${JSON.stringify(r && r.status)}.`);
  assert(r.relaySource === 'fallback',
    `an empty/unresolvable relay set must set relaySource to 'fallback'; got ${JSON.stringify(r.relaySource)}.`);
  assert(Array.isArray(r.items) && r.items.length >= 1,
    'the fallback path must still return notes (the default querySync fake yields 2).');
});

test('B11 (AC-2): a runCypher error during set resolution degrades to the fallback relays, not a crash', async () => {
  const mod = loadModule();
  const deps = makeDeps({ runCypher: async () => { throw new Error('neo4j unavailable'); } });
  const r = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps });
  assert(r && r.status === 'OK',
    `a relay-set resolution ERROR must degrade to the fallback relays (ADR: "Empty/error → fallback"), not throw; got ${JSON.stringify(r && r.status)}.`);
  assert(r.relaySource === 'fallback',
    `on relay-set resolution error, relaySource must be 'fallback'; got ${JSON.stringify(r.relaySource)}.`);
});

// ===========================================================================
// AC-3 — Edge: no source identity (NO_SOURCE)
// ===========================================================================

test('B12 (AC-3): no logged-in user AND no House PoV configured yields status NO_SOURCE', async () => {
  const mod = loadModule();
  const deps = makeDeps({ getSettings: () => ({ grapevine: { searchPreferences: { povPubkey: null } } }) });
  const r = await callBuildFeed(mod, { sessionPubkey: undefined, deps });
  assert(r && r.status === 'NO_SOURCE',
    `no session pubkey and no House povPubkey must yield status 'NO_SOURCE'; got ${JSON.stringify(r && r.status)}.`);
});

test('B13 (AC-3): the NO_SOURCE outcome queries no relays (the external fetch is never invoked)', async () => {
  const mod = loadModule();
  let queried = false;
  const deps = makeDeps({
    getSettings: () => ({ grapevine: { searchPreferences: { povPubkey: null } } }),
    querySync: async () => { queried = true; return []; },
  });
  const r = await callBuildFeed(mod, { sessionPubkey: undefined, deps });
  assert(r && r.status === 'NO_SOURCE', `expected NO_SOURCE; got ${JSON.stringify(r && r.status)}.`);
  assert(queried === false,
    'NO_SOURCE must not query any relays (story AC-3: "no relays are queried").');
});

test('B14 (AC-3): NO_SOURCE is distinct from an empty list — it is not status EMPTY with items: []', async () => {
  const mod = loadModule();
  const deps = makeDeps({ getSettings: () => ({ grapevine: { searchPreferences: { povPubkey: null } } }) });
  const r = await callBuildFeed(mod, { sessionPubkey: undefined, deps });
  assert(r && r.status !== 'EMPTY',
    'no source must NOT collapse into an EMPTY feed — the no-source outcome is distinct (story AC-3).');
  assert(r.status === 'NO_SOURCE', `expected the distinct NO_SOURCE status; got ${JSON.stringify(r.status)}.`);
});

// ===========================================================================
// AC-4 — Edge: follow list not local (FOLLOW_LIST_UNAVAILABLE)
// ===========================================================================

test('B15 (AC-4): a source exists but its kind-3 is absent from local strfry yields status FOLLOW_LIST_UNAVAILABLE', async () => {
  const mod = loadModule();
  // House PoV present so a source resolves; strfry returns NO kind-3.
  const deps = makeDeps({
    getSettings: () => ({ grapevine: { searchPreferences: { povPubkey: HOUSE } } }),
    scanStrfry: () => [], // no kind-3 anywhere in local strfry
  });
  const r = await callBuildFeed(mod, { sessionPubkey: undefined, deps });
  assert(r && r.status === 'FOLLOW_LIST_UNAVAILABLE',
    `a source with no kind-3 in local strfry must yield 'FOLLOW_LIST_UNAVAILABLE'; got ${JSON.stringify(r && r.status)}.`);
});

test('B16 (AC-4): FOLLOW_LIST_UNAVAILABLE is distinct from both NO_SOURCE and an empty-but-present feed', async () => {
  const mod = loadModule();
  const deps = makeDeps({
    getSettings: () => ({ grapevine: { searchPreferences: { povPubkey: HOUSE } } }),
    scanStrfry: () => [],
  });
  const r = await callBuildFeed(mod, { sessionPubkey: undefined, deps });
  assert(r && r.status !== 'NO_SOURCE',
    'a present source with a missing follow list must NOT be NO_SOURCE (a source DID resolve) — story AC-4.');
  assert(r.status !== 'EMPTY',
    'a missing follow list must NOT be an EMPTY-but-present feed — story AC-4 wants a distinct outcome.');
  assert(r.status === 'FOLLOW_LIST_UNAVAILABLE', `expected FOLLOW_LIST_UNAVAILABLE; got ${JSON.stringify(r.status)}.`);
});

// ===========================================================================
// AC-5 — Edge: present but empty (EMPTY)
// ===========================================================================

test('B17 (AC-5): a present kind-3 follow list that yields no qualifying notes gives status EMPTY with items: []', async () => {
  const mod = loadModule();
  const deps = makeDeps({
    scanStrfry: (filter) => {
      const f = typeof filter === 'string' ? JSON.parse(filter) : filter;
      if (Array.isArray(f.kinds) && f.kinds.includes(3)) return [kind3(SOURCE, [FOLLOW_1, FOLLOW_2])];
      return [];
    },
    querySync: async () => [], // follows posted nothing in the window
  });
  const r = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps });
  assert(r && r.status === 'EMPTY',
    `a present follow list with no qualifying notes must yield status 'EMPTY'; got ${JSON.stringify(r && r.status)}.`);
  assert(Array.isArray(r.items) && r.items.length === 0,
    `EMPTY must carry an empty items array; got ${JSON.stringify(r && r.items)}.`);
});

test('B18 (AC-5): a kind-3 present with ZERO p-tags (follows nobody) is a present-but-empty feed, not FOLLOW_LIST_UNAVAILABLE', async () => {
  const mod = loadModule();
  // ADR: a kind-3 with zero p-tags is a PRESENT list with no follows → empty-feed path,
  // distinct from "no kind-3 at all" (FOLLOW_LIST_UNAVAILABLE).
  const deps = makeDeps({
    scanStrfry: (filter) => {
      const f = typeof filter === 'string' ? JSON.parse(filter) : filter;
      if (Array.isArray(f.kinds) && f.kinds.includes(3)) return [kind3(SOURCE, [])]; // present, zero follows
      return [];
    },
    querySync: async () => [],
  });
  const r = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps });
  assert(r && r.status === 'EMPTY',
    `a present kind-3 with zero follows must be EMPTY (a present-but-empty feed), not FOLLOW_LIST_UNAVAILABLE; got ${JSON.stringify(r && r.status)}.`);
});

test('B19 (AC-5): the three edge outcomes + OK are four mutually distinct status values', async () => {
  const mod = loadModule();
  const okDeps = makeDeps();
  const ok = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps: okDeps });

  const emptyDeps = makeDeps({ querySync: async () => [] });
  const empty = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps: emptyDeps });

  const noSrcDeps = makeDeps({ getSettings: () => ({ grapevine: { searchPreferences: { povPubkey: null } } }) });
  const noSrc = await callBuildFeed(mod, { sessionPubkey: undefined, deps: noSrcDeps });

  const unavailDeps = makeDeps({
    getSettings: () => ({ grapevine: { searchPreferences: { povPubkey: HOUSE } } }),
    scanStrfry: () => [],
  });
  const unavail = await callBuildFeed(mod, { sessionPubkey: undefined, deps: unavailDeps });

  const statuses = [ok.status, empty.status, noSrc.status, unavail.status];
  assert(JSON.stringify(statuses) === JSON.stringify(['OK', 'EMPTY', 'NO_SOURCE', 'FOLLOW_LIST_UNAVAILABLE']),
    `the four outcomes must be distinct discriminated statuses [OK, EMPTY, NO_SOURCE, FOLLOW_LIST_UNAVAILABLE]; got ${JSON.stringify(statuses)}.`);
  assert(new Set(statuses).size === 4, 'all four status values must be mutually distinct.');
});

// ===========================================================================
// Source resolution order (login wins over House) — supports AC-1/AC-3/AC-4.
// ===========================================================================

test('B20 (resolution): the logged-in user wins over the House PoV as the source identity', async () => {
  const mod = loadModule();
  let scannedAuthor = null;
  const deps = makeDeps({
    getSettings: () => ({ grapevine: { searchPreferences: { povPubkey: HOUSE } } }),
    scanStrfry: (filter) => {
      const f = typeof filter === 'string' ? JSON.parse(filter) : filter;
      if (Array.isArray(f.kinds) && f.kinds.includes(3)) {
        scannedAuthor = Array.isArray(f.authors) ? f.authors[0] : null;
        return [kind3(SOURCE, [FOLLOW_1])];
      }
      return [];
    },
    querySync: async () => [kind1('n1', FOLLOW_1, 200, 'hi')],
  });
  const r = await callBuildFeed(mod, { sessionPubkey: SOURCE, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  assert(scannedAuthor === SOURCE,
    `with a logged-in user present, the kind-3 follow list must be read for the LOGIN pubkey (${SOURCE.slice(0, 6)}..), not the House pubkey; got ${scannedAuthor && scannedAuthor.slice(0, 6)}..`);
  if (r.source) {
    assert(r.source.origin === 'login' && r.source.pubkey === SOURCE,
      `source must report origin 'login' for the logged-in user; got ${JSON.stringify(r.source)}.`);
  }
});

test('B21 (resolution): with no login but a House PoV configured, the House identity is the source', async () => {
  const mod = loadModule();
  let scannedAuthor = null;
  const deps = makeDeps({
    getSettings: () => ({ grapevine: { searchPreferences: { povPubkey: HOUSE } } }),
    scanStrfry: (filter) => {
      const f = typeof filter === 'string' ? JSON.parse(filter) : filter;
      if (Array.isArray(f.kinds) && f.kinds.includes(3)) {
        scannedAuthor = Array.isArray(f.authors) ? f.authors[0] : null;
        return [kind3(HOUSE, [FOLLOW_1])];
      }
      return [];
    },
    querySync: async () => [kind1('n1', FOLLOW_1, 200, 'hi')],
  });
  const r = await callBuildFeed(mod, { sessionPubkey: undefined, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  assert(scannedAuthor === HOUSE,
    `with no login, the kind-3 follow list must be read for the House PoV pubkey (${HOUSE.slice(0, 6)}..); got ${scannedAuthor && scannedAuthor.slice(0, 6)}..`);
  if (r.source) {
    assert(r.source.origin === 'house' && r.source.pubkey === HOUSE,
      `source must report origin 'house' when falling back to the House PoV; got ${JSON.stringify(r.source)}.`);
  }
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
