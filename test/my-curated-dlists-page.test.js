/**
 * my-curated-dlists #1: My Curated DLists — the menu item, the list of empowered DLists, and the
 * detail page's front door.
 *
 * Story: engineering-team/stories/my-curated-dlists/1-my-curated-dlists-page.md
 * ADR:   engineering-team/decisions/my-curated-dlists/0001-my-curated-dlists-page.md
 *
 * Three classes (house pattern; ESM behavioral import per test/dlist-curation-map-entries.test.js):
 *   U (behavioral) — the five new pure exports of ui/src/utils/treasureMap.js: curatedDListRows,
 *                    parseCuratedDListRouteId, curatedDListPath, curatedDListAccess, and
 *                    lookupCurationHeaders (driven with fake scanLocal / fetchRelay). FAIL now: the
 *                    exports do not exist (the util loads — R3 exercises its existing exports).
 *   S (structure)  — the nav line, the nested route block, the two pages, the two hooks, and the
 *                    no-write / identity hygiene of the new files. FAIL now: none of it exists.
 *   R (sentinel)   — the other My Grapevine nav items and routes, the util's existing exports, and
 *                    the shipped Treasure Map files keeping their own lookups (migration is OPEN.md
 *                    row 249's, not this story's). PASS before and after.
 *
 * Not covered here: the rendered pages in a browser (the reviewer's Playwright-with-page.route
 * method covers them — the auth stubs, the kind-10040 scan, the header scans, /api/relay/external),
 * and the real strfry scan and relay fetch (their own lanes).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const UI = path.resolve(__dirname, '../ui/src');
const UTIL = path.join(UI, 'utils/treasureMap.js');
const LAYOUT = path.join(UI, 'components/Layout.jsx');
const APP = path.join(UI, 'App.jsx');
const LIST_PAGE = path.join(UI, 'pages/grapevine/MyCuratedDLists.jsx');
const DETAIL_PAGE = path.join(UI, 'pages/grapevine/CuratedDListDetail.jsx');
const MAP_HOOK = path.join(UI, 'hooks/useTreasureMap.js');
const HEADERS_HOOK = path.join(UI, 'hooks/useCurationHeaders.js');
const TA_PAGE = path.join(UI, 'pages/grapevine/TrustedAssertions.jsx');
const TAGS_PANEL = path.join(UI, 'pages/grapevine/TreasureMapTagsPanel.jsx');
const CURATION_PANEL = path.join(UI, 'pages/grapevine/DListCurationPanel.jsx');
const DLIST_DETAIL = path.join(UI, 'pages/lists/DListDetail.jsx');
const NEW_FILES = [LIST_PAGE, DETAIL_PAGE, MAP_HOOK, HEADERS_HOOK];

const ME = 'a'.repeat(64);                        // the signed-in user's own assistant
const OTHER = '0123456789abcdef'.repeat(4);       // some other pubkey
const OTHER_UP = OTHER.toUpperCase();
const RELAY = 'wss://dcosl.brainstorm.world';
const LIST_BASE = '/tapestry/grapevine/curated-dlists/';

// A Map carrying every shape the page must handle (AC-3): two non-DList entries, three distinct
// lists (one kind 39999 with a colon in its d-tag), the reserved blanket designation, two later
// duplicates of dog-breed (the first names someone else), and a delegate-less row.
const TAGS = [
  ['30382:rank', OTHER, 'wss://nip85.example'],
  ['30392', ME, RELAY],
  ['39998:dog-breed', ME, RELAY],
  ['39998:cats', OTHER, RELAY],
  ['39999:a:b', ME, ''],
  ['39998:dlist-header', ME, RELAY],
  ['39998:dog-breed', OTHER, RELAY],
  ['39998:dog-breed', ME, RELAY],
  ['39998:no-delegate', 'not-hex', RELAY],
];

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
  assert(typeof mod[name] === 'function', `ui/src/utils/treasureMap.js must export ${name} (ADR 0001 §Implementation 1)`);
  return mod[name];
}
function src(p, what) {
  const s = safeRead(p);
  assert(s.length > 0, `${what}: ${rel(p)} must exist (ADR 0001 §Implementation notes)`);
  return s;
}
// Header-lookup fixtures.
function ev(kind, pubkey, d, createdAt) {
  return { id: `${kind}-${pubkey.slice(0, 4)}-${d}-${createdAt}`, kind, pubkey, created_at: createdAt, tags: [['d', d]] };
}
function row(kind, pubkey, d, relay = null) { return { kind, d, pubkey, relay, coord: `${kind}:${pubkey}:${d}` }; }
function isMissing(r, checkedRelay, failed) {
  return !!r && r.missing === true && !r.event && r.checkedRelay === checkedRelay && r.failed === failed;
}

const tests = [];
function test(name, f) { tests.push({ name, fn: f }); }

/* ── U: the pure functions ─────────────────────────────────── */

