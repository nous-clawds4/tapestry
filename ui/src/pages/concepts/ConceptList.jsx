import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';

const QUERY = `
  MATCH (h:ListHeader)
  WHERE h.kind IN [9998, 39998]
  OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s:Superset)
  OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
  OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s)-[:IS_A_SUPERSET_OF*0..5]->(ss)-[:HAS_ELEMENT]->(explicitElem:ListItem)
  OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s)-[:IS_A_SUPERSET_OF*1..5]->(setNode)
  OPTIONAL MATCH (p:Property)-[:IS_A_PROPERTY_OF]->(js)
  WITH h,
    count(DISTINCT s) AS supersetCount,
    count(DISTINCT js) AS schemaCount,
    collect(DISTINCT explicitElem.uuid) AS explicitUuids,
    count(DISTINCT setNode) AS setCount,
    count(DISTINCT p) AS propertyCount
  OPTIONAL MATCH (implicitElem:ListItem)-[:HAS_TAG]->(zt:NostrEventTag {type: 'z', value: h.uuid})
  WITH h, supersetCount, schemaCount, explicitUuids, setCount, propertyCount,
    collect(DISTINCT implicitElem.uuid) AS implicitUuids
  WITH h, supersetCount, schemaCount, setCount, propertyCount,
    size(explicitUuids) + size([u IN implicitUuids WHERE NOT u IN explicitUuids]) AS elementCount
  RETURN h.uuid AS uuid,
    h.name AS name,
    h.pubkey AS author,
    supersetCount,
    schemaCount,
    elementCount,
    setCount,
    propertyCount
  ORDER BY h.name
`;

export default function ConceptList() {
  const { data, loading, error } = useCypher(QUERY);
  const navigate = useNavigate();

  const authorPubkeys = useMemo(
    () => [...new Set((data || []).map(r => r.author).filter(Boolean))],
    [data]
  );
  const profiles = useProfiles(authorPubkeys);

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'elementCount', label: 'Elements' },
    {
      key: 'supersetCount',
      label: 'Superset',
      render: (val) => parseInt(val) > 0 ? '✅' : '—',
    },
    {
      key: 'schemaCount',
      label: 'Schema',
      render: (val) => parseInt(val) > 0 ? '✅' : '—',
    },
    { key: 'setCount', label: 'Sets' },
    { key: 'propertyCount', label: 'Properties' },
    {
      key: 'author',
      label: 'Author',
      render: (val) => <AuthorCell pubkey={val} profiles={profiles} />,
    },
  ];

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🧩 Concepts</h1>
      <p className="page-description">All concept definitions in the knowledge graph.</p>

      {loading && <div className="loading">Loading concepts…</div>}
      {error && <div className="error">Error: {error.message}</div>}
      {!loading && !error && (
        <DataTable
          columns={columns}
          data={data}
          onRowClick={(row) => navigate(`/kg/concepts/${encodeURIComponent(row.uuid)}`)}
          emptyMessage="No concepts found"
        />
      )}
    </div>
  );
}
