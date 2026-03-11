import { useState, useMemo, useCallback } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import { useAuth } from '../../context/AuthContext';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';

/**
 * Element detail page within a concept's context.
 * Route: /kg/concepts/:uuid/elements/:elemUuid
 *
 * Shows the element with editing scoped to this concept's JSON Schema.
 */
export default function ElementDetail() {
  const { concept, uuid: conceptUuid } = useOutletContext();
  const { elemUuid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.classification === 'owner';

  const [activeTab, setActiveTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch the element node
  const { data: elemData, loading: elemLoading, refetch: refetchElem } = useCypher(`
    MATCH (e:NostrEvent {uuid: '${elemUuid}'})
    OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
    OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag)
    WITH e, head(collect(DISTINCT j.value)) AS json,
         collect(DISTINCT {type: t.type, value: t.value}) AS tags
    RETURN e.uuid AS uuid, e.name AS name, e.pubkey AS author,
           e.kind AS kind, e.created_at AS created_at,
           json, tags
  `);

  // Fetch the concept's JSON Schema
  const { data: schemaData } = useCypher(`
    MATCH (h:NostrEvent {uuid: '${conceptUuid}'})
    OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
    OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    RETURN head(collect(jt.value)) AS schemaJson
  `);

  const elem = elemData?.[0];
  const fullJson = useMemo(() => {
    if (!elem?.json) return {};
    try { return typeof elem.json === 'string' ? JSON.parse(elem.json) : elem.json; }
    catch { return {}; }
  }, [elem?.json]);

  const schema = useMemo(() => {
    const raw = schemaData?.[0]?.schemaJson;
    if (!raw) return null;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      // Extract actual JSON Schema from word-wrapper format if present
      if (parsed.jsonSchema && typeof parsed.jsonSchema === 'object') {
        return parsed.jsonSchema;
      }
      return parsed;
    }
    catch { return null; }
  }, [schemaData]);

  const schemaProperties = useMemo(() => {
    if (!schema?.properties) return [];
    return Object.entries(schema.properties).map(([key, def]) => ({
      key,
      type: def.type || 'string',
      description: def.description || '',
      required: (schema.required || []).includes(key),
    }));
  }, [schema]);

  // Extract only the properties relevant to this concept's schema
  const conceptJson = useMemo(() => {
    const obj = {};
    for (const prop of schemaProperties) {
      obj[prop.key] = fullJson[prop.key] ?? defaultForType(prop.type);
    }
    return obj;
  }, [fullJson, schemaProperties]);

  const authorPubkeys = useMemo(
    () => elem?.author ? [elem.author] : [],
    [elem?.author]
  );
  const profiles = useProfiles(authorPubkeys);

  function handleEdit() {
    setEditValues({ ...conceptJson });
    setEditing(true);
    setSaveError(null);
    setSaveSuccess(false);
  }

  function handleCancel() {
    setEditing(false);
    setEditValues({});
    setSaveError(null);
  }

  const handleFieldChange = useCallback((key, value) => {
    setEditValues(prev => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      // Merge edited concept fields back into the full JSON
      const mergedJson = { ...fullJson, ...editValues };

      const res = await fetch('/api/normalize/save-element-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: elemUuid, json: mergedJson }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');

      setSaveSuccess(true);
      setEditing(false);
      setEditValues({});
      refetchElem();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Validation against schema
  const [validationResult, setValidationResult] = useState(null);
  useMemo(() => {
    if (!schema || !elem?.json) { setValidationResult(null); return; }
    import('ajv').then(({ default: Ajv }) => {
      try {
        const ajv = new Ajv({ allErrors: true, strict: false });
        const { $schema, ...schemaNoMeta } = schema;
        const validate = ajv.compile(schemaNoMeta);
        const parsed = typeof elem.json === 'string' ? JSON.parse(elem.json) : elem.json;
        const valid = validate(parsed);
        setValidationResult({
          valid,
          errors: valid ? null : ajv.errorsText(validate.errors),
        });
      } catch (e) {
        setValidationResult({ valid: false, errors: e.message });
      }
    });
  }, [schema, elem?.json]);

  if (elemLoading) return <div className="loading">Loading element…</div>;
  if (!elem) return <div className="placeholder">Element not found.</div>;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'json-editor', label: 'JSON Editor' },
    { id: 'raw', label: 'Raw Data' },
  ];

  return (
    <div>
      {/* Element header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>{elem.name || 'Unnamed Element'}</h2>
        <button
          className="btn btn-small"
          onClick={() => navigate(`/kg/databases/neo4j/nodes/${encodeURIComponent(elemUuid)}`)}
          title="View this node outside the concept context"
        >
          🔵 View Full Node
        </button>
      </div>

      <div className="concept-meta" style={{ marginBottom: '1rem' }}>
        <span>UUID: <code>{elemUuid}</code></span>
        <span>Author: <AuthorCell pubkey={elem.author} profiles={profiles} /></span>
        {validationResult && (
          <span>
            Schema: {validationResult.valid ? '✅ Valid' : '❌ Invalid'}
          </span>
        )}
      </div>

      {validationResult && !validationResult.valid && validationResult.errors && (
        <div className="health-banner health-fail" style={{ marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 'normal' }}>
          <span className="health-banner-icon">❌</span>
          <div>
            <strong>Schema validation errors:</strong>
            <div style={{ marginTop: '0.25rem', fontFamily: 'monospace', fontSize: '0.85em', opacity: 0.9 }}>
              {validationResult.errors}
            </div>
          </div>
        </div>
      )}

      {/* Sub-tabs */}
      <div className="tab-nav">
        {tabs.map(t => (
          <a
            key={t.id}
            className={`tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
            style={{ cursor: 'pointer' }}
          >
            {t.label}
          </a>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <h3>Element of: {concept?.name}</h3>
          <div className="detail-grid" style={{ marginTop: '1rem' }}>
            <div className="detail-row">
              <span className="detail-label">NAME</span>
              <span className="detail-value">{elem.name}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">KIND</span>
              <span className="detail-value">{elem.kind}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">CONCEPT</span>
              <span className="detail-value">
                <a
                  className="clickable-text"
                  onClick={() => navigate(`/kg/concepts/${encodeURIComponent(conceptUuid)}`)}
                >
                  {concept?.name}
                </a>
              </span>
            </div>
            {elem.created_at && (
              <div className="detail-row">
                <span className="detail-label">CREATED</span>
                <span className="detail-value">{new Date(elem.created_at * 1000).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Concept-scoped JSON preview */}
          {schemaProperties.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3>{concept?.name} Properties</h3>
              <pre className="json-block">{JSON.stringify(conceptJson, null, 2)}</pre>
            </div>
          )}

          {/* Full JSON (collapsed) */}
          {elem.json && (
            <details style={{ marginTop: '1.5rem' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9em' }}>
                Full JSON (all concepts)
              </summary>
              <pre className="json-block" style={{ marginTop: '0.5rem' }}>{JSON.stringify(fullJson, null, 2)}</pre>
            </details>
          )}
        </div>
      )}

      {/* JSON Editor Tab */}
      {activeTab === 'json-editor' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Edit {concept?.name} Properties</h3>
            {!editing && isOwner && (
              <button className="btn btn-primary btn-small" onClick={handleEdit}>
                ✏️ Edit
              </button>
            )}
          </div>

          {!isOwner && (
            <div className="health-banner health-warn" style={{ marginBottom: '1rem' }}>
              <span className="health-banner-icon">🔒</span>
              <span>Sign in as owner to edit element data.</span>
            </div>
          )}

          {saveSuccess && (
            <div className="health-banner health-pass" style={{ marginBottom: '1rem' }}>
              <span className="health-banner-icon">✅</span>
              <span>JSON saved successfully.</span>
            </div>
          )}

          {saveError && (
            <div className="health-banner health-fail" style={{ marginBottom: '1rem' }}>
              <span className="health-banner-icon">❌</span>
              <span>{saveError}</span>
            </div>
          )}

          {schemaProperties.length === 0 ? (
            <div className="placeholder">
              No JSON Schema properties defined for this concept.
              <br />
              <a
                className="clickable-text"
                onClick={() => navigate(`/kg/concepts/${encodeURIComponent(conceptUuid)}/schema`)}
                style={{ marginTop: '0.5rem', display: 'inline-block' }}
              >
                → Define schema properties
              </a>
            </div>
          ) : editing ? (
            <div className="new-concept-form">
              {schemaProperties.map(prop => (
                <div className="form-field" key={prop.key}>
                  <label htmlFor={`field-${prop.key}`}>
                    {prop.key}
                    {prop.required && <span className="required"> *</span>}
                    <span style={{ fontWeight: 'normal', fontSize: '0.85em', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      ({prop.type})
                    </span>
                  </label>
                  {prop.description && (
                    <span className="form-hint">{prop.description}</span>
                  )}
                  <FieldEditor
                    type={prop.type}
                    value={editValues[prop.key]}
                    onChange={val => handleFieldChange(prop.key, val)}
                    disabled={saving}
                  />
                </div>
              ))}

              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving || !isOwner}
                >
                  {saving ? '⏳ Saving…' : '💾 Save'}
                </button>
                <button className="btn" onClick={handleCancel} disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <table className="data-table" style={{ maxWidth: 600 }}>
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {schemaProperties.map(prop => (
                    <tr key={prop.key}>
                      <td>
                        <strong>{prop.key}</strong>
                        {prop.required && <span className="required"> *</span>}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{prop.type}</td>
                      <td>
                        <code className="json-preview">
                          {formatValue(conceptJson[prop.key])}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Raw Data Tab */}
      {activeTab === 'raw' && (
        <div>
          <h3>All Tags</h3>
          <table className="data-table" style={{ marginTop: '0.5rem' }}>
            <thead>
              <tr><th>Type</th><th>Value</th></tr>
            </thead>
            <tbody>
              {(elem.tags || []).map((t, i) => (
                <tr key={i}>
                  <td><code>{t.type}</code></td>
                  <td style={{ maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {elem.json && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3>Full JSON</h3>
              <pre className="json-block">{JSON.stringify(fullJson, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Helper Components ── */

function FieldEditor({ type, value, onChange, disabled }) {
  if (type === 'boolean') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={!!value}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
        />
        {value ? 'true' : 'false'}
      </label>
    );
  }

  if (type === 'number' || type === 'integer') {
    return (
      <input
        type="number"
        value={value ?? ''}
        onChange={e => onChange(type === 'integer' ? parseInt(e.target.value, 10) : parseFloat(e.target.value))}
        disabled={disabled}
        step={type === 'integer' ? 1 : 'any'}
      />
    );
  }

  if (type === 'array' || type === 'object') {
    const strVal = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return (
      <textarea
        value={strVal ?? ''}
        onChange={e => {
          try { onChange(JSON.parse(e.target.value)); }
          catch { /* keep raw string while user types */ }
        }}
        disabled={disabled}
        rows={4}
        style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
      />
    );
  }

  // Default: string
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
    />
  );
}

function defaultForType(type) {
  if (type === 'string') return '';
  if (type === 'number' || type === 'integer') return 0;
  if (type === 'boolean') return false;
  if (type === 'array') return [];
  if (type === 'object') return {};
  return null;
}

function formatValue(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'string') return val || '""';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  return JSON.stringify(val);
}
