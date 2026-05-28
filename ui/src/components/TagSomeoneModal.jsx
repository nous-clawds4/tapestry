import React, { useEffect, useRef, useState } from 'react';
import TagPageRow from './TagPageRow';
import { getWotScore } from '../utils/wotScore';

/**
 * Story 17 / ADR 0014 Decision 5.
 *
 * Clearly-separated modal that hosts the "Tag someone" search. Replaces
 * the old inline TagPageSearch on the tag-detail page so search results
 * no longer bleed into the tagged-profiles list.
 *
 * Props:
 *   open                — boolean controlling visibility
 *   onClose             — () => void; called on Escape, backdrop click, ×
 *   tag                 — the tag being authored against (passed through
 *                         to the onApply/onDispute handlers)
 *   viewerPubkey        — used for the POV-aware search call
 *   viewerAssertions    — { pubkey: 'applied'|'disputed' } map from
 *                         useTagDetail, so already-asserted profiles
 *                         render with the correct viewerState
 *   rowsByPubkey        — Map<pubkey, row> from the main list, so search
 *                         hits that already appear in the page list
 *                         render with their +N/-M data instead of a
 *                         Verification Score
 *   povSuffix           — 8-char POV suffix from useTagDetail (used by
 *                         getWotScore to resolve namespaced WoT rank)
 *   onApply, onDispute  — same publish handlers as the parent
 *
 * Escape + backdrop-click → onClose. The publisher state lives in
 * TagPageRow itself, so a successful apply/dispute updates the row's
 * label naturally on the parent's next refetch.
 */
const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;
const RESULTS_LIMIT = 10;

export default function TagSomeoneModal({
  open,
  onClose,
  tag,
  viewerPubkey,
  viewerAssertions,
  rowsByPubkey,
  povSuffix,
  onApply,
  onDispute,
}) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const debounceRef = useRef(null);
  const seqRef = useRef(0);
  const inputRef = useRef(null);

  // Escape closes; also focus the search input on open.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    // Defer focus to the next tick so the modal is mounted.
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  // Reset transient state when the modal closes so a re-open starts clean.
  useEffect(() => {
    if (!open) {
      setQ('');
      setHits([]);
      setError(null);
      setLoading(false);
    }
  }, [open]);

  // Debounced Meili search — mirrors TagPageSearch's pattern (Story 3).
  useEffect(() => {
    if (!open) return undefined;
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
      if (viewerPubkey) {
        params.set('wotPov', 'user');
        params.set('userPubkey', viewerPubkey);
      } else {
        params.set('wotPov', 'house');
      }
      fetch(`/api/search/profiles/meili?${params}`)
        .then(async (r) => {
          const data = await r.json().catch(() => null);
          if (mySeq !== seqRef.current) return;
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
  }, [open, q, viewerPubkey]);

  if (!open) return null;

  const trimmed = q.trim();
  const hasQuery = trimmed.length >= MIN_QUERY_LENGTH;

  return (
    <div
      className="tsm-backdrop"
      onMouseDown={(e) => {
        // Click outside the dialog closes the modal.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="tsm-dialog"
        role="dialog"
        aria-label="Tag someone"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="tsm-head">
          <h3 className="tsm-title">
            Tag someone{tag?.name ? ` with "${tag.name}"` : ''}
          </h3>
          <button
            type="button"
            className="tsm-close"
            onClick={onClose}
            aria-label="Close"
          >×</button>
        </div>

        <div className="tsm-body">
          <input
            ref={inputRef}
            type="text"
            className="tsm-search-input"
            placeholder="Find a profile to tag…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search profiles to tag"
          />

          {hasQuery && loading && (
            <p className="tsm-status">Searching…</p>
          )}
          {hasQuery && error && (
            <p className="tsm-status tsm-error" role="alert">⚠️ {error}</p>
          )}
          {hasQuery && !loading && !error && hits.length === 0 && (
            <p className="tsm-status">No profiles match "{trimmed}".</p>
          )}
          {hasQuery && !loading && !error && hits.length > 0 && (
            <ul className="bs-tag-row-list tsm-results">
              {hits.map((hit) => {
                const pubkey = hit.pubkey || hit.id;
                // If the hit is already in the main tagged list, surface its
                // +N/-M data; otherwise show the Verification Score.
                const existingRow = rowsByPubkey?.get?.(pubkey) || null;
                const row = existingRow || {
                  pubkey,
                  displayName: hit.display_name || hit.name || null,
                  picture: hit.picture || null,
                  applications: 0,
                  disputes: 0,
                  onlyViewerVisible: false,
                };
                const verificationScore = existingRow
                  ? null
                  : getWotScore(hit, 'rank', povSuffix);
                return (
                  <TagPageRow
                    key={pubkey}
                    row={row}
                    viewerState={viewerAssertions?.[pubkey] || null}
                    showActions={true}
                    showActionsOnHover={true}
                    scoresAlwaysVisible={true}
                    tapOpensMenu={true}
                    verificationScore={verificationScore}
                    onApply={onApply}
                    onDispute={onDispute}
                  />
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
