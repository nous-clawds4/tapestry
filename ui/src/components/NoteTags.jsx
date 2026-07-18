import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useEventTags } from '../hooks/useEventTags';
import { useEventTagging } from '../hooks/useEventTagging';
import useTagApplicability from '../hooks/useTagApplicability';
import TagChip from './TagChip';
import AddTagDialog from './AddTagDialog';
import PovStatusNotice from './PovStatusNotice';
import RawTaggingEvents from './RawTaggingEvents';

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
  const { tags, mine, rawEvents, availableTags, povResolution, error, refetch } = useEventTags(item?.id, viewerPubkey);
  // Type-aware picker (tag-applicability #2): event-context applicable tags, viewer-inclusive.
  const { applicableKeys, contextsByKey } = useTagApplicability('event', viewerPubkey);
  const { applyTag, disputeTag } = useEventTagging();

  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionError, setActionError] = useState(null);
  // Story 3 / ADR 0003 D4 — which chips' raw-events panels are open, keyed by
  // the STABLE tag coordinate `${authorPubkey}:${slug}` (t.eventId can be a
  // synthesized fallback for mine-only chips, so it is not the key). Per-instance
  // state ⇒ per-note isolation and multi-open stacking for free. The notices map
  // carries AC-4's visible per-chip message when a panel cannot be produced.
  const [openRaw, setOpenRaw] = useState(() => new Set());
  const [rawNotices, setRawNotices] = useState({});

  // The viewer's own stance per tag coordinate, from `mine` (durable, trust-unfiltered).
  const myStanceByCoord = useMemo(() => {
    const m = new Map();
    for (const s of mine) m.set(`${s.authorPubkey}:${s.slug}`, s);
    return m;
  }, [mine]);

  // tag-event-inspector #3 / ADR 0003 D3. The evidence blocks behind one chip,
  // composed from the SAME arrays the popover's numbers are the lengths of —
  // count-back is structural. `counted` = which server channel the entry rode
  // in on (applications/disputes = this POV's counted verdict; mine-and-not-
  // counted = the viewer-union), never re-derived from event bytes.
  const rawBlocksFor = (t) => {
    const entries = [
      ...t.applications.map((e) => ({ polarity: 'apply', counted: true, id: e.eventId })),
      ...t.disputes.map((e) => ({ polarity: 'dispute', counted: true, id: e.eventId })),
    ];
    const s = myStanceByCoord.get(`${t.authorPubkey}:${t.slug}`);
    if (s && !entries.some((b) => b.id === s.mineEventId)) {
      entries.push({ polarity: s.stance, counted: false, id: s.mineEventId });
    }
    const blocks = entries.map((b) => ({ polarity: b.polarity, counted: b.counted, event: rawEvents[b.id] }));
    if (!blocks.length || blocks.some((b) => !b.event)) return null; // AC-4: all-or-nothing per chip
    return blocks.sort((a, b) =>
      (a.polarity === b.polarity ? 0 : a.polarity === 'apply' ? -1 : 1)
      || (b.event.created_at - a.event.created_at)
      || a.event.id.localeCompare(b.event.id));
  };

  // Toggle one chip's panel. Unproducible (rawBlocksFor → null) ⇒ set that
  // coordinate's visible notice instead of opening anything (AC-4, D6); a later
  // successful toggle clears it. Coordinate in, coordinate out — toggling one
  // chip cannot touch another chip or note.
  const toggleRaw = (t) => {
    const coord = `${t.authorPubkey}:${t.slug}`;
    if (!rawBlocksFor(t)) {
      setRawNotices((n) => ({ ...n, [coord]: 'Raw tagging events unavailable' }));
      return;
    }
    setRawNotices((n) => {
      if (!n[coord]) return n;
      const next = { ...n };
      delete next[coord];
      return next;
    });
    setOpenRaw((prev) => {
      const next = new Set(prev);
      if (next.has(coord)) next.delete(coord); else next.add(coord);
      return next;
    });
  };

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

  // Keyed the same way AddTagDialog resolves "already applied" (coordinate when
  // present, else eventId) so the shared dialog treats note tags correctly.
  const appliedTagKeys = useMemo(
    () => new Set(displayedTags.map((t) => t.tagAddress || t.eventId)),
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

      {/* Disclose a degraded POV only when the card shows counted tags, or when
          the selected POV has no computed scores here (silent-emptiness per card,
          ADR 0002) — so unfiltered dev feeds don't spam every untagged note. */}
      {(tags.length > 0 || povResolution?.mode === 'not-computed') && (
        <PovStatusNotice status={povResolution} variant="compact" />
      )}

      {/* Story 3 / ADR 0003 D4 — the raw-events panels: inside the note card,
          below the note's content, above the chips row (AC-2's mandated slot).
          displayedTags IS the chips' display order, so stacked panels are
          ordered by construction. */}
      {displayedTags.filter(t => openRaw.has(`${t.authorPubkey}:${t.slug}`)).map((t) => {
        const blocks = rawBlocksFor(t);
        if (!blocks) return null;
        return (
          <section
            key={`raw-${t.authorPubkey}:${t.slug}`}
            className="bsp-note-tags-raw"
            aria-label={`Raw tagging events for ${t.name}`}
          >
            <p className="bsp-note-tags-raw-caption">Raw tagging events — {t.name}</p>
            <RawTaggingEvents assertions={blocks} />
          </section>
        );
      })}

      <div className="bsp-note-tags-row">
        {displayedTags.map((t) => {
          const coord = `${t.authorPubkey}:${t.slug}`;
          const s = myStanceByCoord.get(coord);
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
              rawOpen={openRaw.has(coord)}
              onToggleRaw={() => toggleRaw(t)}
              rawNotice={rawNotices[coord]}
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
          appliedTagKeys={appliedTagKeys}
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
