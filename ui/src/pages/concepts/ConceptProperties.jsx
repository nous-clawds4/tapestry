import { useOutletContext } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import DataTable from '../../components/DataTable';

export default function ConceptProperties() {
  const { uuid } = useOutletContext();

  const { data, loading, error } = useCypher(`
    MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h:ListHeader {uuid: '${uuid}'})
    MATCH (p:Property)-[:IS_A_PROPERTY_OF]->(js)
    OPTIONAL MATCH (p)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
    WITH DISTINCT p, head(collect(j.value)) AS json
    RETURN p.uuid AS uuid, p.name AS name, json
    ORDER BY p.name
  `);

  const columns = [
    { key: 'name', label: 'Property Name' },
    {
      key: 'json',
      label: 'Type',
      render: (val) => {
        if (!val) return '—';
        try {
          const parsed = typeof val === 'string' ? JSON.parse(val.replace(/\\"/g, '"')) : val;
          return parsed?.property?.type || '—';
        } catch { return '—'; }
      },
    },
    {
      key: 'json',
      label: 'Required',
      render: (val) => {
        if (!val) return '—';
        try {
          const parsed = typeof val === 'string' ? JSON.parse(val.replace(/\\"/g, '"')) : val;
          return parsed?.property?.required ? '✅' : '—';
        } catch { return '—'; }
      },
    },
    {
      key: 'json',
      label: 'Description',
      render: (val) => {
        if (!val) return '—';
        try {
          const parsed = typeof val === 'string' ? JSON.parse(val.replace(/\\"/g, '"')) : val;
          return parsed?.property?.description || '—';
        } catch { return '—'; }
      },
    },
  ];

  return (
    <div>
      <h2>Property Tree</h2>
      {loading && <div className="loading">Loading properties…</div>}
      {error && <div className="error">Error: {error.message}</div>}
      {!loading && !error && (
        <DataTable
          columns={columns}
          data={data}
          emptyMessage="No properties found"
        />
      )}
    </div>
  );
}
