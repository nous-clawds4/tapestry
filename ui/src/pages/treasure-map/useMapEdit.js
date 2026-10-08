import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchProfilesChunked } from '../../utils/profileBatch';
import { buildRows } from '../assistants/myAssistants';
import {
  pickCategory, undoCategory, pickAll, undoAll, setOverride as overrideStep, setOverrideAll as overrideAllStep,
  setBackups as backupsStep,
} from './editTreasureMap';

/**
 * Edit mode's state on the Manage your Treasure Map page (treasure-map-edit #3, ADR treasure-map-edit/0003 sub-decision
 * 3): whether Edit is on, the pending changes, which list is open, and the person's Assistants for the lists.
 *
 * The Assistants are read the first time Edit turns on, as the My Assistants page reads them (book decision 1): its
 * session-shaped endpoint, then the profiles, then its row order (Local first, then by name). Turning Edit off drops the
 * pending changes and closes any list. A change of viewer resets everything, Assistants included, so one person's
 * choices never reach another person's Map. Nothing here signs, publishes or stores.
 *
 * Story 4's switches live in `pending` too (ADR treasure-map-edit/0004 sub-decision 3), so Edit off and a new viewer
 * reset them with everything else.
 */

const IDLE = { phase: 'idle', rows: [], profiles: {} };

export default function useMapEdit({ viewer }) {
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState({});
  const [openPicker, setOpenPicker] = useState(null); // 'all' | 'scores' | 'lists' | 'concepts' | null
  const [assistants, setAssistants] = useState(IDLE);
  const latest = useRef(0);

  /** Read the person's Assistants; a newer read or a new viewer makes an older answer stale. */
  const loadAssistants = useCallback(async () => {
    const mine = ++latest.current;
    setAssistants({ phase: 'loading', rows: [], profiles: {} });
    try {
      const res = await fetch('/api/assistant/my-assistants');
      const body = await res.json();
      if (!res.ok || !body || body.success !== true || body.signedIn !== true) throw new Error(`HTTP ${res.status}`);
      const rows = Array.isArray(body.rows) ? body.rows : [];
      const profiles = rows.length > 0 ? await fetchProfilesChunked(rows.map((row) => row.pubkey)) : {};
      if (mine === latest.current) setAssistants({ phase: 'ready', rows: buildRows({ rows, profiles }), profiles });
    } catch {
      if (mine === latest.current) setAssistants({ phase: 'error', rows: [], profiles: {} });
    }
  }, []);

  useEffect(() => {
    latest.current++;
    setEditing(false);
    setPending({});
    setOpenPicker(null);
    setAssistants(IDLE);
  }, [viewer]);

  const toggleEditing = useCallback(() => {
    setPending({});
    setOpenPicker(null);
    if (editing) { setEditing(false); return; }
    setEditing(true);
    if (assistants.phase === 'idle') loadAssistants();
  }, [editing, assistants.phase, loadAssistants]);

  const togglePicker = useCallback((which) => setOpenPicker((open) => (open === which ? null : which)), []);
  const closePicker = useCallback(() => setOpenPicker(null), []);

  const pick = useCallback((category, pubkey, current) => {
    setPending((p) => pickCategory(p, category, pubkey, current));
    setOpenPicker(null);
  }, []);
  const undo = useCallback((category) => setPending((p) => undoCategory(p, category)), []);
  const pickEveryone = useCallback((pubkey, current) => {
    setPending((p) => pickAll(p, pubkey, current));
    setOpenPicker(null);
  }, []);
  const undoEveryone = useCallback(() => setPending((p) => undoAll(p)), []);
  const setOverride = useCallback((category, on) => setPending((p) => overrideStep(p, category, on)), []);
  const setOverrideAll = useCallback((on) => setPending((p) => overrideAllStep(p, on)), []);
  const setBackups = useCallback((on) => setPending((p) => backupsStep(p, on)), []);

  return {
    editing, pending, openPicker, assistants,
    toggleEditing, togglePicker, closePicker, retryAssistants: loadAssistants, pick, undo, pickEveryone, undoEveryone,
    setOverride, setOverrideAll, setBackups,
  };
}
