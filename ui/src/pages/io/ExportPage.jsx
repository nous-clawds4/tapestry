import { useState, useMemo, useCallback } from 'react';
import { useCypher } from '../../hooks/useCypher';

/**
 * Export page — select tapestry nodes and concepts, create export zips.
 * Route: /kg/io/export
 */
export default function ExportPage() {
  const [filter, setFilter] = useState('');
  const [conceptFilter, setConceptFilter] = useState('');
  const [selectedNodes, setSelectedNodes] = useState(new Set());
  const [selectedConcepts, setSelectedConcepts] = useState({});
  // { [uuid]: { uuid, name, conceptGraph: bool, propertyTree: bool, coreNodes: bool } }
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createResult, setCreateResult] = useState(null);

  // Fetch all NostrEvent nodes (tapestry nodes)
  const { data: nodesData, loading: nodesLoading } = useCypher(`
    MATCH (e:NostrEvent)
    RETURN e.uuid AS uuid, e.name AS name, e.kind AS kind
    ORDER BY e.name
  `);

  // Fetch all concept headers (ListHeader nodes)
  const { data: conceptsData, loading: conceptsLoading } = useCypher(`
    MATCH (h:ListHeader)
    RETURN h.uuid AS uuid, h.name AS name
    ORDER BY h.name
  `);

  // Fetch available exports
  const [exports, setExports] = useState([]);
  const [exportsLoading, setExportsLoading] = useState(true);

  useState(() => {
    fetch('/api/io/exports')
      .then(r => r.json())
      .then(data => {
        if (data.success) setExports(data.files || []);
      })
      .catch(() => {})
      .finally(() => setExportsLoading(false));
  });

  // Filter nodes
  const filteredNodes = useMemo(() => {
    if (!nodesData) return [];
    if (!filter) return nodesData;
    const lower = filter.toLowerCase();
    return nodesData.filter(n =>
      (n.name || '').toLowerCase().includes(lower) ||
      (n.uuid || '').toLowerCase().includes(lower)
    );
  }, [nodesData, filter]);

  // Filter concepts
  const filteredConcepts = useMemo(() => {
    if (!conceptsData) return [];
    if (!conceptFilter) return conceptsData;
    const lower = conceptFilter.toLowerCase();
    return conceptsData.filter(c =>
      (c.name || '').toLowerCase().includes(lower) ||
      (c.uuid || '').toLowerCase().includes(lower)
    );
  }, [conceptsData, conceptFilter]);

  // Toggle individual node selection
  const toggleNode = useCallback((uuid) => {
    setSelectedNodes(prev => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  }, []);

  // Toggle concept selection
  const toggleConcept = useCallback((uuid, name) => {
    setSelectedConcepts(prev => {
      if (prev[uuid]) {
        const next = { ...prev };
        delete next[uuid];
        return next;
      }
      return {
        ...prev,
        [uuid]: { uuid, name, conceptGraph: false, propertyTree: false, coreNodes: false },
      };
    });
  }, []);

  // Toggle a graph type for a selected concept
  const toggleGraph = useCallback((uuid, graphKey) => {
    setSelectedConcepts(prev => {
      if (!prev[uuid]) return prev;
      return {
        ...prev,
        [uuid]: { ...prev[uuid], [graphKey]: !prev[uuid][graphKey] },
      };
    });
  }, []);

  // Resolve graph nodes for selected concepts
  const resolveGraphNodes = useCallback(async () => {
    const graphUuids = new Set();
    const conceptEntries = Object.values(selectedConcepts);

    for (const concept of conceptEntries) {
      const graphTypes = [];
      if (concept.conceptGraph) graphTypes.push('IS_THE_CONCEPT_GRAPH_FOR');
      if (concept.propertyTree) graphTypes.push('IS_THE_PROPERTY_TREE_GRAPH_FOR');
      if (concept.coreNodes) graphTypes.push('IS_THE_CORE_GRAPH_FOR');

      if (!graphTypes.length) continue;

      for (const relType of graphTypes) {
        // Fetch graph node JSON
        const rows = await fetchCypher(`
          MATCH (g)-[:${relType}]->(h:ListHeader {uuid: '${concept.uuid}'})
          OPTIONAL MATCH (g)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
          RETURN head(collect(j.value)) AS json
        `);

        const graphJson = rows?.[0]?.json;
        if (!graphJson) continue;

        let parsed;
        try {
          parsed = typeof graphJson === 'string' ? JSON.parse(graphJson) : graphJson;
        } catch { continue; }

        // Extract node UUIDs from graph.nodes array
        const graphNodes = parsed?.graph?.nodes || [];
        for (const node of graphNodes) {
          const nodeUuid = node.uuid || node;
          if (typeof nodeUuid === 'string' && nodeUuid) {
            graphUuids.add(nodeUuid);
          }
        }
      }
    }

    return graphUuids;
  }, [selectedConcepts]);

  // Create export
  const handleCreateExport = useCallback(async () => {
    setCreating(true);
    setCreateError(null);
    setCreateResult(null);

    try {
      // Collect individual node UUIDs
      const allUuids = new Set(selectedNodes);

      // Resolve graph nodes from selected concepts
      const graphUuids = await resolveGraphNodes();
      for (const uuid of graphUuids) {
        allUuids.add(uuid);
      }

      if (allUuids.size === 0) {
        setCreateError('No nodes selected for export');
        setCreating(false);
        return;
      }

      const concepts = Object.values(selectedConcepts).map(c => ({
        uuid: c.uuid,
        name: c.name,
        graphs: {
          conceptGraph: c.conceptGraph,
          propertyTree: c.propertyTree,
          coreNodes: c.coreNodes,
        },
      }));

      const res = await fetch('/api/io/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeUuids: [...allUuids], concepts }),
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Export failed');

      setCreateResult(data);

      // Refresh exports list
      const listRes = await fetch('/api/io/exports');
      const listData = await listRes.json();
      if (listData.success) setExports(listData.files || []);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }, [selectedNodes, selectedConcepts, resolveGraphNodes]);

  const selectedConceptCount = Object.keys(selectedConcepts).length;
  const totalSelected = selectedNodes.size + selectedConceptCount;

  return (
    <div>
      <h1>Export</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Select individual nodes and/or concepts to export as a zip archive.
      </p>

      {/* Individual Node Selection */}
      <section style={{ marginBottom: '2rem' }}>
        <h2>Individual Nodes</h2>
        <div className="form-field" style={{ marginBottom: '0.75rem' }}>
          <input
            type="text"
            placeholder="Filter nodes by name or UUID…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>

        {nodesLoading ? (
          <div className="loading">Loading nodes…</div>
        ) : (
          <div className="data-table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Name</th>
                  <th>Kind</th>
                  <th>UUID</th>
                </tr>
              </thead>
              <tbody>
                {filteredNodes.slice(0, 200).map(n => (
                  <tr key={n.uuid} className="clickable" onClick={() => toggleNode(n.uuid)}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedNodes.has(n.uuid)}
                        onChange={() => toggleNode(n.uuid)}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                    <td>{n.name || '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{n.kind}</td>
                    <td><code style={{ fontSize: '0.8em' }}>{n.uuid}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredNodes.length > 200 && (
              <div style={{ padding: '8px 16px', color: 'var(--text-muted)', fontSize: '0.85em' }}>
                Showing 200 of {filteredNodes.length} nodes. Use the filter to narrow results.
              </div>
            )}
          </div>
        )}
        {selectedNodes.size > 0 && (
          <div style={{ marginTop: '0.5rem', color: 'var(--accent)', fontSize: '0.9em' }}>
            {selectedNodes.size} node{selectedNodes.size !== 1 ? 's' : ''} selected
          </div>
        )}
      </section>

      {/* Concept Selection */}
      <section style={{ marginBottom: '2rem' }}>
        <h2>Concepts</h2>
        <div className="form-field" style={{ marginBottom: '0.75rem' }}>
          <input
            type="text"
            placeholder="Filter concepts by name…"
            value={conceptFilter}
            onChange={e => setConceptFilter(e.target.value)}
          />
        </div>

        {conceptsLoading ? (
          <div className="loading">Loading concepts…</div>
        ) : (
          <div className="data-table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}></th>
                  <th>Concept</th>
                  <th>Concept Graph</th>
                  <th>Property Tree</th>
                  <th>Core Nodes</th>
                </tr>
              </thead>
              <tbody>
                {filteredConcepts.map(c => {
                  const sel = selectedConcepts[c.uuid];
                  return (
                    <tr key={c.uuid}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!sel}
                          onChange={() => toggleConcept(c.uuid, c.name)}
                        />
                      </td>
                      <td>{c.name || '—'}</td>
                      <td>
                        <ToggleSwitch
                          enabled={!!sel?.conceptGraph}
                          disabled={!sel}
                          onChange={() => toggleGraph(c.uuid, 'conceptGraph')}
                        />
                      </td>
                      <td>
                        <ToggleSwitch
                          enabled={!!sel?.propertyTree}
                          disabled={!sel}
                          onChange={() => toggleGraph(c.uuid, 'propertyTree')}
                        />
                      </td>
                      <td>
                        <ToggleSwitch
                          enabled={!!sel?.coreNodes}
                          disabled={!sel}
                          onChange={() => toggleGraph(c.uuid, 'coreNodes')}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {selectedConceptCount > 0 && (
          <div style={{ marginTop: '0.5rem', color: 'var(--accent)', fontSize: '0.9em' }}>
            {selectedConceptCount} concept{selectedConceptCount !== 1 ? 's' : ''} selected
          </div>
        )}
      </section>

      {/* Export Action */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            className="btn btn-primary"
            onClick={handleCreateExport}
            disabled={creating || totalSelected === 0}
          >
            {creating ? 'Creating Export…' : 'Create Export'}
          </button>
          {totalSelected > 0 && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>
              {selectedNodes.size} individual node{selectedNodes.size !== 1 ? 's' : ''},{' '}
              {selectedConceptCount} concept{selectedConceptCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {createError && (
          <div className="health-banner health-fail" style={{ marginTop: '1rem' }}>
            <span className="health-banner-icon">Error</span>
            <span>{createError}</span>
          </div>
        )}

        {createResult && (
          <div className="health-banner health-pass" style={{ marginTop: '1rem' }}>
            <span className="health-banner-icon">Done</span>
            <span>
              Exported {createResult.wordCount} words, {createResult.conceptCount} concepts
              — <strong>{createResult.filename}</strong> ({formatSize(createResult.size)})
            </span>
          </div>
        )}
      </section>

      {/* Available Exports */}
      <section>
        <h2>Available Exports</h2>
        {exportsLoading ? (
          <div className="loading">Loading exports…</div>
        ) : exports.length === 0 ? (
          <div className="placeholder">No exports yet.</div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Size</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {exports.map(f => (
                  <tr key={f.name}>
                    <td><code>{f.name}</code></td>
                    <td>{formatSize(f.size)}</td>
                    <td>{new Date(f.date).toLocaleString()}</td>
                    <td>
                      <a
                        className="btn btn-small"
                        href={`/api/io/exports/${encodeURIComponent(f.name)}`}
                        download
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ── Helpers ── */

async function fetchCypher(query) {
  const res = await fetch('/api/neo4j/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cypher: query }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Query failed');
  return json.data || [];
}

function ToggleSwitch({ enabled, disabled, onChange }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
      <input
        type="checkbox"
        checked={enabled}
        onChange={onChange}
        disabled={disabled}
        style={{ marginRight: 4 }}
      />
      <span style={{ fontSize: '0.85em', color: enabled ? 'var(--green)' : 'var(--text-muted)' }}>
        {enabled ? 'On' : 'Off'}
      </span>
    </label>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
