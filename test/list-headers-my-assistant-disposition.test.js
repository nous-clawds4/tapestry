/**
 * list-headers-disposition #3: Disposition on My Assistant rows — Submit as a Shared Concept and Keep private,
 * signed only by the caller's own Assistant.
 *
 * Story: engineering-team/stories/list-headers-disposition/3-disposition-on-my-assistant-rows.md
 * ADR:   engineering-team/decisions/list-headers-disposition/0003-my-assistant-disposition-endpoints-and-panel.md
 * Plan:  engineering-team/stories/list-headers-disposition/3-disposition-on-my-assistant-rows.test-plan.md
 * Browser half: tests/brainstorm/list-headers-my-assistant-disposition.spec.js
 *
 *   K1..K7  — the pure tag composition in src/lib/headerDispositionCompose.js.
 *   P1..P2  — parity: Concept Headers' own handlers (selfDeclare.js, bDisposition.js), run in an isolated child
 *             process with stand-in parts, produce the same tags as the shared module for the same headers.
 *   H1..H12 — the handler, src/api/list-headers/myAssistantDisposition.js, through injected deps: every refusal,
 *             who signs (the SESSION's own Assistant, never another's), what is saved, what never leaks.
 *   W1..W4, P3, HW1..HW6 — story 4 (ADR 0004): Wire. The pure composeWire; parity with Concept Headers'
 *             handleBAppend; the handler's b-append action, which keeps every story-3 refusal and adds step 4b (the
 *             target is checked before the relay is read).
 *   HW7..HW12, W5 — story 4 review round 1 (ADR 0004 Amendment 1): the target is a string with no control or format
 *             characters, at most 1024 UTF-8 bytes, a list header's address (literal kind 39998), not the header's own
 *             (by parts); every action reads its new version back from the relay before writing the graph.
 *   H13..H15, S5 — review round 1 (ADR 0003 Amendment 1): another site is refused first; the relay's latest header
 *             is verified (author, kind, first d, signature) before anything is signed or answered "already"; the
 *             handle is decoded once; the module carries the same-host check and no second decode.
 *   S1..S4  — structure the ADR pins: no owner/admin/loopback/TA-only identifiers; the shell-free scan; the two
 *             routes; their registration.
 *   U1      — authorRole in ui/src/utils/viewerAuthorScope.js (ADR 0001's predicate, added by ADR 0003).
 *   R1      — Concept Headers' gates are unchanged (passes before and after).
 *   L1..L2  — LIVE, refusals only, skipped without the local stack: a no-session call from inside the container
 *             gets 401 and changes nothing (through test/helpers/stackHttp.js, the house's honest-status helper —
 *             review round 2); a guest session with no Assistant gets 403. Neither can publish.
 *
 * EXPECTED NOW (pre-implementation): K, P, H, S, U and L FAIL (missing modules / missing routes); R1 PASSES.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { pathToFileURL } = require('url');
const { loopbackRequest, describeResponse } = require('./helpers/stackHttp');

const ROOT = path.resolve(__dirname, '..');
const COMPOSE = path.join(ROOT, 'src/lib/headerDispositionCompose.js');
const HANDLER = path.join(ROOT, 'src/api/list-headers/myAssistantDisposition.js');
const API_INDEX = path.join(ROOT, 'src/api/index.js');
const SELF_DECLARE = path.join(ROOT, 'src/api/concept/selfDeclare.js');
const B_DISPOSITION = path.join(ROOT, 'src/api/concept/bDisposition.js');
const SCOPE_JS = path.join(ROOT, 'ui/src/utils/viewerAuthorScope.js');

const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_PORT || '7778'}`;
const ROUTE = (handle, action) => `/api/list-headers/my-assistant/${encodeURIComponent(handle)}/${action}`;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(ROOT, p);

function load(p, what) {
  try { return require(p); } catch (err) {
    throw new Error(`ADR 0003 §Implementation: ${rel(p)} must exist and load stack-free (${what}) — ${err.message.split('\n')[0]}`);
  }
}
const compose = () => load(COMPOSE, 'pure CJS tag composition');
const handlerMod = () => load(HANDLER, 'createMyAssistantDispositionHandler + register');

/** Source with comments blanked, so a structural check can't be satisfied (or tripped) by prose. */
function code(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const d = s[i + 1];
    if (c === '/' && d === '*') { const e = s.indexOf('*/', i + 2); const stop = e === -1 ? s.length : e + 2; for (let k = i; k < stop; k++) out += s[k] === '\n' ? '\n' : ' '; i = stop; }
    else if (c === '/' && d === '/') { while (i < s.length && s[i] !== '\n') { out += ' '; i++; } }
    else if (c === "'" || c === '"' || c === '`') { const q = c; out += c; i++; while (i < s.length) { if (s[i] === '\\') { out += s[i] + (s[i + 1] || ''); i += 2; continue; } out += s[i]; if (s[i] === q) { i++; break; } i++; } }
    else { out += c; i++; }
  }
  return out;
}

// ── fixtures ────────────────────────────────────────────────────────────────

const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const CUST = '3'.repeat(64);
const CUST_TA = '4'.repeat(64);
const ADMIN = '5'.repeat(64);
const ADMIN_TA = '6'.repeat(64);
const GUEST = '7'.repeat(64);
const SK = { [OWNER_TA]: 'a1'.repeat(32), [CUST_TA]: 'c3'.repeat(32), [ADMIN_TA]: 'd5'.repeat(32) };
const KEYS = {
  [OWNER]: { pubkey: OWNER_TA, privkey: SK[OWNER_TA] },
  [CUST]: { pubkey: CUST_TA, privkey: SK[CUST_TA] },
  [ADMIN]: { pubkey: ADMIN_TA, privkey: SK[ADMIN_TA] },
};
const ALL_SECRETS = Object.values(SK);
const SENTINEL = 'b-tag-deferred';
const THEIRS = `39998:${'9'.repeat(64)}:somebody-elses-concept`;
const AN_EVENT_ID = 'e7'.repeat(32);
const ANOTHER = `39998:${'ab'.repeat(32)}:another-concept`; // story 4: a second wiring target
const NOW = 1790000000;

function header(pubkey, d, bTags = [], { created_at = NOW - 3600, extra = [] } = {}) {
  return {
    id: 'f0'.repeat(32), pubkey, kind: 39998, created_at, content: '{"x":1}', sig: '0'.repeat(128),
    tags: [['d', d], ['names', 'thing', 'things'], ...extra, ...bTags],
  };
}
const addr = (pubkey, d) => `39998:${pubkey}:${d}`;

/**
 * A request as Express hands it to the handler. Express has already decoded req.params, so the handle arrives
 * decoded (ADR 0003 Amendment 1 §3; re-aimed in review round 1 — it used to pass the raw, encoded path segment).
 * `origin` is set only when given: a missing Origin is what curl and in-container calls send.
 */
function request(handle, { session = null, localTrusted = false, origin, host = 'localhost:7778' } = {}) {
  const req = { params: { handle }, body: {}, headers: { host } };
  if (origin !== undefined) req.headers.origin = origin;
  if (session) req.session = session;
  else req.session = {};
  if (localTrusted) req.localTrusted = true;
  return req;
}
const signedIn = (pubkey) => ({ authenticated: true, pubkey });

