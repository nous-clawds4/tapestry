/**
 * Story feed-usability #3: pinned-note-aware profile "Content" card.
 * ADR feed-usability/0003. See engineering-team/stories/feed-usability/3-profile-content-card.test-plan.md
 *
 * ADR chose Option A: a new self-contained read path src/api/notes/profileContentReadPath.js
 * on _shared/relaySource + _shared/noteEnrichment, exposed at GET /api/user/:pubkey/content,
 * selecting: pinned note (first resolvable e-tag of the newest kind-10001) → latest top-level
 * note (!isReply) → NO_TOPLEVEL → EMPTY, plus INVALID for a bad pubkey. A new one-shot hook
 * useProfileContent(pubkey) feeds the updated ProfileContentSection (a "Pinned" badge on the
 * pinned case; the reply-only message on NO_TOPLEVEL; the existing empty message otherwise).
 *
 * TEST LEVELS:
 *  - Server (SB): EXECUTE the real module with injected deps — a querySync fake that dispatches
 *    on the filter (kind-10001 pin list / {ids} by-id / kind-1 by-author) — so pinned-wins,
 *    first-resolvable, fall-through, top-level fallback, NO_TOPLEVEL, EMPTY and INVALID are
 *    observable behavior with no live relays/strfry/Neo4j. Plus pinnedNoteIds as a pure unit.
 *  - UI (U): source-regex sentinels on the new hook + the updated section.
 *  - Regression (R): the new path REUSES _shared/relaySource (not a 3rd private copy); the
 *    by-author /notes read path is NOT taught pin logic.
 *
 * ALL SB/U tests FAIL pre-implementation; R pass before and after.
 */

const fs = require('fs');
const path = require('path');

const MODULE_PATH = path.resolve(__dirname, '../src/api/notes/profileContentReadPath.js');
const API_INDEX = path.resolve(__dirname, '../src/api/index.js');
const NOTES_READ_PATH = path.resolve(__dirname, '../src/api/notes/userNotesReadPath.js');
const HOOK = path.resolve(__dirname, '../ui/src/hooks/useProfileContent.js');
const SECTION = path.resolve(__dirname, '../ui/src/components/ProfileContentSection.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function loadModule() {
  try { delete require.cache[require.resolve(MODULE_PATH)]; } catch { /* not resolvable yet */ }
  try { return require(MODULE_PATH); } catch { return null; }
}
function bodyHelper(src, names) {
  const m = src.match(new RegExp(`function\\s+(${names.join('|')})\\s*\\(`));
  return m ? src.slice(m.index) : src;
}

// ---------------------------------------------------------------------------
// Fixtures.  AUTHOR is the viewed user; PINNER may differ (pins can reference
// anyone's note). querySync dispatches on the filter shape.
// ---------------------------------------------------------------------------
const HEX = (c) => c.repeat(64);
const AUTHOR = HEX('a');
const OTHER = HEX('c');           // a different author (a pinned note by someone else)
const P1 = 'p'.repeat(64);        // pinned note id #1
const P2 = 'q'.repeat(64);        // pinned note id #2

function kind1(id, author, createdAt, tags = []) {
  return { id, kind: 1, pubkey: author, created_at: createdAt, content: 'c-' + id, tags };
}
const REPLY_TAGS = [['e', HEX('e'), '', 'reply']];
function pinList(author, ids, createdAt = 500) {
  return { id: 'pl-' + author.slice(0, 4), kind: 10001, pubkey: author, created_at: createdAt,
    tags: ids.map(id => ['e', id]) };
}

// Build a filter-dispatching querySync from a scenario. Records calls for the INVALID test.
function makeQuerySync({ pinEvents = [], byId = {}, authorNotes = [] } = {}, record) {
  return async (relays, filter) => {
    if (record) record.push(filter);
    if (filter.kinds && filter.kinds.includes(10001)) return pinEvents;
    if (filter.ids) return filter.ids.map(id => byId[id]).filter(Boolean);
    if (filter.kinds && filter.kinds.includes(1)) return authorNotes;
    return [];
  };
}
function makeDeps(scenario, record) {
  return {
    scanStrfry: () => [],                       // no local kind-0 → null name/avatar (fine)
    runCypher: async () => ([{ json: JSON.stringify({ nostrRelay: { websocketUrl: 'wss://set.example' } }) }]),
    querySync: makeQuerySync(scenario, record),
  };
}
async function build(mod, scenario, { pubkey = AUTHOR } = {}, record) {
  assert(mod && typeof mod.buildProfileContent === 'function',
    'src/api/notes/profileContentReadPath.js must export an async buildProfileContent — feature not implemented yet (ADR feed-usability/0003).');
  const deps = makeDeps(scenario, record);
  return mod.buildProfileContent({ pubkey, deps, ...deps });
}

// ===========================================================================
// STRUCTURAL
// ===========================================================================

test('SB0: module exists and exports buildProfileContent + handleGetProfileContent + pinnedNoteIds', () => {
  const mod = loadModule();
  assert(mod !== null, 'src/api/notes/profileContentReadPath.js does not load yet — create the read path (ADR 0003).');
  assert(typeof mod.buildProfileContent === 'function', 'must export buildProfileContent.');
  assert(typeof mod.handleGetProfileContent === 'function', 'must export handleGetProfileContent (GET /api/user/:pubkey/content).');
  assert(typeof mod.pinnedNoteIds === 'function', 'must export pinnedNoteIds (the pure e-tag extractor).');
});

test('SB0b: GET /api/user/:pubkey/content is registered to handleGetProfileContent', () => {
  const src = safeRead(API_INDEX);
  assert(/['"]\/api\/user\/:pubkey\/content['"]/.test(src),
    "src/api/index.js must register '/api/user/:pubkey/content' (beside /api/user/:pubkey/notes).");
  assert(/handleGetProfileContent/.test(src), 'index.js must wire the content route to handleGetProfileContent.');
});

test('SB0c: the read path REUSES _shared/relaySource (not a 3rd private sourcing copy) and the shared enrichNotes', () => {
  const src = safeRead(MODULE_PATH);
  assert(src.length > 0, 'profileContentReadPath.js does not exist yet.');
  assert(/require\(['"]\.\.\/_shared\/relaySource['"]\)/.test(src),
    'ADR 0003: the new path must build on _shared/relaySource (the third consumer — consolidation), not duplicate the sourcing helpers a third time.');
  assert(/require\(['"]\.\.\/_shared\/noteEnrichment['"]\)/.test(src) && /enrichNotes/.test(src),
    'must reuse the shared enrichNotes (item shape + isReply).');
});

// ===========================================================================
// SERVER BEHAVIORAL — the selection order
// ===========================================================================

test('SB1 (AC pinned wins): a resolvable pin ⇒ OK, pinned:true, item is the pinned note', async () => {
  const mod = loadModule();
  const scenario = { pinEvents: [pinList(AUTHOR, [P1])], byId: { [P1]: kind1(P1, OTHER, 100) },
    authorNotes: [kind1('recent', AUTHOR, 999)] };
  const r = await build(mod, scenario);
  assert(r.status === 'OK', `expected OK; got ${r.status}`);
  assert(r.pinned === true, 'the pinned case must set pinned:true (AC-1: labelled pinned).');
  assert(r.item && r.item.id === P1, `the card must show the pinned note (${P1}), not the recent author note; got ${r.item && r.item.id}.`);
});

test('SB2 (AC one-of-several): several pins ⇒ exactly the FIRST resolvable e-tag (deterministic)', async () => {
  const mod = loadModule();
  const scenario = { pinEvents: [pinList(AUTHOR, [P1, P2])], byId: { [P1]: kind1(P1, AUTHOR, 100), [P2]: kind1(P2, AUTHOR, 200) } };
  const r = await build(mod, scenario);
  assert(r.status === 'OK' && r.pinned === true, 'must be an OK pinned card.');
  assert(r.item.id === P1, `with two resolvable pins the FIRST e-tag (${P1}) must win (deterministic, leading=most-recent-pinned); got ${r.item.id}.`);
});

test('SB2b (AC one-of-several): first pin unresolvable ⇒ the first RESOLVABLE pin is chosen', async () => {
  const mod = loadModule();
  const scenario = { pinEvents: [pinList(AUTHOR, [P1, P2])], byId: { [P2]: kind1(P2, AUTHOR, 200) } }; // P1 missing
  const r = await build(mod, scenario);
  assert(r.status === 'OK' && r.pinned === true && r.item.id === P2,
    `the first RESOLVABLE pin (${P2}) must be chosen when the leading id doesn't resolve; got ${JSON.stringify({ s: r.status, id: r.item && r.item.id })}.`);
});

test('SB3 (AC unresolvable pins fall through): pin list present but nothing resolves ⇒ the top-level fallback, pinned:false', async () => {
  const mod = loadModule();
  const scenario = { pinEvents: [pinList(AUTHOR, [P1, P2])], byId: {}, // no pinned note resolves
    authorNotes: [kind1('top', AUTHOR, 300)] };
  const r = await build(mod, scenario);
  assert(r.status === 'OK' && r.pinned === false && r.item.id === 'top',
    `unresolvable pins must fall through to the latest top-level note (pinned:false), never an error/stuck; got ${JSON.stringify({ s: r.status, p: r.pinned, id: r.item && r.item.id })}.`);
});

test('SB4 (AC no pin → latest top-level): first !isReply wins even when a NEWER reply exists', async () => {
  const mod = loadModule();
  const scenario = { pinEvents: [], byId: {},
    // newest-first as relays deliver: a reply at 300 then a top-level at 200
    authorNotes: [kind1('reply', AUTHOR, 300, REPLY_TAGS), kind1('top', AUTHOR, 200)] };
  const r = await build(mod, scenario);
  assert(r.status === 'OK' && r.pinned === false, 'no pin ⇒ an OK non-pinned card.');
  assert(r.item.id === 'top', `must skip the newer reply and show the latest TOP-LEVEL note; got ${r.item.id}.`);
});

test('SB5 (AC reply-only → NO_TOPLEVEL): notes exist but all replies, no pin ⇒ NO_TOPLEVEL', async () => {
  const mod = loadModule();
  const scenario = { pinEvents: [], byId: {}, authorNotes: [kind1('r1', AUTHOR, 300, REPLY_TAGS), kind1('r2', AUTHOR, 200, REPLY_TAGS)] };
  const r = await build(mod, scenario);
  assert(r.status === 'NO_TOPLEVEL', `all-replies + no pin must be NO_TOPLEVEL (distinct from EMPTY); got ${r.status}.`);
  assert(!r.item, 'NO_TOPLEVEL carries no item.');
});

test('SB6 (AC existing empty preserved): no pin and no kind-1 at all ⇒ EMPTY', async () => {
  const mod = loadModule();
  const r = await build(mod, { pinEvents: [], byId: {}, authorNotes: [] });
  assert(r.status === 'EMPTY', `no notes + no pin must be EMPTY (the pre-existing empty state); got ${r.status}.`);
});

test('SB7 (INVALID): a malformed pubkey ⇒ INVALID and NO relays/Neo4j are queried', async () => {
  const mod = loadModule();
  const record = [];
  const r = await build(mod, { pinEvents: [], byId: {}, authorNotes: [] }, { pubkey: 'not-hex' }, record);
  assert(r.status === 'INVALID', `a bad pubkey must short-circuit to INVALID; got ${r.status}.`);
  assert(record.length === 0, 'INVALID must be decided BEFORE any relay query (no querySync calls).');
});

test('SB8 (pure unit): pinnedNoteIds returns e-tag ids in list order, caps at PIN_TRY_CAP, ignores non-e / id-less', () => {
  const mod = loadModule();
  assert(mod && typeof mod.pinnedNoteIds === 'function', 'pinnedNoteIds must be exported.');
  const ids = mod.pinnedNoteIds([['e', P1], ['p', OTHER], ['e'], ['e', P2], ['a', 'x']]);
  assert(JSON.stringify(ids) === JSON.stringify([P1, P2]),
    `must keep only well-formed e-tag ids in order [P1,P2]; got ${JSON.stringify(ids)}.`);
  const cap = mod.PIN_TRY_CAP || 10;
  const many = Array.from({ length: cap + 5 }, (_, i) => ['e', HEX(String(i % 10)) ]);
  assert(mod.pinnedNoteIds(many).length <= cap, `must cap the attempted ids at PIN_TRY_CAP (${cap}).`);
  assert(mod.pinnedNoteIds(undefined).length === 0 && mod.pinnedNoteIds('x').length === 0,
    'non-array tags ⇒ [] (no crash).');
});

// ===========================================================================
// UI SENTINELS — the one-shot hook + the updated section
// ===========================================================================

test('U1: useProfileContent(pubkey) fetches /api/user/<pubkey>/content and returns { data, loading, error }', () => {
  const src = safeRead(HOOK);
  assert(src.length > 0, 'ui/src/hooks/useProfileContent.js does not exist yet (ADR 0003 §Client).');
  assert(/useProfileContent\s*\(\s*pubkey\s*\)/.test(src) || /function\s+useProfileContent\s*\(/.test(src),
    'useProfileContent must take (pubkey).');
  assert(/fetch\(\s*`\/api\/user\/\$\{pubkey\}\/content`/.test(src),
    'useProfileContent must fetch `/api/user/${pubkey}/content` (the ADR 0003 endpoint).');
  assert(/success/.test(src) && /return\s*\{[\s\S]{0,80}data[\s\S]{0,80}loading[\s\S]{0,80}error/.test(src),
    'must gate on success and return { data, loading, error }.');
  assert(/AbortController/.test(src) && /\.abort\(\)/.test(src), 'must abort the fetch on unmount.');
});

test('U2: the hook does NOT paginate — it is one-shot (no loadMore/until), decoupled from useUserNotes', () => {
  const src = safeRead(HOOK);
  assert(src.length > 0, 'useProfileContent.js missing.');
  assert(!/loadMore|until=|useUserNotes/.test(src),
    'the content card shows ONE note; its hook must be one-shot (no loadMore/until, not the paginating useUserNotes) — ADR 0003 §Client.');
});

test('U3: renderContentBody renders the single data.item on OK and a "Pinned" badge when data.pinned', () => {
  const src = safeRead(SECTION);
  assert(src.length > 0, 'ProfileContentSection.jsx missing.');
  const body = bodyHelper(src, ['renderContentBody']);
  assert(/status\s*===?\s*['"]OK['"]/.test(body) && /<NoteCard\b[^>]*\bitem=\{data\.item\}/.test(body),
    'the OK branch must render <NoteCard item={data.item} /> (the single selected note).');
  assert(/data\.pinned/.test(body) && /bsp-content-pinned/.test(src),
    'when data.pinned, the section must render a "Pinned" badge (bsp-content-pinned) so the reader knows it is a chosen note (AC-1).');
  assert(/PINNED_LABEL\s*:\s*['"]Pinned['"]/.test(src),
    'CONTENT_COPY must carry the "Pinned" label.');
});

test('U4: renderContentBody has the NO_TOPLEVEL (reply-only) branch, distinct from the existing EMPTY copy', () => {
  const src = safeRead(SECTION);
  const body = bodyHelper(src, ['renderContentBody']);
  assert(/NO_TOPLEVEL/.test(body) && /NO_TOPLEVEL\s*:/.test(src),
    'the section must handle status NO_TOPLEVEL with its own message (AC-5: "no top-level notes to feature").');
  const m = src.match(/NO_TOPLEVEL\s*:\s*["']([^"']+)["']/);
  assert(m && /top[\s-]?level|feature/i.test(m[1]),
    `the NO_TOPLEVEL copy must convey there are no top-level notes to feature; got ${m && '"' + m[1] + '"'}.`);
  assert(/CONTENT_COPY\.EMPTY/.test(src),
    'the pre-existing EMPTY message must remain for the no-notes case (AC-6).');
});

test('U5: the "View all notes →" link stays present (AC-5: the notes-page link remains available)', () => {
  const src = safeRead(SECTION);
  assert(/to=\{`\/user\/\$\{pubkey\}\/notes`\}/.test(src) && /VIEW_ALL/.test(src),
    'the section must keep the always-present <Link to={`/user/${pubkey}/notes`}> (VIEW_ALL) in every state.');
});

// ===========================================================================
// REGRESSION
// ===========================================================================

test('R1: the by-author /notes read path is NOT taught pin logic (untouched by this story)', () => {
  const src = safeRead(NOTES_READ_PATH);
  assert(src.length > 0, 'userNotesReadPath.js missing — unexpected.');
  assert(!/10001|pinned|pinnedNoteIds/.test(src),
    'ADR 0003 §Out of scope: the /notes page must NOT prefer pins — userNotesReadPath.js must gain no kind-10001/pin logic.');
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
