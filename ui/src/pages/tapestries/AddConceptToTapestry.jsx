import { useState, useMemo } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { publishOrThrow } from '../../utils/publishProfileTag';
import { getActiveSignerOrThrow } from '../../utils/signerGuard';
import { buildAddConceptDraft } from './tapestryDraft.mjs';
import useConceptOptions from './useConceptOptions';

/**
 * Add a concept to an existing Tapestry — tapestries #5 / ADR tapestries/0005.
 *
 * Sidebar affordance on the EXISTING Exploration page (no new page, no new route, no new
 * server endpoint). The typeahead searches the shared concept options (useConceptOptions),
 * excludes concepts that are already members (judged from the authored graph block of the
 * event being edited — Decision 2-A), and PICKING a result performs the save: one concept
 * per save; repeat to add more. The replacement event comes from the pure append transform
 * buildAddConceptDraft (add-only by construction), republished through the #3 publish paths
 * decided by the event's author (Decision 3):
 *   author == TA        → POST /api/strfry/publish signAs:"assistant" (server-signed, owner-403-gated)
 *   author == own key   → getActiveSignerOrThrow → window.nostr.signEvent → publishOrThrow
 * On success the parent re-reads the same coordinate (onAdded → reload) — visibility by
 * re-read, not optimism. On failure the error shows inline and membership is unchanged.
 */
export default function AddConceptToTapestry({ event, onAdded }) {
  const { taPubkey } = useConfig();
  const { concepts, conceptsLoading, conceptsError } = useConceptOptions();

  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Current membership = node uuids in the element's OWN authored graph block (Decision 2-A:
  // never the composed graph, which fluctuates with import resolution). Exclusion here is
  // UI-level; buildAddConceptDraft independently throws on duplicates (defense in depth).
  const memberUuids = useMemo(() => {
    const set = new Set();
    try {
      const raw = event?.tags?.find((t) => t[0] === 'json')?.[1];
      const nodes = raw ? JSON.parse(raw)?.graph?.nodes : null;
      if (Array.isArray(nodes)) {
        for (const n of nodes) { if (n?.uuid) set.add(n.uuid); }
      }
    } catch { /* unpreservable json → the transform refuses the save anyway */ }
    return set;
  }, [event]);

  // Typeahead results: non-member concepts matching the searchText blob (same idiom as
  // NewTapestry). Empty when the box is empty so the panel only appears while searching.
  const results = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return [];
    return concepts.filter(
      (c) => !memberUuids.has(c.handle) && (c.searchText || '').includes(q),
    );
  }, [concepts, filter, memberUuids]);

  async function save(concept) {
    if (busy) return; // re-entry guard — defense beyond the disabled controls
    setBusy(true);
    setError(null);
    try {
      const draft = buildAddConceptDraft({ event, member: concept, taPubkey });
      const author = event.pubkey;

      if (author === taPubkey) {
        // TA-authored tapestry: the server re-signs as the assistant and publishes
        // (owner-gated → 403 otherwise) — the existing endpoint, exactly as create uses it.
        const resp = await fetch('/api/strfry/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: draft.unsignedEvent, signAs: 'assistant' }),
        });
        const data = await resp.json().catch(() => null);
        if (!resp.ok || !data?.success) {
          throw new Error(data?.error || `Publish failed: status ${resp.status}`);
        }
      } else {
        // Own-key tapestry: refuse signer/session drift, sign in the browser under the
        // tapestry's EXISTING author key, publish local + external — the #3 own-key path.
        await getActiveSignerOrThrow(author);
        const signed = await window.nostr.signEvent({ ...draft.unsignedEvent, pubkey: author });
        await publishOrThrow(signed);
      }

      setFilter(''); // clear the box; the flow repeats to add more
      if (onAdded) onAdded();
    } catch (err) {
      setError(err.message || 'Failed to add the concept.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tapestry-add-concept" style={{ padding: '0 0.5rem 0.5rem' }}>
      <input
        type="text"
        className="tapestry-concept-filter"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Add a concept…"
        aria-label="Add a concept"
        disabled={busy}
      />
      {filter.trim() && !busy && (
        <div className="tapestry-concept-picker" role="listbox" aria-label="Addable concepts">
          {conceptsLoading ? (
            <p className="placeholder" style={{ margin: '0.25rem' }}>Loading concepts…</p>
          ) : results.length === 0 ? (
            <p className="placeholder" style={{ margin: '0.25rem' }}>No addable concepts match “{filter}”.</p>
          ) : (
            results.map((c) => (
              <button
                key={c.handle}
                type="button"
                className="tapestry-concept-option"
                aria-label={`Add ${c.name}`}
                onClick={() => save(c)}
              >
                <span>{c.name}</span>
                <span className="tapestry-concept-add">+ Add</span>
              </button>
            ))
          )}
        </div>
      )}
      {busy && <p className="placeholder" style={{ margin: '0.25rem 0 0' }}>Adding…</p>}
      {conceptsError && <p className="error" style={{ margin: '0.25rem 0 0' }}>Could not load concepts: {conceptsError}</p>}
      {error && <p className="error" style={{ margin: '0.25rem 0 0' }}>{error}</p>}
    </div>
  );
}
