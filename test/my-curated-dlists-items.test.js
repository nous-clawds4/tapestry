/**
 * my-curated-dlists #3: items, the curation-method panel, and Update list — plus AC-7 (a real
 * pointer beats b-tag-deferred, the house rule).
 *
 * Story: engineering-team/stories/my-curated-dlists/3-items-method-and-update.md
 * ADR:   engineering-team/decisions/my-curated-dlists/0003-items-method-and-update.md
 *
 * Three classes (house pattern; ESM behavioral import per test/my-curated-dlists-headers.test.js):
 *   U (behavioral) — describeCurationHeader's amended `deferred` (parity with the house
 *                    dispositionOf), and the new pure exports of ui/src/utils/treasureMap.js:
 *                    itemRouteId, lookupListItems (fakes for both sources), curatedItemRows (the
 *                    three views, "already copied", order), sharedListUnavailable. FAIL now: the
 *                    exports do not exist and `deferred` still follows ADR 0002.
 *   S (structure)  — the new items module (method panel, items section, disabled Update), its hook,
 *                    the detail page's placement, the util taking the sentinel from its owner, and
 *                    the new files writing nothing. FAIL now: none of it exists.
 *   R (sentinel)   — story 2's headers module, the util's existing exports, the house b-value owner,
 *                    and Simple Lists' item route. PASS before and after.
 *
 * Story 2's suite U4 is re-aimed in this phase (ADR 0003 sub-decision 9): "sentinel beside a pointer"
 * now expects deferred:false — it fails until this story is implemented.
 *
 * Not covered here: the rendered table and checkboxes in a browser, and the real strfry scan / relay
 * fetch (the reviewer's live check on the local stack, where the shared dog-breed list has two local
 * items).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const UI = path.resolve(__dirname, '../ui/src');
const UTIL = path.join(UI, 'utils/treasureMap.js');
const BDISP = path.join(UI, 'utils/bDisposition.js');
const ITEMS = path.join(UI, 'pages/grapevine/CuratedDListItems.jsx');
const ITEMS_HOOK = path.join(UI, 'hooks/useListItems.js');
const DETAIL = path.join(UI, 'pages/grapevine/CuratedDListDetail.jsx');
const HEADERS = path.join(UI, 'pages/grapevine/CuratedDListHeaders.jsx');
const APP = path.join(UI, 'App.jsx');
const ITEM_PAGE = path.join(UI, 'pages/events/DListItemDetail.jsx');
const NEW_FILES = [ITEMS, ITEMS_HOOK];

const ME = 'a'.repeat(64);                    // the signed-in user's own assistant
const OTHER = 'b'.repeat(64);                 // someone else
const AUTHOR = '0123456789abcdef'.repeat(4);  // the shared list's author
const RELAY = 'wss://dcosl.brainstorm.world';
const MY = `39998:${ME}:dog-breed`;           // my local DList (my assistant's header)
const SHARED = `39998:${AUTHOR}:dog-breed`;   // the shared list
const EVENT_ID = 'e'.repeat(64);
const APOS = "(?:'|’|&apos;|&#39;)";

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
  assert(typeof mod[name] === 'function', `ui/src/utils/treasureMap.js must export ${name} (ADR 0003 §Implementation 1)`);
  return mod[name];
}
function src(p, what) {
  const s = safeRead(p);
  assert(s.length > 0, `${what}: ${rel(p)} must exist (ADR 0003 §Implementation notes)`);
  return s;
}
let seq = 0;
const hexId = () => (++seq).toString(16).padStart(64, '0');
// A DList item: kind 39999 (addressable, needs d) or 9999; `z` points at its list.
function item({ kind = 39999, pubkey = ME, d, name, createdAt = 100, z = MY, tags = [], id = hexId() }) {
  const t = [['z', z], ...(d ? [['d', d]] : []), ...(name ? [['name', name]] : []), ...tags];
  return { id, kind, pubkey, created_at: createdAt, content: '', sig: 's'.repeat(128), tags: t };
}
const coordOf = (e) => `39999:${e.pubkey}:${e.tags.find((t) => t[0] === 'd')[1]}`;
const wrap = (events, local = true) => events.map((event) => ({ event, local }));
function assistantHeader(bTags) {
  return { id: 'h'.repeat(64), kind: 39998, pubkey: ME, created_at: 1, content: '', sig: 'x'.repeat(128), tags: [['d', 'dog-breed'], ...bTags] };
}

const tests = [];
function test(name, f) { tests.push({ name, fn: f }); }

/* ── U: the pure functions ─────────────────────────────────── */

