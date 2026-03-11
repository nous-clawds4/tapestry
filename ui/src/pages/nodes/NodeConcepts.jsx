import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import DataTable from '../../components/DataTable';
import { useMemo } from 'react';

function tryParseJson(raw) {
  if (!raw) return null;
  let parsed = typeof raw === 'string' ? null : raw;
  if (!parsed) {
    try { parsed = JSON.parse(raw); } catch {}
  }
  if (!parsed) {
    try { parsed = JSON.parse(raw.replace(/""/g, '"')); } catch {}
  }
  if (!parsed) return null;
  // Extract actual JSON Schema from word-wrapper format if present
  if (parsed.jsonSchema && typeof parsed.jsonSchema === 'object') {
    return parsed.jsonSchema;
  }
  return parsed;
}

function basicValidate(data, schema) {
  const errors = [];
  if (!schema || !data) return { valid: false, errors: ['Missing data or schema'] };

  let innerSchema = schema;
  if (schema.type === 'object' && schema.properties) {
    const keys = Object.keys(schema.properties);
    if (keys.length === 1 && schema.properties[keys[0]]?.type === 'object') {
      innerSchema = schema.properties[keys[0]];
      data = data[keys[0]] || data;
    }
  }

  if (innerSchema.required) {
    for (const field of innerSchema.required) {
      if (data[field] === undefined || data[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  if (innerSchema.properties) {
    for (const [key, propSchema] of Object.entries(innerSchema.properties)) {
      if (data[key] !== undefined && propSchema.type) {
        const val = data[key];
        const expectedType = propSchema.type;
        let actualType = typeof val;
        if (Array.isArray(val)) actualType = 'array';
        if (val === null) actualType = 'null';
        if (expectedType !== 'any' && actualType !== expectedType) {
          if (expectedType === 'integer' && actualType === 'number' && Number.isInteger(val)) continue;
          errors.push(`${key}: expected ${expectedType}, got ${actualType}`);
        }
        if (propSchema.enum && !propSchema.enum.includes(val)) {
          errors.push(`${key}: value "${val}" not in enum [${propSchema.enum.join(', ')}]`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export default function NodeConcepts() {
  const { uuid } = useOutletContext();
  const navigate = useNavigate();

  // Node's own JSON data (for validation)
  const { data: jsonRows } = useCypher(`
    MATCH (n {uuid: '${uuid}'})-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
    RETURN j.value AS json LIMIT 1
  `);
  const jsonData = jsonRows?.[0]?.json ? tryParseJson(jsonRows[0].json) : null;

  // Explicit membership
  const { data: explicit, loading: l1, error: e1 } = useCypher(`
    MATCH (e {uuid: '${uuid}'})<-[:HAS_ELEMENT]-(ss)<-[:IS_A_SUPERSET_OF*0..5]-(s:Superset)<-[:IS_THE_CONCEPT_FOR]-(h:ListHeader)
    OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
    OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    WITH DISTINCT h, head(collect(jt.value)) AS schemaJson
    RETURN h.uuid AS uuid, h.name AS name, schemaJson
  `);

  // Implicit membership
  const { data: implicit, loading: l2, error: e2 } = useCypher(`
    MATCH (e {uuid: '${uuid}'})-[:HAS_TAG]->(zt:NostrEventTag {type: 'z'})
    MATCH (h:ListHeader {uuid: zt.value})
    OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
    OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    WITH DISTINCT h, head(collect(jt.value)) AS schemaJson
    RETURN h.uuid AS uuid, h.name AS name, schemaJson
  `);

  const concepts = useMemo(() => {
    const byUuid = new Map();
    for (const r of (explicit || [])) {
      byUuid.set(r.uuid, { ...r, isExplicit: true, isImplicit: false });
    }
    for (const r of (implicit || [])) {
      if (byUuid.has(r.uuid)) {
        byUuid.get(r.uuid).isImplicit = true;
        if (r.schemaJson && !byUuid.get(r.uuid).schemaJson) {
          byUuid.get(r.uuid).schemaJson = r.schemaJson;
        }
      } else {
        byUuid.set(r.uuid, { ...r, isExplicit: false, isImplicit: true });
      }
    }
    return [...byUuid.values()];
  }, [explicit, implicit]);

  const conceptsWithValidation = useMemo(() => {
    return concepts.map(c => {
      const schema = tryParseJson(c.schemaJson);
      if (!schema || !jsonData) {
        return { ...c, validates: null, validationErrors: [] };
      }
      const result = basicValidate(jsonData, schema);
      return { ...c, validates: result.valid, validationErrors: result.errors };
    });
  }, [concepts, jsonData]);

  const loading = l1 || l2;
  const error = e1 || e2;

  const columns = [
    {
      key: 'name',
      label: 'Concept',
      render: (val, row) => (
        <span
          className="clickable-text"
          onClick={(e) => { e.stopPropagation(); navigate(`/kg/concepts/${encodeURIComponent(row.uuid)}`); }}
        >
          {val || row.uuid?.slice(0, 20) + '…'}
        </span>
      ),
    },
    { key: 'isExplicit', label: 'Explicit', render: v => v ? '✅' : '—' },
    { key: 'isImplicit', label: 'Implicit', render: v => v ? '✅' : '—' },
    {
      key: 'validates',
      label: 'Validates',
      render: (v, row) => {
        if (v === null) return <span style={{ color: 'var(--text-muted)' }}>no schema</span>;
        if (v) return '✅';
        return (
          <span title={row.validationErrors?.join('\n')} style={{ color: 'var(--red)', cursor: 'help' }}>
            ❌ {row.validationErrors?.length} error{row.validationErrors?.length !== 1 ? 's' : ''}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <h2>🧩 Concept Membership</h2>
      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error">Error: {error.message}</div>}
      {!loading && !error && conceptsWithValidation.length > 0 ? (
        <DataTable
          columns={columns}
          data={conceptsWithValidation}
          emptyMessage="Not an element of any concept"
        />
      ) : !loading && !error ? (
        <p className="placeholder">This node is not an element of any concept.</p>
      ) : null}
    </div>
  );
}
