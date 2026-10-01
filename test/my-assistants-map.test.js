'use strict';
/**
 * my-assistants #3: what each Assistant does — your Treasure Map on the My Assistants page.
 *
 * Story: engineering-team/stories/my-assistants/3-the-treasure-map-on-the-page.md
 * ADR:   engineering-team/decisions/my-assistants/0003-the-pages-treasure-map-is-the-shared-hook-read-strictly.md
 * Plan:  engineering-team/stories/my-assistants/3-the-treasure-map-on-the-page.test-plan.md
 * Browser half: tests/brainstorm/my-assistants-map.spec.js (the map states, tabs, row duties, the not-tagged
 * section, the Duties tab).
 *
 * Classes:
 *   D — the view-model's duties, pure, on one fixture Treasure Map holding every entry class, a repeated key, a
 *       repeated delegate and three entries the app cannot place (ADR 0003 sub-decisions 2–4).   [AC-3, AC-6, AC-7]
 *   P — per Assistant: dutiesOf, mapOnlyAssistants, and every listed row now opens (rowActions).  [AC-2, AC-3, AC-4]
 *   T — the Duties tab's rows and sentences: dutyRows, dutySentence.                              [AC-6]
 *   H — the shared hook's strict option, by source (React hooks do not run in this runner).        [AC-1, AC-7]
 *   S — source sentinels: the two new page files exist and hold no 64-hex literal; the page's withdrawal publisher
 *       forwards the relays it is handed (ADR 0003 sub-decision 6).                                  [Also in this cycle]
 *
 * Nothing here reads a relay or publishes. Everything FAILS against the current code (the functions do not exist).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const VIEW_MODEL = path.join(REPO, 'ui/src/pages/assistants/myAssistants.js');
const HOOK = path.join(REPO, 'ui/src/hooks/useTreasureMap.js');
const PAGE_DIR = path.join(REPO, 'ui/src/pages/assistants');
const NL = String.fromCharCode(10);

const A = 'c1'.repeat(32);   // in the list, tagged
const B = 'c2'.repeat(32);   // in the list, tagged
const D = 'd1'.repeat(32);   // on the map, not in the list
const E = 'd2'.repeat(32);   // on the map, not in the list
const LOCAL = 'a2'.repeat(32); // in the list, untagged, no duties
const R = 'wss://relay.example';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
const plain = (s) => String(s).replace(/[’']/g, "'");

async function vm() {
  assert(fs.existsSync(VIEW_MODEL), `${rel(VIEW_MODEL)} does not exist`);
  try { return await import(`${pathToFileURL(VIEW_MODEL).href}?t=${Date.now()}`); } catch (err) {
    throw new Error(`${rel(VIEW_MODEL)} could not be loaded in Node: ${err.message}`);
  }
}
function need(mod, name) {
  assert(mod && typeof mod[name] === 'function', `${rel(VIEW_MODEL)} does not export ${name}() (ADR 0003 sub-decision 4)`);
  return mod[name];
}

/** One Treasure Map holding every case. Order matters: it is the Map's order. */
const MAP = {
  kind: 10040, pubkey: 'f'.repeat(64), created_at: 1000, id: 'e'.repeat(64), content: '',
  tags: [
    ['30382:rank', A, R],            //  1 exact score, Preferred A
    ['30382:rank', B, R],            //  2 the same key: Alternate B
    ['30382:rank', A, R],            //  3 the same key and delegate again: deduped
    ['30392', D, R],                 //  4 a bare List kind (scope)
    ['30382', B, R],                 //  5 a bare Score kind (scope)
    ['39998:dog-breed', A, R],       //  6 one Curated DList (exact)
    ['39998:dlist-header', D, R],    //  7 every Concept header (scope)
    ['30392:podcasters', B, R],      //  8 a named List (exact; recognized, inert in this app)
    ['30383:rank', D, R],            //  9 exact score about events
    ['30382:followers', A, R],       // 10 exact score, another metric
    ['99999', A, R],                 // 11 a kind the app cannot place → not a duty
    ['30382:hops', 'not-a-key', R],  // 12 no valid delegate → not a duty
    ['d', 'something'],              // 13 not an entry → not a duty
    ['30394', E, R],                 // 14 a bare List kind about addressable events (scope)
  ],
};
const ORDER = ['30382', '30392', '30394', '39998:dlist-header', '30382:rank', '30383:rank', '30382:followers', '30392:podcasters', '39998:dog-breed'];

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// D — duties
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('D1: treasureMapDuties — one duty per placeable key, most generic first (Scope before Exact; Scores, Lists, Concepts; then Map order)', async () => {
  const duties = need(await vm(), 'treasureMapDuties')(MAP);
  assert(Array.isArray(duties), `expected an array, got ${show(duties)}`);
  const keys = duties.map((d) => d.key);
  assert(show(keys) === show(ORDER), `keys should be ${show(ORDER)}, got ${show(keys)}`);
});

