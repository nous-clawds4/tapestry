import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import SortToggle from './SortToggle';
import NoteCard from './NoteCard';
import PovStatusNotice from './PovStatusNotice';
import useAuthoredTagging from '../hooks/useAuthoredTagging';
import { useNotesByAuthor } from '../hooks/useNotesByAuthor';
import { timeAgo } from '../utils/timeAgo';

const SORT_LABELS = [
  { key: 'recent',      label: 'Most recent' },
  { key: 'applied',     label: 'Popular tags' },
  { key: 'disputed',    label: 'Contested tags' },
  { key: 'most-backed', label: 'Most-backed' },
  { key: 'divisive',    label: 'Most divisive' },
];

function shortNpub(pk) {
  if (!pk) return '—';
  try {
    const npub = nip19.npubEncode(pk);
    return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
  } catch {
    return `${pk.slice(0, 12)}…${pk.slice(-8)}`;
  }
}

function peerAnnotation(row) {
  const matched = row.polarity === 'applied' ? row.peerApplications : row.peerDisputes;
  const opposed = row.polarity === 'applied' ? row.peerDisputes : row.peerApplications;
  if (matched === 0 && opposed === 0) return null;
  if (matched > 0 && opposed === 0) {
    return <span className="bsp-authored-peer is-agree">+{matched} agree</span>;
  }
  if (matched === 0 && opposed > 0) {
    return <span className="bsp-authored-peer is-disagree">−{opposed} disagree</span>;
  }
  return (
    <span className="bsp-authored-peer">
      <span className="is-agree">+{matched} agree</span>
      <span className="bsp-authored-peer-sep"> · </span>
      <span className="is-disagree">−{opposed} disagree</span>
    </span>
  );
}

