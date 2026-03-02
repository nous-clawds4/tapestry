import { useOutletContext } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import { useMemo } from 'react';

export default function NodeOverview() {
  const { node, uuid } = useOutletContext();

  const { data: tagRows } = useCypher(`
    MATCH (n {uuid: '${uuid}'})-[:HAS_TAG]->(t:NostrEventTag)
    RETURN t.type AS type, t.value AS value
    ORDER BY t.type
  `);

  const tagMap = useMemo(() => {
    const m = {};
    for (const t of (tagRows || [])) {
      if (!m[t.type]) m[t.type] = [];
      m[t.type].push(t.value);
    }
    return m;
  }, [tagRows]);

  const overviewFields = [
    'name', 'names', 'title', 'titles', 'description', 'slug',
    'alias', 'type', 'd', 'z',
  ];

  return (
    <div>
      <h2>Overview</h2>
      <div className="detail-grid">
        <div className="detail-row">
          <span className="detail-label">UUID</span>
          <code className="detail-value">{node.uuid}</code>
        </div>
        <div className="detail-row">
          <span className="detail-label">Event ID</span>
          <code className="detail-value">{node.id}</code>
        </div>
        <div className="detail-row">
          <span className="detail-label">Author</span>
          <code className="detail-value">{node.pubkey}</code>
        </div>
        <div className="detail-row">
          <span className="detail-label">Kind</span>
          <span className="detail-value">{node.kind}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Created</span>
          <span className="detail-value">
            {node.created_at ? new Date(parseInt(node.created_at) * 1000).toLocaleString() : '—'}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Labels</span>
          <span className="detail-value">
            {(Array.isArray(node.nodeLabels) ? node.nodeLabels : []).map(l => (
              <span key={l} className="label-badge">{l}</span>
            ))}
          </span>
        </div>
        {overviewFields.map(field => {
          const values = tagMap[field];
          if (!values || values.length === 0) return null;
          return (
            <div className="detail-row" key={field}>
              <span className="detail-label">{field}</span>
              <span className="detail-value">{values.join(', ')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
