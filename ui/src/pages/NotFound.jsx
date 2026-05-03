import { Link, useLocation } from 'react-router-dom';

/**
 * Catch-all "page not found" rendered for any URL that doesn't match a defined
 * route. Used at the top level (`/foo`) and under `/tapestry/*` to give visitors
 * a clear message and a way home, instead of React Router's default error UI.
 */
export default function NotFound() {
  const location = useLocation();
  const inTapestry = location.pathname.startsWith('/tapestry');
  const homeHref = inTapestry ? '/tapestry' : '/';
  const homeLabel = inTapestry ? 'Dashboard' : 'Brainstorm Search';

  return (
    <div style={{
      maxWidth: 560,
      margin: '6rem auto',
      padding: '2rem 1.5rem',
      textAlign: 'center',
      lineHeight: 1.6,
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Page not found</h1>
      <p style={{ opacity: 0.6, marginBottom: '1.5rem' }}>
        No route matched <code style={{ background: 'rgba(255,255,255,0.06)', padding: '0.1rem 0.35rem', borderRadius: 4 }}>{location.pathname}</code>.
      </p>
      <p>
        <Link to={homeHref} style={{ color: '#a5b4fc' }}>← Return to {homeLabel}</Link>
      </p>
    </div>
  );
}
