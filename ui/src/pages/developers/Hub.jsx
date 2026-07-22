import { Link } from 'react-router-dom';
import DevPage, { S } from './DevPage';

const card = {
  display: 'block', padding: '1rem 1.2rem', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)',
  textDecoration: 'none', marginBottom: '0.8rem',
};

export default function DevelopersHub() {
  return (
    <DevPage
      title="Developer Documentation"
      back={false}
      intro={<>Integrate this Brainstorm instance's web-of-trust features into your nostr client. Pick a feature below.</>}
    >
      <Link to="/developers/nip-50" style={card}>
        <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>NIP-50 relay search →</div>
        <div style={{ ...S.p, opacity: 0.7, marginTop: '0.25rem' }}>
          Full-text profile search over the nostr relay protocol (WebSocket), with web-of-trust sort/filter extensions.
        </div>
      </Link>

      <Link to="/developers/open-ranking" style={card}>
        <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>Open Ranking (ORE) →</div>
        <div style={{ ...S.p, opacity: 0.7, marginTop: '0.25rem' }}>
          An HTTP/JSON interface to the web of trust — capability discovery, per-pubkey stats, and ranked profile search.
        </div>
      </Link>

      <Link to="/developers/trusted-assertions" style={card}>
        <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>Trusted Assertions →</div>
        <div style={{ ...S.p, opacity: 0.7, marginTop: '0.25rem' }}>
          Web-of-trust scores published as ordinary nostr events, so any client can fetch and verify them.
        </div>
      </Link>

      <Link to="/developers/relay-tools" style={card}>
        <div style={{ fontSize: '1.05rem', fontWeight: 600 }}>Relay Tools →</div>
        <div style={{ ...S.p, opacity: 0.7, marginTop: '0.25rem' }}>
          Screen spam from your own hosted relay using a personalized whitelist drawn from your web of trust.
        </div>
      </Link>

      <h2 style={S.h2}>Open-source</h2>
      <ul style={{ ...S.p }}>
        <li><a href="https://github.com/nous-clawds4/tapestry" target="_blank" rel="noreferrer">Brainstorm Search repo</a> (this website)</li>
        <li><a href="https://github.com/nosfabrica" target="_blank" rel="noreferrer">NosFabrica repos</a> (personalization service)</li>
      </ul>
    </DevPage>
  );
}
