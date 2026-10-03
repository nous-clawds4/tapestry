import { useEffect, useState } from 'react';
import { COMMUNITY_RELAYS } from '../../hooks/useCommunitySharedConcepts';

/**
 * The reads Create New Concept (wired), Edit and Re-Sync share: this instance's relay, the community
 * relay read strictly, the shared concept's newest header from both, and whether a header is one a
 * firmware reinstall rebuilds. No component here imports a page, so a page can import it without a cycle
 * (ConceptEntry re-exports `scan` for the pages that took it from there).
 */

/** This instance's relay: the events matching a filter. Throws when the read fails. */
export async function scan(filter) {
  const resp = await fetch(`/api/strfry/scan?filter=${encodeURIComponent(JSON.stringify(filter))}`);
  const json = await resp.json();
  if (!resp.ok || json.success === false) throw new Error(json.error || `HTTP ${resp.status}`);
  return json.events || json.data || [];
}

/**
 * The community relay, read strictly (`strict=1`): a relay that couldn't be read is an error, never an
 * empty answer, so a page can't mistake "unreachable" for "not there" (the lenient read answers
 * `{success: true, events: []}` for both).
 */
export async function readCommunityStrict(filter) {
  const params = new URLSearchParams({ filter: JSON.stringify(filter), relays: COMMUNITY_RELAYS.join(','), strict: '1' });
  const resp = await fetch(`/api/relay/external?${params}`);
  const data = await resp.json();
  if (!data || data.success !== true) throw new Error((data && data.error) || `HTTP ${resp.status}`);
  return Array.isArray(data.events) ? data.events : [];
}

/**
 * A shared concept's header at `target`: the newest of this instance's relay and the community relay.
 * { event, done, unreadable, reload }: `unreadable` when neither relay has it and the community relay
 * couldn't be read, so whether it has a header there isn't known.
 */
export function useSharedHeader(target) {
  const [state, setState] = useState({ event: null, done: !target, unreadable: false });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!target) { setState({ event: null, done: true, unreadable: false }); return undefined; }
    let cancelled = false;
    setState({ event: null, done: false, unreadable: false });
    const [, pubkey, ...rest] = target.split(':');
    const d = rest.join(':');
    const filter = { kinds: [39998], authors: [pubkey], '#d': [d] };
    const own = (ev) => ev && ev.kind === 39998 && ev.pubkey === pubkey && (ev.tags || []).find((t) => t[0] === 'd')?.[1] === d;
    (async () => {
      const reads = await Promise.allSettled([scan(filter), readCommunityStrict(filter)]);
      const events = reads.flatMap((r) => (r.status === 'fulfilled' && Array.isArray(r.value) ? r.value : [])).filter(own);
      const newest = events.reduce((a, b) => (!a || (b.created_at || 0) > (a.created_at || 0) ? b : a), null);
      if (!cancelled) setState({ event: newest, done: true, unreadable: !newest && reads[1].status === 'rejected' });
    })();
    return () => { cancelled = true; };
  }, [target, version]);
  return { ...state, reload: () => setVersion((v) => v + 1) };
}

/** Is this header one a firmware reinstall rebuilds? Decided by the server from the address. null until known. */
export function useFirmware(coord) {
  const [firmware, setFirmware] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setFirmware(null);
    if (!coord) return undefined;
    fetch(`/api/dictionaries/concepts/firmware?coord=${encodeURIComponent(coord)}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setFirmware(Boolean(data && data.success && data.firmware)); })
      .catch(() => { if (!cancelled) setFirmware(null); });
    return () => { cancelled = true; };
  }, [coord]);
  return firmware;
}
