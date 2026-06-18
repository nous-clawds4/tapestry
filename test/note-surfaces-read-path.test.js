/**
 * Story note-surfaces #1: By-author notes read path — a user's own recent kind-1 notes.
 * ADR note-surfaces/0001. See engineering-team/stories/note-surfaces/1-by-author-notes-read-path.test-plan.md
 *
 * ADR chose Option A: a self-contained module `src/api/notes/userNotesReadPath.js`
 * exporting `buildUserNotes({ pubkey, limit, deps })`, an Express handler
 * `handleGetUserNotes`, and a pure `clampLimit` — exposed at GET /api/user/:pubkey/notes.
 * It mirrors feedReadPath.js's structure but SELECTS kind-1 by the single given author
 * (no source identity / follow list / PoV), sourcing notes from the general-purpose
 * relays (settled empirically — local strfry holds 0 kind-1) and REUSING the shared
 * `enrichNotes` (src/api/_shared/noteEnrichment.js) for author/mention enrichment.
 * Result is a discriminated `status` union { OK, EMPTY, INVALID } plus a `relaySource`
 * { set, fallback } on OK/EMPTY, each item shaped
 *   { id, pubkey, createdAt, content, author: { displayName, avatar }, mentions } —
 * the SAME item shape as the feed, so NoteCard renders it unchanged.
 *
 * WHY behavioral, not source-regex: the ACs require the OK/EMPTY/INVALID outcomes +
 * newest-first ordering + the limit cap + kind-6/7 + foreign-author exclusion + the
 * set-vs-fallback discriminator to be OBSERVABLE BEHAVIOR, without touching live strfry,
 * Neo4j, or external relays. buildUserNotes crosses three I/O boundaries —
 *   - relay set : runCypher(...) on the-set-of-general-purpose-relays node
 *   - kind-1    : SimplePool.querySync(relays, filter) (external relays)
 *   - kind-0    : exec/execSync `strfry scan ...` (local strfry, via enrichNotes)
 * so the tests inject FAKES via buildUserNotes's options object (the same { pubkey, limit }
 * object the ADR passes). Production callers pass no deps and get the real helpers; tests
 * pass deps to stay hermetic. If the Implementer hard-wires the boundaries and ignores
 * injected deps, the behavioral assertions fail loudly (real I/O / throw) — correct pressure
 * toward the seam, not a false pass.
 *
 * ALL S/C/B/M/H tests FAIL pre-implementation (module absent) and must PASS post.
 * R* are regression sentinels — PASS before AND after (the shipped feed read path is untouched).
 */

const fs = require('fs');
const path = require('path');

