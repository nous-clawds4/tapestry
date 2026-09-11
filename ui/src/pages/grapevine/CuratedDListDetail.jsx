import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import useTreasureMap from '../../hooks/useTreasureMap';
import useCurationHeaders from '../../hooks/useCurationHeaders';
import { curatedDListAccess, describeHeaderLookup } from '../../utils/treasureMap';

const LIST_PATH = '/tapestry/grapevine/curated-dlists';
const short = (pk) => `${pk.slice(0, 8)}…${pk.slice(-4)}`;
const muted = { fontSize: '0.85rem', opacity: 0.6 };

// One sentence per front-door case (ADR 0001 sub-decision 4); none of them shows list content.
const SENTENCES = {
  'signed-out': () => 'Sign in with a nostr extension (NIP-07) to open your curated DLists.',
  'no-assistant': () => "You don't have a Tapestry Assistant on this instance, so no curated DList opens here.",
  'bad-id': ({ id }) => `“${id || ''}” is not a curated-DList address.`,
  'checking': () => '⏳ Checking your Treasure Map…',
  'map-error': ({ map }) => `Your Treasure Map could not be read: ${map.error}`,
  'no-map': ({ map }) => `No Treasure Map found — searched local strfry${map.relays.length > 0 ? ` and ${map.relays.join(', ')}` : ''}.`,
  'not-on-map': ({ id }) => `${id} is not on your Treasure Map.`,
  'other-pubkey': ({ id, row }) => `${id} is empowered for another pubkey · ${short(row.pubkey)} — only lists your own assistant curates open here.`,
};

/**
 * A curated DList's detail page — the front door (my-curated-dlists #1, ADR 0001). The route id is
 * the Map entry's own `<kind>:<d>`, resolved against the VIEWER's Map: the page opens only a list
 * the viewer's own assistant curates, and otherwise says which case applies. Stories 2–3 add the
 * headers, the items, and the curation controls below the heading.
 */
export default function CuratedDListDetail() {
  // React Router 7 hands the param over already decoded (ADR 0001 fact 6) — it is not decoded again.
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const assistantPubkey = user?.assistantPubkey || null;
  const map = useTreasureMap(user?.pubkey || null);
  const access = curatedDListAccess({
    signedIn: !!user, authLoading, assistantPubkey, mapStatus: map.status, tags: map.event?.tags, id,
  });
  const { headers } = useCurationHeaders(access.status === 'ok' ? [access.row] : []);
  const backLink = <p style={{ margin: '0 0 0.75rem' }}><Link to={LIST_PATH} style={{ color: '#58a6ff' }}>← My Curated DLists</Link></p>;

  if (access.status !== 'ok') {
    const sentence = (SENTENCES[access.status] || SENTENCES.checking)({ id, map, row: access.row });
    return (
      <div className="page">
        <Breadcrumbs />
        {backLink}
        <p style={{ fontSize: '0.95rem' }}>{sentence}</p>
      </div>
    );
  }

  const row = access.row;
  const lookup = headers[row.coord];
  const name = lookup?.event?.tags?.find((t) => t[0] === 'names')?.[1] || null;
  let headerLine;
  if (!lookup) headerLine = <span style={muted}>⏳ checking the header…</span>;
  else if (lookup.event) headerLine = <span style={muted}>Header found {lookup.where === 'relay' ? `on ${lookup.checkedRelay}` : 'locally'}.</span>;
  else if (lookup.failed) {
    headerLine = <span style={{ color: '#f59e0b' }}>⚠️ Couldn&apos;t check the header — looked locally{lookup.checkedRelay ? ` and on ${lookup.checkedRelay}` : ''}.</span>;
  } else headerLine = <span style={{ color: '#f59e0b' }}>⚠️ {describeHeaderLookup({ relay: lookup.checkedRelay }, null, lookup.checkedRelay).text}.</span>;

  return (
    <div className="page">
      <Breadcrumbs />
      {backLink}
      <h1>{name || row.d}</h1>
      <p className="subtitle">
        <code>{row.kind}:{row.d}</code> · curated by your assistant · <code>{short(assistantPubkey)}</code>
      </p>
      <p style={{ fontSize: '0.85rem' }}>{headerLine}</p>
      {/* ── Stories 2–3 insert here: the assistant's header and the shared header (story 2); the
          items table, the curation-method panel, and Update list (story 3). ── */}
    </div>
  );
}
