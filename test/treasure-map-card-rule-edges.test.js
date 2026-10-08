'use strict';
/**
 * treasure-map-edit #1: the cards' counting rule follows the draft Treasure Maps grammar in three edge cases.
 *
 * Story: engineering-team/stories/treasure-map-edit/1-the-card-rule-edge-cases.md
 * ADR:   engineering-team/decisions/treasure-map-edit/0001-the-card-rule-compares-keys-segment-by-segment.md
 * Plan:  engineering-team/stories/treasure-map-edit/1-the-card-rule-edge-cases.test-plan.md
 *
 * Re-aimed by treasure-map-edit #2 (book decision 11; ADR treasure-map-edit/0002): a `*:…` entry that names anything
 * after the `*` counts on no card. H6–H8, F1–F5, X3, X6, X7 and X10 now expect that; story 2's plan records each change.
 * H1–H5 renamed by treasure-map-edit #3 (story 2's review, non-blocking 3): their names no longer say "covers".
 *
 * Classes (all pure: categoryAssistants(event) in ui/src/pages/treasure-map/manageTreasureMap.js):
 *   H — a broad entry is hidden only where a family entry covers it, segment by segment; since story 2, a `*:…`
 *       entry counts nowhere, covered or not.                                                                [AC-1]
 *   F — a `*:` entry with a system word or metric: since story 2 it reaches no category.                    [AC-2]
 *   N — two spellings of one key count as one key; a Concept's d tag stays as written.                     [AC-3]
 *   X — the cases ADR 0001's Implementation notes add, and the story's § Out of scope kept as today.  [AC-1..AC-3]
 *
 * AC-4 (everything else unchanged) is held by the suites that already pin it, unchanged: manage-treasure-map-cards
 * (K1–K20, C, W, S), manage-treasure-map-page, and the two manage-treasure-map browser specs.
 *
 * Rows whose story table says "same" pass today and pin what must not move. Every other row FAILS against the current
 * code, which hides a `*:…` entry only behind the exact `3038x:<rest>`, lets every `*:…` reach Scores and Lists, and
 * groups entries by the key as written.
 */

const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const VIEW_MODEL = path.join(REPO, 'ui/src/pages/treasure-map/manageTreasureMap.js');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const C = 'c3'.repeat(32);
const D = 'd1'.repeat(32);
const R = 'wss://relay.example';
const LETTER = { [A]: 'A', [B]: 'B', [C]: 'C', [D]: 'D' };

// Stand-ins for a category (a DList's naddr, say) and a Tag; any segment without a colon will do.
const X = 'naddr1x';
const Y = 'naddr1y';
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

/** Run the rule on entries (in Map order) and compare the named cards; '—' in a message means Not assigned yet. */
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
// H — AC-1: a broad entry counts only where nothing more specific covers it
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('H1 (story 3): `3038x:tag` → B and `*:tag:<X>` → D, which is ignored (story 2) — Scores: B', () =>
  expectCards([['3038x:tag', B], [`*:tag:${X}`, D]], { scores: [B] }));
test('H2 (story 3): `3038x:tag:` (an empty last segment) → B and `*:tag:<X>` → D, which is ignored — Scores: B', () =>
  expectCards([['3038x:tag:', B], [`*:tag:${X}`, D]], { scores: [B] }));
test('H3 (story 3): `3038x:tag::<T>` → B and `*:tag:<X>:<T>` → D, which is ignored — Scores: B', () =>
  expectCards([[`3038x:tag::${T}`, B], [`*:tag:${X}:${T}`, D]], { scores: [B] }));
test('H4 (story 3): Lists — `3039x:dlist` → B and `*:dlist:<X>` → D, which is ignored — Lists: B', () =>
  expectCards([['3039x:dlist', B], [`*:dlist:${X}`, D]], { lists: [B] }));
test('H5 (story 3): `3038x:tag` → B and `*:tag` → D, which is ignored — Scores: B', () =>
  expectCards([['3038x:tag', B], ['*:tag', D]], { scores: [B] }));
test('H6 (story 2): `3038x:tag:<X>` → B and `*:tag` → D, which is ignored — Scores: B', () =>
  expectCards([[`3038x:tag:${X}`, B], ['*:tag', D]], { scores: [B] }));
test('H7 (story 2): `3038x:tag:<X>` → B and `*:tag:<Y>` → D, which is ignored — Scores: B', () =>
  expectCards([[`3038x:tag:${X}`, B], [`*:tag:${Y}`, D]], { scores: [B] }));
test('H8 (story 2): `30382:rank` → A and `*:rank` → D, which is ignored — Scores: A', () =>
  expectCards([['30382:rank', A], ['*:rank', D]], { scores: [A] }));

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// F — AC-2, re-aimed by story 2: a `*:` entry with a system word or a metric reaches no category
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('F1 (story 2): `*:rank` → D is ignored — Not assigned yet on all three cards', () =>
  expectCards([['*:rank', D]], { scores: [], lists: [], concepts: [] }));
