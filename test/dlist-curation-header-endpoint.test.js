/**
 * dlist-curation #4: the assistant curation-header endpoint.
 *
 * Story: engineering-team/stories/dlist-curation/4-assistant-curation-header-endpoint.md
 * ADR:   engineering-team/decisions/dlist-curation/0004-assistant-curation-header-endpoint.md
 *
 * Stack-free (no Neo4j / Redis / strfry / relays): the handler is built through the ADR's
 * dependency-injected factory with every side effect stubbed and recorded, and driven with a
 * fake req/res (the house precedent: test/global-publish-gate.test.js fakeRes,
 * test/default-deny-mutations.test.js mock req). Three classes:
 *   U (behavioral) — parseATag / classifyExisting / composeCurationHeader, and the handler's
 *                    branches AC-1..AC-9 through the factory. FAIL now: the module does not exist.
 *   S (structure)  — the module is wired (route registered; trustedList exports publishToStrfry;
 *                    per-relay settlement) and requires nothing that can write the graph. FAIL now.
 *   R (sentinel)   — trustedList's existing exports, the brain-write hook on /api/strfry/publish,
 *                    bValueForms and assistantKeys exports. PASS before and after.
 *
 * Not covered here: a live publish (would spray a real header under the dev assistant's key —
 * OPEN.md row 191's posture: a live suite must SKIP unless local-only), real relay sockets, and
 * the real `strfry import` — those are the injected seams' own lanes.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULE = path.join(ROOT, 'src/api/dlist-curation/index.js');
const API_INDEX = path.join(ROOT, 'src/api/index.js');
const TRUSTED_LIST = path.join(ROOT, 'src/api/trustedList/index.js');
const PUBLISH_EVENT = path.join(ROOT, 'src/api/strfry/commands/publishEvent.js');

const PK_USER = 'b'.repeat(64);
const PK_ASSISTANT = 'c'.repeat(64);
const PK_COMMUNITY = '0123456789abcdef'.repeat(4);
const PRIV = 'e'.repeat(64);
const D = 'dogs';
const T = `39998:${PK_COMMUNITY}:${D}`;
const RELAY = 'wss://dcosl.brainstorm.world';
const NOW = 1800000000;

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function loadModule() {
  let mod;
  try { mod = require(MODULE); } catch (e) { throw new Error(`src/api/dlist-curation/index.js must load: ${e.message}`); }
  return mod;
}

function communityHeader(over = {}) {
  return {
    id: '1'.repeat(64), kind: 39998, pubkey: PK_COMMUNITY, created_at: 1700000000, content: '', sig: '2'.repeat(128),
    tags: [
      ['d', D], ['names', 'dog', 'dogs'], ['slug', D],
      ['concept-graph', `39999:${PK_COMMUNITY}:${D}-concept-graph`],
      ['json', '{"word":{"slug":"dogs","name":"dog"},"conceptHeader":{"description":"Dogs."}}'],
      ['b', T, 'pointer'],
    ],
    ...over,
  };
}
const CONTRACT_B = ['b', T, 'inherit-items'];
const bTags = (ev) => (ev.tags || []).filter((t) => t[0] === 'b');
const tag = (ev, name) => (ev.tags || []).find((t) => t[0] === name);

function fakeRes() {
  const r = { _json: null, _status: 200 };
  r.json = (o) => { r._json = o; return r; };
  r.status = (c) => { r._status = c; return r; };
  return r;
}
function fakeReq(over = {}) {
  return { method: 'POST', path: '/api/dlist-curation/header', session: { authenticated: true, pubkey: PK_USER }, body: { target: T }, ...over };
}

/**
 * Stubs for every injected seam; `over` replaces any of them. Recording is applied UNIFORMLY on
 * top of whichever implementation is in effect (default or override), so a test that overrides a
 * seam can still assert how the handler called it. (Tester amendment during Phase 4: the first
 * cut recorded inside the defaults only, so H4's override made its own assertion unsatisfiable.)
 */
