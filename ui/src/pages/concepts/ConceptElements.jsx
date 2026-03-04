import { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import DataTable from '../../components/DataTable';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';

function ValidationCell({ status, errors }) {
  if (status === 'pending') return <span className="validation-pending" title="Validating…">⏳</span>;
  if (status === 'valid') return <span className="validation-valid" title="Valid">✅</span>;
  if (status === 'invalid') return (
    <span className="validation-invalid" title={errors || 'Invalid'}>❌</span>
  );
  if (status === 'no-json') return <span className="validation-none" title="No JSON data">—</span>;
  if (status === 'no-schema') return <span className="validation-none" title="No schema available">—</span>;
  if (status === 'error') return <span className="validation-error" title={errors || 'Parse error'}>⚠️</span>;
  return <span>—</span>;
}

export default function ConceptElements() {
  const { uuid } = useOutletContext();
  const navigate = useNavigate();

  // Fetch the concept's JSON schema
  const { data: schemaData } = useCypher(`
    MATCH (h:ListHeader {uuid: '${uuid}'})
    OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
    OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    RETURN head(collect(jt.value)) AS schemaJson
  `);

  // Explicit elements: connected via Superset → HAS_ELEMENT
  const { data: explicit, loading: l1, error: e1 } = useCypher(`
    MATCH (h:ListHeader {uuid: '${uuid}'})-[:IS_THE_CONCEPT_FOR]->(s:Superset)
      -[:IS_A_SUPERSET_OF*0..5]->(ss)-[:HAS_ELEMENT]->(e:NostrEvent)
    OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
    WITH DISTINCT e, head(collect(j.value)) AS json
    RETURN e.uuid AS uuid, e.name AS name, e.pubkey AS author, json
  `);

  // Implicit elements: z-tag points to the concept's uuid
  const { data: implicit, loading: l2, error: e2 } = useCypher(`
    MATCH (e:NostrEvent)-[:HAS_TAG]->(zt:NostrEventTag {type: 'z', value: '${uuid}'})
    OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
    WITH DISTINCT e, head(collect(j.value)) AS json
    RETURN e.uuid AS uuid, e.name AS name, e.pubkey AS author, json
  `);

  // Merge explicit + implicit, dedup by uuid, mark binding type
  const merged = useMemo(() => {
    const explicitUuids = new Set((explicit || []).map(e => e.uuid));
    const implicitUuids = new Set((implicit || []).map(e => e.uuid));
    const byUuid = new Map();

    for (const e of (explicit || [])) {
      byUuid.set(e.uuid, { ...e, isExplicit: true, isImplicit: implicitUuids.has(e.uuid) });
    }
    for (const e of (implicit || [])) {
      if (byUuid.has(e.uuid)) {
        byUuid.get(e.uuid).isImplicit = true;
      } else {
        byUuid.set(e.uuid, { ...e, isExplicit: false, isImplicit: true });
      }
    }

    return [...byUuid.values()].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [explicit, implicit]);

  // Async validation state: { [uuid]: { status, errors } }
  const [validationResults, setValidationResults] = useState({});

  useEffect(() => {
    if (!merged.length) return;

    const schemaRaw = schemaData?.[0]?.schemaJson;
    if (!schemaRaw) {
      // No schema — mark all as no-schema
      const results = {};
      for (const el of merged) {
        results[el.uuid] = { status: el.json ? 'no-schema' : 'no-json' };
      }
      setValidationResults(results);
      return;
    }

    // Mark all as pending initially
    const pending = {};
    for (const el of merged) {
      pending[el.uuid] = { status: el.json ? 'pending' : 'no-json' };
    }
    setValidationResults(pending);

    // Validate asynchronously in batches to avoid blocking the UI
    let cancelled = false;

    (async () => {
      try {
        const Ajv = (await import('ajv')).default;
        const ajv = new Ajv({ allErrors: true, strict: false });

        let schema;
        try {
          schema = typeof schemaRaw === 'string' ? JSON.parse(schemaRaw) : schemaRaw;
        } catch {
          // Schema itself is unparseable
          const results = {};
          for (const el of merged) {
            results[el.uuid] = { status: el.json ? 'error' : 'no-json', errors: 'Schema parse error' };
          }
          if (!cancelled) setValidationResults(results);
          return;
        }

        let validate;
        try {
          const { $schema: _, ...schemaNoMeta } = schema;
          validate = ajv.compile(schemaNoMeta);
        } catch (e) {
          const results = {};
          for (const el of merged) {
            results[el.uuid] = { status: el.json ? 'error' : 'no-json', errors: `Schema compile error: ${e.message}` };
          }
          if (!cancelled) setValidationResults(results);
          return;
        }

        const elementsWithJson = merged.filter(el => el.json);
        const BATCH_SIZE = 10;

        for (let i = 0; i < elementsWithJson.length; i += BATCH_SIZE) {
          if (cancelled) return;

          const batch = elementsWithJson.slice(i, i + BATCH_SIZE);
          const batchResults = {};

          for (const el of batch) {
            try {
              const parsed = typeof el.json === 'string' ? JSON.parse(el.json) : el.json;
              const valid = validate(parsed);
              batchResults[el.uuid] = valid
                ? { status: 'valid' }
                : { status: 'invalid', errors: ajv.errorsText(validate.errors) };
            } catch (e) {
              batchResults[el.uuid] = { status: 'error', errors: `JSON parse error: ${e.message}` };
            }
          }

          if (!cancelled) {
            setValidationResults(prev => ({ ...prev, ...batchResults }));
          }

          // Yield to the browser between batches
          if (i + BATCH_SIZE < elementsWithJson.length) {
            await new Promise(r => setTimeout(r, 0));
          }
        }
      } catch (e) {
        console.error('Validation error:', e);
      }
    })();

    return () => { cancelled = true; };
  }, [merged, schemaData]);

  const loading = l1 || l2;
  const error = e1 || e2;

  const authorPubkeys = useMemo(
    () => [...new Set(merged.map(r => r.author).filter(Boolean))],
    [merged]
  );
  const profiles = useProfiles(authorPubkeys);

  const columns = [
    { key: 'name', label: 'Name' },
    {
      key: 'isExplicit',
      label: 'Explicit',
      render: (val) => val ? '✅' : '—',
    },
    {
      key: 'isImplicit',
      label: 'Implicit',
      render: (val) => val ? '✅' : '—',
    },
    {
      key: 'uuid',
      label: <span title="JSON validates against concept schema" style={{ cursor: 'help' }}>✓ Schema</span>,
      render: (val) => {
        const result = validationResults[val] || { status: 'pending' };
        return <ValidationCell status={result.status} errors={result.errors} />;
      },
    },
    {
      key: 'json',
      label: 'JSON Data',
      render: (val) => {
        if (!val) return '—';
        try {
          const parsed = typeof val === 'string' ? JSON.parse(val) : val;
          return <code className="json-preview">{JSON.stringify(parsed, null, 0).slice(0, 80)}…</code>;
        } catch {
          return <code className="json-preview">{String(val).slice(0, 80)}…</code>;
        }
      },
    },
    {
      key: 'author',
      label: 'Author',
      render: (val) => <AuthorCell pubkey={val} profiles={profiles} />,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>Elements</h2>
        <button
          className="btn btn-small btn-primary"
          onClick={() => navigate(`/kg/concepts/${encodeURIComponent(uuid)}/elements/new`)}
        >
          + New Element
        </button>
      </div>
      {loading && <div className="loading">Loading elements…</div>}
      {error && <div className="error">Error: {error.message}</div>}
      {!loading && !error && (
        <DataTable
          columns={columns}
          data={merged}
          onRowClick={(row) => navigate(`/kg/concepts/${encodeURIComponent(uuid)}/elements/${encodeURIComponent(row.uuid)}`)}
          emptyMessage="No elements found"
        />
      )}
    </div>
  );
}
