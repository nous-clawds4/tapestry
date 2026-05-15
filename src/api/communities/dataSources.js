/*
 * Communities data-source abstraction.
 *
 * All functions return the empty equivalent (null / [] / {}) on any error,
 * so the REST handlers can always succeed on fresh deploys where no
 * community-record events exist yet. The strfry + Neo4j query wiring is
 * isolated here; the rest of the API surface and the scoring algorithm
 * never call session.run() or fetch() directly.
 *
 * For Slice 2 these implementations are stubs that resolve to empty
 * collections. Live wiring (strfry kind-39999 filter + Neo4j GR-score
 * read) gets filled in when the communities droplet is provisioned and
 * real community records start flowing. Staging smoke verifies the
 * live-data path; the unit tests here verify the empty-data contract.
 */

/* eslint-disable no-unused-vars */

/**
 * Load one community record for a given slug, from the perspective of
 * `viewerPubkey`. Returns a normalized object or null if not found.
 *
 * Expected normalized shape (matches PLAN.md §3 community-record fields):
 *   {
 *     slug, name, description, image, topics, language, founder,
 *     accent, relays, seedMembers, weightingModel, endorsementThreshold,
 *     aTag,         // "39999:<curator>:<slug>" — used as the community a-tag
 *     nip72Wrapping // optional; "34550:<creator>:<d-tag>" if wrapping a NIP-72 community
 *   }
 */
async function loadCommunityRecord(slug, viewerPubkey) {
  try {
    // TODO live wiring: query Neo4j for a kind-39999 ListItem with d-tag=slug
    // reachable through viewerPubkey's trust network. For Slice 2 this stub
    // returns null so empty-deploy GETs answer 404 cleanly.
    return null
  } catch (err) {
    console.warn('[communities/dataSources] loadCommunityRecord failed:', err.message)
    return null
  }
}

/**
 * Load all communities reachable through `viewerPubkey`'s trust network.
 * Returns an array of normalized records (same shape as loadCommunityRecord)
 * or an empty array on error / empty data.
 */
async function loadCommunitiesForViewer(viewerPubkey) {
  try {
    // TODO live wiring: query Neo4j for the union of all kind-39999 ListItems
    // (children of any brainstorm-communities DList) reachable from
    // viewerPubkey. Slice 2 returns []; staging smoke verifies live behavior.
    return []
  } catch (err) {
    console.warn('[communities/dataSources] loadCommunitiesForViewer failed:', err.message)
    return []
  }
}

/**
 * Load endorsement and veto signals for a community.
 *
 * @param {string} communityATag  community a-tag, e.g. "39999:<curator>:<slug>".
 * @returns {Promise<Array<{rater: string, target: string, type: 'endorse'|'veto'}>>}
 *
 * Returns [] when no signals are present, when the query fails, or when the
 * tag is malformed.
 */
async function loadEndorsementSignals(communityATag) {
  try {
    // TODO live wiring: strfry filter { kinds: [39999], '#a': [communityATag] }.
    // Each event yields { rater: event.pubkey, target: <event p-tag>,
    // type: <event type-tag, default 'endorse'> }.
    return []
  } catch (err) {
    console.warn('[communities/dataSources] loadEndorsementSignals failed:', err.message)
    return []
  }
}

/**
 * Load baseline GrapeRank scores for a set of pubkeys.
 *
 * @param {string[]} pubkeys
 * @returns {Promise<Record<string, number>>}  map from pubkey to baseline GR in [0, 1].
 *
 * Returns {} when no scores are available. Pubkeys absent from the result
 * are treated as having baseline 0 by the scoring algorithm.
 */
async function loadBaselineGrScores(pubkeys) {
  try {
    // TODO live wiring: Neo4j MATCH (u:NostrUserWotMetricsCard {observer: <TA>})
    // WHERE u.pubkey IN $pubkeys RETURN u.pubkey, u.influence — matches the
    // existing global GR's score-storage pattern.
    return {}
  } catch (err) {
    console.warn('[communities/dataSources] loadBaselineGrScores failed:', err.message)
    return {}
  }
}

module.exports = {
  loadCommunityRecord,
  loadCommunitiesForViewer,
  loadEndorsementSignals,
  loadBaselineGrScores,
}