test('U1: describeCurationHeader follows the house rule (AC-7) — a real b beats b-tag-deferred; the sentinel alone is still "deliberately unaffiliated"', async () => {
  const describe = await fn('describeCurationHeader');
  let info = describe(assistantHeader([['b', 'b-tag-deferred']]), ME);
  assert(info.deferred === true && info.pointer === null && info.problems.length === 0, `AC-7: the sentinel alone stays deferred; got ${JSON.stringify(info)}`);
  info = describe(assistantHeader([['b', 'b-tag-deferred'], ['b', SHARED, 'inherit-items']]), ME);
  assert(info.deferred === false && info.pointer && info.pointer.coord === SHARED && info.problems.length === 0,
    `AC-7 / ADR 0003 sub-decision 9: beside a real pointer the sentinel is superseded — not deferred, the pointer followed; got ${JSON.stringify(info)}`);
  info = describe(assistantHeader([['b', 'b-tag-deferred'], ['b', EVENT_ID]]), ME);
  assert(info.deferred === false && info.pointer === null && deepEq(info.problems, ['not-a-coordinate']),
    `sub-decision 9: an event-id b is real to the house rule (not deferred) but still not a list coordinate; got ${JSON.stringify(info)}`);
  const house = await loadEsm(BDISP);
  assert(house && typeof house.dispositionOf === 'function', 'ui/src/utils/bDisposition.js must load (the house owner)');
  const cases = [[], ['b-tag-deferred'], ['b-tag-deferred', SHARED], [SHARED, 'b-tag-deferred'], ['b-tag-deferred', EVENT_ID], ['nonsense', 'b-tag-deferred'], [SHARED]];
  for (const values of cases) {
    const mine = describe(assistantHeader(values.map((v) => ['b', v])), ME).deferred;
    const theirs = house.dispositionOf(values).deferred;
    assert(mine === theirs, `sub-decision 9: deferred must equal the house dispositionOf for b values ${JSON.stringify(values)} (house ${theirs}, got ${mine})`);
  }
});

test('U2: itemRouteId — "39999:<pubkey>:<d>" for an addressable item, the event id for kind 9999 (Simple Lists\' item ids); garbage → null', async () => {
  const itemRouteId = await fn('itemRouteId');
  const a = item({ kind: 39999, d: 'poodle-1' });
  assert(itemRouteId(a) === `39999:${ME}:poodle-1`, `ADR note 1: kind 39999 → its coordinate; got ${itemRouteId(a)}`);
  const b = item({ kind: 9999 });
  assert(itemRouteId(b) === b.id, `ADR note 1: kind 9999 → its event id; got ${itemRouteId(b)}`);
  const noD = item({ kind: 39999 });
  assert(itemRouteId(noD) === noD.id, 'ADR note 1: a 39999 without a d-tag falls back to its event id');
  for (const g of [null, undefined, {}, 42, { kind: 9999 }]) {
    let out;
    try { out = itemRouteId(g); } catch (e) { throw new Error(`never throws — threw on ${JSON.stringify(g)}: ${e.message}`); }
    assert(out === null, `ADR note 1: garbage → null; got ${JSON.stringify(out)} for ${JSON.stringify(g)}`);
  }
});

