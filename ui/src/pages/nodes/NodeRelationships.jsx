import { useOutletContext, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';

export default function NodeRelationships() {
  const { uuid } = useOutletContext();
  const navigate = useNavigate();

  const { data: outgoing, loading: l1, error: e1 } = useCypher(`
    MATCH (n {uuid: '${uuid}'})-[r]->(target)
    RETURN type(r) AS relType, target.uuid AS otherUuid,
           target.name AS otherName, labels(target) AS otherLabels
  `);

  const { data: incoming, loading: l2, error: e2 } = useCypher(`
    MATCH (source)-[r]->(n {uuid: '${uuid}'})
    RETURN type(r) AS relType, source.uuid AS otherUuid,
           source.name AS otherName, labels(source) AS otherLabels
  `);

  const relationships = [
    ...(outgoing || []).map(r => ({ ...r, direction: 'outgoing' })),
    ...(incoming || []).map(r => ({ ...r, direction: 'incoming' })),
  ];

  const loading = l1 || l2;
  const error = e1 || e2;

  return (
    <div>
      <h2>🔗 Relationships</h2>
      {loading && <div className="loading">Loading…</div>}
      {error && <div className="error">Error: {error.message}</div>}
      {!loading && !error && relationships.length > 0 ? (
        <div className="relationships-list">
          {relationships.map((rel, i) => (
            <div key={i} className="relationship-row">
              {rel.direction === 'incoming' ? (
                <>
                  <span
                    className="rel-node clickable-text"
                    onClick={() => rel.otherUuid && navigate(`/kg/databases/neo4j/nodes/${encodeURIComponent(rel.otherUuid)}`)}
                  >
                    {rel.otherName || rel.otherUuid?.slice(0, 20) + '…'}
                    {rel.otherLabels && Array.isArray(rel.otherLabels) && (
                      <span className="rel-labels">{rel.otherLabels.filter(l => l !== 'NostrEvent').join(', ')}</span>
                    )}
                  </span>
                  <span className="rel-arrow">—[<span className="rel-type">{rel.relType}</span>]→</span>
                  <span className="rel-node self">this node</span>
                </>
              ) : (
                <>
                  <span className="rel-node self">this node</span>
                  <span className="rel-arrow">—[<span className="rel-type">{rel.relType}</span>]→</span>
                  <span
                    className="rel-node clickable-text"
                    onClick={() => rel.otherUuid && navigate(`/kg/databases/neo4j/nodes/${encodeURIComponent(rel.otherUuid)}`)}
                  >
                    {rel.otherName || rel.otherUuid?.slice(0, 20) + '…'}
                    {rel.otherLabels && Array.isArray(rel.otherLabels) && (
                      <span className="rel-labels">{rel.otherLabels.filter(l => l !== 'NostrEvent').join(', ')}</span>
                    )}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      ) : !loading && !error ? (
        <p className="placeholder">No relationships found.</p>
      ) : null}
    </div>
  );
}
