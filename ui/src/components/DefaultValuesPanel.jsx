import { useState } from 'react';

/**
 * Panel for setting default values on JSON Schema properties.
 * Renders below the JSONJoy visual editor to avoid vendor patching.
 * Supports nested object properties recursively.
 */

const inputStyle = {
  width: '100%',
  padding: '0.4rem 0.6rem',
  fontSize: '0.85rem',
  fontFamily: 'monospace',
  backgroundColor: 'var(--bg-secondary, #1a1a2e)',
  color: 'var(--text-primary, #e0e0e0)',
  border: '1px solid var(--border, #444)',
  borderRadius: '4px',
};

const labelStyle = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: 'var(--text-primary, #e0e0e0)',
};

const typeHintStyle = {
  fontSize: '0.75rem',
  color: 'var(--text-muted, #888)',
  marginLeft: '0.5rem',
  fontWeight: 400,
};

const rowStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
  padding: '0.5rem 0',
};

const clearBtnStyle = {
  fontSize: '0.75rem',
  color: 'var(--text-muted, #888)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '0.4rem 0',
  textDecoration: 'underline',
};

function getDefaultForDisplay(propSchema) {
  if (propSchema.default === undefined) return '';
  const val = propSchema.default;
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  if (typeof val === 'boolean') return val;
  return String(val);
}

function parseValueForType(type, rawValue) {
  if (rawValue === '') return undefined;
  switch (type) {
    case 'number':
    case 'integer': {
      const n = Number(rawValue);
      return isNaN(n) ? rawValue : n;
    }
    case 'boolean':
      return rawValue === true || rawValue === 'true';
    case 'object':
    case 'array':
      try { return JSON.parse(rawValue); } catch { return rawValue; }
    default:
      return rawValue;
  }
}

function PropertyDefaultRow({ name, propSchema, path, onChange, depth = 0 }) {
  const type = propSchema?.type || 'string';
  const hasDefault = propSchema?.default !== undefined;
  const isObject = type === 'object' && propSchema?.properties;
  const isArray = type === 'array';

  // For objects with sub-properties, recurse
  if (isObject) {
    const subProps = propSchema.properties || {};
    const subNames = Object.keys(subProps);
    if (subNames.length === 0) return null;

    return (
      <div style={{ marginLeft: depth > 0 ? '1rem' : 0 }}>
        <div style={{ ...labelStyle, padding: '0.5rem 0 0.25rem', display: 'flex', alignItems: 'center' }}>
          <span>{name}</span>
          <span style={typeHintStyle}>object</span>
        </div>
        <div style={{
          borderLeft: '2px solid var(--border, #444)',
          paddingLeft: '0.75rem',
          marginLeft: '0.25rem',
        }}>
          {subNames.map(subName => (
            <PropertyDefaultRow
              key={[...path, subName].join('.')}
              name={subName}
              propSchema={subProps[subName]}
              path={[...path, subName]}
              onChange={onChange}
              depth={depth + 1}
            />
          ))}
        </div>
      </div>
    );
  }

  const displayValue = getDefaultForDisplay(propSchema);

  function handleChange(rawValue) {
    const parsed = parseValueForType(type, rawValue);
    onChange(path, parsed);
  }

  function handleClear() {
    onChange(path, undefined);
  }

  // Boolean: use a select
  if (type === 'boolean') {
    return (
      <div style={{ ...rowStyle, marginLeft: depth > 0 ? '1rem' : 0 }}>
        <div style={{ minWidth: '140px', ...labelStyle }}>
          {name}
          <span style={typeHintStyle}>{type}</span>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select
            value={hasDefault ? String(propSchema.default) : ''}
            onChange={(e) => {
              if (e.target.value === '') handleClear();
              else handleChange(e.target.value);
            }}
            style={{ ...inputStyle, width: 'auto', minWidth: '120px' }}
          >
            <option value="">No default</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
          {hasDefault && <button style={clearBtnStyle} onClick={handleClear}>clear</button>}
        </div>
      </div>
    );
  }

  // Array / complex object without sub-properties: use textarea
  if (isArray || (type === 'object' && !propSchema?.properties)) {
    return (
      <div style={{ marginLeft: depth > 0 ? '1rem' : 0, padding: '0.5rem 0' }}>
        <div style={{ ...labelStyle, marginBottom: '0.25rem' }}>
          {name}
          <span style={typeHintStyle}>{type}</span>
        </div>
        <textarea
          value={typeof displayValue === 'string' ? displayValue : ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`Default ${type} value (JSON)`}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace' }}
        />
        {hasDefault && <button style={clearBtnStyle} onClick={handleClear}>clear default</button>}
      </div>
    );
  }

  // String, number, integer: simple input
  return (
    <div style={{ ...rowStyle, marginLeft: depth > 0 ? '1rem' : 0 }}>
      <div style={{ minWidth: '140px', ...labelStyle }}>
        {name}
        <span style={typeHintStyle}>{type}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type={type === 'number' || type === 'integer' ? 'number' : 'text'}
          value={displayValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={`Default ${type} value`}
          style={inputStyle}
        />
        {hasDefault && <button style={clearBtnStyle} onClick={handleClear}>clear</button>}
      </div>
    </div>
  );
}


export default function DefaultValuesPanel({ schema, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const properties = schema?.properties || {};
  const propNames = Object.keys(properties);

  if (propNames.length === 0) return null;

  // Count how many defaults are set
  function countDefaults(props) {
    let count = 0;
    for (const key of Object.keys(props)) {
      const p = props[key];
      if (p.default !== undefined) count++;
      if (p.type === 'object' && p.properties) count += countDefaults(p.properties);
    }
    return count;
  }
  const defaultCount = countDefaults(properties);

  function handleDefaultChange(path, value) {
    // Deep-clone the schema and set/remove the default at the given path
    const newSchema = JSON.parse(JSON.stringify(schema));
    let target = newSchema.properties;
    for (let i = 0; i < path.length - 1; i++) {
      target = target[path[i]]?.properties || target[path[i]];
    }
    const lastKey = path[path.length - 1];
    if (target[lastKey]) {
      if (value === undefined) {
        delete target[lastKey].default;
      } else {
        target[lastKey].default = value;
      }
    }
    onChange(newSchema);
  }

  return (
    <div style={{
      marginTop: '1.5rem',
      border: '1px solid var(--border, #444)',
      borderRadius: '8px',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 1rem',
          background: 'var(--bg-secondary, #1a1a2e)',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary, #e0e0e0)',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}
      >
        <span>
          {expanded ? '▾' : '▸'} Default Values
          {defaultCount > 0 && (
            <span style={{
              marginLeft: '0.5rem',
              fontSize: '0.75rem',
              fontWeight: 400,
              color: 'var(--text-muted, #888)',
            }}>
              ({defaultCount} set)
            </span>
          )}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '0.5rem 1rem 1rem' }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', marginBottom: '0.75rem' }}>
            Set default values for properties. These are included in the JSON Schema's <code>default</code> field for each property.
          </p>
          {propNames.map(name => (
            <PropertyDefaultRow
              key={name}
              name={name}
              propSchema={properties[name]}
              path={[name]}
              onChange={handleDefaultChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
