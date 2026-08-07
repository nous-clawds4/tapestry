import { createContext, useContext, useState, useEffect } from 'react';

const ConfigContext = createContext({});

export function useConfig() {
  return useContext(ConfigContext);
}

export function ConfigProvider({ children }) {
  const [taPubkey, setTaPubkey] = useState(null);
  const [ownerPubkey, setOwnerPubkey] = useState(null);
  // The owner's kind-0. Resolved here, once, because it is instance identity —
  // the same thing this context already owns — and because <Avatar> needs it on
  // every assistant-authored row: useProfiles has no in-flight dedupe, so asking
  // per row would fire one request per row on first paint (ADR ta-avatar/0001).
  const [ownerProfile, setOwnerProfile] = useState(null);
  const [aRelays, setARelays] = useState(null);
  // neo4jBrowserUrl flows from /api/status:neo4jBrowserUrl which is computed
  // server-side from BRAINSTORM_NEO4J_BROWSER_URL in /etc/brainstorm.conf
  // (template-rendered as http://${DOMAIN_NAME}:7474 per story #16).
  // Consumed by AdminToolsPanel in Dashboard.jsx and the Open Neo4j Browser
  // button in pages/databases/Neo4jOverview.jsx. Story #19 / ADR 0017.
  const [neo4jBrowserUrl, setNeo4jBrowserUrl] = useState(null);

  useEffect(() => {
    fetch('/api/assistant/pubkey')
      .then(r => r.json())
      .then(d => { if (d.success) setTaPubkey(d.pubkey); })
      .catch(() => {});

    fetch('/api/owner/pubkey')
      .then(r => r.json())
      .then(d => {
        if (!d.success) return null;
        setOwnerPubkey(d.pubkey);
        return fetch(`/api/profiles?pubkeys=${d.pubkey}`)
          .then(r => r.json())
          .then(p => { if (p.success) setOwnerProfile(p.profiles?.[d.pubkey] || null); });
      })
      .catch(() => {});

    fetch('/api/relays')
      .then(r => r.json())
      .then(d => { if (d.success) setARelays(d.aRelays); })
      .catch(() => {});

    fetch('/api/status')
      .then(r => r.json())
      .then(d => { if (d.neo4jBrowserUrl) setNeo4jBrowserUrl(d.neo4jBrowserUrl); })
      .catch(() => {});
  }, []);

  return (
    <ConfigContext.Provider value={{ taPubkey, ownerPubkey, ownerProfile, aRelays, neo4jBrowserUrl }}>
      {children}
    </ConfigContext.Provider>
  );
}
