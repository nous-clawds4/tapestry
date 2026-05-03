import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useConfig } from './ConfigContext';

const STORAGE_KEY = 'tapestry_trust_method';

const SCORING_METHODS = [
  { id: 'trusted-assertions-rank', label: 'Trusted Assertions (rank)' },
  { id: 'follow-list', label: 'Follow List' },
  { id: 'trusted-list', label: 'Trusted List' },
  { id: 'trust-everyone', label: 'Trust Everyone' },
];

const DEFAULT_SCORING_METHOD = 'trusted-assertions-rank';
const DEFAULT_TRUSTED_LIST_ID = '';

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        povPubkey: parsed.povPubkey || null,
        scoringMethod: SCORING_METHODS.some(m => m.id === parsed.scoringMethod)
          ? parsed.scoringMethod
          : DEFAULT_SCORING_METHOD,
        trustedListId: parsed.trustedListId || DEFAULT_TRUSTED_LIST_ID,
      };
    }
  } catch {}
  return { povPubkey: null, scoringMethod: DEFAULT_SCORING_METHOD, trustedListId: DEFAULT_TRUSTED_LIST_ID };
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
  const { ownerPubkey } = useConfig();
  const [state, setState] = useState(loadState);

  // Once the owner pubkey arrives from the server, default povPubkey to it
  // (only if the user hasn't set their own — i.e. we restored null from storage).
  useEffect(() => {
    if (!ownerPubkey) return;
    setState(prev => (prev.povPubkey ? prev : { ...prev, povPubkey: ownerPubkey }));
  }, [ownerPubkey]);

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
    if (!ownerPubkey) return;
    setState(prev => {
      const next = { ...prev, povPubkey: ownerPubkey };
      saveState(next);
      return next;
    });
  }, [ownerPubkey]);

  const isOwnerPov = ownerPubkey != null && state.povPubkey === ownerPubkey;

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
