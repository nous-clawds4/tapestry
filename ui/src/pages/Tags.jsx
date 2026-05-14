import React from 'react';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import TopBar from '../components/TopBar';
import SearchInput from '../components/SearchInput';
import SortToggle from '../components/SortToggle';
import useTagIndex from '../hooks/useTagIndex';

function shortNpub(pk) {
  if (!pk) return '—';
  try {
    const npub = nip19.npubEncode(pk);
    return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
  } catch {
    return `${pk.slice(0, 12)}…${pk.slice(-8)}`;
  }
}

function truncate(str, n) {
  if (!str) return '';
  return str.length <= n ? str : `${str.slice(0, n - 1)}…`;
}

const SORT_LABELS = [
  { key: 'used',     label: 'Most used' },
  { key: 'endorsed', label: 'Most endorsed' },
  { key: 'divisive', label: 'Most divisive' },
];

export default function Tags() {
  const {
    rows, total, povSuffix,
    sort, setSort,
    q, setQ,
    mineOnly, setMineOnly,
    loading, error,
    loadMore,
    user,
  } = useTagIndex();

  const hasMore = rows.length < total;
  const isInitialLoading = loading && rows.length === 0;
  const showEmptyNoData = !loading && total === 0 && q === '';
  const showEmptyNoMatch = !loading && total === 0 && q !== '';

  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-tagindex-main">
        <header className="bs-tagindex-header">
          <h1 className="bs-tagindex-title">Tags</h1>
          <p className="bs-tagindex-sub">
            Tags your active POV's Web of Trust is using.
            {povSuffix && <span className="bs-tagindex-pov"> POV: <code>{povSuffix}</code></span>}
          </p>
        </header>

        <div className="bs-tagindex-controls">
          <SearchInput
            variant="results"
            value={q}
            onChange={setQ}
            placeholder="Filter tags…"
          />
          <SortToggle
            options={SORT_LABELS}
            value={sort}
            onChange={setSort}
            ariaLabel="Sort tags"
            className="bs-tagindex-sort"
          />
        </div>
        {user && (
          <label className="bs-tagindex-mineonly">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => setMineOnly(e.target.checked)}
            />
            <span>Only show tags I authored</span>
          </label>
        )}

        {error && <p className="bs-tagindex-error">⚠️ {error}</p>}
        {isInitialLoading && <p className="bs-tagindex-loading">Loading tags…</p>}

        {showEmptyNoData && (
          <div className="bs-tagindex-empty">
            <p>
              No tags in your active POV's WoT yet
              {povSuffix && <> (POV: <code>{povSuffix}</code>)</>}.
            </p>
            <p className="bs-tagindex-empty-cta">
              <Link to="/personalization" className="bs-tagindex-link">Switch POV</Link>
              {' · '}
              <Link to="/" className="bs-tagindex-link">Start tagging</Link>
            </p>
          </div>
        )}

        {showEmptyNoMatch && (
          <div className="bs-tagindex-empty">
            <p>No tags match <strong>"{q}"</strong>.</p>
            <button
              type="button"
              className="bs-tagindex-clear-btn"
              onClick={() => setQ('')}
            >
              Clear filter
            </button>
          </div>
        )}

        {!isInitialLoading && rows.length > 0 && (
          <>
            <ul className="bs-tagindex-list">
              {rows.map((row) => (
                <li key={row.tagEventId} className="bs-tagindex-row">
                  <Link
                    to={`/tag/${encodeURIComponent(row.slug)}/${row.tagEventId}`}
                    className="bs-tagindex-row-link"
                  >
                    <div className="bs-tagindex-row-main">
                      <span className="bs-tagindex-row-name">{row.name}</span>
                      {row.description && (
                        <span className="bs-tagindex-row-desc">{truncate(row.description, 140)}</span>
                      )}
                      <span className="bs-tagindex-row-author">
                        by {row.displayName || shortNpub(row.authorPubkey)}
                      </span>
                    </div>
                    <div className="bs-tagindex-row-counts">
                      <span className="bs-tagindex-count bs-tagindex-count-apply" title="Applications in your POV's WoT">
                        +{row.applications}
                      </span>
                      <span className="bs-tagindex-count bs-tagindex-count-dispute" title="Disputes in your POV's WoT">
                        −{row.disputes}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="bs-tagindex-footer">
              <span className="bs-tagindex-count-summary">
                Showing {rows.length} of {total}
              </span>
              {hasMore && (
                <button
                  type="button"
                  className="bs-tagindex-loadmore"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
