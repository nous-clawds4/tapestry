import { useState, useEffect } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { queryRelay } from '../../api/relay';

/**
 * The ONE shared concept-picker loader (ADR tapestries/0005 Decision 4) — extracted verbatim
 * from useCreateTapestry so the create form and the add-a-concept affordance read the same
 * options and the same typeahead data, with no second copy to drift.
 *
 * Loads the picker from strfry concept headers (the canonical source per ADR tapestries/0002
 * — not Neo4j /summaries).
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
  // Keyword search matches this blob (not just the display name): every naming form the
  // concept-header carries — oNames/oSlugs/oKeys/oTitles/oLabels (singular+plural), word.name/slug,
  // the d-tag — plus the free-text description. Built once here; the typeahead filters on it.
  const both = (o) => (o ? [o.singular, o.plural] : []);
  const searchText = [
    ...both(conceptHeader.oNames), ...both(conceptHeader.oSlugs), ...both(conceptHeader.oKeys),
    ...both(conceptHeader.oTitles), ...both(conceptHeader.oLabels),
    word.name, word.slug, dTag, conceptHeader.description,
  ].filter(Boolean).join(' ').toLowerCase();
  return {
    handle: `39998:${ev.pubkey}:${dTag}`,        // the concept-header coordinate (d-tag = short slug)
    shortSlug: dTag,
    // oSlugs.singular is what the derived *-concept-graph is named after (diverges from the d-tag
    // for some concepts, e.g. nostr-event-tag) — used to build a resolvable import uuid.
    conceptGraphSlug: conceptHeader.oSlugs?.singular || dTag,
    descriptiveSlug: word.slug || `concept-header-for-${dTag}`, // word.slug → clean dedup at read time
    name: conceptHeader.oNames?.singular || word.name || dTag,  // friendly display name
    searchText,
  };
}

export default function useConceptOptions() {
  const { taPubkey } = useConfig();
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

  return { concepts, conceptsLoading, conceptsError };
}
