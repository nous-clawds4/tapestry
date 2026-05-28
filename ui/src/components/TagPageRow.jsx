import React, { useState, useCallback, useEffect, useRef } from 'react';
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
 * Story 18 / ADR 0016 polish:
 *   - In the collapsed Curated view (showActionsOnHover=true), the scores
 *     slot now hides by default and joins the existing hover-reveal
 *     selector group (CSS-driven, see styles.css). A visually-hidden
 *     mirror keeps the values in the accessibility tree.
 *   - A `⋯` overflow trigger renders on hover-none / pointer-coarse
 *     viewports and opens an anchored popover containing the same
 *     scores + action buttons. Closes on outside-tap, Escape, or after
 *     a successful Apply/Dispute.
 *   - Native `title=` attributes migrate to `data-bs-tooltip=` so the
 *     fast onset from the global `--bs-tooltip-onset` CSS variable
 *     applies. Each migrated node keeps its accessible name via
 *     `aria-label`.
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
 *                         Story 18: scores follow the same rule unless
 *                         `scoresAlwaysVisible` is set.
 *   scoresAlwaysVisible — boolean; when true the scores slot ignores
 *                         the visibility:hidden default and always
 *                         shows. Used in the "Tag someone" search
 *                         modal where the Verification Score is
 *                         critical information at all times.
 *   tapOpensMenu        — boolean; when true, tapping anywhere on the
 *                         row (instead of the avatar/name link) opens
 *                         the ⋯ menu on narrow viewports. Also adds a
 *                         "View profile" link to the menu so the user
 *                         can still reach the profile page. Used in
 *                         the search modal where the primary intent
 *                         is apply/dispute, not navigate.
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
  scoresAlwaysVisible = false,
  tapOpensMenu = false,
  verificationScore = null,
  onApply,
  onDispute,
}) {
  const [publishingPolarity, setPublishingPolarity] = useState(null);
  const [publishError, setPublishError] = useState(null);
  // Story 18 / ADR 0016 — overflow menu open state. Replaces the
  // Story-17 `touchRevealed` row-wide tap-to-reveal, which fired on
  // *any* touch (including the start of a scroll) and caused scores
  // to flash in/out as the user scrolled.
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef(null);

  const isApplied = viewerState === 'applied';
  const isDisputed = viewerState === 'disputed';

  const closeOverflow = useCallback(() => setOverflowOpen(false), []);

  const handleClick = async (polarityLabel, handler, opts = {}) => {
    if (publishingPolarity) return;
    setPublishingPolarity(polarityLabel);
    setPublishError(null);
    try {
      await handler(row.pubkey);
      if (opts.closeAfter) closeOverflow();
    } catch (err) {
      setPublishError(err?.message || 'Publish failed.');
    } finally {
      setPublishingPolarity(null);
    }
  };

  // Outside-tap / Escape close for the overflow menu.
  useEffect(() => {
    if (!overflowOpen) return undefined;
    const onDocDown = (e) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) {
        closeOverflow();
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') closeOverflow();
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [overflowOpen, closeOverflow]);

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
    scoresAlwaysVisible ? 'is-scores-pinned' : '',
  ].filter(Boolean).join(' ');

  // Story 18 — in tap-opens-menu contexts (e.g. "Tag someone" search
  // modal), intercept link clicks on narrow viewports and open the
  // overflow menu instead. On wider viewports the link still
  // navigates to the profile so desktop UX is unchanged.
  const handleLinkClick = (e) => {
    if (!tapOpensMenu) return;
    if (typeof window !== 'undefined' && window.matchMedia
        && window.matchMedia('(max-width: 768px)').matches) {
      e.preventDefault();
      setOverflowOpen(true);
    }
  };

  // Story 18: shared markup pieces so the inline row AND the overflow
  // popover render the same buttons / scores. The popover sets
  // closeAfter:true so a successful action collapses the menu.
  const renderActionsMarkup = (closeAfter = false) => (
    <div className="bs-tag-row-actions">
      <button
        type="button"
        className={`bs-tag-row-apply${isApplied ? ' is-applied' : ''}`}
        aria-pressed={isApplied}
        disabled={applyDisabled}
        onClick={() => handleClick('apply', onApply, { closeAfter })}
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
        onClick={() => handleClick('dispute', onDispute, { closeAfter })}
      >
        {publishingPolarity === 'dispute'
          ? 'Disputing…'
          : isDisputed ? 'Disputed' : 'Dispute'}
      </button>
    </div>
  );

  const scoresMarkup = (
    <div className="bs-tag-row-scores">
      {hasAssertions ? (
        <>
          <span
            className={netClass}
            data-bs-tooltip="Net score: applications minus disputes in this POV's WoT"
            aria-label={`Net score ${net > 0 ? '+' + net : net}, applications minus disputes in your POV's WoT`}
          >
            {net > 0 ? `+${net}` : net < 0 ? `${net}` : '0'}
          </span>
          <span className="bs-tag-row-counts">
            <span
              className="bs-tag-count bs-tag-count-apply"
              data-bs-tooltip="Applications in your POV's WoT"
              aria-label={`${row.applications} applications in your POV's WoT`}
            >
              +{row.applications}
            </span>
            <span
              className="bs-tag-count bs-tag-count-dispute"
              data-bs-tooltip="Disputes in your POV's WoT"
              aria-label={`${row.disputes} disputes in your POV's WoT`}
            >
              −{row.disputes}
            </span>
          </span>
        </>
      ) : verificationScore != null ? (
        <span
          className="bs-tag-row-verif"
          data-bs-tooltip="Verification Score (POV-aware WoT rank)"
          aria-label={`Verification Score ${verificationScore}, POV-aware WoT rank`}
        >
          🏅 {verificationScore}
        </span>
      ) : null}
    </div>
  );

  // Story 18 AC-19 — visually-hidden mirror so screen readers continue
  // to announce the score values even when the visual slot is
  // visibility:hidden in the collapsed Curated view.
  const srOnlyScoreSummary = hasAssertions
    ? `Net ${net > 0 ? '+' + net : net}, ${row.applications} applied, ${row.disputes} disputed.`
    : verificationScore != null
      ? `Verification Score ${verificationScore}.`
      : '';

  const displayLabel = row.displayName || shortNpub(row.pubkey);

  return (
    <li className={rowClasses}>
      <Link
        to={`/user/${row.pubkey}`}
        className="bs-tag-row-link"
        onClick={handleLinkClick}
      >
        {row.picture ? (
          <img className="bs-tag-row-avatar" src={row.picture} alt="" />
        ) : (
          <span
            className="bs-tag-row-avatar bs-tag-row-avatar-placeholder"
            aria-hidden="true"
          />
        )}
        <span className="bs-tag-row-name">
          {displayLabel}
          {showActions && row.onlyViewerVisible && (
            <span
              className="bs-tag-row-badge"
              data-bs-tooltip="Only your assertion is making this profile appear under your active POV's WoT."
              data-bs-tooltip-wrap="true"
              aria-label="Only your assertion is making this profile appear under your active POV's WoT."
            >
              your assertion — not yet visible to this POV
            </span>
          )}
        </span>
      </Link>

      {srOnlyScoreSummary && (
        <span className="bs-sr-only">{srOnlyScoreSummary}</span>
      )}

      {showActions && renderActionsMarkup(false)}

      {scoresMarkup}

      {/* Story 18 / ADR 0016 — ⋯ menu surfaces scores AND (when
          signed in) apply/dispute buttons. The trigger renders even
          when logged out because narrow viewports hide the inline
          scores too; the menu is the way to reach them on mobile. */}
      {(hasAssertions || verificationScore != null || showActions) && (
        <div className="bs-tag-row-overflow" ref={overflowRef}>
          <button
            type="button"
            className="bs-tag-row-overflow-trigger"
            aria-label={`Actions for ${displayLabel}`}
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen((o) => !o)}
          >
            ⋯
          </button>
          {overflowOpen && (
            <div className="bs-tag-row-overflow-menu" role="menu">
              {scoresMarkup}
              {(hasAssertions || verificationScore != null) && (
                <p className="bs-tag-row-overflow-help">
                  {hasAssertions
                    ? <>Net = applications (+N) minus disputes (−N) under your point-of-view's web of trust.</>
                    : <>Verification Score is this candidate's WoT rank under your active point-of-view.</>}
                </p>
              )}
              {showActions && renderActionsMarkup(true)}
              {tapOpensMenu && (
                <Link
                  to={`/user/${row.pubkey}`}
                  className="bs-tag-row-overflow-visit"
                  role="menuitem"
                  onClick={closeOverflow}
                >
                  👤 View profile
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {publishError && (
        <p className="bs-tag-row-error" role="alert">⚠️ {publishError}</p>
      )}
    </li>
  );
}
