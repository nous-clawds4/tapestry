/**
 * Tagging edges — the NostrUser→NostrUser `TAGS` relationship (epic tagging-edges).
 *
 * Story 1 ships the contract every writer uses (ADR tagging-edges/0001); story 2 adds the gap-filling
 * pass's pure planner, `sweep` (ADR tagging-edges/0002). Later stories add their pure siblings here.
 */

module.exports = { ...require('./contract'), ...require('./sweep') };
