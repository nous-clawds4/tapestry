import { useNotesForTag } from '../hooks/useNotesForTag';
import NoteCard from './NoteCard';

/**
 * Story 8 — the "Notes" view of a tag's detail page: the kind-1 notes tagged with
 * this tag, rendered via the shared NoteCard (so each note carries the Story-6
 * tagging affordance). Reads `/api/event-tags/for-tag`. ADR 0008.
 */
export default function TagNotesView({ tag, viewerPubkey }) {
  const { notes, total, truncated, loading, error } = useNotesForTag(tag?.authorPubkey, tag?.slug, viewerPubkey);

  if (loading) return <p className="bs-tag-loading">Loading notes…</p>;
  if (error) return <p className="bs-tag-error">⚠️ {error}</p>;
  if (!notes.length) {
    return (
      <p className="bs-tag-empty">
        No notes have been tagged with <strong>{tag?.name || tag?.slug}</strong> yet.
      </p>
    );
  }

  return (
    <>
      {truncated && (
        <p className="bs-tag-notes-truncation">
          Showing the {notes.length} most recently tagged of {total} notes.
        </p>
      )}
      <ul className="bs-tag-notes-list">
        {notes.map((n) => (
          <li key={n.id} className="bs-tag-notes-item">
            <NoteCard item={n} />
          </li>
        ))}
      </ul>
    </>
  );
}
