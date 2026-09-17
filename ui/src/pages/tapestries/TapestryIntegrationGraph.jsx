import { useState, useEffect, useRef, useMemo } from 'react';
import { inferNodeType } from './tapestryGraphModel';

/*
 * vis-network visualization of a tapestry's composed graph. Modeled on the
 * Firmware Explorer's IntegrationGraph, but driven by the composed
 * {nodes, relationships} model: node type is inferred (not authored), edges are
 * colored by canonical alias, and labels come from node.name (no re-pluralization
 * — avoids the Firmware Explorer's "dog-breedss" artifact).
 */

const GRAPH_COLORS = {
  superset:      { bg: '#8b5cf6', border: '#a78bfa', font: '#fff' },
  conceptHeader: { bg: '#6366f1', border: '#818cf8', font: '#fff' },
  property:      { bg: '#f59e0b', border: '#fbbf24', font: '#fff' },
  other:         { bg: '#6e7681', border: '#8b949e', font: '#fff' },
};

const GRAPH_EDGE_COLORS = {
  IS_THE_CONCEPT_FOR: '#818cf8',
  IS_A_SUPERSET_OF:   '#38bdf8',
  HAS_ELEMENT:        '#4ade80',
  ENUMERATES:         '#f59e0b',
};

const EDGE_SHORT = {
  IS_THE_CONCEPT_FOR: 'CONCEPT_FOR',
  IS_A_SUPERSET_OF:   'SUPERSET_OF',
};

export default function TapestryIntegrationGraph({ composed }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const graphData = useMemo(() => {
    if (!composed) return null;
    const nodes = (composed.nodes || []).map((n) => ({
      id: n.slug,
      label: n.name || n.slug, // node.name — no re-pluralization
      type: inferNodeType(n),
    }));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = (composed.relationships || [])
      .filter((r) => nodeIds.has(r.from) && nodeIds.has(r.to))
      .map((r) => ({ from: r.from, to: r.to, relType: r.alias }));
    return { nodes, edges };
  }, [composed]);

  useEffect(() => {
    if (!graphData || !containerRef.current) return;
    let destroyed = false;

    import('vis-network/standalone').then(({ Network, DataSet }) => {
      if (destroyed || !containerRef.current) return;
      const visNodes = new DataSet();
      const visEdges = new DataSet();

      for (const node of graphData.nodes) {
        const colors = GRAPH_COLORS[node.type] || GRAPH_COLORS.other;
        const shape = node.type === 'conceptHeader' ? 'diamond'
                    : node.type === 'superset' ? 'triangle'
                    : 'box';
        const size = node.type === 'superset' ? 20 : node.type === 'conceptHeader' ? 16 : 14;
        visNodes.add({
          id: node.id,
          label: node.label,
          shape,
          size,
          color: { background: colors.bg, border: colors.border, highlight: { background: colors.border, border: colors.bg } },
          font: { color: colors.font, size: 11, face: 'system-ui' },
          borderWidth: node.type === 'superset' ? 2 : 1,
          shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', size: 4, x: 2, y: 2 },
          _data: node,
        });
      }

      for (const edge of graphData.edges) {
        const color = GRAPH_EDGE_COLORS[edge.relType] || '#6e7681';
        const label = EDGE_SHORT[edge.relType] || edge.relType;
        const dashes = edge.relType === 'ENUMERATES' ? [5, 5] : false;
        visEdges.add({
          from: edge.from,
          to: edge.to,
          label,
          color: { color, highlight: '#e6edf3' },
          font: { color: '#8b949e', size: 8, strokeWidth: 0, face: 'system-ui' },
          arrows: 'to',
          width: edge.relType === 'ENUMERATES' ? 2 : 1.5,
          dashes,
          smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.3 },
        });
      }

      const options = {
        physics: {
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: { gravitationalConstant: -120, centralGravity: 0.008, springLength: 160, springConstant: 0.04, damping: 0.4, avoidOverlap: 0.8 },
          stabilization: { iterations: 300, updateInterval: 25 },
        },
        layout: { improvedLayout: true },
        edges: { arrows: { to: { scaleFactor: 0.6 } }, font: { align: 'middle' } },
        interaction: { hover: true, tooltipDelay: 200, zoomView: true, dragView: true },
      };

      const network = new Network(containerRef.current, { nodes: visNodes, edges: visEdges }, options);
      networkRef.current = network;
      network.on('stabilized', () => network.setOptions({ physics: { enabled: false } }));
      network.on('click', (params) => {
        if (params.nodes.length > 0) {
          const node = visNodes.get(params.nodes[0]);
          if (node?._data) {
            setTooltip({ label: node._data.label, type: node._data.type, x: params.event.center.x, y: params.event.center.y });
          }
        } else {
          setTooltip(null);
        }
      });
    });

    return () => {
      destroyed = true;
      if (networkRef.current) { networkRef.current.destroy(); networkRef.current = null; }
    };
  }, [graphData]);

  const nodeCount = graphData?.nodes.length || 0;
  const edgeCount = graphData?.edges.length || 0;

  return (
    <div className="firmware-node-content">
      <h2>🕸️ Integration Graph</h2>
      <p style={{ opacity: 0.7, marginBottom: '0.75rem' }}>
        This tapestry&apos;s member concepts and the integrations between them, composed from its
        graph and resolved imports.
      </p>

      <div className="firmware-graph-legend">
        <span className="firmware-graph-legend-item">
          <span className="firmware-graph-dot" style={{ background: GRAPH_COLORS.superset.bg }} />
          Superset (▲)
        </span>
        <span className="firmware-graph-legend-item">
          <span className="firmware-graph-dot" style={{ background: GRAPH_COLORS.conceptHeader.bg }} />
          Concept Header (◆)
        </span>
        <span className="firmware-graph-legend-item">
          <span className="firmware-graph-dot" style={{ background: GRAPH_COLORS.property.bg }} />
          Property (■)
        </span>
        <span style={{ opacity: 0.5, fontSize: '0.8rem', marginLeft: '0.5rem' }}>
          {nodeCount} nodes · {edgeCount} edges
        </span>
      </div>

      <div className="firmware-graph-legend" style={{ marginTop: '0.25rem' }}>
        {[
          { color: GRAPH_EDGE_COLORS.IS_A_SUPERSET_OF, label: 'SUPERSET_OF', style: 'solid' },
          { color: GRAPH_EDGE_COLORS.HAS_ELEMENT, label: 'HAS_ELEMENT', style: 'solid' },
          { color: GRAPH_EDGE_COLORS.IS_THE_CONCEPT_FOR, label: 'CONCEPT_FOR', style: 'solid' },
          { color: GRAPH_EDGE_COLORS.ENUMERATES, label: 'ENUMERATES', style: 'dashed' },
        ].map((e) => (
          <span key={e.label} className="firmware-graph-legend-item">
            <span
              className="firmware-graph-line"
              style={{ background: e.style === 'solid' ? e.color : 'transparent', borderBottom: e.style !== 'solid' ? `2px ${e.style} ${e.color}` : 'none' }}
            />
            {e.label}
          </span>
        ))}
      </div>

      <div ref={containerRef} className="firmware-graph-container" />

      {tooltip && (
        <div className="firmware-graph-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          <strong>{tooltip.label}</strong>
          <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '0.2rem' }}>{tooltip.type}</div>
        </div>
      )}
    </div>
  );
}
