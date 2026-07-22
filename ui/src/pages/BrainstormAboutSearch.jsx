import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu from '../components/BrainstormUserMenu';

export default function BrainstormAboutSearch() {
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
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>About Brainstorm Search</h1>

        <div style={{ lineHeight: 1.7, fontSize: '0.95rem', opacity: 0.85, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>How Search Works</h2>
          <p>
            Brainstorm indexes millions of nostr profiles and ranks them using signals from your community —
            follows, mutes, and reports — so that spam, bots, and impersonators fall away without anyone
            having to police them. For the mechanics behind that, see{' '}
            <a href="/how-search-works" style={{ color: '#a5b4fc' }}>How Search Works</a>.
          </p>

          <h2 style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>How to Use Brainstorm Search</h2>
          <p>There are three ways to put it to work.</p>

          <ol style={{ paddingLeft: '1.2rem', marginTop: '0.5rem' }}>
            <li style={{ marginBottom: '0.9rem' }}>
              <strong>Directly, through the search bar</strong> — type a name, a bio keyword, a tag, a
              NIP-05 address, or a website, and see results ranked by your point of view.
            </li>
            <li style={{ marginBottom: '0.9rem' }}>
              <strong>Using your agent</strong> — let software do the searching for you.{' '}
              <a href="/brainstorm-skill" style={{ color: '#a5b4fc' }}>Read where this is heading</a>.
            </li>
            <li>
              <strong>Via other nostr clients</strong> — Brainstorm's web of trust is available to any
              client that wants it, over the nostr relay protocol and over HTTP.{' '}
              <a href="/developers" style={{ color: '#a5b4fc' }}>See the developer documentation</a>.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
