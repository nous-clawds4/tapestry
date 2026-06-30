import { useCallback } from 'react';
import { useConfig } from '../context/ConfigContext';
import { publishOrThrow } from '../utils/publishProfileTag';
// Single source of truth for the event-tagging wire shape + publish sequence:
// the dependency-free CJS core, imported through the Vite alias (see
// ui/vite.config.js). The hook never re-inlines the wire shape — it only
// supplies the browser deps (signer / transport / discovery / clock).
import { applyEventTagging } from '@tapestry/event-tagging';

// Canonical concept namespace — the ADR-0015 lineage literal (as in
// publishProfileTag.js / publishTagPin.js). This is the ONE sanctioned hardcode;
// the LOCAL namespace is always the RUNTIME TA from config, never a literal.
const LEGACY_TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const HEX64 = /^[0-9a-f]{64}$/;

/**
 * Story 5 — the client publish path for event-taggings. Exposes apply/dispute;
 * the core orchestrator decides the 1/2/3-publish sequence (existing header /
 * tag-without-header / brand-new tag), signs all, and publishes in order through
 * the guarded publishOrThrow (Story-2 local-only guard inherited).
 *
 * @returns {{ applyTag: Function, disputeTag: Function }}
 *   applyTag(tagInput, target)   — tagInput is { name, description } (new) or
 *   disputeTag(tagInput, target)   { authorPubkey, slug } (existing); target is
 *                                  { id } (kind-1 note) or { address } (a-coord).
 *   Resolves to { sequence, published, failedAt? }.
 */
export function useEventTagging() {
  const { taPubkey } = useConfig();

  const run = useCallback(async (tagInput, target, polarity) => {
    if (!window.nostr) {
      throw new Error('No NIP-07 extension detected. Install one to apply tags.');
    }
    const asserterPubkey = await window.nostr.getPublicKey();

    // Dual-z: canonical + the runtime local TA. A missing/malformed local TA is
    // non-fatal — the canonical z still ships (mirrors createTag / publishProfileTag).
    const taPubkeys = [LEGACY_TA_PUBKEY, ...(HEX64.test(taPubkey || '') ? [taPubkey] : [])];

    return applyEventTagging({
      tagInput,
      target,
      polarity,
      asserterPubkey,
      taPubkeys,
      deps: {
        // Story-4 read: which per-tag tagging headers already exist for this tag.
        findHeaders: async ({ tagAuthorPubkey, slug }) => {
          const params = new URLSearchParams({ tagAuthor: tagAuthorPubkey, slug });
          const r = await fetch(`/api/event-tags/headers-for-tag?${params}`);
          const j = await r.json().catch(() => ({}));
          return Array.isArray(j.headers) ? j.headers : [];
        },
        sign: (unsigned) => window.nostr.signEvent(unsigned),
        publish: publishOrThrow,
        now: () => Math.floor(Date.now() / 1000),
      },
    });
  }, [taPubkey]);

  const applyTag = useCallback((tagInput, target) => run(tagInput, target, 1), [run]);
  const disputeTag = useCallback((tagInput, target) => run(tagInput, target, -1), [run]);

  return { applyTag, disputeTag };
}
