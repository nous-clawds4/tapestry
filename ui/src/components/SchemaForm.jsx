import { useState, useEffect, useMemo } from 'react';

/**
 * Dynamic form generated from a JSON Schema.
 * Handles nested objects recursively, type-aware inputs,
 * and pre-populates with schema defaults.
 */

const inputStyle = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  backgroundColor: 'var(--bg-secondary, #1a1a2e)',
  color: 'var(--text-primary, #e0e0e0)',
  border: '1px solid var(--border, #444)',
  borderRadius: '6px',
};

const monoInputStyle = {
  ...inputStyle,
  fontFamily: 'monospace',
  fontSize: '0.8rem',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--text-primary, #e0e0e0)',
  marginBottom: '0.25rem',
};

const descStyle = {
  fontSize: '0.75rem',
  color: 'var(--text-muted, #888)',
  marginBottom: '0.35rem',
};

const typeTagStyle = {
  fontSize: '0.7rem',
  color: 'var(--text-muted, #888)',
  fontWeight: 400,
  marginLeft: '0.4rem',
};

const requiredStar = {
  color: '#ef4444',
  marginLeft: '0.2rem',
};

/**
 * Build initial form values from a JSON Schema, using defaults where available.
 */
export function buildInitialValues(schema, overrides = {}) {
  const properties = schema?.properties || {};
  const values = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    if (overrides[key] !== undefined) {
      values[key] = overrides[key];
      continue;
    }
    if (propSchema.default !== undefined) {
      values[key] = typeof propSchema.default === 'object'
        ? JSON.parse(JSON.stringify(propSchema.default))
        : propSchema.default;
      continue;
    }
    const type = propSchema.type || 'string';
    switch (type) {
      case 'string':  values[key] = ''; break;
      case 'number':
      case 'integer': values[key] = ''; break;  // keep empty string for controlled input
      case 'boolean': values[key] = false; break;
      case 'object':
        if (propSchema.properties) {
          values[key] = buildInitialValues(propSchema);
        } else {
          values[key] = '';  // raw JSON string for unstructured objects
        }
        break;
      case 'array':   values[key] = ''; break;  // raw JSON string
      default:        values[key] = ''; break;
    }
  }
  return values;
}

/**
 * Convert form values into proper typed JSON for the element.
 */
export function formValuesToJson(schema, values) {
  const properties = schema?.properties || {};
  const result = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    const type = propSchema.type || 'string';
    const val = values[key];

    if (type === 'object' && propSchema.properties && typeof val === 'object' && val !== null) {
      result[key] = formValuesToJson(propSchema, val);
    } else if (type === 'number' || type === 'integer') {
      result[key] = val === '' ? (propSchema.default ?? 0) : Number(val);
    } else if (type === 'boolean') {
      result[key] = Boolean(val);
    } else if ((type === 'object' || type === 'array') && typeof val === 'string') {
      if (val.trim() === '') {
        result[key] = type === 'array' ? [] : {};
      } else {
        try { result[key] = JSON.parse(val); }
        catch { result[key] = val; }
      }
    } else {
      result[key] = val;
    }
  }
  return result;
}