test('U1: curatedDListRows — one row per empowered DList in Map order, with kind, d-tag, pubkey, relay hint, coordinate, and route id', async () => {
  const curatedDListRows = await fn('curatedDListRows');
  const rows = curatedDListRows(TAGS, ME);
  assert(Array.isArray(rows), 'AC-3: returns an array');
  assert(deepEq(rows.map((r) => r.routeId), ['39998:dog-breed', '39998:cats', '39999:a:b']),
    `AC-3: one row per distinct list, in Map order — dog-breed, cats, a:b; got ${JSON.stringify(rows.map((r) => r.routeId))}`);
  const [dog, cats, ab] = rows;
  assert(dog.kind === 39998 && dog.d === 'dog-breed' && dog.pubkey === ME && dog.relay === RELAY,
    `AC-3: the dog-breed row carries kind, d-tag, pubkey, and relay hint; got ${JSON.stringify(dog)}`);
  assert(dog.coord === `39998:${ME}:dog-breed`, `ADR note 1: coord = <kind>:<pubkey>:<d>; got ${dog.coord}`);
  assert(cats.pubkey === OTHER && cats.coord === `39998:${OTHER}:cats`, `AC-3: another pubkey's list is a row too; got ${JSON.stringify(cats)}`);
  assert(ab.kind === 39999 && ab.d === 'a:b' && ab.relay === null,
    `AC-3: kind 39999 is listed; the d-tag keeps its colon; an empty hint reads as null; got ${JSON.stringify(ab)}`);
});

test('U2: curatedDListRows — when a list is named twice the first entry counts and the row counts the ignored duplicates', async () => {
  const curatedDListRows = await fn('curatedDListRows');
  const [dog, cats, ab] = curatedDListRows(TAGS, ME);
  assert(dog && dog.ignoredDuplicates === 2, `AC-3: dog-breed appears three times — two ignored; got ${dog && dog.ignoredDuplicates}`);
  assert(cats && cats.ignoredDuplicates === 0 && ab && ab.ignoredDuplicates === 0, 'AC-3: lists named once have no ignored duplicates');
  const firstWins = curatedDListRows([['39998:x', OTHER, RELAY], ['39998:x', ME, RELAY]], ME);
  assert(firstWins.length === 1 && firstWins[0].pubkey === OTHER && firstWins[0].mine === false && firstWins[0].ignoredDuplicates === 1,
    `AC-3 / ADR dlist-curation/0002 §5: the first entry decides, even when a later one names my assistant; got ${JSON.stringify(firstWins)}`);
  const kinds = curatedDListRows([['39998:x', ME, ''], ['39999:x', ME, '']], ME);
  assert(kinds.length === 2 && kinds.every((r) => r.ignoredDuplicates === 0), 'AC-3: 39998:x and 39999:x are different lists, not duplicates');
});

test('U3: curatedDListRows — "mine" means the signed-in user\'s own assistant; non-DList entries never appear; garbage never throws', async () => {
  const curatedDListRows = await fn('curatedDListRows');
  assert(deepEq(curatedDListRows(TAGS, ME).map((r) => r.mine), [true, false, true]),
    'AC-4: rows naming my assistant are mine; the row naming another pubkey is not');
  assert(deepEq(curatedDListRows(TAGS, ME.toUpperCase()).map((r) => r.mine), [true, false, true]),
    'ADR sub-decision 2: the assistant pubkey is compared lowercased');
  const upper = curatedDListRows([['39998:x', OTHER_UP, '']], OTHER);
  assert(upper.length === 1 && upper[0].mine === true && upper[0].pubkey === OTHER,
    'ADR sub-decision 2: an entry written in uppercase hex is still mine (delegates are lowercased)');
  for (const none of [null, undefined, '']) {
    assert(curatedDListRows(TAGS, none).every((r) => r.mine === false),
      `AC-4: with no assistant (${JSON.stringify(none)}) nothing is mine`);
  }
  const ids = curatedDListRows(TAGS, ME).map((r) => r.routeId);
  assert(!ids.includes('39998:dlist-header'), 'AC-3: the reserved blanket designation is not a curated DList');
  assert(!ids.includes('39998:no-delegate'), 'AC-3: a row without a valid delegate is no entry');
  assert(!ids.some((id) => id.startsWith('30382') || id.startsWith('30392')), 'AC-3: Trusted Assertion and Trusted List entries are not DLists');
  for (const g of [null, undefined, 'x', 42, [null], [[]], [[42, ME]], [['39998:x']]]) {
    let out;
    try { out = curatedDListRows(g, ME); } catch (e) { throw new Error(`ADR note 1: never throws — threw on ${JSON.stringify(g)}: ${e.message}`); }
    assert(Array.isArray(out) && out.length === 0, `ADR note 1: garbage → []; got ${JSON.stringify(out)} for ${JSON.stringify(g)}`);
  }
});

