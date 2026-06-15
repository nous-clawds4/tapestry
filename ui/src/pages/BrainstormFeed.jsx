import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu from '../components/BrainstormUserMenu';
import useFeed from '../hooks/useFeed';

/**
 * Story live-feed #2 / ADR live-feed/0002: the public, login-free `/feed` page.
 *
 * Front-end only. It renders the read path's already-resolved four-outcome output
 * (from `/api/feed`, ADR 0001) and adds NO read logic — no source resolution, no
 * follow reading, no note fetching, no relay selection, no profile enrichment, and
 * no re-sorting (items arrive newest-first; the page renders them in array order).
 *
 * The body is delegated to `renderFeedState`, a PURE, named-exported function of
 * `{ data, loading, error }` — no fetch, no auth, no router, no browser globals —
 * so the four story states (+ loading + the defensive case) are an isolated unit.
 */

// Operator-delegated copy (story #2). Punctuation is non-binding; meaning is exact.
export const FEED_COPY = {
  HEADING: 'Live Feed',
  INDICATOR: 'Showing the most recent 50 notes.',
  NO_SOURCE: "No House point-of-view is selected — there's no feed to show yet.",
  FOLLOW_UNAVAIL: 'The follow list for this identity is not available locally yet.',
  NO_NOTES: 'No recent notes from the accounts this identity follows.',
  LOADING: 'Loading the feed…',
  COULDNT_LOAD: "Couldn't load the feed right now.",
};

// Unix seconds → a human-readable local timestamp. Tiny local helper, no date library.
export function formatTimestamp(createdAt) {
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return '';
  return new Date(createdAt * 1000).toLocaleString();
}

export default function BrainstormFeed() {
  const { user, login, logout } = useAuth();
  const { data, loading, error } = useFeed();

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

      <div className="bsp-content bsp-feed-content">
        <h1 className="bsp-feed-heading">{FEED_COPY.HEADING}</h1>
        {renderFeedState({ data, loading, error })}
      </div>
    </div>
  );
}

// One note entry: avatar (placeholder fallback) + author display name + timestamp + text.
function FeedItem({ item }) {
  const author = item.author || {};
  const displayName = author.displayName || (item.pubkey ? `${item.pubkey.slice(0, 8)}…` : 'Unknown');
  const avatar = author.avatar;

  return (
    <div className="bsp-feed-item">
      <div className="bsp-feed-item-head">
        {avatar ? (
          <img className="bsp-avatar bsp-feed-avatar" src={avatar} alt="" />
        ) : (
          <div className="bsp-avatar bsp-avatar-placeholder bsp-feed-avatar">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="bsp-feed-item-meta">
          <div className="bsp-name bsp-feed-name">{displayName}</div>
          <div className="bsp-feed-time">{formatTimestamp(item.createdAt)}</div>
        </div>
      </div>
      <div className="bsp-feed-text">{item.content}</div>
    </div>
  );
}

/**
 * Pure state→view mapping. A function only of its args — exactly one of the four
 * read-path states (OK / EMPTY / FOLLOW_LIST_UNAVAILABLE / NO_SOURCE), plus a
 * transient loading line and a defensive "couldn't load" branch for transport
 * failures / unknown statuses. Never a raw error or a blank surface. Defined last
 * so it stays a pure function of its args — no fetch, no auth, no router, no
 * browser globals (ADR §Testability #1).
 */
export function renderFeedState({ data, loading, error }) {
  if (loading && !data) {
    return <div className="bsp-feed-loading">{FEED_COPY.LOADING}</div>;
  }

  // Defensive: transport failure, missing body, or an unrecognized status. The four
  // named states are below; anything else falls through to a neutral "couldn't load".
  const status = data && data.status;
  if (error || data == null ||
      !['OK', 'EMPTY', 'FOLLOW_LIST_UNAVAILABLE', 'NO_SOURCE'].includes(status)) {
    return <div className="bsp-empty">{FEED_COPY.COULDNT_LOAD}</div>;
  }

  if (status === 'NO_SOURCE') {
    return <div className="bsp-empty">{FEED_COPY.NO_SOURCE}</div>;
  }
  if (status === 'FOLLOW_LIST_UNAVAILABLE') {
    return <div className="bsp-empty">{FEED_COPY.FOLLOW_UNAVAIL}</div>;
  }
  if (status === 'EMPTY') {
    return <div className="bsp-empty">{FEED_COPY.NO_NOTES}</div>;
  }

  // status === 'OK' — render the indicator, then one entry per note IN ARRAY ORDER
  // (already newest-first from the read path; the page does NOT re-sort).
  const items = data.items || [];
  return (
    <>
      <div className="bsp-feed-indicator">{FEED_COPY.INDICATOR}</div>
      <div className="bsp-feed-list">
        {items.map(item => <FeedItem key={item.id} item={item} />)}
      </div>
    </>
  );
}
