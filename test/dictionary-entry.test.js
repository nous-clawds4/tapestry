/**
 * The Dictionary entry page, laid out as the design's Dictionary entry screen (the owner's Claude
 * Design artifact, 2026-10-01; recorded in docs/DICTIONARY_PAGE_HANDOFF.md).
 *
 * The entry's Items are the events z-filed under its concept by people the active point of view
 * trusts (the qualifying set GUM₁ counts), plus the reader's own filings. What has no backend yet is
 * shown disabled with a note: the Trusted Curation Method, the Curation switches, Veto, item pages.
 *
 *   I1..I11 — pure: trustedItems in src/lib/trustedDictionary.js (I8–I10: a curation copy and its
 *             original are one item; I11: the response cap).
 *   C1..C3 — pure: conceptCurator in ui/src/utils/treasureMap.js (dynamic import).
 *   E1..E6 — structural pins, read off comment-stripped source: the route and its seam, the
 *            client read, the design's sections in order, the disabled controls with their notes,
 *            and the dropped sample chips.
 *
 * The browser half (search, sort, pages, panels) is tests/brainstorm/dictionary-concepts.spec.js D10.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const LIB_JS = path.join(ROOT, 'src/lib/trustedDictionary.js');
const ADOPTION_API_JS = path.join(ROOT, 'src/api/adoption/index.js');
const UI = path.join(ROOT, 'ui/src');
const ENTRY_JSX = path.join(UI, 'pages/dictionaries/ConceptEntry.jsx');
const HELPERS_JS = path.join(UI, 'pages/dictionaries/conceptsDictionary.js');
const DICTIONARY_ENTRY_JSX = path.join(UI, 'pages/dictionary/Entry.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function src(p) {
  let s = '';
  try { s = fs.readFileSync(p, 'utf8'); } catch { /* reported below */ }
  assert(s.length > 0, `${path.relative(ROOT, p)} must exist`);
  return s;
}
const flat = (s) => s.replace(/\s+/g, ' ');
/** Source with comments blanked out, so prose cannot satisfy an assertion. */
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

function lib() {
  const mod = require(LIB_JS);
  assert(typeof mod.trustedItems === 'function', 'trustedItems must be exported from src/lib/trustedDictionary.js');
  return mod;
}

const ME = '1'.repeat(64); // the reader's account
const MY_TA = '2'.repeat(64); // the reader's assistant
const TRUSTED = '3'.repeat(64);
const STRANGER = '4'.repeat(64);
const FH = 'f'.repeat(64); // the shared concept's author
const OWN = `39998:${MY_TA}:relay`;
const SHARED = `39998:${FH}:relay`;
const OTHER = `39998:${FH}:something-else`;

let n = 0;
function item(pubkey, z, { name, d, kind = 39999, at } = {}) {
  n += 1;
  const tags = [['z', z]];
  if (d !== undefined) tags.push(['d', d]);
  if (name) tags.push(['name', name]);
  return { id: n.toString(16).padStart(64, '0'), kind, pubkey, created_at: at ?? n, tags };
}

// ═══ I — trustedItems ═════════════════════════════════════════════════════════

test('I1: empty inputs → no items', () => {
  const out = lib().trustedItems({});
  assert(Array.isArray(out.items) && out.items.length === 0, 'no carriers → no items');
  assert(out.filerCount === 0 && out.totalCount === 0, 'and nothing counted');
});

test('I2: only trusted filers, and the reader, are kept; strangers are counted but set aside', () => {
  const zCarriers = [
    item(TRUSTED, SHARED, { name: 'a', d: 'a' }),
    item(STRANGER, SHARED, { name: 'b', d: 'b' }),
    item(MY_TA, OWN, { name: 'c', d: 'c' }),
    item(ME, SHARED, { name: 'd', d: 'd' }),
  ];
  const out = lib().trustedItems({ zCarriers, coords: [OWN, SHARED], qualifying: new Set([TRUSTED]), own: [ME, MY_TA] });
  const names = out.items.map((i) => i.name);
  assert(JSON.stringify(names) === JSON.stringify(['a', 'c', 'd']), `trusted + own, in filing order; got ${JSON.stringify(names)}`);
  assert(out.filerCount === 3, `three distinct kept filers, got ${out.filerCount}`);
  assert(out.totalCount === 4, `every distinct item before the filter, got ${out.totalCount}`);
});

