/**
 * Create New Concept, wired from the finder and signed by the person's own Assistant (2026-10-02).
 *
 * The owner's decisions: the finder's "No matching concept of your own? Create New Concept" opens
 * /dictionary/new, started from the shared concept and wired to it (its b-tag points there), so it
 * joins the person's Dictionary in one step; every signed-in person (owner, admin or customer) sees it;
 * the header is signed by that person's own Assistant, for plain Create New Concept too; someone with
 * no Assistant here is told so, with no fallback to their own key.
 *
 *   E1..E19 — the endpoint, POST /api/dictionaries/concepts/new (src/api/adoption/newConcept.js),
 *             through createNewConceptHandler with every side effect injected.
 *   C1..C4  — the copy rule, src/lib/conceptHeaderCopy.js (the owner's rule of 2026-10-02: every tag of the
 *             shared header but json and the others it leaves out).
 *   P1..P4  — the page's pure helpers (ui/src/pages/dictionary/newConceptDraft.js, dynamic import),
 *             and the server's header equal to the page's preview.
 *   S1..S4  — structural pins, read off comment-stripped source.
 *
 * The browser half is tests/brainstorm/dictionary-concepts.spec.js D24–D27 and D29–D30.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const MODULE = path.join(ROOT, 'src/api/adoption/newConcept.js');
const ADOPTION_INDEX = path.join(ROOT, 'src/api/adoption/index.js');
const AUTH_JS = path.join(ROOT, 'src/middleware/auth.js');
const UI = path.join(ROOT, 'ui/src');
const DRAFT_JS = path.join(UI, 'pages/dictionary/newConceptDraft.js');
const PAGE_JSX = path.join(UI, 'pages/dictionary/NewConcept.jsx');
const DICT_JS = path.join(UI, 'pages/dictionaries/conceptsDictionary.js');
const CONCEPTS_JSX = path.join(UI, 'pages/dictionaries/Concepts.jsx');

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

function mod() {
  let m = null;
  try { m = require(MODULE); } catch (err) { throw new Error(`${path.relative(ROOT, MODULE)} must load: ${err.message}`); }
  assert(typeof m.createNewConceptHandler === 'function', 'createNewConceptHandler is exported');
  return m;
}

let _d;
async function draftMod() {
  if (_d === undefined) {
    try { _d = await import(pathToFileURL(DRAFT_JS).href); } catch (err) { _d = null; console.log(`      (could not load: ${err.message})`); }
  }
  assert(_d && typeof _d.conceptHeaderDraft === 'function', `${path.relative(ROOT, DRAFT_JS)} must load as a pure ESM module`);
  return _d;
}

const SESSION = 'a'.repeat(64);
const ASSISTANT = 'b'.repeat(64);
const OWNER_TA = 'c'.repeat(64);
const SHARED = `39998:${'d'.repeat(64)}:taco-truck`;
const NOW = 1790000000;

/** A fake signer: the event signed as `pubkey`, with a recognisable id. */
const fakeSign = (pubkey) => (template, privkey) => ({ ...template, pubkey, id: `${privkey.slice(0, 4)}${'0'.repeat(60)}`, sig: 'f'.repeat(128) });

/** Run the handler once: returns { status, body, calls }. `over` replaces any dep or request part. */
async function run(over = {}) {
  const calls = { keysFor: [], scans: [], signed: [], published: [], readBack: [] };
  const deps = {
    requireAuth: over.requireAuth || (() => SESSION),
    getAssistantKeys: async (pk) => { calls.keysFor.push(pk); return 'keys' in over ? over.keys : { pubkey: ASSISTANT, privkey: '9'.repeat(64) }; },
    scanAll: async (filter) => {
      calls.scans.push(filter);
      if (Array.isArray(filter.ids)) return (over.local || []).filter((ev) => filter.ids.includes(ev.id));
      return over.existing ? [].concat(over.existing) : [];
    },
    readCommunity: async (filter) => {
      calls.community = (calls.community || []).concat([filter]);
      if (over.communityDown) return { status: 'unreachable', events: [] };
      return { status: 'ok', events: (over.community || []).filter((ev) => filter.ids.includes(ev.id)) };
    },
    sign: (template, privkey) => { calls.signed.push({ template, privkey }); return (over.sign || fakeSign(ASSISTANT))(template, privkey); },
    publishLocal: async (ev) => { calls.published.push(ev); },
    isStored: over.isStored || (async (id) => { calls.readBack.push(id); return true; }),
    verify: over.verify || (() => true),
    now: () => NOW,
  };
  const req = {
    headers: over.headers || { host: 'here.example' },
    body: 'body' in over ? over.body : { singular: 'Taco Truck', plural: 'Taco Trucks', description: 'Trucks.' },
  };
  let status = 200;
  let body = null;
  const res = { status(n) { status = n; return this; }, json(b) { body = b; return this; } };
  await mod().createNewConceptHandler(deps)(req, res);
  return { status, body, calls };
}