const MODULE_PATH = path.resolve(__dirname, '../src/api/notes/userNotesReadPath.js');
const API_INDEX = path.resolve(__dirname, '../src/api/index.js');
const FEED_READ_PATH = path.resolve(__dirname, '../src/api/feed/feedReadPath.js');
const SHARED_ENRICH = path.resolve(__dirname, '../src/api/_shared/noteEnrichment.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// Load the not-yet-written module without letting a missing-file require crash the suite.
function loadModule() {
  try { delete require.cache[require.resolve(MODULE_PATH)]; } catch { /* not resolvable yet */ }
  try { return require(MODULE_PATH); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Fixtures: pubkeys, kind-1/kind-0 events, the three injectable fakes.
// ---------------------------------------------------------------------------

const HEX = (c) => c.repeat(64);
const AUTHOR = HEX('a');     // the viewed user (the note author)
const OTHER = HEX('9');      // a DIFFERENT author a relay might leak into the response
const NOT_HEX = 'not-a-valid-pubkey';

function kind1(id, author, createdAt, content) {
  return { id, kind: 1, pubkey: author, created_at: createdAt, content: content || '', tags: [] };
}
function kind0(pubkey, profile, createdAt) {
  return { id: 'k0-' + pubkey.slice(0, 6), kind: 0, pubkey, created_at: createdAt || 50, tags: [], content: JSON.stringify(profile) };
}

/**
 * Build the three injectable fakes (no getSettings — this read path has no PoV/source
 * resolution). Any can be overridden per-test.
 *  - scanStrfry : (filter) => events[]   (fake LOCAL strfry: kind-0 profiles only)
 *  - runCypher  : (cypher, params) => rows[]  (fake relay-set resolution)
 *  - querySync  : (relays, filter) => events[]  (fake external kind-1 fetch by author)
 */
function makeDeps(overrides = {}) {
  return {
    // Default local strfry: no kind-0 profiles (author renders with null name/avatar).
    scanStrfry: () => [],
    // Default relay set: two non-fallback members.
    runCypher: async () => ([
      { json: JSON.stringify({ nostrRelay: { websocketUrl: 'wss://set-relay-a.example' } }) },
      { json: JSON.stringify({ nostrRelay: { websocketUrl: 'wss://set-relay-b.example' } }) },
    ]),
    // Default external fetch: two notes by the viewed author, out of order.
    querySync: async () => ([
      kind1('n1', AUTHOR, 200, 'first'),
      kind1('n2', AUTHOR, 100, 'second'),
    ]),
    ...overrides,
  };
}

/**
 * Invoke buildUserNotes with injected deps, tolerating the ADR's naming latitude (deps may
 * live under `deps:` or be spread onto the options object — we pass BOTH; the impl reads
 * whichever it exposes, mirroring the live-feed read-path test seam).
 */
async function callBuildUserNotes(mod, { pubkey = AUTHOR, limit, deps } = {}) {
  assert(mod && typeof mod.buildUserNotes === 'function',
    'src/api/notes/userNotesReadPath.js must export an async `buildUserNotes` function — the feature is not implemented yet ' +
    '(ADR note-surfaces/0001 §Implementation notes).');
  return mod.buildUserNotes({ pubkey, limit, deps, ...deps });
}

// ===========================================================================
// STRUCTURAL SENTINELS — make "feature absent" legible, pin the contract + reuse.
// ===========================================================================

test('S1: module src/api/notes/userNotesReadPath.js exists and exports buildUserNotes + handleGetUserNotes + clampLimit (ADR §Decision / §Impl)', () => {
  const mod = loadModule();
  assert(mod !== null,
    'src/api/notes/userNotesReadPath.js does not exist / does not load yet — the Implementer must create the by-author read-path module (ADR note-surfaces/0001 Option A).');
  assert(typeof mod.buildUserNotes === 'function',
    'userNotesReadPath.js must export `buildUserNotes` (the orchestrator the outcomes are asserted against).');
  assert(typeof mod.handleGetUserNotes === 'function',
    'userNotesReadPath.js must export `handleGetUserNotes` (the public GET /api/user/:pubkey/notes Express handler).');
  assert(typeof mod.clampLimit === 'function',
    'userNotesReadPath.js must export `clampLimit` (the limit default/cap, unit-tested directly).');
});

test('S2: GET /api/user/:pubkey/notes is registered to handleGetUserNotes in src/api/index.js (ADR §Impl)', () => {
  const src = safeRead(API_INDEX);
  assert(src.length > 0, 'src/api/index.js missing — unexpected.');
  assert(/['"]\/api\/user\/:pubkey\/notes['"]/.test(src),
    "src/api/index.js must register the public route '/api/user/:pubkey/notes' (alongside /api/feed).");
  assert(/handleGetUserNotes/.test(src),
    'src/api/index.js must wire /api/user/:pubkey/notes to handleGetUserNotes.');
});

test('S3 (reuse): the read path REUSES the shared enrichNotes (it does not re-implement enrichment)', () => {
  const src = safeRead(MODULE_PATH);
  assert(src.length > 0, 'userNotesReadPath.js does not exist yet.');
  assert(/require\(\s*['"]\.\.\/_shared\/noteEnrichment['"]\s*\)/.test(src) && /enrichNotes/.test(src),
    "userNotesReadPath.js must require enrichNotes from '../_shared/noteEnrichment' and use it (ADR: reuse the shared seam, do not re-implement author/mention enrichment).");
});

// ===========================================================================
// clampLimit — the count default + hard cap (AC-2). req.query.limit is a STRING.
// ===========================================================================

test('C1 (AC-2): clampLimit passes the known caller values through — 1 → 1, 50 → 50 (number and string forms)', () => {
  const mod = loadModule();
  assert(mod && typeof mod.clampLimit === 'function', 'clampLimit must be exported (feature absent).');
  assert(mod.clampLimit(1) === 1, `clampLimit(1) must be 1; got ${mod.clampLimit(1)}.`);
  assert(mod.clampLimit(50) === 50, `clampLimit(50) must be 50; got ${mod.clampLimit(50)}.`);
  assert(mod.clampLimit('1') === 1, `clampLimit('1') must be 1 — query params arrive as strings; got ${mod.clampLimit('1')}.`);
  assert(mod.clampLimit('50') === 50, `clampLimit('50') must be 50 — query params arrive as strings; got ${mod.clampLimit('50')}.`);
});

test('C2 (AC-2): clampLimit applies a hard maximum (NOTES_CAP=50) and a floor of 1; absent/non-numeric → the default', () => {
  const mod = loadModule();
  assert(mod && typeof mod.clampLimit === 'function', 'clampLimit must be exported (feature absent).');
  assert(mod.NOTES_CAP === 50, `NOTES_CAP must be exported and === 50 (the page cap / feed cap); got ${mod.NOTES_CAP}.`);
  assert(mod.clampLimit(51) === 50, `clampLimit(51) must clamp to the 50 maximum; got ${mod.clampLimit(51)}.`);
  assert(mod.clampLimit(1000) === 50, `clampLimit(1000) must clamp to 50 (no unbounded result); got ${mod.clampLimit(1000)}.`);
  assert(mod.clampLimit(0) === 1, `clampLimit(0) must floor to 1; got ${mod.clampLimit(0)}.`);
  assert(mod.clampLimit(-5) === 1, `clampLimit(-5) must floor to 1; got ${mod.clampLimit(-5)}.`);
  assert(mod.clampLimit(undefined) === 50, `an ABSENT limit must default to 50; got ${mod.clampLimit(undefined)}.`);
  assert(mod.clampLimit('banana') === 50, `a NON-NUMERIC limit must default to 50 (not NaN/unbounded); got ${mod.clampLimit('banana')}.`);
});

// ===========================================================================
// AC-1 — Selection & content (kind-1 by the given author, shape, local profiles)
// ===========================================================================

test('B1 (AC-1): a valid author with kind-1 notes yields status OK carrying that author\'s notes', async () => {
  const mod = loadModule();
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps: makeDeps() });
  assert(r && r.status === 'OK', `expected status 'OK' for an author with notes; got ${JSON.stringify(r && r.status)}.`);
  assert(Array.isArray(r.items) && r.items.length === 2, `expected 2 items; got ${JSON.stringify(r && r.items && r.items.length)}.`);
  assert(r.items.every((it) => it.pubkey === AUTHOR), `every item must be authored by the viewed pubkey; got ${JSON.stringify(r.items.map((it) => it.pubkey.slice(0, 6)))}.`);
});

test('B2 (AC-1): each item is the feed item shape — { id, pubkey, createdAt, content, author:{displayName,avatar}, mentions }', async () => {
  const mod = loadModule();
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps: makeDeps() });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  const item = r.items.find((it) => it.id === 'n1');
  assert(item, 'expected an item for note id "n1".');
  assert(item.pubkey === AUTHOR, `item.pubkey must be the author; got ${item.pubkey}.`);
  assert(item.createdAt === 200, `item.createdAt must be the note timestamp (created_at=200); got ${item.createdAt}.`);
  assert(item.content === 'first', `item.content must be the note text; got ${JSON.stringify(item.content)}.`);
  assert(item.author && typeof item.author === 'object' && 'displayName' in item.author && 'avatar' in item.author,
    'each item must carry a nested author { displayName, avatar } (the feed item shape NoteCard renders).');
  assert(item.mentions && typeof item.mentions === 'object',
    'each item must carry a `mentions` map (empty when the note has no nostr: refs) — the feed item shape.');
});

test('B3 (AC-1): author displayName + avatar come from LOCAL kind-0 (scanStrfry), never the external relays', async () => {
  const mod = loadModule();
  const deps = makeDeps({
    scanStrfry: (filter) => {
      const f = typeof filter === 'string' ? JSON.parse(filter) : filter;
      if (Array.isArray(f.kinds) && f.kinds.includes(0)) return [kind0(AUTHOR, { display_name: 'Alice Local', name: 'alice', picture: 'https://local/alice.png' })];
      return [];
    },
    querySync: async (relays, filter) => {
      const f = filter || {};
      assert(!(Array.isArray(f.kinds) && f.kinds.includes(0)),
        'profile (kind-0) data must come from LOCAL strfry, never the external relays (AC-1; ADR §Constraints).');
      return [kind1('n1', AUTHOR, 200, 'hi')];
    },
  });
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  const item = r.items.find((it) => it.id === 'n1');
  assert(item.author.displayName === 'Alice Local', `author.displayName must come from local kind-0 ("Alice Local"); got ${JSON.stringify(item.author.displayName)}.`);
  assert(item.author.avatar === 'https://local/alice.png', `author.avatar must come from local kind-0 picture; got ${JSON.stringify(item.author.avatar)}.`);
});

test('B4 (AC-1): an author with no local kind-0 profile yields null displayName + null avatar (never an external fetch)', async () => {
  const mod = loadModule();
  const deps = makeDeps({ querySync: async () => [kind1('n1', AUTHOR, 200, 'hi')] }); // default scanStrfry → no kind-0
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  const item = r.items.find((it) => it.id === 'n1');
  assert(item.author.displayName === null, `missing local profile must give author.displayName === null; got ${JSON.stringify(item.author.displayName)}.`);
  assert(item.author.avatar === null, `missing local profile must give author.avatar === null; got ${JSON.stringify(item.author.avatar)}.`);
});

test('B5 (AC-1): items are ordered newest-first by the note timestamp', async () => {
  const mod = loadModule();
  const deps = makeDeps({
    querySync: async () => ([
      kind1('old', AUTHOR, 100, 'oldest'),
      kind1('new', AUTHOR, 300, 'newest'),
      kind1('mid', AUTHOR, 200, 'middle'),
    ]),
  });
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  const ids = r.items.map((it) => it.id);
  assert(JSON.stringify(ids) === JSON.stringify(['new', 'mid', 'old']),
    `items must be newest-first by timestamp (expected ['new','mid','old']); got ${JSON.stringify(ids)}.`);
});

test('B6 (AC-1): kind-6 (reposts) and kind-7 (reactions) are excluded even if a relay returns them', async () => {
  const mod = loadModule();
  const deps = makeDeps({
    querySync: async () => ([
      kind1('note', AUTHOR, 300, 'a real note'),
      { id: 'repost', kind: 6, pubkey: AUTHOR, created_at: 400, content: '', tags: [] },
      { id: 'reaction', kind: 7, pubkey: AUTHOR, created_at: 500, content: '+', tags: [] },
    ]),
  });
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  const ids = r.items.map((it) => it.id);
  assert(ids.includes('note'), 'the kind-1 note must be present.');
  assert(!ids.includes('repost'), 'kind-6 reposts must be excluded (AC-1).');
  assert(!ids.includes('reaction'), 'kind-7 reactions must be excluded (AC-1).');
  assert(r.items.length === 1, `only the single kind-1 note should remain; got ${r.items.length} items.`);
});

test('B7 (AC-1): notes authored by ANYONE ELSE are excluded even if a relay leaks them', async () => {
  const mod = loadModule();
  const deps = makeDeps({
    querySync: async () => ([
      kind1('mine', AUTHOR, 300, 'by the viewed user'),
      kind1('intruder', OTHER, 400, 'by a different author'),
    ]),
  });
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  const ids = r.items.map((it) => it.id);
  assert(ids.includes('mine'), "the viewed author's note must be present.");
  assert(!ids.includes('intruder'), 'a note from a DIFFERENT author must be excluded (AC-1: notes authored by anyone else are excluded).');
  assert(r.items.length === 1, `only the viewed author's note should remain; got ${r.items.length}.`);
});

// ===========================================================================
// AC-2 — Count parameterization & cap
// ===========================================================================

test('B8 (AC-2): limit=1 returns exactly the single most-recent qualifying note', async () => {
  const mod = loadModule();
  const deps = makeDeps({
    querySync: async () => ([
      kind1('a', AUTHOR, 100, 'old'),
      kind1('b', AUTHOR, 300, 'newest'),
      kind1('c', AUTHOR, 200, 'mid'),
    ]),
  });
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 1, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  assert(r.items.length === 1, `limit=1 must return exactly one item; got ${r.items.length}.`);
  assert(r.items[0].id === 'b', `limit=1 must return the single MOST-RECENT note (id 'b', createdAt 300); got ${r.items[0].id}.`);
});

test('B9 (AC-2): the result is capped at the requested count — limit=3 keeps the 3 most recent of many', async () => {
  const mod = loadModule();
  const many = [];
  for (let i = 1; i <= 10; i++) many.push(kind1('e' + i, AUTHOR, i, 'note ' + i));
  const deps = makeDeps({ querySync: async () => many });
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 3, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  assert(r.items.length === 3, `limit=3 must return 3 items; got ${r.items.length}.`);
  assert(JSON.stringify(r.items.map((it) => it.createdAt)) === JSON.stringify([10, 9, 8]),
    `limit=3 must keep the 3 MOST RECENT (createdAt 10,9,8 newest-first); got ${JSON.stringify(r.items.map((it) => it.createdAt))}.`);
});

test('B10 (AC-2): an over-maximum limit is clamped to the hard cap of 50 (60 notes → 50 newest)', async () => {
  const mod = loadModule();
  const many = [];
  for (let i = 1; i <= 60; i++) many.push(kind1('e' + i, AUTHOR, i, 'note ' + i));
  const deps = makeDeps({ querySync: async () => many });
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 999, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  assert(r.items.length === 50, `an over-max limit must clamp to 50 items; got ${r.items.length}.`);
  assert(r.items[0].createdAt === 60, `the cap must keep the MOST RECENT (newest createdAt=60 first); got ${r.items[0].createdAt}.`);
  assert(r.items[r.items.length - 1].createdAt === 11, `the 50-cap drops the oldest (kept window createdAt 11..60); tail should be 11, got ${r.items[r.items.length - 1].createdAt}.`);
});

// ===========================================================================
// AC-2 — relaySource set-vs-fallback discriminator
// ===========================================================================

test('B11 (AC-2): when the general-purpose relay set resolves to members, relaySource is "set"', async () => {
  const mod = loadModule();
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps: makeDeps() });
  assert(r && (r.status === 'OK' || r.status === 'EMPTY'), `expected OK/EMPTY; got ${JSON.stringify(r && r.status)}.`);
  assert(r.relaySource === 'set', `with a resolvable, non-empty relay set, relaySource must be 'set'; got ${JSON.stringify(r.relaySource)}.`);
});

