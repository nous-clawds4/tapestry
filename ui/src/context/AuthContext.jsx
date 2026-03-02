import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { pubkey, classification, profile }
  const [loading, setLoading] = useState(true);

  // Check session status on mount
  useEffect(() => {
    checkStatus();
  }, []);

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

  const login = useCallback(async () => {
    if (!window.nostr) {
      throw new Error('No NIP-07 extension found. Please install nos2x, Alby, or similar.');
    }

    // Step 1: Get pubkey from extension
    const pubkey = await window.nostr.getPublicKey();

    // Step 2: Verify with server — get challenge
    const verifyRes = await fetch('/api/auth/verify-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pubkey }),
    });
    const verifyData = await verifyRes.json();

    if (!verifyData.authorized) {
      throw new Error(verifyData.message || 'Authentication failed');
    }

    // Step 3: Sign the challenge
    const event = {
      kind: 22242,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['challenge', verifyData.challenge]],
      content: 'Tapestry authentication',
      pubkey,
    };

    const signedEvent = await window.nostr.signEvent(event);

    // Step 4: Login with signed event
    const loginRes = await fetch('/api/auth/login-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: signedEvent }),
    });
    const loginData = await loginRes.json();

    if (!loginData.success) {
      throw new Error(loginData.message || 'Login failed');
    }

    // Step 5: Refresh status
    await checkStatus();
  }, []);

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
    </AuthContext.Provider>
  );
}
