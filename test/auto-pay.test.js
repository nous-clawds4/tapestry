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
  FINAL_STATES,
  getAutoPayment,
  insertAttemptingPayment,
  listReconciliationPayments,
  dailyLimitStatus,
  resetPayment: resetScopedPayment,
  paymentReference,
  stableClaimAddress,
  updatePaymentState: updateScopedPaymentState,
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
const { runAutoPayTick, maxPaymentSats, reconcileIssuerPayments, reconcileStuckAttempts, processAutoPayClaim } = require('../src/services/autoPayWatcher');

const SAMPLE_2000_SAT_INVOICE = 'lnbc20u1p3y0x3hpp5743k2g0fsqqxj7n8qzuhns5gmkk4djeejk3wkp64ppevgekvc0jsdqcve5kzar2v9nr5gpqd4hkuetesp5ez2g297jduwc20t6lmqlsg3man0vf2jfd8ar9fh8fhn2g8yttfkqxqy9gcqcqzys9qrsgqrzjqtx3k77yrrav9hye7zar2rtqlfkytl094dsp0ms5majzth6gt7ca6uhdkxl983uywgqqqqlgqqqvx5qqjqrzjqd98kxkpyw0l9tyy8r8q57k7zpy9zjmh6sez752wj6gcumqnj3yxzhdsmg6qq56utgqqqqqqqqqqqeqqjq7jd56882gtxhrjm03c93aacyfy306m4fq0tskf83c0nmet8zc2lxyyg3saz8x6vwcp26xnrlagf9semau3qm2glysp7sv95693fphvsp54l567';

let passed = 0;

async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

function basePayment(claimId, amountSats, now, overrides = {}) {
  const claimantPubkey = overrides.claimantPubkey || 'b'.repeat(64);
  const bountyId = overrides.bountyId || 'bounty-1';
  return {
    claimEventId: claimId,
    bountyId,
    issuerPubkey: overrides.issuerPubkey || 'a'.repeat(64),
    claimantPubkey,
    claimAddress: overrides.claimAddress || `39999:${claimantPubkey}:${claimId}`,
    amountSats,
    now,
  };
}

function paymentByClaim(claimId, bountyId = 'bounty-1') {
  return getAutoPayment({ bountyId, claimEventId: claimId });
}
function getAutoPaymentByClaimId(claimId, bountyId = 'bounty-1') {
  return paymentByClaim(claimId, bountyId);
}

function resetPayment(claimId, opts = {}, bountyId = 'bounty-1') {
  const row = paymentByClaim(claimId, bountyId);
  const issuerPubkey = row?.issuer_pubkey || 'a'.repeat(64);
  return resetScopedPayment({ bountyId, claimEventId: claimId, issuerPubkey }, opts);
}


function updatePaymentState(claimId, state, fields = {}, bountyId = 'bounty-1') {
  const row = paymentByClaim(claimId, bountyId);
  if (!row) throw new Error(`missing payment ${bountyId}/${claimId}`);
  return updateScopedPaymentState(paymentReference(row), state, fields);
}