// ═══ C — the copy rule ═══════════════════════════════════════════════════════

const COPY = path.join(ROOT, 'src/lib/conceptHeaderCopy.js');
const SHARER = 'e'.repeat(64);
const SHARED_GH = `39998:${SHARER}:github-accounts`;
/** The shared header the owner saw copied without its required and field-type tags (staging, 2026-10-02). */
const GH = {
  id: '7'.repeat(64), kind: 39998, pubkey: SHARER, created_at: 1700000000, content: '', sig: 'a'.repeat(128),
  tags: [
    ['d', 'github-accounts'], ['names', 'GitHub Account', 'GitHub Accounts'], ['description', 'A list of github handles/accounts'],
    ['required', 'github-username'], ['field-type', 'github-username', 'text'], ['b', SHARED_GH, 'pointer'],
  ],
};

test('C1: every tag of the shared header is copied; d, names, description and b are the copy\'s own', () => {
  const { copiedHeaderTags } = require(COPY);
  const tags = copiedHeaderTags({ source: GH, d: 'github-account', singular: 'GitHub Account', plural: 'GitHub Accounts', description: 'A list of github handles/accounts', target: SHARED_GH });
  assert(show(tags) === show([
    ['d', 'github-account'], ['names', 'GitHub Account', 'GitHub Accounts'], ['description', 'A list of github handles/accounts'],
    ['required', 'github-username'], ['field-type', 'github-username', 'text'], ['b', SHARED_GH, 'pointer'],
  ]), show(tags));
});

test('C2: json, concept-graph, z, client, alt, expiration, "-" and nonce are left out; slug is the copy\'s own d-tag', () => {
  const { copiedHeaderTags, COPY_SKIPPED } = require(COPY);
  assert(show(COPY_SKIPPED) === show(['json', 'concept-graph', 'z', 'client', 'alt', 'expiration', '-', 'nonce']), show(COPY_SKIPPED));
  const source = { ...GH, tags: [
    ['d', 'dog-breed'], ['names', 'dog breed', 'dog breeds'], ['slug', 'dog-breed'], ['concept-graph', `39999:${SHARER}:dog-breed-concept-graph`],
    ['json', '{"word":{}}'], ['description', 'Breeds.'], ['client', 'Brainstorm'], ['alt', 'A concept.'], ['expiration', '1800000000'],
    ['-'], ['nonce', '1', '20'], ['z', `39998:${SHARER}:animal`], ['optional', 'title'], ['allowed', 'e'], ['t', 'dogs'],
    ['name', 'Dog Breed'], ['founder', SHARER], ['b', `39998:${SHARER}:dog-breed`, 'pointer'],
  ] };
  const tags = copiedHeaderTags({ source, d: 'hound', singular: 'hound', plural: 'hounds', description: 'Breeds.', target: `39998:${SHARER}:dog-breed` });
  assert(show(tags) === show([
    ['d', 'hound'], ['names', 'hound', 'hounds'], ['slug', 'hound'], ['description', 'Breeds.'],
    ['optional', 'title'], ['allowed', 'e'], ['t', 'dogs'], ['name', 'Dog Breed'], ['founder', SHARER], ['b', `39998:${SHARER}:dog-breed`, 'pointer'],
  ]), show(tags));
});

