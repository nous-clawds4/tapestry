'use strict';
/**
 * treasure-map-edit #3: Edit mode on /treasure-map — assign Assistants and preview the result.
 *
 * Story: engineering-team/stories/done/treasure-map-edit/3-edit-mode-assign-and-preview.md
 * ADR:   engineering-team/decisions/done/treasure-map-edit/0003-a-pure-edit-model-beside-the-card-rule.md
 * Plan:  engineering-team/stories/done/treasure-map-edit/3-edit-mode-assign-and-preview.test-plan.md
 * Browser half: tests/brainstorm/treasure-map-edit.spec.js (what a viewer sees and does).
 *
 * Classes (pure unless noted; the edit model is ui/src/pages/treasure-map/editTreasureMap.js):
 *   R — entryRole(category, tag): a category's own entries, its individually assigned duties, and the rest.   [AC-5]
 *   E — editedTags(tags, pending, relayFor): the story's AC-5 table, row by row, then the edges ADR 0003 names. [AC-5]
 *   D — editedDraft: the Map as Save would sign it, without id, signature or created_at.                      [AC-6]
 *   Y — makeRelayFor: the relay an entry names (ADR 0003 sub-decision 2).                                      [AC-5]
 *   P — the pending steps: pickCategory, undoCategory, pickAll, undoAll.                                [AC-2, AC-3]
 *   N — saveNote, currentOf, currentAll.                                                          [AC-2, AC-3, AC-4]
 *   K — pickerRows: the picker's rows.                                                                         [AC-2]
 *   W — the words (story § Copy) and the card rule's exports and JSDoc (ADR 0003 sub-decision 1).        [AC-1..AC-7]
 *   S — source sentinels: the edit model is pure; the edit state only reads; nothing signs or publishes.      [AC-6]
 *
 * Everything FAILS against the current code: editTreasureMap.js and useMapEdit.js don't exist, manageTreasureMap.js
 * exports neither entryOf nor appliesTo and has no COPY.edit, and its categoryAssistants JSDoc says a `*:…` entry
 * "never counts" without "that names anything after the `*`".
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const DIR = path.join(REPO, 'ui/src/pages/treasure-map');
const EDIT_MODEL = path.join(DIR, 'editTreasureMap.js');
const VIEW_MODEL = path.join(DIR, 'manageTreasureMap.js');
const EDIT_HOOK = path.join(DIR, 'useMapEdit.js');
const MA_VIEW_MODEL = path.join(REPO, 'ui/src/pages/assistants/myAssistants.js');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const C = 'c3'.repeat(32);
const D = 'd1'.repeat(32);
const L = 'a2'.repeat(32); // the viewer's own Assistant here
const VIEWER = 'a1'.repeat(32);
const R0 = 'wss://old.example';
const LETTER = { [A]: 'A', [B]: 'B', [C]: 'C', [D]: 'D', [L]: 'L' };
/** A relayFor that shows who and which category it was asked for. */
const rf = (pk, cat) => `wss://${cat}.${LETTER[pk] || 'x'}`;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v, (k, x) => (typeof x === 'string' && LETTER[x] ? LETTER[x] : x));
const rel = (p) => path.relative(REPO, p);
const clone = (v) => JSON.parse(JSON.stringify(v));
/** The same keys and values, in any key order. */
const sameObj = (a, b) => !!a && typeof a === 'object' && show(Object.entries(a).sort()) === show(Object.entries(b).sort());

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
  assert(typeof mod[name] === 'function', `${rel(EDIT_MODEL)} does not export ${name}() (ADR 0003 sub-decision 2)`);
  return mod[name];
}
async function viewModel() { return esm(VIEW_MODEL, 'The page view-model.'); }

