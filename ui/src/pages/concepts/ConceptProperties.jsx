import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import DataTable from '../../components/DataTable';

function safeParseJson(val) {
  if (!val) return null;
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch {}
  try { return JSON.parse(val.replace(/""/g, '"')); } catch {}
  return null;
}

export default function ConceptProperties() {
  const { uuid } = useOutletContext();
  const navigate = useNavigate();

  const { data, loading, error } = useCypher(`
    MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h:NostrEvent {uuid: '${uuid}'})
    MATCH (p:Property)-[:IS_A_PROPERTY_OF *1..]->(js)
    OPTIONAL MATCH (p)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
    OPTIONAL MATCH (p)-[:IS_A_PROPERTY_OF]->(parent)
    WITH DISTINCT p, head(collect(j.value)) AS json,
      CASE WHEN parent:JSONSchema THEN null ELSE parent.name END AS parentName
    RETURN p.uuid AS uuid, p.name AS name, json, parentName
    ORDER BY parentName IS NOT NULL, parentName, p.name
  `);

  const columns = [
    {
      key: 'name',
      label: 'Property Name',
      render: (val, row) => row.parentName ? `↳ ${val}` : val,
    },
    { key: 'parentName', label: 'Parent', render: (val) => val || '(top level)' },
    {
      key: 'json',
      label: 'Type',
      render: (val) => {
        if (!val) return '—';
        try {
          const parsed = safeParseJson(val);
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
          const parsed = safeParseJson(val);
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
          const parsed = safeParseJson(val);
          return parsed?.property?.description || '—';
        } catch { return '—'; }
      },
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Property Tree</h2>
        <button
          className="btn btn-small btn-primary"
          onClick={() => navigate(`/kg/concepts/${encodeURIComponent(uuid)}/properties/new`)}
        >
          + New Property
        </button>
      </div>
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
