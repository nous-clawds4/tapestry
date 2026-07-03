/**
 * Shared pagination footer for the feed surfaces (feed-usability #2 / ADR feed-usability/0002).
 * Explicit "Load more" control — NOT infinite scroll. Hosts three states:
 *   - exhausted → an end-of-history line (no dead button)
 *   - loadingMore → a disabled "Loading…" button (AC: loading state visible; no double-activate)
 *   - otherwise → the "Load more" button wired to onLoadMore
 * Pure presentational: a function of its props (the page/hook owns the fetch + accumulation).
 */
export default function LoadMoreFooter({ loadingMore, exhausted, onLoadMore, endText }) {
  if (exhausted) {
    return <div className="bsp-loadmore-end">{endText}</div>;
  }
  return (
    <div className="bsp-loadmore-wrap">
      <button
        type="button"
        className="bsp-loadmore"
        disabled={loadingMore}
        onClick={onLoadMore}
      >
        {loadingMore ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}
