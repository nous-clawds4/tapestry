const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brainstorm-auto-pay-'));
process.env.BOUNTIES_DB_PATH = path.join(tmpDir, 'bounties.db');
process.env.AUTO_PAY_ALLOWLIST_PUBKEYS = `${'d'.repeat(64)}`;
// The tests below drive processAutoPayClaim directly with realistic bounty
// amounts (up to 500 sats). AUTO_PAY_MAX_SATS is a per-payment cap read from
// the environment — a local (gitignored) .env commonly sets a small dev
// value — so pin it here rather than leaving these tests at the mercy of
// whatever happens to be in the environment's .env.
process.env.AUTO_PAY_MAX_SATS = '1000000';

const {
  getAutoPaymentByClaimId,
  insertAttemptingPayment,
  dailyLimitStatus,
  resetPayment,
  updatePaymentState,
} = require('../src/db/autoPay');
const {
  annotateClaimsWithPaymentState,
  calculateBountyPaymentState,
} = require('../src/lib/bounty-policy');
const { isAutoPayAuthorized } = require('../src/api/bounties');
const { checkCallbackUrl, fetchLnurlPayData, verifyBolt11AmountSats } = require('../src/lib/zap-node');
const { checkUrlTarget } = require('../src/api/receiving/ssrfGuard');
const { createBounty } = require('../src/db/bounties');
const { appendAudit } = require('../src/lib/agentAudit');

// paymentService/autoPayWatcher unconditionally require src/api/profiles/fetchProfiles,
// which loads nostr-tools/ws from a hardcoded global install path
// (/usr/local/lib/node_modules/brainstorm/node_modules/...) that only exists inside
// the deployed tapestry container (see test/support/fetchprofiles-strfry.e2e.js,
// test/boot-safety.test.js). Outside that container the require throws
// MODULE_NOT_FOUND before payClaim's self-claim guard is ever reached, so fall back
// to the local copies of the same packages purely to make payClaim/runAutoPayTick
// loadable here. A real global install still resolves normally first, so this
// fallback is a no-op wherever that path actually exists.
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
const GLOBAL_MODULE_FALLBACKS = {
  '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools': require.resolve('nostr-tools'),
  '/usr/local/lib/node_modules/brainstorm/node_modules/ws': require.resolve('ws'),
};
Module._resolveFilename = function patchedResolveFilename(request, ...rest) {
  try {
    return originalResolveFilename.call(this, request, ...rest);
  } catch (err) {
    if (GLOBAL_MODULE_FALLBACKS[request]) return GLOBAL_MODULE_FALLBACKS[request];
    throw err;
  }
};

// payClaim/runAutoPayTick resolve claims via paymentStateForBounty, which scans the
// local strfry relay through a child process not available in this harness. Stub it
// with a per-bounty fixture so the self-claim tests below control exactly which
// claims are "payable" without a relay.
const bountiesApi = require('../src/api/bounties');
const fakePayableClaimsByBounty = new Map();
function setFakePayableClaims(bountyId, claims) {
  fakePayableClaimsByBounty.set(bountyId, claims);
}
bountiesApi.paymentStateForBounty = async (bounty) => {
  const claims = fakePayableClaimsByBounty.get(bounty.id) || [];
  return { claims, paymentState: { payableClaims: claims } };
};

// processAutoPayClaim's wallet/mint/profile/receipt calls are captured by
// reference inside autoPayWatcher.js the moment it is first required — a side
// effect of requiring paymentService below — so, exactly like the
// paymentStateForBounty stub above, each dependency must be replaced on its
// real module *before* that first require happens. Every stub defaults to a
// hard failure (no test in this file may hit the real network/CLI); a test
// calls `.set(impl)` before driving processAutoPayClaim/reconcileStuckAttempts
// and `.clear()` in a `finally` block afterward.
function stubbableFn(name) {
  let impl = null;
  const fn = (...args) => {
    if (!impl) throw new Error(`${name} stub was not configured for this test`);
    return impl(...args);
  };
  fn.set = (next) => { impl = next; };
  fn.clear = () => { impl = null; };
  return fn;
}

