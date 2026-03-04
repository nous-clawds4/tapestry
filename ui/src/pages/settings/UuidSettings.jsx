import { useState } from 'react';

const CONCEPT_UUIDS = [
  { key: 'nodeType', label: 'Node Types' },
  { key: 'superset', label: 'Supersets' },
  { key: 'set', label: 'Sets' },
  { key: 'relationship', label: 'Relationships' },
  { key: 'relationshipType', label: 'Relationship Types' },
  { key: 'property', label: 'Properties' },
  { key: 'JSONSchema', label: 'JSON Schemas' },
  { key: 'list', label: 'Lists' },
  { key: 'jsonDataType', label: 'JSON Data Types' },
  { key: 'graphType', label: 'Graph Types' },
  { key: 'graph', label: 'Graphs' },
];

const RELATIONSHIP_TYPE_UUIDS = [
  { key: 'CLASS_THREAD_INITIATION', label: 'Class Thread Initiation' },
  { key: 'CLASS_THREAD_PROPAGATION', label: 'Class Thread Propagation' },
  { key: 'CLASS_THREAD_TERMINATION', label: 'Class Thread Termination' },
  { key: 'IS_A_PROPERTY_OF', label: 'Is a Property Of' },
  { key: 'IS_THE_JSON_SCHEMA_FOR', label: 'Is the JSON Schema For' },
  { key: 'ENUMERATES', label: 'Enumerates' },
];

export default function UuidSettings({ settings, defaults, overrides, onSave, onReset }) {
  return (
    <div className="settings-section">
      <h2>🔑 Concept & Relationship Type UUIDs</h2>
      <p className="settings-hint">
        These identify the canonical list headers and items that define the knowledge graph schema.
        Changes here <strong>require a restart</strong> to take effect.
      </p>

      <h3>Concept UUIDs (List Headers)</h3>
      <UuidGroup
        items={CONCEPT_UUIDS}
        section="conceptUUIDs"
        settings={settings?.conceptUUIDs || {}}
        defaults={defaults?.conceptUUIDs || {}}
        overrides={overrides?.conceptUUIDs || {}}
        onSave={onSave}
        onReset={onReset}
      />

      <h3 style={{ marginTop: 24 }}>Relationship Type UUIDs (List Items)</h3>
      <UuidGroup
        items={RELATIONSHIP_TYPE_UUIDS}
        section="relationshipTypeUUIDs"
        settings={settings?.relationshipTypeUUIDs || {}}
        defaults={defaults?.relationshipTypeUUIDs || {}}
        overrides={overrides?.relationshipTypeUUIDs || {}}
        onSave={onSave}
        onReset={onReset}
      />
    </div>
  );
}

function UuidGroup({ items, section, settings, defaults, overrides, onSave, onReset }) {
  const [editKey, setEditKey] = useState(null);
  const [editValue, setEditValue] = useState('');

  function startEdit(key) {
    setEditKey(key);
    setEditValue(settings[key] || '');
  }

  function save() {
    onSave({ [section]: { [editKey]: editValue.trim() } });
    setEditKey(null);
  }

  function cancel() {
    setEditKey(null);
  }

  return (
    <div className="uuid-table">
      {items.map(({ key, label }) => {
        const isOverridden = overrides[key] !== undefined;
        const isEditing = editKey === key;

        return (
          <div key={key} className="uuid-row">
            <div className="uuid-label">
              {label}
              {isOverridden && <span className="badge-override">customized</span>}
            </div>
            {isEditing ? (
              <div className="uuid-edit">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="input-uuid"
                  placeholder="kind:pubkey:d-tag"
                />
                <button className="btn-primary btn-small" onClick={save}>Save</button>
                <button className="btn-small" onClick={cancel}>Cancel</button>
              </div>
            ) : (
              <div className="uuid-value-row">
                <code className="uuid-value" title={settings[key]}>{settings[key] || '(not set)'}</code>
                <button className="btn-small" onClick={() => startEdit(key)}>Edit</button>
                {isOverridden && (
                  <button className="btn-small" onClick={() => onReset(`${section}.${key}`)} title="Reset to default">↩</button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
