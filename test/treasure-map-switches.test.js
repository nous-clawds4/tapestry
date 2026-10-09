'use strict';
/**
 * treasure-map-edit #4: Edit mode — the override switches and the backup switch.
 *
 * Story: engineering-team/stories/done/treasure-map-edit/4-override-and-backup-switches.md
 * ADR:   engineering-team/decisions/done/treasure-map-edit/0004-switches-are-part-of-the-one-pending-edit.md
 * Plan:  engineering-team/stories/done/treasure-map-edit/4-override-and-backup-switches.test-plan.md
 * Browser half: tests/brainstorm/treasure-map-switches.spec.js (what a viewer sees and does).
 *
 * Classes (pure unless noted; the edit model is ui/src/pages/treasure-map/editTreasureMap.js):
 *   I — individualDuties(tags, category, pubkey): what a card's override switch counts.                       [AC-1]
 *   O — editedTags with an override on: the duties leave the Map whole; nothing else moves.               [AC-1, AC-4]
 *   B — dropBackups and backupCount: every draft-grammar key keeps its first entry; nothing else is touched.   [AC-4]
 *   Q — planEdit: the duties, the backups left after assignments and overrides, the pending that takes
 *       effect, and the draft.                                                                     [AC-1, AC-4, AC-5]
 *   T — the steps: setOverride, setOverrideAll, setBackups; pickCategory, undoCategory, pickAll, undoAll with
 *       the switches and book decision 16.                                                       [AC-1..AC-4]
 *   A — overrideAllState: the All duties switch's count and state.                                            [AC-2]
 *   N — saveNote with the backup switch; overrides never count.                                                [AC-4]
 *   W — the words (story § Copy).                                                                    [AC-1, AC-2, AC-4]
 *   S — source sentinels: the hook's three actions; the page plans with planEdit and draws real switches.     [AC-6]
 *
 * Everything here FAILS against story 3's code: none of the new functions exist, editedTags ignores `override` and
 * `backups`, undoCategory keeps the everything entry's change, and COPY.edit has none of the switch words.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const DIR = path.join(REPO, 'ui/src/pages/treasure-map');
const EDIT_MODEL = path.join(DIR, 'editTreasureMap.js');
const VIEW_MODEL = path.join(DIR, 'manageTreasureMap.js');
const EDIT_HOOK = path.join(DIR, 'useMapEdit.js');
const PAGE = path.join(DIR, 'Index.jsx');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const C = 'c3'.repeat(32);
const D = 'd1'.repeat(32);
const VIEWER = 'a1'.repeat(32);
const R0 = 'wss://old.example';
const LETTER = { [A]: 'A', [B]: 'B', [C]: 'C', [D]: 'D', [VIEWER]: 'V' };
const NAMES = { [A]: 'Ava', [B]: 'Bea', [C]: 'Cy', [D]: 'Dee' };
const nameOf = (pk) => NAMES[pk] || 'someone';
/** A relayFor that shows who and which category it was asked for. */
const rf = (pk, cat) => `wss://${cat}.${LETTER[pk] || 'x'}`;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v, (k, x) => (typeof x === 'string' && LETTER[x] ? LETTER[x] : x));
const rel = (p) => path.relative(REPO, p);
const clone = (v) => JSON.parse(JSON.stringify(v));
/** The same keys and values, in any key order, nested objects included. */
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const sameObj = (a, b) => !!a && typeof a === 'object' && show(canon(a)) === show(canon(b));
/** [key, who, relay?] rows as tags, every relay R0 unless given. */
const T = (rows) => rows.map(([k, pk, r = R0, ...extra]) => (pk === undefined ? [k] : [k, pk, r, ...extra]));

function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

