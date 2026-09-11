import { useState, useEffect } from 'react';
import { queryRelayBounded } from '../api/relay';
import { lookupListItems } from '../utils/treasureMap';

/** One community-relay read through the server's external-relay endpoint (→ `{ success, events }`). */
async function fetchRelay(filter, url) {
  const res = await fetch(`/api/relay/external?filter=${encodeURIComponent(JSON.stringify(filter))}&relays=${encodeURIComponent(url)}`);
  return res.json();
}

/**
 * The items of DList coordinates — my-curated-dlists #3, ADR 0003 note 2: the pure `lookupListItems`
 * bound to this instance's bounded strfry scan (so a capped read is reported) and the community
 * relay. Keyed on the coordinates and the relay, not the array's identity. Read-only.
 *
 * @param {string[]} coords
 * @param {string} relay  the community relay
 * @returns {{ lists: Object, loading: boolean }}  `lists[coord]` is undefined until read
 */
export default function useListItems(coords, relay) {
  const list = Array.isArray(coords) ? coords.filter(Boolean) : [];
  const key = `${list.join('|')}@${relay || ''}`;
  const [state, setState] = useState({ lists: {}, loading: false });

  useEffect(() => {
    if (list.length === 0) { setState({ lists: {}, loading: false }); return undefined; }
    let cancelled = false;
    setState((s) => ({ lists: s.lists, loading: true }));
    lookupListItems(list, { scanLocal: queryRelayBounded, fetchRelay }, relay)
      .then((lists) => { if (!cancelled) setState({ lists, loading: false }); });
    return () => { cancelled = true; };
  }, [key]); // the coordinates and the relay are the identity (see above)

  return state;
}
