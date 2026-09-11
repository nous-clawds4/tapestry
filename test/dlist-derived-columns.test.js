/**
 * dlist-item-tagging #8: Derived columns for undeclared item fields.
 *
 * Story (Light profile — Design note, edge cases and AC→handle lines all live in the story file):
 *   engineering-team/stories/dlist-item-tagging/8-derived-columns-for-undeclared-fields.md
 *
 * Three classes (house pattern — see test/dlist-browse.test.js):
 *   U (behavioral) — ui/src/utils/dlistFields.js dynamically imported and exercised against
 *                    inline fixture events. The new export derivedFieldDecls() does not exist
 *                    yet, so these FAIL now (a missing export counts as fail, not skip).
 *   S (structure)  — the wiring the pure function cannot reach: the shared table's toggle, the
 *                    showOther threading, the is-derived header class + tooltip, and the AC-6
 *                    horizontal-scroll rule in styles.css. FAIL now.
 *   R (sentinel)   — what the Design note promised not to disturb: the off-state markup and the
 *                    three mount sites that must need no per-surface code. PASS before and after.
 *
 * No stack dependency: nothing here talks to strfry, Neo4j, or the control panel. Every input is
 * an inline fixture or a source file on disk — no external dependency, hence no error-path table.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const UI = path.resolve(__dirname, '../ui/src');
const UTIL = path.join(UI, 'utils/dlistFields.js');
const TABLE = path.join(UI, 'components/dlist/DListItemsTable.jsx');
const ROW = path.join(UI, 'components/dlist/DListItemRow.jsx');
const STYLES = path.join(UI, 'styles.css');
const LIST_PAGE = path.join(UI, 'pages/List.jsx');
const TAG_ITEMS_VIEW = path.join(UI, 'components/TagItemsView.jsx');
const TAG_A_NOTE_MODAL = path.join(UI, 'components/TagANoteModal.jsx');

const HEADER_PK = 'b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450';
const HEADER_COORD = `39998:${HEADER_PK}:github-accounts`;

/** A header that declares exactly one field, `github-username` (required). */
const DECLS = [{ name: 'github-username', requirement: 'required', description: null, type: 'text' }];

let seq = 0;
function item(extraTags = [], overrides = {}) {
  seq += 1;
  return {
    id: String(seq).padStart(64, '0'),
    kind: 39999,
    pubkey: '1'.repeat(64),
    created_at: 1757000100,
    content: '',
    tags: [
      ['d', `item-${seq}`],
      ['z', HEADER_COORD],
      ['github-username', `user-${seq}`],
      ...extraTags,
    ],
    ...overrides,
  };
}

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const names = (decls) => decls.map((d) => d.name);