function claim(id, pubkey, createdAt, autoPayment = null, listCoordinate = 'list-coordinate') {
  return {
    event: { id, kind: 39999, pubkey, created_at: createdAt, tags: [['z', listCoordinate], ['d', id]] },
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
    assert.strictEqual(paymentByClaim('cap-blocked'), null);
  });

  await test('per-payment cap fails closed for invalid values and never exceeds the daily ceiling', () => {
    assert.strictEqual(maxPaymentSats('not-a-number'), 0);
    assert.strictEqual(maxPaymentSats('Infinity'), 0);
    assert.strictEqual(maxPaymentSats('0'), 0);
    assert.strictEqual(maxPaymentSats('5000'), 5000);
    assert.strictEqual(maxPaymentSats('5001'), 5000);
  });

  await test('stable claim identity requires the bounty list coordinate in a z tag', () => {
    const claimant = '9'.repeat(64);
    const event = claim('identity-event', claimant, 1, null, 'expected-list').event;
    assert.strictEqual(
      stableClaimAddress(event, 'expected-list'),
      `39999:${claimant}:expected-list`,
    );
    assert.strictEqual(stableClaimAddress(event, 'other-list'), null);
    assert.strictEqual(stableClaimAddress({ ...event, tags: [['d', 'only-d']] }, 'expected-list'), null);
    assert.strictEqual(
      stableClaimAddress({ ...event, tags: [['z', 'expected-list'], ['z', 'other-list']] }, 'expected-list'),
      null,
    );
    assert.strictEqual(
      stableClaimAddress({ ...event, tags: [['z', 'expected-list'], ['z', 'expected-list']] }, 'expected-list'),
      null,
    );
  });

  await test('payment identity is bounty plus replaceable claim address', () => {
    const now = 2_500_000;
    const claimant = '9'.repeat(64);
    const sharedEvent = 'shared-event';
    const sharedAddress = `39999:${claimant}:list-coordinate`;
    const first = basePayment(sharedEvent, 10, now, {
      bountyId: 'identity-bounty-1',
      claimantPubkey: claimant,
      claimAddress: sharedAddress,
    });
    const second = { ...first, bountyId: 'identity-bounty-2', now: now + 1 };
    assert.strictEqual(insertAttemptingPayment(first).inserted, true);
    assert.strictEqual(insertAttemptingPayment(second).inserted, true);

    const replacement = {
      ...first,
      claimEventId: 'replacement-event',
      now: now + 2,
    };
    const duplicate = insertAttemptingPayment(replacement);
    assert.strictEqual(duplicate.inserted, false);
    assert.strictEqual(duplicate.existing.claim_event_id, sharedEvent);
    assert.notStrictEqual(
      getAutoPayment({ bountyId: first.bountyId, claimAddress: sharedAddress }).id,
      getAutoPayment({ bountyId: second.bountyId, claimAddress: sharedAddress }).id,
    );
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
  await test('ambiguous send remains reserved in issuer cap until an explicit forced reset', () => {
    const now = 3_100_000;
    assert.strictEqual(insertAttemptingPayment(basePayment('ambiguous-cap', 5000, now)).inserted, true);
    updatePaymentState('ambiguous-cap', 'failed', { reason: 'ambiguous_send: timeout', now: now + 1 });
    assert.strictEqual(dailyLimitStatus({ amountSats: 1, now: now + 2 }).ok, false);

    assert.deepStrictEqual(resetPayment('ambiguous-cap'), { reset: false, blocked: 'ambiguous_payment' });
    assert.deepStrictEqual(resetPayment('ambiguous-cap', { force: true }), { reset: true });
    assert.strictEqual(dailyLimitStatus({ amountSats: 5000, now: now + 3 }).ok, true);
  });


  await test('spend gate authorizes allowlisted pubkeys and rejects ordinary users', () => {
    assert.strictEqual(isAutoPayAuthorized('d'.repeat(64)), true);
    assert.strictEqual(isAutoPayAuthorized('f'.repeat(64)), false);
  });

  await test('allowlisted issuers can reset and inspect only their own payment rows', async () => {
    const issuer = 'd'.repeat(64);
    const otherIssuer = 'e'.repeat(64);
    for (const [claimId, rowIssuer] of [
      ['scope-own-reset', issuer],
      ['scope-foreign-reset', otherIssuer],
      ['scope-own-status', issuer],
    ]) {
      assert.strictEqual(insertAttemptingPayment({
        ...basePayment(claimId, 10, 4_000_000),
        issuerPubkey: rowIssuer,
      }).inserted, true);
      updatePaymentState(claimId, 'failed', { reason: 'test failure', now: 4_000_001 });
    }

    const routes = new Map();
    bountiesApi.register({
      get: (route, ...handlers) => routes.set(`GET ${route}`, handlers),
      post: (route, ...handlers) => routes.set(`POST ${route}`, handlers),
    });
    async function invoke(method, route, body = {}) {
      const req = { session: { authenticated: true, pubkey: issuer }, body };
      const response = { statusCode: 200, body: null };
      const res = {
        status(code) { response.statusCode = code; return this; },
        json(payload) { response.body = payload; return this; },
      };
      for (const handler of routes.get(`${method} ${route}`)) {
        let advanced = false;
        await handler(req, res, () => { advanced = true; });
        if (response.body || !advanced) break;
      }
      return response;
    }

    const denied = await invoke('POST', '/api/bounties/auto-pay/reset', {
      bountyId: 'bounty-1',
      claimEventId: 'scope-foreign-reset',
    });
    assert.strictEqual(denied.statusCode, 403);
    assert.ok(paymentByClaim('scope-foreign-reset'));

    const own = await invoke('POST', '/api/bounties/auto-pay/reset', {
      bountyId: 'bounty-1',
      claimEventId: 'scope-own-reset',
    });
    assert.strictEqual(own.statusCode, 200);
    assert.strictEqual(own.body.reset, true);
    assert.strictEqual(paymentByClaim('scope-own-reset'), null);

    const status = await invoke('GET', '/api/bounties/auto-pay/status');
    assert.strictEqual(status.statusCode, 200);
    assert.ok(status.body.recentPayments.some(row => row.claim_event_id === 'scope-own-status'));
    assert.ok(status.body.recentPayments.every(row => row.issuer_pubkey === issuer));
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
  for (const legacyPayment of [
    { state: 'paid' },
    { state: 'failed', reason: 'ambiguous_send: timeout' },
  ]) {
    await test(`legacy ${legacyPayment.state} payment blocks replacement claims for the whole bounty`, () => {
      const state = calculateBountyPaymentState({
        amount_sats: 100,
        bounty_cap_sats: 500,
        reward_per_item: 0,
      }, [
        {
          ...claim('old-event', '', 1, legacyPayment),
          durableOnly: true,
          legacyPaymentBlock: true,
        },
        claim('replacement-event', 'a'.repeat(64), 2),
      ]);
      assert.equal(state.legacyPaymentBlock, true);
      assert.deepStrictEqual(state.payableClaims, []);
      assert.deepStrictEqual(
        state.closedClaims.map(item => item.closedReason),
        ['legacy_payment_reconciliation_required'],
      );
    });
  }
  await test('ambiguous send consumes bounty and per-pubkey capacity', () => {
    const claimant = 'a'.repeat(64);
    const next = 'b'.repeat(64);
    const state = calculateBountyPaymentState({
      amount_sats: 100,
      bounty_cap_sats: 200,
      reward_per_item: 0,
      max_rewards_per_npub: 1,
    }, [
      claim('ambiguous-held', claimant, 1, { state: 'failed', reason: 'ambiguous_send: timeout' }),
      claim('same-claimant', claimant, 2),
      claim('next-claimant', next, 3),
    ]);

    assert.deepStrictEqual(state.heldClaims.map(item => item.event.id), ['ambiguous-held']);
    assert.deepStrictEqual(state.reconciliationClaims.map(item => item.event.id), ['ambiguous-held']);
    assert.deepStrictEqual(state.payableClaims.map(item => item.event.id), ['next-claimant']);
    assert.strictEqual(state.remainingRewardSlots, 1);
  });


  await test('attempting, paid, and paid_unreceipted claims remain visible for reconciliation', () => {
    const state = calculateBountyPaymentState({
      amount_sats: 100,
      bounty_cap_sats: 300,
      reward_per_item: 1,
    }, [
      claim('attempting-visible', 'a'.repeat(64), 1, { state: 'attempting' }),
      claim('paid-visible', 'b'.repeat(64), 2, { state: 'paid' }),
      claim('unreceipted-visible', 'c'.repeat(64), 3, { state: 'paid_unreceipted' }),
    ]);
    assert.deepStrictEqual(
      state.reconciliationClaims.map(item => item.event.id),
      ['attempting-visible', 'paid-visible', 'unreceipted-visible'],
    );
    assert.deepStrictEqual(FINAL_STATES, ['settled', 'paid_unreceipted']);
  });

  await test('payClaim reports an existing failed row without treating it as terminal or retrying', async () => {
    const issuer = 'd'.repeat(64);
    const claimant = 'e'.repeat(64);
    const bounty = createBounty({
      issuerPubkey: issuer,
      listCoordinate: `39998:${issuer}:failed-row`,
      amountSats: 25,
      criteria: 'test',
    });
    const payable = claim('failed-payment-visible', claimant, 1, null, bounty.list_coordinate);
    payable.paymentAmountSats = 25;
    setFakePayableClaims(bounty.id, [payable]);
    insertAttemptingPayment({
      claimEventId: payable.event.id,
      bountyId: bounty.id,
      issuerPubkey: issuer,
      claimantPubkey: claimant,
      claimAddress: `39999:${claimant}:${bounty.list_coordinate}`,
      amountSats: 25,
    });
    updatePaymentState(payable.event.id, 'failed', { reason: 'wallet rejected' }, bounty.id);

    const result = await payClaim({ bountyId: bounty.id, claimEventId: payable.event.id, dryRun: true });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'already_attempted');
    assert.equal(result.payment.state, 'failed');
    assert.equal(getAutoPaymentByClaimId(payable.event.id, bounty.id).state, 'failed');
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
    setFakePayableClaims(bounty.id, [claim('self-claim-exact', issuer, 1, null, bounty.list_coordinate)]);

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
    setFakePayableClaims(bounty.id, [claim('self-claim-mixed', issuerUpper.toLowerCase(), 1, null, bounty.list_coordinate)]);

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
      setFakePayableClaims(bounty.id, [claim('tick-self-claim', issuer, 1, null, bounty.list_coordinate)]);

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
      bolt11WhenPayBolt11Called = getAutoPaymentByClaimId(claimEventId, bounty.id)?.bolt11 ?? null;
      throw new Error('send exploded');
    });
    stubGetPaymentStatus.set(async () => ({ inconclusive: true, reason: 'test_stub' }));

    try {
      const result = await processAutoPayClaim(bounty, claim(claimEventId, claimant, 1, null, bounty.list_coordinate), {
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
      const result = await processAutoPayClaim(bounty, claim(claimEventId, claimant, 1, null, bounty.list_coordinate), {
        delegate: { delegate_pubkey: 'd'.repeat(64), delegate_nsec: 'a'.repeat(64) },
      });
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.state, 'failed');
      assert.strictEqual(result.error, 'socket hang up');
      assert.strictEqual(result.payment.reason, 'ambiguous_send: socket hang up');

      const row = getAutoPaymentByClaimId(claimEventId, bounty.id);
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
      const result = await processAutoPayClaim(bounty, claim(claimEventId, claimant, 1, null, bounty.list_coordinate), {
        delegate: { delegate_pubkey: 'd'.repeat(64), delegate_nsec: 'a'.repeat(64) },
      });
      assert.strictEqual(result.ok, true);
      assert.notStrictEqual(result.state, 'failed');
      assert.ok(
        ['settled', 'paid_unreceipted'].includes(result.state),
        `expected a paid-family state, got: ${result.state}`
      );

      const row = getAutoPaymentByClaimId(claimEventId, bounty.id);
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
  await test('reconcileIssuerPayments resolves ambiguous sends from wallet facts', async () => {
    const issuer = '1'.repeat(64);
    const cases = [
      ['ambiguous-now-settled', 'invoice-settled', { paid: true }],
      ['ambiguous-now-unreceipted', 'invoice-unreceipted', { paid: true }],
      ['ambiguous-now-unpaid', 'invoice-unpaid', { paid: false }],
      ['ambiguous-still-unknown', 'invoice-unknown', { inconclusive: true, reason: 'wallet_pending' }],
    ];
    for (const [index, [claimId, bolt11]] of cases.entries()) {
      assert.strictEqual(insertAttemptingPayment({
        ...basePayment(claimId, 25, 14_900_000 + index),
        bountyId: 'ambiguous-reconcile-bounty',
        issuerPubkey: issuer,
      }).inserted, true);
      updatePaymentState(claimId, 'attempting', { bolt11, now: 14_900_010 + index }, 'ambiguous-reconcile-bounty');
      updatePaymentState(claimId, 'failed', { reason: 'ambiguous_send: timeout', now: 14_900_020 + index }, 'ambiguous-reconcile-bounty');
    }

    const statusByInvoice = new Map(cases.map(([, bolt11, status]) => [bolt11, status]));
    // now sits just after the fixture rows, so no row has aged past the
    // receipt grace window yet.
    const result = await reconcileIssuerPayments({ issuerPubkey: issuer, now: 14_900_100 }, {
      getPaymentStatus: async ({ bolt11 }) => statusByInvoice.get(bolt11),
      getBounty: () => ({ id: 'ambiguous-reconcile-bounty' }),
      bridgeZapReceipt: async () => null,
      readLocalReceipt: async (_bounty, claimId) => (
        claimId === 'ambiguous-now-settled' ? { id: 'receipt' } : null
      ),
    });

    assert.deepStrictEqual(
      result.results.map(item => [item.claimEventId, item.state, item.status]),
      [
        ['ambiguous-now-settled', 'settled', 'settled'],
        ['ambiguous-now-unreceipted', 'paid_unreceipted', 'reconciliation_unresolved'],
        ['ambiguous-now-unpaid', 'failed', 'reset_required'],
        ['ambiguous-still-unknown', 'failed', 'ambiguous_reconciliation'],
      ],
    );
    assert.equal(
      getAutoPaymentByClaimId('ambiguous-now-unpaid', 'ambiguous-reconcile-bounty').reason,
      'wallet_confirmed_unpaid',
    );
    assert.equal(
      getAutoPaymentByClaimId('ambiguous-still-unknown', 'ambiguous-reconcile-bounty').reason,
      'ambiguous_send: timeout',
    );
  });

  await test('reconcileIssuerPayments dry-run writes nothing and live mode settles an observed receipt without paying', async () => {
    const issuer = 'f'.repeat(64);
    const claimId = 'reconcile-observed-receipt';
    assert.strictEqual(insertAttemptingPayment({
      ...basePayment(claimId, 50, 14_700_000),
      bountyId: 'reconcile-bounty',
      issuerPubkey: issuer,
    }).inserted, true);
    updatePaymentState(claimId, 'attempting', { bolt11: SAMPLE_2000_SAT_INVOICE, now: 14_700_001 }, 'reconcile-bounty');
    let bridgeCalls = 0;
    const dependencies = {
      getPaymentStatus: async () => ({ paid: true }),
      getBounty: () => ({ id: 'reconcile-bounty' }),
      readLocalReceipt: async () => ({ id: 'receipt-event' }),
      bridgeZapReceipt: async () => { bridgeCalls += 1; return null; },
    };

    const dryRun = await reconcileIssuerPayments({ issuerPubkey: issuer, dryRun: true }, dependencies);
    assert.equal(dryRun.ok, true);
    assert.equal(dryRun.dryRun, true);
    assert.equal(dryRun.results[0].state, 'settled');
    assert.equal(getAutoPaymentByClaimId(claimId, 'reconcile-bounty').state, 'attempting');
    assert.equal(bridgeCalls, 0);

    const live = await reconcileIssuerPayments({ issuerPubkey: issuer }, dependencies);
    assert.equal(live.ok, true);
    assert.equal(live.dryRun, false);
    assert.equal(live.results[0].status, 'settled');
    assert.equal(getAutoPaymentByClaimId(claimId, 'reconcile-bounty').state, 'settled');
    assert.equal(bridgeCalls, 1);
  });

  await test('reconcileIssuerPayments reports missing receipts and failed rows as unresolved work', async () => {
    const issuer = '9'.repeat(64);
    const paidClaim = 'reconcile-missing-receipt';
    const failedClaim = 'reconcile-reset-required';
    assert.strictEqual(insertAttemptingPayment({
      ...basePayment(paidClaim, 50, 14_800_000),
      bountyId: 'reconcile-bounty',
      issuerPubkey: issuer,
    }).inserted, true);
    updatePaymentState(paidClaim, 'paid', { bolt11: SAMPLE_2000_SAT_INVOICE, now: 14_800_001 }, 'reconcile-bounty');
    assert.strictEqual(insertAttemptingPayment({
      ...basePayment(failedClaim, 50, 14_800_002),
      bountyId: 'reconcile-bounty',
      issuerPubkey: issuer,
    }).inserted, true);
    updatePaymentState(failedClaim, 'failed', { reason: 'wallet rejected', now: 14_800_003 }, 'reconcile-bounty');

    const result = await reconcileIssuerPayments({ issuerPubkey: issuer, now: 14_800_100 }, {
      getBounty: () => ({ id: 'reconcile-bounty' }),
      readLocalReceipt: async () => null,
      bridgeZapReceipt: async () => null,
    });
    assert.equal(result.ok, false);
    assert.equal(result.results.find(item => item.claimEventId === paidClaim).status, 'reconciliation_unresolved');
    assert.equal(result.results.find(item => item.claimEventId === failedClaim).status, 'reset_required');
    assert.equal(getAutoPaymentByClaimId(paidClaim, 'reconcile-bounty').state, 'paid_unreceipted');
    assert.equal(getAutoPaymentByClaimId(failedClaim, 'reconcile-bounty').state, 'failed');
  });

  // docker-compose passes "" when the host .env leaves the var unset; Number("")
  // is 0, which used to collapse the grace window to zero seconds.
  await test('receiptGraceSeconds treats blank env values as unset', () => {
    const { receiptGraceSeconds } = require('../src/db/autoPay');
    const fallback = receiptGraceSeconds(undefined);
    assert.ok(fallback > 0);
    assert.equal(receiptGraceSeconds(''), fallback);
    assert.equal(receiptGraceSeconds('   '), fallback);
    assert.equal(receiptGraceSeconds('3600'), 3600);
  });

  // One unreceipted payment used to fail every later pass, so the settlement
  // timer reported failed forever and the runbook gate could never pass again.
  await test('reconcileIssuerPayments makes paid_unreceipted terminal once the receipt grace window closes', async () => {
    const issuer = '7'.repeat(64);
    const claimId = 'reconcile-receipt-grace';
    const createdAt = 14_850_000;
    const graceSeconds = 3600;
    assert.strictEqual(insertAttemptingPayment({
      ...basePayment(claimId, 50, createdAt),
      bountyId: 'receipt-grace-bounty',
      issuerPubkey: issuer,
    }).inserted, true);
    updatePaymentState(claimId, 'paid', { bolt11: SAMPLE_2000_SAT_INVOICE, now: createdAt + 1 }, 'receipt-grace-bounty');
    const dependencies = {
      getBounty: () => ({ id: 'receipt-grace-bounty' }),
      readLocalReceipt: async () => null,
      bridgeZapReceipt: async () => null,
    };

    const insideGrace = await reconcileIssuerPayments({
      issuerPubkey: issuer, now: createdAt + 60, graceSeconds,
    }, dependencies);
    assert.equal(insideGrace.ok, false);
    assert.equal(insideGrace.results[0].status, 'reconciliation_unresolved');
    assert.equal(getAutoPaymentByClaimId(claimId, 'receipt-grace-bounty').state, 'paid_unreceipted');

    const afterGrace = await reconcileIssuerPayments({
      issuerPubkey: issuer, now: createdAt + graceSeconds + 60, graceSeconds,
    }, dependencies);
    assert.equal(afterGrace.ok, true, 'an aged unreceipted payment must stop failing the run');
    assert.equal(afterGrace.results.length, 0, 'an aged unreceipted payment leaves the reconciliation queue');
    assert.equal(getAutoPaymentByClaimId(claimId, 'receipt-grace-bounty').state, 'paid_unreceipted');

    // A row that ages out during the same pass reports its terminal status once.
    const agedClaimId = 'reconcile-receipt-grace-aged';
    assert.strictEqual(insertAttemptingPayment({
      ...basePayment(agedClaimId, 50, createdAt),
      bountyId: 'receipt-grace-bounty',
      issuerPubkey: issuer,
    }).inserted, true);
    updatePaymentState(agedClaimId, 'paid', { bolt11: SAMPLE_2000_SAT_INVOICE, now: createdAt + 1 }, 'receipt-grace-bounty');
    const agedOut = await reconcileIssuerPayments({
      issuerPubkey: issuer, now: createdAt + graceSeconds + 60, graceSeconds,
    }, dependencies);
    assert.equal(agedOut.ok, true);
    assert.equal(agedOut.results.length, 1);
    assert.equal(agedOut.results[0].status, 'paid_unreceipted_final');
    assert.equal(agedOut.results[0].reason, 'receipt_grace_elapsed');

    // The row also leaves the reconciliation query, so later passes never see it.
    const stillQueued = listReconciliationPayments(issuer, { now: createdAt + 60, graceSeconds });
    assert.equal(stillQueued.some(row => row.claim_event_id === claimId), true);
    const droppedFromQueue = listReconciliationPayments(issuer, {
      now: createdAt + graceSeconds + 60, graceSeconds,
    });
    assert.equal(droppedFromQueue.some(row => row.claim_event_id === claimId), false);
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
      setFakePayableClaims(bounty.id, [claim('judgment-default-block', claimant, 1, null, bounty.list_coordinate)]);

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
      setFakePayableClaims(bounty.id, [claim(claimEventId, claimant, 1, null, bounty.list_coordinate)]);
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
      const row = getAutoPaymentByClaimId(claimEventId, bounty.id);
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
      setFakePayableClaims(bounty.id, [claim(claimEventId, claimant, 1, null, bounty.list_coordinate)]);
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
