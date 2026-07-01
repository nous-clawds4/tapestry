import { useNotesByAuthor } from '../hooks/useNotesByAuthor';
import NoteCard from './NoteCard';

/**
 * Story 14 — the notes this person has tagged, on their profile (alongside the
 * profiles-side AuthoredTaggingSection, which is unchanged). Each note renders via
 * the shared NoteCard, prefixed by the tag(s) they applied. Reads notes-by-author.
 */
export default function AuthoredNotesSection({ profilePubkey, viewerPubkey }) {
  const { notes, loading, error } = useNotesByAuthor(profilePubkey, viewerPubkey);

  if (loading) {
    return <section className="bsp-authored-notes"><h3 className="bsp-authored-notes-title">NOTES TAGGED</h3><p className="bsp-authored-loading">Loading…</p></section>;
  }
  if (error) {
    return <section className="bsp-authored-notes"><h3 className="bsp-authored-notes-title">NOTES TAGGED</h3><p className="bsp-authored-error">⚠️ {error}</p></section>;
  }
  if (!notes.length) return null; // tagged no notes → no chrome

  return (
    <section className="bsp-authored-notes" aria-label="Notes this person has tagged">
      <h3 className="bsp-authored-notes-title">NOTES TAGGED</h3>
      <ul className="bsp-authored-notes-list">
        {notes.map((n) => (
          <li key={n.id} className="bsp-authored-notes-item">
            {n.taggedWith?.length > 0 && (
              <div className="bsp-authored-notes-tags">
                {n.taggedWith.map((tw, i) => (
                  <span key={`${tw.authorPubkey}:${tw.slug}:${i}`} className={`bsp-authored-notes-tag ${tw.stance === 'dispute' ? 'is-dispute' : 'is-apply'}`}>
                    {tw.stance === 'dispute' ? '−' : '+'} {tw.slug}
                  </span>
                ))}
              </div>
            )}
            <NoteCard item={n} />
          </li>
        ))}
      </ul>
    </section>
  );
}
