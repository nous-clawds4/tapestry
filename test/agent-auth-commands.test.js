const assert = require('assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-auth-commands-'));
const jarPath = path.join(directory, 'cookies.json');
fs.writeFileSync(jarPath, JSON.stringify({ 'connect.sid': 'signed-session-cookie' }), { mode: 0o600 });

let paymentsDueSuccess = true;
const requests = [];
const server = http.createServer((req, res) => {
  let body = '';
  req.setEncoding('utf8');
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    requests.push({ method: req.method, url: req.url, cookie: req.headers.cookie, body: body ? JSON.parse(body) : null });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/bounties/mine/payments-due') {
      res.end(JSON.stringify(paymentsDueSuccess ? { success: true, items: [] } : { success: false, error: 'denied' }));
      return;
    }
    if (req.url === '/api/bounties/auto-pay/reset') {
      res.end(JSON.stringify({ success: true, reset: false, blocked: 'not_failed' }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ success: false, error: 'not found' }));
  });
});

function listen() {
  return new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}

function close() {
  return new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
}

(async () => {
  await listen();
  process.env.MC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.MC_COOKIE_JAR = jarPath;
  const { commands } = require('../bin/agent');
  const output = [];
  const originalLog = console.log;
  console.log = text => output.push(JSON.parse(text));
  try {
    process.exitCode = 0;
    await commands['payments-due']();
    assert.equal(process.exitCode, 0);
    assert.equal(output.at(-1).ok, true);
    assert.equal(requests.at(-1).cookie, 'connect.sid=signed-session-cookie');

    process.exitCode = 0;
    await commands.reset({ bounty: 'bounty-1', claim: 'claim-1', force: true });
    assert.equal(process.exitCode, 1);
    assert.deepEqual(output.at(-1), { success: true, reset: false, blocked: 'not_failed', ok: false });
    assert.deepEqual(requests.at(-1).body, { bountyId: 'bounty-1', claimEventId: 'claim-1', force: true });
    assert.equal(requests.at(-1).cookie, 'connect.sid=signed-session-cookie');

    process.exitCode = 0;
    paymentsDueSuccess = false;
    await commands['payments-due']();
    assert.equal(process.exitCode, 1);
    assert.equal(output.at(-1).ok, false);
  } finally {
    console.log = originalLog;
    process.exitCode = 0;
    await close();
  }

  console.log('3 authenticated agent command self-checks passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
