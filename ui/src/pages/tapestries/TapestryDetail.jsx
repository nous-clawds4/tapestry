import { useState } from 'react';
import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import JsonView from '../../components/JsonView';
import useTapestryGraph from './useTapestryGraph';
import TapestryIntegrationGraph from './TapestryIntegrationGraph';
import { inferNodeType, groupRelationships, nodeName } from './tapestryGraphModel';

/**
 * Tapestry Exploration page (ADR tapestries/0002). Renders a tapestry as-authored:
 * the element's graph block + one-level resolved imports, composed into the
 * Firmware-Explorer-style read-only views (integration graph, integration tables,
 * per-concept JSON). Reads everything from strfry via useTapestryGraph.
 */

const INTEGRATION_ITEMS = [
  { key: 'graph', label: 'Integration Graph', icon: '🕸️' },
  { key: 'enumerations', label: 'Enumerations', icon: '🔢' },
  { key: 'elements', label: 'Elements', icon: '📦' },
  { key: 'subsets', label: 'Subsets', icon: '🔀' },
  { key: 'json', label: 'JSON', icon: '{ }' },
];

/** JsonView with a Viewer / Raw toggle (mirrors the Firmware Explorer's node JSON view). */
function JsonPanel({ data }) {
  const [mode, setMode] = useState('viewer');
  return (
    <div className="firmware-json-view">
      <div className="firmware-json-header">
        {[{ key: 'viewer', label: 'Viewer' }, { key: 'raw', label: 'Raw JSON' }].map((opt) => (
          <button
            key={opt.key}
            className={`firmware-view-btn ${mode === opt.key ? 'active' : ''}`}
            onClick={() => setMode(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {mode === 'viewer'
        ? <JsonView data={data} />
        : <pre className="firmware-json-pre">{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}

const VERB = { enumerations: 'enumerates', elements: 'has element', subsets: 'is a superset of' };

function RelationshipTable({ groupKey, label, rows, composed }) {
  return (
    <div className="firmware-node-content">
      <h2>{label}</h2>
      {(!rows || rows.length === 0) ? (
        <p className="placeholder">No {label.toLowerCase()} in this tapestry.</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>From</th><th>Relationship</th><th>To</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.from}|${r.to}|${i}`}>
                <td>{nodeName(composed, r.from)}</td>
                <td>{VERB[groupKey]}</td>
                <td>{nodeName(composed, r.to)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ConceptDetail({ composed, imports, slug }) {
  const node = (composed?.nodes || []).find((n) => n.slug === slug);
  const name = node?.name || slug;
  // The concept's resolved concept-graph is the import whose graph includes this
  // concept's header node.
  const match = (imports || []).find((i) => (i.graph?.nodes || []).some((n) => n.uuid && n.uuid === node?.uuid));

  return (
    <div className="firmware-node-content">
      <h2>🧩 {name}</h2>
      {match ? (
        <JsonPanel data={match.graph} />
      ) : (
        <p className="placeholder">No resolved concept graph for this concept.</p>
      )}
    </div>
  );
}

export default function TapestryDetail() {
  const { uuid } = useParams();
  const { loading, error, tapestry, rawGraph, composed, imports, degraded, notFound } = useTapestryGraph(uuid);
  const [selected, setSelected] = useState({ kind: 'integration', key: 'graph' });

  const title = tapestry?.title || 'Tapestry';

  if (loading) {
    return <div className="page"><Breadcrumbs /><h1>🧵 {title}</h1><p>Loading tapestry…</p></div>;
  }
  if (error) {
    return <div className="page"><Breadcrumbs /><h1>🧵 {title}</h1><p className="error">Error: {error}</p></div>;
  }
  if (notFound) {
    return <div className="page"><Breadcrumbs /><h1>🧵 Tapestry</h1><p className="placeholder">Tapestry not found.</p></div>;
  }
  if (degraded) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>🧵 {title}</h1>
        <p className="placeholder">This tapestry has no graph to explore yet — nothing to explore.</p>
      </div>
    );
  }

  const memberConcepts = (composed?.nodes || []).filter((n) => inferNodeType(n) === 'conceptHeader');
  const groups = groupRelationships(composed);

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🧵 {title}</h1>
      {tapestry?.description && <p className="subtitle">{tapestry.description}</p>}

      <div className="firmware-layout">
        <div className="firmware-sidebar">
          <div className="firmware-sidebar-divider">Concepts</div>
          {memberConcepts.length === 0 && <p className="placeholder" style={{ padding: '0 0.5rem' }}>No member concepts.</p>}
          {memberConcepts.map((c) => (
            <button
              key={c.slug}
              className={`firmware-concept-btn ${selected.kind === 'concept' && selected.slug === c.slug ? 'active' : ''}`}
              onClick={() => setSelected({ kind: 'concept', slug: c.slug })}
            >
              {c.name || c.slug}
            </button>
          ))}

          <div className="firmware-sidebar-divider">Integrations</div>
          {INTEGRATION_ITEMS.map((it) => (
            <button
              key={it.key}
              className={`firmware-concept-btn ${selected.kind === 'integration' && selected.key === it.key ? 'active' : ''}`}
              onClick={() => setSelected({ kind: 'integration', key: it.key })}
            >
              {it.icon} {it.label}
            </button>
          ))}
        </div>

        <div className="firmware-content">
          {selected.kind === 'integration' && selected.key === 'graph' && (
            <TapestryIntegrationGraph composed={composed} />
          )}
          {selected.kind === 'integration' && selected.key === 'enumerations' && (
            <RelationshipTable groupKey="enumerations" label="Enumerations" rows={groups.enumerations} composed={composed} />
          )}
          {selected.kind === 'integration' && selected.key === 'elements' && (
            <RelationshipTable groupKey="elements" label="Elements" rows={groups.elements} composed={composed} />
          )}
          {selected.kind === 'integration' && selected.key === 'subsets' && (
            <RelationshipTable groupKey="subsets" label="Subsets" rows={groups.subsets} composed={composed} />
          )}
          {selected.kind === 'integration' && selected.key === 'json' && (
            <div className="firmware-node-content">
              <h2>{'{ }'} Tapestry JSON</h2>
              <JsonPanel data={rawGraph} />
            </div>
          )}
          {selected.kind === 'concept' && (
            <ConceptDetail composed={composed} imports={imports} slug={selected.slug} />
          )}
        </div>
      </div>
    </div>
  );
}
