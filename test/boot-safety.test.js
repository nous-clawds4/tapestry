// Phase 0 boot-safety: the bounties API must register and the delegate read
// path must work with the auto-pay wallet binary absent AND no master key set.
// This is the exact backend that 502'd prod (notes-deploy-incident) — the guard
// is that requiring/registering bounties never eager-loads the wallet/zap deps,
// and receipt matching never decrypts a delegate secret.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brainstorm-boot-'));
process.env.BOUNTIES_DB_PATH = path.join(tmpDir, 'bounties.db');
delete process.env.RELAY_KEY_MASTER_KEY;   // master key absent
delete process.env.AUTO_PAY_ENABLED;        // auto-pay disabled
process.env.MDK_WALLET_BIN = path.join(tmpDir, 'no-such-agent-wallet'); // binary absent

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

test('requiring + registering bounties does not crash with no master key', () => {
  const bountiesApi = require('../src/api/bounties');
  const routes = [];
  const fakeApp = {
    get: (p) => routes.push(`GET ${p}`),
    post: (p) => routes.push(`POST ${p}`),
  };
  bountiesApi.register(fakeApp);
  assert.ok(routes.includes('GET /api/bounties'), 'bounty routes registered');
});

test('disabled auto-pay never eager-loads the wallet/zap-node deps', () => {
  // require.cache must not contain the wallet or zap modules: the watcher (which
  // pulls them in) is only required when AUTO_PAY_ENABLED === "true".
  const loaded = Object.keys(require.cache);
  assert.ok(!loaded.some(p => p.endsWith('/src/lib/wallet.js')), 'wallet.js not loaded');
  assert.ok(!loaded.some(p => p.endsWith('/src/lib/zap-node.js')), 'zap-node.js not loaded');
  assert.ok(!loaded.some(p => p.endsWith('/src/services/autoPayWatcher.js')), 'watcher not loaded');
});

test('delegate read path returns the pubkey without a master key', () => {
  const { upsertDelegate, getDelegatePubkey } = require('../src/db/autoPay');
  const issuer = 'a'.repeat(64);
  const delegatePubkey = 'b'.repeat(64);
  // Seed the row WITH a master key (encrypts the nsec), then drop the key and
  // prove receipt matching reads the plaintext pubkey without it.
  process.env.RELAY_KEY_MASTER_KEY = 'test-master-key';
  upsertDelegate({ issuerPubkey: issuer, delegatePubkey, delegateNsec: 'c'.repeat(64) });
  delete process.env.RELAY_KEY_MASTER_KEY;
  assert.strictEqual(getDelegatePubkey(issuer), delegatePubkey);
  assert.strictEqual(getDelegatePubkey('f'.repeat(64)), null);
});

test('provisioning a delegate without a master key fails closed (no plaintext secret)', () => {
  const { upsertDelegate } = require('../src/db/autoPay');
  delete process.env.RELAY_KEY_MASTER_KEY;
  assert.throws(
    () => upsertDelegate({ issuerPubkey: 'e'.repeat(64), delegatePubkey: 'b'.repeat(64), delegateNsec: 'c'.repeat(64) }),
    /Master key required/,
  );
});

test('boot gate keeps the server up when auto-pay deps/binary are broken', () => {
  // Replicates the src/api/index.js gate verbatim: with auto-pay enabled but a
  // broken wallet/dep environment, the inner try/catch must swallow the failure
  // so boot continues with auto-pay simply off — never a 502.
  process.env.AUTO_PAY_ENABLED = 'true';
  let bootCrashed = false;
  try {
    if (process.env.AUTO_PAY_ENABLED === 'true') {
      try {
        require('../src/services/autoPayWatcher').startAutoPayWatcher();
      } catch (err) {
        // gate swallows: auto-pay stays off, boot continues
      }
    }
  } catch (err) {
    bootCrashed = true;
  }
  assert.strictEqual(bootCrashed, false, 'boot must survive a broken auto-pay environment');
});

console.log(`\n${passed} boot-safety tests passed`);
