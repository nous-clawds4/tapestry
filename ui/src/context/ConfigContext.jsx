import { createContext, useContext, useState, useEffect } from 'react';

const ConfigContext = createContext({});

export function useConfig() {
  return useContext(ConfigContext);
}

export function ConfigProvider({ children }) {
  const [taPubkey, setTaPubkey] = useState(null);

  useEffect(() => {
    fetch('/api/assistant/pubkey')
      .then(r => r.json())
      .then(d => { if (d.success) setTaPubkey(d.pubkey); })
      .catch(() => {});
  }, []);

  return (
    <ConfigContext.Provider value={{ taPubkey }}>
      {children}
    </ConfigContext.Provider>
  );
}
