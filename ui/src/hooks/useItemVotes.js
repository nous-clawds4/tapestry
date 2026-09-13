import { useState, useEffect } from 'react';
import { queryRelayBounded } from '../api/relay';
import { lookupItemVotes } from '../utils/treasureMap';

/** One community-relay read through the server's external-relay endpoint (→ `{ success, events }`). */
async function fetchRelay(filter, url) {
  const res = await fetch(`/api/relay/external?filter=${encodeURIComponent(JSON.stringify(filter))}&relays=${encodeURIComponent(url)}`);
  return res.json();
}

/**
 * The votes on items — curated-dlist-update #4, ADR 0004 §2: the pure `lookupItemVotes` bound to this
 * instance's bounded strfry scan (so a capped read is reported) and the community relay, as `useListItems`
 * binds `lookupListItems`. Keyed on the ids and the relay, not the array's identity. An answer is returned
 * only for the ids it was read for, so new ids are never judged on votes read for others. Read-only.
 *
 * @param {string[]} ids  the items' event ids
 * @param {string} relay  the community relay
 * @returns {Object|null}  the lookup's answer for exactly these ids, or null while it is pending
 */
export default function useItemVotes(ids, relay) {
  const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
  const key = `${list.join('|')}@${relay || ''}`;
  const [answer, setAnswer] = useState({ key: null, votes: null });

  useEffect(() => {
    let cancelled = false;
    lookupItemVotes(list, { scanLocal: queryRelayBounded, fetchRelay }, relay)
      .then((votes) => { if (!cancelled) setAnswer({ key, votes }); });
    return () => { cancelled = true; };
  }, [key]); // the ids and the relay are the identity (see above)

  return answer.key === key ? answer.votes : null;
}
