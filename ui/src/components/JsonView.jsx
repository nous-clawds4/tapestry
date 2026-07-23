import { useState } from 'react';

/*
 * JsonView — a small, dependency-free collapsible JSON tree viewer.
 *
 * Renders arbitrary JSON as an indented, syntax-coloured tree where every
 * object/array can be expanded or collapsed. Nodes at or below `collapseDepth`
 * start collapsed so deep structures (e.g. JSON Schemas) don't render as a wall.
 * "Expand all" / "Collapse all" remount the tree so each node re-derives its
 * initial state from the forced depth.
 */

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value; // 'object' | 'string' | 'number' | 'boolean'
}

function PrimitiveValue({ value }) {
  switch (typeOf(value)) {
    case 'string':
      return <span className="jsonview-string">"{value}"</span>;
    case 'number':
      return <span className="jsonview-number">{String(value)}</span>;
    case 'boolean':
      return <span className="jsonview-boolean">{String(value)}</span>;
    case 'null':
      return <span className="jsonview-null">null</span>;
    default:
      return <span>{String(value)}</span>;
  }
}

function countLabel(type, count) {
  if (type === 'array') return `${count} ${count === 1 ? 'item' : 'items'}`;
  return `${count} ${count === 1 ? 'key' : 'keys'}`;
}

function JsonNode({ nodeKey, value, depth, collapseDepth, trailingComma }) {
  const type = typeOf(value);
  const isContainer = type === 'object' || type === 'array';
  const [collapsed, setCollapsed] = useState(depth >= collapseDepth);

  const indent = { paddingLeft: `${depth * 1.25}rem` };
  const keyEl = nodeKey !== null && nodeKey !== undefined ? (
    <>
      <span className="jsonview-key">{nodeKey}</span>
      <span className="jsonview-punct">: </span>
    </>
  ) : null;

  // Primitive leaf
  if (!isContainer) {
    return (
      <div className="jsonview-row" style={indent}>
        <span className="jsonview-caret jsonview-caret-empty" />
        {keyEl}
        <PrimitiveValue value={value} />
        {trailingComma && <span className="jsonview-punct">,</span>}
      </div>
    );
  }

  const entries = type === 'array'
    ? value.map((v, i) => [i, v])
    : Object.entries(value);
  const open = type === 'array' ? '[' : '{';
  const close = type === 'array' ? ']' : '}';

  // Empty container renders on a single line
  if (entries.length === 0) {
    return (
      <div className="jsonview-row" style={indent}>
        <span className="jsonview-caret jsonview-caret-empty" />
        {keyEl}
        <span className="jsonview-punct">{open}{close}</span>
        {trailingComma && <span className="jsonview-punct">,</span>}
      </div>
    );
  }

  return (
    <div className="jsonview-node">
      <div
        className="jsonview-row jsonview-toggle"
        style={indent}
        onClick={() => setCollapsed(c => !c)}
      >
        <span className="jsonview-caret">{collapsed ? '▸' : '▾'}</span>
        {keyEl}
        <span className="jsonview-punct">{open}</span>
        {collapsed && (
          <>
            <span className="jsonview-summary">{countLabel(type, entries.length)}</span>
            <span className="jsonview-punct">{close}</span>
            {trailingComma && <span className="jsonview-punct">,</span>}
          </>
        )}
      </div>

      {!collapsed && (
        <>
          {entries.map(([k, v], i) => (
            <JsonNode
              key={k}
              nodeKey={type === 'array' ? null : k}
              value={v}
              depth={depth + 1}
              collapseDepth={collapseDepth}
              trailingComma={i < entries.length - 1}
            />
          ))}
          <div className="jsonview-row" style={indent}>
            <span className="jsonview-caret jsonview-caret-empty" />
            <span className="jsonview-punct">{close}</span>
            {trailingComma && <span className="jsonview-punct">,</span>}
          </div>
        </>
      )}
    </div>
  );
}

export default function JsonView({ data, collapseDepth = 3 }) {
  // Bumping `remountKey` forces every JsonNode to re-initialise its collapsed
  // state from `forcedDepth` — how Expand all / Collapse all take effect.
  const [forcedDepth, setForcedDepth] = useState(collapseDepth);
  const [remountKey, setRemountKey] = useState(0);

  function expandAll() {
    setForcedDepth(Infinity);
    setRemountKey(k => k + 1);
  }
  function collapseAll() {
    setForcedDepth(1); // root open, everything beneath it collapsed
    setRemountKey(k => k + 1);
  }

  return (
    <div className="jsonview">
      <div className="jsonview-controls">
        <button className="jsonview-ctrl-btn" onClick={expandAll}>Expand all</button>
        <button className="jsonview-ctrl-btn" onClick={collapseAll}>Collapse all</button>
      </div>
      <div className="jsonview-tree">
        <JsonNode
          key={remountKey}
          nodeKey={null}
          value={data}
          depth={0}
          collapseDepth={forcedDepth}
          trailingComma={false}
        />
      </div>
    </div>
  );
}
