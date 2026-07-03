import { useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu from '../components/BrainstormUserMenu';
import NoteCard from '../components/NoteCard';
import SortToggle from '../components/SortToggle';
import LoadMoreFooter from '../components/LoadMoreFooter';
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
  // Truthful, count-derived indicator (feed-usability #2): pagination loads past 50 and the
  // toggle filters, so the indicator reflects what is actually shown — not a fixed "50".
  INDICATOR: (n) => `Showing ${n} note${n === 1 ? '' : 's'}.`,
  END: "You've reached the end — no more notes to load.",
  NO_SOURCE: "No House point-of-view is selected — there's no feed to show yet.",
  FOLLOW_UNAVAIL: 'The follow list for this identity is not available locally yet.',
  NO_NOTES: 'No recent notes from the accounts this identity follows.',
  LOADING: 'Loading the feed…',
  COULDNT_LOAD: "Couldn't load the feed right now.",
  REPLY_ONLY: 'No top-level notes to show — switch to Notes + Replies to see replies.',
};

// The two toggle states (feed-usability Story 1 / ADR feed-usability/0001):
// 'notes' = top-level only (the default view), 'all' = notes + replies (the old view).
const MODE_OPTIONS = [
  { key: 'notes', label: 'Notes' },
  { key: 'all', label: 'Notes + Replies' },
];

export default function BrainstormFeed() {
  const { user, login, logout } = useAuth();
  const { data, loading, error, loadingMore, exhausted, loadMore } = useFeed();
  // Client-only toggle state — switching re-filters the already-delivered items;
  // no refetch, no navigation. Not persisted (story: out of scope).
  const [mode, setMode] = useState('notes');

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
        {data?.status === 'OK' && (
          <SortToggle
            className="bsp-feed-filter"
            ariaLabel="Filter notes"
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
          />
        )}
        {renderFeedState({ data, loading, error, mode, loadingMore, exhausted, loadMore })}
      </div>
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
export function renderFeedState({ data, loading, error, mode, loadingMore, exhausted, loadMore }) {
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

  // status === 'OK' — filter by the toggle mode, then render the indicator and one
  // entry per note IN ARRAY ORDER (already newest-first from the read path; the page
  // does NOT re-sort). 'notes' (the default) drops replies via the item's server-computed
  // isReply flag; 'all' keeps everything (feed-usability Story 1).
  const all = data.items || [];
  const items = mode === 'all' ? all : all.filter(it => !it.isReply);
  const footer = (
    <LoadMoreFooter
      loadingMore={loadingMore}
      exhausted={exhausted}
      onLoadMore={loadMore}
      endText={FEED_COPY.END}
    />
  );
  if (all.length > 0 && items.length === 0) {
    // Everything loaded SO FAR is a reply and the toggle is on Notes — an explicit
    // message, never a blank list (Story 1 AC-5). But older top-level notes may exist
    // further back, so keep the "Load more" control (composes with pagination).
    return (
      <>
        <div className="bsp-empty">{FEED_COPY.REPLY_ONLY}</div>
        {footer}
      </>
    );
  }
  // Virtualized (react-virtuoso, window-scroll) so the rendered DOM stays bounded no matter
  // how many pages are loaded; items render in delivered array order (newest-first; no re-sort).
  return (
    <>
      <div className="bsp-feed-indicator">{FEED_COPY.INDICATOR(items.length)}</div>
      <Virtuoso
        useWindowScroll
        data={items}
        computeItemKey={(_, item) => item.id}
        itemContent={(_, item) => <NoteCard item={item} />}
        components={{ Footer: () => footer }}
      />
    </>
  );
}
