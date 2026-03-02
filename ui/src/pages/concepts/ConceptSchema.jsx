import { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';

export default function ConceptSchema() {
  const { uuid } = useOutletContext();

  const { data, loading, error } = useCypher(`
    MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h:ListHeader {uuid: '${uuid}'})
    OPTIONAL MATCH (js)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
    WITH js, head(collect(j.value)) AS json
    RETURN js.uuid AS uuid, js.name AS name, js.pubkey AS author, json
    LIMIT 1
  `);

  const schema = data?.[0];
  const authorPubkeys = useMemo(
    () => schema?.author ? [schema.author] : [],
    [schema?.author]
  );
  const profiles = useProfiles(authorPubkeys);

  function prettyJson(raw) {
    if (!raw) return null;
    try {
      const cleaned = typeof raw === 'string' ? raw.replace(/\\"/g, '"') : raw;
      const parsed = typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return String(raw);
    }
  }

  return (
    <div>
      <h2>JSON Schema</h2>
      {loading && <div className="loading">Loading schema…</div>}
      {error && <div className="error">Error: {error.message}</div>}
      {schema && (
        <div className="schema-view">
          <div className="schema-meta">
            <span>UUID: <code>{schema.uuid}</code></span>
            <span>Author: <AuthorCell pubkey={schema.author} profiles={profiles} /></span>
          </div>
          {schema.json ? (
            <pre className="json-block">{prettyJson(schema.json)}</pre>
          ) : (
            <p className="placeholder">No JSON Schema content available.</p>
          )}
        </div>
      )}
      {!loading && !error && !schema && (
        <p className="placeholder">No JSON Schema found for this concept.</p>
      )}
    </div>
  );
}
