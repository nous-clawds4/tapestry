export function formatSats(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}

export function bountyCapSats(bounty) {
  return bounty?.bounty_cap_sats ?? bounty?.paymentState?.bountyCapSats ?? bounty?.amount_sats ?? 0;
}

export function rewardScopeLabel(bounty) {
  return bounty?.reward_per_item || bounty?.paymentState?.rewardPerItem ? 'per item' : 'per contributor';
}

export function rewardText(bounty) {
  return `${formatSats(bounty?.amount_sats)} sats ${rewardScopeLabel(bounty)}`;
}

export function capText(bounty) {
  return `${formatSats(bountyCapSats(bounty))} sats cap`;
}

export function maxRewardsText(bounty) {
  const rewardPerItem = bounty?.reward_per_item || bounty?.paymentState?.rewardPerItem;
  const maxRewards = bounty?.max_rewards_per_npub ?? bounty?.paymentState?.maxRewardsPerNpub;
  if (!rewardPerItem || !maxRewards) return null;
  return `max ${maxRewards} rewards per contributor`;
}

export function remainingRewardsText(bounty) {
  const remaining = bounty?.paymentState?.remainingRewardSlots;
  if (!Number.isInteger(remaining)) return null;
  return `${remaining} reward${remaining === 1 ? '' : 's'} remaining`;
}

export function closedReasonText(reason) {
  if (reason === 'contributor') return 'Contributor limit reached';
  if (reason === 'cap') return 'Bounty cap reached';
  return 'Not payable';
}
