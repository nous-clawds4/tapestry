import { useState, useMemo } from 'react';
import { useNotesForTag } from '../hooks/useNotesForTag';
import { useAuth } from '../context/AuthContext';
import TagViewControls from './TagViewControls';
import TagANoteModal from './TagANoteModal';
import NoteCard from './NoteCard';

/**
 * Story 8 — the "Notes" view of a tag's detail page: the kind-1 notes tagged with
 * this tag, rendered via the shared NoteCard (so each note carries the Story-6
 * tagging affordance). Reads `/api/event-tags/for-tag`. ADR 0008.
 *
 * Story 15 — this tab now uses the SAME control as the Profiles tab
 * (`TagViewControls`): same "View options" disclosure, same curated-default vs
 * expanded behavior, same text filter, and full sort parity (recent / applied /
 * disputed / divisive). Sorting is server-side over the whole tagged set (a
 * `sort` param on for-tag), so non-recency sorts aren't limited to the
 * recency-capped page. The "+ Tag someone" button is Profiles-only here
 * (`hidePrimary`); the Notes-tab "+ Tag a Note" arrives in Story 16.
 */
const NOTE_SORT_OPTIONS = [
  { key: 'recent', label: 'Most recent' },
  { key: 'applied', label: 'Most applied' },
  { key: 'disputed', label: 'Most disputed' },
  { key: 'divisive', label: 'Most divisive' },
];

function noteMatchesFilter(note, text) {
  if (!text) return true;
  const needle = text.trim().toLowerCase();
  if (!needle) return true;
  const fields = [note.content, note.author?.displayName, note.author?.name];
  for (const f of fields) {
    if (f && String(f).toLowerCase().includes(needle)) return true;
  }
  return false;
}

export default function TagNotesView({ tag, viewerPubkey }) {
  const { user, login } = useAuth();
  const [sort, setSort] = useState('recent');
  const [expanded, setExpanded] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [tagANoteOpen, setTagANoteOpen] = useState(false);
  const { notes, total, truncated, loading, error, refetch } = useNotesForTag(
    tag?.authorPubkey, tag?.slug, viewerPubkey, sort,
  );

  // Story 16 — "+ Tag a Note" mirrors Profiles' "+ Tag someone": gate the click
  // through login when logged out, else open the Event-ID modal.
  const handleTagANoteClick = async () => {
    if (!user) { try { await login(); } catch { /* user dismissed */ } return; }
    setTagANoteOpen(true);
  };

  // Text filter → curated filter (when collapsed) → displayed notes. Mirrors
  // Tag.jsx's `displayedRows` for Profiles: curated keeps net-endorsed notes
  // (applications > disputes) plus the viewer's own (the `mine` durability
  // principle — a note you tagged is never hidden). Ordering comes from the
  // server (the chosen sort); no client-side re-sort.
  const shown = useMemo(() => {
    const byText = filterText ? notes.filter((n) => noteMatchesFilter(n, filterText)) : notes;
    if (expanded) return byText;
    return byText.filter((n) => ((n.applications || 0) - (n.disputes || 0)) >= 1 || !!n.mine);
  }, [notes, filterText, expanded]);

  return (
    <>
      <TagViewControls
        sort={sort}
        onSortChange={setSort}
        expanded={expanded}
        onToggleExpand={setExpanded}
        filterText={filterText}
        onFilterChange={setFilterText}
        signedIn={!!user}
        onPrimaryClick={handleTagANoteClick}
        primaryLabel="➕ Tag a Note"
        primaryLabelSignedOut="🔒 Sign in to tag a note"
        primaryAriaLabel="Tag a note"
        primaryAriaLabelSignedOut="Sign in to tag a note"
        sortOptions={NOTE_SORT_OPTIONS}
        sortAriaLabel="Sort tagged notes"
        filterPlaceholder="Filter these notes…"
        filterAriaLabel="Filter the list of tagged notes"
      />

      {loading ? (
        <p className="bs-tag-loading">Loading notes…</p>
      ) : error ? (
        <p className="bs-tag-error">⚠️ {error}</p>
      ) : (
        <>
          {truncated && (
            <p className="bs-tag-notes-truncation">
              Showing the top {notes.length} of {total} tagged notes.
            </p>
          )}

          {notes.length === 0 ? (
            <p className="bs-tag-empty">
              No notes have been tagged with <strong>{tag?.name || tag?.slug}</strong> yet.
            </p>
          ) : shown.length === 0 ? (
            <p className="bs-tag-empty">
              {filterText
                ? `No tagged notes match "${filterText}".`
                : 'No notes meet the Curated threshold yet. Open View options to see all tagged notes.'}
            </p>
          ) : (
            <ul className="bs-tag-notes-list">
              {shown.map((n) => (
                <li key={n.id} className="bs-tag-notes-item">
                  <NoteCard item={n} showTagScores={expanded} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <TagANoteModal
        open={tagANoteOpen}
        onClose={() => setTagANoteOpen(false)}
        tag={tag}
        viewerPubkey={user?.pubkey || null}
        onTagged={refetch}
      />
    </>
  );
}
