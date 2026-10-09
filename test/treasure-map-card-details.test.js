'use strict';
/**
 * treasure-map-card-details #2: Show details — each card's assignments on /treasure-map, entry by entry.
 *
 * Story: engineering-team/stories/treasure-map-card-details/2-show-details-panel.md (Light profile; the test plan is
 *        the story's Edge cases and AC→handle lines)
 * Browser half: tests/brainstorm/treasure-map-card-details.spec.js (what a viewer sees and does).
 *
 *   U — categoryEntries(event) in ui/src/pages/treasure-map/manageTreasureMap.js, pure: the card rule's one walk,
 *       keeping every key and every valid tag.                                                     [AC-2, AC-3, AC-4]
 *   A — agreement: categoryAssistants is exactly the distinct first Assistants of categoryEntries' keys, over every
 *       Map the card-rule suites use and the story's edge cases.                                               [AC-7]
 *   W — the panel's words in COPY.                                                                     [AC-1–AC-4, AC-8]
 *   S — wiring: categoryAssistants derives from categoryEntries; the page reads categoryEntries from the published
 *       Map in view mode and from the draft in Edit mode; the name lookup covers every Assistant in the panels;
 *       the labels come from entryRole; the toggle is a real disclosure button.              [AC-1, AC-3, AC-5–AC-8]
 *
 * U, W and S FAIL against the code before the story: manageTreasureMap.js exports no categoryEntries and COPY has no
 * details words; the page has no details panel. A fails too (categoryEntries is missing).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const VIEW_MODEL = path.join(REPO, 'ui/src/pages/treasure-map/manageTreasureMap.js');
const PAGE = path.join(REPO, 'ui/src/pages/treasure-map/Index.jsx');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const C = 'c3'.repeat(32);
const D = 'd1'.repeat(32);
const E = 'e1'.repeat(32);
const L = 'a2'.repeat(32);
const R1 = 'wss://one.example';
const R2 = 'wss://two.example';
const LETTER = { [A]: 'A', [B]: 'B', [C]: 'C', [D]: 'D', [E]: 'E', [L]: 'L' };

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v, (k, x) => (typeof x === 'string' && LETTER[x] ? LETTER[x] : x));
const rel = (p) => path.relative(REPO, p);
const clone = (v) => JSON.parse(JSON.stringify(v));

function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}
let cached = null;
async function viewModel() {
  if (cached) return cached;
  assert(fs.existsSync(VIEW_MODEL), `${rel(VIEW_MODEL)} does not exist`);
  try { cached = await import(`${pathToFileURL(VIEW_MODEL).href}?t=${Date.now()}`); } catch (err) {
    throw new Error(`${rel(VIEW_MODEL)} could not be loaded in Node: ${err.message}`);
  }
  return cached;
}
async function fn(name) {
  const mod = await viewModel();
  assert(typeof mod[name] === 'function', `${rel(VIEW_MODEL)} does not export ${name}() (story 2 design note)`);
  return mod[name];
}
const mapOf = (tags) => ({ id: '9'.repeat(64), pubkey: 'a1'.repeat(32), kind: 10040, created_at: 1, content: '', sig: 'f'.repeat(128), tags });
/** A compact view of one category's entries: "key[norm]=A@relay,C@" per key. */
const compact = (list) => (Array.isArray(list)
  ? list.map((e) => `${e.key}${e.norm !== e.key ? `[${e.norm}]` : ''}=${(e.tags || []).map((t) => `${LETTER[t.pubkey] || t.pubkey}@${t.relay}`).join(',')}`).join(' ')
  : show(list));

