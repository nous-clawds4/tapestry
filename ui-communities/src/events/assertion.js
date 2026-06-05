/*
 * Pure-function builders for nostr-user-tag events (Story 43 — the membership
 * writer). The carve (`chore/carve-nostr-user-tag-core`) is read-only, so the
 * app publishes assertions itself; these return unsigned kind-39999 events that
 * `events/publish.js#publishEvent` signs (NIP-07) and sends. No hand-rolled
 * crypto here — signing lives behind the single NIP-07 chokepoint.
 *
 * Two events, both kind 39999, distinguished by their `z` type-header (a fixed
 * legacy pubkey per ADR-0015, NOT the deployment TA):
 *
 *   tag-ELEMENT   z = 39998:<LEG>:tag             d = <slug>  (bare slug)
 *                 the label itself; addressable coord 39999:<author>:<slug>
 *   ASSERTION     z = 39998:<LEG>:nostr-user-tag  d = profile-tag-<slug>-<target8>-<asserter8>
 *                 "asserter attaches <target> to <tag-element>, polarity ±1"
 *
 * The tag is GENERAL and community-agnostic (David's invariant): an assertion
 * carries no community pointer. A community CLAIMS a tag-element's coord on the
 * read side (ADR 0030); membership is derived per viewer from these assertions.
 *
 * Permissionless by design: the asserter is just the signer; web-of-trust
 * gating happens at READ time (the server's PoV WoT filter), never at write.
 *
 * Both builders emit the `a` coordinate from day one so our assertions are born
 * hybrid (e + a) — Communities needs zero backfill when the server's `#a` read
 * generalization lands. See docs/COMMUNITIES_TAG_CORE_INTEGRATION_HANDOFF.md.
 */

// Fixed z-tag pubkey (ADR-0015) — deployment-independent, and exactly what the
// read endpoints filter on (TAG_Z_TAG / NOSTR_USER_TAG_Z_TAG on the core).
export const LEGACY_Z_TAG_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833'
export const TAG_Z_TAG = `39998:${LEGACY_Z_TAG_PUBKEY}:tag`
export const NOSTR_USER_TAG_Z_TAG = `39998:${LEGACY_Z_TAG_PUBKEY}:nostr-user-tag`

function nowSec() {
  return Math.floor(Date.now() / 1000)
}

/** The addressable coordinate of a tag-element authored by `author` with `slug`. */
export function tagElementCoord(author, slug) {
  return `39999:${author}:${slug}`
}

/**
 * Build a tag-ELEMENT (the label a community can claim). Published once when a
 * circle needs its own tag-element (the founding default claim `39999:<founder>:<slug>`).
 *
 * @param {object} args
 * @param {string} args.viewerPubkey   the author (a peer; the circle's founder for the default claim)
 * @param {string} args.slug           the tag slug — the element's bare `d` tag
 * @param {string} [args.name]
 * @param {string} [args.description]
 * @returns {object} unsigned kind-39999 event
 */
export function buildTagElement({ viewerPubkey, slug, name, description = '' }) {
  if (!viewerPubkey) throw new Error('buildTagElement: viewerPubkey is required')
  if (!slug) throw new Error('buildTagElement: slug is required')

  return {
    kind: 39999,
    tags: [
      ['d', slug], // bare slug — elements use ['d', slug], NOT a tag- prefix
      ['z', `39998:${LEGACY_Z_TAG_PUBKEY}:tag`],
    ],
    content: JSON.stringify({ tag: { slug, name: name || slug, description } }),
    created_at: nowSec(),
    pubkey: viewerPubkey,
  }
}

/**
 * Build a membership ASSERTION: the signer attaches `target` to a tag-element,
 * with polarity (+1 apply / vouch, −1 dispute). A self-tag (target === signer,
 * +1) is the applicant signal; a +1 on someone else is a vouch.
 *
 * @param {object} args
 * @param {string} args.viewerPubkey         the asserter (signer)
 * @param {string} args.target               the pubkey being tagged
 * @param {object} args.tagElement           { eventId, aCoord, slug } of the claimed tag-element
 * @param {number} [args.polarity=1]         ≥0 → apply (+1); <0 → dispute (−1)
 * @returns {object} unsigned kind-39999 event
 */
export function buildMembershipAssertion({ viewerPubkey, target, tagElement, polarity = 1 }) {
  if (!viewerPubkey) throw new Error('buildMembershipAssertion: viewerPubkey is required')
  if (!target) throw new Error('buildMembershipAssertion: target is required')
  if (!tagElement || !tagElement.eventId || !tagElement.aCoord || !tagElement.slug) {
    throw new Error('buildMembershipAssertion: tagElement { eventId, aCoord, slug } is required')
  }

  // Only an explicit negative is a dispute; everything else (incl. absent) is an
  // apply — mirrors the reader (see deriveRoster), so the two never disagree.
  const pol = polarity < 0 ? '-1' : '1'
  const { eventId, aCoord, slug } = tagElement
  // d-tag's 4th segment is the SIGNER's first-8 (not a literal x). Opaque to
  // reads (dedupe is by author+d-tag), but keep the data uniform.
  const dTag = `profile-tag-${slug}-${target.slice(0, 8)}-${viewerPubkey.slice(0, 8)}`

  return {
    kind: 39999,
    tags: [
      ['d', dTag],
      ['p', target],
      ['e', eventId],                                    // version-at-apply-time (provenance)
      ['a', aCoord],                                      // stable identity — born hybrid, no backfill
      ['z', `39998:${LEGACY_Z_TAG_PUBKEY}:nostr-user-tag`],
      ['polarity', pol],
    ],
    content: JSON.stringify({ nostrUserTag: { taggedPubkey: target, tagEventId: eventId } }),
    created_at: nowSec(),
    pubkey: viewerPubkey,
  }
}
