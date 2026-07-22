/**
 * Unit tests for the receiving-setup HTTP layer (src/api/receiving/*).
 *
 * Covers the API-specific composable pieces, hermetically (literal IPs only, no
 * real DNS / network):
 *   - SSRF guard: IP classification + checkReceivingTarget (reject loopback /
 *     private, accept public) + host extraction for lud16 / lnurl
 *   - probe → tracked verdict mapping (the same trackedVerdict the /probe route returns)
 *   - build field + cleared per method, including clearing a legacy bolt12
 *   - GET /show and /resolve: pubkey param validation + response shaping
 *     (normalizePubkeyParam, shapeShowResponse, shapePayout, applyProbeVerdict,
 *     shapeProbe), stubbed against a resolveProfile()-shaped object — no network.
 *
 * The async DNS path uses literal IPs so dns.lookup resolves them to themselves
 * without touching the network.
 *
 * Run: `npm run test:receiving:api` (or `node test/receiving.api.test.js`).
 */

const assert = require('assert');

const { checkReceivingTarget, isBlockedAddress, ipv4Blocked, extractTarget } = require('../src/api/receiving/ssrfGuard');
const { trackedVerdict } = require('../src/lib/receiving/probe');
const { buildReceivingContent } = require('../src/lib/receiving/mergeKind0');
const {
  normalizePubkeyParam,
  shapeProbe,
  shapeShowResponse,
  shapePayout,
  applyProbeVerdict,
} = require('../src/api/receiving');

const A = 'a'.repeat(64);
const GOOD_LNURL = 'lnurl1dp68gurn8ghj7um9wfmxjcm99e3k7mf0v9cxj0m385ekvcenxc6r2c35xvukxefcv5mkvv34x5ekzd3ev56nyd3hxqurzepexejxxepnxscrvwfnv9nxzcn9xq6xyefhvgcxxcmyxymnserxfq5fns';

let passed = 0, failed = 0;
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => { console.log(`  ✓ ${name}`); passed++; })
    .catch(err => { console.error(`  ✗ ${name}\n      ${err.message}`); failed++; });
}

async function main() {
  console.log('Running receiving API (SSRF guard + verdict + build) tests…\n');

  // ---- SSRF: pure IP classification --------------------------------------
  console.log('SSRF address classification:');
  await check('isBlockedAddress blocks loopback / private / link-local / CGNAT', () => {
    for (const ip of ['127.0.0.1', '127.5.5.5', '10.0.0.1', '172.16.0.1', '172.31.255.255',
      '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0']) {
      assert.strictEqual(isBlockedAddress(ip), true, `${ip} should be blocked`);
    }
  });
  await check('isBlockedAddress allows public IPv4', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.0.1', '172.32.0.1']) {
      assert.strictEqual(isBlockedAddress(ip), false, `${ip} should be allowed`);
    }
  });
  await check('isBlockedAddress handles IPv6 loopback / ULA / link-local / mapped', () => {
    assert.strictEqual(isBlockedAddress('::1'), true);
    assert.strictEqual(isBlockedAddress('fc00::1'), true);
    assert.strictEqual(isBlockedAddress('fd12:3456::1'), true);
    assert.strictEqual(isBlockedAddress('fe80::1'), true);
    assert.strictEqual(isBlockedAddress('::ffff:192.168.0.1'), true); // mapped private
    assert.strictEqual(isBlockedAddress('2606:4700:4700::1111'), false); // public (Cloudflare)
  });
  await check('isBlockedAddress fails closed on garbage', () => {
    assert.strictEqual(isBlockedAddress(''), true);
    assert.strictEqual(isBlockedAddress(null), true);
    assert.strictEqual(ipv4Blocked('not.an.ip.addr'), true);
  });

  // ---- SSRF: host extraction ---------------------------------------------
  console.log('\nSSRF target extraction:');
  await check('extractTarget pulls the domain from a lud16 (https)', () => {
    const t = extractTarget('alice@walletofsatoshi.com');
    assert.strictEqual(t.kind, 'lud16');
    assert.strictEqual(t.host, 'walletofsatoshi.com');
    assert.strictEqual(t.scheme, 'https');
  });
  await check('extractTarget strips a :port from the lud16 domain', () => {
    const t = extractTarget('alice@127.0.0.1:8080');
    assert.strictEqual(t.host, '127.0.0.1');
  });
  await check('extractTarget bech32-decodes an lnurl1… to its URL host', () => {
    const t = extractTarget(GOOD_LNURL);
    assert.strictEqual(t.kind, 'lnurl');
    assert.strictEqual(t.host, 'service.com');
    assert.strictEqual(t.scheme, 'https');
  });
  await check('extractTarget rejects junk', () => {
    assert.ok(extractTarget('not-a-thing').error);
  });

  // ---- SSRF: full guard over literal IPs (hermetic, no real DNS) ----------
  console.log('\nSSRF guard (literal IPs, allowPrivate:false):');
  await check('accepts a public IPv4 host', async () => {
    const r = await checkReceivingTarget('alice@8.8.8.8', { allowPrivate: false });
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    assert.ok(r.addresses.includes('8.8.8.8'));
  });
  await check('rejects loopback', async () => {
    const r = await checkReceivingTarget('alice@127.0.0.1', { allowPrivate: false });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.status, 400);
  });
  await check('rejects a private (10/8) host', async () => {
    const r = await checkReceivingTarget('alice@10.1.2.3', { allowPrivate: false });
    assert.strictEqual(r.ok, false);
  });
  await check('rejects 169.254 link-local (cloud metadata)', async () => {
    const r = await checkReceivingTarget('alice@169.254.169.254', { allowPrivate: false });
    assert.strictEqual(r.ok, false);
  });
  await check('allowPrivate:true lets a loopback host through (dev/test)', async () => {
    const r = await checkReceivingTarget('alice@127.0.0.1', { allowPrivate: true });
    assert.strictEqual(r.ok, true);
  });

  // ---- probe → verdict mapping -------------------------------------------
  console.log('\nProbe verdict mapping:');
  await check('allowsNostr:true → tracked', () => {
    assert.strictEqual(trackedVerdict({ reachable: true, ok: true, allowsNostr: true }).tracked, true);
  });
  await check('reachable but no allowsNostr → not tracked', () => {
    assert.strictEqual(trackedVerdict({ reachable: true, ok: true, allowsNostr: false }).tracked, false);
  });
  await check('unreachable → not tracked', () => {
    assert.strictEqual(trackedVerdict({ reachable: false, error: 'timeout' }).tracked, false);
  });
  await check('not probed → tracked null', () => {
    assert.strictEqual(trackedVerdict(null).tracked, null);
  });

  // ---- build: field + cleared (incl. legacy bolt12) ----------------------
  console.log('\nbuild field + cleared:');
  await check('address → lud16, clears a legacy bolt12', () => {
    const b = buildReceivingContent({ profile: { name: 'A', bolt12: 'lno1legacy' }, method: 'address', value: 'a@b.com', pubkeyHex: A });
    assert.strictEqual(b.field, 'lud16');
    assert.strictEqual(b.content.lud16, 'a@b.com');
    assert.strictEqual(b.content.bolt12, undefined);
    assert.strictEqual(b.content.name, 'A');
    assert.ok(b.cleared.includes('bolt12'));
  });
  await check('npub-cash → derived lud16, clears legacy lud12/lightning_offer', () => {
    const b = buildReceivingContent({ profile: { lud12: 'lno1x', lightning_offer: 'lno1y' }, method: 'npub-cash', pubkeyHex: A });
    assert.strictEqual(b.field, 'lud16');
    assert.ok(b.content.lud16.endsWith('@npub.cash'));
    assert.deepStrictEqual(b.cleared.sort(), ['lightning_offer', 'lud12']);
  });
  await check('lnurl → lud06 (normalized)', () => {
    const b = buildReceivingContent({ profile: {}, method: 'lnurl', value: 'LIGHTNING:' + GOOD_LNURL.toUpperCase(), pubkeyHex: A });
    assert.strictEqual(b.field, 'lud06');
    assert.strictEqual(b.content.lud06, GOOD_LNURL);
  });
  await check('bolt12 is not a settable method (removed)', () => {
    assert.throws(() => buildReceivingContent({ profile: {}, method: 'bolt12', value: 'lno1abc', pubkeyHex: A }), /Unknown receiving method/);
  });

  // ---- GET /show, /resolve: pubkey param validation -----------------------
  console.log('\npubkey param validation (normalizePubkeyParam):');
  await check('rejects a short hex string', () => {
    assert.strictEqual(normalizePubkeyParam('abcd'), null);
  });
  await check('rejects non-hex characters at 64 length', () => {
    assert.strictEqual(normalizePubkeyParam('g'.repeat(64)), null);
  });
  await check('rejects undefined/empty', () => {
    assert.strictEqual(normalizePubkeyParam(undefined), null);
    assert.strictEqual(normalizePubkeyParam(''), null);
  });
  await check('accepts 64-char hex and lowercases it', () => {
    assert.strictEqual(normalizePubkeyParam(A), A);
    assert.strictEqual(normalizePubkeyParam(A.toUpperCase()), A);
  });

  // ---- GET /show response shaping ------------------------------------------
  console.log('\nGET /show response shaping (shapeShowResponse):');
  await check('no profile on any relay → null (route 404s)', () => {
    assert.strictEqual(shapeShowResponse(A, { profile: null, source: null, createdAt: null, sources: { local: 0, external: 0 } }), null);
    assert.strictEqual(shapeShowResponse(A, null), null);
  });
  await check('profile with a lud16 → method/source/createdAt/sources, no raw content leak', () => {
    const resolved = {
      profile: { name: 'Alice', about: 'secret bio', lud16: 'alice@walletofsatoshi.com' },
      source: 'external',
      createdAt: 1700000000,
      sources: { local: 0, external: 2 },
    };
    const body = shapeShowResponse(A, resolved);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.pubkey, A);
    assert.strictEqual(body.method.method, 'lud16');
    assert.strictEqual(body.method.value, 'alice@walletofsatoshi.com');
    assert.strictEqual(body.createdAt, 1700000000);
    assert.deepStrictEqual(body.sources, { local: 0, external: 2 });
    assert.strictEqual(body.source, 'external');
    // Only receiving-relevant fields + created_at — no raw profile passthrough.
    assert.strictEqual(body.profile, undefined);
    assert.strictEqual(body.about, undefined);
  });
  await check('profile found but no receiving method set → method:null, not 404', () => {
    const resolved = { profile: { name: 'Bob' }, source: 'local', createdAt: 42, sources: { local: 1, external: 0 } };
    const body = shapeShowResponse(A, resolved);
    assert.notStrictEqual(body, null);
    assert.strictEqual(body.method, null);
  });

  // ---- GET /resolve payout shaping -----------------------------------------
  console.log('\nGET /resolve payout shaping (shapePayout / applyProbeVerdict):');
  await check('no profile → payment type none, no probe needed', () => {
    const { payment, payTarget, needsProbe } = shapePayout({ profile: null });
    assert.strictEqual(payment.type, 'none');
    assert.strictEqual(needsProbe, false);
    assert.strictEqual(payTarget, undefined);
  });
  await check('lud16 profile → bolt11 via lud16, needs probe', () => {
    const { payment, payTarget, needsProbe } = shapePayout({ profile: { lud16: 'alice@walletofsatoshi.com' } });
    assert.strictEqual(payment.type, 'bolt11');
    assert.strictEqual(payment.lud16, 'alice@walletofsatoshi.com');
    assert.strictEqual(payTarget, 'alice@walletofsatoshi.com');
    assert.strictEqual(needsProbe, true);
  });
  await check('static lnurl profile → bolt11 via lnurl, needs probe', () => {
    const { payment, payTarget, needsProbe } = shapePayout({ profile: { lud06: GOOD_LNURL } });
    assert.strictEqual(payment.type, 'bolt11');
    assert.strictEqual(payment.via, 'lnurl');
    assert.strictEqual(payTarget, GOOD_LNURL);
    assert.strictEqual(needsProbe, true);
  });
  await check('legacy bolt12-only profile → type none, unsupported, no probe', () => {
    const { payment, needsProbe } = shapePayout({ profile: { bolt12: 'lno1legacyoffer1234567890' } });
    assert.strictEqual(payment.type, 'none');
    assert.strictEqual(payment.unsupported, true);
    assert.strictEqual(needsProbe, false);
  });
  await check('applyProbeVerdict: allowsNostr → tracked, payable untouched', () => {
    const payment = { type: 'bolt11', lud16: 'a@b.com', tracked: true };
    applyProbeVerdict(payment, { reachable: true, ok: true, allowsNostr: true });
    assert.strictEqual(payment.tracked, true);
    assert.strictEqual(typeof payment.probeNote, 'string');
    assert.strictEqual(payment.payable, undefined);
  });
  await check('applyProbeVerdict: no allowsNostr → not tracked, payable:false', () => {
    const payment = { type: 'bolt11', lud16: 'a@b.com', tracked: true };
    applyProbeVerdict(payment, { reachable: true, ok: true, allowsNostr: false });
    assert.strictEqual(payment.tracked, false);
    assert.strictEqual(payment.payable, false);
  });

  // ---- probe response shaping (shared by /probe and /resolve) -------------
  console.log('\nProbe result whitelisting (shapeProbe):');
  await check('shapeProbe only exposes the whitelisted fields — never a raw body', () => {
    const probe = {
      ok: true, reachable: true, allowsNostr: true, minSendable: 1000, maxSendable: 5000000,
      callback: 'https://evil.example/secret-callback', tag: 'payRequest', metadata: '[["text/plain","hi"]]',
    };
    const shaped = shapeProbe(probe);
    assert.deepStrictEqual(Object.keys(shaped).sort(), ['allowsNostr', 'error', 'maxSendable', 'minSendable', 'ok', 'reachable']);
    assert.strictEqual(shaped.error, null);
  });

  console.log('\n-------------');
  console.log(`API: ${passed} passed, ${failed} failed → ${failed === 0 ? 'PASS' : 'FAIL'}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => { console.error('api test harness error:', err); process.exit(1); });
