const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brainstorm-auto-pay-'));
process.env.BOUNTIES_DB_PATH = path.join(tmpDir, 'bounties.db');
process.env.AUTO_PAY_ALLOWLIST_PUBKEYS = `${'d'.repeat(64)}`;

const {
  getAutoPaymentByClaimId,
  insertAttemptingPayment,
  dailyLimitStatus,
  updatePaymentState,
} = require('../src/db/autoPay');
const {
  annotateClaimsWithPaymentState,
  calculateBountyPaymentState,
} = require('../src/lib/bounty-policy');
const { isAutoPayAuthorized } = require('../src/api/bounties');
const { checkCallbackUrl, fetchLnurlPayData, verifyBolt11AmountSats } = require('../src/lib/zap-node');
const { checkUrlTarget } = require('../src/api/receiving/ssrfGuard');

const SAMPLE_2000_SAT_INVOICE = 'lnbc20u1p3y0x3hpp5743k2g0fsqqxj7n8qzuhns5gmkk4djeejk3wkp64ppevgekvc0jsdqcve5kzar2v9nr5gpqd4hkuetesp5ez2g297jduwc20t6lmqlsg3man0vf2jfd8ar9fh8fhn2g8yttfkqxqy9gcqcqzys9qrsgqrzjqtx3k77yrrav9hye7zar2rtqlfkytl094dsp0ms5majzth6gt7ca6uhdkxl983uywgqqqqlgqqqvx5qqjqrzjqd98kxkpyw0l9tyy8r8q57k7zpy9zjmh6sez752wj6gcumqnj3yxzhdsmg6qq56utgqqqqqqqqqqqeqqjq7jd56882gtxhrjm03c93aacyfy306m4fq0tskf83c0nmet8zc2lxyyg3saz8x6vwcp26xnrlagf9semau3qm2glysp7sv95693fphvsp54l567';

let passed = 0;

async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

function basePayment(claimId, amountSats, now) {
  return {
    claimEventId: claimId,
    bountyId: 'bounty-1',
    issuerPubkey: 'a'.repeat(64),
    amountSats,
    now,
  };
}

function claim(id, pubkey, createdAt, autoPayment = null) {
  return {
    event: { id, pubkey, created_at: createdAt },
    zapReceipt: null,
    autoPayment,
  };
}

(async () => {
  await test('fixed 5000-sat rolling 24h cap allows boundary and blocks one sat over without inserting', () => {
    const now = 2_000_000;
    assert.strictEqual(insertAttemptingPayment(basePayment('cap-3000', 3000, now)).inserted, true);
    assert.strictEqual(insertAttemptingPayment(basePayment('cap-1999', 1999, now + 1)).inserted, true);

    const boundary = dailyLimitStatus({ amountSats: 1, now: now + 2 });
    assert.strictEqual(boundary.ok, true);
    assert.strictEqual(boundary.spentSats, 4999);
    assert.strictEqual(insertAttemptingPayment(basePayment('cap-boundary', 1, now + 2)).inserted, true);

    const over = dailyLimitStatus({ amountSats: 1, now: now + 3 });
    assert.strictEqual(over.ok, false);
    assert.strictEqual(over.reason, 'daily_cap_exceeded');

    const blocked = insertAttemptingPayment(basePayment('cap-blocked', 1, now + 3));
    assert.strictEqual(blocked.inserted, false);
    assert.strictEqual(blocked.reason, 'daily_cap_exceeded');
    assert.strictEqual(getAutoPaymentByClaimId('cap-blocked'), null);
  });

  await test('rolling cap counts spend-capable states and ignores failed rows', () => {
    const now = 3_000_000;
    assert.strictEqual(insertAttemptingPayment(basePayment('failed-row', 5000, now)).inserted, true);
    updatePaymentState('failed-row', 'failed', { reason: 'test failure', now: now + 1 });

    assert.strictEqual(dailyLimitStatus({ amountSats: 5000, now: now + 2 }).ok, true);
    assert.strictEqual(insertAttemptingPayment(basePayment('unreceipted-row', 5000, now + 2)).inserted, true);
    updatePaymentState('unreceipted-row', 'paid_unreceipted', { reason: 'receipt_timeout', now: now + 3 });
    assert.strictEqual(dailyLimitStatus({ amountSats: 1, now: now + 4 }).ok, false);
  });

  await test('spend gate authorizes allowlisted pubkeys and rejects ordinary users', () => {
    assert.strictEqual(isAutoPayAuthorized('d'.repeat(64)), true);
    assert.strictEqual(isAutoPayAuthorized('f'.repeat(64)), false);
  });

  await test('SSRF guard rejects private callback targets and LNURL redirects', async () => {
    const privateCallback = await checkUrlTarget('https://127.0.0.1/callback', { allowPrivate: false });
    assert.strictEqual(privateCallback.ok, false);
    assert.match(privateCallback.error, /disallowed|resolves/);

    await assert.rejects(
      checkCallbackUrl('https://127.0.0.1/callback', { allowPrivate: false }),
      /disallowed LNURL callback/
    );

    await assert.rejects(
      fetchLnurlPayData('alice@127.0.0.1:9735', {
        allowPrivate: true,
        fetchImpl: async () => ({
          status: 302,
          ok: false,
          json: async () => ({}),
        }),
      }),
      /redirects are not followed/
    );
  });

  await test('BOLT11 amount verification rejects mismatch', () => {
    assert.deepStrictEqual(
      verifyBolt11AmountSats(SAMPLE_2000_SAT_INVOICE, 2000),
      { amountMsats: '2000000', amountSats: 2000 }
    );
    assert.throws(
      () => verifyBolt11AmountSats(SAMPLE_2000_SAT_INVOICE, 2001),
      /BOLT11 amount mismatch/
    );
  });

  await test('paid_unreceipted suppresses normal payable claim state', () => {
    const alice = 'a'.repeat(64);
    const bob = 'b'.repeat(64);
    const state = calculateBountyPaymentState({
      amount_sats: 1000,
      bounty_cap_sats: 1000,
      reward_per_item: 0,
    }, [
      claim('held', alice, 1, { state: 'paid_unreceipted' }),
      claim('next', bob, 2),
    ]);

    assert.deepStrictEqual(state.payableClaims.map(c => c.event.id), []);
    assert.deepStrictEqual(state.reconciliationClaims.map(c => c.event.id), ['held']);
    assert.deepStrictEqual(state.closedClaims.map(c => [c.event.id, c.closedReason]), [['next', 'cap']]);

    const annotated = annotateClaimsWithPaymentState([
      claim('held', alice, 1, { state: 'paid_unreceipted' }),
      claim('next', bob, 2),
    ], state);
    assert.strictEqual(annotated[0].paymentStatus, 'paid_unreceipted');
    assert.strictEqual(annotated[0].duplicatePaymentSuppressed, true);
    assert.notStrictEqual(annotated[0].paymentStatus, 'payable');
  });

  console.log(`\n${passed} auto-pay tests passed`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