function response() {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

/** Injected deps that record every call. `headers` is what scanLatest finds, keyed by `${author}:${d}`. */
function deps({ headers = {}, publishThrows = false, realAuth = false, verify = () => true, stored = true } = {}) {
  const calls = [];
  const d = {
    // The relay read-back (ADR 0004 Amendment 1 §4): "stored" unless a test says otherwise; 'throws' simulates a failed read.
    isStored: async (id) => { calls.push(['isStored', id]); if (stored === 'throws') throw new Error('strfry scan failed'); return stored; },
    // The signature check is injected (ADR 0003 Amendment 1 §1); "valid" unless a test says otherwise, because the
    // default verifier loads nostr-tools from the container path, which the host doesn't have.
    verify: (ev) => { calls.push(['verify', ev]); return verify(ev); },
    getAssistantKeys: async (pk) => { calls.push(['getAssistantKeys', pk]); return KEYS[pk] || null; },
    scanLatest: async (filter) => {
      calls.push(['scanLatest', filter]);
      const a = (filter.authors || [])[0];
      const dd = (filter['#d'] || [])[0];
      return headers[`${a}:${dd}`] || null;
    },
    sign: (template, privkeyHex) => {
      calls.push(['sign', template, privkeyHex]);
      const signer = Object.keys(SK).find((pk) => SK[pk] === privkeyHex) || 'unknown';
      return { ...template, id: 'ab'.repeat(32), pubkey: signer, sig: '11'.repeat(64) };
    },
    publishLocal: async (ev) => { calls.push(['publishLocal', ev]); if (publishThrows) throw new Error('strfry import failed: boom'); },
    importToGraph: async (ev, uuid) => { calls.push(['importToGraph', ev, uuid]); },
    now: () => NOW,
  };
  if (!realAuth) {
    d.requireAuth = (req, res) => {
      calls.push(['requireAuth']);
      const pk = req.session && req.session.pubkey;
      if (!req.session || req.session.authenticated !== true || !/^[0-9a-f]{64}$/.test(pk || '')) {
        res.status(401).json({ success: false, error: 'authentication required' });
        return null;
      }
      return pk;
    };
  }
  return { d, calls };
}
const called = (calls, name) => calls.filter((c) => c[0] === name);
function noLeak(res, label) {
  const text = JSON.stringify(res.body || {});
  for (const s of ALL_SECRETS) assert(!text.includes(s), `ADR 0003: ${label} — the response must never carry an Assistant's private key`);
}

async function run1(action, handle, opts, depOpts) {
  const { createMyAssistantDispositionHandler } = handlerMod();
  assert(typeof createMyAssistantDispositionHandler === 'function', 'ADR 0003: createMyAssistantDispositionHandler must be exported');
  const { d, calls } = deps(depOpts);
  const res = response();
  const req = request(handle, opts);
  if (opts && opts.body !== undefined) req.body = opts.body; // story 4: b-append reads its target from the body
  await createMyAssistantDispositionHandler(action, d)(req, res);
  return { res, calls };
}

// ── K — composition ─────────────────────────────────────────────────────────

test('K1: Submit on an undecided header adds the self-pointing b and keeps every earlier tag, without touching the input', () => {
  const { composeSelfDeclare } = compose();
  const h = header(CUST_TA, 'recipes');
  const before = JSON.stringify(h.tags);
  const out = composeSelfDeclare(h, addr(CUST_TA, 'recipes'));
  assert(out && Array.isArray(out.tags), `story AC 2: expected { tags }, got ${show(out)}`);
  assert(show(out.tags) === show([...h.tags, ['b', addr(CUST_TA, 'recipes'), 'pointer']]),
    `story AC 2: every earlier tag then ['b', <own address>, 'pointer'] — got ${show(out.tags)}`);
  assert(JSON.stringify(h.tags) === before, 'ADR 0003: composeSelfDeclare must not mutate header.tags');
});

test('K2: Submit drops the keep-private marker and keeps every real b-tag', () => {
  const { composeSelfDeclare } = compose();
  const h = header(CUST_TA, 'recipes', [['b', SENTINEL], ['b', THEIRS, 'pointer']]);
  const out = composeSelfDeclare(h, addr(CUST_TA, 'recipes'));
  assert(out && Array.isArray(out.tags), `expected { tags }, got ${show(out)}`);
  assert(!out.tags.some((t) => t[0] === 'b' && t[1] === SENTINEL), `story AC 2: the marker is dropped — got ${show(out.tags)}`);
  assert(out.tags.some((t) => t[0] === 'b' && t[1] === THEIRS), 'story AC 2: the wiring is kept');
  assert(out.tags.some((t) => t[0] === 'b' && t[1] === addr(CUST_TA, 'recipes')), 'story AC 2: the self-pointing b is added');
});

test('K3: Submit on an already self-declared header is "already", whatever the b-tag type', () => {
  const { composeSelfDeclare } = compose();
  for (const type of [['pointer'], ['inherit'], []]) {
    const out = composeSelfDeclare(header(CUST_TA, 'r', [['b', addr(CUST_TA, 'r'), ...type]]), addr(CUST_TA, 'r'));
    assert(out && out.already === true && !out.tags, `story AC 2: already self-declared (type ${show(type)}) means nothing new — got ${show(out)}`);
  }
});

test('K4: Keep private on an undecided header adds the marker and keeps every earlier tag, without touching the input', () => {
  const { composeKeepPrivate } = compose();
  const h = header(CUST_TA, 'r');
  const before = JSON.stringify(h.tags);
  const out = composeKeepPrivate(h);
  assert(out && show(out.tags) === show([...h.tags, ['b', SENTINEL]]), `story AC 3: earlier tags then ['b', 'b-tag-deferred'] — got ${show(out)}`);
  assert(JSON.stringify(h.tags) === before, 'ADR 0003: composeKeepPrivate must not mutate header.tags');
});

test('K5: Keep private is refused once a real b-tag exists (address or event id); an unreadable b-tag is not real', () => {
  const { composeKeepPrivate } = compose();
  const sentence = 'this header already carries a real b — deferral applies only to unaffiliated headers';
  for (const b of [[THEIRS, 'pointer'], [AN_EVENT_ID], [addr(CUST_TA, 'r'), 'pointer']]) {
    const out = composeKeepPrivate(header(CUST_TA, 'r', [['b', ...b]]));
    assert(out && out.refused === sentence && !out.tags, `story AC 3: with b ${show(b)} Keep private is refused with the house sentence — got ${show(out)}`);
  }
  const unreadable = composeKeepPrivate(header(CUST_TA, 'r', [['b', 'not-a-coordinate']]));
  assert(unreadable && Array.isArray(unreadable.tags), `an unreadable b-tag is not a real one, so Keep private proceeds — got ${show(unreadable)}`);
});

test('K6: Keep private on an already private header is "already"', () => {
  const { composeKeepPrivate } = compose();
  const out = composeKeepPrivate(header(CUST_TA, 'r', [['b', SENTINEL]]));
  assert(out && out.already === true && !out.tags, `story AC 3: already private means nothing new — got ${show(out)}`);
});

test('K7: a new version is always strictly newer than the one it replaces', () => {
  const { nextCreatedAt } = compose();
  assert(nextCreatedAt(NOW - 100, NOW) === NOW, 'an older previous version: now');
  assert(nextCreatedAt(NOW, NOW) === NOW + 1, 'the same second: one more');
  assert(nextCreatedAt(NOW + 50, NOW) === NOW + 51, 'a previous version from the future: one more than it');
  assert(nextCreatedAt(undefined, NOW) === NOW, 'no previous timestamp: now');
});

// ── P — parity with Concept Headers' handlers ────────────────────────────────

const PARITY_CASES = [
  ['undecided', []],
  ['wired by address', [['b', THEIRS, 'pointer']]],
  ['wired by event id', [['b', AN_EVENT_ID]]],
  ['marker only', [['b', SENTINEL]]],
  ['marker and wired', [['b', SENTINEL], ['b', THEIRS, 'pointer']]],
  ['unreadable only', [['b', 'not-a-coordinate']]],
  ['wired to another target', [['b', ANOTHER, 'pointer']]],
  ['self-declared', 'SELF'],
  ['self-declared, inherit type', 'SELF_INHERIT'],
];

/** Run Concept Headers' real handlers in a child process with stand-in parts; return what they signed. */
function oldHandlerOutputs() {
  const script = `
    const path = require('path'); const ROOT = process.cwd();
    const cp = require('child_process');
    let current = null;
    cp.exec = (cmd, opts, cb) => { const done = typeof opts === 'function' ? opts : cb; setImmediate(() => done(null, current ? JSON.stringify(current) + '\\n' : '')); return { stdin: { write() {}, end() {} } }; };
    const stub = (r, exp) => { const p = require.resolve(path.join(ROOT, r)); require.cache[p] = { id: p, filename: p, loaded: true, exports: exp }; };
    const TA = '${OWNER_TA}';
    let signedTags = null;
    stub('src/api/normalize/helpers.js', { loadTAKey: async () => {}, signAndFinalize: (t) => { signedTags = t.tags; return { ...t, id: 'x', pubkey: TA, sig: 'y' }; }, publishToStrfry: async () => {}, importEventDirect: async () => {} });
    stub('src/utils/assistantKeys.js', { getOwnerAssistantPubkey: () => TA });
    stub('src/middleware/auth.js', { isOwner: () => true });
    const { handleConceptSelfDeclare } = require(path.join(ROOT, 'src/api/concept/selfDeclare.js'));
    const { handleBDefer, handleBAppend } = require(path.join(ROOT, 'src/api/concept/bDisposition.js'));
    const cases = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    (async () => {
      const out = [];
      for (const c of cases) {
        const row = {};
        for (const [name, fn] of [['self', handleConceptSelfDeclare], ['defer', handleBDefer], ['wire', handleBAppend]]) {
          current = c.header; signedTags = null;
          let body = null;
          const res = { status() { return res; }, json(b) { body = b; return res; } };
          await fn({ params: { handle: encodeURIComponent(c.handle) }, body: { target: c.target }, session: {} }, res);
          row[name] = { success: body && body.success, result: body && body.result, error: body && body.error, tags: signedTags };
        }
        out.push(row);
      }
      process.stdout.write(JSON.stringify(out));
    })().catch((e) => { process.stderr.write(String(e && e.stack || e)); process.exit(1); });
  `;
  const cases = PARITY_CASES.map(([, b]) => {
    const d = 'parity';
    const self = addr(OWNER_TA, d);
    const bTags = b === 'SELF' ? [['b', self, 'pointer']] : b === 'SELF_INHERIT' ? [['b', self, 'inherit']] : b;
    return { handle: self, header: header(OWNER_TA, d, bTags), target: THEIRS };
  });
  const r = cp.spawnSync(process.execPath, ['-e', script], { cwd: ROOT, input: JSON.stringify(cases), encoding: 'utf8', timeout: 30000 });
  assert(r.status === 0, `the parity harness could not run Concept Headers' handlers: ${(r.stderr || '').split('\n').slice(0, 3).join(' | ')}`);
  return { cases, outputs: JSON.parse(r.stdout) };
}

test('P1: Submit composes exactly what Concept Headers\' self-declare signs, case by case (ADR 0003 parity)', () => {
  const { composeSelfDeclare } = compose();
  const { cases, outputs } = oldHandlerOutputs();
  cases.forEach((c, i) => {
    const old = outputs[i].self;
    const neu = composeSelfDeclare(c.header, c.handle);
    const label = PARITY_CASES[i][0];
    if (old.result === 'already-declared') assert(neu && neu.already === true, `ADR 0003 parity (${label}): Concept Headers says already-declared; the shared module says ${show(neu)}`);
    else assert(neu && show(neu.tags) === show(old.tags), `ADR 0003 parity (${label}): Concept Headers signs ${show(old.tags)}; the shared module composes ${show(neu && neu.tags)}`);
  });
});

test('P2: Keep private composes exactly what Concept Headers\' b-defer signs or refuses, case by case (ADR 0003 parity)', () => {
  const { composeKeepPrivate } = compose();
  const { cases, outputs } = oldHandlerOutputs();
  cases.forEach((c, i) => {
    const old = outputs[i].defer;
    const neu = composeKeepPrivate(c.header);
    const label = PARITY_CASES[i][0];
    if (old.success === false) assert(neu && neu.refused === old.error, `ADR 0003 parity (${label}): Concept Headers refuses with ${show(old.error)}; the shared module says ${show(neu)}`);
    else if (old.result === 'already-deferred') assert(neu && neu.already === true, `ADR 0003 parity (${label}): Concept Headers says already-deferred; the shared module says ${show(neu)}`);
    else assert(neu && show(neu.tags) === show(old.tags), `ADR 0003 parity (${label}): Concept Headers signs ${show(old.tags)}; the shared module composes ${show(neu && neu.tags)}`);
  });
});

// ── H — the handler ─────────────────────────────────────────────────────────

const custHeader = (bTags = []) => header(CUST_TA, 'recipes', bTags);
const custHandle = addr(CUST_TA, 'recipes');
const asCustomer = { session: signedIn(CUST) };

test('H1: no signed-in session — 401, and nothing else happens (story AC 4)', async () => {
  for (const action of ['self-declare', 'b-defer']) {
    const { res, calls } = await run1(action, custHandle, {}, { headers: { [`${CUST_TA}:recipes`]: custHeader() } });
    assert(res.statusCode === 401, `story AC 4: ${action} without a session must answer 401, got ${res.statusCode}`);
    for (const n of ['getAssistantKeys', 'scanLatest', 'sign', 'publishLocal', 'importToGraph']) assert(called(calls, n).length === 0, `story AC 4: ${action} without a session must not reach ${n}`);
  }
});

test('H2: a call from inside the container with no session — 401 through the real sign-in check (book decision 2)', async () => {
  const { createMyAssistantDispositionHandler } = handlerMod();
  for (const action of ['self-declare', 'b-defer', 'b-append']) { // b-append: story 4
    const { d, calls } = deps({ realAuth: true, headers: { [`${OWNER_TA}:recipes`]: header(OWNER_TA, 'recipes') } });
    const res = response();
    await createMyAssistantDispositionHandler(action, d)(request(addr(OWNER_TA, 'recipes'), { localTrusted: true }), res);
    assert(res.statusCode === 401, `book decision 2: ${action} with req.localTrusted and no session must answer 401 (the default requireAuth), got ${res.statusCode} ${show(res.body)}`);
    assert(called(calls, 'sign').length === 0 && called(calls, 'getAssistantKeys').length === 0, `book decision 2: ${action} must not look up keys or sign for a no-session caller`);
  }
});

test('H3: signed in with no Assistant on this instance — 403, nothing scanned or signed (story AC 4)', async () => {
  const { res, calls } = await run1('self-declare', custHandle, { session: signedIn(GUEST) }, { headers: { [`${CUST_TA}:recipes`]: custHeader() } });
  assert(res.statusCode === 403 && res.body && res.body.success === false && /no Tapestry Assistant/i.test(res.body.error || ''),
    `story AC 4: no Assistant here means 403 "…no Tapestry Assistant…", got ${res.statusCode} ${show(res.body)}`);
  assert(called(calls, 'scanLatest').length === 0 && called(calls, 'sign').length === 0, 'story AC 4: nothing is scanned or signed');
});

test('H4: an unreadable handle or a kind-9998 handle — 400, nothing scanned or signed (story AC 4)', async () => {
  for (const handle of ['not-a-handle', `9998:${CUST_TA}:recipes`, `39998:short:recipes`]) {
    const { res, calls } = await run1('self-declare', handle, asCustomer);
    assert(res.statusCode === 400 && res.body && res.body.success === false, `story AC 4: ${show(handle)} must answer 400, got ${res.statusCode} ${show(res.body)}`);
    assert(called(calls, 'scanLatest').length === 0 && called(calls, 'sign').length === 0, `story AC 4: ${show(handle)} — nothing scanned or signed`);
  }
});

test('H5: a header not written by the caller\'s own Assistant — 403, nothing scanned or signed, for every role (story AC 4)', async () => {
  const cases = [
    ['a customer asking about the Owner\'s Assistant\'s header', signedIn(CUST), addr(OWNER_TA, 'x')],
    ['the Owner asking about a customer\'s Assistant\'s header', signedIn(OWNER), addr(CUST_TA, 'x')],
    ['an admin asking about the Owner\'s Assistant\'s header', signedIn(ADMIN), addr(OWNER_TA, 'x')],
    ['a customer asking about their own ACCOUNT\'s header', signedIn(CUST), addr(CUST, 'x')],
  ];
  for (const [label, session, handle] of cases) {
    for (const action of ['self-declare', 'b-defer']) {
      const all = { [`${OWNER_TA}:x`]: header(OWNER_TA, 'x'), [`${CUST_TA}:x`]: header(CUST_TA, 'x'), [`${CUST}:x`]: header(CUST, 'x') };
      const { res, calls } = await run1(action, handle, { session }, { headers: all });
      assert(res.statusCode === 403 && res.body && res.body.success === false && /your own Assistant/i.test(res.body.error || ''),
        `story AC 4: ${label} (${action}) must answer 403 "…your own Assistant…", got ${res.statusCode} ${show(res.body)}`);
      assert(called(calls, 'sign').length === 0 && called(calls, 'scanLatest').length === 0, `story AC 4: ${label} (${action}) — nothing scanned or signed`);
    }
  }
});

test('H6: the caller\'s own Assistant has no such header here — 404, nothing signed (story AC 4)', async () => {
  const { res, calls } = await run1('self-declare', custHandle, asCustomer, { headers: {} });
  assert(res.statusCode === 404 && res.body && res.body.success === false, `story AC 4: no such header means 404, got ${res.statusCode} ${show(res.body)}`);
  assert(called(calls, 'sign').length === 0, 'story AC 4: nothing signed');
});

test('H7: Submit signs with the CALLER\'s own Assistant, newer than before, saves to the relay then the graph, and answers "declared" (story AC 2)', async () => {
  const h = custHeader([['b', SENTINEL]]);
  const { res, calls } = await run1('self-declare', custHandle, asCustomer, { headers: { [`${CUST_TA}:recipes`]: h } });
  const scans = called(calls, 'scanLatest');
  assert(scans.length === 1 && show(scans[0][1]) === show({ kinds: [39998], authors: [CUST_TA], '#d': ['recipes'] }),
    `ADR 0003: the latest header is read by the caller's own Assistant's pubkey — got ${show(scans.map((s) => s[1]))}`);
  const signs = called(calls, 'sign');
  assert(signs.length === 1, `story AC 2: exactly one signature, got ${signs.length}`);
  const [, template, sk] = signs[0];
  assert(sk === SK[CUST_TA], 'story AC 2 / AC 4: the customer\'s OWN Assistant\'s key signs — never another\'s');
  assert(template.kind === 39998 && template.content === h.content, `story AC 2: same kind and content — got ${show({ kind: template.kind, content: template.content })}`);
  assert(template.created_at > h.created_at, 'story AC 2: the new version is strictly newer than the one it replaces');
  assert(!template.tags.some((t) => t[0] === 'b' && t[1] === SENTINEL) && template.tags.some((t) => t[0] === 'b' && t[1] === custHandle),
    `story AC 2: the marker dropped, the self-pointing b added — got ${show(template.tags)}`);
  const order = calls.map((c) => c[0]).filter((n) => ['sign', 'publishLocal', 'importToGraph'].includes(n));
  assert(show(order) === show(['sign', 'publishLocal', 'importToGraph']), `story AC 2: sign, then the relay, then the graph — got ${show(order)}`);
  const imp = called(calls, 'importToGraph')[0];
  assert(imp[2] === custHandle, `story AC 2: imported into the graph under the header's own address, got ${show(imp[2])}`);
  assert(res.statusCode === 200 && res.body && res.body.success === true && res.body.result === 'declared' && res.body.event && res.body.event.pubkey === CUST_TA,
    `story AC 2: 200 { success, result: 'declared', event signed by the customer's Assistant } — got ${res.statusCode} ${show(res.body)}`);
  noLeak(res, 'H7');
});

test('H8: Submit on an already self-declared header signs and saves nothing, and answers "already-declared" with the existing event (story AC 2)', async () => {
  const h = custHeader([['b', custHandle, 'pointer']]);
  const { res, calls } = await run1('self-declare', custHandle, asCustomer, { headers: { [`${CUST_TA}:recipes`]: h } });
  for (const n of ['sign', 'publishLocal', 'importToGraph']) assert(called(calls, n).length === 0, `story AC 2: already self-declared must not reach ${n}`);
  assert(res.body && res.body.success === true && res.body.result === 'already-declared' && res.body.event && res.body.event.id === h.id,
    `story AC 2: { result: 'already-declared', event: <the existing header> } — got ${show(res.body)}`);
});

test('H9: Keep private — deferred on an undecided header; refused (200, success:false) beside a real b; already-deferred when private (story AC 3)', async () => {
  let r = await run1('b-defer', custHandle, asCustomer, { headers: { [`${CUST_TA}:recipes`]: custHeader() } });
  assert(r.res.body && r.res.body.result === 'deferred' && called(r.calls, 'sign').length === 1 && called(r.calls, 'sign')[0][2] === SK[CUST_TA],
    `story AC 3: undecided → 'deferred', signed by the customer's own Assistant — got ${show(r.res.body)}`);
  assert(called(r.calls, 'sign')[0][1].tags.some((t) => t[0] === 'b' && t[1] === SENTINEL), 'story AC 3: the marker is added');

  r = await run1('b-defer', custHandle, asCustomer, { headers: { [`${CUST_TA}:recipes`]: custHeader([['b', THEIRS, 'pointer']]) } });
  assert(r.res.statusCode === 200 && r.res.body && r.res.body.success === false && /already carries a real b/.test(r.res.body.error || ''),
    `story AC 3: beside a real b, Keep private is a domain refusal (200, success:false) — got ${r.res.statusCode} ${show(r.res.body)}`);
  assert(called(r.calls, 'sign').length === 0, 'story AC 3: nothing signed beside a real b');

  r = await run1('b-defer', custHandle, asCustomer, { headers: { [`${CUST_TA}:recipes`]: custHeader([['b', SENTINEL]]) } });
  assert(r.res.body && r.res.body.result === 'already-deferred' && called(r.calls, 'sign').length === 0,
    `story AC 3: already private → 'already-deferred', nothing signed — got ${show(r.res.body)}`);
});

test('H10: the Owner and an admin each sign with their OWN Assistant — whatever the account-to-Assistant mapping returns, nothing else (story AC 4)', async () => {
  for (const [who, account, ta] of [['the Owner', OWNER, OWNER_TA], ['an admin', ADMIN, ADMIN_TA]]) {
    const handle = addr(ta, 'x');
    const { res, calls } = await run1('self-declare', handle, { session: signedIn(account) }, { headers: { [`${ta}:x`]: header(ta, 'x') } });
    const sk = (called(calls, 'sign')[0] || [])[2];
    assert(sk === SK[ta], `story AC 4: ${who} signs with their own Assistant's key, got ${sk ? 'another key' : 'no signature'}`);
    assert(show(called(calls, 'getAssistantKeys').map((c) => c[1])) === show([account]), `ADR 0003: keys come from the session's account only, got ${show(called(calls, 'getAssistantKeys').map((c) => c[1]))}`);
    noLeak(res, `H10 (${who})`);
  }
});

test('H11: a failed save answers 500 without key material, and the graph isn\'t touched (ADR 0003)', async () => {
  const { res, calls } = await run1('self-declare', custHandle, asCustomer, { headers: { [`${CUST_TA}:recipes`]: custHeader() }, publishThrows: true });
  assert(res.statusCode === 500 && res.body && res.body.success === false, `ADR 0003: a failed relay save answers 500, got ${res.statusCode} ${show(res.body)}`);
  assert(called(calls, 'importToGraph').length === 0, 'ADR 0003: nothing is imported into the graph after a failed relay save');
  noLeak(res, 'H11');
});

test('H12: no answer on any path carries an Assistant\'s private key (ADR 0003)', async () => {
  const paths = [
    ['self-declare', custHandle, asCustomer, { headers: { [`${CUST_TA}:recipes`]: custHeader() } }],
    ['b-defer', custHandle, asCustomer, { headers: { [`${CUST_TA}:recipes`]: custHeader() } }],
    ['b-defer', custHandle, asCustomer, { headers: { [`${CUST_TA}:recipes`]: custHeader([['b', THEIRS]]) } }],
    ['self-declare', addr(OWNER_TA, 'x'), asCustomer, {}],
    ['self-declare', custHandle, asCustomer, {}],
  ];
  for (const [action, handle, opts, depOpts] of paths) noLeak((await run1(action, handle, opts, depOpts)).res, `H12 ${action} ${handle.slice(0, 12)}…`);
});

// ── story 4 — Wire (ADR 0004) ───────────────────────────────────────────────

const WIRE = (target) => ({ ...asCustomerWire, body: { target } });
const asCustomerWire = { session: signedIn(CUST) };

test('W1: Wire adds a pointer b to the target after every earlier tag, without touching the input (story 4 AC 2)', () => {
  const { composeWire } = compose();
  assert(typeof composeWire === 'function', 'ADR 0004: headerDispositionCompose.js must export composeWire');
  const h = header(CUST_TA, 'recipes');
  const before = JSON.stringify(h.tags);
  const out = composeWire(h, addr(CUST_TA, 'recipes'), THEIRS);
  assert(out && show(out.tags) === show([...h.tags, ['b', THEIRS, 'pointer']]), `story 4 AC 2: earlier tags then ['b', <target>, 'pointer'] — got ${show(out)}`);
  assert(JSON.stringify(h.tags) === before, 'ADR 0004: composeWire must not mutate header.tags');
});

test('W2: Wire drops the keep-private marker and keeps every real b — a second target is added beside the first (story 4 AC 2)', () => {
  const { composeWire } = compose();
  const out = composeWire(header(CUST_TA, 'r', [['b', SENTINEL], ['b', ANOTHER, 'pointer'], ['b', addr(CUST_TA, 'r'), 'pointer']]), addr(CUST_TA, 'r'), THEIRS);
  assert(out && Array.isArray(out.tags), `expected { tags }, got ${show(out)}`);
  const bs = out.tags.filter((t) => t[0] === 'b').map((t) => t[1]);
  assert(!bs.includes(SENTINEL), `story 4 AC 2: the marker is dropped — got ${show(bs)}`);
  assert(bs.includes(ANOTHER) && bs.includes(addr(CUST_TA, 'r')) && bs.includes(THEIRS), `story 4 AC 2: the earlier wiring and the self-declaration stay, and the new target is added — got ${show(bs)}`);
});

test('W3: Wire to a target already wired, whatever the b type, is "already" (story 4 AC 3)', () => {
  const { composeWire } = compose();
  for (const type of [['pointer'], ['inherit'], []]) {
    const out = composeWire(header(CUST_TA, 'r', [['b', THEIRS, ...type]]), addr(CUST_TA, 'r'), THEIRS);
    assert(out && out.already === true && !out.tags, `story 4 AC 3: already wired (type ${show(type)}) means nothing new — got ${show(out)}`);
  }
});

test('W4: Wire to the header\'s own address is refused by the composition too (ADR 0004 guard)', () => {
  const { composeWire } = compose();
  const out = composeWire(header(CUST_TA, 'r'), addr(CUST_TA, 'r'), addr(CUST_TA, 'r'));
  assert(out && out.refused && !out.tags, `ADR 0004: the own address is never composed into a wiring — got ${show(out)}`);
});

test('P3: Wire composes exactly what Concept Headers\' b-append signs, case by case (ADR 0004 parity)', () => {
  const { composeWire } = compose();
  const { cases, outputs } = oldHandlerOutputs();
  cases.forEach((c, i) => {
    const old = outputs[i].wire;
    const neu = composeWire(c.header, c.handle, c.target);
    const label = PARITY_CASES[i][0];
    if (old.result === 'already-wired') assert(neu && neu.already === true, `ADR 0004 parity (${label}): Concept Headers says already-wired; the shared module says ${show(neu)}`);
    else assert(neu && show(neu.tags) === show(old.tags), `ADR 0004 parity (${label}): Concept Headers signs ${show(old.tags)}; the shared module composes ${show(neu && neu.tags)}`);
  });
});

test('HW1: Wire keeps every story-3 refusal — another site, no session, no Assistant, a bad handle, kind 9998, another Assistant\'s header, a missing or unverifiable header (story 4 AC 5)', async () => {
  const found = { [`${CUST_TA}:recipes`]: custHeader() };
  const cases = [
    ['another site', custHandle, { ...WIRE(THEIRS), origin: 'https://evil.example' }, { headers: found }, 403],
    ['no session', custHandle, { body: { target: THEIRS } }, { headers: found }, 401],
    ['no Assistant here', custHandle, { session: signedIn(GUEST), body: { target: THEIRS } }, { headers: found }, 403],
    ['a bad handle', 'not-a-handle', WIRE(THEIRS), { headers: found }, 400],
    ['kind 9998', `9998:${CUST_TA}:recipes`, WIRE(THEIRS), { headers: found }, 400],
    ['the Owner\'s Assistant\'s header', addr(OWNER_TA, 'x'), WIRE(THEIRS), { headers: { [`${OWNER_TA}:x`]: header(OWNER_TA, 'x') } }, 403],
    ['a missing header', custHandle, WIRE(THEIRS), { headers: {} }, 404],
    ['an unverifiable header', custHandle, WIRE(THEIRS), { headers: found, verify: () => false }, 409],
  ];
  for (const [label, handle, opts, depOpts, status] of cases) {
    const { res, calls } = await run1('b-append', handle, opts, depOpts);
    assert(res.statusCode === status && res.body && res.body.success === false, `story 4 AC 5: ${label} must answer ${status}, got ${res.statusCode} ${show(res.body)}`);
    for (const n of ['sign', 'publishLocal', 'importToGraph']) assert(called(calls, n).length === 0, `story 4 AC 5: ${label} must not reach ${n}`);
    noLeak(res, `HW1 ${label}`);
  }
});

test('HW2: a target that isn\'t a header address, or is the header\'s own, is refused (400) before the relay is read (story 4 AC 4, ADR 0004 step 4b)', async () => {
  const found = { [`${CUST_TA}:recipes`]: custHeader() };
  for (const target of ['not-an-address', '', '   ', '39998:short:x', AN_EVENT_ID, undefined]) {
    const { res, calls } = await run1('b-append', custHandle, { ...asCustomerWire, body: target === undefined ? {} : { target } }, { headers: found });
    assert(res.statusCode === 400 && res.body && /list header['’]s address/i.test(res.body.error || ''), `story 4 AC 4 / Amendment 1: target ${show(target)} must answer 400 "…list header's address…", got ${res.statusCode} ${show(res.body)}`);
    assert(called(calls, 'scanLatest').length === 0 && called(calls, 'sign').length === 0, `ADR 0004: target ${show(target)} is refused before the relay is read`);
  }
  const own = await run1('b-append', custHandle, WIRE(custHandle), { headers: found });
  assert(own.res.statusCode === 400 && /own address/i.test(own.res.body.error || '') && /Submit as a Shared Concept/.test(own.res.body.error || ''),
    `story 4 AC 4: the header's own address must answer 400, pointing to Submit as a Shared Concept — got ${own.res.statusCode} ${show(own.res.body)}`);
  assert(called(own.calls, 'scanLatest').length === 0, 'ADR 0004: the own address is refused before the relay is read');
});

test('HW3: Wire signs with the CALLER\'s own Assistant, drops the marker, adds the pointer b, saves to the relay then the graph, answers "wired" (story 4 AC 2)', async () => {
  const h = custHeader([['b', SENTINEL]]);
  const { res, calls } = await run1('b-append', custHandle, WIRE(`  ${THEIRS}  `), { headers: { [`${CUST_TA}:recipes`]: h } });
  const signs = called(calls, 'sign');
  assert(signs.length === 1 && signs[0][2] === SK[CUST_TA], 'story 4 AC 2: exactly one signature, by the customer\'s OWN Assistant');
  const tags = signs[0][1].tags;
  assert(!tags.some((t) => t[0] === 'b' && t[1] === SENTINEL) && tags.some((t) => t[0] === 'b' && t[1] === THEIRS && t[2] === 'pointer'),
    `story 4 AC 2: the marker dropped, ['b', <trimmed target>, 'pointer'] added — got ${show(tags)}`);
  const order = calls.map((c) => c[0]).filter((n) => ['verify', 'sign', 'publishLocal', 'importToGraph'].includes(n));
  assert(show(order) === show(['verify', 'sign', 'publishLocal', 'importToGraph']), `story 4 AC 2 / Amendment 1: verify, sign, relay, graph — got ${show(order)}`);
  assert(res.body && res.body.success === true && res.body.result === 'wired' && res.body.event && res.body.event.pubkey === CUST_TA, `story 4 AC 2: { result: 'wired' } — got ${show(res.body)}`);
  noLeak(res, 'HW3');
});

test('HW4: already wired to that target — nothing signed, the existing event answered "already-wired"; an unverifiable header is still refused first (story 4 AC 3)', async () => {
  const h = custHeader([['b', THEIRS, 'pointer']]);
  let r = await run1('b-append', custHandle, WIRE(THEIRS), { headers: { [`${CUST_TA}:recipes`]: h } });
  assert(r.res.body && r.res.body.result === 'already-wired' && r.res.body.event && r.res.body.event.id === h.id && called(r.calls, 'sign').length === 0,
    `story 4 AC 3: { result: 'already-wired', event: <existing> }, nothing signed — got ${show(r.res.body)}`);
  r = await run1('b-append', custHandle, WIRE(THEIRS), { headers: { [`${CUST_TA}:recipes`]: h }, verify: () => false });
  assert(r.res.statusCode === 409, `Amendment 1 §1: an unverifiable already-wired header is refused, not answered "already-wired" — got ${r.res.statusCode} ${show(r.res.body)}`);
});

test('HW5: a second target is added beside the first — both kept (story 4 AC 2)', async () => {
  const h = custHeader([['b', ANOTHER, 'pointer']]);
  const { res, calls } = await run1('b-append', custHandle, WIRE(THEIRS), { headers: { [`${CUST_TA}:recipes`]: h } });
  const tags = (called(calls, 'sign')[0] || [])[1];
  const bs = tags ? tags.tags.filter((t) => t[0] === 'b').map((t) => t[1]) : [];
  assert(res.body && res.body.result === 'wired' && bs.includes(ANOTHER) && bs.includes(THEIRS), `story 4 AC 2: both wirings kept — got ${show(bs)} ${show(res.body)}`);
});

test('HW6: the two story-3 actions ignore a body — a target sent to Submit or Keep private changes nothing (ADR 0004)', async () => {
  const h = custHeader();
  const r = await run1('self-declare', custHandle, WIRE(THEIRS), { headers: { [`${CUST_TA}:recipes`]: h } });
  const tags = (called(r.calls, 'sign')[0] || [])[1];
  assert(r.res.body && r.res.body.result === 'declared' && tags && !tags.tags.some((t) => t[0] === 'b' && t[1] === THEIRS),
    `ADR 0004: Submit with a target in the body still only self-declares — got ${show(tags && tags.tags)}`);
});

// ── story 4 review round 1 (ADR 0004 Amendment 1) ───────────────────────────

const LIST_HEADER = /list header['’]s address/i;
const found = () => ({ [`${CUST_TA}:recipes`]: custHeader() });
async function refusedBeforeLookup(target, sentence, label) {
  const { res, calls } = await run1('b-append', custHandle, { ...asCustomerWire, body: target === undefined ? {} : { target } }, { headers: found() });
  assert(res.statusCode === 400 && res.body && res.body.success === false && sentence.test(res.body.error || ''),
    `Amendment 1: ${label} must answer 400 matching ${sentence}, got ${res.statusCode} ${show(res.body)}`);
  assert(called(calls, 'scanLatest').length === 0 && called(calls, 'sign').length === 0, `Amendment 1: ${label} is refused before the relay is read`);
}

test('W5: composeWire\'s own-address guard is a sentence that names Submit, not a bare code (ADR 0004 Amendment 1)', () => {
  const { composeWire } = compose();
  const out = composeWire(header(CUST_TA, 'r'), addr(CUST_TA, 'r'), addr(CUST_TA, 'r'));
  assert(out && typeof out.refused === 'string' && /Submit as a Shared Concept/.test(out.refused), `Amendment 1: the guard says to use Submit — got ${show(out)}`);
});

test('HW7: a target that isn\'t a string is refused (400) before the lookup — numbers, arrays, objects with a toString, null, a missing body (Amendment 1 §1)', async () => {
  for (const [label, target] of [['a number', 39998], ['an array', [THEIRS]], ['an object with a toString', { toString: () => THEIRS }], ['null', null], ['a missing body', undefined]]) {
    await refusedBeforeLookup(target, LIST_HEADER, label);
  }
});

test('HW8: a target with a control or format character is refused (400) before the lookup — NUL, ESC, TAB, an RTL override, a zero-width space (Amendment 1 §1)', async () => {
  const sentence = /characters an address can['’]t have/i;
  for (const [label, code] of [['NUL', 0], ['ESC', 27], ['TAB', 9], ['RTL override', 0x202e], ['zero-width space', 0x200b]]) {
    const target = `39998:${'9'.repeat(64)}:some${String.fromCharCode(code)}concept`;
    await refusedBeforeLookup(target, sentence, `a target with ${label}`);
  }
});

test('HW9: the target is at most 1024 UTF-8 bytes — bytes, not characters (Amendment 1 §1)', async () => {
  const prefix = `39998:${'9'.repeat(64)}:`; // 71 bytes
  const exactly = prefix + 'x'.repeat(1024 - prefix.length);
  const { res } = await run1('b-append', custHandle, WIRE(exactly), { headers: found() });
  assert(res.statusCode === 200 && res.body && res.body.result === 'wired', `Amendment 1: exactly 1024 bytes passes the size check, got ${res.statusCode} ${show(res.body)}`);
  const tooLong = /too long/i;
  await refusedBeforeLookup(prefix + 'x'.repeat(1025 - prefix.length), tooLong, '1025 bytes');
  const multibyte = prefix + 'é'.repeat(477); // 548 characters, 1025 bytes
  assert(multibyte.length < 1024 && Buffer.byteLength(multibyte, 'utf8') === 1025, 'fixture: fewer than 1024 characters but 1025 bytes');
  await refusedBeforeLookup(multibyte, tooLong, '548 characters that are 1025 bytes');
});

test('HW10: only a list header\'s address — the literal kind 39998 — can be wired (Amendment 1 §2, owner decision)', async () => {
  for (const [label, target] of [
    ['kind 1', `1:${'9'.repeat(64)}:x`],
    ['kind 39999', `39999:${'9'.repeat(64)}:x`],
    ['a leading zero', `039998:${'9'.repeat(64)}:x`],
    ['kind 9998', `9998:${'9'.repeat(64)}:x`],
  ]) {
    await refusedBeforeLookup(target, LIST_HEADER, label);
  }
});

test('HW11: the own-address check compares pubkey and d-tag — padded or not (Amendment 1 §3)', async () => {
  for (const target of [custHandle, `  ${custHandle}  `]) {
    await refusedBeforeLookup(target, /own address[\s\S]*Submit as a Shared Concept/, `the own address ${show(target)}`);
  }
});

test('HW12: every action reads the new version back from the relay before writing the graph — not kept or a failed read is 502 with the graph untouched (Amendment 1 §4)', async () => {
  const cases = [
    ['self-declare', asCustomer],
    ['b-defer', asCustomer],
    ['b-append', WIRE(THEIRS)],
  ];
  for (const [action, opts] of cases) {
    let r = await run1(action, custHandle, opts, { headers: found() });
    const order = r.calls.map((c) => c[0]).filter((n) => ['sign', 'publishLocal', 'isStored', 'importToGraph'].includes(n));
    assert(show(order) === show(['sign', 'publishLocal', 'isStored', 'importToGraph']), `Amendment 1 §4 (${action}): sign, relay, read back, graph — got ${show(order)}`);
    const signedId = called(r.calls, 'sign').length ? r.res.body.event.id : null;
    assert(called(r.calls, 'isStored')[0][1] === signedId, `Amendment 1 §4 (${action}): the read-back asks for the signed event's id`);

    r = await run1(action, custHandle, opts, { headers: found(), stored: false });
    assert(r.res.statusCode === 502 && r.res.body && r.res.body.success === false && /didn['’]t keep/i.test(r.res.body.error || ''),
      `Amendment 1 §4 (${action}): not kept must answer 502 "…didn't keep…", got ${r.res.statusCode} ${show(r.res.body)}`);
    assert(called(r.calls, 'importToGraph').length === 0, `Amendment 1 §4 (${action}): not kept — the graph is not touched`);
    noLeak(r.res, `HW12 ${action} not kept`);

    r = await run1(action, custHandle, opts, { headers: found(), stored: 'throws' });
    assert(r.res.statusCode === 502 && r.res.body && /couldn['’]t confirm/i.test(r.res.body.error || ''),
      `Amendment 1 §4 (${action}): a failed read-back must answer 502 "…couldn't confirm…", got ${r.res.statusCode} ${show(r.res.body)}`);
    assert(called(r.calls, 'importToGraph').length === 0, `Amendment 1 §4 (${action}): a failed read-back — the graph is not touched`);
  }
});

// ── review round 1 (ADR 0003 Amendment 1) ───────────────────────────────────

test('H13: a request from another site is refused first — 403 before the sign-in check, nothing else happens; same-host and no-Origin requests go on (Amendment 1 §2)', async () => {
  const h = { [`${CUST_TA}:recipes`]: custHeader() };
  for (const action of ['self-declare', 'b-defer']) {
    const { res, calls } = await run1(action, custHandle, { ...asCustomer, origin: 'https://evil.example' }, { headers: h });
    assert(res.statusCode === 403 && res.body && res.body.success === false && /another site/i.test(res.body.error || ''),
      `Amendment 1 §2: a foreign Origin (${action}) must answer 403 "…another site…", got ${res.statusCode} ${show(res.body)}`);
    assert(calls.length === 0, `Amendment 1 §2: a foreign Origin (${action}) must be refused before requireAuth or anything else — got ${show(calls.map((c) => c[0]))}`);
  }
  for (const [label, origin] of [['same host', 'http://localhost:7778'], ['same host, other port', 'http://localhost:5173'], ['no Origin', undefined]]) {
    const { res } = await run1('self-declare', custHandle, { ...asCustomer, origin }, { headers: { [`${CUST_TA}:recipes`]: custHeader() } });
    assert(res.statusCode === 200 && res.body && res.body.result === 'declared', `Amendment 1 §2: ${label} goes on to the other checks, got ${res.statusCode} ${show(res.body)}`);
  }
});

test('H14: the relay\'s latest header must verify — signature, author, kind and first d — before anything is signed, saved, or answered "already" (Amendment 1 §1)', async () => {
  const sentence = /couldn['’]t be verified as your Assistant['’]s, so nothing was signed/;
  const cases = [
    ['a forged signature', custHeader(), () => false],
    ['another author', { ...custHeader(), pubkey: OWNER_TA }, () => true],
    ['kind 9998', { ...custHeader(), kind: 9998 }, () => true],
    ['a first d tag that is not the URL\'s', { ...custHeader(), tags: [['d', 'other'], ['d', 'recipes'], ['names', 'thing', 'things']] }, () => true],
    ['an already self-declared header with a forged signature', custHeader([['b', custHandle, 'pointer']]), () => false],
    ['an already private header with a forged signature', custHeader([['b', SENTINEL]]), () => false],
  ];
  for (const [label, found, verify] of cases) {
    for (const action of ['self-declare', 'b-defer']) {
      const { res, calls } = await run1(action, custHandle, asCustomer, { headers: { [`${CUST_TA}:recipes`]: found }, verify });
      assert(res.statusCode === 409 && res.body && res.body.success === false && sentence.test(res.body.error || ''),
        `Amendment 1 §1: ${label} (${action}) must answer 409 "…couldn't be verified as your Assistant's, so nothing was signed", got ${res.statusCode} ${show(res.body)}`);
      for (const n of ['sign', 'publishLocal', 'importToGraph']) assert(called(calls, n).length === 0, `Amendment 1 §1: ${label} (${action}) must not reach ${n}`);
      noLeak(res, `H14 ${label}`);
    }
  }
  // And a sound header is checked once, with the header itself.
  const sound = custHeader();
  const { res, calls } = await run1('self-declare', custHandle, asCustomer, { headers: { [`${CUST_TA}:recipes`]: sound } });
  const v = called(calls, 'verify');
  assert(res.body && res.body.result === 'declared' && v.length === 1 && v[0][1] === sound, `Amendment 1 §1: a sound header is verified once, then signed — got ${show(res.body)}, verify calls ${v.length}`);
});

test('H15: the handle is used exactly as Express decoded it — no second decode (Amendment 1 §3)', async () => {
  const d1 = 'a%41';
  const h1 = header(CUST_TA, d1);
  let r = await run1('self-declare', addr(CUST_TA, d1), asCustomer, { headers: { [`${CUST_TA}:${d1}`]: h1 } });
  const scan = called(r.calls, 'scanLatest')[0];
  assert(scan && show(scan[1]['#d']) === show([d1]), `Amendment 1 §3: a d-tag of "a%41" is looked up as "a%41", not "aA" — got ${show(scan && scan[1]['#d'])}`);
  assert(r.res.body && r.res.body.result === 'declared', `Amendment 1 §3: and that header is the one signed — got ${show(r.res.body)}`);
  r = await run1('self-declare', addr(CUST_TA, '50%'), asCustomer, { headers: {} });
  assert(r.res.statusCode === 404, `Amendment 1 §3: a lone % in the d-tag is just a character — 404 for a missing header, never a 500 — got ${r.res.statusCode} ${show(r.res.body)}`);
});

test('S5: the module carries the same-host check, calls it before requireAuth, and never decodes the handle again (Amendment 1)', () => {
  let src = '';
  try { src = code(fs.readFileSync(HANDLER, 'utf8')); } catch { throw new Error(`${rel(HANDLER)} must exist`); }
  assert(/function\s+sameHost\s*\(\s*req\s*\)/.test(src), 'Amendment 1 §2: the module defines sameHost(req), copied from dlist-curation/update.js');
  // Within the handler factory's body: the default deps above it also mention requireAuth.
  const start = src.search(/function\s+createMyAssistantDispositionHandler\s*\(/);
  const body = start >= 0 ? src.slice(start) : '';
  const sh = body.search(/\bsameHost\s*\(\s*req\s*\)/);
  const ra = body.search(/\brequireAuth\s*\(\s*req\b/);
  assert(sh >= 0 && ra >= 0 && sh < ra, 'Amendment 1 §2: inside the handler, sameHost(req) is called before requireAuth(req, …)');
  assert(!/\bdecodeURIComponent\b/.test(src), 'Amendment 1 §3: no decodeURIComponent anywhere in the module');
  assert(/verifyEvent\s*\(\s*JSON\.parse\s*\(\s*JSON\.stringify\s*\(/.test(src), 'Amendment 1 §1: the default verifier checks a JSON round-trip with verifyEvent');
});

// ── S — structure ───────────────────────────────────────────────────────────

test('S1: the handler module never mentions the old bypasses: owner/admin checks, loopback trust, or the Owner-only key helpers (ADR 0003)', () => {
  let src = '';
  try { src = code(fs.readFileSync(HANDLER, 'utf8')); } catch { throw new Error(`${rel(HANDLER)} must exist`); }
  for (const forbidden of ['isOwner', 'isOwnerOrAdmin', 'localTrusted', 'loadTAKey', 'signAndFinalize', 'getOwnerAssistantKeys', 'getOwnerAssistantPubkey']) {
    assert(!new RegExp(`\\b${forbidden}\\b`).test(src), `ADR 0003: ${rel(HANDLER)} must not reference ${forbidden}`);
  }
});

test('S2: the latest header is read without a shell — strfryScanStream, not strfryScan (ADR 0003)', () => {
  let src = '';
  try { src = code(fs.readFileSync(HANDLER, 'utf8')); } catch { throw new Error(`${rel(HANDLER)} must exist`); }
  assert(/\bstrfryScanStream\b/.test(src), 'ADR 0003: the default scanLatest uses strfryScanStream');
  assert(!/\bstrfryScan\b(?!Stream)/.test(src) && !/\bexec\s*\(/.test(src), 'ADR 0003: no shell-quoted strfryScan and no exec in the handler module');
});

test('S3: register(app) mounts exactly the three POST routes (story 4 added b-append)', () => {
  const { register } = handlerMod();
  assert(typeof register === 'function', 'ADR 0003: register(app) must be exported');
  const mounted = [];
  const app = { post: (p, h) => mounted.push(['post', p, typeof h]), get: (p) => mounted.push(['get', p]), put: (p) => mounted.push(['put', p]), delete: (p) => mounted.push(['delete', p]), use: () => {} };
  register(app);
  const want = [
    ['post', '/api/list-headers/my-assistant/:handle/self-declare', 'function'],
    ['post', '/api/list-headers/my-assistant/:handle/b-defer', 'function'],
    ['post', '/api/list-headers/my-assistant/:handle/b-append', 'function'],
  ];
  assert(show(mounted.sort()) === show(want.sort()), `ADR 0003: register mounts ${show(want)}, got ${show(mounted)}`);
});

test('S4: the API index registers the new routes beside the others (ADR 0003)', () => {
  const src = code(fs.readFileSync(API_INDEX, 'utf8'));
  const direct = /require\(\s*['"]\.\/list-headers\/myAssistantDisposition['"]\s*\)\s*\.register\(\s*app\s*\)/.test(src);
  const viaBinding = /(\w+)\s*=\s*require\(\s*['"]\.\/list-headers\/myAssistantDisposition['"]\s*\)[\s\S]*?\b\1\.register\(\s*app\s*\)/.test(src);
  assert(direct || viaBinding, "ADR 0003: src/api/index.js must call require('./list-headers/myAssistantDisposition').register(app)");
});

// ── U — whose row is this ───────────────────────────────────────────────────

test('U1: authorRole names "me", "my-assistant", or nothing — with no fallback to anyone else\'s Assistant (ADR 0003, ADR 0001)', async () => {
  let m;
  try { m = await import(pathToFileURL(SCOPE_JS).href); } catch (err) { throw new Error(`${rel(SCOPE_JS)} must load: ${err.message}`); }
  assert(typeof m.authorRole === 'function', 'ADR 0003: viewerAuthorScope.js must export authorRole');
  const u = { pubkey: CUST, assistantPubkey: CUST_TA };
  assert(m.authorRole(CUST, u) === 'me', `the account's own pubkey is 'me', got ${show(m.authorRole(CUST, u))}`);
  assert(m.authorRole(CUST_TA, u) === 'my-assistant', `the account's Assistant is 'my-assistant', got ${show(m.authorRole(CUST_TA, u))}`);
  assert(m.authorRole(OWNER_TA, u) === null, `someone else's Assistant is nobody's here, got ${show(m.authorRole(OWNER_TA, u))}`);
  const noTa = { pubkey: CUST, assistantPubkey: null };
  assert(m.authorRole(OWNER_TA, noTa) === null && m.authorRole(null, noTa) === null, 'ADR 0003: no Assistant means no "my-assistant" row — never a fallback');
  assert(m.authorRole(CUST, null) === null && m.authorRole(CUST_TA, undefined) === null, 'signed out, no row is anyone\'s');
});

// ── R — what must not change ────────────────────────────────────────────────

test('R1: Concept Headers keeps its own gate and signer in this book (story AC 4)', () => {
  const self = code(fs.readFileSync(SELF_DECLARE, 'utf8'));
  const bdis = code(fs.readFileSync(B_DISPOSITION, 'utf8'));
  assert(/!isOwner\(req\)\s*&&\s*!req\.localTrusted/.test(self) && /loadTAKey\(\)/.test(self), 'story AC 4: selfDeclare.js keeps its owner-or-loopback gate and the Owner\'s Assistant signer');
  assert(/isOwner\(req\)\s*\|\|\s*req\.localTrusted/.test(bdis) && /loadTAKey\(\)/.test(bdis), 'story AC 4: bDisposition.js keeps its owner-or-loopback gate and the Owner\'s Assistant signer');
});

// ── L — live refusals (skipped without the local stack) ─────────────────────

let liveExecuted = 0;
let liveSkipped = 0;

async function stackTa() {
  try {
    const r = await fetch(`${HOST_BASE}/api/assistant/pubkey`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    return j && j.success && /^[0-9a-f]{64}$/.test(j.pubkey) ? j.pubkey : null;
  } catch { return null; }
}
function dockerOk() {
  try { cp.execFileSync('docker', ['exec', CONTAINER, 'true'], { timeout: 10000, stdio: 'ignore' }); return true; } catch { return false; }
}
async function latestId(author, d) {
  const filter = encodeURIComponent(JSON.stringify({ kinds: [39998], authors: [author], '#d': [d] }));
  const j = await (await fetch(`${HOST_BASE}/api/strfry/scan?filter=${filter}`, { signal: AbortSignal.timeout(15000) })).json();
  const evs = (j && j.events) || [];
  const newest = evs.reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);
  return newest ? newest.id : null;
}
async function someTaHeaderD(ta) {
  const filter = encodeURIComponent(JSON.stringify({ kinds: [39998], authors: [ta], limit: 1 }));
  const j = await (await fetch(`${HOST_BASE}/api/strfry/scan?filter=${filter}`, { signal: AbortSignal.timeout(15000) })).json();
  const ev = ((j && j.events) || [])[0];
  return ev ? (ev.tags.find((t) => t[0] === 'd') || [])[1] : null;
}

test('L1 (live): a no-session call from inside the container gets 401, and the header is unchanged (book decision 2)', async () => {
  const ta = await stackTa();
  if (!ta || !dockerOk()) { liveSkipped++; return 'SKIP'; }
  liveExecuted++;
  const d = await someTaHeaderD(ta);
  assert(d, 'the local stack has at least one kind-39998 header by its Assistant');
  const before = await latestId(ta, d);
  for (const action of ['self-declare', 'b-defer', 'b-append']) { // b-append: story 4
    // Through the shared helper (ADR honest-test-gate/0001 §6; review round 2, blocking 4): it reports the real HTTP
    // status, or "no response" — never a status the stack didn't send.
    const r = loopbackRequest({ container: CONTAINER, method: 'POST', url: `${CONTAINER_BASE}${ROUTE(addr(ta, d), action)}`, body: {}, timeoutS: 20 });
    assert(r.status === 401, `book decision 2: a no-session loopback ${action} must answer 401, got ${describeResponse(r)}`);
  }
  assert((await latestId(ta, d)) === before, 'book decision 2: the header must be unchanged after refused calls');
});

test('L2 (live): a guest session with no Assistant here gets 403 (story AC 4)', async () => {
  const ta = await stackTa();
  if (!ta) { liveSkipped++; return 'SKIP'; }
  let nt;
  try { nt = require('nostr-tools'); } catch { liveSkipped++; return 'SKIP'; }
  liveExecuted++;
  const sk = nt.generateSecretKey();
  const pk = nt.getPublicKey(sk);
  const jar = {};
  const keep = (r) => { for (const c of (r.headers.getSetCookie ? r.headers.getSetCookie() : [])) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); } };
  const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
  const post = async (p, body) => { const r = await fetch(`${HOST_BASE}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie() }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(20000) }); keep(r); let j = null; try { j = await r.json(); } catch {} return { status: r.status, json: j }; };
  const v = await post('/api/auth/verify-user', { pubkey: pk });
  assert(v.json && v.json.authorized && v.json.challenge, `verify-user gave no challenge: ${show(v.json)}`);
  const ev = nt.finalizeEvent({ kind: 22242, created_at: Math.floor(Date.now() / 1000), tags: [['challenge', v.json.challenge]], content: 'Tapestry authentication' }, sk);
  const l = await post('/api/auth/login-user', { event: ev });
  assert(l.json && l.json.success, `login-user failed: ${show(l.json)}`);
  try {
    const d = await someTaHeaderD(ta);
    const before = await latestId(ta, d);
    const r = await post(ROUTE(addr(ta, d), 'self-declare'));
    assert(r.status === 403 && r.json && /no Tapestry Assistant/i.test(r.json.error || ''), `story AC 4: a guest with no Assistant must get 403 "…no Tapestry Assistant…", got ${r.status} ${show(r.json)}`);
    assert((await latestId(ta, d)) === before, 'story AC 4: the header must be unchanged');
  } finally {
    await post('/api/auth/logout');
  }
});

// ── runner ─────────────────────────────────────────────────────────────────────

async function run() {
  let pass = 0;
  let fail = 0;
  let skipped = 0;
  const failures = [];
  console.log('\nlist-headers-disposition #3 — Disposition on My Assistant rows (server + rules)\n');
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { skipped++; console.log(`  - SKIP ${t.name}`); } else { pass++; console.log(`  ✓ ${t.name}`); }
    } catch (err) {
      fail++;
      failures.push({ name: t.name, message: err.message });
      console.log(`  ✗ ${t.name}\n      ${err.message}`);
    }
  }
  console.log(`\n  live: ${liveExecuted} executed / ${liveSkipped} skipped`);
  console.log(`  ${pass} passed, ${fail} failed, ${skipped} skipped\n`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