function AuthoredTagRow({ row }) {
  const targetName = row.targetDisplayName || shortNpub(row.targetPubkey);
  const ts = timeAgo(row.createdAt);
  return (
    <li className="bsp-authored-row">
      {row.polarity === 'applied' ? (
        <span className="bsp-authored-badge bsp-authored-applied" aria-label="applied">+</span>
      ) : (
        <span className="bsp-authored-badge bsp-authored-disputed" aria-label="disputed">−</span>
      )}
      <Link
        to={`/tag/${encodeURIComponent(row.tagSlug)}/${row.tagEventId}`}
        className="bsp-authored-tag-link"
      >
        {row.tagName}
      </Link>
      <span className="bsp-authored-arrow" aria-label="applied to">→</span>
      <Link
        to={`/user/${row.targetPubkey}`}
        className="bsp-authored-target-link"
      >
        {row.targetPicture && (
          <img
            className="bsp-authored-target-avatar"
            src={row.targetPicture}
            alt=""
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}
        <span className="bsp-authored-target-name">{targetName}</span>
      </Link>
      {ts && <span className="bsp-authored-time">{ts}</span>}
      {peerAnnotation(row)}
    </li>
  );
}

// A note this person has tagged — the note-target analog of AuthoredTagRow. Renders the
// tag(s) they applied (with polarity) above the target note, so a note-tagging is legibly
// distinct from a profile-tagging row while living in the SAME intermixed list.
function AuthoredNoteRow({ note }) {
  return (
    <li className="bsp-authored-row bsp-authored-note-row">
      {note.taggedWith?.length > 0 && (
        <div className="bsp-authored-note-tags">
          {note.taggedWith.map((tw, i) => (
            <span
              key={`${tw.authorPubkey}:${tw.slug}:${i}`}
              className={`bsp-authored-note-tag ${tw.stance === 'dispute' ? 'is-dispute' : 'is-apply'}`}
            >
              {tw.stance === 'dispute' ? '−' : '+'} {tw.slug}
            </span>
          ))}
        </div>
      )}
      <NoteCard item={note} />
    </li>
  );
}

export default function AuthoredTaggingSection({ profilePubkey, viewerPubkey }) {
  const { rows, sort, setSort, povSuffix, povResolution, loading, error } = useAuthoredTagging(profilePubkey);
  const { notes, loading: notesLoading, error: notesError } = useNotesByAuthor(profilePubkey, viewerPubkey);
  // Collapsed by default — the section was noisy on initial profile view.
  // The header is a click target that toggles open/closed; chevron rotates
  // visually to match.
  const [collapsed, setCollapsed] = useState(true);

  const anyLoading = loading || notesLoading;
  const total = rows.length + notes.length;

  // Loading placeholder so the section doesn't pop in/out during the first
  // auth-bootstrap → fetch cycle.
  if (anyLoading && total === 0) {
    return (
      <section className="bsp-authored" aria-label="Tagging activity">
        <p className="bsp-authored-loading">Loading tagging activity…</p>
      </section>
    );
  }

  // Hidden entirely when this person has tagged nothing at all (neither
  // profiles nor notes).
  if (!anyLoading && !error && !notesError && total === 0) return null;

  const showAboutMe = !!viewerPubkey && viewerPubkey !== profilePubkey;
  const aboutMe = showAboutMe ? rows.filter((r) => r.targetPubkey === viewerPubkey) : [];
  const otherProfiles = showAboutMe ? rows.filter((r) => r.targetPubkey !== viewerPubkey) : rows;

  // Intermix profile-taggings and note-taggings into ONE list. Profile rows sort by
  // their assertion time; note rows by when they were tagged (taggedAt, exposed by
  // notes-by-author). The default 'recent' sort interleaves both by time; other sorts
  // keep the server-ordered profile rows and append notes (which lack peer metrics) in
  // recency order — see Story 15 for full server-side note sort parity on the tag page.
  const profileItems = otherProfiles.map((r) => ({
    kind: 'profile', key: `p:${r.assertionEventId}`, ts: r.createdAt || 0, row: r,
  }));
  const noteItems = notes.map((n) => ({
    kind: 'note', key: `n:${n.id}`, ts: n.taggedAt || n.createdAt || 0, note: n,
  }));
  const byTsDesc = (a, b) => b.ts - a.ts;
  const merged = sort === 'recent'
    ? [...profileItems, ...noteItems].sort(byTsDesc)
    : [...profileItems, ...noteItems.sort(byTsDesc)];

  return (
    <section className="bsp-authored" aria-label="Tagging activity">
      <button
        type="button"
        className="bsp-authored-head bsp-authored-head-toggle"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-controls="bsp-authored-body"
      >
        <h3 className="bsp-authored-title">
          TAGGING ACTIVITY
          <span className="bsp-authored-count">({total})</span>
        </h3>
        <span
          className={`bsp-authored-chevron${collapsed ? '' : ' is-open'}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
      {!collapsed && (
        <div id="bsp-authored-body" className="bsp-authored-body">
          <div className="bsp-authored-sort-row">
            <SortToggle
              options={SORT_LABELS}
              value={sort}
              onChange={setSort}
              ariaLabel="Sort tagging activity"
              className="bsp-authored-sort"
            />
          </div>
          <PovStatusNotice status={povResolution} variant="banner" />
          {error && <p className="bsp-authored-error">⚠️ {error}</p>}
          {notesError && <p className="bsp-authored-error">⚠️ {notesError}</p>}
          {aboutMe.length > 0 && (
            <div className="bsp-authored-aboutme">
              <h4 className="bsp-authored-subhead">Tags they&apos;ve placed on YOU</h4>
              <ul className="bsp-authored-list">
                {aboutMe.map((r) => <AuthoredTagRow key={r.assertionEventId} row={r} />)}
              </ul>
            </div>
          )}
          {merged.length > 0 && (
            <ul className="bsp-authored-list">
              {merged.map((item) => (
                item.kind === 'note'
                  ? <AuthoredNoteRow key={item.key} note={item.note} />
                  : <AuthoredTagRow key={item.key} row={item.row} />
              ))}
            </ul>
          )}
          {povSuffix && (
            <p className="bsp-authored-pov-hint">
              Targets outside your active POV are hidden. Switch POV to see more.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
