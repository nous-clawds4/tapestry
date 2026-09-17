import { useState, useEffect, useMemo } from 'react';
import JsonView from '../../components/JsonView';
import { fetchConceptMembers } from '../../api/conceptMembers';

/*
 * ConceptMembersView — the Firmware Explorer's per-concept Elements / Sets view.
 *
 * A master-detail: a name-sorted list of the selected concept's members on the left
 * (with a Direct / Full scope toggle + count), and the clicked member's JSON on the
 * right, defaulting to the collapsible Viewer with a Raw toggle — the same interaction
 * as the core-node views (FirmwareNodeJson). Reused, not re-implemented: JsonView and
 * the .firmware-view-* / .firmware-json-* styles.
 *
 * Data comes from fetchConceptMembers (parameterized /api/neo4j/query); the query logic
 * lives in ../../api/conceptMembers, never inline here.
 */

const SCOPES = [
  { key: 'direct', label: 'Direct' },
  { key: 'full', label: 'Full' },
];
const VIEW_MODES = [
  { key: 'viewer', label: 'Viewer' },
  { key: 'raw', label: 'Raw JSON' },
];

export default function ConceptMembersView({ conceptData, kind }) {
  const headerUuid = conceptData?.nodes?.header?.uuid;
  const noun = kind === 'sets' ? 'set' : 'element';

  const [scope, setScope] = useState('direct');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedUuid, setSelectedUuid] = useState(null);
  const [viewMode, setViewMode] = useState('viewer');

  useEffect(() => {
    if (!headerUuid) { setRows([]); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedUuid(null);
    fetchConceptMembers({ headerUuid, kind, scope })
      .then(data => { if (!cancelled) setRows(Array.isArray(data) ? data : []); })
      .catch(e => { if (!cancelled) setError(e.message || String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [headerUuid, kind, scope]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.name || a.uuid || '').localeCompare(b.name || b.uuid || '')),
    [rows]
  );
  const selected = useMemo(
    () => sorted.find(r => r.uuid === selectedUuid) || null,
    [sorted, selectedUuid]
  );

  if (!headerUuid) {
    return <div className="firmware-members-empty">This concept has no header node — nothing to list.</div>;
  }

  const countText = loading
    ? '…'
    : `${sorted.length} ${noun}${sorted.length === 1 ? '' : 's'}`;

  return (
    <div className="firmware-members">
      {/* Left: scoped list */}
      <div className="firmware-members-list">
        <div className="firmware-members-head">
          <div className="firmware-view-toggle">
            {SCOPES.map(s => (
              <button
                key={s.key}
                className={`firmware-view-btn ${scope === s.key ? 'active' : ''}`}
                onClick={() => setScope(s.key)}
                title={s.key === 'direct'
                  ? `Only ${noun}s attached directly to this concept`
                  : `Also ${noun}s reached through nested sets${kind === 'elements' ? ', plus implicit (z-tagged) members' : ''}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="firmware-members-count">{countText}</span>
        </div>

        {error ? (
          <div className="firmware-members-empty">⚠️ {error}</div>
        ) : loading ? (
          <div className="firmware-members-empty">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="firmware-members-empty">
            No {noun}s for this concept{scope === 'direct' ? ' — try Full.' : '.'}
          </div>
        ) : (
          <ul className="firmware-members-items">
            {sorted.map(r => (
              <li key={r.uuid}>
                <button
                  className={`firmware-members-item ${selectedUuid === r.uuid ? 'active' : ''}`}
                  onClick={() => { setSelectedUuid(r.uuid); setViewMode('viewer'); }}
                  title={r.uuid}
                >
                  {r.name || r.uuid?.slice(-24) || '(unnamed)'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Right: JSON detail */}
      <div className="firmware-members-detail">
        {!selected ? (
          <div className="firmware-members-empty">
            Select {noun === 'set' ? 'a set' : 'an element'} to view its JSON.
          </div>
        ) : (
          <MemberDetail item={selected} viewMode={viewMode} setViewMode={setViewMode} />
        )}
      </div>
    </div>
  );
}

function MemberDetail({ item, viewMode, setViewMode }) {
  const parsed = useMemo(() => {
    if (item.json == null || item.json === '') return { state: 'none' };
    try {
      const obj = typeof item.json === 'string' ? JSON.parse(item.json) : item.json;
      return { state: 'ok', obj };
    } catch {
      return { state: 'raw', raw: String(item.json) };
    }
  }, [item]);

  return (
    <div className="firmware-json-view">
      <div className="firmware-json-header">
        <h3>{item.name || '(unnamed)'}</h3>
        <span className="firmware-json-meta">
          <code className="uuid-short" title={item.uuid}>{item.uuid?.slice(-16)}</code>
        </span>
        {parsed.state === 'ok' && (
          <div className="firmware-view-toggle">
            {VIEW_MODES.map(m => (
              <button
                key={m.key}
                className={`firmware-view-btn ${viewMode === m.key ? 'active' : ''}`}
                onClick={() => setViewMode(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {parsed.state === 'none' ? (
        <div className="firmware-members-empty">This item has no JSON.</div>
      ) : parsed.state === 'raw' ? (
        <pre className="firmware-json-pre">{parsed.raw}</pre>
      ) : viewMode === 'viewer' ? (
        <JsonView data={parsed.obj} />
      ) : (
        <pre className="firmware-json-pre">{JSON.stringify(parsed.obj, null, 2)}</pre>
      )}
    </div>
  );
}
