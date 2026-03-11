import { useRef, useEffect, useState, useMemo } from 'react';
import { useCypher } from '../../hooks/useCypher';

/**
 * Organization (Sets) View
 *
 * Visualizes all class threads emanating from a Concept Header:
 *   ConceptHeader → Superset → Sets → Elements
 *
 * Explicit HAS_ELEMENT edges are solid.
 * Implicit elements (in a Set but not explicitly HAS_ELEMENT from Superset) are dashed.
 */

// ── Colors ────────────────────────────────────────────────

const COLORS = {
  conceptHeader: { bg: '#6366f1', border: '#818cf8', font: '#fff' },
  superset:      { bg: '#8b5cf6', border: '#a78bfa', font: '#fff' },
  set:           { bg: '#0ea5e9', border: '#38bdf8', font: '#fff' },
  element:       { bg: '#22c55e', border: '#4ade80', font: '#fff' },
  implicitElement: { bg: '#374151', border: '#6b7280', font: '#d1d5db' },
};

const EDGE_COLORS = {
  IS_THE_CONCEPT_FOR:  '#818cf8',  // header → superset
  IS_A_SUPERSET_OF:    '#38bdf8',  // superset/set → set
  HAS_ELEMENT:         '#4ade80',  // explicit element
  HAS_ELEMENT_IMPLICIT:'#6b7280',  // implicit element (dashed)
};

// ── Node shapes ───────────────────────────────────────────

function nodeShape(labels) {
  if (labels.includes('ConceptHeader') || labels.includes('ListHeader')) return 'diamond';
  if (labels.includes('Superset')) return 'triangle';
  if (labels.includes('Set')) return 'dot';
  return 'box';  // elements
}

function nodeColor(labels, isImplicit) {
  if (isImplicit) return COLORS.implicitElement;
  if (labels.includes('ConceptHeader') || labels.includes('ListHeader')) return COLORS.conceptHeader;
  if (labels.includes('Superset')) return COLORS.superset;
  if (labels.includes('Set')) return COLORS.set;
  return COLORS.element;
}

// ── Truncate ──────────────────────────────────────────────