test('C3: the copy has one b-tag, pointing at the shared concept, whatever b-tags the source has', () => {
  const { copiedHeaderTags } = require(COPY);
  const source = { ...GH, tags: [['d', 'x'], ['b', `39998:${'1'.repeat(64)}:else`, 'pointer'], ['names', 'x', 'xs'], ['b', 'b-tag-deferred']] };
  const tags = copiedHeaderTags({ source, d: 'x', singular: 'x', plural: 'xs', description: '', target: SHARED_GH });
  assert(show(tags) === show([['d', 'x'], ['b', SHARED_GH, 'pointer'], ['names', 'x', 'xs']]), show(tags));
  const none = copiedHeaderTags({ source: { tags: [['d', 'x'], ['required', 'a']] }, d: 'x', singular: 'x', plural: 'xs', description: 'D.', target: SHARED_GH });
  assert(show(none) === show([['d', 'x'], ['names', 'x', 'xs'], ['description', 'D.'], ['required', 'a'], ['b', SHARED_GH, 'pointer']]),
    `names, description and b the source lacks are placed: ${show(none)}`);
});

test('C4: a blank description leaves the source\'s out; extra values of names and description are kept', () => {
  const { copiedHeaderTags } = require(COPY);
  const source = { tags: [['d', 'x'], ['names', 'x', 'xs', 'extra'], ['description', 'Old.', 'en']] };
  const blank = copiedHeaderTags({ source, d: 'x', singular: 'y', plural: 'ys', description: '', target: SHARED_GH });
  assert(show(blank) === show([['d', 'x'], ['names', 'y', 'ys', 'extra'], ['b', SHARED_GH, 'pointer']]), show(blank));
  const kept = copiedHeaderTags({ source, d: 'x', singular: 'y', plural: 'ys', description: 'New.', target: SHARED_GH });
  assert(show(kept[2]) === show(['description', 'New.', 'en']), show(kept));
});

// ═══ E — the endpoint ════════════════════════════════════════════════════════

test('E1: a request from another site is refused before anything is read', async () => {
  const r = await run({ headers: { host: 'here.example', origin: 'https://elsewhere.example' } });
  assert(r.status === 403 && r.body.success === false, `got ${r.status} ${show(r.body)}`);
  assert(r.calls.keysFor.length === 0 && r.calls.signed.length === 0, 'no key read, nothing signed');
  const same = await run({ headers: { host: 'here.example', origin: 'https://here.example' } });
  assert(same.status === 200, `the same host goes on: ${same.status} ${show(same.body)}`);
});

test('E2: no verified session: requireAuth answers, and nothing is read or signed', async () => {
  let answered = false;
  const r = await run({ requireAuth: (req, res) => { answered = true; res.status(401).json({ success: false }); return null; } });
  assert(answered && r.status === 401, `got ${r.status}`);
  assert(r.calls.keysFor.length === 0 && r.calls.signed.length === 0, 'no key read, nothing signed');
});

test('E3: no Assistant on this instance: refused with code no-assistant, never another key', async () => {
  for (const keys of [null, { pubkey: ASSISTANT }, { privkey: '9'.repeat(64) }]) {
    const r = await run({ keys });
    assert(r.status === 403 && r.body.code === 'no-assistant', `${show(keys)} → ${r.status} ${show(r.body)}`);
    assert(r.calls.keysFor.length === 1 && r.calls.signed.length === 0, 'one lookup, nothing signed');
  }
});

test('E4: the keys are the caller\'s own: looked up for the session\'s pubkey, and those sign', async () => {
  const r = await run();
  assert(show(r.calls.keysFor) === show([SESSION]), `keys looked up for ${show(r.calls.keysFor)}`);
  assert(r.calls.signed.length === 1 && r.calls.signed[0].privkey === '9'.repeat(64), 'signed with the caller\'s Assistant key');
  assert(!/getOwnerAssistantKeys|getOwnerAssistantPubkey/.test(code(src(MODULE))), 'no owner-key helper anywhere in the module');
});

test('E5: the fields are checked before the relay is read: names, slug, control characters, lookup sizes, the target', async () => {
  const big = 'x'.repeat(1025);
  const addr = (n) => { const head = `39998:${'d'.repeat(64)}:`; return head + 'x'.repeat(n - head.length); };
  const bad = [
    [{ singular: 'Taco', plural: '' }, /Both the singular and the plural name/],
    [{ singular: '   ', plural: 'Tacos' }, /Both the singular and the plural name/],
    [{ singular: 'Taco', plural: 3 }, /must be text/],
    [{ singular: '!!!', plural: 'Tacos' }, /at least one Latin letter or digit/],
    [{ singular: 'Ta\u0000co', plural: 'Tacos' }, /control characters/],
    [{ singular: 'Taco', plural: 'Ta\ncos' }, /control characters/],
    [{ singular: 'Taco', plural: 'Tacos', description: 'bell\u0007' }, /description can't contain control characters/],
    [{ singular: 'a'.repeat(185), plural: 'Tacos' }, /its d-tag would be 185 characters, and this relay can look up at most 184/],
    [{ singular: 'Taco', plural: 'Tacos', target: addr(256) }, /longer than this relay can look up \(255 bytes\)/],
    [{ singular: 'Taco', plural: 'Tacos', target: '39999:' + 'd'.repeat(64) + ':x' }, /must be a list header's address/],
    [{ singular: 'Taco', plural: 'Tacos', target: '39998:abc:x' }, /must be a list header's address/],
    [{ singular: 'Taco', plural: 'Tacos', target: `${SHARED}​` }, /characters an address can't have/],
    [null, /Both the singular and the plural name/],
  ];
  for (const [body, re] of bad) {
    const r = await run({ body });
    assert(r.status === 400 && re.test(r.body.error || ''), `${show(body)} → ${r.status} ${show(r.body)}`);
    assert(r.calls.scans.length === 0 && r.calls.signed.length === 0, `${show(body)}: no relay read, nothing signed`);
  }
  const ok = await run({ body: { singular: ' Taco ', plural: 'Tacos', description: 'Line one.\nLine two.\tTabbed.' } });
  assert(ok.status === 200, `a description may keep line breaks and tabs: ${ok.status} ${show(ok.body)}`);
  const emoji = await run({ body: { singular: 'Family 👨‍👩‍👧', plural: 'Families' } });
  assert(emoji.status === 200, `a name may carry an emoji sequence (its joiners are format characters): ${show(emoji.body)}`);
  // At the bounds: a 184-character d-tag keeps the header's own address at 255 bytes; a 255-byte target is lookupable.
  const edge = await run({ body: { singular: 'a'.repeat(184), plural: 'As', target: addr(255) } });
  assert(edge.status === 200 && Buffer.byteLength(edge.body.coord) === 255, `at the bounds: ${edge.status} ${show(edge.body).slice(0, 120)}`);
  // Names and the description aren't looked up: only the relay's event size bounds them.
  const long = await run({ body: { singular: 'Taco', plural: big, description: big.repeat(4) } });
  assert(long.status === 200, `a long plural and description are kept: ${long.status} ${show(long.body).slice(0, 160)}`);
});

test('E6: never replace: a verified header of the Assistant\'s at that d-tag stops it, with its address', async () => {
  const stored = { id: '1'.repeat(64), kind: 39998, pubkey: ASSISTANT, tags: [['d', 'taco-truck']] };
  const r = await run({ existing: stored });
  assert(r.status === 409 && r.body.code === 'exists' && r.body.coord === `39998:${ASSISTANT}:taco-truck`, `got ${r.status} ${show(r.body)}`);
  assert(show(r.calls.scans) === show([{ kinds: [39998], authors: [ASSISTANT], '#d': ['taco-truck'] }]), `scanned ${show(r.calls.scans)}`);
  assert(r.calls.signed.length === 0 && r.calls.published.length === 0, 'nothing signed or published');
  // What the new header wouldn't replace doesn't stop it: an unverifiable import, or a match on a second d tag.
  const forged = await run({ existing: stored, verify: () => false });
  assert(forged.status === 200, `an unverified stored event isn't the Assistant's header: ${forged.status} ${show(forged.body)}`);
  const elsewhere = { ...stored, id: '2'.repeat(64), created_at: 9, tags: [['d', 'other'], ['d', 'taco-truck']] };
  const second = await run({ existing: elsewhere });
  assert(second.status === 200, `a header whose first d is another isn't at this address: ${second.status} ${show(second.body)}`);
  // ...but it can't hide the real one: every match is checked, not just the newest (review round 2, R2-1).
  const both = await run({ existing: [{ ...stored, created_at: 1 }, elsewhere] });
  assert(both.status === 409 && both.body.code === 'exists', `a newer event elsewhere doesn't let the genuine header be replaced: ${both.status} ${show(both.body)}`);
  assert(both.calls.signed.length === 0, 'nothing signed');
});

test('E7: created plainly, the header is shared: its b-tag points to itself', async () => {
  const r = await run();
  const t = r.calls.signed[0].template;
  assert(t.kind === 39998 && t.content === '' && t.created_at === NOW, show(t));
  assert(show(t.tags) === show([
    ['d', 'taco-truck'], ['names', 'Taco Truck', 'Taco Trucks'], ['description', 'Trucks.'], ['b', `39998:${ASSISTANT}:taco-truck`, 'pointer'],
  ]), show(t.tags));
});

test('E8: with a target, the header is wired: its b-tag points to the shared concept', async () => {
  const r = await run({ body: { singular: 'Taco Truck', plural: 'Taco Trucks', description: '', target: ` ${SHARED} ` } });
  const t = r.calls.signed[0].template;
  assert(show(t.tags) === show([['d', 'taco-truck'], ['names', 'Taco Truck', 'Taco Trucks'], ['b', SHARED, 'pointer']]), show(t.tags));
  assert(r.body.coord === `39998:${ASSISTANT}:taco-truck`, `the new header's own address: ${r.body.coord}`);
});

test('E13: a target that is the header\'s own address is refused (it would be the plain concept)', async () => {
  const r = await run({ body: { singular: 'Taco Truck', plural: 'Taco Trucks', target: `39998:${ASSISTANT}:taco-truck` } });
  assert(r.status === 400 && /own concept at this name/.test(r.body.error), `${r.status} ${show(r.body)}`);
  assert(r.calls.scans.length === 0 && r.calls.signed.length === 0, 'nothing read or signed');
});

test('E9: the relay\'s keeping is read back: a miss or a failed read claims nothing', async () => {
  const miss = await run({ isStored: async () => false });
  assert(miss.status === 502 && /didn't keep/.test(miss.body.error), `${miss.status} ${show(miss.body)}`);
  const broke = await run({ isStored: async () => { throw new Error('scan failed'); } });
  assert(broke.status === 502 && /couldn't confirm/.test(broke.body.error), `${broke.status} ${show(broke.body)}`);
  assert(miss.calls.published.length === 1, 'it was sent to the local relay before the read-back');
});

test('E10: an event that didn\'t sign as the Assistant\'s pubkey is never published', async () => {
  const r = await run({ sign: fakeSign(OWNER_TA) });
  assert(r.status === 500 && r.calls.published.length === 0, `${r.status} ${show(r.body)}`);
});

test('E11: success answers the signed event and the new header\'s address', async () => {
  const r = await run();
  assert(r.status === 200 && r.body.success === true, show(r.body));
  assert(r.body.event && r.body.event.pubkey === ASSISTANT && r.body.event.sig, 'the signed event');
  assert(r.body.coord === `39998:${ASSISTANT}:taco-truck`, r.body.coord);
  assert(show(r.calls.readBack) === show([r.body.event.id]), 'read back by its id');
});

test('E12: the route is registered with the adoption routes, and no auth list gates it to owners or customers', () => {
  const m = mod();
  assert(m.ROUTE === '/api/dictionaries/concepts/new', m.ROUTE);
  assert(/require\('\.\/newConcept'\)\.register\(app\);/.test(code(src(ADOPTION_INDEX))), 'registered in registerAdoptionRoutes');
  const auth = src(AUTH_JS);
  for (const list of ['ownerOnlyEndpoints', 'customerOrOwnerEndpoints']) {
    const block = auth.match(new RegExp(`const ${list} = \\[([\\s\\S]*?)\\]`));
    assert(block, `${list} must still be readable in auth.js`);
    const entries = [...block[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    const hit = entries.find((e) => m.ROUTE.includes(e));
    assert(!hit, `${list} entry ${hit} would gate the route (admins included: the owner's decision is every signed-in person)`);
  }
});

test('E17: with copyFrom, the header is a copy of that version of the shared header, read here or from the community relay', async () => {
  const { copiedHeaderTags } = require(COPY);
  const body = { singular: 'GitHub Account', plural: 'GitHub Accounts', description: 'A list of github handles/accounts', target: SHARED_GH, copyFrom: GH.id };
  const expected = copiedHeaderTags({ source: GH, d: 'github-account', singular: body.singular, plural: body.plural, description: body.description, target: SHARED_GH });
  const here = await run({ body, local: [GH] });
  assert(here.status === 200 && show(here.calls.signed[0].template.tags) === show(expected), `${here.status} ${show(here.body).slice(0, 120)}`);
  assert(!here.calls.community, 'found here, so the community relay isn\'t asked');
  const there = await run({ body, community: [GH] });
  assert(there.status === 200 && show(there.calls.signed[0].template.tags) === show(expected), `from the community relay: ${there.status} ${show(there.body).slice(0, 120)}`);
  assert(show(there.calls.community) === show([{ ids: [GH.id], kinds: [39998], authors: [SHARER] }]), show(there.calls.community));
  const plain = await run({ body: { ...body, copyFrom: undefined } });
  assert(show(plain.calls.signed[0].template.tags.map((t) => t[0])) === show(['d', 'names', 'description', 'b']), 'no copyFrom: the fields alone, as before');
});

test('E18: a version that can\'t be read, isn\'t at the target, or doesn\'t verify is refused, never guessed at', async () => {
  const body = { singular: 'GitHub Account', plural: 'GitHub Accounts', target: SHARED_GH, copyFrom: GH.id };
  const missing = await run({ body });
  assert(missing.status === 409 && missing.body.code === 'source-missing' && missing.calls.signed.length === 0, `${missing.status} ${show(missing.body)}`);
  const elsewhere = await run({ body, local: [{ ...GH, tags: [['d', 'other'], ...GH.tags.slice(1)] }] });
  assert(elsewhere.status === 400 && elsewhere.body.code === 'source-mismatch', `${elsewhere.status} ${show(elsewhere.body)}`);
  const forged = await run({ body, local: [GH], verify: (ev) => ev.id !== GH.id });
  assert(forged.status === 400 && forged.body.code === 'source-mismatch' && forged.calls.signed.length === 0, `${forged.status} ${show(forged.body)}`);
  for (const bad of [{ ...body, target: undefined }, { ...body, copyFrom: 'abc' }]) {
    const r = await run({ body: bad });
    assert(r.status === 400 && /copyFrom/.test(r.body.error) && r.calls.scans.length === 0, `${show(bad).slice(0, 80)} → ${show(r.body)}`);
  }
});

test('E19: a community relay that can\'t be reached is said so (502), never "not there"', async () => {
  const body = { singular: 'GitHub Account', plural: 'GitHub Accounts', target: SHARED_GH, copyFrom: GH.id };
  const r = await run({ body, communityDown: true });
  assert(r.status === 502 && r.body.code === 'source-unreachable' && r.calls.signed.length === 0, `${r.status} ${show(r.body)}`);
  const page = flat(code(src(PAGE_JSX)));
  assert(/if \(resp\.status === 409 && data\.code === 'source-missing'\) \{ shared\.reload\(\);/.test(page),
    'a replaced version: the page reads the shared header again, rather than resend the same copyFrom');
  assert(/\$\{source \? ' Its other tags are copied from the shared concept’s header/.test(page),
    'the lede says tags are copied only when there is a header to copy');
});

// ═══ P — the page's helpers ═══════════════════════════════════════════════════

test('P1: ?wire= is used only when it is a list header\'s address this relay can look up', async () => {
  const { wireTarget, wireProblem } = await draftMod();
  assert(wireTarget(SHARED) === SHARED && wireTarget(`  ${SHARED} `) === SHARED, 'an address, trimmed');
  for (const v of [null, '', 'taco', `39999:${'d'.repeat(64)}:x`, `39998:${'d'.repeat(63)}:x`, `39998:${'d'.repeat(64)}:`]) {
    assert(wireTarget(v) === null && wireProblem(v) === 'not-an-address', `${show(v)} is not one`);
  }
  const head = `39998:${'d'.repeat(64)}:`;
  const at = head + 'x'.repeat(255 - head.length);
  assert(wireTarget(at) === at && wireProblem(at) === null, 'a 255-byte address is lookupable');
  assert(wireTarget(`${at}x`) === null && wireProblem(`${at}x`) === 'too-long', 'a 256-byte one is not, and says so');
  const multi = head + 'é'.repeat(Math.ceil((256 - head.length) / 2));
  assert(wireProblem(multi) === 'too-long', 'the bound is in bytes, not characters');
});

test('P4: a singular name whose d-tag would make an unlookupable address isn\'t ready', async () => {
  const { conceptHeaderDraft, lookupable, MAX_D_BYTES } = await draftMod();
  const { MAX_D_BYTES: serverMax, MAX_FILTER_VALUE_BYTES } = mod();
  assert(MAX_D_BYTES === 184 && serverMax === 184 && MAX_FILTER_VALUE_BYTES === 255, 'the page and the server share the bound');
  const ok = conceptHeaderDraft({ singular: 'a'.repeat(184), plural: 'As', pubkey: ASSISTANT });
  assert(ok.ready && !ok.tooLong && lookupable(ok.coord), 'at 184 the address is 255 bytes and ready');
  const over = conceptHeaderDraft({ singular: 'a'.repeat(185), plural: 'As', pubkey: ASSISTANT });
  assert(!over.ready && over.tooLong && !lookupable(over.coord), 'at 185 it is not');
});

test('P2: the form starts from the shared header\'s names and description', async () => {
  const { fieldsFromHeader } = await draftMod();
  assert(show(fieldsFromHeader({ tags: [['d', 'x'], ['names', ' Taco Truck ', 'Taco Trucks'], ['description', 'Trucks.']] }))
    === show({ singular: 'Taco Truck', plural: 'Taco Trucks', description: 'Trucks.' }), 'names and description');
  assert(fieldsFromHeader({ tags: [['d', 'bird'], ['name', 'Bird']] }).singular === 'Bird', 'a name tag');
  assert(fieldsFromHeader({ tags: [['d', 'bird']] }).singular === 'bird', 'else the d-tag');
  assert(show(fieldsFromHeader(null)) === show({ singular: '', plural: '', description: '' }), 'nothing to start from');
});

test('P3: the server signs exactly the page\'s preview, plain and wired', async () => {
  const { conceptHeaderDraft } = await draftMod();
  const { composeConceptHeader, readFields } = mod();
  const cases = [
    { singular: 'Taco Truck in Nashville', plural: 'Taco Trucks in Nashville', description: ' Trucks. ' },
    { singular: 'Crème Brûlée', plural: 'Crèmes Brûlées', description: '' },
    { singular: 'Bird', plural: 'Birds', description: 'Line one.\nLine two.', target: SHARED },
  ];
  for (const c of cases) {
    const { fields } = readFields(c);
    const server = composeConceptHeader({ ...fields, signer: ASSISTANT, now: NOW });
    const page = conceptHeaderDraft({ ...c, pubkey: ASSISTANT }).event;
    assert(show(server.tags) === show(page.tags) && server.kind === page.kind && server.content === page.content,
      `${show(c)}: server ${show(server.tags)} vs page ${show(page.tags)}`);
  }
  const wired = conceptHeaderDraft({ singular: 'Bird', plural: 'Birds', pubkey: ASSISTANT, target: SHARED });
  assert(wired.coord === `39998:${ASSISTANT}:bird`, 'the draft\'s own address stays the signer\'s, not the target\'s');
});

// ═══ S — structural ═══════════════════════════════════════════════════════════

test('S1: the page reads ?wire= and starts from the shared header, read here and on the community relay', () => {
  const s = flat(code(src(PAGE_JSX)));
  assert(/from '@tapestry\/concept-header-copy';/.test(s) && /tags: copiedHeaderTags\(\{ source, d: plain\.d,/.test(s),
    'the wired preview is the copy rule the server signs with');
  assert(/\.\.\.\(source \? \{ copyFrom: source\.id \} : \{\}\)/.test(s), 'and the request names the version it showed');
  const vite = src(path.join(ROOT, 'ui/vite.config.js'));
  assert(/'@tapestry\/concept-header-copy': conceptHeaderCopyCore/.test(vite) && /\/src\\\/lib\\\/conceptHeaderCopy\//.test(vite), 'the alias, built as CommonJS');
  assert(!/require\(/.test(code(src(COPY))), 'zero requires, so the browser can take it');
  assert(/const target = wireTarget\(wireParam\);/.test(s) && /params\.get\(DICTIONARY_WIRE_PARAM\)/.test(s), 'the wire target comes from the URL');
  assert(/Promise\.allSettled\(\[scan\(filter\), fetchFromRelays\(filter, COMMUNITY_RELAYS\)\]\)/.test(s), 'both relays, the newest wins');
  assert(/if \(!shared\.event \|\| touched\) return;/.test(s), 'the shared header never overwrites what the person typed');
  assert(/conceptHeaderDraft\(\{ singular, plural, description, pubkey: signer, target \}\)/.test(s), 'the preview is wired');
  assert(/\.\.\.\(target \? \{ target \} : \{\}\)/.test(s), 'the request carries the target');
});

test('S2: the finder\'s path is /dictionary/new?wire=<address>', () => {
  const s = flat(code(src(DICT_JS)));
  assert(/export const DICTIONARY_WIRE_PARAM = 'wire';/.test(s), 'the param');
  assert(/export const dictionaryWirePath = \(coord\) => `\$\{DICTIONARY_NEW_PATH\}\?\$\{DICTIONARY_WIRE_PARAM\}=\$\{encodeURIComponent\(coord\)\}`;/.test(s), 'the path');
});

test('S3: no Assistant: the form is disabled, and the page names Account Setup; so does the finder', () => {
  const s = flat(code(src(PAGE_JSX)));
  assert(/const noAssistant = !person\.loading && person\.signedIn && !person\.assistant;/.test(s), 'signed in with no Assistant here');
  assert(/<fieldset disabled=\{!signer \|\| busy \|\| locked\}/.test(s), 'no signer, no form');
  const finder = flat(code(src(CONCEPTS_JSX)));
  assert(/hasAssistant=\{Boolean\(assistantPubkey\)\}/.test(finder) && /\{ASSISTANT_COPY\.noAssistantLine\} <Link to="\/setup">\{ASSISTANT_COPY\.noAssistantLink\}<\/Link>/.test(finder),
    'the finder doesn\'t promise "Your Assistant adds…" to a reader who has none');
});

test('S4: the finder offers Add only for an address this relay can look up, and the page refuses its own address', () => {
  const finder = flat(code(src(CONCEPTS_JSX)));
  assert(/\{canAdd && lookupable\(r\.uuid\) && \(\s*<button/.test(finder) && /\{canAdd && !lookupable\(r\.uuid\) && \(/.test(finder),
    'no Add for an unlookupable address, and a line saying why');
  const s = flat(code(src(PAGE_JSX)));
  assert(/const selfTarget = Boolean\(target && draft\.coord === target\);/.test(s) && /draft\.ready && !selfTarget && !busy && !locked/.test(s),
    'wired to its own address is not created');
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
  console.log(`\ndictionary-wired-create: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run: runAll };