test('B12 (AC-2): an empty/unresolvable relay set falls back to the fixed relays (relaySource "fallback"), still returning notes', async () => {
  const mod = loadModule();
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps: makeDeps({ runCypher: async () => [] }) });
  assert(r && r.status === 'OK', `with an empty set, the fallback relays must still yield notes (OK); got ${JSON.stringify(r && r.status)}.`);
  assert(r.relaySource === 'fallback', `an empty/unresolvable relay set must set relaySource to 'fallback'; got ${JSON.stringify(r.relaySource)}.`);
  assert(Array.isArray(r.items) && r.items.length >= 1, 'the fallback path must still return notes (the default querySync fake yields 2).');
});

test('B13 (AC-2): a runCypher error during set resolution degrades to the fallback relays, not a crash', async () => {
  const mod = loadModule();
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps: makeDeps({ runCypher: async () => { throw new Error('neo4j down'); } }) });
  assert(r && r.status === 'OK', `a relay-set resolution ERROR must degrade to the fallback relays, not throw; got ${JSON.stringify(r && r.status)}.`);
  assert(r.relaySource === 'fallback', `on relay-set resolution error, relaySource must be 'fallback'; got ${JSON.stringify(r.relaySource)}.`);
});

// ===========================================================================
// AC-3 — Empty outcome vs AC-4 — Invalid-input outcome (the two must be distinct)
// ===========================================================================

