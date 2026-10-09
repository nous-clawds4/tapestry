/**
 * Dictionary › Concepts: the rows are the person's own dictionary.
 *
 * The owner's correction of 2026-09-29 (recorded in docs/DICTIONARY_PAGE_HANDOFF.md): version 1
 * shipped the trusted dictionary as the page's rows. The design says otherwise: "Every row on this
 * page is a DList header authored by your local Assistant, carrying a b-tag that recognizes at least
 * one other DList header as a shared concept". So the rows are exactly what Active b-tags lists under
 * "Mine", and the trusted dictionary's arithmetic only scores them (GUM₁ of the shared concept each
 * row points to).
 *
 *   U1..U10 — pure: computeConceptDictionary in src/lib/trustedDictionary.js (rows arrive
 *            pre-classified at the handler seam), including parity with computeDictionary.
 *   P1..P3  — pure: the person helpers in ui/src/utils/authorScope.js that both pages resolve "Mine"
 *            through (dynamic import, the author-scoped-inspection-views idiom).
 *   S1..S6  — structural pins, read off comment-stripped source: the route and its seam, the pages'
 *            data source, the one shared definition of "Mine", the restored FAQ wording, the routes
 *            and the untouched Dictionaries index prose (moved here from trusted-dictionary S6).
 *   S7..S9  — /dictionary, the same list in the Brainstorm design's styling: its routes, that it
 *            renders the control panel pages' own bodies rather than a second copy, and its avatar
 *            menu item beside Dictionaries.
 *   H1..H3  — live, against the stack at :7778 (SKIP when it is down): the rows equal the Active
 *            b-tags rule for the owner's pair, computed independently from strfry; bad `authors`
 *            are refused; each row's gum agrees with the trusted dictionary from the same point of
 *            view. Read-only: nothing is published.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const LIB_JS = path.join(ROOT, 'src/lib/trustedDictionary.js');
const ADOPTION_API_JS = path.join(ROOT, 'src/api/adoption/index.js');
const UI = path.join(ROOT, 'ui/src');
const SCOPE_JS = path.join(UI, 'utils/authorScope.js');
const B_PAGE = path.join(UI, 'pages/shared-concepts/ActiveBTags.jsx');
const DICT_CONCEPTS_JSX = path.join(UI, 'pages/dictionaries/Concepts.jsx');
const DICT_ENTRY_JSX = path.join(UI, 'pages/dictionaries/ConceptEntry.jsx');
const DICT_HELPERS_JS = path.join(UI, 'pages/dictionaries/conceptsDictionary.js');
const DICT_PLACEHOLDERS_JSX = path.join(UI, 'pages/dictionaries/Placeholders.jsx');
const DICTIONARY_PAGE_JSX = path.join(UI, 'pages/dictionary/Index.jsx');
const DICTIONARY_ENTRY_JSX = path.join(UI, 'pages/dictionary/Entry.jsx');
const MENU_LINKS_JS = path.join(UI, 'config/avatarMenuLinks.js');
const APP_JSX = path.join(UI, 'App.jsx');

const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const SENTINEL = 'b-tag-deferred';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function rel(p) { return path.relative(ROOT, p); }
function src(p) {
  const s = safeRead(p);
  assert(s.length > 0, `${rel(p)} must exist`);
  return s;
}
const flat = (s) => s.replace(/\s+/g, ' ');

/** Source with comments blanked out (strings tracked), so prose cannot satisfy an assertion. */
function code(s) {
  let out = '';
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    const d = s[i + 1];
    if (c === '/' && d === '*') {
      const end = s.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      for (let k = i; k < stop; k++) out += s[k] === '\n' ? '\n' : ' ';
      i = stop;
    } else if (c === '/' && d === '/') {
      let k = i;
      while (k < n && s[k] !== '\n') { out += ' '; k++; }
      i = k;
    } else if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      out += c;
      i++;
      while (i < n) {
        if (s[i] === '\\') { out += s[i] + (s[i + 1] || ''); i += 2; continue; }
        out += s[i];
        if (s[i] === quote) { i++; break; }
        i++;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function lib() {
  const mod = require(LIB_JS);
  assert(typeof mod.computeConceptDictionary === 'function',
    'computeConceptDictionary must be exported from src/lib/trustedDictionary.js');
  return mod;
}

let _scope;
async function scope() {
  if (_scope === undefined) {
    try { _scope = await import(pathToFileURL(SCOPE_JS).href); } catch { _scope = null; }
  }
  assert(_scope, `${rel(SCOPE_JS)} must load as a pure ESM module`);
  return _scope;
}

// ── U fixtures ────────────────────────────────────────────────────────────────

const TA = 'a'.repeat(64); // the instance's TA (also the owner's assistant)
const ME = 'b'.repeat(64); // a customer's assistant: the person whose dictionary it is
const FH = 'f'.repeat(64); // a shared concept's author
const Q1 = '1'.repeat(64);
const Q2 = '2'.repeat(64);
const Q3 = '3'.repeat(64);
const UQ = '9'.repeat(64); // never in the qualifying set
const coordOf = (pk, d) => `39998:${pk}:${d}`;
let _id = 0;
function zc(pk, target) {
  _id += 1;
  return { pubkey: pk, id: String(_id).padStart(64, '0'), tags: [['z', target]] };
}
/** A pre-classified row, as the handler seam builds it. */
function row(d, { author = ME, targets = [], selfDeclared = false, ...over } = {}) {
  const coord = coordOf(author, d);
  const aTags = targets.filter((t) => /^\d+:[0-9a-f]{64}:.+$/.test(t));
  return {
    coord, name: d, author, targets, selfDeclared,
    scoreCoords: [...(selfDeclared ? [coord] : []), ...aTags],
    isFirmware: false,
    ...over,
  };
}

// ═══ U — the scoring core ════════════════════════════════════════════════════

test('U1: empty inputs → no entries, and the result names its metric', () => {
  const out = lib().computeConceptDictionary({});
  assert(Array.isArray(out.entries) && out.entries.length === 0, 'no rows → no entries');
  assert(out.metric === 'gum1', `metric must be "gum1" (SPEC § 4), got ${out.metric}`);
});

test('U2: a wired row is scored with GUM₁ of the shared concept it points to', () => {
  const shared = coordOf(FH, 'bird');
  const out = lib().computeConceptDictionary({
    rows: [row('bird', { targets: [shared] })],
    zCarriers: [zc(Q1, shared), zc(Q2, shared), zc(UQ, shared)],
    qualifying: new Set([Q1, Q2]),
    taPubkey: TA,
  });
  const e = out.entries[0];
  assert(e && e.gum === 2, `two qualifying authors file under the shared concept → gum 2, got ${e && e.gum}`);
  assert(e.sharedCoord === shared, 'sharedCoord names the concept the score is for');
  assert(e.totalAuthorCount === 3 && e.totalEventCount === 3, 'the totals count every author but the excluded ones');
  assert(e.itemCount === 0, "nothing is filed under the row's own header");
});

test("U3: the shared concept's own author and the TA never count toward its score", () => {
  const shared = coordOf(FH, 'bird');
  const out = lib().computeConceptDictionary({
    rows: [row('bird', { targets: [shared] })],
    zCarriers: [zc(FH, shared), zc(TA, shared), zc(Q1, shared)],
    qualifying: new Set([FH, TA, Q1]),
    taPubkey: TA,
  });
  assert(out.entries[0].gum === 1, `only Q1 counts; FH (own author) and TA are excluded, got ${out.entries[0].gum}`);
});

test("U4: parity — a row's gum is the number computeDictionary gives its shared concept", () => {
  const { computeDictionary, computeConceptDictionary } = lib();
  const shared = coordOf(FH, 'bird');
  const zCarriers = [zc(Q1, shared), zc(Q2, shared), zc(Q3, shared), zc(UQ, shared), zc(FH, shared), zc(TA, shared)];
  const qualifying = new Set([Q1, Q2, Q3, FH, TA]);
  const td = computeDictionary({
    headers: [{ coord: shared, name: 'bird', author: FH, isMine: false, bState: 'none' }],
    zCarriers, qualifying, threshold: 1, taPubkey: TA,
  });
  const cd = computeConceptDictionary({ rows: [row('bird', { targets: [shared] })], zCarriers, qualifying, taPubkey: TA });
  assert(td.entries[0].gum === cd.entries[0].gum && cd.entries[0].gum === 3,
    `both reads must count the same way (expected 3 and 3), got trusted ${td.entries[0].gum} vs concepts ${cd.entries[0].gum}`);
  assert(td.entries[0].totalAuthorCount === cd.entries[0].totalAuthorCount,
    'the evidence totals must agree too');
});

test('U5: a self-declared row is scored as itself, and its own filings never count', () => {
  const r = row('dog', { selfDeclared: true });
  const out = lib().computeConceptDictionary({
    rows: [r],
    zCarriers: [zc(ME, r.coord), zc(ME, r.coord), zc(Q1, r.coord)],
    qualifying: new Set([ME, Q1]),
    taPubkey: TA,
  });
  const e = out.entries[0];
  assert(e.sharedCoord === r.coord, 'a self-declared concept is its own shared concept');
  assert(e.gum === 1, `its author's filings are self-evidence; only Q1 counts, got ${e.gum}`);
  assert(e.itemCount === 3, `itemCount counts every item under the row's own header, the author's included, got ${e.itemCount}`);
  assert(e.selfDeclared === true, 'selfDeclared passes through (the "Shared by you" marker)');
});

test("U6: itemCount is the row's own header, independent of the shared concept's items", () => {
  const shared = coordOf(FH, 'tag');
  const r = row('tag', { author: TA, targets: [shared] });
  const out = lib().computeConceptDictionary({
    rows: [r],
    zCarriers: [zc(TA, r.coord), zc(Q1, r.coord), zc(Q1, shared), zc(Q2, shared), zc(Q3, shared)],
    qualifying: new Set([Q1, Q2, Q3]),
    taPubkey: TA,
  });
  const e = out.entries[0];
  assert(e.itemCount === 2, `two items are filed under the row's own header (TA's included), got ${e.itemCount}`);
  assert(e.gum === 3, `the score is the shared concept's (3 trusted authors), got ${e.gum}`);
});

test('U7: several targets → the best-scoring one; a tie keeps tag order', () => {
  const a = coordOf(FH, 'a');
  const b = coordOf(FH, 'b');
  const c = coordOf(FH, 'c');
  const out = lib().computeConceptDictionary({
    rows: [row('x', { targets: [a, b] }), row('y', { targets: [c, a] })],
    zCarriers: [zc(Q1, a), zc(Q1, b), zc(Q2, b), zc(Q1, c)],
    qualifying: new Set([Q1, Q2]),
    taPubkey: TA,
  });
  const x = out.entries.find((e) => e.name === 'x');
  const y = out.entries.find((e) => e.name === 'y');
  assert(x.sharedCoord === b && x.gum === 2, `x: b scores 2 and beats a's 1, got ${x.sharedCoord} / ${x.gum}`);
  assert(y.sharedCoord === c && y.gum === 1, `y: c and a tie at 1, so the first in tag order (c) wins, got ${y.sharedCoord}`);
});

test('U8: a row that points only at an event id has no score', () => {
  const out = lib().computeConceptDictionary({
    rows: [row('e', { targets: ['e'.repeat(64)] })],
    zCarriers: [],
    qualifying: new Set(),
    taPubkey: TA,
  });
  const e = out.entries[0];
  assert(e && e.gum === 0 && e.sharedCoord === null && e.totalAuthorCount === 0,
    'an event-id b locates an event, not a concept anything is filed under: gum 0, sharedCoord null');
  assert(e.targets.length === 1, 'the event id is still listed as a target');
});

test("U9: a target this relay has no header for still excludes its own author (read off the coordinate)", () => {
  const remote = coordOf(FH, 'remote');
  const out = lib().computeConceptDictionary({
    rows: [row('remote', { targets: [remote] })],
    zCarriers: [zc(FH, remote), zc(Q1, remote)],
    qualifying: new Set([FH, Q1]),
    taPubkey: TA,
  });
  assert(out.entries[0].gum === 1, `FH authored the coordinate, so only Q1 counts, got ${out.entries[0].gum}`);
});

test('U10: pass-through fields, override null, sorted by name then coordinate', () => {
  const out = lib().computeConceptDictionary({
    rows: [
      row('zebra', { plural: 'zebras', description: 'Striped.', isFirmware: true }),
      row('Apple'),
      { ...row('apple', { author: TA }), name: 'apple' },
    ],
    zCarriers: [],
    qualifying: new Set(),
    taPubkey: TA,
  });
  const names = out.entries.map((e) => e.name);
  assert(names[0].toLowerCase() === 'apple' && names[1].toLowerCase() === 'apple' && names[2] === 'zebra',
    `alphabetical, case-insensitive, got ${names.join(', ')}`);
  assert(out.entries[0].coord < out.entries[1].coord, 'equal names fall back to the coordinate');
  const z = out.entries[2];
  assert(z.plural === 'zebras' && z.description === 'Striped.' && z.isFirmware === true, 'plural, description and isFirmware pass through');
  assert(out.entries.every((e) => e.override === null), 'override stays null until Pins (SPEC § 3)');
  assert(out.entries.every((e) => Array.isArray(e.targets)), 'every entry lists its targets');
});

// ═══ P — one definition of "Mine" ════════════════════════════════════════════

const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const CUST = '3'.repeat(64);
const CUST_TA = '4'.repeat(64);
const ADMIN = '5'.repeat(64);
const ADMIN_TA = '6'.repeat(64);
const ROSTER = [
  { accountPubkey: OWNER, assistantPubkey: OWNER_TA, role: 'owner', displayName: 'Owner' },
  { accountPubkey: CUST, assistantPubkey: CUST_TA, role: 'customer', displayName: 'Customer' },
];

test('P1: defaultPersonFor — the signed-in reader, else the owner, else no one', async () => {
  const { defaultPersonFor } = await scope();
  assert(typeof defaultPersonFor === 'function', 'authorScope.js must export defaultPersonFor');
  assert(defaultPersonFor(ROSTER, { accountPubkey: CUST, assistantPubkey: CUST_TA }) === CUST, 'signed in → the reader');
  assert(defaultPersonFor(ROSTER, null) === OWNER, 'signed out → the owner (story 3 AC-2)');
  assert(defaultPersonFor([], null) === null, 'no roster and no reader → no one, never a guess');
});

test('P2: scopeRosterFor — an unlisted reader is added, a listed one is not duplicated', async () => {
  const { scopeRosterFor } = await scope();
  assert(typeof scopeRosterFor === 'function', 'authorScope.js must export scopeRosterFor');
  assert(scopeRosterFor(ROSTER, null) === ROSTER, 'signed out → the roster as it is');
  assert(scopeRosterFor(ROSTER, { accountPubkey: CUST, assistantPubkey: CUST_TA }).length === ROSTER.length,
    'a reader the roster lists is not added again');
  const widened = scopeRosterFor(ROSTER, { accountPubkey: ADMIN, assistantPubkey: ADMIN_TA });
  const added = widened.find((a) => a.accountPubkey === ADMIN);
  assert(added && added.assistantPubkey === ADMIN_TA, 'an admin the roster withholds is added with their assistant');
});

test('P3: composed, the helpers give the pubkeys Active b-tags shows under "Mine"', async () => {
  const { defaultPersonFor, scopeRosterFor, personPubkeys } = await scope();
  const mine = (viewer) => {
    const r = scopeRosterFor(ROSTER, viewer);
    return personPubkeys(r, defaultPersonFor(ROSTER, viewer)).join(',');
  };
  assert(mine({ accountPubkey: CUST, assistantPubkey: CUST_TA }) === `${CUST},${CUST_TA}`, 'a customer: account + assistant');
  assert(mine(null) === `${OWNER},${OWNER_TA}`, 'signed out: the owner + the owner\'s assistant');
  assert(mine({ accountPubkey: ADMIN, assistantPubkey: ADMIN_TA }) === `${ADMIN},${ADMIN_TA}`, 'an unlisted admin: account + assistant');
  assert(mine({ accountPubkey: ADMIN, assistantPubkey: null }) === ADMIN, 'no assistant: the account alone');
});

// ═══ S — structure ════════════════════════════════════════════════════════════

test('S1: the route, its validation, and the seam it shares with the trusted dictionary', () => {
  const s = flat(code(src(ADOPTION_API_JS)));
  assert(/app\.get\(\s*['"]\/api\/dictionaries\/concepts['"]\s*,\s*handleConceptDictionary\s*\)/.test(s),
    'GET /api/dictionaries/concepts must be registered in the adoption module');
  assert(/function parseAuthors/.test(s) && /list\.length\s*<\s*1\s*\|\|\s*list\.length\s*>\s*2/.test(s),
    '`authors` must be one or two hex pubkeys (a person: their account, and their assistant)');
  assert(/strfryScanStream\(\s*\{\s*kinds:\s*\[39998\],\s*authors\s*\}/.test(s),
    "the rows are read from the person's own headers (kinds 39998, authors)");
  assert(/dispositionOf\(bValues,\s*coord\)/.test(s) && /!disp\.wired\s*&&\s*!disp\.selfDeclared/.test(s),
    'a row needs a real b (bValueForms.dispositionOf at the seam): the sentinel and malformed values make none');
  assert(/firmware\.has\(coord\)\s*\|\|\s*targets\.some/.test(s),
    'Firmware: the row is a firmware concept or points at one');
  assert(/computeConceptDictionary\(/.test(s), 'the arithmetic is delegated to the pure core');
  const uses = (s.match(/await resolveQualifying\(/g) || []).length;
  assert(uses === 3, `the three dictionary reads (trusted dictionary, a person's dictionary, an entry's Items) resolve the qualifying set through one seam (resolveQualifying), found ${uses} calls`);
});

test('S2: the pages read the person\'s dictionary, not the trusted dictionary', () => {
  const page = code(src(DICT_CONCEPTS_JSX));
  const entry = code(src(DICT_ENTRY_JSX));
  const helpers = code(src(DICT_HELPERS_JS));
  assert(/['"`]\/api\/dictionaries\/concepts/.test(helpers), 'the shared helper must read /api/dictionaries/concepts');
  for (const [file, s] of [['Concepts.jsx', page], ['ConceptEntry.jsx', entry], ['conceptsDictionary.js', helpers]]) {
    assert(!/\/api\/trusted-dictionary/.test(s), `${file} must not read /api/trusted-dictionary: it is not this list`);
    assert(!/\/api\/shared-by-me/.test(s), `${file} must not read /api/shared-by-me: "Shared by you" is the row's own selfDeclared`);
    assert(!/qualifyingAuthorCount/.test(s), `${file} must not re-derive the metric (SPEC § 4): it renders gum`);
    assert(!/sentinelDeferred/.test(s), `${file}: a kept-private header carries no real b-tag, so it is never a row`);
  }
  assert(/defaultPersonFor\(/.test(helpers) && /scopeRosterFor\(/.test(helpers) && /personPubkeys\(/.test(helpers),
    'the person must be resolved through the authorScope helpers Active b-tags uses');
  assert(/usePov\s*\(/.test(page) && /useConceptDictionary\(\s*person\s*,\s*povParams/.test(page),
    'the page passes the person and the active point of view');
  assert(/\.gum\b/.test(page) && /metric/.test(page) && /selfDeclared/.test(page),
    'the page renders the server\'s gum, its metric, and the row\'s selfDeclared');
  assert(/useCommunitySharedConcepts/.test(page), '"Don\'t see what you\'re looking for?" still searches useCommunitySharedConcepts');
});

test('S3: Active b-tags opens on the same person through the same helpers (one "Mine")', () => {
  const s = flat(code(src(B_PAGE)));
  assert(/defaultPersonFor\(assistants,\s*viewer\)/.test(s) && /scopeRosterFor\(assistants,\s*viewer\)/.test(s),
    'ActiveBTags must resolve its default person and scope roster with defaultPersonFor / scopeRosterFor');
  assert(!/assistants\.find\(\(a\)\s*=>\s*a\.role\s*===\s*['"]owner['"]\)/.test(s),
    'the owner fallback lives in defaultPersonFor, not inline in the page');
});

test('S4: the FAQ carries the design\'s wording', () => {
  const page = src(DICT_CONCEPTS_JSX);
  assert(page.includes('Every row on this page is a DList header authored by your local Assistant, carrying a b-tag that recognizes at least one other DList header as a shared concept.'),
    "the design's definition of a row must be restored verbatim (owner, 2026-09-29)");
  assert(page.includes("GUM₃: for each pinning on “Add to My Dictionary”, add up the pinner\\'s rank score — an apply adds it, a dispute subtracts it. If the selected metric is above the cutoff (default 2 for GUM₁, 1.50 for GUM₂ and GUM₃), your Assistant clones the shared concept: it publishes its own header with a b-tag pointing at the shared one."),
    "the design's technical \"decide\" answer must survive verbatim, marked as coming later");
  assert(page.includes('An entry is shown under X when its concept header is an element of the superset for the concept of X — that is, when the header carries a class-thread n tag (HAS_ELEMENT) pointing at that superset, signed by a curator your Assistant trusts for that concept.'),
    "the Selection Bar answer keeps the design's text");
  assert(!/'Private'/.test(code(page)), 'Private is not a Show group in this version');
});

test('S5: routes, placeholders, and the Dictionaries index prose (from trusted-dictionary S6)', () => {
  const app = src(APP_JSX);
  const dictBlock = app.slice(app.indexOf("path: 'dictionaries'"), app.indexOf("path: 'trusted-agents'"));
  assert(/path:\s*['"`]concepts['"`][\s\S]*index:\s*true,\s*element:\s*<DictionaryConcepts\s*\/>/.test(dictBlock)
    && /path:\s*['"`]:coord['"`],\s*element:\s*<DictionaryConceptEntry\s*\/>/.test(dictBlock),
    'App.jsx must route dictionaries/concepts to the page and dictionaries/concepts/:coord to its entry page');
  const ph = src(DICT_PLACEHOLDERS_JSX);
  assert(!/export function DictionaryConcepts\b/.test(ph), 'the DictionaryConcepts placeholder stays replaced');
  assert(/export function DictionaryTags\b/.test(ph) && /export function DictionaryDLists\b/.test(ph),
    'the Tags and DLists placeholders stay (SPEC § 5)');
  assert(ph.includes('Being added by hand will override community-based criteria.')
    && ph.includes('There are currently three dictionaries: Tags, DLists, and Concepts.'),
    "the Dictionaries index keeps the owner's verbatim model statement (do not edit it)");
});

test('S6: Add to Dictionary is offered to any signed-in reader; only the owner gets the twin picker (the b-disposition writes are owner-only)', () => {
  const page = flat(code(src(DICT_CONCEPTS_JSX)));
  assert(/canAdd=\{signedIn && !managed\}/.test(page) && /isOwner=\{person\.isOwner\}/.test(page),
    'the finder gets canAdd = signed in, on the reader\'s own list (dictionary-managed-by S3), and whether they own the instance (dictionary-wired-create)');
  assert(/\{canAdd && lookupable\(r\.uuid\) && \(\s*<button/.test(page),
    'the Add to Dictionary button renders only when canAdd (and for an address the relay can look up: dictionary-wired-create S4)');
  assert(/if \(!isOwner\) return undefined;/.test(page) && /if \(!isOwner\) \{ return \(/.test(page),
    'a reader who isn\'t the owner reads no twins and gets no picker, only Create New Concept, wired to the result');
});

// ═══ S7..S9 — /dictionary: the same list in the design's styling ═══════════════

test('S7: /dictionary and /dictionary/:coord are top-level routes, outside the control panel', () => {
  const app = src(APP_JSX);
  const top = app.slice(app.indexOf('createBrowserRouter(['), app.indexOf("path: '/tapestry'"));
  assert(/path:\s*['"`]\/dictionary['"`],\s*element:\s*<DictionaryPage\s*\/>/.test(top),
    'App.jsx must route /dictionary to DictionaryPage, above the /tapestry layout');
  assert(/path:\s*['"`]\/dictionary\/:coord['"`],\s*element:\s*<DictionaryEntryPage\s*\/>/.test(top),
    'App.jsx must route /dictionary/:coord to DictionaryEntryPage, above the /tapestry layout');
  assert(/import DictionaryPage from ['"]\.\/pages\/dictionary\/Index['"]/.test(app)
    && /import DictionaryEntryPage from ['"]\.\/pages\/dictionary\/Entry['"]/.test(app),
    'the two routes render pages/dictionary/Index and pages/dictionary/Entry');
});

test('S8: /dictionary renders the control panel pages\' own bodies, so the two cannot drift', () => {
  const page = flat(code(src(DICTIONARY_PAGE_JSX)));
  const entry = flat(code(src(DICTIONARY_ENTRY_JSX)));
  const concepts = flat(code(src(DICT_CONCEPTS_JSX)));
  const conceptEntry = flat(code(src(DICT_ENTRY_JSX)));
  assert(/import \{ ConceptsDictionaryBody \} from ['"]\.\.\/dictionaries\/Concepts['"]/.test(page)
    && /<ConceptsDictionaryBody entryHref=\{dictionaryEntryPath\}( managed=\{managed\})?( newConceptHref=\{DICTIONARY_NEW_PATH\})? \/>/.test(page),
    '/dictionary renders ConceptsDictionaryBody from the control panel page, its rows opening /dictionary/:coord');
  assert(/import \{ ConceptEntryBody \} from ['"]\.\.\/dictionaries\/ConceptEntry['"]/.test(entry)
    && /<ConceptEntryBody (key=\{coord\} )?listHref=\{DICTIONARY_PATH\}/.test(entry),
    '/dictionary/:coord renders ConceptEntryBody, its back link going to /dictionary');
  assert(/export function ConceptsDictionaryBody\(/.test(concepts) && /<ConceptsDictionaryBody \/>/.test(concepts),
    'the control panel list renders the same exported body');
  assert(/export function ConceptEntryBody\(/.test(conceptEntry) && /<ConceptEntryBody \/>/.test(conceptEntry),
    'the control panel entry renders the same exported body');
  assert(/to=\{entryHref\(e\.coord\)\}/.test(concepts), 'a row links through entryHref, never a fixed path');
  for (const [file, s] of [['pages/dictionary/Index.jsx', page], ['pages/dictionary/Entry.jsx', entry]]) {
    assert(!/fetch\(/.test(s) && !/\/api\//.test(s), `${file} reads nothing itself: the shared body does`);
    assert(!/qualifyingAuthorCount|\.gum\b/.test(s), `${file} must not touch the metric: the shared body renders it`);
  }
  const helpers = code(src(DICT_HELPERS_JS));
  assert(/export const DICTIONARY_PATH = ['"]\/dictionary['"]/.test(helpers)
    && /export const dictionaryEntryPath = \(coord\) => `\$\{DICTIONARY_PATH\}\/\$\{encodeURIComponent\(coord\)\}`/.test(helpers),
    'conceptsDictionary.js names /dictionary and its entry path once');
});

test('S9: the avatar menus offer Dictionary (/dictionary), right after Dictionaries', async () => {
  const { personalLinks } = await import(pathToFileURL(MENU_LINKS_JS).href);
  assert(typeof personalLinks === 'function', 'avatarMenuLinks.js must export personalLinks');
  for (const profileBase of ['/user', '/tapestry/users']) {
    const links = personalLinks({ pubkey: CUST, assistantPubkey: CUST_TA, classification: 'customer', profileBase });
    const i = links.findIndex((l) => l && l.key === 'dictionaries');
    assert(i >= 0, 'Dictionaries is still offered');
    const next = links[i + 1];
    assert(next && next.key === 'dictionary' && next.label === 'Dictionary' && next.to === '/dictionary',
      `the link after Dictionaries must be Dictionary → /dictionary (profileBase ${profileBase})`);
    assert(links.filter((l) => l && l.to === '/dictionary').length === 1, 'offered once');
  }
});

// ═══ H — live (read-only; SKIP when the stack is down) ═══════════════════════

let _stack = null;
async function stack() {
  if (_stack) return _stack;
  try {
    const r = await fetch(`${HOST_BASE}/api/assistant/roster`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    const owner = j && j.success && (j.assistants || []).find((a) => a.role === 'owner');
    _stack = owner && owner.assistantPubkey ? { up: true, owner: owner.accountPubkey, ta: owner.assistantPubkey } : { up: false };
  } catch { _stack = { up: false }; }
  return _stack;
}
async function getJson(pathname) {
  const r = await fetch(`${HOST_BASE}${pathname}`, { signal: AbortSignal.timeout(60000) });
  let j = null; try { j = await r.json(); } catch { /* not JSON */ }
  return { status: r.status, json: j };
}
async function scanStream(filter) {
  const r = await fetch(`${HOST_BASE}/api/strfry/scan/stream?filter=${encodeURIComponent(JSON.stringify(filter))}`,
    { signal: AbortSignal.timeout(60000) });
  const out = [];
  for (const line of (await r.text()).split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip */ }
  }
  return out;
}

test('H1: the rows are exactly Active b-tags › Mine for the owner (signed out), rebuilt from strfry', async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const authors = [s.owner, s.ta];
  const { status, json } = await getJson(`/api/dictionaries/concepts?authors=${authors.join(',')}`);
  assert(status === 200 && json && json.success, `GET /api/dictionaries/concepts must answer 200, got ${status}`);
  assert(json.metric === 'gum1', 'the response names its metric');

  // Active b-tags' row rule (ActiveBTags.jsx): any b tag with a non-empty value other than the
  // sentinel, on a kind-39998 event signed by the person. The dictionary also needs the value to be
  // well-formed (bValueForms, W16); any difference must be exactly those malformed-only headers.
  const events = await scanStream({ kinds: [39998], authors });
  const A_TAG = /^\d+:[0-9a-f]{64}:.+$/;
  const EVENT_ID = /^[0-9a-f]{64}$/;
  const inspector = new Set();
  const malformedOnly = new Set();
  for (const ev of events) {
    const d = (ev.tags || []).find((t) => t[0] === 'd')?.[1];
    if (d == null) continue;
    const coord = `${ev.kind}:${ev.pubkey}:${d}`;
    const bs = (ev.tags || []).filter((t) => t[0] === 'b' && typeof t[1] === 'string' && t[1].trim() !== '' && t[1].trim() !== SENTINEL)
      .map((t) => t[1]);
    if (!bs.length) continue;
    inspector.add(coord);
    if (!bs.some((v) => A_TAG.test(v) || EVENT_ID.test(v))) malformedOnly.add(coord);
  }
  const rows = new Set(json.entries.map((e) => e.coord));
  const missing = [...inspector].filter((c) => !rows.has(c) && !malformedOnly.has(c));
  const extra = [...rows].filter((c) => !inspector.has(c));
  assert(missing.length === 0 && extra.length === 0,
    `rows must equal Active b-tags › Mine: missing ${missing.join(' ')} · extra ${extra.join(' ')}`);
  if (malformedOnly.size) console.log(`      note: ${malformedOnly.size} header(s) carry only malformed b values — listed by Active b-tags, no Dictionary row`);
});

test('H2: a request without a person is refused, never widened', async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const bad = [
    '',
    '?authors=',
    '?authors=nothex',
    `?authors=${'1'.repeat(64)},${'2'.repeat(64)},${'3'.repeat(64)}`,
    `?authors[]=${'1'.repeat(64)}`,
  ];
  for (const q of bad) {
    const { status, json } = await getJson(`/api/dictionaries/concepts${q}`);
    assert(status === 400 && json && json.success === false, `"${q || '(no query)'}" must be refused with 400, got ${status}`);
  }
});

test("H3: each row's gum agrees with the trusted dictionary from the same point of view", async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const [cd, td] = await Promise.all([
    getJson(`/api/dictionaries/concepts?authors=${s.owner},${s.ta}&wotPov=house`),
    getJson('/api/trusted-dictionary?wotPov=house'),
  ]);
  assert(cd.status === 200 && td.status === 200, `both reads must answer 200, got ${cd.status} / ${td.status}`);
  const members = new Map((td.json.entries || []).map((e) => [e.coord, e.gum]));
  const threshold = td.json.pov && Number.isFinite(td.json.pov.threshold) ? td.json.pov.threshold : 2;
  // The trusted dictionary's candidates are the headers this relay holds. A shared concept whose
  // header is absent can still have items filed under its coordinate, so it scores here without
  // being a candidate there (on staging, 2026-09-29: the upstream nostr-event-tag, 5 trusted
  // authors, header not synced). Only a present header must be a member once it reaches the
  // threshold.
  const shared = [...new Set(cd.json.entries.map((e) => e.sharedCoord).filter(Boolean))];
  const present = new Set();
  if (shared.length) {
    const events = await scanStream({ kinds: [39998], authors: [...new Set(shared.map((c) => c.split(':')[1]))] });
    for (const ev of events) {
      const d = (ev.tags || []).find((t) => t[0] === 'd')?.[1];
      if (d != null) present.add(`${ev.kind}:${ev.pubkey}:${d}`);
    }
  }
  for (const e of cd.json.entries) {
    if (!e.sharedCoord) { assert(e.gum === 0, `${e.coord}: no shared coordinate → gum 0`); continue; }
    if (members.has(e.sharedCoord)) {
      assert(e.gum === members.get(e.sharedCoord),
        `${e.coord}: gum ${e.gum} must equal the trusted dictionary's ${members.get(e.sharedCoord)} for ${e.sharedCoord}`);
    } else if (present.has(e.sharedCoord)) {
      assert(e.gum < threshold, `${e.coord}: ${e.sharedCoord} is held here but not a trusted-dictionary member, so its gum must be below ${threshold}, got ${e.gum}`);
    }
  }
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
  console.log(`\ndictionary-concepts: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
