import { publishOrThrow } from './publishProfileTag';

/**
 * Single source of truth for the tag-pinning wire shape from ADR 0009.
 *
 * Used by:
 *   - Tag page (Story 10) — header Pin / Unpin affordance.
 *   - Story 12 — CurationMethodDialog (custom curation values).
 *
 * The wire layout lives in one place here so future changes to the
 * pin event's tags / content body only touch this file.
 *
 * The z-tag is composed from LEGACY_TA_PUBKEY (a hardcoded literal),
 * not from the deployment's runtime TA pubkey — see ADR 0015. This
 * preserves visibility of historical pin events on non-dev
 * deployments. The runtime TA pubkey continues to be the right value
 * for every OTHER use (signer reads, kind-30392 author filtering on
 * the server side); only z-tag composition uses the legacy literal.
 */

/**
 * Legacy z-tag-composition pubkey — see ADR 0015.
 *
 * Used only for composing the kind-39999 `z` tag handle that
 * historical pin events reference. NOT to be confused with the
 * deployment's runtime TA pubkey (`useConfig().taPubkey`), which
 * is correct for any OTHER use of "the TA pubkey" but, by
 * deliberate design, is NOT used here.
 *
 * Mirrors the same pattern in `useProfileTags.js` and
 * `publishProfileTag.js` (sibling client publishers for the other
 * two z-tag namespaces).
 */
const LEGACY_TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const TAG_PINNING_HANDLE = `39998:${LEGACY_TA_PUBKEY}:tag-pinning`;

/**
 * Compose the kind-39999 pin event's `d`-tag identifier. This is the
 * tag the *viewer* writes onto their own pin event so that re-pinning
 * the same tag replaces the prior pin (parameterized replaceable).
 *
 * NOT the URL slug — see `computeTLDTag()` for the kind-30392 TL
 * identifier the `/pin/:dTag` route navigates to.
 */
export function computePinEventDTag({ tagSlug, tagAuthorPubkey, viewerPubkey }) {
  return `tag-pin-${tagSlug}-${tagAuthorPubkey.slice(0, 8)}-${viewerPubkey.slice(0, 8)}`;
}

/**
 * Compose the kind-30392 Trusted List event's `d`-tag identifier — the
 * one the TA writes when materializing a pin into a published TL, and
 * the one the `/pin/:dTag` route in `PinDetail.jsx` uses to address it.
 *
 * Server source of truth: `src/api/trustedList/refreshPinnedTags.js`
 * (`computeTLDTag()` at :67). This client helper mirrors that exact
 * formula. If the server formula changes, update this one in lockstep.
 *
 * `observer` is the curation-method's observer pubkey (defaults to
 * the viewer's own pubkey via `defaultCurationMethod()`).
 */
export function computeTLDTag({ observer, tagAuthorPubkey, tagSlug }) {
  return `tl-pin-${observer.slice(0, 8)}-${tagAuthorPubkey.slice(0, 8)}-${tagSlug}`;
}

/**
 * Default curation-method payload.
 *
 * Story 17 flipped cutoff 2→1 (WYSIWYG with Curated view) and
 * includeScoreInTL false→true (richer TLs by default).
 */
export function defaultCurationMethod(viewerPubkey) {
  return {
    observer: viewerPubkey,
    method: 'nip85:rank',
    cutoff: 1,
    includeScoreInTL: true,
  };
}

/**
 * Build, sign, and publish a kind-39999 tag-pinning event for one tag.
 *
 * @param {object} args
 * @param {{eventId: string, slug: string, authorPubkey: string}} args.tag —
 *   the tag being pinned. `authorPubkey` is the tag-event's publisher
 *   (used in the d-tag and a-tag).
 * @param {object} [args.curationMethod] — optional override; defaults to
 *   `defaultCurationMethod(viewerPubkey)`.
 * @returns {Promise<object>} the signed Pin event.
 */
export async function pinTag({ tag, curationMethod }) {
  if (!window.nostr) {
    throw new Error('No NIP-07 extension detected. Install one to pin tags.');
  }
  const authorPk = await window.nostr.getPublicKey();
  const curation = curationMethod || defaultCurationMethod(authorPk);
  const dTag = computePinEventDTag({
    tagSlug: tag.slug,
    tagAuthorPubkey: tag.authorPubkey,
    viewerPubkey: authorPk,
  });
  const unsigned = {
    kind: 39999,
    pubkey: authorPk,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', dTag],
      ['e', tag.eventId],
      ['a', `39999:${tag.authorPubkey}:${tag.slug}`],
      ['z', TAG_PINNING_HANDLE],
      ['curation-method', JSON.stringify(curation)],
    ],
    content: JSON.stringify({
      tagPinning: { tagEventId: tag.eventId, curationMethod: curation },
    }),
  };
  const signed = await window.nostr.signEvent(unsigned);
  await publishOrThrow(signed);
  return signed;
}

/**
 * Build, sign, and publish a NIP-09 kind-5 deletion targeting a Pin event.
 *
 * @param {object} args
 * @param {string} args.pinEventId — the id of the Pin event to retract.
 * @returns {Promise<object>} the signed deletion event.
 */
export async function unpinTag({ pinEventId }) {
  if (!window.nostr) {
    throw new Error('No NIP-07 extension detected.');
  }
  const authorPk = await window.nostr.getPublicKey();
  const unsigned = {
    kind: 5,
    pubkey: authorPk,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['e', pinEventId]],
    content: 'unpinned',
  };
  const signed = await window.nostr.signEvent(unsigned);
  await publishOrThrow(signed);
  return signed;
}