test('U3: lookupListItems — this instance (bounded) and the community relay, same filter; only items that point at the list; deduped (newest per coordinate, one per id); "local" when any copy is here', async () => {
  const lookup = await fn('lookupListItems');
  const a1 = item({ d: 'akita', name: 'akita', createdAt: 100 });
  const a1new = { ...a1, id: hexId(), created_at: 200, tags: [...a1.tags] };
  const b = item({ kind: 9999, pubkey: OTHER, name: 'beagle', createdAt: 150 });
  const c = item({ d: 'corgi', name: 'corgi', createdAt: 120 });
  const noise = [item({ d: 'elsewhere', z: `39998:${ME}:cats` }), { ...item({ d: 'kind1' }), kind: 1 }];
  const calls = [];
  const res = await lookup([MY], {
    scanLocal: async (f) => { calls.push(['local', f]); return { events: [a1, a1new, b, ...noise], truncated: false, total: 5 }; },
    fetchRelay: async (f, url) => { calls.push(['relay', f, url]); return { success: true, events: [{ ...a1, created_at: 150, id: hexId() }, c, b] }; },
  }, RELAY);
  const want = { kinds: [9999, 39999], '#z': [MY], limit: 500 };
  const local = calls.find((c2) => c2[0] === 'local'); const relay = calls.find((c2) => c2[0] === 'relay');
  assert(local && deepEq(local[1], want), `ADR sub-decision 3: the local filter is ${JSON.stringify(want)}; got ${JSON.stringify(local)}`);
  assert(relay && deepEq(relay[1], want) && relay[2] === RELAY, `ADR sub-decision 3: the same filter on the community relay; got ${JSON.stringify(relay)}`);
  const r = res && res[MY];
  assert(r && r.local === 'ok' && r.relay === 'ok' && r.truncated === false && r.total === 5, `sub-decision 3: per-source status; got ${JSON.stringify(r && { local: r.local, relay: r.relay, truncated: r.truncated, total: r.total })}`);
  const byId = Object.fromEntries((r.items || []).map((x) => [x.event.id, x]));
  assert((r.items || []).length === 3, `AC-1: three distinct items (akita once, beagle once, corgi); got ${(r.items || []).length}`);
  assert(byId[a1new.id] && byId[a1new.id].local === true, 'sub-decision 3: an addressable item keeps its newest version; local because a copy is here');
  assert(byId[b.id] && byId[b.id].local === true, 'sub-decision 3: a 9999 item found here and on the relay appears once, local');
  assert(byId[c.id] && byId[c.id].local === false, 'sub-decision 3: an item only on the relay is not local');
  assert(!(r.items || []).some((x) => x.event.kind === 1 || x.event.tags.some((t) => t[0] === 'z' && t[1] !== MY)), 'sub-decision 3: only kind 9999/39999 items whose z is this list');
  const t = await lookup([MY], { scanLocal: async () => ({ events: [a1], truncated: true, total: 812 }), fetchRelay: async () => ({ success: true, events: [] }) }, RELAY);
  assert(t[MY].truncated === true && t[MY].total === 812, `AC-1 / sub-decision 7: the local cap is reported with its total; got ${JSON.stringify(t[MY])}`);
  const u = await lookup([MY], { scanLocal: async () => ({ events: [a1], truncated: true, total: null }), fetchRelay: async () => ({ success: true, events: [] }) }, RELAY);
  assert(u[MY].truncated === true && u[MY].total === null, 'sub-decision 7: an unknown total stays null, never the bounded count');
});

test('U4: lookupListItems — a failed source is marked failed (the other still counts), a non-ws relay is skipped, and it never rejects', async () => {
  const lookup = await fn('lookupListItems');
  const a = item({ d: 'akita', name: 'akita' });
  let res = await lookup([MY], { scanLocal: async () => { throw new Error('strfry down'); }, fetchRelay: async () => ({ success: true, events: [a] }) }, RELAY);
  assert(res[MY].local === 'failed' && res[MY].relay === 'ok' && res[MY].items.length === 1 && res[MY].items[0].local === false,
    `AC-1 / sub-decision 7: local failed, the relay's items still shown; got ${JSON.stringify(res[MY])}`);
  res = await lookup([MY], { scanLocal: async () => ({ events: [a], truncated: false, total: 1 }), fetchRelay: async () => { throw new Error('offline'); } }, RELAY);
  assert(res[MY].local === 'ok' && res[MY].relay === 'failed' && res[MY].items.length === 1, `sub-decision 7: the relay failed, local items still shown; got ${JSON.stringify(res[MY])}`);
  res = await lookup([MY], { scanLocal: async () => ({ events: [], truncated: false, total: 0 }), fetchRelay: async () => ({ success: false, events: [], error: 'boom' }) }, RELAY);
  assert(res[MY].relay === 'failed', `sub-decision 3: an unsuccessful relay answer is a failure, not "empty"; got ${JSON.stringify(res[MY])}`);
  let both;
  try { both = await lookup([MY], { scanLocal: async () => { throw new Error('x'); }, fetchRelay: async () => { throw new Error('y'); } }, RELAY); } catch (e) { throw new Error(`never rejects — rejected with ${e.message}`); }
  assert(both[MY].local === 'failed' && both[MY].relay === 'failed' && both[MY].items.length === 0, `AC-1: both failed → "couldn't check", no items; got ${JSON.stringify(both[MY])}`);
  let relayCalled = false;
  res = await lookup([MY], { scanLocal: async () => ({ events: [a], truncated: false, total: 1 }), fetchRelay: async () => { relayCalled = true; return { success: true, events: [] }; } }, 'https://not-a-relay.example');
  assert(res[MY].relay === 'skipped' && !relayCalled, 'sub-decision 3: a relay that is not ws/wss is skipped, not fetched');
  let called = false;
  const spy = { scanLocal: async () => { called = true; return { events: [] }; }, fetchRelay: async () => { called = true; return { success: true, events: [] }; } };
  for (const empty of [[], null, undefined]) {
    const out = await lookup(empty, spy, RELAY);
    assert(out && typeof out === 'object' && Object.keys(out).length === 0, `no lists → {}; got ${JSON.stringify(out)}`);
  }
  assert(!called, 'no lists → no scan and no fetch');
});

