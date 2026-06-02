/**
 * LNURL-probe verification (the "is this address actually payable/tracked?" check).
 *
 * Hermetic: a local HTTP server stands in for an LNURL-pay endpoint. Exercises
 * probeLud16 over a real fetch for the cases that matter — especially the
 * fedimint-gateway case where the LNURL is reachable but does NOT advertise
 * allowsNostr, so payments are NOT tracked (and zap.js would refuse).
 *
 * Run: `npm run test:receiving:probe` (or `node test/receiving.probe.e2e.js`).
 */
const assert = require('assert');
const http = require('http');
const { bech32 } = require('@scure/base');
const { probeLud16, probeLnurl, probeReceiving, trackedVerdict, parseLud16 } = require('../src/lib/receiving/probe');

// Encode an http(s) URL as a static lnurl1… code (the inverse of decodeLnurl).
// Used to point a test LNURL at the ephemeral local server.
function encodeLnurl(url) {
  return bech32.encode('lnurl', bech32.toWords(new TextEncoder().encode(url)), 2000);
}

let passed = 0, failed = 0;
function check(name, fn) {
  return Promise.resolve().then(fn)
    .then(() => { console.log(`  ✓ ${name}`); passed++; })
    .catch(err => { console.error(`  ✗ ${name}\n      ${err.message}`); failed++; });
}

function startLnurlServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const m = req.url.match(/^\/\.well-known\/lnurlp\/(.+)$/);
      const user = m ? decodeURIComponent(m[1]) : null;
      if (user === 'good') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ tag: 'payRequest', callback: 'https://x/cb', minSendable: 1000, maxSendable: 1e8, allowsNostr: true }));
      } else if (user === 'nonostr') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ tag: 'payRequest', callback: 'https://x/cb', minSendable: 1000, maxSendable: 1e8 }));
      } else {
        res.writeHead(404); res.end('not found');
      }
    });
    srv.listen(0, '127.0.0.1', () => resolve({ port: srv.address().port, close: () => new Promise(r => srv.close(r)) }));
  });
}

(async () => {
  const srv = await startLnurlServer();
  const D = `127.0.0.1:${srv.port}`;
  const OPT = { allowInsecureLocalhost: true, timeoutMs: 3000 };
  console.log(`lnurl test server at http://${D}\n\nLNURL probe:\n`);

  await check('parseLud16 splits/validates', () => {
    assert.deepStrictEqual(parseLud16('a@b.com'), { user: 'a', domain: 'b.com' });
    assert.strictEqual(parseLud16('nope'), null);
    assert.strictEqual(parseLud16('a@b@c'), null);
  });

  await check('allowsNostr:true → ok + tracked', async () => {
    const p = await probeLud16(`good@${D}`, OPT);
    assert.ok(p.ok && p.reachable && p.allowsNostr === true, JSON.stringify(p));
    assert.strictEqual(trackedVerdict(p).tracked, true);
  });

  await check('reachable but no allowsNostr → NOT tracked (the fedimint-gateway case)', async () => {
    const p = await probeLud16(`nonostr@${D}`, OPT);
    assert.ok(p.ok && p.allowsNostr === false, JSON.stringify(p));
    assert.strictEqual(trackedVerdict(p).tracked, false);
  });

  await check('404 → not ok, reachable, not tracked', async () => {
    const p = await probeLud16(`missing@${D}`, OPT);
    assert.ok(!p.ok && p.reachable && p.status === 404, JSON.stringify(p));
    assert.strictEqual(trackedVerdict(p).tracked, false);
  });

  await check('unreachable host → reachable:false, not tracked', async () => {
    const p = await probeLud16('x@127.0.0.1:1', { allowInsecureLocalhost: true, timeoutMs: 2000 });
    assert.strictEqual(p.reachable, false, JSON.stringify(p));
    assert.strictEqual(trackedVerdict(p).tracked, false);
  });

  await check('malformed lud16 → error', async () => {
    const p = await probeLud16('notanaddress', OPT);
    assert.ok(!p.ok && /malformed/.test(p.error), JSON.stringify(p));
  });

  // ---- LNURL-pay code (lud06): bech32-decode → fetch the same endpoints ----
  const lnGood = encodeLnurl(`http://${D}/.well-known/lnurlp/good`);
  const lnNoNostr = encodeLnurl(`http://${D}/.well-known/lnurlp/nonostr`);
  const lnMissing = encodeLnurl(`http://${D}/.well-known/lnurlp/missing`);

  await check('probeLnurl: allowsNostr:true → ok + tracked, exposes decoded url', async () => {
    const p = await probeLnurl(lnGood, { timeoutMs: 3000 });
    assert.ok(p.ok && p.reachable && p.allowsNostr === true, JSON.stringify(p));
    assert.ok(p.url && p.url.endsWith('/good'), `expected decoded url; got ${p.url}`);
    assert.strictEqual(trackedVerdict(p).tracked, true);
  });

  await check('probeLnurl: reachable but no allowsNostr → NOT tracked (the paycode case)', async () => {
    const p = await probeLnurl(lnNoNostr, { timeoutMs: 3000 });
    assert.ok(p.ok && p.allowsNostr === false, JSON.stringify(p));
    assert.strictEqual(trackedVerdict(p).tracked, false);
  });

  await check('probeLnurl: 404 → not ok, reachable, not tracked', async () => {
    const p = await probeLnurl(lnMissing, { timeoutMs: 3000 });
    assert.ok(!p.ok && p.reachable && p.status === 404, JSON.stringify(p));
    assert.strictEqual(trackedVerdict(p).tracked, false);
  });

  await check('probeLnurl: malformed lnurl → error', async () => {
    const p = await probeLnurl('lnurl1notvalidchecksum', { timeoutMs: 3000 });
    assert.ok(!p.ok && /malformed LNURL/.test(p.error), JSON.stringify(p));
  });

  await check('probeReceiving dispatches: lnurl1… → LNURL probe, name@domain → lud16 probe', async () => {
    const a = await probeReceiving(lnGood, { timeoutMs: 3000 });
    assert.ok(a.ok && a.allowsNostr === true && a.url, `lnurl path: ${JSON.stringify(a)}`);
    const b = await probeReceiving(`good@${D}`, OPT);
    assert.ok(b.ok && b.allowsNostr === true && !b.url, `lud16 path: ${JSON.stringify(b)}`);
  });

  await srv.close();
  console.log(`\n-------------\nPROBE E2E: ${passed} passed, ${failed} failed → ${failed === 0 ? 'PASS' : 'FAIL'}`);
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error('probe harness error:', e); process.exit(1); });
