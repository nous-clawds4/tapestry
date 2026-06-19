/**
 * Story event-page #1: Event read path. ADR event-page/0001.
 * See engineering-team/stories/event-page/1-event-read-path.test-plan.md
 *
 * ADR chose Option A: a self-contained src/api/event/eventReadPath.js exporting
 * buildEvent({ id, author, relays, deps }) + handleGetEvent, using a NEW
 * src/api/_shared/relaySource.js (extracted sourcing primitives) + the reused
 * enrichNotes. It returns a discriminated `status` union
 *   { OK, UNSUPPORTED_KIND, INVALID_EVENT, NOT_FOUND, NO_AUTHOR_NOTE, INVALID }
 * plus, on the fetched outcomes, a `relaySource` { set, fallback }; an OK item is
 * the feed shape { id, pubkey, createdAt, content, author:{displayName,avatar}, mentions }.
 *
 * WHY behavioral with REAL signed fixtures: verification is a load-bearing AC
 * (does-not-validate). We mint genuinely-signed events with nostr-tools so
 * verifyEvent is exercised honestly. NOTE: nostr-tools memoizes verification via a
 * Symbol that object-spread COPIES — so every fixture is passed through a JSON clone
 * (drops the cache) and "invalid" fixtures flip a sig char on the clone, forcing a
 * real re-check. buildEvent crosses three injected I/O boundaries (scanStrfry /
 * runCypher / querySync); the relay union (hints + outbox + well-known) is asserted
 * by recording the relay arg the querySync fake receives.
 *
 * ALL S/B/H tests FAIL pre-implementation (modules absent); R* regression sentinels
 * PASS before AND after (Option A leaves the shipped feed/user-notes read paths
 * untouched).
 */

const fs = require('fs');
const path = require('path');
const { generateSecretKey, getPublicKey, finalizeEvent } = require('nostr-tools');

const MODULE_PATH = path.resolve(__dirname, '../src/api/event/eventReadPath.js');
const SHARED_PATH = path.resolve(__dirname, '../src/api/_shared/relaySource.js');
const API_INDEX = path.resolve(__dirname, '../src/api/index.js');
const FEED_READ_PATH = path.resolve(__dirname, '../src/api/feed/feedReadPath.js');
const USER_NOTES_PATH = path.resolve(__dirname, '../src/api/notes/userNotesReadPath.js');
const SHARED_ENRICH = path.resolve(__dirname, '../src/api/_shared/noteEnrichment.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function loadModule() {
  try { delete require.cache[require.resolve(MODULE_PATH)]; } catch { /* not resolvable yet */ }
  try { return require(MODULE_PATH); } catch { return null; }
}

// ── Fixtures: genuinely signed events (clean clones; no carried verify-Symbol) ──
const SK = generateSecretKey(); const PK = getPublicKey(SK);       // the author
const SK2 = generateSecretKey(); const PK2 = getPublicKey(SK2);    // a different author
function signed(sk, tpl) {
  return JSON.parse(JSON.stringify(finalizeEvent({ created_at: 1000, tags: [], content: '', ...tpl }, sk)));
}
// Flip one signature char on a CLEAN clone → verifyEvent recomputes → false (id unchanged).
function badSig(ev) {
  const c = JSON.parse(JSON.stringify(ev));
  c.sig = (c.sig[0] === 'a' ? 'b' : 'a') + c.sig.slice(1);
  return c;
}
function kind0(pubkey, profile) {
  return { id: 'k0-' + pubkey.slice(0, 6), kind: 0, pubkey, created_at: 50, tags: [], content: JSON.stringify(profile) };
}
function kind10002(pubkey, rTags, created_at) {
  return { id: 'k10-' + created_at, kind: 10002, pubkey, created_at, tags: rTags, content: '' };
}

const DEFAULT_SET_ROWS = [
  { json: JSON.stringify({ nostrRelay: { websocketUrl: 'wss://wk-a.example' } }) },
  { json: JSON.stringify({ nostrRelay: { websocketUrl: 'wss://wk-b.example' } }) },
];

