import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

/**
 * One row on the tag-detail page (and on TagSomeoneModal search results).
 *
 * Story 17 / ADR 0014 reshaped this row into three flex slots:
 *   1. <Link>     — avatar + name + optional viewer-only badge
 *   2. <div>      — action buttons (Apply / Dispute), visibility-controlled
 *                   so the slot's width is reserved permanently (no jiggle)
 *   3. <div>      — scores: Net prominent + small +N/-M secondary, OR
 *                   Verification Score when applications+disputes==0 and a
 *                   `verificationScore` prop is supplied (search-result rows)
 *
 * Props:
 *   row                 — { pubkey, displayName, picture, applications,
 *                          disputes, onlyViewerVisible }
 *   viewerState         — 'applied' | 'disputed' | null
 *   showActions         — boolean; false when logged out (slot omitted)
 *   showActionsOnHover  — boolean; when true the actions slot starts as
 *                         visibility:hidden and only reveals on hover /
 *                         touch-tap / focus-within (Curated default view
 *                         + modal search-results). When false (or omitted),
 *                         the slot is always visible (Expanded mode).
 *   verificationScore   — number | null; rendered in the scores slot when
 *                         row.applications + row.disputes === 0.
 *   onApply, onDispute  — async (targetPubkey) => void publishers
 */

function shortNpub(pk) {
  if (!pk) return '—';
  try {
    const npub = nip19.npubEncode(pk);
    return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
  } catch {
    return `${pk.slice(0, 12)}…${pk.slice(-8)}`;
  }
}

export default function TagPageRow({
  row,
  viewerState,
  showActions,
  showActionsOnHover = false,
  verificationScore = null,
  onApply,
  onDispute,
}) {
  const [publishingPolarity, setPublishingPolarity] = useState(null);
  const [publishError, setPublishError] = useState(null);
  // Touch-tap reveal state — only relevant when showActionsOnHover is true.
  // Desktop hover is handled via CSS :hover; touch can't use :hover reliably.
  const [touchRevealed, setTouchRevealed] = useState(false);

  const isApplied = viewerState === 'applied';
  const isDisputed = viewerState === 'disputed';

  const handleClick = async (polarityLabel, handler) => {
    if (publishingPolarity) return;
    setPublishingPolarity(polarityLabel);
    setPublishError(null);
    try {
      await handler(row.pubkey);
    } catch (err) {
      setPublishError(err?.message || 'Publish failed.');
    } finally {
      setPublishingPolarity(null);
    }
  };

  const handlePointerDown = useCallback((e) => {
    if (!showActionsOnHover) return;
    // Reveal on touch input only; mouse/pen hover is CSS-driven.
    if (e.pointerType === 'touch') setTouchRevealed(true);
  }, [showActionsOnHover]);

  const applications = row.applications || 0;
  const disputes = row.disputes || 0;
  const net = applications - disputes;
  const hasAssertions = (applications + disputes) > 0;

  const netClass = net > 0
    ? 'bs-tag-row-net is-positive'
    : net < 0
      ? 'bs-tag-row-net is-negative'
      : 'bs-tag-row-net is-zero';

  const applyDisabled = isApplied || publishingPolarity !== null;
  const disputeDisabled = isDisputed || publishingPolarity !== null;

  const rowClasses = [
    'bs-tag-row',
    showActionsOnHover ? '' : 'is-expanded-mode',
    touchRevealed ? 'is-revealed' : '',
  ].filter(Boolean).join(' ');

  return (
    <li className={rowClasses} onPointerDown={handlePointerDown}>
      <Link to={`/user/${row.pubkey}`} className="bs-tag-row-link">
        {row.picture ? (
          <img className="bs-tag-row-avatar" src={row.picture} alt="" />
        ) : (
          <span
            className="bs-tag-row-avatar bs-tag-row-avatar-placeholder"
            aria-hidden="true"
          />
        )}
        <span className="bs-tag-row-name">
          {row.displayName || shortNpub(row.pubkey)}
          {showActions && row.onlyViewerVisible && (
            <span className="bs-tag-row-badge" title="Only your assertion is making this profile appear under your active POV's WoT.">
              your assertion — not yet visible to this POV
            </span>
          )}
        </span>
      </Link>

      {showActions && (
        <div className="bs-tag-row-actions">
          <button
            type="button"
            className={`bs-tag-row-apply${isApplied ? ' is-applied' : ''}`}
            aria-pressed={isApplied}
            disabled={applyDisabled}
            onClick={() => handleClick('apply', onApply)}
          >
            {publishingPolarity === 'apply'
              ? 'Applying…'
              : isApplied ? 'Applied' : 'Apply'}
          </button>
          <button
            type="button"
            className={`bs-tag-row-dispute${isDisputed ? ' is-disputed' : ''}`}
            aria-pressed={isDisputed}
            disabled={disputeDisabled}
            onClick={() => handleClick('dispute', onDispute)}
          >
            {publishingPolarity === 'dispute'
              ? 'Disputing…'
              : isDisputed ? 'Disputed' : 'Dispute'}
          </button>
        </div>
      )}

      <div className="bs-tag-row-scores">
        {hasAssertions ? (
          <>
            <span
              className={netClass}
              title="Net score: applications minus disputes in this POV's WoT"
            >
              {net > 0 ? `+${net}` : net < 0 ? `${net}` : '0'}
            </span>
            <span className="bs-tag-row-counts">
              <span
                className="bs-tag-count bs-tag-count-apply"
                title="Applications in your POV's WoT"
              >
                +{row.applications}
              </span>
              <span
                className="bs-tag-count bs-tag-count-dispute"
                title="Disputes in your POV's WoT"
              >
                −{row.disputes}
              </span>
            </span>
          </>
        ) : verificationScore != null ? (
          <span
            className="bs-tag-row-verif"
            title="Verification Score (POV-aware WoT rank)"
          >
            🏅 {verificationScore}
          </span>
        ) : null}
      </div>

      {publishError && (
        <p className="bs-tag-row-error" role="alert">⚠️ {publishError}</p>
      )}
    </li>
  );
}
