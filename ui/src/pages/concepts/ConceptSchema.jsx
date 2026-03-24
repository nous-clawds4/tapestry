import { useState, useMemo, useCallback, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import { useAuth } from '../../context/AuthContext';
import { saveSchema } from '../../api/normalize';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';
import { resolveJsonValue } from '../../utils/lmdb';

import 'jsonjoy-builder/styles.css';
import { SchemaVisualEditor } from 'jsonjoy-builder';
import DefaultValuesPanel from '../../components/DefaultValuesPanel';
import TapestryExtensionsPanel from '../../components/TapestryExtensionsPanel';

export default function ConceptSchema() {
  const { concept, uuid } = useOutletContext();
  const { user } = useAuth();
  const isOwner = user?.classification === 'owner';

  const { data, loading, error, refetch } = useCypher(`
    MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h:NostrEvent {uuid: '${uuid}'})
    OPTIONAL MATCH (js)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
    WITH js, head(collect(j.value)) AS json
    RETURN js.uuid AS uuid, js.name AS name, js.pubkey AS author, json
    LIMIT 1
  `);

  const schemaNode = data?.[0];

  // Resolve the JSON value (may be inline or an LMDB ref)
  const [savedSchemaRaw, setSavedSchemaRaw] = useState(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!schemaNode?.json) { setSavedSchemaRaw(null); return; }
    let cancelled = false;
    setResolving(true);
    resolveJsonValue(schemaNode.json).then(resolved => {
      if (!cancelled) setSavedSchemaRaw(resolved);
    }).finally(() => {
      if (!cancelled) setResolving(false);
    });
    return () => { cancelled = true; };
  }, [schemaNode?.json]);

  // Extract the actual JSON Schema from word-wrapper format if present
  const savedSchema = useMemo(() => {
    if (!savedSchemaRaw) return null;
    // Word-wrapper format: { word: { ... }, jsonSchema: { ... } }
    if (savedSchemaRaw.jsonSchema && typeof savedSchemaRaw.jsonSchema === 'object') {
      return savedSchemaRaw.jsonSchema;
    }
    // Already a plain JSON Schema (legacy or direct format)
    return savedSchemaRaw;
  }, [savedSchemaRaw]);


  const authorPubkeys = useMemo(
    () => schemaNode?.author ? [schemaNode.author] : [],
    [schemaNode?.author]
  );
  const profiles = useProfiles(authorPubkeys);

  // Editor state
  const [editing, setEditing] = useState(false);
  const [editSchema, setEditSchema] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  function handleEdit() {
    // Initialize editor with current schema (strip $schema meta for cleaner editing)
    setEditSchema(savedSchema || {
      type: 'object',
      title: concept?.name || '',
      properties: {},
      required: [],
    });
    setEditing(true);
    setSaveError(null);
    setSaveSuccess(false);
  }

  function handleCancel() {
    setEditing(false);
    setEditSchema(null);
    setSaveError(null);
    setSaveSuccess(false);
  }

  const handleSchemaChange = useCallback((newSchema) => {
    setEditSchema(newSchema);
    setSaveSuccess(false);
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      // Send the plain JSON Schema — server handles word-wrapper wrapping
      await saveSchema({ concept: concept.name, schema: editSchema });
      setSaveSuccess(true);
      setEditing(false);
      setEditSchema(null);
      refetch();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Show JSON preview of editor state
  const [showPreview, setShowPreview] = useState(false);

  // Raw JSON editor mode
  const [editorMode, setEditorMode] = useState('visual'); // 'visual' | 'raw'
  const [rawJson, setRawJson] = useState('');
  const [rawJsonError, setRawJsonError] = useState(null);

  function switchToRaw() {
    const fullSchema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      ...editSchema,
    };
    setRawJson(JSON.stringify(fullSchema, null, 2));
    setRawJsonError(null);
    setEditorMode('raw');
  }

  function switchToVisual() {
    // Try to parse raw JSON and sync back to visual editor
    try {
      const parsed = JSON.parse(rawJson);
      // Strip $schema for the visual editor (it adds it back on save)
      const { $schema, ...rest } = parsed;
      setEditSchema(rest);
      setRawJsonError(null);
      setEditorMode('visual');
    } catch (err) {
      setRawJsonError(`Invalid JSON: ${err.message}`);
    }
  }

  function handleRawJsonChange(e) {
    setRawJson(e.target.value);
    setRawJsonError(null);
  }

  // Save from raw mode: parse first, then save
  async function handleSaveRaw() {
    try {
      const parsed = JSON.parse(rawJson);
      const { $schema, ...rest } = parsed;
      setEditSchema(rest);
      // Now save using the parsed schema, re-wrapped if needed
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);
      await saveSchema({ concept: concept.name, schema: rest });
      setSaveSuccess(true);
      setEditing(false);
      setEditSchema(null);
      setEditorMode('visual');
      refetch();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setRawJsonError(`Invalid JSON: ${err.message}`);
      } else {
        setSaveError(err.message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>JSON Schema</h2>
        {schemaNode && !editing && isOwner && (
          <button className="btn btn-primary btn-small" onClick={handleEdit}>
            ✏️ Edit Schema
          </button>
        )}
      </div>

      {(loading || resolving) && <div className="loading">Loading schema…</div>}
      {error && <div className="error">Error: {error.message}</div>}

      {!loading && !error && !schemaNode && (
        <p className="placeholder">No JSON Schema found for this concept.</p>
      )}

      {schemaNode && !editing && (
        <div className="schema-view">
          <div className="schema-meta">
            <span>UUID: <code>{schemaNode.uuid}</code></span>
            <span>Author: <AuthorCell pubkey={schemaNode.author} profiles={profiles} /></span>
          </div>

          {saveSuccess && (
            <div className="health-banner health-pass" style={{ marginBottom: '1rem' }}>
              <span className="health-banner-icon">✅</span>
              <span>Schema saved successfully.</span>
            </div>
          )}

          {savedSchema ? (
            <pre className="json-block">{JSON.stringify(savedSchema, null, 2)}</pre>
          ) : (
            <p className="placeholder">No JSON Schema content available.</p>
          )}
        </div>
      )}

      {editing && (
        <div>
          {!isOwner && (
            <div className="health-banner health-warn" style={{ marginBottom: '1rem' }}>
              <span className="health-banner-icon">🔒</span>
              <span>Sign in as owner to save changes.</span>
            </div>
          )}

          {saveError && (
            <div className="health-banner health-fail" style={{ marginBottom: '1rem' }}>
              <span className="health-banner-icon">❌</span>
              <span>{saveError}</span>
            </div>
          )}

          {rawJsonError && (
            <div className="health-banner health-fail" style={{ marginBottom: '1rem' }}>
              <span className="health-banner-icon">⚠️</span>
              <span>{rawJsonError}</span>
            </div>
          )}

          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={editorMode === 'raw' ? handleSaveRaw : handleSave}
              disabled={saving || !isOwner}
            >
              {saving ? '⏳ Saving…' : '💾 Save Schema'}
            </button>
            <button className="btn" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>

            {/* Mode toggle */}
            <div style={{
              display: 'inline-flex',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid var(--border, #444)',
            }}>
              <button
                className="btn"
                style={{
                  borderRadius: 0,
                  border: 'none',
                  borderRight: '1px solid var(--border, #444)',
                  background: editorMode === 'visual' ? 'var(--accent, #3b82f6)' : 'transparent',
                  color: editorMode === 'visual' ? '#fff' : 'inherit',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.85rem',
                }}
                onClick={editorMode === 'raw' ? switchToVisual : undefined}
                disabled={editorMode === 'visual'}
              >
                🎨 Visual
              </button>
              <button
                className="btn"
                style={{
                  borderRadius: 0,
                  border: 'none',
                  background: editorMode === 'raw' ? 'var(--accent, #3b82f6)' : 'transparent',
                  color: editorMode === 'raw' ? '#fff' : 'inherit',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.85rem',
                }}
                onClick={editorMode === 'visual' ? switchToRaw : undefined}
                disabled={editorMode === 'raw'}
              >
                { '{ }' } Raw JSON
              </button>
            </div>

            {editorMode === 'visual' && (
              <button
                className="btn"
                onClick={() => setShowPreview(p => !p)}
              >
                {showPreview ? '🔽 Hide JSON' : '📋 Show JSON'}
              </button>
            )}
          </div>

          {editorMode === 'visual' && (
            <>
              <div className="schema-editor-wrapper">
                <SchemaVisualEditor
                  schema={editSchema}
                  readOnly={false}
                  onChange={handleSchemaChange}
                />
              </div>

              {editSchema && (
                <DefaultValuesPanel
                  schema={editSchema}
                  onChange={handleSchemaChange}
                />
              )}

              {editSchema && (
                <TapestryExtensionsPanel
                  schema={editSchema}
                  onChange={handleSchemaChange}
                />
              )}

              {showPreview && editSchema && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>📋 JSON Preview</h3>
                  <pre className="json-block">{JSON.stringify({
                    $schema: 'https://json-schema.org/draft/2020-12/schema',
                    type: 'object',
                    ...editSchema,
                  }, null, 2)}</pre>
                </div>
              )}
            </>
          )}

          {editorMode === 'raw' && (
            <div style={{ marginTop: '0.5rem' }}>
              <textarea
                value={rawJson}
                onChange={handleRawJsonChange}
                spellCheck={false}
                style={{
                  width: '100%',
                  minHeight: '400px',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  lineHeight: '1.5',
                  padding: '1rem',
                  backgroundColor: 'var(--bg-secondary, #1a1a2e)',
                  color: 'var(--text-primary, #e0e0e0)',
                  border: '1px solid var(--border, #444)',
                  borderRadius: '8px',
                  resize: 'vertical',
                  tabSize: 2,
                }}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', marginTop: '0.5rem' }}>
                Edit the raw JSON Schema directly. Switch back to Visual to continue with the graphical editor.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Generate Property Tree button */}
      {isOwner && concept?.name && (
        <GeneratePropertyTreeButton concept={concept.name} />
      )}
    </div>
  );
}

function GeneratePropertyTreeButton({ concept }) {
  const [status, setStatus] = useState(null); // null | 'loading' | { success, message, error, count }

  async function handleGenerate() {
    setStatus('loading');
    try {
      const res = await fetch('/api/normalize/generate-property-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept }),
      });
      const data = await res.json();
      setStatus({
        success: data.success,
        message: data.message || data.error,
        count: data.properties?.length || 0,
      });
    } catch (err) {
      setStatus({ success: false, message: err.message });
    }
  }

  return (
    <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          className="btn"
          onClick={handleGenerate}
          disabled={status === 'loading'}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          {status === 'loading' ? '⏳ Generating…' : '🌳 Generate Property Tree →'}
        </button>
        <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
          Create/sync the property tree from this JSON Schema
        </span>
      </div>
      {status && status !== 'loading' && (
        <div style={{
          marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '6px',
          fontSize: '0.85rem',
          backgroundColor: status.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          color: status.success ? '#4ade80' : '#f87171',
          border: `1px solid ${status.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          {status.success ? '✅' : '❌'} {status.message}
        </div>
      )}
    </div>
  );
}