/** editedTags over [key, who, relay?, ...extra] rows, compared in full; who is a pubkey or any string. */
async function expectEdited(rows, pending, want, label) {
  const editedTags = await fn('editedTags');
  const tags = rows.map(([k, pk, r = R0, ...extra]) => [k, pk, r, ...extra]);
  const before = clone(tags);
  let got;
  try { got = editedTags(tags, pending, rf); } catch (err) { throw new Error(`${label}: threw ${err.message}`); }
  assert(show(tags) === show(before), `${label}: editedTags changed its input`);
  assert(show(got) === show(want), `${label} — ${show(rows)} with ${show(pending)}:${NL}        want ${show(want)}${NL}        got  ${show(got)}`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// R — entryRole: own, individual, or neither
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const ROLES = {
  scores: {
    own: ['3038x', '3038x:', '30380', '30382', '30389', '30382:rank', '30382:rank:', '3038x:rank', '30383:confidence'],
    individual: ['30382:tag', '30382:tag:X:T:rank', '3038x:tag', '3038x:dlist:Q', '30382:pin:x', '30382:contexts', '30382::rank'],
    none: ['*', '*:', '*:tag', '*:rank', '30392', '3039x', '39998', '99999', '3040x'],
  },
  lists: {
    own: ['3039x', '3039x:', '30390', '30392', '30399', '30392:'],
    individual: ['30392:rank', '30396:tag:X:T', '3039x:dlist', '30397:pin:39998:P', '3039x:tag::T'],
    none: ['*', '*:tag', '30382', '3038x', '39998'],
  },
  concepts: {
    own: ['39998', '39998:dlist-header', '39999'],
    individual: ['39998:dog-breed', '39998:a:b', '39999:x', '39999:dlist-header'],
    none: ['*', '*:', '30382', '30392', '3038x'],
  },
};

for (const [category, sets] of Object.entries(ROLES)) {
  test(`R-${category}: entryRole('${category}', …) — own, individual, and neither, as ADR 0003 sub-decision 2 lists`, async () => {
    const entryRole = await fn('entryRole');
    const wrong = [];
    for (const [want, keys] of [['own', sets.own], ['individual', sets.individual], [null, sets.none]]) {
      for (const key of keys) {
        const got = entryRole(category, [key, A, R0]);
        if (got !== want) wrong.push(`${key}: want ${show(want)}, got ${show(got)}`);
      }
    }
    assert(wrong.length === 0, wrong.join('; '));
  });
}

test('R-invalid: a tag with no valid 64-hex Assistant, or not a tag at all, has no role in any category', async () => {
  const entryRole = await fn('entryRole');
  const wrong = [];
  for (const tag of [['3038x', 'not-a-key', R0], ['30382:rank'], [42, A], null, 'x', ['39998', 'c'.repeat(63)]]) {
    for (const category of ['scores', 'lists', 'concepts']) {
      let got;
      try { got = entryRole(category, tag); } catch (err) { got = `threw ${err.message}`; }
      if (got !== null) wrong.push(`${show(tag)} on ${category}: ${show(got)}`);
    }
  }
  assert(wrong.length === 0, wrong.join('; '));
});

// Owner's request, 2026-10-08: assigning Concepts writes both of its kinds, `39998` and `39999`.
test('R-family: FAMILY names each category\'s family entries — 3038x; 3039x; 39998 and 39999', async () => {
  const mod = await esm(EDIT_MODEL, 'The edit model (ADR 0003 sub-decision 2).');
  const want = { scores: ['3038x'], lists: ['3039x'], concepts: ['39998', '39999'] };
  assert(show(mod.FAMILY) === show(want), `FAMILY is ${show(mod.FAMILY)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// E — editedTags: the story's AC-5 table, then the edges
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('E1: AC-5 row 1 — rank and followers → A, 30392 → L; Scores → B: both move to B in place, 30392 stays, 3038x → B added', () =>
  expectEdited([['30382:rank', A], ['30382:followers', A], ['30392', L]], { scores: B },
    [['30382:rank', B, rf(B, 'scores')], ['30382:followers', B, rf(B, 'scores')], ['30392', L, R0], ['3038x', B, rf(B, 'scores')]], 'E1'));
test('E2: AC-5 row 2 — rank → A, then rank → C (a backup); Scores → B: the first moves to B, the backup stays', () =>
  expectEdited([['30382:rank', A], ['30382:rank', C]], { scores: B },
    [['30382:rank', B, rf(B, 'scores')], ['30382:rank', C, R0], ['3038x', B, rf(B, 'scores')]], 'E2'));
test('E3: AC-5 row 3 — 3038x → A, 3038x:tag:<X> → C; Scores → B: 3038x moves, the individually assigned duty stays', () =>
  expectEdited([['3038x', A], ['3038x:tag:X', C]], { scores: B },
    [['3038x', B, rf(B, 'scores')], ['3038x:tag:X', C, R0]], 'E3'));
test('E4: AC-5 row 4 — 30392 → A, 30396:tag:<X>:<T> → C; Lists → B: 30392 moves, the duty stays, 3039x → B added', () =>
  expectEdited([['30392', A], ['30396:tag:X:T', C]], { lists: B },
    [['30392', B, rf(B, 'lists')], ['30396:tag:X:T', C, R0], ['3039x', B, rf(B, 'lists')]], 'E4'));
test('E5: AC-5 row 5 — 39998:dlist-header → A, 39998:<d> → C; Concepts → B: the family entry moves in its own spelling, 39999 → B added', () =>
  expectEdited([['39998:dlist-header', A], ['39998:d', C]], { concepts: B },
    [['39998:dlist-header', B, rf(B, 'concepts')], ['39998:d', C, R0], ['39999', B, rf(B, 'concepts')]], 'E5'));
test('E6: AC-5 row 6 — *:tag → D, rank → A; Assign to all → B: *:tag stays, rank moves, then 3038x, 3039x, 39998, 39999 and * → B added in that order', () =>
  expectEdited([['*:tag', D], ['30382:rank', A]], { scores: B, lists: B, concepts: B, everything: B },
    [['*:tag', D, R0], ['30382:rank', B, rf(B, 'scores')], ['3038x', B, rf(B, 'scores')], ['3039x', B, rf(B, 'lists')],
      ['39998', B, rf(B, 'concepts')], ['39999', B, rf(B, 'concepts')], ['*', B, '']], 'E6'));
test('E7: AC-5 row 7 — no Map; Scores → B: a new Map with 3038x → B, nothing else (book decision 15)', () =>
  expectEdited([], { scores: B }, [['3038x', B, rf(B, 'scores')]], 'E7'));

test('E8: a real Map — every tag the edit doesn\'t move keeps its bytes and its place, non-entry tags and odd ones included', async () => {
  const metrics = ['rank', 'followers', 'personalizedGrapeRank_influence', 'personalizedGrapeRank_average', 'personalizedGrapeRank_confidence',
    'personalizedGrapeRank_input', 'personalizedPageRank', 'verifiedFollowerCount', 'verifiedMuterCount', 'verifiedReporterCount', 'hops'];
  const rows = [
    ['client', 'some-app'],
    ...metrics.map((m) => [`30382:${m}`, L, 'wss://nip85.example']),
    ['30392', L, 'wss://tl.example'],
    ['39998:dlist-header', L, ''],
    ['39998:restaurants', C, 'wss://dl.example', 'note'],
    ['*:tag', D, ''],
    ['3038x:tag:X', C, ''],
    ['99999', A, ''],
  ];
  const want = [
    ['client', 'some-app'],
    ...metrics.map((m) => [`30382:${m}`, B, rf(B, 'scores')]),
    ['30392', L, 'wss://tl.example'],
    ['39998:dlist-header', L, ''],
    ['39998:restaurants', C, 'wss://dl.example', 'note'],
    ['*:tag', D, ''],
    ['3038x:tag:X', C, ''],
    ['99999', A, ''],
    ['3038x', B, rf(B, 'scores')],
  ];
  const editedTags = await fn('editedTags');
  const got = editedTags(clone(rows), { scores: B }, rf);
  assert(show(got) === show(want), `want ${show(want)}${NL}        got  ${show(got)}`);
});
test('E9: nothing to move — every own entry already names B: the tags come back as they were, relays included', () =>
  expectEdited([['30382:rank', B], ['3038x', B]], { scores: B }, [['30382:rank', B, R0], ['3038x', B, R0]], 'E9'));
test('E10: an own entry whose Assistant is B in upper case counts as B — left as it is', () =>
  expectEdited([['30382:rank', B.toUpperCase()], ['3038x', B]], { scores: B }, [['30382:rank', B.toUpperCase(), R0], ['3038x', B, R0]], 'E10'));
test('E11: tags with no valid Assistant are kept, and an invalid family entry is no family entry — 3038x → B is added', () =>
  expectEdited([['3038x', 'not-a-key'], ['30382:rank', A]], { scores: B },
    [['3038x', 'not-a-key', R0], ['30382:rank', B, rf(B, 'scores')], ['3038x', B, rf(B, 'scores')]], 'E11'));
test('E12: a moved entry keeps its key\'s spelling and any extra elements after the relay', () =>
  expectEdited([['30382:rank:', A, R0, 'extra', 'more']], { scores: B },
    [['30382:rank:', B, rf(B, 'scores'), 'extra', 'more'], ['3038x', B, rf(B, 'scores')]], 'E12'));
test('E13: one key in two spellings — only its first valid entry moves; the second is that key\'s backup', () =>
  expectEdited([['30382:rank', A], ['30382:rank:', C]], { scores: B },
    [['30382:rank', B, rf(B, 'scores')], ['30382:rank:', C, R0], ['3038x', B, rf(B, 'scores')]], 'E13'));
test('E14: the everything entry — an existing * (or *:) moves to B in place with relay "", else * → B is added', async () => {
  await expectEdited([['*', A]], { everything: B }, [['*', B, '']], 'E14a');
  await expectEdited([['*:', A], ['*', C]], { everything: B }, [['*:', B, ''], ['*', C, R0]], 'E14b');
  await expectEdited([['30382:rank', A]], { everything: B }, [['30382:rank', A, R0], ['*', B, '']], 'E14c');
});
test('E15: a category with only individually assigned duties — they stay, and the family entry is added', () =>
  expectEdited([['3038x:tag:X', C], ['30392:rank', C]], { scores: B, lists: B },
    [['3038x:tag:X', C, R0], ['30392:rank', C, R0], ['3038x', B, rf(B, 'scores')], ['3039x', B, rf(B, 'lists')]], 'E15'));
test('E16: nothing pending — the tags come back unchanged (a copy)', () =>
  expectEdited([['30382:rank', A], ['*:tag', D]], {}, [['30382:rank', A, R0], ['*:tag', D, R0]], 'E16'));
test('E18: Concepts → B — each of 39998 and 39999 moves in place when the Map has it, and is added when it doesn\'t', async () => {
  await expectEdited([['39999', A]], { concepts: B }, [['39999', B, rf(B, 'concepts')], ['39998', B, rf(B, 'concepts')]], 'E18a');
  await expectEdited([['39998', A], ['39999', C]], { concepts: B },
    [['39998', B, rf(B, 'concepts')], ['39999', B, rf(B, 'concepts')]], 'E18b');
  await expectEdited([['39998', B], ['39999', B]], { concepts: B }, [['39998', B, R0], ['39999', B, R0]], 'E18c');
  await expectEdited([], { concepts: B }, [['39998', B, rf(B, 'concepts')], ['39999', B, rf(B, 'concepts')]], 'E18d');
});
test('E17: a bare * is no category\'s own entry — Scores → B leaves it; and the other categories\' entries stay', () =>
  expectEdited([['*', A], ['30392', A], ['39998', A]], { scores: B },
    [['*', A, R0], ['30392', A, R0], ['39998', A, R0], ['3038x', B, rf(B, 'scores')]], 'E17'));

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// D — editedDraft
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('D1: the draft is { kind: 10040, pubkey: viewer, content, tags } — no id, sig or created_at; content kept', async () => {
  const editedDraft = await fn('editedDraft');
  const event = { id: '9'.repeat(64), pubkey: VIEWER, kind: 10040, created_at: 5, content: 'hello', sig: 'f'.repeat(128), tags: [['30382:rank', A, R0]] };
  const before = clone(event);
  const got = editedDraft({ event, viewer: VIEWER, pending: { scores: B }, relayFor: rf });
  assert(show(Object.keys(got).sort()) === show(['content', 'kind', 'pubkey', 'tags']), `keys ${show(Object.keys(got))}`);
  assert(got.kind === 10040 && got.pubkey === VIEWER && got.content === 'hello', `got ${show(got)}`);
  assert(show(got.tags) === show([['30382:rank', B, rf(B, 'scores')], ['3038x', B, rf(B, 'scores')]]), `tags ${show(got.tags)}`);
  assert(show(event) === show(before), 'editedDraft changed the event');
});
test('D2: no Map — the draft has content "" and only the new entries', async () => {
  const editedDraft = await fn('editedDraft');
  const got = editedDraft({ event: null, viewer: VIEWER, pending: { lists: B }, relayFor: rf });
  assert(sameObj(got, { kind: 10040, pubkey: VIEWER, content: '', tags: [['3039x', B, rf(B, 'lists')]] }), `got ${show(got)}`);
});
test('D3: nothing pending — the draft\'s tags are the Map\'s tags', async () => {
  const editedDraft = await fn('editedDraft');
  const tags = [['30382:rank', A, R0], ['client', 'x']];
  const got = editedDraft({ event: { kind: 10040, pubkey: VIEWER, content: '', tags }, viewer: VIEWER, pending: {}, relayFor: rf });
  assert(show(got.tags) === show(tags), `tags ${show(got.tags)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// Y — makeRelayFor
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const A_RELAYS = { aTrustedAssertionRelays: ['wss://ta1', 'wss://ta2'], aTrustedListRelays: ['wss://tl'], aDListRelays: ['wss://dl'] };

test('Y1: the Assistant here gets its category\'s first configured relay — Trusted Assertion, Trusted List, DList; the everything entry ""', async () => {
  const relayFor = (await fn('makeRelayFor'))({ localPubkey: L, aRelays: A_RELAYS });
  const got = ['scores', 'lists', 'concepts', 'everything'].map((c) => relayFor(L, c));
  assert(show(got) === show(['wss://ta1', 'wss://tl', 'wss://dl', '']), `got ${show(got)}`);
});
test('Y2: any other Assistant gets "", in every category', async () => {
  const relayFor = (await fn('makeRelayFor'))({ localPubkey: L, aRelays: A_RELAYS });
  const got = ['scores', 'lists', 'concepts'].map((c) => relayFor(B, c));
  assert(show(got) === show(['', '', '']), `got ${show(got)}`);
});
test('Y3: no relay settings yet, empty groups, or no Assistant here — "" without a throw', async () => {
  const makeRelayFor = await fn('makeRelayFor');
  const wrong = [];
  for (const input of [{ localPubkey: L, aRelays: null }, { localPubkey: L, aRelays: undefined }, { localPubkey: L, aRelays: {} },
    { localPubkey: L, aRelays: { aTrustedAssertionRelays: [] } }, { localPubkey: null, aRelays: A_RELAYS }]) {
    let got;
    try { got = makeRelayFor(input)(input.localPubkey || L, 'scores'); } catch (err) { got = `threw ${err.message}`; }
    if (got !== '') wrong.push(`${show(input)} → ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// P — the pending steps
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('P1: pickCategory — sets the card\'s change; picking the card\'s current Assistant removes it; the input is never changed', async () => {
  const pickCategory = await fn('pickCategory');
  const start = { lists: C };
  const a = pickCategory(start, 'scores', B, A);
  assert(sameObj(a, { lists: C, scores: B }), `pick B: ${show(a)}`);
  const b = pickCategory(a, 'scores', A, A);
  assert(sameObj(b, { lists: C }), `pick the current A: ${show(b)}`);
  const c = pickCategory(a, 'scores', C, A);
  assert(sameObj(c, { lists: C, scores: C }), `pick C over B: ${show(c)}`);
  assert(show(start) === show({ lists: C }) && a.scores === B, 'pickCategory changed its input');
});
test('P2: pickCategory on a card with no single current Assistant (null) — every pick sets the change', async () => {
  const pickCategory = await fn('pickCategory');
  const got = pickCategory({}, 'concepts', A, null);
  assert(sameObj(got, { concepts: A }), `got ${show(got)}`);
});
// Re-aimed at treasure-map-edit #4's Test Design (book decision 16, ADR 0004 sub-decision 1): after Assign to all, a
// card's Undo also cancels the everything entry's change. It used to keep it.
test('P3: undoCategory — removes that card\'s change and, by book decision 16, the everything entry\'s; the other cards keep theirs', async () => {
  const undoCategory = await fn('undoCategory');
  const all = { scores: B, lists: B, concepts: B, everything: B };
  const got = undoCategory(all, 'lists');
  assert(sameObj(got, { scores: B, concepts: B }), `got ${show(got)}`);
  assert(all.lists === B && all.everything === B, 'undoCategory changed its input');
});
test('P4: pickAll — all three cards and the everything entry to one Assistant; picking the current-all Assistant clears everything', async () => {
  const pickAll = await fn('pickAll');
  const got = pickAll({ scores: C }, B, A);
  assert(sameObj(got, { scores: B, lists: B, concepts: B, everything: B }), `pick B: ${show(got)}`);
  const cleared = pickAll(got, A, A);
  assert(sameObj(cleared, {}), `pick the current A: ${show(cleared)}`);
});
test('P5: undoAll — nothing pending', async () => {
  const undoAll = await fn('undoAll');
  const got = undoAll({ scores: B, everything: B });
  assert(sameObj(got, {}), `got ${show(got)}`);
});
test('P6: a card changed after Assign to all changes only that card', async () => {
  const pickAll = await fn('pickAll');
  const pickCategory = await fn('pickCategory');
  const got = pickCategory(pickAll({}, B, null), 'scores', A, C);
  assert(sameObj(got, { scores: A, lists: B, concepts: B, everything: B }), `got ${show(got)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// N — saveNote, currentOf, currentAll
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

const NAMES = { [A]: 'Ava', [B]: 'Bea', [C]: 'Cy' };
const nameOf = (pk) => NAMES[pk] || pk;

test('N1: saveNote — "No changes yet", "All duties → Bea", "1 unsaved change", "N unsaved changes"', async () => {
  const saveNote = await fn('saveNote');
  const cases = [
    [{}, 'No changes yet'],
    [{ scores: B, lists: B, concepts: B, everything: B }, 'All duties → Bea'],
    [{ scores: B }, '1 unsaved change'],
    [{ scores: A, lists: B, concepts: B, everything: B }, '4 unsaved changes'],
    [{ scores: B, lists: B, concepts: B }, '3 unsaved changes'],
    [{ everything: B }, '1 unsaved change'],
  ];
  const wrong = cases.map(([p, want]) => [p, want, saveNote(p, nameOf)]).filter(([, want, got]) => got !== want)
    .map(([p, want, got]) => `${show(p)}: want ${show(want)}, got ${show(got)}`);
  assert(wrong.length === 0, wrong.join('; '));
});
test('N2: currentOf — a single card\'s Assistant; a mixed or unassigned card has none', async () => {
  const currentOf = await fn('currentOf');
  const { categoryCards } = await viewModel();
  const cards = categoryCards({ assistants: { scores: [A], lists: [A, B], concepts: [] }, profiles: {}, localPubkey: null });
  const got = cards.map((card) => currentOf(card));
  assert(show(got) === show([A, null, null]), `got ${show(got)}`);
});
test('N3: currentAll — only when all three cards name one Assistant alone', async () => {
  const currentAll = await fn('currentAll');
  const { categoryCards } = await viewModel();
  const of = (s, l, c) => categoryCards({ assistants: { scores: s, lists: l, concepts: c }, profiles: {}, localPubkey: null });
  const got = [of([A], [A], [A]), of([A], [A], [B]), of([A], [], [A]), of([A, B], [A], [A])].map((cards) => currentAll(cards));
  assert(show(got) === show([A, null, null, null]), `got ${show(got)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// K — pickerRows
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

async function builtRows() {
  const { buildRows } = await esm(MA_VIEW_MODEL, 'The My Assistants view-model.');
  return buildRows({
    rows: [{ pubkey: C, local: false, tags: [] }, { pubkey: L, local: true, tags: [] }, { pubkey: B, local: false, tags: [] }, { pubkey: A, local: false, tags: [] }],
    profiles: { [L]: { display_name: 'Zed Local' }, [A]: { display_name: 'Ava', website: 'ava.example', nip05: 'ava@ava.example' }, [B]: { name: 'Bea', nip05: 'bea@bea.example' }, [C]: { name: 'Cy' } },
  });
}

test('K1: pickerRows keeps the My Assistants order (Local first, then by name) and marks Local, Current and the selected row', async () => {
  const pickerRows = await fn('pickerRows');
  const rows = await builtRows();
  const got = pickerRows(rows, { current: A, selected: null });
  assert(show(got.map((r) => r.pubkey)) === show([L, A, B, C]), `order ${show(got.map((r) => r.pubkey))}`);
  assert(show(got.map((r) => r.name)) === show(['Zed Local', 'Ava', 'Bea', 'Cy']), `names ${show(got.map((r) => r.name))}`);
  assert(show(got.map((r) => r.local)) === show([true, false, false, false]), `local ${show(got.map((r) => r.local))}`);
  assert(show(got.map((r) => r.current)) === show([false, true, false, false]), `current ${show(got.map((r) => r.current))}`);
  assert(show(got.map((r) => r.selected)) === show([false, true, false, false]), `selected (none picked: the current) ${show(got.map((r) => r.selected))}`);
  assert(got.every((r) => typeof r.initial === 'string' && r.initial.length > 0), 'every row has an avatar letter');
});
test('K2: a picked Assistant is the selected row; the current one stays Current', async () => {
  const pickerRows = await fn('pickerRows');
  const got = pickerRows(await builtRows(), { current: A, selected: B });
  assert(show(got.map((r) => r.selected)) === show([false, false, true, false]), `selected ${show(got.map((r) => r.selected))}`);
  assert(got[1].current === true, 'Ava stays Current');
});
test('K3: each row\'s detail is the website, else the NIP-05, else the shortened npub', async () => {
  const pickerRows = await fn('pickerRows');
  const rows = await builtRows();
  const got = pickerRows(rows, { current: null, selected: null });
  const want = [rows[0].npubShort, 'ava.example', 'bea@bea.example', rows[3].npubShort];
  assert(show(got.map((r) => r.detail)) === show(want), `detail ${show(got.map((r) => r.detail))}, want ${show(want)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// W — the words, the card rule's exports and its JSDoc
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** Every string COPY.edit holds, functions called with a sample, so the test pins words, not key names. */
function stringsOf(obj) {
  const out = [];
  const visit = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') { try { const r = v('Bea'); if (typeof r === 'string') out.push(r); } catch { /* not a name function */ } }
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(obj);
  return out;
}

const PHRASES = [
  'Edit', 'Editing', 'All duties', 'Assign one Assistant to Scores, Lists, Concepts, and everything else.', 'Assign to all',
  'Choose an Assistant', 'Change', 'Unsaved', 'Undo', 'Local', 'Current', 'No changes yet',
  'View the raw Treasure Map — edited', 'Hide the raw Treasure Map — edited', 'Unsaved draft',
  'We didn’t find a Treasure Map on your relays, so saving will publish a new one. If you already have one on a relay we couldn’t check, the new one will replace it.',
  'Loading your Assistants…', 'Couldn’t load your Assistants.',
];

test('W1: COPY.edit holds every word of the story\'s § Copy, exactly (apostrophes curly, as the page\'s other words)', async () => {
  const { COPY } = await viewModel();
  assert(COPY && COPY.edit && typeof COPY.edit === 'object', 'COPY has no edit object (ADR 0003 sub-decision 1)');
  const have = new Set(stringsOf(COPY.edit));
  const missing = PHRASES.filter((p) => !have.has(p));
  assert(missing.length === 0, `COPY.edit lacks ${show(missing)}`);
  const all = stringsOf(COPY.edit).join(NL);
  assert(/You have no Assistants yet\./.test(all) && /My Assistants/.test(all), 'COPY.edit lacks the empty state ("You have no Assistants yet. Add one on the My Assistants page.")');
});
test('W2: COPY.edit\'s word functions — assignedTo, allDutiesTo, unsavedChanges (singular and plural), noChanges', async () => {
  const { COPY } = await viewModel();
  const e = (COPY && COPY.edit) || {};
  const wrong = [];
  const call = (f, ...args) => { try { return typeof f === 'function' ? f(...args) : `not a function (${typeof f})`; } catch (err) { return `threw ${err.message}`; } };
  if (call(e.assignedTo, 'Bea') !== 'Will be assigned to Bea') wrong.push(`assignedTo('Bea') → ${show(call(e.assignedTo, 'Bea'))}`);
  if (call(e.allDutiesTo, 'Bea') !== 'All duties → Bea') wrong.push(`allDutiesTo('Bea') → ${show(call(e.allDutiesTo, 'Bea'))}`);
  if (call(e.unsavedChanges, 1) !== '1 unsaved change') wrong.push(`unsavedChanges(1) → ${show(call(e.unsavedChanges, 1))}`);
  if (call(e.unsavedChanges, 3) !== '3 unsaved changes') wrong.push(`unsavedChanges(3) → ${show(call(e.unsavedChanges, 3))}`);
  if (e.noChanges !== 'No changes yet') wrong.push(`noChanges is ${show(e.noChanges)}`);
  assert(wrong.length === 0, wrong.join('; '));
});
test('W3: the card rule exports entryOf and appliesTo, unchanged (ADR 0003 sub-decision 1)', async () => {
  const mod = await viewModel();
  assert(typeof mod.entryOf === 'function' && typeof mod.appliesTo === 'function', `exports: entryOf ${typeof mod.entryOf}, appliesTo ${typeof mod.appliesTo}`);
  const e = mod.entryOf(['3038x:tag:', A, R0]);
  assert(e && e.norm === '3038x:tag' && e.slot === '3038x' && show(e.segments) === show(['tag']), `entryOf: ${show(e)}`);
  assert(mod.appliesTo('scores', mod.entryOf(['*', A])) === true && mod.appliesTo('scores', mod.entryOf(['*:tag', A])) === false, 'appliesTo: a bare * reaches Scores, a *:… entry doesn\'t');
});
test('W4: AC-7 — categoryAssistants\' JSDoc says a `*:…` entry "that names anything after the `*`" never counts', () => {
  const src = safeRead(VIEW_MODEL);
  const at = src.indexOf('export function categoryAssistants');
  assert(at > 0, `${rel(VIEW_MODEL)} has no categoryAssistants`);
  const doc = src.slice(src.lastIndexOf('/**', at), at);
  assert(/that names anything after the `\*`/.test(doc.replace(/\s*\n\s*\*\s*/g, ' ')), `the JSDoc above categoryAssistants doesn't say "that names anything after the \`*\`": ${show(doc.slice(0, 400))}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// S — source sentinels
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('S1: the edit model is pure — no React, fetch, signing, publishing or storage; only .js-suffixed imports', () => {
  const src = codeOnly(safeRead(EDIT_MODEL));
  assert(src, `${rel(EDIT_MODEL)} does not exist`);
  const bad = src.match(/from\s+['"]react['"]|\b(fetch\s*\(|signEvent|publish\w*\s*\(|localStorage|sessionStorage)/);
  assert(!bad, `${rel(EDIT_MODEL)} uses ${bad && bad[0]}`);
  const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  const notJs = imports.filter((p) => !p.endsWith('.js'));
  assert(notJs.length === 0, `${rel(EDIT_MODEL)} imports ${show(notJs)} without a .js suffix (Node can't load it)`);
});
test('S2: the edit state reads the person\'s Assistants as /assistants does, and signs, publishes and stores nothing', () => {
  const src = codeOnly(safeRead(EDIT_HOOK));
  assert(src, `${rel(EDIT_HOOK)} does not exist (ADR 0003 sub-decision 3)`);
  const wrong = [];
  if (!/['"`]\/api\/assistant\/my-assistants['"`]/.test(src)) wrong.push('it doesn\'t read /api/assistant/my-assistants');
  if (!/\bfetchProfilesChunked\b/.test(src)) wrong.push('it doesn\'t use fetchProfilesChunked');
  if (!/\bbuildRows\b/.test(src)) wrong.push('it doesn\'t use buildRows');
  const bad = src.match(/\b(signEvent|getActiveSigner\w*|publish\w*\s*\(|localStorage|sessionStorage)\b/);
  if (bad) wrong.push(`it uses ${bad[0]}`);
  if (/method\s*:\s*['"](POST|PUT|PATCH|DELETE)['"]/i.test(src)) wrong.push('it sends a non-GET request');
  const imp = src.match(/from\s+['"][^'"]*(publish\w*|signerGuard|nostrPublish)[^'"]*['"]/i);
  if (imp) wrong.push(`it imports ${imp[0]}`);
  if (/\btaPubkey\b/.test(src)) wrong.push('it uses taPubkey');
  if (/[0-9a-f]{64}/i.test(src)) wrong.push('it contains a 64-hex literal');
  assert(wrong.length === 0, `${rel(EDIT_HOOK)}: ${wrong.join('; ')}`);
});
test('S3: the page uses the edit model and the edit state, and takes only the relay settings from the config', () => {
  const page = path.join(DIR, 'Index.jsx');
  const src = codeOnly(safeRead(page));
  assert(src, `${rel(page)} does not exist`);
  const wrong = [];
  if (!/from\s+['"]\.\/editTreasureMap(\.js)?['"]/.test(src)) wrong.push('it doesn\'t import ./editTreasureMap');
  if (!/from\s+['"]\.\/useMapEdit(\.js)?['"]/.test(src)) wrong.push('it doesn\'t import ./useMapEdit');
  if (!/\{\s*aRelays\s*\}\s*=\s*useConfig\(\)/.test(src)) wrong.push('it doesn\'t take aRelays from useConfig() (ADR 0003 Implementation notes)');
  if (/\btaPubkey\b/.test(src)) wrong.push('it uses taPubkey');
  assert(wrong.length === 0, `${rel(page)}: ${wrong.join('; ')}`);
});

async function run() {
  console.log(`${NL}=== treasure-map-edit-mode (treasure-map-edit #3) ===`);
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
  console.log(`${NL}treasure-map-edit-mode: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };
