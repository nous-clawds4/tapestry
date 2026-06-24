// CLI integration test: drives the real bin/agent.js binary over HTTP against a
// stub server through the user-agent loop (auth-login → discover → submit →
// negotiate send), asserting the signed events it publishes are well-formed.
// Real-sats settlement (pay → kind-9735) is the manual signet run — see
// test/agents/README.md.
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { generateSecretKey, getPublicKey, verifyEvent } = require('nostr-tools');

const sk = generateSecretKey();
const pk = getPublicKey(sk);
const NSEC_HEX = Buffer.from(sk).toString('hex');
const LIST_COORDINATE = `30000:${'a'.repeat(64)}:dogs`;
const BOUNTY = { id: 'b1', issuer_pubkey: 'a'.repeat(64), list_coordinate: LIST_COORDINATE, amount_sats: 100, criteria: 'add 3 dog breeds', status: 'open' };

const published = []; // events the stub received via /api/strfry/publish

function body(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const send = (obj, headers = {}) => { res.writeHead(200, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(obj)); };
  const url = req.url.split('?')[0];
  if (url === '/api/auth/verify-user') return send({ authorized: true, challenge: 'test-challenge' });
  if (url === '/api/auth/login-user') return send({ success: true }, { 'Set-Cookie': 'connect.sid=test-session; Path=/' });
  if (url === '/api/bounties' && req.method === 'GET') return send({ success: true, bounties: [BOUNTY] });
  if (url === '/api/bounties/eligible') return send({ success: true, bounties: [BOUNTY] });
  if (url === '/api/bounties/b1') return send({ success: true, bounty: BOUNTY });
  if (url === '/api/strfry/publish') { const b = await body(req); published.push(b.event); return send({ success: true }); }
  res.writeHead(404); res.end(JSON.stringify({ error: 'not found' }));
});

const tmpJar = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mc-e2e-')), 'jar.json');

async function runCli(args, baseUrl) {
  const { stdout } = await execFileAsync('node', ['bin/agent.js', ...args], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, MC_BASE_URL: baseUrl, MC_NSEC: NSEC_HEX, MC_COOKIE_JAR: tmpJar },
  });
  return JSON.parse(stdout);
}

let passed = 0;
async function test(name, fn) { await fn(); passed += 1; console.log(`  ok  ${name}`); }

server.listen(0, async () => {
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await test('auth-login completes the verify → sign 22242 → login flow', async () => {
      const r = await runCli(['auth-login'], baseUrl);
      assert.strictEqual(r.ok, true);
      assert.strictEqual(r.pubkey, pk);
      assert.ok(fs.existsSync(tmpJar), 'cookie jar persisted');
    });

    await test('discover --eligible returns the trusted bounty', async () => {
      const r = await runCli(['discover', '--eligible'], baseUrl);
      assert.strictEqual(r.bounties[0].id, 'b1');
    });

    await test('submit publishes a valid kind-39999 claim z-tagged to the list', async () => {
      const r = await runCli(['submit', '--bounty', 'b1', '--content', 'beagle, corgi, husky'], baseUrl);
      assert.strictEqual(r.ok, true);
      const claim = published.find(e => e.kind === 39999);
      assert.ok(claim && verifyEvent(claim), 'claim is validly signed');
      assert.strictEqual(claim.pubkey, pk);
      assert.ok(claim.tags.some(t => t[0] === 'z' && t[1] === LIST_COORDINATE), 'z-tag = list coordinate');
      assert.strictEqual(r.claimEventId, claim.id);
    });

    await test('negotiate send publishes a kind-1111 carrying bountyId', async () => {
      const r = await runCli(['negotiate', 'send', '--bounty', 'b1', '--message', 'can I add 4?'], baseUrl);
      assert.strictEqual(r.ok, true);
      const comment = published.find(e => e.kind === 1111);
      assert.ok(comment && verifyEvent(comment), 'comment is validly signed');
      assert.ok(comment.tags.some(t => t[0] === 'bountyId' && t[1] === 'b1'), 'carries bountyId');
      assert.ok(comment.tags.some(t => t[0] === 'a' && t[1] === LIST_COORDINATE), 'anchored to list coordinate');
    });

    console.log(`\n${passed} agent-e2e tests passed`);
    server.close(() => process.exit(0));
  } catch (err) {
    server.close();
    console.error(err.stdout || err.message);
    process.exit(1);
  }
});
