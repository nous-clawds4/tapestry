import { useState, useEffect } from 'react';
import { queryRelay } from '../api/relay';
import { lookupCurationHeaders } from '../utils/treasureMap';

/** One relay-hint fetch through the server's external-relay endpoint (→ `{ success, events }`). */
async function fetchRelay(filter, url) {
  const res = await fetch(`/api/relay/external?filter=${encodeURIComponent(JSON.stringify(filter))}&relays=${encodeURIComponent(url)}`);
  return res.json();
}

/**
 * The assistant headers behind curated-DList rows — my-curated-dlists #1, ADR 0001 note 3: the
 * pure `lookupCurationHeaders` bound to local strfry and the row's relay hint. Keyed on the rows'
 * coordinates and hints, not on the array's identity, so a re-render does not re-fetch.
 *
 * @param {Array<{coord:string, kind:number, pubkey:string, d:string, relay:string|null}>} rows
 * @returns {{ headers: Object, loading: boolean }}  `headers[coord]` is undefined until checked
 */
export default function useCurationHeaders(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const key = list.map((r) => `${r.coord}@${r.relay || ''}`).join('|');
  const [state, setState] = useState({ headers: {}, loading: false });

  useEffect(() => {
    if (list.length === 0) { setState({ headers: {}, loading: false }); return undefined; }
    let cancelled = false;
    setState((s) => ({ headers: s.headers, loading: true }));
    lookupCurationHeaders(list, { scanLocal: queryRelay, fetchRelay })
      .then((headers) => { if (!cancelled) setState({ headers, loading: false }); });
    return () => { cancelled = true; };
  }, [key]); // the coordinates and hints are the identity (see above)

  return state;
}
