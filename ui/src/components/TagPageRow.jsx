import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';

/**
 * One row on the tag-detail page. Renders the profile (avatar + display
 * name + WoT-filtered counts) as a navigable link, with optional Apply /
 * Dispute buttons next to the counts (when `showActions`) and a
 * "your assertion — not yet visible to this POV" badge when
 * `row.onlyViewerVisible`.
 *
 * Buttons are siblings of the row link, not children — invalid HTML to nest
 * <button> inside <a>, and the per-button publish handlers need their own
 * click semantics.
 *
 * Per-row state (publishingPolarity, publishError) is local: parent
 * triggers `refetchRows` after a successful publish; the new viewerAssertions
 * map collapses the local state when the row re-renders with the new
 * `viewerState`.
 *
 * Story 3 / ADR-0004.
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
  viewerState,    // 'applied' | 'disputed' | null
  showActions,    // boolean — false when logged out
  onApply,        // async (targetPubkey) => void
  onDispute,      // async (targetPubkey) => void
}) {
  const [publishingPolarity, setPublishingPolarity] = useState(null); // 'apply' | 'dispute' | null
  const [publishError, setPublishError] = useState(null);

  const isApplied = viewerState === 'applied';
  const isDisputed = viewerState === 'disputed';

  const handleClick = async (polarityLabel, handler) => {
    if (publishingPolarity) return; // single-flight per row
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

  const applyDisabled = isApplied || publishingPolarity !== null;
  const disputeDisabled = isDisputed || publishingPolarity !== null;

  return (
    <li className="bs-tag-row">
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

      {publishError && (
        <p className="bs-tag-row-error" role="alert">⚠️ {publishError}</p>
      )}
    </li>
  );
}