test('D2: entries the app cannot place (an unknown kind, no valid delegate, a non-entry tag) are not duties', async () => {
  const duties = need(await vm(), 'treasureMapDuties')(MAP);
  const keys = duties.map((d) => d.key);
  for (const k of ['99999', '30382:hops', 'd']) assert(!keys.includes(k), `${k} must not be a duty; keys ${show(keys)}`);
});

test('D3: a duty\'s Assistants are its delegates in Map order, deduped — Preferred first, Alternates after', async () => {
  const duties = need(await vm(), 'treasureMapDuties')(MAP);
  const rank = duties.find((d) => d.key === '30382:rank');
  assert(rank && show(rank.assistants) === show([A, B]), `30382:rank assistants should be [A, B] (A repeated once only); got ${show(rank && rank.assistants)}`);
  assert(Array.isArray(rank.entries) && rank.entries.length === 3, `its raw entries are all three tags of that key; got ${show(rank.entries)}`);
});

test('D4: each duty\'s group and level', async () => {
  const duties = need(await vm(), 'treasureMapDuties')(MAP);
  const by = Object.fromEntries(duties.map((d) => [d.key, [d.group, d.level]]));
  const want = {
    '30382': ['scores', 'Scope'], '30392': ['lists', 'Scope'], '30394': ['lists', 'Scope'], '39998:dlist-header': ['concepts', 'Scope'],
    '30382:rank': ['scores', 'Exact'], '30383:rank': ['scores', 'Exact'], '30382:followers': ['scores', 'Exact'],
    '30392:podcasters': ['lists', 'Exact'], '39998:dog-breed': ['concepts', 'Exact'],
  };
  for (const [k, w] of Object.entries(want)) assert(show(by[k]) === show(w), `${k}: [group, level] should be ${show(w)}, got ${show(by[k])}`);
});

test('D5: each duty\'s name and its "what", in story § Copy\'s words', async () => {
  const duties = need(await vm(), 'treasureMapDuties')(MAP);
  const by = Object.fromEntries(duties.map((d) => [d.key, [d.title, plain(d.what)]]));
  const want = {
    '30382': ['All Scores about profiles', 'every Score about profiles, except where this Map says otherwise.'],
    '30392': ['All Lists of profiles', 'every Trusted List of profiles, except where this Map says otherwise.'],
    '30394': ['All Lists of addressable events', 'every Trusted List of addressable events, except where this Map says otherwise.'],
    '39998:dlist-header': ['All Concept headers', 'my Concept Graph — my DList headers and the items filed under them, except where this Map says otherwise.'],
    '30382:rank': ['rank', 'a rank for every profile, as seen from my trusted community.'],
    '30383:rank': ['rank', 'a rank for every event, as seen from my trusted community.'],
    '30382:followers': ['followers', 'a “followers” score for every profile.'],
    '30392:podcasters': ['podcasters', 'the Trusted List “podcasters” of profiles.'],
    '39998:dog-breed': ['Curated DList: dog-breed', 'my curated copy of dog-breed: its header, and a copy of each item.'],
  };
  for (const [k, w] of Object.entries(want)) assert(show(by[k]) === show(w), `${k}: [title, what] should be ${show(w)}, got ${show(by[k])}`);
});