test('U4: parseCuratedDListRouteId — "<kind>:<d>" for kinds 39998/39999 (split at the first colon); anything else is null', async () => {
  const parse = await fn('parseCuratedDListRouteId');
  assert(deepEq(parse('39998:dog-breed'), { kind: 39998, d: 'dog-breed' }), `AC-5: 39998:dog-breed parses; got ${JSON.stringify(parse('39998:dog-breed'))}`);
  assert(deepEq(parse('39999:a:b'), { kind: 39999, d: 'a:b' }), `AC-5: split at the first colon only; got ${JSON.stringify(parse('39999:a:b'))}`);
  for (const bad of ['39998:dlist-header', '30392:x', '39998:', '39998', 'dog-breed', '', ' 39998:x', null, undefined, 42, {}]) {
    let out;
    try { out = parse(bad); } catch (e) { throw new Error(`ADR note 1: never throws — threw on ${JSON.stringify(bad)}: ${e.message}`); }
    assert(out === null, `AC-5: ${JSON.stringify(bad)} is not a curated-DList address → null; got ${JSON.stringify(out)}`);
  }
});

test('U5: curatedDListPath — one encoded path segment that the router decodes back to the route id (colons, slashes, percent signs, spaces)', async () => {
  const curatedDListPath = await fn('curatedDListPath');
  const parse = await fn('parseCuratedDListRouteId');
  assert(curatedDListPath('39998:dog-breed') === `${LIST_BASE}39998%3Adog-breed`,
    `ADR sub-decision 3: the detail URL; got ${curatedDListPath('39998:dog-breed')}`);
  for (const d of ['a:b', 'x/y', '50%', 'two words', 'ünï']) {
    const routeId = `39998:${d}`;
    const p = curatedDListPath(routeId);
    assert(typeof p === 'string' && p.startsWith(LIST_BASE), `ADR sub-decision 3: the path lives under ${LIST_BASE}; got ${p}`);
    const seg = p.slice(LIST_BASE.length);
    assert(!seg.includes('/'), `ADR sub-decision 3: "${d}" must stay one path segment; got ${seg}`);
    const decoded = decodeURIComponent(seg); // what React Router hands useParams (ADR fact 6)
    assert(decoded === routeId, `ADR sub-decision 3: the router's decode returns the route id; got ${decoded}`);
    assert(deepEq(parse(decoded), { kind: 39998, d }), `AC-5: the decoded id parses back to d-tag "${d}"`);
  }
});

test('U6: curatedDListAccess — the detail page opens only a list on the viewer\'s own Map that names the viewer\'s own assistant, and otherwise names the case', async () => {
  const access = await fn('curatedDListAccess');
  const base = { signedIn: true, authLoading: false, assistantPubkey: ME, mapStatus: 'found', tags: TAGS, id: '39998:dog-breed' };
  const acc = (over) => access({ ...base, ...over });
  let r = acc({});
  assert(r && r.status === 'ok' && r.row && r.row.routeId === '39998:dog-breed' && r.row.mine === true,
    `AC-5: my assistant's list on my Map opens; got ${JSON.stringify(r)}`);
  assert(acc({ id: '39999:a:b' }).status === 'ok', 'AC-5: kind-39999 lists open too');
  // Auth first: while it resolves nothing is known — never the signed-out sentence (ADR note 4).
  assert(acc({ authLoading: true, signedIn: false }).status === 'checking', 'ADR sub-decision 4 / note 4: auth still loading → checking, never signed-out');
  assert(acc({ signedIn: false }).status === 'signed-out', 'AC-5: signed out');
  assert(acc({ signedIn: false, assistantPubkey: null, id: 'garbage', mapStatus: 'error' }).status === 'signed-out',
    'ADR sub-decision 4: signed-out outranks every later case');
  for (const none of [null, undefined, '']) {
    assert(acc({ assistantPubkey: none }).status === 'no-assistant', `AC-5: no assistant on this instance (${JSON.stringify(none)})`);
  }
  assert(acc({ assistantPubkey: null, id: 'garbage', mapStatus: 'loading' }).status === 'no-assistant',
    'ADR sub-decision 4: no-assistant outranks a bad id and the Map states');
  for (const id of ['garbage', '39998:dlist-header', '30392:x', '', undefined]) {
    assert(acc({ id }).status === 'bad-id', `ADR sub-decision 4: ${JSON.stringify(id)} is not a curated-DList address → bad-id`);
  }
  assert(acc({ id: 'garbage', mapStatus: 'loading' }).status === 'bad-id', 'ADR sub-decision 4: bad-id outranks the Map states');
  for (const s of ['loading', 'idle']) {
    assert(acc({ mapStatus: s, tags: [] }).status === 'checking',
      `AC-2 / ADR sub-decision 4: a Map lookup still "${s}" is checking — never "not on your Map"`);
  }
  assert(acc({ mapStatus: 'error', tags: [] }).status === 'map-error', 'AC-2: a failed Map lookup is an error, never "not on your Map"');
  assert(acc({ mapStatus: 'none', tags: [] }).status === 'no-map', 'AC-2: no Treasure Map found');
  r = acc({ id: '39998:unknown' });
  assert(r.status === 'not-on-map' && r.row === null, `AC-5: a list not on my Map; got ${JSON.stringify(r)}`);
  assert(acc({ id: '39998:Dog-Breed' }).status === 'not-on-map', 'AC-5: d-tags match exactly (case matters)');
  assert(acc({ id: '39999:dog-breed' }).status === 'not-on-map', 'AC-5: the kind is part of the list address');
  r = acc({ id: '39998:cats' });
  assert(r.status === 'other-pubkey' && r.row && r.row.pubkey === OTHER,
    `AC-5: empowered for another pubkey — the row is returned so the page can name it; got ${JSON.stringify(r)}`);
  assert(acc({ tags: [['39998:x', OTHER, RELAY], ['39998:x', ME, RELAY]], id: '39998:x' }).status === 'other-pubkey',
    'AC-5 / ADR sub-decision 1: the first entry decides — a later entry naming me does not open it');
  assert(acc({ tags: [['39998:x', ME, RELAY], ['39998:x', OTHER, RELAY]], id: '39998:x' }).status === 'ok',
    'AC-5 / ADR sub-decision 1: first entry mine, later duplicate someone else → ok');
  assert(acc({ tags: null, id: '39998:x' }).status === 'not-on-map', 'ADR note 1: a Map with no tags has no lists');
  for (const g of [undefined, null, {}, { tags: 'x' }]) {
    let out;
    try { out = access(g); } catch (e) { throw new Error(`ADR note 1: never throws — threw on ${JSON.stringify(g)}: ${e.message}`); }
    assert(out && typeof out.status === 'string', `ADR note 1: garbage still yields a status; got ${JSON.stringify(out)}`);
  }
});

