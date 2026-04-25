import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu from '../components/BrainstormUserMenu';

export default function BrainstormAbout() {
  const { user, login, logout } = useAuth();

  return (
    <div className="bsp-page">
      {/* Top bar */}
      <div className="bsp-top-bar">
        <a href="/" className="bsp-logo">
          <img src="/brainstorm.svg" alt="" className="bsp-logo-img" />
        </a>
        <div className="bsp-auth">
          <BrainstormUserMenu user={user} login={login} logout={logout} />
        </div>
      </div>

      <div className="bsp-content" style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>About Brainstorm</h1>

        <div style={{ lineHeight: 1.7, fontSize: '0.95rem', opacity: 0.85, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p>
            Brainstorm is a search engine for <a href="https://github.com/nostr" target="_blank" rel="noopener noreferrer">nostr</a>,
            the open social-media protocol. It indexes millions of profiles and ranks them through a trust-based filter —
            by default using a community-curated perspective, or optionally one personalized to your own trust network.
          </p>

          <p>
            Brainstorm is a project of{' '}
            <a href="https://nosfabrica.com" target="_blank" rel="noopener noreferrer">NosFabrica</a>,
            which builds sovereign-data infrastructure on nostr and Bitcoin.
          </p>

          <p>
            Brainstorm is open source. See <a href="/developers" style={{ color: '#a5b4fc' }}>Developers</a> for
            repository links and integration docs, <a href="/how-search-works" style={{ color: '#a5b4fc' }}>How Search Works</a> for
            the underlying mechanics, and <a href="/personalization" style={{ color: '#a5b4fc' }}>How Personalization Works</a> for
            an explanation of the trust filter.
          </p>
        </div>
      </div>
    </div>
  );
}
