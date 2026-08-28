import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useConfig } from '../../context/ConfigContext';
import Avatar from '../../components/Avatar';
import { classifyEntry } from '../../utils/treasureMap';

const CLS_LABEL = { ta: 'Trusted Assertion', tl: 'Trusted List', other: 'other' };
const CLS_COLOR = { ta: '#58a6ff', tl: '#d2a8ff', other: '#8b949e' };

/**
 * Enumerates every entry of a kind-10040 Treasure Map: kind, classification
 * (per ADR tl-treasure-map/0001's parse rule), the delegate's avatar linked to
 * their profile, and whether the delegate is this instance's Tapestry Assistant.
 * Display-only — the opt-in/publish flow is story 3's.
 */
export default function TreasureMapTagsPanel({ tags }) {
  const { taPubkey } = useConfig();
  const [profiles, setProfiles] = useState({});

  const rows = useMemo(() => (tags || []).map(classifyEntry), [tags]);

  // One deduped kind-0 fetch for every pubkey the Map delegates to.
  useEffect(() => {
    const pubkeys = [...new Set(rows.map((r) => r.pubkey).filter(Boolean))];
    if (pubkeys.length === 0) return;
    fetch(`/api/profiles?pubkeys=${pubkeys.join(',')}`)
      .then((r) => r.json())
      .then((d) => { if (d?.success && d.profiles) setProfiles(d.profiles); })
      .catch(() => {});
  }, [rows]);

  if (!tags || tags.length === 0) {
    return (
      <div style={{ padding: '0.75rem 1rem', opacity: 0.6, fontSize: '0.85rem' }}>
        No tags in this Map yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {rows.map((row, i) => (
        <EntryRow key={i} row={row} taPubkey={taPubkey} profile={row.pubkey ? profiles[row.pubkey] : null} />
      ))}
    </div>
  );
}

function EntryRow({ row, taPubkey, profile }) {
  // No judgment until the runtime TA pubkey has resolved — the local TA's own
  // row must never flash "external" while /api/assistant/pubkey is in flight.
  const locality = !taPubkey || !row.pubkey ? null : row.pubkey === taPubkey ? 'local' : 'external';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.5rem 0.75rem',
      backgroundColor: 'var(--bg-primary, #0f0f23)',
      border: '1px solid var(--border, #444)',
      borderRadius: '6px',
      flexWrap: 'wrap',
    }}>
      <code style={{ fontSize: '0.8rem', fontWeight: 600, minWidth: '7.5rem' }}>
        {row.raw || '(empty)'}
      </code>
      <span style={{
        fontSize: '0.7rem',
        fontWeight: 600,
        padding: '0.15rem 0.5rem',
        borderRadius: '999px',
        border: `1px solid ${CLS_COLOR[row.cls]}`,
        color: CLS_COLOR[row.cls],
        whiteSpace: 'nowrap',
      }}>
        {CLS_LABEL[row.cls]}{row.cls === 'tl' && row.name ? ` · ${row.name}` : ''}
      </span>

      {row.pubkey ? (
        <Link
          to={`/tapestry/users/${row.pubkey}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: '#58a6ff' }}
        >
          <Avatar pubkey={row.pubkey} profile={profile} size={28} />
          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
            {profile?.display_name || profile?.name || `${row.pubkey.slice(0, 8)}…${row.pubkey.slice(-4)}`}
          </span>
        </Link>
      ) : (
        <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>—</span>
      )}

      {locality === 'local' && (
        <span style={{
          fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px',
          backgroundColor: 'rgba(63, 185, 80, 0.15)', color: '#3fb950', whiteSpace: 'nowrap',
        }}>
          Local TA
        </span>
      )}
      {locality === 'external' && (
        <span style={{
          fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px',
          backgroundColor: 'rgba(139, 148, 158, 0.15)', color: '#8b949e', whiteSpace: 'nowrap',
        }}>
          external
        </span>
      )}

      {row.relay && (
        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.55, marginLeft: 'auto' }}>
          {row.relay}
        </span>
      )}
    </div>
  );
}
