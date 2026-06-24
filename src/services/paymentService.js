const { getBounty } = require('../db/bounties');
const { paymentStateForBounty } = require('../api/bounties');
const { rank } = require('../lib/trust-rank');
const { processAutoPayClaim } = require('./autoPayWatcher');
const { appendAudit, latestJudgment } = require('../lib/agentAudit');

const TRUST_FLOOR = 2;

// The single payment entry point shared by the operator loop and the CLI `pay`,
// so the rank gate, dry-run, and audit live in exactly one place. Settlement is
// still the kind-9735 — this just mints + pays; processAutoPayClaim does the
// cap/idempotency/float-preflight and writes the auto_payments row.
async function payClaim({ bountyId, claimEventId, dryRun = false } = {}) {
  if (!bountyId) throw new Error('bountyId is required');
  if (!claimEventId) throw new Error('claimEventId is required');

  const bounty = getBounty(bountyId);
  if (!bounty) return { ok: false, reason: 'bounty_not_found' };

  const { paymentState } = await paymentStateForBounty(bounty, { trustFilter: true });
  const claim = paymentState.payableClaims.find(c => c.event.id === claimEventId);
  if (!claim) return { ok: false, reason: 'claim_not_payable' };

  const minRank = bounty.auto_pay ? Math.max(TRUST_FLOOR, bounty.auto_pay_min_rank) : TRUST_FLOOR;
  const claimantRank = await rank(bounty.issuer_pubkey, claim.event.pubkey);
  if (claimantRank < minRank) return { ok: false, reason: 'rank_too_low', claimantRank, minRank };

  // Fail-closed judgment gate: when enabled, never pay a claim the operator
  // hasn't recorded an accept-judgment for (real money requires a yes on record).
  if (process.env.AGENT_REQUIRE_JUDGMENT === 'true' && !dryRun) {
    const judgment = latestJudgment(bountyId, claimEventId);
    if (!judgment?.pay) return { ok: false, reason: 'no_accept_judgment' };
  }

  const amountSats = Number(claim.paymentAmountSats ?? bounty.amount_sats);

  if (dryRun) {
    // Dry-run NEVER writes an auto_payments row (that would reserve a slot and
    // suppress the real payment) — it goes to the append-only audit channel.
    appendAudit({ kind: 'dry_run_payment', bountyId, claimEventId, claimant: claim.event.pubkey, amountSats, claimantRank, minRank });
    return { ok: true, dryRun: true, wouldPay: { bountyId, claimEventId, amountSats, claimantRank } };
  }

  const result = await processAutoPayClaim(bounty, claim);
  return { ...result, bountyId, claimEventId, amountSats };
}

module.exports = { payClaim, TRUST_FLOOR };