async function util() {
  const mod = await loadEsm(UTIL);
  assert(mod, 'ui/src/utils/dlistFields.js must exist and be importable as ESM');
  assert(typeof mod.derivedFieldDecls === 'function',
    'Design note: dlistFields.js must export derivedFieldDecls(items, fieldDecls)');
  return mod;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── U: derivedFieldDecls behavior ─────────────────────────── */

test('U1: derivedFieldDecls returns the union of undeclared tag names across the items it is given', async () => {
  const { derivedFieldDecls } = await util();
  const items = [
    item([['alpha', '1'], ['beta', '2']]),
    item([['beta', '3'], ['gamma', '4']]),
  ];
  const derived = derivedFieldDecls(items, DECLS);
  assert(Array.isArray(derived), 'AC-2: derivedFieldDecls returns an array of declarations');
  assert(names(derived).slice().sort().join(',') === 'alpha,beta,gamma',
    `AC-2: the column set is the union across items, got [${names(derived)}]`);
});

test('U2: single-letter tag names are never promoted to a column, and declared names are never duplicated', async () => {
  const { derivedFieldDecls, undeclaredFields } = await util();
  const items = [item([['e', 'ref'], ['p', 'pk'], ['a', 'coord'], ['extra', 'v']])];
  // Assert the inherited exclusion at its source rather than assuming it (Design note).
  const raw = undeclaredFields(items[0], DECLS);
  assert(names(raw).every((n) => n.length > 1),
    `AC-2: undeclaredFields itself drops single-letter names, got [${names(raw)}]`);
  const derived = derivedFieldDecls(items, DECLS);
  assert(names(derived).every((n) => n.length > 1),
    `AC-2: no single-letter column ('d','z','e','p','a') is derived, got [${names(derived)}]`);
  assert(!names(derived).includes('github-username'),
    'AC-2: a header-declared name never appears a second time as a derived column');
  assert(names(derived).includes('extra'), 'AC-2: a multi-letter undeclared tag does become a column');
  assert(new Set(names(derived)).size === derived.length, 'AC-2: each derived name appears exactly once');
});

test('U3: derived columns are ordered most-common first (items carrying the name), not first-appearance', async () => {
  const { derivedFieldDecls } = await util();
  // First appearance order is alpha, beta, gamma; frequency order is beta(3), gamma(2), alpha(1).
  const items = [
    item([['alpha', '1'], ['beta', '2']]),
    item([['beta', '3'], ['gamma', '4']]),
    item([['beta', '5'], ['gamma', '6']]),
  ];
  const order = names(derivedFieldDecls(items, DECLS));
  assert(order.join(',') === 'beta,gamma,alpha',
    `Gate A: order is count-descending (beta,gamma,alpha), not first-appearance (alpha,beta,gamma); got [${order}]`);
});

test('U4: ties in frequency are broken by first appearance', async () => {
  const { derivedFieldDecls } = await util();
  const items = [
    item([['zeta', '1'], ['delta', '2']]),
    item([['common', 'a']]),
    item([['common', 'b']]),
  ];
  const order = names(derivedFieldDecls(items, DECLS));
  assert(order.join(',') === 'common,zeta,delta',
    `Gate A: equal counts keep first-appearance order (zeta before delta), got [${order}]`);
});

test('U5: a name repeated on one item counts once — items carrying it, not tag occurrences (E1)', async () => {
  const { derivedFieldDecls } = await util();
  const items = [
    item([['twice', 'a'], ['twice', 'b'], ['twice', 'c']]),
    item([['spread', 'x']]),
    item([['spread', 'y']]),
  ];
  const order = names(derivedFieldDecls(items, DECLS));
  assert(order.join(',') === 'spread,twice',
    `E1: "twice" appears 3× on one item but on only 1 item, so "spread" (2 items) sorts first; got [${order}]`);
});

test('U6: each derived declaration has parseFieldDecls\' shape with requirement "derived" and derived: true', async () => {
  const { derivedFieldDecls, parseFieldDecls } = await util();
  const derived = derivedFieldDecls([item([['alpha', '1']])], DECLS);
  assert(derived.length === 1, `expected one derived decl, got ${derived.length}`);
  const d = derived[0];
  const declaredShape = Object.keys(parseFieldDecls({
    kind: 39998, pubkey: HEADER_PK, tags: [['d', 'x'], ['required', 'github-username']],
  })[0]).sort();
  const derivedShape = Object.keys(d).filter((k) => k !== 'derived').sort();
  assert(derivedShape.join(',') === declaredShape.join(','),
    `Design note: derived decls carry the same keys as parseFieldDecls' (${declaredShape}), got (${derivedShape})`);
  assert(d.name === 'alpha', 'the decl is named after the tag');
  assert(d.requirement === 'derived', `Design note: requirement is the marker 'derived', got ${JSON.stringify(d.requirement)}`);
  assert(d.type === 'text', `Design note: derived columns render as text, got ${JSON.stringify(d.type)}`);
  assert(d.description === null, `Design note: no description is invented, got ${JSON.stringify(d.description)}`);
  assert(d.derived === true, 'Design note: an explicit derived: true flag for future consumers');
});

test('U7: fieldCellModel never marks a derived column missing, but still marks a declared-required one (AC-4)', async () => {
  const { derivedFieldDecls, fieldCellModel } = await util();
  const withAlpha = item([['alpha', '1']]);
  const without = item();
  const [alphaDecl] = derivedFieldDecls([withAlpha], DECLS);
  const cell = fieldCellModel(without, alphaDecl);
  assert(cell.value === null, 'AC-4: an item lacking a derived field has no value');
  assert(cell.missing === false,
    'AC-4: a derived column with no value renders empty, never the "missing" marker');
  const required = fieldCellModel({ kind: 39999, tags: [['d', 'x']] }, DECLS[0]);
  assert(required.missing === true,
    'AC-4 contrast: a declared *required* field with no value is still marked missing');
});

test('U8: an item carrying the derived field still renders its value and +N more through fieldCellModel', async () => {
  const { derivedFieldDecls, fieldCellModel } = await util();
  const it = item([['alpha', 'first'], ['alpha', 'second']]);
  const [alphaDecl] = derivedFieldDecls([it], DECLS);
  const cell = fieldCellModel(it, alphaDecl);
  assert(cell.value === 'first', `E1: the cell shows the first value, got ${JSON.stringify(cell.value)}`);
  assert(cell.extra === 1, `E1: further same-name tags surface as +N more, got ${cell.extra}`);
});

test('U9: degenerate inputs derive nothing and never throw (no items, nothing undeclared, junk)', async () => {
  const { derivedFieldDecls } = await util();
  assert(derivedFieldDecls([], DECLS).length === 0, 'AC-8: no items → nothing to derive');
  assert(derivedFieldDecls([item()], DECLS).length === 0,
    'AC-8: items whose every non-single-letter tag is declared → nothing to derive (the control is absent)');
  assert(derivedFieldDecls([{ kind: 39999 }], DECLS).length === 0,
    'E8: an item with no tags array contributes nothing and does not throw');
  for (const junk of [null, undefined]) {
    assert(derivedFieldDecls(junk, DECLS).length === 0, `derivedFieldDecls(${junk}, decls) must be []`);
    const undeclaredAll = names(derivedFieldDecls([item([['alpha', '1']])], junk));
    assert(undeclaredAll.slice().sort().join(',') === 'alpha,github-username',
      `E5: derivedFieldDecls(items, ${junk}) treats "no declarations" as "nothing declared" — every non-single-letter tag derives; got [${undeclaredAll}]`);
  }
});

test('U10: an empty-value tag derives no column, but a whitespace-only value still does (E2, accepted as-is)', async () => {
  const { derivedFieldDecls } = await util();
  const empty = names(derivedFieldDecls([item([['blank', '']])], DECLS));
  assert(!empty.includes('blank'), `E2: an empty string value promotes no column, got [${empty}]`);
  const spaces = names(derivedFieldDecls([item([['spacey', '   ']])], DECLS));
  assert(spaces.includes('spacey'),
    'E2: a whitespace-only value DOES promote a (visually blank) column — inherited from undeclaredFields; do not add a trim rule in this story');
});

/* ── S: table / row / styles wiring ────────────────────────── */

test('S1: DListItemsTable owns a showAll toggle labelled "Show all fields", off by default, and renders it only when something is derivable', () => {
  const src = safeRead(TABLE);
  assert(src.length > 0, 'ui/src/components/dlist/DListItemsTable.jsx must exist');
  assert(/derivedFieldDecls/.test(src), 'Design note: the table computes columns via derivedFieldDecls()');
  assert(/useState\(\s*false\s*\)/.test(src) && /showAll/.test(src),
    'AC-1: a component-local showAll state, initialised false (off by default)');
  assert(/Show all fields/.test(src), 'Gate A wording: the control reads "Show all fields"');
  assert(/derived\s*\.\s*length\s*>\s*0|derived\.length\s*!==\s*0|derived\.length\s*&&/.test(src),
    'AC-1/AC-8: the control renders only when derived.length > 0');
  assert(/useMemo/.test(src), 'Design note: derivation is memoised over items/fieldDecls');
  assert(/bs-dlist-table-toolbar/.test(src), 'Design note: the toggle lives in a toolbar above the scroll wrapper');
  assert(/bs-dlist-table-region/.test(src), 'Design note: a new region root wraps toolbar + scroll wrapper');
  assert(!/queryRelay|fetch\(|useParams/.test(src), 'Design note: the table still knows nothing about routes or fetching');
});

test('S2: the derived columns follow the declared ones, and the "other fields" th/td pair is dropped together via showOther', () => {
  const table = safeRead(TABLE);
  const row = safeRead(ROW);
  assert(/showAll\s*\?\s*\[\s*\.\.\.\s*fieldDecls\s*,\s*\.\.\.\s*derived\s*\]/.test(table.replace(/\s+/g, ' ')) || /\.\.\.fieldDecls,\s*\.\.\.derived/.test(table),
    'AC-2: columns = showAll ? [...fieldDecls, ...derived] : fieldDecls — derived after declared');
  assert(/showOther=\{\s*!showAll\s*\}/.test(table),
    'AC-4: the table threads showOther={!showAll} to DListItemRow');
  assert(/showOther/.test(row), 'AC-4: DListItemRow accepts showOther and skips its other-fields <td> when false');
  assert(/showOther\s*&&|!showOther|showOther\s*\?/.test(table),
    'AC-4: the is-other <th> is skipped under the same condition so th/td counts stay aligned');
});

test('S3: derived column headers are visibly marked — is-derived class plus the "derived from its items" title attribute', () => {
  const table = safeRead(TABLE);
  const styles = safeRead(STYLES);
  assert(/is-\$\{decl\.requirement\}|is-derived/.test(table),
    'AC-3: the header class for a derived decl resolves to is-derived');
  assert(/\.bs-dlist-table th\.is-derived/.test(styles),
    'AC-3: styles.css carries a .bs-dlist-table th.is-derived rule');
  assert(/derived from its items/.test(table),
    'AC-3 (J1 correction): the tooltip is a title ATTRIBUTE set in DListItemsTable.jsx — a CSS rule cannot produce it');
  assert(/title=\{[^}]*derived[^}]*\}|title="[^"]*derived from its items/.test(table),
    'AC-3: the derived header\'s title attribute is set in the component, not inherited from decl.description (which is null)');
  assert(/not declared by this list's header|not declared by this list’s header/.test(table),
    'Gate A wording: the tooltip reads "not declared by this list\'s header — derived from its items"');
});

