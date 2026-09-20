'use strict';
/**
 * Regression: NIP-05 verification must classify a host before it talks to it.
 *
 * Story: engineering-team/stories/done/nip05-ssrf-guard/1-shared-pre-fetch-address-guard.md
 * Book:  engineering-team/audits/nip05-ssrf-guard/book.md
 *
 * NIP-05 verification takes a domain out of user-supplied input and fetches
 * https://<domain>/.well-known/nostr.json from the server. Three byte-identical copies of
 * that fetch exist (src/api/nip05.js, src/api/search/profiles/meili/index.js,
 * src/api/admin/index.js) and none of them classified the address first, so the request
 * could be aimed at hosts only the server can reach.
 *
 * Five hermetic surfaces, no live stack and no real network or DNS:
 *   A. The address predicate over literals — pure, no I/O.
 *   B. Hostname classification — an isolated copy of the guard is loaded against a stub
 *      DNS resolver, so a hostname's answer is whatever the test says it is.
 *   C. The three call sites — global fetch is spied on; a non-public domain must produce
 *      ZERO outbound requests and the same null the callers already return on failure.
 *   D. Redirects — ratified at the Planning gate as "refuse them all": the request is made
 *      with redirect:'manual' and any 3xx is a failed lookup.
 *   E. Fail-closed — DNS error, empty answer, empty host all reject.
 *
 * Pre-fix: A and B cannot even load the guard (it does not exist); C sees a real outbound
 * request for 10.0.0.5; D sees redirect following left at its default. Post-fix: all green.
 */

const path = require('path');
const REPO = path.resolve(__dirname, '..');
const GUARD = path.join(REPO, 'src/utils/ssrfGuard.js');

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// The guard under test. Missing pre-fix — each test then fails with its own readable
// message instead of the whole suite dying at load.
let guard = null;
let guardLoadError = null;
try { guard = require(GUARD); } catch (err) { guardLoadError = err.message.split('\n')[0]; }
function needGuard() {
  assert(guard, `src/utils/ssrfGuard.js must exist and be requirable (${guardLoadError})`);
  return guard;
}

/**
 * Load a SECOND, throwaway copy of the guard whose DNS resolver is `lookupStub`.
 *
 * The guard captures dns.promises.lookup in a load-time destructure, so patching the
 * module, requiring a fresh copy, then restoring both the patch and the require cache
 * leaves the real guard — the one the call sites hold — completely untouched. The gate
 * loads every suite up front and runs them in one process, so a permanent monkeypatch
 * here would silently follow every later suite around.
 */
function guardWithDns(lookupStub) {
  const dns = require('dns');
  const realLookup = dns.promises.lookup;
  dns.promises.lookup = lookupStub;
  const saved = require.cache[GUARD];
  delete require.cache[GUARD];
  try {
    return require(GUARD);
  } finally {
    delete require.cache[GUARD];
    if (saved) require.cache[GUARD] = saved;
    dns.promises.lookup = realLookup;
  }
}
const answers = (...addrs) => async () => addrs.map((address) => ({
  address, family: address.includes(':') ? 6 : 4,
}));

// ── A. the address predicate over literals ──────────────────────────────────

const NON_PUBLIC_V4 = [
  ['0.0.0.0', 'this-network 0/8'], ['0.1.2.3', 'this-network 0/8'],
  ['10.0.0.5', 'private 10/8'], ['10.255.255.254', 'private 10/8'],
  ['100.64.0.1', 'CGNAT 100.64/10'], ['100.127.255.255', 'CGNAT 100.64/10'],
  ['127.0.0.1', 'loopback 127/8'], ['127.1.2.3', 'loopback 127/8'],
  ['169.254.169.254', 'link-local 169.254/16'], ['169.254.0.1', 'link-local 169.254/16'],
  ['172.16.0.1', 'private 172.16/12'], ['172.31.255.254', 'private 172.16/12'],
  ['192.0.0.1', 'IETF protocol 192.0.0/24'],
  ['192.0.2.1', 'documentation 192.0.2/24'],
  ['192.168.1.50', 'private 192.168/16'], ['192.168.255.1', 'private 192.168/16'],
  ['198.18.0.1', 'benchmarking 198.18/15'], ['198.19.255.254', 'benchmarking 198.18/15'],
  ['198.51.100.7', 'documentation 198.51.100/24'],
  ['203.0.113.7', 'documentation 203.0.113/24'],
  ['224.0.0.1', 'multicast 224/4'], ['239.1.2.3', 'multicast 224/4'],
  ['240.0.0.1', 'reserved 240/4'], ['255.255.255.255', 'broadcast'],
];
const PUBLIC_V4 = ['1.1.1.1', '8.8.8.8', '93.184.216.34', '172.15.255.255', '172.32.0.1',
  '100.63.255.255', '100.128.0.1', '11.0.0.1', '192.167.1.1', '192.169.1.1', '169.253.0.1',
  '198.17.255.255', '198.20.0.1', '223.255.255.255'];