const walletLib = require('../src/lib/wallet');
const zapNodeLib = require('../src/lib/zap-node');
const zapBridgeLib = require('../src/lib/zap-bridge');
const fetchProfilesLib = require('../src/api/profiles/fetchProfiles');

const stubGetBalance = stubbableFn('getBalance');
const stubPayBolt11 = stubbableFn('payBolt11');
const stubGetPaymentStatus = stubbableFn('getPaymentStatus');
const stubMintZapInvoice = stubbableFn('mintZapInvoice');
const stubGetProfiles = stubbableFn('getProfiles');
const stubListClaimsFor = stubbableFn('listClaimsFor');
const stubBridgeZapReceipt = stubbableFn('bridgeZapReceipt');

walletLib.getBalance = stubGetBalance;
walletLib.payBolt11 = stubPayBolt11;
walletLib.getPaymentStatus = stubGetPaymentStatus;
zapNodeLib.mintZapInvoice = stubMintZapInvoice;
fetchProfilesLib.getProfiles = stubGetProfiles;
bountiesApi.listClaimsFor = stubListClaimsFor;
zapBridgeLib.bridgeZapReceipt = stubBridgeZapReceipt;

// rank() hits a real network fetch that fails fast (caught, returns 0) in this
// harness, so — unlike the wallet/mint/profile stubs above, which must never
// silently fall through to a real (possibly slow) implementation — this one
// defaults to the real function and only the judgment-gate tests below opt in
// to a fixed override, since DEV_SKIP_TRUST_CHECK can't help here: trust-rank.js
// reads it into a module-level constant at require time, before any test gets
// a chance to set the env var.
const trustRankLib = require('../src/lib/trust-rank');
const realRank = trustRankLib.rank;
let rankOverride = null;
trustRankLib.rank = (...args) => (rankOverride ? rankOverride(...args) : realRank(...args));

function clearProcessStubs() {
  stubGetBalance.clear();
  stubPayBolt11.clear();
  stubGetPaymentStatus.clear();
  stubMintZapInvoice.clear();
  stubGetProfiles.clear();
  stubListClaimsFor.clear();
  stubBridgeZapReceipt.clear();
}