test('U7: lookupCurationHeaders — local strfry first, one scan per (kind, pubkey), newest header per coordinate; no relay call for what was found', async () => {
  const lookup = await fn('lookupCurationHeaders');
  const rows = [row(39998, ME, 'dogs', RELAY), row(39998, ME, 'cats', RELAY), row(39999, ME, 'birds', RELAY), row(39998, OTHER, 'fish', RELAY)];
  const scans = []; const relayCalls = [];
  const scanLocal = async (filter) => {
    scans.push(filter);
    const out = [];
    if (filter.kinds[0] === 39998 && filter.authors[0] === ME) out.push(ev(39998, ME, 'dogs', 100), ev(39998, ME, 'dogs', 200), ev(39998, ME, 'cats', 150));
    if (filter.kinds[0] === 39999 && filter.authors[0] === ME) out.push(ev(39999, ME, 'birds', 50));
    if (filter.authors[0] === OTHER) out.push(ev(39998, OTHER, 'fish', 70));
    return out;
  };
  const fetchRelay = async (filter, url) => { relayCalls.push({ filter, url }); return { success: true, events: [] }; };
  const res = await lookup(rows, { scanLocal, fetchRelay });
  assert(scans.length === 3, `ADR sub-decision 6: one local scan per (kind, pubkey) group — 3 groups; got ${scans.length}`);
  assert(scans.every((f) => Array.isArray(f.kinds) && f.kinds.length === 1 && Array.isArray(f.authors) && f.authors.length === 1 && Array.isArray(f['#d'])),
    `ADR note 1: each scan filters one kind, one author, and the group's d-tags; got ${JSON.stringify(scans)}`);
  const g = scans.find((f) => f.kinds[0] === 39998 && f.authors[0] === ME);
  assert(g && deepEq([...g['#d']].sort(), ['cats', 'dogs']), `ADR note 1: the (39998, me) scan asks for both d-tags; got ${JSON.stringify(g)}`);
  const dogs = res && res[`39998:${ME}:dogs`];
  assert(dogs && dogs.event && dogs.event.created_at === 200 && dogs.where === 'local' && dogs.checkedRelay === null,
    `AC-3: found locally, newest version wins; got ${JSON.stringify(dogs)}`);
  for (const c of [`39998:${ME}:cats`, `39999:${ME}:birds`, `39998:${OTHER}:fish`]) {
    assert(res[c] && res[c].where === 'local' && res[c].event, `AC-3: ${c} found locally`);
  }
  assert(relayCalls.length === 0, `ADR sub-decision 6: the relay hint is consulted only for what is still missing; got ${relayCalls.length} relay calls`);
});

