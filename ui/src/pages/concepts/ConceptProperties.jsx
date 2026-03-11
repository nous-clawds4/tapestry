import { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import { useAuth } from '../../context/AuthContext';
import DataTable from '../../components/DataTable';

function safeParseJson(val) {
  if (!val) return null;
  if (typeof val !== 'string') return val;
  try { return JSON.parse(val); } catch {}
  try { return JSON.parse(val.replace(/""/g, '"')); } catch {}
  return null;
}

export default function ConceptProperties() {
  const { concept, uuid } = useOutletContext();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.classification === 'owner';

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

      {/* Generate JSON Schema from Property Tree */}
      {isOwner && concept?.name && (
        <GenerateSchemaButton concept={concept.name} />
      )}
    </div>
  );
}

function GenerateSchemaButton({ concept }) {
  const [status, setStatus] = useState(null);

  async function handleGenerate() {
    setStatus('loading');
    try {
      const res = await fetch('/api/property/generate-json-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept }),
      });
      const data = await res.json();
      setStatus({
        success: data.success,
        message: data.message || data.error,
      });
    } catch (err) {
      setStatus({ success: false, message: err.message });
    }
  }

  return (
    <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          className="btn"
          onClick={handleGenerate}
          disabled={status === 'loading'}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          {status === 'loading' ? '⏳ Generating…' : '📋 Generate JSON Schema →'}
        </button>
        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
          Rebuild the JSON Schema from this property tree
        </span>
      </div>
      {status && status !== 'loading' && (
        <div style={{
          marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '6px',
          fontSize: '0.85rem',
          backgroundColor: status.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          color: status.success ? '#4ade80' : '#f87171',
          border: `1px solid ${status.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          {status.success ? '✅' : '❌'} {status.message}
        </div>
      )}
    </div>
  );
}
