import { useEffect, useState } from 'react';

export default function ManageTagsDialog({
  myAssertions,
  availableTags,
  busy,
  onClose,
  onRevoke,
}) {
  const [error, setError] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Consume-by-#a (ADR profile-tag-hardening/0001): resolve each assertion's
  // tag by its stable coordinate (tagAddress) first, so a tag applied through a
  // now-replaced version still shows its name; fall back to the event-id.
  const byAddress = new Map();
  const byEventId = new Map();
  for (const t of availableTags) {
    if (t.tagAddress) byAddress.set(t.tagAddress, t);
    byEventId.set(t.eventId, t);
  }

  const handleRevoke = async (eventId) => {
    setError(null);
    try {
      await onRevoke(eventId);
    } catch (err) {
      setError(err.message || String(err));
    }
  };

  return (
    <div className="ptd-backdrop" onMouseDown={onClose}>
      <div
        className="ptd"
        role="dialog"
        aria-label="Manage your tags on this profile"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ptd-head">
          <h3 className="ptd-title">Manage your tags</h3>
          <button type="button" className="ptd-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error && <div className="ptd-error">⚠️ {error}</div>}

        {myAssertions.length === 0 ? (
          <div className="ptd-empty">You haven't applied or disputed any tags on this profile.</div>
        ) : (
          <ul className="ptd-mine">
            {myAssertions.map((a) => {
              const tag = (a.tagAddress && byAddress.get(a.tagAddress)) || byEventId.get(a.tagEventId);
              const label = tag ? tag.name : `${(a.tagAddress || a.tagEventId || '').slice(0, 12)}…`;
              const polarityLabel = a.polarity > 0 ? 'Applied' : 'Disputed';
              return (
                <li key={a.eventId} className="ptd-mine-row">
                  <span className="ptd-mine-label">
                    <strong>{polarityLabel}:</strong> {label}
                  </span>
                  <button
                    type="button"
                    className="ptd-btn ptd-btn-revoke"
                    disabled={busy}
                    onClick={() => handleRevoke(a.eventId)}
                  >
                    Revoke
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
