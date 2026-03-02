import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';

export default function ConceptOverview() {
  const { concept, uuid } = useOutletContext();

  // Fetch canonical constituents
  const { data: constituents } = useCypher(`
    MATCH (h:ListHeader {uuid: '${uuid}'})
    OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s:Superset)
    OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
    RETURN h.uuid AS headerUuid, h.name AS headerName,
           s.uuid AS supersetUuid, s.name AS supersetName,
           js.uuid AS schemaUuid, js.name AS schemaName
    LIMIT 1
  `);

  const navigate = useNavigate();
  const c = constituents?.[0];

  function goToNode(nodeUuid) {
    if (nodeUuid) navigate(`/kg/nodes/${encodeURIComponent(nodeUuid)}`);
  }

  return (
    <div className="concept-overview">
      <h2>Canonical Constituents</h2>
      <div className="constituents-grid">
        <div className="constituent-card clickable" onClick={() => goToNode(c?.headerUuid || uuid)}>
          <h3>📄 List Header</h3>
          <p className="constituent-name">{c?.headerName || concept.name}</p>
          <code className="uuid">{c?.headerUuid || uuid}</code>
        </div>
        {c?.supersetUuid && (
          <div className="constituent-card clickable" onClick={() => goToNode(c.supersetUuid)}>
            <h3>📦 Superset</h3>
            <p className="constituent-name">{c?.supersetName || 'Superset'}</p>
            <code className="uuid">{c.supersetUuid}</code>
          </div>
        )}
        {c?.schemaUuid && (
          <div className="constituent-card clickable" onClick={() => goToNode(c.schemaUuid)}>
            <h3>📋 JSON Schema</h3>
            <p className="constituent-name">{c?.schemaName || 'Schema'}</p>
            <code className="uuid">{c.schemaUuid}</code>
          </div>
        )}
      </div>
    </div>
  );
}
