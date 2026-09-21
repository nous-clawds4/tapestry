import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

/**
 * The instance's assistant roster (ADR author-scoped-inspection/0002).
 *
 * A context rather than props because <Avatar> sits three levels inside DataTable's render, and
 * prop-threading the roster through a component 25 pages share is the cost ConfigContext already
 * exists to avoid (the same call ADR ta-avatar/0001 made for taPubkey).
 *
 * Re-fetched when the session changes: the response is session-shaped — an owner sees admins, a
 * customer does not, and `viewer` is the caller's own account/assistant pair.
 *
 * `assistants` lists only assistants this instance CONTROLS. Absence means "not one of ours",
 * never "not an assistant".
 */
const AssistantRosterContext = createContext({ assistants: [], viewer: null, loading: true });

export function useAssistantRoster() {
  return useContext(AssistantRosterContext);
}

export function AssistantRosterProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState({ assistants: [], viewer: null, loading: true });

  useEffect(() => {
    // Fetched immediately, NOT after AuthContext settles: the server shapes this response from
    // req.session, which the browser supplies with the cookie, so the first answer is already
    // correct for whoever is signed in. Waiting on AuthContext would put two round-trips in front
    // of it and delay every surface that needs the roster before it can render.
    // Re-fetched when the session pubkey changes, so an in-page login/logout re-shapes it.
    let cancelled = false;
    fetch('/api/assistant/roster')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d && d.success) {
          setState({ assistants: d.assistants || [], viewer: d.viewer || null, loading: false });
        } else {
          setState({ assistants: [], viewer: null, loading: false });
        }
      })
      .catch(() => { if (!cancelled) setState({ assistants: [], viewer: null, loading: false }); });
    return () => { cancelled = true; };
  }, [user?.pubkey]);

  return (
    <AssistantRosterContext.Provider value={state}>
      {children}
    </AssistantRosterContext.Provider>
  );
}