const { payClaim } = require('../src/services/paymentService');
const { runAutoPayTick, reconcileStuckAttempts, processAutoPayClaim } = require('../src/services/autoPayWatcher');

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

  await test('payClaim refuses a same-case self-claim before the rank gate and writes no auto_payments row', async () => {
    const issuer = 'a'.repeat(64);
    const bounty = createBounty({
      issuerPubkey: issuer,
      listCoordinate: 'lc-self-claim-exact',
      amountSats: 500,
      bountyCapSats: 500,
      criteria: 'self-claim guard (exact case)',
    });
    setFakePayableClaims(bounty.id, [claim('self-claim-exact', issuer, 1)]);

    const result = await payClaim({ bountyId: bounty.id, claimEventId: 'self-claim-exact' });
    assert.deepStrictEqual(result, { ok: false, reason: 'self_claim' });
    assert.strictEqual(getAutoPaymentByClaimId('self-claim-exact'), null);
  });

  await test('payClaim refuses a self-claim regardless of pubkey case and writes no auto_payments row', async () => {
    const issuerUpper = 'B'.repeat(64);
    const bounty = createBounty({
      issuerPubkey: issuerUpper,
      listCoordinate: 'lc-self-claim-mixed',
      amountSats: 500,
      bountyCapSats: 500,
      criteria: 'self-claim guard (mixed case)',
    });
    setFakePayableClaims(bounty.id, [claim('self-claim-mixed', issuerUpper.toLowerCase(), 1)]);

    const result = await payClaim({ bountyId: bounty.id, claimEventId: 'self-claim-mixed' });
    assert.deepStrictEqual(result, { ok: false, reason: 'self_claim' });
    assert.strictEqual(getAutoPaymentByClaimId('self-claim-mixed'), null);
  });

  await test('runAutoPayTick skips a self-claim before any payment attempt', async () => {
    process.env.AUTO_PAY_ENABLED = 'true';
    const originalWarn = console.warn;
    const warnCalls = [];
    console.warn = (...args) => { warnCalls.push(args); };
    try {
      const issuer = 'c'.repeat(64);
      const bounty = createBounty({
        issuerPubkey: issuer,
        listCoordinate: 'lc-tick-self-claim',
        amountSats: 500,
        bountyCapSats: 500,
        autoPay: true,
        autoPayMinRank: 2,
        criteria: 'tick self-claim guard',
      });
      setFakePayableClaims(bounty.id, [claim('tick-self-claim', issuer, 1)]);

      const result = await runAutoPayTick();

      assert.strictEqual(result.ok, true);
      assert.deepStrictEqual(result.results, []);
      assert.strictEqual(getAutoPaymentByClaimId('tick-self-claim'), null);
      assert.ok(
        warnCalls.some(args => args[0] === '[auto-pay] skipping self-claim' && args[1]?.claimEventId === 'tick-self-claim'),
        'logs a self-claim skip warning'
      );
    } finally {
      console.warn = originalWarn;
      delete process.env.AUTO_PAY_ENABLED;
    }
  });

  // --- Gap 1: ambiguous Lightning sends can no longer be double-paid ---

  await test('processAutoPayClaim persists the minted bolt11 on the attempting row before payBolt11 is called', async () => {
    const issuer = '3'.repeat(64);
    const claimant = '4'.repeat(64);
    const bounty = createBounty({
      issuerPubkey: issuer,
      listCoordinate: 'lc-persist-before-send',
      amountSats: 500,
      bountyCapSats: 500,
      criteria: 'persist bolt11 before send',
    });
    const claimEventId = 'persist-before-send';
    let bolt11WhenPayBolt11Called = 'not-called';

    stubGetProfiles.set(async () => new Map([[claimant, { lud16: 'claimant@example.com' }]]));
    stubGetBalance.set(async () => ({ balance_sats: 10_000 }));
    stubMintZapInvoice.set(async () => ({ type: 'bolt11', payload: SAMPLE_2000_SAT_INVOICE }));
    stubPayBolt11.set(async () => {
      bolt11WhenPayBolt11Called = getAutoPaymentByClaimId(claimEventId)?.bolt11 ?? null;
      throw new Error('send exploded');
    });
    stubGetPaymentStatus.set(async () => ({ inconclusive: true, reason: 'test_stub' }));

    try {
      const result = await processAutoPayClaim(bounty, claim(claimEventId, claimant, 1), {
        delegate: { delegate_pubkey: 'd'.repeat(64), delegate_nsec: 'a'.repeat(64) },
      });
      assert.strictEqual(bolt11WhenPayBolt11Called, SAMPLE_2000_SAT_INVOICE, 'bolt11 was already persisted when payBolt11 ran');
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.state, 'failed');
      assert.ok(
        result.payment.reason.startsWith('ambiguous_send:'),
        `expected ambiguous_send prefix, got: ${result.payment.reason}`
      );
    } finally {
      clearProcessStubs();
    }
  });

  await test('processAutoPayClaim marks a post-send error ambiguous_send when the wallet cannot confirm either way', async () => {
    const issuer = '5'.repeat(64);
    const claimant = '6'.repeat(64);
    const bounty = createBounty({
      issuerPubkey: issuer,
      listCoordinate: 'lc-ambiguous-send',
      amountSats: 500,
      bountyCapSats: 500,
      criteria: 'ambiguous send after error',
    });
    const claimEventId = 'ambiguous-send';

    stubGetProfiles.set(async () => new Map([[claimant, { lud16: 'claimant@example.com' }]]));
    stubGetBalance.set(async () => ({ balance_sats: 10_000 }));
    stubMintZapInvoice.set(async () => ({ type: 'bolt11', payload: SAMPLE_2000_SAT_INVOICE }));
    stubPayBolt11.set(async () => { throw new Error('socket hang up'); });
    stubGetPaymentStatus.set(async () => ({ inconclusive: true, reason: 'wallet_cli_no_lookup' }));

    try {
      const result = await processAutoPayClaim(bounty, claim(claimEventId, claimant, 1), {
        delegate: { delegate_pubkey: 'd'.repeat(64), delegate_nsec: 'a'.repeat(64) },
      });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.state, 'failed');
      assert.strictEqual(result.error, 'socket hang up');
      assert.strictEqual(result.payment.reason, 'ambiguous_send: socket hang up');

      const row = getAutoPaymentByClaimId(claimEventId);
      assert.strictEqual(row.state, 'failed');
      assert.strictEqual(row.reason, 'ambiguous_send: socket hang up');
    } finally {
      clearProcessStubs();
    }
  });

  await test('processAutoPayClaim treats a post-send error as paid when the wallet confirms it, keeping cap reserved', async () => {
    const issuer = '7'.repeat(64);
    const claimant = '8'.repeat(64);
    const bounty = createBounty({
      issuerPubkey: issuer,
      listCoordinate: 'lc-verified-paid-after-error',
      amountSats: 500,
      bountyCapSats: 500,
      criteria: 'verified paid after error',
    });
    const claimEventId = 'verified-paid-after-error';

    stubGetProfiles.set(async () => new Map([[claimant, { lud16: 'claimant@example.com' }]]));
    stubGetBalance.set(async () => ({ balance_sats: 10_000 }));
    stubMintZapInvoice.set(async () => ({ type: 'bolt11', payload: SAMPLE_2000_SAT_INVOICE }));
    stubPayBolt11.set(async () => { throw new Error('timed out waiting for response'); });
    stubGetPaymentStatus.set(async () => ({ paid: true }));
    // Force pollForReceipt to resolve on its very first loop iteration so the
    // test stays fast and hermetic (no real relay/websocket activity, no
    // multi-second polling wait).
    stubBridgeZapReceipt.set(async () => null);
    stubListClaimsFor.set(async () => [
      { event: { id: claimEventId }, zapReceipt: { id: 'fake-receipt', kind: 9735 } },
    ]);

    try {
      const result = await processAutoPayClaim(bounty, claim(claimEventId, claimant, 1), {
        delegate: { delegate_pubkey: 'd'.repeat(64), delegate_nsec: 'a'.repeat(64) },
      });
      assert.strictEqual(result.ok, true);
      assert.notStrictEqual(result.state, 'failed');
      assert.ok(
        ['settled', 'paid_unreceipted'].includes(result.state),
        `expected a paid-family state, got: ${result.state}`
      );

      const row = getAutoPaymentByClaimId(claimEventId);
      assert.notStrictEqual(row.state, 'failed');
      assert.ok(['paid', 'settled', 'paid_unreceipted'].includes(row.state));

      // Spend-capable states are everything except 'failed' — a non-'failed'
      // terminal state means the 500 sats stayed reserved against the cap
      // instead of being released for a double-pay retry.
      const spent = dailyLimitStatus({ amountSats: 1, issuerPubkey: issuer }).spentSats;
      assert.strictEqual(spent, 500);
    } finally {
      clearProcessStubs();
    }
  });

  await test('resetPayment blocks a row flagged ambiguous_send unless forced, and deletes plain failed rows freely', () => {
    const now = 13_000_000;
    assert.strictEqual(insertAttemptingPayment(basePayment('ambiguous-reset', 500, now)).inserted, true);
    updatePaymentState('ambiguous-reset', 'failed', { reason: 'ambiguous_send: socket hang up', now: now + 1 });

    const blocked = resetPayment('ambiguous-reset');
    assert.deepStrictEqual(blocked, { reset: false, blocked: 'ambiguous_payment' });
    assert.ok(getAutoPaymentByClaimId('ambiguous-reset'), 'row still present after a blocked reset');

    const forced = resetPayment('ambiguous-reset', { force: true });
    assert.deepStrictEqual(forced, { reset: true });
    assert.strictEqual(getAutoPaymentByClaimId('ambiguous-reset'), null);

    const now2 = 14_000_000;
    assert.strictEqual(insertAttemptingPayment(basePayment('plain-reset', 500, now2)).inserted, true);
    updatePaymentState('plain-reset', 'failed', { reason: 'stuck_timeout', now: now2 + 1 });

    const plainResult = resetPayment('plain-reset');
    assert.deepStrictEqual(plainResult, { reset: true });
    assert.strictEqual(getAutoPaymentByClaimId('plain-reset'), null);
  });

  await test('resetPayment refuses non-failed rows entirely — attempting/paid/settled/paid_unreceipted, even with force', () => {
    const now = 14_500_000;
    // Mid-flight: a live send may still be outstanding; deleting the row would
    // drop the already_attempted guard and allow a second mint+send.
    assert.strictEqual(insertAttemptingPayment(basePayment('reset-attempting', 500, now)).inserted, true);
    assert.deepStrictEqual(resetPayment('reset-attempting'), { reset: false, blocked: 'not_failed' });
    assert.deepStrictEqual(resetPayment('reset-attempting', { force: true }), { reset: false, blocked: 'not_failed' });
    assert.ok(getAutoPaymentByClaimId('reset-attempting'), 'attempting row survives reset attempts');

    // Definitively-paid rows (incl. the wallet-verified-after-error states)
    // are money that already left — never resettable.
    for (const [claimId, state, reason] of [
      ['reset-paid', 'paid', 'verified_paid_after_error'],
      ['reset-settled', 'settled', null],
      ['reset-unreceipted', 'paid_unreceipted', 'verified_paid_after_stuck'],
    ]) {
      assert.strictEqual(insertAttemptingPayment(basePayment(claimId, 100, now)).inserted, true);
      updatePaymentState(claimId, state, { reason, now: now + 1 });
      assert.deepStrictEqual(resetPayment(claimId), { reset: false, blocked: 'not_failed' });
      assert.deepStrictEqual(resetPayment(claimId, { force: true }), { reset: false, blocked: 'not_failed' });
      assert.ok(getAutoPaymentByClaimId(claimId), `${state} row survives reset attempts`);
      // The row still suppresses a second attempt for this claim.
      assert.strictEqual(insertAttemptingPayment(basePayment(claimId, 100, now + 2)).inserted, false);
    }

    // Unknown claim id: nothing to reset, not an error.
    assert.deepStrictEqual(resetPayment('reset-nonexistent'), { reset: false });

    // Cleanup via the legitimate remediation path (a lingering 'attempting'
    // fixture would otherwise be swept by the reconcile tests below): once the
    // row is genuinely failed, reset works again.
    updatePaymentState('reset-attempting', 'failed', { reason: 'test_cleanup', now: now + 3 });
    assert.deepStrictEqual(resetPayment('reset-attempting'), { reset: true });
  });

  await test('reconcileStuckAttempts: bolt11-less stuck row fails stuck_timeout; bolt11-bearing + inconclusive row goes ambiguous', async () => {
    const now = 15_000_000;
    const staleAt = now - 700; // older than the default 600s cutoff
    assert.strictEqual(insertAttemptingPayment(basePayment('stuck-no-bolt11', 500, staleAt)).inserted, true);
    assert.strictEqual(insertAttemptingPayment(basePayment('stuck-with-bolt11', 500, staleAt)).inserted, true);
    updatePaymentState('stuck-with-bolt11', 'attempting', { bolt11: SAMPLE_2000_SAT_INVOICE, now: staleAt });

    stubGetPaymentStatus.set(async () => ({ inconclusive: true, reason: 'test_stub' }));
    try {
      const result = await reconcileStuckAttempts({ now });
      assert.strictEqual(result.reconciled, 2);
    } finally {
      stubGetPaymentStatus.clear();
    }

    const noBolt = getAutoPaymentByClaimId('stuck-no-bolt11');
    assert.strictEqual(noBolt.state, 'failed');
    assert.strictEqual(noBolt.reason, 'stuck_timeout');

    const withBolt = getAutoPaymentByClaimId('stuck-with-bolt11');
    assert.strictEqual(withBolt.state, 'failed');
    assert.strictEqual(withBolt.reason, 'ambiguous_send: stuck_timeout');
  });

  await test('reconcileStuckAttempts marks a bolt11-bearing stuck row paid_unreceipted when the wallet confirms payment', async () => {
    const now = 16_000_000;
    const staleAt = now - 700;
    assert.strictEqual(insertAttemptingPayment(basePayment('stuck-verified-paid', 500, staleAt)).inserted, true);
    updatePaymentState('stuck-verified-paid', 'attempting', { bolt11: SAMPLE_2000_SAT_INVOICE, now: staleAt });

    stubGetPaymentStatus.set(async () => ({ paid: true }));
    try {
      const result = await reconcileStuckAttempts({ now });
      assert.strictEqual(result.reconciled, 1);
    } finally {
      stubGetPaymentStatus.clear();
    }

    const row = getAutoPaymentByClaimId('stuck-verified-paid');
    assert.strictEqual(row.state, 'paid_unreceipted');
    assert.strictEqual(row.reason, 'verified_paid_after_stuck');
  });

  // --- Gap 2: judgment gate is now fail-closed by default ---

  await test('payClaim fails closed by default: refuses a live payment without a recorded accept-judgment', async () => {
    delete process.env.AGENT_REQUIRE_JUDGMENT;
    rankOverride = async () => 100; // clear the rank gate so the judgment gate is what's under test
    try {
      const issuer = 'e'.repeat(64);
      const claimant = '1'.repeat(64);
      const bounty = createBounty({
        issuerPubkey: issuer,
        listCoordinate: 'lc-judgment-default-block',
        amountSats: 500,
        bountyCapSats: 500,
        criteria: 'judgment gate default (blocked)',
      });
      setFakePayableClaims(bounty.id, [claim('judgment-default-block', claimant, 1)]);

      const result = await payClaim({ bountyId: bounty.id, claimEventId: 'judgment-default-block' });
      assert.deepStrictEqual(result, { ok: false, reason: 'no_accept_judgment' });
      assert.strictEqual(getAutoPaymentByClaimId('judgment-default-block'), null);
    } finally {
      rankOverride = null;
    }
  });

  await test('payClaim proceeds past the judgment gate once a confident accept is recorded', async () => {
    delete process.env.AGENT_REQUIRE_JUDGMENT;
    rankOverride = async () => 100;
    try {
      const issuer = 'e'.repeat(64);
      const claimant = '2'.repeat(64);
      const bounty = createBounty({
        issuerPubkey: issuer,
        listCoordinate: 'lc-judgment-default-allow',
        amountSats: 500,
        bountyCapSats: 500,
        criteria: 'judgment gate default (allowed)',
      });
      const claimEventId = 'judgment-default-allow';
      setFakePayableClaims(bounty.id, [claim(claimEventId, claimant, 1)]);
      appendAudit({ kind: 'judgment', bountyId: bounty.id, claimEventId, decision: 'accept', pay: true });

      const result = await payClaim({ bountyId: bounty.id, claimEventId });
      assert.notStrictEqual(result.reason, 'no_accept_judgment');
      // No wallet delegate is configured in this hermetic harness, so the real
      // payment attempt fails closed further downstream — but crucially it DID
      // attempt (an auto_payments row exists), proving the judgment gate let it
      // through rather than short-circuiting the way it did above.
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.state, 'failed');
      assert.match(result.error, /delegate/);
      const row = getAutoPaymentByClaimId(claimEventId);
      assert.ok(row, 'auto_payments row was created (payment was actually attempted)');
      assert.strictEqual(row.state, 'failed');
    } finally {
      rankOverride = null;
    }
  });

  await test('AGENT_REQUIRE_JUDGMENT=false explicitly opts out of the judgment gate', async () => {
    process.env.AGENT_REQUIRE_JUDGMENT = 'false';
    rankOverride = async () => 100;
    try {
      const issuer = 'e'.repeat(64);
      const claimant = '9'.repeat(64);
      const bounty = createBounty({
        issuerPubkey: issuer,
        listCoordinate: 'lc-judgment-opt-out',
        amountSats: 500,
        bountyCapSats: 500,
        criteria: 'judgment gate opt-out',
      });
      const claimEventId = 'judgment-opt-out';
      setFakePayableClaims(bounty.id, [claim(claimEventId, claimant, 1)]);
      // Deliberately no judgment recorded — the opt-out must skip the gate anyway.

      const result = await payClaim({ bountyId: bounty.id, claimEventId });
      assert.notStrictEqual(result.reason, 'no_accept_judgment');
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.state, 'failed');
      assert.match(result.error, /delegate/);
    } finally {
      delete process.env.AGENT_REQUIRE_JUDGMENT;
      rankOverride = null;
    }
  });

  console.log(`\n${passed} auto-pay tests passed`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
