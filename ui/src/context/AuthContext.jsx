import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { waitForNostr } from '../utils/nip07';
import { setSessionPubkey } from '../utils/signerGuard';
import LoginErrorModal from '../components/LoginErrorModal';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

// Login failures are categorized so the shared modal can show controlled,
// vendor-neutral copy instead of leaking raw extension/server strings.
//   NO_SIGNER       — no NIP-07 signer appeared (even after the injection wait)
//   SIGNER_DECLINED — the user rejected getPublicKey()/signEvent() in their signer
//   NOT_AUTHORIZED  — the server declined the pubkey or the signed challenge
//   UNKNOWN         — anything else (network, parse, …)
function makeLoginError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { pubkey, classification, profile }
  const [loading, setLoading] = useState(true);
  // { code, message } | null — surfaced in the shared LoginErrorModal below so
  // every login entry point reports the reason instead of failing silently.
  const [loginError, setLoginError] = useState(null);

  // Check session status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  // Publish the session pubkey to the signer guard so plain-util write paths
  // (profile tags, pins, NIP-51 exports) can refuse to sign as a drifted
  // extension account without threading it through every call site (issue #335).
  useEffect(() => {
    setSessionPubkey(user?.pubkey || null);
  }, [user?.pubkey]);

  async function checkStatus() {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/status');
      const data = await res.json();

      if (data.authenticated && data.pubkey) {
        // Get classification
        const classRes = await fetch('/api/auth/user-classification');
        const classData = await classRes.json();

        // Fetch profile (kind 0) via profiles API
        let profile = null;
        try {
          const profRes = await fetch(`/api/profiles?pubkeys=${data.pubkey}`);
          const profData = await profRes.json();
          if (profData.success && profData.profiles?.[data.pubkey]) {
            profile = profData.profiles[data.pubkey];
          }
        } catch (e) {
          console.warn('Could not fetch profile:', e);
        }

        setUser({
          pubkey: data.pubkey,
          classification: classData.classification || 'guest',
          assistantPubkey: classData.assistantPubkey || null,
          profile,
        });
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Auth status check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  const runLogin = useCallback(async () => {
    // Wait briefly for an asynchronously-injected signer before giving up —
    // an immediate check mis-reports late-injecting extensions (ADR 0021).
    const nostr = await waitForNostr();
    if (!nostr) {
      throw makeLoginError(
        'NO_SIGNER',
        'No Nostr signer detected. Signing in needs a NIP-07 signer — usually a browser extension that holds your Nostr keys. Install one, then try again.'
      );
    }

    // Step 1: Get pubkey from the signer (the user may decline here)
    let pubkey;
    try {
      pubkey = await nostr.getPublicKey();
    } catch {
      throw makeLoginError('SIGNER_DECLINED', 'Sign-in was cancelled in your signer. Try again when you’re ready.');
    }

    // Step 2: Verify with server — get challenge
    const verifyRes = await fetch('/api/auth/verify-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey }),
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.authorized) {
      throw makeLoginError('NOT_AUTHORIZED', verifyData.message || 'You’re not authorized to sign in here.');
    }

    // Step 3: Sign the challenge (the user may decline here too)
    const event = {
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['challenge', verifyData.challenge]],
      content: 'Tapestry authentication',
      pubkey,
    };

    let signedEvent;
    try {
      signedEvent = await nostr.signEvent(event);
    } catch {
      throw makeLoginError('SIGNER_DECLINED', 'Sign-in was cancelled in your signer. Try again when you’re ready.');
    }

    // Step 4: Login with signed event
    const loginRes = await fetch('/api/auth/login-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: signedEvent }),
    });
    const loginData = await loginRes.json();

    if (!loginData.success) {
      throw makeLoginError('NOT_AUTHORIZED', loginData.message || 'Sign-in was rejected. Please try again.');
    }

    // Step 5: Refresh status
    await checkStatus();
  }, []);

  // Public login wrapper: records any failure (as a coded error) for the shared
  // modal, then re-throws so callers that branch on success — e.g. Tag.jsx
  // aborting a follow-up action — keep working unchanged.
  const login = useCallback(async () => {
    try {
      setLoginError(null);
      await runLogin();
    } catch (err) {
      setLoginError({ code: err?.code || 'UNKNOWN', message: err?.message || 'Sign-in failed. Please try again.' });
      throw err;
    }
  }, [runLogin]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
      <LoginErrorModal error={loginError} onClose={() => setLoginError(null)} />
    </AuthContext.Provider>
  );
}
