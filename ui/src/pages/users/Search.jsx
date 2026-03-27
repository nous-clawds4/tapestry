import { useState, useCallback } from 'react';
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

function UserPreviewCard({ pubkey, searchHit }) {
  const profiles = useProfiles([pubkey]);
  const profile = profiles[pubkey];
  const navigate = useNavigate();

  // Prefer data from search hit (kind 0 fields), fall back to relay-fetched profile
  const name = searchHit?.name || searchHit?.display_name || profile?.name || profile?.display_name || 'Unknown';
  const picture = searchHit?.picture || profile?.picture;
  const nip05 = searchHit?.nip05 || profile?.nip05;
  const about = searchHit?.about || profile?.about;
  const npub = searchHit?.npub;

  return (
    <div
      style={{
        padding: '1rem',
        border: '1px solid var(--border, #444)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        cursor: 'pointer',
      }}
      onClick={() => navigate(`/kg/users/${pubkey}`)}
      onKeyDown={e => e.key === 'Enter' && navigate(`/kg/users/${pubkey}`)}
      role="button"
      tabIndex={0}
    >
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
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>{name}</div>
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
        </div>
      </div>
    </div>
  );
}

export default function UserSearch() {
  const [pubkeyInput, setPubkeyInput] = useState('');
  const [npubInput, setNpubInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [foundPubkey, setFoundPubkey] = useState(null);
  const [keywordResults, setKeywordResults] = useState(null);
  const [keywordMeta, setKeywordMeta] = useState(null);
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const navigate = useNavigate();

  const searchByPubkey = useCallback(() => {
    setSearchError(null);
    setFoundPubkey(null);
    setKeywordResults(null);
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
    const trimmed = npubInput.trim();
    const hex = npubToHex(trimmed);
    if (hex) {
      setFoundPubkey(hex);
    } else {
      setSearchError('Invalid npub. Must start with "npub1" and be a valid bech32 encoding.');
    }
  }, [npubInput]);

  const searchByKeyword = useCallback(async () => {
    const q = keywordInput.trim();
    if (!q) return;

    setSearchError(null);
    setFoundPubkey(null);
    setKeywordResults(null);
    setKeywordMeta(null);
    setKeywordLoading(true);

    try {
      const resp = await fetch(`/api/search/profiles/meili?q=${encodeURIComponent(q)}&limit=20`);
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

      {/* Search by Keyword (promoted to top — this is the primary search now) */}
      <div style={sectionStyle}>
        <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
          Search by Keyword
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchByKeyword()}
            placeholder="e.g. straycat, brainstorm, alice@example.com ..."
            style={{ ...inputStyle, fontFamily: 'inherit' }}
            autoFocus
          />
          <button
            className="btn btn-primary"
            onClick={searchByKeyword}
            disabled={keywordLoading}
          >
            {keywordLoading ? '⏳' : '🔍'} Search
          </button>
        </div>
        <p style={{ fontSize: '0.75rem', margin: '0.5rem 0 0', opacity: 0.5 }}>
          Full-text search across names, bios, NIP-05, Lightning addresses, and more.
          Powered by Meilisearch.
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

      {/* Keyword search results */}
      {keywordResults && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.9rem', opacity: 0.7, margin: 0 }}>
              {keywordResults.length === 0
                ? 'No results found'
                : `${keywordMeta?.estimatedTotalHits?.toLocaleString() || keywordResults.length} results`
              }
            </h3>
            {keywordMeta?.processingTimeMs != null && (
              <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>
                {keywordMeta.processingTimeMs}ms
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {keywordResults.map(hit => (
              <UserPreviewCard
                key={hit.pubkey || hit.id}
                pubkey={hit.pubkey || hit.id}
                searchHit={hit}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
