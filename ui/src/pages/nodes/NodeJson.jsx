import { useOutletContext } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';

function tryParseJson(raw) {
  if (!raw) return null;
  try {
    const cleaned = typeof raw === 'string' ? raw.replace(/\\"/g, '"') : raw;
    return typeof cleaned === 'string' ? JSON.parse(cleaned) : cleaned;
  } catch { return null; }
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