function PropertyField({ name, propSchema, value, onChange, required, disabled, depth = 0 }) {
  const type = propSchema?.type || 'string';
  const description = propSchema?.description;
  const enumValues = propSchema?.enum;
  const isNestedObject = type === 'object' && propSchema?.properties;

  // Nested object: recurse
  if (isNestedObject) {
    const subProps = propSchema.properties;
    const subRequired = new Set(propSchema.required || []);
    const subValues = (typeof value === 'object' && value !== null) ? value : {};

    function handleSubChange(subKey, subVal) {
      onChange({ ...subValues, [subKey]: subVal });
    }

    return (
      <div style={{ marginBottom: '1rem' }}>
        <div style={labelStyle}>
          {name}
          <span style={typeTagStyle}>object</span>
          {required && <span style={requiredStar}>*</span>}
        </div>
        {description && <div style={descStyle}>{description}</div>}
        <div style={{
          borderLeft: '2px solid var(--border, #444)',
          paddingLeft: '1rem',
          marginLeft: '0.25rem',
          marginTop: '0.25rem',
        }}>
          {Object.entries(subProps).map(([subName, subSchema]) => (
            <PropertyField
              key={subName}
              name={subName}
              propSchema={subSchema}
              value={subValues[subName]}
              onChange={(val) => handleSubChange(subName, val)}
              required={subRequired.has(subName)}
              disabled={disabled}
              depth={depth + 1}
            />
          ))}
        </div>
      </div>
    );
  }

  // Boolean: checkbox
  if (type === 'boolean') {
    return (
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
          />
          <span style={{ ...labelStyle, marginBottom: 0 }}>
            {name}
            <span style={typeTagStyle}>boolean</span>
            {required && <span style={requiredStar}>*</span>}
          </span>
        </label>
        {description && <div style={{ ...descStyle, marginLeft: '1.5rem' }}>{description}</div>}
      </div>
    );
  }

  // Enum: select dropdown
  if (enumValues && enumValues.length > 0) {
    return (
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>
          {name}
          <span style={typeTagStyle}>{type}</span>
          {required && <span style={requiredStar}>*</span>}
        </label>
        {description && <div style={descStyle}>{description}</div>}
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{ ...inputStyle, cursor: 'pointer' }}
        >
          <option value="">— select —</option>
          {enumValues.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
    );
  }

  // Array or unstructured object: textarea for raw JSON
  if (type === 'array' || (type === 'object' && !propSchema?.properties)) {
    const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : (value ?? '');
    return (
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>
          {name}
          <span style={typeTagStyle}>{type}</span>
          {required && <span style={requiredStar}>*</span>}
        </label>
        {description && <div style={descStyle}>{description}</div>}
        <textarea
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={4}
          placeholder={type === 'array' ? '[\n  \n]' : '{\n  \n}'}
          style={{ ...monoInputStyle, resize: 'vertical' }}
        />
      </div>
    );
  }

  // Number / integer
  if (type === 'number' || type === 'integer') {
    return (
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>
          {name}
          <span style={typeTagStyle}>{type}</span>
          {required && <span style={requiredStar}>*</span>}
        </label>
        {description && <div style={descStyle}>{description}</div>}
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={`Enter ${type}`}
          step={type === 'integer' ? 1 : 'any'}
          style={inputStyle}
        />
      </div>
    );
  }

  // String (default)
  const isLong = description?.toLowerCase().includes('description') || name === 'description' || name === 'about' || name === 'content';
  if (isLong) {
    return (
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>
          {name}
          <span style={typeTagStyle}>string</span>
          {required && <span style={requiredStar}>*</span>}
        </label>
        {description && <div style={descStyle}>{description}</div>}
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={3}
          placeholder={`Enter ${name}`}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={labelStyle}>
        {name}
        <span style={typeTagStyle}>string</span>
        {required && <span style={requiredStar}>*</span>}
      </label>
      {description && <div style={descStyle}>{description}</div>}
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={propSchema?.format === 'uuid' ? 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' : `Enter ${name}`}
        style={inputStyle}
      />
    </div>
  );
}


/**
 * SchemaForm — renders a dynamic form from a JSON Schema.
 *
 * Props:
 *   schema     — the JSON Schema object
 *   values     — current form values (controlled)
 *   onChange   — (newValues) => void
 *   disabled   — disable all inputs
 */
export default function SchemaForm({ schema, values, onChange, disabled = false }) {
  const properties = schema?.properties || {};
  const requiredFields = new Set(schema?.required || []);
  const propNames = Object.keys(properties);

  if (propNames.length === 0) {
    return <p style={{ opacity: 0.6, fontStyle: 'italic' }}>No schema properties defined.</p>;
  }

  function handleFieldChange(key, val) {
    onChange({ ...values, [key]: val });
  }

  return (
    <div>
      {propNames.map(name => (
        <PropertyField
          key={name}
          name={name}
          propSchema={properties[name]}
          value={values[name]}
          onChange={(val) => handleFieldChange(name, val)}
          required={requiredFields.has(name)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
