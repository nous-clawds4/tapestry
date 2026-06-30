import { useState, useMemo } from 'react';
import { useNotesForTag } from '../hooks/useNotesForTag';
import NoteCard from './NoteCard';

/**
 * Story 8 — the "Notes" view of a tag's detail page: the kind-1 notes tagged with
 * this tag, rendered via the shared NoteCard (so each note carries the Story-6
 * tagging affordance). Reads `/api/event-tags/for-tag`. ADR 0008.
 *
 * Mirrors the profiles view's View-options pattern (Tag.jsx): the CURATED default
 * (collapsed) shows only net-endorsed notes (applications > disputes) plus the
 * viewer's own; EXPANDED shows every tagged note with a sort control.
 */
export default function TagNotesView({ tag, viewerPubkey }) {
  const { notes, total, truncated, loading, error } = useNotesForTag(tag?.authorPubkey, tag?.slug, viewerPubkey);
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState('recent'); // 'recent' | 'applied'

  const shown = useMemo(() => {
    // Curated default: net-endorsed (applications > disputes) OR the viewer's own
    // (so a note you tagged is never hidden — the `mine` durability principle).
    let list = expanded
      ? notes
      : notes.filter((n) => ((n.applications || 0) - (n.disputes || 0)) >= 1 || !!n.mine);
    list = [...list].sort(
      sort === 'applied'
        ? (a, b) => (b.applications || 0) - (a.applications || 0)
        : (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
    return list;
  }, [notes, expanded, sort]);

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
      <div className="bs-tag-notes-controls">
        <button
          type="button"
          className="bs-tag-notes-viewopts"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? '▾ View options' : '▸ View options'}
        </button>
        {expanded && (
          <div className="bs-tag-notes-sort" role="group" aria-label="Sort notes">
            <button type="button" className={sort === 'recent' ? 'is-active' : ''} onClick={() => setSort('recent')}>Recent</button>
            <button type="button" className={sort === 'applied' ? 'is-active' : ''} onClick={() => setSort('applied')}>Most applied</button>
          </div>
        )}
      </div>

      {truncated && (
        <p className="bs-tag-notes-truncation">
          Showing the {notes.length} most recently tagged of {total} notes.
        </p>
      )}

      {shown.length === 0 ? (
        <p className="bs-tag-empty">
          No notes meet the Curated threshold yet. Open <strong>View options</strong> to see all tagged notes.
        </p>
      ) : (
        <ul className="bs-tag-notes-list">
          {shown.map((n) => (
            <li key={n.id} className="bs-tag-notes-item">
              <NoteCard item={n} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
