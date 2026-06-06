/*
 * Pure-function event builders.
 *
 * Each function returns an unsigned nostr event ({ kind, tags, content,
 * created_at, pubkey }) that the publish wrapper will hand to the NIP-07
 * signer via auth/viewer.js for signing.
 *
 * Schemas come from:
 *   - PLAN.md §3 — community-record tag set
 *   - COMMUNITY_ENDORSEMENTS_DLIST.md — endorsement signal shape
 *   - firmware v1.1.0 brainstorm-community + brainstorm-community-signal
 *     JSON schemas — concept-layer JSON for the word-wrapper format
 *
 * `content` is empty on every event per PLAN.md §3 (reserved for future
 * encrypted-data use).
 */

const COMMUNITIES_DLIST_DTAG = 'brainstorm-communities'
const ENDORSEMENTS_DLIST_DTAG = 'brainstorm-community-endorsements'
const DEFAULT_WEIGHTING_MODEL = 'gr-community-default-v1'
const DEFAULT_ENDORSEMENT_THRESHOLD = 0.5

function nowSec() {
  return Math.floor(Date.now() / 1000)
}

function communitiesHeaderATag(viewerPubkey) {
  return `39998:${viewerPubkey}:${COMMUNITIES_DLIST_DTAG}`
}

function endorsementsHeaderATag(headerCuratorPubkey) {
  // The endorsements DList is a single global list per PLAN.md §3 / COMMUNITY_
  // ENDORSEMENTS_DLIST.md. Its canonical pubkey is whoever publishes the
  // header. v1 uses the viewer's own pubkey as the parent pointer — the
  // network-effect is the same regardless of which header an author cites,
  // since the list is identified by tag-shape, not pubkey ownership.
  return `39998:${headerCuratorPubkey}:${ENDORSEMENTS_DLIST_DTAG}`
}

/**
 * Build the user's brainstorm-communities DList header (kind 39998).
 * Published once per viewer; idempotent (replaceable d-tag).
 *
 * Per PLAN.md §3, the header carries schema declarations that future
 * DList-aware clients use to validate items.
 */
export function buildCommunitiesDListHeader({ viewerPubkey }) {
  const tags = [
    ['d', COMMUNITIES_DLIST_DTAG],
    ['names', 'brainstorm community', 'brainstorm communities'],
    ['titles', 'Brainstorm Community', 'Brainstorm Communities'],
    ['description', 'Communities I curate'],
    ['required', 't'],
    ['required', 'name'],
    ['required', 'description'],
    ['required', 'relay'],
    ['required', 'seed'],
    ['required', 'weighting_model'],
    ['required', 'endorsement_threshold'],
    ['allowed', 'image'],
    ['allowed', 'topic'],
    ['allowed', 'language'],
    ['allowed', 'founder'],
    ['allowed', 'a'],
  ]
  return {
    kind: 39998,
    tags,
    content: '',
    created_at: nowSec(),
    pubkey: viewerPubkey,
  }
}

/**
 * Build a kind-39999 community-record ListItem on the viewer's
 * brainstorm-communities DList.
 *
 * `community` is the API/mock-projection shape: { slug, name, description,
 * image, tags (topics), language, founder, accent, relays, seedMembers,
 * weightingModel, endorsementThreshold, nip72Wrapping? }.
 */
export function buildCommunityRecord({ viewerPubkey, community }) {
  if (!community || !community.slug) {
    throw new Error('buildCommunityRecord: community.slug is required')
  }

  const tags = [
    ['d', community.slug],
    ['z', communitiesHeaderATag(viewerPubkey)],
    ['t', community.slug],
    ['name', community.name || ''],
    ['description', community.description || ''],
  ]

  // Optional metadata: skip when source field is absent.
  if (community.image) tags.push(['image', community.image])
  if (Array.isArray(community.tags || community.topics)) {
    const topics = community.tags || community.topics
    for (const topic of topics) {
      if (topic) tags.push(['topic', topic])
    }
  }
  if (community.language) tags.push(['language', community.language])
  if (community.founder) tags.push(['founder', community.founder])
  if (community.nip72Wrapping) tags.push(['a', community.nip72Wrapping])

  // Required infrastructure: relays + seed members + scoring params.
  const relays = Array.isArray(community.relays) && community.relays.length > 0
    ? community.relays
    : ['wss://communities.brainstorm.world']
  for (const url of relays) {
    if (url) tags.push(['relay', url])
  }

  const seeds = Array.isArray(community.seedMembers) && community.seedMembers.length > 0
    ? community.seedMembers
    : (Array.isArray(community.members) ? community.members.slice(0, 5) : [viewerPubkey])
  for (const pubkey of seeds) {
    if (pubkey) tags.push(['seed', pubkey])
  }

  tags.push(['weighting_model', community.weightingModel || DEFAULT_WEIGHTING_MODEL])
  const threshold = typeof community.endorsementThreshold === 'number'
    ? community.endorsementThreshold
    : DEFAULT_ENDORSEMENT_THRESHOLD
  tags.push(['endorsement_threshold', String(threshold)])

  return {
    kind: 39999,
    tags,
    content: '',
    created_at: nowSec(),
    pubkey: viewerPubkey,
  }
}

