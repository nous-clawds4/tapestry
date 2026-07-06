import { useState, useMemo } from 'react';
import useProfileTags from '../hooks/useProfileTags';
import useTagApplicability from '../hooks/useTagApplicability';
import TagChip from './TagChip';
import AddTagDialog from './AddTagDialog';
import ManageTagsDialog from './ManageTagsDialog';

export default function ProfileTagsSection({ targetPubkey, viewerPubkey }) {
  // Type-aware picker (tag-applicability #2): pubkey-context applicable tags, viewer-inclusive.
  const { applicableKeys, contextsByKey } = useTagApplicability('pubkey', viewerPubkey);
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

  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null); // 'add' | 'manage' | null
  const [actionError, setActionError] = useState(null);

  const { displayedTags, appsByTagId, disputesByTagId, appliedTagEventIds } = useMemo(() => {
    const apps = new Map();
    const disp = new Map();
    for (const a of applications) {
      const arr = apps.get(a.tagEventId) || [];
      arr.push(a);
      apps.set(a.tagEventId, arr);
    }
    for (const d of disputes) {
      const arr = disp.get(d.tagEventId) || [];
      arr.push(d);
      disp.set(d.tagEventId, arr);
    }
    const tagIds = new Set([...apps.keys(), ...disp.keys()]);
    const tagsById = new Map(availableTags.map((t) => [t.eventId, t]));
    // Render only tags that have at least one application or dispute on this
    // profile. Order alphabetically by name for stability.
    const tagsToShow = [...tagIds]
      .map((id) => tagsById.get(id) || { eventId: id, slug: id.slice(0, 8), name: id.slice(0, 8), description: '' })
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      displayedTags: tagsToShow,
      appsByTagId: apps,
      disputesByTagId: disp,
      appliedTagEventIds: tagIds,
    };
  }, [availableTags, applications, disputes]);

  const myAssertions = useMemo(
    () => [...myApplications, ...myDisputes].sort((a, b) => b.createdAt - a.createdAt),
    [myApplications, myDisputes]
  );

  const wrap = async (fn) => {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err?.message || String(err));
      // Re-throw so callers that want to react (e.g. AddTagDialog keeping
      // itself open on failure) still see the error.
      throw err;
    } finally {
      setBusy(false);
    }
  };

  // Chip popover handlers: TagChip doesn't render a local error message, so
  // we swallow the re-thrown rejection here — the section-level actionError
  // banner is the single source of truth for these surfaces.
  const handleApply = (tag) => wrap(() => applyTag(tag)).catch(() => {});
  const handleDispute = (tag) => wrap(() => disputeTag(tag)).catch(() => {});
  // Dialog handlers: AddTagDialog and ManageTagsDialog both catch the
  // rejection and keep themselves open with an inline error on failure, so
  // we leave the throw to propagate.
  const handleSelectExisting = (tag) => wrap(() => applyTag(tag));
  const handleCreateNew = ({ name, description }) =>
    wrap(async () => {
      const created = await createTag({ name, description });
      await applyTag(created);
    });
  const handleRevoke = (eventId) => wrap(() => revoke(eventId));

  const isEmpty = !loading && displayedTags.length === 0;

  return (
    <section className="bsp-tags" aria-label="Tags on this profile">
      <div className="bsp-tags-head">
        <h3 className="bsp-tags-title">TAGS</h3>
        <button
          type="button"
          className="bsp-tags-manage"
          onClick={() => setDialog('manage')}
        >
          Manage
        </button>
      </div>

      {loading && <div className="bsp-tags-loading">Loading tags…</div>}
      {error && <div className="bsp-tags-error">⚠️ {error}</div>}
      {actionError && <div className="bsp-tags-error">⚠️ {actionError}</div>}

      {!loading && !error && (
        <div className="bsp-tags-row">
          {displayedTags.map((t) => (
            <TagChip
              key={t.eventId}
              tag={t}
              applications={appsByTagId.get(t.eventId) || []}
              disputes={disputesByTagId.get(t.eventId) || []}
              viewerPubkey={viewerPubkey}
              busy={busy}
              onApply={handleApply}
              onDispute={handleDispute}
            />
          ))}

          {isEmpty ? (
            <button
              type="button"
              className="bsp-tags-add bsp-tags-add-empty"
              onClick={() => setDialog('add')}
            >
              + Add the first tag
            </button>
          ) : (
            <button
              type="button"
              className="bsp-tags-add"
              onClick={() => setDialog('add')}
              aria-label="Add a tag"
            >
              +
            </button>
          )}
        </div>
      )}

      {dialog === 'add' && (
        <AddTagDialog
          availableTags={availableTags}
          appliedTagEventIds={appliedTagEventIds}
          applicableKeys={applicableKeys}
          contextsByKey={contextsByKey}
          busy={busy}
          onClose={() => setDialog(null)}
          onSelectExisting={handleSelectExisting}
          onCreateNew={handleCreateNew}
        />
      )}
      {dialog === 'manage' && (
        <ManageTagsDialog
          myAssertions={myAssertions}
          availableTags={availableTags}
          busy={busy}
          onClose={() => setDialog(null)}
          onRevoke={handleRevoke}
        />
      )}
    </section>
  );
}
