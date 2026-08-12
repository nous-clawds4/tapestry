const { getBounty, listAutoPayOpenBounties } = require('../db/bounties');
const {
  AUTO_PAY_DAILY_LIMIT_SATS,
  getAutoPayment,
  getDelegate,
  insertAttemptingPayment,
  listReconciliationPayments,
  listStuckAttempting,
  paymentReference,
  receiptGraceSeconds,
  stableClaimAddress,
  updatePaymentState,
} = require('../db/autoPay');
const { paymentStateForBounty, listClaimsFor } = require('../api/bounties');
const { rank } = require('../lib/trust-rank');
const { mintZapInvoice } = require('../lib/zap-node');
const { getBalance, getPaymentStatus, payBolt11 } = require('../lib/wallet');
const { bridgeZapReceipt } = require('../lib/zap-bridge');

const DEFAULT_INTERVAL_MS = 30_000;
const DEFAULT_RECEIPT_TIMEOUT_MS = 60_000;
const DEFAULT_RECEIPT_POLL_MS = 5_000;

function autoPayEnabled() {
  return process.env.AUTO_PAY_ENABLED === 'true';
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function localRelays() {
  return String(process.env.AUTO_PAY_ZAP_RELAYS || process.env.BRAINSTORM_RELAY_URL || 'wss://localhost:7777')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function maxPaymentSats(value = process.env.AUTO_PAY_MAX_SATS) {
  const configured = value === undefined ? AUTO_PAY_DAILY_LIMIT_SATS : Number(value);
  if (!Number.isSafeInteger(configured) || configured <= 0) return 0;
  return Math.min(configured, AUTO_PAY_DAILY_LIMIT_SATS);
}

function readReceiving(profileEntry) {
  if (!profileEntry) return null;
  return profileEntry.lud16 || profileEntry.lud06 || null;
}

// A kind-39999 claim is replaceable, so the event id recorded on the payment
// row can differ from the event id the relay serves today. Match either: the
// live event id, or the payment row's own claim event id that listClaimsFor
// carries through as paymentClaimEventId. Matching only the live id orphans the
// receipt lookup for every replaced claim.
async function readLocalReceipt(bounty, claimId) {
  const wanted = String(claimId || '').toLowerCase();
  if (!wanted) return null;
  const claims = await listClaimsFor(bounty, { trustFilter: true });
  const match = claims.find(claim => String(claim.event?.id || '').toLowerCase() === wanted
    || String(claim.paymentClaimEventId || '').toLowerCase() === wanted);
  return match?.zapReceipt || null;
}

async function pollForReceipt(bounty, claimId, {
  timeoutMs = DEFAULT_RECEIPT_TIMEOUT_MS,
  pollMs = DEFAULT_RECEIPT_POLL_MS,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  const relays = localRelays();
  while (Date.now() <= deadline) {
    // Pull any externally-published receipt onto the local relay, then re-scan
    // it (the state machine only trusts the local relay). The bridge's own wait
    // paces the loop, so no extra sleep is needed.
    await bridgeZapReceipt({ claimId, relays, timeoutMs: pollMs }).catch(() => null);
    const receipt = await readLocalReceipt(bounty, claimId);
    if (receipt) return receipt;
  }
  return null;
}

async function profileFor(pubkey) {
  const { getProfiles } = require('../api/profiles/fetchProfiles');
  const profiles = await getProfiles([pubkey]);
  if (profiles instanceof Map) return profiles.get(pubkey) ?? null;
  return profiles?.[pubkey] ?? (Array.isArray(profiles) ? profiles[0] : null);
}

async function processAutoPayClaim(bounty, claim, opts = {}) {
  const claimId = claim?.event?.id;
  if (!claimId) return { ok: false, skipped: true, reason: 'missing_claim_id' };
  const claimAddress = stableClaimAddress(claim.event, bounty.list_coordinate);
  if (!claimAddress) return { ok: false, skipped: true, reason: 'invalid_claim_address' };
  const existing = getAutoPayment({
    bountyId: bounty.id,
    claimAddress,
    issuerPubkey: bounty.issuer_pubkey,
  });
  if (existing) return { ok: false, skipped: true, reason: 'already_attempted', payment: existing };

  const amountSats = Number(claim.paymentAmountSats ?? bounty.amount_sats);
  if (!Number.isInteger(amountSats) || amountSats <= 0) {
    return { ok: false, skipped: true, reason: 'invalid_amount' };
  }
  if (amountSats > maxPaymentSats()) {
    return { ok: false, skipped: true, reason: 'payment_max_exceeded' };
  }

  const inserted = insertAttemptingPayment({
    claimEventId: claimId,
    bountyId: bounty.id,
    issuerPubkey: bounty.issuer_pubkey,
    claimantPubkey: claim.event.pubkey,
    claimAddress,
    amountSats,
  });
  if (!inserted.inserted) {
    return {
      ok: false,
      skipped: true,
      reason: inserted.reason || 'already_attempted',
      payment: inserted.existing,
      limit: inserted.limit,
    };
  }
  const paymentRef = paymentReference(inserted.payment);
  const update = (state, fields) => updatePaymentState(paymentRef, state, fields);
  // updatePaymentState throws when it matches no row. Inside the catch block
  // below that throw would replace the real send error and lose the
  // ambiguous_send marker, which is the one write that must always land.
  const markState = (state, fields) => {
    try {
      return update(state, fields);
    } catch (writeError) {
      console.error('[auto-pay] could not record payment state', state, writeError.message);
      return null;
    }
  };

  let sentBolt11 = null; // set once the invoice is persisted — after that, the send is "possibly initiated"

  try {
    const delegate = opts.delegate || getDelegate(bounty.issuer_pubkey);
    if (!delegate?.delegate_nsec) throw new Error('auto-pay delegate key is not configured');

    const profile = await profileFor(claim.event.pubkey);
    const receiving = readReceiving(profile);
    if (!receiving) throw new Error('claimant has no Lightning address');

    // Float preflight: never mint/pay if the wallet can't cover it. Fails closed
    // (marks the attempt failed); top up + admin reset to retry.
    const floatSats = Number((await getBalance())?.balance_sats);
    if (!Number.isFinite(floatSats) || floatSats < amountSats) {
      throw new Error(`insufficient wallet float: have ${Number.isFinite(floatSats) ? floatSats : 0} sats, need ${amountSats}`);
    }

    const invoice = await mintZapInvoice({
      recipientPubkeyHex: claim.event.pubkey,
      receiving,
      amountSats,
      claimEventId: claimId,
      listCoordinate: bounty.list_coordinate,
      signerPrivateKey: delegate.delegate_nsec,
      relays: localRelays(),
    });

    // Persist the invoice BEFORE sending. Once this write lands, a thrown error
    // out of payBolt11 can no longer be treated as "nothing happened" — the
    // sats may already be gone (timeout/crash after the wallet accepted the
    // send) — so the catch block below verifies against wallet history instead
    // of failing blind.
    update('attempting', { bolt11: invoice.payload });
    sentBolt11 = invoice.payload;

    const walletResponse = await payBolt11(invoice.payload);
    update('paid', {
      bolt11: invoice.payload,
      preimage: walletResponse?.preimage || walletResponse?.paymentPreimage || null,
      walletResponse,
    });

    const receipt = await pollForReceipt(bounty, claimId);
    if (receipt) {
      return { ok: true, state: 'settled', payment: update('settled') };
    }
    return {
      ok: true,
      state: 'paid_unreceipted',
      payment: update('paid_unreceipted', { reason: 'receipt_timeout' }),
    };
  } catch (err) {
    if (!sentBolt11) {
      // Nothing was ever sent — safe to fail exactly as before.
      return {
        ok: false,
        state: 'failed',
        error: err.message,
        payment: markState('failed', { reason: err.message }),
      };
    }

    // The send may have gone through despite the error. Ask the wallet before
    // deciding — assuming "failed" here, followed by a later reset, would
    // double-pay the claimant if the sats actually left.
    const status = await getPaymentStatus({ bolt11: sentBolt11 }).catch(lookupErr => ({
      inconclusive: true,
      reason: `status_lookup_threw: ${lookupErr.message}`,
    }));

    if (status.paid === true) {
      markState('paid', { reason: 'verified_paid_after_error' });
      const receipt = await pollForReceipt(bounty, claimId).catch(() => null);
      if (receipt) {
        return { ok: true, state: 'settled', payment: markState('settled') };
      }
      return {
        ok: true,
        state: 'paid_unreceipted',
        payment: markState('paid_unreceipted', { reason: 'verified_paid_after_error' }),
      };
    }

    if (status.paid === false) {
      return {
        ok: false,
        state: 'failed',
        error: err.message,
        payment: markState('failed', { reason: err.message }),
      };
    }

    // Inconclusive: cannot rule out the send having landed. Fail closed with an
    // ambiguous_send marker so resetPayment (db/autoPay.js) refuses to delete
    // this row without an explicit force.
    return {
      ok: false,
      state: 'failed',
      error: err.message,
      payment: markState('failed', { reason: `ambiguous_send: ${err.message}` }),
    };
  }
}

async function reconcileIssuerPayments({
  issuerPubkey,
  dryRun = false,
  now = nowSeconds(),
  graceSeconds = receiptGraceSeconds(),
} = {}, dependencies = {}) {
  const issuer = String(issuerPubkey || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(issuer)) throw new Error('issuerPubkey must be a 64-char hex pubkey');

  const listRows = dependencies.listRows || listReconciliationPayments;
  const lookupPayment = dependencies.getPaymentStatus || getPaymentStatus;
  const findBounty = dependencies.getBounty || getBounty;
  const readReceipt = dependencies.readLocalReceipt || readLocalReceipt;
  const bridgeReceipt = dependencies.bridgeZapReceipt || bridgeZapReceipt;
  const updateState = dependencies.updatePaymentState || updatePaymentState;
  const results = [];

  const resultFor = (row, values) => ({
    claimEventId: row.claim_event_id,
    bountyId: row.bounty_id,
    issuerPubkey: row.issuer_pubkey,
    amountSats: row.amount_sats,
    previousState: row.state,
    ...values,
  });
  const observe = (row, state, fields = {}) => {
    if (!dryRun) updateState(paymentReference(row), state, fields);
    return state;
  };

  for (const row of listRows(issuer, { now, graceSeconds })) {
    let currentState = row.state;
    if (row.state === 'failed') {
      const ambiguous = String(row.reason || '').startsWith('ambiguous_send:');
      if (!ambiguous || !row.bolt11) {
        results.push(resultFor(row, {
          ok: false,
          state: 'failed',
          status: ambiguous ? 'ambiguous_reconciliation' : 'reset_required',
          reason: row.reason || 'payment_failed',
        }));
        continue;
      }

      let walletStatus;
      try {
        walletStatus = await lookupPayment({ bolt11: row.bolt11 });
      } catch (error) {
        walletStatus = { inconclusive: true, reason: `status_lookup_threw: ${error.message}` };
      }
      if (walletStatus?.paid === true) {
        currentState = observe(row, 'paid', { reason: 'wallet_confirmed_paid' });
      } else if (walletStatus?.paid === false) {
        const state = observe(row, 'failed', { reason: 'wallet_confirmed_unpaid' });
        results.push(resultFor(row, {
          ok: false,
          state,
          status: 'reset_required',
          reason: 'wallet_confirmed_unpaid',
        }));
        continue;
      } else {
        results.push(resultFor(row, {
          ok: false,
          state: 'failed',
          status: 'ambiguous_reconciliation',
          reason: walletStatus?.reason || row.reason,
        }));
        continue;
      }
    }

    if (row.state === 'attempting') {
      if (!row.bolt11) {
        const state = observe(row, 'failed', { reason: 'no_invoice_attempt' });
        results.push(resultFor(row, {
          ok: false,
          state,
          status: 'reset_required',
          reason: 'no_invoice_attempt',
        }));
        continue;
      }

      let walletStatus;
      try {
        walletStatus = await lookupPayment({ bolt11: row.bolt11 });
      } catch (error) {
        walletStatus = { inconclusive: true, reason: `status_lookup_threw: ${error.message}` };
      }
      if (walletStatus?.paid !== true && walletStatus?.paid !== false) {
        results.push(resultFor(row, {
          ok: false,
          state: 'attempting',
          status: 'ambiguous_reconciliation',
          reason: walletStatus?.reason || 'wallet_status_inconclusive',
        }));
        continue;
      }
      if (walletStatus.paid === false) {
        const state = observe(row, 'failed', { reason: 'wallet_confirmed_unpaid' });
        results.push(resultFor(row, {
          ok: false,
          state,
          status: 'reset_required',
          reason: 'wallet_confirmed_unpaid',
        }));
        continue;
      }
      currentState = observe(row, 'paid', { reason: 'wallet_confirmed_paid' });
    }

    const bounty = findBounty(row.bounty_id);
    if (!bounty) {
      results.push(resultFor(row, {
        ok: false,
        state: currentState,
        status: 'reconciliation_unresolved',
        reason: 'bounty_not_found',
      }));
      continue;
    }

    let receipt;
    try {
      if (!dryRun) {
        await bridgeReceipt({
          claimId: row.claim_event_id,
          relays: localRelays(),
          timeoutMs: DEFAULT_RECEIPT_POLL_MS,
        }).catch(() => null);
      }
      receipt = await readReceipt(bounty, row.claim_event_id);
    } catch (error) {
      results.push(resultFor(row, {
        ok: false,
        state: currentState,
        status: 'reconciliation_unresolved',
        reason: `receipt_lookup_threw: ${error.message}`,
      }));
      continue;
    }
    if (receipt) {
      const state = observe(row, 'settled', { reason: 'receipt_observed' });
      results.push(resultFor(row, { ok: true, state, status: 'settled' }));
      continue;
    }

    // The sats left and no receipt came back. Another pass cannot change that,
    // so the row stops being a failure once the grace window closes. Without
    // this bound one unreceipted payment fails every later timer run.
    const state = observe(row, 'paid_unreceipted', { reason: 'receipt_not_observed' });
    if (Number(row.created_at) <= now - graceSeconds) {
      results.push(resultFor(row, {
        ok: true,
        state,
        status: 'paid_unreceipted_final',
        reason: 'receipt_grace_elapsed',
        graceSeconds,
      }));
      continue;
    }
    results.push(resultFor(row, {
      ok: false,
      state,
      status: 'reconciliation_unresolved',
      reason: 'receipt_not_observed',
    }));
  }

  return {
    ok: results.every(result => result.ok),
    dryRun: Boolean(dryRun),
    results,
  };
}

// Stale 'attempting' rows (crash/timeout mid-send) can't be assumed failed —
// the send may have gone through. For each stuck row: no bolt11 means nothing
// was ever sent (safe to fail as before); a persisted bolt11 means the wallet
// must be asked what actually happened before a final state is chosen.
async function reconcileStuckAttempts({ olderThanSeconds = 600, now = nowSeconds() } = {}) {
  const stuck = listStuckAttempting({ olderThanSeconds, now });
  for (const row of stuck) {
    const ref = paymentReference(row);
    if (!row.bolt11) {
      updatePaymentState(ref, 'failed', { reason: 'stuck_timeout', now });
      continue;
    }
    const status = await getPaymentStatus({ bolt11: row.bolt11 }).catch(err => ({
      inconclusive: true,
      reason: `status_lookup_threw: ${err.message}`,
    }));
    if (status.paid === true) {
      updatePaymentState(ref, 'paid_unreceipted', { reason: 'verified_paid_after_stuck', now });
    } else if (status.paid === false) {
      updatePaymentState(ref, 'failed', { reason: 'stuck_timeout', now });
    } else {
      updatePaymentState(ref, 'failed', { reason: 'ambiguous_send: stuck_timeout', now });
    }
  }
  return { reconciled: stuck.length };
}

async function runAutoPayTick({ limit = 100 } = {}) {
  if (!autoPayEnabled()) return { ok: true, skipped: true, reason: 'disabled' };
  await reconcileStuckAttempts();
  const bounties = listAutoPayOpenBounties({ limit });
  const results = [];
  for (const bounty of bounties) {
    const { paymentState } = await paymentStateForBounty(bounty, { trustFilter: true });
    for (const claim of paymentState.payableClaims) {
      // Fail-closed: never let a bounty issuer get auto-paid on their own
      // bounty. Must run before any rank check or payment attempt — the
      // trust-rank observer===subject shortcut would otherwise rank a
      // self-claim at 100 and let it straight through.
      if (String(claim.event.pubkey || '').toLowerCase() === String(bounty.issuer_pubkey || '').toLowerCase()) {
        console.warn('[auto-pay] skipping self-claim', { bountyId: bounty.id, claimEventId: claim.event.id });
        continue;
      }
      const claimantRank = await rank(bounty.issuer_pubkey, claim.event.pubkey);
      if (claimantRank < bounty.auto_pay_min_rank) continue;
      results.push(await processAutoPayClaim(bounty, claim));
    }
  }
  return { ok: true, results };
}

function startAutoPayWatcher({
  intervalMs = Number(process.env.AUTO_PAY_INTERVAL_MS || DEFAULT_INTERVAL_MS),
} = {}) {
  if (!autoPayEnabled()) return null;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runAutoPayTick();
      if (result.results?.length) {
        console.log('[auto-pay] tick', JSON.stringify(result.results.map(r => ({
          ok: r.ok,
          state: r.state,
          reason: r.reason || r.error,
        }))));
      }
    } catch (err) {
      console.error('[auto-pay] watcher tick failed:', err.message);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  tick();
  return timer;
}

module.exports = {
  autoPayEnabled,
  readLocalReceipt,
  maxPaymentSats,
  processAutoPayClaim,
  reconcileStuckAttempts,
  reconcileIssuerPayments,
  runAutoPayTick,
  startAutoPayWatcher,
};
