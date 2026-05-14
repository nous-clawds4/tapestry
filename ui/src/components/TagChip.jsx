import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

function shortPk(pk) {
  return pk ? `${pk.slice(0, 8)}…` : '';
}

function AsserterRow({ entry }) {
  // The hook surfaces { authorPubkey, ... }. We don't have profile metadata
  // here, so render the short pubkey as a fallback handle.
  return (
    <div className="ptc-asserter">
      <span className="ptc-asserter-avatar" aria-hidden="true">
        {(entry.authorPubkey || '?')[0].toUpperCase()}
      </span>
      <span className="ptc-asserter-name">{shortPk(entry.authorPubkey)}</span>
    </div>
  );
}

export default function TagChip({
  tag,
  applications,
  disputes,
  viewerPubkey,
  busy,
  onApply,
  onDispute,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const popoverId = `tag-popover-${tag.eventId.slice(0, 12)}`;

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

  const myAssertion = [...applications, ...disputes].find((a) => a.authorPubkey === viewerPubkey);
  const hasDisputes = disputes.length > 0;

  return (
    <span
      ref={containerRef}
      className="ptc"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        // Only close if focus is leaving the entire chip subtree
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
            <strong className="ptc-popover-name">{tag.name}</strong>
            {tag.description && <p className="ptc-popover-desc">{tag.description}</p>}
          </div>

          {applications.length > 0 && (
            <div className="ptc-section">
              <div className="ptc-section-label">Applied by {applications.length}</div>
              <div className="ptc-asserters">
                {applications.map((a) => (
                  <AsserterRow key={a.eventId} entry={a} />
                ))}
              </div>
            </div>
          )}

          {disputes.length > 0 && (
            <div className="ptc-section ptc-section-dispute">
              <div className="ptc-section-label">Disputed by {disputes.length}</div>
              <div className="ptc-asserters">
                {disputes.map((d) => (
                  <AsserterRow key={d.eventId} entry={d} />
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
