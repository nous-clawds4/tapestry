import { useOutletContext } from 'react-router-dom';
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
 * Returns { valid, errors[] } where errors is an array of error strings.
 */
async function validateJson(jsonData, schemas) {
  if (!jsonData || !schemas || schemas.length === 0) return null;
  const { default: Ajv } = await import('ajv');
  const results = [];

  for (const { name, schema } of schemas) {
    try {
      const ajv = new Ajv({ allErrors: true, strict: false });
      const { $schema, ...schemaNoMeta } = schema;
      const validate = ajv.compile(schemaNoMeta);
      const valid = validate(jsonData);
      results.push({
        conceptName: name,
        valid,
        errors: valid ? [] : validate.errors.map(e => `${e.instancePath || '/'} ${e.message}`),
      });
    } catch (e) {
      results.push({
        conceptName: name,
        valid: false,
        errors: [e.message],
      });
    }
  }
  return results;
}

function ValidationBadge({ results, loading }) {
  const [showErrors, setShowErrors] = useState(false);

  if (loading) {
    return <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>Validating…</span>;
  }
  if (!results || results.length === 0) {
    return (
      <span style={{ fontSize: '0.8rem', opacity: 0.5, fontStyle: 'italic' }}>
        No schemas to validate against
      </span>
    );
  }

  const allValid = results.every(r => r.valid);
  const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          fontSize: '0.8rem', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 600,
          backgroundColor: allValid ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          color: allValid ? '#22c55e' : '#ef4444',
        }}>
          {allValid ? '✅ Valid' : `❌ ${totalErrors} error${totalErrors !== 1 ? 's' : ''}`}
        </span>
        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
          against {results.length} schema{results.length !== 1 ? 's' : ''}
        </span>
        {!allValid && (
          <button
            onClick={() => setShowErrors(e => !e)}
            style={{
              background: 'none', border: 'none', color: '#ef4444',
              cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline',
              padding: 0,
            }}
          >
            {showErrors ? 'Hide errors' : 'Show errors'}
          </button>
        )}
      </div>
      {showErrors && !allValid && (
        <div style={{
          marginTop: '0.5rem', padding: '0.75rem 1rem', borderRadius: '6px',
          backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          fontSize: '0.85rem', fontFamily: 'monospace',
        }}>
          {results.filter(r => !r.valid).map((r, i) => (
            <div key={i} style={{ marginBottom: i < results.filter(x => !x.valid).length - 1 ? '0.5rem' : 0 }}>
              <strong style={{ color: '#ef4444' }}>{r.conceptName}:</strong>
              <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, listStyle: 'disc' }}>
                {r.errors.map((err, j) => (
                  <li key={j} style={{ opacity: 0.9 }}>{err}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NodeJson() {
  const { node, uuid } = useOutletContext();

  const [activeSource, setActiveSource] = useState('tapestry'); // 'tapestry' | 'neo4j'

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
    fetch(`/api/tapestry-key/${tapestryKey}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setLmdbData(d.success ? d.data : null); })
      .catch(() => { if (!cancelled) setLmdbData(null); })
      .finally(() => { if (!cancelled) setLmdbLoading(false); });
    return () => { cancelled = true; };
  }, [tapestryKey]);

  const lmdbContent = lmdbData?.data;

  // ── Fetch schemas for this node (via concept membership) ──
  // Find schemas through explicit concept membership (element or set → superset → concept header → schema)
  const { data: schemaRows } = useCypher(`
    MATCH (n {uuid: '${uuid}'})
    OPTIONAL MATCH (n)<-[:HAS_ELEMENT|IS_A_SUPERSET_OF*1..6]-(s:Superset)<-[:IS_THE_CONCEPT_FOR]-(h:ListHeader)
    OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
    OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    WITH DISTINCT h.name AS conceptName, head(collect(jt.value)) AS schemaJson
    WHERE schemaJson IS NOT NULL
    RETURN conceptName, schemaJson
  `);

  const schemas = useMemo(() => {
    if (!schemaRows) return [];
    return schemaRows
      .map(r => {
        const parsed = tryParseJson(r.schemaJson);
        if (!parsed) return null;
        // Extract jsonSchema from word-wrapper if present
        const schema = parsed.jsonSchema && typeof parsed.jsonSchema === 'object'
          ? parsed.jsonSchema : parsed;
        return { name: r.conceptName, schema };
      })
      .filter(Boolean);
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

    // Validate tapestryJSON
    if (lmdbContent) {
      // Extract the inner data if it's wrapped (e.g. has a jsonSchema or wordData wrapper)
      const dataToValidate = lmdbContent.jsonSchema || lmdbContent.wordData || lmdbContent;
      promises.push(
        validateJson(dataToValidate, schemas).then(setTapestryValidation)
      );
    } else {
      setTapestryValidation(null);
    }

    // Validate Neo4j tag JSON
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
      <h2>📋 JSON Data</h2>

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
            <strong>tapestryJSON</strong> — The derived/enriched JSON stored in LMDB via the Duality engine.
            This is the canonical representation, rebuilt from the concept graph and may contain
            richer data than the original nostr event tag.
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

          {/* Schema validation */}
          <ValidationBadge results={currentValidation} loading={validationLoading} />
        </>
      ) : !currentLoading ? (
        <p className="placeholder">
          {activeSource === 'tapestry'
            ? 'No tapestryJSON in LMDB for this node.'
            : tagIsLmdbRef
              ? `JSON tag offloaded to LMDB (${rawTagValue})`
              : 'No JSON tag on this node.'
          }
          {/* Still show validation status even when empty */}
          <ValidationBadge results={currentValidation} loading={validationLoading} />
        </p>
      ) : null}
    </div>
  );
}
