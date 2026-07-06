import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEventTags } from '../hooks/useEventTags';
import { useEventTagging } from '../hooks/useEventTagging';
import useTagApplicability from '../hooks/useTagApplicability';
import TagChip from './TagChip';
import AddTagDialog from './AddTagDialog';

/**
 * Story 6 — the event-tag affordance for a single kind-1 note. Rendered once
 * inside the shared NoteCard, so every note surface (feed, /event, /user/:pk/notes,
 * profile content) inherits it. Mirrors the profile (pubkey) ProfileTagsSection,
 * reusing TagChip + AddTagDialog. Reads via useEventTags; writes via the Story-5
 * useEventTagging hook (guarded/local-only — no publish path here). ADR 0006.
 *
 * The viewer's OWN stance comes from the durable `mine` channel (Story 7): a tag
 * the viewer applied shows (and is highlighted as theirs) even when the POV doesn't
 * count them — distinct from the POV-counted applications/disputes shown in the chip.
 */
export default function NoteTags({ item, showScores = false }) {
  const { user } = useAuth();
  const viewerPubkey = user?.pubkey || null;
  const { tags, mine, availableTags, error, refetch } = useEventTags(item?.id, viewerPubkey);
  // Type-aware picker (tag-applicability #2): event-context applicable tags, viewer-inclusive.
  const { applicableKeys, contextsByKey } = useTagApplicability('event', viewerPubkey);
  const { applyTag, disputeTag } = useEventTagging();

  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionError, setActionError] = useState(null);

  // The viewer's own stance per tag coordinate, from `mine` (durable, trust-unfiltered).
  const myStanceByCoord = useMemo(() => {
    const m = new Map();
    for (const s of mine) m.set(`${s.authorPubkey}:${s.slug}`, s);
    return m;
  }, [mine]);

  // Displayed = the POV-counted set UNION the viewer's own (mine-only) tags, so a
  // just-applied tag the POV doesn't count still appears (and survives reload).
  const displayedTags = useMemo(() => {
    const byCoord = new Map();
    for (const t of tags) byCoord.set(`${t.authorPubkey}:${t.slug}`, t);
    for (const s of mine) {
      const key = `${s.authorPubkey}:${s.slug}`;
      if (!byCoord.has(key)) {
        byCoord.set(key, {
          eventId: s.eventId, authorPubkey: s.authorPubkey, slug: s.slug,
          name: s.name, description: s.description, applications: [], disputes: [],
        });
      }
    }
    return Array.from(byCoord.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tags, mine]);

  const appliedTagEventIds = useMemo(
    () => new Set(displayedTags.map((t) => t.eventId)),
    [displayedTags]
  );

  // Run a write, surface partial-failure (the write hook returns { failedAt }),
  // then refetch so the durable `mine` channel re-establishes the viewer's stance.
  const run = useCallback(async (fn) => {
    if (busy) return undefined;
    setBusy(true);
    setActionError(null);
    try {
      const result = await fn();
      if (result && result.failedAt) {
        setActionError(`Tagging didn't fully complete (stopped at kind ${result.failedAt.kind}). You can retry — replaceable, so no duplicates.`);
      }
      refetch();
      return result;
    } catch (e) {
      setActionError(e?.message || String(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }, [busy, refetch]);

  const target = { id: item?.id };
  // Chip popover handlers swallow the re-thrown rejection — the section banner is
  // the single error surface (mirrors ProfileTagsSection).
  const handleApply = (tag) => run(() => applyTag({ authorPubkey: tag.authorPubkey, slug: tag.slug }, target)).catch(() => {});
  const handleDispute = (tag) => run(() => disputeTag({ authorPubkey: tag.authorPubkey, slug: tag.slug }, target)).catch(() => {});
  // Dialog handlers let the throw propagate so AddTagDialog keeps itself open with
  // an inline error on failure.
  const handleSelectExisting = (tag) => run(() => applyTag({ authorPubkey: tag.authorPubkey, slug: tag.slug }, target));
  const handleCreateNew = ({ name, description }) => run(() => applyTag({ name, description }, target));

  if (!item?.id) return null;

  const hasTags = displayedTags.length > 0;
  if (!hasTags && !viewerPubkey) return null; // nothing to show and nothing to add → no chrome

  return (
    <div className="bsp-note-tags" aria-label="Tags on this note">
      {error && <div className="bsp-note-tags-error">⚠️ {error}</div>}
      {actionError && <div className="bsp-note-tags-error">⚠️ {actionError}</div>}

      <div className="bsp-note-tags-row">
        {displayedTags.map((t) => {
          const s = myStanceByCoord.get(`${t.authorPubkey}:${t.slug}`);
          const myStance = s
            ? { authorPubkey: viewerPubkey, polarity: s.stance === 'apply' ? 1 : -1, eventId: s.eventId }
            : undefined;
          return (
            <TagChip
              key={t.eventId}
              tag={t}
              applications={t.applications}
              disputes={t.disputes}
              viewerPubkey={viewerPubkey}
              myStance={myStance}
              busy={busy}
              onApply={handleApply}
              onDispute={handleDispute}
              showScores={showScores}
            />
          );
        })}

        {viewerPubkey && (
          <button
            type="button"
            className="bsp-note-tags-add"
            onClick={() => setDialogOpen(true)}
            disabled={busy}
            aria-label="Add a tag to this note"
          >
            +
          </button>
        )}
      </div>

      {dialogOpen && (
        <AddTagDialog
          availableTags={availableTags}
          appliedTagEventIds={appliedTagEventIds}
          applicableKeys={applicableKeys}
          contextsByKey={contextsByKey}
          busy={busy}
          onClose={() => setDialogOpen(false)}
          onSelectExisting={handleSelectExisting}
          onCreateNew={handleCreateNew}
        />
      )}
    </div>
  );
}
