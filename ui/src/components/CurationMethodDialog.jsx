import React, { useState, useRef, useEffect } from 'react';
import { TL_MEMBERSHIP_METHODS } from '../config/tlMembershipMethods';
import { buildCuration } from '../utils/curationDialogBuild';

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
 *   onUnpin         — Story 18 / ADR 0016; optional. When provided AND
 *                     `mode === 'edit'`, renders a destructive "Unpin"
 *                     button on the left of the action row. Resolving
 *                     the promise closes the dialog (the caller is
 *                     responsible for the underlying delete + refresh).
 */
const SUPPORTED_METHODS = [
  { value: 'nip85:rank',      label: 'nip85:rank',      enabled: true },
  { value: 'follows',         label: 'follows',         enabled: false },
  { value: 'trust-everyone',  label: 'trust-everyone',  enabled: false },
  { value: 'trusted-list',    label: 'trusted-list',    enabled: false },
];

// search-index-selection #4 — `normalizeObserver` / `normalizeCutoff` and the blob
// build MOVED to ../utils/curationDialogBuild.js (pure, node-importable) so the
// confirm step's byte-identity with `defaultCurationMethod` is assertable. There is
// no second copy of the rule here.

export default function CurationMethodDialog({
  tag,
  initialCuration,
  mode = 'create',
  // search-index-selection #4 AC-5 — for a "Pin to community" flow the chosen context is
  // shown, fixed (not editable here); null for a neutral pin.
  context = null,
  contextName = null,
  viewerPubkey,
  onSubmit,
  onCancel,
  onUnpin,
}) {
  const init = initialCuration || {};
  const [cutoff, setCutoff] = useState(String(init.cutoff ?? 1));
  const [includeScoreInTL, setIncludeScoreInTL] = useState(!!init.includeScoreInTL);
  const [method, setMethod] = useState(init.method || 'nip85:rank');
  // Story 12 / ADR 0015 — target-typed pinning. Which of the tag's target types
  // to materialize, and (for notes) which curation. Default: both.
  const initTypes = init.targetTypes || ['profile', 'note'];
  const [includeProfiles, setIncludeProfiles] = useState(initTypes.includes('profile'));
  const [includeNotes, setIncludeNotes] = useState(initTypes.includes('note'));
  // Story dlist-item-tagging #5 — item targets (kind-30394). The initTypes fallback
  // above deliberately stays ['profile','note']: editing a pre-existing pin must not
  // silently add items.
  const [includeItems, setIncludeItems] = useState(initTypes.includes('item'));
  const [noteMethod, setNoteMethod] = useState(init.noteMethod || 'notes:net-endorsed');
  // search-index-selection ADR 0001 §3 — trust scope. A separate two-option
  // control, NOT a value in the method enum (every runner gates on
  // method === 'nip85:rank'). Anything that is not 'observer' renders as "My web
  // of trust", and the RAW initial value is kept so an edit that does not touch
  // the control re-emits it verbatim — a value this build does not recognise is
  // never silently downgraded. Same initTypes discipline as targetTypes above.
  const rawAuthorConstraint = init.authorConstraint;
  const [authorConstraint, setAuthorConstraint] = useState(
    rawAuthorConstraint === 'observer' ? 'observer' : ''
  );
  const [authorConstraintTouched, setAuthorConstraintTouched] = useState(false);
  // search-index-selection ADR 0002 §3 — the pin's own membership method.
  // Empty string = "Instance default" (the field stays ABSENT from the blob, so
  // the deployment dial supplies the fold). Same discipline as authorConstraint
  // above: the RAW initial value is kept and only a touched control overrides
  // it, so an edit never silently downgrades a value this build cannot render.
  const rawMembershipMethod = init.membershipMethod;
  const [membershipMethod, setMembershipMethod] = useState(
    TL_MEMBERSHIP_METHODS.some((m) => m.id === rawMembershipMethod) ? rawMembershipMethod : ''
  );
  const [membershipMethodTouched, setMembershipMethodTouched] = useState(false);
  const [observer, setObserver] = useState(
    init.observer && init.observer !== viewerPubkey ? init.observer : ''
  );
  const [advancedOpen, setAdvancedOpen] = useState(
    !!(init.observer && init.observer !== viewerPubkey)
  );
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [unpinning, setUnpinning] = useState(false);
  const [confirmingUnpin, setConfirmingUnpin] = useState(false);

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
    const result = buildCuration({
      observer,
      viewerPubkey,
      cutoff,
      includeScoreInTL,
      method,
      includeProfiles,
      includeNotes,
      includeItems,
      noteMethod,
      authorConstraint,
      rawAuthorConstraint,
      authorConstraintTouched,
      membershipMethod,
      rawMembershipMethod,
      membershipMethodTouched,
    });
    setFieldErrors(result.ok ? {} : result.fieldErrors);
    if (!result.ok) return;
    const custom = result.curation;

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

  // The v1-disabled "Advanced" block below keeps its open/onToggle wiring here so the
  // only `<details>` that renders in this dialog — the create-mode "What's a Trusted
  // List?" explainer — is unambiguously collapsed by default. Behaviour unchanged.
  const advancedDetailsProps = {
    open: advancedOpen,
    onToggle: (e) => setAdvancedOpen(e.target.open),
  };

  const handleUnpinClick = async () => {
    if (!onUnpin || unpinning || submitting) return;
    if (!confirmingUnpin) {
      setConfirmingUnpin(true);
      return;
    }
    setUnpinning(true);
    setError(null);
    try {
      await onUnpin();
      onCancel(); // close on success
    } catch (err) {
      setError(err?.message || 'Unpin failed');
      setConfirmingUnpin(false);
    } finally {
      setUnpinning(false);
    }
  };

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

        {/* search-index-selection #4 / Gate A ruling 2 — the confirm step says what
            the primary action is about to do, and offers a collapsed explainer.
            Create mode only: an edit of an existing pin sees neither. */}
        {mode === 'create' && (
          <div className="pcd-create-note">
            <p className="pcd-create-line">
              Pinning publishes a Trusted List under your point of view with this curation.
            </p>
            {context && (
              <p className="pcd-create-context">
                Community: <strong>{contextName || context}</strong>
                <span className="pcd-create-context-note"> — this pin and its lists are scoped to this community</span>
              </p>
            )}
            <details className="pcd-tl-explainer">
              <summary>{"What's a Trusted List?"}</summary>
              <p>
                Pin this tag to publish a Trusted List (kind-30392) curated to your
                preferences. Other Nostr apps can read it for content discovery and
                trust-weighted ranking.
              </p>
            </details>
          </div>
        )}

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

          {/* search-index-selection ADR 0002 §3 — how THIS pin's already-trust-filtered
              assertions are folded into members. Absent ⇒ the instance-wide dial, which
              is why the leading option is a real, selectable empty value. The dialog
              deliberately does not name the current dial: the only endpoint carrying it
              is owner-gated. */}
          <div className="pcd-field">
            <label htmlFor="pcd-membership-method" className="pcd-label">Membership method</label>
            <select
              id="pcd-membership-method"
              className="pcd-select"
              value={membershipMethod}
              onChange={(e) => { setMembershipMethodTouched(true); setMembershipMethod(e.target.value); }}
              disabled={submitting}
            >
              <option value="">Instance default</option>
              {TL_MEMBERSHIP_METHODS.map((m) => (
                <option key={m.id} value={m.id} disabled={!m.available}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="pcd-helper">
              Instance default means whatever this instance&apos;s operator has selected; the
              published list records the method that actually ran.
            </p>
          </div>

          {/* search-index-selection ADR 0001 §3 — whose assertions count. Not a
              method (that is HOW trust is computed); this is WHOSE assertions are
              eligible. "Only me" is what makes a list certain enough to index. */}
          <div className="pcd-field">
            <span className="pcd-label">Trust scope</span>
            <label className="pcd-toggle">
              <input
                type="radio"
                name="pcd-author-constraint"
                value=""
                checked={authorConstraint !== 'observer'}
                onChange={() => { setAuthorConstraint(''); setAuthorConstraintTouched(true); }}
                disabled={submitting}
              />
              <span>My web of trust</span>
            </label>
            <label className="pcd-toggle">
              <input
                type="radio"
                name="pcd-author-constraint"
                value="observer"
                checked={authorConstraint === 'observer'}
                onChange={() => { setAuthorConstraint('observer'); setAuthorConstraintTouched(true); }}
                disabled={submitting}
              />
              <span>Only me</span>
            </label>
            <p className="pcd-helper">
              "Only me" counts only the observer's own taggings — certain, because
              only they can sign as themselves. "My web of trust" counts every
              trusted author's taggings, as today.
            </p>
          </div>

          {/* Story 12 / ADR 0015 — target-type selection. A tag can span both
              profiles and notes; choose which to snapshot. Profiles → a kind-30000
              follow set; notes → a kind-30003 bookmark set. */}
          <div className="pcd-field">
            <span className="pcd-label">Include</span>
            <label className="pcd-toggle">
              <input
                type="checkbox"
                checked={includeProfiles}
                onChange={(e) => setIncludeProfiles(e.target.checked)}
                disabled={submitting}
              />
              <span>Profiles → follow set (kind-30000)</span>
            </label>
            <label className="pcd-toggle">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
                disabled={submitting}
              />
              <span>Notes → bookmark set (kind-30003)</span>
            </label>
            <label className="pcd-toggle">
              <input
                type="checkbox"
                checked={includeItems}
                onChange={(e) => setIncludeItems(e.target.checked)}
                disabled={submitting}
              />
              <span>Items → item Trusted List (kind-30394)</span>
            </label>
            {fieldErrors.targetTypes && (
              <p className="pcd-error" role="alert">{fieldErrors.targetTypes}</p>
            )}
            {includeNotes && (
              <div className="pcd-note-method">
                <label htmlFor="pcd-note-method" className="pcd-label">Note curation</label>
                <select
                  id="pcd-note-method"
                  className="pcd-select"
                  value={noteMethod}
                  onChange={(e) => setNoteMethod(e.target.value)}
                  disabled={submitting}
                >
                  <option value="notes:net-endorsed">Net-endorsed (applied &gt; disputed), recent first</option>
                  <option value="notes:most-applied">Most-applied (by application count)</option>
                </select>
              </div>
            )}
            <p className="pcd-helper">
              Only target types the tag actually has are published; an empty set for a type is skipped.
            </p>
          </div>

          {/* Story 17 / ADR 0014 Decision 8 — Advanced (observer override)
              hidden in v1; the observer always falls back to the viewer's
              own pubkey via defaultCurationMethod. Re-enable when a POV
              picker is added. */}
          {false && (
            <details
              className="pcd-advanced"
              {...advancedDetailsProps}
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

          {mode === 'edit' && onUnpin && confirmingUnpin && (
            <p className="pcd-unpin-export-hint" role="note">
              Note: your published cross-client list (NIP-51 kind 30000) will
              not be automatically retracted. To take it down from your other
              clients, re-export an empty version from the pin's detail page,
              or publish a NIP-09 deletion yourself.
            </p>
          )}

          <div className="pcd-actions">
            {mode === 'edit' && onUnpin && (
              <button
                type="button"
                className={`pcd-unpin${confirmingUnpin ? ' is-confirming' : ''}`}
                onClick={handleUnpinClick}
                disabled={submitting || unpinning}
                aria-label={confirmingUnpin ? 'Confirm unpin' : 'Unpin this tag'}
              >
                {unpinning
                  ? 'Unpinning…'
                  : confirmingUnpin ? 'Confirm Unpin' : '🗑 Unpin'}
              </button>
            )}
            <span className="pcd-actions-spacer" />
            <button
              type="button"
              className="pcd-cancel"
              onClick={onCancel}
              disabled={submitting || unpinning}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="pcd-submit"
              disabled={submitting || unpinning}
            >
              {submitting ? 'Publishing…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
