import React, { useState, useEffect } from 'react';
import { publishNip51ExportForPin } from '../utils/publishTagPin';

/**
 * Story 19 / ADR 0017 — kind-30000 NIP-51 follow-set export button.
 * Sibling to TLShareButton (kind-30392 share), visually distinct.
 *
 * Click → opens an inline popover with:
 *   - editable title (defaults to currentTitle or tag.name)
 *   - relay-preview block listing the user's NIP-65 write relays
 *     (or a no-NIP-65 warning when writeRelays is empty)
 *   - [Export] + [Cancel] buttons
 *
 * On Export:
 *   1. POST /api/trusted-list/prepare-nip51-export {pinEventId, title}
 *   2. NIP-07 sign the returned unsigned template
 *   3. Publish via publishEverywhere(signed, writeRelays)
 *   4. Copy returned naddr to clipboard
 *   5. Call onExported() so the parent can refetch
 *
 * Props:
 *   pinEventId    — kind-39999 pin event id (required)
 *   dTag          — d-tag (unused directly here; for parent symmetry)
 *   currentTitle  — pre-fill for the title input (last published title
 *                   from nip51ExportStatus.currentTitle), or null
 *   writeRelays   — user's NIP-65 write relays (from
 *                   nip51ExportStatus.writeRelays). Empty array means no
 *                   kind-10002; the popover shows the AC-27 warning.
 *   defaultTitle  — fallback when currentTitle and user input are empty
 *                   (typically the tag's display name)
 *   variant       — 'compact' (icon-only button) or 'full' (text+icon)
 *   onExported    — optional callback after a successful publish
 */
export default function TLExportButton({
  pinEventId, dTag, currentTitle, writeRelays = [], defaultTitle = '',
  variant = 'compact', onExported,
}) {
  const [open, setOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(currentTitle || defaultTitle);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Keep the input synced when the parent passes a new currentTitle
    // (e.g. after a refetch that surfaces a fresh nip51ExportStatus).
    if (open) return;
    setTitleDraft(currentTitle || defaultTitle);
  }, [currentTitle, defaultTitle, open]);

  const hasNip07 = typeof window !== 'undefined' && !!window.nostr;
  const hasWriteRelays = Array.isArray(writeRelays) && writeRelays.length > 0;

  const handleTriggerClick = (e) => {
    e.stopPropagation(); e.preventDefault();
    setError(null);
    setCopied(false);
    setOpen(true);
  };

  const handleConfirm = async () => {
    setExporting(true);
    setError(null);
    try {
      const { naddr } = await publishNip51ExportForPin({
        pinEventId,
        title: (titleDraft || '').trim() || undefined,
      });
      if (navigator?.clipboard?.writeText && naddr) {
        try { await navigator.clipboard.writeText(naddr); } catch { /* clipboard rejected */ }
      }
      setCopied(true);
      setOpen(false);
      setTimeout(() => setCopied(false), 1800);
      if (typeof onExported === 'function') onExported();
    } catch (e) {
      setError(e.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const triggerLabel = variant === 'compact'
    ? (copied ? '✓' : '📤')
    : (copied ? '✓ Exported' : '📤 Export for other clients');

  const triggerTitle = hasNip07
    ? 'Sign and publish a NIP-51 follow set under your key (other nostr clients can subscribe to it)'
    : 'Sign in with a NIP-07 extension to export this list';

  return (
    <span className={`bs-tl-export-wrap${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className={`bs-tl-export bs-tl-export-${variant}${copied ? ' is-copied' : ''}`}
        onClick={handleTriggerClick}
        disabled={!hasNip07 || exporting}
        title={triggerTitle}
        aria-label="Export list for use in other nostr clients"
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="bs-tl-export-popover"
          role="dialog"
          aria-label="Export list for other clients"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bs-tl-export-row">
            <label className="bs-tl-export-label" htmlFor="bs-tl-export-title">
              List title
            </label>
            <input
              id="bs-tl-export-title"
              type="text"
              className="bs-tl-export-input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder={defaultTitle || 'Choose a name'}
              disabled={exporting}
            />
          </div>

          {hasWriteRelays ? (
            <div className="bs-tl-export-preview is-ok">
              <p className="bs-tl-export-preview-lead">
                This will publish the NIP-51 list <strong>{(titleDraft || defaultTitle || 'untitled')}</strong> to:
              </p>
              <ul className="bs-tl-export-preview-list">
                {writeRelays.map((r) => (
                  <li key={r}><code>{r}</code></li>
                ))}
              </ul>
              <p className="bs-tl-export-preview-foot">
                ({writeRelays.length} of your write relays from your NIP-65 relay list, plus this Brainstorm instance's relay.)
              </p>
            </div>
          ) : (
            <div className="bs-tl-export-preview is-warn" role="alert">
              ⚠️ You haven't published a NIP-65 relay list, so this list will
              only land on this Brainstorm instance's relay. Other nostr
              clients won't find it unless they have this relay configured.
              To make it discoverable, publish a NIP-65 relay list and try
              again.
            </div>
          )}

          {error && (
            <p className="bs-tl-export-error" role="alert">⚠️ {error}</p>
          )}

          <div className="bs-tl-export-actions">
            <button
              type="button"
              className="bs-tl-export-cancel"
              onClick={() => { setOpen(false); setError(null); }}
              disabled={exporting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="bs-tl-export-confirm"
              onClick={handleConfirm}
              disabled={exporting}
            >
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
