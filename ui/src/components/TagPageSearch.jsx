import React, { useState, useEffect, useRef } from 'react';
import SearchInput from './SearchInput';
import TagPageRow from './TagPageRow';

/**
 * Page-search section on the tag-detail page: type → debounced Meili search
 * → result rows with Apply / Dispute buttons. After a successful publish on
 * a search row, the parent's refetchRows() pulls the main list (which now
 * includes the newly tagged profile via the viewer-union).
 *
 * Reuses <SearchInput variant="results"> (ADR-0003) and <TagPageRow>. No
 * autocomplete dropdown — this surface is "find + tag", not "find + navigate".
 *
 * Story 3 / ADR-0004.
 */
const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const RESULTS_LIMIT = 10;

export default function TagPageSearch({
  user,
  viewerAssertions,
  onApply,
  onDispute,
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const debounceRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const trimmed = q.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setHits([]);
      setLoading(false);
      setError(null);
      return undefined;
    }
    const mySeq = ++seqRef.current;
    setLoading(true);
    setError(null);

    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams({
        q: trimmed,
        limit: String(RESULTS_LIMIT),
        offset: '0',
      });
      if (user?.pubkey) {
        params.set('wotPov', 'user');
        params.set('userPubkey', user.pubkey);
      } else {
        params.set('wotPov', 'house');
      }
      fetch(`/api/search/profiles/meili?${params}`)
        .then(async (r) => {
          const data = await r.json().catch(() => null);
          if (mySeq !== seqRef.current) return; // stale
          if (r.ok && data?.hits) {
            setHits(data.hits);
          } else {
            setError(data?.error || `status ${r.status}`);
          }
        })
        .catch((err) => {
          if (mySeq !== seqRef.current) return;
          setError(err.message);
        })
        .finally(() => {
          if (mySeq !== seqRef.current) return;
          setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q, user?.pubkey]);

  const trimmed = q.trim();
  const hasQuery = trimmed.length >= MIN_QUERY_LENGTH;

  return (
    <div className="bs-tag-search">
      <SearchInput
        variant="results"
        value={q}
        onChange={setQ}
        placeholder="Find a profile to tag…"
      >
        {q && (
          <button
            type="button"
            className="bs-tag-search-clear"
            aria-label="Clear profile search"
            title="Clear search"
            onClick={() => setQ('')}
          >
            ×
          </button>
        )}
      </SearchInput>
      {hasQuery && loading && (
        <p className="bs-tag-loading">Searching…</p>
      )}
      {hasQuery && error && (
        <p className="bs-tag-error">⚠️ {error}</p>
      )}
      {hasQuery && !loading && !error && hits.length > 0 && (
        <ul className="bs-tag-row-list bs-tag-search-results">
          {hits.map((hit) => {
            const pubkey = hit.pubkey || hit.id;
            const row = {
              pubkey,
              displayName: hit.display_name || hit.name || null,
              picture: hit.picture || null,
              applications: 0,
              disputes: 0,
              onlyViewerVisible: false,
            };
            return (
              <TagPageRow
                key={pubkey}
                row={row}
                viewerState={viewerAssertions[pubkey] || null}
                showActions={true}
                onApply={onApply}
                onDispute={onDispute}
              />
            );
          })}
        </ul>
      )}
      {hasQuery && !loading && !error && hits.length === 0 && (
        <p className="bs-tag-empty">No profiles match "{trimmed}".</p>
      )}
    </div>
  );
}
