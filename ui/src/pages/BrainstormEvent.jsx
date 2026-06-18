import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu from '../components/BrainstormUserMenu';

/**
 * Placeholder for the public single-event view (/event). Reachable from the feed's
 * per-note "Copy Note Link" action, which builds /event?nevent=<nevent>. The page
 * also accepts ?id=<hex> so either identifier resolves once the real view is built.
 *
 * Front-end only and intentionally minimal: it confirms the route is live and echoes
 * back the identifier it received. The actual event rendering is a work in progress.
 */
export default function BrainstormEvent() {
  const { user, login, logout } = useAuth();
  const [params] = useSearchParams();
  const nevent = params.get('nevent');
  const id = params.get('id');
  const identifier = nevent || id || null;

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
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Event</h1>
        <p style={{ lineHeight: 1.7, fontSize: '0.95rem', opacity: 0.85 }}>
          This is a placeholder page — the single-event view is a work in progress.
        </p>
        {identifier && (
          <p className="bsp-event-identifier">
            <span className="bsp-event-identifier-label">{nevent ? 'nevent' : 'event id'}:</span>{' '}
            <code className="bsp-event-identifier-value">{identifier}</code>
          </p>
        )}
      </div>
    </div>
  );
}