async function expectEntries(tags, want, label) {
  const categoryEntries = await fn('categoryEntries');
  const event = mapOf(tags);
  const before = clone(event);
  let got;
  try { got = categoryEntries(event); } catch (err) { throw new Error(`${label}: threw ${err.message}`); }
  assert(show(event) === show(before), `${label}: categoryEntries changed its input`);
  const wrong = [];
  for (const [category, line] of Object.entries(want)) {
    const g = compact(got && got[category]);
    if (g !== line) wrong.push(`${category}: want "${line}", got "${g}"`);
  }
  assert(wrong.length === 0, `${label}: ${wrong.join('; ')}`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// U — categoryEntries
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('U1: the shape — { scores, lists, concepts }, each a list of { key, norm, tags: [{ pubkey, relay }] }; nothing else on an entry or a tag', async () => {
  const categoryEntries = await fn('categoryEntries');
  const got = categoryEntries(mapOf([['30382:rank', A, R1], ['30392', B, R2], ['39998', C, '']]));
  assert(show(Object.keys(got).sort()) === show(['concepts', 'lists', 'scores']), `keys ${show(Object.keys(got))}`);
  const wrong = [];
  for (const category of ['scores', 'lists', 'concepts']) {
    const list = got[category];
    if (!Array.isArray(list) || list.length !== 1) { wrong.push(`${category}: ${show(list)}`); continue; }
    if (show(Object.keys(list[0]).sort()) !== show(['key', 'norm', 'tags'])) wrong.push(`${category} entry keys ${show(Object.keys(list[0]))}`);
    if (show(Object.keys(list[0].tags[0]).sort()) !== show(['pubkey', 'relay'])) wrong.push(`${category} tag keys ${show(Object.keys(list[0].tags[0]))}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U2: no event, no tags, or garbage — three empty lists, never a throw (AC-4)', async () => {
  const categoryEntries = await fn('categoryEntries');
  const wrong = [];
  for (const ev of [null, undefined, {}, { tags: null }, { tags: 'x' }, mapOf([]), mapOf([null, 'x', 42, [], [7, A], ['30382:rank']])]) {
    let got;
    try { got = categoryEntries(ev); } catch (err) { wrong.push(`${show(ev)} threw ${err.message}`); continue; }
    if (show(got) !== show({ scores: [], lists: [], concepts: [] })) wrong.push(`${show(ev)} → ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U3: keys in the order the Map first names them; each key\'s valid tags in Map order, relay as written (AC-2)', () =>
  expectEntries([['30382:rank', A, R1], ['30382:followers', A, R1], ['30392', L, R2], ['30382:rank', C, ''], ['39998', L, R2]], {
    scores: '30382:rank=A@wss://one.example,C@ 30382:followers=A@wss://one.example',
    lists: '30392=L@wss://two.example',
    concepts: '39998=L@wss://two.example',
  }, 'U3'));

test('U4: E2 — one key in two spellings is one key, shown in its first spelling, the second tag after the first', () =>
  expectEntries([['30382:rank', A, R1], ['30382:rank:', C, R2]], {
    scores: '30382:rank=A@wss://one.example,C@wss://two.example',
  }, 'U4'));

test('U5: E3 — `39998:dlist-header` and `39998` are one Concepts key, in whichever spelling comes first', async () => {
  await expectEntries([['39998', A, R1], ['39998:dlist-header', B, R2]], { concepts: '39998=A@wss://one.example,B@wss://two.example' }, 'U5a');
  await expectEntries([['39998:dlist-header', B, R2], ['39998', A, R1]], { concepts: '39998:dlist-header[39998]=B@wss://two.example,A@wss://one.example' }, 'U5b');
});

test('U6: E4 (J1 advisory) — a tag with no valid Assistant is left out; when it carries a key\'s first spelling, the first valid tag\'s spelling and Assistant lead', async () => {
  await expectEntries([['30382:rank:', 'not-a-key', R1], ['30382:rank', A, R2]], { scores: '30382:rank=A@wss://two.example' }, 'U6a');
  await expectEntries([['30382:rank', A, R1], ['30382:rank', 'c'.repeat(63), R2], ['30382:rank', C, '']], { scores: '30382:rank=A@wss://one.example,C@' }, 'U6b');
  await expectEntries([['3038x', 'not-a-key', R1]], { scores: '', lists: '', concepts: '' }, 'U6c');
});

test('U7: E5 — the same Assistant twice on one key is listed twice', () =>
  expectEntries([['30392', B, R1], ['30392', B, R2]], { lists: '30392=B@wss://one.example,B@wss://two.example' }, 'U7'));

test('U8: AC-3 / E8 — a bare `*` is listed where it reaches; a family entry covering it hides it there; `*:…` never listed', async () => {
  await expectEntries([['*', D, R1], ['*:tag', A, R1], ['*:rank', A, R1]], {
    scores: '*=D@wss://one.example', lists: '*=D@wss://one.example', concepts: '*=D@wss://one.example',
  }, 'U8a');
  await expectEntries([['*', D, R1], ['3038x', A, R2], ['39998:dlist-header', B, '']], {
    scores: '3038x=A@wss://two.example', lists: '*=D@wss://one.example', concepts: '39998:dlist-header[39998]=B@',
  }, 'U8b');
  await expectEntries([['*:', D, R1]], { scores: '*:[*]=D@wss://one.example' }, 'U8c');
});

test('U9: other categories\' entries, unknown kinds and non-entry tags are in no category\'s list; individual duties are listed', () =>
  expectEntries([['p', A], ['client', 'x'], ['99999', A, R1], ['3038x:tag:X1', C, R1], ['30396:tag:X:T', D, R1], ['39998:restaurants', C, R2]], {
    scores: '3038x:tag:X1=C@wss://one.example',
    lists: '30396:tag:X:T=D@wss://one.example',
    concepts: '39998:restaurants=C@wss://two.example',
  }, 'U9'));

test('U10: an Assistant in upper case is listed in lower case; a missing or non-text relay is ""', () =>
  expectEntries([['30382:rank', B.toUpperCase(), R1], ['30392', A], ['39998', C, 42]], {
    scores: '30382:rank=B@wss://one.example', lists: '30392=A@', concepts: '39998=C@',
  }, 'U10'));

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// A — the card and its panel never disagree (AC-7)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const AGREEMENT_MAPS = [
  [],
  [['30382:rank', A], ['30382:followers', A], ['30392', L], ['39998:dlist-header', L], ['39998:restaurants', C], ['*:tag', D]],
  [['30382:rank', A], ['30382:rank', C], ['3038x:tag:X1', C], ['30382:tag:X2', B], ['30392', L], ['30396:tag:X1:T1', D],
    ['39998:dlist-header', L], ['39998:restaurants', C], ['39998:restaurants', B], ['*:tag', D], ['*:tag', A], ['31234:foo', A]],
  [['*', A]], [['*', A], ['3038x', B]], [['*', A], ['3039x:', B], ['39998', C]], [['*:', A], ['*::', B]],
  [['3038x:', 'not-a-key'], ['*', D]], [['30382:rank:', A], ['30382:rank', B]], [['39999', A], ['39999:dlist-header', B]],
  [['39998:a:b', A], ['39998:a', B]], [['3039x:rank', D]], [['30382:rank', C], ['30382:rank', A], ['30382:followers', C], ['*', E]],
  [['3038x', 'not-a-key'], ['30382:rank', 'c'.repeat(63)], ['30382:rank', B]],
];

test('A1: over every Map the card-rule suites use and the edge cases, categoryAssistants is the distinct first Assistants of categoryEntries\' keys, in order', async () => {
  const categoryEntries = await fn('categoryEntries');
  const categoryAssistants = await fn('categoryAssistants');
  const wrong = [];
  for (const rows of AGREEMENT_MAPS) {
    const event = mapOf(rows.map(([k, pk, r = R1]) => [k, pk, r]));
    const entries = categoryEntries(event);
    const cards = categoryAssistants(event);
    for (const category of ['scores', 'lists', 'concepts']) {
      const firsts = [];
      for (const e of entries[category]) if (!firsts.includes(e.tags[0].pubkey)) firsts.push(e.tags[0].pubkey);
      if (show(firsts) !== show(cards[category])) wrong.push(`${show(rows)} ${category}: panel firsts ${show(firsts)}, card ${show(cards[category])}`);
    }
  }
  assert(wrong.length === 0, wrong.join(NL + '        '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// W — words
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('W1: COPY holds the panel\'s words — Show details, Hide details, "<Title> details", Backup, Individually assigned, Everything else, No relay, No entries yet.', async () => {
  const { COPY } = await viewModel();
  const want = {
    showDetails: 'Show details', hideDetails: 'Hide details', backup: 'Backup', individual: 'Individually assigned',
    everythingElse: 'Everything else', noRelay: 'No relay', noEntries: 'No entries yet.',
  };
  const wrong = Object.entries(want).filter(([k, v]) => COPY[k] !== v).map(([k, v]) => `${k}: want ${show(v)}, got ${show(COPY[k])}`);
  if (typeof COPY.detailsLabel !== 'function') wrong.push('detailsLabel is not a function');
  else for (const t of ['Scores', 'Lists', 'Concepts']) if (COPY.detailsLabel(t) !== `${t} details`) wrong.push(`detailsLabel(${t}) is ${show(COPY.detailsLabel(t))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// S — wiring
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('S1: categoryAssistants is a projection of categoryEntries (one walk of the card rule), and keeps its JSDoc', () => {
  const src = codeOnly(safeRead(VIEW_MODEL));
  const raw = safeRead(VIEW_MODEL);
  const start = src.indexOf('export function categoryAssistants(');
  assert(start >= 0, `${rel(VIEW_MODEL)} has no categoryAssistants`);
  const body = src.slice(start, src.indexOf(NL + '}', start));
  const wrong = [];
  if (!/\bcategoryEntries\s*\(/.test(body)) wrong.push('categoryAssistants doesn\'t call categoryEntries');
  if (/\bappliesTo\s*\(|\bshadowed\s*\(|\bentryOf\b/.test(body)) wrong.push('categoryAssistants still walks the tags itself');
  if (!/that names anything after the `\*`[\s\S]{0,600}\*\/\s*export function categoryAssistants\(/.test(raw)) {
    wrong.push('the JSDoc directly above categoryAssistants lost "that names anything after the `*`" (treasure-map-edit-mode W4)');
  }
  assert(wrong.length === 0, `${rel(VIEW_MODEL)}: ${wrong.join('; ')}`);
});

test('S2: the page reads categoryEntries — from the published Map, and from the draft in Edit mode (AC-5)', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  const wrong = [];
  if (!/import\s*\{[^}]*\bcategoryEntries\b[^}]*\}\s*from\s*['"]\.\/manageTreasureMap(\.js)?['"]/.test(src)) wrong.push('it doesn\'t import categoryEntries from ./manageTreasureMap');
  if (!/categoryEntries\(\s*event\s*\)/.test(src)) wrong.push('no categoryEntries(event) for the published Map');
  if (!/categoryEntries\(\s*draft\s*\)/.test(src)) wrong.push('no categoryEntries(draft) for Edit mode');
  assert(wrong.length === 0, `${rel(PAGE)}: ${wrong.join('; ')}`);
});

test('S3: the name lookup covers every Assistant the panels list — built from categoryEntries\' tags, not only the counted Assistants (AC-6, E1)', () => {
  const src = codeOnly(safeRead(PAGE));
  const at = src.indexOf('const wantedKey');
  assert(at >= 0, `${rel(PAGE)} has no wantedKey`);
  const decl = src.slice(at, src.indexOf(';', src.indexOf('],', at)) + 1);
  const wrong = [];
  if (!/\.tags\b/.test(decl)) wrong.push('wantedKey isn\'t built from the entries\' tags');
  if (/assistants\.scores|assistants\.lists|assistants\.concepts/.test(decl)) wrong.push('wantedKey is still built from the counted Assistants only');
  if (!/fetchProfilesChunked\([\s\S]{0,80}\)\s*\.catch\(\s*\(\)\s*=>\s*\(\{\}\)\s*\)/.test(src)) wrong.push('a failed lookup no longer settles to {} (E1)');
  assert(wrong.length === 0, `${rel(PAGE)}: ${wrong.join('; ')}`);
});

test('S4: the labels come from entryRole (Individually assigned) and the `*` key (Everything else); the words from COPY', () => {
  const src = codeOnly(safeRead(PAGE));
  const wrong = [];
  if (!/import\s*\{[^}]*\bentryRole\b[^}]*\}\s*from\s*['"]\.\/editTreasureMap(\.js)?['"]/.test(src)) wrong.push('it doesn\'t import entryRole from ./editTreasureMap');
  if (!/entryRole\([^)]*\)\s*===\s*['"]individual['"]/.test(src)) wrong.push('no entryRole(…) === \'individual\'');
  for (const word of ['showDetails', 'hideDetails', 'detailsLabel', 'backup', 'individual', 'everythingElse', 'noRelay', 'noEntries']) {
    if (!new RegExp(`COPY\\.${word}\\b`).test(src)) wrong.push(`COPY.${word} isn't used`);
  }
  if (/['"](Show details|Hide details|Backup|Individually assigned|Everything else|No relay|No entries yet\.)['"]/.test(src)) wrong.push('a panel word is retyped as a literal');
  assert(wrong.length === 0, `${rel(PAGE)}: ${wrong.join('; ')}`);
});

test('S5: the toggle is a real disclosure button — type="button", aria-expanded, aria-controls — and the panel a named region (AC-8)', () => {
  const src = codeOnly(safeRead(PAGE));
  const wrong = [];
  // The opening of the element a word sits in: from the last `<tag` before the word up to the word. (A JSX attribute
  // can hold `=>`, so the tag's end can't be found with [^>]*.)
  const opening = (word, tagName) => {
    const at = src.search(word);
    if (at < 0) return '';
    const start = src.lastIndexOf(`<${tagName}`, at);
    return start < 0 ? '' : src.slice(start, at);
  };
  const button = opening(/COPY\.(?:showDetails|hideDetails)\b/, 'button');
  if (!button) wrong.push('no <button> showing COPY.showDetails / COPY.hideDetails');
  else {
    if (!/type="button"/.test(button)) wrong.push('the toggle has no type="button"');
    if (!/aria-expanded=/.test(button)) wrong.push('the toggle has no aria-expanded');
    if (!/aria-controls=/.test(button)) wrong.push('the toggle has no aria-controls');
    // Gate B finding 1: three toggles share one name, so each is described by its card's title.
    if (!/aria-describedby=\{titleId\(card\.key\)\}/.test(button)) wrong.push('the toggle isn\'t described by its card\'s title');
  }
  const region = src.match(/<[a-z]+\b(?:(?!<[a-z])[\s\S]){0,300}?aria-label=\{COPY\.detailsLabel\(/);
  if (!region || !/role="region"/.test(region[0])) wrong.push('no role="region" named by COPY.detailsLabel(…)');
  assert(wrong.length === 0, `${rel(PAGE)}: ${wrong.join('; ')}`);
});

async function run() {
  console.log(`${NL}=== treasure-map-card-details (treasure-map-card-details #2) ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, f] of tests) {
    try {
      await f();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}treasure-map-card-details: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };
