/**
 * Create New Concept, wired from the finder and signed by the person's own Assistant (2026-10-02).
 *
 * The owner's decisions: the finder's "No matching concept of your own? Create New Concept" opens
 * /dictionary/new, started from the shared concept and wired to it (its b-tag points there), so it
 * joins the person's Dictionary in one step; every signed-in person (owner, admin or customer) sees it;
 * the header is signed by that person's own Assistant, for plain Create New Concept too; someone with
 * no Assistant here is told so, with no fallback to their own key.
 *
 *   E1..E12 — the endpoint, POST /api/dictionaries/concepts/new (src/api/adoption/newConcept.js),
 *             through createNewConceptHandler with every side effect injected.
 *   P1..P3  — the page's pure helpers (ui/src/pages/dictionary/newConceptDraft.js, dynamic import),
 *             and the server's header equal to the page's preview.
 *   S1..S3  — structural pins, read off comment-stripped source.
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
    scanLatest: async (filter) => { calls.scans.push(filter); return over.existing || null; },
    sign: (template, privkey) => { calls.signed.push({ template, privkey }); return (over.sign || fakeSign(ASSISTANT))(template, privkey); },
    publishLocal: async (ev) => { calls.published.push(ev); },
    isStored: over.isStored || (async (id) => { calls.readBack.push(id); return true; }),
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

test('E5: the fields are checked before the relay is read: names, slug, control characters, sizes, the target', async () => {
  const big = 'x'.repeat(1025);
  const bad = [
    [{ singular: 'Taco', plural: '' }, /Both the singular and the plural name/],
    [{ singular: '   ', plural: 'Tacos' }, /Both the singular and the plural name/],
    [{ singular: 'Taco', plural: 3 }, /must be text/],
    [{ singular: '!!!', plural: 'Tacos' }, /at least one Latin letter or digit/],
    [{ singular: 'Ta\u0000co', plural: 'Tacos' }, /control characters/],
    [{ singular: 'Taco', plural: 'Ta\ncos' }, /control characters/],
    [{ singular: 'Taco', plural: 'Tacos', description: 'bell\u0007' }, /description can't contain control characters/],
    [{ singular: big, plural: 'Tacos' }, /singular name is too long/],
    [{ singular: 'Taco', plural: 'Tacos', description: big }, /description is too long/],
    [{ singular: 'Taco', plural: 'Tacos', target: '39999:' + 'd'.repeat(64) + ':x' }, /must be a list header's address/],
    [{ singular: 'Taco', plural: 'Tacos', target: '39998:abc:x' }, /must be a list header's address/],
    [{ singular: 'Taco', plural: 'Tacos', target: `${SHARED}​` }, /characters an address can't have/],
    [{ singular: 'Taco', plural: 'Tacos', target: `39998:${'d'.repeat(64)}:${big}` }, /address is too long/],
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
});

test('E6: never replace: any header the Assistant has at that d-tag stops it, with that header\'s address', async () => {
  const r = await run({ existing: { id: '1'.repeat(64), kind: 39998, pubkey: ASSISTANT, tags: [['d', 'taco-truck']] } });
  assert(r.status === 409 && r.body.code === 'exists' && r.body.coord === `39998:${ASSISTANT}:taco-truck`, `got ${r.status} ${show(r.body)}`);
  assert(show(r.calls.scans) === show([{ kinds: [39998], authors: [ASSISTANT], '#d': ['taco-truck'] }]), `scanned ${show(r.calls.scans)}`);
  assert(r.calls.signed.length === 0 && r.calls.published.length === 0, 'nothing signed or published');
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

// ═══ P — the page's helpers ═══════════════════════════════════════════════════

test('P1: ?wire= is used only when it is a list header\'s address', async () => {
  const { wireTarget } = await draftMod();
  assert(wireTarget(SHARED) === SHARED && wireTarget(`  ${SHARED} `) === SHARED, 'an address, trimmed');
  for (const v of [null, '', 'taco', `39999:${'d'.repeat(64)}:x`, `39998:${'d'.repeat(63)}:x`, `39998:${'d'.repeat(64)}:`]) {
    assert(wireTarget(v) === null, `${show(v)} is not one`);
  }
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

test('S3: no Assistant: the form is disabled, and the page names Account Setup', () => {
  const s = flat(code(src(PAGE_JSX)));
  assert(/const noAssistant = !person\.loading && person\.signedIn && !person\.assistant;/.test(s), 'signed in with no Assistant here');
  assert(/<fieldset disabled=\{!signer \|\| busy \|\| locked\}/.test(s), 'no signer, no form');
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
