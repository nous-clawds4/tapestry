/**
 * profile-lookup-bounds #1: author names must resolve on pages with many distinct authors.
 *
 * Story: engineering-team/stories/profile-lookup-bounds/1-resolve-author-names-at-any-scale.md
 * ADR:   engineering-team/decisions/profile-lookup-bounds/0001-chunk-at-the-cap-in-the-shared-hook.md
 *
 * The bug: useProfiles puts a page's whole pubkey set into one
 * GET /api/profiles?pubkeys=<csv>. The endpoint refuses more than 50, the hook
 * swallows the refusal, and author cells fall back to truncated pubkeys.
 * Measured on :7778 2026-09-20 — /tapestry/lists/items asks for 246 authors in a
 * 16,032-byte URL and gets a 400; 288 cells render as truncated pubkeys.
 *
 * TEST LEVEL — there is no jsdom in this repo (ADR graph-curation-ui/0001), and `react`
 * is not resolvable from the repo root, so ui/src/hooks/useProfiles.js CANNOT be imported
 * by a test. The chunking core therefore has to live in a React-free module to be
 * executable at all. That is the same move ADR graph-curation-ui/0002 made for the same
 * reason (ui/src/utils/authorDisplay.js).
 *
 * Seam pinned by this plan (a refinement of the ADR's implementation notes, named here so
 * the Implementer is not guessing):
 *
 *   // ui/src/utils/profileBatch.js   — must NOT import react
 *   export const PROFILE_CHUNK = 50;
 *   export const PROFILE_LOOKUP_FAILED = Object.freeze({ __lookupFailed: true });
 *   export async function fetchProfilesChunked(pubkeys, {
 *     fetchImpl,                    // defaults to globalThis.fetch
 *     chunkSize = PROFILE_CHUNK,
 *     onBatch,                      // (partialProfiles) => void, after each batch
 *     isCancelled,                  // () => boolean, checked before each batch
 *   } = {})
 *   // resolves to a plain object: { [pubkey]: profile | null | PROFILE_LOOKUP_FAILED }
 *
 * useProfiles then becomes a thin React wrapper over it, and AuthorCell imports the
 * sentinel from the same module.
 *
 * Classes:
 *   C (chunking) — EXECUTED against the pure seam with an injected fetch. This is where
 *                  AC1-AC4 are actually proved. FAIL until ui/src/utils/profileBatch.js
 *                  exists.
 *   S (source)   — structural pins on the wiring the ADR names (hook, AuthorCell,
 *                  endpoint). FAIL until implemented.
 *   E (endpoint) — live HTTP against /api/profiles. SKIP when the stack is absent.
 *                  E1 passes today; E2 fails until the refusal carries its remedy.
 *   R (regression) — green BEFORE and AFTER. These exist to catch the Implementer
 *                  breaking working behavior while fixing the request shape.
 *
 * DELIBERATELY NOT TESTED — a request past the ~16 KB request-head ceiling. Node refuses
 * it beneath Express (431, empty body); the handler never runs, so no assertion about the
 * endpoint's response is possible. AC5 is scoped to requests the endpoint actually
 * handles, and C12 covers the real guarantee: first-party code never emits such a URL.
 *
 * EXPECTED NOW (pre-implementation): every C and S test FAILS; E1 PASSES and E2/E3 FAIL;
 * every R test PASSES. Live tests SKIP when the stack is absent.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const BATCH_JS = path.join(ROOT, 'ui/src/utils/profileBatch.js');
const USE_PROFILES = path.join(ROOT, 'ui/src/hooks/useProfiles.js');
const AUTHOR_CELL = path.join(ROOT, 'ui/src/components/AuthorCell.jsx');
const FETCH_PROFILES = path.join(ROOT, 'src/api/profiles/fetchProfiles.js');
const BASE = process.env.TAPESTRY_BASE || 'http://localhost:7778';

// Node's default request-head ceiling. A URL at or past this is refused below Express.
const HEADER_CEILING = 16384;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
async function loadEsm(p) { try { return await import(pathToFileURL(p).href); } catch { return null; } }

const NOT_BUILT =
  'ui/src/utils/profileBatch.js must export fetchProfilesChunked(pubkeys, opts), ' +
  'PROFILE_CHUNK and PROFILE_LOOKUP_FAILED — not implemented yet (ADR profile-lookup-bounds/0001).';

async function batchMod() {
  const mod = await loadEsm(BATCH_JS);
  assert(mod && typeof mod.fetchProfilesChunked === 'function', NOT_BUILT);
  return mod;
}

/** Deterministic 64-hex fixture pubkeys. */
function pubkeys(n, seed = 0) {
  return Array.from({ length: n }, (_, i) => (seed + i + 1).toString(16).padStart(64, '0'));
}

