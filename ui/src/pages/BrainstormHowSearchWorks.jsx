import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu from '../components/BrainstormUserMenu';

export default function BrainstormHowSearchWorks() {
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
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>How Search Works</h1>

        <div style={{ lineHeight: 1.7, fontSize: '0.95rem', opacity: 0.85, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>Search</h2>
          <p>
            Brainstorm indexes millions of nostr profiles (and growing) and lets you search them by name,
            bio, NIP-05, or website. Under the hood we are using <a href="https://meilisearch.com" target="_blank">Meilisearch</a>,
            a lightning-fast, open-source, and developer-friendly search engine designed to provide instant,
            typo-tolerant full-text and hybrid (semantic) search.
          </p>

          <h2 style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>Verification</h2>
          <p>
            Brainstorm harnesses organic signals from your community to distinguish "legitimate" nostr accounts from spam,
            impersonators, bots, and other bad actors seeking to weasel their way onto the screen in front of your eyes.
          </p>

          <p>
            Currently we rely upon follows, mutes, and reports, processed
            using a method called <a href="https://primal.net/straycat/graperank">GrapeRank</a> to come up with a
            verification score between 0 and 100. When one profile (whose score is above 0) follows another, that profile's score gets a bump up,
            leveling out at the max score of 100. Mutes and reports push a score down. But have no fear: if an
            unverified account follows, mutes, or reports someone, that follow, mute, or report is <i>completely ignored</i>{' '}
            by virtue of having a verification score of 0.
          </p>

          <p>
            So it doesn't matter how many spambots are spun up. A thousand, a million. Without social proof, they will all be ignored.
          </p>

          <p style={{ marginTop: '2rem', opacity: 0.7, fontSize: '0.9rem' }}>
            Curious how your point of view affects what you see?
            See <a href="/personalization" style={{ color: '#a5b4fc' }}>How Personalization Works</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
