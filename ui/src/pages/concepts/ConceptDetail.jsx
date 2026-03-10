import { useMemo } from 'react';
import { useParams, NavLink, Outlet } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import Breadcrumbs from '../../components/Breadcrumbs';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';

export default function ConceptDetail() {
  const { uuid } = useParams();
  const decodedUuid = decodeURIComponent(uuid);

  const { data, loading, error } = useCypher(`
    MATCH (h:ListHeader {uuid: '${decodedUuid}'})
    OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s:Superset)
    OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s)-[:IS_A_SUPERSET_OF*0..5]->(ss)-[:HAS_ELEMENT]->(elem:ListItem)
    WITH h, s, count(DISTINCT elem) AS elementCount
    RETURN h.uuid AS uuid, h.name AS name, h.pubkey AS author,
           s.uuid AS supersetUuid, s.name AS supersetName,
           elementCount
    LIMIT 1
  `);

  const concept = data?.[0];
  const authorPubkeys = useMemo(
    () => concept?.author ? [concept.author] : [],
    [concept?.author]
  );
  const profiles = useProfiles(authorPubkeys);

  const tabs = [
    { to: '', label: 'Overview', end: true },
    { to: 'core-nodes', label: 'Core Nodes' },
    { to: 'elements', label: 'Elements' },
    { to: 'dag', label: 'Organization (Sets)' },
    { to: 'visualization', label: 'Visualization' },
    { to: 'properties', label: 'Properties' },
    { to: 'schema', label: 'JSON Schema' },
    { to: 'health', label: '🩺 Health Audit' },
  ];

  return (
    <div className="page">
      <Breadcrumbs />

      {loading && <div className="loading">Loading concept…</div>}
      {error && <div className="error">Error: {error.message}</div>}

      {concept && (
        <>
          <h1>{concept.name || concept.uuid?.slice(0, 20) + '…'}</h1>
          <div className="concept-meta">
            <span className="meta-item">UUID: <code>{concept.uuid}</code></span>
            <span className="meta-item">Elements: <strong>{concept.elementCount}</strong></span>
            <span className="meta-item">Author: <AuthorCell pubkey={concept.author} profiles={profiles} /></span>
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
            <Outlet context={{ concept, uuid: decodedUuid }} />
          </div>
        </>
      )}
    </div>
  );
}