// Fixture for U5–U7: my assistant's items (some pointing back at shared items), someone else's, the shared list.
const S1 = item({ pubkey: AUTHOR, d: 'sheep-dog', name: 'sheep dog', z: SHARED });
const S2 = item({ pubkey: AUTHOR, d: 'poodle-s', name: 'poodle', z: SHARED });
const S3 = item({ pubkey: AUTHOR, d: 'akita-s', name: 'akita', z: SHARED });
const S4 = item({ kind: 9999, pubkey: AUTHOR, name: 'beagle', z: SHARED });
const S5 = item({ pubkey: AUTHOR, d: 'shiba', name: 'shiba inu', z: SHARED, createdAt: 50 });
const S6 = item({ kind: 9999, pubkey: AUTHOR, name: 'golden retriever', z: SHARED, createdAt: 60 });
const M1 = item({ d: 'm-poodle', name: 'poodle', createdAt: 300, tags: [['e', S1.id]] });                      // copies S1 by id
const M2 = item({ kind: 9999, name: 'Beagle', createdAt: 200, tags: [['a', coordOf(S2)]] });                  // copies S2 by coordinate
const M3 = item({ d: 'm-akita', name: 'akita', createdAt: 100, tags: [['b', coordOf(S3), 'inherit'], ['x', 'foo', S4.id]] }); // S3 at index 1, S4's id at index 2
const O1 = item({ pubkey: OTHER, d: 'o-corgi-1', name: 'corgi', createdAt: 250, tags: [['e', S5.id]] });     // someone else "copying" S5 — does not count
const O2 = item({ pubkey: OTHER, d: 'o-corgi-2', name: 'Corgi', createdAt: 260 });
const MINE_LIST = [...wrap([M1, M3], true), ...wrap([M2], false), ...wrap([O1, O2], true)];
const SHARED_LIST = wrap([S1, S2, S3, S4, S5, S6], true);

test('U5: curatedItemRows — by default only my assistant\'s items, marked "assistant"; others and candidates only when asked', async () => {
  const rows = (await fn('curatedItemRows'))({ mine: MINE_LIST, shared: SHARED_LIST, assistantPubkey: ME, showOthers: false, showCandidates: false });
  assert(deepEq(rows.map((r) => r.from), ['assistant', 'assistant', 'assistant']), `AC-1: default = my assistant's items only; got ${JSON.stringify(rows.map((r) => [r.from, r.name]))}`);
  assert(deepEq(rows.map((r) => r.name), ['akita', 'Beagle', 'poodle']), `sub-decision 5: by name, case-insensitive; got ${JSON.stringify(rows.map((r) => r.name))}`);
  const upper = (await fn('curatedItemRows'))({ mine: MINE_LIST, shared: null, assistantPubkey: ME.toUpperCase(), showOthers: false, showCandidates: false });
  assert(upper.length === 3 && upper.every((r) => r.from === 'assistant'), 'sub-decision 1: the assistant pubkey compares lowercased');
});

