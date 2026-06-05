/*
 * Pure-function builder for a Community Declaration (kind 39998).
 *
 * Per ADR 0029, a community in the "right way" model IS a kind-39998
 * concept in its own right (not a kind-39999 ListItem like the frozen
 * bespoke `buildCommunityRecord`). A Declaration is forkable via the
 * `b` inherit-from tag (BIBLE §25) and resolved via §26 — so this
 * shape is forward-compatible with the fork story (Block 2).
 *
 * Strangler boundary: this lives beside the frozen `build.js`, which is
 * left untouched. New founding writes a Declaration; existing bespoke
 * circles keep working.
 *
 * The `t = brainstorm-community` tag marks this 39998 as a community
 * Declaration so reads can tell it apart from the bespoke
 * `brainstorm-communities` DList header and other concept headers.
 */

export const COMMUNITY_TYPE_MARKER = 'brainstorm-community'

function nowSec() {
  return Math.floor(Date.now() / 1000)
}

/**
 * Build a Community Declaration event.
 *
 * @param {object} args
 * @param {string} args.viewerPubkey            the founder (a peer, not an owner)
 * @param {object} args.circle                  { slug, name, purpose, belongingBar, topics? }
 * @param {string|null} [args.parentATag]       parent Declaration a-tag → a `b` tag (fork; Block 2). Unused by founding.
 * @returns {object} unsigned kind-39998 event
 */
export function buildCommunityDeclaration({ viewerPubkey, circle, parentATag = null }) {
  if (!viewerPubkey) throw new Error('buildCommunityDeclaration: viewerPubkey is required')
  if (!circle || !circle.slug) throw new Error('buildCommunityDeclaration: circle.slug is required')

  const tags = [
    ['d', circle.slug],
    // Type marker (kept in sync with COMMUNITY_TYPE_MARKER above); inlined as a
    // literal so the pure-function builder stays self-contained.
    ['t', 'brainstorm-community'],
    ['name', circle.name || ''],
    ['description', circle.purpose || ''],
    ['belonging', circle.belongingBar || ''],
    ['founder', viewerPubkey],
  ]

  const topics = Array.isArray(circle.topics) ? circle.topics : []
  for (const t of topics) {
    if (t) tags.push(['topic', t])
  }

  // Forward-compatible with forking (Block 2 / §25). Founding never sets it.
  if (parentATag) tags.push(['b', parentATag, 'inherit'])

  return {
    kind: 39998,
    tags,
    content: '',
    created_at: nowSec(),
    pubkey: viewerPubkey,
  }
}