test('I3: a carrier filed under another concept is not an item here', () => {
  const zCarriers = [item(TRUSTED, OTHER, { name: 'x', d: 'x' }), item(TRUSTED, SHARED, { name: 'y', d: 'y' })];
  const out = lib().trustedItems({ zCarriers, coords: [SHARED], qualifying: [TRUSTED] });
  assert(out.items.length === 1 && out.items[0].name === 'y', 'only z → one of coords');
  assert(out.totalCount === 1, 'the other concept\'s carrier is not counted either');
});

test('I4: an addressable item is one item, the newest version winning', () => {
  const zCarriers = [
    item(TRUSTED, SHARED, { name: 'old name', d: 'r', at: 10 }),
    item(TRUSTED, SHARED, { name: 'new name', d: 'r', at: 20 }),
  ];
  const out = lib().trustedItems({ zCarriers, coords: [SHARED], qualifying: [TRUSTED] });
  assert(out.items.length === 1, `one item, got ${out.items.length}`);
  assert(out.items[0].name === 'new name', 'the newest version wins');
  assert(out.items[0].address === `39999:${TRUSTED}:r`, `its address is kind:pubkey:d, got ${out.items[0].address}`);
});

test('I5: a regular (non-addressable) event is one item per id', () => {
  const zCarriers = [item(TRUSTED, SHARED, { name: 'p', kind: 9999 }), item(TRUSTED, SHARED, { name: 'p', kind: 9999 })];
  const out = lib().trustedItems({ zCarriers, coords: [SHARED], qualifying: [TRUSTED] });
  assert(out.items.length === 2, 'two ids, two items');
  assert(out.items.every((i) => i.address === null), 'a regular event has no address');
});

test('I6: the name falls back names → name → title → d → a short id', () => {
  const withNames = item(TRUSTED, SHARED, { name: 'plain', d: 'slug' });
  withNames.tags.push(['names', 'singular', 'plural']);
  const titled = item(TRUSTED, SHARED, { d: 'tl-pin-1', kind: 30000 });
  titled.tags.push(['title', 'A pin export']);
  const dOnly = item(TRUSTED, SHARED, { d: 'only-d' });
  const bare = item(TRUSTED, SHARED, { kind: 9999 });
  const out = lib().trustedItems({ zCarriers: [withNames, titled, dOnly, bare], coords: [SHARED], qualifying: [TRUSTED] });
  const names = out.items.map((i) => i.name);
  assert(names[0] === 'singular', `names wins, got ${names[0]}`);
  assert(names[1] === 'A pin export', `then title (a NIP-51 list has no name), got ${names[1]}`);
  assert(names[2] === 'only-d', `then d, got ${names[2]}`);
  assert(names[3] === `${bare.id.slice(0, 8)}…`, `then a short id, got ${names[3]}`);
});

test('I7: filing order is oldest first, ties broken by id', () => {
  const late = item(TRUSTED, SHARED, { name: 'late', d: 'l', at: 50 });
  const early = item(TRUSTED, SHARED, { name: 'early', d: 'e', at: 5 });
  const out = lib().trustedItems({ zCarriers: [late, early], coords: [SHARED], qualifying: [TRUSTED] });
  assert(out.items.map((i) => i.name).join() === 'early,late', 'oldest first');
});

/** A curation copy as src/api/dlist-curation/updateEvents.js composes it: kind 39999, d copy-…, z my header, q → original. */
function copyOf(original, { assistant = MY_TA, header = OWN, at } = {}) {
  n += 1;
  const ref = original.kind === 39999 ? `39999:${original.pubkey}:${original.tags.find((t) => t[0] === 'd')[1]}` : original.id;
  const tags = [['d', `copy-${n.toString(16).padStart(64, '0')}`], ['z', header]];
  if (ref !== original.id) tags.push(['q', ref, '']);
  tags.push(['q', original.id, '', original.pubkey]);
  const name = original.tags.find((t) => t[0] === 'name');
  if (name) tags.push([...name]);
  return { id: n.toString(16).padStart(64, '0'), kind: 39999, pubkey: assistant, created_at: at ?? n, tags };
}

test('I8: a curation copy and its trusted original are one item: the original, with its filer', () => {
  const fido = item(TRUSTED, SHARED, { name: 'Fido', d: 'fido' });
  const out = lib().trustedItems({ zCarriers: [fido, copyOf(fido)], coords: [OWN, SHARED], qualifying: [TRUSTED], own: [ME, MY_TA] });
  assert(out.items.length === 1, `one item, got ${out.items.map((i) => `${i.name} by ${i.author.slice(0, 4)}`)}`);
  assert(out.items[0].author === TRUSTED, 'the original stays: it carries the real filer');
  assert(out.totalCount === 1, `counted once, got ${out.totalCount}`);
});

test('I9: when the original\'s filer is not trusted, the reader\'s own copy is the item', () => {
  const rex = item(STRANGER, SHARED, { name: 'Rex', d: 'rex' });
  const regular = item(STRANGER, SHARED, { name: 'Spot', kind: 9999 });
  const out = lib().trustedItems({
    zCarriers: [rex, copyOf(rex), regular, copyOf(regular)], coords: [OWN, SHARED], qualifying: [TRUSTED], own: [ME, MY_TA],
  });
  assert(out.items.length === 2 && out.items.every((i) => i.author === MY_TA), 'the Assistant\'s copies stand in, once each');
  assert(out.totalCount === 2, `two items in all, got ${out.totalCount}`);
});

test('I10: only a curation copy collapses; any other event that quotes an item is its own item', () => {
  const fido = item(TRUSTED, SHARED, { name: 'Fido', d: 'fido' });
  const quote = item(TRUSTED, SHARED, { name: 'Fido, again', d: 'fido-again' });
  quote.tags.push(['q', `39999:${TRUSTED}:fido`, '']);
  const out = lib().trustedItems({ zCarriers: [fido, quote], coords: [SHARED], qualifying: [TRUSTED] });
  assert(out.items.length === 2, 'a q tag alone does not make a copy');
});

test('I11: at most `limit` items come back, oldest first; the counts still cover all', () => {
  const zCarriers = Array.from({ length: 5 }, (_, i) => item(TRUSTED, SHARED, { name: `n${i}`, d: `n${i}`, at: 100 + i }));
  const out = lib().trustedItems({ zCarriers, coords: [SHARED], qualifying: [TRUSTED], limit: 3 });
  assert(out.items.map((i) => i.name).join() === 'n0,n1,n2', `the first three, got ${out.items.map((i) => i.name)}`);
  assert(out.truncated === true && out.keptCount === 5 && out.totalCount === 5, 'truncated, with keptCount and totalCount whole');
  const whole = lib().trustedItems({ zCarriers, coords: [SHARED], qualifying: [TRUSTED] });
  assert(whole.truncated === false && whole.items.length === 5, 'under the default cap, nothing is cut');
});

// ═══ C — conceptCurator ═══════════════════════════════════════════════════════════

const TREASURE_MAP_JS = path.join(UI, 'utils/treasureMap.js');
let _tm;
async function treasureMap() {
  if (_tm === undefined) {
    try { _tm = await import(pathToFileURL(TREASURE_MAP_JS).href); } catch { _tm = null; }
  }
  assert(_tm && typeof _tm.conceptCurator === 'function', 'conceptCurator must be exported from ui/src/utils/treasureMap.js');
  return _tm;
}

