const assert = require('assert/strict');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const express = require('express');
const Database = require('better-sqlite3');
const { configureSession, resolveSessionSecret } = require('../src/middleware/sessionStore');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'brainstorm-sessions-'));
const dbPath = path.join(directory, 'sessions.db');
const secret = 'session-test-secret';
const placeholder = 'brainstorm-default-session-secret-please-change-in-production';

const envSecret = 'environment-only-secret-value-32-plus';
const explicitSecret = 'explicit-production-secret-value-32-plus';
assert.equal(resolveSessionSecret({
  secret: explicitSecret,
  env: { NODE_ENV: 'production', SESSION_SECRET: envSecret },
  configPath: path.join(directory, 'missing.conf'),
}), explicitSecret);
assert.equal(resolveSessionSecret({
  env: { NODE_ENV: 'production', SESSION_SECRET: envSecret },
  configPath: path.join(directory, 'missing.conf'),
}), envSecret);
assert.equal(resolveSessionSecret({
  env: { NODE_ENV: 'production', SESSION_SECRET: 'é'.repeat(16) },
  configPath: path.join(directory, 'missing.conf'),
}), 'é'.repeat(16));
assert.throws(() => resolveSessionSecret({
  env: { NODE_ENV: 'production' },
  configPath: path.join(directory, 'missing.conf'),
}), /at least 32 bytes/);
assert.throws(() => resolveSessionSecret({
  env: { NODE_ENV: 'production', SESSION_SECRET: placeholder },
  configPath: path.join(directory, 'missing.conf'),
}), /at least 32 bytes/);
assert.throws(() => resolveSessionSecret({
  env: { NODE_ENV: 'production', SESSION_SECRET: 'x' },
  configPath: path.join(directory, 'missing.conf'),
}), /at least 32 bytes/);
assert.throws(() => resolveSessionSecret({
  secret: 'short-explicit-secret',
  env: { NODE_ENV: 'production', SESSION_SECRET: envSecret },
  configPath: path.join(directory, 'missing.conf'),
}), /at least 32 bytes/);
const developmentFallback = resolveSessionSecret({
  env: { NODE_ENV: 'development' },
  configPath: path.join(directory, 'missing.conf'),
});
assert.match(developmentFallback, /^[0-9a-f]{64}$/);
assert.equal(resolveSessionSecret({
  env: { NODE_ENV: 'development' },
  configPath: path.join(directory, 'missing.conf'),
}), developmentFallback);

const configSecret = 'config-file-secret-must-not-log-32-plus';
const configPath = path.join(directory, 'brainstorm.conf');
fs.writeFileSync(configPath, `SESSION_SECRET='${configSecret}'\n`);
const capturedLogs = [];
const originalLog = console.log;
const originalError = console.error;
console.log = (...values) => capturedLogs.push(values.join(' '));
console.error = (...values) => capturedLogs.push(values.join(' '));
try {
  assert.equal(resolveSessionSecret({
    env: { NODE_ENV: 'production' },
    configPath,
  }), configSecret);
} finally {
  console.log = originalLog;
  console.error = originalError;
}
assert.equal(capturedLogs.join('\n').includes(configSecret), false);

// Regression guard for the container boot path. entrypoint.sh resolves
// SESSION_SECRET, bakes it into /etc/brainstorm.conf, and every later process
// re-reads that file. A boot that mints a new secret while the environment
// already carries one invalidates every signed cookie, so the settlement
// timer's session dies on each restart. Drive the real line from the real file.
const entrypointSource = fs.readFileSync(path.join(__dirname, '..', 'docker', 'entrypoint.sh'), 'utf8');
const secretLine = entrypointSource.split('\n').find(line => line.startsWith('SESSION_SECRET='));
assert.ok(secretLine, 'docker/entrypoint.sh must resolve SESSION_SECRET on one line');

let bootCount = 0;
function bootSessionSecret(bootEnv = {}) {
  bootCount += 1;
  const bootConf = path.join(directory, `boot-${bootCount}.conf`);
  const script = [
    'set -eu',
    secretLine,
    'cat > "$BOOT_CONF" <<CONF',
    'export SESSION_SECRET="${SESSION_SECRET}"',
    'CONF',
  ].join('\n');
  const boot = spawnSync('/bin/bash', ['-c', script], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, BOOT_CONF: bootConf, ...bootEnv },
  });
  assert.equal(boot.status, 0, boot.stderr || 'entrypoint secret line failed');
  // Resolve exactly the way production does: no env, no explicit secret, only
  // the generated config file.
  return resolveSessionSecret({ env: { NODE_ENV: 'production' }, configPath: bootConf });
}

const suppliedSecret = 'operator-supplied-session-secret-value';
assert.ok(Buffer.byteLength(suppliedSecret, 'utf8') >= 32);
assert.equal(bootSessionSecret({ SESSION_SECRET: suppliedSecret }), suppliedSecret);
assert.equal(bootSessionSecret({ SESSION_SECRET: suppliedSecret }), suppliedSecret);
const firstGeneratedSecret = bootSessionSecret();
const secondGeneratedSecret = bootSessionSecret();
assert.match(firstGeneratedSecret, /^[0-9a-f]{64}$/);
assert.match(secondGeneratedSecret, /^[0-9a-f]{64}$/);
assert.notEqual(firstGeneratedSecret, secondGeneratedSecret);

function startApp() {
  const app = express();
  const store = configureSession(app, { dbPath, secret, secure: false });
  app.get('/login', (req, res) => {
    req.session.pubkey = 'a'.repeat(64);
    req.session.authenticated = true;
    req.session.nsec = 'nsec1must-not-be-persisted';
    res.json({ ok: true });
  });
  app.get('/status', (req, res) => {
    res.json({
      authenticated: req.session.authenticated === true,
      pubkey: req.session.pubkey || null,
      hasNsec: Object.hasOwn(req.session, 'nsec'),
    });
  });
  const server = http.createServer(app);
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, store })));
}

function request(server, pathname, cookie) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: server.address().port,
      path: pathname,
      headers: cookie ? { Cookie: cookie } : {},
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({
        body: JSON.parse(body),
        setCookie: res.headers['set-cookie']?.[0] || null,
      }));
    });
    req.on('error', reject);
    req.end();
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
}

(async () => {
  const first = await startApp();
  const login = await request(first.server, '/login');
  assert.equal(login.body.ok, true);
  assert.ok(login.setCookie);
  const cookie = login.setCookie.split(';', 1)[0];
  await close(first.server);
  first.store.close();

  assert.equal(fs.statSync(dbPath).mode & 0o777, 0o600);
  const persistedDb = new Database(dbPath, { readonly: true });
  const rows = persistedDb.prepare('SELECT sess FROM sessions').all();
  persistedDb.close();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sess.includes('nsec'), false);
  assert.equal(rows[0].sess.includes('must-not-be-persisted'), false);

  const second = await startApp();
  const status = await request(second.server, '/status', cookie);
  assert.deepEqual(status.body, {
    authenticated: true,
    pubkey: 'a'.repeat(64),
    hasNsec: false,
  });
  await close(second.server);
  second.store.close();

  console.log('durable session-store self-checks passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