/**
 * Build a kind-39999 endorsement / veto signal on the global
 * Endorsements DList.
 *
 * Per COMMUNITY_ENDORSEMENTS_DLIST.md, the `d` tag is deterministic over
 * (role, target, community a-tag) so the same author's most recent stance
 * for the same (person, role) replaces earlier signals — "latest stance
 * wins" semantics.
 */
export function buildEndorsementSignal({
  viewerPubkey,
  targetPubkey,
  communityATag,
  type = 'endorse',
  role = 'member',
  comments = null,
}) {
  if (!targetPubkey) throw new Error('buildEndorsementSignal: targetPubkey is required')
  if (!communityATag) throw new Error('buildEndorsementSignal: communityATag is required')

  // Deterministic d-tag — pipe separator avoids collision with the colons
  // inside the community a-tag (which is "39999:<curator>:<slug>" or the
  // NIP-72 equivalent).
  const dTag = `${role}|${targetPubkey}|${communityATag}`

  const tags = [
    ['d', dTag],
    ['z', endorsementsHeaderATag(viewerPubkey)],
    ['p', targetPubkey],
    ['a', communityATag],
    ['type', type],
    ['role', role],
  ]
  if (comments && typeof comments === 'string' && comments.trim().length > 0) {
    tags.push(['comments', comments.trim()])
  }

  return {
    kind: 39999,
    tags,
    content: '',
    created_at: nowSec(),
    pubkey: viewerPubkey,
  }
}

/**
 * Build a NIP-22 kind-1111 comment scoped to a community.
 *
 * Migrated from kind-1 to fix the timeline-leakage issue: kind-1
 * posts surface in any generic feed reader (Damus, Primal, Amethyst)
 * as plain notes from the author's account. Kind-1111 is the modern
 * NIP-22 "Comment" event — ignored by microblog clients, picked up
 * by the comment-thread tooling other community-style apps already
 * use (Amethyst, zap.stream chat, white-noise, …).
 *
 * Tag shape per NIP-22:
 *   Uppercase A/K/P  → root reference (the community itself)
 *   Lowercase a/k/p  → immediate parent (= root for top-level posts)
 *
 * The a-tag format is "39999:<curator>:<slug>"; we split it to pull
 * out the curator pubkey for the P/p tags. Replies (future) point
 * lowercase a/k/p at the parent comment's e-tag instead.
 *
 * Readers query `{ kinds: [1111], '#A': [communityATag] }` — the
 * uppercase tag-name capture ensures replies show up alongside
 * top-level posts in the same conversation.
 */
export function buildCommunityPost({ viewerPubkey, communityATag, content, parent = null }) {
  if (!viewerPubkey) throw new Error('buildCommunityPost: viewerPubkey is required')
  if (!communityATag) throw new Error('buildCommunityPost: communityATag is required')
  if (!content || !content.trim()) throw new Error('buildCommunityPost: content is required')
  // A reply (ADR-0033) parents the post it answers; require its id + author.
  if (parent && (!parent.id || !parent.author)) {
    throw new Error('buildCommunityPost: parent requires id and author')
  }

  // a-tag format: "<kind>:<curator-pubkey>:<slug>" — split to derive
  // the root-kind and root-author tags NIP-22 requires.
  const [rootKind, rootAuthor] = communityATag.split(':')

  // Uppercase A/K/P always reference the community root — this keeps replies in
  // the same `#A` conversation and scoped to the circle (no timeline leakage).
  const tags = [
    ['A', communityATag],
    ['K', rootKind || '39999'],
  ]
  if (rootAuthor) tags.push(['P', rootAuthor])

  // Lowercase parent: the community itself for a top-level post, or the parent
  // comment for a reply (lowercase e + k=1111 + p=parent author). One-level
  // threading is enforced upstream by re-parenting replies to the top-level post.
  if (parent) {
    tags.push(['e', parent.id, '', parent.author], ['k', '1111'], ['p', parent.author])
  } else {
    tags.push(['a', communityATag], ['k', rootKind || '39999'])
    if (rootAuthor) tags.push(['p', rootAuthor])
  }

  return {
    kind: 1111,
    tags,
    content: content.trim(),
    created_at: nowSec(),
    pubkey: viewerPubkey,
  }
}

export const CONSTANTS = {
  COMMUNITIES_DLIST_DTAG,
  ENDORSEMENTS_DLIST_DTAG,
  DEFAULT_WEIGHTING_MODEL,
  DEFAULT_ENDORSEMENT_THRESHOLD,
}
