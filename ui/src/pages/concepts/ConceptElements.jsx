import { useState, useMemo, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import DataTable from '../../components/DataTable';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';
import { OWNER_PUBKEY, TA_PUBKEY, DAVE_PUBKEY } from '../../config/pubkeys';

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

  // ── Filter state ──
  const [setFilter, setSetFilter] = useState(''); // '' = superset (all), or a set uuid
  const [authorFilter, setAuthorFilter] = useState('');

  // Fetch all sets for this concept with element counts
  const { data: setsData } = useCypher(`
    MATCH (h:ListHeader {uuid: '${uuid}'})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
    OPTIONAL MATCH path = (sup)-[:IS_A_SUPERSET_OF*0..10]->(s)
    WITH s
    OPTIONAL MATCH (s)-[:IS_A_SUPERSET_OF*0..10]->(ss)-[:HAS_ELEMENT]->(elem)
    WITH s, count(DISTINCT elem) AS elementCount, labels(s) AS nodeLabels
    RETURN s.uuid AS uuid, s.name AS name, elementCount, nodeLabels
    ORDER BY elementCount DESC
  `);

  // Build sorted set options for the dropdown
  const setOptions = useMemo(() => {
    if (!setsData) return [];
    return setsData;
  }, [setsData]);

  // The superset uuid (first entry with Superset label, or first overall)
  const supersetUuid = useMemo(() => {
    if (!setOptions.length) return null;
    const sup = setOptions.find(s => s.nodeLabels?.includes('Superset'));
    return sup?.uuid || setOptions[0]?.uuid || null;
  }, [setOptions]);

  // Active set uuid for filtering: default to superset
  const activeSetUuid = setFilter || supersetUuid;

  // Fetch the concept's JSON schema
  const { data: schemaData } = useCypher(`
    MATCH (h:ListHeader {uuid: '${uuid}'})
    OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
    OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    RETURN head(collect(jt.value)) AS schemaJson
  `);

  // Explicit elements: scoped to the active set (direct + indirect via IS_A_SUPERSET_OF)
  const { data: explicit, loading: l1, error: e1 } = useCypher(
    activeSetUuid ? `
      MATCH (s:NostrEvent {uuid: '${activeSetUuid}'})
        -[:IS_A_SUPERSET_OF*0..10]->(ss)-[:HAS_ELEMENT]->(e:NostrEvent)
      OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
      WITH DISTINCT e, head(collect(j.value)) AS json
      RETURN e.uuid AS uuid, e.name AS name, e.pubkey AS author, json
    ` : null
  );

  // Implicit elements: z-tag points to the concept's uuid (only when viewing superset / all)
  const isSuperset = !setFilter || setFilter === supersetUuid;
  const { data: implicit, loading: l2, error: e2 } = useCypher(
    isSuperset ? `
      MATCH (e:NostrEvent)-[:HAS_TAG]->(zt:NostrEventTag {type: 'z', value: '${uuid}'})
      OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
      WITH DISTINCT e, head(collect(j.value)) AS json
      RETURN e.uuid AS uuid, e.name AS name, e.pubkey AS author, json
    ` : null
  );

  // Merge explicit + implicit, dedup by uuid, mark binding type
  // Only include implicit elements when viewing the superset (top-level)
  const merged = useMemo(() => {
    const implicitList = isSuperset ? (implicit || []) : [];
    const explicitUuids = new Set((explicit || []).map(e => e.uuid));
    const implicitUuids = new Set(implicitList.map(e => e.uuid));
    const byUuid = new Map();

    for (const e of (explicit || [])) {
      byUuid.set(e.uuid, { ...e, isExplicit: true, isImplicit: implicitUuids.has(e.uuid) });
    }
    for (const e of implicitList) {
      if (byUuid.has(e.uuid)) {
        byUuid.get(e.uuid).isImplicit = true;
      } else {
        byUuid.set(e.uuid, { ...e, isExplicit: false, isImplicit: true });
      }
    }

    return [...byUuid.values()].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [explicit, implicit, isSuperset]);

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
          const parsed = typeof schemaRaw === 'string' ? JSON.parse(schemaRaw) : schemaRaw;
          // Extract actual JSON Schema from word-wrapper format if present
          schema = (parsed.jsonSchema && typeof parsed.jsonSchema === 'object') ? parsed.jsonSchema : parsed;
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

  // Author filter options (pinned order)
  const authorOptions = useMemo(() => {
    const pksSet = new Set(authorPubkeys);
    const pinned = [];
    if (pksSet.has(OWNER_PUBKEY)) pinned.push(OWNER_PUBKEY);
    if (pksSet.has(DAVE_PUBKEY)) pinned.push(DAVE_PUBKEY);
    if (pksSet.has(TA_PUBKEY)) pinned.push(TA_PUBKEY);
    const others = authorPubkeys.filter(pk => pk !== OWNER_PUBKEY && pk !== TA_PUBKEY && pk !== DAVE_PUBKEY);
    return [...pinned, ...others];
  }, [authorPubkeys]);

  function authorDisplayName(pk) {
    const p = profiles?.[pk];
    const name = p?.name || p?.display_name;
    const short = pk.slice(0, 8) + '…';
    if (pk === OWNER_PUBKEY) return name ? `👑 ${name}` : `👑 Owner (${short})`;
    if (pk === DAVE_PUBKEY) return name ? `🧑‍💻 ${name}` : `🧑‍💻 Dave (${short})`;
    if (pk === TA_PUBKEY) return name ? `🤖 ${name}` : `🤖 Assistant (${short})`;
    return name ? `${name} (${short})` : short;
  }

  // Apply author filter
  const filteredMerged = useMemo(() => {
    if (!authorFilter) return merged;
    return merged.filter(r => r.author === authorFilter);
  }, [merged, authorFilter]);

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
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-small btn-primary"
            onClick={() => navigate(`/kg/concepts/${encodeURIComponent(uuid)}/elements/new`)}
          >
            + New Element
          </button>
          <button
            className="btn btn-small"
            onClick={() => navigate(`/kg/concepts/${encodeURIComponent(uuid)}/elements/add-node`)}
          >
            🔗 Add Node as Element
          </button>
        </div>
      </div>
      {/* Set filter */}
      {setOptions.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1rem',
          padding: '1rem',
          border: '1px solid var(--border, #444)',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
              🗂️ Set
            </label>
            <select
              value={setFilter}
              onChange={e => setSetFilter(e.target.value)}
              style={{
                width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem',
                backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
                border: '1px solid var(--border, #444)', borderRadius: '4px', cursor: 'pointer',
              }}
            >
              {setOptions.map(s => (
                <option key={s.uuid} value={s.uuid}>
                  {s.name || s.uuid?.slice(0, 20) + '…'}
                  {s.nodeLabels?.includes('Superset') ? ' (Superset)' : ''}
                  {' — '}{s.elementCount} element{s.elementCount !== 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
              👤 Author
            </label>
            <select
              value={authorFilter}
              onChange={e => setAuthorFilter(e.target.value)}
              style={{
                width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem',
                backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
                border: '1px solid var(--border, #444)', borderRadius: '4px', cursor: 'pointer',
              }}
            >
              <option value="">All authors</option>
              {authorOptions.map(pk => (
                <option key={pk} value={pk}>{authorDisplayName(pk)}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading && <div className="loading">Loading elements…</div>}
      {error && <div className="error">Error: {error.message}</div>}
      {!loading && !error && (
        <>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', marginBottom: '0.5rem' }}>
            {filteredMerged.length === merged.length
              ? `${merged.length} elements`
              : `${filteredMerged.length} of ${merged.length} elements`}
          </p>
          <DataTable
            columns={columns}
            data={filteredMerged}
            onRowClick={(row) => navigate(`/kg/concepts/${encodeURIComponent(uuid)}/elements/${encodeURIComponent(row.uuid)}`)}
            emptyMessage="No elements match your filters"
          />
        </>
      )}
    </div>
  );
}
