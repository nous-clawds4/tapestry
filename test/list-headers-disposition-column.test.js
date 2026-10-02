/**
 * list-headers-disposition #2: the 🧭 b-disposition column on List Headers.
 *
 * Story: engineering-team/stories/done/list-headers-disposition/2-b-disposition-column.md
 * ADR:   engineering-team/decisions/done/list-headers-disposition/0002-disposition-column-from-the-events-own-tags.md
 * Plan:  engineering-team/stories/done/list-headers-disposition/2-b-disposition-column.test-plan.md
 * Browser half: tests/brainstorm/list-headers-disposition-column.spec.js (what a viewer sees on /tapestry/lists).
 *
 *   D1..D12 — the pure classifier in ui/src/utils/listHeaderDisposition.js, loaded by dynamic import, over
 *             hand-built header events. D9 is the drift guard: the three chips' words must still be the ones
 *             Concept Headers shows (ui/src/pages/concepts/ConceptList.jsx), read off its source.
 *
 * Stack-free: no network, no relay, no publish.
 *
 * EXPECTED NOW (pre-implementation): D1–D12 FAIL, each naming the missing module or rule.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const MODULE_JS = path.join(ROOT, 'ui/src/utils/listHeaderDisposition.js');
const CONCEPT_LIST = path.join(ROOT, 'ui/src/pages/concepts/ConceptList.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const show = (v) => JSON.stringify(v);

async function loadEsm(absPath) {
  try { return await import(pathToFileURL(absPath).href); } catch (err) { return { __error: err }; }
}
let _mod;
async function mod() {
  if (_mod === undefined) _mod = await loadEsm(MODULE_JS);
  assert(_mod && !_mod.__error,
    `ADR 0002 §Implementation: ${path.relative(ROOT, MODULE_JS)} must exist as a pure ESM module Node can import (it must import './bDisposition.js' with the extension)` +
    (_mod && _mod.__error ? ` — import failed: ${_mod.__error.message.split('\n')[0]}` : ''));
  return _mod;
}

const ALICE = 'a1'.repeat(32);
const BOB = 'b1'.repeat(32);
const SOME_EVENT_ID = 'e7'.repeat(32);

/** A header event as the List Headers page receives it from /api/strfry/scan. */
function header({ kind = 39998, pubkey = ALICE, d = 'my-list', b = [], extraTags = [] } = {}) {
  const tags = [];
  if (kind === 39998 && d !== null) tags.push(['d', d]);
  tags.push(['names', 'thing', 'things']);
  for (const v of b) tags.push(Array.isArray(v) ? ['b', ...v] : ['b', v, 'pointer']);
  tags.push(...extraTags);
  return { id: 'f0'.repeat(32), pubkey, kind, created_at: 1790000000, tags, content: '', sig: '0'.repeat(128) };
}
const own = (pubkey = ALICE, d = 'my-list') => `39998:${pubkey}:${d}`;
const glyphs = (r) => (r && Array.isArray(r.marks) ? r.marks.map((m) => m.glyph) : r);

// ── D — the classifier ───────────────────────────────────────────────────────

test('D1: the module exports MARKS (five marks: glyph, title, state), COLUMN_TITLE and listHeaderDisposition', async () => {
  const m = await mod();
  assert(typeof m.listHeaderDisposition === 'function', 'ADR 0002: listHeaderDisposition must be exported');
  assert(typeof m.COLUMN_TITLE === 'string' && m.COLUMN_TITLE.length > 0, 'ADR 0002: COLUMN_TITLE must be exported');
  for (const k of ['wired', 'selfDeclared', 'deferred', 'undecided', 'notApplicable']) {
    const mk = m.MARKS && m.MARKS[k];
    assert(mk && typeof mk.glyph === 'string' && typeof mk.title === 'string' && typeof mk.state === 'string',
      `ADR 0002: MARKS.${k} must be { glyph, title, state }, got ${show(mk)}`);
  }
});

