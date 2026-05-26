import { publishOrThrow } from './publishProfileTag';

/**
 * Single source of truth for the tag-pinning wire shape from ADR 0009.
 *
 * IMPORTANT: the TA pubkey is PER-DEPLOYMENT. Callers MUST pass
 * `taPubkey` to `pinTag()` — typically by reading it from
 * `useConfig().taPubkey`, which is backed by `/api/assistant/pubkey`.
 *
 * NEVER hardcode the TA pubkey here or in any consumer of this
 * module — see CLAUDE.md "Per-deployment TA pubkey" and AGENTS.md §1.
 * A literal hardcode silently breaks the pin/TL stack on every
 * non-dev deployment (the publisher signs with the real on-disk TA
 * key, but the readers look up TLs under the wrong author and find
 * nothing).
 *
 * Used by:
 *   - Tag page (Story 10) — header Pin / Unpin affordance.
 *   - Story 12 — CurationMethodDialog (custom curation values).
 *
 * The wire layout lives in one place here so future changes to the
 * pin event's tags / content body only touch this file.
 */

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
 * @param {string} args.taPubkey — the instance's TA pubkey (hex). REQUIRED.
 *   Pull from `useConfig().taPubkey` at the call site.
 * @param {object} [args.curationMethod] — optional override; defaults to
 *   `defaultCurationMethod(viewerPubkey)`.
 * @returns {Promise<object>} the signed Pin event.
 */
export async function pinTag({ tag, taPubkey, curationMethod }) {
  if (!window.nostr) {
    throw new Error('No NIP-07 extension detected. Install one to pin tags.');
  }
  if (!taPubkey || !/^[0-9a-f]{64}$/.test(taPubkey)) {
    throw new Error('pinTag: taPubkey is required (pull from useConfig().taPubkey)');
  }
  const tagPinningHandle = `39998:${taPubkey}:tag-pinning`;
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
      ['z', tagPinningHandle],
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
