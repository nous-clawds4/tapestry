import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import JsonView from '../../components/JsonView';
import useTapestryGraph from './useTapestryGraph';
import TapestryIntegrationGraph from './TapestryIntegrationGraph';
import { inferNodeType, groupRelationships, nodeName } from './tapestryGraphModel';
import { fetchConceptCoreNodes } from '../../api/conceptCoreNodes';
import { CORE_NODES, ConceptOverview, ConceptNodeJson } from '../../components/concept/CoreNodeViews';
import ConceptMembersView from '../settings/ConceptMembersView';

/**
 * Tapestry Exploration page (ADR tapestries/0002, extended by 0004). Membership and the
 * tapestry-level integration views render as-authored from strfry (useTapestryGraph). The
 * per-concept DETAIL (Overview / 8 core nodes / Elements / Sets) is read from Neo4j + Tapestry
 * LMDB via the concept-graph core-nodes endpoint, mirroring the Firmware Explorer's per-concept
 * experience — relationships from Neo4j, node JSON resolved from LMDB (owner ontology).
 */

const INTEGRATION_ITEMS = [
  { key: 'graph', label: 'Integration Graph', icon: '🕸️' },
  { key: 'enumerations', label: 'Enumerations', icon: '🔢' },
  { key: 'elements', label: 'Elements', icon: '📦' },
  { key: 'subsets', label: 'Subsets', icon: '🔀' },
  { key: 'json', label: 'JSON', icon: '{ }' },
];

// Per-concept membership tabs (mirror the Firmware Explorer's Elements / Sets views).
const MEMBER_VIEWS = [
  { key: 'elements', label: 'Elements' },
  { key: 'sets', label: 'Sets' },
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

/**
 * Per-concept detail — the Firmware-Explorer-style views for one member concept, read from
 * Neo4j + Tapestry LMDB by the concept's header handle (ADR tapestries/0004). Overview + the
 * 8 core-node types reuse the shared CoreNodeViews; Elements / Sets reuse ConceptMembersView.
 * The concept's identity/JSON comes from the instance's graph, NOT the tapestry's authored event.
 */
function ConceptDetail({ concept }) {
  const handle = concept?.uuid || null;
  const name = concept?.name || concept?.slug || 'Concept';

  const [selectedNode, setSelectedNode] = useState('overview');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!handle) { setResult({ found: false, nodes: {} }); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedNode('overview');
    fetchConceptCoreNodes(handle)
      .then((res) => { if (!cancelled) setResult(res); })
      .catch((e) => { if (!cancelled) setError(e.message || String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [handle]);

  // Adapt the endpoint's { found, nodes } into the shape the shared components expect.
  const headerJson = result?.nodes?.header?.json || null;
  const description =
    headerJson?.word?.description || headerJson?.set?.description || headerJson?.conceptHeader?.description || '';
  const data = result
    ? { name, title: name, description, nodes: result.nodes || {}, installed: result.found }
    : null;

  return (
    <>
      <div className="firmware-node-tabs">
        {CORE_NODES.map((n) => (
          <button
            key={n.key}
            className={`firmware-node-tab ${selectedNode === n.key ? 'active' : ''}`}
            onClick={() => setSelectedNode(n.key)}
          >
            {n.label}
          </button>
        ))}
        <span className="firmware-node-tab-divider" aria-hidden="true" />
        {MEMBER_VIEWS.map((n) => (
          <button
            key={n.key}
            className={`firmware-node-tab ${selectedNode === n.key ? 'active' : ''}`}
            onClick={() => setSelectedNode(n.key)}
          >
            {n.label}
          </button>
        ))}
      </div>

      <div className="firmware-node-content">
        {loading ? (
          <div className="loading">Loading…</div>
        ) : error ? (
          <p className="error">Error: {error}</p>
        ) : !data || !data.installed ? (
          <div className="firmware-not-installed">
            <h3>⚠️ Not in the graph</h3>
            <p>
              <strong>{name}</strong> is a member of this tapestry but was not found in the concept
              graph, so there is nothing to inspect yet.
            </p>
          </div>
        ) : selectedNode === 'overview' ? (
          <ConceptOverview data={data} />
        ) : selectedNode === 'elements' || selectedNode === 'sets' ? (
          <ConceptMembersView
            key={`${data.nodes?.header?.uuid}:${selectedNode}`}
            conceptData={data}
            kind={selectedNode}
          />
        ) : (
          <ConceptNodeJson data={data} nodeKey={selectedNode} />
        )}
      </div>
    </>
  );
}

export default function TapestryDetail() {
  const { uuid } = useParams();
  const { loading, error, tapestry, rawGraph, composed, degraded, notFound } = useTapestryGraph(uuid);
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
            <ConceptDetail concept={memberConcepts.find((c) => c.slug === selected.slug)} />
          )}
        </div>
      </div>
    </div>
  );
}