test('U8: lookupCurationHeaders — a header missing locally is fetched from the entry\'s ws/wss hint only; only the matching kind, author, and d-tag count', async () => {
  const lookup = await fn('lookupCurationHeaders');
  const rows = [
    row(39998, ME, 'on-relay', RELAY),
    row(39998, ME, 'nowhere', RELAY),
    row(39998, ME, 'no-hint', null),
    row(39998, ME, 'https-hint', 'https://example.com'),
    row(39998, ME, 'noise', 'ws://relay.example'),
  ];
  const relayCalls = [];
  const fetchRelay = async (filter, url) => {
    relayCalls.push({ filter, url });
    const d = filter['#d'][0];
    if (d === 'on-relay') return { success: true, events: [ev(39998, ME, 'on-relay', 10), ev(39998, ME, 'on-relay', 30), ev(39998, OTHER, 'on-relay', 99), ev(39999, ME, 'on-relay', 99)] };
    if (d === 'noise') return { success: true, events: [ev(39998, OTHER, 'noise', 5), ev(39998, ME, 'other-d', 5)] };
    return { success: true, events: [] };
  };
  const res = await lookup(rows, { scanLocal: async () => [], fetchRelay });
  assert(deepEq(relayCalls.map((c) => c.filter['#d'][0]).sort(), ['noise', 'nowhere', 'on-relay']),
    `ADR sub-decision 6: only rows with a ws/wss hint reach the relay; got ${JSON.stringify(relayCalls.map((c) => c.filter['#d'][0]))}`);
  const onRelay = relayCalls.find((c) => c.filter['#d'][0] === 'on-relay');
  assert(deepEq(onRelay.filter, { kinds: [39998], authors: [ME], '#d': ['on-relay'] }) && onRelay.url === RELAY,
    `ADR note 1: the relay filter and URL; got ${JSON.stringify(onRelay)}`);
  const found = res[`39998:${ME}:on-relay`];
  assert(found && found.where === 'relay' && found.checkedRelay === RELAY && found.event && found.event.created_at === 30 && found.event.pubkey === ME && found.event.kind === 39998,
    `AC-3: found at the hint — the newest event with the row's kind, author, and d-tag; got ${JSON.stringify(found)}`);
  assert(isMissing(res[`39998:${ME}:nowhere`], RELAY, false), `AC-3: absent locally and at the hint; got ${JSON.stringify(res[`39998:${ME}:nowhere`])}`);
  assert(isMissing(res[`39998:${ME}:no-hint`], null, false), `AC-3: no hint → not found, nothing fetched; got ${JSON.stringify(res[`39998:${ME}:no-hint`])}`);
  assert(isMissing(res[`39998:${ME}:https-hint`], null, false), `ADR sub-decision 6: a non-ws hint is not fetched; got ${JSON.stringify(res[`39998:${ME}:https-hint`])}`);
  assert(isMissing(res[`39998:${ME}:noise`], 'ws://relay.example', false),
    `ADR note 1: another author's event or another d-tag is not the header; got ${JSON.stringify(res[`39998:${ME}:noise`])}`);
});

test('U9: lookupCurationHeaders — a failed step is marked failed (never read as "absent"), a hint can still rescue a failed local scan, and the lookup never rejects', async () => {
  const lookup = await fn('lookupCurationHeaders');
  const rows = [
    row(39998, ME, 'rescued', RELAY),
    row(39998, ME, 'stranded', null),
    row(39998, ME, 'unproven', RELAY),
    row(39999, OTHER, 'relay-throws', RELAY),
    row(39999, OTHER, 'relay-unsuccessful', 'wss://down.example'),
  ];
  const scanLocal = async (filter) => { if (filter.authors[0] === ME) throw new Error('strfry scan failed'); return []; };
  const fetchRelay = async (filter) => {
    const d = filter['#d'][0];
    if (d === 'rescued') return { success: true, events: [ev(39998, ME, 'rescued', 1)] };
    if (d === 'relay-throws') throw new Error('network');
    if (d === 'relay-unsuccessful') return { success: false, events: [], error: 'boom' };
    return { success: true, events: [] };
  };
  let res;
  try { res = await lookup(rows, { scanLocal, fetchRelay }); } catch (e) { throw new Error(`ADR note 1: never rejects — rejected with ${e.message}`); }
  assert(res[`39998:${ME}:rescued`] && res[`39998:${ME}:rescued`].where === 'relay',
    `ADR sub-decision 6: a failed local scan does not hide a header the hint has; got ${JSON.stringify(res[`39998:${ME}:rescued`])}`);
  assert(isMissing(res[`39998:${ME}:stranded`], null, true), `ADR sub-decision 6: local scan failed, no hint → failed; got ${JSON.stringify(res[`39998:${ME}:stranded`])}`);
  assert(isMissing(res[`39998:${ME}:unproven`], RELAY, true),
    `ADR sub-decision 6: absence is not established when the local scan failed → failed; got ${JSON.stringify(res[`39998:${ME}:unproven`])}`);
  assert(isMissing(res[`39999:${OTHER}:relay-throws`], RELAY, true), `ADR sub-decision 6: the relay fetch threw → failed; got ${JSON.stringify(res[`39999:${OTHER}:relay-throws`])}`);
  assert(isMissing(res[`39999:${OTHER}:relay-unsuccessful`], 'wss://down.example', true),
    `ADR sub-decision 6: an unsuccessful relay response → failed; got ${JSON.stringify(res[`39999:${OTHER}:relay-unsuccessful`])}`);
  const allFail = await lookup([row(39998, ME, 'x', RELAY)], { scanLocal: async () => { throw new Error('x'); }, fetchRelay: async () => { throw new Error('y'); } });
  assert(isMissing(allFail[`39998:${ME}:x`], RELAY, true), 'ADR note 1: both steps failing still resolves, the row marked failed');
  let called = false;
  const spy = { scanLocal: async () => { called = true; return []; }, fetchRelay: async () => { called = true; return { success: true, events: [] }; } };
  for (const empty of [[], null, undefined]) {
    const out = await lookup(empty, spy);
    assert(out && typeof out === 'object' && Object.keys(out).length === 0, `ADR note 1: no rows → {}; got ${JSON.stringify(out)} for ${JSON.stringify(empty)}`);
  }
  assert(!called, 'ADR note 1: no rows → no scan and no fetch');
});

