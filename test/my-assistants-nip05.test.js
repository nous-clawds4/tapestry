'use strict';
/**
 * my-assistants #4: is each Assistant's NIP-05 genuine, and a way into each Assistant's profile.
 *
 * Story: engineering-team/stories/my-assistants/4-nip05-validity-and-profile-links.md
 * ADR:   engineering-team/decisions/my-assistants/0004-nip05-status-from-the-verify-endpoint-and-plain-profile-links.md
 * Plan:  engineering-team/stories/my-assistants/4-nip05-validity-and-profile-links.test-plan.md
 * Browser half: tests/brainstorm/my-assistants-nip05.spec.js.
 *
 * Classes:
 *   L — lookupNip05 says what happened: malformed, unreachable, or answered (ADR 0004 sub-decision 1).   [AC-1]
 *   V — GET /api/nip05/verify adds `status`, by sub-decision 2's table; `verified` and
 *       verifyNip05Identifier keep their contracts.                                                     [AC-1]
 *   M — the view-model: nip05StatusOf (never "invalid" from a failure), profilePath, a card's nip05Id,
 *       and § Copy's words (sub-decision 3).                                                            [AC-1–AC-5]
 *   S — sentinels: the two new page files exist and hold no 64-hex literal; openapi documents the
 *       endpoint's status.
 *
 * Hermetic: global.fetch is replaced per test with a stub, and every domain is a public IP literal
 * (93.184.216.34), so the guard classifies it without DNS (as test/nip05-ssrf-guard.test.js does). A
 * non-public domain (10.0.0.5) is refused by the guard before any request. Nothing reaches the network.
 * Everything here FAILS against the current code: lookupNip05 and `status` don't exist yet.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const NIP05 = path.join(REPO, 'src/api/nip05.js');
const VIEW_MODEL = path.join(REPO, 'ui/src/pages/assistants/myAssistants.js');
const PAGE_DIR = path.join(REPO, 'ui/src/pages/assistants');
const OPENAPI = path.join(REPO, 'src/api/openapi.yaml');
const NL = String.fromCharCode(10);

const PK = 'b'.repeat(64);
const OTHER = 'c'.repeat(64);
const PUBLIC = '93.184.216.34';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const plain = (s) => String(s).replace(/[’']/g, "'");

function nip05Module() { return require(NIP05); }
function need(mod, name, where) {
  assert(mod && typeof mod[name] === 'function', `${where} does not export ${name}() (ADR 0004)`);
  return mod[name];
}

/** Replace global.fetch for one call; record the requests. `impl(url, opts)` returns a Response-like or throws. */
async function withFetch(impl, fn) {
  const real = global.fetch;
  const calls = [];
  global.fetch = async (url, opts) => { calls.push(String(url)); return impl(String(url), opts); };
  try { return await fn(calls); } finally { global.fetch = real; }
}
const jsonResponse = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body });
const notJson = () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => { throw new SyntaxError('Unexpected token < in JSON'); } });
const redirect = (status) => ({ ok: false, status, headers: { get: (h) => (h.toLowerCase() === 'location' ? `https://www.${PUBLIC}/.well-known/nostr.json` : null) }, json: async () => ({ names: { alice: PK } }) });
const abortError = () => { const e = new Error('This operation was aborted'); e.name = 'AbortError'; throw e; };
const networkError = () => { throw new TypeError('fetch failed'); };

/** Each case: [label, nip05, fetch impl or null (no request expected), expected lookup outcome, expected pubkey]. */
const CASES = [
  ['malformed: no domain', 'alice', null, 'malformed', null],
  ['malformed: empty', '', null, 'malformed', null],
  ['malformed: a trailing @', 'alice@', null, 'malformed', null],
  ['a refused (non-public) host', 'alice@10.0.0.5', null, 'unreachable', null],
  ['a 301', `alice@${PUBLIC}`, () => redirect(301), 'unreachable', null],
  ['a 302', `alice@${PUBLIC}`, () => redirect(302), 'unreachable', null],
  ['a 404', `alice@${PUBLIC}`, () => jsonResponse({ error: 'not found' }, 404), 'unreachable', null],
  ['a 500', `alice@${PUBLIC}`, () => jsonResponse({}, 500), 'unreachable', null],
  ['a network error', `alice@${PUBLIC}`, networkError, 'unreachable', null],
  ['the 5 s abort', `alice@${PUBLIC}`, abortError, 'unreachable', null],
  ['a body that is not JSON', `alice@${PUBLIC}`, notJson, 'unreachable', null],
  ['JSON without names', `alice@${PUBLIC}`, () => jsonResponse({ relays: {} }), 'unreachable', null],
  ['names as an array', `alice@${PUBLIC}`, () => jsonResponse({ names: [PK] }), 'unreachable', null],
  ['names as a string', `alice@${PUBLIC}`, () => jsonResponse({ names: PK }), 'unreachable', null],
  ['names null', `alice@${PUBLIC}`, () => jsonResponse({ names: null }), 'unreachable', null],
  ['the name absent', `alice@${PUBLIC}`, () => jsonResponse({ names: { bob: PK } }), 'answered', null],
  ['a non-hex value', `alice@${PUBLIC}`, () => jsonResponse({ names: { alice: 'npub1notahexkey' } }), 'answered', null],
  ['a different key', `alice@${PUBLIC}`, () => jsonResponse({ names: { alice: OTHER } }), 'answered', OTHER],
  ['the same key', `alice@${PUBLIC}`, () => jsonResponse({ names: { alice: PK } }), 'answered', PK],
  ['the lowercase-name fallback', `Alice@${PUBLIC}`, () => jsonResponse({ names: { alice: PK } }), 'answered', PK],
  ['a bare domain is the _ name', PUBLIC, () => jsonResponse({ names: { _: PK } }), 'answered', PK],
];

/** Sub-decision 2's table, for the requested pubkey PK. */
function expectedStatus([, , , outcome, pubkey]) {
  if (outcome === 'answered' && pubkey === PK) return 'verified';
  if (outcome === 'malformed' || outcome === 'answered') return 'invalid';
  return 'unchecked';
}

