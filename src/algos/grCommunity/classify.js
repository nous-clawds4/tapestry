/*
 * Membership classification helpers.
 *
 * isMember: score >= threshold means a candidate is treated as a member.
 *           Threshold default is 0.5 per PLAN.md §4 calibration items.
 *
 * partitionMembers: split a score map into { members, nonMembers } lists,
 *           each sorted by score descending. Seeds (score 1) always sort first.
 */

const DEFAULT_THRESHOLD = 0.5

function isMember(score, threshold = DEFAULT_THRESHOLD) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return false
  return score >= threshold
}

function partitionMembers(scoresMap, threshold = DEFAULT_THRESHOLD) {
  const entries = Array.from(scoresMap.entries())
  entries.sort((a, b) => b[1] - a[1])
  const members = []
  const nonMembers = []
  for (const [pubkey, score] of entries) {
    if (isMember(score, threshold)) members.push(pubkey)
    else nonMembers.push(pubkey)
  }
  return { members, nonMembers }
}

module.exports = { isMember, partitionMembers, DEFAULT_THRESHOLD }
