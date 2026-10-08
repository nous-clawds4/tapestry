'use strict';
/**
 * treasure-map-edit #2: the cards ignore an everything entry that goes beyond `*` (book decision 11).
 *
 * Story: engineering-team/stories/done/treasure-map-edit/2-the-cards-ignore-scoped-star-entries.md
 * ADR:   engineering-team/decisions/done/treasure-map-edit/0002-only-a-bare-star-counts.md
 * Plan:  engineering-team/stories/done/treasure-map-edit/2-the-cards-ignore-scoped-star-entries.test-plan.md
 *
 * Classes:
 *   I — a `*:…` entry that names anything after the `*` counts on no card (categoryAssistants, pure).          [AC-1]
 *   B — `*` followed only by empty slots is still a plain `*` (pure).                                          [AC-2]
 *   O — an ignored entry changes nothing else: it hides nothing and isn't a backup of a plain `*` (pure).      [AC-3]
 *   P — the draft Treasure Maps grammar's § 13 records the open question (reads the document).                 [AC-5]
 *
 * AC-4 (everything else unchanged) is held by the suites that already pin it: manage-treasure-map-cards (K9 and K16
 * re-aimed by this story), treasure-map-card-rule-edges (H6–H8, F1–F5, X3, X6, X7 and X10 re-aimed), the page suite,
 * and the browser specs.
 *
 * The B rows pass today and pin what must not move. The I, O and P rows FAIL against the current code, which counts a
 * `*:…` entry for the families its system word allows, and against the current draft, whose § 13 has no such question.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const VIEW_MODEL = path.join(REPO, 'ui/src/pages/treasure-map/manageTreasureMap.js');
const DRAFT = path.join(REPO, 'protocols/drafts/treasure-maps.md');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const C = 'c3'.repeat(32);
const D = 'd1'.repeat(32);
const R = 'wss://relay.example';
const LETTER = { [A]: 'A', [B]: 'B', [C]: 'C', [D]: 'D' };

// Stand-ins for a category and a Tag; any segment without a colon will do.
const X = 'naddr1x';
const T = 'naddr1t';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
const letters = (list) => (Array.isArray(list) ? `[${list.map((pk) => LETTER[pk] || pk).join(', ')}]` : show(list));

let loaded = null;
async function categoryAssistants() {
  if (!loaded) {
    try { loaded = await import(`${pathToFileURL(VIEW_MODEL).href}?t=${Date.now()}`); } catch (err) {
      throw new Error(`${rel(VIEW_MODEL)} could not be loaded in Node: ${err.message}`);
    }
  }
  assert(typeof loaded.categoryAssistants === 'function', `${rel(VIEW_MODEL)} does not export categoryAssistants()`);
  return loaded.categoryAssistants;
}
const mapOf = (entries) => ({ id: '9'.repeat(64), pubkey: 'a1'.repeat(32), kind: 10040, created_at: 1, content: '', sig: 'f'.repeat(128), tags: entries.map(([k, pk]) => [k, pk, R]) });
const NONE = { scores: [], lists: [], concepts: [] };

/** Run the rule on entries (in Map order) and compare all three cards; [] means Not assigned yet. */
async function expectCards(entries, want) {
  const rule = await categoryAssistants();
  let got;
  try { got = rule(mapOf(entries)); } catch (err) { throw new Error(`threw ${err.message}`); }
  const wrong = [];
  for (const [card, list] of Object.entries(want)) {
    const g = got && got[card];
    if (show(g) !== show(list)) wrong.push(`${card}: want ${letters(list)}, got ${letters(g)}`);
  }
  const map = entries.map(([k, pk]) => `${k} → ${LETTER[pk] || pk}`).join(', ');
  assert(wrong.length === 0, `${map} — ${wrong.join('; ')}`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// I — AC-1: an everything entry that names anything after the `*` counts on no card
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('I1: `*:tag` → D — Not assigned yet on all three cards', () =>
  expectCards([['*:tag', D]], NONE));
test('I2: `*:rank` → D — Not assigned yet on all three cards', () =>
  expectCards([['*:rank', D]], NONE));
test('I3: `*:contexts` → D — Not assigned yet on all three cards', () =>
  expectCards([['*:contexts', D]], NONE));
test('I4: `*:tag:<X>:<T>:confidence` → D (the review’s finding 1) — Not assigned yet on all three cards', () =>
  expectCards([[`*:tag:${X}:${T}:confidence`, D]], NONE));
test('I5: `*::rank` → D (an empty slot, then more) — Not assigned yet on all three cards', () =>
  expectCards([['*::rank', D]], NONE));
test('I6: `30382:rank` → A and `*:rank` → D — Scores: A; Lists and Concepts: Not assigned yet', () =>
  expectCards([['30382:rank', A], ['*:rank', D]], { scores: [A], lists: [], concepts: [] }));
test('I7: `30392` → A and `*:tag` → D — Scores: Not assigned yet; Lists: A; Concepts: Not assigned yet', () =>
  expectCards([['30392', A], ['*:tag', D]], { scores: [], lists: [A], concepts: [] }));
test('I8: `3038x:tag:<X>` → B and `*:tag` → D — Scores: B; Lists and Concepts: Not assigned yet', () =>
  expectCards([[`3038x:tag:${X}`, B], ['*:tag', D]], { scores: [B], lists: [], concepts: [] }));

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// B — AC-2: `*:` alone is still `*`
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('B1: `*:` → C — C on all three cards (as today)', () =>
  expectCards([['*:', C]], { scores: [C], lists: [C], concepts: [C] }));
test('B2: `*::` → C — C on all three cards (as today)', () =>
  expectCards([['*::', C]], { scores: [C], lists: [C], concepts: [C] }));
test('B3: `3038x` → B and `*:` → C — Scores: B; Lists and Concepts: C (as today)', () =>
  expectCards([['3038x', B], ['*:', C]], { scores: [B], lists: [C], concepts: [C] }));
test('B4: `*` → C, then `*:` → D are one key — C on all three cards; D is a backup (as today)', () =>
  expectCards([['*', C], ['*:', D]], { scores: [C], lists: [C], concepts: [C] }));

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// O — AC-3: an ignored entry changes nothing else on the cards
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('O1: `*:tag` → D, then `*` → C — C on all three cards (D is neither counted nor the key `*`)', () =>
  expectCards([['*:tag', D], ['*', C]], { scores: [C], lists: [C], concepts: [C] }));
test('O2: `*:tag` → D and `3038x:tag` → B — Scores: B; Lists and Concepts: Not assigned yet', () =>
  expectCards([['*:tag', D], ['3038x:tag', B]], { scores: [B], lists: [], concepts: [] }));

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// P — AC-5: the draft grammar records the open question
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** The draft's § 13, from its heading to the next `## ` heading. */
function section13() {
  let src;
  try { src = fs.readFileSync(DRAFT, 'utf8'); } catch (err) { throw new Error(`${rel(DRAFT)} can't be read: ${err.message}`); }
  const start = src.indexOf(`${NL}## 13.`);
  assert(start >= 0, `${rel(DRAFT)} has no "## 13." heading`);
  const end = src.indexOf(`${NL}## `, start + 1);
  return end < 0 ? src.slice(start) : src.slice(start, end);
}

test('P1: the draft’s § 13 asks whether `*:<scope>` is needed, naming `3038x:<scope>` and `3039x:<scope>` as the alternative', () => {
  const s13 = section13();
  const missing = ['`*:<scope>`', '`3038x:<scope>`', '`3039x:<scope>`'].filter((w) => !s13.includes(w));
  assert(missing.length === 0, `${rel(DRAFT)} § 13 doesn't name ${missing.join(', ')}`);
});
test('P2: the draft’s § 13 says Brainstorm reads only a bare `*` for now', () => {
  const s13 = section13();
  assert(/Brainstorm/.test(s13) && /bare `\*`/.test(s13), `${rel(DRAFT)} § 13 doesn't say that Brainstorm reads only a bare \`*\``);
});
test('P3: the question is a new numbered item after the eleven already there (items 1–11 stay)', () => {
  const s13 = section13();
  const numbers = (s13.match(new RegExp(`${NL}(\\d+)\\. `, 'g')) || []).map((m) => Number(m.trim().slice(0, -1)));
  const want = Array.from({ length: 12 }, (_, i) => i + 1);
  assert(want.every((n) => numbers.includes(n)), `${rel(DRAFT)} § 13 items: want 1–12, found ${show(numbers)}`);
});

async function run() {
  console.log(`${NL}=== treasure-map-star-scopes-ignored (treasure-map-edit #2) ===`);
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
  console.log(`${NL}treasure-map-star-scopes-ignored: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };
