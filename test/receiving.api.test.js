/**
 * Unit tests for the receiving-setup HTTP layer (src/api/receiving/*).
 *
 * Covers the API-specific composable pieces, hermetically (literal IPs only, no
 * real DNS / network):
 *   - SSRF guard: IP classification + checkReceivingTarget (reject loopback /
 *     private, accept public) + host extraction for lud16 / lnurl
 *   - probe → tracked verdict mapping (the same trackedVerdict the /probe route returns)
 *   - build field + cleared per method, including clearing a legacy bolt12
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

  console.log('\n-------------');
  console.log(`API: ${passed} passed, ${failed} failed → ${failed === 0 ? 'PASS' : 'FAIL'}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => { console.error('api test harness error:', err); process.exit(1); });
