import React from 'react';

/**
 * Story 10 / ADR 0009 — Pin / Unpin button for the tag detail header.
 *
 * Renders nothing when there's no viewer (logged-out parity, AC-7). When a
 * viewer is present:
 *   - viewerPin == null  → "📌 Pin" button (click → onPin())
 *   - viewerPin != null  → "📌 Pinned · Unpin" button (click → onUnpin())
 *
 * Loading and error states are driven by the parent (Tag.jsx) so the same
 * spinner/error surface is reusable across the future curation editor
 * (Story 11) without re-implementing the wiring.
 */
export default function TagPinAffordance({
  user, viewerPin, onPin, onUnpin, loading, error,
}) {
  if (!user) return null;
  const isPinned = !!viewerPin;
  const handleClick = () => {
    if (loading) return;
    if (isPinned) onUnpin();
    else onPin();
  };
  // Story 17 / ADR 0014 Decision 10 — native title tooltip explains pinning.
  return (
    <div className="bs-tag-pin-wrap">
      <button
        type="button"
        className={`bs-tag-pin${isPinned ? ' is-pinned' : ''}`}
        onClick={handleClick}
        disabled={loading}
        aria-pressed={isPinned}
        title="Pin this tag to publish a Trusted List (kind-30392) curated to your preferences. Other Nostr apps can read it for content discovery and trust-weighted ranking."
      >
        {loading
          ? (isPinned ? 'Unpinning…' : 'Pinning…')
          : (isPinned ? '📌 Pinned · Unpin' : '📌 Pin')}
      </button>
      {error && (
        <p className="bs-tag-pin-error" role="alert">⚠️ {error}</p>
      )}
    </div>
  );
}
