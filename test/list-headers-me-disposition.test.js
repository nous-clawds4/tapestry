/**
 * list-headers-disposition #5: Disposition on Me rows — prepare (server composes), sign (the person's browser
 * signer), commit (the server re-derives the change and accepts only that exact change, signed by the session
 * account).
 *
 * Story: engineering-team/stories/done/list-headers-disposition/5-disposition-on-me-rows.md
 * ADR:   engineering-team/decisions/done/list-headers-disposition/0005-me-rows-prepare-sign-commit.md
 * Plan:  engineering-team/stories/done/list-headers-disposition/5-disposition-on-me-rows.test-plan.md
 * Browser half: tests/brainstorm/list-headers-my-assistant-disposition.spec.js (E1..E8).
 *
 * Signatures are REAL: a throwaway key signs the headers and the commits through nostr-tools, and the injected
 * verifier is nostr-tools' verifyEvent on a JSON round-trip. So "not signed by you", "doesn't verify" and "the
 * stored header can't be verified" are exercised with real cryptography, not flags.
 *
 *   X1..X2   — the exports ADR 0005 relies on, and an unknown (action, phase) refused when the handler is built.
 *   MP1..MP3 — prepare: every refusal before anything (the session account as author); the unsigned template;
 *              "already" with no template.
 *   MC1..MC7 — commit: success (relay, read-back, graph); the account check; the exact-change check; the signature
 *              (broken, or another key's relabelled); a header that changed between prepare and commit (MC5), and
 *              the re-derivation that makes a same change acceptable (MC5b); the read-back 502s; Wire's target.
 *   SM1..SM4 — structure: no private-key handling and no old bypasses; same-host first; six routes; registration.
 *   MA1..MA3 — review round 1 (ADR 0005 Amendment 1): the Me rows' own stored-header sentence (§2); a header dated
 *              too far ahead refused in both phases before anyone signs, after the account check (§3); the limit
 *              itself still prepares and commits, and "already" is unaffected.
 *   ML1      — LIVE (skipped without the stack): a no-session call from inside the container to each of the six
 *              routes gets 401 and the header is unchanged, through test/helpers/stackHttp.js.
 *
 * EXPECTED NOW (pre-implementation): every test FAILS — meDisposition.js, the Assistant module's new exports and the
 * routes don't exist yet. ML1 skips when the stack is down.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { loopbackRequest, describeResponse } = require('./helpers/stackHttp');

const ROOT = path.resolve(__dirname, '..');
const ME_MODULE = path.join(ROOT, 'src/api/list-headers/meDisposition.js');
const ASSISTANT_MODULE = path.join(ROOT, 'src/api/list-headers/myAssistantDisposition.js');
const API_INDEX = path.join(ROOT, 'src/api/index.js');
const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_PORT || '7778'}`;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(ROOT, p);

function load(p, what) {
  try { return require(p); } catch (err) {
    throw new Error(`ADR 0005 §Implementation: ${rel(p)} must exist and load stack-free (${what}) — ${err.message.split('\n')[0]}`);
  }
}
const meMod = () => load(ME_MODULE, 'createMeDispositionHandler + register');

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

// ── real keys ────────────────────────────────────────────────────────────────

const nt = require('nostr-tools');
const SK_ME = nt.generateSecretKey();
const ME = nt.getPublicKey(SK_ME);
const SK_OTHER = nt.generateSecretKey();
const OTHER = nt.getPublicKey(SK_OTHER);
const MY_ASSISTANT = 'a2'.repeat(32);
const SENTINEL = 'b-tag-deferred';
const THEIRS = `39998:${'9'.repeat(64)}:somebody-elses-concept`;
const NOW = Math.floor(Date.now() / 1000);
const realVerify = (ev) => { try { return nt.verifyEvent(JSON.parse(JSON.stringify(ev))) === true; } catch { return false; } };

/** A header the session account really signed. */
function myHeader(d, bTags = [], { created_at = NOW - 3600, sk = SK_ME, content = '{"x":1}' } = {}) {
  return nt.finalizeEvent({ kind: 39998, created_at, content, tags: [['d', d], ['names', 'thing', 'things'], ...bTags] }, sk);
}
const addr = (pk, d) => `39998:${pk}:${d}`;
const MY_HANDLE = addr(ME, 'recipes');

