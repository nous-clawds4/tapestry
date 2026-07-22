import { useState } from 'react';
import { useParams, useOutletContext, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import { useAuth } from '../../context/AuthContext';
import { deleteRelationship } from '../../api/relationships';
import PlacementDialog from '../../components/PlacementDialog';
import ConfirmDialog from '../../components/ConfirmDialog';

/**
 * Set Detail page — shown within a concept's Organization (Sets) tab.
 * Displays set info, collapsible subsets/supersets, and elements.
 */
export default function SetDetail() {
  const { setUuid } = useParams();
  const { uuid: conceptUuid } = useOutletContext();
  const navigate = useNavigate();
  const decodedSetUuid = decodeURIComponent(setUuid);
  const encodedConceptUuid = encodeURIComponent(conceptUuid);

  const { user } = useAuth();
  const isOwner = user?.classification === 'owner' || user?.classification === 'admin';

  const [graphOpen, setGraphOpen] = useState(false);
  const [elementsOpen, setElementsOpen] = useState(true);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null); // { uuid, name, relType }
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeOutcome, setRemoveOutcome] = useState(null); // { type, message, note }

  // Fetch set info
  const { data: setData, loading: setLoading, error: setError } = useCypher(
    decodedSetUuid ? `
      MATCH (s:NostrEvent {uuid: '${decodedSetUuid}'})
      RETURN s.uuid AS uuid, s.name AS name, s.pubkey AS author,
             labels(s) AS nodeLabels
      LIMIT 1
    ` : null
  );

  // Fetch description from json tag
  const { data: jsonData } = useCypher(
    decodedSetUuid ? `
      MATCH (s:NostrEvent {uuid: '${decodedSetUuid}'})-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
      RETURN t.value AS json
      LIMIT 1
    ` : null
  );

  // Direct supersets (nodes that this set is a subset of)
  const { data: supersets, loading: supersetsLoading, refetch: refetchSupersets } = useCypher(
    decodedSetUuid ? `
      MATCH (parent)-[:IS_A_SUPERSET_OF]->(s:NostrEvent {uuid: '${decodedSetUuid}'})
      RETURN parent.uuid AS uuid, parent.name AS name, labels(parent) AS nodeLabels
      ORDER BY parent.name
    ` : null
  );

  // Direct subsets (nodes that this set is a superset of)
  const { data: subsets, loading: subsetsLoading, refetch: refetchSubsets } = useCypher(
    decodedSetUuid ? `
      MATCH (s:NostrEvent {uuid: '${decodedSetUuid}'})-[:IS_A_SUPERSET_OF]->(child)
      RETURN child.uuid AS uuid, child.name AS name, labels(child) AS nodeLabels
      ORDER BY child.name
    ` : null
  );

  // All elements (direct + indirect via IS_A_SUPERSET_OF chain). The `direct`
  // flag marks rows whose HAS_ELEMENT edge starts at THIS set — only those
  // placements can be removed from this page (AC2 / ADR decision 4).
  const { data: elements, loading: elementsLoading, refetch: refetchElements } = useCypher(
    decodedSetUuid ? `
      MATCH (s:NostrEvent {uuid: '${decodedSetUuid}'})-[:IS_A_SUPERSET_OF*0..10]->(ss)-[:HAS_ELEMENT]->(elem)
      WITH DISTINCT s, elem
      RETURN elem.uuid AS uuid, elem.name AS name, labels(elem) AS nodeLabels,
             EXISTS { MATCH (s)-[:HAS_ELEMENT]->(elem) } AS direct
      ORDER BY elem.name
    ` : null
  );

  function refetchAll() {
    refetchSupersets();
    refetchSubsets();
    refetchElements();
  }

  async function handleRemoveConfirmed() {
    if (!removeTarget || removeBusy) return;
    setRemoveBusy(true);
    try {
      const data = await deleteRelationship({
        fromUuid: decodedSetUuid,
        toUuid: removeTarget.uuid,
        relType: removeTarget.relType,
      });
      if (data.result === 'deleted') {
        setRemoveOutcome({
          type: 'success',
          message: `Removed "${removeTarget.name || removeTarget.uuid}" from this set.`,
          note: data.note || null,
        });
        refetchAll();
      } else {
        setRemoveOutcome({ type: 'nochange', message: 'No change was needed — that placement no longer exists.', note: null });
        refetchAll();
      }
    } catch (err) {
      setRemoveOutcome({ type: 'error', message: err.message, note: null });
    } finally {
      setRemoveBusy(false);
      setRemoveTarget(null);
    }
  }

  const set = setData?.[0];

  // Parse description from JSON
  let description = null;
  if (jsonData?.[0]?.json) {
    try {
      const parsed = JSON.parse(jsonData[0].json);
      const inner = parsed?.jsonSchema || parsed;
      description = inner?.description || parsed?.description;
    } catch {
      // ignore
    }
  }

  const nodeType = (labels) => {
    if (!labels) return '—';
    if (labels.includes('Superset')) return 'Superset';
    if (labels.includes('Set')) return 'Set';
    return labels.filter(l => l !== 'NostrEvent' && l !== 'ListItem').join(', ') || '—';
  };

  const typeColor = (labels) => {
    if (!labels) return '#888';
    if (labels.includes('Superset')) return '#a78bfa';
    if (labels.includes('Set')) return '#38bdf8';
    return '#888';
  };

  if (setLoading) {
    return <div className="loading">Loading set…</div>;
  }

  if (setError) {
    return <div className="error">Error: {setError.message}</div>;
  }

  if (!set) {
    return <p style={{ opacity: 0.5 }}>Set not found.</p>;
  }

  const supersetCount = supersets?.length ?? 0;
  const subsetCount = subsets?.length ?? 0;
  const elementCount = elements?.length ?? 0;

  return (
    <div>
      {/* Back link */}
      <button
        className="btn btn-sm"
        style={{ marginBottom: '1rem' }}
        onClick={() => navigate(`/tapestry/concepts/${encodedConceptUuid}/dag`)}
      >
        ← Back to Sets
      </button>

      {/* Set header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <h2 style={{ margin: '0 0 0.25rem 0' }}>
          {set.name || '(unnamed)'}
        </h2>
        {isOwner && (
          <button className="btn btn-primary btn-small" onClick={() => setPlaceOpen(true)}>
            ＋ Add to this set…
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{
          fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          color: typeColor(set.nodeLabels), fontWeight: 500,
        }}>
          {nodeType(set.nodeLabels)}
        </span>
        <code style={{ fontSize: '0.75rem', opacity: 0.5 }}>{set.uuid}</code>
      </div>

      {description && (
        <p style={{ opacity: 0.8, marginBottom: '1rem', fontStyle: 'italic' }}>
          {description}
        </p>
      )}

      {/* Placement-removal outcome (hazard note never suppressed) */}
      {removeOutcome && (
        <div
          className={`health-banner ${removeOutcome.type === 'success' ? 'health-pass' : removeOutcome.type === 'nochange' ? 'health-warn' : 'health-fail'}`}
          style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}
        >
          <span className="health-banner-icon">
            {removeOutcome.type === 'success' ? '✅' : removeOutcome.type === 'nochange' ? 'ℹ️' : '❌'}
          </span>
          <span>{removeOutcome.message}</span>
        </div>
      )}
      {removeOutcome && removeOutcome.note && (
        <div className="health-banner health-warn" style={{ marginBottom: '0.75rem', fontSize: '0.8rem' }}>
          <span className="health-banner-icon">⚠️</span>
          <span>{removeOutcome.note}</span>
        </div>
      )}

      {/* ── Subsets & Supersets (collapsed by default) ── */}
      <div style={{
        border: '1px solid var(--border, #444)',
        borderRadius: '8px',
        marginBottom: '1rem',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setGraphOpen(o => !o)}
          style={{
            width: '100%', padding: '0.75rem 1rem',
            background: 'var(--bg-secondary, #1a1a2e)',
            border: 'none', color: 'var(--text, #e0e0e0)',
            cursor: 'pointer', textAlign: 'left',
            fontSize: '0.9rem', fontWeight: 600,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>
            {graphOpen ? '▾' : '▸'} Direct Supersets &amp; Subsets
            <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: '0.5rem' }}>
              ({supersetCount} superset{supersetCount !== 1 ? 's' : ''}, {subsetCount} subset{subsetCount !== 1 ? 's' : ''})
            </span>
          </span>
        </button>

        {graphOpen && (
          <div style={{ padding: '0.75rem 1rem' }}>
            {/* Supersets */}
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>
              ⬆️ Direct Supersets ({supersetCount})
            </h4>
            {supersetsLoading && <p style={{ opacity: 0.5 }}>Loading…</p>}
            {!supersetsLoading && supersetCount === 0 && (
              <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>None — this is the top-level superset.</p>
            )}
            {!supersetsLoading && supersetCount > 0 && (
              <table className="data-table" style={{ width: '100%', marginBottom: '1rem' }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {supersets.map(row => (
                    <tr
                      key={row.uuid}
                      onClick={() => navigate(`/tapestry/concepts/${encodedConceptUuid}/dag/${encodeURIComponent(row.uuid)}`)}
                      style={{ cursor: 'pointer' }}
                      className="clickable-row"
                    >
                      <td>{row.name || row.uuid?.slice(0, 20) + '…'}</td>
                      <td><span style={{ color: typeColor(row.nodeLabels) }}>{nodeType(row.nodeLabels)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Subsets */}
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem' }}>
              ⬇️ Direct Subsets ({subsetCount})
            </h4>
            {subsetsLoading && <p style={{ opacity: 0.5 }}>Loading…</p>}
            {!subsetsLoading && subsetCount === 0 && (
              <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>None — this is a leaf set.</p>
            )}
            {!subsetsLoading && subsetCount > 0 && (
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    {isOwner && <th style={{ width: '1%' }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {subsets.map(row => (
                    <tr
                      key={row.uuid}
                      onClick={() => navigate(`/tapestry/concepts/${encodedConceptUuid}/dag/${encodeURIComponent(row.uuid)}`)}
                      style={{ cursor: 'pointer' }}
                      className="clickable-row"
                    >
                      <td>{row.name || row.uuid?.slice(0, 20) + '…'}</td>
                      <td><span style={{ color: typeColor(row.nodeLabels) }}>{nodeType(row.nodeLabels)}</span></td>
                      {isOwner && (
                        <td>
                          <button
                            className="btn btn-small"
                            title="Remove this subset placement from this set"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemoveOutcome(null);
                              setRemoveTarget({ uuid: row.uuid, name: row.name, relType: 'IS_A_SUPERSET_OF' });
                            }}
                          >
                            🗑
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Elements (open by default) ── */}
      <div style={{
        border: '1px solid var(--border, #444)',
        borderRadius: '8px',
        marginBottom: '1rem',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setElementsOpen(o => !o)}
          style={{
            width: '100%', padding: '0.75rem 1rem',
            background: 'var(--bg-secondary, #1a1a2e)',
            border: 'none', color: 'var(--text, #e0e0e0)',
            cursor: 'pointer', textAlign: 'left',
            fontSize: '0.9rem', fontWeight: 600,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <span>
            {elementsOpen ? '▾' : '▸'} Elements
            <span style={{ fontWeight: 400, opacity: 0.6, marginLeft: '0.5rem' }}>
              ({elementCount} element{elementCount !== 1 ? 's' : ''}, direct + indirect)
            </span>
          </span>
        </button>

        {elementsOpen && (
          <div style={{ padding: '0.75rem 1rem' }}>
            {elementsLoading && <p style={{ opacity: 0.5 }}>Loading…</p>}
            {!elementsLoading && elementCount === 0 && (
              <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>No elements in this set.</p>
            )}
            {!elementsLoading && elementCount > 0 && (
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    {isOwner && <th style={{ width: '1%' }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {elements.map(row => (
                    <tr
                      key={row.uuid}
                      onClick={() => navigate(`/tapestry/concepts/${encodedConceptUuid}/elements/${encodeURIComponent(row.uuid)}`)}
                      style={{ cursor: 'pointer' }}
                      className="clickable-row"
                    >
                      <td>{row.name || row.uuid?.slice(0, 20) + '…'}</td>
                      <td>
                        {(row.nodeLabels || [])
                          .filter(l => l !== 'NostrEvent' && l !== 'NostrEventTag')
                          .map(l => (
                            <span key={l} style={{
                              display: 'inline-block', fontSize: '0.72rem', padding: '0.1rem 0.4rem',
                              marginRight: '0.25rem', borderRadius: '4px',
                              backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontWeight: 500,
                            }}>{l}</span>
                          ))}
                      </td>
                      {isOwner && (
                        <td>
                          {/* Only a DIRECT placement can be removed here — indirect
                              rows belong to a descendant set (AC2). */}
                          {row.direct ? (
                            <button
                              className="btn btn-small"
                              title="Remove this element placement from this set"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRemoveOutcome(null);
                                setRemoveTarget({ uuid: row.uuid, name: row.name, relType: 'HAS_ELEMENT' });
                              }}
                            >
                              🗑
                            </button>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove placement?"
        message={`Remove "${removeTarget?.name || removeTarget?.uuid || ''}" from this set? Only this one ${removeTarget?.relType === 'IS_A_SUPERSET_OF' ? 'subset' : 'element'} placement is removed — the node itself is not deleted.`}
        onConfirm={handleRemoveConfirmed}
        onCancel={() => setRemoveTarget(null)}
      />

      <PlacementDialog
        open={placeOpen}
        mode="intoSet"
        conceptUuid={conceptUuid}
        fixedSet={{ uuid: decodedSetUuid, name: set.name }}
        onChanged={refetchAll}
        onClose={() => setPlaceOpen(false)}
      />
    </div>
  );
}