/* ── S: structure ──────────────────────────────────────────── */

test('S1: the menu — "My Curated DLists" sits directly below "TA Treasure Map" under My Grapevine, with no end flag', () => {
  const s = src(LAYOUT, 'AC-1');
  assert(/\{\s*to:\s*['"]\/tapestry\/grapevine\/treasure-map['"],\s*label:\s*['"]TA Treasure Map['"]\s*\},\s*\{\s*to:\s*['"]\/tapestry\/grapevine\/curated-dlists['"],\s*label:\s*['"]My Curated DLists['"]\s*\}/.test(s),
    'AC-1 / ADR note 7: { to: \'/tapestry/grapevine/curated-dlists\', label: \'My Curated DLists\' } directly after the TA Treasure Map item, no `end`');
});

test('S2: the routes — a nested curated-dlists block after treasure-map: the list page at the index (crumb "My Curated DLists") and the detail page at :id', () => {
  const s = src(APP, 'AC-1');
  assert(/import\s+MyCuratedDLists\s+from\s+['"]\.\/pages\/grapevine\/MyCuratedDLists['"]/.test(s), 'ADR note 6: App.jsx imports the list page');
  assert(/import\s+CuratedDListDetail\s+from\s+['"]\.\/pages\/grapevine\/CuratedDListDetail['"]/.test(s), 'ADR note 6: App.jsx imports the detail page');
  const at = (re) => { const m = s.match(re); return m ? m.index : -1; };
  const tm = at(/path:\s*['"]treasure-map['"]/);
  const cd = at(/path:\s*['"]curated-dlists['"]/);
  const as = at(/path:\s*['"]assertions['"]/);
  assert(cd > 0, 'AC-1: a route with path \'curated-dlists\'');
  assert(tm >= 0 && as > 0 && tm < cd && cd < as, 'ADR note 6: the curated-dlists block sits directly after treasure-map in the grapevine children');
  const block = s.slice(cd, as);
  assert(/crumb:\s*['"]My Curated DLists['"]/.test(block), 'AC-1: the breadcrumb crumb "My Curated DLists" (the page ends My Grapevine › My Curated DLists)');
  assert(/index:\s*true[^}]*element:\s*<MyCuratedDLists\s*\/>/.test(block), 'ADR note 6: the list page is the index child');
  assert(/path:\s*['"]:id['"][^}]*element:\s*<CuratedDListDetail\s*\/>/.test(block), 'ADR note 6: the detail page is the :id child');
  assert(/crumb:\s*['"]Detail['"]/.test(block), 'ADR sub-decision 8: the detail crumb "Detail"');
});

test('S3: the list page — my own Map and my own assistant, honest states, one row per list, links only on my assistant\'s rows', () => {
  const s = src(LIST_PAGE, 'AC-2/3/4');
  assert(/export\s+default\s+function\s+MyCuratedDLists\b/.test(s), 'ADR note 4: default export MyCuratedDLists');
  assert(/<Breadcrumbs\b/.test(s) && /My Curated DLists/.test(s), 'AC-1: the page titles itself and renders the breadcrumb');
  assert(/\{[^}]*\bloading\b[^}]*\}\s*=\s*useAuth\(\)/.test(s), 'ADR note 4: reads useAuth().loading — no sign-in flash while auth resolves');
  assert(/assistantPubkey/.test(s) && !/taPubkey/.test(s), 'AC-4 / ADR sub-decision 2: "mine" is user.assistantPubkey, never taPubkey (OPEN.md row 188)');
  assert(/sign in/i.test(s), 'AC-2: the signed-out prompt');
  assert(/useTreasureMap\(/.test(s) && /\.pubkey\b/.test(s), 'AC-2 / ADR note 4: the Map lookup for the signed-in user\'s pubkey');
  assert(/No Treasure Map found/i.test(s) && /\/tapestry\/grapevine\/treasure-map/.test(s),
    'AC-2: no Map → says so, names where it looked, links to TA Treasure Map');
  assert(/curatedDListRows\([^)]*assistantPubkey/.test(s), 'AC-3 / ADR note 4: rows from curatedDListRows(…, assistantPubkey)');
  assert(/empowers no DLists/i.test(s) && /DList Curation/.test(s), 'AC-3: empty state points to the DList Curation panel');
  assert(/useCurationHeaders\(/.test(s) && /['"]names['"]/.test(s), 'AC-3 / ADR sub-decision 7: names from the looked-up header\'s names tag');
  assert(/describeHeaderLookup\(/.test(s) && /couldn.?t check/i.test(s), 'AC-3 / ADR note 4: "header not found" with where it looked; "couldn\'t check" when failed');
  assert(/your assistant/i.test(s) && /another pubkey/i.test(s), 'AC-3: who is empowered — your assistant / another pubkey');
  assert(/\.relay\b/.test(s) && /ignoredDuplicates/.test(s) && /duplicate/i.test(s), 'AC-3: the relay hint and the ignored-duplicate note');
  assert(/curatedDListPath\([^)]*routeId/.test(s) && /\bmine\b[\s\S]{0,400}curatedDListPath\(/.test(s),
    'AC-4 / ADR note 4: rows link to curatedDListPath(row.routeId) only when mine');
  assert(/own assistant curates open here/i.test(s), 'AC-4: non-mine rows say why they do not open');
  assert(/Tapestry Assistant on this instance/i.test(s), 'AC-4: a user with no assistant sees a line saying so');
});

test('S4: the detail page — the route id as the router decoded it, one front-door decision, a sentence per case, and the list identified when it opens', () => {
  const s = src(DETAIL_PAGE, 'AC-5');
  assert(/export\s+default\s+function\s+CuratedDListDetail\b/.test(s), 'ADR note 5: default export CuratedDListDetail');
  assert(/useParams\(/.test(s) && !/decodeURIComponent/.test(s), 'ADR sub-decision 3: useParams().id is already decoded — never decodeURIComponent');
  assert(/curatedDListAccess\(/.test(s) && /useTreasureMap\(/.test(s), 'AC-5 / ADR note 5: useTreasureMap + curatedDListAccess');
  assert(/\{[^}]*\bloading\b[^}]*\}\s*=\s*useAuth\(\)/.test(s), 'ADR note 5: reads useAuth().loading');
  assert(/assistantPubkey/.test(s) && !/taPubkey/.test(s), 'AC-5 / ADR sub-decision 2: the viewer\'s own assistant, never taPubkey');
  for (const status of ['signed-out', 'no-assistant', 'bad-id', 'checking', 'map-error', 'no-map', 'not-on-map', 'other-pubkey']) {
    assert(new RegExp(`['"]${status}['"]`).test(s), `AC-5 / ADR note 5: a sentence for the "${status}" case`);
  }
  assert(/sign in/i.test(s) && /Tapestry Assistant on this instance/i.test(s) && /not on your Treasure Map/i.test(s) && /another pubkey/i.test(s) && /No Treasure Map found/i.test(s),
    'AC-5: the case sentences — signed out · no assistant · not on your Map · another pubkey · no Map');
  assert(/curated by your assistant/i.test(s) && /useCurationHeaders\(/.test(s) && /['"]names['"]/.test(s),
    'AC-5 / ADR note 5: the open list is identified — name from the header, curated by your assistant');
  assert(/['"`]\/tapestry\/grapevine\/curated-dlists['"`]/.test(s) && /<Breadcrumbs\b/.test(s), 'AC-5: the link back to My Curated DLists');
});

test('S5: the hooks — useTreasureMap looks where the Treasure Map page looks and waits for the relay list; useCurationHeaders binds the pure lookup to strfry and the relay endpoint', () => {
  const m = src(MAP_HOOK, 'AC-2');
  assert(/export\s+(default\s+)?function\s+useTreasureMap\b|export\s+default\s+useTreasureMap\b/.test(m), 'ADR note 2: exports useTreasureMap');
  assert(/queryRelay\(/.test(m) && /10040/.test(m) && /limit:\s*1\b/.test(m), 'AC-2 / ADR sub-decision 5: local strfry first — kind 10040, limit 1');
  assert(/general purpose relays/.test(m) && /websocketUrl/.test(m), 'AC-2 / ADR note 2: the same general-purpose relay list as the Treasure Map page');
  assert(/\{[^}]*\bloading\b[^}]*\}\s*=\s*useCypher\(/.test(m) && /\{[^}]*\berror\b[^}]*\}\s*=\s*useCypher\(/.test(m),
    'ADR sub-decision 5: reads the relay-list query\'s loading and error — waits for it, reports its failure');
  assert(/\/api\/relay\/external/.test(m) && /\.success\b/.test(m), 'AC-2 / ADR sub-decision 5: the relay step, an unsuccessful response is an error');
  for (const status of ['idle', 'loading', 'found', 'none', 'error']) {
    assert(new RegExp(`['"]${status}['"]`).test(m), `ADR note 2: status "${status}"`);
  }
  const h = src(HEADERS_HOOK, 'AC-3');
  assert(/export\s+(default\s+)?function\s+useCurationHeaders\b|export\s+default\s+useCurationHeaders\b/.test(h), 'ADR note 3: exports useCurationHeaders');
  assert(/lookupCurationHeaders/.test(h) && /queryRelay/.test(h) && /\/api\/relay\/external/.test(h),
    'ADR note 3: wraps lookupCurationHeaders with queryRelay and /api/relay/external');
});

test('S6: nothing is written and no identity is hardcoded — the new files sign nothing, publish nothing, and carry no pubkey literal', () => {
  for (const f of NEW_FILES) {
    const s = src(f, 'AC-6');
    assert(!/signEvent|window\.nostr|publishOrThrow|publishEverywhere|publishToRelays|\/api\/strfry\/publish|method:\s*['"]POST['"]/.test(s),
      `AC-6: ${rel(f)} must not sign or publish anything`);
    assert(!/taPubkey/.test(s), `AC-4 / ADR sub-decision 2: ${rel(f)} must not use taPubkey (OPEN.md row 188)`);
    assert(!/[0-9a-fA-F]{64}/.test(s), `CLAUDE.md (per-deployment TA pubkey): ${rel(f)} must not carry a 64-hex literal`);
  }
});

/* ── R: sentinels (pass before and after) ───────────────────── */

test('R1: every other My Grapevine menu item keeps its label, order, and target', () => {
  const s = safeRead(LAYOUT);
  const items = [
    "{ to: '/tapestry/grapevine/treasure-map', label: 'TA Treasure Map' }",
    "{ to: '/tapestry/grapevine/assertions', label: 'Trusted Assertions' }",
    "{ to: '/tapestry/grapevine/trusted-lists', label: 'Trusted Lists' }",
    "{ to: '/tapestry/grapevine/trust-determination', label: 'Trust Determination' }",
    "{ to: '/tapestry/grapevine/search-preferences', label: 'Search Preferences' }",
    "{ to: '/tapestry/grapevine/meilisearch', label: 'Meilisearch' }",
  ];
  const idx = items.map((i) => s.indexOf(i));
  assert(idx.every((i) => i >= 0), `AC-1: each existing My Grapevine item is intact; missing: ${JSON.stringify(items.filter((_, k) => idx[k] < 0))}`);
  assert(idx.every((v, k) => k === 0 || idx[k - 1] < v), 'AC-1: the existing items keep their order');
  assert(/label:\s*'🍇 My Grapevine',\s*prefix:\s*'\/tapestry\/grapevine'/.test(s), 'AC-1: the group label and prefix are intact');
});

test('R2: the existing grapevine routes are intact', () => {
  const s = safeRead(APP);
  for (const line of [
    "{ path: 'treasure-map', element: <TrustedAssertions />, handle: { crumb: 'TA Treasure Map' } }",
    "{ path: 'assertions', element: <TrustedAssertionsList />, handle: { crumb: 'Trusted Assertions' } }",
    "{ path: 'trust-determination', element: <TrustDetermination />, handle: { crumb: 'Trust Determination' } }",
    "{ path: 'trusted-lists', element: <TrustedLists />, handle: { crumb: 'Trusted Lists' } }",
    "{ path: 'trusted-lists/:dTag', element: <TrustedListDetail />, handle: { crumb: 'Detail' } }",
    "{ path: 'search-preferences', element: <SearchPreferences />, handle: { crumb: 'Search Preferences' } }",
    "{ path: 'meilisearch', element: <MeilisearchAdmin />, handle: { crumb: 'Meilisearch' } }",
  ]) {
    assert(s.includes(line), `AC-1 / AC-6: route intact — ${line}`);
  }
  assert(/path:\s*'grapevine',\s*handle:\s*\{\s*crumb:\s*'My Grapevine'\s*\}/.test(s), 'AC-1: the My Grapevine crumb the breadcrumb starts from');
});

test('R3: the util\'s existing exports are unchanged', async () => {
  const mod = await util();
  for (const name of ['classifyEntry', 'findGenericTlDelegation', 'describeTlDelegation', 'composeManualUpdate', 'upsertGenericTlTag',
    'findDListEntries', 'upsertDListEntry', 'removeDListEntry', 'describeDListCuration', 'markDuplicateEntries', 'communityPointerOf',
    'describeHeaderLookup', 'buildPresenceTargets', 'compareMapVersions', 'summarizePresence', 'planRelaySync']) {
    assert(typeof mod[name] === 'function', `AC-6: ${name} still exported`);
  }
});

test('R4: the shipped Treasure Map files keep their own lookups and links — no migration in this story (OPEN.md row 249)', () => {
  const page = safeRead(TA_PAGE); const at = (n) => page.indexOf(n);
  assert(at('<TreasureMapTagsPanel') < at('Show raw event') && at('Show raw event') < at('<TlOptInCard') && at('<TlOptInCard') < at('<DListCurationPanel') && at('<DListCurationPanel') < at('<TreasureMapManualEdit'),
    'AC-6: the Treasure Map page order is intact');
  assert(/general purpose relays/.test(page) && /\/api\/relay\/external/.test(page) && !/useTreasureMap/.test(page),
    'AC-6 / ADR Consequences: the Treasure Map page keeps its own Map lookup (moving it onto useTreasureMap is row 249\'s)');
  const tags = safeRead(TAGS_PANEL);
  assert(/queryRelay\(/.test(tags) && /\/api\/relay\/external/.test(tags) && !/lookupCurationHeaders|useCurationHeaders/.test(tags),
    'AC-6 / ADR Consequences: Map Entries keeps its own two-step lookup');
  const panel = safeRead(CURATION_PANEL);
  assert(/\/tapestry\/lists\//.test(panel) && !/curated-dlists/.test(panel), 'AC-6: the DList Curation panel still links to Simple Lists, not to the new page');
  const detail = safeRead(DLIST_DETAIL);
  assert(['39998:', '39999:', '9998:', '9999:'].every((p) => detail.includes(`'${p}'`)), 'AC-6: the Simple Lists detail route is unchanged');
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
