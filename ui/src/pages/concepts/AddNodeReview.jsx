import { useState, useMemo } from 'react';
import { useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCypher } from '../../hooks/useCypher';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';
import { addNodeAsElement } from '../../api/normalize';

export default function AddNodeReview() {
  const { concept, uuid } = useOutletContext();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.classification === 'owner';
  const [searchParams] = useSearchParams();
  const nodeUuid = searchParams.get('node');

  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  // Fetch the target node details
  const { data: nodeData, loading: nodeLoading } = useCypher(
    nodeUuid
      ? `MATCH (n:NostrEvent {uuid: '${nodeUuid}'})
         RETURN n.name AS name, n.uuid AS uuid, n.pubkey AS author, labels(n) AS labels`
      : null
  );
  const targetNode = nodeData?.[0];

  // Fetch concept's superset and concept graph info
  const { data: conceptData, loading: conceptLoading } = useCypher(`
    MATCH (h:NostrEvent {uuid: '${uuid}'})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
    OPTIONAL MATCH (ctg)-[:IS_THE_CONCEPT_GRAPH_FOR]->(h)
    RETURN sup.uuid AS supersetUuid, sup.name AS supersetName,
           ctg.uuid AS classGraphUuid, ctg.name AS classGraphName
  `);
  const conceptInfo = conceptData?.[0];

  // Check if already an element
  const { data: existingData } = useCypher(
    conceptInfo?.supersetUuid && nodeUuid
      ? `MATCH (sup:NostrEvent {uuid: '${conceptInfo.supersetUuid}'})-[:HAS_ELEMENT]->(n:NostrEvent {uuid: '${nodeUuid}'})
         RETURN count(*) AS cnt`
      : null
  );
  const alreadyElement = existingData?.[0]?.cnt > 0;

  // Profile resolution
  const authorPubkeys = useMemo(
    () => targetNode?.author ? [targetNode.author] : [],
    [targetNode?.author]
  );
  const profiles = useProfiles(authorPubkeys);

  function formatLabels(lbls) {
    if (!lbls) return '';
    return (Array.isArray(lbls) ? lbls : [])
      .filter(l => l !== 'NostrEvent')
      .sort()
      .join(', ');
  }

  async function handleConfirm() {
    setConfirming(true);
    setError(null);
    try {
      const res = await addNodeAsElement({ conceptUuid: uuid, nodeUuid });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setConfirming(false);
    }
  }

  const loading = nodeLoading || conceptLoading;

  if (!nodeUuid) {
    return (
      <div>
        <h2>Review — Add Node as Element</h2>
        <div className="health-banner health-fail" style={{ marginTop: '1rem' }}>
          <span className="health-banner-icon">❌</span>
          <span>No node selected. Go back and select a node first.</span>
        </div>
        <button
          className="btn"
          style={{ marginTop: '1rem' }}
          onClick={() => navigate(`/kg/concepts/${encodeURIComponent(uuid)}/elements/add-node`)}
        >
          ← Back to Node Selection
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2>Review — Add Node as Element</h2>
      <p style={{ opacity: 0.7, marginBottom: '1.5rem' }}>
        Review the details below before adding this node as an element of <strong>{concept?.name}</strong>.
      </p>

      {loading && <div className="loading">Loading…</div>}

      {!loading && result && (
        <div>
          <div className="health-banner health-pass" style={{ marginBottom: '1.5rem' }}>
            <span className="health-banner-icon">✅</span>
            <span>{result.message}</span>
          </div>

          {result.classGraphUpdated && (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)', marginBottom: '1rem' }}>
              📊 Class threads graph updated.
            </p>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button
              className="btn"
              onClick={() => navigate(`/kg/concepts/${encodeURIComponent(uuid)}/elements`)}
            >
              📋 Back to Elements
            </button>
            <button
              className="btn"
              onClick={() => navigate(`/kg/databases/neo4j/nodes/${encodeURIComponent(nodeUuid)}`)}
            >
              🔵 View Node
            </button>
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/kg/concepts/${encodeURIComponent(uuid)}/elements/add-node`)}
            >
              🔗 Add Another
            </button>
          </div>
        </div>
      )}

      {!loading && !result && targetNode && conceptInfo && (
        <div>
          {/* Selected Node Card */}
          <div style={{
            border: '1px solid var(--border, #444)',
            borderRadius: '8px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
            backgroundColor: 'var(--bg-secondary, #1a1a2e)',
          }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>🔵 Selected Node</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '0.35rem 1rem 0.35rem 0', fontWeight: 600, width: '120px', verticalAlign: 'top' }}>Name</td>
                  <td style={{ padding: '0.35rem 0' }}>{targetNode.name || <em style={{ opacity: 0.5 }}>unnamed</em>}</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.35rem 1rem 0.35rem 0', fontWeight: 600, verticalAlign: 'top' }}>Labels</td>
                  <td style={{ padding: '0.35rem 0' }}>
                    <span style={{ fontSize: '0.85rem' }}>{formatLabels(targetNode.labels)}</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.35rem 1rem 0.35rem 0', fontWeight: 600, verticalAlign: 'top' }}>Author</td>
                  <td style={{ padding: '0.35rem 0' }}>
                    <AuthorCell pubkey={targetNode.author} profiles={profiles} />
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.35rem 1rem 0.35rem 0', fontWeight: 600, verticalAlign: 'top' }}>UUID</td>
                  <td style={{ padding: '0.35rem 0' }}>
                    <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{targetNode.uuid}</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Actions Summary */}
          <div style={{
            border: '1px solid var(--border, #444)',
            borderRadius: '8px',
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>📋 Actions to be performed</h3>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', lineHeight: '1.8' }}>
              <li>
                Create <strong>HAS_ELEMENT</strong> relationship in Neo4j:
                <br />
                <code style={{ fontSize: '0.8rem' }}>
                  ({conceptInfo.supersetName || 'Superset'}) —[:HAS_ELEMENT]→ ({targetNode.name})
                </code>
              </li>
              <li>
                Update <strong>concept graph</strong> JSON
                {conceptInfo.classGraphUuid
                  ? <> (<code style={{ fontSize: '0.75rem' }}>{conceptInfo.classGraphUuid.slice(0, 30)}…</code>)</>
                  : <span style={{ color: '#f59e0b' }}> ⚠️ not found — will skip</span>
                }
              </li>
            </ol>

            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: 'var(--bg-secondary, #1a1a2e)',
              borderRadius: '6px',
              fontSize: '0.8rem',
              color: 'var(--text-muted, #888)',
            }}>
              <strong>Not included (future options):</strong>
              <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
                <li>Update z-tag on the element's nostr event to point to this concept</li>
                <li>Wire to a specific Set instead of the Superset</li>
              </ul>
            </div>
          </div>

          {/* Warnings */}
          {alreadyElement && (
            <div className="health-banner health-warn" style={{ marginBottom: '1rem' }}>
              <span className="health-banner-icon">⚠️</span>
              <span>This node is already an element of <strong>{concept?.name}</strong>. Adding it again will have no effect.</span>
            </div>
          )}

          {error && (
            <div className="health-banner health-fail" style={{ marginBottom: '1rem' }}>
              <span className="health-banner-icon">❌</span>
              <span>{error}</span>
            </div>
          )}

          {!isOwner && (
            <div className="health-banner health-warn" style={{ marginBottom: '1rem' }}>
              <span className="health-banner-icon">🔒</span>
              <span>Sign in as owner to perform this action.</span>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button
              className="btn btn-primary"
              disabled={confirming || !isOwner || alreadyElement}
              onClick={handleConfirm}
            >
              {confirming ? '⏳ Adding…' : '✅ Confirm — Add as Element'}
            </button>
            <button
              className="btn"
              disabled={confirming}
              onClick={() => navigate(`/kg/concepts/${encodeURIComponent(uuid)}/elements/add-node`)}
            >
              ← Back to Selection
            </button>
          </div>
        </div>
      )}

      {!loading && !targetNode && (
        <div className="health-banner health-fail" style={{ marginTop: '1rem' }}>
          <span className="health-banner-icon">❌</span>
          <span>Node not found: <code>{nodeUuid}</code></span>
        </div>
      )}
    </div>
  );
}
