import { useState, useEffect, useCallback } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import { queryRelay } from '../../api/relay';
import { publishOrThrow } from '../../utils/publishProfileTag';
import { getActiveSignerOrThrow } from '../../utils/signerGuard';
import { buildTapestryDraft } from './tapestryDraft.mjs';

/**
 * Authoring hook for "Create a Tapestry" (members-only v1). See ADR tapestries/0003.
 *
 * - Loads the concept picker from strfry concept headers (the canonical source per ADR
 *   tapestries/0002 — not Neo4j /summaries).
 * - create() builds the wire shape via the pure tapestryDraft model and publishes it either
 *   under the owner's own key (NIP-07 → signAs "client") or as the Tapestry Assistant
 *   (server-signed → signAs "assistant", owner-gated by the server).
 */

/** Parse a kind-39998 concept-header event into a picker option (or null to skip). */
function toConcept(ev) {
  const dTag = ev.tags?.find((t) => t[0] === 'd')?.[1];
  if (!dTag) return null; // an addressable event with no d-tag has no stable identity
  let word = {}, conceptHeader = {};
  try {
    const raw = ev.tags?.find((t) => t[0] === 'json')?.[1];
    if (raw) { const j = JSON.parse(raw); word = j.word || {}; conceptHeader = j.conceptHeader || {}; }
  } catch { /* malformed json → fall back to the d-tag below */ }
  return {
    handle: `39998:${ev.pubkey}:${dTag}`,        // the concept-header coordinate (d-tag = short slug)
    shortSlug: dTag,
    // oSlugs.singular is what the derived *-concept-graph is named after (diverges from the d-tag
    // for some concepts, e.g. nostr-event-tag) — used to build a resolvable import uuid.
    conceptGraphSlug: conceptHeader.oSlugs?.singular || dTag,
    descriptiveSlug: word.slug || `concept-header-for-${dTag}`, // word.slug → clean dedup at read time
    name: conceptHeader.oNames?.singular || word.name || dTag,  // friendly display name
  };
}

/** Short random hex for the parameterized-replaceable d-tag suffix. */
function randomSuffix() {
  const bytes = new Uint8Array(4);
  (window.crypto || crypto).getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function useCreateTapestry() {
  const { taPubkey } = useConfig();
  const { user } = useAuth();
  const [concepts, setConcepts] = useState([]);
  const [conceptsLoading, setConceptsLoading] = useState(true);
  const [conceptsError, setConceptsError] = useState(null);

  useEffect(() => {
    if (!taPubkey) return; // wait for the runtime-resolved TA pubkey (never hardcode)
    let cancelled = false;

    (async () => {
      try {
        setConceptsLoading(true);
        setConceptsError(null);
        const events = await queryRelay({ kinds: [39998], authors: [taPubkey] });
        if (cancelled) return;
        const list = (events || []).map(toConcept).filter(Boolean)
          .sort((a, b) => a.name.localeCompare(b.name));
        setConcepts(list);
      } catch (err) {
        if (!cancelled) setConceptsError(err.message);
      } finally {
        if (!cancelled) setConceptsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [taPubkey]);

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
