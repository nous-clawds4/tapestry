import { Link } from 'react-router-dom';
import NoteActionsMenu from './NoteActionsMenu';
import NoteContent from './NoteContent';
import { formatTimeAgo } from '../utils/timeAgo';

/**
 * NoteCard — the shared visual unit for a single kind-1 note. Pure presentational:
 * it takes an already-enriched note `item`
 *   { id, pubkey, createdAt, content, author: { displayName, avatar }, mentions }
 * (the shape every read path serves, see src/api/_shared/noteEnrichment.js) and renders
 * the card. No data fetching, no read logic — the page/parent supplies the item.
 *
 * Used by the live feed today; the profile "latest note" and per-user notes page are
 * expected to reuse it next. Future per-note improvements (reposts, reply indicator,
 * event tags) belong HERE so every location gets them at once. Layout variants should
 * arrive as explicit props (kept few and intentional), not forks of this component.
 *
 * The avatar + display name link to the author's profile (/user/<pubkey>); when the note
 * has no pubkey (defensive; enriched OK items always carry one) they render unlinked so
 * we never emit a /user/ link to nowhere.
 */

// Unix seconds → a compact relative "time ago" label: the two most-significant non-zero
// units among years/days/hours/minutes, space-separated (e.g. "2m ago", "4h 53m ago",
// "1y 213d ago"). Sub-minute renders "just now". Delegates the unit math to the shared
// formatTimeAgo helper (no date library).
export function formatTimestamp(createdAt) {
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return '';
  const now = Math.floor(Date.now() / 1000);
  if (now - createdAt < 60) return 'just now';
  return formatTimeAgo(createdAt, now, { maxUnits: 2, separator: ' ' });
}

// The exact local date/time, shown on hover (title) so the relative label keeps its
// precision a click away. Built-in Date only — no date library.
export function absoluteTimestamp(createdAt) {
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return '';
  return new Date(createdAt * 1000).toLocaleString();
}

export default function NoteCard({ item }) {
  const author = item.author || {};
  const displayName = author.displayName || (item.pubkey ? `${item.pubkey.slice(0, 8)}…` : 'Unknown');
  const avatar = author.avatar;
  const profileHref = item.pubkey ? `/user/${item.pubkey}` : null;

  const avatarEl = avatar ? (
    <img className="bsp-avatar bsp-feed-avatar" src={avatar} alt="" />
  ) : (
    <div className="bsp-avatar bsp-avatar-placeholder bsp-feed-avatar">
      {displayName.charAt(0).toUpperCase()}
    </div>
  );

  return (
    <div className="bsp-feed-item">
      <div className="bsp-feed-item-head">
        {profileHref ? (
          <Link to={profileHref} className="bsp-feed-author-link" aria-label={`View ${displayName}'s profile`}>
            {avatarEl}
          </Link>
        ) : avatarEl}
        <div className="bsp-feed-item-meta">
          {profileHref ? (
            <Link to={profileHref} className="bsp-name bsp-feed-name bsp-feed-name-link">{displayName}</Link>
          ) : (
            <div className="bsp-name bsp-feed-name">{displayName}</div>
          )}
          <div className="bsp-feed-time" title={absoluteTimestamp(item.createdAt)}>{formatTimestamp(item.createdAt)}</div>
        </div>
        {/* Per-note actions (copy link / id, tag) — floats to the top-right of the entry. */}
        <NoteActionsMenu item={item} />
      </div>
      <div className="bsp-feed-text"><NoteContent content={item.content} mentions={item.mentions} /></div>
    </div>
  );
}
