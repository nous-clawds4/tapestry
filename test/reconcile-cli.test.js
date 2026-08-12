const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'reconcile-cli-'));
const dbPath = path.join(directory, 'bounties.db');
const issuer = 'a'.repeat(64);
const claimant = 'b'.repeat(64);
process.env.BOUNTIES_DB_PATH = dbPath;

const {
  insertAttemptingPayment,
  paymentReference,
  updatePaymentState,
} = require('../src/db/autoPay');
const { payment } = insertAttemptingPayment({
  claimEventId: 'failed-cli-claim',
  bountyId: 'failed-cli-bounty',
  issuerPubkey: issuer,
  claimantPubkey: claimant,
  claimAddress: `39999:${claimant}:failed-cli-list`,
  amountSats: 25,
});
updatePaymentState(paymentReference(payment), 'failed', { reason: 'wallet rejected' });

function reconcile(args = []) {
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'bin', 'agent.js'), 'reconcile', '--issuer', issuer, ...args], {
    encoding: 'utf8',
    env: { ...process.env, BOUNTIES_DB_PATH: dbPath },
  });
  assert.equal(result.status, 1, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

const live = reconcile();
assert.equal(live.ok, false);
assert.equal(live.dryRun, false);
assert.equal(live.results.length, 1);
assert.equal(live.results[0].status, 'reset_required');

const dryRun = reconcile(['--dry-run']);
assert.equal(dryRun.ok, false);
assert.equal(dryRun.dryRun, true);
assert.equal(dryRun.results[0].state, 'failed');

console.log('2 reconcile CLI self-checks passed');
