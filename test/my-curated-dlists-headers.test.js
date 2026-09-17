/**
 * my-curated-dlists #2: the two headers — my assistant's DList header and the shared header it
 * points to, on the curated-DList detail page.
 *
 * Story: engineering-team/stories/my-curated-dlists/2-the-two-headers.md
 * ADR:   engineering-team/decisions/my-curated-dlists/0002-the-two-headers.md
 *
 * Three classes (house pattern; ESM behavioral import per test/my-curated-dlists-page.test.js):
 *   U (behavioral) — the three new pure exports of ui/src/utils/treasureMap.js: parseCoordinate,
 *                    describeCurationHeader, curationPointerRow — and the shared-header row driven
 *                    through story 1's lookupCurationHeaders with fakes. FAIL now: the exports do not
 *                    exist (the util loads — R3 exercises its existing exports).
 *   S (structure)  — the new headers module (sections, raw toggles, the Simple Lists link gated on
 *                    "local", the one import request and its isolation), the detail page's second
 *                    lookup at the community relay with refresh wired to each section, and
 *                    useCurationHeaders' refresh. FAIL now: none of it exists.
 *   R (sentinel)   — story 1's front door and write-free files, the util's existing exports, the
 *                    community relay constant, and Simple Lists / the DList Curation panel untouched.
 *                    PASS before and after.
 *
 * Not covered here: the rendered sections and the real import round-trip (the reviewer's live check
 * on the local stack — an import from dcosl into local strfry is a local-only write of a public,
 * author-signed event), and the real strfry scan / relay fetch (their own lanes).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const UI = path.resolve(__dirname, '../ui/src');
const UTIL = path.join(UI, 'utils/treasureMap.js');
const HEADERS = path.join(UI, 'pages/grapevine/CuratedDListHeaders.jsx');
const DETAIL = path.join(UI, 'pages/grapevine/CuratedDListDetail.jsx');
const LIST_PAGE = path.join(UI, 'pages/grapevine/MyCuratedDLists.jsx');
const MAP_HOOK = path.join(UI, 'hooks/useTreasureMap.js');
const HEADERS_HOOK = path.join(UI, 'hooks/useCurationHeaders.js');
const COMMUNITY_HOOK = path.join(UI, 'hooks/useCommunitySharedConcepts.js');
const CURATION_PANEL = path.join(UI, 'pages/grapevine/DListCurationPanel.jsx');
const DLIST_DETAIL = path.join(UI, 'pages/lists/DListDetail.jsx');
const STORY1_FILES = [LIST_PAGE, DETAIL, MAP_HOOK, HEADERS_HOOK];

const ME = 'a'.repeat(64);                    // the signed-in user's own assistant
const AUTHOR = '0123456789abcdef'.repeat(4);  // the shared list's author
const RELAY = 'wss://dcosl.brainstorm.world';
const SHARED = `39998:${AUTHOR}:dog-breed`;
const SHARED_2 = `39998:${AUTHOR}:cat-breed`;
const EVENT_ID = 'e'.repeat(64);
const APOS = "(?:'|’|&apos;|&#39;)";          // an apostrophe as JSX may spell it

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function rel(p) { return path.relative(path.resolve(__dirname, '..'), p); }
async function util() {
  const mod = await loadEsm(UTIL);
  assert(mod && typeof mod.classifyEntry === 'function', 'ui/src/utils/treasureMap.js must load and export classifyEntry');
  return mod;
}
async function fn(name) {
  const mod = await util();
  assert(typeof mod[name] === 'function', `ui/src/utils/treasureMap.js must export ${name} (ADR 0002 §Implementation 1)`);
  return mod[name];
}
function src(p, what) {
  const s = safeRead(p);
  assert(s.length > 0, `${what}: ${rel(p)} must exist (ADR 0002 §Implementation notes)`);
  return s;
}
// An assistant header: kind 39998, d = dog-breed, authored by `pubkey`, with the given b tags.
function header(bTags, pubkey = ME) {
  return { id: 'h'.repeat(64), kind: 39998, pubkey, created_at: 1789091203, content: '', sig: 's'.repeat(128),
    tags: [['d', 'dog-breed'], ['names', 'dog breed', 'dog breeds'], ...bTags] };
}
function count(s, re) { return (s.match(re) || []).length; }

const tests = [];
function test(name, f) { tests.push({ name, fn: f }); }

/* ── U: the pure functions ─────────────────────────────────── */

test('U1: parseCoordinate — "<kind>:<64-hex pubkey>:<d-tag>" (the d-tag keeps its colons); anything else is null', async () => {
  const parseCoordinate = await fn('parseCoordinate');
  assert(deepEq(parseCoordinate(SHARED), { kind: 39998, pubkey: AUTHOR, d: 'dog-breed' }),
    `ADR note 1: the shared coordinate parses; got ${JSON.stringify(parseCoordinate(SHARED))}`);
  assert(deepEq(parseCoordinate(`39999:${AUTHOR}:a:b`), { kind: 39999, pubkey: AUTHOR, d: 'a:b' }),
    'ADR note 1: the d-tag is everything after the second colon');
  for (const bad of [EVENT_ID, `39998:${AUTHOR}`, `39998::dog-breed`, `x:${AUTHOR}:d`, `39998:${AUTHOR.toUpperCase()}:d`, `39998:${AUTHOR.slice(1)}:d`, 'b-tag-deferred', '', null, undefined, 42, {}]) {
    let out;
    try { out = parseCoordinate(bad); } catch (e) { throw new Error(`ADR note 1: never throws — threw on ${JSON.stringify(bad)}: ${e.message}`); }
    assert(out === null, `ADR note 1 / sub-decision 1: ${JSON.stringify(bad)} is not a list coordinate → null; got ${JSON.stringify(out)}`);
  }
});

test('U2: describeCurationHeader — a well-formed assistant header: authored by my assistant, one inherit-items pointer, no problems', async () => {
  const describe = await fn('describeCurationHeader');
  const info = describe(header([['b', SHARED, 'inherit-items']]), ME);
  assert(info && info.authoredByAssistant === true, `AC-1: authored by my assistant; got ${JSON.stringify(info)}`);
  assert(info.pointer && info.pointer.coord === SHARED && info.pointer.type === 'inherit-items'
    && info.pointer.kind === 39998 && info.pointer.pubkey === AUTHOR && info.pointer.d === 'dog-breed',
  `AC-2 / ADR note 1: the pointer carries coord, type, kind, pubkey, d; got ${JSON.stringify(info.pointer)}`);
  assert(info.deferred === false && Array.isArray(info.problems) && info.problems.length === 0,
    `AC-2: no problems on the header the DList Curation endpoint writes; got ${JSON.stringify(info)}`);
});

test('U3: describeCurationHeader — each pointer problem alone: no b tag, not a coordinate, wrong type (incl. the pointer default), more than one pointer', async () => {
  const describe = await fn('describeCurationHeader');
  let info = describe(header([]), ME);
  assert(deepEq(info.problems, ['no-b']) && info.pointer === null && info.deferred === false, `AC-2: no b tag → ['no-b']; got ${JSON.stringify(info)}`);
  for (const bad of [['b', EVENT_ID, 'inherit-items'], ['b', 'nonsense'], ['b', ''], ['b'], ['b', `39998:${AUTHOR.toUpperCase()}:dog-breed`, 'inherit-items']]) {
    info = describe(header([bad]), ME);
    assert(deepEq(info.problems, ['not-a-coordinate']) && info.pointer === null,
      `AC-2: ${JSON.stringify(bad)} is not a list coordinate → ['not-a-coordinate'], no pointer; got ${JSON.stringify(info)}`);
  }
  for (const [tag, type] of [[['b', SHARED, 'pointer'], 'pointer'], [['b', SHARED], 'pointer'], [['b', SHARED, 'inherit'], 'inherit']]) {
    info = describe(header([tag]), ME);
    assert(deepEq(info.problems, ['wrong-type']) && info.pointer && info.pointer.coord === SHARED && info.pointer.type === type,
      `AC-2 / sub-decision 1: ${JSON.stringify(tag)} → ['wrong-type'], type "${type}" (absent → pointer); got ${JSON.stringify(info)}`);
  }
  info = describe(header([['b', SHARED, 'inherit-items'], ['b', SHARED_2, 'inherit-items']]), ME);
  assert(deepEq(info.problems, ['multiple']) && info.pointer && info.pointer.coord === SHARED,
    `AC-2: two pointers → ['multiple'], the first is followed; got ${JSON.stringify(info)}`);
});

