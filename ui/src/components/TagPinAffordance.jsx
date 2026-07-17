import React from 'react';

/**
 * Story 10 / ADR 0009 — Pin button for the tag detail header.
 *
 * Story 20 / ADR 0018 — the button is now a tab toggle (supersedes
 * ADR 0016 AC-13–AC-15, which navigated to /pin/:dTag):
 *   - Unpinned: single-click action; Tag.jsx publishes immediately with
 *     defaults (no curation-dialog interstitial) and switches to the
 *     Pinned tab.
 *   - Pinned, on the default tab: label "📌 Pinned"; click switches to
 *     the on-page "Pinned" tab. It does NOT navigate away and does NOT
 *     unpin (unpinning lives in the Pinned tab's Edit-curation dialog).
 *   - Pinned, on the Pinned tab: label "← Back to Tag"; click switches
 *     back to the default tab.
 *
 * Loading and error states are driven by the parent (Tag.jsx).
 */
export default function TagPinAffordance({
  user, viewerPin, viewerPins = [], contexts = [], onPin, onPinToContext,
  loading, error, activeTab, onSwitchTab,
}) {
  if (!user) return null;
  const isPinned = !!viewerPin;
  const onPinnedTab = activeTab === 'pinned';
  // contextual-pins ADR 0001 — which contexts this tag is already pinned to.
  const pinnedContextSlugs = new Set(
    viewerPins.filter((p) => p && p.context).map((p) => p.context)
  );

  const handleClick = () => {
    if (loading) return;
    if (isPinned) {
      onSwitchTab(onPinnedTab ? 'default' : 'pinned');
      return;
    }
    onPin();
  };

  let label;
  if (loading) {
    label = isPinned ? 'Loading…' : 'Pinning…';
  } else if (!isPinned) {
    label = '📌 Pin';
  } else if (onPinnedTab) {
    label = '← Back to Tag';
  } else {
    label = '📌 Pinned';
  }

  const tooltip = !isPinned
    ? 'Pin this tag to publish a Trusted List (kind-30392) curated to your preferences. Other Nostr apps can read it for content discovery and trust-weighted ranking.'
    : onPinnedTab
      ? 'Back to the tagged-profiles view.'
      : 'View this pin: its Trusted List members and curation settings.';
  const ariaLabel = !isPinned
    ? 'Pin this tag'
    : onPinnedTab ? 'Back to the tag view' : 'View this pin';

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
        <span className="bs-tag-pin-label-default">{label}</span>
      </button>
      {onPinToContext && contexts.length > 0 && (
        <details className="bs-tag-pin-context">
          <summary>📌 Pin to community…</summary>
          <ul className="bs-tag-pin-context-list">
            {contexts.map((c) => {
              const already = pinnedContextSlugs.has(c.slug);
              return (
                <li key={c.slug}>
                  <button
                    type="button"
                    className="bs-tag-pin-context-item"
                    onClick={() => { if (!loading && !already) onPinToContext(c); }}
                    disabled={loading || already}
                    aria-label={already ? `Already pinned to ${c.name}` : `Pin to ${c.name}`}
                    data-bs-tooltip={`Pin this tag within the ${c.name} community context — a distinct, first-class pin that coexists with your neutral pin.`}
                    data-bs-tooltip-wrap="true"
                  >
                    {already ? `✓ ${c.name}` : c.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {error && (
        <p className="bs-tag-pin-error" role="alert">⚠️ {error}</p>
      )}
    </div>
  );
}
