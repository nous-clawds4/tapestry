import { useState, useEffect, useCallback } from 'react';
import { fetchFirmwareManifest, fetchFirmwareConcept } from '../../api/firmware';

const CORE_NODES = [
  { key: 'overview',        label: 'Overview' },
  { key: 'header',          label: 'Concept Header' },
  { key: 'superset',        label: 'Superset' },
  { key: 'schema',          label: 'JSON Schema' },
  { key: 'primaryProperty', label: 'Primary Property' },
  { key: 'properties',      label: 'Properties' },
  { key: 'ptGraph',         label: 'Property Tree Graph' },
  { key: 'coreGraph',       label: 'Core Nodes Graph' },
  { key: 'conceptGraph',    label: 'Concept Graph' },
];

export default function FirmwareExplorer() {
  const [manifest, setManifest] = useState(null);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [selectedNode, setSelectedNode] = useState('overview');
  const [conceptData, setConceptData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [conceptLoading, setConceptLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load manifest on mount
  useEffect(() => {
    fetchFirmwareManifest()
      .then(data => {
        setManifest(data);
        if (data.concepts.length > 0) {
          setSelectedSlug(data.concepts[0].slug);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Load concept data when selection changes
  const loadConcept = useCallback((slug) => {
    if (!slug) return;
    setConceptLoading(true);
    fetchFirmwareConcept(slug)
      .then(data => { setConceptData(data); setError(null); })
      .catch(e => setError(e.message))
      .finally(() => setConceptLoading(false));
  }, []);

  useEffect(() => {
    if (selectedSlug) loadConcept(selectedSlug);
  }, [selectedSlug, loadConcept]);

  if (loading) return <div className="loading">Loading firmware manifest…</div>;
  if (error && !manifest) return <div className="error">Error: {error}</div>;

  return (
    <div className="firmware-explorer">
      <div className="firmware-header">
        <h3>🔧 Firmware Explorer</h3>
        {manifest && (
          <span className="firmware-version">
            v{manifest.version} · {manifest.concepts.length} concepts
          </span>
        )}
      </div>

      <div className="firmware-layout">
        {/* Left: concept list */}
        <div className="firmware-sidebar">
          <div className="firmware-sidebar-header">Concepts</div>
          {manifest?.concepts.map(c => (
            <button
              key={c.slug}
              className={`firmware-concept-btn ${selectedSlug === c.slug ? 'active' : ''}`}
              onClick={() => setSelectedSlug(c.slug)}
              title={c.description}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Right: content area */}
        <div className="firmware-content">
          {/* Top: node selector tabs */}
          <div className="firmware-node-tabs">
            {CORE_NODES.map(n => (
              <button
                key={n.key}
                className={`firmware-node-tab ${selectedNode === n.key ? 'active' : ''}`}
                onClick={() => setSelectedNode(n.key)}
              >
                {n.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="firmware-node-content">
            {conceptLoading ? (
              <div className="loading">Loading…</div>
            ) : !conceptData ? (
              <div className="empty">Select a concept</div>
            ) : !conceptData.installed ? (
              <div className="firmware-not-installed">
                <h3>⚠️ Not Installed</h3>
                <p>
                  <strong>{conceptData.name}</strong> is defined in firmware but not yet installed in the graph.
                  Run <code>tapestry firmware install</code> to create it.
                </p>
              </div>
            ) : selectedNode === 'overview' ? (
              <FirmwareOverview data={conceptData} />
            ) : (
              <FirmwareNodeJson data={conceptData} nodeKey={selectedNode} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FirmwareOverview({ data }) {
  const nodeEntries = Object.entries(data.nodes || {});
  const existCount = nodeEntries.filter(([, v]) => v.uuid).length;
  const jsonCount = nodeEntries.filter(([, v]) => v.json).length;

  return (
    <div className="firmware-overview">
      <h2>{data.title || data.name}</h2>
      <p className="firmware-description">{data.description}</p>

      <table className="data-table" style={{ marginTop: '1.5rem' }}>
        <thead>
          <tr>
            <th>Core Node</th>
            <th>Exists</th>
            <th>JSON</th>
            <th>Name</th>
            <th>UUID</th>
          </tr>
        </thead>
        <tbody>
          {CORE_NODES.filter(n => n.key !== 'overview').map(n => {
            const node = data.nodes[n.key];
            return (
              <tr key={n.key}>
                <td><strong>{n.label}</strong></td>
                <td>{node?.uuid ? '✅' : '❌'}</td>
                <td>{node?.json ? '✅' : node?.uuid ? '❌' : '—'}</td>
                <td>{node?.name || '—'}</td>
                <td>
                  <code className="uuid-short" title={node?.uuid}>
                    {node?.uuid?.slice(-12) || '—'}
                  </code>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="firmware-overview-stats" style={{ marginTop: '1rem', opacity: 0.7 }}>
        {existCount}/8 nodes exist · {jsonCount}/8 have JSON
      </div>
    </div>
  );
}

function FirmwareNodeJson({ data, nodeKey }) {
  const nodeInfo = CORE_NODES.find(n => n.key === nodeKey);
  const node = data.nodes[nodeKey];

  if (!node?.uuid) {
    return (
      <div className="firmware-missing-node">
        <h3>{nodeInfo?.label || nodeKey}</h3>
        <p>This core node does not exist for <strong>{data.name}</strong>.</p>
      </div>
    );
  }

  if (!node.json) {
    return (
      <div className="firmware-missing-json">
        <h3>{nodeInfo?.label || nodeKey}</h3>
        <p>Node exists but has no JSON tag.</p>
        <p><code className="uuid-short">{node.uuid}</code></p>
      </div>
    );
  }

  return (
    <div className="firmware-json-view">
      <div className="firmware-json-header">
        <h3>{nodeInfo?.label || nodeKey}</h3>
        <span className="firmware-json-meta">
          {node.name} · <code className="uuid-short" title={node.uuid}>{node.uuid?.slice(-16)}</code>
        </span>
      </div>
      <pre className="firmware-json-pre">
        {JSON.stringify(node.json, null, 2)}
      </pre>
    </div>
  );
}
