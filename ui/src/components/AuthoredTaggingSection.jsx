import React from 'react';
import { Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import SortToggle from './SortToggle';
import useAuthoredTagging from '../hooks/useAuthoredTagging';
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
      <span className="bsp-authored-verb">tagged</span>
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

export default function AuthoredTaggingSection({ profilePubkey, viewerPubkey }) {
  const { rows, sort, setSort, povSuffix, loading, error } = useAuthoredTagging(profilePubkey);

  // Loading placeholder so the section doesn't pop in/out during the first
  // auth-bootstrap → fetch cycle.
  if (loading && rows.length === 0) {
    return (
      <section className="bsp-authored" aria-label="Tagging activity">
        <p className="bsp-authored-loading">Loading tagging activity…</p>
      </section>
    );
  }

  // AC-6: hidden entirely when zero rows render.
  if (!loading && !error && rows.length === 0) return null;

  const showAboutMe = !!viewerPubkey && viewerPubkey !== profilePubkey;
  const aboutMe = showAboutMe ? rows.filter((r) => r.targetPubkey === viewerPubkey) : [];
  const others  = showAboutMe ? rows.filter((r) => r.targetPubkey !== viewerPubkey) : rows;

  return (
    <section className="bsp-authored" aria-label="Tagging activity">
      <header className="bsp-authored-head">
        <h3 className="bsp-authored-title">TAGGING ACTIVITY</h3>
        <SortToggle
          options={SORT_LABELS}
          value={sort}
          onChange={setSort}
          ariaLabel="Sort tagging activity"
          className="bsp-authored-sort"
        />
      </header>
      {error && <p className="bsp-authored-error">⚠️ {error}</p>}
      {aboutMe.length > 0 && (
        <div className="bsp-authored-aboutme">
          <h4 className="bsp-authored-subhead">Tags they&apos;ve placed on YOU</h4>
          <ul className="bsp-authored-list">
            {aboutMe.map((r) => <AuthoredTagRow key={r.assertionEventId} row={r} />)}
          </ul>
        </div>
      )}
      {others.length > 0 && (
        <ul className="bsp-authored-list">
          {others.map((r) => <AuthoredTagRow key={r.assertionEventId} row={r} />)}
        </ul>
      )}
      {povSuffix && (
        <p className="bsp-authored-pov-hint">
          Targets outside your active POV are hidden. Switch POV to see more.
        </p>
      )}
    </section>
  );
}