const cache = {};
async function esm(absPath, what) {
  if (cache[absPath]) return cache[absPath];
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  try { cache[absPath] = await import(`${pathToFileURL(absPath).href}?t=${Date.now()}`); } catch (err) {
    throw new Error(`${rel(absPath)} could not be loaded in Node: ${err.message}`);
  }
  return cache[absPath];
}
async function fn(name) {
  const mod = await esm(EDIT_MODEL, 'The edit model (ADR treasure-map-edit/0003 sub-decision 2).');
  assert(typeof mod[name] === 'function', `${rel(EDIT_MODEL)} does not export ${name}() (ADR treasure-map-edit/0004)`);
  return mod[name];
}
async function viewModel() { return esm(VIEW_MODEL, 'The page view-model.'); }
function call(f, ...args) {
  try { return f(...args); } catch (err) { throw new Error(`${f.name || 'it'}(${args.map(show).join(', ')}) threw ${err.message}`); }
}

/** editedTags over rows, compared in full, with the input checked unchanged. */
async function expectEdited(rows, pending, wantRows, label) {
  const editedTags = await fn('editedTags');
  const tags = T(rows);
  const before = clone(tags);
  const pend = clone(pending);
  const got = call(editedTags, tags, pending, rf);
  const want = T(wantRows);
  assert(show(tags) === show(before), `${label}: editedTags changed its tags`);
  assert(show(pending) === show(pend), `${label}: editedTags changed its pending`);
  assert(show(got) === show(want), `${label} — ${show(rows)} with ${show(pending)}:${NL}        want ${show(want)}${NL}        got  ${show(got)}`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// I — individualDuties: what a card's override switch counts (AC-1, story 4 default 1)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('I1: Scores — the individual entries naming anyone other than the pending Assistant, each key once, in first-seen order', async () => {
  const individualDuties = await fn('individualDuties');
  const tags = T([
    ['30382:rank', A], ['3038x', A],                 // own: never counted
    ['3038x:tag:X', C], ['30382:tag:X:T:rank', D],   // individual, naming others: counted
    ['3038x:tag:X', C],                              // the same key again: once
    ['30382:tag:Y', B],                              // names only the pending Assistant: not counted
    ['30383:pin:P', B], ['30383:pin:P', C],          // names B, then C: counted
    ['30392:rank', C], ['39998:d', C],               // other categories: not counted
  ]);
  const got = call(individualDuties, tags, 'scores', B);
  const want = ['3038x:tag:X', '30382:tag:X:T:rank', '30383:pin:P'];
  assert(show(got) === show(want), `want ${show(want)}, got ${show(got)}`);
});
test('I2: Lists and Concepts — their own narrower entries; a family or whole-kind entry never counts', async () => {
  const individualDuties = await fn('individualDuties');
  const lists = call(individualDuties, T([['30392', A], ['3039x', A], ['30396:tag:X:T', C], ['3039x:dlist:Q', D], ['30392:rank', B]]), 'lists', B);
  assert(show(lists) === show(['30396:tag:X:T', '3039x:dlist:Q']), `Lists: got ${show(lists)}`);
  const concepts = call(individualDuties, T([['39998:dlist-header', A], ['39998', C], ['39999', C], ['39998:restaurants', C], ['39998:restaurants', B], ['39999:x', D], ['39998:dogs', B]]), 'concepts', B);
  assert(show(concepts) === show(['39998:restaurants', '39999:x']), `Concepts: got ${show(concepts)}`);
});
test('I3: never a `*` or `*:…` entry (book decision 11), an invalid tag, or a non-grammar tag', async () => {
  const individualDuties = await fn('individualDuties');
  const tags = [...T([['*', C], ['*:tag', C], ['*:tag:X:T:rank', D], ['3038x:tag:X', 'not-hex']]), ['30382:tag:Z'], null, 'x', ['p', C], ['alt', D]];
  for (const category of ['scores', 'lists', 'concepts']) {
    const got = call(individualDuties, tags, category, B);
    assert(Array.isArray(got) && got.length === 0, `${category}: want [], got ${show(got)}`);
  }
});
test('I4: no tags, no pending Assistant, or garbage — an empty list, never a throw', async () => {
  const individualDuties = await fn('individualDuties');
  for (const [tags, pk] of [[[], B], [undefined, B], [null, B], [T([['3038x:tag:X', C]]), undefined]]) {
    let got;
    try { got = individualDuties(tags, 'scores', pk); } catch (err) { got = `threw ${err.message}`; }
    if (pk === undefined) assert(Array.isArray(got), `no pending Assistant: want a list, got ${show(got)}`);
    else assert(Array.isArray(got) && got.length === 0, `${show(tags)}: want [], got ${show(got)}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// O — editedTags with an override on (AC-1, AC-4's table rows 1–5)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('O1: AC-4 row 1 — `3038x` → A, `3038x:tag:<X>` → C; Scores → B, override on', () => expectEdited(
  [['3038x', A], ['3038x:tag:X', C]],
  { scores: B, override: { scores: true } },
  [['3038x', B, 'wss://scores.B']],
  'row 1'));
test('O2: AC-4 rows 2–3 — Lists → B: the duty naming C goes, the one naming only B stays, `3039x` is added', () => expectEdited(
  [['30392', A], ['30396:tag:X:T', C], ['30396:tag:Y:T', B]],
  { lists: B, override: { lists: true } },
  [['30392', B, 'wss://lists.B'], ['30396:tag:Y:T', B], ['3039x', B, 'wss://lists.B']],
  'row 3'));
test('O3: AC-4 row 4 — Concepts → B: both `39998:<d>` entries go (one names C); `39999` → B is added', () => expectEdited(
  [['39998', A], ['39998:d', C], ['39998:d', B]],
  { concepts: B, override: { concepts: true } },
  [['39998', B, 'wss://concepts.B'], ['39999', B, 'wss://concepts.B']],
  'row 4'));
test('O4: AC-4 row 5 — a `*:…` entry is never a duty: it stays, in its place', () => expectEdited(
  [['*:tag', D], ['3038x:tag:X', C]],
  { scores: B, override: { scores: true } },
  [['*:tag', D], ['3038x', B, 'wss://scores.B']],
  'row 5'));
test('O5: an override with no pending Assistant for its card, or a pending card with its override off, removes nothing', async () => {
  const rows = [['30382:rank', A], ['3038x:tag:X', C], ['30392', A], ['30396:tag:X:T', C]];
  await expectEdited(rows, { override: { scores: true, lists: true } }, rows, 'override with nothing pending');
  await expectEdited(rows, { lists: B, override: { scores: true } }, [['30382:rank', A], ['3038x:tag:X', C], ['30392', B, 'wss://lists.B'], ['30396:tag:X:T', C], ['3039x', B, 'wss://lists.B']], 'Scores override, only Lists pending');
});
test('O6: removal keeps every other tag byte for byte and in place, extra elements included', () => expectEdited(
  [['alt', 'x'], ['3038x:tag:X', C, 'wss://c.example', 'extra'], ['30382:rank', A, 'wss://a.example', 'more'], ['p', VIEWER], ['3038x:tag:X', D]],
  { scores: B, override: { scores: true } },
  [['alt', 'x'], ['30382:rank', B, 'wss://scores.B', 'more'], ['p', VIEWER], ['3038x', B, 'wss://scores.B']],
  'extras'));

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// B — dropBackups and backupCount (AC-4, book decisions 8 and 11)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('B1: every key keeps only its first entry; later ones go, a repeat of the same Assistant included; order kept', async () => {
  const dropBackups = await fn('dropBackups');
  const tags = T([['30382:rank', A], ['30392', B], ['30382:rank', C], ['30392', B], ['3038x', D], ['30382:rank', D]]);
  const before = clone(tags);
  const got = call(dropBackups, tags);
  assert(show(tags) === show(before), 'dropBackups changed its input');
  const want = T([['30382:rank', A], ['30392', B], ['3038x', D]]);
  assert(show(got) === show(want), `want ${show(want)}, got ${show(got)}`);
});
test('B2: two spellings of one key are one key (`39998:dlist-header` and `39998`; `3038x:` and `3038x`)', async () => {
  const dropBackups = await fn('dropBackups');
  const got = call(dropBackups, T([['39998:dlist-header', A], ['39998', C], ['3038x', B], ['3038x:', D], ['30382:rank:', A], ['30382:rank', C]]));
  const want = T([['39998:dlist-header', A], ['3038x', B], ['30382:rank:', A]]);
  assert(show(got) === show(want), `want ${show(want)}, got ${show(got)}`);
});
test('B3: it reaches the whole Map — `*`, `*:…` entries and keys this page doesn\'t read (book decisions 8 and 11)', async () => {
  const dropBackups = await fn('dropBackups');
  const got = call(dropBackups, T([['*', A], ['*', B], ['*:tag', D], ['*:tag', A], ['31234:foo', A], ['31234:foo', C], ['3039x:tag:X:T', B], ['3039x:tag:X:T', C]]));
  const want = T([['*', A], ['*:tag', D], ['31234:foo', A], ['3039x:tag:X:T', B]]);
  assert(show(got) === show(want), `want ${show(want)}, got ${show(got)}`);
});
test('B4: tags that aren\'t draft-grammar entries are never touched, even when they repeat with a 64-hex second element', async () => {
  const dropBackups = await fn('dropBackups');
  const tags = [['p', VIEWER], ['p', VIEWER], ['alt', A], ['alt', A], ['client', 'x'], ['client', 'x'], ['3038x', 'not-hex'], ['3038x', 'not-hex'], ['30382'], ['abcd', A], ['abcd', B], ['303821', A], ['303821', B]];
  const got = call(dropBackups, tags);
  assert(show(got) === show(tags), `want every tag kept: ${show(tags)}; got ${show(got)}`);
});
test('B5: backupCount is how many tags dropBackups removes; none for a Map without backups, no tags, or garbage', async () => {
  const backupCount = await fn('backupCount');
  const cases = [
    [T([['30382:rank', A], ['30382:rank', C], ['*:tag', D], ['*:tag', A], ['p', VIEWER], ['p', VIEWER]]), 2],
    [T([['39998:dlist-header', A], ['39998', C], ['39998', D]]), 2],
    [T([['30382:rank', A], ['30392', B]]), 0],
    [[], 0], [undefined, 0], [null, 0],
  ];
  const wrong = [];
  for (const [tags, want] of cases) {
    let got;
    try { got = backupCount(tags); } catch (err) { got = `threw ${err.message}`; }
    if (got !== want) wrong.push(`${show(tags)}: want ${want}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});
test('B6: AC-4 row 6 — the backup switch alone: `30382:rank` and `*:tag` keep their first Assistants', () => expectEdited(
  [['30382:rank', A], ['30382:rank', C], ['*:tag', D], ['*:tag', A]],
  { backups: true },
  [['30382:rank', A], ['*:tag', D]],
  'row 6'));
test('B7: AC-4 row 7 — Scores → B with the backup switch: the moved entry\'s backup goes; `3038x` → B is added', () => expectEdited(
  [['30382:rank', A], ['30382:rank', C]],
  { scores: B, backups: true },
  [['30382:rank', B, 'wss://scores.B'], ['3038x', B, 'wss://scores.B']],
  'row 7'));
test('B8: AC-4 row 8 — `39998:dlist-header` → A, `39998` → C: the second spelling is the backup', () => expectEdited(
  [['39998:dlist-header', A], ['39998', C]],
  { backups: true },
  [['39998:dlist-header', A]],
  'row 8'));

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Q — planEdit (ADR 0004 sub-decision 2)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const MAP = { id: '9'.repeat(64), pubkey: VIEWER, created_at: 1790121600, kind: 10040, content: 'kept', sig: 'f'.repeat(128),
  tags: T([
    ['30382:rank', A], ['30382:rank', C], ['3038x:tag:X', C], ['30382:tag:Y', B],
    ['30392', A], ['30396:tag:X:T', D],
    ['39998:dlist-header', A], ['39998:restaurants', C], ['39998:restaurants', B],
    ['*:tag', D], ['*:tag', A], ['31234:foo', A], ['31234:foo', C], ['p', VIEWER], ['p', VIEWER],
  ]) };
async function plan(pending, event = MAP) {
  const planEdit = await fn('planEdit');
  const before = clone(event);
  const pend = clone(pending);
  const got = call(planEdit, { event, viewer: VIEWER, pending, relayFor: rf });
  assert(show(event) === show(before), 'planEdit changed the event');
  assert(show(pending) === show(pend), 'planEdit changed its pending');
  assert(got && typeof got === 'object', `planEdit returned ${show(got)}`);
  return got;
}

test('Q1: duties — each pending card\'s individualDuties against its own Assistant; [] for a card not pending', async () => {
  const got = await plan({ scores: B, concepts: B });
  const want = { scores: ['3038x:tag:X'], lists: [], concepts: ['39998:restaurants'] };
  assert(sameObj(got.duties, want), `want ${show(want)}, got ${show(got.duties)}`);
  const all = await plan({ scores: C, lists: C, concepts: C, everything: C });
  const wantAll = { scores: ['30382:tag:Y'], lists: ['30396:tag:X:T'], concepts: ['39998:restaurants'] };
  assert(sameObj(all.duties, wantAll), `Assign to all → C: want ${show(wantAll)}, got ${show(all.duties)}`);
});
test('Q2: backups — counted after the assignments and overrides: a moved entry keeps its backup; an overridden key\'s don\'t count', async () => {
  const none = await plan({});
  assert(none.backups === 4, `nothing pending: want 4 (30382:rank, 39998:restaurants, *:tag, 31234:foo), got ${show(none.backups)}`);
  const moved = await plan({ scores: B });
  assert(moved.backups === 4, `Scores → B: the moved 30382:rank keeps its backup C: want 4, got ${show(moved.backups)}`);
  const over = await plan({ concepts: B, override: { concepts: true } });
  assert(over.backups === 3, `Concepts → B, override on: 39998:restaurants goes whole: want 3, got ${show(over.backups)}`);
  const on = await plan({ backups: true });
  assert(on.backups === 4, `the switch on: still counts what it removes: want 4, got ${show(on.backups)}`);
});
test('Q3: pending — `backups` dropped when there are none to remove; kept otherwise; nothing else touched', async () => {
  const kept = await plan({ scores: B, backups: true, override: { scores: true } });
  assert(sameObj(kept.pending, { scores: B, backups: true, override: { scores: true } }), `with backups: got ${show(kept.pending)}`);
  const single = { ...MAP, tags: T([['30382:rank', A], ['3038x:tag:X', C], ['3038x:tag:X', A]]) };
  const gone = await plan({ scores: B, backups: true, override: { scores: true } }, single);
  assert(gone.backups === 0, `the override removed the only backup: want 0, got ${show(gone.backups)}`);
  assert(sameObj(gone.pending, { scores: B, override: { scores: true } }), `want backups dropped: got ${show(gone.pending)}`);
});
test('Q4: draft — the viewer\'s kind 10040, content kept, no id or signature, tags as editedTags makes them with the effective pending', async () => {
  const editedTags = await fn('editedTags');
  const pending = { scores: B, override: { scores: true }, backups: true };
  const got = await plan(pending);
  const d = got.draft || {};
  assert(d.kind === 10040 && d.pubkey === VIEWER && d.content === 'kept', `draft head: ${show({ kind: d.kind, pubkey: d.pubkey, content: d.content })}`);
  assert(!('id' in d) && !('sig' in d) && !('created_at' in d), `draft has ${show(Object.keys(d))}`);
  const want = editedTags(MAP.tags, pending, rf);
  assert(show(d.tags) === show(want), `want ${show(want)}, got ${show(d.tags)}`);
  assert(show(d.tags).includes('"p"') && d.tags.filter((t) => t[0] === 'p').length === 2, 'both p tags must survive');
});
test('Q5: no Map — no duties, no backups, a draft with only what the assignments add', async () => {
  const got = await plan({ lists: B, backups: true }, null);
  assert(sameObj(got.duties, { scores: [], lists: [], concepts: [] }), `duties: ${show(got.duties)}`);
  assert(got.backups === 0, `backups: ${show(got.backups)}`);
  assert(sameObj(got.pending, { lists: B }), `pending: ${show(got.pending)}`);
  assert(show(got.draft && got.draft.tags) === show([['3039x', B, 'wss://lists.B']]), `draft tags: ${show(got.draft && got.draft.tags)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// T — the steps (ADR 0004 sub-decision 1; book decision 16)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('T1: setOverride, setOverrideAll, setBackups — on sets, off deletes; no empty override object or false flag; input unchanged', async () => {
  const setOverride = await fn('setOverride');
  const setOverrideAll = await fn('setOverrideAll');
  const setBackups = await fn('setBackups');
  const start = { scores: B };
  const a = call(setOverride, start, 'scores', true);
  assert(sameObj(a, { scores: B, override: { scores: true } }), `setOverride on: ${show(a)}`);
  assert(sameObj(start, { scores: B }), 'setOverride changed its input');
  const b = call(setOverride, a, 'scores', false);
  assert(sameObj(b, { scores: B }), `setOverride off, the last one: want no override key, got ${show(b)}`);
  // Re-aimed at treasure-map-edit #5's Test Design (book decision 18, ADR 0005 sub-decision 4): on turns on only the
  // cards with duties to override; off still clears all three.
  const duties = { scores: ['3038x:tag:X'], lists: ['30396:tag:X:T'], concepts: [] };
  const all = call(setOverrideAll, { everything: B, backups: true }, true, duties);
  assert(sameObj(all, { everything: B, backups: true, override: { scores: true, lists: true } }), `setOverrideAll on, Concepts without duties: ${show(all)}`);
  const allOff = call(setOverrideAll, { ...all, override: { scores: true, lists: true, concepts: true } }, false, duties);
  assert(sameObj(allOff, { everything: B, backups: true }), `setOverrideAll off: ${show(allOff)}`);
  const on = call(setBackups, {}, true);
  assert(sameObj(on, { backups: true }), `setBackups on: ${show(on)}`);
  const off = call(setBackups, on, false);
  assert(sameObj(off, {}), `setBackups off: want {}, got ${show(off)}`);
});
test('T2: pickCategory — another Assistant keeps the card\'s override; its current one cancels the card, its override and the everything change (decision 16)', async () => {
  const pickCategory = await fn('pickCategory');
  const start = { scores: B, lists: B, concepts: B, everything: B, override: { scores: true, lists: true }, backups: true };
  const other = call(pickCategory, start, 'scores', C, A);
  assert(sameObj(other, { ...start, scores: C }), `pick C: ${show(other)}`);
  const current = call(pickCategory, start, 'scores', A, A);
  assert(sameObj(current, { lists: B, concepts: B, override: { lists: true }, backups: true }), `pick the current A: ${show(current)}`);
  const last = call(pickCategory, { scores: B, override: { scores: true } }, 'scores', A, A);
  assert(sameObj(last, {}), `the last override goes with its card: want {}, got ${show(last)}`);
  assert(start.scores === B && start.everything === B, 'pickCategory changed its input');
});
test('T3: undoCategory — removes the card\'s change, its override and the everything change (decision 16); keeps the rest', async () => {
  const undoCategory = await fn('undoCategory');
  const start = { scores: C, lists: B, concepts: B, everything: B, override: { scores: true, concepts: true }, backups: true };
  const got = call(undoCategory, start, 'lists');
  assert(sameObj(got, { scores: C, concepts: B, override: { scores: true, concepts: true }, backups: true }), `undo Lists: ${show(got)}`);
  const s = call(undoCategory, start, 'scores');
  assert(sameObj(s, { lists: B, concepts: B, override: { concepts: true }, backups: true }), `undo Scores: ${show(s)}`);
  assert(start.everything === B && start.lists === B, 'undoCategory changed its input');
});
test('T4: pickAll — every card and everything to one Assistant, every override off, the backup switch kept; its current Assistant keeps only the backup switch', async () => {
  const pickAll = await fn('pickAll');
  const start = { scores: C, override: { scores: true }, backups: true };
  const got = call(pickAll, start, B, A);
  assert(sameObj(got, { scores: B, lists: B, concepts: B, everything: B, backups: true }), `pick B: ${show(got)}`);
  const cur = call(pickAll, got, A, A);
  assert(sameObj(cur, { backups: true }), `pick the current A: ${show(cur)}`);
  const plain = call(pickAll, { scores: C }, B, A);
  assert(sameObj(plain, { scores: B, lists: B, concepts: B, everything: B }), `no switches: ${show(plain)}`);
});
test('T5: undoAll — every assignment and override goes; the backup switch stays (story 4 default 5); no argument still gives {}', async () => {
  const undoAll = await fn('undoAll');
  const got = call(undoAll, { scores: B, lists: B, concepts: B, everything: B, override: { lists: true }, backups: true });
  assert(sameObj(got, { backups: true }), `with the backup switch: ${show(got)}`);
  const none = call(undoAll, { scores: B, everything: B });
  assert(sameObj(none, {}), `without: ${show(none)}`);
  const bare = call(undoAll);
  assert(sameObj(bare, {}), `no argument: ${show(bare)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// A — overrideAllState (AC-2)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('A1: the count is the sum over pending cards; on only when every card with duties has its override on', async () => {
  const overrideAllState = await fn('overrideAllState');
  const duties = { scores: ['3038x:tag:X'], lists: [], concepts: ['39998:a', '39998:b'] };
  const cases = [
    [{ scores: B, lists: B, concepts: B, everything: B }, { count: 3, on: false }],
    [{ scores: B, lists: B, concepts: B, everything: B, override: { scores: true } }, { count: 3, on: false }],
    [{ scores: B, lists: B, concepts: B, everything: B, override: { scores: true, concepts: true } }, { count: 3, on: true }],
    [{ scores: B, lists: B, concepts: B, everything: B, override: { scores: true, lists: true, concepts: true } }, { count: 3, on: true }],
  ];
  const wrong = [];
  for (const [p, want] of cases) {
    const got = call(overrideAllState, duties, p);
    if (!sameObj(got, want)) wrong.push(`${show(p.override || {})}: want ${show(want)}, got ${show(got)}`);
  }
  const none = call(overrideAllState, { scores: [], lists: [], concepts: [] }, { scores: B, lists: B, concepts: B, everything: B, override: { scores: true } });
  if (!sameObj(none, { count: 0, on: false })) wrong.push(`no duties: want {count:0,on:false}, got ${show(none)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// N — saveNote with the switches (AC-1, AC-4; story 4 defaults 2 and 4)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('N1: the backup switch is one change; with it on the note counts, even for all duties to one Assistant; overrides never count', async () => {
  const saveNote = await fn('saveNote');
  const cases = [
    [{ backups: true }, '1 unsaved change'],
    [{ scores: B, backups: true }, '2 unsaved changes'],
    [{ scores: B, lists: B, concepts: B, everything: B, backups: true }, '5 unsaved changes'],
    [{ scores: B, lists: B, concepts: B, everything: B, override: { scores: true, lists: true } }, 'All duties → Bea'],
    [{ scores: B, override: { scores: true } }, '1 unsaved change'],
    [{ override: { scores: true } }, 'No changes yet'],
  ];
  const wrong = [];
  for (const [p, want] of cases) {
    let got;
    try { got = saveNote(p, nameOf); } catch (err) { got = `threw ${err.message}`; }
    if (got !== want) wrong.push(`${show(p)}: want ${show(want)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// W — the words (story § Copy)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('W1: the switch labels — override and overrideAll, singular and plural; backups, singular and plural', async () => {
  const { COPY } = await viewModel();
  const e = (COPY && COPY.edit) || {};
  const wrong = [];
  const say = (f, ...args) => { try { return typeof f === 'function' ? f(...args) : `not a function (${typeof f})`; } catch (err) { return `threw ${err.message}`; } };
  const want = [
    ['override', 1, 'Override 1 individually assigned duty'],
    ['override', 2, 'Override 2 individually assigned duties'],
    ['overrideAll', 1, 'Override 1 individually assigned duty across all categories'],
    ['overrideAll', 3, 'Override 3 individually assigned duties across all categories'],
    ['backups', 1, 'Remove 1 backup Assistant'],
    ['backups', 4, 'Remove 4 backup Assistants'],
  ];
  for (const [name, n, text] of want) {
    const got = say(e[name], n);
    if (got !== text) wrong.push(`COPY.edit.${name}(${n}): want ${show(text)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});
test('W2: the switch notes, exactly (apostrophes curly, as the page\'s other words)', async () => {
  const { COPY } = await viewModel();
  const e = (COPY && COPY.edit) || {};
  const want = {
    overrideOff: 'Kept as they are; they take priority over this assignment.',
    overrideOn: 'These will be removed from your Treasure Map.',
    backupsOff: 'Kept as they are. Apps use a backup when an entry’s first Assistant can’t be reached.',
    backupsOn: 'Every entry keeps only its first Assistant, including entries not shown on this page.',
  };
  const wrong = Object.entries(want).filter(([k, v]) => e[k] !== v).map(([k, v]) => `COPY.edit.${k}: want ${show(v)}, got ${show(e[k])}`);
  assert(wrong.length === 0, wrong.join('; '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// S — source sentinels (ADR 0004 sub-decisions 3–4)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('S1: the hook offers setOverride, setOverrideAll and setBackups through the edit model\'s steps', () => {
  const src = codeOnly(safeRead(EDIT_HOOK));
  assert(src, `${rel(EDIT_HOOK)} does not exist`);
  const missing = ['setOverride', 'setOverrideAll', 'setBackups'].filter((name) => !new RegExp(`\\b${name}\\b[\\s\\S]*\\b${name}\\b`).test(src));
  assert(missing.length === 0, `${rel(EDIT_HOOK)} doesn't import and return ${missing.join(', ')} (ADR 0004 sub-decision 3)`);
  assert(/from\s+['"]\.\/editTreasureMap(\.js)?['"]/.test(src), `${rel(EDIT_HOOK)} doesn't take its steps from ./editTreasureMap`);
});
test('S2: the page plans the edit with planEdit and draws its switches as real switches (role="switch", aria-checked)', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  const wrong = [];
  if (!/\bplanEdit\s*\(/.test(src)) wrong.push('it doesn\'t call planEdit (ADR 0004 sub-decision 4)');
  if (!/role=["']switch["']/.test(src)) wrong.push('no element has role="switch"');
  if (!/aria-checked=/.test(src)) wrong.push('no switch carries aria-checked');
  if (/\btaPubkey\b/.test(src)) wrong.push('it uses taPubkey');
  if (/[0-9a-f]{64}/i.test(src)) wrong.push('it contains a 64-hex literal');
  assert(wrong.length === 0, `${rel(PAGE)}: ${wrong.join('; ')}`);
});

async function run() {
  console.log(`${NL}=== treasure-map-switches (treasure-map-edit #4) ===`);
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
  console.log(`${NL}treasure-map-switches: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };
