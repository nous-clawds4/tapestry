import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import useProfiles from '../hooks/useProfiles';

function shortPk(pk) {
  return pk ? `${pk.slice(0, 8)}…` : '';
}

function AsserterRow({ entry, profile }) {
  const displayName = profile?.display_name || profile?.name || shortPk(entry.authorPubkey);
  const picture = profile?.picture;
  const initial = (displayName || '?')[0].toUpperCase();
  return (
    <Link
      to={`/user/${entry.authorPubkey}`}
      className="ptc-asserter ptc-asserter-link"
      title={displayName}
    >
      {picture ? (
        <img
          className="ptc-asserter-avatar ptc-asserter-avatar-img"
          src={picture}
          alt=""
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <span className="ptc-asserter-avatar" aria-hidden="true">{initial}</span>
      )}
      <span className="ptc-asserter-name">{displayName}</span>
    </Link>
  );
}

export default function TagChip({
  tag,
  applications,
  disputes,
  viewerPubkey,
  myStance, // optional: the viewer's own stance from a SEPARATE source (event-tagging
            // `mine`, Story 7) — drives the chip highlight without inflating the
            // community applications/disputes count. Absent → derived from the arrays
            // (profile-tagging behavior, unchanged).
  busy,
  onApply,
  onDispute,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const popoverId = `tag-popover-${tag.eventId.slice(0, 12)}`;

  // Asserter pubkeys for kind-0 enrichment. useProfiles batches + caches so
  // re-rendering with the same set is a no-op.
  const asserterPubkeys = useMemo(
    () => Array.from(new Set([...applications, ...disputes].map((a) => a.authorPubkey))),
    [applications, disputes]
  );
  const asserterProfiles = useProfiles(asserterPubkeys);

  const closeIfOutside = useCallback((e) => {
    if (containerRef.current && !containerRef.current.contains(e.target)) {
      setOpen(false);
    }
  }, []);

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('mousedown', closeIfOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', closeIfOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, closeIfOutside, handleKey]);

  const myAssertion = myStance || [...applications, ...disputes].find((a) => a.authorPubkey === viewerPubkey);
  const hasDisputes = disputes.length > 0;

  // Popover persistence (Story 6 AC-1): the popover opens on hover/focus and
  // stays open while the cursor moves chip→popover (the bug the story
  // exists to fix). The CSS hover-bridge (.ptc-popover::before) covers the
  // visual gap so mouseleave doesn't fire mid-traversal. mouseleave still
  // closes when the cursor genuinely leaves the chip+popover subtree —
  // otherwise hovering multiple chips in a row would stack their popovers.
  return (
    <span
      ref={containerRef}
      className="ptc"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        // Only close if focus is leaving the entire chip subtree (popover
        // included).
        if (!containerRef.current?.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <Link
        to={`/tag/${encodeURIComponent(tag.slug)}/${tag.eventId}`}
        className={`ptc-chip ${myAssertion ? `ptc-chip-mine-${myAssertion.polarity > 0 ? 'apply' : 'dispute'}` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
      >
        <span className="ptc-name">{tag.name}</span>
        {hasDisputes && (
          <span className="ptc-warn" aria-label={`${disputes.length} dispute${disputes.length === 1 ? '' : 's'}`}>
            !
          </span>
        )}
      </Link>

      {open && (
        <div className="ptc-popover" role="dialog" id={popoverId} aria-label={`Tag: ${tag.name}`}>
          <div className="ptc-popover-head">
            {/* Tag name is a link to the tag's detail page (opens in a new
                tab). Discoverability fix: users were not realizing the chip
                itself navigates; the underlined link + open-in-new-tab icon
                makes the affordance explicit. */}
            <a
              href={`/tag/${encodeURIComponent(tag.slug)}/${tag.eventId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ptc-popover-name-link"
            >
              <strong className="ptc-popover-name">{tag.name}</strong>
              <span className="ptc-popover-name-icon" aria-hidden="true">↗</span>
            </a>
            {tag.description && <p className="ptc-popover-desc">{tag.description}</p>}
          </div>

          {applications.length > 0 && (
            <div className="ptc-section">
              <div className="ptc-section-label">Applied by {applications.length}</div>
              <div className="ptc-asserters">
                {applications.map((a) => (
                  <AsserterRow key={a.eventId} entry={a} profile={asserterProfiles[a.authorPubkey]} />
                ))}
              </div>
            </div>
          )}

          {disputes.length > 0 && (
            <div className="ptc-section ptc-section-dispute">
              <div className="ptc-section-label">Disputed by {disputes.length}</div>
              <div className="ptc-asserters">
                {disputes.map((d) => (
                  <AsserterRow key={d.eventId} entry={d} profile={asserterProfiles[d.authorPubkey]} />
                ))}
              </div>
            </div>
          )}

          <div className="ptc-popover-actions">
            <button
              type="button"
              className="ptc-btn ptc-btn-apply"
              disabled={busy || !viewerPubkey}
              onClick={(e) => { e.preventDefault(); onApply(tag); }}
            >
              + Apply
            </button>
            <button
              type="button"
              className="ptc-btn ptc-btn-dispute"
              disabled={busy || !viewerPubkey}
              onClick={(e) => { e.preventDefault(); onDispute(tag); }}
            >
              Dispute
            </button>
          </div>

          {!viewerPubkey && (
            <div className="ptc-hint">Log in via NIP-07 to apply or dispute.</div>
          )}
        </div>
      )}
    </span>
  );
}
