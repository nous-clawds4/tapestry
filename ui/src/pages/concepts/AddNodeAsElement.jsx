import { useState, useMemo, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCypher } from '../../hooks/useCypher';
import useProfiles from '../../hooks/useProfiles';
import useNeo4jLabels from '../../hooks/useNeo4jLabels';
import AuthorCell from '../../components/AuthorCell';

// Known authors pinned at top of Author selector
import { OWNER_PUBKEY, TA_PUBKEY, DAVE_PUBKEY } from '../../config/pubkeys';

export default function AddNodeAsElement() {
  const { concept, uuid } = useOutletContext();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.classification === 'owner';

  // Filters
  const [nameFilter, setNameFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [uuidFilter, setUuidFilter] = useState('');

  const { labels: nodeLabels } = useNeo4jLabels();

  // Selection
  const [selectedUuid, setSelectedUuid] = useState(null);

  // Fetch distinct authors for the Author dropdown
  const { data: authorRows } = useCypher(`
    MATCH (n:NostrEvent)
    WHERE n.pubkey IS NOT NULL
    WITH DISTINCT n.pubkey AS pk
    RETURN pk ORDER BY pk
  `);
  const authorOptions = useMemo(() => {
    if (!authorRows) return [];
    const others = authorRows
      .map(r => r.pk)
      .filter(pk => pk !== OWNER_PUBKEY && pk !== TA_PUBKEY && pk !== DAVE_PUBKEY);
    const pinned = [];
    // Only include pinned entries if they exist in the data
    const allPks = new Set(authorRows.map(r => r.pk));
    if (allPks.has(OWNER_PUBKEY)) pinned.push(OWNER_PUBKEY);
    if (allPks.has(DAVE_PUBKEY)) pinned.push(DAVE_PUBKEY);
    if (allPks.has(TA_PUBKEY)) pinned.push(TA_PUBKEY);
    return [...pinned, ...others];
  }, [authorRows]);

  // Resolve author profiles for the dropdown labels
  const authorDropdownProfiles = useProfiles(authorOptions);

  function authorDisplayName(pk) {
    const p = authorDropdownProfiles?.get(pk);
    const name = p?.name || p?.display_name;
    const short = pk.slice(0, 8) + '…';
    if (pk === OWNER_PUBKEY) return name ? `👑 ${name}` : `👑 Owner (${short})`;
    if (pk === DAVE_PUBKEY) return name ? `🧑‍💻 ${name}` : `🧑‍💻 Dave (${short})`;
    if (pk === TA_PUBKEY) return name ? `🤖 ${name}` : `🤖 Assistant (${short})`;
    return name ? `${name} (${short})` : short;
  }

  // Fetch existing elements of this concept (to mark duplicates)
  const { data: existingElements } = useCypher(`
    MATCH (h:NostrEvent {uuid: '${uuid}'})-[:IS_THE_CONCEPT_FOR]->(sup)-[:HAS_ELEMENT]->(elem)
    RETURN elem.uuid AS uuid
  `);
  const existingUuids = useMemo(
    () => new Set((existingElements || []).map(r => r.uuid)),
    [existingElements]
  );

  // Build cypher query with filters
  const cypher = useMemo(() => {
    const conditions = [];
    if (labelFilter) {
      conditions.push(`n:${labelFilter}`);
    }
    if (nameFilter.trim()) {
      const escaped = nameFilter.trim().replace(/'/g, "\\'");
      conditions.push(`toLower(n.name) CONTAINS toLower('${escaped}')`);
    }
    if (authorFilter) {
      const escaped = authorFilter.replace(/'/g, "\\'");
      conditions.push(`n.pubkey = '${escaped}'`);
    }
    if (uuidFilter.trim()) {
      const escaped = uuidFilter.trim().replace(/'/g, "\\'");
      conditions.push(`(n.uuid CONTAINS '${escaped}')`);
    }

    const where = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    return `
      MATCH (n:NostrEvent)
      ${where}
      WITH n, labels(n) AS lbls
      WHERE NONE(l IN lbls WHERE l = 'NostrEventTag')
      RETURN n.uuid AS uuid, n.name AS name, n.pubkey AS author, lbls
      ORDER BY n.name
      LIMIT 200
    `;
  }, [nameFilter, labelFilter, authorFilter, uuidFilter]);

  const { data: nodes, loading, error } = useCypher(cypher);

  // Collect author pubkeys for profile resolution
  const authorPubkeys = useMemo(() => {
    if (!nodes) return [];
    const set = new Set();
    for (const row of nodes) {
      if (row.author) set.add(row.author);
    }
    return [...set];
  }, [nodes]);
  const profiles = useProfiles(authorPubkeys);

  // Format labels for display (exclude NostrEvent which everything has)
  function formatLabels(lbls) {
    if (!lbls) return '';
    return (Array.isArray(lbls) ? lbls : [])
      .filter(l => l !== 'NostrEvent')
      .sort()
      .join(', ');
  }

  const selectedNode = useMemo(() => {
    if (!selectedUuid || !nodes) return null;
    return nodes.find(n => n.uuid === selectedUuid);
  }, [selectedUuid, nodes]);

  function handleReview() {
    if (!selectedUuid) return;
    navigate(`/kg/concepts/${encodeURIComponent(uuid)}/elements/add-node/review?node=${encodeURIComponent(selectedUuid)}`);
  }

  return (
    <div>
      <h2>Add Node as Element</h2>
      <p style={{ opacity: 0.7, marginBottom: '1rem' }}>
        Select an existing node to add as an element of <strong>{concept?.name}</strong>.
      </p>

      {!isOwner && (
        <div className="health-banner health-warn" style={{ marginBottom: '1rem' }}>
          <span className="health-banner-icon">🔒</span>
          <span>Sign in as owner to add elements.</span>
        </div>
      )}

      {/* Filters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1rem',
        padding: '1rem',
        border: '1px solid var(--border, #444)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
      }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            🔍 Name
          </label>
          <input
            type="text"
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            placeholder="Search by name…"
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              fontSize: '0.85rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)',
              color: 'var(--text-primary, #e0e0e0)',
              border: '1px solid var(--border, #444)',
              borderRadius: '4px',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            🏷️ Label
          </label>
          <select
            value={labelFilter}
            onChange={e => setLabelFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              fontSize: '0.85rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)',
              color: 'var(--text-primary, #e0e0e0)',
              border: '1px solid var(--border, #444)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <option value="">All labels</option>
            {nodeLabels.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            👤 Author
          </label>
          <select
            value={authorFilter}
            onChange={e => setAuthorFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              fontSize: '0.85rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)',
              color: 'var(--text-primary, #e0e0e0)',
              border: '1px solid var(--border, #444)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <option value="">All authors</option>
            {authorOptions.map(pk => (
              <option key={pk} value={pk}>{authorDisplayName(pk)}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            🔑 UUID
          </label>
          <input
            type="text"
            value={uuidFilter}
            onChange={e => setUuidFilter(e.target.value)}
            placeholder="UUID (partial)…"
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              fontSize: '0.85rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)',
              color: 'var(--text-primary, #e0e0e0)',
              border: '1px solid var(--border, #444)',
              borderRadius: '4px',
            }}
          />
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1rem',
      }}>
        <button
          className="btn btn-primary"
          disabled={!selectedUuid || !isOwner}
          onClick={handleReview}
          title={!selectedUuid ? 'Select a node first' : !isOwner ? 'Sign in as owner' : ''}
        >
          → Review Selection
        </button>
        {selectedNode && (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #888)' }}>
            Selected: <strong style={{ color: 'var(--text-primary, #e0e0e0)' }}>{selectedNode.name}</strong>
            {existingUuids.has(selectedNode.uuid) && (
              <span style={{
                marginLeft: '0.5rem',
                color: '#f59e0b',
                fontSize: '0.8rem',
              }}>
                ⚠️ already an element
              </span>
            )}
          </span>
        )}
        <button
          className="btn"
          style={{ marginLeft: 'auto' }}
          onClick={() => navigate(`/kg/concepts/${encodeURIComponent(uuid)}/elements`)}
        >
          ← Back to Elements
        </button>
      </div>

      {/* Results table */}
      {loading && <div className="loading">Loading nodes…</div>}
      {error && <div className="error">Error: {error.message}</div>}

      {!loading && !error && nodes && (
        <>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', marginBottom: '0.5rem' }}>
            {nodes.length >= 200 ? '200+ results (showing first 200) — refine your filters' : `${nodes.length} nodes found`}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Name</th>
                  <th>Labels</th>
                  <th>Author</th>
                  <th>UUID</th>
                </tr>
              </thead>
              <tbody>
                {nodes.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                      No nodes match your filters.
                    </td>
                  </tr>
                )}
                {nodes.map(row => {
                  const isSelected = selectedUuid === row.uuid;
                  const isExisting = existingUuids.has(row.uuid);
                  return (
                    <tr
                      key={row.uuid}
                      onClick={() => setSelectedUuid(row.uuid)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isSelected
                          ? 'var(--accent-bg, rgba(59, 130, 246, 0.15))'
                          : undefined,
                      }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="radio"
                          name="node-select"
                          checked={isSelected}
                          onChange={() => setSelectedUuid(row.uuid)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <span style={{ fontWeight: isSelected ? 600 : 400 }}>
                          {row.name || <em style={{ opacity: 0.5 }}>unnamed</em>}
                        </span>
                        {isExisting && (
                          <span style={{
                            marginLeft: '0.5rem',
                            fontSize: '0.7rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            fontWeight: 600,
                          }}>
                            already element
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                          {formatLabels(row.lbls)}
                        </span>
                      </td>
                      <td>
                        <AuthorCell pubkey={row.author} profiles={profiles} />
                      </td>
                      <td>
                        <code style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                          {row.uuid?.length > 40 ? row.uuid.slice(0, 20) + '…' + row.uuid.slice(-12) : row.uuid}
                        </code>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
