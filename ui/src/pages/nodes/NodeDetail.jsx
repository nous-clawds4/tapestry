import { useParams, useNavigate, NavLink, Outlet } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import Breadcrumbs from '../../components/Breadcrumbs';
import { displayName } from '../../utils/nodeName';

export default function NodeDetail() {
  const { uuid } = useParams();
  const decodedUuid = decodeURIComponent(uuid);

  const { data, loading, error } = useCypher(`
    MATCH (n {uuid: '${decodedUuid}'})
    RETURN n.uuid AS uuid, n.id AS id, n.name AS name, n.slug AS slug,
           n.pubkey AS pubkey, n.kind AS kind, n.created_at AS created_at,
           n.aTag AS aTag, n.tapestryKey AS tapestryKey,
           n.tapestryJsonUpdatedAt AS tapestryJsonUpdatedAt,
           labels(n) AS nodeLabels
    LIMIT 1
  `);

  const node = data?.[0];

  const tabs = [
    { to: '', label: 'Overview', end: true },
    { to: 'json', label: 'JSON Data' },
    { to: 'concepts', label: 'Concept Membership' },
    { to: 'relationships', label: 'Relationships' },
    { to: 'neo4j', label: 'Neo4j' },
    { to: 'raw', label: 'Raw Data' },
  ];

  return (
    <div className="page">
      <Breadcrumbs />

      {loading && <div className="loading">Loading node…</div>}
      {error && <div className="error">Error: {error.message}</div>}

      {node && (
        <>
          <h1>{displayName(node)}</h1>
          <div className="concept-meta">
            <span className="meta-item">Kind: <strong>{node.kind}</strong></span>
            <span className="meta-item">Author: <code>{node.pubkey?.slice(0, 12)}…</code></span>
            <span className="meta-item">
              {(Array.isArray(node.nodeLabels) ? node.nodeLabels : [])
                .filter(l => l !== 'NostrEvent')
                .map(l => <span key={l} className="label-badge">{l}</span>)}
            </span>
          </div>

          <nav className="tab-nav">
            {tabs.map(tab => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="tab-content">
            <Outlet context={{ node, uuid: decodedUuid }} />
          </div>
        </>
      )}

      {!loading && !error && !node && (
        <div className="error">Node not found</div>
      )}
    </div>
  );
}
