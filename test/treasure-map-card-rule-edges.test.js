'use strict';
/**
 * treasure-map-edit #1: the cards' counting rule follows the draft Treasure Maps grammar in three edge cases.
 *
 * Story: engineering-team/stories/treasure-map-edit/1-the-card-rule-edge-cases.md
 * ADR:   engineering-team/decisions/treasure-map-edit/0001-the-card-rule-compares-keys-segment-by-segment.md
 * Plan:  engineering-team/stories/treasure-map-edit/1-the-card-rule-edge-cases.test-plan.md
 *
 * Classes (all pure: categoryAssistants(event) in ui/src/pages/treasure-map/manageTreasureMap.js):
 *   H — a broad entry is hidden only where a family entry covers it, segment by segment.                    [AC-1]
 *   F — a `*:` entry reaches only the families its system word allows.                                      [AC-2]
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

test('H1: `3038x:tag` → B covers `*:tag:<X>` → D for Scores — Scores: B', () =>
  expectCards([['3038x:tag', B], [`*:tag:${X}`, D]], { scores: [B] }));
test('H2: `3038x:tag:` (an empty last segment) → B covers `*:tag:<X>` → D — Scores: B', () =>
  expectCards([['3038x:tag:', B], [`*:tag:${X}`, D]], { scores: [B] }));
test('H3: `3038x:tag::<T>` (an empty middle segment means any category) → B covers `*:tag:<X>:<T>` → D — Scores: B', () =>
  expectCards([[`3038x:tag::${T}`, B], [`*:tag:${X}:${T}`, D]], { scores: [B] }));
test('H4: Lists — `3039x:dlist` → B covers `*:dlist:<X>` → D — Lists: B', () =>
  expectCards([['3039x:dlist', B], [`*:dlist:${X}`, D]], { lists: [B] }));
test('H5: `3038x:tag` → B covers `*:tag` → D — Scores: B (as today)', () =>
  expectCards([['3038x:tag', B], ['*:tag', D]], { scores: [B] }));
test('H6: `3038x:tag:<X>` → B doesn’t cover `*:tag` → D, which still reaches tag-based Scores outside <X> — Scores: B and D (as today)', () =>
  expectCards([[`3038x:tag:${X}`, B], ['*:tag', D]], { scores: [B, D] }));
test('H7: `3038x:tag:<X>` → B doesn’t cover `*:tag:<Y>` → D — Scores: B and D (as today)', () =>
  expectCards([[`3038x:tag:${X}`, B], [`*:tag:${Y}`, D]], { scores: [B, D] }));
test('H8: a single kind never covers a family — `30382:rank` → A and `*:rank` → D — Scores: A and D (as today)', () =>
  expectCards([['30382:rank', A], ['*:rank', D]], { scores: [A, D] }));

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// F — AC-2: a `*:` entry reaches only the families its system word allows
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('F1: `*:rank` → D names a Score metric — Scores: D; Lists and Concepts: Not assigned yet', () =>
  expectCards([['*:rank', D]], { scores: [D], lists: [], concepts: [] }));
test('F2: `*:contexts` → D is Lists-only — Lists: D; Scores and Concepts: Not assigned yet', () =>
  expectCards([['*:contexts', D]], { scores: [], lists: [D], concepts: [] }));
test('F3: `*:pin` → D reaches Scores and Lists, never Concepts (as today)', () =>
  expectCards([['*:pin', D]], { scores: [D], lists: [D], concepts: [] }));
test('F4: `30392` → A and `*:rank` → D — Scores: D; Lists: A (the metric doesn’t reach Lists)', () =>
  expectCards([['30392', A], ['*:rank', D]], { scores: [D], lists: [A], concepts: [] }));
test('F5: `3038x` → B and `*:contexts` → D — Scores: B; Lists: D (as today)', () =>
  expectCards([['3038x', B], ['*:contexts', D]], { scores: [B], lists: [D], concepts: [] }));

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
test('X3: `*:tag:` is `*:tag`, so `3038x:tag` → B covers it — Scores: B; Lists: D', () =>
  expectCards([['3038x:tag', B], ['*:tag:', D]], { scores: [B], lists: [D] }));
test('X4: an exact kind folds too — `30382:rank` → A, then `30382:rank:` → B are one key — Scores: A', () =>
  expectCards([['30382:rank', A], ['30382:rank:', B]], { scores: [A] }));
test('X5: `30396:tag` → A, then `30396:tag::` → B are one key — Lists: A', () =>
  expectCards([['30396:tag', A], ['30396:tag::', B]], { lists: [A] }));
test('X6: a system word is matched as spelled — `*:Tag` → D is a metric, so Scores only', () =>
  expectCards([['*:Tag', D]], { scores: [D], lists: [], concepts: [] }));
test('X7: a family entry with no valid delegate covers nothing — `3038x:tag` → (not a key) and `*:tag:<X>` → D — Scores: D', () =>
  expectCards([['3038x:tag', 'not-a-key'], [`*:tag:${X}`, D]], { scores: [D] }));
test('X8: only kind 39998’s `dlist-header` folds — `39999` → A and `39999:dlist-header` → B are two keys — Concepts: A and B', () =>
  expectCards([['39999', A], ['39999:dlist-header', B]], { concepts: [A, B] }));
test('X9: a Concept d tag with colons stays whole — `39998:a:b` → A and `39998:a` → B are two keys — Concepts: A and B', () =>
  expectCards([['39998:a:b', A], ['39998:a', B]], { concepts: [A, B] }));
test('X10: out of scope, as today — `*::rank` (an empty system slot) → D reaches Scores and Lists', () =>
  expectCards([['*::rank', D]], { scores: [D], lists: [D], concepts: [] }));
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
