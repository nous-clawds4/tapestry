import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import Avatar from '../components/Avatar';
import DListItemsTable from '../components/dlist/DListItemsTable';
import useProfiles from '../hooks/useProfiles';
import { queryRelay, queryRelayBounded } from '../api/relay';
import { headerCoord, headerNames, parseFieldDecls, parseListRef, reactionPolarity } from '../utils/dlistFields';

const NOT_HERE = 'This list is not on this relay.';

function shortPubkey(pk) {
  return pk ? `${pk.slice(0, 8)}…` : '—';
}

function itemsFilter(header) {
  const coord = headerCoord(header);
  return header.kind === 39998
    ? { kinds: [9999, 39999], '#z': [coord] }
    : { kinds: [9999, 39999], '#e': [coord] };
}

/**
 * /list/:ref — one DList, its items rendered from the header's field
 * declarations, 50 per page (dlist-item-tagging #1).
 */
export default function List() {
  const { ref } = useParams();
  const parsed = useMemo(() => parseListRef(ref), [ref]);

  const [header, setHeader] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const [voteCounts, setVoteCounts] = useState({});
  const [votesFailed, setVotesFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Votes: one batched kind-7 scan per page, folded through reactionPolarity (E9: '—' on failure).
  const loadVotes = useCallback(async (pageItems) => {
    if (pageItems.length === 0) return;
    try {
      const reactions = await queryRelay({ kinds: [7], '#e': pageItems.map((it) => it.id) });
      const next = {};
      for (const it of pageItems) next[it.id] = { up: 0, down: 0 };
      for (const r of reactions) {
        const polarity = reactionPolarity(r.content);
        if (polarity === 0) continue;
        for (const t of r.tags || []) {
          if (t[0] === 'e' && next[t[1]]) next[t[1]][polarity > 0 ? 'up' : 'down'] += 1;
        }
      }
      setVoteCounts((prev) => ({ ...prev, ...next }));
    } catch {
      setVotesFailed(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setHeader(null); setItems([]); setTotal(null); setTruncated(false);
    setVoteCounts({}); setVotesFailed(false); setError(null); setNotFound(false);
    if (!parsed) { setNotFound(true); setLoading(false); return undefined; }
    setLoading(true);
    (async () => {
      try {
        const found = parsed.id
          ? await queryRelay({ ids: [parsed.id] })
          : await queryRelay({ kinds: [parsed.kind], authors: [parsed.pubkey], '#d': [parsed.d] });
        if (cancelled) return;
        if (found.length === 0) { setNotFound(true); return; }
        const h = found[0];
        setHeader(h);
        const page = await queryRelayBounded({ ...itemsFilter(h), limit: 50 });
        if (cancelled) return;
        setItems(page.events);
        setTotal(page.total);
        setTruncated(page.truncated);
        loadVotes(page.events);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [parsed, loadVotes]);

  // E6: next page = until the oldest created_at seen; de-dupe by id so a shared timestamp neither skips nor repeats.
  async function loadMore() {
    if (!header || items.length === 0) return;
    setPaging(true);
    try {
      const until = Math.min(...items.map((it) => it.created_at));
      const page = await queryRelayBounded({ ...itemsFilter(header), until, limit: 50 });
      const seen = new Set(items.map((it) => it.id));
      const fresh = page.events.filter((it) => !seen.has(it.id));
      setItems((prev) => [...prev, ...fresh]);
      setTruncated(page.truncated);
      loadVotes(fresh);
    } catch (err) {
      setError(err.message);
    } finally {
      setPaging(false);
    }
  }

  const fieldDecls = useMemo(() => (header ? parseFieldDecls(header) : []), [header]);
  const names = useMemo(() => (header ? headerNames(header) : null), [header]);
  const pubkeys = useMemo(
    () => (header ? [header.pubkey, ...items.map((it) => it.pubkey)] : []),
    [header, items],
  );
  const profiles = useProfiles(pubkeys);
  const authorProfile = header ? profiles[header.pubkey] : null;
  const totalLabel = total === null ? 'unknown' : total;
  const hasMore = truncated || (total !== null && items.length < total);

  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-dlist-main">
        <Link to="/lists" className="bs-dlist-breadcrumb">← All lists</Link>

        {loading && <p className="bs-dlist-loading">Loading list…</p>}
        {error && <p className="bs-dlist-error">⚠️ {error}</p>}
        {!loading && notFound && (
          <div className="bs-dlist-notfound">
            <p>{NOT_HERE}</p>
            <p><code>{ref}</code></p>
          </div>
        )}

        {header && names && (
          <>
            <header className="bs-dlist-header">
              <h1 className="bs-dlist-title">{names.plural}</h1>
              <p className="bs-dlist-sub">
                One item is a <strong>{names.singular}</strong>
                {names.description && <> — {names.description}</>}
              </p>
              <p className="bs-dlist-list-author">
                <Link to={`/user/${header.pubkey}`} className="bs-dlist-author-link">
                  <Avatar pubkey={header.pubkey} profile={authorProfile} size={20} />
                  <span>list by {authorProfile?.display_name || authorProfile?.name || shortPubkey(header.pubkey)}</span>
                </Link>
                {' · '}<code className="bs-dlist-coord">{headerCoord(header)}</code>
              </p>
            </header>

            {!loading && items.length === 0 && <p className="bs-dlist-empty">No items on this relay yet.</p>}
            {items.length > 0 && (
              <DListItemsTable
                items={items}
                fieldDecls={fieldDecls}
                profiles={profiles}
                voteCounts={votesFailed ? {} : voteCounts}
              />
            )}

            <div className="bs-dlist-footer">
              <span className="bs-dlist-count-summary">
                Showing {items.length} of {totalLabel}{truncated && total === null ? ' (scan was bounded)' : ''}
              </span>
              {hasMore && (
                <button type="button" className="bs-dlist-loadmore" onClick={loadMore} disabled={paging}>
                  {paging ? 'Loading…' : 'Next page'}
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
