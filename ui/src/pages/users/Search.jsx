import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import useProfiles from '../../hooks/useProfiles';

/**
 * Validate a hex pubkey (64 lowercase hex chars).
 */
function isValidPubkey(str) {
  return /^[0-9a-f]{64}$/.test(str);
}

/**
 * Decode a bech32 npub to hex pubkey.
 * Minimal inline bech32 decoder (no external deps).
 */
function npubToHex(npub) {
  try {
    if (!npub.startsWith('npub1')) return null;
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const data = [];
    for (let i = 5; i < npub.length; i++) {
      const idx = CHARSET.indexOf(npub[i]);
      if (idx === -1) return null;
      data.push(idx);
    }
    const values = data.slice(0, data.length - 6);
    let acc = 0;
    let bits = 0;
    const bytes = [];
    for (const v of values) {
      acc = (acc << 5) | v;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        bytes.push((acc >> bits) & 0xff);
      }
    }
    if (bytes.length !== 32) return null;
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/**
 * Format a Unix timestamp as a relative time string.
 */
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

function UserPreviewCard({ pubkey, searchHit }) {
  // Only fetch from relay when there's no search hit (pubkey/npub direct lookup)
  const profiles = useProfiles(searchHit ? [] : [pubkey]);
  const profile = searchHit ? null : profiles[pubkey];
  const navigate = useNavigate();

  const name = searchHit?.name || searchHit?.display_name || profile?.name || profile?.display_name || 'Unknown';
  const picture = searchHit?.picture || profile?.picture;
  const banner = searchHit?.banner || profile?.banner;
  const nip05 = searchHit?.nip05 || profile?.nip05;
  const about = searchHit?.about || profile?.about;
  const npub = searchHit?.npub;
  const website = searchHit?.website || profile?.website;
  const lud16 = searchHit?.lud16 || profile?.lud16;
  const createdAt = searchHit?.created_at;

  const profileAge = timeAgo(createdAt);
  const sixMonthsAgo = (Date.now() / 1000) - (180 * 86400);
  const isStale = createdAt && createdAt < sixMonthsAgo;

  return (
    <div
      style={{
        border: '1px solid var(--border, #444)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
      onClick={() => navigate(`/tapestry/users/${pubkey}`)}
      onKeyDown={e => e.key === 'Enter' && navigate(`/tapestry/users/${pubkey}`)}
      role="button"
      tabIndex={0}
    >
      {/* Banner strip */}
      {banner && (
        <div style={{
          height: 48,
          backgroundImage: `url(${banner})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: 0.4,
        }} />
      )}

      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {picture ? (
            <img
              src={picture}
              alt=""
              style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              onError={e => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              backgroundColor: 'var(--border, #444)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
            }}>👤</div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>{name}</span>
              {profileAge && (
                <span style={{
                  fontSize: '0.7rem',
                  opacity: 0.4,
                  color: isStale ? '#d29922' : undefined,
                }}>
                  {isStale ? '⚠ ' : ''}updated {profileAge}
                </span>
              )}
            </div>
            {nip05 && (
              <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{nip05}</div>
            )}
            <div style={{ fontSize: '0.7rem', opacity: 0.4, fontFamily: 'monospace', marginTop: '0.15rem' }}>
              {npub ? `${npub.slice(0, 20)}…${npub.slice(-8)}` : `${pubkey.slice(0, 16)}…${pubkey.slice(-8)}`}
            </div>
            {about && (
              <div style={{
                fontSize: '0.8rem', opacity: 0.6, marginTop: '0.35rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {about.length > 150 ? about.slice(0, 150) + '…' : about}
              </div>
            )}
            {/* Website / Lightning */}
            {(website || lud16) && (
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.3rem', fontSize: '0.75rem', opacity: 0.5 }}>
                {website && (
                  <span>🌐 {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                )}
                {lud16 && (
                  <span>⚡ {lud16}</span>
                )}
              </div>
            )}
            {/* WoT scores */}
            {(searchHit?.wot_rank != null || searchHit?.wot_followers != null) && (
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem', fontSize: '0.75rem' }}>
                {searchHit.wot_rank != null && (
                  <span style={{
                    padding: '0.1rem 0.5rem', borderRadius: '4px',
                    backgroundColor: 'rgba(88, 166, 255, 0.12)', color: '#58a6ff',
                  }}>
                    🏅 rank: {searchHit.wot_rank}
                  </span>
                )}
                {searchHit.wot_followers != null && (
                  <span style={{
                    padding: '0.1rem 0.5rem', borderRadius: '4px',
                    backgroundColor: 'rgba(63, 185, 80, 0.12)', color: '#3fb950',
                  }}>
                    👥 followers: {searchHit.wot_followers}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MeiliStatusPanel({ sectionStyle }) {
  const [stats, setStats] = useState(null);
  const [bulkStatus, setBulkStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const resp = await fetch('/api/search/profiles/meili/stats');
      const data = await resp.json();
      if (data.success !== false) setStats(data);
    } catch { /* ignore */ }
  }, []);

  const fetchBulkStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/search/profiles/meili/bulk-status');
      const data = await resp.json();
      setBulkStatus(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchBulkStatus();
    const interval = setInterval(() => {
      fetchStats();
      fetchBulkStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchBulkStatus]);

  const triggerResync = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/search/profiles/meili/resync', { method: 'POST' });
      setTimeout(fetchBulkStatus, 2000);
      setTimeout(fetchStats, 5000);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [fetchStats, fetchBulkStatus]);

  const isBulkRunning = bulkStatus?.status === 'fetching' || bulkStatus?.status === 'indexing';

  return (
    <div style={{ ...sectionStyle, opacity: 0.7 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setCollapsed(c => !c)}
      >
        <label style={{ fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
          {collapsed ? '▶' : '▼'} Search Index Status
          {stats && !collapsed ? '' : stats ? ` — ${(stats.numberOfDocuments || 0).toLocaleString()} profiles` : ''}
        </label>
        {!collapsed && (
          <button
            className="btn"
            onClick={e => { e.stopPropagation(); triggerResync(); }}
            disabled={loading || isBulkRunning}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
          >
            {isBulkRunning ? '⏳ Indexing...' : '🔄'} Load profiles from strfry
          </button>
        )}
      </div>
      {!collapsed && (
        <>
          {stats && (
            <div style={{ fontSize: '0.8rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              <span>📊 <strong>{(stats.numberOfDocuments || 0).toLocaleString()}</strong> profiles indexed</span>
              {stats.ingest && (
                <span>{stats.ingest.connected ? '🟢' : '🔴'} Live relay: {stats.ingest.connected ? 'connected' : 'disconnected'}</span>
              )}
            </div>
          )}
          {stats?.freshness && (
            <div style={{ fontSize: '0.8rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.5rem', opacity: 0.8 }}>
              <span>🟢 Last 30d: <strong>{stats.freshness.updatedLast30d?.toLocaleString()}</strong></span>
              <span>🟡 30–90d: <strong>{stats.freshness.updated30to90d?.toLocaleString()}</strong></span>
              <span>🔴 &gt;90d: <strong>{stats.freshness.olderThan90d?.toLocaleString()}</strong></span>
            </div>
          )}
          {isBulkRunning && (
            <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#58a6ff' }}>
              🔄 Bulk indexing: {(bulkStatus.indexed || 0).toLocaleString()} indexed / {(bulkStatus.processed || 0).toLocaleString()} processed
              {bulkStatus.status === 'fetching' && ' (streaming from strfry...)'}
            </div>
          )}
          {bulkStatus?.status === 'complete' && bulkStatus.finishedAt && (
            <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#3fb950' }}>
              ✅ Last bulk index: {(bulkStatus.indexed || 0).toLocaleString()} profiles
              ({((bulkStatus.finishedAt - bulkStatus.startedAt) / 1000).toFixed(1)}s)
            </div>
          )}
          {bulkStatus?.status === 'error' && (
            <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: '#f85149' }}>
              ❌ Bulk index error: {bulkStatus.error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const RESULTS_PER_PAGE = 40;

export default function UserSearch() {
  const [pubkeyInput, setPubkeyInput] = useState('');
  const [npubInput, setNpubInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [foundPubkey, setFoundPubkey] = useState(null);
  const [keywordResults, setKeywordResults] = useState(null);
  const [keywordMeta, setKeywordMeta] = useState(null);
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const navigate = useNavigate();
  const debounceRef = useRef(null);

  const searchByPubkey = useCallback(() => {
    setSearchError(null);
    setFoundPubkey(null);
    setKeywordResults(null);
    setHasSearched(true);
    const trimmed = pubkeyInput.trim().toLowerCase();
    if (isValidPubkey(trimmed)) {
      setFoundPubkey(trimmed);
    } else {
      setSearchError('Invalid pubkey. Must be 64 lowercase hex characters.');
    }
  }, [pubkeyInput]);

  const searchByNpub = useCallback(() => {
    setSearchError(null);
    setFoundPubkey(null);
    setKeywordResults(null);
    setHasSearched(true);
    const trimmed = npubInput.trim();
    const hex = npubToHex(trimmed);
    if (hex) {
      setFoundPubkey(hex);
    } else {
      setSearchError('Invalid npub. Must start with "npub1" and be a valid bech32 encoding.');
    }
  }, [npubInput]);

  const searchByKeyword = useCallback(async (query) => {
    const q = (query ?? keywordInput).trim();
    if (!q) return;

    setSearchError(null);
    setFoundPubkey(null);
    setKeywordResults(null);
    setKeywordMeta(null);
    setKeywordLoading(true);
    setHasSearched(true);

    try {
      const resp = await fetch(`/api/search/profiles/meili?q=${encodeURIComponent(q)}&limit=${RESULTS_PER_PAGE}&offset=0`);
      const data = await resp.json();

      if (!resp.ok || data.success === false) {
        setSearchError(data.error || 'Search service unavailable. Is Meilisearch running?');
        return;
      }

      setKeywordResults(data.hits || []);
      setKeywordMeta({
        estimatedTotalHits: data.estimatedTotalHits || 0,
        processingTimeMs: data.processingTimeMs || 0,
        query: data.query || q,
      });
    } catch (err) {
      setSearchError(`Search failed: ${err.message}`);
    } finally {
      setKeywordLoading(false);
    }
  }, [keywordInput]);

  const loadMore = useCallback(async () => {
    if (!keywordResults || !keywordMeta?.query) return;
    setLoadingMore(true);
    try {
      const offset = keywordResults.length;
      const resp = await fetch(`/api/search/profiles/meili?q=${encodeURIComponent(keywordMeta.query)}&limit=${RESULTS_PER_PAGE}&offset=${offset}`);
      const data = await resp.json();
      if (resp.ok && data.hits) {
        setKeywordResults(prev => [...prev, ...data.hits]);
        setKeywordMeta(prev => ({
          ...prev,
          estimatedTotalHits: data.estimatedTotalHits || prev.estimatedTotalHits,
        }));
      }
    } catch { /* ignore */ }
    finally { setLoadingMore(false); }
  }, [keywordResults, keywordMeta]);

  // Debounced search-as-you-type
  const handleKeywordChange = useCallback((value) => {
    setKeywordInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        searchByKeyword(value);
      }, 300);
    }
  }, [searchByKeyword]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const hasMore = keywordResults && keywordMeta &&
    keywordResults.length < keywordMeta.estimatedTotalHits;

  const inputStyle = {
    flex: 1,
    padding: '0.5rem 0.75rem',
    fontSize: '0.9rem',
    fontFamily: 'monospace',
    backgroundColor: 'var(--bg-primary, #0f0f23)',
    color: 'var(--text-primary, #e0e0e0)',
    border: '1px solid var(--border, #444)',
    borderRadius: '4px',
  };

  const sectionStyle = {
    padding: '1rem',
    border: '1px solid var(--border, #444)',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-secondary, #1a1a2e)',
    marginBottom: '1rem',
  };

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🔍 Search Users</h1>
      <p className="subtitle">Find a nostr user by pubkey, npub, or keyword.</p>

      {/* Search by Keyword (primary search) */}
      <div style={sectionStyle}>
        <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
          Search by Keyword
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={keywordInput}
            onChange={e => handleKeywordChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchByKeyword()}
            placeholder="e.g. straycat, brainstorm, alice@example.com ..."
            style={{ ...inputStyle, fontFamily: 'inherit' }}
            autoFocus
          />
          <button
            className="btn btn-primary"
            onClick={() => searchByKeyword()}
            disabled={keywordLoading}
          >
            {keywordLoading ? '⏳' : '🔍'} Search
          </button>
        </div>
        <p style={{ fontSize: '0.75rem', margin: '0.5rem 0 0', opacity: 0.5 }}>
          Full-text search across names, bios, NIP-05, Lightning addresses, and more.
          Results update as you type.
        </p>
      </div>

      {/* Search by Pubkey */}
      <div style={sectionStyle}>
        <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
          Search by Hex Pubkey
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={pubkeyInput}
            onChange={e => setPubkeyInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchByPubkey()}
            placeholder="e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f"
            style={inputStyle}
          />
          <button className="btn btn-primary" onClick={searchByPubkey}>
            🔍 Search
          </button>
        </div>
      </div>

      {/* Search by npub */}
      <div style={sectionStyle}>
        <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
          Search by npub
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={npubInput}
            onChange={e => setNpubInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchByNpub()}
            placeholder="npub1u5njm6g5h5cpw4wy8xugu62e5s7f6fnysv0sj0z3a8rengt2zqhsxrldq3"
            style={inputStyle}
          />
          <button className="btn btn-primary" onClick={searchByNpub}>
            🔍 Search
          </button>
        </div>
      </div>

      {/* Error */}
      {searchError && (
        <div style={{
          padding: '0.75rem 1rem',
          border: '1px solid #f85149',
          borderRadius: '8px',
          backgroundColor: 'rgba(248, 81, 73, 0.08)',
          color: '#f85149',
          fontSize: '0.9rem',
          marginBottom: '1rem',
        }}>
          {searchError}
        </div>
      )}

      {/* Single pubkey result */}
      {foundPubkey && (
        <div style={{ marginTop: '1rem' }}>
          <h3 style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '0.75rem' }}>Result</h3>
          <UserPreviewCard pubkey={foundPubkey} />
        </div>
      )}

      {/* Empty state / search tips */}
      {!hasSearched && !keywordResults && !foundPubkey && (
        <div style={{
          ...sectionStyle,
          textAlign: 'center',
          padding: '2rem',
          opacity: 0.6,
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</div>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>
            Search across <strong>hundreds of thousands</strong> of nostr profiles.
          </p>
          <div style={{ fontSize: '0.8rem', lineHeight: 1.8 }}>
            <strong>Try searching for:</strong><br />
            A display name, NIP-05 address, keyword in a bio,<br />
            Lightning address, or website URL.
          </div>
        </div>
      )}

      {/* Meilisearch Index Status (collapsible) */}
      <MeiliStatusPanel sectionStyle={sectionStyle} />

      {/* Keyword search results */}
      {keywordResults && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.9rem', opacity: 0.7, margin: 0 }}>
              {keywordResults.length === 0
                ? 'No results found'
                : `Showing ${keywordResults.length.toLocaleString()} of ~${keywordMeta?.estimatedTotalHits?.toLocaleString() || '?'} results`
              }
            </h3>
            {keywordMeta?.processingTimeMs != null && (
              <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>
                {keywordMeta.processingTimeMs}ms
              </span>
            )}
          </div>

          {keywordResults.length === 0 && (
            <div style={{ ...sectionStyle, textAlign: 'center', opacity: 0.6 }}>
              <p style={{ fontSize: '0.85rem' }}>
                No profiles matched your query. Try a broader search term or check the spelling.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {keywordResults.map(hit => (
              <UserPreviewCard
                key={hit.pubkey || hit.id}
                pubkey={hit.pubkey || hit.id}
                searchHit={hit}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                className="btn"
                onClick={loadMore}
                disabled={loadingMore}
                style={{ padding: '0.5rem 2rem' }}
              >
                {loadingMore ? '⏳ Loading...' : `Load More (${(keywordMeta.estimatedTotalHits - keywordResults.length).toLocaleString()} remaining)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