test('C1: the Assistant whose Map entry addresses exactly this header curates it; a same-d entry for another header does not', async () => {
  const { conceptCurator: curatorFor } = await treasureMap();
  const tags = [['39998:dlist-header', TRUSTED], ['39998:relay', MY_TA]];
  const out = curatorFor(tags, OWN, null);
  assert(out && out.pubkey === MY_TA && out.why === 'assigned', `["39998:relay", MY_TA] empowers ${OWN}, got ${JSON.stringify(out)}`);
  const elsewhere = curatorFor([['39998:relay', STRANGER]], OWN, MY_TA);
  assert(elsewhere && elsewhere.why === 'local', `["39998:relay", STRANGER] empowers another header, got ${JSON.stringify(elsewhere)}`);
});

test('C2: else the Map\'s blanket DList-header Assistant (the catch-all)', async () => {
  const { conceptCurator: curatorFor } = await treasureMap();
  const out = curatorFor([['39998:dlist-header', TRUSTED], ['39998:other', STRANGER]], OWN, MY_TA);
  assert(out && out.pubkey === TRUSTED && out.why === 'catch-all', `got ${JSON.stringify(out)}`);
});

test('C3: else the local Assistant; with none, no curator', async () => {
  const { conceptCurator: curatorFor } = await treasureMap();
  const local = curatorFor([], OWN, MY_TA);
  assert(local && local.pubkey === MY_TA && local.why === 'local', `got ${JSON.stringify(local)}`);
  assert(curatorFor(undefined, OWN, null) === null, 'no Map and no assistant → null');
});

// ═══ E — structural ═══════════════════════════════════════════════════════════