function makeDeps(over = {}) {
  const calls = { scanLocal: [], fetchFromRelays: [], publishLocal: [], publishToRelays: [], sign: [], getAssistantKeys: [] };
  const base = {
    requireAuth: (req, res) => {
      const pk = req.session && req.session.authenticated === true ? req.session.pubkey : null;
      if (!pk) { res.status(401).json({ success: false, error: 'authentication required' }); return null; }
      return pk;
    },
    getAssistantKeys: async (pk) => (pk === PK_USER ? { privkey: PRIV, pubkey: PK_ASSISTANT } : null),
    fetchFromRelays: async () => [communityHeader()],
    scanLocal: async () => [],
    publishLocal: async () => 'ok',
    publishToRelays: async (ev, urls) => urls.map((url) => ({ url, status: 'ok' })),
    isLocalOnly: () => false,
    getDListRelays: () => [RELAY],
    sign: (template) => ({ ...template, id: 'f'.repeat(64), pubkey: PK_ASSISTANT, sig: 'a'.repeat(128) }),
    now: () => NOW,
    ...over,
  };
  const record = {
    getAssistantKeys: (pk) => pk,
    fetchFromRelays: (filter, urls) => ({ filter, urls }),
    scanLocal: (filter) => filter,
    publishLocal: (ev) => ev,
    publishToRelays: (ev, urls) => ({ ev, urls }),
    sign: (template, privkeyHex) => ({ template, privkeyHex }),
  };
  const deps = { ...base };
  for (const name of Object.keys(record)) {
    const impl = base[name];
    deps[name] = (...args) => { calls[name].push(record[name](...args)); return impl(...args); };
  }
  return { deps, calls };
}
async function run(over = {}, reqOver = {}) {
  const { createAuthorCurationHeaderHandler } = loadModule();
  assert(typeof createAuthorCurationHeaderHandler === 'function', 'ADR §Implementation 1: createAuthorCurationHeaderHandler(deps) must be exported');
  const { deps, calls } = makeDeps(over);
  const res = fakeRes();
  await createAuthorCurationHeaderHandler(deps)(fakeReq(reqOver), res);
  return { res, calls };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── U: pure helpers ─────────────────────────────────────────── */

test('U1: the module exports the factory, register, and the three pure helpers', () => {
  const mod = loadModule();
  for (const name of ['createAuthorCurationHeaderHandler', 'register', 'parseATag', 'classifyExisting', 'composeCurationHeader']) {
    assert(typeof mod[name] === 'function', `ADR §Implementation 1: ${name} must be an exported function`);
  }
});

test('U2: parseATag — kind/pubkey/d, colons inside the d-tag preserved, garbage → null', () => {
  const { parseATag } = loadModule();
  assert(deepEq(parseATag(T), { kind: 39998, pubkey: PK_COMMUNITY, d: D }), 'AC-2: a valid a-tag parses');
  assert(deepEq(parseATag(`39998:${PK_COMMUNITY}:a:b:c`), { kind: 39998, pubkey: PK_COMMUNITY, d: 'a:b:c' }), 'AC-2: split at the first two colons only');
  for (const junk of ['nope', '39998:short:x', `39998:${PK_COMMUNITY}`, `abc:${PK_COMMUNITY}:x`, 42, null, undefined]) {
    assert(parseATag(junk) === null, `AC-2: ${JSON.stringify(junk)} → null`);
  }
});

test('U3: classifyExisting — none / exact / conflict (other target, other type, untyped) / unpointed', () => {
  const { classifyExisting } = loadModule();
  const ev = (tags) => ({ kind: 39998, pubkey: PK_ASSISTANT, tags });
  assert(classifyExisting(null, T) === 'none', 'AC-5: no existing header → none');
  assert(classifyExisting(ev([['d', D], CONTRACT_B]), T) === 'exact', 'AC-5(a): the contract b → exact');
  assert(classifyExisting(ev([['d', D], ['b', T, 'pointer']]), T) === 'conflict', 'AC-5(b): same target, different type → conflict');
  assert(classifyExisting(ev([['d', D], ['b', T]]), T) === 'conflict', 'AC-5(b): untyped (= pointer) → conflict');
  assert(classifyExisting(ev([['d', D], ['b', `39998:${'9'.repeat(64)}:${D}`, 'inherit-items']]), T) === 'conflict', 'AC-5(b): other target → conflict');
  assert(classifyExisting(ev([['d', D], CONTRACT_B, ['b', `39998:${'9'.repeat(64)}:x`, 'pointer']]), T) === 'conflict', 'AC-5(b): exact plus another b → conflict (never silently re-point)');
  assert(classifyExisting(ev([['d', D], ['names', 'dog', 'dogs']]), T) === 'unpointed', 'AC-5(c): no b → unpointed');
});

test('U4: composeCurationHeader — copies names/slug/json verbatim, one inherit-items b, nothing from the community namespace', () => {
  const { composeCurationHeader } = loadModule();
  const c = communityHeader();
  const t = composeCurationHeader(c, T, null, { now: () => NOW });
  assert(t.kind === 39998, 'AC-4: kind 39998');
  assert(deepEq(tag(t, 'd'), ['d', D]), 'AC-4: d = the community d-tag');
  assert(deepEq(tag(t, 'names'), tag(c, 'names')), 'AC-4: names verbatim');
  assert(deepEq(tag(t, 'slug'), tag(c, 'slug')), 'AC-4: slug verbatim');
  assert(deepEq(tag(t, 'json'), tag(c, 'json')), 'AC-4: json verbatim');
  assert(deepEq(bTags(t), [CONTRACT_B]), 'AC-4: exactly one b — ["b", <target>, "inherit-items"]');
  assert(!tag(t, 'concept-graph'), 'AC-4 / ADR sub-decision 2: the community concept-graph coordinate is not copied');
  assert(t.content === '', 'AC-4: empty content');
  assert(t.created_at === NOW, 'AC-4: fresh created_at');
  assert(!('id' in t) && !('sig' in t) && !('pubkey' in t), 'AC-4: an unsigned template (no id/sig/pubkey — the signer adds them)');
});

test('U5: composeCurationHeader — slug synthesized when the community header lacks one; unknown tags not copied', () => {
  const { composeCurationHeader } = loadModule();
  const c = communityHeader({ tags: [['d', D], ['names', 'dog', 'dogs'], ['json', '{}'], ['t', 'hashtag'], ['b', T, 'pointer']] });
  const t = composeCurationHeader(c, T, null, { now: () => NOW });
  assert(deepEq(tag(t, 'slug'), ['slug', D]), 'ADR sub-decision 2: slug synthesized from d');
  assert(!tag(t, 't'), 'AC-4: no other tag copied');
  assert(deepEq(bTags(t), [CONTRACT_B]), 'AC-4: still exactly one b');
});

test('U6: composeCurationHeader — case (c): existing tags preserved, b appended, content kept, created_at skew-proof', () => {
  const { composeCurationHeader } = loadModule();
  const existing = { kind: 39998, pubkey: PK_ASSISTANT, created_at: NOW + 500, content: 'kept', tags: [['d', D], ['names', 'hound', 'hounds'], ['json', '{"x":1}']] };
  const t = composeCurationHeader(communityHeader(), T, existing, { now: () => NOW });
  assert(deepEq(t.tags.slice(0, 3), existing.tags) && deepEq(t.tags[3], CONTRACT_B) && t.tags.length === 4, 'AC-5(c): every existing tag preserved in order, the contract b appended');
  assert(t.content === 'kept', 'AC-5(c): content preserved');
  assert(t.created_at >= existing.created_at + 1, 'ADR sub-decision 3: created_at strictly after the existing event, even under skew');
});

/* ── U: the handler through the factory ─────────────────────── */

test('H1: no verified session → 401 from the guard, nothing else consulted', async () => {
  const { res, calls } = await run({}, { session: { authenticated: false, pubkey: PK_USER } });
  assert(res._status === 401 && res._json && res._json.success === false, 'AC-1: 401');
  assert(calls.getAssistantKeys.length === 0 && calls.fetchFromRelays.length === 0, 'AC-1: nothing consulted after a refused session');
});

test('H2: no provisioned assistant → 400 naming the Assistant; the owner TA is not a fallback', async () => {
  const { res, calls } = await run({ getAssistantKeys: async () => null });
  assert(res._status === 400 && /assistant/i.test(res._json.error), `AC-1: 400 with a plain message, got ${res._status} ${JSON.stringify(res._json)}`);
  assert(calls.fetchFromRelays.length === 0 && calls.sign.length === 0, 'AC-1: no fetch, no signing without a key');
});

test('H3: malformed, kind-39999, own-header, and own-assistant targets → 400 before any fetch', async () => {
  const cases = [
    ['nope', /a-tag|malformed|invalid/i],
    [`39999:${PK_COMMUNITY}:x`, /39999/],
    [`39998:${PK_USER}:x`, /own/i],
    [`39998:${PK_ASSISTANT}:x`, /own/i],
  ];
  for (const [target, re] of cases) {
    const { res, calls } = await run({}, { body: { target } });
    assert(res._status === 400, `AC-2: ${target} → 400, got ${res._status}`);
    assert(re.test(res._json.error || ''), `AC-2: ${target} → message matches ${re}, got ${JSON.stringify(res._json)}`);
    assert(calls.fetchFromRelays.length === 0 && calls.scanLocal.length === 0, `AC-2: ${target} rejected before any fetch`);
  }
});

test('H4: target not on the community relays nor local → 404', async () => {
  const { res, calls } = await run({ fetchFromRelays: async () => [], scanLocal: async () => [] });
  assert(res._status === 404, `AC-3: 404, got ${res._status}`);
  assert(calls.fetchFromRelays.length === 1, 'AC-3: the relays were asked');
  assert(calls.scanLocal.some((f) => deepEq(f.authors, [PK_COMMUNITY]) && deepEq(f['#d'], [D])), 'ADR sub-decision 1: local strfry consulted as the fallback with the same filter');
  assert(calls.sign.length === 0 && calls.publishLocal.length === 0, 'AC-3: nothing signed or published');
});

test('H5: a fetched header that is not self-declared → 400', async () => {
  for (const tags of [
    [['d', D], ['names', 'dog', 'dogs'], ['b', `39998:${'9'.repeat(64)}:${D}`, 'pointer']],   // b to someone else
    [['d', D], ['names', 'dog', 'dogs']],                                                    // no b at all
  ]) {
    const { res, calls } = await run({ fetchFromRelays: async () => [communityHeader({ tags })] });
    assert(res._status === 400 && /self-declared/i.test(res._json.error || ''), `AC-3: not self-declared → 400, got ${res._status} ${JSON.stringify(res._json)}`);
    assert(calls.sign.length === 0, 'AC-3: nothing signed');
  }
});

test('H6: case (a) — the exact contract b already exists → existing:true, nothing signed or published', async () => {
  const existing = { id: '3'.repeat(64), kind: 39998, pubkey: PK_ASSISTANT, created_at: 1750000000, content: '', sig: '4'.repeat(128), tags: [['d', D], ['names', 'dog', 'dogs'], CONTRACT_B] };
  const { res, calls } = await run({ scanLocal: async (f) => (deepEq(f.authors, [PK_ASSISTANT]) ? [existing] : []) });
  assert(res._status === 200 && res._json.success === true && res._json.existing === true, `AC-5(a): 200 existing:true, got ${res._status} ${JSON.stringify(res._json)}`);
  assert(deepEq(res._json.header, existing), 'AC-5(a)/AC-8: the existing header is returned');
  assert(res._json.published === null, 'AC-5(a): no republish → published:null');
  assert(calls.sign.length === 0 && calls.publishLocal.length === 0 && calls.publishToRelays.length === 0, 'AC-5(a): idempotent — nothing signed or published');
});

test('H7: case (b) — an existing header with a different b → 409 with the existing pointer, nothing published', async () => {
  const existing = { id: '3'.repeat(64), kind: 39998, pubkey: PK_ASSISTANT, created_at: 1750000000, content: '', sig: '4'.repeat(128), tags: [['d', D], ['b', T, 'pointer']] };
  const { res, calls } = await run({ scanLocal: async (f) => (deepEq(f.authors, [PK_ASSISTANT]) ? [existing] : []) });
  assert(res._status === 409 && res._json.success === false, `AC-5(b): 409, got ${res._status}`);
  assert(deepEq(res._json.existing && res._json.existing.b, [['b', T, 'pointer']]), 'AC-5(b)/ADR sub-decision 4: the existing b tag(s) returned verbatim');
  assert(deepEq(res._json.existing.event, existing), 'AC-5(b): the existing event returned for the panel');
  assert(calls.sign.length === 0 && calls.publishLocal.length === 0 && calls.publishToRelays.length === 0, 'AC-5(b): never silently re-pointed — nothing published');
});

test('H8: case (d) — absent → composed, signed with the caller\'s assistant key, imported locally, sent to the DList relays, reported', async () => {
  const { res, calls } = await run();
  assert(res._status === 200 && res._json.success === true && res._json.existing === false, `AC-8: 200 success existing:false, got ${res._status} ${JSON.stringify(res._json)}`);
  assert(calls.sign.length === 1 && calls.sign[0].privkeyHex === PRIV, 'AC-1/AC-4: signed once, with the caller\'s assistant private key');
  const template = calls.sign[0].template;
  assert(template.kind === 39998 && deepEq(tag(template, 'd'), ['d', D]) && deepEq(bTags(template), [CONTRACT_B]) && !tag(template, 'concept-graph'), 'AC-4: the signed template is the composed header');
  assert(calls.publishLocal.length === 1 && calls.publishLocal[0].sig, 'AC-6: the SIGNED event is imported locally');
  assert(calls.publishToRelays.length === 1 && deepEq(calls.publishToRelays[0].urls, [RELAY]), 'AC-6: sent to settings.aRelays.aDListRelays');
  assert(deepEq(res._json.header, calls.publishLocal[0]), 'AC-8: the response carries the signed header');
  assert(res._json.published && res._json.published.local === 'ok' && deepEq(res._json.published.relays, [{ url: RELAY, status: 'ok' }]), 'AC-6/AC-8: per-destination outcomes');
});

test('H9: local-only publish policy → relays skipped (and reported so), publishToRelays never called', async () => {
  const { res, calls } = await run({ isLocalOnly: () => true });
  assert(res._status === 200 && res._json.success === true, 'AC-6: local success under local-only');
  assert(calls.publishLocal.length === 1 && calls.publishToRelays.length === 0, 'AC-6: local import happens; no external send under the gate');
  const rows = res._json.published.relays;
  assert(rows.length === 1 && rows[0].url === RELAY && rows[0].status === 'skipped' && /local-only/i.test(rows[0].reason || ''), `AC-6: the relay row reads skipped with the reason, got ${JSON.stringify(rows)}`);
});

test('H10: local import fails → 500 with stage "local", nothing sent to relays', async () => {
  const { res, calls } = await run({ publishLocal: async () => { throw new Error('strfry import exited 1: boom'); } });
  assert(res._status === 500 && res._json.success === false && res._json.stage === 'local' && /boom/.test(res._json.error || ''), `AC-9: 500 stage:local with the message, got ${res._status} ${JSON.stringify(res._json)}`);
  assert(calls.publishToRelays.length === 0, 'AC-9: nothing else attempted after a local failure');
});

test('H11: a relay rejects → success:true with a failed row carrying the message (never a blanket success)', async () => {
  const { res } = await run({ publishToRelays: async (ev, urls) => urls.map((url) => ({ url, status: 'failed', error: 'relay said no' })) });
  assert(res._status === 200 && res._json.success === true, 'AC-9: local is the source of truth → success');
  const rows = res._json.published.relays;
  assert(rows.length === 1 && rows[0].status === 'failed' && /relay said no/.test(rows[0].error), `AC-6: the failure is reported honestly, got ${JSON.stringify(rows)}`);
});

test('H12: fetch order — community relays first (newest copy wins), local strfry only as the fallback', async () => {
  const older = communityHeader({ created_at: 1700000000, tags: communityHeader().tags.map((t) => (t[0] === 'names' ? ['names', 'hound', 'hounds'] : t)) });
  const newer = communityHeader({ id: '5'.repeat(64), created_at: 1700009999 });
  const a = await run({ fetchFromRelays: async () => [older, newer] });
  assert(a.res._status === 200, `H12: relay hit → 200, got ${a.res._status} ${JSON.stringify(a.res._json)}`);
  assert(deepEq(tag(a.calls.sign[0].template, 'names'), ['names', 'dog', 'dogs']), 'ADR sub-decision 1: the newest copy across relays is the one copied');
  assert(!a.calls.scanLocal.some((f) => deepEq(f.authors, [PK_COMMUNITY])), 'ADR sub-decision 1: local strfry not consulted for the community header when the relays had it');
  assert(a.calls.scanLocal.some((f) => deepEq(f.authors, [PK_ASSISTANT]) && deepEq(f['#d'], [D])), 'AC-5: the existing-header scan always runs against the assistant');
  const b = await run({ fetchFromRelays: async () => [], scanLocal: async (f) => (deepEq(f.authors, [PK_COMMUNITY]) ? [communityHeader()] : []) });
  assert(b.res._status === 200 && b.calls.sign.length === 1, `ADR sub-decision 1: a local mirrored copy is as good — 200, got ${b.res._status} ${JSON.stringify(b.res._json)}`);
});

test('H13: case (c) — an existing header with no b is re-signed with the contract b appended and republished', async () => {
  const existing = { id: '3'.repeat(64), kind: 39998, pubkey: PK_ASSISTANT, created_at: NOW + 500, content: 'kept', sig: '4'.repeat(128), tags: [['d', D], ['names', 'hound', 'hounds'], ['json', '{"x":1}']] };
  const { res, calls } = await run({ scanLocal: async (f) => (deepEq(f.authors, [PK_ASSISTANT]) ? [existing] : []) });
  assert(res._status === 200 && res._json.success === true, `AC-5(c): 200, got ${res._status} ${JSON.stringify(res._json)}`);
  const t = calls.sign[0].template;
  assert(deepEq(t.tags, [...existing.tags, CONTRACT_B]) && t.content === 'kept' && t.created_at >= existing.created_at + 1, 'AC-5(c): existing tags + the contract b, content kept, created_at bumped');
  assert(calls.publishLocal.length === 1 && calls.publishToRelays.length === 1, 'AC-5(c): republished locally and to the relays');
});

test('H14: only ws:// and wss:// relays from the DList group are used', async () => {
  const { calls } = await run({ getDListRelays: () => ['wss://a.example', 'http://bad.example', 'ws://b.example', 42, ''] });
  assert(deepEq(calls.publishToRelays[0].urls, ['wss://a.example', 'ws://b.example']), `ADR §7: relay list filtered to ws/wss, got ${JSON.stringify(calls.publishToRelays[0] && calls.publishToRelays[0].urls)}`);
});

/* ── S: wiring and the no-graph-write sentinel ───────────────── */

test('S1: the module exists and requires nothing that can write the graph', () => {
  const src = safeRead(MODULE);
  assert(src.length > 0, 'ADR §Implementation 1: src/api/dlist-curation/index.js must exist');
  for (const forbidden of ['neo4j', 'eventSync', 'executeCypher', 'buildImportCypher', 'firmware']) {
    assert(!new RegExp(`require\\([^)]*${forbidden}`).test(src), `AC-7: the module must not require anything matching "${forbidden}"`);
  }
  assert(!/maybeBrainWriteTapestry|tapestryBrainWrite|\/api\/strfry\/publish/.test(src), 'AC-7 / ADR Option B rejected: no brain-writing publish path');
});

test('S2: the route is registered in src/api/index.js next to the other modules', () => {
  const src = safeRead(API_INDEX);
  const at = src.indexOf("require('./dlist-curation')");
  assert(at > 0, 'ADR §Implementation 3: src/api/index.js requires ./dlist-curation');
  assert(/\.register\(app\)/.test(src.slice(at, at + 200)), 'ADR §Implementation 3: … and calls its register(app)');
  assert(/\/api\/dlist-curation\/header/.test(safeRead(MODULE)), 'ADR Decision: POST /api/dlist-curation/header');
});

test('S3: trustedList now exports publishToStrfry (the one-line change to a shipped module)', () => {
  const tl = require(TRUSTED_LIST);
  assert(typeof tl.publishToStrfry === 'function', 'ADR §Implementation 2: publishToStrfry exported from src/api/trustedList/index.js');
});

test('S4: relay sends settle per relay, and the module carries no pubkey literal', () => {
  const src = safeRead(MODULE);
  assert(/allSettled/.test(src), 'ADR Option A / OPEN.md row 200: per-relay Promise.allSettled, never an unconditional success');
  assert(!/[0-9a-fA-F]{64}/.test(src), 'CLAUDE.md § per-deployment TA pubkey: no 64-hex literal');
});

/* ── R: sentinels (pass before and after) ────────────────────── */

test('R1: trustedList\'s existing exports are intact', () => {
  const tl = require(TRUSTED_LIST);
  for (const name of ['register', 'buildAndPublishTL', 'requireAuth', 'isLoopbackRequest']) {
    assert(typeof tl[name] === 'function', `R: trustedList still exports ${name}`);
  }
});

test('R2: /api/strfry/publish still carries (and awaits) the brain-write hook — untouched', () => {
  const src = safeRead(PUBLISH_EVENT);
  assert(/maybeBrainWriteTapestry/.test(src) && /await\s+maybeBrainWriteTapestry/.test(src), 'R: the hook is neither removed nor un-awaited');
});

test('R3: the b-value forms module still exports A_TAG_RE and dispositionOf', () => {
  const bv = require(path.join(ROOT, 'src/lib/bValueForms.js'));
  assert(bv.A_TAG_RE instanceof RegExp && typeof bv.dispositionOf === 'function', 'R: A_TAG_RE + dispositionOf available to the endpoint');
  assert(bv.dispositionOf([T], T).selfDeclared === true && bv.dispositionOf([`39998:${'9'.repeat(64)}:x`], T).selfDeclared === false, 'R: selfDeclared semantics unchanged');
});

test('R4: getAssistantKeys is still the per-user key seam', () => {
  const ak = require(path.join(ROOT, 'src/utils/assistantKeys.js'));
  assert(typeof ak.getAssistantKeys === 'function', 'R: src/utils/assistantKeys.js exports getAssistantKeys');
});

async function run_() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail, skipped: 0 };
}

module.exports = { run: run_ };
