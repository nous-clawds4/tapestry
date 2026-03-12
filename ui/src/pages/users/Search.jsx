import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';

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
    // Remove 6-char checksum
    const values = data.slice(0, data.length - 6);
    // Convert 5-bit groups to 8-bit bytes
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

function UserPreviewCard({ pubkey }) {
  const profiles = useProfiles([pubkey]);
  const profile = profiles[pubkey];
  const navigate = useNavigate();

  return (
    <div
      style={{
        marginTop: '1.5rem',
        padding: '1.25rem',
        border: '1px solid var(--border, #444)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
      }}
    >
      <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>User Found</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        {profile?.picture && (
          <img
            src={profile.picture}
            alt=""
            style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
          />
        )}
        <div>
          <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
            {profile?.name || profile?.display_name || 'Unknown'}
          </div>
          {profile?.nip05 && (
            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{profile.nip05}</div>
          )}
          <div style={{ fontSize: '0.75rem', opacity: 0.5, fontFamily: 'monospace', marginTop: '0.25rem' }}>
            {pubkey.slice(0, 16)}…{pubkey.slice(-8)}
          </div>
          {profile?.about && (
            <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.5rem', maxWidth: '500px' }}>
              {profile.about.length > 200 ? profile.about.slice(0, 200) + '…' : profile.about}
            </div>
          )}
        </div>
      </div>
      <button
        className="btn btn-primary"
        onClick={() => navigate(`/kg/users/${pubkey}`)}
      >
        View Profile →
      </button>
    </div>
  );
}

export default function UserSearch() {
  const [pubkeyInput, setPubkeyInput] = useState('');
  const [npubInput, setNpubInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [foundPubkey, setFoundPubkey] = useState(null);
  const [searchError, setSearchError] = useState(null);

  const searchByPubkey = useCallback(() => {
    setSearchError(null);
    setFoundPubkey(null);
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
    const trimmed = npubInput.trim();
    const hex = npubToHex(trimmed);
    if (hex) {
      setFoundPubkey(hex);
    } else {
      setSearchError('Invalid npub. Must start with "npub1" and be a valid bech32 encoding.');
    }
  }, [npubInput]);

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

      {/* Search by Keyword */}
      <div style={{ ...sectionStyle, opacity: 0.5 }}>
        <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
          Search by Keyword
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={keywordInput}
            onChange={e => setKeywordInput(e.target.value)}
            placeholder="e.g. straycat, brainstorm, ..."
            style={inputStyle}
            disabled
          />
          <button className="btn" disabled>
            🔍 Search
          </button>
        </div>
        <p style={{ fontSize: '0.8rem', margin: '0.5rem 0 0', opacity: 0.7 }}>
          🚧 Coming soon — keyword search across profiles
        </p>
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

      {/* Result */}
      {foundPubkey && <UserPreviewCard pubkey={foundPubkey} />}
    </div>
  );
}
