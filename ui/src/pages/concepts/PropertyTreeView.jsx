import { useRef, useEffect, useState, useMemo } from 'react';
import { useCypher } from '../../hooks/useCypher';

/**
 * Property Tree View
 *
 * Visualizes the property tree of a concept:
 *   JSON Schema (right) ← Primary Property ← nested properties (left)
 *
 * Wind blows left to spread the tree horizontally.
 * IS_A_PROPERTY_OF edges point from child → parent (toward the schema).
 */

// ── Colors ────────────────────────────────────────────────

const COLORS = {
  jsonSchema:     { bg: '#f59e0b', border: '#fbbf24', font: '#000' },
  primaryProp:    { bg: '#8b5cf6', border: '#a78bfa', font: '#fff' },
  objectProp:     { bg: '#0ea5e9', border: '#38bdf8', font: '#fff' },
  leafProp:       { bg: '#22c55e', border: '#4ade80', font: '#fff' },
};

const EDGE_COLOR = '#a78bfa';

function truncate(str, max = 28) {
  if (!str) return '?';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// ── Component ─────────────────────────────────────────────

export default function PropertyTreeView({ uuid, conceptName }) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [physicsOn, setPhysicsOn] = useState(true);
  const [windX, setWindX] = useState(-15);
  const [centralGravity, setCentralGravity] = useState(-60);
  const [springLength, setSpringLength] = useState(140);
  const [showControls, setShowControls] = useState(false);

  // ── 1. Fetch property tree data ──

  const { data: treeData, loading, error } = useCypher(
    uuid ? `
      MATCH (h:NostrEvent {uuid: '${uuid}'})
      OPTIONAL MATCH (js)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
      OPTIONAL MATCH (pp)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)
      WITH h, js, pp
      OPTIONAL MATCH path = (prop:Property)-[:IS_A_PROPERTY_OF*1..10]->(js)
      WITH h, js, pp, prop, relationships(path) AS rels
      UNWIND (CASE WHEN rels IS NULL THEN [null] ELSE rels END) AS r
      WITH h,
           head(collect(DISTINCT js)) AS js0,
           head(collect(DISTINCT pp)) AS pp0,
           collect(DISTINCT prop) AS allProps,
           collect(DISTINCT {
             fromUuid: CASE WHEN r IS NOT NULL THEN startNode(r).uuid ELSE null END,
             toUuid: CASE WHEN r IS NOT NULL THEN endNode(r).uuid ELSE null END
           }) AS rawEdges
      RETURN h.uuid AS headerUuid, h.name AS headerName,
             js0.uuid AS schemaUuid, js0.name AS schemaName,
             pp0.uuid AS primaryUuid, pp0.name AS primaryName,
             [p IN allProps | { uuid: p.uuid, name: p.name, labels: labels(p) }] AS props,
             [e IN rawEdges WHERE e.fromUuid IS NOT NULL | e] AS edges
    ` : null
  );

  // ── 2. Compute graph data ──

  const graphData = useMemo(() => {
    if (!treeData || treeData.length === 0) return null;
    const row = treeData[0];
    if (!row.schemaUuid) return null;

    const nodesMap = new Map();

    // JSON Schema node
    nodesMap.set(row.schemaUuid, {
      uuid: row.schemaUuid,
      name: row.schemaName || 'JSON Schema',
      role: 'schema',
    });

    // Property nodes
    for (const p of (row.props || [])) {
      if (!p.uuid || nodesMap.has(p.uuid)) continue;
      const isPrimary = p.uuid === row.primaryUuid;
      // Determine if object (has children) or leaf
      const hasChildren = (row.edges || []).some(e => e.toUuid === p.uuid);
      nodesMap.set(p.uuid, {
        uuid: p.uuid,
        name: p.name,
        role: isPrimary ? 'primary' : hasChildren ? 'object' : 'leaf',
        labels: p.labels || [],
      });
    }

    // If primary property exists but wasn't in the props list, add it
    if (row.primaryUuid && !nodesMap.has(row.primaryUuid)) {
      nodesMap.set(row.primaryUuid, {
        uuid: row.primaryUuid,
        name: row.primaryName || 'Primary Property',
        role: 'primary',
      });
    }

    const edges = (row.edges || []).filter(e => e.fromUuid && e.toUuid);

    return { nodesMap, edges, schemaUuid: row.schemaUuid, primaryUuid: row.primaryUuid };
  }, [treeData]);

  // ── 3. Build vis-network ──

  useEffect(() => {
    if (!graphData || !containerRef.current) return;

    import('vis-network/standalone').then(({ Network, DataSet }) => {
      const { nodesMap, edges, schemaUuid, primaryUuid } = graphData;

      const visNodes = new DataSet();
      const visEdges = new DataSet();

      // Compute depth for each node (distance from schema)
      const childrenOf = new Map(); // parentUuid → [childUuid]
      for (const e of edges) {
        if (!childrenOf.has(e.toUuid)) childrenOf.set(e.toUuid, []);
        childrenOf.get(e.toUuid).push(e.fromUuid);
      }

      const depthMap = new Map();
      function computeDepth(nodeUuid, depth) {
        depthMap.set(nodeUuid, depth);
        for (const child of (childrenOf.get(nodeUuid) || [])) {
          computeDepth(child, depth + 1);
        }
      }
      computeDepth(schemaUuid, 0);

      for (const [nodeUuid, info] of nodesMap) {
        const isSchema = info.role === 'schema';
        const isPrimary = info.role === 'primary';
        const isObject = info.role === 'object';
        const colors = isSchema ? COLORS.jsonSchema
          : isPrimary ? COLORS.primaryProp
          : isObject ? COLORS.objectProp
          : COLORS.leafProp;

        const depth = depthMap.get(nodeUuid) || 0;

        visNodes.add({
          id: nodeUuid,
          label: truncate(info.name),
          shape: isSchema ? 'diamond' : isPrimary ? 'triangle' : isObject ? 'dot' : 'box',
          size: isSchema ? 22 : isPrimary ? 18 : 14,
          color: { background: colors.bg, border: colors.border, highlight: { background: colors.border, border: colors.bg } },
          font: { color: colors.font, size: isSchema ? 12 : 11, face: 'system-ui' },
          borderWidth: isSchema || isPrimary ? 2 : 1,
          mass: isSchema ? 5 : 1,
          // Pin schema on the right
          ...(isSchema ? { x: 300, y: 0, fixed: { x: true, y: true } } : {}),
          _info: info,
          _depth: depth,
        });
      }

      // Add edges (IS_A_PROPERTY_OF: child → parent)
      for (const e of edges) {
        if (!visNodes.get(e.fromUuid) || !visNodes.get(e.toUuid)) continue;
        visEdges.add({
          from: e.fromUuid,
          to: e.toUuid,
          label: 'PROPERTY_OF',
          color: { color: EDGE_COLOR, highlight: '#e6edf3' },
          font: { color: '#8b949e', size: 8, strokeWidth: 0 },
          arrows: 'to',
          width: 1.5,
          smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.4 },
        });
      }

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
            avoidOverlap: 0.8,
          },
          stabilization: { iterations: 200, updateInterval: 25 },
          wind: { x: windX, y: 0 },
        },
        layout: { improvedLayout: true },
        edges: {
          arrows: { to: { scaleFactor: 0.6 } },
          font: { align: 'middle' },
        },
        nodes: {
          shadow: { enabled: true, color: 'rgba(0,0,0,0.3)', size: 4, x: 2, y: 2 },
        },
        interaction: { hover: true, tooltipDelay: 200, zoomView: true, dragView: true },
      };

      const network = new Network(containerRef.current, { nodes: visNodes, edges: visEdges }, options);
      networkRef.current = network;

      network.on('stabilized', () => {
        setPhysicsOn(false);
        network.setOptions({ physics: { enabled: false } });
      });

      network.on('click', (params) => {
        if (params.nodes.length > 0) {
          const nodeId = params.nodes[0];
          const node = visNodes.get(nodeId);
          if (node?._info) {
            setTooltip({
              name: node._info.name,
              role: node._info.role,
              uuid: nodeId,
              depth: node._depth,
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
  }, [graphData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 3b. Sync physics controls ──

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
          avoidOverlap: 0.8,
        },
        wind: { x: windX, y: 0 },
      },
    });
  }, [physicsOn, centralGravity, springLength, windX]);

  // ── 4. Render ──

  if (loading) return <div className="loading">Loading property tree…</div>;
  if (error) return <div className="error">Error: {error.message}</div>;
  if (!graphData) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
        <p>No property tree found for <strong>{conceptName}</strong>.</p>
        <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
          Generate one via: <code>POST /api/normalize/generate-property-tree</code>
        </p>
      </div>
    );
  }

  const nodeCount = graphData.nodesMap.size;
  const edgeCount = graphData.edges.length;

  return (
    <div>
      {/* Stats */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1.5rem',
        marginBottom: '0.75rem', fontSize: '0.8rem', opacity: 0.7,
      }}>
        <span>{nodeCount} nodes</span>
        <span>{edgeCount} edges</span>
      </div>

      {/* Legend + Controls toggle */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem' }}>
          <LegendItem color={COLORS.jsonSchema.bg} shape="◆" label="JSON Schema" />
          <LegendItem color={COLORS.primaryProp.bg} shape="▲" label="Primary Property" />
          <LegendItem color={COLORS.objectProp.bg} shape="●" label="Object Property" />
          <LegendItem color={COLORS.leafProp.bg} shape="■" label="Leaf Property" />
        </div>
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

      {/* Physics Controls */}
      {showControls && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.2rem',
          padding: '0.6rem 0.8rem', marginBottom: '0.75rem',
          backgroundColor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
          fontSize: '0.75rem',
        }}>
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

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ opacity: 0.7 }}>← Wind</span>
            <input
              type="range" min={-50} max={0} step={0.5} value={windX}
              onChange={e => setWindX(Number(e.target.value))}
              style={{ width: 100, accentColor: '#8b5cf6' }}
            />
            <span style={{ opacity: 0.5, minWidth: 32, textAlign: 'right' }}>{windX.toFixed(1)}</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ opacity: 0.7 }}>Gravity</span>
            <input
              type="range" min={-300} max={0} step={5} value={centralGravity}
              onChange={e => setCentralGravity(Number(e.target.value))}
              style={{ width: 100, accentColor: '#6366f1' }}
            />
            <span style={{ opacity: 0.5, minWidth: 32, textAlign: 'right' }}>{centralGravity}</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ opacity: 0.7 }}>Spring</span>
            <input
              type="range" min={30} max={300} step={10} value={springLength}
              onChange={e => setSpringLength(Number(e.target.value))}
              style={{ width: 100, accentColor: '#6366f1' }}
            />
            <span style={{ opacity: 0.5, minWidth: 32, textAlign: 'right' }}>{springLength}</span>
          </label>

          <button
            onClick={() => { setWindX(-15); setCentralGravity(-60); setSpringLength(140); setPhysicsOn(true); }}
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
          width: '100%', height: '600px',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
          backgroundColor: '#0d1117', position: 'relative',
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
          borderRadius: '6px', fontSize: '0.8rem', maxWidth: '280px',
          zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{tooltip.name}</div>
          <div style={{ opacity: 0.6, fontSize: '0.7rem', wordBreak: 'break-all' }}>{tooltip.uuid}</div>
          <div style={{ marginTop: '0.25rem' }}>
            <span style={{
              fontSize: '0.65rem', padding: '0.1rem 0.3rem',
              borderRadius: '3px', backgroundColor: 'rgba(139, 92, 246, 0.15)',
              color: '#a78bfa',
            }}>
              {tooltip.role} · depth {tooltip.depth}
            </span>
          </div>
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
