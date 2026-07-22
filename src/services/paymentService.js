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

  // Fail-closed: a bounty issuer can never be paid on their own bounty. This
  // must come before the rank gate — trust-rank's observer===subject
  // shortcut would otherwise hand a self-claim a rank of 100 and sail
  // straight through it.
  if (String(claim.event.pubkey || '').toLowerCase() === String(bounty.issuer_pubkey || '').toLowerCase()) {
    return { ok: false, reason: 'self_claim' };
  }

  const minRank = bounty.auto_pay ? Math.max(TRUST_FLOOR, bounty.auto_pay_min_rank) : TRUST_FLOOR;
  const claimantRank = await rank(bounty.issuer_pubkey, claim.event.pubkey);
  if (claimantRank < minRank) return { ok: false, reason: 'rank_too_low', claimantRank, minRank };

  // Fail-closed judgment gate: ON by default for every live (non-dry-run)
  // payment — never pay a claim the operator hasn't recorded an accept-judgment
  // for (real money requires a yes on record). Only an explicit
  // AGENT_REQUIRE_JUDGMENT=false opts out; unset or misspelled leaves the gate
  // enforced, unlike the old fail-open default.
  if (!dryRun && process.env.AGENT_REQUIRE_JUDGMENT !== 'false') {
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