test('A1: every non-public IPv4 literal is rejected', () => {
  const g = needGuard();
  const admitted = NON_PUBLIC_V4.filter(([ip]) => g.isPublicAddress(ip)).map(([ip, why]) => `${ip} (${why})`);
  assert(admitted.length === 0,
    `these non-public IPv4 addresses were admitted: ${admitted.join(', ')}`);
});

test('A2: public IPv4 literals are allowed (the guard is not a blanket deny)', () => {
  const g = needGuard();
  const refused = PUBLIC_V4.filter((ip) => !g.isPublicAddress(ip));
  assert(refused.length === 0, `these public IPv4 addresses were refused: ${refused.join(', ')}`);
});

const NON_PUBLIC_V6 = [
  ['::', 'unspecified'], ['0:0:0:0:0:0:0:0', 'unspecified, expanded'],
  ['::1', 'loopback'], ['0:0:0:0:0:0:0:1', 'loopback, expanded'],
  ['fe80::1', 'link-local fe80::/10'], ['febf::1', 'link-local fe80::/10'],
  ['fe80:0:0:0:0:0:0:1', 'link-local, expanded'],
  ['fc00::1', 'ULA fc00::/7'], ['fd12:3456:789a::1', 'ULA fc00::/7'],
  ['ff02::1', 'multicast ff00::/8'], ['ff00::', 'multicast ff00::/8'],
  ['2001:db8::1', 'documentation 2001:db8::/32'],
  ['2001:0db8:0000:0000:0000:0000:0000:0001', 'documentation, expanded'],
];
const PUBLIC_V6 = ['2606:4700:4700::1111', '2001:4860:4860::8888', '2a00:1450:4001:80e::200e',
  '2001:db9::1', 'fb00::1', '2600::1'];

test('A3: every non-public IPv6 literal is rejected, compressed and expanded', () => {
  const g = needGuard();
  const admitted = NON_PUBLIC_V6.filter(([ip]) => g.isPublicAddress(ip)).map(([ip, why]) => `${ip} (${why})`);
  assert(admitted.length === 0,
    `these non-public IPv6 addresses were admitted: ${admitted.join(', ')}`);
});

test('A4: public IPv6 literals are allowed', () => {
  const g = needGuard();
  const refused = PUBLIC_V6.filter((ip) => !g.isPublicAddress(ip));
  assert(refused.length === 0, `these public IPv6 addresses were refused: ${refused.join(', ')}`);
});

const EMBEDDED_V4 = [
  ['::ffff:10.0.0.5', 'IPv4-mapped, private'],
  ['::ffff:127.0.0.1', 'IPv4-mapped, loopback'],
  ['::ffff:169.254.169.254', 'IPv4-mapped, link-local'],
  ['::ffff:a00:5', 'IPv4-mapped in hex notation, private'],
  ['::127.0.0.1', 'IPv4-compatible, loopback'],
  ['::10.0.0.5', 'IPv4-compatible, private'],
  ['64:ff9b::169.254.169.254', 'NAT64, link-local'],
  ['64:ff9b::a00:5', 'NAT64 in hex notation, private'],
];

test('A5: an IPv4 address embedded in IPv6 is unwrapped and re-classified', () => {
  const g = needGuard();
  const admitted = EMBEDDED_V4.filter(([ip]) => g.isPublicAddress(ip)).map(([ip, why]) => `${ip} (${why})`);
  assert(admitted.length === 0,
    `these embedded-IPv4 addresses were admitted without unwrapping: ${admitted.join(', ')}`);
  assert(g.isPublicAddress('::ffff:93.184.216.34'),
    'an IPv4-mapped PUBLIC address must still be allowed — unwrapping must not become a blanket deny');
});

