/**
 * curated-dlist-update #2: curated headers link with `pointer`, and the curation screens say "copy".
 *
 * Story: engineering-team/stories/done/curated-dlist-update/2-pointer-header-and-copy-wording.md
 * ADR:   engineering-team/decisions/done/curated-dlist-update/0002-pointer-switch-and-copy-wording.md
 *
 * Four classes (house pattern; ESM behavioral import per test/my-curated-dlists-headers.test.js):
 *   U (behavioral) — the new pure export linkTypeLabel; describeCurationHeader's new `notes` beside
 *                    `problems` (the older inherit-items link is a note, not a problem; `pointer` is
 *                    the expected link); curatedItemRows' "already copied" by a `q` tag alone.
 *                    FAIL now: linkTypeLabel does not exist, `notes` is absent, `pointer` is still
 *                    wrong-type, and a mention in any tag still retires a candidate.
 *   S (structure)  — no user-facing "inherit" on the five curation files (comments and bare type
 *                    values excepted); both raw-type displays go through linkTypeLabel; the older-link
 *                    note is plain and the wrong-type warning names "pointer"; the method panel says
 *                    "copy". FAIL now.
 *   D (docs, AC-6) — the "still writes inherit-items until story 2" sentences follow the switch and
 *                    keep copies tied to story 5; BIBLE's glossary names curated-dlist-update ADR 0001.
 *                    FAIL now.
 *   R (sentinel)   — communityPointerOf's reporting and the house b-value owners' exports (ADR Option
 *                    B not taken). PASS before and after.
 *
 * Re-aimed in their own suites (the test plan lists each): the endpoint's contract `b` and its
 * existing-header states (test/dlist-curation-header-endpoint.test.js), the panel description
 * (test/dlist-curation-panel.test.js), "copies from" (test/dlist-curation-map-entries.test.js), the
 * header checks (test/my-curated-dlists-headers.test.js), and the items rules and labels
 * (test/my-curated-dlists-items.test.js).
 *
 * Not covered here: the rendered pages in a browser, and a real Add against the endpoint (the
 * reviewer's live check on the local stack; staging holds the two real older-link headers).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const UI = path.join(ROOT, 'ui/src');
const UTIL = path.join(UI, 'utils/treasureMap.js');
const BDISP = path.join(UI, 'utils/bDisposition.js');
const B_VALUE_FORMS = path.join(ROOT, 'src/lib/bValueForms.js');
const PANEL = path.join(UI, 'pages/grapevine/DListCurationPanel.jsx');
const HEADERS = path.join(UI, 'pages/grapevine/CuratedDListHeaders.jsx');
const ITEMS = path.join(UI, 'pages/grapevine/CuratedDListItems.jsx');
const TAGS_PANEL = path.join(UI, 'pages/grapevine/TreasureMapTagsPanel.jsx');
const CURATION_FILES = [PANEL, HEADERS, ITEMS, TAGS_PANEL, UTIL];
const INHERIT_FROM = path.join(ROOT, 'protocols/drafts/inherit-from.md');
const DESIGNATION = path.join(ROOT, 'protocols/drafts/assistant-designation.md');
const BIBLE = path.join(ROOT, 'BIBLE.md');

const ME = 'a'.repeat(64);                    // the signed-in user's own assistant
const OTHER = 'b'.repeat(64);                 // someone else
const AUTHOR = '0123456789abcdef'.repeat(4);  // the shared list's author
const RELAY = 'wss://dcosl.brainstorm.world';
const MY = `39998:${ME}:dog-breed`;           // my curated list (my assistant's header)
const SHARED = `39998:${AUTHOR}:dog-breed`;   // the shared list

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function rel(p) { return path.relative(ROOT, p); }
async function fn(name) {
  const mod = await loadEsm(UTIL);
  assert(mod && typeof mod.classifyEntry === 'function', 'ui/src/utils/treasureMap.js must load and export classifyEntry');
  assert(typeof mod[name] === 'function', `ui/src/utils/treasureMap.js must export ${name} (ADR 0002 §Implementation 2)`);
  return mod[name];
}
function src(p) {
  const s = safeRead(p);
  assert(s.length > 0, `${rel(p)} must exist`);
  return s;
}

/** Source with comments removed — block comments (JSX comment blocks included) and line comments not in a URL. */
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}
/**
 * Every "inherit" that reads as user-facing text. Not counted: a bare string literal that is exactly a
 * type value ('inherit-items', 'inherit') — code comparing or naming a type — and identifiers
 * (preceded by an identifier character, all-caps INHERIT, or camelCase inheritX).
 */
