/*
 * GR-Community scoring entry point.
 *
 * Pure-function module: no I/O, deterministic, importable from CLI / tests /
 * the Communities REST handlers. See ADR-0006 + PLAN.md §4.
 */

const { computeGrCommunityScores, WEIGHTING_MODEL_ID, DEFAULTS } = require('./computeScores.js')
const { twoGateWeight } = require('./twoGate.js')
const { isMember, partitionMembers, DEFAULT_THRESHOLD } = require('./classify.js')

module.exports = {
  computeGrCommunityScores,
  twoGateWeight,
  isMember,
  partitionMembers,
  WEIGHTING_MODEL_ID,
  DEFAULT_THRESHOLD,
  DEFAULTS,
}
