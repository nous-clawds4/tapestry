import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu from '../components/BrainstormUserMenu';

export default function BrainstormPersonalization() {
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();

  return (
    <div className="bsp-page">
      {/* Top bar */}
      <div className="bsp-top-bar">
        <button className="bsp-back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <a href="/kg/brainstorm-search" className="bsp-logo">
          <img src="/kg/brainstorm.svg" alt="" className="bsp-logo-img" />
          Brainstorm
        </a>
        <div className="bsp-auth">
          <BrainstormUserMenu user={user} login={login} logout={logout} />
        </div>
      </div>

      <div className="bsp-content" style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>How Personalization Works</h1>

        <div style={{ lineHeight: 1.7, fontSize: '0.95rem', opacity: 0.85 }}>
          <p>
            Brainstorm indexes over a million nostr profiles and lets you search them by name,
            bio, NIP-05, or website. But what makes it different is <strong>personalization</strong> —
            the ability to rank and filter search results using your own Web of Trust.
          </p>

          <h2 style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>Two Points of View</h2>
          <p>
            Every search is filtered through a <strong>point of view</strong>. There are two options:
          </p>
          <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>House Point of View</strong> — The default. Uses trust scores calculated by the
              operator of this instance. Available to everyone, no sign-in required.
            </li>
            <li>
              <strong>My Point of View</strong> — Your personalized perspective. Uses trust scores
              derived from <em>your</em> Web of Trust. Requires sign-in and a calculated Grapevine.
            </li>
          </ul>

          <h2 style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>What are Trust Scores?</h2>
          <p>
            Trust scores come from <strong>kind 30382 Trusted Assertions</strong> — nostr events that
            encode reputation metrics like WoT Rank, follower count, and GrapeRank influence. These
            scores are published by a Grapevine calculator and referenced via a <strong>kind 10040
            Treasure Map</strong>.
          </p>

          <h2 style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>Getting Personalized</h2>
          <p>
            To unlock your personalized point of view:
          </p>
          <ol style={{ paddingLeft: '1.2rem', marginTop: '0.5rem' }}>
            <li style={{ marginBottom: '0.4rem' }}>Sign in with a nostr browser extension (NIP-07)</li>
            <li style={{ marginBottom: '0.4rem' }}>
              Calculate your Grapevine at{' '}
              <a href="https://brainstorm.nosfabrica.com/" target="_blank" rel="noopener noreferrer"
                style={{ color: '#a5b4fc' }}>
                brainstorm.nosfabrica.com
              </a>
            </li>
            <li style={{ marginBottom: '0.4rem' }}>
              Visit <a href="/kg/brainstorm-search/settings" style={{ color: '#a5b4fc' }}>Settings</a> to
              sync your scores and configure your filters
            </li>
            <li>Switch to "My Point of View" from the search page</li>
          </ol>

          <p style={{ marginTop: '1.5rem', opacity: 0.6, fontSize: '0.85rem' }}>
            Personalization is entirely optional. The house point of view works well for most searches.
            Your personalized perspective simply lets you see the nostr world through your own trust network.
          </p>
        </div>
      </div>

      <div className="bs-footer">
        Powered by <a href="https://brainstorm.nosfabrica.com/" className="bs-footer-link">NosFabrica</a>
      </div>
    </div>
  );
}