test('B14 (AC-3): a valid author with no locatable kind-1 notes yields status EMPTY with items: []', async () => {
  const mod = loadModule();
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps: makeDeps({ querySync: async () => [] }) });
  assert(r && r.status === 'EMPTY', `a valid author with no notes must yield status 'EMPTY'; got ${JSON.stringify(r && r.status)}.`);
  assert(Array.isArray(r.items) && r.items.length === 0, `EMPTY must carry an empty items array; got ${JSON.stringify(r && r.items)}.`);
});

test('B15 (AC-4): a malformed pubkey yields the explicit INVALID outcome — not EMPTY, not a crash', async () => {
  const mod = loadModule();
  const r = await callBuildUserNotes(mod, { pubkey: NOT_HEX, limit: 50, deps: makeDeps() });
  assert(r && r.status === 'INVALID', `a malformed pubkey must yield the distinct 'INVALID' outcome; got ${JSON.stringify(r && r.status)}.`);
  assert(r.status !== 'EMPTY', 'INVALID must NOT collapse into EMPTY — a bad request is distinct from "no notes" (AC-3/AC-4).');
});

test('B16 (AC-4): the INVALID outcome short-circuits before any relay/Neo4j is queried', async () => {
  const mod = loadModule();
  let queried = false, cyphered = false;
  const deps = makeDeps({
    querySync: async () => { queried = true; return []; },
    runCypher: async () => { cyphered = true; return []; },
  });
  const r = await callBuildUserNotes(mod, { pubkey: NOT_HEX, limit: 50, deps });
  assert(r && r.status === 'INVALID', `expected INVALID; got ${JSON.stringify(r && r.status)}.`);
  assert(queried === false && cyphered === false,
    'a malformed pubkey must be rejected up-front, querying no relays and no Neo4j (validation is step 1).');
});

