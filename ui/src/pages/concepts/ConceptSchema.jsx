import { useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import { useAuth } from '../../context/AuthContext';
import { saveSchema } from '../../api/normalize';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';

import 'jsonjoy-builder/styles.css';
import { SchemaVisualEditor } from 'jsonjoy-builder';

function parseSchema(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

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
  const savedSchema = useMemo(() => parseSchema(schemaNode?.json), [schemaNode?.json]);

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

      {loading && <div className="loading">Loading schema…</div>}
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

          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !isOwner}
            >
              {saving ? '⏳ Saving…' : '💾 Save Schema'}
            </button>
            <button className="btn" onClick={handleCancel} disabled={saving}>
              Cancel
            </button>
            <button
              className="btn"
              onClick={() => setShowPreview(p => !p)}
            >
              {showPreview ? '🔽 Hide JSON' : '📋 Show JSON'}
            </button>
          </div>

          <div className="schema-editor-wrapper">
            <SchemaVisualEditor
              schema={editSchema}
              onChange={handleSchemaChange}
            />
          </div>

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
        </div>
      )}
    </div>
  );
}
