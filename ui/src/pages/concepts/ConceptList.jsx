import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';

const QUERY = `
  MATCH (h:NostrEvent)
  WHERE (h:ListHeader OR h:ConceptHeader) AND h.kind IN [9998, 39998]
  OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s:Superset)
  OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
  OPTIONAL MATCH (pp)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)
  OPTIONAL MATCH (props)-[:IS_THE_PROPERTIES_SET_FOR]->(h)
  OPTIONAL MATCH (g1)-[:IS_THE_CORE_GRAPH_FOR]->(h)
  OPTIONAL MATCH (g2)-[:IS_THE_CONCEPT_GRAPH_FOR]->(h)
  OPTIONAL MATCH (g3)-[:IS_THE_PROPERTY_TREE_GRAPH_FOR]->(h)
  OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s)-[:IS_A_SUPERSET_OF*0..5]->(ss)-[:HAS_ELEMENT]->(explicitElem:NostrEvent)
  OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s)-[:IS_A_SUPERSET_OF*0..5]->(setNode)
  OPTIONAL MATCH (p:Property)-[:IS_A_PROPERTY_OF]->(js)
  WITH h,
    count(DISTINCT s) AS supersetCount,
    count(DISTINCT js) AS schemaCount,
    count(DISTINCT pp) AS ppCount,
    count(DISTINCT props) AS propsSetCount,
    count(DISTINCT g1) AS coreGraphCount,
    count(DISTINCT g2) AS conceptGraphCount,
    count(DISTINCT g3) AS propTreeGraphCount,
    count(DISTINCT setNode) AS setCount,
    collect(DISTINCT explicitElem.uuid) AS explicitUuids,
    count(DISTINCT p) AS propertyCount
  OPTIONAL MATCH (implicitElem:NostrEvent)-[:HAS_TAG]->(zt:NostrEventTag {type: 'z', value: h.uuid})
  WITH h, supersetCount, schemaCount, ppCount, propsSetCount, coreGraphCount, conceptGraphCount, propTreeGraphCount, setCount,
    explicitUuids, propertyCount,
    collect(DISTINCT implicitElem.uuid) AS implicitUuids
  WITH h, supersetCount, schemaCount, ppCount, propsSetCount, coreGraphCount, conceptGraphCount, propTreeGraphCount, setCount, propertyCount,
    size(explicitUuids) + size([u IN implicitUuids WHERE NOT u IN explicitUuids]) AS elementCount
  RETURN h.uuid AS uuid,
    h.name AS name,
    h.pubkey AS author,
    CASE WHEN 'ConceptHeader' IN labels(h) THEN 1 ELSE 0 END AS hasConceptHeader,
    supersetCount,
    schemaCount,
    ppCount,
    propsSetCount,
    coreGraphCount,
    conceptGraphCount,
    propTreeGraphCount,
    setCount,
    elementCount,
    propertyCount
  ORDER BY h.name
`;

export default function ConceptList() {
  const { data, loading, error } = useCypher(QUERY);
  const navigate = useNavigate();
  const [healthMap, setHealthMap] = useState({});

  // Fetch audit summary for all concepts
  useEffect(() => {
    fetch('/api/audit/concepts-summary')
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          const map = {};
          for (const item of res.data) {
            map[item.uuid] = item;
          }
          setHealthMap(map);
        }
      })
      .catch(() => {}); // silently fail
  }, []);

  const authorPubkeys = useMemo(
    () => [...new Set((data || []).map(r => r.author).filter(Boolean))],
    [data]
  );
  const profiles = useProfiles(authorPubkeys);

  const check = (val) => parseInt(val) > 0 ? '✅' : '—';
  const num = (val) => parseInt(val) || '—';
  const iconHeader = (icon, tooltip) => <span title={tooltip} style={{ cursor: 'help' }}>{icon}</span>;

  // Merge health status into row data for sorting
  const enrichedData = useMemo(() => {
    if (!data) return [];
    return data.map(row => {
      const h = healthMap[row.uuid];
      const healthSort = h ? (h.status === 'pass' ? 0 : h.status === 'warn' ? 1 : 2) : 3;
      return { ...row, _healthSort: healthSort, _healthSummary: h?.summary || '' };
    });
  }, [data, healthMap]);

  const healthIcon = (val, row) => {
    const h = healthMap[row?.uuid];
    if (!h) return <span style={{ opacity: 0.3 }}>…</span>;
    const icon = h.status === 'pass' ? '✅' : h.status === 'warn' ? '⚠️' : '❌';
    return <span title={h.summary} style={{ cursor: 'help' }}>{icon}</span>;
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: '_healthSort', label: iconHeader('🩺', 'Audit Health'), render: healthIcon },
    { key: 'elementCount', label: iconHeader('📝', 'Elements'), render: num },
    { key: 'setCount', label: iconHeader('🗂️', 'Sets (incl. superset)'), render: num },
    { key: 'propertyCount', label: iconHeader('⚙️', 'Properties (count)'), render: num },
    { key: 'hasConceptHeader', label: iconHeader('🏷️', 'ConceptHeader Label'), render: check },
    { key: 'supersetCount', label: iconHeader('📦', 'Superset'), render: check },
    { key: 'schemaCount', label: iconHeader('📋', 'JSON Schema'), render: check },
    { key: 'ppCount', label: iconHeader('🔑', 'Primary Property'), render: check },
    { key: 'propsSetCount', label: iconHeader('📂', 'Properties Set'), render: check },
    { key: 'propTreeGraphCount', label: iconHeader('🌿', 'Property Tree Graph'), render: check },
    { key: 'coreGraphCount', label: iconHeader('🔗', 'Core Nodes Graph'), render: check },
    { key: 'conceptGraphCount', label: iconHeader('🌳', 'Concept Graph'), render: check },
    {
      key: 'author',
      label: 'Author',
      render: (val) => <AuthorCell pubkey={val} profiles={profiles} />,
    },
  ];

  return (
    <div className="page">
      <Breadcrumbs />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>🧩 Concepts</h1>
        <button className="btn btn-primary" onClick={() => navigate('/kg/concepts/new')}>+ New Concept</button>
      </div>
      <p className="page-description">All concept definitions in the knowledge graph.</p>

      {loading && <div className="loading">Loading concepts…</div>}
      {error && <div className="error">Error: {error.message}</div>}
      {!loading && !error && (
        <DataTable
          columns={columns}
          data={enrichedData}
          onRowClick={(row) => navigate(`/kg/concepts/${encodeURIComponent(row.uuid)}`)}
          emptyMessage="No concepts found"
        />
      )}
    </div>
  );
}
