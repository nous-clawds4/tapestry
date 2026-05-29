import React, { useState, useEffect, useCallback } from 'react';
import {
  publishNip51ExportForPin,
  fetchUserWriteRelays,
  WELL_KNOWN_FALLBACK_RELAYS,
} from '../utils/publishTagPin';

/**
 * Story 21 / ADR 0019 — the single "Export" affordance.
 *
 * Collapses the former Refresh action (kind-30392 recompute), "Share"
 * (kind-30392 naddr copy — now a detail-page row), and "Export for other
 * clients" (kind-30000 publish) into ONE action. Clicking Export opens a
 * modal with two targets — a Follow Set (kind-30000, user-signed,
 * cross-client) and a Trusted List (kind-30392, TA-signed, internal) —
 * both checked by default and hidden behind a "What will be exported?"
 * disclosure. Most users never expand it and simply get both.
 *
 * On confirm (in order, so the kind-30000 reflects the fresh membership):
 *   1. if Trusted List checked → POST /api/trusted-list/refresh-pinned-tag
 *      (recompute the TA-signed kind-30392; no prompt).
 *   2. if Follow Set checked → publishNip51ExportForPin (NIP-07 prompt;
 *      reads the now-fresh kind-30392 for membership).
 *
 * Props:
 *   pinEventId    — kind-39999 pin event id (required)
 *   currentTitle  — last published kind-30000 title, or null
 *   defaultTitle  — fallback title (the tag's display name)
 *   variant       — 'compact' | 'full'
 *   onExported    — callback after a successful export so the parent refetches
 */
