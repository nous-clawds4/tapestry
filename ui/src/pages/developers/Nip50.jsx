import DevPage, { S, CopyBlock } from './DevPage';

export default function DevelopersNip50() {
  const relayUrl = typeof window !== 'undefined'
    ? `wss://${window.location.host}/relay`
    : 'wss://your-instance/relay';

  const minimalReq = `["REQ", "search-1", {
  "kinds": [0],
  "search": "jack"
}]`;

  const exampleReq = `["REQ", "search-1", {
  "kinds": [0],
  "limit": 20,
  "search": "jack observer:<your-pubkey> sort:followers:desc filter:rank:gte:2"
}]`;

  return (
    <DevPage
      title="NIP-50 Relay Search"
      intro={<>This relay supports <a href="https://github.com/nostr-protocol/nips/blob/master/50.md" target="_blank" rel="noreferrer">NIP-50</a> full-text profile search. Any nostr client can query it over a standard WebSocket connection.</>}
    >
      <h2 style={S.h2}>Relay URL</h2>
      <CopyBlock>{relayUrl}</CopyBlock>

      <h2 style={S.h2}>Quick Start</h2>
      <p style={S.p}>Connect via WebSocket and send a standard NIP-50 search REQ:</p>
      <pre style={S.pre}>{minimalReq}</pre>
      <p style={{ ...S.p, marginTop: '0.5rem' }}>
        This returns kind 0 profile events filtered and sorted by the community of the relay's default nostr profile.
        All standard nostr traffic (non-search REQs, EVENT publishing) passes through to the underlying strfry relay transparently.
      </p>

      <h2 style={S.h2}>Personalized Results with WoT Extensions</h2>
      <p style={S.p}>
        Add custom extensions to the <code style={S.code}>search</code> string to get results personalized to a specific user
        (filtered and sorted by that user's community):
      </p>
      <pre style={S.pre}>{exampleReq}</pre>

      <table style={S.table}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', textAlign: 'left' }}>
            <th style={S.th}>Extension</th>
            <th style={S.th}>Format</th>
            <th style={S.th}>Description</th>
          </tr>
        </thead>
        <tbody style={{ opacity: 0.85 }}>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <td style={S.td}><code style={S.code}>observer</code></td>
            <td style={{ ...S.td, ...S.mono }}>observer:&lt;hex-pubkey&gt;</td>
            <td style={S.td}>The user's pubkey. Results are processed by that user's community. Omit to use the relay's default point of view.</td>
          </tr>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <td style={S.td}><code style={S.code}>sort</code></td>
            <td style={{ ...S.td, ...S.mono }}>sort:&lt;metric&gt;:&lt;asc|desc&gt;</td>
            <td style={S.td}>Sort by a trust metric. Common metrics: <code style={S.code}>followers</code>, <code style={S.code}>rank</code></td>
          </tr>
          <tr>
            <td style={S.td}><code style={S.code}>filter</code></td>
            <td style={{ ...S.td, ...S.mono }}>filter:&lt;metric&gt;:&lt;op&gt;:&lt;value&gt;</td>
            <td style={S.td}>Filter by a trust metric threshold. Operators: <code style={S.code}>gte</code>, <code style={S.code}>lte</code>, <code style={S.code}>gt</code>, <code style={S.code}>lt</code>, <code style={S.code}>eq</code></td>
          </tr>
        </tbody>
      </table>

      <h2 style={S.h2}>Automatic Score Provisioning</h2>
      <p style={S.p}>
        The first time you search with a new <code style={S.code}>observer</code>, the relay automatically loads that user's
        Brainstorm data in the background if it is available. In the meantime, the search returns results using the relay's
        default perspective. Once loaded, subsequent searches will return results that are fully personalized.
      </p>
    </DevPage>
  );
}
