import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import Breadcrumbs from '../../components/Breadcrumbs';
import useProfiles from '../../hooks/useProfiles';

function shortPubkey(pk) {
  if (!pk) return '—';
  return pk.slice(0, 8) + '…' + pk.slice(-4);
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <tr>
      <td className="detail-label">{label}</td>
      <td>
        <span className="copy-field">
          <code className="pubkey-full">{value}</code>
          <button
            className="btn-copy"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? '✓' : '📋'}
          </button>
        </span>
      </td>
    </tr>
  );
}

export default function UserDetail() {
  const { pubkey } = useParams();
  const pubkeys = useMemo(() => [pubkey], [pubkey]);
  const profiles = useProfiles(pubkeys);
  const profile = profiles.get(pubkey);

  const displayName = profile?.display_name || profile?.name || shortPubkey(pubkey);

  const npub = useMemo(() => {
    try { return nip19.npubEncode(pubkey); } catch { return null; }
  }, [pubkey]);

  const nprofile = useMemo(() => {
    try {
      return nip19.nprofileEncode({
        pubkey,
        relays: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'],
      });
    } catch { return null; }
  }, [pubkey]);

  return (
    <div className="page">
      <Breadcrumbs />
      <div className="user-detail-header">
        {profile?.picture ? (
          <img src={profile.picture} alt="" className="user-detail-avatar" />
        ) : (
          <div className="user-detail-avatar-placeholder">
            {(displayName || '?')[0].toUpperCase()}
          </div>
        )}
        <div>
          <h1>{displayName}</h1>
          {profile?.nip05 && <p className="user-nip05">✅ {profile.nip05}</p>}
        </div>
      </div>

      {profile?.banner && (
        <div className="user-banner">
          <img src={profile.banner} alt="" />
        </div>
      )}

      <div className="user-detail-grid">
        <div className="user-detail-card">
          <h3>About</h3>
          <p className="user-about">{profile?.about || <span className="text-muted">No bio available</span>}</p>
        </div>

        <div className="user-detail-card">
          <h3>Identity</h3>
          <table className="detail-table">
            <tbody>
              <CopyField label="Pubkey (hex)" value={pubkey} />
              {npub && <CopyField label="npub" value={npub} />}
              {nprofile && <CopyField label="nprofile" value={nprofile} />}
              {profile?.name && (
                <tr>
                  <td className="detail-label">Name</td>
                  <td>{profile.name}</td>
                </tr>
              )}
              {profile?.display_name && (
                <tr>
                  <td className="detail-label">Display Name</td>
                  <td>{profile.display_name}</td>
                </tr>
              )}
              {profile?.nip05 && (
                <tr>
                  <td className="detail-label">NIP-05</td>
                  <td>{profile.nip05}</td>
                </tr>
              )}
              {profile?.website && (
                <tr>
                  <td className="detail-label">Website</td>
                  <td><a href={profile.website} target="_blank" rel="noopener noreferrer">{profile.website}</a></td>
                </tr>
              )}
              {profile?.lud16 && (
                <tr>
                  <td className="detail-label">Lightning</td>
                  <td>{profile.lud16}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!profile && (
        <p className="text-muted" style={{ marginTop: 16 }}>
          Profile not found on external relays. This user may not have published a kind 0 event.
        </p>
      )}
    </div>
  );
}
