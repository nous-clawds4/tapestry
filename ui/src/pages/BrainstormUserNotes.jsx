import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu from '../components/BrainstormUserMenu';
import NoteCard from '../components/NoteCard';
import useUserNotes from '../hooks/useUserNotes';

/**
 * Story note-surfaces #3 / ADR note-surfaces/0002: the public per-user notes page
 * (/user/:pubkey/notes), a sibling of /user/:pubkey/follows.
 *
 * Front-end only. It renders the by-author read path's output (ADR 0001) at limit 50 as a list
 * of shared <NoteCard>s, newest-first (array order — it does NOT re-sort), with a back link, a
 * heading naming whose notes these are, and an empty state. It adds no read logic — useUserNotes
 * owns the fetch. Modeled on BrainstormFollows.jsx's public shell. The body is delegated to a
 * PURE, named-exported renderUserNotesState of { data, loading, error }.
 */

// Operator-delegated copy (story #3). Punctuation is non-binding; meaning is exact.
export const NOTES_COPY = {
  HEADING: 'Notes',
  INDICATOR: 'Showing the most recent 50 notes.',
  EMPTY: 'No kind-1 events could be located for this user.',
  LOADING: 'Loading notes…',
};

function shortNpub(pubkey) {
  try { return nip19.npubEncode(pubkey).slice(0, 12) + '…'; }
  catch { return pubkey ? `${pubkey.slice(0, 10)}…` : '—'; }
}

export default function BrainstormUserNotes() {
  const { pubkey } = useParams();
  const { user, login, logout } = useAuth();
  const { data, loading, error } = useUserNotes(pubkey, 50);

  // Subject display name for the header — so the page identifies WHOSE notes even when empty
  // (the /api/profiles?pubkeys= convention from BrainstormProfile.jsx). Falls back to a short npub.
  const [subjectName, setSubjectName] = useState(null);
  useEffect(() => {
    if (!pubkey) return;
    let cancelled = false;
    setSubjectName(null); // clear the prior user's name on a param-only navigation (A/notes → B/notes)
    fetch(`/api/profiles?pubkeys=${pubkey}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        const p = d?.profiles?.[pubkey];
        // Set unconditionally so a user with no local kind-0 resolves to null → npub fallback engages.
        setSubjectName(p ? (p.display_name || p.name || null) : null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pubkey]);

  const displayName = subjectName || shortNpub(pubkey);

  return (
    <div className="bsp-page">
      {/* Top bar */}
      <div className="bsp-top-bar">
        <a href="/" className="bsp-logo">
          <img src="/brainstorm.svg" alt="" className="bsp-logo-img" />
        </a>
        <div className="bsp-auth">
          <BrainstormUserMenu user={user} login={login} logout={logout} />
        </div>
      </div>

      <div className="bsp-content">
        {/* Header + back link */}
        <div className="bsp-follows-header">
          <Link to={`/user/${pubkey}`} className="bsp-back-link">← Back to profile</Link>
          <h1 className="bsp-follows-title">{NOTES_COPY.HEADING}</h1>
        </div>
        <div className="bsp-notes-subtitle">{displayName}</div>

        {renderUserNotesState({ data, loading, error })}
      </div>
    </div>
  );
}

/**
 * Pure state→view mapping. A function only of its args — the populated list (status OK) in array
 * order (already newest-first; the page does NOT re-sort), the operator-delegated empty message
 * (status EMPTY / a transport failure / an unknown status), and a transient loading line. Never a
 * raw error or a blank surface. Defined last so it stays a pure function of its args.
 */
export function renderUserNotesState({ data, loading, error }) {
  if (loading && !data) {
    return <div className="bsp-feed-loading">{NOTES_COPY.LOADING}</div>;
  }
  const status = data && data.status;
  if (error || data == null || !['OK', 'EMPTY'].includes(status)) {
    return <div className="bsp-empty">{NOTES_COPY.EMPTY}</div>;
  }
  if (status === 'EMPTY') {
    return <div className="bsp-empty">{NOTES_COPY.EMPTY}</div>;
  }
  // status === 'OK' — the indicator, then one entry per note IN ARRAY ORDER (already newest-first
  // from the read path; the page does NOT re-sort).
  const items = data.items || [];
  return (
    <>
      <div className="bsp-notes-indicator">{NOTES_COPY.INDICATOR}</div>
      <div className="bsp-notes-list">
        {items.map(item => <NoteCard key={item.id} item={item} />)}
      </div>
    </>
  );
}