/**
 * A stub fetch that records every call. `plan` maps a 0-based batch index to
 * 'ok' | 'reject' | 'unsuccessful' | 'bodiless'. Anything unlisted is 'ok'.
 */
function stubFetch(plan = {}) {
  const calls = [];
  const impl = async (url) => {
    const idx = calls.length;
    const asked = new URL(url, 'http://x').searchParams.get('pubkeys');
    const list = asked ? asked.split(',') : [];
    calls.push({ url: String(url), pubkeys: list, bytes: Buffer.byteLength(String(url), 'utf8') });
    const mode = plan[idx] || 'ok';
    if (mode === 'reject') throw new Error('network down');
    if (mode === 'unsuccessful') {
      return { ok: false, status: 400, json: async () => ({ success: false, error: 'max 50 pubkeys per request' }) };
    }
    if (mode === 'bodiless') {
      // The 431 shape: no body at all, so .json() throws.
      return { ok: false, status: 431, json: async () => { throw new SyntaxError('Unexpected end of JSON input'); } };
    }
    const profiles = {};
    for (const pk of list) profiles[pk] = { name: 'name-' + pk.slice(-4) };
    return { ok: true, status: 200, json: async () => ({ success: true, profiles }) };
  };
  return { impl, calls };
}

/* ── C: the chunking core, executed ───────────────────────────────────────── */

test('C1 (AC1): 246 authors — the live List Items figure — all resolve, and no request exceeds the cap', async () => {
  const { fetchProfilesChunked } = await batchMod();
  const pks = pubkeys(246);
  const { impl, calls } = stubFetch();
  const out = await fetchProfilesChunked(pks, { fetchImpl: impl });
  const unresolved = pks.filter(pk => !out[pk] || !out[pk].name);
  assert(unresolved.length === 0,
    `AC-1: all 246 authors must resolve; ${unresolved.length} did not (first: ${unresolved[0]})`);
  const oversized = calls.filter(c => c.pubkeys.length > 50);
  assert(oversized.length === 0,
    `AC-1: no request may ask for more than 50 pubkeys; ${oversized.length} did ` +
    `(largest ${Math.max(0, ...calls.map(c => c.pubkeys.length))}) — this is the 400 the page hits today`);
});

test('C2 (AC2): 1,000 authors resolve in bounded batches, past both ceilings', async () => {
  const { fetchProfilesChunked } = await batchMod();
  const pks = pubkeys(1000);
  const { impl, calls } = stubFetch();
  const out = await fetchProfilesChunked(pks, { fetchImpl: impl });
  assert(Object.keys(out).length === 1000,
    `AC-2: 1,000 authors must all be accounted for; got ${Object.keys(out).length}`);
  assert(calls.length === 20,
    `AC-2: 1,000 pubkeys at a cap of 50 is 20 requests; got ${calls.length}`);
  const oversized = calls.filter(c => c.pubkeys.length > 50);
  assert(oversized.length === 0, `AC-2: ${oversized.length} request(s) exceeded the 50-pubkey cap`);
});

test('C3 (AC3): 50 authors — at the cap — go out as exactly one request', async () => {
  const { fetchProfilesChunked } = await batchMod();
  const { impl, calls } = stubFetch();
  await fetchProfilesChunked(pubkeys(50), { fetchImpl: impl });
  assert(calls.length === 1,
    `AC-3: a page at or under the cap must behave exactly as today — one request; got ${calls.length}`);
  assert(calls[0].pubkeys.length === 50, `AC-3: that one request must carry all 50; got ${calls[0].pubkeys.length}`);
});

test('C4 (AC3): a single author still costs a single request', async () => {
  const { fetchProfilesChunked } = await batchMod();
  const { impl, calls } = stubFetch();
  const [pk] = pubkeys(1);
  const out = await fetchProfilesChunked([pk], { fetchImpl: impl });
  assert(calls.length === 1, `AC-3: one pubkey is one request; got ${calls.length}`);
  assert(out[pk] && out[pk].name, 'AC-3: the single author must resolve');
});