test('U6: curatedItemRows — "someone else" and candidates; "already copied" = my assistant\'s item carries the shared item\'s id or coordinate in any tag', async () => {
  const rows = (await fn('curatedItemRows'))({ mine: MINE_LIST, shared: SHARED_LIST, assistantPubkey: ME, showOthers: true, showCandidates: true });
  const pairs = rows.map((r) => `${r.from}:${r.name}`);
  assert(deepEq(pairs, ['assistant:akita', 'assistant:Beagle', 'assistant:poodle', 'other:Corgi', 'other:corgi', 'candidate:golden retriever', 'candidate:shiba inu']),
    `AC-2 / AC-3 / sub-decisions 2 and 5: groups assistant → someone else → candidate; S1–S4 copied (by id in "e", by coordinate in "a", by coordinate in a "b" at index 1, by id at index 2 of any tag); S5 still a candidate (only someone else referenced it); S6 a candidate; got ${JSON.stringify(pairs)}`);
  const onlyOthers = (await fn('curatedItemRows'))({ mine: MINE_LIST, shared: SHARED_LIST, assistantPubkey: ME, showOthers: true, showCandidates: false });
  assert(!onlyOthers.some((r) => r.from === 'candidate') && onlyOthers.filter((r) => r.from === 'other').length === 2, 'AC-2: others without candidates');
  const noShared = (await fn('curatedItemRows'))({ mine: MINE_LIST, shared: null, assistantPubkey: ME, showOthers: false, showCandidates: true });
  assert(!noShared.some((r) => r.from === 'candidate'), 'AC-3: no shared list read → no candidates');
});

test('U7: curatedItemRows — row fields, the newest-first tie-break, the "(unnamed)" fallback, and garbage', async () => {
  const curatedItemRows = await fn('curatedItemRows');
  const rows = curatedItemRows({ mine: MINE_LIST, shared: SHARED_LIST, assistantPubkey: ME, showOthers: true, showCandidates: true });
  const corgis = rows.filter((r) => r.from === 'other');
  assert(corgis[0].createdAt === 260 && corgis[1].createdAt === 250, 'sub-decision 5: same name (case-insensitive) → newest first');
  const m2 = rows.find((r) => r.name === 'Beagle');
  assert(m2 && m2.routeId === M2.id && m2.author === ME && m2.createdAt === 200 && m2.local === false && typeof m2.key === 'string' && m2.key.length > 0,
    `ADR note 1: { key, from, name, author, createdAt, routeId, local }; got ${JSON.stringify(m2)}`);
  const akita = rows.find((r) => r.name === 'akita' && r.from === 'assistant');
  assert(akita.routeId === `39999:${ME}:m-akita` && akita.local === true, 'ADR note 1: an addressable item routes by coordinate; local passes through');
  assert(new Set(rows.map((r) => r.key)).size === rows.length, 'ADR note 1: row keys are unique');
  const nameless = curatedItemRows({ mine: wrap([item({ d: 'x' })]), shared: null, assistantPubkey: ME, showOthers: false, showCandidates: false });
  assert(nameless.length === 1 && nameless[0].name === '(unnamed)', 'sub-decision 5: no name tag → "(unnamed)"');
  for (const g of [undefined, null, {}, { mine: 'x' }, { mine: [null, {}], assistantPubkey: ME }]) {
    let out;
    try { out = curatedItemRows(g); } catch (e) { throw new Error(`never throws — threw on ${JSON.stringify(g)}: ${e.message}`); }
    assert(Array.isArray(out) && out.length === 0, `garbage → []; got ${JSON.stringify(out)} for ${JSON.stringify(g)}`);
  }
});

test('U8: sharedListUnavailable — why there is no shared list to draw candidates from (or null when there is one)', async () => {
  const sharedListUnavailable = await fn('sharedListUnavailable');
  const describe = await fn('describeCurationHeader');
  const ev = (b) => assistantHeader(b);
  assert(sharedListUnavailable(undefined, null) === 'checking', 'ADR note 1: the assistant\'s header not looked up yet → checking');
  assert(sharedListUnavailable({ missing: true, failed: true, checkedRelay: RELAY }, null) === 'failed', 'AC-3: the header could not be checked → failed');
  assert(sharedListUnavailable({ missing: true, failed: false, checkedRelay: RELAY }, null) === 'missing', 'AC-3: the header was not found → missing');
  const deferred = ev([['b', 'b-tag-deferred']]);
  assert(sharedListUnavailable({ event: deferred, where: 'local' }, describe(deferred, ME)) === 'deferred', 'AC-3: deliberately unaffiliated → deferred');
  const nob = ev([]);
  assert(sharedListUnavailable({ event: nob, where: 'local' }, describe(nob, ME)) === 'no-pointer', 'AC-3: no pointer → no-pointer');
  const good = ev([['b', SHARED, 'inherit-items']]);
  assert(sharedListUnavailable({ event: good, where: 'relay' }, describe(good, ME)) === null, 'AC-3: a followed pointer → null (candidates available)');
});