function makeDeps({ mainEvents = [], kind10002s = [], kind0s = [], runCypher } = {}) {
  const calls = [];
  const deps = {
    scanStrfry: (filter) => {
      const f = typeof filter === 'string' ? JSON.parse(filter) : filter;
      if (Array.isArray(f.kinds) && f.kinds.includes(0)) return kind0s;
      return [];
    },
    runCypher: runCypher || (async () => DEFAULT_SET_ROWS),
    querySync: async (relays, filter) => {
      const f = filter || {};
      calls.push({ relays: relays || [], filter: f });
      if (Array.isArray(f.kinds) && f.kinds.includes(10002)) return kind10002s;
      return mainEvents;
    },
  };
  return { deps, calls };
}
function mainCall(calls) { return calls.find(c => !((c.filter.kinds || []).includes(10002))); }

async function callBuildEvent(mod, opts, deps) {
  assert(mod && typeof mod.buildEvent === 'function',
    'src/api/event/eventReadPath.js must export an async `buildEvent` — feature not implemented yet (ADR event-page/0001).');
  return mod.buildEvent({ ...opts, deps, ...deps });
}

// ===========================================================================
// STRUCTURAL
// ===========================================================================

test('S1: src/api/event/eventReadPath.js exists and exports buildEvent + handleGetEvent (ADR §Decision)', () => {
  const mod = loadModule();
  assert(mod !== null, 'src/api/event/eventReadPath.js does not load yet — the Implementer must create the event read-path module (ADR event-page/0001 Option A).');
  assert(typeof mod.buildEvent === 'function', 'eventReadPath.js must export `buildEvent`.');
  assert(typeof mod.handleGetEvent === 'function', 'eventReadPath.js must export `handleGetEvent` (the GET /api/event handler).');
});

test('S2: src/api/_shared/relaySource.js exists and exports the extracted sourcing primitives (ADR §Decision Option A)', () => {
  const src = safeRead(SHARED_PATH);
  assert(src.length > 0, 'src/api/_shared/relaySource.js does not exist yet — Option A extracts the shared sourcing here.');
  let mod = null; try { mod = require(SHARED_PATH); } catch { mod = null; }
  assert(mod && typeof mod.resolveGeneralPurposeRelays === 'function', 'relaySource.js must export resolveGeneralPurposeRelays.');
  assert(Array.isArray(mod.FALLBACK_RELAYS) && mod.FALLBACK_RELAYS.some(r => /relay\.primal\.net/.test(r)) && mod.FALLBACK_RELAYS.some(r => /nos\.lol/.test(r)) && mod.FALLBACK_RELAYS.some(r => /relay\.damus\.io/.test(r)),
    'relaySource.js must export FALLBACK_RELAYS including relay.primal.net, nos.lol, relay.damus.io.');
});

