import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu from '../components/BrainstormUserMenu';

export default function BrainstormSkill() {
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
        <a href="/about-brainstorm-search" style={{ fontSize: '0.85rem', opacity: 0.7, textDecoration: 'none' }}>
          ← About Brainstorm Search
        </a>

        <h1 style={{ fontSize: '1.5rem', margin: '0.75rem 0 1.5rem' }}>Using Your Agent</h1>

        <div style={{ lineHeight: 1.7, fontSize: '0.95rem', opacity: 0.85, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p>
            Google search was revolutionary back in the day. A user goes to the search bar, types in
            keywords or a sentence, and sees a list of results.
          </p>
          <p>
            But the future of search is not the search bar. It is agentic. You're not going to deal with
            the search bar; your agent will do the typing for you.
          </p>
          <p>Watch this space for more information.</p>
        </div>
      </div>
    </div>
  );
}