test('D2: a b-tag pointing at the header\'s own address shows 🤝 "self-declared shared concept" (story AC 2)', async () => {
  const { listHeaderDisposition } = await mod();
  const r = listHeaderDisposition(header({ b: [own()] }));
  assert(show(glyphs(r)) === show(['🤝']), `story AC 2: a self-pointing b shows 🤝 alone, got ${show(glyphs(r))}`);
  assert(r.marks[0].title === 'self-declared shared concept', `story AC 2: tooltip "self-declared shared concept", got ${show(r.marks[0].title)}`);
});

test('D3: a b-tag pointing at another header, by address or by event id, shows 🔗 "wired to an external shared concept" (story AC 2)', async () => {
  const { listHeaderDisposition } = await mod();
  for (const [label, b] of [['by address', `39998:${BOB}:their-list`], ['by event id', SOME_EVENT_ID]]) {
    const r = listHeaderDisposition(header({ b: [b] }));
    assert(show(glyphs(r)) === show(['🔗']), `story AC 2: wired ${label} shows 🔗 alone, got ${show(glyphs(r))}`);
    assert(r.marks[0].title === 'wired to an external shared concept',
      `story AC 2: tooltip "wired to an external shared concept", got ${show(r.marks[0].title)}`);
  }
});

test('D4: a header both self-declared and wired shows 🔗 then 🤝, in that order (story AC 2)', async () => {
  const { listHeaderDisposition } = await mod();
  for (const b of [[own(), `39998:${BOB}:their-list`], [`39998:${BOB}:their-list`, own()]]) {
    const r = listHeaderDisposition(header({ b }));
    assert(show(glyphs(r)) === show(['🔗', '🤝']), `story AC 2: both shows 🔗 then 🤝 whatever the tag order (${show(b)}), got ${show(glyphs(r))}`);
  }
});

test('D5: the keep-private marker alone shows 🔒; beside a real b-tag the real one wins and 🔒 does not show (story AC 3)', async () => {
  const { listHeaderDisposition } = await mod();
  const alone = listHeaderDisposition(header({ b: [['b-tag-deferred']] }));
  assert(show(glyphs(alone)) === show(['🔒']), `story AC 3: the marker alone shows 🔒, got ${show(glyphs(alone))}`);
  assert(alone.marks[0].title === 'deliberately private (no shared affiliation)',
    `story AC 3: tooltip "deliberately private (no shared affiliation)", got ${show(alone.marks[0].title)}`);
  const withSelf = listHeaderDisposition(header({ b: [['b-tag-deferred'], own()] }));
  assert(show(glyphs(withSelf)) === show(['🤝']), `story AC 3: marker + self-pointing b shows 🤝 only, got ${show(glyphs(withSelf))}`);
  const withWire = listHeaderDisposition(header({ b: [`39998:${BOB}:their-list`, ['b-tag-deferred']] }));
  assert(show(glyphs(withWire)) === show(['🔗']), `story AC 3: marker + wiring shows 🔗 only, got ${show(glyphs(withWire))}`);
});

test('D6: no b-tag, or only unreadable b values, shows a muted ○ "not yet decided" — never "—", never an error (story AC 4)', async () => {
  const { listHeaderDisposition, MARKS } = await mod();
  const cases = {
    'no b-tag': header({ b: [] }),
    'malformed only': header({ b: ['not-a-coordinate', ['39998:short:x'], ['']] }),
    'b-tag with no value': header({ extraTags: [['b']] }),
  };
  for (const [label, ev] of Object.entries(cases)) {
    let r;
    try { r = listHeaderDisposition(ev); } catch (err) { throw new Error(`story AC 4: ${label} must not throw — threw ${err.message}`); }
    assert(show(glyphs(r)) === show(['○']), `story AC 4: ${label} shows ○ alone, got ${show(glyphs(r))}`);
    assert(r.marks[0].title === 'not yet decided', `story AC 4: ${label} has the tooltip "not yet decided", got ${show(r.marks[0].title)}`);
  }
  assert(MARKS.undecided.glyph === '○' && MARKS.undecided.glyph !== MARKS.notApplicable.glyph,
    'story AC 4: "not yet decided" and "kind 9998" never share a mark');
});