test('E1: GET /api/dictionaries/concepts/items: validated, trust resolved at the shared seam, rule in the pure core', () => {
  const s = flat(code(src(ADOPTION_API_JS)));
  assert(/app\.get\(\s*['"]\/api\/dictionaries\/concepts\/items['"]\s*,\s*handleConceptItems\s*\)/.test(s),
    'the Items route must be registered in the adoption module');
  assert(/COORD\.test\(coord\)/.test(s) && /parseAuthors\(/.test(s), 'coord and authors are validated before any read');
  assert(/strfryScanStream\(\s*\{\s*['"]#z['"]:\s*coords\s*\}/.test(s), 'items are read by z → the entry\'s coordinates');
  assert(/await resolveQualifying\(\{\s*wotPov,\s*userPubkey,\s*authors:\s*filers,\s*cutoff\s*\}\)/.test(s),
    'the trusted set comes from resolveQualifying, the seam GUM₁ uses, from the active point of view');
  assert(/trustedItems\(\{\s*zCarriers,\s*coords,\s*qualifying,\s*own:\s*authors\s*\}\)/.test(s), 'the rule is trustedItems');
});

test('E2: the entry reads its Items through useConceptItems, with the person and the point of view', () => {
  const helpersSrc = flat(code(src(HELPERS_JS)));
  const entry = flat(code(src(ENTRY_JSX)));
  assert(/['"`]\/api\/dictionaries\/concepts\/items/.test(helpersSrc), 'useConceptItems reads /api/dictionaries/concepts/items');
  assert(/useConceptItems\(\{\s*coord,\s*shared:\s*sharedCoord,\s*person,\s*povParams,\s*enabled:\s*settled\s*\}\)/.test(entry),
    'the page passes its coordinate, the shared concept, the person and the active point of view, once the row is known');
  assert(!/\/api\/strfry\/scan[^]*#z/.test(entry), 'the page no longer samples items from strfry itself');
});

test('E3: the design\'s sections, in its order', () => {
  const entry = code(src(ENTRY_JSX));
  const order = [
    'className="dict-entry-title"',
    'className="dict-card dict-items"',
    'dict-curation',
    'dict-entry-faq',
    'dict-author-strip',
    'label="Community Concept header"',
    'id="dict-own-header"',
  ];
  let at = -1;
  for (const marker of order) {
    const i = entry.indexOf(marker, at + 1);
    assert(i > at, `${marker} must come after the previous section`);
    at = i;
  }
  for (const text of ['Search &amp; sort', 'Trusted Curation Method', 'Curated by', 'Recognizes the shared concept',
    'A Shared Community Concept, authored by', 'Who decides which items belong on this list?']) {
    assert(entry.includes(text), `the page must say "${text}"`);
  }
  assert(/const PAGE_SIZE = 10;/.test(entry), 'ten items a page, as the design pages them');
  assert(/value: 'none', label: 'Default order'/.test(entry) && /'A → Z'/.test(entry) && /'Z → A'/.test(entry), 'the design\'s three sorts');
});

test('E4: what has no backend is shown disabled, each with its note', () => {
  const entry = flat(code(src(ENTRY_JSX)));
  assert(/disabled title="Custom curation methods arrive in a later version"/.test(entry), 'Customize is disabled');
  assert(/role="switch" aria-checked="false"[^>]*disabled/.test(entry), 'the Curation switches are off and disabled');
  assert(/These settings arrive in a later version\./.test(entry), 'with a note under the switches');
  assert(/disabled aria-describedby="dict-veto-note"/.test(entry) && /Vetoing and restoring entries by hand arrive with Pins, in a later version\./.test(entry),
    'Veto stays disabled with its note (Pins, SPEC § 3)');
  assert(/Item pages arrive in a later version\./.test(entry), 'the rows are not links yet, and the page says so');
  for (const label of ['Publish Trusted List of items', 'Publish Trusted Lists of Tagged Items', 'Organize items into subsets', 'Update the expected format for list items']) {
    assert(entry.includes(`'${label}'`), `the design's switch "${label}" is listed`);
  }
});

test('E5: the sample chips and the Usage card are gone; the links moved into the header panels', () => {
  const entry = flat(code(src(ENTRY_JSX)));
  assert(!/dict-chips|Some items|useSampleItems/.test(entry), 'the "Some items" chips are replaced by the Items table');
  assert(!/metricLabel\(/.test(entry), 'the Usage card is gone: GUM₁ is the author strip\'s member count');
  assert(/\{members\} \{members === 1 \? 'member' : 'members'\}/.test(entry), 'the strip states the GUM₁ count as members');
  assert(/Open the concept →/.test(entry) && (entry.match(/Raw header event →/g) || []).length === 2, 'both header panels keep their links');
  const dict = flat(code(src(DICTIONARY_ENTRY_JSX)));
  assert(/<ConceptEntryBody listHref=\{DICTIONARY_PATH\} listLabel="Dictionary" profileBase="\/user" \/>/.test(dict),
    '/dictionary/:coord links Filed by names to the Main side\'s profile pages');
});

test('E6: nothing is said from a read that has not happened, or failed', () => {
  const entry = flat(code(src(ENTRY_JSX)));
  assert(/useTreasureMap\([^)]*\{\s*strict:\s*true\s*\}\)/.test(entry), 'the Treasure Map is read strictly');
  assert(/mapSettled && !mapError \? conceptCurator\(/.test(entry), 'a failed Map read names no curator');
  assert(/Could not read \$\{whose\} Treasure Map: \$\{map\.error\}/.test(entry), 'and says so');
  assert(/!settled \? \( <span>Reading \{whose\} Dictionary…<\/span>/.test(entry), 'the author strip waits for the row');
  assert(/!settled \? \( <p className="text-muted">Reading \{whose\} Dictionary…<\/p>/.test(entry), 'so does the Community header panel');
  assert(/entry && sharedCoord && metric === 'gum1' &&/.test(entry), 'the members sentence is GUM₁\'s, and only shown for it');
  assert(/!items\.data \? ''/.test(entry), 'the pager says nothing until the items arrive');
});

// ═══ runner ══════════════════════════════════════════════════════════════════

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${t.name}`); skipped++; }
      else { console.log(`  ✓ ${t.name}`); pass++; }
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      failures.push({ name: t.name, message: err.message });
      fail++;
    }
  }
  console.log(`\ndictionary-entry: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };
