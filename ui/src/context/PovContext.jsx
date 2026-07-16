import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { resolvePovReadParams } from '../utils/povReadParams';

/**
 * Single source of the selected POV (pov-selectable-tag-surfaces, ADR 0001).
 *
 * Search used to own the `pov` value (house/named/own) inside BrainstormSearch's
 * component state, unreachable from the tag routes. This context lifts that value
 * (and its persistence) to the app root so search AND every tag surface share one
 * selection resolved by one rule (`resolvePovReadParams`).
 *
 * The load/persist logic is lifted verbatim from BrainstormSearch's UserMenu:
 * same `bs_pov_<pubkey>` localStorage fast-path, same GET/PUT `/api/user-prefs`
 * (`preferences.pov`, only 'user'|'nosfabrica'), same 'nosfabrica' default — so
 * search behaviour is byte-preserved. (The delegate `rankAuthor`/`rankRelay`
 * persistence stays in UserMenu, which owns that WoT-pipeline state.)
 */
const PovContext = createContext(null);

const POV_STORAGE_PREFIX = 'bs_pov_';

export function usePov() {
  return useContext(PovContext);
}

export function PovProvider({ children }) {
  const { user } = useAuth();
  const [selectedPov, setSelectedPov] = useState('nosfabrica');
  // Hydration guard: the persist effect must NOT write until the saved value has
  // been loaded — otherwise, on mount, it PUTs the default 'nosfabrica' over a
  // saved pov:'user' before the load resolves (the Story-4 mount clobber). Only
  // user-initiated changes (after hydration) persist.
  const hydratedRef = useRef(false);

  // Restore selection: localStorage fast-path, then server (source of truth).
  useEffect(() => {
    if (!user) return;
    hydratedRef.current = false; // re-hydrate on account switch
    const cached = localStorage.getItem(POV_STORAGE_PREFIX + user.pubkey);
    setSelectedPov(cached === 'user' || cached === 'nosfabrica' ? cached : 'nosfabrica');
    (async () => {
      try {
        const resp = await fetch('/api/user-prefs');
        const data = await resp.json();
        if (data.success && data.preferences) {
          const p = data.preferences;
          if (p.pov === 'user' || p.pov === 'nosfabrica') setSelectedPov(p.pov);
        }
      } catch {}
      finally {
        // Hydration complete — from here on, real selection changes persist.
        hydratedRef.current = true;
      }
    })();
  }, [user?.pubkey]);

  // Persist selection to both localStorage and server (merge-safe: PUT { pov }
  // preserves rankAuthor/filters/sortConfig written by other paths). Guarded by
  // hydration so the default is never written over a saved value on mount.
  useEffect(() => {
    if (!user || !selectedPov || !hydratedRef.current) return;
    localStorage.setItem(POV_STORAGE_PREFIX + user.pubkey, selectedPov);
    fetch('/api/user-prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pov: selectedPov }),
    }).catch(() => {});
  }, [user?.pubkey, selectedPov]);

  const povParams = resolvePovReadParams({ pov: selectedPov, userPubkey: user?.pubkey });

  return (
    <PovContext.Provider value={{ selectedPov, setSelectedPov, povParams }}>
      {children}
    </PovContext.Provider>
  );
}

export default PovProvider;
