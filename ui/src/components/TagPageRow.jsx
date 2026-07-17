import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import TagRowRawEvents from './TagRowRawEvents';

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
 *   menuRecentlyClosedRef — optional shared MutableRef<number>. When
 *                         present, the outside-tap close sets it to
 *                         Date.now(). handleLinkClick reads it to skip
 *                         "tap-elsewhere-just-closed → open another row"
 *                         from stacking menus across sibling rows.
 *   verificationScore   — number | null; rendered in the scores slot when
 *                         row.applications + row.disputes === 0.
 *   showRawEvent        — boolean; offer the Show/Hide Raw Event item in the ⋯
 *                         menu, and give the row a ⋯ at desktop width too
 *                         (Story 2 / ADR 0002 D5). TAG DETAIL PAGE ONLY.
 *                         Defaults to FALSE, and the default is load-bearing:
 *                         TagSomeoneModal renders this same component and must
 *                         not offer it. Gating on `row.assertions?.length`
 *                         instead would LEAK into the modal — it passes the
 *                         profiles-tagged row object by reference for any hit
 *                         already in the tagged list (TagSomeoneModal.jsx:196),
 *                         so those rows genuinely carry assertions.
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
  menuRecentlyClosedRef = null,
  verificationScore = null,
  showRawEvent = false,
  onApply,
  onDispute,
}) {
  const [publishingPolarity, setPublishingPolarity] = useState(null);
  const [publishError, setPublishError] = useState(null);
  // Story 2 / ADR 0002 D3 — the raw-event panel's visibility, PER ROW. Unlike
  // Story 1 (where the menu and panel were siblings and state had to lift to
  // Tag.jsx), both live inside this <li>, so per-instance state is the natural
  // home — and AC-3's "several rows may have panels open at once; opening one
  // does not close another" falls out of that for free.
  const [rawOpen, setRawOpen] = useState(false);
  // AC-5: reported, not silent, when a row has no assertions to show.
  const [rawNotice, setRawNotice] = useState(null);
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
        // Mark the close time synchronously (before the subsequent
        // click bubbles to a sibling row's link). handleLinkClick on
        // that sibling reads this to avoid opening a stacked menu.
        if (menuRecentlyClosedRef) {
          menuRecentlyClosedRef.current = Date.now();
        }
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
  }, [overflowOpen, closeOverflow, menuRecentlyClosedRef]);

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
    // Story 2 / ADR 0002 D5 — scopes the wide-viewport ⋯ to the surface that
    // actually offers raw-event inspection, WITHOUT touching the base
    // .bs-tag-row-overflow rule the "Tag someone" modal shares.
    showRawEvent ? 'is-raw-enabled' : '',
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
      // Stacked-menu guard: if a sibling row's menu was just closed by
      // outside-tap (this same gesture), don't immediately open ours.
      // The first tap dismisses; the user has to tap again to act.
      if (menuRecentlyClosedRef
          && (Date.now() - (menuRecentlyClosedRef.current || 0)) < 300) {
        return;
      }
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
      {(hasAssertions || verificationScore != null || showActions || showRawEvent) && (
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
            <>
            {/* Real backdrop (mobile bottom-sheet): a CSS ::before with
                pointer-events:none can't dismiss on iOS, where taps on
                non-interactive areas don't fire mouse events. This element
                captures the tap, closes the sheet, and marks the close so a
                sibling row's link doesn't immediately open a stacked sheet. */}
            <div
              className="bs-tag-row-overflow-backdrop"
              aria-hidden="true"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (menuRecentlyClosedRef) menuRecentlyClosedRef.current = Date.now();
                closeOverflow();
              }}
            />
            <div className="bs-tag-row-overflow-menu" role="menu">
              {scoresMarkup}
              {(hasAssertions || verificationScore != null) && (
                <p className="bs-tag-row-overflow-help">
                  {hasAssertions
                    ? <>Net = applications (+N) minus disputes (−N) under your point-of-view's web of trust.</>
                    : <>Verification Score is this candidate's WoT rank under your active point-of-view.</>}
                </p>
              )}
              {/* Story 2 / ADR 0002 D6 — Apply/Dispute stay left, Raw Event floats
                  to the right edge (AC-2). The button is deliberately OUTSIDE
                  renderActionsMarkup: that helper is shared with the inline row
                  (see below), where a button placed in it would become hover-only
                  AND break the reserved-width no-jiggle invariant. */}
              {(showActions || showRawEvent) && (
                <div className="bs-tag-row-overflow-actions">
                  {showActions && renderActionsMarkup(true)}
                  {showRawEvent && (
                    <button
                      type="button"
                      className="bs-tag-row-raw-btn"
                      aria-expanded={rawOpen}
                      onClick={() => {
                        if (!row.assertions?.length) {
                          // AC-5: report, don't open an empty panel that could be
                          // misread as "nobody asserted this".
                          setRawNotice('Raw Event unavailable');
                          closeOverflow();
                          return;
                        }
                        setRawNotice(null);
                        setRawOpen((o) => !o);
                        // ADR 0002 D4 — close at BOTH widths. Under 769px this menu
                        // is a position:fixed bottom sheet with a backdrop at
                        // inset:0, so staying open would sit on top of the very
                        // panel this click just opened. Deliberately the opposite of
                        // TagActionsMenu's stays-open convention, and deliberately
                        // the same as this component's own (Apply/Dispute already
                        // close via closeAfter). See the amended epic guardrail.
                        closeOverflow();
                      }}
                    >
                      {rawOpen ? 'Hide Raw Event' : 'Show Raw Event'}
                    </button>
                  )}
                </div>
              )}
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
            </>
          )}
        </div>
      )}

      {publishError && (
        <p className="bs-tag-row-error" role="alert">⚠️ {publishError}</p>
      )}

      {/* Story 2 / ADR 0002 D6 — the raw assertions, below this row's own content.
          LAST child of the <li>, after the publish-error line, so a transient error
          stays adjacent to the row rather than being pushed below a JSON blob. Both
          wrap onto their own line via flex-basis:100% (the .bs-tag-row-error
          precedent) — .bs-tag-row is display:flex; flex-wrap:wrap. */}
      {rawNotice && (
        <p className="bs-tag-row-error" role="alert">⚠️ {rawNotice}</p>
      )}
      {rawOpen && row.assertions?.length > 0 && (
        <section className="bs-tag-row-raw" aria-label={`Raw tagging events for ${displayLabel}`}>
          <TagRowRawEvents assertions={row.assertions} />
        </section>
      )}
    </li>
  );
}
