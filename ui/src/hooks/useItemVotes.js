import { useState, useEffect } from 'react';
import { queryRelayBounded } from '../api/relay';
import { lookupItemVotes } from '../utils/treasureMap';

/**
 * One community-relay read through the server's external-relay endpoint (→ `{ success, events }`), in its strict
 * mode (curated-dlist-update ADR 0005 §2): an unreachable relay answers `success: false`, never "no votes".
 */
async function fetchRelay(filter, url) {
  const res = await fetch(`/api/relay/external?filter=${encodeURIComponent(JSON.stringify(filter))}&relays=${encodeURIComponent(url)}&strict=1`);
  return res.json();
}

/**
 * The votes on items — curated-dlist-update #4, ADR 0004 §2: the pure `lookupItemVotes` bound to this
 * instance's bounded strfry scan (so a capped read is reported) and the community relay, as `useListItems`
 * binds `lookupListItems`. Keyed on the ids and the relay, not the array's identity, and on `epoch`: each
 * bump re-reads (curated-dlist-update ADR 0006 §7). An answer is returned only for the key it was read for,
 * so new ids are never judged on votes read for others. Read-only.
 *
 * @param {string[]} ids  the items' event ids
 * @param {string} relay  the community relay
 * @param {number} [epoch]  bumped to read again
 * @returns {Object|null}  the lookup's answer for exactly these ids, or null while it is pending
 */
export default function useItemVotes(ids, relay, epoch = 0) {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  const key = `${list.join('|')}@${relay || ''}#${epoch}`;
  const [answer, setAnswer] = useState({ key: null, votes: null });

  useEffect(() => {
    let cancelled = false;
    lookupItemVotes(list, { scanLocal: queryRelayBounded, fetchRelay }, relay)
      .then((votes) => { if (!cancelled) setAnswer({ key, votes }); });
    return () => { cancelled = true; };
  }, [key]); // the ids and the relay are the identity (see above)

  return answer.key === key ? answer.votes : null;
}
