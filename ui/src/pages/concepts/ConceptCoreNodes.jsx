import { useOutletContext, Link } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';

// Core node definitions in canonical order
const CORE_NODES = [
  { key: 'header',    emoji: '📄', label: 'Concept Header' },
  { key: 'superset',  emoji: '📦', label: 'Superset' },
  { key: 'schema',    emoji: '📋', label: 'JSON Schema' },
  { key: 'pp',        emoji: '🔑', label: 'Primary Property' },
  { key: 'props',     emoji: '📂', label: 'Properties' },
  { key: 'pt',        emoji: '🌿', label: 'Property Tree Graph' },
  { key: 'core',      emoji: '🔗', label: 'Core Nodes Graph' },
  { key: 'conceptG',  emoji: '🌳', label: 'Concept Graph' },
];

function NavLinks({ nodeUuid, eventId }) {
  if (!nodeUuid) return null;
  const enc = encodeURIComponent(nodeUuid);
  return (
    <div className="constituent-nav">
      <Link to={`/kg/databases/neo4j/nodes/${enc}`} title="Neo4j Node">🔗 Node</Link>
      {eventId && (
        <Link to={`/kg/lists/items/${eventId}`} title="Strfry Event">📜 Event</Link>
      )}
      <Link to={`/kg/databases/neo4j/nodes/${enc}/json`} title="JSON Representation">📋 JSON</Link>
    </div>
  );
}

export default function ConceptCoreNodes() {
  const { concept, uuid } = useOutletContext();

  // Fetch all 8 core nodes in one query, including event ids for strfry links
  const { data } = useCypher(`
    MATCH (h:ListHeader {uuid: '${uuid}'})
    OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
    OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
    OPTIONAL MATCH (pp)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)
    OPTIONAL MATCH (props)-[:IS_THE_PROPERTIES_SET_FOR]->(h)
    OPTIONAL MATCH (cg)-[:IS_THE_CORE_GRAPH_FOR]->(h)
    OPTIONAL MATCH (conceptG)-[:IS_THE_CONCEPT_GRAPH_FOR]->(h)
    OPTIONAL MATCH (ptg)-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(h)
    RETURN h.uuid AS headerUuid, h.name AS headerName, h.id AS headerId,
           sup.uuid AS supersetUuid, sup.name AS supersetName, sup.id AS supersetId,
           js.uuid AS schemaUuid, js.name AS schemaName, js.id AS schemaId,
           pp.uuid AS ppUuid, pp.name AS ppName, pp.id AS ppId,
           props.uuid AS propsUuid, props.name AS propsName, props.id AS propsId,
           ptg.uuid AS ptUuid, ptg.name AS ptName, ptg.id AS ptId,
           cg.uuid AS coreUuid, cg.name AS coreName, cg.id AS coreId,
           conceptG.uuid AS conceptGUuid, conceptG.name AS conceptGName, conceptG.id AS conceptGId
    LIMIT 1
  `);

  const d = data?.[0] || {};

  // Build a map keyed by our CORE_NODES keys
  const nodes = {
    header:   { uuid: d.headerUuid || uuid, name: d.headerName || concept.name, id: d.headerId },
    superset: { uuid: d.supersetUuid, name: d.supersetName, id: d.supersetId },
    schema:   { uuid: d.schemaUuid, name: d.schemaName, id: d.schemaId },
    pp:       { uuid: d.ppUuid, name: d.ppName, id: d.ppId },
    props:    { uuid: d.propsUuid, name: d.propsName, id: d.propsId },
    pt:       { uuid: d.ptUuid, name: d.ptName, id: d.ptId },
    core:     { uuid: d.coreUuid, name: d.coreName, id: d.coreId },
    conceptG: { uuid: d.conceptGUuid, name: d.conceptGName, id: d.conceptGId },
  };

  return (
    <div className="concept-overview">
      <h2>Core Nodes</h2>
      <div className="constituents-grid">
        {CORE_NODES.map(({ key, emoji, label }) => {
          const n = nodes[key];
          if (n?.uuid) {
            return (
              <div key={key} className="constituent-card">
                <h3>{emoji} {label}</h3>
                <p className="constituent-name">{n.name}</p>
                <code className="uuid">{n.uuid}</code>
                <NavLinks nodeUuid={n.uuid} eventId={n.id} />
              </div>
            );
          }
          return (
            <div key={key} className="constituent-card missing">
              <h3>{emoji} {label}</h3>
              <p className="constituent-name">Not yet created</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