function request(handle, { session = { authenticated: true, pubkey: ME }, origin, host = 'localhost:7778', body = {}, localTrusted = false } = {}) {
  const req = { params: { handle }, body, headers: { host }, session: session || {} };
  if (localTrusted) req.localTrusted = true; // what the middleware stamps on a call from inside the container
  if (origin !== undefined) req.headers.origin = origin;
  return req;
}
function response() {
  const r = { statusCode: 200, body: undefined };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

/** Injected deps that record every call. `latest` is what scanLatest finds for (author, d), and can change. */
function deps({ latest = {}, stored = true } = {}) {
  const calls = [];
  const d = {
    requireAuth: (req, res) => {
      calls.push(['requireAuth']);
      const pk = req.session && req.session.pubkey;
      if (!req.session || req.session.authenticated !== true || !/^[0-9a-f]{64}$/.test(pk || '')) { res.status(401).json({ success: false, error: 'authentication required' }); return null; }
      return pk;
    },
    scanLatest: async (filter) => { calls.push(['scanLatest', filter]); return latest[`${(filter.authors || [])[0]}:${(filter['#d'] || [])[0]}`] || null; },
    verify: (ev) => { calls.push(['verify', ev]); return realVerify(ev); },
    publishLocal: async (ev) => { calls.push(['publishLocal', ev]); },
    isStored: async (id) => { calls.push(['isStored', id]); if (stored === 'throws') throw new Error('strfry scan failed'); return stored; },
    importToGraph: async (ev, uuid) => { calls.push(['importToGraph', ev, uuid]); },
    now: () => NOW,
    // Present only to prove the Me path never touches them:
    getAssistantKeys: async () => { calls.push(['getAssistantKeys']); return { pubkey: MY_ASSISTANT, privkey: '11'.repeat(32) }; },
    sign: () => { calls.push(['sign']); throw new Error('the Me path must never sign on the server'); },
  };
  return { d, calls };
}
const called = (calls, n) => calls.filter((c) => c[0] === n);
const WRITES = ['publishLocal', 'isStored', 'importToGraph', 'sign', 'getAssistantKeys'];
function nothingWritten(calls, label) {
  for (const n of WRITES) assert(called(calls, n).length === 0, `${label}: must not reach ${n}`);
}

async function run(action, phase, handle, reqOpts, depOpts) {
  const { createMeDispositionHandler } = meMod();
  assert(typeof createMeDispositionHandler === 'function', 'ADR 0005: createMeDispositionHandler must be exported');
  const { d, calls } = deps(depOpts);
  const res = response();
  await createMeDispositionHandler(action, phase, d)(request(handle, reqOpts), res);
  return { res, calls };
}
const latestOf = (h) => ({ [`${ME}:recipes`]: h });

/** prepare → sign the template with `sk` (default: the session account) → the signed event. */
async function prepareAndSign(action, h, { body = {}, sk = SK_ME, edit = (t) => t } = {}) {
  const p = await run(action, 'prepare', MY_HANDLE, { body }, { latest: latestOf(h) });
  assert(p.res.body && p.res.body.result === 'sign' && p.res.body.template, `prepare must answer a template for ${action} — got ${show(p.res.body)}`);
  return nt.finalizeEvent(edit({ ...p.res.body.template }), sk);
}

// ── X — exports ───────────────────────────────────────────────────────────────

test('X1: the Assistant module exports the building blocks ADR 0005 reuses, and the Me module exports its handler and register', () => {
  const a = load(ASSISTANT_MODULE, 'the Assistant handler');
  for (const n of ['sameHost', 'firstD', 'HANDLE_RE', 'HEADER_KIND', 'ACTIONS', 'defaultDeps']) {
    assert(a[n] !== undefined, `ADR 0005: myAssistantDisposition.js must export ${n}`);
  }
  assert(typeof a.sameHost === 'function' && typeof a.firstD === 'function' && typeof a.defaultDeps === 'function', 'ADR 0005: sameHost, firstD and defaultDeps are the functions themselves');
  assert(a.HANDLE_RE instanceof RegExp && a.HEADER_KIND === 39998, 'ADR 0005: HANDLE_RE is the handle pattern and HEADER_KIND is 39998');
  assert(['self-declare', 'b-defer', 'b-append'].every((k) => a.ACTIONS[k] && typeof a.ACTIONS[k].compose === 'function'), 'ADR 0005: ACTIONS holds the three actions\' compose rules');
  assert(typeof a.ACTIONS['b-append'].prepare === 'function', 'ADR 0005: ACTIONS["b-append"] keeps the target checks');
  const m = meMod();
  assert(typeof m.createMeDispositionHandler === 'function' && typeof m.register === 'function', 'ADR 0005: meDisposition.js exports createMeDispositionHandler and register');
});

test('X2: an unknown action or phase is refused when the handler is built', () => {
  const { createMeDispositionHandler } = meMod();
  for (const [action, phase] of [['b-delete', 'prepare'], ['self-declare', 'publish'], ['', 'commit']]) {
    let threw = false;
    try { createMeDispositionHandler(action, phase, {}); } catch { threw = true; }
    assert(threw, `ADR 0005: (${show(action)}, ${show(phase)}) must not build a handler`);
  }
});

// ── MP — prepare ──────────────────────────────────────────────────────────────

test('MP1: prepare and commit refuse, before anything else, every request story 5 AC 4 names (the session account as author)', async () => {
  const tampered = { ...myHeader('recipes'), content: 'changed after signing' };
  const cases = [
    ['another site', MY_HANDLE, { origin: 'https://evil.example' }, {}, 403, (c) => c.length === 0],
    ['no session', MY_HANDLE, { session: null }, {}, 401, null],
    ['no session, from inside the container', MY_HANDLE, { session: null, localTrusted: true }, { latest: latestOf(myHeader('recipes')) }, 401, null],
    ['a bad handle', 'not-a-handle', {}, {}, 400, null],
    ['kind 9998', `9998:${ME}:recipes`, {}, {}, 400, null],
    ['someone else\'s header', addr(OTHER, 'recipes'), {}, { latest: { [`${OTHER}:recipes`]: myHeader('recipes', [], { sk: SK_OTHER }) } }, 403, null],
    ['my Assistant\'s header (not mine)', addr(MY_ASSISTANT, 'recipes'), {}, {}, 403, null],
    ['a missing header', MY_HANDLE, {}, {}, 404, null],
    ['a stored header that doesn\'t verify', MY_HANDLE, {}, { latest: latestOf(tampered) }, 409, null],
    ['a stored header by another author', MY_HANDLE, {}, { latest: latestOf(myHeader('recipes', [], { sk: SK_OTHER })) }, 409, null],
    ['a stored header whose first d differs', MY_HANDLE, {}, { latest: latestOf(myHeader('other-d')) }, 409, null],
  ];
  const SENTENCES = {
    'another site': /a request from another site is refused/,
    "someone else's header": /You can only disposition headers you wrote/,
    "my Assistant's header (not mine)": /You can only disposition headers you wrote/,
  };
  for (const phase of ['prepare', 'commit']) {
    for (const action of ['self-declare', 'b-defer', 'b-append']) {
      for (const [label, handle, reqOpts, depOpts, status, extra] of cases) {
        const body = action === 'b-append' ? { target: THEIRS, event: {} } : { event: {} };
        const { res, calls } = await run(action, phase, handle, { body, ...reqOpts }, depOpts);
        assert(res.statusCode === status && res.body && res.body.success === false, `story 5 AC 4: ${label} (${action} ${phase}) must answer ${status}, got ${res.statusCode} ${show(res.body)}`);
        nothingWritten(calls, `story 5 AC 4: ${label} (${action} ${phase})`);
        if (extra) assert(extra(calls), `story 5 AC 4: ${label} (${action} ${phase}) is refused before requireAuth`);
        if (SENTENCES[label]) assert(SENTENCES[label].test(res.body.error || ''), `ADR 0005: ${label} says ${SENTENCES[label]} — got ${show(res.body.error)}`);
      }
    }
  }
  // Wire's target rules apply on Me rows too, before the lookup.
  for (const phase of ['prepare', 'commit']) {
    for (const target of [42, `1:${'9'.repeat(64)}:x`, MY_HANDLE, `39998:${'9'.repeat(64)}:x${String.fromCharCode(0x202e)}`]) {
      const { res, calls } = await run('b-append', phase, MY_HANDLE, { body: { target, event: {} } }, { latest: latestOf(myHeader('recipes')) });
      assert(res.statusCode === 400 && called(calls, 'scanLatest').length === 0, `story 5 AC 2: Wire target ${show(target)} (${phase}) must be refused (400) before the lookup, got ${res.statusCode} ${show(res.body)}`);
    }
  }
});

test('MP2: prepare answers the unsigned template — the session account as author, the action\'s exact tags, strictly newer — and saves nothing (story 5 AC 2)', async () => {
  const h = myHeader('recipes', [['b', SENTINEL]]);
  const expected = {
    'self-declare': [['d', 'recipes'], ['names', 'thing', 'things'], ['b', MY_HANDLE, 'pointer']],
    'b-append': [['d', 'recipes'], ['names', 'thing', 'things'], ['b', THEIRS, 'pointer']],
  };
  for (const action of ['self-declare', 'b-append']) {
    const { res, calls } = await run(action, 'prepare', MY_HANDLE, { body: action === 'b-append' ? { target: THEIRS } : {} }, { latest: latestOf(h) });
    const t = res.body && res.body.template;
    assert(res.statusCode === 200 && res.body.success === true && res.body.result === 'sign' && t, `story 5 AC 2: ${action} prepare answers { result: 'sign', template } — got ${res.statusCode} ${show(res.body)}`);
    assert(t.kind === 39998 && t.pubkey === ME && t.content === h.content && show(t.tags) === show(expected[action]) && t.created_at > h.created_at,
      `story 5 AC 2: ${action}'s template is the action's change by the session account, newer than the header — got ${show(t)}`);
    assert(!('sig' in t) && !('id' in t), 'ADR 0005: the template is unsigned');
    nothingWritten(calls, `ADR 0005: ${action} prepare`);
  }
  const k = await run('b-defer', 'prepare', MY_HANDLE, {}, { latest: latestOf(myHeader('recipes')) });
  assert(k.res.body && k.res.body.result === 'sign' && show(k.res.body.template.tags.slice(-1)) === show([['b', SENTINEL]]), `story 5 AC 2: Keep private prepares the marker — got ${show(k.res.body)}`);
});

test('MP3: when nothing new is needed, prepare says "already" with the stored event and no template — the signer is never needed (story 5 AC 2)', async () => {
  const cases = [
    ['self-declare', myHeader('recipes', [['b', MY_HANDLE, 'pointer']]), {}, 'already-declared'],
    ['b-defer', myHeader('recipes', [['b', SENTINEL]]), {}, 'already-deferred'],
    ['b-append', myHeader('recipes', [['b', THEIRS, 'pointer']]), { target: THEIRS }, 'already-wired'],
  ];
  for (const [action, h, body, result] of cases) {
    const { res, calls } = await run(action, 'prepare', MY_HANDLE, { body }, { latest: latestOf(h) });
    assert(res.body && res.body.success === true && res.body.result === result && res.body.event && res.body.event.id === h.id && !res.body.template,
      `story 5 AC 2: ${action} on an already-done header answers ${result} with the stored event and no template — got ${show(res.body)}`);
    nothingWritten(calls, `story 5 AC 2: ${action} already`);
  }
  const r = await run('b-defer', 'prepare', MY_HANDLE, {}, { latest: latestOf(myHeader('recipes', [['b', THEIRS, 'pointer']])) });
  assert(r.res.statusCode === 200 && r.res.body && r.res.body.success === false && /already carries a real b/.test(r.res.body.error || ''), `story 5 AC 2: Keep private beside a real b is refused — got ${show(r.res.body)}`);
});

// ── MC — commit ───────────────────────────────────────────────────────────────

test('MC1: commit accepts the person\'s signature of exactly the prepared change — relay, read-back, then graph — and answers the action\'s result (story 5 AC 2)', async () => {
  const cases = [
    ['self-declare', myHeader('recipes'), {}, 'declared'],
    ['b-defer', myHeader('recipes'), {}, 'deferred'],
    ['b-append', myHeader('recipes'), { target: THEIRS }, 'wired'],
  ];
  for (const [action, h, body, done] of cases) {
    const signed = await prepareAndSign(action, h, { body });
    const { res, calls } = await run(action, 'commit', MY_HANDLE, { body: { ...body, event: signed } }, { latest: latestOf(h) });
    assert(res.statusCode === 200 && res.body && res.body.success === true && res.body.result === done && res.body.event && res.body.event.id === signed.id,
      `story 5 AC 2: ${action} commit answers ${done} with the signed event — got ${res.statusCode} ${show(res.body)}`);
    const order = calls.map((c) => c[0]).filter((n) => ['publishLocal', 'isStored', 'importToGraph'].includes(n));
    assert(show(order) === show(['publishLocal', 'isStored', 'importToGraph']), `story 5 AC 2: relay, read-back, graph — got ${show(order)}`);
    assert(called(calls, 'publishLocal')[0][1].id === signed.id && called(calls, 'importToGraph')[0][2] === MY_HANDLE, `story 5 AC 2: the person's signed event is what is saved, under the header's address`);
    assert(called(calls, 'sign').length === 0 && called(calls, 'getAssistantKeys').length === 0, 'ADR 0005: the Me path never signs on the server or looks up a key');
  }
});

test('MC2: commit refuses (403) a version not signed by the signed-in account, and anything that isn\'t an event (story 5 AC 4)', async () => {
  const h = myHeader('recipes');
  const byOther = await prepareAndSign('self-declare', h, { sk: SK_OTHER, edit: (t) => ({ ...t }) });
  for (const [label, event] of [['signed by another key', byOther], ['a string', 'x'], ['null', null], ['missing', undefined]]) {
    const { res, calls } = await run('self-declare', 'commit', MY_HANDLE, { body: event === undefined ? {} : { event } }, { latest: latestOf(h) });
    assert(res.statusCode === 403 && /wasn['’]t signed by the account you['’]re signed in with/i.test((res.body && res.body.error) || ''),
      `story 5 AC 4: ${label} must answer 403 "…wasn't signed by the account you're signed in with…", got ${res.statusCode} ${show(res.body)}`);
    nothingWritten(calls, `story 5 AC 4: ${label}`);
  }
});

test('MC3: commit refuses (409) anything but the action\'s exact change — kind, content, tags, b-type, timestamps (story 5 AC 4)', async () => {
  const h = myHeader('recipes');
  const edits = [
    ['another kind', (t) => ({ ...t, kind: 30023 })],
    ['changed content', (t) => ({ ...t, content: 'something else' })],
    ['an extra tag', (t) => ({ ...t, tags: [...t.tags, ['p', 'f'.repeat(64)]] })],
    ['a missing tag', (t) => ({ ...t, tags: t.tags.filter((x) => x[0] !== 'names') })],
    ['the wrong b-type', (t) => ({ ...t, tags: t.tags.map((x) => (x[0] === 'b' ? ['b', x[1], 'inherit'] : x)) })],
    ['a stale timestamp', (t) => ({ ...t, created_at: h.created_at })],
    ['a far-future timestamp', (t) => ({ ...t, created_at: NOW + 601 })],
  ];
  for (const [label, edit] of edits) {
    const signed = await prepareAndSign('self-declare', h, { edit });
    const { res, calls } = await run('self-declare', 'commit', MY_HANDLE, { body: { event: signed } }, { latest: latestOf(h) });
    assert(res.statusCode === 409 && /isn['’]t exactly this action['’]s change/i.test((res.body && res.body.error) || ''),
      `story 5 AC 4: ${label} must answer 409 "…isn't exactly this action's change…", got ${res.statusCode} ${show(res.body)}`);
    nothingWritten(calls, `story 5 AC 4: ${label}`);
  }
});

test('MC4: commit refuses (400) a version that doesn\'t verify — a broken signature (story 5 AC 4)', async () => {
  const h = myHeader('recipes');
  const signed = await prepareAndSign('self-declare', h);
  const broken = { ...signed, sig: (signed.sig[0] === 'a' ? 'b' : 'a') + signed.sig.slice(1) };
  const { res, calls } = await run('self-declare', 'commit', MY_HANDLE, { body: { event: broken } }, { latest: latestOf(h) });
  assert(res.statusCode === 400 && /doesn['’]t verify/i.test((res.body && res.body.error) || ''), `story 5 AC 4: a broken signature must answer 400 "…doesn't verify…", got ${res.statusCode} ${show(res.body)}`);
  nothingWritten(calls, 'story 5 AC 4: a broken signature');
  // Signed by another key, then relabelled as the session account: the account check passes, the signature can't.
  const byOther = await prepareAndSign('self-declare', h, { sk: SK_OTHER });
  const relabelled = { ...JSON.parse(JSON.stringify(byOther)), pubkey: ME };
  const r = await run('self-declare', 'commit', MY_HANDLE, { body: { event: relabelled } }, { latest: latestOf(h) });
  assert(r.res.statusCode === 400 && /doesn['’]t verify/i.test((r.res.body && r.res.body.error) || ''), `story 5 AC 4: another key's signature relabelled as the account must answer 400, got ${r.res.statusCode} ${show(r.res.body)}`);
  nothingWritten(r.calls, 'story 5 AC 4: a relabelled signature');
});

test('MC5: a header that changed between prepare and commit, so the change is no longer what was signed — even into "already" or a refusal — is refused (409), nothing saved (ADR 0005)', async () => {
  const v1 = myHeader('recipes', [], { created_at: NOW - 3600 });
  const submit = await prepareAndSign('self-declare', v1);
  const keep = await prepareAndSign('b-defer', v1);
  const cases = [
    ['self-declare', submit, 'wired elsewhere meanwhile', myHeader('recipes', [['b', THEIRS, 'pointer']], { created_at: NOW - 60 })],
    ['self-declare', submit, 'its content edited meanwhile', myHeader('recipes', [], { created_at: NOW - 60, content: '{"x":2}' })],
    ['self-declare', submit, 'already self-declared meanwhile', myHeader('recipes', [['b', MY_HANDLE, 'pointer']], { created_at: NOW - 60 })],
    ['b-defer', keep, 'wired meanwhile, so Keep private is now refused', myHeader('recipes', [['b', THEIRS, 'pointer']], { created_at: NOW - 60 })],
  ];
  for (const [action, signed, label, v2] of cases) {
    const { res, calls } = await run(action, 'commit', MY_HANDLE, { body: { event: signed } }, { latest: latestOf(v2) });
    assert(res.statusCode === 409 && res.body && res.body.success === false && !res.body.result && /isn['’]t exactly this action['’]s change/i.test(res.body.error || ''),
      `ADR 0005: ${label} — commit must answer 409 with the change sentence, never "already" or a 200 refusal, got ${res.statusCode} ${show(res.body)}`);
    nothingWritten(calls, `ADR 0005: ${label}`);
  }
});

test('MC5b: the commit re-derives from the CURRENT header, not the one prepare saw — kept private meanwhile, Submit\'s change is the same, so it is accepted (ADR 0005)', async () => {
  const v1 = myHeader('recipes', [], { created_at: NOW - 3600 });
  const signed = await prepareAndSign('self-declare', v1);
  const v2 = myHeader('recipes', [['b', SENTINEL]], { created_at: NOW - 60 });
  const { res, calls } = await run('self-declare', 'commit', MY_HANDLE, { body: { event: signed } }, { latest: latestOf(v2) });
  assert(res.statusCode === 200 && res.body && res.body.result === 'declared' && called(calls, 'publishLocal').length === 1,
    `ADR 0005: Submit drops the marker, so the re-derived change equals what was signed — accepted; got ${res.statusCode} ${show(res.body)}`);
});

test('MC6: the read-back still decides — not kept, or a failed read, is 502 with the graph untouched (story 5 AC 2, ADR 0004 Amendment 1 §4)', async () => {
  const h = myHeader('recipes');
  const signed = await prepareAndSign('b-defer', h);
  let r = await run('b-defer', 'commit', MY_HANDLE, { body: { event: signed } }, { latest: latestOf(h), stored: false });
  assert(r.res.statusCode === 502 && /didn['’]t keep/i.test(r.res.body.error || '') && called(r.calls, 'importToGraph').length === 0, `not kept: 502, no graph — got ${r.res.statusCode} ${show(r.res.body)}`);
  r = await run('b-defer', 'commit', MY_HANDLE, { body: { event: signed } }, { latest: latestOf(h), stored: 'throws' });
  assert(r.res.statusCode === 502 && /couldn['’]t confirm/i.test(r.res.body.error || '') && called(r.calls, 'importToGraph').length === 0, `a failed read: 502, no graph — got ${r.res.statusCode} ${show(r.res.body)}`);
});

test('MC7: Wire\'s commit re-derives from the target it is given — a different target than the one signed is refused (story 5 AC 4)', async () => {
  const h = myHeader('recipes');
  const signed = await prepareAndSign('b-append', h, { body: { target: THEIRS } });
  const other = `39998:${'8'.repeat(64)}:another-concept`;
  const { res, calls } = await run('b-append', 'commit', MY_HANDLE, { body: { target: other, event: signed } }, { latest: latestOf(h) });
  assert(res.statusCode === 409, `story 5 AC 4: a commit whose target differs from the signed one must answer 409, got ${res.statusCode} ${show(res.body)}`);
  nothingWritten(calls, 'story 5 AC 4: a different target');
});

// ── MA — review round 1 (ADR 0005 Amendment 1) ───────────────────────────────

const UNVERIFIED_HEADER = /couldn['’]t be verified as yours, so nothing was saved/;
const TOO_FAR_AHEAD = /dated more than 10 minutes ahead, so a newer version can['’]t be saved yet — nothing was saved/;

test('MA1 (Amendment 1 §2): on Me rows, an unverifiable stored header gets its own sentence — "as yours … nothing was saved" — in both phases', async () => {
  const tampered = { ...myHeader('recipes'), content: 'changed after signing' };
  for (const phase of ['prepare', 'commit']) {
    for (const action of ['self-declare', 'b-defer', 'b-append']) {
      const body = action === 'b-append' ? { target: THEIRS, event: {} } : { event: {} };
      const { res, calls } = await run(action, phase, MY_HANDLE, { body }, { latest: latestOf(tampered) });
      const error = (res.body && res.body.error) || '';
      assert(res.statusCode === 409 && UNVERIFIED_HEADER.test(error) && !/Assistant/.test(error),
        `Amendment 1 §2: ${action} ${phase} must answer 409 "The stored header couldn't be verified as yours, so nothing was saved", got ${res.statusCode} ${show(error)}`);
      nothingWritten(calls, `Amendment 1 §2: ${action} ${phase}`);
    }
  }
});

test('MA2 (Amendment 1 §3): a header dated so far ahead that its next version would pass now + 600 is refused in both phases — no template, nothing written — after the account check', async () => {
  const ahead = myHeader('recipes', [], { created_at: NOW + 700 });
  for (const action of ['self-declare', 'b-defer', 'b-append']) {
    const body = action === 'b-append' ? { target: THEIRS } : {};
    const { res, calls } = await run(action, 'prepare', MY_HANDLE, { body }, { latest: latestOf(ahead) });
    assert(res.statusCode === 409 && res.body && !res.body.template && TOO_FAR_AHEAD.test(res.body.error || ''),
      `Amendment 1 §3: ${action} prepare must answer 409 "…dated more than 10 minutes ahead…" with no template, got ${res.statusCode} ${show(res.body)}`);
    nothingWritten(calls, `Amendment 1 §3: ${action} prepare`);
  }
  // At commit: a version the person signed anyway (exactly what an unamended prepare would have offered) gets the same
  // sentence, not "isn't exactly this action's change".
  const signed = nt.finalizeEvent({ kind: 39998, content: ahead.content, tags: [['d', 'recipes'], ['names', 'thing', 'things'], ['b', MY_HANDLE, 'pointer']], created_at: NOW + 701 }, SK_ME);
  let r = await run('self-declare', 'commit', MY_HANDLE, { body: { event: signed } }, { latest: latestOf(ahead) });
  assert(r.res.statusCode === 409 && TOO_FAR_AHEAD.test((r.res.body && r.res.body.error) || ''),
    `Amendment 1 §3: commit on a header dated too far ahead must answer 409 "…dated more than 10 minutes ahead…", got ${r.res.statusCode} ${show(r.res.body)}`);
  nothingWritten(r.calls, 'Amendment 1 §3: commit');
  // The account check still comes first at commit.
  const byOther = nt.finalizeEvent({ kind: 39998, content: ahead.content, tags: [['d', 'recipes']], created_at: NOW + 701 }, SK_OTHER);
  r = await run('self-declare', 'commit', MY_HANDLE, { body: { event: byOther } }, { latest: latestOf(ahead) });
  assert(r.res.statusCode === 403, `Amendment 1 §3: at commit, the account check runs first — another key's version gets 403, got ${r.res.statusCode} ${show(r.res.body)}`);
});

test('MA3 (Amendment 1 §3): at the limit a header still prepares and commits; an "already" answer is unaffected by the date', async () => {
  const atLimit = myHeader('recipes', [], { created_at: NOW + 599 });
  const p = await run('self-declare', 'prepare', MY_HANDLE, {}, { latest: latestOf(atLimit) });
  assert(p.res.statusCode === 200 && p.res.body && p.res.body.result === 'sign' && p.res.body.template && p.res.body.template.created_at === NOW + 600,
    `Amendment 1 §3: a header at now + 599 prepares a version at now + 600, got ${p.res.statusCode} ${show(p.res.body)}`);
  const signed = nt.finalizeEvent({ ...p.res.body.template }, SK_ME);
  const c = await run('self-declare', 'commit', MY_HANDLE, { body: { event: signed } }, { latest: latestOf(atLimit) });
  assert(c.res.statusCode === 200 && c.res.body && c.res.body.result === 'declared', `Amendment 1 §3: and that version commits, got ${c.res.statusCode} ${show(c.res.body)}`);
  const aheadDone = myHeader('recipes', [['b', MY_HANDLE, 'pointer']], { created_at: NOW + 700 });
  const a = await run('self-declare', 'prepare', MY_HANDLE, {}, { latest: latestOf(aheadDone) });
  assert(a.res.statusCode === 200 && a.res.body && a.res.body.result === 'already-declared',
    `Amendment 1 §3: an already self-declared header answers "already" whatever its date, got ${a.res.statusCode} ${show(a.res.body)}`);
});

// ── SM — structure ────────────────────────────────────────────────────────────

function meSource() {
  try { return code(fs.readFileSync(ME_MODULE, 'utf8')); } catch { throw new Error(`ADR 0005 §Implementation: ${rel(ME_MODULE)} must exist`); }
}

test('SM1: the Me module never handles a private key or an old bypass (ADR 0005)', () => {
  const src = meSource();
  for (const forbidden of ['getAssistantKeys', 'privkey', 'finalizeEvent', 'isOwner', 'isOwnerOrAdmin', 'localTrusted', 'loadTAKey', 'signAndFinalize', 'getOwnerAssistantKeys', 'getOwnerAssistantPubkey', 'decodeURIComponent']) {
    assert(!new RegExp(`\\b${forbidden}\\b`).test(src), `ADR 0005: ${rel(ME_MODULE)} must not reference ${forbidden}`);
  }
  assert(!/\bsign\s*\(/.test(src), 'ADR 0005: the Me module never calls sign(…) — the person\'s browser signs');
});

test('SM2: inside the handler, the same-host check runs before requireAuth (ADR 0005)', () => {
  const src = meSource();
  const start = src.search(/function\s+createMeDispositionHandler\s*\(/);
  const body = start >= 0 ? src.slice(start) : '';
  const sh = body.search(/\bsameHost\s*\(\s*req\s*\)/);
  const ra = body.search(/\brequireAuth\s*\(\s*req\b/);
  assert(sh >= 0 && ra >= 0 && sh < ra, 'ADR 0005: sameHost(req) is called before requireAuth(req, …) inside createMeDispositionHandler');
});

test('SM3: register(app) mounts exactly the six POST routes — three actions × prepare/commit (ADR 0005)', () => {
  const { register } = meMod();
  const mounted = [];
  register({ post: (p, h) => mounted.push(['post', p, typeof h]), get: (p) => mounted.push(['get', p]), put: (p) => mounted.push(['put', p]), delete: (p) => mounted.push(['delete', p]), use: () => {} });
  const want = [];
  for (const a of ['self-declare', 'b-defer', 'b-append']) for (const ph of ['prepare', 'commit']) want.push(['post', `/api/list-headers/me/:handle/${a}/${ph}`, 'function']);
  assert(show(mounted.sort()) === show(want.sort()), `ADR 0005: register mounts ${show(want)}, got ${show(mounted)}`);
});

test('SM4: the API index registers the Me routes (ADR 0005)', () => {
  const src = code(fs.readFileSync(API_INDEX, 'utf8'));
  assert(/require\(\s*['"]\.\/list-headers\/meDisposition['"]\s*\)\s*\.register\(\s*app\s*\)/.test(src), "ADR 0005: src/api/index.js must call require('./list-headers/meDisposition').register(app)");
});

// ── ML — live refusals (skipped without the stack) ───────────────────────────

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
async function someHeaderD(author) {
  const filter = encodeURIComponent(JSON.stringify({ kinds: [39998], authors: [author], limit: 1 }));
  const j = await (await fetch(`${HOST_BASE}/api/strfry/scan?filter=${filter}`, { signal: AbortSignal.timeout(15000) })).json();
  const ev = ((j && j.events) || [])[0];
  return ev ? (ev.tags.find((t) => t[0] === 'd') || [])[1] : null;
}

test('ML1 (live): a no-session call from inside the container to each of the six routes gets 401, and the header is unchanged (story 5 AC 4)', async () => {
  const ta = await stackTa();
  if (!ta || !dockerOk()) { liveSkipped++; return 'SKIP'; }
  liveExecuted++;
  // Any real header will do: a no-session call is refused before the author is looked at. The TA's is the one this
  // stack is sure to hold.
  const d = await someHeaderD(ta);
  assert(d, 'the local stack has at least one kind-39998 header by its Assistant');
  const before = await latestId(ta, d);
  const handle = encodeURIComponent(`39998:${ta}:${d}`);
  for (const a of ['self-declare', 'b-defer', 'b-append']) {
    for (const ph of ['prepare', 'commit']) {
      const r = loopbackRequest({ container: CONTAINER, method: 'POST', url: `${CONTAINER_BASE}/api/list-headers/me/${handle}/${a}/${ph}`, body: { target: THEIRS, event: {} }, timeoutS: 20 });
      assert(r.status === 401, `story 5 AC 4: a no-session ${a} ${ph} from inside the container must answer 401, got ${describeResponse(r)}`);
    }
  }
  assert((await latestId(ta, d)) === before, 'story 5 AC 4: the header must be unchanged after refused calls');
});

// ── runner ─────────────────────────────────────────────────────────────────────

async function runAll() {
  let pass = 0;
  let fail = 0;
  let skipped = 0;
  const failures = [];
  console.log('\nlist-headers-disposition #5 — Disposition on Me rows (prepare / sign / commit)\n');
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

module.exports = { run: runAll };

if (require.main === module) {
  runAll().then((r) => process.exit(r.fail ? 1 : 0));
}
