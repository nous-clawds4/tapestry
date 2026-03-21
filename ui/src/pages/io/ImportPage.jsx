import { useState, useCallback, useRef } from 'react';

/**
 * Import page — upload a zip, preview contents, select words.
 * Route: /kg/io/import
 *
 * No actual import to neo4j — just upload, preview, and selection UI.
 */
export default function ImportPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [tempId, setTempId] = useState(null);
  const [manifest, setManifest] = useState(null);
  const [selectedWords, setSelectedWords] = useState(new Set());
  const [previewSlug, setPreviewSlug] = useState(null);
  const [previewJson, setPreviewJson] = useState(null);
  const [previewRawEvent, setPreviewRawEvent] = useState(null);
  const [previewHasJson, setPreviewHasJson] = useState(false);
  const [previewHasRawEvent, setPreviewHasRawEvent] = useState(false);
  const [previewMode, setPreviewMode] = useState('json'); // 'json' | 'rawEvent'
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState(null);
  const fileInputRef = useRef(null);

  // Handle file upload
  const handleUpload = useCallback(async (file) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setManifest(null);
    setTempId(null);
    setSelectedWords(new Set());
    setPreviewSlug(null);
    setPreviewJson(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/io/imports/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Upload failed');

      setTempId(data.tempId);
      setManifest(data.manifest);

      // Select all words by default
      const allSlugs = new Set((data.manifest.words || []).map(w => w.slug));
      setSelectedWords(allSlugs);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.name.endsWith('.zip')) {
      handleUpload(file);
    } else {
      setUploadError('Please upload a .zip file');
    }
  }, [handleUpload]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // File picker
  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  // Toggle word selection
  const toggleWord = useCallback((slug) => {
    setSelectedWords(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  // Select/deselect all
  const toggleAll = useCallback(() => {
    if (!manifest?.words) return;
    if (selectedWords.size === manifest.words.length) {
      setSelectedWords(new Set());
    } else {
      setSelectedWords(new Set(manifest.words.map(w => w.slug)));
    }
  }, [manifest, selectedWords]);

  // Preview word JSON and/or raw event
  const handlePreview = useCallback(async (slug) => {
    if (previewSlug === slug) {
      setPreviewSlug(null);
      setPreviewJson(null);
      setPreviewRawEvent(null);
      setPreviewHasJson(false);
      setPreviewHasRawEvent(false);
      return;
    }

    setPreviewSlug(slug);
    setPreviewLoading(true);
    setPreviewJson(null);
    setPreviewRawEvent(null);
    setPreviewHasJson(false);
    setPreviewHasRawEvent(false);

    try {
      const res = await fetch(`/api/io/imports/${tempId}/word/${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Preview failed');
      setPreviewJson(data.json);
      setPreviewRawEvent(data.rawEvent);
      setPreviewHasJson(data.hasJson);
      setPreviewHasRawEvent(data.hasRawEvent);
      // Default to whichever is available
      if (data.hasJson) setPreviewMode('json');
      else if (data.hasRawEvent) setPreviewMode('rawEvent');
    } catch (err) {
      setPreviewJson({ error: err.message });
      setPreviewHasJson(true);
    } finally {
      setPreviewLoading(false);
    }
  }, [tempId, previewSlug]);

  // Execute import for selected words
  const handleImport = useCallback(async () => {
    if (!tempId || selectedWords.size === 0) return;
    setImporting(true);
    setImportResult(null);
    setImportError(null);

    try {
      const res = await fetch(`/api/io/imports/${tempId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugs: [...selectedWords] }),
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Import failed');
      setImportResult(data);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setImporting(false);
    }
  }, [tempId, selectedWords]);

  return (
    <div>
      <h1>Import</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Upload an export zip to preview and import words into strfry and Neo4j.
      </p>

      {/* Upload Zone */}
      <section style={{ marginBottom: '2rem' }}>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 8,
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
            transition: 'all 0.2s',
          }}
        >
          {uploading ? (
            <div className="loading">Uploading and parsing…</div>
          ) : (
            <>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                Drop a .zip file here or click to browse
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>
                Accepts export zip files with manifest.json
              </div>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {uploadError && (
          <div className="health-banner health-fail" style={{ marginTop: '1rem' }}>
            <span className="health-banner-icon">Error</span>
            <span>{uploadError}</span>
          </div>
        )}
      </section>

      {/* Parsed Content */}
      {manifest && (
        <>
          {/* Summary */}
          <section style={{ marginBottom: '1.5rem' }}>
            <h2>Import Summary</h2>
            <div className="detail-grid" style={{ maxWidth: 400 }}>
              <div className="detail-row">
                <span className="detail-label">WORDS</span>
                <span className="detail-value">{manifest.wordCount || manifest.words?.length || 0}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">CONCEPTS</span>
                <span className="detail-value">{manifest.conceptCount || manifest.concepts?.length || 0}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">EXPORT DATE</span>
                <span className="detail-value">
                  {manifest.exportDate ? new Date(manifest.exportDate).toLocaleString() : '—'}
                </span>
              </div>
            </div>
          </section>

          {/* Concepts */}
          {manifest.concepts?.length > 0 && (
            <section style={{ marginBottom: '1.5rem' }}>
              <h2>Concepts</h2>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Concept</th>
                      <th>Concept Graph</th>
                      <th>Property Tree</th>
                      <th>Core Nodes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manifest.concepts.map(c => (
                      <tr key={c.uuid}>
                        <td>{c.name}</td>
                        <td>
                          <GraphIndicator on={c.graphs?.conceptGraph} />
                        </td>
                        <td>
                          <GraphIndicator on={c.graphs?.propertyTree} />
                        </td>
                        <td>
                          <GraphIndicator on={c.graphs?.coreNodes} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Words */}
          <section style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={{ margin: 0 }}>Words</h2>
              <button className="btn btn-small" onClick={toggleAll}>
                {selectedWords.size === (manifest.words?.length || 0) ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div style={{ marginBottom: '0.5rem', color: 'var(--accent)', fontSize: '0.9em' }}>
              {selectedWords.size} of {manifest.words?.length || 0} selected
            </div>

            <div className="data-table-wrapper" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Slug</th>
                    <th>Description</th>
                    <th>Word Types</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(manifest.words || []).map(w => (
                    <>
                      <tr key={w.slug}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedWords.has(w.slug)}
                            onChange={() => toggleWord(w.slug)}
                          />
                        </td>
                        <td><strong>{w.slug}</strong></td>
                        <td style={{ color: 'var(--text-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {w.description || '—'}
                        </td>
                        <td>
                          {(w.wordTypes || []).map(wt => (
                            <span key={wt} style={{
                              display: 'inline-block',
                              background: 'var(--bg-tertiary)',
                              border: '1px solid var(--border)',
                              borderRadius: 4,
                              padding: '2px 6px',
                              fontSize: '0.8em',
                              marginRight: 4,
                            }}>
                              {wt}
                            </span>
                          ))}
                        </td>
                        <td>
                          <button
                            className="btn btn-small"
                            onClick={() => handlePreview(w.slug)}
                          >
                            {previewSlug === w.slug ? 'Hide' : 'Preview'}
                          </button>
                        </td>
                      </tr>
                      {previewSlug === w.slug && (
                        <tr key={`${w.slug}-preview`}>
                          <td colSpan={5} style={{ padding: 0 }}>
                            {previewLoading ? (
                              <div className="loading" style={{ padding: '1rem' }}>Loading…</div>
                            ) : (
                              <div style={{ margin: '0.5rem 1rem' }}>
                                {/* Mode toggle buttons */}
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                  <button
                                    className={`btn btn-small${previewMode === 'json' ? ' btn-primary' : ''}`}
                                    onClick={() => setPreviewMode('json')}
                                    disabled={!previewHasJson}
                                    style={{ opacity: previewHasJson ? 1 : 0.4 }}
                                  >
                                    JSON Payload
                                  </button>
                                  <button
                                    className={`btn btn-small${previewMode === 'rawEvent' ? ' btn-primary' : ''}`}
                                    onClick={() => setPreviewMode('rawEvent')}
                                    disabled={!previewHasRawEvent}
                                    style={{ opacity: previewHasRawEvent ? 1 : 0.4 }}
                                  >
                                    Nostr Event
                                  </button>
                                  {!previewHasJson && (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85em', alignSelf: 'center' }}>
                                      ⚠ No JSON payload in export
                                    </span>
                                  )}
                                  {!previewHasRawEvent && (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85em', alignSelf: 'center' }}>
                                      ⚠ No raw event in export (v1 format)
                                    </span>
                                  )}
                                </div>
                                {/* Preview content */}
                                <pre className="json-block" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                  {previewMode === 'json'
                                    ? (previewJson ? JSON.stringify(previewJson, null, 2) : 'Not available')
                                    : (previewRawEvent ? JSON.stringify(previewRawEvent, null, 2) : 'Not available')
                                  }
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Import Action */}
          <section style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={importing || selectedWords.size === 0 || !manifest.rawEvents?.length}
              >
                {importing ? 'Importing…' : 'Import Selected'}
              </button>
              {selectedWords.size > 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>
                  {selectedWords.size} word{selectedWords.size !== 1 ? 's' : ''} selected
                </span>
              )}
              {manifest.exportVersion !== 2 && !manifest.rawEvents?.length && (
                <span style={{ color: 'var(--warning, #e6a700)', fontSize: '0.9em' }}>
                  ⚠ This export does not include raw nostr events (v1 format). Import is not available.
                </span>
              )}
            </div>

            {importError && (
              <div className="health-banner health-fail" style={{ marginTop: '1rem' }}>
                <span className="health-banner-icon">Error</span>
                <span>{importError}</span>
              </div>
            )}

            {importResult && (
              <div style={{ marginTop: '1rem' }}>
                <div className={`health-banner ${importResult.failed > 0 ? 'health-warn' : 'health-pass'}`}>
                  <span className="health-banner-icon">
                    {importResult.failed > 0 ? 'Warning' : 'Done'}
                  </span>
                  <span>
                    {importResult.imported} imported, {importResult.skipped} skipped, {importResult.failed} failed
                    {' · '}
                    {importResult.conceptsWired || 0} concept links, {importResult.labelsApplied || 0} labels, {importResult.graphRelsCreated || 0} graph relationships
                  </span>
                </div>

                {/* Per-word results */}
                <div className="data-table-wrapper" style={{ marginTop: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Slug</th>
                        <th>Status</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.results.map(r => (
                        <tr key={r.slug}>
                          <td><strong>{r.slug}</strong></td>
                          <td>
                            <span style={{
                              color: r.status === 'imported' ? 'var(--green)'
                                : r.status === 'skipped' ? 'var(--text-muted)'
                                : 'var(--red, #e55)',
                              fontWeight: 600,
                              fontSize: '0.9em',
                            }}>
                              {r.status === 'imported' ? '✓ Imported'
                                : r.status === 'skipped' ? '⊘ Skipped'
                                : '✗ Failed'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>
                            {r.status === 'imported' ? `kind ${r.kind}` : (r.reason || r.error || '')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {importResult.imported > 0 && (
                  <p style={{ marginTop: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9em' }}>
                    💡 Events written to strfry and Neo4j with concept links, labels, and graph relationships.
                    {importResult.conceptsWired === 0 && (
                      <> No concept links were created — ensure firmware is installed first.</>
                    )}
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ── Helpers ── */

function GraphIndicator({ on }) {
  return (
    <span style={{ color: on ? 'var(--green)' : 'var(--text-muted)', fontSize: '0.9em' }}>
      {on ? 'Included' : '—'}
    </span>
  );
}
