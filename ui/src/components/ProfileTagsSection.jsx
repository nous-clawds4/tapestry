import { useState, useMemo } from 'react';
import useProfileTags from '../hooks/useProfileTags';
import useTagApplicability from '../hooks/useTagApplicability';
import TagChip from './TagChip';
import AddTagDialog from './AddTagDialog';
import ManageTagsDialog from './ManageTagsDialog';
import PovStatusNotice from './PovStatusNotice';

export default function ProfileTagsSection({ targetPubkey, viewerPubkey }) {
  // Type-aware picker (tag-applicability #2): pubkey-context applicable tags, viewer-inclusive.
  const { applicableKeys, contextsByKey } = useTagApplicability('pubkey', viewerPubkey);
  const {
    availableTags,
    applications,
    disputes,
    povResolution,
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

  const { displayedTags, appsByTagId, disputesByTagId, appliedTagKeys } = useMemo(() => {
    // Consume-by-#a (ADR profile-tag-hardening/0001): group taggings by the
    // tag's STABLE coordinate (tagAddress), not the fragile applied-version
    // event-id — so two event-ids of the same tag collapse onto one chip.
    const byAddress = new Map();
    const byEventId = new Map();
    for (const t of availableTags) {
      if (t.tagAddress) byAddress.set(t.tagAddress, t);
      byEventId.set(t.eventId, t);
    }
    // Resolve an assertion to its canonical tag + grouping key. Prefer the
    // assertion's own coordinate; fall back to its (legacy) event-id. When the
    // tag is unknown, fall back to a per-assertion key + truncated-id render.
    const resolve = (a) => {
      const tag = (a.tagAddress && byAddress.get(a.tagAddress)) || byEventId.get(a.tagEventId) || null;
      const key = tag ? (tag.tagAddress || tag.eventId) : (a.tagAddress || a.tagEventId);
      return { key, tag };
    };
    const apps = new Map();
    const disp = new Map();
    const tagByKey = new Map();
    const record = (map, a) => {
      const { key, tag } = resolve(a);
      if (!key) return;
      const arr = map.get(key) || [];
      arr.push(a);
      map.set(key, arr);
      if (!tagByKey.has(key)) {
        tagByKey.set(
          key,
          tag || { eventId: a.tagEventId || key, slug: key.slice(0, 8), name: key.slice(0, 8), description: '' }
        );
      }
    };
    for (const a of applications) record(apps, a);
    for (const d of disputes) record(disp, d);
    const keys = new Set([...apps.keys(), ...disp.keys()]);
    // Render only tags that have at least one application or dispute on this
    // profile. Order alphabetically by name for stability.
    const tagsToShow = [...keys]
      .map((key) => ({ key, tag: tagByKey.get(key) }))
      .sort((a, b) => a.tag.name.localeCompare(b.tag.name));
    return {
      displayedTags: tagsToShow,
      appsByTagId: apps,
      disputesByTagId: disp,
      appliedTagKeys: keys,
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

      {!loading && !error && <PovStatusNotice status={povResolution} variant="compact" />}

      {!loading && !error && (
        <div className="bsp-tags-row">
          {displayedTags.map(({ key, tag }) => (
            <TagChip
              key={key}
              tag={tag}
              applications={appsByTagId.get(key) || []}
              disputes={disputesByTagId.get(key) || []}
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
          appliedTagKeys={appliedTagKeys}
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
