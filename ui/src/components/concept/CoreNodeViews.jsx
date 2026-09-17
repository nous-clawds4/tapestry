import { useState } from 'react';
import JsonView from '../JsonView';

/*
 * CoreNodeViews — the per-concept core-node presentational pieces, shared by the Firmware
 * Explorer and the Tapestry Exploration page (ADR tapestries/0004, Decision 3). Extracted
 * verbatim from FirmwareExplorer.jsx (FirmwareOverview → ConceptOverview, FirmwareNodeJson →
 * ConceptNodeJson) so both pages render an identical concept view from the same `{ name,
 * nodes: { header, superset, schema, primaryProperty, properties, ptGraph, coreGraph,
 * conceptGraph } }` shape. Reuses JsonView and the .firmware-* CSS classes.
 */

export const CORE_NODES = [
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

/* ── Concept Overview ── */

export function ConceptOverview({ data }) {
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

/* ── Concept Node JSON ── */

export function ConceptNodeJson({ data, nodeKey }) {
  const nodeInfo = CORE_NODES.find(n => n.key === nodeKey);
  const node = data.nodes[nodeKey];
  const [viewMode, setViewMode] = useState('viewer'); // 'viewer' | 'raw'

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
        <div className="firmware-view-toggle">
          {[
            { key: 'viewer', label: 'Viewer' },
            { key: 'raw', label: 'Raw JSON' },
          ].map(opt => (
            <button
              key={opt.key}
              className={`firmware-view-btn ${viewMode === opt.key ? 'active' : ''}`}
              onClick={() => setViewMode(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {viewMode === 'viewer' ? (
        <JsonView data={node.json} />
      ) : (
        <pre className="firmware-json-pre">
          {JSON.stringify(node.json, null, 2)}
        </pre>
      )}
    </div>
  );
}
