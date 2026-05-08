import { useState, useMemo } from 'react';
import useProfileTags from '../hooks/useProfileTags';

export default function ProfileTagPanel({ targetPubkey, viewerPubkey }) {
  const {
    availableTags,
    applications,
    disputes,
    myApplications,
    myDisputes,
    loading,
    error,
    applyTag,
    disputeTag,
    createTag,
    revoke,
  } = useProfileTags(targetPubkey, viewerPubkey);

  const [view, setView] = useState('apply');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { appsByTagId, disputesByTagId } = useMemo(() => {
    const a = new Map();
    const d = new Map();
    for (const app of applications) {
      const arr = a.get(app.tagEventId) || [];
      arr.push(app);
      a.set(app.tagEventId, arr);
    }
    for (const dis of disputes) {
      const arr = d.get(dis.tagEventId) || [];
      arr.push(dis);
      d.set(dis.tagEventId, arr);
    }
    return { appsByTagId: a, disputesByTagId: d };
  }, [applications, disputes]);

  const handleAction = async (fn) => {
    if (busy) return;
    setBusy(true);
    setLocalError(null);
    try {
      await fn();
    } catch (err) {
      setLocalError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="ptp-loading">Loading tags…</div>;
  if (error) return <div className="ptp-error">⚠️ {error}</div>;

  const myAssertions = [...myApplications, ...myDisputes].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="ptp">
      <div className="ptp-tabs" role="tablist">
        <button
          type="button"
          className={view === 'apply' ? 'ptp-tab ptp-tab-active' : 'ptp-tab'}
          onClick={() => setView('apply')}
        >
          Apply or Dispute
        </button>
        <button
          type="button"
          className={view === 'create' ? 'ptp-tab ptp-tab-active' : 'ptp-tab'}
          onClick={() => setView('create')}
        >
          Create new tag
        </button>
        <button
          type="button"
          className={view === 'manage' ? 'ptp-tab ptp-tab-active' : 'ptp-tab'}
          onClick={() => setView('manage')}
        >
          Manage
        </button>
      </div>

      {!viewerPubkey && (
        <div className="ptp-hint">Log in via NIP-07 to apply, dispute, or revoke tags.</div>
      )}
      {localError && <div className="ptp-error">⚠️ {localError}</div>}

      {view === 'apply' && (
        <div className="ptp-list">
          {availableTags.length === 0 ? (
            <div className="ptp-empty">No tags published yet. Switch to "Create new tag" to add one.</div>
          ) : (
            availableTags.map((t) => {
              const apps = appsByTagId.get(t.eventId) || [];
              const disps = disputesByTagId.get(t.eventId) || [];
              return (
                <div key={t.eventId} className="ptp-row">
                  <div className="ptp-row-meta">
                    <strong className="ptp-row-name">{t.name}</strong>
                    {t.description && <span className="ptp-row-desc"> — {t.description}</span>}
                    <div className="ptp-row-counts">
                      Applied by {apps.length} · Disputed by {disps.length}
                    </div>
                  </div>
                  <div className="ptp-row-actions">
                    <button
                      type="button"
                      className="ptp-btn ptp-btn-apply"
                      disabled={busy || !viewerPubkey}
                      onClick={() => handleAction(() => applyTag(t))}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      className="ptp-btn ptp-btn-dispute"
                      disabled={busy || !viewerPubkey}
                      onClick={() => handleAction(() => disputeTag(t))}
                    >
                      Dispute
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {view === 'create' && (
        <div className="ptp-create">
          <label className="ptp-field">
            <span className="ptp-field-label">Name (required)</span>
            <input
              className="ptp-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Verified Human"
            />
          </label>
          <label className="ptp-field">
            <span className="ptp-field-label">Description (optional)</span>
            <textarea
              className="ptp-textarea"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              placeholder="What does this tag mean? When should it apply?"
            />
          </label>
          <button
            type="button"
            className="ptp-btn ptp-btn-create"
            disabled={busy || !viewerPubkey || !newName.trim()}
            onClick={() =>
              handleAction(async () => {
                await createTag({ name: newName.trim(), description: newDesc.trim() });
                setNewName('');
                setNewDesc('');
                setView('apply');
              })
            }
          >
            Create tag
          </button>
        </div>
      )}

      {view === 'manage' && (
        <div className="ptp-manage">
          {myAssertions.length === 0 ? (
            <div className="ptp-empty">You haven't applied or disputed any tags on this profile.</div>
          ) : (
            myAssertions.map((a) => {
              const tag = availableTags.find((t) => t.eventId === a.tagEventId);
              const label = tag ? tag.name : `${a.tagEventId.slice(0, 12)}…`;
              const polarityLabel = a.polarity > 0 ? 'Applied' : 'Disputed';
              return (
                <div key={a.eventId} className="ptp-manage-row">
                  <span className="ptp-manage-label">
                    <strong>{polarityLabel}:</strong> {label}
                  </span>
                  <button
                    type="button"
                    className="ptp-btn ptp-btn-revoke"
                    disabled={busy}
                    onClick={() => handleAction(() => revoke(a.eventId))}
                  >
                    Revoke
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
