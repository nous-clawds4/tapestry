import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import { useState, useEffect, useMemo } from 'react';

function tryParseJson(raw) {
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch {}
  try { return JSON.parse(raw.replace(/""/g, '"')); } catch {}
  return null;
}

function isLmdbRef(value) {
  return typeof value === 'string' && value.startsWith('lmdb:');
}

/**
 * Validate a JSON object against one or more schemas using Ajv.
 */
async function validateJson(jsonData, schemas) {
  if (!jsonData || !schemas || schemas.length === 0) return null;
  const { default: Ajv } = await import('ajv');
  const results = [];

  for (const { name, uuid, schema } of schemas) {
    try {
      const ajv = new Ajv({ allErrors: true, strict: false });
      const { $schema, ...schemaNoMeta } = schema;
      const validate = ajv.compile(schemaNoMeta);
      const valid = validate(jsonData);
      results.push({
        conceptName: name,
        schemaUuid: uuid,
        valid,
        errors: valid ? [] : validate.errors.map(e => `${e.instancePath || '/'} ${e.message}`),
      });
    } catch (e) {
      results.push({
        conceptName: name,
        schemaUuid: uuid,
        valid: false,
        errors: [e.message],
      });
    }
  }
  return results;
}

/**
 * Schema list with links and per-schema validation results.
 */
