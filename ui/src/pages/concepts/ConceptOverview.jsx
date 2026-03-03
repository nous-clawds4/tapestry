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

  // Fetch graph instances for this concept (z-tag points to graph concept header, name references this concept)
  const conceptName = concept?.name || '';
  const { data: graphs } = useCypher(`
    MATCH (g:ListItem)-[:HAS_TAG]->(zt:NostrEventTag {type: 'z'})
    WHERE zt.value STARTS WITH '39998:' AND zt.value ENDS WITH ':ec1b87c4'
    AND g.name CONTAINS '${conceptName.replace(/'/g, "\\'")}'
    RETURN g.uuid AS uuid, g.name AS name
    ORDER BY g.name
  `);

  const navigate = useNavigate();
  const c = constituents?.[0];

  function goToNode(nodeUuid) {
    if (nodeUuid) navigate(`/kg/nodes/${encodeURIComponent(nodeUuid)}`);
  }

  // Classify graphs by type
  const coreNodesGraph = graphs?.find(g => g.name?.includes('core nodes'));
  const classThreadsGraph = graphs?.find(g => g.name?.includes('class threads'));
  const propertyTreeGraph = graphs?.find(g => g.name?.includes('property tree'));

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
        {coreNodesGraph ? (
          <div className="constituent-card clickable" onClick={() => goToNode(coreNodesGraph.uuid)}>
            <h3>🔗 Core Nodes Graph</h3>
            <p className="constituent-name">{coreNodesGraph.name}</p>
            <code className="uuid">{coreNodesGraph.uuid}</code>
          </div>
        ) : (
          <div className="constituent-card missing">
            <h3>🔗 Core Nodes Graph</h3>
            <p className="constituent-name">Not yet created</p>
          </div>
        )}
        {classThreadsGraph ? (
          <div className="constituent-card clickable" onClick={() => goToNode(classThreadsGraph.uuid)}>
            <h3>🌳 Class Threads Graph</h3>
            <p className="constituent-name">{classThreadsGraph.name}</p>
            <code className="uuid">{classThreadsGraph.uuid}</code>
          </div>
        ) : (
          <div className="constituent-card missing">
            <h3>🌳 Class Threads Graph</h3>
            <p className="constituent-name">Not yet created</p>
          </div>
        )}
        {propertyTreeGraph ? (
          <div className="constituent-card clickable" onClick={() => goToNode(propertyTreeGraph.uuid)}>
            <h3>🌿 Property Tree Graph</h3>
            <p className="constituent-name">{propertyTreeGraph.name}</p>
            <code className="uuid">{propertyTreeGraph.uuid}</code>
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
