import { publishOrThrow } from './publishProfileTag';

/**
 * Single source of truth for the tag-pinning wire shape from ADR 0009.
 *
 * Used by:
 *   - Tag page (Story 10) — header Pin / Unpin affordance.
 *   - Future Story 11 — curation-method editor (will pass a customized
 *     curationMethod object instead of the default).
 *
 * Both surfaces call pinTag / unpinTag so the wire layout lives in one place.
 */

export const TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
export const TAG_PINNING_HANDLE = `39998:${TA_PUBKEY}:tag-pinning`;

/** Default curation-method payload (Story 10 v1). Story 11 will let the
 *  user override these fields per pin at pin time / from /pins. */
export function defaultCurationMethod(viewerPubkey) {
  return {
    observer: viewerPubkey,
    method: 'nip85:rank',
    cutoff: 2,
    includeScoreInTL: false,
  };
}

/**
 * Build, sign, and publish a kind-39999 tag-pinning event for one tag.
 *
 * @param {object} args
 * @param {{eventId: string, slug: string, authorPubkey: string}} args.tag —
 *   the tag being pinned. `authorPubkey` is the tag-event's publisher (used
 *   in the d-tag and a-tag).
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
  const dTag = `tag-pin-${tag.slug}-${tag.authorPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`;
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