test('D7: a kind-9998 header shows "—", whatever its tags, with a tooltip saying it can\'t be re-published (story AC 5)', async () => {
  const { listHeaderDisposition } = await mod();
  for (const b of [[], [SOME_EVENT_ID], [['b-tag-deferred']], [`39998:${BOB}:their-list`]]) {
    const r = listHeaderDisposition(header({ kind: 9998, b }));
    assert(show(glyphs(r)) === show(['—']), `story AC 5 / book decision 3: kind 9998 with b ${show(b)} shows "—" alone, got ${show(glyphs(r))}`);
    const t = r.marks[0].title;
    assert(/9998/.test(t) && /re-?publish/i.test(t) && /disposition/i.test(t),
      `story AC 5: the tooltip says kind 9998 headers can't be re-published, so they don't take a disposition — got ${show(t)}`);
  }
});

test('D8: the column\'s tooltip names every state the column shows (story AC 1)', async () => {
  const { COLUMN_TITLE } = await mod();
  for (const word of ['wired', 'self-declared', 'private', 'not yet decided']) {
    assert(COLUMN_TITLE.includes(word), `story AC 1: the 🧭 header tooltip must name "${word}", got ${show(COLUMN_TITLE)}`);
  }
});

test('D9: the three chips are Concept Headers\' own — same glyph, same tooltip, word for word (story AC 2, ADR 0002 drift guard)', async () => {
  const { MARKS } = await mod();
  const src = fs.readFileSync(CONCEPT_LIST, 'utf8');
  for (const k of ['wired', 'selfDeclared', 'deferred']) {
    const { glyph, title } = MARKS[k];
    const chip = `title="${title}">${glyph}</span>`;
    assert(src.includes(chip),
      `story AC 2: Concept Headers shows ${show(chip)} — MARKS.${k} has drifted from ui/src/pages/concepts/ConceptList.jsx (or that page changed; then change both)`);
  }
});

test('D10: the b-tag\'s type (pointer / inherit / none) doesn\'t change the disposition (ADR 0002)', async () => {
  const { listHeaderDisposition } = await mod();
  for (const type of [['pointer'], ['inherit'], []]) {
    const r = listHeaderDisposition(header({ b: [[own(), ...type]] }));
    assert(show(glyphs(r)) === show(['🤝']), `ADR 0002: a self-pointing b of type ${show(type)} is still 🤝, got ${show(glyphs(r))}`);
  }
});

test('D11: every result carries a plain state word, so the column sorts and searches as words (ADR 0002)', async () => {
  const { listHeaderDisposition } = await mod();
  const expected = [
    [header({ b: [own()] }), 'self-declared'],
    [header({ b: [`39998:${BOB}:x`] }), 'wired'],
    [header({ b: [own(), `39998:${BOB}:x`] }), 'wired + self-declared'],
    [header({ b: [['b-tag-deferred']] }), 'private'],
    [header({ b: [] }), 'undecided'],
    [header({ kind: 9998 }), 'not applicable'],
  ];
  for (const [ev, state] of expected) {
    const r = listHeaderDisposition(ev);
    assert(r.state === state, `ADR 0002: state must be ${show(state)}, got ${show(r.state)}`);
  }
});

test('D12: a 39998 with no d tag can\'t be self-declared — its own b-tag isn\'t a readable address (ADR 0002)', async () => {
  const { listHeaderDisposition } = await mod();
  const r = listHeaderDisposition(header({ d: null, b: [`39998:${ALICE}:`] }));
  assert(show(glyphs(r)) === show(['○']), `ADR 0002: with no d tag, a b of "39998:<pubkey>:" is unreadable, so the header is undecided — got ${show(glyphs(r))}`);
});

// ── runner ─────────────────────────────────────────────────────────────────────

async function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  console.log('\nlist-headers-disposition #2 — the 🧭 b-disposition column (pure classifier)\n');
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log(`  ✓ ${t.name}`);
    } catch (err) {
      fail++;
      failures.push({ name: t.name, message: err.message });
      console.log(`  ✗ ${t.name}\n      ${err.message}`);
    }
  }
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  return { pass, fail, skipped: 0, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
