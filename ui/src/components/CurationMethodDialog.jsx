import React, { useState, useRef, useEffect } from 'react';
import { nip19 } from 'nostr-tools';

/**
 * Story 12 / ADR 0011 — Curation-method editor.
 *
 * Shared between three trigger points:
 *   - Tag detail page Pin button (mode='create')
 *   - /pins per-row Edit button (mode='edit')
 *   - PinDetail Edit button (mode='edit')
 *
 * Props:
 *   tag             — { eventId, slug, name, authorPubkey }
 *   initialCuration — { observer, method, cutoff, includeScoreInTL }
 *   mode            — 'create' | 'edit'
 *   viewerPubkey    — used as the default observer when the field is empty
 *   onSubmit(custom) — async; resolves on publish success, rejects to surface inline error
 *   onCancel        — closes the dialog without publishing
 */
const SUPPORTED_METHODS = [
  { value: 'nip85:rank',      label: 'nip85:rank',      enabled: true },
  { value: 'follows',         label: 'follows',         enabled: false },
  { value: 'trust-everyone',  label: 'trust-everyone',  enabled: false },
  { value: 'trusted-list',    label: 'trusted-list',    enabled: false },
];

function normalizeObserver(raw, viewerPubkey) {
  const trimmed = (raw || '').trim();
  if (trimmed === '') return { ok: true, value: viewerPubkey };
  if (/^[0-9a-f]{64}$/.test(trimmed)) return { ok: true, value: trimmed };
  if (trimmed.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'npub' && typeof decoded.data === 'string') {
        return { ok: true, value: decoded.data };
      }
    } catch { /* fall through */ }
  }
  return { ok: false, error: 'Must be a 64-char hex pubkey or a valid npub.' };
}

function normalizeCutoff(raw) {
  const trimmed = (raw || '').trim();
  if (trimmed === '') return { ok: false, error: 'Cutoff must be a positive integer.' };
  if (!/^-?\d+$/.test(trimmed)) {
    return { ok: false, error: 'Cutoff must be a positive integer.' };
  }
  const n = parseInt(trimmed, 10);
  if (!Number.isInteger(n) || n < 1) {
    return { ok: false, error: 'Cutoff must be a positive integer.' };
  }
  return { ok: true, value: n };
}

