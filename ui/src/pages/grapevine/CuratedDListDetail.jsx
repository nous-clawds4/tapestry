import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import useTreasureMap from '../../hooks/useTreasureMap';
import useCurationHeaders from '../../hooks/useCurationHeaders';
import { COMMUNITY_RELAYS } from '../../hooks/useCommunitySharedConcepts';
import { curatedDListAccess, describeCurationHeader, curationPointerRow, sharedListUnavailable } from '../../utils/treasureMap';
import { AssistantHeaderSection, SharedHeaderSection } from './CuratedDListHeaders';
import { CurationMethodPanel, ItemsSection } from './CuratedDListItems';

const LIST_PATH = '/tapestry/grapevine/curated-dlists';
// The shared header is looked up where the DList Curation panel searches (ADR 0002 sub-decision 4).
const COMMUNITY_RELAY = COMMUNITY_RELAYS[0];
const short = (pk) => `${pk.slice(0, 8)}…${pk.slice(-4)}`;

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
 * A curated DList's detail page (my-curated-dlists #1, ADR 0001; the two headers #2, ADR 0002). The
 * route id is the Map entry's own `<kind>:<d>`, resolved against the VIEWER's Map: the page opens only
 * a list the viewer's own assistant curates, and otherwise says which case applies. This file writes
 * nothing — the one import lives in CuratedDListHeaders.jsx (ADR 0002 fact 6).
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
  // Both lookups run on every render, ahead of the early exit below — the rules of hooks: the
  // assistant's header, then the shared header its pointer names, through one primitive (ADR 0002).
  const mine = useCurationHeaders(access.status === 'ok' ? [access.row] : []);
  const lookup = access.status === 'ok' ? mine.headers[access.row.coord] : undefined;
  const info = lookup?.event ? describeCurationHeader(lookup.event, assistantPubkey) : null;
  const sharedRow = curationPointerRow(info?.pointer, COMMUNITY_RELAY);
  const shared = useCurationHeaders(sharedRow ? [sharedRow] : []);
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
  const name = lookup?.event?.tags?.find((t) => t[0] === 'names')?.[1] || null;

  return (
    <div className="page">
      <Breadcrumbs />
      {backLink}
      <h1>{name || row.d}</h1>
      <p className="subtitle">
        <code>{row.kind}:{row.d}</code> · curated by your assistant · <code>{short(assistantPubkey)}</code>
      </p>
      <AssistantHeaderSection row={row} lookup={lookup} info={info} onImported={mine.refresh} checking={mine.loading} />
      <SharedHeaderSection
        info={info}
        lookup={sharedRow ? shared.headers[sharedRow.coord] : undefined}
        assistantLookup={lookup}
        communityRelay={COMMUNITY_RELAY}
        onImported={shared.refresh}
        checking={shared.loading}
      />
      {/* Story 3 (ADR 0003 sub-decision 10): the curation method, then the items with Update list. */}
      <CurationMethodPanel />
      <ItemsSection
        myCoord={row.coord}
        sharedCoord={info?.pointer?.coord || null}
        sharedUnavailable={sharedListUnavailable(lookup, info)}
        assistantPubkey={assistantPubkey}
        communityRelay={COMMUNITY_RELAY}
      />
    </div>
  );
}
