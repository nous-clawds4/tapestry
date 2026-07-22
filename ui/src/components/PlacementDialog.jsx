import { useEffect, useMemo, useState } from 'react';
import { useCypher } from '../hooks/useCypher';
import { PLACEMENT_KINDS, buildPlacementOps, filterDestinations } from '../utils/placement';
import { addRelationship, deleteRelationship } from '../api/relationships';

/**
 * Shared placement dialog (ADR graph-curation-ui/0001, Option A).
 *
 * Two modes:
 *  - mode="intoSet": the destination set is fixed (`fixedSet`); the user picks
 *    an existing node of the concept and a placement kind. (Set detail page.)
 *  - mode="forNode": the node is fixed (`fixedNode`); the user picks a
 *    destination set and a kind. An optional `source` placement makes it a
 *    move; without one, the dialog offers the node's current placements as a
 *    "move from" choice (or a plain add). (Element detail, Organization tab.)
 *
 * All direction/ordering/no-op logic lives in ui/src/utils/placement.js; the
 * HTTP calls live in ui/src/api/relationships.js. Every graph-changing
 * success surfaces the server's firmware-install hazard `note` — never
 * suppressed (epic guardrail).
 */
export default function PlacementDialog({
  open,
  mode, // 'intoSet' | 'forNode'
  conceptUuid,
  fixedSet, // { uuid, name } when mode === 'intoSet'
  fixedNode, // { uuid, name } when mode === 'forNode'
  source, // { setUuid, setName, relType } — preselected placement to move
  defaultKind = 'element',
  onChanged,
  onClose,
}) {
  const [kind, setKind] = useState(defaultKind);
  const [selectedUuid, setSelectedUuid] = useState('');
  const [moveFromKey, setMoveFromKey] = useState(''); // '' = plain add (forNode without `source`)
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null); // { type, message, note }

  // Reset per open so a re-opened dialog never shows stale state.
  useEffect(() => {
    if (open) {
      setKind(source && source.relType === PLACEMENT_KINDS.subset ? 'subset' : defaultKind);
      setSelectedUuid('');
      setMoveFromKey('');
      setBusy(false);
      setOutcome(null);
    }
  }, [open, defaultKind, source]);

  const intoSet = mode === 'intoSet';
  const anchorUuid = intoSet ? fixedSet?.uuid : fixedNode?.uuid;

  // Sets/Supersets of the concept (destination options in forNode mode;
  // set-candidates in intoSet mode). Same DAG walk as NewSet.jsx/ConceptDag.jsx.
  const { data: setsData } = useCypher(
    open && conceptUuid ? `
      MATCH (h:NostrEvent {uuid: '${conceptUuid}'})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
      OPTIONAL MATCH path = (sup)-[:IS_A_SUPERSET_OF*0..10]->(s)
      WITH s, length(path) AS depth, labels(s) AS nodeLabels
      RETURN s.uuid AS uuid, s.name AS name, nodeLabels, depth
      ORDER BY depth, name
    ` : null
  );

  // Elements of the concept (node candidates, intoSet mode only).
  const { data: elementsData } = useCypher(
    open && intoSet && conceptUuid ? `
      MATCH (h:NostrEvent {uuid: '${conceptUuid}'})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
      MATCH (sup)-[:IS_A_SUPERSET_OF*0..10]->(ss)-[:HAS_ELEMENT]->(elem)
      WITH DISTINCT elem
      RETURN elem.uuid AS uuid, elem.name AS name, labels(elem) AS nodeLabels
      ORDER BY elem.name
    ` : null
  );

  // Cycle-guard exclusion list (subset kind only; ADR decision 3):
  //  - forNode: descendants of the node (placing it under one closes a cycle);
  //  - intoSet: ancestors of the fixed set (a picked node from among them
  //    would become its own ancestor's child-set).
  const { data: exclusionData } = useCypher(
    open && anchorUuid ? (
      intoSet
        ? `MATCH (x)-[:IS_A_SUPERSET_OF*0..10]->(s:NostrEvent {uuid: '${anchorUuid}'}) RETURN x.uuid AS uuid`
        : `MATCH (n:NostrEvent {uuid: '${anchorUuid}'})-[:IS_A_SUPERSET_OF*0..10]->(d) RETURN d.uuid AS uuid`
    ) : null
  );

  // Current direct placements of the fixed node (forNode without an explicit
  // `source`): offered as an optional "move from" choice.
  const { data: currentPlacements } = useCypher(
    open && !intoSet && !source && fixedNode?.uuid ? `
      MATCH (p)-[r:HAS_ELEMENT|IS_A_SUPERSET_OF]->(e:NostrEvent {uuid: '${fixedNode.uuid}'})
      RETURN p.uuid AS uuid, p.name AS name, type(r) AS relType
      ORDER BY p.name
    ` : null
  );

  const exclusionUuids = useMemo(() => (exclusionData || []).map(r => r.uuid), [exclusionData]);

  const setCandidates = useMemo(() => filterDestinations(setsData || [], {
    nodeUuid: anchorUuid,
    kind,
    descendantUuids: exclusionUuids,
  }), [setsData, anchorUuid, kind, exclusionUuids]);

  const elementCandidates = useMemo(() => filterDestinations(elementsData || [], {
    nodeUuid: anchorUuid,
    kind,
    descendantUuids: exclusionUuids,
  }), [elementsData, anchorUuid, kind, exclusionUuids]);

  const effectiveSource = useMemo(() => {
    if (source) return source;
    if (!moveFromKey) return null;
    const [setUuid, relType] = moveFromKey.split('|');
    const row = (currentPlacements || []).find(p => p.uuid === setUuid && p.relType === relType);
    return row ? { setUuid: row.uuid, setName: row.name, relType: row.relType } : null;
  }, [source, moveFromKey, currentPlacements]);

  if (!open) return null;

  const nodeUuid = intoSet ? selectedUuid : fixedNode?.uuid;
  const destSetUuid = intoSet ? fixedSet?.uuid : selectedUuid;
  const canConfirm = !busy && nodeUuid && destSetUuid;

  async function handleConfirm() {
    let ops;
    try {
      ops = buildPlacementOps({ nodeUuid, destSetUuid, kind, source: effectiveSource || undefined });
    } catch (err) {
      setOutcome({ type: 'error', message: err.message });
      return;
    }
    if (ops.length === 0) {
      setOutcome({ type: 'nochange', message: 'No change — that is already the placement.' });
      return;
    }
    setBusy(true);
    setOutcome(null);
    let addRes;
    try {
      addRes = await addRelationship(ops[0]);
    } catch (err) {
      setOutcome({ type: 'error', message: err.message });
      setBusy(false);
      return;
    }
    let delRes = null;
    if (ops[1]) {
      try {
        delRes = await deleteRelationship(ops[1]);
      } catch (err) {
        // Add-before-delete caps a partial failure at "in both places".
        setOutcome({
          type: 'partial',
          message:
            `The new placement was created, but removing the old one failed (${err.message}). ` +
            `The node is now in BOTH places — retry removing it from "${effectiveSource?.setName || 'the previous set'}".`,
          note: addRes.note || null,
        });
        setBusy(false);
        if (onChanged) onChanged();
        return;
      }
    }
    const changed = addRes.result === 'created' || (delRes && delRes.result === 'deleted');
    if (!changed && addRes.result === 'already-existed') {
      setOutcome({ type: 'nochange', message: 'No change was needed — the placement already existed.' });
    } else {
      setOutcome({
        type: 'success',
        message: delRes ? 'Placement moved.' : 'Placement created.',
        note: addRes.note || (delRes && delRes.note) || null,
      });
    }
    setBusy(false);
    if (changed && onChanged) onChanged();
  }

  const kindLabel = (k) => (k === 'subset' ? 'Subset' : 'Element');
  const relLabel = (relType) => (relType === PLACEMENT_KINDS.subset ? 'subset' : 'element');
  const indent = (depth) => '  '.repeat(depth || 0);

  return (
    <div className="bsp-confirm-overlay" onClick={onClose}>
      <div className="bsp-confirm-box" style={{ maxWidth: 540, width: '92%' }} onClick={e => e.stopPropagation()}>
        <h3 className="bsp-confirm-title">
          {intoSet ? `Add to “${fixedSet?.name || 'this set'}”` : `Place “${fixedNode?.name || 'node'}”`}
        </h3>

        {/* Kind choice */}
        <div style={{ display: 'flex', gap: '1.25rem', margin: '0.75rem 0' }}>
          {['element', 'subset'].map(k => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input
                type="radio"
                name="placement-kind"
                checked={kind === k}
                onChange={() => setKind(k)}
                disabled={busy}
              />
              as {kindLabel(k)} <code style={{ fontSize: '0.72rem', opacity: 0.5 }}>{PLACEMENT_KINDS[k]}</code>
            </label>
          ))}
        </div>

        {/* Picker */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 500 }}>
            {intoSet ? 'Node to place' : 'Destination Set/Superset'}
          </label>
          <select
            value={selectedUuid}
            onChange={e => setSelectedUuid(e.target.value)}
            disabled={busy}
            style={{
              width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.9rem',
              borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
              backgroundColor: 'rgba(255,255,255,0.05)', color: 'inherit',
            }}
          >
            <option value="">— choose —</option>
            {intoSet ? (
              <>
                <optgroup label="Sets">
                  {setCandidates.map(opt => (
                    <option key={opt.uuid} value={opt.uuid}>
                      {opt.name || opt.uuid.slice(0, 20)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Elements">
                  {elementCandidates.map(opt => (
                    <option key={opt.uuid} value={opt.uuid}>
                      {opt.name || opt.uuid.slice(0, 20)}
                    </option>
                  ))}
                </optgroup>
              </>
            ) : (
              setCandidates.map(opt => (
                <option key={opt.uuid} value={opt.uuid}>
                  {indent(opt.depth)}{opt.depth > 0 ? '└ ' : ''}{opt.name || opt.uuid.slice(0, 20)}
                  {(opt.nodeLabels || []).includes('Superset') ? ' (Superset)' : ' (Set)'}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Move-from: fixed source (Element page "Move…") or free choice */}
        {!intoSet && source && (
          <p style={{ fontSize: '0.85rem', opacity: 0.75, marginBottom: '0.75rem' }}>
            Moving from <strong>{source.setName || source.setUuid}</strong> ({relLabel(source.relType)} placement).
          </p>
        )}
        {!intoSet && !source && (currentPlacements || []).length > 0 && (
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 500 }}>
              Existing placement
            </label>
            <select
              value={moveFromKey}
              onChange={e => setMoveFromKey(e.target.value)}
              disabled={busy}
              style={{
                width: '100%', padding: '0.5rem 0.7rem', fontSize: '0.9rem',
                borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)',
                backgroundColor: 'rgba(255,255,255,0.05)', color: 'inherit',
              }}
            >
              <option value="">Keep — add as a new placement</option>
              {(currentPlacements || []).map(p => (
                <option key={`${p.uuid}|${p.relType}`} value={`${p.uuid}|${p.relType}`}>
                  Move from: {p.name || p.uuid.slice(0, 20)} ({relLabel(p.relType)})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Outcome banners */}
        {outcome && (
          <div
            className={`health-banner ${outcome.type === 'success' ? 'health-pass' : outcome.type === 'nochange' ? 'health-warn' : 'health-fail'}`}
            style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}
          >
            <span className="health-banner-icon">
              {outcome.type === 'success' ? '✅' : outcome.type === 'nochange' ? 'ℹ️' : '❌'}
            </span>
            <span>{outcome.message}</span>
          </div>
        )}
        {outcome && outcome.note && (
          <div className="health-banner health-warn" style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>
            <span className="health-banner-icon">⚠️</span>
            <span>{outcome.note}</span>
          </div>
        )}

        <div className="bsp-confirm-buttons">
          <button className="bsp-confirm-cancel" onClick={onClose} disabled={busy}>Close</button>
          <button className="bsp-confirm-ok" onClick={handleConfirm} disabled={!canConfirm}>
            {busy ? 'Working…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
