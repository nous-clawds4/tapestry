'use strict';
/**
 * assistant-profile-checklist #3: a personalized avatar for every Assistant, and the avatar panel's fix.
 *
 * Story: engineering-team/stories/assistant-profile-checklist/3-a-personalized-avatar-for-every-assistant.md
 * ADR:   engineering-team/decisions/assistant-profile-checklist/0003-the-stamped-avatar-for-the-signed-in-persons-own-assistant.md
 * Plan:  engineering-team/stories/assistant-profile-checklist/3-a-personalized-avatar-for-every-assistant.test-plan.md
 * Browser half: tests/brainstorm/assistant-profile-checklist-page.spec.js (the avatar panel: B-AV tests).
 * Expected words: test/helpers/profileChecklistFixtures.js (AVATAR_COPY).
 *
 * Classes:
 *   G — the gate, createRequireOwnAssistant(deps): signed in, with an Assistant here, or refused before anything else. [AC-1, AC-6]
 *   P — getPersonPictureUrl(pubkey, deps): the person's own newest kind 0, local first, then the profile relays.        [AC-1]
 *   M — handleMyPicture(req, res, deps): the signed-in person's picture only, every hop through the SSRF guard, the three
 *       codes. The internal-address cases run the REAL guardedFetch with global fetch stubbed, so nothing leaves.  [AC-1, AC-5, AC-6]
 *   N — the store: 32-hex content names, and at most 20 new files a day per person; an existing name is not counted.  [AC-6]
 *   U — ui/src/utils/stampedAvatar.js, loaded in Node as ESM: reasonOf(status, body).                                 [AC-5]
 *   D — source sentinels: the routes and their order (the gate before multer), the old route gone, the editor and the
 *       panel on the shared flow, story 3's words.                                                     [AC-2 … AC-4, AC-6]
 *
 * Every test FAILS against the current code: avatar.js gates on isOwner and has no createRequireOwnAssistant,
 * handleMyPicture or getPersonPictureUrl; names are 8 hex; there is no limit; ui/src/utils/stampedAvatar.js does not
 * exist; the editor's section is the Owner's only.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const X = require('./helpers/profileChecklistFixtures');

const REPO = path.resolve(__dirname, '..');
const AVATAR_MODULE = path.join(REPO, 'src/api/assistant/avatar.js');
const API_INDEX = path.join(REPO, 'src/api/index.js');
const UI_UTIL = path.join(REPO, 'ui/src/utils/stampedAvatar.js');
const EDITOR = path.join(REPO, 'ui/src/components/AssistantProfileEditor.jsx');
const PAGE_FILE = path.join(REPO, 'ui/src/pages/assistant/ProfileChecklist.jsx');
const COPY_MOD = path.join(REPO, 'ui/src/pages/assistant/profileChecklistCopy.js');
const NL = String.fromCharCode(10);

const PERSON = 'd1'.repeat(32);
const PERSON_ASSISTANT = 'd2'.repeat(32);
const OWNER = '0e'.repeat(32);
const STRANGER = 'b3'.repeat(32);
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PUBLIC_IMG = 'https://93.184.216.34/alice.png'; // an IP literal: the real guard classifies it with no DNS

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}
function strings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') out.push(String(v));
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

function avatarModule() {
  assert(fs.existsSync(AVATAR_MODULE), 'src/api/assistant/avatar.js is missing');
  delete require.cache[require.resolve(AVATAR_MODULE)];
  return require(AVATAR_MODULE);
}
function need(mod, name) {
  assert(typeof mod[name] === 'function', `src/api/assistant/avatar.js must export ${name}() (ADR 0003 § Implementation notes). Exports: ${Object.keys(mod).join(', ')}`);
  return mod[name];
}
function fakeRes() {
  const res = { statusCode: 200, body: undefined, headers: {}, sent: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.set = (k, v) => { if (typeof k === 'object') Object.assign(res.headers, k); else res.headers[String(k).toLowerCase()] = v; return res; };
  res.send = (b) => { res.sent = b; return res; };
  return res;
}
/** A same-shaped stand-in for a fetch Response. */
function response(status, { type = 'image/png', body = Buffer.concat([PNG_SIG, Buffer.from('x')]), location } = {}) {
  const headers = {};
  if (type) headers['content-type'] = type;
  if (location) headers.location = location;
  return new Response(status >= 300 && status < 400 ? null : body, { status, headers });
}

