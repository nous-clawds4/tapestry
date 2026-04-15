import { useState, useEffect } from 'react';

/**
 * Modal that fetches a deep preview of a foreign concept (schema shape, sets,
 * element count) and offers a one-click import button.
 */
export default function ConceptPreview({ pubkey, slug, relays, onClose, onImported }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPreview(null);
    (async () => {
      try {
        const params = new URLSearchParams({ pubkey, slug });
        if (relays && relays.length > 0) params.set('relays', relays.join(','));
        const resp = await fetch(`/api/concept-discovery/concept-preview?${params}`);
        const body = await resp.json();
        if (cancelled) return;
        if (!body.success) throw new Error(body.error || `HTTP ${resp.status}`);
        setPreview(body);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pubkey, slug, relays.join(',')]);

  async function doImport() {
    setImporting(true);
    setImportMessage(null);
    try {
      const resp = await fetch('/api/concept-discovery/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pubkey, slug, relays }),
      });
      const body = await resp.json();
      if (!resp.ok || !body.success) throw new Error(body.error || `HTTP ${resp.status}`);
      setImportMessage(`✅ Imported ${body.eventCount} events. Pass-3 derived ${body.pass3?.derived || 0} nodes.`);
      // Brief pause so the user sees the success message, then close.
      setTimeout(() => onImported?.(body), 1200);
    } catch (err) {
      setImportMessage(`⚠️ ${err.message}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="cdisc-modal-backdrop" onClick={onClose}>
      <div className="cdisc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cdisc-modal-header">
          <span className="cdisc-modal-title">Concept Preview</span>
          <button type="button" onClick={onClose} className="cdisc-modal-close">×</button>
        </div>

        {loading && <div className="rtp-loading">Loading preview…</div>}
        {error && <div className="rtp-error">⚠️ {error}</div>}

        {preview && (
          <div className="cdisc-preview-body">
            <div className="cdisc-preview-section">
              <div className="cdisc-preview-label">Coordinate</div>
              <div><code className="cdisc-preview-coord">{preview.coordinate}</code></div>
            </div>

            <div className="cdisc-preview-section">
              <div className="cdisc-preview-label">Name</div>
              <div className="cdisc-preview-name">
                {preview.header.name}
                {preview.header.pluralName && (
                  <span className="cdisc-preview-plural"> · {preview.header.pluralName}</span>
                )}
              </div>
              {preview.header.description && (
                <div className="cdisc-preview-desc">{preview.header.description}</div>
              )}
            </div>

            {preview.schema && (
              <div className="cdisc-preview-section">
                <div className="cdisc-preview-label">Schema shape</div>
                <table className="cdisc-schema-table">
                  <thead>
                    <tr><th>Field</th><th>Type</th><th>Req?</th><th>Description</th></tr>
                  </thead>
                  <tbody>
                    {Object.entries(preview.schema.properties).map(([name, prop]) => (
                      <tr key={name}>
                        <td><code>{name}</code></td>
                        <td>{prop.type}</td>
                        <td>{preview.schema.required.includes(name) ? '✓' : ''}</td>
                        <td className="cdisc-schema-desc">{prop.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {preview.sets && preview.sets.length > 0 && (
              <div className="cdisc-preview-section">
                <div className="cdisc-preview-label">Sets ({preview.sets.length})</div>
                <ul className="cdisc-sets-list">
                  {preview.sets.map((s, i) => (
                    <li key={i}>
                      <strong>{s.name || s.slug}</strong>
                      {s.description && <span className="cdisc-set-desc"> — {s.description}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="cdisc-preview-section">
              <div className="cdisc-preview-label">User-published instances ({preview.elementCount})</div>
              <div className="cdisc-preview-hint">
                Once imported, your relay-discovery aggregated view will start surfacing every
                kind-39999 anywhere on nostr that is z-tagged to this concept's coordinate.
              </div>
            </div>

            {importMessage && (
              <div className="cdisc-import-msg">{importMessage}</div>
            )}

            <div className="cdisc-modal-actions">
              <button type="button" onClick={onClose} className="cdisc-btn">
                Cancel
              </button>
              <button
                type="button"
                onClick={doImport}
                disabled={importing || preview.alreadyImported}
                className="cdisc-btn cdisc-btn-primary"
              >
                {preview.alreadyImported
                  ? '✓ Already imported'
                  : importing ? 'Importing…' : 'Import this concept'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