export default function ExportModal({
  pinEventId, currentTitle, defaultTitle = '',
  variant = 'full', onExported,
}) {
  const [open, setOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(currentTitle || defaultTitle);
  // Both targets default-checked (AC-3).
  const [exportFollowSet, setExportFollowSet] = useState(true);   // kind-30000
  const [exportTrustedList, setExportTrustedList] = useState(true); // kind-30392
  const [showWhat, setShowWhat] = useState(false); // "What will be exported?" disclosure (AC-4)
  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  // Per-open NIP-65 write-relay preview. null = loading; [] = none found.
  const [writeRelays, setWriteRelays] = useState(null);

  useEffect(() => {
    if (open) return;
    setTitleDraft(currentTitle || defaultTitle);
  }, [currentTitle, defaultTitle, open]);

  // Fetch the user's write relays each time the modal opens (only relevant
  // when the Follow Set is part of the export).
  useEffect(() => {
    if (!open) { setWriteRelays(null); return undefined; }
    let cancelled = false;
    (async () => {
      const relays = await fetchUserWriteRelays();
      if (!cancelled) setWriteRelays(relays);
    })();
    return () => { cancelled = true; };
  }, [open]);

  const handleClose = useCallback(() => { setOpen(false); setError(null); }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !exporting) handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, exporting, handleClose]);

  const hasNip07 = typeof window !== 'undefined' && !!window.nostr;
  const hasWriteRelays = Array.isArray(writeRelays) && writeRelays.length > 0;
  const relaysLoading = writeRelays === null;
  // AC-5: disable Export when neither target is selected.
  const nothingSelected = !exportFollowSet && !exportTrustedList;

  const handleTriggerClick = (e) => {
    e.stopPropagation(); e.preventDefault();
    setError(null); setDone(false); setOpen(true);
  };

  const handleConfirm = async () => {
    if (nothingSelected) return;
    setExporting(true); setError(null);
    try {
      // 1. Trusted List first so the Follow Set reads fresh membership.
      if (exportTrustedList) {
        const rr = await fetch('/api/trusted-list/refresh-pinned-tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pinEventId }),
        });
        const data = await rr.json().catch(() => null);
        if (!rr.ok || !data?.success) {
          throw new Error(data?.error || `Trusted List refresh failed (status ${rr.status})`);
        }
      }
      // 2. Follow Set (user-signed, NIP-07 prompt).
      if (exportFollowSet) {
        await publishNip51ExportForPin({
          pinEventId,
          title: (titleDraft || '').trim() || undefined,
          writeRelays: Array.isArray(writeRelays) ? writeRelays : [],
        });
      }
      setDone(true);
      setOpen(false);
      setTimeout(() => setDone(false), 1800);
      if (typeof onExported === 'function') onExported();
    } catch (e) {
      setError(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const triggerLabel = variant === 'compact'
    ? (done ? '✓' : '📤')
    : (done ? '✓ Exported' : '📤 Export');

  return (
    <span className={`bs-tl-export-wrap${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className={`bs-tl-export bs-tl-export-${variant}${done ? ' is-copied' : ''}`}
        onClick={handleTriggerClick}
        disabled={!hasNip07 || exporting}
        title={hasNip07
          ? 'Publish this pinned list (Follow Set + Trusted List)'
          : 'Sign in with a NIP-07 extension to export this list'}
        aria-label="Export this pinned list"
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="bs-tl-export-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !exporting) handleClose(); }}
        >
          <div
            className="bs-tl-export-popover"
            role="dialog"
            aria-label="Export this pinned list"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="bs-tl-export-row">
              <label className="bs-tl-export-label" htmlFor="bs-export-title">
                List title
              </label>
              <input
                id="bs-export-title"
                type="text"
                className="bs-tl-export-input"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                placeholder={defaultTitle || 'Choose a name'}
                disabled={exporting}
              />
            </div>

            {/* AC-4: kind checkboxes hidden behind a disclosure. */}
            <details
              className="bs-export-what"
              open={showWhat}
              onToggle={(e) => setShowWhat(e.target.open)}
            >
              <summary className="bs-export-what-summary">What will be exported?</summary>
              <div className="bs-export-what-body">
                <label className="bs-export-target">
                  <input
                    type="checkbox"
                    checked={exportFollowSet}
                    onChange={(e) => setExportFollowSet(e.target.checked)}
                    disabled={exporting}
                  />
                  <span>
                    <strong>Follow Set</strong> (kind-30000) — a portable list
                    other nostr clients can subscribe to, signed by you.
                  </span>
                </label>
                <label className="bs-export-target">
                  <input
                    type="checkbox"
                    checked={exportTrustedList}
                    onChange={(e) => setExportTrustedList(e.target.checked)}
                    disabled={exporting}
                  />
                  <span>
                    <strong>Trusted List</strong> (kind-30392) — the
                    rank-carrying list Brainstorm and curation pipelines read.
                  </span>
                </label>
              </div>
            </details>

            {/* Relay preview matters only when the Follow Set is exported. */}
            {exportFollowSet && (relaysLoading ? (
              <div className="bs-tl-export-preview is-ok">
                <p className="bs-tl-export-preview-lead">Reading your relay list…</p>
              </div>
            ) : (
              <div className={`bs-tl-export-preview ${hasWriteRelays ? 'is-ok' : 'is-warn'}`}>
                <p className="bs-tl-export-preview-lead">
                  The Follow Set <strong>{(titleDraft || defaultTitle || 'untitled')}</strong> will publish to:
                </p>
                {hasWriteRelays ? (
                  <>
                    <p className="bs-tl-export-preview-subhead"><strong>Your write relays</strong></p>
                    <ul className="bs-tl-export-preview-list">
                      {writeRelays.map((r) => (<li key={r}><code>{r}</code></li>))}
                    </ul>
                  </>
                ) : (
                  <p className="bs-tl-export-preview-warn-inline" role="alert">
                    ⚠️ No write relays found for you — the Follow Set still
                    publishes to the well-known fallback relays below, so it
                    remains reachable by other nostr clients.
                  </p>
                )}
                <p className="bs-tl-export-preview-subhead">
                  <strong>Well-known public relays</strong>{' '}
                  <span className="bs-tl-export-preview-source">(always included for portability)</span>
                </p>
                <ul className="bs-tl-export-preview-list">
                  {WELL_KNOWN_FALLBACK_RELAYS.map((r) => (<li key={r}><code>{r}</code></li>))}
                </ul>
                <p className="bs-tl-export-preview-foot">Plus this Brainstorm instance's local relay.</p>
              </div>
            ))}

            {nothingSelected && (
              <p className="bs-tl-export-error" role="alert">
                Select at least one list to export.
              </p>
            )}
            {error && (<p className="bs-tl-export-error" role="alert">⚠️ {error}</p>)}

            <div className="bs-tl-export-actions">
              <button
                type="button"
                className="bs-tl-export-cancel"
                onClick={handleClose}
                disabled={exporting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bs-tl-export-confirm"
                onClick={handleConfirm}
                disabled={exporting || nothingSelected}
              >
                {exporting ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
