import { createContext, useContext, useState, useEffect } from 'react';

const ConfigContext = createContext({});

export function useConfig() {
  return useContext(ConfigContext);
}

export function ConfigProvider({ children }) {
  const [taPubkey, setTaPubkey] = useState(null);
  const [ownerPubkey, setOwnerPubkey] = useState(null);
  const [aRelays, setARelays] = useState(null);

  useEffect(() => {
    fetch('/api/assistant/pubkey')
      .then(r => r.json())
      .then(d => { if (d.success) setTaPubkey(d.pubkey); })
      .catch(() => {});

    fetch('/api/owner/pubkey')
      .then(r => r.json())
      .then(d => { if (d.success) setOwnerPubkey(d.pubkey); })
      .catch(() => {});

    fetch('/api/relays')
      .then(r => r.json())
      .then(d => { if (d.success) setARelays(d.aRelays); })
      .catch(() => {});
  }, []);

  return (
    <ConfigContext.Provider value={{ taPubkey, ownerPubkey, aRelays }}>
      {children}
    </ConfigContext.Provider>
  );
}
