import { Link } from 'react-router-dom';
import NoteCard from './NoteCard';
import useProfileContent from '../hooks/useProfileContent';

/**
 * Story note-surfaces #2 / ADR note-surfaces/0002: the profile "Content" section.
 *
 * Front-end only. Appended as the LAST section of BrainstormProfile.jsx, it shows the viewed
 * user's single most-recent kind-1 note (the read path at limit 1) as one shared <NoteCard>,
 * an explicit empty state when none can be located, and a link to the full /user/:pubkey/notes
 * page. It adds no read logic — useUserNotes owns the fetch.
 *
 * Labelled "Content" (not "Notes") deliberately: the section may host other content kinds later
 * but is kind-1 only for now. The body is delegated to a PURE, named-exported renderContentBody
 * of { data, loading, error } — no fetch/hook/router/browser globals — so its states are an
 * isolated, sentinel-testable unit.
 */

// Operator-delegated copy (story #2). Punctuation is non-binding; meaning is exact.
export const CONTENT_COPY = {
  HEADING: 'Content',
  PINNED_LABEL: 'Pinned',
  NO_TOPLEVEL: 'No top-level notes to feature yet.',
  EMPTY: 'No kind-1 events could be located for this user.',
  VIEW_ALL: 'View all notes →',
  LOADING: 'Loading…',
};

export default function ProfileContentSection({ pubkey }) {
  const { data, loading, error } = useProfileContent(pubkey);

  return (
    <div className="bsp-section bsp-content-section">
      <h3>{CONTENT_COPY.HEADING}</h3>
      {renderContentBody({ data, loading, error })}
      <Link to={`/user/${pubkey}/notes`} className="bsp-content-viewall">{CONTENT_COPY.VIEW_ALL}</Link>
    </div>
  );
}

/**
 * Pure state→view mapping for the Content section. A function only of its args. Renders the
 * single selected note (data.item — pinned or latest top-level, feed-usability #3) on OK, with
 * a "Pinned" badge when it was chosen from the user's pin list; an explicit "no top-level notes
 * to feature" message on NO_TOPLEVEL; the operator-delegated "no kind-1 events could be located"
 * message on EMPTY / a transport failure / an unknown status. Never a card on an error, never a
 * raw error. Defined last so it stays a pure function of its args.
 */
export function renderContentBody({ data, loading, error }) {
  if (loading && !data) {
    return <div className="bsp-content-loading">{CONTENT_COPY.LOADING}</div>;
  }
  if (!error && data && data.status === 'OK' && data.item) {
    return (
      <>
        {data.pinned && <div className="bsp-content-pinned">{CONTENT_COPY.PINNED_LABEL}</div>}
        <NoteCard item={data.item} />
      </>
    );
  }
  if (!error && data && data.status === 'NO_TOPLEVEL') {
    return <div className="bsp-empty">{CONTENT_COPY.NO_TOPLEVEL}</div>;
  }
  return <div className="bsp-empty">{CONTENT_COPY.EMPTY}</div>;
}