test('S3: GET /api/event is registered to handleGetEvent in src/api/index.js (ADR §Impl)', () => {
  const src = safeRead(API_INDEX);
  assert(/['"]\/api\/event['"]/.test(src), "src/api/index.js must register the public route '/api/event'.");
  assert(/handleGetEvent/.test(src), 'src/api/index.js must wire /api/event to handleGetEvent.');
});

test('S4 (reuse): eventReadPath requires _shared/relaySource AND the shared enrichNotes (no re-implementation)', () => {
  const src = safeRead(MODULE_PATH);
  assert(src.length > 0, 'eventReadPath.js does not exist yet.');
  assert(/require\(\s*['"]\.\.\/_shared\/relaySource['"]\s*\)/.test(src),
    'eventReadPath.js must require the extracted ../_shared/relaySource (Option A: the new path consumes the shared home, no inline 3rd copy).');
  assert(/require\(\s*['"]\.\.\/_shared\/noteEnrichment['"]\s*\)/.test(src) && /enrichNotes/.test(src),
    'eventReadPath.js must reuse enrichNotes from ../_shared/noteEnrichment.');
});

// ===========================================================================
// BY EVENT ID (AC: by event reference)
// ===========================================================================

test('B1 (AC by-id): a located, verified kind-1 yields OK with that event as a feed-shaped item', async () => {
  const mod = loadModule();
  const ev = signed(SK, { kind: 1, created_at: 200, content: 'hello world' });
  const { deps, calls } = makeDeps({ mainEvents: [ev], kind0s: [kind0(PK, { name: 'Alice' })] });
  const r = await callBuildEvent(mod, { id: ev.id }, deps);
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  assert(r.item && r.item.id === ev.id && r.item.pubkey === PK && r.item.content === 'hello world',
    `OK must carry the located event as the item; got ${JSON.stringify(r.item && { id: r.item.id, content: r.item.content })}.`);
  assert(mainCall(calls), 'the main fetch must have been issued.');
});

test('B2 (AC by-id): a located, verified NON-kind-1 yields UNSUPPORTED_KIND carrying the kind', async () => {
  const mod = loadModule();
  const ev = signed(SK, { kind: 6, created_at: 200, content: '' }); // a repost
  const { deps } = makeDeps({ mainEvents: [ev] });
  const r = await callBuildEvent(mod, { id: ev.id }, deps);
  assert(r && r.status === 'UNSUPPORTED_KIND', `a non-kind-1 event must yield UNSUPPORTED_KIND; got ${JSON.stringify(r && r.status)}.`);
  assert(r.kind === 6, `UNSUPPORTED_KIND must carry the kind number (6); got ${JSON.stringify(r.kind)}.`);
});

test('B3 (AC by-id): an event located by id but failing verification yields INVALID_EVENT (does not validate)', async () => {
  const mod = loadModule();
  const ev = signed(SK, { kind: 1, created_at: 200, content: 'real' });
  const tampered = badSig(ev); // same id, broken signature → verifyEvent false
  const { deps } = makeDeps({ mainEvents: [tampered] });
  const r = await callBuildEvent(mod, { id: ev.id }, deps);
  assert(r && r.status === 'INVALID_EVENT', `an event that fails verification must yield INVALID_EVENT; got ${JSON.stringify(r && r.status)}.`);
});

test('B4 (AC by-id): no event with that id in the relay union yields NOT_FOUND', async () => {
  const mod = loadModule();
  const ev = signed(SK, { kind: 1, created_at: 200, content: 'x' });
  const { deps } = makeDeps({ mainEvents: [] });
  const r = await callBuildEvent(mod, { id: ev.id }, deps);
  assert(r && r.status === 'NOT_FOUND', `no matching event must yield NOT_FOUND; got ${JSON.stringify(r && r.status)}.`);
});

test('B5 (AC invalid input): neither a valid id nor a valid author yields INVALID and queries nothing', async () => {
  const mod = loadModule();
  const { deps, calls } = makeDeps({});
  const r = await callBuildEvent(mod, { id: 'not-hex', author: '' }, deps);
  assert(r && r.status === 'INVALID', `a malformed id with no author must yield INVALID; got ${JSON.stringify(r && r.status)}.`);
  assert(calls.length === 0, 'INVALID must short-circuit before any relay query.');
});

// ===========================================================================
// BY AUTHOR (AC: latest note)
// ===========================================================================

test('B6 (AC by-author): returns the newest VERIFIED kind-1 by the author — skipping an unverified-newer and a foreign-author event', async () => {
  const mod = loadModule();
  const authorValidOld = signed(SK, { kind: 1, created_at: 100, content: 'the one' });
  const authorInvalidNew = badSig(signed(SK, { kind: 1, created_at: 200, content: 'broken newer' }));
  const foreignValidNewest = signed(SK2, { kind: 1, created_at: 300, content: 'someone else' });
  const { deps } = makeDeps({ mainEvents: [foreignValidNewest, authorInvalidNew, authorValidOld], kind0s: [kind0(PK, { name: 'Alice' })] });
  const r = await callBuildEvent(mod, { author: PK }, deps);
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  assert(r.item.content === 'the one' && r.item.pubkey === PK,
    `must pick the newest VERIFIED kind-1 by the requested author (skip unverified-newer + foreign); got ${JSON.stringify(r.item && { c: r.item.content, pk: r.item.pubkey.slice(0, 6) })}.`);
});

test('B7 (AC by-author): an author with no verifiable kind-1 yields NO_AUTHOR_NOTE', async () => {
  const mod = loadModule();
  const { deps } = makeDeps({ mainEvents: [] });
  const r = await callBuildEvent(mod, { author: PK }, deps);
  assert(r && r.status === 'NO_AUTHOR_NOTE', `no kind-1 for the author must yield NO_AUTHOR_NOTE; got ${JSON.stringify(r && r.status)}.`);
});

// ===========================================================================
// RELAY UNION + OUTBOX + WELL-KNOWN
// ===========================================================================

test('B8 (AC relay union): the main fetch consults hints + author outbox (kind-10002 write relays) + well-known set', async () => {
  const mod = loadModule();
  const ev = signed(SK, { kind: 1, created_at: 100, content: 'x' });
  const outbox = kind10002(PK, [['r', 'wss://outbox-write.example'], ['r', 'wss://outbox-read.example', 'read']], 5);
  const { deps, calls } = makeDeps({ mainEvents: [ev], kind10002s: [outbox] });
  const r = await callBuildEvent(mod, { author: PK, relays: ['wss://hint.example'] }, deps);
  assert(r && r.status === 'OK', `expected OK; got ${JSON.stringify(r && r.status)}.`);
  const mc = mainCall(calls);
  assert(mc, 'a main (non-kind-10002) fetch must have been issued.');
  const set = new Set(mc.relays);
  assert(set.has('wss://hint.example'), `the union must include the supplied relay hint; got ${JSON.stringify(mc.relays)}.`);
  assert(set.has('wss://outbox-write.example'), `the union must include the author's WRITE outbox relay; got ${JSON.stringify(mc.relays)}.`);
  assert(set.has('wss://wk-a.example') && set.has('wss://wk-b.example'), `the union must include the well-known set relays; got ${JSON.stringify(mc.relays)}.`);
  assert(!set.has('wss://outbox-read.example'), `a READ-marked outbox relay must NOT be added (write relays only); got ${JSON.stringify(mc.relays)}.`);
});

test('B9 (AC relay source): resolvable set → relaySource "set"; empty set → "fallback" with the fixed relays in the union', async () => {
  const mod = loadModule();
  const ev = signed(SK, { kind: 1, created_at: 100, content: 'x' });
  const setRes = await callBuildEvent(mod, { id: ev.id }, makeDeps({ mainEvents: [ev] }).deps);
  assert(setRes.relaySource === 'set', `a resolvable set must give relaySource 'set'; got ${JSON.stringify(setRes.relaySource)}.`);

  const fb = makeDeps({ mainEvents: [ev], runCypher: async () => [] });
  const fbRes = await callBuildEvent(mod, { id: ev.id }, fb.deps);
  assert(fbRes.relaySource === 'fallback', `an empty set must give relaySource 'fallback'; got ${JSON.stringify(fbRes.relaySource)}.`);
  const mc = mainCall(fb.calls);
  assert(mc.relays.some(r => /relay\.primal\.net|nos\.lol|relay\.damus\.io/.test(r)),
    `the fallback union must include the fixed fallback relays; got ${JSON.stringify(mc.relays)}.`);
});

test('B10 (AC relay source): a runCypher error degrades to the fallback relays, not a crash', async () => {
  const mod = loadModule();
  const ev = signed(SK, { kind: 1, created_at: 100, content: 'x' });
  const r = await callBuildEvent(mod, { id: ev.id }, makeDeps({ mainEvents: [ev], runCypher: async () => { throw new Error('neo4j down'); } }).deps);
  assert(r && r.status === 'OK' && r.relaySource === 'fallback',
    `a relay-set resolution error must degrade to 'fallback', not throw; got ${JSON.stringify(r && { s: r.status, rs: r.relaySource })}.`);
});

test('B11 (AC outbox): the NEWEST kind-10002 wins and only write-eligible r-tags are used', async () => {
  const mod = loadModule();
  const ev = signed(SK, { kind: 1, created_at: 100, content: 'x' });
  const older = kind10002(PK, [['r', 'wss://older-write.example']], 1);
  const newer = kind10002(PK, [['r', 'wss://newer-write.example'], ['r', 'wss://newer-read.example', 'read']], 9);
  const { deps, calls } = makeDeps({ mainEvents: [ev], kind10002s: [older, newer] });
  await callBuildEvent(mod, { author: PK }, deps);
  const set = new Set(mainCall(calls).relays);
  assert(set.has('wss://newer-write.example'), 'the newest kind-10002 write relay must be in the union.');
  assert(!set.has('wss://older-write.example'), 'an OLDER kind-10002 must be superseded by the newest (its relays not used).');
  assert(!set.has('wss://newer-read.example'), 'a read-marked relay in the newest kind-10002 must be excluded.');
});

test('B12 (AC item shape): an OK item is the feed shape with author name from LOCAL kind-0 + a mentions map', async () => {
  const mod = loadModule();
  const ev = signed(SK, { kind: 1, created_at: 100, content: 'hi there' });
  const { deps } = makeDeps({ mainEvents: [ev], kind0s: [kind0(PK, { display_name: 'Alice Local', picture: 'https://local/a.png' })] });
  const r = await callBuildEvent(mod, { id: ev.id }, deps);
  assert(r.status === 'OK', `expected OK; got ${JSON.stringify(r.status)}.`);
  const it = r.item;
  assert(it && it.id === ev.id && it.pubkey === PK && it.createdAt === 100 && it.content === 'hi there',
    'item must carry id/pubkey/createdAt/content (createdAt mapped from created_at).');
  assert(it.author && it.author.displayName === 'Alice Local' && it.author.avatar === 'https://local/a.png',
    `author name/avatar must come from the LOCAL kind-0 scan; got ${JSON.stringify(it.author)}.`);
  assert(it.mentions && typeof it.mentions === 'object', 'item must carry a mentions map (feed shape).');
});

// ===========================================================================
// HANDLER
// ===========================================================================

test('H1 (AC invalid): handleGetEvent responds 400 { success:false, status:"INVALID" } for no valid id/author (no live I/O)', async () => {
  const mod = loadModule();
  assert(mod && typeof mod.handleGetEvent === 'function', 'handleGetEvent must be exported (feature absent).');
  let statusCode = 200; let body = null;
  const req = { query: { id: 'not-hex' } };
  const res = { status(c) { statusCode = c; return this; }, json(b) { body = b; return this; } };
  await mod.handleGetEvent(req, res);
  assert(statusCode === 400, `a malformed/absent id+author must respond 400; got ${statusCode}.`);
  assert(body && body.success === false && body.status === 'INVALID', `the 400 body must be { success:false, status:'INVALID', ... }; got ${JSON.stringify(body)}.`);
});

test('H2 (handler mapping): the source maps INVALID → 400 and the valid outcomes → 200 (success body)', () => {
  const src = safeRead(MODULE_PATH);
  assert(src.length > 0, 'eventReadPath.js does not exist yet.');
  assert(/400/.test(src) && /INVALID/.test(src), 'the handler must respond 400 on the INVALID outcome.');
  assert(/success:\s*true/.test(src), 'the handler must respond { success:true, ...result } for the valid outcomes.');
});

// ===========================================================================
// REGRESSION — Option A: the shipped feed/user-notes read paths are NOT modified
// ===========================================================================

test('R1: feedReadPath.js is untouched — still self-contained (own resolveGeneralPurposeRelays, FEED_CAP=50, exports)', () => {
  const src = safeRead(FEED_READ_PATH);
  assert(src.length > 0, 'src/api/feed/feedReadPath.js missing — unexpected.');
  assert(/function resolveGeneralPurposeRelays/.test(src), 'feedReadPath.js must KEEP its own resolveGeneralPurposeRelays — Option A defers re-pointing it to _shared/relaySource.');
  assert(/FEED_CAP\s*=\s*50/.test(src) && /module\.exports\s*=\s*\{\s*buildFeed\s*,\s*handleGetFeed\s*\}/.test(src),
    'feedReadPath.js must be unchanged (FEED_CAP=50; exports buildFeed/handleGetFeed).');
});

test('R2: userNotesReadPath.js is untouched — still self-contained and exporting its contract', () => {
  const src = safeRead(USER_NOTES_PATH);
  assert(src.length > 0, 'src/api/notes/userNotesReadPath.js missing — unexpected.');
  assert(/function resolveGeneralPurposeRelays/.test(src), 'userNotesReadPath.js must KEEP its own resolveGeneralPurposeRelays — Option A defers re-pointing it.');
  assert(/NOTES_CAP\s*=\s*50/.test(src) && /handleGetUserNotes/.test(src), 'userNotesReadPath.js must be unchanged (NOTES_CAP=50; exports handleGetUserNotes).');
});

test('R3: the shared enrichNotes seam still exports enrichNotes (reused, not modified)', () => {
  const src = safeRead(SHARED_ENRICH);
  assert(/enrichNotes/.test(src) && /PROFILE_LOOKUP_CAP/.test(src), 'noteEnrichment.js must still export enrichNotes + PROFILE_LOOKUP_CAP (reused unchanged).');
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
