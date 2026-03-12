import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import Breadcrumbs from '../../components/Breadcrumbs';
import useProfiles from '../../hooks/useProfiles';
import { useTrust } from '../../context/TrustContext';
import { useCypher } from '../../hooks/useCypher';
import { queryRelay } from '../../api/relay';
import AuthorCell from '../../components/AuthorCell';

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
  const navigate = useNavigate();
  const { povPubkey, setPovPubkey } = useTrust();
  const isCurrentPov = povPubkey === pubkey;
  const pubkeys = useMemo(() => [pubkey], [pubkey]);
  const profiles = useProfiles(pubkeys);
  const profile = profiles?.[pubkey];

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

      {/* Trust Determination Panel */}
      <TrustPanel
        pubkey={pubkey}
        isCurrentPov={isCurrentPov}
        setPovPubkey={setPovPubkey}
        navigate={navigate}
      />

      {!profile && (
        <p className="text-muted" style={{ marginTop: 16 }}>
          Profile not found on external relays. This user may not have published a kind 0 event.
        </p>
      )}
    </div>
  );
}

/* ─── Trust Panel ─────────────────────────────────────────── */

const SOURCE_LOCAL = '__local__';

function TrustPanel({ pubkey, isCurrentPov, setPovPubkey, navigate }) {
  // Local strfry status — null = not checked, false = absent, event obj = present
  const [profileEvent, setProfileEvent] = useState(null);
  const [followList, setFollowList] = useState(null);
  const [muteList, setMuteList] = useState(null);
  const [treasureMap, setTreasureMap] = useState(null);
  const [checked, setChecked] = useState(false);

  // Relay source for find/update
  const [pendingSource, setPendingSource] = useState(SOURCE_LOCAL);

  // Fetch state
  const [fetchingProfile, setFetchingProfile] = useState(false);
  const [fetchingFollow, setFetchingFollow] = useState(false);
  const [fetchingMute, setFetchingMute] = useState(false);
  const [fetchingTM, setFetchingTM] = useState(false);

  // Expandable follows list
  const [showFollows, setShowFollows] = useState(false);

  // Relay sets from concept graph
  const { data: relaySetsData } = useCypher(`
    MATCH (h:ConceptHeader {name: 'nostr relay'})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
      -[:IS_A_SUPERSET_OF*0..5]->(s)
    OPTIONAL MATCH (s)-[:IS_A_SUPERSET_OF*0..5]->(ss)-[:HAS_ELEMENT]->(elem)
    OPTIONAL MATCH (elem)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    WITH s, labels(s) AS nodeLabels,
         collect(DISTINCT {name: elem.name, json: jt.value}) AS elems
    RETURN s.name AS name, s.uuid AS uuid, nodeLabels, elems
    ORDER BY size(elems) DESC
  `);

  const relaySets = useMemo(() => {
    if (!relaySetsData) return [];
    return relaySetsData.map(s => {
      const relays = [];
      for (const e of (s.elems || [])) {
        if (!e.json) continue;
        try {
          const parsed = JSON.parse(e.json);
          const url = parsed?.nostrRelay?.websocketUrl;
          if (url) relays.push(url);
        } catch {}
      }
      const isSuperset = (s.nodeLabels || []).includes('Superset');
      return {
        name: s.name,
        uuid: s.uuid,
        relays,
        label: isSuperset
          ? `All nostr relays (${relays.length})`
          : `${s.name} (${relays.length})`,
      };
    }).filter(s => s.relays.length > 0);
  }, [relaySetsData]);

  // Check local strfry for both events
  useEffect(() => {
    if (checked) return;
    let cancelled = false;

    async function check() {
      try {
        const [pr, fl, ml, tm] = await Promise.all([
          queryRelay({ kinds: [0], authors: [pubkey], limit: 1 }),
          queryRelay({ kinds: [3], authors: [pubkey], limit: 1 }),
          queryRelay({ kinds: [10000], authors: [pubkey], limit: 1 }),
          queryRelay({ kinds: [10040], authors: [pubkey], limit: 1 }),
        ]);
        if (!cancelled) {
          setProfileEvent(pr.length > 0 ? pr[0] : false);
          setFollowList(fl.length > 0 ? fl[0] : false);
          setMuteList(ml.length > 0 ? ml[0] : false);
          setTreasureMap(tm.length > 0 ? tm[0] : false);
          setChecked(true);
        }
      } catch {
        if (!cancelled) setChecked(true);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [pubkey, checked]);

  // Reset when pubkey changes
  useEffect(() => {
    setProfileEvent(null);
    setFollowList(null);
    setMuteList(null);
    setTreasureMap(null);
    setChecked(false);
  }, [pubkey]);

  // Find/update a specific kind from selected relay source
  const findEvent = useCallback(async (kind, setEvent, setFetching) => {
    setFetching(true);
    try {
      if (pendingSource === SOURCE_LOCAL) {
        // Just re-check local
        const events = await queryRelay({ kinds: [kind], authors: [pubkey], limit: 1 });
        setEvent(events.length > 0 ? events[0] : false);
      } else {
        const set = relaySets.find(s => s.uuid === pendingSource);
        if (!set || set.relays.length === 0) return;

        const filter = JSON.stringify({ kinds: [kind], authors: [pubkey], limit: 1 });
        const res = await fetch(
          `/api/relay/external?filter=${encodeURIComponent(filter)}&relays=${encodeURIComponent(set.relays.join(','))}`
        );
        const data = await res.json();
        if (data.success && data.events?.length > 0) {
          const ev = data.events.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];
          // Import to local strfry
          const pubRes = await fetch('/api/strfry/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: ev, signAs: 'client' }),
          });
          const pubData = await pubRes.json();
          if (pubData.success) {
            setEvent(ev);
          }
        } else {
          // Re-check local in case it was already there
          const local = await queryRelay({ kinds: [kind], authors: [pubkey], limit: 1 });
          setEvent(local.length > 0 ? local[0] : false);
        }
      }
    } catch (err) {
      console.error('Find event error:', err);
    } finally {
      setFetching(false);
    }
  }, [pubkey, pendingSource, relaySets]);

  const sectionStyle = {
    padding: '1rem',
    border: '1px solid var(--border, #444)',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-secondary, #1a1a2e)',
    marginTop: '1.5rem',
  };

  const statusRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.6rem 0.75rem',
    backgroundColor: 'var(--bg-primary, #0f0f23)',
    border: '1px solid var(--border, #444)',
    borderRadius: '6px',
    marginBottom: '0.5rem',
  };

  return (
    <div style={sectionStyle}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '1.3rem' }}>🎯</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Trust Determination</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
            {isCurrentPov
              ? 'This user is currently the active Point of View.'
              : 'Use this user\'s perspective for trust calculations.'}
          </div>
        </div>
        {isCurrentPov ? (
          <span style={{
            fontSize: '0.8rem',
            padding: '0.3rem 0.6rem',
            backgroundColor: 'rgba(63, 185, 80, 0.15)',
            border: '1px solid #3fb950',
            borderRadius: '4px',
            color: '#3fb950',
            fontWeight: 600,
          }}>
            ✅ Active PoV
          </span>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => {
              setPovPubkey(pubkey);
              navigate('/kg/grapevine/trust-determination');
            }}
            style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          >
            🎯 Use as Trust PoV
          </button>
        )}
      </div>

      {/* Relay source selector */}
      <div style={{
        marginBottom: '0.75rem',
        padding: '0.6rem 0.75rem',
        backgroundColor: 'var(--bg-primary, #0f0f23)',
        border: '1px solid var(--border, #444)',
        borderRadius: '6px',
      }}>
        <label style={{ fontSize: '0.7rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem', opacity: 0.7 }}>
          📡 Relay source for Find / Update
        </label>
        <select
          value={pendingSource}
          onChange={e => setPendingSource(e.target.value)}
          style={{
            width: '100%', padding: '0.35rem 0.6rem', fontSize: '0.8rem',
            backgroundColor: 'var(--bg-secondary, #1a1a2e)', color: 'var(--text-primary, #e0e0e0)',
            border: '1px solid var(--border, #444)', borderRadius: '4px', cursor: 'pointer',
          }}
        >
          <option value={SOURCE_LOCAL}>Local strfry (re-check)</option>
          {relaySets.map(s => (
            <option key={s.uuid} value={s.uuid}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Profile status */}
      <div style={statusRowStyle}>
        <span style={{ fontSize: '1rem' }}>👤</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Profile <span style={{ opacity: 0.5, fontWeight: 400 }}>(kind 0)</span></div>
          {checked && profileEvent === false && (
            <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Not found in local strfry</div>
          )}
          {checked && profileEvent && (() => {
            let name;
            try { name = JSON.parse(profileEvent.content || '{}').name; } catch {}
            return (
              <div style={{ fontSize: '0.75rem', color: '#3fb950' }}>
                ● Present{name ? ` — ${name}` : ''}
                {profileEvent.created_at && (
                  <span style={{ opacity: 0.5 }}> · {new Date(profileEvent.created_at * 1000).toLocaleDateString()}</span>
                )}
              </div>
            );
          })()}
          {!checked && <div style={{ fontSize: '0.75rem', opacity: 0.4 }}>Checking…</div>}
        </div>
        <button
          className="btn btn-sm"
          onClick={() => findEvent(0, setProfileEvent, setFetchingProfile)}
          disabled={fetchingProfile}
          style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}
        >
          {fetchingProfile ? '⏳' : (checked && profileEvent ? '🔄 Update' : '🔍 Find')}
        </button>
      </div>

      {/* Follow List status */}
      <div style={statusRowStyle}>
        <span style={{ fontSize: '1rem' }}>📋</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Follow List <span style={{ opacity: 0.5, fontWeight: 400 }}>(kind 3)</span></div>
          {checked && followList === false && (
            <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Not found in local strfry</div>
          )}
          {checked && followList && (
            <div style={{ fontSize: '0.75rem', color: '#3fb950' }}>
              ● Present — {followList.tags?.filter(t => t[0] === 'p').length || 0} follows
              {followList.created_at && (
                <span style={{ opacity: 0.5 }}> · {new Date(followList.created_at * 1000).toLocaleDateString()}</span>
              )}
            </div>
          )}
          {!checked && <div style={{ fontSize: '0.75rem', opacity: 0.4 }}>Checking…</div>}
        </div>
        {checked && followList && (
          <button
            className="btn btn-sm"
            onClick={() => setShowFollows(prev => !prev)}
            style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}
          >
            {showFollows ? '🔽 Hide' : '👁️ View'}
          </button>
        )}
        <button
          className="btn btn-sm"
          onClick={() => findEvent(3, setFollowList, setFetchingFollow)}
          disabled={fetchingFollow}
          style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}
        >
          {fetchingFollow ? '⏳' : (checked && followList ? '🔄 Update' : '🔍 Find')}
        </button>
      </div>

      {/* Expandable follows list */}
      {showFollows && followList && (
        <FollowsList followList={followList} />
      )}

      {/* Mute List status */}
      <div style={statusRowStyle}>
        <span style={{ fontSize: '1rem' }}>🔇</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Mute List <span style={{ opacity: 0.5, fontWeight: 400 }}>(kind 10000)</span></div>
          {checked && muteList === false && (
            <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Not found in local strfry</div>
          )}
          {checked && muteList && (
            <div style={{ fontSize: '0.75rem', color: '#3fb950' }}>
              ● Present — {muteList.tags?.filter(t => t[0] === 'p').length || 0} muted users
              {muteList.created_at && (
                <span style={{ opacity: 0.5 }}> · {new Date(muteList.created_at * 1000).toLocaleDateString()}</span>
              )}
            </div>
          )}
          {!checked && <div style={{ fontSize: '0.75rem', opacity: 0.4 }}>Checking…</div>}
        </div>
        <button
          className="btn btn-sm"
          onClick={() => findEvent(10000, setMuteList, setFetchingMute)}
          disabled={fetchingMute}
          style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}
        >
          {fetchingMute ? '⏳' : (checked && muteList ? '🔄 Update' : '🔍 Find')}
        </button>
      </div>

      {/* Treasure Map status */}
      <div style={statusRowStyle}>
        <span style={{ fontSize: '1rem' }}>🗺️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>TA Treasure Map <span style={{ opacity: 0.5, fontWeight: 400 }}>(kind 10040)</span></div>
          {checked && treasureMap === false && (
            <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>Not found in local strfry</div>
          )}
          {checked && treasureMap && (
            <div style={{ fontSize: '0.75rem', color: '#3fb950' }}>
              ● Present — {treasureMap.tags?.length || 0} tags
              {treasureMap.created_at && (
                <span style={{ opacity: 0.5 }}> · {new Date(treasureMap.created_at * 1000).toLocaleDateString()}</span>
              )}
            </div>
          )}
          {!checked && <div style={{ fontSize: '0.75rem', opacity: 0.4 }}>Checking…</div>}
        </div>
        <button
          className="btn btn-sm"
          onClick={() => findEvent(10040, setTreasureMap, setFetchingTM)}
          disabled={fetchingTM}
          style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}
        >
          {fetchingTM ? '⏳' : (checked && treasureMap ? '🔄 Update' : '🔍 Find')}
        </button>
      </div>
    </div>
  );
}


