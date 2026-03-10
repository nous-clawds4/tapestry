import { useState, useEffect, useCallback } from 'react';
import {
  fetchFirmwareManifest, fetchFirmwareConcept,
  fetchFirmwareVersions, fetchInstallStatus, installFirmware,
} from '../../api/firmware';

const CORE_NODES = [
  { key: 'overview',        label: 'Overview' },
  { key: 'header',          label: 'Concept Header' },
  { key: 'superset',        label: 'Superset' },
  { key: 'schema',          label: 'JSON Schema' },
  { key: 'primaryProperty', label: 'Primary Property' },
  { key: 'properties',      label: 'Properties Set' },
  { key: 'ptGraph',         label: 'Property Tree Graph' },
  { key: 'coreGraph',       label: 'Core Nodes Graph' },
  { key: 'conceptGraph',    label: 'Concept Graph' },
];

export default function FirmwareExplorer() {
  const [manifest, setManifest] = useState(null);
  const [versions, setVersions] = useState(null);
  const [activeDir, setActiveDir] = useState(null);
  const [installStatus, setInstallStatus] = useState(null);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [selectedNode, setSelectedNode] = useState('overview');
  const [conceptData, setConceptData] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [conceptLoading, setConceptLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState(null);
  const [error, setError] = useState(null);

  // Load everything on mount
  useEffect(() => {
    Promise.all([
      fetchFirmwareManifest().catch(e => ({ error: e.message })),
      fetchFirmwareVersions().catch(e => ({ error: e.message })),
      fetchInstallStatus().catch(e => ({ error: e.message })),
    ]).then(([man, ver, status]) => {
      if (!man.error) {
        setManifest(man);
        if (man.concepts?.length > 0) setSelectedSlug(man.concepts[0].slug);
      }
      if (!ver.error) {
        setVersions(ver.versions);
        setActiveDir(ver.activeDir);
      }
      if (!status.error) setInstallStatus(status);
    }).finally(() => setLoading(false));
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

  async function handleInstall() {
    if (!confirm('Install firmware? This will create all firmware concepts, elements, and relationship types in the knowledge graph.')) return;
    setInstalling(true);
    setInstallResult(null);
    setError(null);
    try {
      const result = await installFirmware();
      setInstallResult(result);
      // Refresh install status
      const status = await fetchInstallStatus();
      setInstallStatus(status);
    } catch (e) {
      setError(e.message);
    } finally {
      setInstalling(false);
    }
  }

  if (loading) return <div className="loading">Loading firmware…</div>;

  return (
    <div className="firmware-explorer">
      {/* ── Install Status Banner ── */}
      <InstallStatusBanner
        installStatus={installStatus}
        versions={versions}
        activeDir={activeDir}
        manifest={manifest}
        installing={installing}
        onInstall={handleInstall}
      />

      {/* Install result */}
      {installResult && (
        <div style={{
          padding: '0.75rem 1rem', margin: '0.75rem 0', borderRadius: '8px',
          backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
        }}>
          <strong style={{ color: '#22c55e' }}>✅ Firmware installed!</strong>
          {installResult.pass1 && (
            <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '0.3rem' }}>
              Pass 1: {Object.keys(installResult.pass1.results || {}).length} concepts created,
              {' '}{installResult.pass1.errors?.length || 0} errors
            </div>
          )}
          {installResult.pass2 && (
            <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              Pass 2: {installResult.pass2.updated?.length || 0} schemas enriched,
              {' '}{installResult.pass2.errors?.length || 0} errors
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{
          padding: '0.75rem 1rem', margin: '0.75rem 0', borderRadius: '8px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
        }}>
          ❌ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>dismiss</button>
        </div>
      )}

      {/* ── Manifest Preview ── */}
      {manifest && (
        <>
          <div className="firmware-header">
            <h3>🔧 Firmware Explorer</h3>
            <span className="firmware-version">
              v{manifest.version} · {manifest.concepts.length} concepts · {manifest.relationshipTypes?.length || 0} relationship types
            </span>
          </div>

          <div className="firmware-layout">
            {/* Left: concept list */}
            <div className="firmware-sidebar">
              <div className="firmware-sidebar-header">
                <select
                  className="firmware-category-select"
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                >
                  <option value="all">All ({manifest.concepts.length})</option>
                  {manifest.categories?.map(cat => {
                    const count = manifest.concepts.filter(c => c.categories.includes(cat)).length;
                    return (
                      <option key={cat} value={cat}>
                        {cat} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>
              {manifest.concepts
                .filter(c => selectedCategory === 'all' || c.categories.includes(selectedCategory))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(c => (
                  <button
                    key={c.slug}
                    className={`firmware-concept-btn ${selectedSlug === c.slug ? 'active' : ''}`}
                    onClick={() => setSelectedSlug(c.slug)}
                    title={c.description}
                  >
                    {c.name}
                    {installStatus && !installStatus.installed && installStatus.installedSlugs?.includes(c.slug) && (
                      <span style={{ marginLeft: '0.3rem', fontSize: '0.7rem', opacity: 0.6 }}>✅</span>
                    )}
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
                    </p>
                    {!installStatus?.installed && (
                      <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                        Use the <strong>Install Firmware</strong> button above to create all firmware concepts.
                      </p>
                    )}
                  </div>
                ) : selectedNode === 'overview' ? (
                  <FirmwareOverview data={conceptData} />
                ) : (
                  <FirmwareNodeJson data={conceptData} nodeKey={selectedNode} />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Install Status Banner ── */

function InstallStatusBanner({ installStatus, versions, activeDir, manifest, installing, onInstall }) {
  const isInstalled = installStatus?.installed;
  const isPartial = installStatus?.partial;

  return (
    <div style={{
      padding: '1rem 1.25rem', marginBottom: '1rem', borderRadius: '8px',
      border: `1px solid ${isInstalled ? 'rgba(34, 197, 94, 0.3)' : isPartial ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
      backgroundColor: isInstalled ? 'rgba(34, 197, 94, 0.05)' : isPartial ? 'rgba(245, 158, 11, 0.05)' : 'rgba(239, 68, 68, 0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>
              {isInstalled ? '✅' : isPartial ? '⚠️' : '📦'}
            </span>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>
              {isInstalled ? 'Firmware Installed' : isPartial ? 'Firmware Partially Installed' : 'Firmware Not Installed'}
            </h3>
          </div>

          {installStatus && (
            <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              {isInstalled ? (
                <span>All {installStatus.totalCount} concepts are installed (v{installStatus.activeVersion}).</span>
              ) : isPartial ? (
                <span>
                  {installStatus.installedCount} of {installStatus.totalCount} concepts installed.
                  Missing: {installStatus.missing.slice(0, 5).join(', ')}
                  {installStatus.missing.length > 5 ? ` +${installStatus.missing.length - 5} more` : ''}
                </span>
              ) : (
                <span>No firmware concepts found in the knowledge graph. Install firmware to create the foundational meta-concepts.</span>
              )}
            </div>
          )}

          {/* Available versions */}
          {versions && versions.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', opacity: 0.7 }}>
                Available Versions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {versions.map(v => (
                  <div key={v.dir} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.3rem 0.5rem', borderRadius: '4px',
                    backgroundColor: v.dir === activeDir ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                  }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: v.dir === activeDir ? 600 : 400 }}>
                      v{v.version}
                    </span>
                    {v.dir === activeDir && (
                      <span style={{
                        fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#818cf8',
                      }}>
                        active
                      </span>
                    )}
                    <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                      {v.date} · {v.conceptCount} concepts · {v.relationshipTypeCount} rel types
                    </span>
                    {v.description && (
                      <span style={{ fontSize: '0.75rem', opacity: 0.5, fontStyle: 'italic' }}>
                        — {v.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manifest summary for active version */}
          {manifest && !isInstalled && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', opacity: 0.7 }}>
                Active Firmware Summary (v{manifest.version})
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', opacity: 0.7 }}>
                <span>🧩 {manifest.concepts.length} concepts</span>
                <span>🔗 {manifest.relationshipTypes?.length || 0} relationship types</span>
                <span>📂 {Object.keys(manifest.elements || {}).length} element categories</span>
              </div>
              {manifest.relationshipTypes && manifest.relationshipTypes.length > 0 && (
                <details style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                  <summary style={{ cursor: 'pointer', opacity: 0.7 }}>
                    Relationship Types ({manifest.relationshipTypes.length})
                  </summary>
                  <div style={{ marginTop: '0.3rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {manifest.relationshipTypes.map(rt => (
                      <span key={rt.slug} style={{
                        fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)',
                      }} title={rt.description || ''}>
                        {rt.alias || rt.slug}
                      </span>
                    ))}
                  </div>
                </details>
              )}
              {manifest.concepts && manifest.concepts.length > 0 && (
                <details style={{ marginTop: '0.3rem', fontSize: '0.8rem' }}>
                  <summary style={{ cursor: 'pointer', opacity: 0.7 }}>
                    Concepts ({manifest.concepts.length})
                  </summary>
                  <div style={{ marginTop: '0.3rem', display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {manifest.concepts.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                      <span key={c.slug} style={{
                        fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px',
                        backgroundColor: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)',
                      }} title={c.description || ''}>
                        {c.name}
                        {c.categories?.length > 0 && (
                          <span style={{ opacity: 0.5 }}> ({c.categories.join(', ')})</span>
                        )}
                      </span>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Install button */}
        {!isInstalled && (
          <button
            className="btn-primary"
            onClick={onInstall}
            disabled={installing}
            style={{
              padding: '0.6rem 1.2rem', fontSize: '0.9rem', whiteSpace: 'nowrap',
              opacity: installing ? 0.6 : 1,
            }}
          >
            {installing ? '⏳ Installing…' : isPartial ? '🔧 Complete Install' : '🚀 Install Firmware'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Firmware Overview ── */

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

/* ── Firmware Node JSON ── */

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
