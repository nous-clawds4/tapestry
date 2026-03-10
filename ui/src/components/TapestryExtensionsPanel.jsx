import { useState, useMemo } from 'react';

/**
 * Panel for editing x-tapestry extensions on JSON Schema properties.
 * Renders below the visual schema editor.
 *
 * Currently supports:
 *   - unique: array of property names that must be unique across elements
 *
 * Works by reading/writing x-tapestry on each top-level property object
 * in the schema (the primary property level).
 */

const inputStyle = {
  padding: '0.35rem 0.5rem',
  fontSize: '0.85rem',
  backgroundColor: 'var(--bg-secondary, #1a1a2e)',
  color: 'var(--text-primary, #e0e0e0)',
  border: '1px solid var(--border, #444)',
  borderRadius: '4px',
};

/**
 * Find all top-level property objects in the schema that have sub-properties.
 * These are the primary property wrappers (e.g., { dog: { type: "object", properties: { name, slug, ... } } }).
 */
function findPropertyContainers(schema) {
  const containers = [];
  const topProps = schema?.properties || {};
  for (const [key, prop] of Object.entries(topProps)) {
    if (prop?.type === 'object' && prop?.properties) {
      containers.push({ key, prop });
    }
  }
  // If no nested object properties, treat the schema root as the container
  if (containers.length === 0 && schema?.properties) {
    containers.push({ key: null, prop: schema });
  }
  return containers;
}

function UniqueFieldsEditor({ propKey, prop, allFieldNames, onChange }) {
  const xTapestry = prop['x-tapestry'] || {};
  const uniqueFields = xTapestry.unique || [];
  // Also check legacy `unique` at prop level
  const legacyUnique = prop.unique || [];
  const effectiveUnique = uniqueFields.length > 0 ? uniqueFields : legacyUnique;

  const [showMigrate, setShowMigrate] = useState(legacyUnique.length > 0 && uniqueFields.length === 0);

  function handleToggle(fieldName) {
    const newUnique = effectiveUnique.includes(fieldName)
      ? effectiveUnique.filter(f => f !== fieldName)
      : [...effectiveUnique, fieldName];
    // Write to x-tapestry, remove legacy
    const newXTapestry = { ...xTapestry, unique: newUnique };
    const newProp = { ...prop, 'x-tapestry': newXTapestry };
    // Remove legacy unique if present
    delete newProp.unique;
    onChange(propKey, newProp);
    setShowMigrate(false);
  }

  function handleMigrate() {
    const newXTapestry = { ...xTapestry, unique: [...legacyUnique] };
    const newProp = { ...prop, 'x-tapestry': newXTapestry };
    delete newProp.unique;
    onChange(propKey, newProp);
    setShowMigrate(false);
  }

  const label = propKey ? `${propKey}` : 'root';

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
          Unique fields{propKey ? ` (${label})` : ''}
        </span>
        {showMigrate && (
          <button
            className="btn-small"
            onClick={handleMigrate}
            style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}
            title="Move legacy 'unique' array to x-tapestry.unique"
          >
            ⚠️ Migrate from legacy format
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {allFieldNames.map(fieldName => {
          const isUnique = effectiveUnique.includes(fieldName);
          return (
            <button
              key={fieldName}
              onClick={() => handleToggle(fieldName)}
              style={{
                padding: '0.25rem 0.6rem',
                fontSize: '0.8rem',
                borderRadius: '4px',
                border: `1px solid ${isUnique ? 'rgba(99, 102, 241, 0.5)' : 'var(--border, #444)'}`,
                backgroundColor: isUnique ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                color: isUnique ? '#a5b4fc' : 'var(--text-muted, #888)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              title={isUnique ? `Remove ${fieldName} from unique constraint` : `Mark ${fieldName} as unique`}
            >
              {isUnique ? '🔑 ' : ''}{fieldName}
            </button>
          );
        })}
      </div>
      {effectiveUnique.length > 0 && (
        <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.3rem' }}>
          x-tapestry.unique: [{effectiveUnique.join(', ')}]
        </div>
      )}
    </div>
  );
}

/**
 * TapestryExtensionsPanel — edits x-tapestry extensions on JSON Schema.
 *
 * Props:
 *   schema   — current JSON Schema object (the one being edited)
 *   onChange — (newSchema) => void
 */
export default function TapestryExtensionsPanel({ schema, onChange }) {
  const containers = useMemo(() => findPropertyContainers(schema), [schema]);

  if (containers.length === 0) return null;

  // Check if any container has unique fields (active or legacy)
  const hasAnyUnique = containers.some(({ prop }) =>
    (prop['x-tapestry']?.unique?.length > 0) || (prop.unique?.length > 0)
  );

  function handlePropChange(propKey, newProp) {
    if (propKey === null) {
      // Root-level schema is the container
      onChange({ ...schema, ...newProp });
    } else {
      onChange({
        ...schema,
        properties: {
          ...schema.properties,
          [propKey]: newProp,
        },
      });
    }
  }

  return (
    <div style={{
      marginTop: '1.5rem',
      padding: '1rem',
      borderRadius: '8px',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      backgroundColor: 'rgba(99, 102, 241, 0.03)',
    }}>
      <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        🧩 Tapestry Extensions
        <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.5 }}>(x-tapestry)</span>
      </h3>
      <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '1rem', marginTop: 0 }}>
        Click field names to toggle uniqueness constraints. Unique fields must have distinct values across all elements of this concept.
      </p>
      {containers.map(({ key, prop }) => {
        const subProps = prop?.properties || {};
        const fieldNames = Object.keys(subProps);
        if (fieldNames.length === 0) return null;
        return (
          <UniqueFieldsEditor
            key={key || '__root__'}
            propKey={key}
            prop={prop}
            allFieldNames={fieldNames}
            onChange={handlePropChange}
          />
        );
      })}
    </div>
  );
}
