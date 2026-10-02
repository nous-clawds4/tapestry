/**
 * Edit a Dictionary concept (the owner's request of 2026-10-02).
 *
 * The owner's decisions: a signed-in person edits a concept whose header their own Assistant wrote, from
 * an Edit button on its entry page that is easy to find without drawing attention; the edit page has the
 * New DList page's fields (singular and plural names, description, Item Property Tags), and the person's
 * own Assistant signs the new version; firmware concepts can be edited, with a warning that a firmware
 * reinstall rebuilds their headers.
 *
 *   L1..L11  — the edit rule, src/lib/conceptHeaderEdit.js (shared by the server and the page).
 *   E1..E16  — POST /api/dictionaries/concepts/edit (src/api/adoption/editConcept.js), every side effect injected.
 *   S1..S7   — structural pins, read off comment-stripped source.
 *
 * The browser half is tests/brainstorm/dictionary-concepts.spec.js D32–D36.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIB = path.join(ROOT, 'src/lib/conceptHeaderEdit.js');
const MODULE = path.join(ROOT, 'src/api/adoption/editConcept.js');
const ADOPTION_INDEX = path.join(ROOT, 'src/api/adoption/index.js');
const AUTH_JS = path.join(ROOT, 'src/middleware/auth.js');
const OUTCOME = path.join(ROOT, 'src/lib/broadcastOutcome.js');
const VITE = path.join(ROOT, 'ui/vite.config.js');
const UI = path.join(ROOT, 'ui/src');
const APP_JSX = path.join(UI, 'App.jsx');
const PAGE_JSX = path.join(UI, 'pages/dictionary/EditConcept.jsx');
const ENTRY_PAGE_JSX = path.join(UI, 'pages/dictionary/Entry.jsx');
const ENTRY_BODY_JSX = path.join(UI, 'pages/dictionaries/ConceptEntry.jsx');
const DICT_JS = path.join(UI, 'pages/dictionaries/conceptsDictionary.js');

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
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const show = (v) => JSON.stringify(v);

function lib() {
  let m = null;
  try { m = require(LIB); } catch (err) { throw new Error(`${path.relative(ROOT, LIB)} must load: ${err.message}`); }
  return m;
}
function mod() {
  let m = null;
  try { m = require(MODULE); } catch (err) { throw new Error(`${path.relative(ROOT, MODULE)} must load: ${err.message}`); }
  assert(typeof m.createEditConceptHandler === 'function', 'createEditConceptHandler is exported');
  return m;
}

const SESSION = 'a'.repeat(64);
const ASSISTANT = 'b'.repeat(64);
const OTHER = 'c'.repeat(64);
const SHARED = `39998:${'d'.repeat(64)}:dog`;
const COORD = `39998:${ASSISTANT}:dog`;
const NOW = 1790000000;
const BASE = {
  id: '1'.repeat(64), kind: 39998, pubkey: ASSISTANT, created_at: 1700000000, content: '', sig: 'e'.repeat(128),
  tags: [
    ['d', 'dog'], ['names', 'dog', 'dogs'], ['description', 'A dog.'], ['required', 'name'], ['optional', 'url', 'string'],
    ['b', SHARED, 'pointer'], ['concept-graph', 'x'],
  ],
};
const EDIT = { singular: 'Dog', plural: 'Dogs', description: 'Good dogs.', properties: [['required', 'name'], ['recommended', 'image']] };

// ═══ L — the edit rule ═══════════════════════════════════════════════════════

test('L1: the form starts from the header: names, description, and the Item Property Tags whole', () => {
  const { headerFields } = lib();
  assert(show(headerFields(BASE)) === show({
    singular: 'dog', plural: 'dogs', description: 'A dog.', properties: [['required', 'name'], ['optional', 'url', 'string']],
  }), show(headerFields(BASE)));
  assert(show(headerFields(null)) === show({ singular: '', plural: '', description: '', properties: [] }), 'nothing to start from');
});

test('L2: the fields are checked: names, control characters, and each Item Property Tag', () => {
  const { checkEditFields, MAX_PROPERTIES } = lib();
  const bad = [
    [{ singular: 'Dog', plural: '' }, /Both the singular and the plural name/],
    [{ singular: 'Dog', plural: 3 }, /must be text/],
    [{ singular: 'D\u0000og', plural: 'Dogs' }, /control characters/],
    [{ singular: 'Dog', plural: 'Dogs', description: 'bell\u0007' }, /description can't contain control characters/],
    [{ singular: 'Dog', plural: 'Dogs', properties: 'name' }, /must be a list/],
    [{ singular: 'Dog', plural: 'Dogs', properties: [['mandatory', 'name']] }, /required, optional or recommended, not "mandatory"/],
    [{ singular: 'Dog', plural: 'Dogs', properties: [['required', '  ']] }, /needs a value/],
    [{ singular: 'Dog', plural: 'Dogs', properties: [['required']] }, /a requirement and a value/],
    [{ singular: 'Dog', plural: 'Dogs', properties: [['required', 5]] }, /a requirement and a value/],
    [{ singular: 'Dog', plural: 'Dogs', properties: [['required', 'na\nme']] }, /control characters/],
    [{ singular: 'Dog', plural: 'Dogs', properties: Array.from({ length: MAX_PROPERTIES + 1 }, (_, i) => ['optional', `p${i}`]) }, /At most 200/],
  ];
  for (const [input, re] of bad) {
    const r = checkEditFields(input);
    assert(r.error && re.test(r.error), `${show(input).slice(0, 80)} → ${show(r)}`);
  }
  const ok = checkEditFields({ singular: ' Dog ', plural: 'Dogs', description: 'Line.\nTab\t.', properties: [['optional', ' url ', 'string']] });
  assert(show(ok.fields) === show({ singular: 'Dog', plural: 'Dogs', description: 'Line.\nTab\t.', properties: [['optional', 'url', 'string']] }),
    `trimmed, and a property tag's further values kept: ${show(ok)}`);
});

test('L3: an edit replaces names, description and the Item Property Tags in place; d, b and every other tag are kept', () => {
  const { checkEditFields, composeEdit } = lib();
  const out = composeEdit(BASE, checkEditFields(EDIT).fields, NOW);
  assert(show(out.tags) === show([
    ['d', 'dog'], ['names', 'Dog', 'Dogs'], ['description', 'Good dogs.'], ['required', 'name'], ['recommended', 'image'],
    ['b', SHARED, 'pointer'], ['concept-graph', 'x'],
  ]), show(out.tags));
  assert(out.kind === 39998 && out.content === '' && out.created_at === NOW, show(out));
  const late = composeEdit(BASE, checkEditFields(EDIT).fields, BASE.created_at - 50);
  assert(late.created_at === BASE.created_at + 1, 'never at or before the version it replaces, whatever the clock says');
});

test('L4: a blank description removes it; names, description and properties absent from the base go where New DList puts them', () => {
  const { checkEditFields, composeEdit } = lib();
  const blank = composeEdit(BASE, checkEditFields({ ...EDIT, description: ' ' }).fields, NOW);
  assert(!blank.tags.some((t) => t[0] === 'description'), show(blank.tags));
  const bare = { ...BASE, tags: [['d', 'dog'], ['b', SHARED, 'pointer']] };
  const filled = composeEdit(bare, checkEditFields(EDIT).fields, NOW);
  assert(show(filled.tags) === show([
    ['d', 'dog'], ['names', 'Dog', 'Dogs'], ['description', 'Good dogs.'], ['required', 'name'], ['recommended', 'image'], ['b', SHARED, 'pointer'],
  ]), show(filled.tags));
});

test('L5: a names tag\'s further values, and the content, are kept', () => {
  const { checkEditFields, composeEdit } = lib();
  const base = { ...BASE, content: 'kept', tags: [['d', 'dog'], ['names', 'dog', 'dogs', 'doggo']] };
  const out = composeEdit(base, checkEditFields(EDIT).fields, NOW);
  assert(show(out.tags[1]) === show(['names', 'Dog', 'Dogs', 'doggo']) && out.content === 'kept', show(out));
});

test('L6: duplicate description and property tags collapse into the edit, at the first one\'s place', () => {
  const { checkEditFields, composeEdit } = lib();
  const base = { ...BASE, tags: [['d', 'dog'], ['required', 'a'], ['names', 'dog', 'dogs'], ['description', 'one'], ['optional', 'b'], ['description', 'two']] };
  const out = composeEdit(base, checkEditFields({ ...EDIT, properties: [['optional', 'c']] }).fields, NOW);
  assert(show(out.tags) === show([['d', 'dog'], ['optional', 'c'], ['names', 'Dog', 'Dogs'], ['description', 'Good dogs.']]), show(out.tags));
});

test('L7: the same values are no change', () => {
  const { headerFields, checkEditFields, composeEdit, changesTags } = lib();
  const same = composeEdit(BASE, checkEditFields(headerFields(BASE)).fields, NOW);
  assert(!changesTags(BASE, same), `unchanged: ${show(same.tags)}`);
  assert(changesTags(BASE, composeEdit(BASE, checkEditFields(EDIT).fields, NOW)), 'an edit is a change');
});

test('L8: the json copy of the names and description follows the edit; its identities are kept', () => {
  const { checkEditFields, composeEdit } = lib();
  const json = {
    word: { slug: 'concept-header-for-the-concept-of-dogs', name: 'concept header for the concept of dogs', wordTypes: ['word', 'conceptHeader'] },
    conceptHeader: {
      description: 'A dog.', oNames: { singular: 'dog', plural: 'dogs' }, oSlugs: { singular: 'dog', plural: 'dogs' },
      oKeys: { singular: 'dog', plural: 'dogs' }, oTitles: { singular: 'Dog', plural: 'Dogs' }, oLabels: { singular: 'Dog', plural: 'Dogs' },
    },
  };
  const base = { ...BASE, tags: [['d', 'dog'], ['names', 'dog', 'dogs'], ['json', JSON.stringify(json)], ['description', 'A dog.']] };
  const out = composeEdit(base, checkEditFields({ ...EDIT, singular: 'hound', plural: 'hounds' }).fields, NOW);
  const after = JSON.parse(out.tags.find((t) => t[0] === 'json')[1]);
  assert(show(after.conceptHeader.oNames) === show({ singular: 'hound', plural: 'hounds' }) && after.conceptHeader.description === 'Good dogs.',
    `names and description follow: ${show(after.conceptHeader)}`);
  for (const k of ['oSlugs', 'oKeys', 'oTitles', 'oLabels']) assert(show(after.conceptHeader[k]) === show(json.conceptHeader[k]), `${k} kept`);
  assert(show(after.word) === show(json.word), 'word kept');
  const blank = JSON.parse(composeEdit(base, checkEditFields({ ...EDIT, description: '' }).fields, NOW).tags.find((t) => t[0] === 'json')[1]);
  assert(!('description' in blank.conceptHeader), 'a removed description leaves the json too');
  // No change in them: the tag stays byte for byte, so an edit of only the properties is only that.
  const spaced = { ...base, tags: [['d', 'dog'], ['names', 'dog', 'dogs'], ['json', JSON.stringify(json, null, 2)], ['description', 'A dog.']] };
  const propsOnly = composeEdit(spaced, checkEditFields({ singular: 'dog', plural: 'dogs', description: 'A dog.', properties: [['optional', 'x']] }).fields, NOW);
  assert(propsOnly.tags.find((t) => t[0] === 'json')[1] === JSON.stringify(json, null, 2), 'an untouched json keeps its exact text');
});

test('L9: a json tag that isn\'t a concept header\'s is left alone; a description tag keeps its further values; text-direction controls are refused', () => {
  const { checkEditFields, composeEdit } = lib();
  for (const raw of ['{not json', JSON.stringify({ other: true }), JSON.stringify([1, 2])]) {
    const out = composeEdit({ ...BASE, tags: [['d', 'dog'], ['names', 'dog', 'dogs'], ['json', raw]] }, checkEditFields(EDIT).fields, NOW);
    assert(out.tags.find((t) => t[0] === 'json')[1] === raw, `left alone: ${raw}`);
  }
  const out = composeEdit({ ...BASE, tags: [['d', 'dog'], ['description', 'A dog.', 'en']] }, checkEditFields(EDIT).fields, NOW);
  assert(show(out.tags.find((t) => t[0] === 'description')) === show(['description', 'Good dogs.', 'en']), show(out.tags));
  assert(/text-direction/.test(checkEditFields({ ...EDIT, singular: 'dog\u202Egod' }).error || ''), 'a bidi override in a name');
});

test('L10: NAME_KEYED_CONCEPTS names every concept the code looks up by a literal name', () => {
  const { NAME_KEYED_CONCEPTS, nameKeyed } = lib();
  const found = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'dist') walk(p); continue; }
      if (!/\.(c?js|jsx|mjs)$/.test(e.name)) continue;
      const text = code(fs.readFileSync(p, 'utf8'));
      for (const m of text.matchAll(/_CONCEPT_NAME = '([^']+)'/g)) found.add(m[1]);
      for (const m of text.matchAll(/\bconcept: '([a-z][a-z ]*)'/g)) found.add(m[1]);
    }
  };
  walk(path.join(ROOT, 'src'));
  walk(UI);
  assert(found.size >= 10, `the scan must find the code's literal names (found ${found.size})`);
  const missing = [...found].filter((n) => !NAME_KEYED_CONCEPTS.includes(n));
  assert(missing.length === 0, `looked up by name in the code but renamable: ${missing.join(', ')}`);
  assert(nameKeyed('shared concept') && nameKeyed(' tapestry owner goal ') && !nameKeyed('dog') && !nameKeyed('Shared concept'),
    'exact names, as the Cypher lookups are');
});

test('L11: the json copy changes only with what the edit changes, measured against the header\'s tags, not the json', () => {
  const { headerFields, checkEditFields, composeEdit, changesTags } = lib();
  // Created without a description: the json holds a default one, and the header has no description tag.
  const json = JSON.stringify({ word: { slug: 'w' }, conceptHeader: { description: 'Dog Breed is a concept.', oNames: { singular: 'dog breed', plural: 'dog breeds' } } });
  const base = { ...BASE, tags: [['d', 'dog-breed'], ['names', 'dog breed', 'dog breeds'], ['json', json], ['b', SHARED, 'pointer']] };
  const same = composeEdit(base, checkEditFields(headerFields(base)).fields, NOW);
  assert(!changesTags(base, same), `opening and saving changes nothing: ${show(same.tags)}`);
  const renamed = composeEdit(base, checkEditFields({ ...headerFields(base), singular: 'breed', plural: 'breeds' }).fields, NOW);
  const r = JSON.parse(renamed.tags.find((t) => t[0] === 'json')[1]).conceptHeader;
  assert(show(r.oNames) === show({ singular: 'breed', plural: 'breeds' }) && r.description === 'Dog Breed is a concept.',
    `a rename leaves the json's default description: ${show(r)}`);
  const described = composeEdit(base, checkEditFields({ ...headerFields(base), description: 'Breeds of dog.' }).fields, NOW);
  const dsc = JSON.parse(described.tags.find((t) => t[0] === 'json')[1]).conceptHeader;
  assert(dsc.description === 'Breeds of dog.' && show(dsc.oNames) === show({ singular: 'dog breed', plural: 'dog breeds' }),
    `a description edit leaves the names: ${show(dsc)}`);
});

// ═══ E — the endpoint ════════════════════════════════════════════════════════

const fakeSign = (pubkey) => (template, privkey) => ({ ...template, pubkey, id: `${privkey.slice(0, 4)}${'0'.repeat(60)}`, sig: 'f'.repeat(128) });

async function run(over = {}) {
  const calls = { keysFor: [], scans: [], signed: [], published: [], readBack: [], graphAsked: [], imported: [] };
  const deps = {
    requireAuth: over.requireAuth || (() => SESSION),
    getAssistantKeys: async (pk) => { calls.keysFor.push(pk); return 'keys' in over ? over.keys : { pubkey: ASSISTANT, privkey: '9'.repeat(64) }; },
    scanAll: async (filter) => { calls.scans.push(filter); return 'stored' in over ? over.stored : [BASE]; },
    sign: (template, privkey) => { calls.signed.push({ template, privkey }); return (over.sign || fakeSign(ASSISTANT))(template, privkey); },
    publishLocal: async (ev) => { calls.published.push(ev); },
    isStored: over.isStored || (async (id) => { calls.readBack.push(id); return true; }),
    verify: over.verify || (() => true),
    graphHas: over.graphHas || (async (uuid) => { calls.graphAsked.push(uuid); return true; }),
    importToGraph: over.importToGraph || (async (ev, uuid) => { calls.imported.push({ id: ev.id, uuid }); }),
    now: () => NOW,
  };
  const req = {
    headers: over.headers || { host: 'here.example' },
    body: 'body' in over ? over.body : { coord: COORD, basedOn: BASE.id, ...EDIT },
  };
  let status = 200;
  let body = null;
  const res = { status(n) { status = n; return this; }, json(b) { body = b; return this; } };
  await mod().createEditConceptHandler(deps)(req, res);
  return { status, body, calls };
}

test('E1: a request from another site is refused before anything is read', async () => {
  const r = await run({ headers: { host: 'here.example', origin: 'https://elsewhere.example' } });
  assert(r.status === 403 && r.calls.keysFor.length === 0 && r.calls.signed.length === 0, `${r.status} ${show(r.body)}`);
});

test('E2: no verified session: requireAuth answers, and nothing is read', async () => {
  const r = await run({ requireAuth: (req, res) => { res.status(401).json({ success: false }); return null; } });
  assert(r.status === 401 && r.calls.keysFor.length === 0, `${r.status}`);
});

test('E3: no Assistant on this instance: refused, never another key', async () => {
  const r = await run({ keys: null });
  assert(r.status === 403 && r.body.code === 'no-assistant' && r.calls.signed.length === 0, `${r.status} ${show(r.body)}`);
  assert(show(r.calls.keysFor) === show([SESSION]), 'the session\'s own keys are the ones looked up');
});

test('E4: only a header the caller\'s own Assistant wrote', async () => {
  const theirs = await run({ body: { coord: `39998:${OTHER}:dog`, basedOn: BASE.id, ...EDIT } });
  assert(theirs.status === 403 && theirs.body.code === 'not-yours' && theirs.calls.scans.length === 0, `${theirs.status} ${show(theirs.body)}`);
  for (const coord of [undefined, 'dog', `39999:${ASSISTANT}:dog`, `39998:${ASSISTANT}:`]) {
    const r = await run({ body: { coord, basedOn: BASE.id, ...EDIT } });
    assert(r.status === 400 && r.calls.scans.length === 0, `${show(coord)} → ${r.status} ${show(r.body)}`);
  }
  const head = `39998:${ASSISTANT}:`;
  const long = await run({ body: { coord: head + 'x'.repeat(256 - head.length), basedOn: BASE.id, ...EDIT } });
  assert(long.status === 400 && /look up/.test(long.body.error) && long.calls.scans.length === 0, `an address the relay can't look up: ${show(long.body)}`);
});

test('E5: the version being edited and the fields are checked before the relay is read', async () => {
  for (const basedOn of [undefined, 'abc', 'G'.repeat(64)]) {
    const r = await run({ body: { coord: COORD, basedOn, ...EDIT } });
    assert(r.status === 400 && /basedOn/.test(r.body.error) && r.calls.scans.length === 0, `${show(basedOn)} → ${show(r.body)}`);
  }
  const r = await run({ body: { coord: COORD, basedOn: BASE.id, ...EDIT, plural: '' } });
  assert(r.status === 400 && /plural/.test(r.body.error) && r.calls.scans.length === 0, show(r.body));
});

test('E6: the latest version is the newest verified header of the Assistant\'s at exactly this address', async () => {
  const r = await run({ stored: [] });
  assert(r.status === 404 && r.calls.signed.length === 0, `${r.status} ${show(r.body)}`);
  assert(show(r.calls.scans) === show([{ kinds: [39998], authors: [ASSISTANT], '#d': ['dog'] }]), show(r.calls.scans));
  const forged = { ...BASE, id: '2'.repeat(64), created_at: BASE.created_at + 10 };
  const elsewhere = { ...BASE, id: '3'.repeat(64), created_at: BASE.created_at + 20, tags: [['d', 'other'], ['d', 'dog']] };
  const notTheirs = { ...BASE, id: '4'.repeat(64), created_at: BASE.created_at + 30, pubkey: OTHER };
  const r2 = await run({ stored: [BASE, forged, elsewhere, notTheirs], verify: (ev) => ev.id !== forged.id });
  assert(r2.status === 200 && r2.body.success, `newer events that aren't the header at this address don't count: ${r2.status} ${show(r2.body)}`);
});

test('E7: a header that changed after the page loaded it is never overwritten: 409, with the latest', async () => {
  const newer = { ...BASE, id: '5'.repeat(64), created_at: BASE.created_at + 5 };
  const r = await run({ stored: [BASE, newer] });
  assert(r.status === 409 && r.body.code === 'changed' && r.body.event.id === newer.id, `${r.status} ${show(r.body).slice(0, 120)}`);
  assert(r.calls.signed.length === 0 && r.calls.published.length === 0, 'nothing signed or published');
});

test('E8: no change is answered without signing', async () => {
  const { headerFields } = lib();
  const r = await run({ body: { coord: COORD, basedOn: BASE.id, ...headerFields(BASE) } });
  assert(r.status === 200 && r.body.unchanged === true && r.body.event.id === BASE.id, show(r.body));
  assert(r.calls.signed.length === 0 && r.calls.published.length === 0, 'nothing signed or published');
});

test('E9: the new version is the edit rule\'s, signed with the caller\'s Assistant key, read back, and the graph follows where it has the header', async () => {
  const { checkEditFields, composeEdit } = lib();
  const r = await run();
  assert(r.status === 200 && r.body.success && r.body.graph === 'updated' && r.body.coord === COORD, show(r.body).slice(0, 160));
  const t = r.calls.signed[0];
  assert(t.privkey === '9'.repeat(64), 'the caller\'s Assistant key');
  assert(show(t.template) === show(composeEdit(BASE, checkEditFields(EDIT).fields, NOW)), `the rule's version: ${show(t.template.tags)}`);
  assert(show(r.calls.readBack) === show([r.body.event.id]), 'read back by id');
  assert(show(r.calls.graphAsked) === show([COORD]) && show(r.calls.imported) === show([{ id: r.body.event.id, uuid: COORD }]),
    `the graph's node for the header is updated: ${show(r.calls)}`);
  const none = await run({ graphHas: async () => false });
  assert(none.body.graph === 'none' && none.calls.imported.length === 0, 'a header with no node gets none');
  const broke = await run({ graphHas: async () => { throw new Error('neo4j down'); } });
  assert(broke.status === 200 && broke.body.success && broke.body.graph === 'failed', `the relay has it, and the page is told the graph didn't follow: ${show(broke.body).slice(0, 120)}`);
});

test('E10: a version the relay didn\'t keep is never claimed, and the graph isn\'t touched', async () => {
  const miss = await run({ isStored: async () => false });
  assert(miss.status === 502 && miss.calls.graphAsked.length === 0 && miss.calls.imported.length === 0, `${miss.status} ${show(miss.body)}`);
  const broke = await run({ isStored: async () => { throw new Error('scan failed'); } });
  assert(broke.status === 502 && broke.calls.imported.length === 0, `${broke.status} ${show(broke.body)}`);
});

test('E11: an event that didn\'t sign as the Assistant\'s pubkey is never published', async () => {
  const r = await run({ sign: fakeSign(OTHER) });
  assert(r.status === 500 && r.calls.published.length === 0, `${r.status} ${show(r.body)}`);
});

test('E12: the route is registered with the adoption routes, and no auth list gates it to owners or customers', () => {
  const m = mod();
  assert(m.ROUTE === '/api/dictionaries/concepts/edit', m.ROUTE);
  assert(/require\('\.\/editConcept'\)\.register\(app\);/.test(code(src(ADOPTION_INDEX))), 'registered');
  const auth = src(AUTH_JS);
  for (const list of ['ownerOnlyEndpoints', 'customerOrOwnerEndpoints']) {
    const block = auth.match(new RegExp(`const ${list} = \\[([\\s\\S]*?)\\]`));
    assert(block, `${list} must still be readable in auth.js`);
    const hit = [...block[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).find((e) => m.ROUTE.includes(e));
    assert(!hit, `${list} entry ${hit} would gate the route`);
  }
  assert(!/getOwnerAssistantKeys|getOwnerAssistantPubkey/.test(code(src(MODULE))), 'no owner-key helper');
});

test('E13: a concept the server finds by name keeps its singular name; the rest of it can change', async () => {
  const keyed = { ...BASE, tags: [['d', 'shared-concept'], ['names', 'shared concept', 'shared concepts']] };
  const coord = `39998:${ASSISTANT}:shared-concept`;
  const renamed = await run({ stored: [keyed], body: { coord, basedOn: BASE.id, ...EDIT, singular: 'Shared concept', plural: 'shared concepts' } });
  assert(renamed.status === 400 && renamed.body.code === 'name-keyed' && renamed.calls.signed.length === 0, `even a case change: ${show(renamed.body)}`);
  const kept = await run({ stored: [keyed], body: { coord, basedOn: BASE.id, ...EDIT, singular: 'shared concept', plural: 'Shared Concepts' } });
  assert(kept.status === 200 && kept.body.success, `the plural, description and properties can change: ${kept.status} ${show(kept.body)}`);
});

test('E16: no concept can be renamed onto a name the server keeps for its own concepts', async () => {
  const r = await run({ body: { coord: COORD, basedOn: BASE.id, ...EDIT, singular: 'tapestry work record' } });
  assert(r.status === 400 && r.body.code === 'name-keyed' && r.calls.signed.length === 0, `${r.status} ${show(r.body)}`);
});

test('E14: a singular name another of the Assistant\'s concepts has is refused, whatever its case; the concept\'s own isn\'t', async () => {
  const cat = { ...BASE, id: '6'.repeat(64), tags: [['d', 'cat'], ['names', 'Cat', 'cats']] };
  const deps = { stored: [BASE, cat] };
  const r = await run({ ...deps, body: { coord: COORD, basedOn: BASE.id, ...EDIT, singular: 'cat' } });
  assert(r.status === 409 && r.body.code === 'name-taken' && r.body.coord === `39998:${ASSISTANT}:cat`, `${r.status} ${show(r.body)}`);
  assert(r.calls.signed.length === 0, 'nothing signed');
  assert(show(r.calls.scans[1]) === show({ kinds: [39998], authors: [ASSISTANT] }), `every header of the Assistant's is checked: ${show(r.calls.scans)}`);
  const own = await run({ ...deps, body: { coord: COORD, basedOn: BASE.id, ...EDIT, singular: 'DOG' } });
  assert(own.status === 200, `its own name in another case is fine: ${own.status} ${show(own.body)}`);
  const forged = await run({ ...deps, verify: (ev) => ev.id !== cat.id, body: { coord: COORD, basedOn: BASE.id, ...EDIT, singular: 'cat' } });
  assert(forged.status === 200, 'an unverified header doesn\'t hold a name');
});

test('E15: a header at the address that doesn\'t verify is named as such, never "no header"', async () => {
  const r = await run({ verify: () => false });
  assert(r.status === 409 && r.body.code === 'unverified' && r.calls.signed.length === 0, `${r.status} ${show(r.body)}`);
});

// ═══ S — structural ═══════════════════════════════════════════════════════════

test('S1: the page and the server compose with the same module (the preview is what is signed)', () => {
  const vite = src(VITE);
  assert(/'@tapestry\/concept-header-edit': conceptHeaderEditCore/.test(vite) && /new URL\('\.\.\/src\/lib\/conceptHeaderEdit\.js', import\.meta\.url\)/.test(vite),
    'the alias points at src/lib/conceptHeaderEdit.js');
  assert(/\/src\\\/lib\\\/conceptHeaderEdit\//.test(vite), 'and the build treats it as CommonJS');
  const page = flat(code(src(PAGE_JSX)));
  assert(/from '@tapestry\/concept-header-edit';/.test(page) && /composeEdit\(base, check\.fields,/.test(page), 'the page previews with composeEdit');
  assert(/require\('\.\.\/\.\.\/lib\/conceptHeaderEdit'\)/.test(src(MODULE)), 'the server composes with it');
  assert(!/require\(/.test(code(src(LIB))), 'zero requires, so the browser can take it');
});

test('S2: Edit on the entry page: only /dictionary, only a signed-in reader, only on their own Assistant\'s header', () => {
  assert(/editHref=\{dictionaryEditPath\}/.test(flat(code(src(ENTRY_PAGE_JSX)))), '/dictionary passes the edit path');
  const body = flat(code(src(ENTRY_BODY_JSX)));
  assert(/editHref = null,/.test(body), 'the control panel\'s entry page passes none, so it shows no Edit');
  assert(/const canEdit = Boolean\(editHref && person\.signedIn && author && author === person\.assistant\);/.test(body), 'the condition');
  assert(/className="dict-pill-btn dict-pill-btn--quiet dict-entry-edit"/.test(body) && /<DictIcon name="edit" \/> Edit/.test(body),
    'a quiet pill with a pencil, beside the title (easy to find, not loud)');
  assert(/export const dictionaryEditPath = \(coord\) => `\$\{dictionaryEntryPath\(coord\)\}\/edit`;/.test(flat(code(src(DICT_JS)))), 'the path');
  assert(/path: '\/dictionary\/:coord\/edit', element: <DictionaryEditConceptPage \/>/.test(flat(code(src(APP_JSX)))), 'the route');
});

test('S3: saving: the version loaded, the server\'s conflict answer, the Assistant\'s signature, and the broadcast\'s outcome', () => {
  const s = flat(code(src(PAGE_JSX)));
  assert(/body: JSON\.stringify\(\{ coord, basedOn: base\.id, \.\.\.check\.fields \}\)/.test(s), 'the request names the version being edited');
  assert(/if \(resp\.status === 409 && data\.code === 'changed' && data\.event\) \{ setChanged\(data\.event\); return; \}/.test(s), 'a conflict stops it');
  assert(/const startOver = \(\) => \{ setBase\(changed\); setForm\(headerFields\(changed\)\);/.test(s), 'and starting again is the person\'s choice');
  assert(/if \(!signed \|\| signed\.pubkey !== person\.assistant\) \{ throw new Error/.test(s), 'only the Assistant\'s signature is broadcast');
  assert(/outcomeMessage\(\{ outcome, verb: 'save' \}\)/.test(s) && /if \(outcome === 'not-delivered'\) \{ setUndelivered/.test(s), 'what the broadcast did');
  assert(/const canSave = mine && Boolean\(draft\) && dirty && !busy && !locked && !changed;/.test(s), 'save only a real change, by the right Assistant');
});

test('S4: a firmware concept warns that a reinstall undoes the edit, from the row\'s own header only', () => {
  const s = flat(code(src(PAGE_JSX)));
  assert(/\{\(firmware \|\| entry\?\.firmwareHeader\) && \(/.test(s) && /A firmware reinstall rebuilds its header from the built-in definition/.test(s), 'the warning');
  assert(/fetch\(`\/api\/dictionaries\/concepts\/firmware\?coord=\$\{encodeURIComponent\(coord\)\}`\)/.test(s),
    'from the address, so a header that isn\'t a Dictionary row is warned of too (review 1, S2)');
  const idx = flat(code(src(ADOPTION_INDEX)));
  assert(/app\.get\('\/api\/dictionaries\/concepts\/firmware', handleConceptFirmware\);/.test(idx)
    && /firmware: Boolean\(taPubkey\) && firmwareCoords\(taPubkey\)\.has\(coord\)/.test(idx), 'the read, from the firmware manifest');
  assert(/firmwareHeader: firmware\.has\(coord\),/.test(flat(code(src(ADOPTION_INDEX)))),
    'the Dictionary row says whether its own header is a firmware one (a row that only points at one isn\'t rebuilt)');
});

test('S5: the page reads the header as the server does: first d tag, newest', () => {
  const s = flat(code(src(PAGE_JSX)));
  assert(/\.filter\(\(ev\) => ev && ev\.pubkey === pubkey && ev\.kind === 39998 && firstD\(ev\) === d\)/.test(s), 'exactly this address');
});

test('S6: the broadcast outcome has words for a save', () => {
  const { outcomeMessage } = require(OUTCOME);
  const fresh = ['published', 'kept-local', 'not-delivered'].map((o) => outcomeMessage({ outcome: o, verb: 'save' }));
  assert(new Set(fresh).size === 3 && fresh.every((m) => /^Saved/.test(m)), show(fresh));
  assert(!fresh.some((m) => /shared concept|Wired/.test(m)), 'not the submit or wire words');
});

test('S7: the page keeps a name-keyed concept\'s singular name, names a taken name, and says each outcome once', () => {
  const s = flat(code(src(PAGE_JSX)));
  assert(/const lockedName = nameKeyed\(baseSingular\);/.test(s) && /readOnly=\{lockedName\}/.test(s), 'the singular name is read-only for a name-keyed concept');
  assert(/if \(resp\.status === 409 && data\.code === 'name-taken' && data\.coord\) \{ setTaken\(/.test(s), 'a taken name links to the other concept');
  assert(!/Saved on this instance\./.test(s), 'the not-delivered line doesn\'t repeat "Saved" (review 1, N1)');
});

// ═══ runner ══════════════════════════════════════════════════════════════════

async function runAll() {
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
  console.log(`\ndictionary-edit-concept: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run: runAll };