function truncate(str, max = 28) {
  if (!str) return '?';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// ── Component ─────────────────────────────────────────────

export default function OrganizationView({ uuid, conceptName }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [physicsOn, setPhysicsOn] = useState(true);
  const [centralGravity, setCentralGravity] = useState(-80);
  const [windY, setWindY] = useState(0.5);
  const [showImplicit, setShowImplicit] = useState(false);
  const [repulsion, setRepulsion] = useState(0.8);
  const [springLength, setSpringLength] = useState(120);
  const [showControls, setShowControls] = useState(false);

  // ── 1. Fetch all class thread nodes + edges ──

  // Get all nodes reachable via class thread paths from the header
  const { data: threadData, loading: threadLoading, error: threadError } = useCypher(
    uuid ? `
      MATCH (h:NostrEvent {uuid: '${uuid}'})
      OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
      WITH h, sup
      OPTIONAL MATCH path = (sup)-[:IS_A_SUPERSET_OF|HAS_ELEMENT*1..10]->(n)
      WITH h, sup, n, relationships(path) AS rels
      UNWIND (CASE WHEN rels IS NULL THEN [null] ELSE rels END) AS r
      WITH h,
           head(collect(DISTINCT sup)) AS sup0,
           collect(DISTINCT { uuid: n.uuid, name: n.name, labels: labels(n) }) AS threadNodes,
           collect(DISTINCT {
             fromUuid: CASE WHEN r IS NOT NULL THEN startNode(r).uuid ELSE null END,
             toUuid: CASE WHEN r IS NOT NULL THEN endNode(r).uuid ELSE null END,
             relType: CASE WHEN r IS NOT NULL THEN type(r) ELSE null END
           }) AS threadEdges
      RETURN h.uuid AS headerUuid, h.name AS headerName, labels(h) AS headerLabels,
             threadNodes + CASE WHEN sup0 IS NOT NULL THEN [{ uuid: sup0.uuid, name: sup0.name, labels: labels(sup0) }] ELSE [] END AS nodes,
             threadEdges + CASE WHEN sup0 IS NOT NULL THEN [{ fromUuid: h.uuid, toUuid: sup0.uuid, relType: 'IS_THE_CONCEPT_FOR' }] ELSE [] END AS edges
    ` : null
  );

  // ── 2. Compute implicit elements ──

  const graphData = useMemo(() => {
    if (!threadData || threadData.length === 0) return null;
    const row = threadData[0];

    // Build node map (uuid → info)
    const nodesMap = new Map();
    // Add header
    nodesMap.set(row.headerUuid, {
      uuid: row.headerUuid,
      name: row.headerName,
      labels: row.headerLabels || [],
      isHeader: true,
    });

    // Add all thread nodes
    for (const n of (row.nodes || [])) {
      if (!n.uuid || nodesMap.has(n.uuid)) continue;
      nodesMap.set(n.uuid, {
        uuid: n.uuid,
        name: n.name,
        labels: n.labels || [],
      });
    }

    // Build edge list + track explicit HAS_ELEMENT targets from superset
    const edges = [];
    const explicitElements = new Set();  // UUIDs that have explicit HAS_ELEMENT from any set/superset
    let supersetUuid = null;

    for (const e of (row.edges || [])) {
      if (!e.fromUuid || !e.toUuid || !e.relType) continue;
      // Deduplicate
      const edgeKey = `${e.fromUuid}→${e.relType}→${e.toUuid}`;
      if (edges.find(ex => `${ex.fromUuid}→${ex.relType}→${ex.toUuid}` === edgeKey)) continue;

      edges.push(e);

      if (e.relType === 'IS_THE_CONCEPT_FOR') {
        supersetUuid = e.toUuid;
      }
      if (e.relType === 'HAS_ELEMENT') {
        explicitElements.add(e.toUuid);
      }
    }

    // Find implicit elements: nodes that are elements (ListItem or leaf nodes)
    // reached via IS_A_SUPERSET_OF → HAS_ELEMENT chains from sets,
    // but NOT directly connected to the superset via HAS_ELEMENT
    const implicitEdges = [];
    if (supersetUuid) {
      for (const e of edges) {
        // Elements connected to a Set (not the superset) via HAS_ELEMENT
        if (e.relType === 'HAS_ELEMENT' && e.fromUuid !== supersetUuid) {
          const targetUuid = e.toUuid;
          // If this element doesn't have an explicit HAS_ELEMENT from the superset
          if (!explicitElements.has(targetUuid) || !edges.some(
            ex => ex.relType === 'HAS_ELEMENT' && ex.fromUuid === supersetUuid && ex.toUuid === targetUuid
          )) {
            implicitEdges.push({
              fromUuid: supersetUuid,
              toUuid: targetUuid,
              relType: 'HAS_ELEMENT_IMPLICIT',
            });
          }
        }
      }
    }

    return { nodesMap, edges, implicitEdges, supersetUuid, headerUuid: row.headerUuid };
  }, [threadData]);

  // Refs for DataSets so we can mutate without rebuilding the network
  const visNodesRef = useRef(null);
  const visEdgesRef = useRef(null);
  const implicitEdgeIdsRef = useRef([]);

  // ── 3. Build vis-network ──

  useEffect(() => {
    if (!graphData || !containerRef.current) return;

    import('vis-network/standalone').then(({ Network, DataSet }) => {
      const { nodesMap, edges, implicitEdges, supersetUuid, headerUuid } = graphData;

      const visNodes = new DataSet();
      const visEdges = new DataSet();
      visNodesRef.current = visNodes;
      visEdgesRef.current = visEdges;

      // Determine implicit element UUIDs for coloring
      const implicitUuids = new Set(implicitEdges.map(e => e.toUuid));

      // Determine which nodes are sets vs elements for mass differentiation
      // Sets: have IS_A_SUPERSET_OF pointing to them, or have HAS_ELEMENT going out
      const setUuids = new Set();
      for (const e of edges) {
        if (e.relType === 'IS_A_SUPERSET_OF') setUuids.add(e.toUuid);
      }

      // Add nodes
      for (const [nodeUuid, info] of nodesMap) {
        const labels = info.labels || [];
        const isImplicit = implicitUuids.has(nodeUuid) &&
          !edges.some(e => e.relType === 'HAS_ELEMENT' && e.fromUuid === supersetUuid && e.toUuid === nodeUuid);
        const colors = nodeColor(labels, isImplicit);
        const isHeader = nodeUuid === headerUuid;
        const isSuperset = nodeUuid === supersetUuid;
        const isSet = labels.includes('Set') || setUuids.has(nodeUuid);
        const isElement = !isHeader && !isSuperset && !isSet;

        visNodes.add({
          id: nodeUuid,
          label: truncate(info.name),
          shape: nodeShape(labels),
          size: isHeader ? 24 : isSuperset ? 20 : 16,
          color: { background: colors.bg, border: colors.border, highlight: { background: colors.border, border: colors.bg } },
          font: { color: colors.font, size: isHeader ? 13 : 11, face: 'system-ui' },
          borderWidth: isHeader || isSuperset ? 2 : 1,
          // High mass on elements so wind only pushes sets
          mass: isElement ? 8 : 1,
          // Pin header and superset at top
          ...(isHeader ? { x: 0, y: -200, fixed: { x: true, y: true } } : {}),
          ...(isSuperset ? { x: 0, y: -100, fixed: { x: true, y: true } } : {}),
          _info: info,
          _isImplicit: isImplicit,
        });
      }

      // Add explicit edges
      for (const e of edges) {
        if (!visNodes.get(e.fromUuid) || !visNodes.get(e.toUuid)) continue;
        const color = EDGE_COLORS[e.relType] || '#6e7681';

        visEdges.add({
          from: e.fromUuid,
          to: e.toUuid,
          label: e.relType === 'IS_THE_CONCEPT_FOR' ? 'CONCEPT_FOR'
               : e.relType === 'IS_A_SUPERSET_OF' ? 'SUPERSET_OF'
               : e.relType,
          color: { color, highlight: '#e6edf3' },
          font: { color: '#8b949e', size: 8, strokeWidth: 0 },
          arrows: 'to',
          width: 1.5,
          smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.3 },
        });
      }

      // Network options
      const options = {
        physics: {
          enabled: true,
          solver: 'forceAtlas2Based',
          forceAtlas2Based: {
            gravitationalConstant: centralGravity,
            centralGravity: 0.005,
            springLength: springLength,
            springConstant: 0.06,
            damping: 0.4,
            avoidOverlap: repulsion,
          },
          stabilization: {
            iterations: 200,
            updateInterval: 25,
          },
          wind: { x: 0, y: windY },
        },
        layout: {
          improvedLayout: true,
        },
        edges: {
          arrows: { to: { scaleFactor: 0.6 } },
          font: { align: 'middle' },
        },
        nodes: {
          shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.3)',
            size: 4,
            x: 2,
            y: 2,
          },
        },
        interaction: {
          hover: true,
          tooltipDelay: 200,
          zoomView: true,
          dragView: true,
        },
      };

      const network = new Network(containerRef.current, { nodes: visNodes, edges: visEdges }, options);
      networkRef.current = network;

      // After stabilization, turn physics off so nodes stay put
      network.on('stabilized', () => {
        setPhysicsOn(false);
        network.setOptions({ physics: { enabled: false } });
      });

      // Click handler for tooltip
      network.on('click', (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const node = visNodes.get(nodeId);
          if (node?._info) {
            setTooltip({
              name: node._info.name,
              uuid: nodeId,
              labels: node._info.labels,
              isImplicit: node._isImplicit,
              x: params.event.center.x,
              y: params.event.center.y,
            });
          }
        } else {
          setTooltip(null);
        }
      });

      return () => network.destroy();
    });

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, [graphData]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3a. Toggle implicit edges without rebuilding the network ──

  useEffect(() => {
    const visEdges = visEdgesRef.current;
    if (!visEdges || !graphData) return;

    // Remove any existing implicit edges
    const oldIds = implicitEdgeIdsRef.current;
    if (oldIds.length > 0) {
      visEdges.remove(oldIds);
      implicitEdgeIdsRef.current = [];
    }

    // Add them back if toggled on
    if (showImplicit) {
      const visNodes = visNodesRef.current;
      const newIds = [];
      for (const e of graphData.implicitEdges) {
        if (!visNodes?.get(e.fromUuid) || !visNodes?.get(e.toUuid)) continue;
        const id = `implicit-${e.fromUuid}-${e.toUuid}`;
        const edgeData = {
          id,
          from: e.fromUuid,
          to: e.toUuid,
          label: 'HAS_ELEMENT',
          dashes: [6, 4],
          color: { color: EDGE_COLORS.HAS_ELEMENT_IMPLICIT, highlight: '#e6edf3' },
          font: { color: '#6b7280', size: 8, strokeWidth: 0 },
          arrows: 'to',
          width: 1,
          smooth: { type: 'cubicBezier', forceDirection: 'vertical', roundness: 0.3 },
        };
        // Use update (upsert) to handle React strict mode double-firing
        visEdges.update(edgeData);
        newIds.push(id);
      }
      implicitEdgeIdsRef.current = newIds;
    }
  }, [showImplicit, graphData]);

  // ── 3b. Sync physics controls to live network ──

  useEffect(() => {
    if (!networkRef.current) return;
    networkRef.current.setOptions({
      physics: {
        enabled: physicsOn,
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: centralGravity,
          centralGravity: 0.005,
          springLength: springLength,
          springConstant: 0.06,
          damping: 0.4,
          avoidOverlap: repulsion,
        },
        wind: { x: 0, y: windY },
      },
    });
  }, [physicsOn, centralGravity, repulsion, springLength, windY]);

  // ── 4. Render ──

  if (threadLoading) return <div className="loading">Loading class threads…</div>;
  if (threadError) return <div className="error">Error: {threadError.message}</div>;

  const nodeCount = graphData?.nodesMap?.size || 0;
  const edgeCount = (graphData?.edges?.length || 0) + (graphData?.implicitEdges?.length || 0);
  const implicitCount = graphData?.implicitEdges?.length || 0;

  return (
    <div>
      {/* Stats bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1.5rem',
        marginBottom: '0.75rem', fontSize: '0.8rem', opacity: 0.7,
      }}>
        <span>{nodeCount} nodes</span>
        <span>{edgeCount} edges ({implicitCount} implicit)</span>
      </div>

      {/* Legend + Physics Controls row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        {/* Legend */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem',
        }}>
          <LegendItem color={COLORS.conceptHeader.bg} shape="◆" label="Concept Header" />
          <LegendItem color={COLORS.superset.bg} shape="▲" label="Superset" />
          <LegendItem color={COLORS.set.bg} shape="●" label="Set" />
          <LegendItem color={COLORS.element.bg} shape="■" label="Element" />
          {showImplicit && <>
            <LegendItem color={COLORS.implicitElement.bg} shape="■" label="Implicit Element" />
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ display: 'inline-block', width: 20, height: 0, borderTop: '2px dashed #6b7280' }} />
              implicit HAS_ELEMENT
            </span>
          </>}
        </div>

        {/* Implicit toggle + Physics toggle */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setShowImplicit(v => !v)}
            style={{
              padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '5px',
              border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
              backgroundColor: showImplicit ? 'rgba(107,114,128,0.2)' : 'transparent',
              color: showImplicit ? '#9ca3af' : '#aaa',
            }}
          >
            {showImplicit ? '🔗 Hide Implicit' : '🔗 Show Implicit'}
          </button>
          <button
            onClick={() => setShowControls(v => !v)}
            style={{
              padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '5px',
              border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer',
              backgroundColor: showControls ? 'rgba(99,102,241,0.15)' : 'transparent',
              color: showControls ? '#818cf8' : '#aaa',
            }}
          >
            ⚙️ Physics
          </button>
        </div>
      </div>

      {/* Physics Controls Panel */}
      {showControls && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.2rem',
          padding: '0.6rem 0.8rem', marginBottom: '0.75rem',
          backgroundColor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
          fontSize: '0.75rem',
        }}>
          {/* On/Off toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <span style={{ opacity: 0.7 }}>Physics</span>
            <button
              onClick={() => setPhysicsOn(v => !v)}
              style={{
                width: 40, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
                backgroundColor: physicsOn ? '#6366f1' : '#374151',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                backgroundColor: '#fff', transition: 'left 0.2s',
                left: physicsOn ? 22 : 2,
              }} />
            </button>
          </label>

          {/* Wind Y slider */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ opacity: 0.7 }}>↓ Wind</span>
            <input
              type="range" min={0} max={50} step={0.5} value={windY}
              onChange={e => setWindY(Number(e.target.value))}
              style={{ width: 100, accentColor: '#22c55e' }}
            />
            <span style={{ opacity: 0.5, minWidth: 32, textAlign: 'right' }}>{windY.toFixed(1)}</span>
          </label>

          {/* Central Gravity slider */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ opacity: 0.7 }}>Central</span>
            <input
              type="range" min={-300} max={0} step={5} value={centralGravity}
              onChange={e => setCentralGravity(Number(e.target.value))}
              style={{ width: 100, accentColor: '#6366f1' }}
            />
            <span style={{ opacity: 0.5, minWidth: 32, textAlign: 'right' }}>{centralGravity}</span>
          </label>

          {/* Repulsion slider */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ opacity: 0.7 }}>Repulsion</span>
            <input
              type="range" min={0} max={1} step={0.05} value={repulsion}
              onChange={e => setRepulsion(Number(e.target.value))}
              style={{ width: 100, accentColor: '#6366f1' }}
            />
            <span style={{ opacity: 0.5, minWidth: 32, textAlign: 'right' }}>{repulsion.toFixed(2)}</span>
          </label>

          {/* Spring Length slider */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ opacity: 0.7 }}>Spring</span>
            <input
              type="range" min={30} max={300} step={10} value={springLength}
              onChange={e => setSpringLength(Number(e.target.value))}
              style={{ width: 100, accentColor: '#6366f1' }}
            />
            <span style={{ opacity: 0.5, minWidth: 32, textAlign: 'right' }}>{springLength}</span>
          </label>

          {/* Reset button */}
          <button
            onClick={() => { setCentralGravity(-80); setWindY(0.5); setRepulsion(0.8); setSpringLength(120); setPhysicsOn(true); }}
            style={{
              padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
              backgroundColor: 'transparent', color: '#aaa',
            }}
          >
            Reset
          </button>
        </div>
      )}

      {/* Graph container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '600px',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          backgroundColor: '#0d1117',
          position: 'relative',
        }}
      />

      {/* Click tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: Math.min(tooltip.x + 10, window.innerWidth - 300),
          top: tooltip.y + 10,
          padding: '0.6rem 0.8rem',
          backgroundColor: '#1c2333',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '6px',
          fontSize: '0.8rem',
          maxWidth: '280px',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{tooltip.name}</div>
          <div style={{ opacity: 0.6, fontSize: '0.7rem', wordBreak: 'break-all' }}>{tooltip.uuid}</div>
          <div style={{ marginTop: '0.25rem' }}>
            {tooltip.labels?.map(l => (
              <span key={l} style={{
                fontSize: '0.65rem', padding: '0.1rem 0.3rem', marginRight: '0.25rem',
                borderRadius: '3px', backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
              }}>
                {l}
              </span>
            ))}
          </div>
          {tooltip.isImplicit && (
            <div style={{ marginTop: '0.3rem', fontSize: '0.7rem', color: '#f59e0b' }}>
              ⚠️ Implicit element (no explicit HAS_ELEMENT from superset)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, shape, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      <span style={{ color, fontSize: '0.9rem' }}>{shape}</span>
      <span>{label}</span>
    </span>
  );
}
