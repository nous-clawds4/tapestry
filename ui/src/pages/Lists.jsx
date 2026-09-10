import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import useProfiles from '../hooks/useProfiles';
import { queryRelay } from '../api/relay';
import { headerCoord, headerNames, matchesListQuery, parseListRef } from '../utils/dlistFields';

function shortPubkey(pk) {
  return pk ? `${pk.slice(0, 8)}…` : '—';
}

/**
 * /lists — every DList header on local strfry, with its item count, plus a
 * paste box for a coordinate / naddr / event id (dlist-item-tagging #1).
 */
export default function Lists() {
  const navigate = useNavigate();
  const [headers, setHeaders] = useState([]);
  const [counts, setCounts] = useState(null); // null = item-counts unavailable
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ref, setRef] = useState('');
  const [refError, setRefError] = useState(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [events, countsRes] = await Promise.all([
          queryRelay({ kinds: [9998, 39998] }),
          fetch('/api/dlists/item-counts').then((r) => r.json()).catch(() => null),
        ]);
        if (cancelled) return;
        setHeaders([...events].sort((a, b) => b.created_at - a.created_at));
        setCounts(countsRes && countsRes.success ? countsRes.counts : null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const authorKeys = useMemo(() => headers.map((h) => h.pubkey), [headers]);
  const profiles = useProfiles(authorKeys);
  // AC-10: client-side filter over the already-loaded headers (names + description).
  const visible = useMemo(() => headers.filter((h) => matchesListQuery(h, query)), [headers, query]);

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
        {headers.length > 0 && visible.length === 0 && <p className="bs-dlist-empty">No lists match.</p>}

        {visible.length > 0 && (
          <ul className="bs-dlist-index">
            {visible.map((h) => {
              const coord = headerCoord(h);
              const names = headerNames(h);
              const profile = profiles[h.pubkey];
              const count = counts && counts[coord] != null ? counts[coord] : '—';
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
      </main>
    </div>
  );
}