test('S4: AC-6 — .bs-dlist-table can outgrow its container so the scroll happens inside .bs-dlist-table-wrap', () => {
  const styles = safeRead(STYLES);
  assert(/\.bs-dlist-table-wrap\s*\{[^}]*overflow-x:\s*auto/.test(styles),
    'AC-6: the existing .bs-dlist-table-wrap overflow-x: auto is still there');
  assert(/\.bs-dlist-table\s*\{[^}]*width:\s*max-content/.test(styles),
    'AC-6: .bs-dlist-table gets width: max-content so it overflows instead of squeezing');
  assert(/\.bs-dlist-table\s*\{[^}]*min-width:\s*100%/.test(styles),
    'AC-6: .bs-dlist-table keeps min-width: 100% so a narrow table still fills the region');
  assert(/\.bs-dlist-table-wrap\s*\{[^}]*max-width:\s*100%/.test(styles) && /\.bs-dlist-table-wrap\s*\{[^}]*min-width:\s*0/.test(styles),
    'AC-6: the wrap is capped (max-width: 100%; min-width: 0) so a flex/grid parent cannot force the page sideways');
  assert(/\.bs-dlist-table-region/.test(styles) && /\.bs-dlist-table-toolbar/.test(styles),
    'Design note: the new region and toolbar classes are styled');
  assert(!/position:\s*sticky/.test(styles.slice(styles.indexOf('.bs-dlist-table-wrap'), styles.indexOf('.bs-dlist-table-wrap') + 2000)),
    'Gate A: no sticky first column in v1');
});

