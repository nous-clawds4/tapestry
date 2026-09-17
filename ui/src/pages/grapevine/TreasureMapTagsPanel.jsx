import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../../components/Avatar';
import { queryRelay } from '../../api/relay';
import { classifyEntry, markDuplicateEntries, communityPointerOf, describeHeaderLookup } from '../../utils/treasureMap';

const CLS_LABEL = { ta: 'Trusted Assertion', tl: 'Trusted List', dlist: 'Curated DList', designation: 'TA designation', other: 'other' };
const CLS_COLOR = { ta: '#58a6ff', tl: '#d2a8ff', dlist: '#f0883e', designation: '#8b949e', other: '#8b949e' };

const short = (pk) => `${pk.slice(0, 8)}…${pk.slice(-4)}`;
/** `<kind>:<pubkey>:<d>` → `<kind>:<pk8>…<pk4>:<d>` for display (the d-tag may contain colons). */
function shortCoord(coord) {
  const i = coord.indexOf(':');
  const j = coord.indexOf(':', i + 1);
  if (j < 0) return coord;
  return `${coord.slice(0, i)}:${short(coord.slice(i + 1, j))}:${coord.slice(j + 1)}`;
}

/**
 * Enumerates every entry of a kind-10040 Treasure Map: kind, classification
 * (per ADR tl-treasure-map/0001's parse rule, extended by ADR dlist-curation/0006 with the
 * Curated DList and TA designation classes), the delegate's avatar linked to their profile, and
 * whether the delegate is this instance's Tapestry Assistant. For Curated DList rows the panel
 * also verifies the header the entry addresses — local strfry first, the row's relay hint only
 * when missing locally — and shows its name, a link, and the community header it inherits from,
 * or a warning naming where it looked. Display-only — the opt-in/publish flows are the panels'.
 */
export default function TreasureMapTagsPanel({ tags }) {
  // Badge baseline = the SIGNED-IN USER'S assistant, not the instance owner's
  // (escaped-defect pin, OPEN.md row 188).
  const { user } = useAuth();
  const assistantPubkey = user?.assistantPubkey || null;
  const [profiles, setProfiles] = useState({});
  const [headers, setHeaders] = useState({}); // coordinate → { event, checkedRelay } | { missing: true, checkedRelay }

  // First occurrence wins among Curated DList rows (ADR 0002 §5).
  const rows = useMemo(() => markDuplicateEntries((tags || []).map(classifyEntry)), [tags]);

  // One deduped kind-0 fetch for every pubkey the Map delegates to.
  useEffect(() => {
    const pubkeys = [...new Set(rows.map((r) => r.pubkey).filter(Boolean))];
    if (pubkeys.length === 0) return;
    fetch(`/api/profiles?pubkeys=${pubkeys.join(',')}`)
      .then((r) => r.json())
      .then((d) => { if (d?.success && d.profiles) setProfiles(d.profiles); })
      .catch(() => {});
  }, [rows]);

  // The two-step header lookup for the effective Curated DList rows (ADR 0006 sub-decision 2):
  // local strfry batched per (kind, delegate), then the row's relay hint only for what is still
  // missing. Every failure reads as "missing" — the warning is the honest state.
  useEffect(() => {
    const effective = rows.filter((r) => r.cls === 'dlist' && !r.duplicate);
    if (effective.length === 0) { setHeaders({}); return undefined; }
    let cancelled = false;
    (async () => {
      const found = {};
      const groups = new Map();
      for (const r of effective) {
        const key = `${r.kind}:${r.pubkey}`;
        if (!groups.has(key)) groups.set(key, { kind: r.kind, pubkey: r.pubkey, ds: [] });
        groups.get(key).ds.push(r.name);
      }
      for (const g of groups.values()) {
        try {
          const evs = await queryRelay({ kinds: [g.kind], authors: [g.pubkey], '#d': g.ds });
          for (const ev of evs || []) {
            const d = ev?.tags?.find((t) => t[0] === 'd')?.[1];
            if (d == null) continue;
            const coord = `${ev.kind}:${ev.pubkey}:${d}`;
            if (!found[coord] || (ev.created_at || 0) > (found[coord].event.created_at || 0)) found[coord] = { event: ev, checkedRelay: null };
          }
        } catch { /* a failed local lookup reads as missing */ }
      }
      for (const r of effective) {
        const coord = `${r.kind}:${r.pubkey}:${r.name}`;
        if (found[coord]) continue;
        const hint = r.relay && /^wss?:\/\//i.test(r.relay) ? r.relay : null;
        if (!hint) { found[coord] = { missing: true, checkedRelay: null }; continue; }
        try {
          const filter = JSON.stringify({ kinds: [r.kind], authors: [r.pubkey], '#d': [r.name] });
          const res = await fetch(`/api/relay/external?filter=${encodeURIComponent(filter)}&relays=${encodeURIComponent(hint)}`);
          const data = await res.json();
          const ev = (data?.events || [])
            .filter((e) => e && e.kind === r.kind && e.pubkey === r.pubkey)
            .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];
          found[coord] = ev ? { event: ev, checkedRelay: hint } : { missing: true, checkedRelay: hint };
        } catch {
          found[coord] = { missing: true, checkedRelay: hint };
        }
      }
      if (!cancelled) setHeaders(found);
    })();
    return () => { cancelled = true; };
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
        <EntryRow
          key={i}
          row={row}
          assistantPubkey={assistantPubkey}
          profile={row.pubkey ? profiles[row.pubkey] : null}
          lookup={row.cls === 'dlist' && !row.duplicate ? headers[`${row.kind}:${row.pubkey}:${row.name}`] : undefined}
        />
      ))}
    </div>
  );
}

