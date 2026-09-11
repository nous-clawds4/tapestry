import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import useTreasureMap from '../../hooks/useTreasureMap';
import useCurationHeaders from '../../hooks/useCurationHeaders';
import { curatedDListRows, curatedDListPath, describeHeaderLookup } from '../../utils/treasureMap';

const TREASURE_MAP_PATH = '/tapestry/grapevine/treasure-map';
const short = (pk) => `${pk.slice(0, 8)}…${pk.slice(-4)}`;
const muted = { fontSize: '0.85rem', opacity: 0.6 };
const mono = { fontFamily: 'monospace', fontSize: '0.75rem' };
const box = (color) => ({
  padding: '0.75rem 1rem', borderRadius: '8px', fontSize: '0.9rem', marginBottom: '1rem',
  border: `1px solid ${color}`, backgroundColor: 'var(--bg-secondary, #1a1a2e)',
});

/**
 * My Curated DLists (my-curated-dlists #1, ADR 0001): every DList the signed-in user's Treasure Map
 * empowers — whichever pubkey each entry names — one row per list (the first entry counts). Rows
 * naming the user's OWN assistant open the list's detail page; "mine" is `user.assistantPubkey`,
 * never the instance owner's (OPEN.md row 188). Read-only: nothing is signed, published, or imported.
 */
export default function MyCuratedDLists() {
  const { user, loading: authLoading } = useAuth();
  const assistantPubkey = user?.assistantPubkey || null;
  const map = useTreasureMap(user?.pubkey || null);
  const rows = useMemo(
    () => (map.status === 'found' ? curatedDListRows(map.event?.tags, assistantPubkey) : []),
    [map.status, map.event, assistantPubkey]
  );
  const { headers } = useCurationHeaders(rows);

  let body;
  if (authLoading) {
    body = <p style={muted}>⏳ Checking sign-in…</p>;
  } else if (!user) {
    body = <p className="subtitle">Sign in with a nostr extension (NIP-07) to see the DLists your Treasure Map empowers.</p>;
  } else if (map.status === 'idle' || map.status === 'loading') {
    body = <p style={muted}>⏳ Searching local strfry and general-purpose relays for your Treasure Map…</p>;
  } else if (map.status === 'error') {
    body = <div style={{ ...box('#f85149'), color: '#f85149' }}>Error: {map.error}</div>;
  } else if (map.status === 'none') {
    body = (
      <div style={box('#f59e0b')}>
        <div style={{ fontWeight: 600, color: '#f59e0b' }}>No Treasure Map found</div>
        <div style={{ ...muted, marginTop: '0.25rem' }}>
          Searched local strfry{map.relays.length > 0
            ? <> and {map.relays.length} general-purpose relay{map.relays.length === 1 ? '' : 's'}: <span style={mono}>{map.relays.join(', ')}</span></>
            : ' (no general-purpose relays are configured)'}.
        </div>
        <div style={{ marginTop: '0.5rem' }}><Link to={TREASURE_MAP_PATH} style={{ color: '#58a6ff' }}>Go to TA Treasure Map →</Link></div>
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <p style={{ fontSize: '0.95rem' }}>
        Your Treasure Map empowers no DLists yet. Empower your assistant to curate one from the
        DList Curation panel on <Link to={TREASURE_MAP_PATH} style={{ color: '#58a6ff' }}>TA Treasure Map</Link>.
      </p>
    );
  } else {
    body = (
      <>
        {!assistantPubkey && (
          <div style={box('#8b949e')}>You don&apos;t have a Tapestry Assistant on this instance, so none of these lists open here.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {rows.map((row) => (
            <CuratedDListRow key={row.routeId} row={row} lookup={headers[row.coord]} explainClosed={!!assistantPubkey} />
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🍇 My Curated DLists</h1>
      <p className="subtitle">The DLists your Treasure Map empowers a Tapestry Assistant to curate.</p>
      {body}
    </div>
  );
}

/** One empowered DList: name (a link only when my assistant curates it), address, who, hint, notes. */
function CuratedDListRow({ row, lookup, explainClosed }) {
  const name = lookup?.event?.tags?.find((t) => t[0] === 'names')?.[1] || null;
  const label = name || row.d;
  let note = null;
  if (!lookup) note = '⏳ checking…';
  else if (lookup.missing && lookup.failed) {
    note = `⚠️ Couldn't check the header — looked locally${lookup.checkedRelay ? ` and on ${lookup.checkedRelay}` : ''}`;
  } else if (lookup.missing) note = `⚠️ ${describeHeaderLookup({ relay: lookup.checkedRelay }, null, lookup.checkedRelay).text}`;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
      padding: '0.6rem 0.8rem', border: '1px solid var(--border, #444)', borderRadius: '6px',
      backgroundColor: 'var(--bg-secondary, #1a1a2e)',
    }}>
      {row.mine
        ? <Link to={curatedDListPath(row.routeId)} style={{ color: '#58a6ff', fontWeight: 600 }}>{label}</Link>
        : <span style={{ fontWeight: 600 }}>{label}</span>}
      <code style={{ fontSize: '0.8rem', opacity: 0.8 }}>{row.kind}:{row.d}</code>
      <span style={{
        fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px', whiteSpace: 'nowrap',
        backgroundColor: row.mine ? 'rgba(63, 185, 80, 0.15)' : 'rgba(139, 148, 158, 0.15)',
        color: row.mine ? '#3fb950' : '#8b949e',
      }}>
        {row.mine ? 'your assistant' : `another pubkey · ${short(row.pubkey)}`}
      </span>
      {row.relay && <span style={{ ...mono, opacity: 0.55, marginLeft: 'auto' }}>{row.relay}</span>}
      {(note || row.ignoredDuplicates > 0 || (!row.mine && explainClosed)) && (
        <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.8rem' }}>
          {note && <span style={{ color: lookup?.missing ? '#f59e0b' : undefined, opacity: lookup ? 1 : 0.6 }}>{note}</span>}
          {row.ignoredDuplicates > 0 && (
            <span style={{ opacity: 0.7 }}>
              {row.ignoredDuplicates === 1 ? 'A duplicate entry' : `${row.ignoredDuplicates} duplicate entries`} for this list ignored — the first entry counts.
            </span>
          )}
          {!row.mine && explainClosed && <span style={{ opacity: 0.6 }}>Only lists your own assistant curates open here.</span>}
        </div>
      )}
    </div>
  );
}
