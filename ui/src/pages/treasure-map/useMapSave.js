import { useCallback, useEffect, useRef, useState } from 'react';
import { queryRelay } from '../../api/relay';
import { getActiveSignerOrThrow, assertSignerMatches, getSessionPubkey } from '../../utils/signerGuard';
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
 * the page shows in place of the read one (`shown`): the Map just signed after a save that reached somewhere, or a newer
 * Map the check found (book decision 19). A new viewer resets everything. A save runs one at a time, and an answer that
 * is no longer current (the person signed out or changed, or a newer save started) signs, publishes and changes nothing
 * (ADR 0005 Amendment 1).
 */

const IDLE = { busy: false, outcome: null, message: null, report: null, toast: false, shown: null, seq: 0 };
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
  const running = useRef(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    latest.current++;
    running.current = false;
    clearTimeout(toastTimer.current);
    setState(IDLE);
  }, [viewer]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const save = useCallback(async ({ base, draft }) => {
    // One save at a time, decided synchronously so two clicks in one go can't both start one.
    if (running.current) return { outcome: 'not-sent', reason: 'busy', current: false };
    running.current = true;
    const mine = ++latest.current;
    const isCurrent = () => mine === latest.current && getSessionPubkey() === viewer;
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
        isCurrent,
      },
    });
    const current = mine === latest.current && answer.reason !== 'stale';
    if (mine === latest.current) running.current = false;
    if (!current) {
      // The person signed out or changed mid-save: nothing to show, but the save is over.
      if (mine === latest.current) setState((s) => ({ ...s, busy: false }));
      return { ...answer, current: false };
    }
    const reached = answer.outcome === 'saved' || answer.outcome === 'partial';
    setState((s) => ({
      busy: false,
      outcome: answer.outcome,
      message: answer.message || null,
      report: answer.report || null,
      toast: answer.outcome === 'saved',
      shown: reached ? answer.signed : answer.reason === 'changed' ? answer.latest : s.shown,
      seq: s.seq + 1,
    }));
    if (answer.outcome === 'saved') {
      toastTimer.current = setTimeout(() => setState((s) => ({ ...s, toast: false })), TOAST_MS);
    }
    return { ...answer, current: true };
  }, [viewer, relays]);

  /** Clear the outcome and the report (Edit turned on again); the Map just signed stays shown. */
  const clear = useCallback(() => setState((s) => ({ ...s, outcome: null, message: null, report: null })), []);

  return { ...state, save, clear };
}