// ── Expandable Follows List ──────────────────────────────────

function FollowsList({ followList }) {
  const followPubkeys = useMemo(() => {
    return (followList.tags || [])
      .filter(t => t[0] === 'p' && t[1])
      .map(t => t[1]);
  }, [followList]);

  const profiles = useProfiles(followPubkeys);

  const rows = useMemo(() => {
    return followPubkeys.map((pk, i) => {
      const p = profiles[pk];
      return {
        idx: i + 1,
        pubkey: pk,
        name: p?.name || p?.display_name || null,
      };
    }).sort((a, b) => {
      // Named profiles first, then by name alpha
      if (a.name && !b.name) return -1;
      if (!a.name && b.name) return 1;
      if (a.name && b.name) return a.name.localeCompare(b.name);
      return 0;
    });
  }, [followPubkeys, profiles]);

  return (
    <div style={{
      marginLeft: '2rem',
      marginBottom: '0.75rem',
      padding: '0.75rem',
      border: '1px solid var(--border, #333)',
      borderRadius: '6px',
      maxHeight: '400px',
      overflowY: 'auto',
    }}>
      <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.5rem' }}>
        Following {followPubkeys.length} accounts:
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border, #333)' }}>
            <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem', opacity: 0.5, fontWeight: 500 }}>#</th>
            <th style={{ textAlign: 'left', padding: '0.3rem 0.5rem', opacity: 0.5, fontWeight: 500 }}>User</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.pubkey} style={{ borderBottom: '1px solid var(--border, #222)' }}>
              <td style={{ padding: '0.25rem 0.5rem', opacity: 0.4 }}>{i + 1}</td>
              <td style={{ padding: '0.25rem 0.5rem' }}>
                <Link
                  to={`/kg/users/${row.pubkey}`}
                  style={{ color: '#58a6ff', textDecoration: 'none' }}
                >
                  {row.name || (row.pubkey.slice(0, 12) + '…' + row.pubkey.slice(-6))}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
