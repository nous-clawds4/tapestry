import { publishEverywhere } from './nostrPublish';

/**
 * Single source of truth for the nostr-user-tag wire shape from ADR-0001.
 *
 * Used by:
 *   - useProfileTags (Story 1) — chip-popover Apply/Dispute on the profile page.
 *   - Tag page (Story 3) — per-row Apply/Dispute + page-search Apply/Dispute.
 *
 * Both surfaces call publishProfileTagAssertion to construct, sign, and publish
 * the kind-39999 assertion event with identical tag layout, so future wire
 * changes happen in one place.
 */

const TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
export const NOSTR_USER_TAG_HANDLE = `39998:${TA_PUBKEY}:nostr-user-tag`;

/**
 * Publish a signed event everywhere and throw if BOTH local and external
 * publishes failed. Partial failure — local OK with external failing — is
 * acceptable silently because the strfry router will redistribute later.
 */
export async function publishOrThrow(signed) {
  const result = await publishEverywhere(signed);
  const localOk = result?.local?.success;
  const externalOk = (result?.external?.successes?.length || 0) > 0;
  if (!localOk && !externalOk) {
    const reason = result?.local?.error || 'Publish failed on every relay.';
    throw new Error(reason);
  }
  return result;
}

/**
 * Build, sign, and publish a single (tag, target, polarity) assertion.
 *
 * @param {object} args
 * @param {{eventId: string, slug: string}} args.tag — the tag-element being applied.
 * @param {string} args.targetPubkey — the pubkey being tagged.
 * @param {1 | -1} args.polarity — +1 = apply; -1 = dispute.
 * @returns {Promise<object>} the signed event.
 */
export async function publishProfileTagAssertion({ tag, targetPubkey, polarity }) {
  if (!window.nostr) {
    throw new Error('No NIP-07 extension detected. Install one to publish tags.');
  }
  const authorPk = await window.nostr.getPublicKey();
  const dTag = `profile-tag-${tag.slug}-${targetPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`;
  const unsigned = {
    kind: 39999,
    pubkey: authorPk,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', dTag],
      ['p', targetPubkey],
      ['e', tag.eventId],
      ['z', NOSTR_USER_TAG_HANDLE],
      ['polarity', String(polarity)],
    ],
    content: JSON.stringify({
      nostrUserTag: { taggedPubkey: targetPubkey, tagEventId: tag.eventId },
    }),
  };
  const signed = await window.nostr.signEvent(unsigned);
  await publishOrThrow(signed);
  return signed;
}
