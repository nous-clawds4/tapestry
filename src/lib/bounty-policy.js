function positiveIntegerOr(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function isRewardPerItem(bounty) {
  const value = bounty?.reward_per_item ?? bounty?.rewardPerItem ?? false;
  return value === true || value === 1 || value === '1' || value === 'true';
}

function bountyPolicy(bounty = {}) {
  const amountSats = positiveIntegerOr(bounty.amount_sats ?? bounty.amountSats, 0);
  const bountyCapSats = positiveIntegerOr(
    bounty.bounty_cap_sats ?? bounty.bountyCapSats,
    amountSats
  );
  const totalRewardSlots = amountSats > 0
    ? Math.max(1, Math.floor(bountyCapSats / amountSats))
    : 0;
  const rewardPerItem = isRewardPerItem(bounty);
  const maxRewardsPerNpub = rewardPerItem
    ? positiveIntegerOr(
      bounty.max_rewards_per_npub ?? bounty.maxRewardsPerNpub,
      Infinity
    )
    : 1;

  return {
    amountSats,
    bountyCapSats,
    rewardPerItem,
    maxRewardsPerNpub,
    totalRewardSlots,
  };
}

function claimId(claim) {
  return claim?.event?.id ?? '';
}

function claimPubkey(claim) {
  return (claim?.event?.pubkey ?? '').toLowerCase();
}

function claimCreatedAt(claim) {
  return Number(claim?.event?.created_at) || 0;
}

function autoPaymentState(claim) {
  return claim?.autoPayment?.state ?? null;
}
function ambiguousPayment(claim) {
  return autoPaymentState(claim) === 'failed'
    && String(claim?.autoPayment?.reason || '').startsWith('ambiguous_send:');
}


function suppressesDuplicatePayment(claim) {
  return ['attempting', 'paid', 'settled', 'paid_unreceipted'].includes(autoPaymentState(claim))
    || ambiguousPayment(claim);
}

function compareClaims(a, b) {
  const byCreatedAt = claimCreatedAt(a) - claimCreatedAt(b);
  if (byCreatedAt !== 0) return byCreatedAt;
  return claimId(a).localeCompare(claimId(b));
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function publicPaymentState(state) {
  return {
    rewardAmountSats: state.rewardAmountSats,
    bountyCapSats: state.bountyCapSats,
    rewardPerItem: state.rewardPerItem,
    maxRewardsPerNpub: Number.isFinite(state.maxRewardsPerNpub) ? state.maxRewardsPerNpub : null,
    totalRewardSlots: state.totalRewardSlots,
    paidRewardCount: state.paidRewardCount,
    heldRewardCount: state.heldRewardCount,
    remainingRewardSlots: state.remainingRewardSlots,
    payableRewardCount: state.payableClaims.length,
    reconciliationRewardCount: state.reconciliationClaims.length,
    legacyPaymentBlock: state.legacyPaymentBlock,
    openRewardSlots: state.openRewardSlots,
    fulfilled: state.fulfilled,
  };
}

function calculateBountyPaymentState(bounty, claims = []) {
  const policy = bountyPolicy(bounty);
  const sortedClaims = [...claims].sort(compareClaims);
  const paidClaims = [];
  const heldClaims = [];
  const reconciliationClaims = [];
  const unpaidClaims = [];
  const paidByPubkey = new Map();
  const legacyPaymentBlock = sortedClaims.some(claim => claim.legacyPaymentBlock === true);


  for (const claim of sortedClaims) {
    if (claim.zapReceipt) {
      paidClaims.push(claim);
      increment(paidByPubkey, claimPubkey(claim));
    } else if (suppressesDuplicatePayment(claim)) {
      const paymentState = autoPaymentState(claim);
      heldClaims.push(claim);
      if (['attempting', 'paid', 'paid_unreceipted'].includes(paymentState) || ambiguousPayment(claim)) {
        reconciliationClaims.push(claim);
      }
      increment(paidByPubkey, claimPubkey(claim));
    } else {
      unpaidClaims.push(claim);
    }
  }

  const paidRewardCount = paidClaims.length;
  const heldRewardCount = heldClaims.length;
  const consumedRewardSlots = paidRewardCount + heldRewardCount;
  const remainingRewardSlots = Math.max(0, policy.totalRewardSlots - consumedRewardSlots);
  let openRewardSlots = remainingRewardSlots;
  const reservedByPubkey = new Map(paidByPubkey);
  const payableClaims = [];
  const closedClaims = [];

  for (const claim of unpaidClaims) {
    const pubkey = claimPubkey(claim);
    const pubkeyReserved = reservedByPubkey.get(pubkey) || 0;

    if (legacyPaymentBlock) {
      closedClaims.push({ ...claim, closedReason: 'legacy_payment_reconciliation_required' });
      continue;
    }
    if (openRewardSlots <= 0) {
      closedClaims.push({ ...claim, closedReason: 'cap' });
      continue;
    }
    if (pubkeyReserved >= policy.maxRewardsPerNpub) {
      closedClaims.push({ ...claim, closedReason: 'contributor' });
      continue;
    }

    payableClaims.push({
      ...claim,
      paymentStatus: 'payable',
      paymentAmountSats: policy.amountSats,
    });
    increment(reservedByPubkey, pubkey);
    openRewardSlots -= 1;
  }

  return {
    rewardAmountSats: policy.amountSats,
    bountyCapSats: policy.bountyCapSats,
    rewardPerItem: policy.rewardPerItem,
    maxRewardsPerNpub: policy.maxRewardsPerNpub,
    totalRewardSlots: policy.totalRewardSlots,
    paidRewardCount,
    heldRewardCount,
    legacyPaymentBlock,
    remainingRewardSlots,
    openRewardSlots,
    fulfilled: policy.totalRewardSlots > 0 && paidRewardCount >= policy.totalRewardSlots,
    paidClaims,
    heldClaims,
    reconciliationClaims,
    payableClaims,
    closedClaims,
    paidByPubkey,
    reservedByPubkey,
  };
}

function annotateClaimsWithPaymentState(claims = [], state) {
  const payableById = new Map(state.payableClaims.map(claim => [claimId(claim), claim]));
  const closedById = new Map(state.closedClaims.map(claim => [claimId(claim), claim]));

  return claims.map(claim => {
    const id = claimId(claim);
    if (claim.zapReceipt) {
      return { ...claim, paymentStatus: 'paid', paymentAmountSats: state.rewardAmountSats };
    }
    if (suppressesDuplicatePayment(claim)) {
      const autoState = autoPaymentState(claim);
      return {
        ...claim,
        paymentStatus: autoState,
        paymentAmountSats: state.rewardAmountSats,
        duplicatePaymentSuppressed: true,
        reconciliationRequired: ['attempting', 'paid', 'paid_unreceipted'].includes(autoState) || ambiguousPayment(claim),
      };
    }
    const payable = payableById.get(id);
    if (payable) return payable;
    const closed = closedById.get(id);
    return {
      ...claim,
      paymentStatus: 'closed',
      paymentAmountSats: state.rewardAmountSats,
      closedReason: closed?.closedReason ?? 'cap',
    };
  });
}

function canAcceptNewClaimFrom(state, pubkey) {
  if (!state || state.fulfilled || state.openRewardSlots <= 0) return false;
  const key = (pubkey ?? '').toLowerCase();
  return (state.reservedByPubkey.get(key) || 0) < state.maxRewardsPerNpub;
}

module.exports = {
  ambiguousPayment,
  annotateClaimsWithPaymentState,
  autoPaymentState,
  bountyPolicy,
  calculateBountyPaymentState,
  canAcceptNewClaimFrom,
  publicPaymentState,
  suppressesDuplicatePayment,
};
