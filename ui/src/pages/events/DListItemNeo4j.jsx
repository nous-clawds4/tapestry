import { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';

import { cypher } from '../../api/cypher';

/* ── colour palette by label ── */
const LABEL_COLORS = {
  ListHeader:    { bg: '#58a6ff', border: '#79c0ff', font: '#e6edf3' },
  ListItem:      { bg: '#3fb950', border: '#56d364', font: '#e6edf3' },
  NostrUser:     { bg: '#d29922', border: '#e3b341', font: '#e6edf3' },
  NostrEventTag: { bg: '#484f58', border: '#6e7681', font: '#e6edf3' },
  NostrEvent:    { bg: '#bc8cff', border: '#d2a8ff', font: '#e6edf3' },
};

const LABEL_SHAPES = {
  NostrUser:     'diamond',
  NostrEventTag: 'box',
};

function colorFor(labels) {
  for (const l of ['ListHeader', 'ListItem', 'NostrUser', 'NostrEventTag', 'NostrEvent']) {
    if (labels.includes(l)) return LABEL_COLORS[l];
  }
  return LABEL_COLORS.NostrEvent;
}

function shapeFor(labels) {
  for (const [l, s] of Object.entries(LABEL_SHAPES)) {
    if (labels.includes(l)) return s;
  }
  return 'dot';
}

/* ── edge styling by type ── */
const EDGE_COLORS = {
  HAS_TAG:                      '#484f58',
  AUTHORS:                      '#d29922',
  IS_THE_CONCEPT_FOR:           '#58a6ff',
  IS_A_SUPERSET_OF:             '#58a6ff',
  HAS_ELEMENT:                  '#3fb950',
  IS_THE_JSON_SCHEMA_FOR:       '#bc8cff',
  IS_THE_PRIMARY_PROPERTY_FOR:  '#f85149',
  IS_A_PROPERTY_OF:             '#d29922',
  ENUMERATES:                   '#d29922',
  SUPERCEDES:                   '#8b949e',
};

function edgeColor(type) {
  return EDGE_COLORS[type] || '#6e7681';
}

/* ── layer groups for toggle controls ── */
const LAYERS = [
  { key: 'tags',       label: 'Tags (HAS_TAG)',        match: (e) => e.relType === 'HAS_TAG' },
  { key: 'author',     label: 'Author',                match: (e) => e.relType === 'AUTHORS' },
  { key: 'structure',  label: 'Structural (concepts)',  match: (e) => !['HAS_TAG','AUTHORS'].includes(e.relType) },
  { key: 'hop2',       label: '2nd-hop references',     match: () => false }, // controlled separately
];

/* ── tiny helpers ── */
function truncate(s, n = 28) {
  if (!s) return '—';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function friendlyLabel(labels) {
  const skip = new Set(['NostrEvent']);
  const display = labels.filter(l => !skip.includes?.(l) && !skip.has(l));
  return display.length ? display.join(', ') : labels.join(', ');
}

/* ── arrangement engine ── */

const SKELETON_ROLE_POSITIONS = {
  // Relative to center (0,0). Y-axis: positive = down.
  // Clock positions for ConceptHeader:
  //   12:00 = core graph (above)
  //   10:00 = property tree graph (up-left)
  //    9:00 = JSON schema (left)
  //    7:00 = primary property (down-left)
  //    6:00 = superset (below)
  //    5:00 = concept graph (down-right)
  coreGraph:          { x:   0, y: -200 },   // 12 o'clock
  propertyTreeGraph:  { x: -180, y: -120 },  // 10 o'clock
  jsonSchema:         { x: -220, y:   0 },   // 9 o'clock
  primaryProperty:    { x: -180, y:  120 },  // 7 o'clock
  superset:           { x:   0, y:  200 },   // 6 o'clock
  conceptGraph:       { x:  180, y:  120 },  // 5 o'clock
};

// Map relationship types to skeleton roles
function skeletonRoleFromEdge(relType, outgoing, neighbourLabels) {
  if (relType === 'IS_THE_CONCEPT_FOR' && outgoing) return 'superset';
  if (relType === 'IS_THE_CONCEPT_FOR' && !outgoing) return 'coreGraph';
  if (relType === 'IS_THE_JSON_SCHEMA_FOR') return 'jsonSchema';
  if (relType === 'IS_THE_PRIMARY_PROPERTY_FOR') return 'primaryProperty';
  if (relType === 'IS_A_SUPERSET_OF') return 'superset';
  if (relType === 'IS_THE_CORE_GRAPH_FOR') return 'coreGraph';
  if (relType === 'IS_THE_PROPERTY_TREE_GRAPH_FOR') return 'propertyTreeGraph';
  if (relType === 'IS_THE_CONCEPT_GRAPH_FOR') return 'conceptGraph';
  return null;
}

function computeArrangement(centerId, centerLabels, nodesMap, edgesArr, hop2Nodes, hop2Edges, visNodes) {
  const positions = {};
  const cx = 0, cy = 0;
  positions[centerId] = { x: cx, y: cy };

  const isHeader = centerLabels.includes('ListHeader');

  // Build lookup: nodeId → { relType, outgoing } (relative to center)
  const edgesByNeighbour = new Map();
  for (const e of edgesArr) {
    const neighbourId = e.from === centerId ? e.to : e.from;
    const outgoing = e.from === centerId;
    if (!edgesByNeighbour.has(neighbourId)) edgesByNeighbour.set(neighbourId, []);
    edgesByNeighbour.get(neighbourId).push({ relType: e.relType, outgoing });
  }

  // Classify neighbours
  const tags = [];
  const authors = [];
  const structural = [];
  const assigned = new Set(); // nodes that got specific positions

  for (const [nId, info] of nodesMap) {
    if (nId === centerId) continue;
    if (!visNodes.get(nId)) continue; // not currently visible
    if (info.labels?.includes('NostrEventTag')) { tags.push(nId); continue; }
    if (info.labels?.includes('NostrUser')) { authors.push(nId); continue; }
    structural.push(nId);
  }

  // ── ConceptHeader-specific: skeleton positions ──
  if (isHeader) {
    for (const nId of structural) {
      const edges = edgesByNeighbour.get(nId) || [];
      for (const { relType, outgoing } of edges) {
        const role = skeletonRoleFromEdge(relType, outgoing, nodesMap.get(nId)?.labels);
        if (role && SKELETON_ROLE_POSITIONS[role] && !assigned.has(role)) {
          positions[nId] = { ...SKELETON_ROLE_POSITIONS[role] };
          assigned.add(role);
          assigned.add(nId);
          break;
        }
      }
    }
  }

  // ── General: IS_A_SUPERSET_OF hierarchy (superset above, subset below) ──
  for (const nId of structural) {
    if (assigned.has(nId)) continue;
    const edges = edgesByNeighbour.get(nId) || [];
    for (const { relType, outgoing } of edges) {
      if (relType === 'IS_A_SUPERSET_OF') {
        // outgoing from center means center IS_A_SUPERSET_OF neighbour → neighbour is below
        // incoming means neighbour IS_A_SUPERSET_OF center → neighbour is above
        positions[nId] = outgoing ? { x: 0, y: 200 } : { x: 0, y: -200 };
        assigned.add(nId);
        break;
      }
      if (relType === 'HAS_ELEMENT') {
        positions[nId] = outgoing ? { x: 0, y: 200 } : { x: 0, y: -200 };
        assigned.add(nId);
        break;
      }
      if (relType === 'IS_A_PROPERTY_OF') {
        // neighbour IS_A_PROPERTY_OF center → neighbour below-left
        positions[nId] = outgoing ? { x: -160, y: -120 } : { x: -160, y: 120 };
        assigned.add(nId);
        break;
      }
      if (relType === 'ENUMERATES') {
        positions[nId] = outgoing ? { x: 0, y: 200 } : { x: 0, y: -200 };
        assigned.add(nId);
        break;
      }
    }
  }

  // ── Unassigned structural → spread on the left ──
  const unassignedStructural = structural.filter(n => !assigned.has(n));
  const structSpacing = 80;
  const structStartY = -(unassignedStructural.length - 1) * structSpacing / 2;
  unassignedStructural.forEach((nId, i) => {
    positions[nId] = { x: -250, y: structStartY + i * structSpacing };
  });

  // ── Author → top-right ──
  authors.forEach((nId, i) => {
    positions[nId] = { x: 250, y: -200 + i * 60 };
  });

  // ── Tags → stacked vertically on the right, sorted by tag type ──
  const TAG_ORDER = ['d', 'names', 'name', 'description', 'title', 'slug', 'L', 'l', 'json', 'z', 'e', 'a', 'p', 'r'];
  tags.sort((a, b) => {
    const aType = nodesMap.get(a)?.tagType || '';
    const bType = nodesMap.get(b)?.tagType || '';
    const ai = TAG_ORDER.indexOf(aType);
    const bi = TAG_ORDER.indexOf(bType);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const tagX = 320;
  const tagSpacing = 50;
  const tagStartY = -(tags.length - 1) * tagSpacing / 2;
  tags.forEach((nId, i) => {
    positions[nId] = { x: tagX, y: tagStartY + i * tagSpacing };
  });

  // ── 2nd-hop refs → further right of their referencing tag ──
  for (const e of hop2Edges) {
    const nId = e.to;
    if (!visNodes.get(nId)) continue;
    const tagPos = positions[e.from];
    if (tagPos) {
      positions[nId] = { x: tagPos.x + 200, y: tagPos.y };
    } else {
      positions[nId] = { x: 520, y: 0 };
    }
  }

  return positions;
}

/* ══════════════════════════════════════════════════════
   DListItemNeo4j — ego-graph visualisation
   ══════════════════════════════════════════════════════ */
export default function DListItemNeo4j({ eventOverride } = {}) {
  const outletCtx = useOutletContext() || {};
  const event = eventOverride || outletCtx.event;
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const networkRef = useRef(null);

  const [status, setStatus] = useState('loading');        // loading | missing | ready | error
  const [graphData, setGraphData] = useState(null);       // { nodes, edges, hop2Nodes, hop2Edges }
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null); // detail panel
  const [layers, setLayers] = useState({ tags: true, author: true, structure: true, hop2: true });
  const [arranged, setArranged] = useState(false);
  const visNodesRef = useRef(null);

  /* ── derive uuid from event ── */
  const uuid = (() => {
    if (!event) return null;
    const dTag = event.tags?.find(t => t[0] === 'd')?.[1];
    if ((event.kind === 39999 || event.kind === 39998) && dTag) {
      return `${event.kind}:${event.pubkey}:${dTag}`;
    }
    return event.id;
  })();

  /* ── fetch graph data ── */
  const fetchGraph = useCallback(async () => {
    if (!uuid) return;
    setStatus('loading');
    setError(null);

    try {
      // Check existence
      const check = await fetch(`/api/neo4j/event-check?uuid=${encodeURIComponent(uuid)}`);
      const checkJson = await check.json();

      if (!checkJson.success) throw new Error(checkJson.error);

      if (checkJson.status === 'missing_from_neo4j' || checkJson.status === 'not_found') {
        setStatus('missing');
        return;
      }

      // 1-hop: all neighbours
      const q1 = `
        MATCH (center:NostrEvent {uuid: '${esc(uuid)}'})
        OPTIONAL MATCH (center)-[r]-(neighbour)
        RETURN
          id(center)       AS centerId,
          labels(center)   AS centerLabels,
          center.name      AS centerName,
          center.uuid      AS centerUuid,
          center.kind      AS centerKind,
          center.pubkey    AS centerPubkey,
          id(neighbour)    AS nId,
          labels(neighbour) AS nLabels,
          neighbour.name   AS nName,
          neighbour.uuid   AS nUuid,
          neighbour.pubkey AS nPubkey,
          neighbour.type   AS nType,
          neighbour.value  AS nValue,
          type(r)          AS relType,
          startNode(r) = center AS outgoing
      `;

      const rows1 = await cypher(q1);
      if (!rows1.length) { setStatus('missing'); return; }

      const centerId = rows1[0].centerId;

      // Collect unique nodes and edges (1-hop)
      const nodesMap = new Map();
      const edgesArr = [];
      const tagNodeIds = new Set();

      // Center node
      nodesMap.set(centerId, {
        neoId: centerId,
        labels: rows1[0].centerLabels || [],
        name: rows1[0].centerName,
        uuid: rows1[0].centerUuid,
        pubkey: rows1[0].centerPubkey,
        kind: rows1[0].centerKind,
        isCenter: true,
      });

      for (const row of rows1) {
        if (row.nId == null) continue;
        if (!nodesMap.has(row.nId)) {
          const info = {
            neoId: row.nId,
            labels: row.nLabels || [],
            name: row.nName,
            uuid: row.nUuid,
            pubkey: row.nPubkey,
            tagType: row.nType,
            tagValue: row.nValue,
          };
          nodesMap.set(row.nId, info);
        }
        if ((row.nLabels || []).includes('NostrEventTag')) {
          tagNodeIds.add(row.nId);
        }
        const from = row.outgoing ? centerId : row.nId;
        const to = row.outgoing ? row.nId : centerId;
        edgesArr.push({ from, to, relType: row.relType, hop: 1 });
      }

      // 2-hop: for tags that REFERENCE other nodes (z, e, a tags)
      // Find tag nodes whose value looks like a uuid or event id, and fetch the referenced node
      const refTagIds = [];
      for (const [nId, info] of nodesMap) {
        if (!tagNodeIds.has(nId)) continue;
        if (['z', 'e', 'a', 'p'].includes(info.tagType) && info.tagValue) {
          refTagIds.push({ nId, tagValue: info.tagValue, tagType: info.tagType });
        }
      }

      const hop2Nodes = new Map();
      const hop2Edges = [];

      for (const ref of refTagIds) {
        let q2;
        if (ref.tagType === 'p') {
          q2 = `MATCH (n:NostrUser {pubkey: '${esc(ref.tagValue)}'}) RETURN id(n) AS nId, labels(n) AS nLabels, n.name AS nName, n.uuid AS nUuid, n.pubkey AS nPubkey LIMIT 1`;
        } else {
          q2 = `MATCH (n:NostrEvent) WHERE n.uuid = '${esc(ref.tagValue)}' OR n.id = '${esc(ref.tagValue)}' RETURN id(n) AS nId, labels(n) AS nLabels, n.name AS nName, n.uuid AS nUuid, n.pubkey AS nPubkey LIMIT 1`;
        }
        try {
          const rows2 = await cypher(q2);
          if (rows2.length && rows2[0].nId != null && !nodesMap.has(rows2[0].nId)) {
            hop2Nodes.set(rows2[0].nId, {
              neoId: rows2[0].nId,
              labels: rows2[0].nLabels || [],
              name: rows2[0].nName,
              uuid: rows2[0].nUuid,
              pubkey: rows2[0].nPubkey,
              isHop2: true,
            });
            hop2Edges.push({ from: ref.nId, to: rows2[0].nId, relType: 'REFERENCES', hop: 2 });
          }
        } catch { /* ignore lookup failures */ }
      }

      setGraphData({
        nodesMap,
        edgesArr,
        hop2Nodes,
        hop2Edges,
        centerId,
      });
      setStatus('ready');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, [uuid]);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);

  /* ── import handler ── */
  async function handleImport() {
    setImporting(true);
    try {
      const res = await fetch('/api/neo4j/event-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await fetchGraph();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  /* ── build vis-network ── */
  useEffect(() => {
    if (status !== 'ready' || !graphData || !containerRef.current) return;

    // dynamic import to avoid SSR issues
    import('vis-network/standalone').then(({ Network, DataSet }) => {
      const { nodesMap, edgesArr, hop2Nodes, hop2Edges, centerId } = graphData;

      const visNodes = new DataSet();
      const visEdges = new DataSet();

      // Helper: build vis node
      function makeVisNode(info) {
        const lbl = info.isCenter
          ? (info.name || info.uuid || 'center')
          : info.tagType
            ? `${info.tagType}: ${truncate(info.tagValue || info.name, 24)}`
            : truncate(info.name || info.uuid || info.pubkey || '?', 24);
        const colors = colorFor(info.labels);
        const shape = info.isCenter ? 'star' : shapeFor(info.labels);
        return {
          id: info.neoId,
          label: lbl,
          shape,
          size: info.isCenter ? 30 : info.isHop2 ? 14 : 18,
          color: { background: colors.bg, border: colors.border, highlight: { background: colors.border, border: colors.bg } },
          font: { color: colors.font, size: info.isCenter ? 14 : 11 },
          borderWidth: info.isCenter ? 3 : 1,
          _info: info,
        };
      }

      // Add 1-hop nodes
      for (const [nId, info] of nodesMap) {
        const isTag = info.labels?.includes('NostrEventTag');
        const isAuthor = info.labels?.includes('NostrUser');
        if (!info.isCenter) {
          if (isTag && !layers.tags) continue;
          if (isAuthor && !layers.author) continue;
          if (!isTag && !isAuthor && !info.isCenter && !layers.structure) continue;
        }
        visNodes.add(makeVisNode(info));
      }

      // Add 1-hop edges
      for (const e of edgesArr) {
        const isTag = e.relType === 'HAS_TAG';
        const isAuthor = e.relType === 'AUTHORS';
        if (isTag && !layers.tags) continue;
        if (isAuthor && !layers.author) continue;
        if (!isTag && !isAuthor && !layers.structure) continue;
        // check both endpoints exist
        if (!visNodes.get(e.from) || !visNodes.get(e.to)) continue;
        visEdges.add({
          from: e.from,
          to: e.to,
          label: e.relType,
          color: { color: edgeColor(e.relType), highlight: '#e6edf3' },
          font: { color: '#8b949e', size: 9, strokeWidth: 0 },
          arrows: 'to',
          smooth: { type: 'curvedCW', roundness: 0.15 },
        });
      }

      // Add 2-hop nodes + edges
      if (layers.hop2) {
        for (const [nId, info] of hop2Nodes) {
          visNodes.add(makeVisNode(info));
        }
        for (const e of hop2Edges) {
          if (!visNodes.get(e.from) || !visNodes.get(e.to)) continue;
          visEdges.add({
            from: e.from,
            to: e.to,
            label: 'REFERENCES',
            dashes: true,
            color: { color: '#6e7681', highlight: '#e6edf3' },
            font: { color: '#6e7681', size: 9, strokeWidth: 0 },
            arrows: 'to',
            smooth: { type: 'curvedCW', roundness: 0.15 },
          });
        }
      }

      const options = {
        physics: {
          solver: 'forceAtlas2Based',
          forceAtlas2Based: { gravitationalConstant: -60, centralGravity: 0.008, springLength: 140, springConstant: 0.04 },
          stabilization: { iterations: 150 },
        },
        interaction: {
          hover: true,
          tooltipDelay: 200,
          dragNodes: true,
          zoomView: true,
          dragView: true,
        },
        layout: { improvedLayout: true },
      };

      const net = new Network(containerRef.current, { nodes: visNodes, edges: visEdges }, options);
      networkRef.current = net;
      visNodesRef.current = visNodes;

      // Drag start → temporarily unfix so dragging works even on pinned nodes
      net.on('dragStart', (params) => {
        for (const nodeId of params.nodes) {
          visNodes.update({ id: nodeId, fixed: false });
        }
      });

      // Drag end → pin node in place (fix position)
      net.on('dragEnd', (params) => {
        if (params.nodes.length > 0) {
          for (const nodeId of params.nodes) {
            const pos = net.getPositions([nodeId])[nodeId];
            visNodes.update({ id: nodeId, fixed: { x: true, y: true }, x: pos.x, y: pos.y });
          }
        }
      });

      // Click → unpin node (release back to physics)
      net.on('click', (params) => {
        if (params.nodes.length === 1) {
          const nodeId = params.nodes[0];
          visNodes.update({ id: nodeId, fixed: false });
        }
      });

      // Double-click → toggle side panel
      net.on('doubleClick', (params) => {
        if (params.nodes.length === 1) {
          const nodeId = params.nodes[0];
          const visNode = visNodes.get(nodeId);
          const info = visNode?._info || null;
          setSelectedNode(prev => prev?.neoId === info?.neoId ? null : info);
        } else {
          setSelectedNode(null);
        }
      });

      return () => net.destroy();
    });
  }, [status, graphData, layers, navigate]);

  /* ── toggle layer ── */
  function toggleLayer(key) {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  }

  /* ── arrange toggle ── */
  function handleArrangeToggle() {
    const next = !arranged;
    setArranged(next);
    const visNodes = visNodesRef.current;
    const net = networkRef.current;
    if (!visNodes || !net || !graphData) return;

    if (!next) {
      // Unpin all nodes
      visNodes.forEach(n => visNodes.update({ id: n.id, fixed: false }));
      return;
    }

    // Compute positions
    const { nodesMap, edgesArr, hop2Nodes, hop2Edges, centerId } = graphData;
    const centerInfo = nodesMap.get(centerId);
    const centerLabels = centerInfo?.labels || [];
    const positions = computeArrangement(centerId, centerLabels, nodesMap, edgesArr, hop2Nodes, hop2Edges, visNodes);

    // Apply positions and pin
    for (const [nodeId, pos] of Object.entries(positions)) {
      const id = parseInt(nodeId);
      if (visNodes.get(id)) {
        visNodes.update({ id, x: pos.x, y: pos.y, fixed: { x: true, y: true } });
      }
    }
    net.fit({ animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
  }

  /* ── render ── */
  if (!event) return <p>No event data.</p>;

  return (
    <div className="dlist-neo4j">
      <h2>Neo4j Graph</h2>

      {status === 'loading' && <p style={{ color: 'var(--text-muted)' }}>Loading graph data…</p>}

      {status === 'error' && (
        <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--red)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <p style={{ color: 'var(--red)' }}>⚠ Error: {error}</p>
          <button className="btn" onClick={fetchGraph} style={{ marginTop: 8 }}>Retry</button>
        </div>
      )}

      {status === 'missing' && (
        <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 8, padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: '1.1em', marginBottom: 8 }}>This event is not yet in Neo4j.</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
            Importing will create a <strong>NostrEvent</strong> node with its tags and author relationship.
          </p>
          <ImportPreview event={event} />
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={importing}
            style={{ marginTop: 16 }}
          >
            {importing ? 'Importing…' : '📥 Import to Neo4j'}
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          {/* Controls row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Show:</span>
            {LAYERS.map(l => (
              <label key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer', color: layers[l.key] ? 'var(--text)' : 'var(--text-muted)' }}>
                <input type="checkbox" checked={layers[l.key]} onChange={() => toggleLayer(l.key)} />
                {l.label}
              </label>
            ))}
            <span style={{ borderLeft: '1px solid var(--border)', height: 20, margin: '0 4px' }} />
            <button
              className={`btn btn-small${arranged ? ' btn-active' : ''}`}
              onClick={handleArrangeToggle}
              style={{
                fontSize: 12,
                background: arranged ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: arranged ? '#0d1117' : 'var(--text)',
                border: `1px solid ${arranged ? 'var(--accent)' : 'var(--border)'}`,
              }}
              title={arranged ? 'Release all nodes back to physics' : 'Arrange nodes in a structured layout'}
            >
              {arranged ? '📐 Arranged' : '📐 Arrange'}
            </button>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
            {Object.entries(LABEL_COLORS).map(([label, c]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: c.bg, display: 'inline-block', border: `2px solid ${c.border}` }} />
                {label}
              </span>
            ))}
          </div>

          {/* Graph container */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div
              ref={containerRef}
              style={{
                flex: 1,
                height: 520,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
            />

            {/* Detail panel */}
            {selectedNode && (
              <NodePanel
                info={selectedNode}
                onClose={() => setSelectedNode(null)}
                onNavigate={(path) => navigate(path)}
              />
            )}
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
            Drag to pin · Click to unpin · Double-click to inspect · Scroll to zoom
          </p>
        </>
      )}
    </div>
  );
}

/* ── Import preview: what will be created ── */
function ImportPreview({ event }) {
  const tagCount = event.tags?.length || 0;
  return (
    <div style={{ textAlign: 'left', background: 'var(--bg-secondary)', borderRadius: 6, padding: 12, display: 'inline-block', fontSize: 13 }}>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>Preview — will create:</p>
      <ul style={{ listStyle: 'none', paddingLeft: 0, lineHeight: 1.8 }}>
        <li>📦 <strong>1</strong> NostrEvent node (kind {event.kind})</li>
        <li>🏷️ <strong>{tagCount}</strong> NostrEventTag node{tagCount !== 1 ? 's' : ''}</li>
        <li>👤 <strong>1</strong> NostrUser node (or merge with existing)</li>
        <li>🔗 <strong>{tagCount + 1}</strong> relationship{tagCount !== 1 ? 's' : ''} (HAS_TAG × {tagCount} + AUTHORS × 1)</li>
      </ul>
    </div>
  );
}

/* ── Side panel for selected node ── */
function NodePanel({ info, onClose, onNavigate }) {
  const labels = info.labels || [];
  const isTag = labels.includes('NostrEventTag');
  const isUser = labels.includes('NostrUser');

  function navPath() {
    if (isUser && info.pubkey) return `/kg/users/${info.pubkey}`;
    if (info.uuid) return `/kg/databases/neo4j/nodes/${encodeURIComponent(info.uuid)}`;
    return null;
  }

  return (
    <div style={{
      width: 280,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 16,
      fontSize: 13,
      lineHeight: 1.6,
      flexShrink: 0,
      maxHeight: 520,
      overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ fontSize: 14 }}>{friendlyLabel(labels)}</strong>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}
          title="Close panel"
        >✕</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {info.name && (
            <tr>
              <td style={tdLabel}>Name</td>
              <td style={tdValue}>{info.name}</td>
            </tr>
          )}
          {isTag && info.tagType && (
            <tr>
              <td style={tdLabel}>Tag</td>
              <td style={tdValue}><code>{info.tagType}</code></td>
            </tr>
          )}
          {isTag && info.tagValue && (
            <tr>
              <td style={tdLabel}>Value</td>
              <td style={{ ...tdValue, wordBreak: 'break-all' }}><code style={{ fontSize: '0.85em' }}>{info.tagValue}</code></td>
            </tr>
          )}
          {info.uuid && (
            <tr>
              <td style={tdLabel}>UUID</td>
              <td style={{ ...tdValue, wordBreak: 'break-all' }}><code style={{ fontSize: '0.85em' }}>{info.uuid}</code></td>
            </tr>
          )}
          {info.pubkey && (
            <tr>
              <td style={tdLabel}>Pubkey</td>
              <td style={{ ...tdValue, wordBreak: 'break-all' }}><code style={{ fontSize: '0.85em' }}>{info.pubkey}</code></td>
            </tr>
          )}
          {info.kind != null && (
            <tr>
              <td style={tdLabel}>Kind</td>
              <td style={tdValue}>{info.kind}</td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {navPath() && (
          <button className="btn btn-small" onClick={() => onNavigate(navPath())}>
            Open Detail →
          </button>
        )}
        {!info.isCenter && info.uuid && (
          <button className="btn btn-small" onClick={() => {
            const encoded = encodeURIComponent(info.uuid);
            // Try to find matching dlist-item route
            const parts = info.uuid.split(':');
            if (parts[0] === '39999' || parts[0] === '9999') {
              onNavigate(`/kg/lists/items/${encoded}`);
            } else {
              onNavigate(`/kg/databases/neo4j/nodes/${encoded}`);
            }
          }}>
            View Event →
          </button>
        )}
      </div>
    </div>
  );
}

const tdLabel = { color: 'var(--text-muted)', paddingRight: 8, verticalAlign: 'top', whiteSpace: 'nowrap' };
const tdValue = { color: 'var(--text)' };

/* ── escape for Cypher string literals ── */
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