test('F2 (story 2): `*:contexts` → D is ignored — Not assigned yet on all three cards', () =>
  expectCards([['*:contexts', D]], { scores: [], lists: [], concepts: [] }));
test('F3 (story 2): `*:pin` → D is ignored — Not assigned yet on all three cards', () =>
  expectCards([['*:pin', D]], { scores: [], lists: [], concepts: [] }));
test('F4 (story 2): `30392` → A and `*:rank` → D, which is ignored — Scores: Not assigned yet; Lists: A', () =>
  expectCards([['30392', A], ['*:rank', D]], { scores: [], lists: [A], concepts: [] }));
test('F5 (story 2): `3038x` → B and `*:contexts` → D, which is ignored — Scores: B; Lists: Not assigned yet', () =>
  expectCards([['3038x', B], ['*:contexts', D]], { scores: [B], lists: [], concepts: [] }));

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// N — AC-3: two spellings of one key count as one key
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('N1: Concepts — `39998` → A, then `39998:dlist-header` → B are one key — Concepts: A (B is a backup)', () =>
  expectCards([['39998', A], ['39998:dlist-header', B]], { concepts: [A] }));
test('N2: Concepts — `39998:dlist-header` → B, then `39998` → A — Concepts: B (the first listed wins)', () =>
  expectCards([['39998:dlist-header', B], ['39998', A]], { concepts: [B] }));
test('N3: `*` → C, then `*:` → D are one key — C on all three cards', () =>
  expectCards([['*', C], ['*:', D]], { scores: [C], lists: [C], concepts: [C] }));
test('N4: `3038x:tag` → B, then `3038x:tag:` → D are one key — Scores: B', () =>
  expectCards([['3038x:tag', B], ['3038x:tag:', D]], { scores: [B] }));
test('N5: a Concept keeps its d tag as written — `39998:dog-breed` → A and `39998:dog-breed:` → B are two Concepts (as today)', () =>
  expectCards([['39998:dog-breed', A], ['39998:dog-breed:', B]], { concepts: [A, B] }));

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// X — the cases ADR 0001 adds, and the story's § Out of scope kept as today
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('X1: `3038x:` is `3038x`, so it covers `*` → C for Scores — Scores: B; Lists and Concepts: C', () =>
  expectCards([['3038x:', B], ['*', C]], { scores: [B], lists: [C], concepts: [C] }));
test('X2: `*::` is `*`, so it reaches all three cards — C on Scores, Lists and Concepts', () =>
  expectCards([['*::', C]], { scores: [C], lists: [C], concepts: [C] }));
test('X3 (story 2): `*:tag:` is `*:tag`, which is ignored — Scores: B (from `3038x:tag`); Lists: Not assigned yet', () =>
  expectCards([['3038x:tag', B], ['*:tag:', D]], { scores: [B], lists: [] }));
test('X4: an exact kind folds too — `30382:rank` → A, then `30382:rank:` → B are one key — Scores: A', () =>
  expectCards([['30382:rank', A], ['30382:rank:', B]], { scores: [A] }));
test('X5: `30396:tag` → A, then `30396:tag::` → B are one key — Lists: A', () =>
  expectCards([['30396:tag', A], ['30396:tag::', B]], { lists: [A] }));
test('X6 (story 2): `*:Tag` → D is ignored like any `*:…` entry — Not assigned yet on all three cards', () =>
  expectCards([['*:Tag', D]], { scores: [], lists: [], concepts: [] }));
test('X7 (story 2): a family entry with no valid delegate hides nothing — `3038x:` → (not a key) and `*` → D — Scores: D', () =>
  expectCards([['3038x:', 'not-a-key'], ['*', D]], { scores: [D] }));
test('X8: only kind 39998’s `dlist-header` folds — `39999` → A and `39999:dlist-header` → B are two keys — Concepts: A and B', () =>
  expectCards([['39999', A], ['39999:dlist-header', B]], { concepts: [A, B] }));
test('X9: a Concept d tag with colons stays whole — `39998:a:b` → A and `39998:a` → B are two keys — Concepts: A and B', () =>
  expectCards([['39998:a:b', A], ['39998:a', B]], { concepts: [A, B] }));
test('X10 (story 2): `*::rank` (an empty slot, then more) → D is ignored — Not assigned yet on all three cards', () =>
  expectCards([['*::rank', D]], { scores: [], lists: [], concepts: [] }));
test('X11: out of scope, as today — `3039x:rank` (a metric on a List family) → D reaches Lists', () =>
  expectCards([['3039x:rank', D]], { scores: [], lists: [D], concepts: [] }));

async function run() {
  console.log(`${NL}=== treasure-map-card-rule-edges (treasure-map-edit #1) ===`);
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
  console.log(`${NL}treasure-map-card-rule-edges: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };
