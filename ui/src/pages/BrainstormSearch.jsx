import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/* ── Helpers ──────────────────────────────────────────── */

function timeAgo(unixSeconds) {
  if (!unixSeconds) return null;
  const now = Date.now() / 1000;
  const diff = now - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

const RESULTS_PER_PAGE = 40;

/* ── Result Card ──────────────────────────────────────── */

function ResultCard({ hit }) {
  const name = hit.name || hit.display_name || 'Unknown';
  const picture = hit.picture;
  const banner = hit.banner;
  const nip05 = hit.nip05;
  const about = hit.about;
  const npub = hit.npub;
  const website = hit.website;
  const lud16 = hit.lud16;
  const createdAt = hit.created_at;
  const profileAge = timeAgo(createdAt);
  const sixMonthsAgo = (Date.now() / 1000) - (180 * 86400);
  const isStale = createdAt && createdAt < sixMonthsAgo;

  return (
    <a
      href={`/kg/users/${hit.pubkey || hit.id}`}
      className="bs-result-card"
    >
      {banner && (
        <div className="bs-result-banner" style={{ backgroundImage: `url(${banner})` }} />
      )}
      <div className="bs-result-body">
        <div className="bs-result-row">
          {picture ? (
            <img
              src={picture}
              alt=""
              className="bs-result-avatar"
              onError={e => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="bs-result-avatar bs-result-avatar-placeholder">👤</div>
          )}
          <div className="bs-result-info">
            <div className="bs-result-name-row">
              <span className="bs-result-name">{name}</span>
              {profileAge && (
                <span className={`bs-result-age ${isStale ? 'stale' : ''}`}>
                  {isStale ? '⚠ ' : ''}updated {profileAge}
                </span>
              )}
            </div>
            {nip05 && <div className="bs-result-nip05">{nip05}</div>}
            <div className="bs-result-pubkey">
              {npub ? `${npub.slice(0, 20)}…${npub.slice(-8)}` : `${(hit.pubkey || '').slice(0, 16)}…${(hit.pubkey || '').slice(-8)}`}
            </div>
            {about && (
              <div className="bs-result-about">
                {about.length > 200 ? about.slice(0, 200) + '…' : about}
              </div>
            )}
            {(website || lud16) && (
              <div className="bs-result-links">
                {website && <span>🌐 {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>}
                {lud16 && <span>⚡ {lud16}</span>}
              </div>
            )}
            {(hit.wot_rank != null || hit.wot_followers != null) && (
              <div className="bs-result-wot">
                {hit.wot_rank != null && (
                  <span className="bs-wot-badge bs-wot-rank">🏅 rank: {hit.wot_rank}</span>
                )}
                {hit.wot_followers != null && (
                  <span className="bs-wot-badge bs-wot-followers">👥 followers: {hit.wot_followers}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function BrainstormSearch() {
  const { user, login, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [pov, setPov] = useState('nosfabrica');
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const hasResults = results !== null;
  const hasQuery = query.trim().length > 0;

  // Search function
  const doSearch = useCallback(async (q, offset = 0) => {
    const trimmed = (q ?? query).trim();
    if (!trimmed) return;

    if (offset === 0) {
      setLoading(true);
      setResults(null);
      setMeta(null);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const resp = await fetch(
        `/api/search/profiles/meili?q=${encodeURIComponent(trimmed)}&limit=${RESULTS_PER_PAGE}&offset=${offset}`
      );
      const data = await resp.json();

      if (!resp.ok || data.success === false) {
        setError(data.error || 'Search service unavailable.');
        return;
      }

      if (offset === 0) {
        setResults(data.hits || []);
      } else {
        setResults(prev => [...(prev || []), ...(data.hits || [])]);
      }
      setMeta({
        estimatedTotalHits: data.estimatedTotalHits || 0,
        processingTimeMs: data.processingTimeMs || 0,
        query: data.query || trimmed,
      });
    } catch (err) {
      setError(`Search failed: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [query]);

  // Debounced search-as-you-type
  const handleInputChange = useCallback((value) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(() => doSearch(value), 300);
    } else if (value.trim().length === 0) {
      setResults(null);
      setMeta(null);
      setError(null);
    }
  }, [doSearch]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const hasMore = results && meta && results.length < meta.estimatedTotalHits;

  // Landing view (no results yet)
  if (!hasResults && !loading && !error) {
    return (
      <div className="bs-page">
        {/* Top-right auth area */}
        <div className="bs-top-bar">
          {user ? (
            <div className="bs-user-area">
              <span className="bs-user-name">{user.profile?.name || user.pubkey.slice(0, 12) + '…'}</span>
              <button className="bs-link-btn" onClick={logout}>Sign out</button>
            </div>
          ) : (
            <button className="bs-link-btn" onClick={login}>Sign in with nostr</button>
          )}
        </div>

        {/* Centered landing */}
        <div className="bs-landing">
          <h1 className="bs-logo">
            <span className="bs-logo-icon">🧠</span>
            Brainstorm Search
          </h1>
          <p className="bs-tagline">Search across millions of nostr profiles</p>

          <div className="bs-search-box-landing">
            <span className="bs-search-icon">🔍</span>
            <input
              ref={inputRef}
              type="text"
              className="bs-search-input-landing"
              value={query}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search by name, bio, NIP-05, website…"
              autoFocus
            />
          </div>

          {/* POV selector (visible when signed in) */}
          {user && (
            <div className="bs-pov-landing">
              <span className="bs-pov-label">Point of view:</span>
              <button
                className={`bs-pov-btn ${pov === 'nosfabrica' ? 'active' : ''}`}
                onClick={() => setPov('nosfabrica')}
              >
                NosFabrica
              </button>
              <button
                className={`bs-pov-btn ${pov === 'user' ? 'active' : ''}`}
                onClick={() => setPov('user')}
              >
                My WoT
              </button>
            </div>
          )}

          <div className="bs-hints">
            <span>Try:</span>
            {['straycat', 'bitcoin', 'developer', 'nostr'].map(term => (
              <button
                key={term}
                className="bs-hint-chip"
                onClick={() => { setQuery(term); doSearch(term); }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        <div className="bs-footer">
          Powered by <a href="https://tapestry.ninja" className="bs-footer-link">Tapestry</a> · Nostr profile data indexed via Meilisearch
        </div>
      </div>
    );
  }

  // Results view
  return (
    <div className="bs-page bs-page-results">
      {/* Top bar with search + auth */}
      <div className="bs-results-header">
        <div className="bs-results-header-left">
          <a
            href="/kg/brainstorm-search"
            className="bs-results-logo"
            onClick={e => {
              e.preventDefault();
              setQuery('');
              setResults(null);
              setMeta(null);
              setError(null);
            }}
          >
            🧠
          </a>
          <div className="bs-search-box-results">
            <input
              ref={inputRef}
              type="text"
              className="bs-search-input-results"
              value={query}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search profiles…"
            />
          </div>
        </div>
        <div className="bs-results-header-right">
          {user && (
            <div className="bs-pov-inline">
              <button
                className={`bs-pov-btn-sm ${pov === 'nosfabrica' ? 'active' : ''}`}
                onClick={() => setPov('nosfabrica')}
              >
                NosFabrica
              </button>
              <button
                className={`bs-pov-btn-sm ${pov === 'user' ? 'active' : ''}`}
                onClick={() => setPov('user')}
              >
                My WoT
              </button>
            </div>
          )}
          {user ? (
            <div className="bs-user-area-sm">
              <span className="bs-user-name-sm">{user.profile?.name || user.pubkey.slice(0, 8) + '…'}</span>
              <button className="bs-link-btn-sm" onClick={logout}>Sign out</button>
            </div>
          ) : (
            <button className="bs-link-btn-sm" onClick={login}>Sign in</button>
          )}
        </div>
      </div>

      {/* Results area */}
      <div className="bs-results-body">
        {loading && (
          <div className="bs-loading">Searching…</div>
        )}

        {error && (
          <div className="bs-error">{error}</div>
        )}

        {results && !loading && (
          <>
            <div className="bs-results-meta">
              <span>
                {results.length === 0
                  ? 'No results found'
                  : `About ${meta?.estimatedTotalHits?.toLocaleString() || '?'} results`}
              </span>
              {meta?.processingTimeMs != null && (
                <span className="bs-results-time">({meta.processingTimeMs}ms)</span>
              )}
            </div>

            <div className="bs-results-list">
              {results.map(hit => (
                <ResultCard key={hit.pubkey || hit.id} hit={hit} />
              ))}
            </div>

            {hasMore && (
              <div className="bs-load-more">
                <button
                  className="bs-load-more-btn"
                  onClick={() => doSearch(meta.query, results.length)}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? 'Loading…'
                    : `Show more results`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