async function verifyAnswer(query, impl) {
  const { handleNip05Verify } = nip05Module();
  const res = { headers: {}, body: undefined, statusCode: 200,
    set(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; } };
  const calls = await withFetch(impl || (() => { throw new Error('no request was expected'); }), async (c) => { await handleNip05Verify({ query }, res); return c; });
  return { res, calls };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// L — lookupNip05
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('L1: lookupNip05 — malformed, unreachable or answered, case by case (ADR 0004 sub-decision 1)', async () => {
  const lookup = need(nip05Module(), 'lookupNip05', rel(NIP05));
  const wrong = [];
  for (const c of CASES) {
    const [label, nip05, impl, outcome, pubkey] = c;
    const { got, calls } = await withFetch(impl || (() => { throw new Error('no request expected'); }), async (calls) => ({ got: await lookup(nip05), calls }));
    if (!got || got.outcome !== outcome || (got.pubkey || null) !== pubkey) wrong.push(`${label}: expected { outcome: ${outcome}, pubkey: ${pubkey && pubkey.slice(0, 4)} }, got ${show(got && { outcome: got.outcome, pubkey: got.pubkey && got.pubkey.slice(0, 4) })}`);
    if (!impl && calls.length !== 0) wrong.push(`${label}: no request may be made; ${calls.length} were`);
  }
  assert(wrong.length === 0, wrong.join(NL + '        '));
});

test('L2: the lookup still asks the same URL, once, with redirect:"manual" and an abort signal', async () => {
  const lookup = need(nip05Module(), 'lookupNip05', rel(NIP05));
  let opts = null;
  const calls = await withFetch((url, o) => { opts = o; return jsonResponse({ names: { alice: PK } }); }, async (c) => { await lookup(`alice@${PUBLIC}`); return c; });
  assert(show(calls) === show([`https://${PUBLIC}/.well-known/nostr.json?name=alice`]), `one request to the same URL; got ${show(calls)}`);
  assert(opts && opts.redirect === 'manual' && opts.signal, `redirect:'manual' and the abort signal must be kept; got ${show(opts && { redirect: opts.redirect, signal: !!opts.signal })}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// V — the endpoint
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('V1: GET /api/nip05/verify answers a status by sub-decision 2\'s table, and verified === (status === "verified")', async () => {
  const wrong = [];
  for (const c of CASES) {
    const [label, nip05, impl] = c;
    const { res } = await verifyAnswer({ nip05, pubkey: PK }, impl);
    const want = expectedStatus(c);
    const b = res.body || {};
    if (b.status !== want) wrong.push(`${label}: status should be ${want}, got ${show(b.status)}`);
    if (b.verified !== (want === 'verified')) wrong.push(`${label}: verified should be ${want === 'verified'}, got ${show(b.verified)}`);
  }
  assert(wrong.length === 0, wrong.join(NL + '        '));
});

test('V2: the requested pubkey is compared case-insensitively; a different key is invalid, never verified', async () => {
  const same = await verifyAnswer({ nip05: `alice@${PUBLIC}`, pubkey: PK.toUpperCase() }, () => jsonResponse({ names: { alice: PK } }));
  assert(same.res.body && same.res.body.status === 'verified' && same.res.body.verified === true, `an uppercase pubkey parameter still verifies; got ${show(same.res.body)}`);
  const other = await verifyAnswer({ nip05: `alice@${PUBLIC}`, pubkey: PK }, () => jsonResponse({ names: { alice: OTHER } }));
  assert(other.res.body && other.res.body.status === 'invalid' && other.res.body.verified === false, `a domain naming another key is invalid; got ${show(other.res.body)}`);
});

test('V3: a missing or malformed pubkey parameter is unchecked, never invalid, and asks nothing', async () => {
  for (const pubkey of [undefined, '', 'npub1abc', 'b'.repeat(63)]) {
    const { res, calls } = await verifyAnswer({ nip05: `alice@${PUBLIC}`, pubkey }, () => jsonResponse({ names: { alice: PK } }));
    assert(res.body && res.body.status === 'unchecked' && res.body.verified === false, `pubkey ${show(pubkey)}: expected { verified: false, status: 'unchecked' }, got ${show(res.body)}`);
    assert(calls.length === 0, `pubkey ${show(pubkey)}: no lookup should be made; ${calls.length} were`);
  }
});

test('V4: the endpoint keeps Cache-Control: no-store and answers 200', async () => {
  const { res } = await verifyAnswer({ nip05: `alice@${PUBLIC}`, pubkey: PK }, () => jsonResponse({ names: { alice: PK } }));
  assert(res.headers['cache-control'] === 'no-store', `Cache-Control should stay no-store; got ${show(res.headers['cache-control'])}`);
  assert(res.statusCode === 200, `the answer stays 200; got ${res.statusCode}`);
});

test('V5: verifyNip05Identifier keeps its contract — the attested pubkey when the domain lists one, else null', async () => {
  const fn = need(nip05Module(), 'verifyNip05Identifier', rel(NIP05));
  const wrong = [];
  for (const [label, nip05, impl, , pubkey] of CASES) {
    const got = await withFetch(impl || (() => { throw new Error('no request expected'); }), () => fn(nip05));
    if (got !== pubkey) wrong.push(`${label}: expected ${pubkey && pubkey.slice(0, 4)}, got ${show(got && got.slice(0, 4))}`);
  }
  assert(wrong.length === 0, wrong.join(NL + '        '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// M — the view-model
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

async function vm() {
  assert(fs.existsSync(VIEW_MODEL), `${rel(VIEW_MODEL)} does not exist`);
  return import(`${pathToFileURL(VIEW_MODEL).href}?t=${Date.now()}`);
}

test('M1: nip05StatusOf — the three statuses pass through; anything else is unchecked, never invalid', async () => {
  const fn = need(await vm(), 'nip05StatusOf', rel(VIEW_MODEL));
  for (const s of ['verified', 'invalid', 'unchecked']) assert(fn({ verified: s === 'verified', status: s }) === s, `${s} → ${s}; got ${show(fn({ status: s }))}`);
  for (const a of [null, undefined, {}, { verified: false }, { verified: true }, { status: 'bogus' }, { status: 'INVALID' }, 'invalid', 42, []]) {
    const got = fn(a);
    assert(got === 'unchecked', `${show(a)} must read unchecked (a failure is never "invalid"); got ${show(got)}`);
  }
});

test('M2: profilePath — the Brainstorm profile page, /user/<pubkey>', async () => {
  const fn = need(await vm(), 'profilePath', rel(VIEW_MODEL));
  assert(fn(PK) === `/user/${PK}`, `got ${show(fn(PK))}`);
});

test('M3: a card keeps its NIP-05 identifier apart from the "—" placeholder (nip05Id)', async () => {
  const m = await vm();
  const rows = m.buildRows({
    rows: [{ pubkey: PK, local: false, tags: [] }, { pubkey: OTHER, local: false, tags: [] }, { pubkey: 'd'.repeat(64), local: false, tags: [] }],
    profiles: { [PK]: { name: 'Has', nip05: ' has@ex.example ' }, [OTHER]: { name: 'None' }, ['d'.repeat(64)]: { name: 'Odd', nip05: 7 } },
  });
  const by = Object.fromEntries(rows.map((r) => [r.name, [r.nip05, r.nip05Id]]));
  assert(show(by.Has) === show(['has@ex.example', 'has@ex.example']), `a NIP-05 is shown and kept; got ${show(by.Has)}`);
  assert(show(by.None) === show(['—', null]), `no NIP-05: shown "—", nip05Id null; got ${show(by.None)}`);
  assert(show(by.Odd) === show(['—', null]), `a non-text NIP-05 is no NIP-05; got ${show(by.Odd)}`);
});

test('M4: § Copy\'s words — the three statuses, Checking…, their explanations, and the link', async () => {
  const { COPY } = await vm();
  const want = {
    nip05Verified: 'Verified',
    nip05Invalid: 'Not valid',
    nip05Unchecked: "Couldn't check",
    nip05Checking: 'Checking…',
    nip05VerifiedTitle: 'Its domain confirms this NIP-05 belongs to this profile.',
    nip05InvalidTitle: "Its domain doesn't list this NIP-05 for this profile.",
    nip05UncheckedTitle: "Its domain didn't answer, so this NIP-05 couldn't be checked.",
    viewProfile: 'View profile',
  };
  const wrong = Object.entries(want).filter(([k, v]) => typeof COPY[k] !== 'string' || plain(COPY[k]) !== v).map(([k, v]) => `COPY.${k} should be ${show(v)}, got ${show(COPY[k])}`);
  const label = typeof COPY.viewProfileLabel === 'function' ? COPY.viewProfileLabel('Ava') : null;
  if (label !== 'View profile of Ava (opens in a new tab)') wrong.push(`COPY.viewProfileLabel('Ava') should be "View profile of Ava (opens in a new tab)" (ADR 0004 sub-decision 5), got ${show(label)}`);
  for (const k of ['nip05Unchecked', 'nip05InvalidTitle', 'nip05UncheckedTitle']) if (typeof COPY[k] === 'string' && /'/.test(COPY[k])) wrong.push(`COPY.${k} must use a curly apostrophe`);
  assert(wrong.length === 0, wrong.join(NL + '        '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// S — sentinels
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('S1: the two new page files exist and hold no 64-hex literal', () => {
  for (const f of ['Nip05Status.jsx', 'ProfileLink.jsx']) {
    const src = safeRead(path.join(PAGE_DIR, f));
    assert(src, `ui/src/pages/assistants/${f} does not exist (ADR 0004 § Implementation notes)`);
    assert(!/[0-9a-f]{64}/i.test(src), `${f} has a 64-hex literal`);
  }
});

test('S2: openapi documents GET /api/nip05/verify with its status', () => {
  const src = safeRead(OPENAPI);
  const at = src.indexOf('/api/nip05/verify:');
  assert(at >= 0, `${rel(OPENAPI)} should document /api/nip05/verify (ADR 0004 § Implementation notes)`);
  const block = src.slice(at, at + 2500);
  for (const word of ['verified', 'status', 'unchecked', 'invalid']) assert(block.includes(word), `the /api/nip05/verify entry should mention ${word}`);
});

async function run() {
  console.log(`${NL}=== my-assistants-nip05 (my-assistants #4) ===`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}my-assistants-nip05: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
