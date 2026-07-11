import { Link } from 'react-router-dom';

// Shared inline styles for the developer pages (reuses the legacy bsp- chrome).
export const S = {
  pre: {
    background: 'rgba(255,255,255,0.06)', padding: '0.8rem 1rem', borderRadius: 8,
    fontSize: '0.85rem', overflowX: 'auto', lineHeight: 1.5,
    border: '1px solid rgba(255,255,255,0.1)',
  },
  urlPre: {
    background: 'rgba(255,255,255,0.06)', padding: '0.8rem 1rem', borderRadius: 8,
    fontSize: '0.95rem', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'pointer', position: 'relative',
  },
  h2: { fontSize: '1.1rem', marginTop: '2rem' },
  p: { lineHeight: 1.7, fontSize: '0.95rem', opacity: 0.85 },
  code: { background: 'rgba(255,255,255,0.1)', padding: '0.15rem 0.4rem', borderRadius: 4 },
  table: { width: '100%', marginTop: '1rem', fontSize: '0.9rem', borderCollapse: 'collapse' },
  th: { padding: '0.5rem 0.8rem' },
  td: { padding: '0.5rem 0.8rem' },
  mono: { fontFamily: 'monospace', fontSize: '0.8rem' },
};

// Click-to-copy code/URL block.
export function CopyBlock({ children, style }) {
  return (
    <pre
      style={style || S.urlPre}
      onClick={() => navigator.clipboard?.writeText(typeof children === 'string' ? children : String(children))}
      title="Click to copy"
    >
      {children}
    </pre>
  );
}

// Shared page chrome: top bar + centered content + optional "← Developers" back-link.
export default function DevPage({ title, intro, back = true, children }) {
  return (
    <div className="bsp-page">
      <div className="bsp-top-bar">
        <a href="/" className="bsp-logo">
          <img src="/brainstorm.svg" alt="" className="bsp-logo-img" />
        </a>
        <div className="bsp-auth" />
      </div>

      <div className="bsp-content" style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {back && (
          <Link to="/developers" style={{ fontSize: '0.85rem', opacity: 0.7, textDecoration: 'none' }}>
            ← Developers
          </Link>
        )}
        <h1 style={{ fontSize: '1.5rem', margin: back ? '0.75rem 0 0.5rem' : '0 0 0.5rem' }}>{title}</h1>
        {intro && <div style={{ opacity: 0.6, marginBottom: '2rem', fontSize: '0.9rem' }}>{intro}</div>}
        {children}
      </div>
    </div>
  );
}
