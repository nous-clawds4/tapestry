import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Breadcrumbs from '../../components/Breadcrumbs';
import useTreasureMap from '../../hooks/useTreasureMap';
import useCurationHeaders from '../../hooks/useCurationHeaders';
import useCurationCutoff from '../../hooks/useCurationCutoff';
import { COMMUNITY_RELAYS } from '../../hooks/useCommunitySharedConcepts';
import { curatedDListAccess, describeCurationHeader, curationPointerRow, sharedListUnavailable, curateHereOffer } from '../../utils/treasureMap';
import { AssistantHeaderSection, SharedHeaderSection } from './CuratedDListHeaders';
import { CurationMethodPanel, ItemsSection } from './CuratedDListItems';
import CurateHereOffer from './CurateHereOffer';

const LIST_PATH = '/tapestry/grapevine/curated-dlists';
// The shared header is looked up where the DList Curation panel searches (ADR 0002 sub-decision 4).
const COMMUNITY_RELAY = COMMUNITY_RELAYS[0];
// A read-only list's items are read at its Map entry's relay hint when that is a relay URL
// (curated-dlist-update ADR 0003 §4 — element 3 is where the header and its items can be fetched).
const WS_RELAY = /^wss?:\/\//i;
const short = (pk) => `${pk.slice(0, 8)}…${pk.slice(-4)}`;

// One sentence per front-door case (ADR 0001 sub-decision 4, as curated-dlist-update ADR 0003 §1 left
// it); none of them shows list content. A list on the viewer's Map always opens — as theirs, or read-only.
const SENTENCES = {
  'signed-out': () => 'Sign in with a nostr extension (NIP-07) to open your curated DLists.',
  'bad-id': ({ id }) => `“${id || ''}” is not a curated-DList address.`,
  'checking': () => '⏳ Checking your Treasure Map…',
  'map-error': ({ map }) => `Your Treasure Map could not be read: ${map.error}`,
  'no-map': ({ map }) => `No Treasure Map found — searched local strfry${map.relays.length > 0 ? ` and ${map.relays.join(', ')}` : ''}.`,
  'not-on-map': ({ id }) => `${id} is not on your Treasure Map.`,
};

/**
 * A curated DList's detail page (my-curated-dlists #1, ADR 0001; the two headers #2, ADR 0002). The
 * route id is the Map entry's own `<kind>:<d>`, resolved against the VIEWER's Map: a list on it opens as
 * theirs when it names their own assistant, and read-only otherwise — seen through the curating
 * assistant's pubkey, with an offer to curate it here instead (curated-dlist-update ADR 0003). Any other
 * case says which applies. This file writes nothing — the import lives in CuratedDListHeaders.jsx (ADR
 * 0002 fact 6), the offer's two writes in CurateHereOffer.jsx.
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
  const open = access.status === 'ok' || access.status === 'read-only';
  const readOnly = access.status === 'read-only';
  // Everything below is seen through the curator's pubkey: the viewer's assistant for their own list,
  // the assistant the Map names for a read-only one (curated-dlist-update ADR 0003 §3).
  const curatorPubkey = open ? access.row.pubkey : null;
  // Both lookups run on every render, ahead of the early exit below — the rules of hooks: the curating
  // assistant's header, then the shared header its pointer names, through one primitive (ADR 0002).
  const mine = useCurationHeaders(open ? [access.row] : []);
  const lookup = open ? mine.headers[access.row.coord] : undefined;
  const info = lookup?.event ? describeCurationHeader(lookup.event, curatorPubkey) : null;
  const sharedRow = curationPointerRow(info?.pointer, COMMUNITY_RELAY);
  const shared = useCurationHeaders(sharedRow ? [sharedRow] : []);
  // My own list's cutoff, remembered in this browser, and the verdicts' summary the items section reports up
  // to the method panel (curated-dlist-update ADR 0004 §6) — hooks too, so they run before the exit as well.
  const [cutoff, setCutoff] = useCurationCutoff(open && !readOnly ? access.row.coord : null);
  const [verdictSummary, setVerdictSummary] = useState(null);
  const backLink = <p style={{ margin: '0 0 0.75rem' }}><Link to={LIST_PATH} style={{ color: '#58a6ff' }}>← My Curated DLists</Link></p>;

  if (!open) {
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
  const curator = readOnly ? 'other' : 'mine';
  const name = lookup?.event?.tags?.find((t) => t[0] === 'names')?.[1] || null;
  const offer = readOnly ? curateHereOffer({ assistantPubkey, row, assistantLookup: lookup, info }) : null;
  const listRelay = readOnly && typeof row.relay === 'string' && WS_RELAY.test(row.relay) ? row.relay : COMMUNITY_RELAY;

  return (
    <div className="page">
      <Breadcrumbs />
      {backLink}
      <h1>{name || row.d}</h1>
      <p className="subtitle">
        <code>{row.kind}:{row.d}</code> · {readOnly ? 'curated by another assistant' : 'curated by your assistant'} · <code>{short(curatorPubkey)}</code>
      </p>
      {readOnly && (
        <p style={{ fontSize: '0.9rem', margin: '0 0 0.5rem' }}>
          {assistantPubkey
            ? 'Read-only here: your Treasure Map names this assistant for the list, not your assistant on this instance.'
            : "Read-only here: your Treasure Map names this assistant for the list, and you don't have a Tapestry Assistant on this instance."}
        </p>
      )}
      {readOnly && (
        <CurateHereOffer row={row} assistantPubkey={assistantPubkey} offer={offer} mapEvent={map.event} onPublished={map.refresh} />
      )}
      <AssistantHeaderSection row={row} lookup={lookup} info={info} onImported={mine.refresh} checking={mine.loading} curator={curator} />
      <SharedHeaderSection
        info={info}
        lookup={sharedRow ? shared.headers[sharedRow.coord] : undefined}
        assistantLookup={lookup}
        communityRelay={COMMUNITY_RELAY}
        onImported={shared.refresh}
        checking={shared.loading}
        curator={curator}
      />
      {/* Story 3 (ADR 0003 sub-decision 10): the curation method, then the items with Update list. On another
          assistant's list the method is set where that assistant lives (curated-dlist-update ADR 0003 §3). */}
      {readOnly
        ? <p style={{ fontSize: '0.85rem', opacity: 0.75, marginTop: '1rem' }}>The curation method is set where this list&apos;s assistant lives.</p>
        : <CurationMethodPanel cutoff={cutoff} onCutoffChange={setCutoff} summary={verdictSummary} />}
      <ItemsSection
        myCoord={row.coord}
        sharedCoord={info?.pointer?.coord || null}
        sharedUnavailable={sharedListUnavailable(lookup, info)}
        assistantPubkey={row.pubkey}
        communityRelay={COMMUNITY_RELAY}
        curator={curator}
        listRelay={listRelay}
        canCurateHere={offer?.status === 'available'}
        cutoff={cutoff}
        onVerdictSummary={setVerdictSummary}
      />
    </div>
  );
}
