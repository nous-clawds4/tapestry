import DevPage, { S, CopyBlock } from './DevPage';

const FIELDS = [
  ['rank', 'GrapeRank web-of-trust rank (GrapeRank influence ×100).'],
  ['hops', 'Degrees of separation along the follow graph from the point of view (999 = unreachable).'],
  ['followers / muters / reporters', 'Verified inbound counts — accounts following / muting / reporting this pubkey whose own web-of-trust rank clears the verification cutoff.'],
  ['follows / mutes / reporting', 'Exact outbound totals — accounts this pubkey follows / mutes / has reported.'],
  ['pagerank', 'Raw personalized-PageRank score under the active point of view.'],
];

export default function DevelopersOpenRanking() {
  const host = typeof window !== 'undefined' ? window.location.host : 'your-instance';
  const base = `https://${host}`;
  const capUrl = `${base}/.well-known/open-ranking.json`;

  const statsReq = `curl -s -X POST ${base}/stats/pubkey \\
  -H 'Content-Type: application/json' \\
  -d '{"pubkey":"<64-hex-pubkey>"}'`;

  const statsResp = `{
  "pubkey": "<64-hex-pubkey>",
  "rank": 93,
  "hops": 1,
  "followers": 19470,
  "muters": 72,
  "reporters": 6,
  "follows": 1669,
  "mutes": 0,
  "reporting": 23,
  "pagerank": 0.0114
}`;

  const searchReq = `curl -s -X POST ${base}/search/pubkeys \\
  -H 'Content-Type: application/json' \\
  -d '{"query":"jack","limit":20}'`;

  const searchResp = `{
  "results": [
    { "pubkey": "<hex>", "rank": 100 },
    { "pubkey": "<hex>", "rank": 98 }
  ]
}`;

  return (
    <DevPage
      title="Open Ranking (ORE)"
      intro={<>This instance is an <a href="https://github.com/Open-Ranking/protocol" target="_blank" rel="noreferrer">Open Ranking</a> provider — a plain HTTP/JSON interface to its web of trust. Any HTTP client can discover its capabilities and query web-of-trust ranking, per-pubkey stats, and profile search without speaking the nostr relay protocol. It complements the NIP-50 relay over the same underlying data.</>}
    >
      <h2 style={S.h2}>1. Discover capabilities</h2>
      <p style={S.p}>Fetch the capability document (<code style={S.code}>GET</code>) to see which endpoints and algorithms this provider offers:</p>
      <CopyBlock>{capUrl}</CopyBlock>
      <p style={{ ...S.p, marginTop: '0.5rem' }}>
        It returns a JSON object keyed by endpoint path; each value lists the available algorithms. The first algorithm in a list
        is that endpoint's default; an algorithm with <code style={S.code}>"pov": true</code> requires a point-of-view pubkey in the request.
      </p>

      <h2 style={S.h2}>2. Web-of-trust stats — <code style={S.code}>POST /stats/pubkey</code></h2>
      <p style={S.p}>
        Returns this instance's web-of-trust metrics for one pubkey. Algorithms: <code style={S.code}>graperank</code> (global, the default)
        and <code style={S.code}>graperank-personalized</code> (requires a provisioned <code style={S.code}>pov</code>; advertised in the
        capability document only when this instance serves it — check there first). An unprovisioned <code style={S.code}>pov</code> returns{' '}
        <code style={S.code}>422</code> whose <code style={S.code}>X-Reason</code> explains the unavailability and says what to do instead.
      </p>
      <pre style={S.pre}>{statsReq}</pre>
      <p style={{ ...S.p, marginTop: '0.5rem' }}>Response:</p>
      <pre style={S.pre}>{statsResp}</pre>

      <table style={S.table}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', textAlign: 'left' }}>
            <th style={S.th}>Field</th>
            <th style={S.th}>Meaning</th>
          </tr>
        </thead>
        <tbody style={{ opacity: 0.85 }}>
          {FIELDS.map(([f, d]) => (
            <tr key={f} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <td style={{ ...S.td, ...S.mono }}>{f}</td>
              <td style={S.td}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={S.h2}>3. Profile search — <code style={S.code}>POST /search/pubkeys</code></h2>
      <p style={S.p}>Free-text profile search, returning pubkeys ranked by this instance's global GrapeRank, highest first.</p>
      <pre style={S.pre}>{searchReq}</pre>
      <p style={{ ...S.p, marginTop: '0.5rem' }}>Response:</p>
      <pre style={S.pre}>{searchResp}</pre>

      <h2 style={S.h2}>Conventions</h2>
      <p style={S.p}>
        All endpoints are JSON over HTTP with <code style={S.code}>Access-Control-Allow-Origin: *</code>. Pubkeys are 64-character
        lowercase hex. Errors are signalled by HTTP status — <code style={S.code}>400</code> (malformed JSON),
        <code style={S.code}>422</code> (invalid input / unsupported algorithm / missing or unprovisioned <code style={S.code}>pov</code>) —
        with a human-readable <code style={S.code}>X-Reason</code> header.
      </p>
      <p style={S.p}>
        Point-of-view honesty: a personalized request for a <code style={S.code}>pov</code> this instance cannot serve is refused —
        results are never silently computed from another point of view (such as the global house view) and presented as personalized.
        On that <code style={S.code}>422</code>, fall back explicitly: re-request the default global algorithm. The same contract is
        proposed upstream for all Open Ranking providers (see Reference).
      </p>

      <h2 style={S.h2}>Reference</h2>
      <ul style={{ ...S.p }}>
        <li><a href="https://github.com/Open-Ranking/protocol" target="_blank" rel="noreferrer">Open Ranking protocol spec</a> — ORE-01 (discovery), ORE-02 (stats), ORE-05 (search)</li>
        <li><a href="https://github.com/nous-clawds4/tapestry" target="_blank" rel="noreferrer">Brainstorm Search repo</a> — this provider's implementation</li>
        <li><a href="https://github.com/Open-Ranking/protocol/issues/8" target="_blank" rel="noreferrer">Open-Ranking/protocol#8</a> — personalization honesty: the upstream proposal behind this provider's never-substitute rule (draft: <code style={S.code}>protocols/upstream/ore-01-pov-unavailable.md</code>)</li>
      </ul>
    </DevPage>
  );
}
