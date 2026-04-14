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
        <a href="/" className="bsp-logo">
          <img src="/brainstorm.svg" alt="" className="bsp-logo-img" />
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
            Brainstorm indexes millions of nostr profiles (and growing) and lets you search them by name,
            bio, NIP-05, or website. Legitimate nostr profiles are <a href="https://primal.net/straycat/graperank">distinguished</a> 
            from spam, impersonators and other bad actors using a combination of factors including follows, mutes, and reports.
            But what makes this process unique is <strong>personalization</strong>: 
            search results are ranked and filtered from <em>your</em> perspective, using input from <em>your</em> extended community.
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
              derived from <em>your</em> extended community. Requires sign-in and calculated Trust Scores.
            </li>
          </ul>

          <h2 style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>Getting Personalized</h2>
          <p>
            To unlock your personalized point of view:
          </p>
          <ol style={{ paddingLeft: '1.2rem', marginTop: '0.5rem' }}>
            <li style={{ marginBottom: '0.4rem' }}>Sign in with a nostr browser extension (NIP-07)</li>
            <li style={{ marginBottom: '0.4rem' }}>
              Calculate your personalized Trust Metrics at{' '}
              <a href="https://brainstorm.nosfabrica.com/" target="_blank" rel="noopener noreferrer"
                style={{ color: '#a5b4fc' }}>
                brainstorm.nosfabrica.com
              </a>
            </li>
            <li style={{ marginBottom: '0.4rem' }}>
              Visit <a href="/settings" style={{ color: '#a5b4fc' }}>Settings</a> to
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
        <a href="https://brainstorm.nosfabrica.com/" className="bs-footer-link">My Brainstorm</a>
      </div>
    </div>
  );
}
