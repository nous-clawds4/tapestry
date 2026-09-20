import { useState, useEffect } from 'react';
import { queryRelayBounded } from '../api/relay';
import { lookupListItems } from '../utils/treasureMap';

/**
 * One community-relay read through the server's external-relay endpoint (→ `{ success, events }`), in its strict
 * mode (curated-dlist-update ADR 0005 §2): an unreachable relay answers `success: false`, never an empty list.
 */
async function fetchRelay(filter, url) {
  const res = await fetch(`/api/relay/external?filter=${encodeURIComponent(JSON.stringify(filter))}&relays=${encodeURIComponent(url)}&strict=1`);
  return res.json();
}

/**
 * The items of DList coordinates — my-curated-dlists #3, ADR 0003 note 2: the pure `lookupListItems`
 * bound to this instance's bounded strfry scan (so a capped read is reported) and the community
 * relay. Keyed on the coordinates and the relay, not the array's identity, and on `epoch`: each bump
 * re-reads (curated-dlist-update ADR 0006 §7). Until a key's read is in, `loading` is true and the lists
 * are the previous key's. Read-only.
 *
 * @param {string[]} coords
 * @param {string} relay  the community relay
 * @param {number} [epoch]  bumped to read again
 * @returns {{ lists: Object, loading: boolean }}  `lists[coord]` is undefined until read
 */
export default function useListItems(coords, relay, epoch = 0) {
  const list = Array.isArray(coords) ? coords.filter(Boolean) : [];
  const key = `${list.join('|')}@${relay || ''}#${epoch}`;
  const [state, setState] = useState({ lists: {}, loading: false, key: null });

  useEffect(() => {
    if (list.length === 0) { setState({ lists: {}, loading: false, key }); return undefined; }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    lookupListItems(list, { scanLocal: queryRelayBounded, fetchRelay }, relay)
      .then((lists) => { if (!cancelled) setState({ lists, loading: false, key }); });
    return () => { cancelled = true; };
  }, [key]); // the coordinates, the relay and the epoch are the identity (see above)

  return { lists: state.lists, loading: state.loading || state.key !== key };
}
