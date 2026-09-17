import { useState, useEffect, useMemo, useCallback } from 'react';
import { queryRelay } from '../api/relay';
import { useCypher } from './useCypher';

const KIND_TREASURE_MAP = 10040;

// The same relay list the TA Treasure Map page reads (TrustedAssertions.jsx:25–29).
const GENERAL_PURPOSE_RELAYS = `
  MATCH (s {name: 'general purpose relays'})-[:IS_A_SUPERSET_OF*0..3]->(ss)-[:HAS_ELEMENT]->(e)
  OPTIONAL MATCH (e)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
  RETURN e.name AS name, jt.value AS json
`;

const IDLE = { status: 'idle', event: null, where: null, error: null, localMiss: false };
const LOADING = { status: 'loading', event: null, where: null, error: null, localMiss: false };

/**
 * The signed-in user's Treasure Map (kind 10040) — my-curated-dlists #1, ADR 0001 sub-decision 5.
 *
 * Deliberately the TA Treasure Map page's order and stop rule — local strfry first (`limit: 1`),
 * then the general-purpose relays, newest wins — so both pages show the same Map. Two differences:
 * the relay step WAITS for the relay list to settle (the page's own effect can run before it
 * arrives and skip the relays — OPEN.md row 260), and every failure is `error`, never `none`.
 * OPEN.md row 249's chore is to move the Treasure Map page onto this hook.
 *
 * @param {string|null} pubkey  the signed-in user's pubkey (null → idle)
 * @returns {{ status: 'idle'|'loading'|'found'|'none'|'error', event: Object|null,
 *             where: 'local'|'relay'|null, relays: string[], error: string|null, refresh: Function }}
 *   `relays` is the general-purpose list the relay step searches — what "where it looked" names.
 */
export default function useTreasureMap(pubkey) {
  const { data: relayData, loading: relaysLoading, error: relaysError } = useCypher(GENERAL_PURPOSE_RELAYS);
  const [state, setState] = useState(pubkey ? LOADING : IDLE);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const relays = useMemo(() => {
    const urls = [];
    for (const r of relayData || []) {
      if (!r.json) continue;
      try {
        const url = JSON.parse(r.json)?.nostrRelay?.websocketUrl;
        if (url && !urls.includes(url)) urls.push(url);
      } catch { /* an element without parseable JSON names no relay */ }
    }
    return urls;
  }, [relayData]);
  const relaysKey = relays.join(',');

  // Step 1 — local strfry.
  useEffect(() => {
    if (!pubkey) { setState(IDLE); return undefined; }
    let cancelled = false;
    setState(LOADING);
    queryRelay({ kinds: [KIND_TREASURE_MAP], authors: [pubkey], limit: 1 })
      .then((events) => {
        if (cancelled) return;
        if (Array.isArray(events) && events.length > 0) {
          setState({ status: 'found', event: events[0], where: 'local', error: null, localMiss: false });
        } else {
          setState({ ...LOADING, localMiss: true });
        }
      })
      .catch((err) => {
        if (!cancelled) setState({ ...LOADING, status: 'error', error: `Could not search local strfry: ${err?.message || err}` });
      });
    return () => { cancelled = true; };
  }, [pubkey, nonce]);

  // Step 2 — the general-purpose relays, only after a local miss AND once the relay list has settled.
  useEffect(() => {
    if (!state.localMiss || relaysLoading) return undefined;
    if (relaysError) {
      setState({ ...LOADING, status: 'error', error: `Not in local strfry, and the general-purpose relay list could not be read: ${relaysError.message || relaysError}` });
      return undefined;
    }
    if (relays.length === 0) { setState({ ...LOADING, status: 'none' }); return undefined; }
    let cancelled = false;
    const filter = JSON.stringify({ kinds: [KIND_TREASURE_MAP], authors: [pubkey], limit: 1 });
    fetch(`/api/relay/external?filter=${encodeURIComponent(filter)}&relays=${encodeURIComponent(relaysKey)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data || !data.success) {
          setState({ ...LOADING, status: 'error', error: `Not in local strfry, and the relay search failed: ${data?.error || 'no answer'}` });
          return;
        }
        const newest = (data.events || [])
          .filter((e) => e && e.kind === KIND_TREASURE_MAP && e.pubkey === pubkey)
          .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];
        setState(newest
          ? { status: 'found', event: newest, where: 'relay', error: null, localMiss: false }
          : { ...LOADING, status: 'none' });
      })
      .catch((err) => {
        if (!cancelled) setState({ ...LOADING, status: 'error', error: `Not in local strfry, and the relay search failed: ${err?.message || err}` });
      });
    return () => { cancelled = true; };
  }, [state.localMiss, relaysLoading, relaysError, relaysKey, pubkey]);

  return { status: state.status, event: state.event, where: state.where, relays, error: state.error, refresh };
}