function EntryRow({ row, assistantPubkey, profile, lookup }) {
  // No judgment until the user's assistant has resolved (null ⇒ no badge) —
  // a delegate row must never flash "external" against a missing baseline.
  const locality = !assistantPubkey || !row.pubkey ? null : row.pubkey === assistantPubkey ? 'local' : 'external';
  const isDList = row.cls === 'dlist';
  const pillName = row.cls === 'tl' && row.name ? ` · ${row.name}` : isDList ? ` · ${row.name}` : '';

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
        {CLS_LABEL[row.cls]}{pillName}
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
          Your assistant
        </span>
      )}
      {locality === 'external' && (
        <span style={{
          fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px',
          backgroundColor: 'rgba(139, 148, 158, 0.15)', color: '#8b949e', whiteSpace: 'nowrap',
        }}>
          {isDList ? `external · ${short(row.pubkey)}` : 'external'}
        </span>
      )}
      {row.duplicate && (
        <span style={{
          fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px',
          backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', whiteSpace: 'nowrap',
        }} title="A later entry for the same kind and d-tag; the first occurrence is the effective one (ADR dlist-curation/0002 §5)">
          duplicate — ignored
        </span>
      )}

      {row.relay && (
        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.55, marginLeft: 'auto' }}>
          {row.relay}
        </span>
      )}

      {isDList && !row.duplicate && <DListRowDetails row={row} lookup={lookup} />}
    </div>
  );
}

/** The verified-header line under a Curated DList row: name + link, the community pointer, or the warning. */
function DListRowDetails({ row, lookup }) {
  const coord = `${row.kind}:${row.pubkey}:${row.name}`;
  const line = { flexBasis: '100%', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' };
  if (!lookup) return <div style={{ ...line, opacity: 0.6 }}>⏳ checking the header…</div>;
  const verdict = describeHeaderLookup(row, lookup.event || null, lookup.checkedRelay);
  if (verdict.status === 'missing') {
    return <div style={{ ...line, color: '#f59e0b' }}>⚠️ {verdict.text}</div>;
  }
  const header = lookup.event;
  const name = header.tags?.find((t) => t[0] === 'names')?.[1] || row.name;
  const pointer = communityPointerOf(header);
  return (
    <div style={line}>
      <Link to={`/tapestry/lists/${encodeURIComponent(coord)}`} style={{ color: '#58a6ff', fontWeight: 600 }}>{name}</Link>
      {pointer ? (
        <span>
          inherits from{' '}
          <Link to={`/tapestry/lists/${encodeURIComponent(pointer.coord)}`} style={{ color: '#58a6ff', fontFamily: 'monospace', fontSize: '0.75rem' }}>{shortCoord(pointer.coord)}</Link>
          <span style={{ opacity: 0.6 }}> ({pointer.type})</span>
        </span>
      ) : (
        <span style={{ opacity: 0.6 }}>no community pointer</span>
      )}
      <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>· found {verdict.where === 'relay' ? `on ${lookup.checkedRelay}` : 'locally'}</span>
    </div>
  );
}
