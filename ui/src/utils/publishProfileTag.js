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
 * @param {{eventId: string, slug: string, authorPubkey: string}} args.tag —
 *   the tag-element being applied. `authorPubkey` is the tag-element author's
 *   pubkey (the `.pubkey` of its kind-39999 event), needed for the `a` coord.
 * @param {string} args.targetPubkey — the pubkey being tagged.
 * @param {1 | -1} args.polarity — +1 = apply; -1 = dispute.
 * @returns {Promise<object>} the signed event.
 */
export async function publishProfileTagAssertion({ tag, targetPubkey, polarity }) {
  if (!window.nostr) {
    throw new Error('No NIP-07 extension detected. Install one to publish tags.');
  }
  // ADR tag-stack-merge-hardening/0002 (Option A): refuse to publish when the
  // tag-element author pubkey is missing/malformed. Every apply surface
  // supplies it (handleAvailableTags / handleTagById / createTag), so this is
  // a guard against a future caller — never a silent e-only fallback, which
  // would re-grow the legacy set ADR-0022 exists to stop.
  if (!tag || !/^[0-9a-f]{64}$/.test(tag.authorPubkey || '')) {
    throw new Error('Cannot publish tag assertion: tag.authorPubkey (the tag-element author) is missing or malformed.');
  }
  const authorPk = await window.nostr.getPublicKey();
  const dTag = `profile-tag-${tag.slug}-${targetPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`;
  // Hybrid e+a parent reference (ADR-0022): `a` = stable tag identity
  // (consume by #a), `e` = applied-version provenance (retained).
  const tagAddress = `39999:${tag.authorPubkey}:${tag.slug}`;
  const unsigned = {
    kind: 39999,
    pubkey: authorPk,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', dTag],
      ['p', targetPubkey],
      ['a', tagAddress],
      ['e', tag.eventId],
      ['z', NOSTR_USER_TAG_HANDLE],
      ['polarity', String(polarity)],
    ],
    content: JSON.stringify({
      nostrUserTag: { taggedPubkey: targetPubkey, tagEventId: tag.eventId, tagAddress },
    }),
  };
  const signed = await window.nostr.signEvent(unsigned);
  await publishOrThrow(signed);
  return signed;
}
