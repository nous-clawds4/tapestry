import { useNavigate } from 'react-router-dom';

export default function BrainstormDevelopers() {
  const navigate = useNavigate();

  // Derive relay URL from current host
  const relayUrl = typeof window !== 'undefined'
    ? `wss://${window.location.host}/relay`
    : 'wss://your-instance.tapestry.ninja/relay';

  const exampleReq = `["REQ", "search-1", {
  "kinds": [0],
  "limit": 20,
  "search": "jack observer:<your-pubkey> sort:followers:desc filter:rank:gte:2"
}]`;

  const minimalReq = `["REQ", "search-1", {
  "kinds": [0],
  "search": "jack"
}]`;

  return (
    <div className="bsp-page">
      {/* Top bar — reuses bsp- styles from BrainstormPersonalization */}
      <div className="bsp-top-bar">
        <button className="bsp-back-btn" onClick={() => navigate(-1)}>
          &larr; Back
        </button>
        <a href="/" className="bsp-logo">
          <img src="/brainstorm.svg" alt="" className="bsp-logo-img" />
          Brainstorm
        </a>
        <div className="bsp-auth" />
      </div>

      <div className="bsp-content" style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Add Brainstorm Search to Your Nostr Client</h1>
        <p style={{ opacity: 0.6, marginBottom: '2rem', fontSize: '0.9rem' }}>
          This relay supports NIP-50 full-text profile search.
          Any nostr client can query it over a standard WebSocket connection.
        </p>

        {/* Relay URL */}
        <h2 style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>Relay URL</h2>
        <pre style={{
          background: 'rgba(255,255,255,0.06)',
          padding: '0.8rem 1rem',
          borderRadius: 8,
          fontSize: '0.95rem',
          overflowX: 'auto',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
          position: 'relative',
        }}
        onClick={() => navigator.clipboard?.writeText(relayUrl)}
        title="Click to copy"
        >
          {relayUrl}
        </pre>

        {/* Minimal example */}
        <h2 style={{ fontSize: '1.1rem', marginTop: '2rem' }}>Quick Start</h2>
        <p style={{ lineHeight: 1.7, fontSize: '0.95rem', opacity: 0.85 }}>
          Connect via WebSocket and send a standard NIP-50 search REQ:
        </p>
        <pre style={{
          background: 'rgba(255,255,255,0.06)',
          padding: '0.8rem 1rem',
          borderRadius: 8,
          fontSize: '0.85rem',
          overflowX: 'auto',
          lineHeight: 1.5,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {minimalReq}
        </pre>
        <p style={{ lineHeight: 1.7, fontSize: '0.95rem', opacity: 0.85, marginTop: '0.5rem' }}>
          This returns kind 0 profile events filtered and sorted by the community of the relay's default nostr profile.
          All standard nostr traffic (non-search REQs, EVENT publishing) passes through
          to the underlying strfry relay transparently.
        </p>

        {/* WoT extensions */}
        <h2 style={{ fontSize: '1.1rem', marginTop: '2rem' }}>Personalized Results with WoT Extensions</h2>
        <p style={{ lineHeight: 1.7, fontSize: '0.95rem', opacity: 0.85 }}>
          Add custom extensions to the <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>search</code> string
          to get results personalized to a specific user (filtered and sorted by that user's community):
        </p>
        <pre style={{
          background: 'rgba(255,255,255,0.06)',
          padding: '0.8rem 1rem',
          borderRadius: 8,
          fontSize: '0.85rem',
          overflowX: 'auto',
          lineHeight: 1.5,
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          {exampleReq}
        </pre>

        <table style={{
          width: '100%',
          marginTop: '1rem',
          fontSize: '0.9rem',
          borderCollapse: 'collapse',
        }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', textAlign: 'left' }}>
              <th style={{ padding: '0.5rem 0.8rem' }}>Extension</th>
              <th style={{ padding: '0.5rem 0.8rem' }}>Format</th>
              <th style={{ padding: '0.5rem 0.8rem' }}>Description</th>
            </tr>
          </thead>
          <tbody style={{ opacity: 0.85 }}>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <td style={{ padding: '0.5rem 0.8rem' }}><code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>observer</code></td>
              <td style={{ padding: '0.5rem 0.8rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>observer:&lt;hex-pubkey&gt;</td>
              <td style={{ padding: '0.5rem 0.8rem' }}>The user's pubkey. Results are processed by that user's community. Omit to use the relay's default point of view.</td>
            </tr>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <td style={{ padding: '0.5rem 0.8rem' }}><code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>sort</code></td>
              <td style={{ padding: '0.5rem 0.8rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>sort:&lt;metric&gt;:&lt;asc|desc&gt;</td>
              <td style={{ padding: '0.5rem 0.8rem' }}>Sort by a trust metric. Common metrics: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>followers</code>, <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>rank</code></td>
            </tr>
            <tr>
              <td style={{ padding: '0.5rem 0.8rem' }}><code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>filter</code></td>
              <td style={{ padding: '0.5rem 0.8rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>filter:&lt;metric&gt;:&lt;op&gt;:&lt;value&gt;</td>
              <td style={{ padding: '0.5rem 0.8rem' }}>Filter by a trust metric threshold. Operators: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>gte</code>, <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>lte</code>, <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>gt</code>, <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>lt</code>, <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>eq</code></td>
            </tr>
          </tbody>
        </table>

        {/* Auto-provisioning */}
        <h2 style={{ fontSize: '1.1rem', marginTop: '2rem' }}>Automatic Score Provisioning</h2>
        <p style={{ lineHeight: 1.7, fontSize: '0.95rem', opacity: 0.85 }}>
          The first time you search with a new <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.15rem 0.4rem', borderRadius: 4 }}>observer</code>,
          the relay automatically loads that user's Brainstorm data in the background if it is available.
          In the meantime, the search returns results using the relay's default perspective.
          Once loaded, subsequent searches will return results that are fully personalized.
        </p>

        {/* Footer */}
        <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', opacity: 0.5, fontSize: '0.85rem', textAlign: 'center' }}>
          <a href="https://brainstorm.nosfabrica.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>My Brainstorm</a>
        </div>
      </div>
    </div>
  );
}
