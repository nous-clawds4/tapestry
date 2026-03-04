import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';

export default function ConceptOverview() {
  const { concept, uuid } = useOutletContext();

  // Fetch canonical constituents: header, superset, schema
  const { data: constituents } = useCypher(`
    MATCH (h:ListHeader {uuid: '${uuid}'})
    OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s:Superset)
    OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
    RETURN h.uuid AS headerUuid, h.name AS headerName,
           s.uuid AS supersetUuid, s.name AS supersetName,
           js.uuid AS schemaUuid, js.name AS schemaName
    LIMIT 1
  `);

  // Fetch graph nodes via their relationship to this concept's header
  const { data: graphs } = useCypher(`
    MATCH (h:ListHeader {uuid: '${uuid}'})
    OPTIONAL MATCH (cg)-[:IS_THE_CORE_GRAPH_FOR]->(h)
    OPTIONAL MATCH (ctg)-[:IS_THE_CLASS_THREADS_GRAPH_FOR]->(h)
    OPTIONAL MATCH (ptg)-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(h)
    RETURN cg.uuid AS coreUuid, cg.name AS coreName,
           ctg.uuid AS ctUuid, ctg.name AS ctName,
           ptg.uuid AS ptUuid, ptg.name AS ptName
    LIMIT 1
  `);

  const navigate = useNavigate();
  const c = constituents?.[0];
  const g = graphs?.[0];

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
        {c?.supersetUuid ? (
          <div className="constituent-card clickable" onClick={() => goToNode(c.supersetUuid)}>
            <h3>📦 Superset</h3>
            <p className="constituent-name">{c.supersetName}</p>
            <code className="uuid">{c.supersetUuid}</code>
          </div>
        ) : (
          <div className="constituent-card missing">
            <h3>📦 Superset</h3>
            <p className="constituent-name">Not yet created</p>
          </div>
        )}
        {c?.schemaUuid ? (
          <div className="constituent-card clickable" onClick={() => goToNode(c.schemaUuid)}>
            <h3>📋 JSON Schema</h3>
            <p className="constituent-name">{c.schemaName}</p>
            <code className="uuid">{c.schemaUuid}</code>
          </div>
        ) : (
          <div className="constituent-card missing">
            <h3>📋 JSON Schema</h3>
            <p className="constituent-name">Not yet created</p>
          </div>
        )}
        {g?.coreUuid ? (
          <div className="constituent-card clickable" onClick={() => goToNode(g.coreUuid)}>
            <h3>🔗 Core Nodes Graph</h3>
            <p className="constituent-name">{g.coreName}</p>
            <code className="uuid">{g.coreUuid}</code>
          </div>
        ) : (
          <div className="constituent-card missing">
            <h3>🔗 Core Nodes Graph</h3>
            <p className="constituent-name">Not yet created</p>
          </div>
        )}
        {g?.ctUuid ? (
          <div className="constituent-card clickable" onClick={() => goToNode(g.ctUuid)}>
            <h3>🌳 Class Threads Graph</h3>
            <p className="constituent-name">{g.ctName}</p>
            <code className="uuid">{g.ctUuid}</code>
          </div>
        ) : (
          <div className="constituent-card missing">
            <h3>🌳 Class Threads Graph</h3>
            <p className="constituent-name">Not yet created</p>
          </div>
        )}
        {g?.ptUuid ? (
          <div className="constituent-card clickable" onClick={() => goToNode(g.ptUuid)}>
            <h3>🌿 Property Tree Graph</h3>
            <p className="constituent-name">{g.ptName}</p>
            <code className="uuid">{g.ptUuid}</code>
          </div>
        ) : (
          <div className="constituent-card missing">
            <h3>🌿 Property Tree Graph</h3>
            <p className="constituent-name">Not yet created</p>
          </div>
        )}
      </div>
    </div>
  );
}