test('D6: no Treasure Map, or one with no entries, gives no duties — and nothing throws', async () => {
  const fn = need(await vm(), 'treasureMapDuties');
  for (const ev of [null, undefined, {}, { kind: 10040, tags: [] }, { kind: 10040, tags: 'nonsense' }]) {
    const got = fn(ev);
    assert(Array.isArray(got) && got.length === 0, `${show(ev)} → expected [], got ${show(got)}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// P — per Assistant
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('P1: dutiesOf — an Assistant\'s duties, grouped Scores / Lists / Concepts in duty order, with a count', async () => {
  const m = await vm();
  const duties = need(m, 'treasureMapDuties')(MAP);
  const a = need(m, 'dutiesOf')(A, duties);
  const keys = (g) => (a[g] || []).map((d) => d.key);
  assert(a.count === 3, `A has 3 duties; got ${show(a.count)}`);
  assert(show(keys('scores')) === show(['30382:rank', '30382:followers']) && show(keys('lists')) === show([]) && show(keys('concepts')) === show(['39998:dog-breed']),
    `A's groups; got ${show({ scores: keys('scores'), lists: keys('lists'), concepts: keys('concepts') })}`);
  const b = m.dutiesOf(B, duties);
  assert(b.count === 3 && show(b.scores.map((d) => d.key)) === show(['30382', '30382:rank']), `B (Alternate on rank counts as a duty); got ${show(b)}`);
  const none = m.dutiesOf(LOCAL, duties);
  assert(none.count === 0 && none.scores.length === 0 && none.lists.length === 0 && none.concepts.length === 0, `LOCAL has none; got ${show(none)}`);
});

test('P2: mapOnlyAssistants — the delegates not in the list, each with its duty count, in first-appearance order', async () => {
  const m = await vm();
  const duties = need(m, 'treasureMapDuties')(MAP);
  const got = need(m, 'mapOnlyAssistants')(duties, [{ pubkey: A }, { pubkey: B }, { pubkey: LOCAL }]);
  assert(show(got.map((x) => [x.pubkey, x.count])) === show([[D, 3], [E, 1]]), `expected [[D, 3], [E, 1]]; got ${show(got.map((x) => [x.pubkey.slice(0, 4), x.count]))}`);
  assert(show(m.mapOnlyAssistants([], [{ pubkey: A }])) === show([]), 'no duties → nobody');
});

test('P3: every listed row opens now — the untagged Local row has actions with no Change and no Remove', async () => {
  const m = await vm();
  const [local] = m.buildRows({ rows: [{ pubkey: LOCAL, local: true, tags: [], retract: {} }], profiles: {} });
  const a = m.rowActions(local, {});
  assert(a && a.change === null && a.remove === null, `the untagged Local row's actions should be { change: null, remove: null }; got ${show(a)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// T — the Duties tab
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const NAMES = { [A]: 'Ava', [B]: 'Bea', [D]: 'Dee' }; // E has no name → its shortened npub

test('T1: dutySentence — "I entrust {Preferred} to publish and maintain {what}", then the Alternates joined by ", then "', async () => {
  const fn = need(await vm(), 'dutySentence');
  const one = fn({ what: 'a rank for every profile, as seen from my trusted community.', assistants: [A] }, NAMES);
  assert(plain(one) === 'I entrust Ava to publish and maintain a rank for every profile, as seen from my trusted community.', `got ${show(one)}`);
  const three = fn({ what: 'x.', assistants: [A, B, D] }, NAMES);
  assert(plain(three) === "I entrust Ava to publish and maintain x. If it can't, ask Bea, then Dee.", `got ${show(three)}`);
});

test('T2: dutyRows — rank, title, key, level, Preferred, Not tagged, Alternates, sentence and raw, in duty order', async () => {
  const m = await vm();
  const duties = need(m, 'treasureMapDuties')(MAP);
  const rows = need(m, 'dutyRows')(duties, NAMES, [{ pubkey: A }, { pubkey: B }, { pubkey: LOCAL }]);
  assert(show(rows.map((r) => r.key)) === show(ORDER) && show(rows.map((r) => r.rank)) === show(ORDER.map((_, i) => i + 1)), `order and ranks; got ${show(rows.map((r) => [r.rank, r.key]))}`);
  const rank = rows.find((r) => r.key === '30382:rank');
  assert(rank.title === 'rank' && rank.level === 'Exact' && rank.preferred === 'Ava' && rank.untagged === false && show(rank.alternates) === show(['Bea']),
    `the rank row; got ${show(rank)}`);
  assert(plain(rank.sentence) === "I entrust Ava to publish and maintain a rank for every profile, as seen from my trusted community. If it can't, ask Bea.", `sentence; got ${show(rank.sentence)}`);
  assert(typeof rank.raw === 'string' && (rank.raw.match(/"30382:rank"/g) || []).length === 3 && rank.raw.includes(A), `raw shows its three entries in full; got ${show(rank.raw)}`);
  const lists = rows.find((r) => r.key === '30392');
  assert(lists.preferred === 'Dee' && lists.untagged === true && lists.alternates.length === 0, `a Preferred not in the list is Not tagged; got ${show(lists)}`);
  const eRow = rows.find((r) => r.key === '30394');
  assert(eRow.preferred === m.npubShort(E), `a nameless Assistant is its shortened npub; got ${show(eRow.preferred)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// H — the shared hook's strict option
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('H1: useTreasureMap takes { strict } and, with it, asks /api/relay/external with strict=1 (callers without it unchanged)', () => {
  const src = safeRead(HOOK);
  assert(/export default function useTreasureMap\(\s*pubkey\s*,\s*\{\s*strict\s*=\s*false\s*\}\s*=\s*\{\}\s*\)/.test(src),
    `${rel(HOOK)} should be useTreasureMap(pubkey, { strict = false } = {}) (ADR 0003 sub-decision 1)`);
  assert(/strict=1/.test(src), `${rel(HOOK)} should add strict=1 to the relay read when strict`);
  for (const caller of ['ui/src/pages/grapevine/MyCuratedDLists.jsx', 'ui/src/pages/grapevine/CuratedDListDetail.jsx']) {
    assert(/useTreasureMap\(user\?\.pubkey \|\| null\)/.test(safeRead(path.join(REPO, caller))), `${caller} should still call useTreasureMap without the option`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// S — sentinels
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('S1: the two new page files exist and hold no 64-hex literal', () => {
  for (const f of ['DutiesTab.jsx', 'MapOnlySection.jsx']) {
    const src = safeRead(path.join(PAGE_DIR, f));
    assert(src, `ui/src/pages/assistants/${f} does not exist (ADR 0003 § Implementation notes)`);
    const hex = src.match(/[0-9a-f]{64}/i);
    assert(!hex, `${f} has a 64-hex literal`);
  }
});

test('S2: the page\'s withdrawal publisher sends to the relays it is handed, and names no relay list itself (ADR 0003 sub-decision 6)', () => {
  // The report's relay rows come from the list the page hands assistantActions (describeTaggingPublish's `relays`),
  // not from the send, so no browser test can see a page that sends somewhere else. O9 pins the orchestration's half.
  const src = safeRead(path.join(PAGE_DIR, 'Index.jsx'));
  const line = (src.match(/withdrawTaggings\s*:\s*([^\n]+)/) || [])[1] || '';
  assert(line, 'ui/src/pages/assistants/Index.jsx has no withdrawTaggings dependency');
  assert(!/[A-Z_]+_RELAYS\b/.test(line), `withdrawTaggings should forward the relays it is given, not name a list; got ${show(line.trim())}`);
  const forwards = /\brelays\b/.test(line) || /\.\.\.\w+/.test(line) || /\(\s*(\w+)\s*\)\s*=>\s*publishTaggingWithdrawalWithReport\(\s*\1\s*\)/.test(line);
  assert(forwards, `withdrawTaggings should pass its relays on; got ${show(line.trim())}`);
  assert(/withdrawRelays\s*:/.test(src), 'the page should still hand assistantActions a withdrawRelays list');
});

async function run() {
  console.log(`${NL}=== my-assistants-map (my-assistants #3) ===`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}my-assistants-map: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