function inheritHits(code) {
  const hits = [];
  const re = /inherit/gi;
  let m;
  while ((m = re.exec(code))) {
    const i = m.index;
    const before = code[i - 1] || '';
    const token = code.slice(i).match(/^[A-Za-z0-9_$-]+/)[0];
    const quote = before === "'" || before === '"' || before === '`';
    const bareTypeValue = quote && (token === 'inherit' || token === 'inherit-items') && code[i + token.length] === before;
    const identifier = /[A-Za-z0-9_$]/.test(before) || m[0] === 'INHERIT' || /^[A-Z_]/.test(code[i + m[0].length] || '');
    if (!bareTypeValue && !identifier) hits.push(code.slice(Math.max(0, i - 40), i + 40).replace(/\s+/g, ' ').trim());
  }
  return hits;
}
/** The text of one `'key': …` entry in an object literal, up to the next key or the end of the object. */
function entry(s, key) {
  let i = s.indexOf(`'${key}'`);
  if (i < 0) i = s.indexOf(`"${key}"`);
  if (i < 0) return '';
  const rest = s.slice(i + key.length + 2);
  const end = rest.search(/\n\s*['"][A-Za-z-]+['"]\s*:|\n\s*\}\s*;?/);
  return rest.slice(0, end < 0 ? 300 : end);
}

const tests = [];
function test(name, f) { tests.push({ name, fn: f }); }

/* ── U: the pure functions ─────────────────────────────────── */

test('U1: linkTypeLabel — nothing for the expected pointer link, "older link" for the older inherit-items link, the quoted value for anything else', async () => {
  const linkTypeLabel = await fn('linkTypeLabel');
  const table = [
    ['pointer', null], ['', null], [undefined, null], [null, null],
    ['inherit-items', 'older link'],
    ['inherit', '“inherit”'], ['curates', '“curates”'],
    [42, null], [{}, null],
  ];
  for (const [input, want] of table) {
    let got;
    try { got = linkTypeLabel(input); } catch (e) { throw new Error(`ADR Decision §3: never throws — threw on ${JSON.stringify(input)}: ${e.message}`); }
    assert(got === want, `ADR Decision §3: linkTypeLabel(${JSON.stringify(input)}) → ${JSON.stringify(want)}; got ${JSON.stringify(got)}`);
  }
});

test('U2: describeCurationHeader — `pointer` (or no type) is the expected link; the older inherit-items link is a note, not a problem; any other type is still wrong-type', async () => {
  const describe = await fn('describeCurationHeader');
  const header = (tags) => ({ id: 'h'.repeat(64), kind: 39998, pubkey: ME, created_at: 1, content: '', sig: 'x'.repeat(128), tags: [['d', 'dog-breed'], ...tags] });
  const cases = [
    [['b', SHARED, 'pointer'], [], []],
    [['b', SHARED], [], []],
    [['b', SHARED, ''], [], []],
    [['b', SHARED, 'inherit-items'], [], ['older-link']],
    [['b', SHARED, 'inherit'], ['wrong-type'], []],
    [['b', SHARED, 'curates'], ['wrong-type'], []],
  ];
  for (const [b, problems, notes] of cases) {
    const info = describe(header([b]), ME);
    assert(info && info.pointer && info.pointer.coord === SHARED && deepEq(info.problems, problems) && deepEq(info.notes, notes),
      `AC-3 / ADR Decision §2: ${JSON.stringify(b)} → problems ${JSON.stringify(problems)}, notes ${JSON.stringify(notes)}; got ${JSON.stringify(info)}`);
  }
  const none = describe(header([]), ME);
  assert(deepEq(none.problems, ['no-b']) && deepEq(none.notes, []), `ADR Decision §2: notes is always an array — no b → ['no-b'] and no notes; got ${JSON.stringify(none)}`);
  let g;
  try { g = describe(null, ME); } catch (e) { throw new Error(`never throws — threw on null: ${e.message}`); }
  assert(g && Array.isArray(g.notes) && g.notes.length === 0, `ADR Decision §2: garbage → notes []; got ${JSON.stringify(g)}`);
});

test('U3: curatedItemRows — "already copied" means one of my assistant\'s items carries a q naming the item (its address for 39999, else its id); a mention in any other tag, a q value past index 1, or someone else\'s q does not count', async () => {
  const curatedItemRows = await fn('curatedItemRows');
  let n = 0;
  const hex = () => (++n).toString(16).padStart(64, '0');
  const it = (o) => ({
    id: hex(), kind: o.kind || 39999, pubkey: o.pubkey || ME, created_at: 100, content: '', sig: 's'.repeat(128),
    tags: [['z', o.z || MY], ...(o.d ? [['d', o.d]] : []), ['name', o.name], ...(o.tags || [])],
  });
  const coord = (e) => `39999:${e.pubkey}:${e.tags.find((t) => t[0] === 'd')[1]}`;
  const A = it({ pubkey: AUTHOR, d: 'a', name: 'addressed', z: SHARED });        // a 39999 original, copied by its address
  const B = it({ pubkey: AUTHOR, d: 'b', name: 'by version id', z: SHARED });    // a 39999 original, copied by the version's id
  const C = it({ kind: 9999, pubkey: AUTHOR, name: 'regular', z: SHARED });       // a 9999 original, copied by its id
  const D = it({ pubkey: AUTHOR, d: 'd', name: 'mentioned', z: SHARED });         // only mentioned in e / a / b / p → a candidate
  const E = it({ pubkey: AUTHOR, d: 'e', name: 'late q value', z: SHARED });      // its id only at index 2 of a q → a candidate
  const F = it({ pubkey: AUTHOR, d: 'f', name: 'others q', z: SHARED });          // only someone else's q → a candidate
  const mine = [
    it({ d: 'c1', name: 'copy of addressed', tags: [['q', coord(A), RELAY]] }),
    it({ d: 'c2', name: 'copy of by version id', tags: [['q', B.id, RELAY, AUTHOR]] }),
    it({ d: 'c3', name: 'copy of regular', tags: [['q', C.id, RELAY, AUTHOR]] }),
    it({ d: 'c4', name: 'mentions', tags: [['e', D.id], ['a', coord(D)], ['b', coord(D), 'pointer'], ['p', D.id], ['q', 'unrelated', E.id]] }),
    it({ pubkey: OTHER, d: 'o1', name: 'someone else', tags: [['q', coord(F), RELAY]] }),
  ].map((event) => ({ event, local: true }));
  const shared = [A, B, C, D, E, F].map((event) => ({ event, local: true }));
  const rows = curatedItemRows({ mine, shared, assistantPubkey: ME, showOthers: false, showCandidates: true });
  const candidates = rows.filter((r) => r.from === 'candidate').map((r) => r.name).sort();
  assert(deepEq(candidates, ['late q value', 'mentioned', 'others q']),
    `AC-5 / ADR Decision §4: copied = a q by my assistant naming the address or the id (A, B, C); mentions in e/a/b/p (D), a q value past index 1 (E), and someone else's q (F) leave candidates; got ${JSON.stringify(candidates)}`);
});

/* ── S: structure ──────────────────────────────────────────── */

test('S1: no user-facing "inherit" on the curation screens — the panel, the detail page\'s headers and items, the Treasure Map entry line, and the util\'s sentences (comments and bare type values excepted)', () => {
  const offenders = [];
  for (const f of CURATION_FILES) {
    for (const hit of inheritHits(stripComments(src(f)))) offenders.push(`${rel(f)}: …${hit}…`);
  }
  assert(offenders.length === 0, `AC-4: user-facing text says "copy", never "inherit" (raw event JSON excepted); found:\n      ${offenders.join('\n      ')}`);
});

test('S2: both raw-type displays go through linkTypeLabel — the detail page\'s "Points to" line and the Treasure Map entry line, which says "copies from"', () => {
  for (const f of [HEADERS, TAGS_PANEL]) {
    const s = src(f);
    assert(/linkTypeLabel\s*\(/.test(s), `ADR Decision §3 / §5: ${rel(f)} calls linkTypeLabel`);
    assert(!/\(\s*\{\s*(?:info\??\.)?pointer\??\.type\s*\}\s*\)/.test(s), `ADR Decision §5: ${rel(f)} no longer prints the raw type as "({…pointer.type})"`);
  }
  assert(/copies from/.test(src(TAGS_PANEL)), 'AC-4 / ADR Decision §5: the Treasure Map entry says "copies from"');
});

test('S3: the detail page — the older link gets a plain note (no ⚠️) that Update list will upgrade it; the wrong-type warning stays a warning and names "pointer"', () => {
  const s = src(HEADERS);
  assert(/NOTE_SENTENCES\s*=/.test(s), 'ADR Decision §5 / §Implementation 3: a NOTE_SENTENCES map beside PROBLEM_SENTENCES');
  const note = entry(s, 'older-link');
  assert(note && /older link/i.test(note) && /Update list/.test(note) && !note.includes('⚠️'),
    `AC-3: the note says the header uses the older link and that Update list will upgrade it — plain, not a warning; got ${JSON.stringify(note)}`);
  assert(/\.notes\b/.test(s) && /NOTE_SENTENCES\s*\[/.test(s), 'AC-3 / ADR §Implementation 3: the notes are rendered');
  const wrong = entry(s, 'wrong-type');
  assert(wrong && /pointer/.test(wrong) && !/inherit/i.test(wrong) && wrong.includes('⚠️'),
    `AC-3: the wrong-type warning stays a warning and names "pointer" as the expected type; got ${JSON.stringify(wrong)}`);
});

test('S4: the Curation method panel says it will decide which candidates to copy', () => {
  assert(/candidates to copy/.test(src(ITEMS)), 'AC-4 / ADR Decision §5: "…decides which candidates to copy…"');
});

/* ── D: the docs (AC-6) ────────────────────────────────────── */

test('D1: inherit-from.md — its implementation note says new curated headers link with pointer since story 2, and copies arrive with story 5', () => {
  const note = (src(INHERIT_FROM).match(/^> \*\*Implementation \(reference deployment\):\*\*[^\n]*/m) || [''])[0];
  assert(note, 'protocols/drafts/inherit-from.md keeps its implementation note');
  assert(!/until then the header endpoint/.test(note) && !/still writes it/.test(note), `AC-6: the "still writes inherit-items until story 2" wording is gone; got …${note.slice(-360)}`);
  assert(/since `curated-dlist-update` story 2/.test(note) && /story 5/.test(note), 'AC-6 / ADR §Implementation 7: "since `curated-dlist-update` story 2 … from story 5"');
});

test('D2: BIBLE.md — § Assistant Keys, the glossary b-tag row and §25 say what the code now does; the glossary names curated-dlist-update ADR 0001; Last updated records #2', () => {
  const s = src(BIBLE);
  for (const stale of ['still writes the earlier `inherit-items` link until', 'still writes it until `curated-dlist-update` story 2', 'until then its header endpoint still writes it']) {
    assert(!s.includes(stale), `AC-6: BIBLE no longer says "${stale}"`);
  }
  const row = (s.match(/^\| \*\*b tag\*\* \|[^\n]*/m) || [''])[0];
  assert(row.includes('`curated-dlist-update` ADR 0001') && !/\(ADR 0001\)/.test(row), 'AC-6 / review round 2 NB 2: the glossary cites `curated-dlist-update` ADR 0001 by name');
  assert(/story 5/.test(row), 'AC-6: the glossary still ties copies to story 5');
  const status = (s.match(/\*\*Status today for the facet:\*\*[^\n]*/) || [''])[0];
  assert(/since `curated-dlist-update` story 2/.test(status) && /story 5/.test(status), `AC-6: §25's status says "since story 2", copies from story 5; got ${JSON.stringify(status.slice(0, 300))}`);
  const updated = (s.match(/^\*\*Last updated:\*\*[^\n]*/m) || [''])[0];
  assert(/curated-dlist-update #2/.test(updated), 'AC-6: BIBLE\'s Last updated records the change (curated-dlist-update #2)');
});

test('D3: assistant-designation.md — Deployment status says the endpoint writes pointer since story 2 and nothing copies items yet', () => {
  const s = src(DESIGNATION);
  const i = s.indexOf('## Deployment status');
  assert(i >= 0, 'protocols/drafts/assistant-designation.md keeps its Deployment status section');
  const sec = s.slice(i);
  assert(!sec.includes('the header endpoint still writes the earlier `inherit-items` link'), 'AC-6: the "still writes the earlier inherit-items link" sentence is gone');
  assert(/since `curated-dlist-update` story 2/.test(sec) && /nothing copies items yet/.test(sec), 'AC-6 / ADR §Implementation 7: "since `curated-dlist-update` story 2 … nothing copies items yet"');
});

/* ── R: sentinels (pass before and after) ──────────────────── */

test('R1: communityPointerOf still reports the first coordinate b with its type — absent reads as pointer; inherit-items is reported as itself', async () => {
  const communityPointerOf = await fn('communityPointerOf');
  const ev = (tags) => ({ kind: 39998, pubkey: ME, tags });
  assert(deepEq(communityPointerOf(ev([['b', SHARED, 'inherit-items']])), { coord: SHARED, type: 'inherit-items' }), 'R: the older link is reported as itself (the label rule decides what is shown)');
  assert(deepEq(communityPointerOf(ev([['b', SHARED]])), { coord: SHARED, type: 'pointer' }), 'R: an absent type reads as pointer');
  assert(deepEq(communityPointerOf(ev([['b', SHARED, 'pointer']])), { coord: SHARED, type: 'pointer' }), 'R: pointer');
});

test('R2: the house b-value owners keep their exports (ADR Option B — moving the type names into them — is not this story)', async () => {
  const forms = require(B_VALUE_FORMS);
  for (const name of ['SENTINEL', 'A_TAG_RE', 'classifyBValue', 'dispositionOf', 'selectPointerTargets']) {
    assert(name in forms, `R: src/lib/bValueForms.js still exports ${name}`);
  }
  const disp = await loadEsm(BDISP);
  assert(disp && typeof disp.dispositionOf === 'function' && typeof disp.classifyBValue === 'function' && disp.SENTINEL === 'b-tag-deferred',
    'R: ui/src/utils/bDisposition.js keeps SENTINEL, classifyBValue, dispositionOf');
});

async function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log(`  ✅ ${t.name}`);
    } catch (e) {
      fail++;
      failures.push({ name: t.name, error: e.message });
      console.log(`  ❌ ${t.name}\n      ${e.message}`);
    }
  }
  console.log(`curated-dlist-update-pointer-switch: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