test('U4: describeCurationHeader — b-tag-deferred alone is its own state (never a problem); beside a real pointer the pointer wins (ADR 0003); problems accumulate in a fixed order', async () => {
  const describe = await fn('describeCurationHeader');
  let info = describe(header([['b', 'b-tag-deferred']]), ME);
  assert(info.deferred === true && info.pointer === null && info.problems.length === 0,
    `AC-2: the sentinel alone is "deliberately unaffiliated" — not no-b, not not-a-coordinate; got ${JSON.stringify(info)}`);
  // Re-aimed by my-curated-dlists #3 (ADR 0003 sub-decision 9, amending ADR 0002 sub-decision 2): the
  // house rule — a real b beats a stale sentinel (ui/src/utils/bDisposition.js dispositionOf).
  info = describe(header([['b', 'b-tag-deferred'], ['b', SHARED, 'inherit-items']]), ME);
  assert(info.deferred === false && info.pointer && info.pointer.coord === SHARED && info.problems.length === 0,
    `AC-2 as amended by ADR 0003 sub-decision 9 (story 3 AC-7): beside a real pointer the sentinel is superseded — not deferred, the pointer followed, not "multiple"; got ${JSON.stringify(info)}`);
  info = describe(header([['b', EVENT_ID], ['b', SHARED, 'pointer'], ['b', SHARED_2, 'inherit-items']]), ME);
  assert(deepEq(info.problems, ['not-a-coordinate', 'wrong-type', 'multiple']) && info.pointer.coord === SHARED && info.pointer.type === 'pointer',
    `AC-2 / sub-decision 2: every problem is reported, in the order no-b · not-a-coordinate · wrong-type · multiple, and the first coordinate is followed; got ${JSON.stringify(info)}`);
});

test('U5: describeCurationHeader — authorship is checked, not assumed; garbage yields no pointer and ["no-b"] without throwing', async () => {
  const describe = await fn('describeCurationHeader');
  const good = [['b', SHARED, 'inherit-items']];
  assert(describe(header(good, AUTHOR), ME).authoredByAssistant === false, 'AC-1 / sub-decision 3: a header by someone else is not "authored by your assistant"');
  assert(describe(header(good), ME.toUpperCase()).authoredByAssistant === true, 'sub-decision 3: the assistant pubkey compares lowercased');
  for (const none of [null, undefined, '']) {
    assert(describe(header(good), none).authoredByAssistant === false, `sub-decision 3: no assistant (${JSON.stringify(none)}) → not authored by your assistant`);
  }
  for (const g of [null, undefined, {}, { tags: 'x' }, 42]) {
    let info;
    try { info = describe(g, ME); } catch (e) { throw new Error(`ADR note 1: never throws — threw on ${JSON.stringify(g)}: ${e.message}`); }
    assert(info && info.authoredByAssistant === false && info.pointer === null && info.deferred === false && deepEq(info.problems, ['no-b']),
      `ADR note 1: garbage → { authoredByAssistant: false, pointer: null, deferred: false, problems: ['no-b'] }; got ${JSON.stringify(info)}`);
  }
});

test('U6: curationPointerRow — the pointer becomes the row the story-1 lookup takes, with the community relay as its hint; no pointer → null', async () => {
  const describe = await fn('describeCurationHeader');
  const curationPointerRow = await fn('curationPointerRow');
  const { pointer } = describe(header([['b', SHARED, 'inherit-items']]), ME);
  const r = curationPointerRow(pointer, RELAY);
  assert(r && r.kind === 39998 && r.pubkey === AUTHOR && r.d === 'dog-breed' && r.relay === RELAY && r.coord === SHARED,
    `ADR note 1: { kind, pubkey, d, relay, coord }; got ${JSON.stringify(r)}`);
  for (const none of [null, undefined]) {
    assert(curationPointerRow(none, RELAY) === null, `ADR note 1: no pointer (${none}) → null`);
  }
});

test('U7: the shared header resolves through lookupCurationHeaders — local strfry first, then the community relay; failures read "failed", never "absent"', async () => {
  const describe = await fn('describeCurationHeader');
  const curationPointerRow = await fn('curationPointerRow');
  const lookup = await fn('lookupCurationHeaders');
  const row = curationPointerRow(describe(header([['b', SHARED, 'inherit-items']]), ME).pointer, RELAY);
  const shared = { id: 'c'.repeat(64), kind: 39998, pubkey: AUTHOR, created_at: 1785953708, tags: [['d', 'dog-breed'], ['b', SHARED, 'pointer']], content: '', sig: 'x'.repeat(128) };
  const calls = [];
  let res = await lookup([row], {
    scanLocal: async (f) => { calls.push(['local', f]); return []; },
    fetchRelay: async (f, url) => { calls.push(['relay', f, url]); return { success: true, events: [shared] }; },
  });
  assert(calls[0] && calls[0][0] === 'local' && deepEq(calls[0][1], { kinds: [39998], authors: [AUTHOR], '#d': ['dog-breed'] }),
    `AC-3 / sub-decision 4: this instance's strfry first, by the pointer's coordinate; got ${JSON.stringify(calls[0])}`);
  assert(calls[1] && calls[1][0] === 'relay' && calls[1][2] === RELAY, `AC-3: then the community relay; got ${JSON.stringify(calls[1])}`);
  assert(res[SHARED] && res[SHARED].where === 'relay' && res[SHARED].event === shared && res[SHARED].checkedRelay === RELAY,
    `AC-3 / AC-4: found only on the relay — the import case; got ${JSON.stringify(res[SHARED])}`);
  res = await lookup([row], { scanLocal: async () => [shared], fetchRelay: async () => { throw new Error('must not be called'); } });
  assert(res[SHARED] && res[SHARED].where === 'local', `AC-3 / AC-4: once imported, the re-check finds it locally; got ${JSON.stringify(res[SHARED])}`);
  res = await lookup([row], { scanLocal: async () => [], fetchRelay: async () => ({ success: true, events: [] }) });
  assert(res[SHARED] && res[SHARED].missing === true && res[SHARED].failed === false && res[SHARED].checkedRelay === RELAY,
    `AC-5: not found locally or on the community relay; got ${JSON.stringify(res[SHARED])}`);
  res = await lookup([row], { scanLocal: async () => [], fetchRelay: async () => { throw new Error('offline'); } });
  assert(res[SHARED] && res[SHARED].missing === true && res[SHARED].failed === true, `AC-5: a failed relay step reads "couldn't check"; got ${JSON.stringify(res[SHARED])}`);
});

/* ── S: structure ──────────────────────────────────────────── */

