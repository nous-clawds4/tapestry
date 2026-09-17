import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import useProfiles from '../hooks/useProfiles';
import { queryRelayBounded } from '../api/relay';
import { fetchPageCounts } from '../api/dlists';
import { headerCoord, headerNames, matchesListQuery, parseListRef } from '../utils/dlistFields';

function shortPubkey(pk) {
  return pk ? `${pk.slice(0, 8)}…` : '—';
}

/**
 * /lists — DList headers on local strfry, 50 per page, with the item counts for
 * the visible page only (dlist-item-tagging #1, paginated in #9).
 */
export default function Lists() {
  const navigate = useNavigate();
  const [headers, setHeaders] = useState([]);
  const [counts, setCounts] = useState({});   // coord → count; an absent key renders —
  const [total, setTotal] = useState(null);   // null = the header scan was bounded: unknown, not zero
  const [truncated, setTruncated] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState(null);
  const [ref, setRef] = useState('');
  const [refError, setRefError] = useState(null);
  const [query, setQuery] = useState('');

  // Counts for just this page's coordinates, never awaited: the 50 rows paint
  // first and the numbers fill in. A failure leaves the rows reading — (AC-5).
  function loadCounts(page) {
    const coords = page.map((h) => headerCoord(h));
    if (coords.length === 0) return;
    fetchPageCounts(coords)
      .then((next) => setCounts((prev) => ({ ...prev, ...next })))
      .catch(() => { /* rows keep their — */ });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await queryRelayBounded({ kinds: [9998, 39998], limit: 50 });
        if (cancelled) return;
        const sorted = [...page.events].sort((a, b) => b.created_at - a.created_at);
        setHeaders(sorted);
        setTotal(page.total);
        setTruncated(page.truncated);
        loadCounts(sorted);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Next page = until the oldest created_at seen; de-dupe by id so a shared
  // timestamp at the boundary neither skips nor repeats a header (E2).
  async function loadMore() {
    if (headers.length === 0) return;
    setPaging(true);
    try {
      const until = Math.min(...headers.map((h) => h.created_at));
      const page = await queryRelayBounded({ kinds: [9998, 39998], until, limit: 50 });
      const seen = new Set(headers.map((h) => h.id));
      const fresh = page.events.filter((h) => !seen.has(h.id));
      if (fresh.length === 0) setExhausted(true);
      const sorted = [...fresh].sort((a, b) => b.created_at - a.created_at);
      setHeaders((prev) => [...prev, ...sorted]);
      setTruncated(page.truncated);
      loadCounts(sorted);
    } catch (err) {
      setError(err.message);
    } finally {
      setPaging(false);
    }
  }

  const authorKeys = useMemo(() => headers.map((h) => h.pubkey), [headers]);
  const profiles = useProfiles(authorKeys);
  // AC-10 / AC-4: client-side filter over the already-loaded headers (names + description).
  const visible = useMemo(() => headers.filter((h) => matchesListQuery(h, query)), [headers, query]);
  const totalLabel = total === null ? 'unknown' : total;
  const hasMore = !exhausted && (truncated || (total !== null && headers.length < total));

  function openRef(e) {
    e.preventDefault();
    const parsed = parseListRef(ref);
    if (!parsed) {
      setRefError('That is not a list coordinate (39998:<pubkey>:<d>), naddr, or event id.');
      return;
    }
    navigate(`/list/${encodeURIComponent(parsed.coord || parsed.id)}`);
  }

  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-dlist-main">
        <header className="bs-dlist-header">
          <h1 className="bs-dlist-title">Lists</h1>
          <p className="bs-dlist-sub">Decentralized Lists on this relay. Anyone can add an item to any list.</p>
        </header>

        <form className="bs-dlist-open" onSubmit={openRef}>
          <input
            type="text"
            value={ref}
            onChange={(e) => { setRef(e.target.value); setRefError(null); }}
            placeholder="Paste a list coordinate, naddr, or event id…"
            aria-label="Open a list by reference"
          />
          <button type="submit">Open</button>
        </form>
        {refError && <p className="bs-dlist-error">{refError}</p>}

        {error && <p className="bs-dlist-error">⚠️ {error}</p>}
        {loading && <p className="bs-dlist-loading">Loading lists…</p>}
        {!loading && !error && headers.length === 0 && <p className="bs-dlist-empty">No lists on this relay yet.</p>}

        {headers.length > 0 && (
          <input
            type="search"
            className="bs-dlist-filter"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter lists by name or description…"
            aria-label="Filter lists"
          />
        )}
        {headers.length > 0 && (
          <p className="bs-dlist-filter-summary">{visible.length} matching of {headers.length} loaded</p>
        )}
        {headers.length > 0 && visible.length === 0 && <p className="bs-dlist-empty">No lists match on this page.</p>}

        {visible.length > 0 && (
          <ul className="bs-dlist-index">
            {visible.map((h) => {
              const coord = headerCoord(h);
              const names = headerNames(h);
              const profile = profiles[h.pubkey];
              const count = counts[coord] != null ? counts[coord] : '—';
              return (
                <li key={h.id} className="bs-dlist-index-row">
                  <Link to={`/list/${encodeURIComponent(coord)}`} className="bs-dlist-index-link">
                    <span className="bs-dlist-index-name">{names.plural}</span>
                    {names.description && <span className="bs-dlist-index-desc">{names.description}</span>}
                    <span className="bs-dlist-index-author">
                      by {profile?.display_name || profile?.name || shortPubkey(h.pubkey)}
                    </span>
                    <span className="bs-dlist-index-count" title="Items on local strfry">{count} items</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {headers.length > 0 && (
          <div className="bs-dlist-footer">
            <span className="bs-dlist-count-summary">
              Showing {headers.length} of {totalLabel}{truncated && total === null ? ' (scan was bounded)' : ''}
            </span>
            {hasMore && (
              <button type="button" className="bs-dlist-loadmore" onClick={loadMore} disabled={paging}>
                {paging ? 'Loading…' : 'Next page'}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
