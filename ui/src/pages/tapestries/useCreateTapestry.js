import { useCallback } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import { publishOrThrow } from '../../utils/publishProfileTag';
import { getActiveSignerOrThrow } from '../../utils/signerGuard';
import { buildTapestryDraft } from './tapestryDraft.mjs';
import useConceptOptions from './useConceptOptions';

/**
 * Authoring hook for "Create a Tapestry" (members-only v1). See ADR tapestries/0003.
 *
 * - The concept picker comes from the shared useConceptOptions hook (extracted verbatim per
 *   ADR tapestries/0005 Decision 4 so create and add-a-concept read ONE loader, no drift).
 *   The delegated contract is unchanged from #3: a queryRelay({kinds:[39998], authors:[taPubkey]})
 *   scan of strfry concept headers — the canonical picker source (ADR tapestries/0002), not
 *   Neo4j /summaries — parsed into options carrying the searchText keyword blob (the o*
 *   naming fields oNames/oSlugs/oKeys/oTitles/oLabels, word.name/slug, the d-tag, and the
 *   free-text description) that the NewTapestry typeahead filters on.
 * - create() builds the wire shape via the pure tapestryDraft model and publishes it either
 *   under the owner's own key (NIP-07 → signAs "client") or as the Tapestry Assistant
 *   (server-signed → signAs "assistant", owner-gated by the server).
 */

/** Short random hex for the parameterized-replaceable d-tag suffix. */
function randomSuffix() {
  const bytes = new Uint8Array(4);
  (window.crypto || crypto).getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function useCreateTapestry() {
  const { taPubkey } = useConfig();
  const { user } = useAuth();
  const { concepts, conceptsLoading, conceptsError } = useConceptOptions();

  const create = useCallback(async ({ title, description, selectedHandles, signAs }) => {
    const members = (selectedHandles || [])
      .map((h) => concepts.find((c) => c.handle === h))
      .filter(Boolean);

    if (signAs === 'client') {
      // Own-key path: resolve the signer FIRST so the tapestry's coordinate (uuid) is keyed to the
      // owner's own key — the event is published under that key, so the redirect must match it.
      const authorPk = await getActiveSignerOrThrow(user?.pubkey || undefined);
      const draft = buildTapestryDraft({ title, description, members, taPubkey, authorPubkey: authorPk, dTagSuffix: randomSuffix() });
      const signed = await window.nostr.signEvent({ ...draft.unsignedEvent, pubkey: authorPk });
      await publishOrThrow(signed); // local + external
      return { uuid: draft.uuid };
    }

    // Tapestry Assistant path: the server signs as the TA (author == taPubkey) and publishes
    // (owner-gated → 403 otherwise). authorPubkey defaults to taPubkey.
    const draft = buildTapestryDraft({ title, description, members, taPubkey, dTagSuffix: randomSuffix() });
    const resp = await fetch('/api/strfry/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: draft.unsignedEvent, signAs: 'assistant' }),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.success) {
      throw new Error(data?.error || `Publish failed: status ${resp.status}`);
    }
    return { uuid: draft.uuid };
  }, [concepts, taPubkey, user?.pubkey]);

  return { concepts, conceptsLoading, conceptsError, create };
}
