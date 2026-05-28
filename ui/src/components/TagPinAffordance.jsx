import React from 'react';
import { useNavigate } from 'react-router-dom';
import { computeTLDTag } from '../utils/publishTagPin';

/**
 * Story 10 / ADR 0009 — Pin button for the tag detail header.
 *
 * Story 18 / ADR 0016 polish:
 *   - Unpinned state: still a single-click action (Tag.jsx now publishes
 *     immediately with defaults — no curation-dialog interstitial).
 *   - Pinned state: button is no longer a toggle. Default label is
 *     "📌 Pinned"; on hover it swaps to "📌 View Pin" (CSS-only). Click
 *     navigates to `/pin/<dTag>` where the user can inspect / edit /
 *     unpin deliberately. `onUnpin` is no longer wired here; unpinning
 *     happens from the pin-detail page or from `/pins`.
 *   - Tooltip migrates from native `title=` to `data-bs-tooltip=` for
 *     the fast onset configured globally in styles.css.
 *
 * Loading and error states are driven by the parent (Tag.jsx) so the
 * same spinner/error surface is reusable across the curation-editor
 * surface on `/pins`.
 */
export default function TagPinAffordance({
  user, tag, viewerPin, onPin, loading, error,
}) {
  if (!user) return null;
  const navigate = useNavigate();
  const isPinned = !!viewerPin;

  const handleClick = () => {
    if (loading) return;
    if (isPinned) {
      if (!tag) return;
      // The /pin/:dTag route resolves the kind-30392 TL by the TA's
      // d-tag, not the viewer's pin event d-tag. Use the observer
      // from the curation method if present (custom observers) and
      // fall back to the viewer's own pubkey (the default).
      const observer = viewerPin?.curationMethod?.observer || user.pubkey;
      const dTag = computeTLDTag({
        observer,
        tagAuthorPubkey: tag.authorPubkey,
        tagSlug: tag.slug,
      });
      navigate(`/pin/${dTag}`);
      return;
    }
    onPin();
  };

  const tooltip = isPinned
    ? "View this pin's details and members."
    : 'Pin this tag to publish a Trusted List (kind-30392) curated to your preferences. Other Nostr apps can read it for content discovery and trust-weighted ranking.';
  const ariaLabel = isPinned ? 'View this pin' : 'Pin this tag';

  return (
    <div className="bs-tag-pin-wrap">
      <button
        type="button"
        className={`bs-tag-pin${isPinned ? ' is-pinned' : ''}`}
        onClick={handleClick}
        disabled={loading}
        aria-label={ariaLabel}
        data-bs-tooltip={tooltip}
        data-bs-tooltip-wrap="true"
      >
        {loading ? (
          <span className="bs-tag-pin-label-default">
            {isPinned ? 'Loading…' : 'Pinning…'}
          </span>
        ) : (
          <>
            <span className="bs-tag-pin-label-default">
              {isPinned ? '📌 Pinned' : '📌 Pin'}
            </span>
            {isPinned && (
              <span className="bs-tag-pin-label-hover" aria-hidden="true">
                📌 View Pin
              </span>
            )}
          </>
        )}
      </button>
      {error && (
        <p className="bs-tag-pin-error" role="alert">⚠️ {error}</p>
      )}
    </div>
  );
}