let idSeq = 0;
function kind0(pubkey, content, createdAt = 1000) {
  idSeq += 1;
  return { id: idSeq.toString(16).padStart(64, '0'), pubkey, kind: 0, created_at: createdAt, tags: [], content: JSON.stringify(content), sig: '0'.repeat(128) };
}

/* ───────────────────────── G — the gate ───────────────────────── */

async function gate(req, { assistant = PERSON_ASSISTANT, owner = OWNER } = {}) {
  const create = need(avatarModule(), 'createRequireOwnAssistant');
  const calls = { getAssistantPubkeyFor: [] };
  const mw = create({
    getAssistantPubkeyFor: async (pk) => { calls.getAssistantPubkeyFor.push(pk); if (assistant === 'throw') throw new Error('fixture: key store'); return assistant; },
    getOwnerPubkey: () => owner,
  });
  const res = fakeRes();
  let nexted = false;
  await mw(req, res, () => { nexted = true; });
  return { res, nexted, req, calls };
}

test('G1: a signed-in person with an Assistant here passes the gate, whatever their role, and the gate names them on the request as req.avatarPerson (AC-1; ADR 0003 sub-decision 1)', async () => {
  const wrong = [];
  for (const [label, pk] of [['a Customer', PERSON], ['an Admin', 'ad'.repeat(32)], ['the Owner', OWNER]]) {
    const { res, nexted, req } = await gate({ session: { authenticated: true, pubkey: pk }, query: { pubkey: STRANGER }, body: {} });
    if (!nexted) wrong.push(`${label}: refused (${res.statusCode} ${show(res.body)})`);
    if (req.avatarPerson !== pk) wrong.push(`${label}: req.avatarPerson want ${pk}, got ${show(req.avatarPerson)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('G2: refused before anything else — no session (401 not-signed-in), a session that is not a 64-hex pubkey (401), a person with no Assistant here (403 no-assistant), a key store that throws (refused) (AC-6; ADR 0003 sub-decision 1)', async () => {
  const cases = [
    ['no session', { query: {} }, {}, 401, 'not-signed-in'],
    ['not authenticated', { session: { authenticated: false, pubkey: PERSON } }, {}, 401, 'not-signed-in'],
    ['a junk pubkey', { session: { authenticated: true, pubkey: 'nope' } }, {}, 401, 'not-signed-in'],
    ['no assistant here', { session: { authenticated: true, pubkey: PERSON } }, { assistant: null }, 403, 'no-assistant'],
    ['a junk assistant', { session: { authenticated: true, pubkey: PERSON } }, { assistant: 'xyz' }, 403, 'no-assistant'],
  ];
  const wrong = [];
  for (const [label, req, opts, status, code] of cases) {
    const { res, nexted } = await gate({ ...req }, opts);
    if (nexted) wrong.push(`${label}: passed the gate`);
    if (res.statusCode !== status || !res.body || res.body.code !== code) wrong.push(`${label}: want ${status} ${code}, got ${res.statusCode} ${show(res.body)}`);
  }
  const thrown = await gate({ session: { authenticated: true, pubkey: PERSON } }, { assistant: 'throw' });
  if (thrown.nexted || thrown.res.statusCode < 400) wrong.push(`a throwing key store: want refused, got ${thrown.res.statusCode}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('G3: the in-container operator (req.localTrusted, no session) acts as the Owner, as today (ADR 0003 sub-decision 1)', async () => {
  const { nexted, req } = await gate({ localTrusted: true });
  assert(nexted && req.avatarPerson === OWNER, `want next() with req.avatarPerson = the Owner; got ${show({ nexted, avatarPerson: req.avatarPerson })}`);
});

test('G4: requireOwnAssistant is exported — the gate with the real dependencies — and refuses a visitor with 401 (ADR 0003 § Implementation notes)', async () => {
  const mw = need(avatarModule(), 'requireOwnAssistant');
  const res = fakeRes();
  let nexted = false;
  await mw({ session: {} }, res, () => { nexted = true; });
  assert(!nexted && res.statusCode === 401, `a visitor: want 401, got ${res.statusCode} ${show(res.body)}`);
});

/* ───────────────────────── P — the person's picture ───────────────────────── */

async function picture(local, relays, { relayList = ['wss://purplepag.es'] } = {}) {
  const get = need(avatarModule(), 'getPersonPictureUrl');
  const calls = { scan: [], query: [] };
  const url = await get(PERSON, {
    scanLocalKind0: async (pk) => { calls.scan.push(pk); return local; },
    queryRelaysKind0: async (list, pk) => { calls.query.push({ list, pk }); return relays || []; },
    getProfileRelays: () => relayList,
  });
  return { url, calls };
}

test('P1: the picture is the person\'s own newest kind 0\'s, from this instance\'s relay; only when it holds no kind 0 are the profile relays asked, and their newest by that person counts (AC-1; ADR 0003 sub-decision 2)', async () => {
  const wrong = [];
  const local = await picture(kind0(PERSON, { picture: 'https://img.example/local.png' }), [kind0(PERSON, { picture: 'https://img.example/relay.png' }, 5000)]);
  if (local.url !== 'https://img.example/local.png') wrong.push(`local kind 0: want its picture, got ${show(local.url)}`);
  if (local.calls.query.length) wrong.push('a local kind 0 needs no relay');
  const localNoPicture = await picture(kind0(PERSON, { name: 'Alice' }), [kind0(PERSON, { picture: 'https://img.example/relay.png' })]);
  if (localNoPicture.url !== null || localNoPicture.calls.query.length) wrong.push(`a local kind 0 with no picture: want null and no relay; got ${show(localNoPicture.url)}, ${localNoPicture.calls.query.length} queries`);
  const remote = await picture(null, [kind0(PERSON, { picture: 'https://img.example/old.png' }, 100), kind0(PERSON, { picture: 'https://img.example/new.png' }, 200), kind0(STRANGER, { picture: 'https://evil.example/x.png' }, 900)]);
  if (remote.url !== 'https://img.example/new.png') wrong.push(`no local kind 0: want the person's newest on the profile relays, got ${show(remote.url)}`);
  if (!remote.calls.query.length || remote.calls.query[0].pk !== PERSON || !Array.isArray(remote.calls.query[0].list) || remote.calls.query[0].list[0] !== 'wss://purplepag.es') wrong.push(`the profile relays asked about the person: got ${show(remote.calls.query)}`);
  const nothing = await picture(null, []);
  if (nothing.url !== null) wrong.push(`nowhere: want null, got ${show(nothing.url)}`);
  if (local.calls.scan[0] !== PERSON) wrong.push(`the scan is about the person: got ${show(local.calls.scan)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── M — the picture proxy ───────────────────────── */

async function proxy({ url = PUBLIC_IMG, guarded, person = PERSON, req: extraReq = {} } = {}) {
  const handle = need(avatarModule(), 'handleMyPicture');
  const calls = { picture: [], guarded: [] };
  const deps = { getPersonPictureUrl: async (pk) => { calls.picture.push(pk); return url; } };
  if (guarded) deps.guardedFetch = async (u, opts) => { calls.guarded.push(String(u)); return guarded(String(u), opts, calls.guarded.length); };
  const res = fakeRes();
  await handle({ avatarPerson: person, session: { authenticated: true, pubkey: person }, query: { url: 'https://attacker.example/x.png', pubkey: STRANGER }, body: {}, ...extraReq }, res, deps);
  return { res, calls };
}
/** Run `fn` with global fetch replaced by a recorder that answers `answer(url)`. */
async function withStubbedFetch(answer, fn) {
  const real = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (u) => { seen.push(String(u)); return answer(String(u)); };
  try { return await fn(seen); } finally { globalThis.fetch = real; }
}

test('M1: the proxy serves the signed-in person\'s own picture — asked by req.avatarPerson, never by a URL or pubkey in the request — same-origin, with its image type (AC-1; ADR 0003 sub-decision 2)', async () => {
  const bytes = Buffer.concat([PNG_SIG, Buffer.from('alice')]);
  const { res, calls } = await proxy({ guarded: () => response(200, { body: bytes }) });
  const wrong = [];
  if (!(res.statusCode === 200 && Buffer.isBuffer(res.sent) && res.sent.equals(bytes))) wrong.push(`want 200 with the picture's bytes; got ${res.statusCode} ${show(res.body)}`);
  if ((res.headers['content-type'] || '') !== 'image/png') wrong.push(`Content-Type: want image/png, got ${show(res.headers['content-type'])}`);
  if (!(calls.picture.length === 1 && calls.picture[0] === PERSON)) wrong.push(`the picture is the session person's: asked ${show(calls.picture)}`);
  if (calls.guarded.some((u) => u.includes('attacker.example'))) wrong.push('the request\'s url was fetched');
  if (calls.guarded[0] !== PUBLIC_IMG) wrong.push(`the fetch went through guardedFetch to the person's picture: ${show(calls.guarded)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('M2: no picture → 404 code no-picture (AC-5; ADR 0003 sub-decision 4)', async () => {
  const { res } = await proxy({ url: null, guarded: () => response(200) });
  assert(res.statusCode === 404 && res.body && res.body.code === 'no-picture', `want 404 no-picture, got ${res.statusCode} ${show(res.body)}`);
});

test('M3: a picture on an internal address, or not https, is unfetchable — and no request leaves for it (the real SSRF guard, global fetch stubbed) (AC-6; ADR 0003 sub-decision 3)', async () => {
  const wrong = [];
  for (const url of ['https://127.0.0.1:7778/api/settings', 'https://169.254.169.254/latest/meta-data/', 'https://10.0.0.5/a.png', 'https://localhost/a.png', 'http://93.184.216.34/a.png', 'file:///etc/passwd', 'ftp://93.184.216.34/a.png']) {
    await withStubbedFetch(() => response(200), async (seen) => {
      const { res } = await proxy({ url });
      if (res.statusCode !== 404 || !res.body || res.body.code !== 'unfetchable') wrong.push(`${url}: want 404 unfetchable, got ${res.statusCode} ${show(res.body)}`);
      if (seen.length) wrong.push(`${url}: a request left the process (${show(seen)})`);
    });
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('M4: a redirect is followed once, through the guard: a public host redirecting to an internal address is unfetchable, with one request only; two redirects are unfetchable (AC-6; ADR 0003 sub-decision 3)', async () => {
  const wrong = [];
  await withStubbedFetch(() => response(302, { location: 'https://127.0.0.1/secret.png' }), async (seen) => {
    const { res } = await proxy({ url: PUBLIC_IMG });
    if (res.statusCode !== 404 || !res.body || res.body.code !== 'unfetchable') wrong.push(`redirect to 127.0.0.1: want unfetchable, got ${res.statusCode} ${show(res.body)}`);
    if (seen.length !== 1) wrong.push(`redirect to 127.0.0.1: want exactly one request (the public host), got ${show(seen)}`);
  });
  const hop = await proxy({ guarded: (u, o, n) => (n === 1 ? response(302, { location: '/cdn/alice.png' }) : response(200)) });
  if (hop.res.statusCode !== 200) wrong.push(`one redirect to a public path: want 200, got ${hop.res.statusCode} ${show(hop.res.body)}`);
  if (hop.calls.guarded[1] !== 'https://93.184.216.34/cdn/alice.png') wrong.push(`the hop is resolved against the first URL and goes through guardedFetch; got ${show(hop.calls.guarded)}`);
  const twice = await proxy({ guarded: (u, o, n) => response(302, { location: `https://93.184.216.34/hop${n}.png` }) });
  if (twice.res.statusCode !== 404 || !twice.res.body || twice.res.body.code !== 'unfetchable') wrong.push(`two redirects: want unfetchable, got ${twice.res.statusCode} ${show(twice.res.body)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('M5: a host that fails — refused by the guard (null), an error answer, a throw — is unfetchable (AC-5; ADR 0003 sub-decision 4)', async () => {
  const wrong = [];
  for (const [label, guarded] of [['refused', () => null], ['500', () => response(500, { type: 'text/plain', body: 'x' })], ['404', () => response(404, { type: 'text/plain', body: 'x' })], ['a throw', () => { throw new Error('fixture: ECONNRESET'); }]]) {
    const { res } = await proxy({ guarded });
    if (res.statusCode !== 404 || !res.body || res.body.code !== 'unfetchable') wrong.push(`${label}: want 404 unfetchable, got ${res.statusCode} ${show(res.body)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('M6: a picture this instance cannot stamp — not an allowed image type (HTML, SVG), or over 5 MB — is not-stampable (AC-5; ADR 0003 sub-decision 4)', async () => {
  const wrong = [];
  const big = Buffer.alloc(5 * 1024 * 1024 + 10, 1);
  for (const [label, guarded] of [['html', () => response(200, { type: 'text/html', body: '<html></html>' })], ['svg', () => response(200, { type: 'image/svg+xml', body: '<svg/>' })], ['too large', () => response(200, { type: 'image/png', body: big })]]) {
    const { res } = await proxy({ guarded });
    if (res.statusCode !== 404 || !res.body || res.body.code !== 'not-stampable') wrong.push(`${label}: want 404 not-stampable, got ${res.statusCode} ${show(res.body)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── N — the store ───────────────────────── */

function makePng(seed) {
  return Buffer.concat([PNG_SIG, Buffer.from(`IHDR-fixture-${seed}`)]);
}
const madeDirs = [];
function freshDir() { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'stamped-everyone-')); madeDirs.push(d); return d; }

test('N1: a stored composite is named by 32 hex characters of its SHA-256 — ta-avatar-<sha256[0:32]>.png (ADR 0003 sub-decision 5)', () => {
  const store = need(avatarModule(), 'storeCompositeAvatar');
  const buf = makePng('n1');
  const out = store(buf, { baseDir: freshDir() });
  const want = `ta-avatar-${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 32)}.png`;
  assert(out && out.filename === want, `want ${want}, got ${show(out && out.filename)}`);
});

// The handler's limit lives in its module, so a sequence of uploads must go through ONE loaded module: each test loads it
// once and hands it in (re-requiring per upload would start every upload with an empty limit).
async function upload(person, buf, { baseDir, now, mod = avatarModule() } = {}) {
  const handle = need(mod, 'handleUploadAvatar');
  const res = fakeRes();
  await handle({ avatarPerson: person, session: { authenticated: true, pubkey: person }, file: { buffer: buf } }, res, { baseDir, now });
  return res;
}

test('N2: at most MAX_NEW_AVATARS_PER_DAY (20) new files per person in a rolling day — the 21st new one is 429 code too-many; storing bytes already there is not counted and still answers; another person is unaffected; a day later it is allowed again (ADR 0003 sub-decision 6)', async () => {
  const mod = avatarModule();
  assert(mod.MAX_NEW_AVATARS_PER_DAY === X.MAX_NEW_AVATARS_PER_DAY, `MAX_NEW_AVATARS_PER_DAY: want ${X.MAX_NEW_AVATARS_PER_DAY}, got ${show(mod.MAX_NEW_AVATARS_PER_DAY)}`);
  const dir = freshDir();
  const who = crypto.randomBytes(32).toString('hex');
  const other = crypto.randomBytes(32).toString('hex');
  const t0 = Date.now();
  const wrong = [];
  for (let i = 0; i < 20; i += 1) {
    const r = await upload(who, makePng(`${who}-${i}`), { mod, baseDir: dir, now: () => t0 + i });
    if (r.statusCode !== 200 || !r.body || r.body.success !== true) { wrong.push(`new file ${i + 1}: want 200, got ${r.statusCode} ${show(r.body)}`); break; }
  }
  const over = await upload(who, makePng(`${who}-20`), { mod, baseDir: dir, now: () => t0 + 100 });
  if (over.statusCode !== 429 || !over.body || over.body.code !== 'too-many') wrong.push(`the 21st new file: want 429 too-many, got ${over.statusCode} ${show(over.body)}`);
  const again = await upload(who, makePng(`${who}-3`), { mod, baseDir: dir, now: () => t0 + 200 });
  if (again.statusCode !== 200) wrong.push(`re-storing bytes already there, at the limit: want 200 (nothing written, not counted), got ${again.statusCode} ${show(again.body)}`);
  const theirs = await upload(other, makePng(`${other}-0`), { mod, baseDir: dir, now: () => t0 + 300 });
  if (theirs.statusCode !== 200) wrong.push(`another person: want 200, got ${theirs.statusCode}`);
  const later = await upload(who, makePng(`${who}-21`), { mod, baseDir: dir, now: () => t0 + 24 * 3600 * 1000 + 1000 });
  if (later.statusCode !== 200) wrong.push(`a day later: want 200, got ${later.statusCode} ${show(later.body)}`);
  if (fs.readdirSync(dir).length !== 22) wrong.push(`files written: want 22 (20 + another person's + a day later), got ${fs.readdirSync(dir).length}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('N3: the store still keeps every older composite, checks the PNG by its bytes, and answers the publishable URL only on a public instance — ADR ta-avatar/0003 D3 and D4 stand (AC-6)', async () => {
  const dir = freshDir();
  const who = crypto.randomBytes(32).toString('hex');
  const wrong = [];
  const a = await upload(who, makePng(`${who}-a`), { baseDir: dir });
  const b = await upload(who, makePng(`${who}-b`), { baseDir: dir });
  if (a.statusCode !== 200 || b.statusCode !== 200 || fs.readdirSync(dir).length !== 2) wrong.push(`two composites, both kept; got ${a.statusCode}/${b.statusCode} and ${show(fs.readdirSync(dir))}`);
  const notPng = await upload(who, Buffer.from('<svg/>'), { baseDir: dir });
  if (notPng.statusCode !== 400) wrong.push(`a non-PNG: want 400, got ${notPng.statusCode}`);
  if (a.body && typeof a.body.path === 'string' && !a.body.path.startsWith('/generated/')) wrong.push(`the path is under /generated/: got ${show(a.body.path)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── U — the browser helper ───────────────────────── */

test('U1: ui/src/utils/stampedAvatar.js loads in Node and exports stampMyPicture, storeStampedAvatar and reasonOf; reasonOf maps the proxy\'s and the store\'s answers — no-picture, unfetchable, not-stampable, too-many; a 401/403 is refused; anything else failed (AC-5; ADR 0003 sub-decision 7)', async () => {
  assert(fs.existsSync(UI_UTIL), `${rel(UI_UTIL)} does not exist — ADR 0003 sub-decision 7 creates it`);
  let mod;
  try { mod = await import(pathToFileURL(UI_UTIL).href); } catch (err) { throw new Error(`${rel(UI_UTIL)} must load in Node as ESM (relative imports with .js): ${err.message}`); }
  for (const n of ['stampMyPicture', 'storeStampedAvatar', 'reasonOf']) assert(typeof mod[n] === 'function', `stampedAvatar.js must export ${n}()`);
  const cases = [
    [404, { code: 'no-picture' }, 'no-picture'], [404, { code: 'unfetchable' }, 'unfetchable'], [404, { code: 'not-stampable' }, 'not-stampable'],
    [429, { code: 'too-many' }, 'too-many'], [401, { code: 'not-signed-in' }, 'refused'], [403, { code: 'no-assistant' }, 'refused'],
    [403, null, 'refused'], [500, { success: false }, 'failed'], [500, null, 'failed'],
  ];
  const wrong = cases.filter(([s, b, want]) => mod.reasonOf(s, b) !== want).map(([s, b, want]) => `reasonOf(${s}, ${show(b)}): want ${want}, got ${show(mod.reasonOf(s, b))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── D — by source ───────────────────────── */

test('D1: the routes — GET /api/assistant/my-picture behind requireOwnAssistant; POST /api/assistant/avatar with requireOwnAssistant BEFORE uploadMiddleware, so a refused body is never parsed; /api/assistant/owner-avatar gone (ADR 0003 sub-decisions 1–2)', () => {
  const src = safeRead(API_INDEX);
  const wrong = [];
  if (!/app\.get\(\s*['"]\/api\/assistant\/my-picture['"]\s*,\s*[\w.]*requireOwnAssistant\s*,\s*[\w.]*handleMyPicture\s*\)/.test(src)) wrong.push("app.get('/api/assistant/my-picture', …requireOwnAssistant, …handleMyPicture)");
  if (!/app\.post\(\s*['"]\/api\/assistant\/avatar['"]\s*,\s*[\w.]*requireOwnAssistant\s*,\s*[\w.]*uploadMiddleware\s*,\s*[\w.]*handleUploadAvatar\s*\)/.test(src)) wrong.push("app.post('/api/assistant/avatar', …requireOwnAssistant, …uploadMiddleware, …handleUploadAvatar)");
  if (/['"]\/api\/assistant\/owner-avatar['"]/.test(src)) wrong.push('/api/assistant/owner-avatar is still registered');
  assert(wrong.length === 0, `src/api/index.js: ${wrong.join('; ')}`);
});

test('D2: the avatar module no longer gates on the instance owner, and the proxy reads the person\'s picture through guardedFetch — no plain fetch( to the picture host (ADR 0003 sub-decisions 1, 3)', () => {
  const src = codeOnly(safeRead(AVATAR_MODULE));
  const wrong = [];
  if (/!\s*isOwner\s*\(\s*req\s*\)/.test(src)) wrong.push('a handler still gates on !isOwner(req) — the middleware gates now');
  if (!/guardedFetch/.test(src)) wrong.push('no guardedFetch');
  const handler = (src.match(/(?:function\s+handleMyPicture|handleMyPicture\s*=\s*async)[\s\S]*?\n\}/) || [''])[0];
  if (!handler) wrong.push('no handleMyPicture');
  if (/(^|[^\w.])fetch\s*\(/.test(handler)) wrong.push('handleMyPicture calls a plain fetch(');
  if (/req\.(query|body|params)/.test(handler)) wrong.push('handleMyPicture reads a request parameter');
  if (/BRAINSTORM_OWNER_PUBKEY/.test(handler)) wrong.push('handleMyPicture reads the instance owner');
  assert(wrong.length === 0, wrong.join('; '));
});

test('D3: the editor offers the stamped avatar through the shared flow — stampMyPicture / storeStampedAvatar from ../utils/stampedAvatar, never /api/assistant/owner-avatar — with story 3\'s "no picture" line (AC-4; ADR 0003 sub-decision 8)', () => {
  const src = codeOnly(safeRead(EDITOR));
  const wrong = [];
  if (!/import\s*\{[^}]*\bstampMyPicture\b[^}]*\}\s*from\s*['"]\.\.\/utils\/stampedAvatar(\.js)?['"]/.test(src)) wrong.push('no stampMyPicture import from ../utils/stampedAvatar');
  if (!/\bstoreStampedAvatar\b/.test(src)) wrong.push('no storeStampedAvatar');
  if (/\/api\/assistant\/owner-avatar/.test(src)) wrong.push('still fetches /api/assistant/owner-avatar');
  if (!safeRead(EDITOR).includes(X.AVATAR_COPY['no-picture'])) wrong.push(`the editor's "no picture" line must be story 3's: ${show(X.AVATAR_COPY['no-picture'])}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('D4: the avatar panel\'s fix — the page stamps, previews and publishes through the shared flow and the set-picture fix, and the copy module carries story 3\'s words (AC-2, AC-3, AC-5; ADR 0003 sub-decision 9)', async () => {
  const page = codeOnly(safeRead(PAGE_FILE));
  const wrong = [];
  if (!page) wrong.push(`${rel(PAGE_FILE)} does not exist`);
  if (!/\bstampMyPicture\b/.test(page) || !/\bstoreStampedAvatar\b/.test(page)) wrong.push('the page uses stampMyPicture and storeStampedAvatar');
  if (!/set-picture/.test(page)) wrong.push('the page publishes the stored avatar with the set-picture fix');
  let copy = '';
  if (fs.existsSync(COPY_MOD)) {
    try { copy = strings((await import(pathToFileURL(COPY_MOD).href)).PROFILE_CHECKLIST_COPY).join(NL); } catch (err) { wrong.push(`profileChecklistCopy.js does not load: ${err.message}`); }
  } else wrong.push(`${rel(COPY_MOD)} does not exist`);
  const missing = Object.values(X.AVATAR_COPY).filter((w) => !copy.includes(w));
  if (missing.length) wrong.push(`PROFILE_CHECKLIST_COPY is missing story 3's words: ${show(missing)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

async function run() {
  console.log(`${NL}=== assistant-stamped-avatar-for-everyone (assistant-profile-checklist #3) ===`);
  let pass = 0, fail = 0;
  const failures = [];
  const warn = console.warn; const error = console.error;
  console.warn = () => {}; console.error = () => {};
  try {
    for (const [name, fn] of tests) {
      try {
        await fn();
        console.log(`  PASS  ${name}`);
        pass++;
      } catch (err) {
        console.log(`  FAIL  ${name}${NL}        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      }
    }
  } finally {
    console.warn = warn; console.error = error;
    for (const d of madeDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
  console.log(`${NL}assistant-stamped-avatar-for-everyone: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => { process.exitCode = r.fail > 0 ? 1 : 0; });
}
