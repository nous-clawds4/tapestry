import { Link, useMatches } from 'react-router-dom';

export default function Breadcrumbs() {
  const matches = useMatches();
  const crumbs = matches
    .filter(m => m.handle?.crumb)
    .map(m => ({
      label: typeof m.handle.crumb === 'function' ? m.handle.crumb(m.data) : m.handle.crumb,
      path: m.pathname,
    }));

  if (crumbs.length <= 1) return null;

  return (
    <nav className="breadcrumbs">
      {crumbs.map((crumb, i) => (
        <span key={crumb.path}>
          {i > 0 && <span className="separator"> › </span>}
          {i < crumbs.length - 1 ? (
            <Link to={crumb.path}>{crumb.label}</Link>
          ) : (
            <span className="current">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