test('S1: the headers module — two titled sections with their states, the pointer line, a sentence per problem, and the deliberately-unaffiliated state', () => {
  const s = src(HEADERS, 'AC-1/2/3/5');
  for (const name of ['AssistantHeaderSection', 'SharedHeaderSection', 'RawEventToggle', 'ImportToLocalButton']) {
    assert(new RegExp(`export\\s+(function|const)\\s+${name}\\b`).test(s), `ADR note 3: named export ${name}`);
  }
  assert(new RegExp(`Your assistant${APOS}s DList header`).test(s) && /Shared DList header/.test(s), 'AC-1 / AC-3: the two section titles');
  assert(new RegExp(`In this instance${APOS}s strfry`).test(s) && new RegExp(`not in this instance${APOS}s strfry`).test(s),
    'AC-1 / AC-3 / AC-4: where each header was found — local, or on a relay and not local');
  assert(/Authored by your assistant/.test(s), 'AC-1: who authored it');
  assert(/Points to/.test(s), 'AC-2: the pointer line (coordinate and type)');
  for (const key of ['no-b', 'not-a-coordinate', 'wrong-type', 'multiple']) {
    assert(new RegExp(`['"]${key}['"]`).test(s), `AC-2 / sub-decision 2: a sentence for the "${key}" problem`);
  }
  assert(/deliberately unaffiliated/i.test(s) && /\.deferred\b/.test(s), 'AC-2: b-tag-deferred shown as "deliberately unaffiliated"');
  assert(/describeHeaderLookup\(/.test(s) && new RegExp(`couldn${APOS}?t check`, 'i').test(s), 'AC-5: not found says where it looked; a failed lookup reads "couldn\'t check"');
  assert(/which shared header/i.test(s), 'AC-5: the shared section says when it can\'t tell which shared header to show');
});

test('S2: the raw-event toggles — one component, closed on every load, not persisted, used by both sections', () => {
  const s = src(HEADERS, 'AC-1/3');
  assert(/useState\(\s*false\s*\)/.test(s), 'AC-1 / AC-3 / sub-decision 7: the toggle starts closed (useState(false))');
  assert(/Show raw event/.test(s) && /Hide raw event/.test(s), 'sub-decision 7: "▸ Show raw event" / "▾ Hide raw event"');
  assert(/JSON\.stringify\(\s*event\s*,\s*null\s*,\s*2\s*\)/.test(s), 'AC-1: the complete event as formatted JSON');
  // Presence only: sections may share one "found" block, so a literal count would over-constrain;
  // that BOTH sections show the toggle is verified live.
  assert(count(s, /<RawEventToggle\b/g) >= 1, 'AC-1 / AC-3: the sections render the raw-event toggle');
  assert(!/localStorage|sessionStorage/.test(s), 'AC-1 / AC-3: "on every load" — the open state is never persisted');
});

test('S3: the Simple Lists link — /tapestry/lists/<encoded coordinate>, shown only when the header is in this instance\'s strfry', () => {
  const s = src(HEADERS, 'AC-1/3');
  assert(/\/tapestry\/lists\/(?:\$\{\s*|['"`]\s*\+\s*)encodeURIComponent\(/.test(s), 'AC-1 / AC-3: the link is /tapestry/lists/ + encodeURIComponent(coordinate)');
  assert(/Open in Simple Lists/.test(s), 'ADR note 3: "Open in Simple Lists →"');
  // Directional only (the gate itself is verified live): the "local" test precedes the link.
  assert(/where\s*===\s*['"]local['"]/.test(s) && /['"]local['"][\s\S]*\/tapestry\/lists\//.test(s),
    'sub-decision 5: the link is gated on where === \'local\'');
});

test('S4: the import — one POST of the event as received ({ event, signAs: \'client\' }) to /api/strfry/publish, then re-check; failure inline; nothing signed', () => {
  const s = src(HEADERS, 'AC-4');
  assert(/fetch\(\s*['"`]\/api\/strfry\/publish['"`]/.test(s) && /method:\s*['"]POST['"]/.test(s), 'AC-4 / ADR note 3: POST /api/strfry/publish');
  assert(/body:\s*JSON\.stringify\(\s*\{\s*event\s*,\s*signAs:\s*['"]client['"]\s*\}\s*\)/.test(s),
    'AC-4 / sub-decision 6: the body is exactly { event, signAs: \'client\' } — the event as received, never rebuilt');
  assert(count(s, /\/api\/strfry\/publish/g) === 1, 'sub-decision 6: exactly one import request in the module');
  assert(!/created_at\s*:/.test(s), 'AC-4: the imported event is not re-stamped or rebuilt');
  assert(/\.success\b/.test(s) && /\.ok\b/.test(s), 'sub-decision 6: success is res.ok && data.success');
  assert(/onImported\(\s*\)/.test(s), 'AC-4 / sub-decision 6: success calls onImported() — the section re-checks');
  assert(/Import to local strfry/.test(s) && /Importing/.test(s) && /Import failed/.test(s), 'AC-4: the control, its busy state, and the inline failure');
  assert(!/signEvent|window\.nostr|finalizeEvent|publishOrThrow|publishEverywhere|publishToRelays|signAs:\s*['"]assistant['"]/.test(s),
    'AC-4: the import signs nothing and publishes nowhere else');
});

test('S5: the detail page — a second lookup for the shared header at the community relay, both before any return, refresh wired to each section', () => {
  const s = src(DETAIL, 'AC-3/4');
  assert(/import\s*\{[^}]*COMMUNITY_RELAYS[^}]*\}\s*from\s*['"]\.\.\/\.\.\/hooks\/useCommunitySharedConcepts['"]/.test(s),
    'AC-3 / sub-decision 4: the community relay the DList Curation panel searches (COMMUNITY_RELAYS)');
  assert(/describeCurationHeader\(/.test(s) && /curationPointerRow\(/.test(s) && /COMMUNITY_RELAYS\[0\]/.test(s),
    'ADR note 4: describeCurationHeader, then curationPointerRow(pointer, COMMUNITY_RELAYS[0])');
  const body = s.slice(Math.max(0, s.search(/export\s+default\s+function\s+CuratedDListDetail\b/)));
  const calls = [...body.matchAll(/useCurationHeaders\(/g)].map((m) => m.index);
  const firstReturn = body.search(/\breturn\s*[(<]/);
  assert(calls.length >= 2, `ADR note 4: two lookups — the assistant's header and the shared header; found ${calls.length}`);
  assert(firstReturn > 0 && calls.every((i) => i < firstReturn), 'rules of hooks: both lookups run before the page\'s first return');
  assert(/\brefresh\b/.test(s) && count(s, /onImported=/g) >= 2, 'AC-4 / ADR note 4: each section gets onImported bound to its own refresh');
  assert(/<AssistantHeaderSection\b/.test(s) && /<SharedHeaderSection\b/.test(s)
    && /import\s*\{[^}]*AssistantHeaderSection[^}]*\}\s*from\s*['"]\.\/CuratedDListHeaders['"]/.test(s),
  'ADR note 4: the two sections from ./CuratedDListHeaders');
  const h = src(HEADERS_HOOK, 'AC-4');
  assert(/\brefresh\b/.test(h) && /nonce/i.test(h), 'ADR note 2: useCurationHeaders returns refresh() backed by a nonce in its effect');
});

test('S6: identity and isolation — the headers module carries no pubkey literal or taPubkey, never decodes the route, and is the only file of the feature that writes', () => {
  const s = src(HEADERS, 'AC-6');
  assert(!/taPubkey/.test(s), 'OPEN.md row 188: never the instance owner\'s key');
  assert(!/[0-9a-fA-F]{64}/.test(s), 'CLAUDE.md (per-deployment TA pubkey): no 64-hex literal');
  assert(!/decodeURIComponent/.test(s), 'ADR 0001 sub-decision 3: nothing decodes the route again');
  for (const f of STORY1_FILES) {
    assert(!/\/api\/strfry\/publish|method:\s*['"]POST['"]/.test(safeRead(f)), `AC-6 / ADR 0002 fact 6: ${rel(f)} stays write-free — the import lives only in CuratedDListHeaders.jsx`);
  }
});

/* ── R: sentinels (pass before and after) ───────────────────── */

test('R1: story 1\'s front door is intact on the detail page', () => {
  const s = safeRead(DETAIL);
  assert(/useParams\(/.test(s) && !/decodeURIComponent/.test(s) && /curatedDListAccess\(/.test(s), 'AC-6: the route id, undecoded, into curatedDListAccess');
  for (const status of ['signed-out', 'no-assistant', 'bad-id', 'checking', 'map-error', 'no-map', 'not-on-map', 'other-pubkey']) {
    assert(new RegExp(`['"]${status}['"]`).test(s), `AC-6: the "${status}" sentence remains`);
  }
  assert(/curated by your assistant/i.test(s) && /['"`]\/tapestry\/grapevine\/curated-dlists['"`]/.test(s), 'AC-6: the heading line and the back link remain');
});

test('R2: the util\'s existing exports and the community relay constant are unchanged', async () => {
  const mod = await util();
  for (const name of ['curatedDListRows', 'parseCuratedDListRouteId', 'curatedDListPath', 'curatedDListAccess', 'lookupCurationHeaders',
    'findDListEntries', 'communityPointerOf', 'describeHeaderLookup', 'markDuplicateEntries']) {
    assert(typeof mod[name] === 'function', `AC-6: ${name} still exported`);
  }
  assert(/export const COMMUNITY_RELAYS = \['wss:\/\/dcosl\.brainstorm\.world'\];/.test(safeRead(COMMUNITY_HOOK)),
    'AC-3: the community relay the DList Curation panel searches is unchanged');
});

test('R3: Simple Lists and the DList Curation panel are untouched', () => {
  const detail = safeRead(DLIST_DETAIL);
  assert(['39998:', '39999:', '9998:', '9999:'].every((p) => detail.includes(`'${p}'`)) && /queryRelay\(/.test(detail),
    'AC-6: the Simple Lists detail route still reads local strfry by coordinate');
  const panel = safeRead(CURATION_PANEL);
  assert(/\/tapestry\/lists\//.test(panel) && !/curated-dlists/.test(panel) && !/CuratedDListHeaders/.test(panel),
    'AC-6: the DList Curation panel still links to Simple Lists and knows nothing of this page');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail, skipped: 0 };
}

module.exports = { run };
