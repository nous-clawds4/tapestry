import { useOutletContext } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';

function tryParseJson(raw) {
  if (!raw) return null;
  // Try parsing as-is first (Bolt driver returns clean strings)
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch {}
  // Fallback: unescape doubled quotes from CSV parsing
  try { return JSON.parse(raw.replace(/""/g, '"')); } catch {}
  return null;
}

export default function NodeJson() {
  const { uuid } = useOutletContext();

  const { data, loading } = useCypher(`
    MATCH (n {uuid: '${uuid}'})-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
    RETURN j.value AS json
    LIMIT 1
  `);

  const jsonData = data?.[0]?.json ? tryParseJson(data[0].json) : null;

  return (
    <div>
      <h2>📋 JSON Data</h2>
      {loading && <div className="loading">Loading…</div>}
      {!loading && jsonData ? (
        <pre className="json-block">{JSON.stringify(jsonData, null, 2)}</pre>
      ) : !loading ? (
        <p className="placeholder">No JSON representation available for this node.</p>
      ) : null}
    </div>
  );
}
