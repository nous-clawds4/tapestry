export function formatSats(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : '0';
}

export function bountyCapSats(bounty) {
  return bounty?.bounty_cap_sats ?? bounty?.amount_sats ?? 0;
}

export function rewardScopeLabel(bounty) {
  return bounty?.reward_per_item ? 'per item' : 'per contributor';
}

export function rewardText(bounty) {
  return `${formatSats(bounty?.amount_sats)} sats ${rewardScopeLabel(bounty)}`;
}

export function capText(bounty) {
  return `${formatSats(bountyCapSats(bounty))} sats cap`;
}

export function maxRewardsText(bounty) {
  if (!bounty?.reward_per_item || !bounty?.max_rewards_per_npub) return null;
  return `max ${bounty.max_rewards_per_npub} rewards per contributor`;
}