/* ── R: regression sentinels (pass today) ──────────────────── */

test('R1: with the toggle off the table renders exactly as today — the literal "Other fields" header survives', () => {
  const table = safeRead(TABLE);
  const row = safeRead(ROW);
  assert(/Other fields/.test(table), 'AC-5: the off-state "Other fields" header string (also pinned by dlist-browse.test.js) is unchanged');
  assert(/is-other/.test(table), 'AC-5: the is-other header class is unchanged');
  assert(/undeclaredFields/.test(row) && /<details/.test(row) && /<summary/.test(row),
    'AC-5: the collapsed details/summary other-fields cell is untouched');
  assert(/other field/.test(row), 'AC-5: the "N other field(s)" wording is untouched');
  assert(/bs-dlist-missing/.test(row), 'AC-5: the declared-required "missing" marker still exists in the row');
});

test('R2: the three mount sites carry no per-surface derived-column code (AC-7)', () => {
  for (const [label, file] of [['List.jsx', LIST_PAGE], ['TagItemsView.jsx', TAG_ITEMS_VIEW], ['TagANoteModal.jsx', TAG_A_NOTE_MODAL]]) {
    const src = safeRead(file);
    assert(src.length > 0, `${label} must exist`);
    assert(/DListItemsTable/.test(src), `${label} still mounts the shared table`);
    assert(!/derivedFieldDecls|showAll|Show all fields/.test(src),
      `AC-7: ${label} needs no per-surface code — derivation stays inside DListItemsTable`);
  }
});

test('R3: the operator browsers remain non-consumers of dlistFields and the shared table', () => {
  const a = safeRead(path.join(UI, 'pages/lists/DListItems.jsx'));
  const b = safeRead(path.join(UI, 'pages/events/DListItemsList.jsx'));
  assert(a.length > 0 && b.length > 0, 'both operator browsers must still exist');
  assert(!/dlistFields|components\/dlist/.test(a + b),
    'Blast radius: the operator browsers import neither dlistFields nor DListItemsTable and stay untouched');
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