test('B17: OK, EMPTY, and INVALID are three mutually distinct status values', async () => {
  const mod = loadModule();
  const ok = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps: makeDeps() });
  const empty = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps: makeDeps({ querySync: async () => [] }) });
  const invalid = await callBuildUserNotes(mod, { pubkey: NOT_HEX, limit: 50, deps: makeDeps() });
  const statuses = [ok.status, empty.status, invalid.status];
  assert(JSON.stringify(statuses) === JSON.stringify(['OK', 'EMPTY', 'INVALID']),
    `the three outcomes must be the distinct statuses [OK, EMPTY, INVALID]; got ${JSON.stringify(statuses)}.`);
  assert(new Set(statuses).size === 3, 'all three status values must be mutually distinct.');
});

// ===========================================================================
// AC-5 — Mentions resolved like the feed (via the reused enrichNotes)
// ===========================================================================

test('M1 (AC-5): a nostr:npub mention resolves to the mentioned profile\'s LOCAL display name (same local kind-0 scan, not an external fetch)', async () => {
  const mod = loadModule();
  const { nip19 } = require('nostr-tools');
  const MENTIONED = HEX('5');
  const npub = nip19.npubEncode(MENTIONED);
  const deps = makeDeps({
    scanStrfry: (filter) => {
      const f = typeof filter === 'string' ? JSON.parse(filter) : filter;
      if (Array.isArray(f.kinds) && f.kinds.includes(0)) {
        assert(Array.isArray(f.authors) && f.authors.includes(MENTIONED),
          'the local kind-0 scan must include the mentioned pubkey so its name resolves in the same pass (no separate/external fetch).');
        return [kind0(MENTIONED, { display_name: 'Bob Mentioned', name: 'bob' }, 60)];
      }
      return [];
    },
    querySync: async (relays, filter) => {
      const f = filter || {};
      assert(!(Array.isArray(f.kinds) && f.kinds.includes(0)), 'mentioned-profile kind-0 must come from LOCAL strfry, never external relays.');
      return [kind1('n1', AUTHOR, 200, `hey nostr:${npub} welcome`)];
    },
  });
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps });
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  const item = r.items.find((it) => it.id === 'n1');
  assert(item && item.mentions && typeof item.mentions === 'object', 'each item must carry a `mentions` map (pubkey → displayName).');
  assert(item.mentions[MENTIONED] === 'Bob Mentioned', `the npub mention must resolve to the local display name; got ${JSON.stringify(item.mentions[MENTIONED])}.`);
});

test('M2 (AC-5): a note with no nostr: mentions carries an empty mentions map (stable shape, no crash)', async () => {
  const mod = loadModule();
  const deps = makeDeps({ querySync: async () => [kind1('n1', AUTHOR, 200, 'just plain text here')] });
  const r = await callBuildUserNotes(mod, { pubkey: AUTHOR, limit: 50, deps });
  const item = r.items.find((it) => it.id === 'n1');
  assert(item.mentions && typeof item.mentions === 'object' && Object.keys(item.mentions).length === 0,
    `a mention-free note must carry an empty mentions object; got ${JSON.stringify(item.mentions)}.`);
});

// ===========================================================================
// HANDLER — the public Express handler maps the outcomes to HTTP (INVALID → 400).
// The INVALID path short-circuits before any I/O, so this runs hermetically with
// the REAL handler (no injected deps, no live relays/Neo4j).
// ===========================================================================

test('H1 (AC-4): handleGetUserNotes responds 400 { success:false, status:"INVALID" } for a malformed :pubkey (no live I/O)', async () => {
  const mod = loadModule();
  assert(mod && typeof mod.handleGetUserNotes === 'function', 'handleGetUserNotes must be exported (feature absent).');
  let statusCode = 200; let body = null;
  const req = { params: { pubkey: NOT_HEX }, query: { limit: '50' } };
  const res = { status(c) { statusCode = c; return this; }, json(b) { body = b; return this; } };
  await mod.handleGetUserNotes(req, res);
  assert(statusCode === 400, `a malformed :pubkey must respond HTTP 400; got ${statusCode}.`);
  assert(body && body.success === false && body.status === 'INVALID',
    `the 400 body must be { success:false, status:'INVALID', ... }; got ${JSON.stringify(body)}.`);
});

