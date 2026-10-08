import { useCallback, useEffect, useRef, useState } from 'react';
import { queryRelay } from '../../api/relay';
import { getActiveSignerOrThrow, assertSignerMatches } from '../../utils/signerGuard';
import { publishEverywhere, PUBLISH_RELAYS } from '../../utils/nostrPublish';
import { saveTreasureMap } from './saveTreasureMap';

/**
 * Save's state on the Manage your Treasure Map page (treasure-map-edit #5, ADR treasure-map-edit/0005 sub-decision 3).
 * The only module of the page that signs or publishes: it hands saveTreasureMap the real effects.
 *
 * - readLatest: the newest Map of local strfry and the general-purpose relays the page reads (non-strict; a source
 *   that fails is skipped), for the newer-Map check (book decision 17).
 * - activeSigner: the app's signer check (issue #335); sign: window.nostr.signEvent, then the signed event's own
 *   pubkey checked too; publish: publishEverywhere to this instance's relay and PUBLISH_RELAYS, under the instance's
 *   publish policy.
 *
 * It holds whether a save is running, its outcome (message or report), the brief "Treasure Map updated", and the Map
 * just signed, which the page shows after a save that reached somewhere. A new viewer resets everything, and an older
 * save's answer never lands on a newer one.
 */

const IDLE = { busy: false, outcome: null, message: null, report: null, toast: false, saved: null, seq: 0 };
const TOAST_MS = 4000;
const KIND_TREASURE_MAP = 10040;

/** The newest Map either source holds for the viewer, or null. */
async function readLatestMap(viewer, relays) {
  const filter = { kinds: [KIND_TREASURE_MAP], authors: [viewer], limit: 1 };
  const local = queryRelay(filter).catch(() => []);
  const remote = Array.isArray(relays) && relays.length > 0
    ? fetch(`/api/relay/external?filter=${encodeURIComponent(JSON.stringify(filter))}&relays=${encodeURIComponent(relays.join(','))}`)
      .then((res) => res.json())
      .then((data) => (data && data.success ? data.events || [] : []))
      .catch(() => [])
    : Promise.resolve([]);
  const found = [...(await local), ...(await remote)]
    .filter((e) => e && e.kind === KIND_TREASURE_MAP && e.pubkey === viewer)
    .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  return found[0] || null;
}

export default function useMapSave({ viewer, relays }) {
  const [state, setState] = useState(IDLE);
  const latest = useRef(0);
  const toastTimer = useRef(null);

  useEffect(() => {
    latest.current++;
    clearTimeout(toastTimer.current);
    setState(IDLE);
  }, [viewer]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const save = useCallback(async ({ base, draft }) => {
    const mine = ++latest.current;
    clearTimeout(toastTimer.current);
    setState((s) => ({ ...s, busy: true, outcome: null, message: null, report: null, toast: false }));
    const answer = await saveTreasureMap({
      viewer,
      base,
      draft,
      relays: PUBLISH_RELAYS,
      deps: {
        readLatest: () => readLatestMap(viewer, relays),
        activeSigner: (expected) => getActiveSignerOrThrow(expected),
        sign: async (unsigned) => {
          const signed = await window.nostr.signEvent(unsigned);
          assertSignerMatches(signed && signed.pubkey, viewer);
          return signed;
        },
        publish: (signed) => publishEverywhere(signed),
        now: () => Math.floor(Date.now() / 1000),
      },
    });
    if (mine !== latest.current) return answer;
    const reached = answer.outcome === 'saved' || answer.outcome === 'partial';
    setState((s) => ({
      busy: false,
      outcome: answer.outcome,
      message: answer.message || null,
      report: answer.report || null,
      toast: answer.outcome === 'saved',
      saved: reached ? answer.signed : s.saved,
      seq: s.seq + 1,
    }));
    if (answer.outcome === 'saved') {
      toastTimer.current = setTimeout(() => setState((s) => ({ ...s, toast: false })), TOAST_MS);
    }
    return answer;
  }, [viewer, relays]);

  /** Clear the outcome and the report (Edit turned on again); the Map just signed stays shown. */
  const clear = useCallback(() => setState((s) => ({ ...s, outcome: null, message: null, report: null })), []);

  return { ...state, save, clear };
}
