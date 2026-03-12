import { createContext, useContext, useState, useCallback } from 'react';
import { OWNER_PUBKEY } from '../config/pubkeys';

const STORAGE_KEY = 'tapestry_trust_method';

const SCORING_METHODS = [
  { id: 'trusted-assertions-rank', label: 'Trusted Assertions (rank)' },
  { id: 'follow-list', label: 'Follow List' },
  { id: 'trusted-list', label: 'Trusted List' },
  { id: 'trust-everyone', label: 'Trust Everyone' },
];

const DEFAULT_STATE = {
  povPubkey: OWNER_PUBKEY,
  scoringMethod: 'trusted-assertions-rank',
  trustedListId: '',  // d-tag identifier for selected kind 30392 Trusted List
};

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        povPubkey: parsed.povPubkey || DEFAULT_STATE.povPubkey,
        scoringMethod: SCORING_METHODS.some(m => m.id === parsed.scoringMethod)
          ? parsed.scoringMethod
          : DEFAULT_STATE.scoringMethod,
        trustedListId: parsed.trustedListId || DEFAULT_STATE.trustedListId,
      };
    }
  } catch {}
  return { ...DEFAULT_STATE };
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const TrustContext = createContext(null);

export function useTrust() {
  const ctx = useContext(TrustContext);
  if (!ctx) throw new Error('useTrust must be used within TrustProvider');
  return ctx;
}

export { SCORING_METHODS };

export function TrustProvider({ children }) {
  const [state, setState] = useState(loadState);

  const setPovPubkey = useCallback((pubkey) => {
    setState(prev => {
      const next = { ...prev, povPubkey: pubkey };
      saveState(next);
      return next;
    });
  }, []);

  const setScoringMethod = useCallback((method) => {
    setState(prev => {
      const next = { ...prev, scoringMethod: method };
      saveState(next);
      return next;
    });
  }, []);

  const setTrustedListId = useCallback((id) => {
    setState(prev => {
      const next = { ...prev, trustedListId: id };
      saveState(next);
      return next;
    });
  }, []);

  const resetToOwner = useCallback(() => {
    setState(prev => {
      const next = { ...prev, povPubkey: OWNER_PUBKEY };
      saveState(next);
      return next;
    });
  }, []);

  const isOwnerPov = state.povPubkey === OWNER_PUBKEY;

  const value = {
    povPubkey: state.povPubkey,
    scoringMethod: state.scoringMethod,
    trustedListId: state.trustedListId,
    setPovPubkey,
    setScoringMethod,
    setTrustedListId,
    resetToOwner,
    isOwnerPov,
    scoringMethods: SCORING_METHODS,
  };

  return (
    <TrustContext.Provider value={value}>
      {children}
    </TrustContext.Provider>
  );
}
