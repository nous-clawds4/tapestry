import { useState, useEffect, useCallback } from 'react';
import { CUTOFF_DEFAULT, cutoffStorageKey, readStoredCutoff } from '../utils/treasureMap';

/** This browser's cutoff for a list, or the default — also when storage is unavailable. */
function load(listCoord) {
  if (!listCoord) return CUTOFF_DEFAULT;
  try { return readStoredCutoff(localStorage.getItem(cutoffStorageKey(listCoord))); } catch { return CUTOFF_DEFAULT; }
}

/**
 * The curation cutoff for one of my curated lists — curated-dlist-update #4, ADR 0004 §5: remembered per
 * list in this browser (Planning-gate decision 1), default 2, never written onto the list. With no
 * coordinate (a list that isn't mine) it keeps the default and never touches storage. Storage
 * unavailable → the default, unsaved.
 *
 * @param {string|null} listCoord  my curated header's coordinate
 * @returns {[number, Function]}  the cutoff, and a setter that remembers it
 */
export default function useCurationCutoff(listCoord) {
  const [cutoff, setCutoffState] = useState(() => load(listCoord));
  useEffect(() => { setCutoffState(load(listCoord)); }, [listCoord]);
  const setCutoff = useCallback((value) => {
    setCutoffState(value);
    if (!listCoord) return;
    try { localStorage.setItem(cutoffStorageKey(listCoord), String(value)); } catch { /* storage unavailable: unsaved */ }
  }, [listCoord]);
  return [cutoff, setCutoff];
}