export default function CurationMethodDialog({
  tag,
  initialCuration,
  mode = 'create',
  viewerPubkey,
  onSubmit,
  onCancel,
}) {
  const init = initialCuration || {};
  const [cutoff, setCutoff] = useState(String(init.cutoff ?? 1));
  const [includeScoreInTL, setIncludeScoreInTL] = useState(!!init.includeScoreInTL);
  const [method, setMethod] = useState(init.method || 'nip85:rank');
  const [observer, setObserver] = useState(
    init.observer && init.observer !== viewerPubkey ? init.observer : ''
  );
  const [advancedOpen, setAdvancedOpen] = useState(
    !!(init.observer && init.observer !== viewerPubkey)
  );
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const dialogRef = useRef(null);
  const cutoffRef = useRef(null);

  useEffect(() => {
    cutoffRef.current?.focus();
    cutoffRef.current?.select?.();
    const onKey = (e) => {
      if (e.key === 'Escape' && !submitting) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, submitting]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    const errs = {};
    const cutoffR = normalizeCutoff(cutoff);
    if (!cutoffR.ok) errs.cutoff = cutoffR.error;
    const observerR = normalizeObserver(observer, viewerPubkey);
    if (!observerR.ok) errs.observer = observerR.error;
    // Method enum check (defensive; the picker prevents bad values).
    if (method !== 'nip85:rank') errs.method = 'Only nip85:rank is supported in v1.';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const custom = {
      observer: observerR.value,
      method: 'nip85:rank',
      cutoff: cutoffR.value,
      includeScoreInTL: !!includeScoreInTL,
    };

    setSubmitting(true);
    try {
      await onSubmit(custom);
      onCancel(); // close on success
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const submitLabel = mode === 'edit' ? 'Save changes' : 'Pin with these settings';

  return (
    <div
      className="pcd-backdrop"
      onMouseDown={(e) => { if (!submitting) onCancel(); }}
    >
      <div
        ref={dialogRef}
        className="pcd"
        role="dialog"
        aria-label="Edit curation method"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="pcd-head">
          <h3 className="pcd-title">
            {mode === 'edit' ? 'Edit curation' : 'Pin curation method'}
          </h3>
          <button
            type="button"
            className="pcd-close"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Close"
          >×</button>
        </div>

        <div className="pcd-tag-info">
          <span className="pcd-tag-label">Tag:</span>
          <span className="pcd-tag-name">{tag?.name || tag?.slug || '—'}</span>
        </div>

        <div className="pcd-intro">
          <p>
            Pinning a tag tells this instance to periodically publish a{' '}
            <strong>Trusted List</strong> (NIP-85 kind-30392) under your
            point-of-view, listing the profiles that the tag applies to.
            Other Nostr apps can read those lists for content discovery,
            list curation, and trust-weighted ranking.
          </p>
        </div>

        <form className="pcd-body" onSubmit={handleSubmit}>
          <div className="pcd-field">
            <label htmlFor="pcd-cutoff" className="pcd-label">Cutoff</label>
            <input
              id="pcd-cutoff"
              ref={cutoffRef}
              type="number"
              min="1"
              step="1"
              className="pcd-input"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              disabled={submitting}
              aria-invalid={!!fieldErrors.cutoff}
            />
            {fieldErrors.cutoff && (
              <p className="pcd-error" role="alert">{fieldErrors.cutoff}</p>
            )}
            <p className="pcd-helper">
              Typical values: 1–10. Higher cutoffs require more endorsements per member.
            </p>
          </div>

          {/* Story 17 / ADR 0014 Decision 8 — hidden in v1; new pins default
              to includeScoreInTL=true via defaultCurationMethod. Re-enable
              when richer curation UX lands. */}
          {false && (
            <div className="pcd-field">
              <label className="pcd-toggle">
                <input
                  type="checkbox"
                  checked={includeScoreInTL}
                  onChange={(e) => setIncludeScoreInTL(e.target.checked)}
                  disabled={submitting}
                />
                <span>Include rank scores in the published Trusted List</span>
              </label>
              <p className="pcd-helper">
                Rank scores require a configured POV for the observer. If the
                observer's POV isn't resolvable, members appear in the list
                without scores.
              </p>
            </div>
          )}

          <div className="pcd-field">
            <label htmlFor="pcd-method" className="pcd-label">Method</label>
            <select
              id="pcd-method"
              className="pcd-select"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              disabled={submitting}
            >
              {SUPPORTED_METHODS.map((m) => (
                <option key={m.value} value={m.value} disabled={!m.enabled}>
                  {m.label}{m.enabled ? '' : ' (coming soon)'}
                </option>
              ))}
            </select>
            {fieldErrors.method && (
              <p className="pcd-error" role="alert">{fieldErrors.method}</p>
            )}
          </div>

          {/* Story 17 / ADR 0014 Decision 8 — Advanced (observer override)
              hidden in v1; the observer always falls back to the viewer's
              own pubkey via defaultCurationMethod. Re-enable when a POV
              picker is added. */}
          {false && (
            <details
              className="pcd-advanced"
              open={advancedOpen}
              onToggle={(e) => setAdvancedOpen(e.target.open)}
            >
              <summary>Advanced</summary>
              <div className="pcd-field">
                <label htmlFor="pcd-observer" className="pcd-label">Observer pubkey</label>
                <input
                  id="pcd-observer"
                  type="text"
                  className="pcd-input"
                  placeholder={`Defaults to you (${viewerPubkey?.slice(0, 8)}…)`}
                  value={observer}
                  onChange={(e) => setObserver(e.target.value)}
                  disabled={submitting}
                  aria-invalid={!!fieldErrors.observer}
                />
                {fieldErrors.observer && (
                  <p className="pcd-error" role="alert">{fieldErrors.observer}</p>
                )}
                <p className="pcd-helper">
                  Accepts a 64-char hex pubkey or an <code>npub1…</code> identifier.
                  Leave empty to use your own pubkey.
                </p>
              </div>
            </details>
          )}

          {error && (
            <p className="pcd-form-error" role="alert">⚠️ {error}</p>
          )}

          <div className="pcd-actions">
            <button
              type="button"
              className="pcd-cancel"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="pcd-submit"
              disabled={submitting}
            >
              {submitting ? 'Publishing…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
