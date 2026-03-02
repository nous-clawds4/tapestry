import { useState } from 'react';

const SYSTEM_FIELDS = [
  {
    key: 'neo4jCypherQueryUrl',
    label: 'Neo4j Cypher Query URL',
    hint: 'Remote API endpoint for Neo4j queries',
    restart: true,
    type: 'url',
  },
  {
    key: 'trustScoreCutoff',
    label: 'Trust Score Cutoff',
    hint: 'Minimum trust score threshold',
    restart: true,
    type: 'number',
  },
];

export default function SystemSettings({ settings, defaults, overrides, onSave, onReset }) {
  const [editKey, setEditKey] = useState(null);
  const [editValue, setEditValue] = useState('');

  function startEdit(field) {
    setEditKey(field.key);
    setEditValue(String(settings[field.key] ?? ''));
  }

  function save(field) {
    let value = editValue.trim();
    if (field.type === 'number') value = Number(value);
    onSave({ [field.key]: value });
    setEditKey(null);
  }

  return (
    <div className="settings-section">
      <h2>🖥️ System Configuration</h2>
      <p className="settings-hint">
        Core system parameters. Fields marked with ⚠️ require a restart after changes.
      </p>

      {SYSTEM_FIELDS.map(field => {
        const isOverridden = overrides[field.key] !== undefined;
        const isEditing = editKey === field.key;
        const currentVal = settings[field.key];

        return (
          <div key={field.key} className="settings-group">
            <div className="settings-group-header">
              <div>
                <h3>
                  {field.label}
                  {field.restart && ' ⚠️'}
                  {isOverridden && <span className="badge-override">customized</span>}
                </h3>
                <p className="settings-hint">{field.hint}</p>
              </div>
              <div className="settings-group-actions">
                {!isEditing && <button className="btn-small" onClick={() => startEdit(field)}>Edit</button>}
                {isOverridden && !isEditing && (
                  <button className="btn-small" onClick={() => onReset(field.key)} title="Reset to default">↩ Reset</button>
                )}
              </div>
            </div>

            {isEditing ? (
              <div className="system-edit">
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="input-system"
                />
                <div className="relay-edit-actions">
                  <button className="btn-primary btn-small" onClick={() => save(field)}>Save</button>
                  <button className="btn-small" onClick={() => setEditKey(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <code className="system-value">{String(currentVal ?? '(not set)')}</code>
            )}
          </div>
        );
      })}
    </div>
  );
}