test('H2 (AC-4): the handler source maps INVALID → 400 and the valid outcomes → 200 (success body)', () => {
  const src = safeRead(MODULE_PATH);
  assert(src.length > 0, 'userNotesReadPath.js does not exist yet.');
  assert(/status\(?\s*400|400\b/.test(src) && /INVALID/.test(src),
    'the handler must respond 400 on the INVALID outcome (a malformed pubkey is a client error).');
  assert(/success:\s*true/.test(src),
    'the handler must respond { success: true, ...result } for the valid OK/EMPTY outcomes (the shape the UI hook gates on).');
});

// ===========================================================================
// REGRESSION — the shipped feed read path is NOT modified (additive; ADR Option A).
// ===========================================================================

test('R1: the shipped feed read path src/api/feed/feedReadPath.js is untouched (FEED_CAP=50, still exports buildFeed/handleGetFeed)', () => {
  const src = safeRead(FEED_READ_PATH);
  assert(src.length > 0, 'src/api/feed/feedReadPath.js missing — unexpected (ADR note-surfaces/0001 must NOT touch the shipped feed).');
  assert(/FEED_CAP\s*=\s*50/.test(src), 'feedReadPath.js must keep FEED_CAP = 50 — this story duplicates sourcing helpers rather than refactoring the shipped feed (ADR Option A).');
  assert(/module\.exports\s*=\s*\{\s*buildFeed\s*,\s*handleGetFeed\s*\}/.test(src),
    'feedReadPath.js must still export { buildFeed, handleGetFeed } unchanged — the by-author read path is additive, it does not re-point the feed (ADR Option A; consolidation is a deferred follow-up).');
});

test('R2: the shared enrichNotes seam still exports enrichNotes + PROFILE_LOOKUP_CAP (reused, not modified)', () => {
  const src = safeRead(SHARED_ENRICH);
  assert(src.length > 0, 'src/api/_shared/noteEnrichment.js missing — unexpected.');
  assert(/enrichNotes/.test(src) && /PROFILE_LOOKUP_CAP/.test(src),
    'noteEnrichment.js must still export enrichNotes + PROFILE_LOOKUP_CAP — this story reuses the seam unchanged (ADR §Out of scope: enrichNotes is reused, not modified).');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail };
}

module.exports = { run };