test('A6: a string that is not an IP address at all is rejected', () => {
  const g = needGuard();
  const junk = ['', '   ', 'example.com', '999.1.1.1', '10.0.0', '10.0.0.5.6', 'fe80::zz',
    '0x7f.0.0.1', '2130706433', null, undefined, 42, {}];
  const admitted = junk.filter((v) => g.isPublicAddress(v)).map((v) => JSON.stringify(v));
  assert(admitted.length === 0,
    `these non-addresses were admitted: ${admitted.join(', ')} — the predicate must only ever say yes to a parsed public IP`);
});

// ── B. hostname classification ──────────────────────────────────────────────

test('B1: a hostname whose DNS answer is a private address is rejected', async () => {
  needGuard();
  const g = guardWithDns(answers('10.0.0.5'));
  assert((await g.isPublicHostname('db.example.com')) === false,
    'a hostname resolving to 10.0.0.5 must be rejected');
});

test('B2: a hostname whose answer is public is allowed', async () => {
  needGuard();
  const g = guardWithDns(answers('93.184.216.34'));
  assert((await g.isPublicHostname('example.com')) === true,
    'a hostname resolving to a public address must be allowed');
});

test('B3: EVERY address in the answer is inspected, not just the first', async () => {
  needGuard();
  const g = guardWithDns(answers('93.184.216.34', '10.0.0.5'));
  assert((await g.isPublicHostname('split.example.com')) === false,
    'a hostname answering one public and one private address must be rejected — checking only the first address is the bug');
  const g2 = guardWithDns(answers('2606:4700:4700::1111', '::1'));
  assert((await g2.isPublicHostname('split6.example.com')) === false,
    'the same must hold for a mixed IPv6 answer');
});

test('B4: an IP literal host is classified directly, with no DNS round trip', async () => {
  needGuard();
  let looked = 0;
  const g = guardWithDns(async () => { looked++; return [{ address: '93.184.216.34', family: 4 }]; });
  assert((await g.isPublicHostname('169.254.169.254')) === false,
    'a literal link-local host must be rejected');
  assert((await g.isPublicHostname('[::1]')) === false,
    'a bracketed IPv6 literal (the form URL.hostname yields) must be unbracketed and rejected');
  assert(looked === 0,
    `an IP literal must never be sent to the resolver; the stub was called ${looked} time(s)`);
});

test('B5: private host suffixes are rejected without a DNS round trip', async () => {
  const g = needGuard();
  const priv = ['nas.local', 'db.internal', 'printer.home.arpa', 'host.localhost', 'localhost'];
  const admitted = priv.filter((h) => !g.hasPrivateHostSuffix(h));
  assert(admitted.length === 0,
    `these private-suffix hosts were not recognised: ${admitted.join(', ')}`);
  const pub = ['example.com', 'brainstorm.world', 'internal-affairs.org', 'localhost.example.com'];
  const refused = pub.filter((h) => g.hasPrivateHostSuffix(h));
  assert(refused.length === 0,
    `these public hostnames were misread as private suffixes: ${refused.join(', ')}`);

  let looked = 0;
  const g2 = guardWithDns(async () => { looked++; return [{ address: '93.184.216.34', family: 4 }]; });
  assert((await g2.isPublicHostname('db.internal')) === false, 'db.internal must be rejected');
  assert(looked === 0, `a private-suffix host must not be sent to the resolver; called ${looked} time(s)`);
});

test('B6: classification is done on the RESOLVED address, not on the spelling of the host', async () => {
  needGuard();
  // Alternate IPv4 encodings — octal, hex, short-form, decimal, and the nip.io
  // style of embedding an address in a real DNS name — are what a string-matching
  // guard misses. They are handled here by construction: the guard asks the SAME
  // resolver fetch will ask, then classifies the answer. Verified against the real
  // getaddrinfo on 2026-09-20: `0x7f.0.0.1`, `127.1`, `0xa.0.0.5`, `010.0.0.5` and
  // `127.0.0.1.nip.io` all resolve to a private address and are all rejected.
  //
  // This test pins the INTENT with a stub, because which of those spellings a
  // platform's getaddrinfo accepts differs between macOS and Linux — asserting the
  // spellings themselves would be a CI flake. What must never change is that the
  // answer, not the input string, is what gets classified.
  const spellings = ['0x7f.0.0.1', '127.1', '010.0.0.5', '127.0.0.1.nip.io', 'sneaky.example.com'];
  for (const host of spellings) {
    const g = guardWithDns(answers('127.0.0.1'));
    assert((await g.isPublicHostname(host)) === false,
      `${host} resolves to 127.0.0.1 and must be rejected — a guard that pattern-matches the input string instead of classifying the answer is the bug this pins`);
  }
  // …and the converse: an odd-looking spelling that resolves somewhere public is fine.
  const g = guardWithDns(answers('93.184.216.34'));
  assert((await g.isPublicHostname('0177.0.0.1')) === true,
    'a host whose resolver answer is public must be allowed however it is spelled — the guard follows the resolver, it does not second-guess it');
});

// ── C. the three call sites ─────────────────────────────────────────────────

function withFetchSpy(impl) {
  const calls = [];
  const real = global.fetch;
  global.fetch = async (url, opts) => { calls.push({ url: String(url), opts }); return impl(String(url), opts); };
  return { calls, restore() { global.fetch = real; } };
}
const okBody = (pubkey) => ({
  ok: true, status: 200,
  json: async () => ({ names: { alice: pubkey, _: pubkey } }),
});
const PUBKEY = 'b'.repeat(64);

function callSites() {
  const nip05 = require(path.join(REPO, 'src/api/nip05.js'));
  const admin = require(path.join(REPO, 'src/api/admin/index.js'));
  const meili = require(path.join(REPO, 'src/api/search/profiles/meili/index.js'));
  return [
    ['src/api/nip05.js verifyNip05Identifier (unauthenticated GET /api/nip05/verify)', nip05.verifyNip05Identifier],
    ['src/api/admin/index.js verifyNip05', admin.verifyNip05],
    ['src/api/search/profiles/meili/index.js verifyNip05', meili.verifyNip05],
  ];
}

test('C1: a non-public domain produces ZERO outbound requests at all three call sites', async () => {
  const spy = withFetchSpy(() => okBody(PUBKEY));
  try {
    for (const [label, fn] of callSites()) {
      assert(typeof fn === 'function',
        `${label} must be exported so this behaviour can be tested (got ${typeof fn})`);
      for (const domain of ['10.0.0.5', '127.0.0.1', '169.254.169.254', '192.168.1.50', 'db.internal']) {
        spy.calls.length = 0;
        const out = await fn(`alice@${domain}`);
        assert(spy.calls.length === 0,
          `${label}: a lookup for ${domain} must not leave the process; it made ${spy.calls.length} request(s): ${spy.calls.map((c) => c.url).join(', ')}`);
        assert(out === null,
          `${label}: a rejected lookup for ${domain} must return null, exactly as a failed lookup does today; got ${JSON.stringify(out)}`);
      }
    }
  } finally { spy.restore(); }
});

test('C2: a public domain still verifies — the guard did not break the feature', async () => {
  const spy = withFetchSpy(() => okBody(PUBKEY));
  try {
    for (const [label, fn] of callSites()) {
      assert(typeof fn === 'function', `${label} must be exported (got ${typeof fn})`);
      spy.calls.length = 0;
      const out = await fn('alice@93.184.216.34');
      assert(spy.calls.length === 1,
        `${label}: a public domain must still be fetched exactly once; got ${spy.calls.length}`);
      assert(spy.calls[0].url === 'https://93.184.216.34/.well-known/nostr.json?name=alice',
        `${label}: the request URL must be unchanged; got ${spy.calls[0].url}`);
      assert(out === PUBKEY,
        `${label}: a public domain's attested pubkey must come back unchanged; got ${JSON.stringify(out)}`);
    }
  } finally { spy.restore(); }
});

test('C3: GET /api/nip05/verify answers verified:false for a non-public domain', async () => {
  const { handleNip05Verify } = require(path.join(REPO, 'src/api/nip05.js'));
  const spy = withFetchSpy(() => okBody(PUBKEY));
  try {
    const res = { body: undefined, set() { return this; }, json(o) { this.body = o; return this; } };
    await handleNip05Verify({ query: { nip05: 'alice@169.254.169.254', pubkey: PUBKEY } }, res);
    assert(spy.calls.length === 0,
      `the unauthenticated endpoint must make no outbound request for a non-public domain; it made ${spy.calls.length}`);
    assert(res.body && res.body.verified === false,
      `the endpoint's contract is unchanged — a rejected lookup is { verified: false }; got ${JSON.stringify(res.body)}`);
  } finally { spy.restore(); }
});