function SchemaList({ schemas, results, loading, navigate }) {
  if (!schemas || schemas.length === 0) {
    return (
      <div style={{ marginTop: '1rem', fontSize: '0.8rem', opacity: 0.5, fontStyle: 'italic' }}>
        No parent JSON Schemas found (this node is not an element of any concept).
      </div>
    );
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>
        📐 Parent JSON Schemas ({schemas.length})
      </h3>
      <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th>Concept</th>
            <th>Schema</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {schemas.map((s, i) => {
            const result = results?.find(r => r.schemaUuid === s.uuid);
            return (
              <tr key={s.uuid || i}>
                <td>{s.name}</td>
                <td>
                  <a
                    className="clickable-text"
                    onClick={() => navigate(`/kg/databases/neo4j/nodes/${encodeURIComponent(s.uuid)}`)}
                    style={{ cursor: 'pointer' }}
                    title={`View schema node: ${s.uuid}`}
                  >
                    {s.schemaName || 'View schema →'}
                  </a>
                </td>
                <td>
                  {loading ? (
                    <span style={{ opacity: 0.5 }}>…</span>
                  ) : result ? (
                    result.valid
                      ? <span style={{ color: '#22c55e' }}>✅ Valid</span>
                      : <SchemaErrors result={result} />
                  ) : (
                    <span style={{ opacity: 0.5 }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SchemaErrors({ result }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <span style={{ color: '#ef4444' }}>
        ❌ {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
      </span>
      {' '}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', color: '#ef4444',
          cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline',
          padding: 0,
        }}
      >
        {open ? 'hide' : 'show'}
      </button>
      {open && (
        <ul style={{
          margin: '0.25rem 0 0 1rem', padding: 0, listStyle: 'disc',
          fontFamily: 'monospace', fontSize: '0.8rem', color: '#ef4444', opacity: 0.9,
        }}>
          {result.errors.map((err, j) => (
            <li key={j}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function NodeJson() {
  const { node, uuid } = useOutletContext();
  const navigate = useNavigate();

  const [activeSource, setActiveSource] = useState('tapestry'); // 'tapestry' | 'neo4j'
  const [deriving, setDeriving] = useState(false);
  const [deriveResult, setDeriveResult] = useState(null); // { success, error? }
  const [refreshCounter, setRefreshCounter] = useState(0); // bump to reload LMDB data

  // ── Neo4j json tag ──
  const { data: tagData, loading: tagLoading } = useCypher(`
    MATCH (n {uuid: '${uuid}'})-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
    RETURN j.value AS json
    LIMIT 1
  `);

  const rawTagValue = tagData?.[0]?.json;
  const tagIsLmdbRef = isLmdbRef(rawTagValue);
  const tagJsonData = tagIsLmdbRef ? null : tryParseJson(rawTagValue);

  // ── LMDB tapestryJSON ──
  const tapestryKey = node?.tapestryKey;
  const [lmdbData, setLmdbData] = useState(undefined);
  const [lmdbLoading, setLmdbLoading] = useState(true);

  useEffect(() => {
    if (!tapestryKey) {
      setLmdbData(null);
      setLmdbLoading(false);
      return;
    }
    let cancelled = false;
    setLmdbLoading(true);
    fetch(`/api/tapestry-key/${tapestryKey}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setLmdbData(d.success ? d.data : null); })
      .catch(() => { if (!cancelled) setLmdbData(null); })
      .finally(() => { if (!cancelled) setLmdbLoading(false); });
    return () => { cancelled = true; };
  }, [tapestryKey, refreshCounter]);

  // ── Derive handler ──
  async function handleDerive() {
    if (!tapestryKey) return;
    setDeriving(true);
    setDeriveResult(null);
    try {
      const resp = await fetch(`/api/tapestry-key/derive/${tapestryKey}`, { method: 'POST' });
      const d = await resp.json();
      if (d.success) {
        setDeriveResult({ success: true });
        // Reload LMDB data and re-resolve schemas
        setRefreshCounter(c => c + 1);
      } else {
        setDeriveResult({ success: false, error: d.error || 'Derivation failed' });
      }
    } catch (e) {
      setDeriveResult({ success: false, error: e.message });
    } finally {
      setDeriving(false);
    }
  }

  const lmdbContent = lmdbData?.data;

  // ── Fetch schemas via element membership (explicit + implicit) ──
  // Explicit: node ←HAS_ELEMENT— set ←IS_A_SUPERSET_OF*— superset ←IS_THE_CONCEPT_FOR— header
  // Implicit: node has a z-tag pointing to the concept header's UUID
  // NOT via IS_A_SUPERSET_OF alone (that's set membership, not element membership).
  const { data: schemaRows } = useCypher(`
    MATCH (n {uuid: '${uuid}'})
    OPTIONAL MATCH (n)<-[:HAS_ELEMENT]-(parentSet)
          <-[:IS_A_SUPERSET_OF*0..10]-(sup:Superset)
          <-[:IS_THE_CONCEPT_FOR]-(h1:ListHeader)
    OPTIONAL MATCH (n)-[:HAS_TAG]->(zt:NostrEventTag {type: 'z'})
    OPTIONAL MATCH (h2:ListHeader {uuid: zt.value})
    WITH collect(DISTINCT h1) + collect(DISTINCT h2) AS headers
    UNWIND headers AS h
    WITH DISTINCT h
    WHERE h IS NOT NULL
    MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
    OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    WITH DISTINCT h.name AS conceptName, js.uuid AS schemaUuid,
         js.name AS schemaName, head(collect(jt.value)) AS schemaJson
    WHERE schemaJson IS NOT NULL
    RETURN conceptName, schemaUuid, schemaName, schemaJson
  `);

  // Resolve schema JSON — may be inline or an LMDB ref that needs fetching
  const [schemas, setSchemas] = useState([]);
  useEffect(() => {
    if (!schemaRows || schemaRows.length === 0) { setSchemas([]); return; }

    let cancelled = false;
    Promise.all(schemaRows.map(async (r) => {
      let raw = r.schemaJson;

      // Resolve LMDB refs via the tapestry-key API
      if (isLmdbRef(raw)) {
        const key = raw.replace('lmdb:', '');
        try {
          const resp = await fetch(`/api/tapestry-key/${key}`);
          const d = await resp.json();
          raw = d.success ? d.data?.data : null;
        } catch {
          raw = null;
        }
      } else {
        raw = tryParseJson(raw);
      }

      if (!raw) return null;
      const schema = raw.jsonSchema && typeof raw.jsonSchema === 'object'
        ? raw.jsonSchema : raw;
      return {
        name: r.conceptName,
        uuid: r.schemaUuid,
        schemaName: r.schemaName,
        schema,
      };
    })).then(results => {
      if (!cancelled) setSchemas(results.filter(Boolean));
    });

    return () => { cancelled = true; };
  }, [schemaRows]);

  // ── Validation state ──
  const [tapestryValidation, setTapestryValidation] = useState(null);
  const [neo4jValidation, setNeo4jValidation] = useState(null);
  const [validationLoading, setValidationLoading] = useState(false);

  useEffect(() => {
    if (schemas.length === 0) {
      setTapestryValidation(null);
      setNeo4jValidation(null);
      return;
    }
    setValidationLoading(true);
    const promises = [];

    if (lmdbContent) {
      const dataToValidate = lmdbContent.jsonSchema || lmdbContent.wordData || lmdbContent;
      promises.push(
        validateJson(dataToValidate, schemas).then(setTapestryValidation)
      );
    } else {
      setTapestryValidation(null);
    }

    if (tagJsonData) {
      const dataToValidate = tagJsonData.jsonSchema || tagJsonData.wordData || tagJsonData;
      promises.push(
        validateJson(dataToValidate, schemas).then(setNeo4jValidation)
      );
    } else {
      setNeo4jValidation(null);
    }

    Promise.all(promises).finally(() => setValidationLoading(false));
  }, [schemas, lmdbContent, tagJsonData]);

  // ── Comparison ──
  const bothExist = tagJsonData && lmdbContent;
  const match = bothExist ? JSON.stringify(tagJsonData) === JSON.stringify(lmdbContent) : null;

  // Current source data
  const currentData = activeSource === 'tapestry' ? lmdbContent : tagJsonData;
  const currentLoading = activeSource === 'tapestry' ? lmdbLoading : tagLoading;
  const currentValidation = activeSource === 'tapestry' ? tapestryValidation : neo4jValidation;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>📋 JSON Data</h2>
        <button
          className="btn btn-primary btn-small"
          onClick={handleDerive}
          disabled={deriving || !tapestryKey}
          title={tapestryKey ? 'Re-derive tapestryJSON from the graph' : 'No tapestryKey — cannot derive'}
        >
          {deriving ? '⏳ Deriving…' : '🔄 Derive'}
        </button>
      </div>

      {deriveResult && (
        <div style={{
          padding: '0.5rem 1rem', borderRadius: '6px', marginBottom: '1rem',
          backgroundColor: deriveResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${deriveResult.success ? '#22c55e' : '#ef4444'}`,
          fontSize: '0.85rem', fontWeight: 600,
          color: deriveResult.success ? '#22c55e' : '#ef4444',
        }}>
          {deriveResult.success
            ? '✅ tapestryJSON re-derived successfully'
            : `❌ ${deriveResult.error}`
          }
        </div>
      )}

      {/* Match indicator when both sources exist */}
      {match !== null && (
        <div style={{
          padding: '0.5rem 1rem', borderRadius: '6px', marginBottom: '1.5rem',
          backgroundColor: match ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${match ? '#22c55e' : '#f59e0b'}`,
          fontSize: '0.85rem', fontWeight: 600,
          color: match ? '#22c55e' : '#f59e0b',
        }}>
          {match
            ? '✅ Neo4j json tag and LMDB tapestryJSON match'
            : '⚠️ Neo4j json tag and LMDB tapestryJSON differ — the derived version in LMDB may contain richer data'
          }
        </div>
      )}

      {/* Toggle buttons */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '1rem' }}>
        <button
          onClick={() => setActiveSource('tapestry')}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid var(--border, #444)',
            borderRadius: '6px 0 0 6px',
            background: activeSource === 'tapestry'
              ? 'var(--accent, #6366f1)' : 'var(--bg-secondary, #1a1a2e)',
            color: activeSource === 'tapestry'
              ? '#fff' : 'var(--text, #e0e0e0)',
            cursor: 'pointer',
            fontWeight: activeSource === 'tapestry' ? 600 : 400,
            fontSize: '0.85rem',
          }}
        >
          🗄️ tapestryJSON
        </button>
        <button
          onClick={() => setActiveSource('neo4j')}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid var(--border, #444)',
            borderLeft: 'none',
            borderRadius: '0 6px 6px 0',
            background: activeSource === 'neo4j'
              ? 'var(--accent, #6366f1)' : 'var(--bg-secondary, #1a1a2e)',
            color: activeSource === 'neo4j'
              ? '#fff' : 'var(--text, #e0e0e0)',
            cursor: 'pointer',
            fontWeight: activeSource === 'neo4j' ? 600 : 400,
            fontSize: '0.85rem',
          }}
        >
          🏷️ Neo4j JSON Tag
        </button>
      </div>

      {/* Description of the active source */}
      <div style={{
        fontSize: '0.8rem', opacity: 0.6, marginBottom: '1rem',
        padding: '0.5rem 0.75rem', borderRadius: '4px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        borderLeft: '3px solid var(--accent, #6366f1)',
      }}>
        {activeSource === 'tapestry' ? (
          <>
            <strong>tapestryJSON</strong> — Verbose JSON data file derived dynamically from the graph and stored in LMDB via the Duality engine.
            It is typically not an exact match of the json stored in the nostr event json tag.
            {tapestryKey && (
              <span style={{ display: 'block', marginTop: '0.25rem' }}>
                Key: <code>{tapestryKey}</code>
              </span>
            )}
          </>
        ) : (
          <>
            <strong>Neo4j JSON Tag</strong> — The raw JSON from the nostr event's <code>json</code> tag,
            stored as-is when the event was imported into Neo4j.
            {tagIsLmdbRef && (
              <span style={{ display: 'block', marginTop: '0.25rem', color: '#22c55e' }}>
                ℹ️ This tag has been offloaded to LMDB ({rawTagValue}). The original inline value is no longer in Neo4j.
              </span>
            )}
          </>
        )}
      </div>

      {/* JSON content */}
      {currentLoading && <div className="loading">Loading…</div>}

      {!currentLoading && currentData ? (
        <>
          <pre className="json-block">{JSON.stringify(currentData, null, 2)}</pre>

          {/* Metadata for tapestryJSON */}
          {activeSource === 'tapestry' && lmdbData?.updatedAt && (
            <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.5rem' }}>
              Last updated: {new Date(lmdbData.updatedAt * 1000).toLocaleString()}
              {lmdbData.rebuiltFrom && <> · Rebuilt from: {lmdbData.rebuiltFrom}</>}
            </div>
          )}

          {/* Badges for Neo4j source */}
          {activeSource === 'neo4j' && (
            <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.5rem' }}>
              {tagIsLmdbRef ? 'Offloaded to LMDB' : 'Stored inline in Neo4j'}
            </div>
          )}
        </>
      ) : !currentLoading ? (
        <p className="placeholder">
          {activeSource === 'tapestry'
            ? 'No tapestryJSON in LMDB for this node.'
            : tagIsLmdbRef
              ? `JSON tag offloaded to LMDB (${rawTagValue})`
              : 'No JSON tag on this node.'
          }
        </p>
      ) : null}

      {/* Schema list with validation results */}
      <SchemaList
        schemas={schemas}
        results={currentValidation}
        loading={validationLoading}
        navigate={navigate}
      />
    </div>
  );
}
