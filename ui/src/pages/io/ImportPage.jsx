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
  const [previewLoading, setPreviewLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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

  // Preview word JSON
  const handlePreview = useCallback(async (slug) => {
    if (previewSlug === slug) {
      setPreviewSlug(null);
      setPreviewJson(null);
      return;
    }

    setPreviewSlug(slug);
    setPreviewLoading(true);
    setPreviewJson(null);

    try {
      const res = await fetch(`/api/io/imports/${tempId}/word/${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Preview failed');
      setPreviewJson(data.json);
    } catch (err) {
      setPreviewJson({ error: err.message });
    } finally {
      setPreviewLoading(false);
    }
  }, [tempId, previewSlug]);

  return (
    <div>
      <h1>Import</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        Upload an export zip to preview its contents. (Import to database not yet implemented.)
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
                              <pre className="json-block" style={{ margin: '0.5rem 1rem', maxHeight: '400px', overflowY: 'auto' }}>
                                {JSON.stringify(previewJson, null, 2)}
                              </pre>
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