test('U9: itemsEmptySentence — "no candidates" only after a shared-list read that did not fail on both sources (ADR 0003 Amendment 1; review round 1, blocking 1)', async () => {
  const itemsEmptySentence = await fn('itemsEmptySentence');
  const BASE = new RegExp(`^Your assistant hasn${APOS}t added any items to this list yet\\.`);
  const NONE = 'The shared list offers no candidates to inherit.';
  const OTHERS = 'No one else has either.';
  let s = itemsEmptySentence({ showOthers: false, shared: undefined });
  assert(BASE.test(s) && !s.includes(OTHERS) && !s.includes(NONE), `Amendment 1: shared list not read → the base sentence only; got "${s}"`);
  s = itemsEmptySentence({ showOthers: true, shared: null });
  assert(BASE.test(s) && s.includes(OTHERS) && !s.includes(NONE), `Amendment 1: others shown, shared not read → base + "${OTHERS}"; got "${s}"`);
  s = itemsEmptySentence({ showOthers: false, shared: { items: [], local: 'ok', relay: 'ok', truncated: false, total: 0 } });
  assert(BASE.test(s) && s.includes(NONE), `Amendment 1: the shared list read cleanly → "${NONE}"; got "${s}"`);
  s = itemsEmptySentence({ showOthers: true, shared: { items: [], local: 'failed', relay: 'failed', truncated: false, total: null } });
  assert(BASE.test(s) && s.includes(OTHERS) && !s.includes(NONE),
    `AC-1 / sub-decision 7 / Amendment 1: a shared-list read that FAILED on both sources is "couldn't check", never "no candidates"; got "${s}"`);
  s = itemsEmptySentence({ showOthers: false, shared: { items: [], local: 'ok', relay: 'failed', truncated: false, total: 0 } });
  assert(s.includes(NONE), `Amendment 1: a partial read keeps today's behaviour (the source note sits beside it; NB-2 is a follow-up); got "${s}"`);
  for (const g of [undefined, null, {}, 42, { shared: 'x' }]) {
    let out;
    try { out = itemsEmptySentence(g); } catch (e) { throw new Error(`never throws — threw on ${JSON.stringify(g)}: ${e.message}`); }
    assert(typeof out === 'string' && BASE.test(out) && !out.includes(NONE), `Amendment 1: garbage → the base sentence; got ${JSON.stringify(out)} for ${JSON.stringify(g)}`);
  }
});

/* ── S: structure ──────────────────────────────────────────── */