test('C5 (AC4): a batch that throws marks ONLY its own pubkeys failed; the rest still resolve', async () => {
  const { fetchProfilesChunked, PROFILE_LOOKUP_FAILED } = await batchMod();
  const pks = pubkeys(150);                       // 3 batches
  const { impl } = stubFetch({ 1: 'reject' });    // the middle one fails
  const out = await fetchProfilesChunked(pks, { fetchImpl: impl });
  const failed = pks.filter(pk => out[pk] === PROFILE_LOOKUP_FAILED);
  assert(failed.length === 50,
    `AC-4: exactly the failed batch's 50 pubkeys must be marked unavailable; got ${failed.length}`);
  const firstBatchOk = pks.slice(0, 50).every(pk => out[pk] && out[pk].name);
  const lastBatchOk = pks.slice(100).every(pk => out[pk] && out[pk].name);
  assert(firstBatchOk && lastBatchOk,
    'AC-4: one bad batch must cost only its own 50 — the other batches must still resolve');
});

test('C6 (AC4): a 400 carrying success:false marks its pubkeys failed rather than being swallowed', async () => {
  const { fetchProfilesChunked, PROFILE_LOOKUP_FAILED } = await batchMod();
  const pks = pubkeys(50);
  const { impl } = stubFetch({ 0: 'unsuccessful' });
  const out = await fetchProfilesChunked(pks, { fetchImpl: impl });
  const failed = pks.filter(pk => out[pk] === PROFILE_LOOKUP_FAILED);
  assert(failed.length === 50,
    `AC-4: today the hook returns early on !data.success and the failure is invisible; ` +
    `all 50 must now be marked unavailable, got ${failed.length}`);
});

test('C7 (AC4): a bodiless rejection — the 431 shape — is reported, not swallowed by the JSON parse', async () => {
  const { fetchProfilesChunked, PROFILE_LOOKUP_FAILED } = await batchMod();
  const pks = pubkeys(50);
  const { impl } = stubFetch({ 0: 'bodiless' });
  const out = await fetchProfilesChunked(pks, { fetchImpl: impl });
  const failed = pks.filter(pk => out[pk] === PROFILE_LOOKUP_FAILED);
  assert(failed.length === 50,
    `AC-4: a response whose body cannot be parsed must still surface as a failure; got ${failed.length}. ` +
    `Today .json() throws into a console.warn and the operator sees nothing.`);
});

test('C8 (AC4): "no profile published" stays distinguishable from "lookup failed"', async () => {
  const { fetchProfilesChunked, PROFILE_LOOKUP_FAILED } = await batchMod();
  const [absent] = pubkeys(1, 900);
  const impl = async (url) => {
    const list = new URL(url, 'http://x').searchParams.get('pubkeys').split(',');
    return { ok: true, status: 200, json: async () => ({ success: true, profiles: Object.fromEntries(list.map(pk => [pk, null])) }) };
  };
  const out = await fetchProfilesChunked([absent], { fetchImpl: impl });
  assert(out[absent] === null,
    `AC-4: a pubkey the server searched and did not find must stay null, not the failure sentinel — ` +
    `otherwise every profile-less author reads as an error. Got ${String(out[absent])}`);
  assert(out[absent] !== PROFILE_LOOKUP_FAILED, 'AC-4: null and the failure sentinel must not collapse');
});

test('C9: batches merge progressively — onBatch fires per batch, not once at the end', async () => {
  const { fetchProfilesChunked } = await batchMod();
  const seen = [];
  const { impl } = stubFetch();
  await fetchProfilesChunked(pubkeys(150), { fetchImpl: impl, onBatch: (partial) => seen.push(Object.keys(partial).length) });
  assert(seen.length === 3,
    `progressive merge: onBatch must fire once per batch so names fill in as they arrive; fired ${seen.length} time(s)`);
});

test('C10: cancellation stops further requests', async () => {
  const { fetchProfilesChunked } = await batchMod();
  const { impl, calls } = stubFetch();
  let done = false;
  await fetchProfilesChunked(pubkeys(500), { fetchImpl: impl, isCancelled: () => done, onBatch: () => { done = true; } });
  assert(calls.length < 10,
    `cancellation: an unmounted component must stop the remaining batches; ${calls.length} requests were issued after cancel`);
});

test('C11: an empty pubkey list issues no request at all', async () => {
  const { fetchProfilesChunked } = await batchMod();
  const { impl, calls } = stubFetch();
  const out = await fetchProfilesChunked([], { fetchImpl: impl });
  assert(calls.length === 0, `empty input must not hit the network; ${calls.length} request(s) issued`);
  assert(out && Object.keys(out).length === 0, 'empty input must resolve to an empty plain object');
});

test('C12 (AC5): no emitted URL comes near the request-head ceiling', async () => {
  const { fetchProfilesChunked } = await batchMod();
  const { impl, calls } = stubFetch();
  await fetchProfilesChunked(pubkeys(1000), { fetchImpl: impl });
  const worst = Math.max(...calls.map(c => c.bytes));
  assert(worst < HEADER_CEILING / 2,
    `AC-5: the real guarantee is that first-party code never emits a URL the HTTP layer will ` +
    `refuse bodilessly. Largest URL was ${worst} bytes against a ${HEADER_CEILING}-byte ceiling.`);
});

/* ── S: the wiring the ADR names ──────────────────────────────────────────── */

test('S1: useProfiles no longer builds one unbounded querystring', () => {
  const src = safeRead(USE_PROFILES) || '';
  assert(!/pubkeys=\$\{needed\.join\(','\)\}/.test(src),
    'S1: ui/src/hooks/useProfiles.js:49 still sends every pubkey in one request — this is the defect');
});

test('S2: useProfiles delegates to the pure chunker', () => {
  const src = safeRead(USE_PROFILES) || '';
  assert(/fetchProfilesChunked/.test(src) && /profileBatch/.test(src),
    'S2: useProfiles must import fetchProfilesChunked from ui/src/utils/profileBatch.js (ADR 0001)');
});

test('S3: the batch size is one exported constant, not a scattered literal', async () => {
  const mod = await loadEsm(BATCH_JS);
  assert(mod && mod.PROFILE_CHUNK === 50,
    `S3: profileBatch.js must export PROFILE_CHUNK = 50 (the endpoint's own cap); got ${mod && mod.PROFILE_CHUNK}`);
});

test('S4: a failed lookup is never written to the client cache', () => {
  const src = safeRead(USE_PROFILES) || '';
  const cacheWrites = src.match(/clientCache\.set\([^)]*\)/g) || [];
  assert(cacheWrites.length > 0, 'S4: the client cache must still be written for real results');
  assert(!cacheWrites.some(w => /PROFILE_LOOKUP_FAILED/.test(w)),
    'S4: caching a transient failure makes it permanent — the sentinel must not reach clientCache (ADR 0001)');
  assert(/PROFILE_LOOKUP_FAILED/.test(src),
    'S4: useProfiles must know the sentinel in order to keep it out of the cache');
});

test('S5 (AC4): AuthorCell renders the unavailable state instead of a bare truncated pubkey', () => {
  const src = safeRead(AUTHOR_CELL) || '';
  assert(/PROFILE_LOOKUP_FAILED/.test(src),
    'S5: ui/src/components/AuthorCell.jsx must branch on the sentinel — this is what gives 31 pages ' +
    'the AC-4 signal without editing a single call site (the ta-avatar/0001 lever)');
});

test('S6: the server cap is a named constant, not a literal buried in the guard', () => {
  const src = safeRead(FETCH_PROFILES) || '';
  assert(/(const|let)\s+MAX_[A-Z_]*\s*=\s*50|MAX_PUBKEYS[^=]*=\s*50/.test(src),
    'S6: src/api/profiles/fetchProfiles.js must name its cap (ADR 0001) so client and server can be ' +
    'checked against one number instead of two copies of "50"');
});

test('S7 (AC5): the refusal tells the caller what to do instead', () => {
  const src = safeRead(FETCH_PROFILES) || '';
  assert(/limit:/.test(src) && /hint:/.test(src),
    'S7: the 400 body must carry limit + hint so a caller can self-correct (ADR 0001); ' +
    'today it is a bare error string');
});

/* ── E: the live endpoint ─────────────────────────────────────────────────── */

async function stackPresent() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const r = await fetch(`${BASE}/api/profiles?pubkeys=${'0'.repeat(64)}`, { signal: ctrl.signal });
    clearTimeout(t);
    return r.ok;
  } catch { return false; }
}

const hex = (n) => pubkeys(n).join(',');

test('E1 (live, AC3): a request at the cap succeeds — the contract the client codes against', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const r = await fetch(`${BASE}/api/profiles?pubkeys=${hex(50)}`);
  const body = await r.json();
  assert(r.status === 200 && body.success === true,
    `AC-3: 50 pubkeys must be served; got HTTP ${r.status}`);
});

test('E2 (live, AC5): a request past the cap is refused readably, naming the limit and the remedy', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const r = await fetch(`${BASE}/api/profiles?pubkeys=${hex(51)}`);
  const body = await r.json();
  assert(r.status === 400 && body.success === false, `AC-5: 51 pubkeys must still be refused; got HTTP ${r.status}`);
  assert(body.limit === 50,
    `AC-5: the refusal must name the limit so a caller can self-correct; got limit=${body.limit}`);
  assert(typeof body.hint === 'string' && body.hint.length > 0,
    'AC-5: the refusal must name what to do instead; got no hint');
  assert(body.received === 51,
    `AC-5: the refusal should say how many were asked for; got received=${body.received}`);
});

test('E3 (live): the refusal stays backward-compatible for existing callers', async () => {
  if (!(await stackPresent())) return 'SKIP';
  const r = await fetch(`${BASE}/api/profiles?pubkeys=${hex(51)}`);
  const body = await r.json();
  assert(body.success === false && typeof body.error === 'string' && /50/.test(body.error),
    'E3: the added fields must be additive — success:false and the error string keep their shape');
});

/* ── R: regression sentinels — green before AND after ─────────────────────── */

test('R1: useProfiles still returns a PLAIN OBJECT, never a Map (ADR graph-curation-ui/0002)', () => {
  const src = safeRead(USE_PROFILES) || '';
  assert(/useState\(\{\}\)/.test(src),
    'R1: the hook holds a plain object; a Map here re-opens the crash graph-curation-ui/0002 fixed');
  assert(/return\s+profiles\s*;/.test(src),
    'R1: the hook must return that plain object directly — consumers read it as profiles?.[pubkey]');
  assert(!/return\s+new Map\(/.test(src),
    'R1: the returned value must not become a Map');
});

test('R2: AuthorCell still reads profiles by subscript, never .get()', () => {
  const src = safeRead(AUTHOR_CELL) || '';
  assert(/profiles\?\.\[pubkey\]/.test(src), 'R2: AuthorCell must keep reading profiles?.[pubkey]');
  assert(!/profiles\?\.get\(|profiles\.get\(/.test(src),
    'R2: .get() on the profiles object is the TypeError that killed a whole route');
});

test('R3: AuthorCell still names the Tapestry Assistant when it has published no kind-0', () => {
  const src = safeRead(AUTHOR_CELL) || '';
  assert(/Tapestry Assistant/.test(src) && /taPubkey/.test(src),
    'R3: a fresh instance\'s TA has no kind-0; it must still be named, not shown as a truncated pubkey');
});

test('R4: the five hand-rolled PROFILE_CHUNK pages are left working and still chunk at 50', () => {
  const pages = [
    'ui/src/pages/BrainstormFollowers.jsx', 'ui/src/pages/BrainstormFollows.jsx',
    'ui/src/pages/BrainstormMuters.jsx', 'ui/src/pages/BrainstormReporters.jsx',
    'ui/src/pages/BrainstormFollowsHops.jsx',
  ];
  for (const p of pages) {
    const src = safeRead(path.join(ROOT, p)) || '';
    assert(/PROFILE_CHUNK\s*=\s*50/.test(src),
      `R4: ${p} chunks at 50 today and this story does not touch it — retiring these onto the shared hook is a named follow-up, not this change`);
  }
});

test('R5: getProfiles\' relay + local-fallback behavior is left alone (OPEN.md row 273 is not this story)', () => {
  const src = safeRead(FETCH_PROFILES) || '';
  assert(/FETCH_TIMEOUT_MS/.test(src) && /strfry scan/.test(src),
    'R5: the relay race and the local-strfry fallback belong to the assistant-profile book; do not refactor them here');
});

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${t.name}`); skipped++; }
      else { console.log(`  PASS  ${t.name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${t.name}`);
      console.log(`        ${err.message}`);
      failures.push(t.name); fail++;
    }
  }
  console.log(`\nprofile-lookup-bounds: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