// ── D. redirects (Planning gate: refuse them all) ───────────────────────────

test('D1: the request is made with redirect:"manual" so no response can steer a second one', async () => {
  const spy = withFetchSpy(() => okBody(PUBKEY));
  try {
    for (const [label, fn] of callSites()) {
      assert(typeof fn === 'function', `${label} must be exported (got ${typeof fn})`);
      spy.calls.length = 0;
      await fn('alice@93.184.216.34');
      assert(spy.calls.length === 1, `${label}: expected one request, got ${spy.calls.length}`);
      const opts = spy.calls[0].opts || {};
      assert(opts.redirect === 'manual',
        `${label}: the fetch must pass redirect:'manual' — otherwise a 302 from a public host aims the next request wherever it likes; got ${JSON.stringify(opts.redirect)}`);
      assert(opts.signal, `${label}: the existing 5s abort signal must still be passed`);
    }
  } finally { spy.restore(); }
});

test('D2: a 3xx response is a failed lookup, not a hop', async () => {
  for (const status of [301, 302, 303, 307, 308]) {
    const spy = withFetchSpy(() => ({
      ok: false, status,
      headers: { get: (h) => (h.toLowerCase() === 'location' ? 'http://169.254.169.254/.well-known/nostr.json' : null) },
      json: async () => ({ names: { alice: PUBKEY } }),
    }));
    try {
      for (const [label, fn] of callSites()) {
        assert(typeof fn === 'function', `${label} must be exported (got ${typeof fn})`);
        spy.calls.length = 0;
        const out = await fn('alice@93.184.216.34');
        assert(out === null,
          `${label}: a ${status} must be treated as a failed lookup; got ${JSON.stringify(out)}`);
        assert(spy.calls.length === 1,
          `${label}: a ${status} must not be followed; ${spy.calls.length} request(s) were made`);
      }
    } finally { spy.restore(); }
  }
});

// ── E. fail-closed ──────────────────────────────────────────────────────────

test('E1: a DNS error rejects', async () => {
  needGuard();
  const g = guardWithDns(async () => { const e = new Error('getaddrinfo ENOTFOUND'); e.code = 'ENOTFOUND'; throw e; });
  assert((await g.isPublicHostname('nope.example.com')) === false,
    'an unresolvable host must reject, not throw and not pass');
});

test('E2: an empty DNS answer rejects', async () => {
  needGuard();
  const g = guardWithDns(async () => []);
  assert((await g.isPublicHostname('empty.example.com')) === false,
    'an empty answer must reject — nothing was proven public');
  const g2 = guardWithDns(async () => null);
  assert((await g2.isPublicHostname('null.example.com')) === false,
    'a null answer must reject');
});

test('E3: an empty or malformed host rejects without reaching the resolver', async () => {
  needGuard();
  let looked = 0;
  const g = guardWithDns(async () => { looked++; return [{ address: '93.184.216.34', family: 4 }]; });
  for (const h of ['', '   ', null, undefined, 42, {}]) {
    assert((await g.isPublicHostname(h)) === false,
      `an empty/malformed host (${JSON.stringify(h)}) must reject`);
  }
  assert(looked === 0, `a malformed host must not reach the resolver; called ${looked} time(s)`);
});

test('E4: the guard never throws out to a caller — every rejection is a return value', async () => {
  needGuard();
  const g = guardWithDns(async () => { throw new Error('resolver exploded'); });
  let threw = null;
  try { await g.isPublicHostname('boom.example.com'); } catch (err) { threw = err.message; }
  assert(threw === null,
    `isPublicHostname must swallow resolver failures and return false; it threw "${threw}". Each call site's catch already maps a throw to null, but the guard is the layer that must fail closed.`);
});

async function run() {
  console.log('\n=== nip05-ssrf-guard (nip05-ssrf-guard #1) ===');
  let pass = 0, fail = 0;
  const skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\nnip05-ssrf-guard: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