test('S1: the items module — the method panel, the items section, the Update button, and their titles and checkbox labels', () => {
  const s = src(ITEMS, 'AC-1/4/5');
  for (const name of ['CurationMethodPanel', 'UpdateListButton', 'ItemsSection']) {
    assert(new RegExp(`export\\s+(function|const)\\s+${name}\\b`).test(s), `ADR note 3: named export ${name}`);
  }
  assert(/Curation method/.test(s) && /['">]\s*Items\s*['"<]/.test(s), 'AC-1 / AC-4: the "Curation method" and "Items" titles');
  assert(/Also show items others added to this list/.test(s) && /Also show candidates to inherit/.test(s), 'AC-2 / AC-3: the two checkbox labels');
});

test('S2: off/closed on every load — the panel and both checkboxes start false and nothing is persisted', () => {
  const s = src(ITEMS, 'AC-2/3/4');
  assert((s.match(/useState\(\s*false\s*\)/g) || []).length >= 3, 'AC-2 / AC-3 / AC-4: the panel and both checkboxes start false (useState(false) ×3)');
  assert((s.match(/type=["']checkbox["']/g) || []).length >= 2 && /checked=\{\s*showOthers\s*\}/.test(s) && /checked=\{\s*showCandidates\s*\}/.test(s),
    'AC-2 / AC-3: two checkboxes bound to showOthers / showCandidates');
  assert(!/localStorage|sessionStorage/.test(s), 'AC-2 / AC-3 / AC-4: "on every load" — nothing persisted');
});

test('S3: the placeholders act on nothing — Update is disabled with a "not built yet" line; the method panel is text only', () => {
  const s = src(ITEMS, 'AC-4/5');
  // The UpdateListButton declaration, up to the next top-level declaration (or the end of the file).
  const start = s.search(/export\s+(function|const)\s+UpdateListButton\b/);
  const rest = start >= 0 ? s.slice(start + 1) : '';
  const next = rest.search(/\n(?:export\s+)?(?:async\s+)?(?:function|const|let|class)\s/);
  const upd = start >= 0 ? s.slice(start, next >= 0 ? start + 1 + next : undefined) : '';
  assert(/<button\b[^>]*\bdisabled\b[^>]*>\s*Update list\s*</.test(upd), 'AC-5 / sub-decision 8: <button … disabled>Update list</button>');
  assert(!/onClick/.test(upd), 'AC-5: the Update button has no handler');
  assert(new RegExp(`isn${APOS}t built yet|not built yet`, 'i').test(s), 'AC-4 / AC-5: says it isn\'t built yet');
  assert(/downvotes/i.test(s) && /upvotes/i.test(s), 'AC-4: the method panel names what it will decide (the downvotes/upvotes example)');
});

test('S4: the table — Name · Author · From · Added, the three "From" values, ages via timeAgo, the Simple Lists item link gated on local, the relay-only marker', () => {
  const s = src(ITEMS, 'AC-1');
  for (const h of ['Name', 'Author', 'From', 'Added']) assert(new RegExp(`['">]\\s*${h}\\s*['"<]`).test(s), `AC-1: a "${h}" column`);
  assert(/your assistant/i.test(s) && /someone else/i.test(s) && /candidate/i.test(s), 'AC-1 / AC-2 / AC-3: the From values');
  assert(/import\s*\{[^}]*timeAgo[^}]*\}\s*from\s*['"]\.\.\/\.\.\/utils\/timeAgo['"]/.test(s) && /timeAgo\(/.test(s), 'sub-decision 7 / fact 5: Added via timeAgo');
  assert(/\/tapestry\/lists\/items\/(?:\$\{\s*|['"`]\s*\+\s*)encodeURIComponent\(/.test(s), 'AC-1: the link is /tapestry/lists/items/ + encodeURIComponent(routeId)');
  assert(/\.local\b[\s\S]*\/tapestry\/lists\/items\//.test(s) && /\bonly\b/.test(s), 'sub-decision 6: the link only for local items; relay-only rows say so');
});

test('S5: the states — loading, couldn\'t check, the local cap, and the empty default view', () => {
  const s = src(ITEMS, 'AC-1');
  assert(/Loading items/i.test(s), 'sub-decision 7: "⏳ Loading items…"');
  assert(new RegExp(`Couldn${APOS}t check`).test(s), 'AC-1 / sub-decision 7: a failed lookup reads "couldn\'t check"');
  assert(/Showing the first/.test(s) && /truncated/.test(s), 'sub-decision 7: the local cap is reported');
  // Re-aimed in round 2 (ADR 0003 Amendment 1): the empty sentence may live in the util.
  assert(new RegExp(`Your assistant hasn${APOS}t added any items to this list yet`).test(s + safeRead(UTIL)), 'AC-1: the empty default view');
});

test('S10: the section renders itemsEmptySentence and composes no "no candidates" clause of its own (ADR 0003 Amendment 1)', () => {
  const s = src(ITEMS, 'AC-1');
  assert(/itemsEmptySentence\(/.test(s), 'Amendment 1: ItemsSection renders itemsEmptySentence(…)');
  assert(!/offers no candidates/.test(s), 'Amendment 1: the "no candidates" clause lives only in the util, where U9 pins its failure rule');
});

test('S6: the data flow — two useListItems calls in the section (the shared one gated on "candidates"), curatedItemRows, and the disabled candidates box', () => {
  const s = src(ITEMS, 'AC-1/2/3');
  assert((s.match(/useListItems\(/g) || []).length >= 2, 'ADR note 3: two useListItems calls — my list and the shared list');
  assert(/useListItems\([^;]*showCandidates/.test(s), 'sub-decision 4: the shared list is read only while "candidates" is on');
  assert(/curatedItemRows\(/.test(s), 'ADR note 3: rows from curatedItemRows');
  assert(/disabled=\{[^}]*sharedUnavailable/.test(s), 'AC-3: the candidates box is disabled (with its reason) when there is no shared list');
  const h = src(ITEMS_HOOK, 'AC-1');
  assert(/export\s+(default\s+)?function\s+useListItems\b|export\s+default\s+useListItems\b/.test(h), 'ADR note 2: exports useListItems');
  assert(/queryRelayBounded/.test(h) && /\/api\/relay\/external/.test(h) && /lookupListItems/.test(h), 'ADR note 2: binds lookupListItems to the bounded scan and the relay endpoint');
});

test('S7: the detail page — the method panel then the items section, after the shared header; no new hooks on the page', () => {
  const s = src(DETAIL, 'AC-1/4');
  assert(/import\s*\{[^}]*CurationMethodPanel[^}]*\}\s*from\s*['"]\.\/CuratedDListItems['"]/.test(s) && /import\s*\{[^}]*ItemsSection[^}]*\}\s*from\s*['"]\.\/CuratedDListItems['"]/.test(s),
    'ADR note 4: the panel and the section from ./CuratedDListItems');
  const at = (re) => s.search(re);
  const sh = at(/<SharedHeaderSection\b/); const mp = at(/<CurationMethodPanel\b/); const is = at(/<ItemsSection\b/);
  assert(sh > 0 && mp > sh && is > mp, 'sub-decision 10: shared header → Curation method → Items');
  assert(/sharedUnavailable=\{\s*sharedListUnavailable\(/.test(s) && /myCoord=\{\s*row\.coord\s*\}/.test(s), 'ADR note 4: ItemsSection gets myCoord and sharedListUnavailable(…)');
  assert(!/useListItems\(/.test(s), 'ADR note 4: no new hooks on the page (story 2\'s hook order holds)');
});

test('S8: AC-7 at the source — the util takes the sentinel and the rule from the house owner and keeps no copy of the literal', () => {
  const s = src(UTIL, 'AC-7');
  assert(/import\s*\{[^}]*dispositionOf[^}]*\}\s*from\s*['"]\.\/bDisposition\.js['"]/.test(s), 'sub-decision 9: import { dispositionOf, … } from \'./bDisposition.js\' (the .js extension keeps Node-loaded suites resolving it)');
  assert(!/['"]b-tag-deferred['"]/.test(s), 'sub-decision 9 / story 2 review NB-5: no string copy of the sentinel in treasureMap.js');
});

test('S9: the new files write nothing and carry no identity literal', () => {
  for (const f of NEW_FILES) {
    const s = src(f, 'AC-6');
    assert(!/\/api\/strfry\/publish|method:\s*['"]POST['"]|signEvent|window\.nostr|publishOrThrow|publishEverywhere|publishToRelays/.test(s), `AC-5 / AC-6: ${rel(f)} writes nothing`);
    assert(!/taPubkey/.test(s) && !/[0-9a-fA-F]{64}/.test(s), `OPEN.md row 188 / CLAUDE.md: ${rel(f)} carries no taPubkey and no 64-hex literal`);
  }
});

/* ── R: sentinels (pass before and after) ───────────────────── */

test('R1: story 2\'s headers module is unchanged in its contract — the one import, the deliberately-unaffiliated state', () => {
  const s = safeRead(HEADERS);
  assert((s.match(/\/api\/strfry\/publish/g) || []).length === 1 && /signAs:\s*['"]client['"]/.test(s), 'AC-6: story 2\'s import is still the page\'s only write');
  assert(/deliberately unaffiliated/i.test(s) && /\.deferred\b/.test(s), 'AC-6 / AC-7: the sentinel-alone state is still rendered');
});

test('R2: the util\'s existing exports are unchanged', async () => {
  const mod = await util();
  for (const name of ['curatedDListRows', 'parseCuratedDListRouteId', 'curatedDListPath', 'curatedDListAccess', 'lookupCurationHeaders',
    'parseCoordinate', 'describeCurationHeader', 'curationPointerRow', 'findDListEntries', 'communityPointerOf', 'describeHeaderLookup']) {
    assert(typeof mod[name] === 'function', `AC-6: ${name} still exported`);
  }
});

test('R3: the house b-value owner is unchanged — SENTINEL, classifyBValue, dispositionOf (a real b beats the sentinel)', async () => {
  const house = await loadEsm(BDISP);
  assert(house && house.SENTINEL === 'b-tag-deferred' && typeof house.classifyBValue === 'function', 'AC-7: the owner still exports the sentinel and the classifier');
  assert(house.dispositionOf(['b-tag-deferred']).deferred === true && house.dispositionOf(['b-tag-deferred', SHARED]).deferred === false, 'AC-7: the rule this story adopts');
});

test('R4: Simple Lists\' item route and page are unchanged', () => {
  assert(/import DListItemDetail from '\.\/pages\/events\/DListItemDetail';/.test(safeRead(APP)), 'AC-6: the Simple Lists item route still mounts DListItemDetail');
  assert(/queryRelay\(/.test(safeRead(ITEM_PAGE)), 'AC-6: the item page still reads local strfry (why links are gated on local)');
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
