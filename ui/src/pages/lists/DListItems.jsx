import { useOutletContext, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
import DataTable from '../../components/DataTable';
import { queryRelay } from '../../api/relay';
import { useCypher } from '../../hooks/useCypher';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';
import { useAuth } from '../../context/AuthContext';
import useTrustWeights from '../../hooks/useTrustWeights';
import { useTrust, SCORING_METHODS } from '../../context/TrustContext';

function getTag(event, name, index = 1) {
  const tag = event.tags?.find(t => t[0] === name);
  return tag ? tag[index] : null;
}

function formatAge(ts) {
  if (!ts) return '—';
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortPubkey(pk) {
  if (!pk) return '—';
  return pk.slice(0, 8) + '…';
}

function isUpvote(content) {
  const c = (content || '').trim();
  return c === '+' || c === '👍' || c === '🤙';
}

function isDownvote(content) {
  const c = (content || '').trim();
  return c === '-' || c === '👎';
}

const SOURCE_LOCAL = '__local__';

export default function DListItems() {
  const { event } = useOutletContext();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ratings state — store full reactions, not just counts
  const [reactions, setReactions] = useState([]); // all kind 7 events
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsFetched, setRatingsFetched] = useState(false);
  const [activeSource, setActiveSource] = useState(SOURCE_LOCAL);
  const [pendingSource, setPendingSource] = useState(SOURCE_LOCAL);

  // Expandable trust detail panel
  const [expandedItemId, setExpandedItemId] = useState(null);

  // Check if list header requires p-tag
  const pTagRequired = useMemo(() => {
    return event.tags?.some(t => t[0] === 'required' && t[1] === 'p') || false;
  }, [event]);

  // Compute the parent reference that items use in their z-tag
  const parentRef = useMemo(() => {
    if (event.kind === 39998) {
      const dTag = getTag(event, 'd');
      return `${event.kind}:${event.pubkey}:${dTag}`;
    }
    return event.id;
  }, [event]);

  // Fetch items
  useEffect(() => {
    let cancelled = false;

    async function fetchItems() {
      try {
        setLoading(true);
        setError(null);

        let allItems;
        if (event.kind === 39998) {
          allItems = await queryRelay({ kinds: [9999, 39999], '#z': [parentRef] });
        } else {
          allItems = await queryRelay({ kinds: [9999, 39999], '#e': [event.id] });
        }

        if (!cancelled) setItems(allItems);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchItems();
    return () => { cancelled = true; };
  }, [event, parentRef]);

  const itemIds = useMemo(() => items.map(i => i.id), [items]);

  // Fetch relay sets for source selector
  const { data: relaySetsData } = useCypher(`
    MATCH (h:ConceptHeader {name: 'nostr relay'})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
      -[:IS_A_SUPERSET_OF*0..5]->(s)
    OPTIONAL MATCH (s)-[:IS_A_SUPERSET_OF*0..5]->(ss)-[:HAS_ELEMENT]->(elem)
    OPTIONAL MATCH (elem)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    WITH s, labels(s) AS nodeLabels,
         collect(DISTINCT {name: elem.name, json: jt.value}) AS elems
    RETURN s.name AS name, s.uuid AS uuid, nodeLabels, elems
    ORDER BY size(elems) DESC
  `);

  const relaySets = useMemo(() => {
    if (!relaySetsData) return [];
    return relaySetsData.map(s => {
      const relays = [];
      for (const e of (s.elems || [])) {
        if (!e.json) continue;
        try {
          const parsed = JSON.parse(e.json);
          const url = parsed?.nostrRelay?.websocketUrl;
          if (url) relays.push({ name: e.name, url });
        } catch {}
      }
      const isSuperset = (s.nodeLabels || []).includes('Superset');
      return {
        name: s.name,
        uuid: s.uuid,
        isSuperset,
        relays,
        label: isSuperset
          ? `All nostr relays (${relays.length})`
          : `${s.name} (${relays.length})`,
      };
    }).filter(s => s.relays.length > 0);
  }, [relaySetsData]);

  // Fetch ratings — store full events
  const fetchRatings = useCallback(async () => {
    if (itemIds.length === 0) return;

    setRatingsLoading(true);
    setActiveSource(pendingSource);

    try {
      let allReactions = [];

      if (pendingSource === SOURCE_LOCAL) {
        const batches = await Promise.all(
          itemIds.map(id => queryRelay({ kinds: [7], '#e': [id] }))
        );
        allReactions = batches.flat();
      } else {
        const set = relaySets.find(s => s.uuid === pendingSource);
        if (!set || set.relays.length === 0) return;
        const urls = set.relays.map(r => r.url);

        for (const id of itemIds) {
          try {
            const res = await fetch(
              `/api/reactions/external?eventId=${id}&relays=${encodeURIComponent(urls.join(','))}`
            );
            const data = await res.json();
            if (data.success) allReactions.push(...(data.events || []));
          } catch {}
        }
      }

      // Deduplicate
      const seen = new Set();
      const unique = allReactions.filter(e => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });

      setReactions(unique);
    } catch (err) {
      console.error('Error fetching ratings:', err);
    } finally {
      setRatingsLoading(false);
      setRatingsFetched(true);
    }
  }, [itemIds, pendingSource, relaySets]);

  // Auto-fetch ratings when items load
  useEffect(() => {
    if (itemIds.length > 0 && !ratingsFetched && !ratingsLoading) {
      fetchRatings();
    }
  }, [itemIds]);

  const sourceChanged = pendingSource !== activeSource;

  // Build reactions-per-item map: { itemId: [{ pubkey, type, id }] }
  const reactionsPerItem = useMemo(() => {
    const map = {};
    for (const id of itemIds) map[id] = [];
    for (const ev of reactions) {
      const eTag = ev.tags?.find(t => t[0] === 'e');
      const targetId = eTag?.[1];
      if (targetId && map[targetId]) {
        let type = 'other';
        if (isUpvote(ev.content)) type = 'upvote';
        else if (isDownvote(ev.content)) type = 'downvote';
        map[targetId].push({ pubkey: ev.pubkey, type, id: ev.id, content: ev.content });
      }
    }
    return map;
  }, [reactions, itemIds]);

  // Collect all pubkeys: item authors + reaction authors + PoV
  const { povPubkey } = useTrust();
  const allPubkeys = useMemo(() => {
    const set = new Set();
    if (povPubkey) set.add(povPubkey);
    for (const item of items) {
      if (item.pubkey) set.add(item.pubkey);
      // Include p-tag pubkeys for profile resolution
      const pTag = item.tags?.find(t => t[0] === 'p')?.[1];
      if (pTag) set.add(pTag);
    }
    for (const ev of reactions) {
      if (ev.pubkey) set.add(ev.pubkey);
    }
    return [...set];
  }, [items, reactions, povPubkey]);

  const profiles = useProfiles(allPubkeys);

  // Trust weights for all pubkeys that appear as authors of items or reactions
  const {
    weights: trustWeights,
    loading: trustLoading,
    error: trustError,
    scoringMethod: trustMethod,
  } = useTrustWeights(allPubkeys);

  const trustMethodLabel = useMemo(
    () => SCORING_METHODS.find(m => m.id === trustMethod)?.label || trustMethod,
    [trustMethod]
  );

  // Compute trust-weighted score for each item
  const trustScores = useMemo(() => {
    const scores = {};
    for (const item of items) {
      const itemAuthor = item.pubkey;
      const itemReactions = reactionsPerItem[item.id] || [];
      const authorTW = trustWeights[itemAuthor];

      // Check if the item author has any kind 7 reaction on this item
      const authorReaction = itemReactions.find(r => r.pubkey === itemAuthor);
      const authorSelfDownvoted = authorReaction?.type === 'downvote';
      const authorHasExplicitUpvote = authorReaction?.type === 'upvote';

      // Build the breakdown
      const breakdown = [];
      let score = 0;

      // 1. Implicit author upvote
      if (authorTW != null) {
        if (authorSelfDownvoted) {
          // Author downvoted their own item → cancels implicit upvote → net 0
          breakdown.push({
            pubkey: itemAuthor,
            role: 'author',
            type: 'implicit-upvote-cancelled',
            weight: authorTW,
            contribution: 0,
            note: 'Implicit upvote cancelled by author\'s kind 7 downvote',
          });
        } else {
          // Normal implicit upvote
          breakdown.push({
            pubkey: itemAuthor,
            role: 'author',
            type: 'implicit-upvote',
            weight: authorTW,
            contribution: authorTW,
            note: authorHasExplicitUpvote
              ? 'Implicit upvote (explicit kind 7 + ignored as duplicate)'
              : 'Implicit upvote (authored the item)',
          });
          score += authorTW;
        }
      } else {
        breakdown.push({
          pubkey: itemAuthor,
          role: 'author',
          type: 'implicit-upvote',
          weight: null,
          contribution: null,
          note: 'Trust weight unknown',
        });
      }

      // 2. Process each reaction from OTHER authors
      for (const r of itemReactions) {
        if (r.pubkey === itemAuthor) {
          // Already handled above — skip explicit reactions from item author
          if (authorSelfDownvoted) {
            breakdown.push({
              pubkey: r.pubkey,
              role: 'author',
              type: 'explicit-downvote',
              weight: authorTW,
              contribution: 0,
              note: 'Author\'s explicit downvote (cancels implicit upvote)',
            });
          }
          // If author has explicit upvote, it was already noted above
          continue;
        }

        const tw = trustWeights[r.pubkey];
        if (tw != null) {
          const contrib = r.type === 'upvote' ? tw : r.type === 'downvote' ? -tw : 0;
          score += contrib;
          breakdown.push({
            pubkey: r.pubkey,
            role: 'reactor',
            type: r.type,
            weight: tw,
            contribution: contrib,
            note: null,
          });
        } else {
          breakdown.push({
            pubkey: r.pubkey,
            role: 'reactor',
            type: r.type,
            weight: null,
            contribution: null,
            note: 'Trust weight unknown',
          });
        }
      }

      scores[item.id] = { score, breakdown };
    }
    return scores;
  }, [items, reactionsPerItem, trustWeights]);

  // Vote count summaries (for the raw columns)
  const voteCounts = useMemo(() => {
    const counts = {};
    for (const id of itemIds) {
      const rxns = reactionsPerItem[id] || [];
      counts[id] = {
        up: rxns.filter(r => r.type === 'upvote').length,
        down: rxns.filter(r => r.type === 'downvote').length,
      };
    }
    return counts;
  }, [reactionsPerItem, itemIds]);

  const rows = useMemo(() => {
    return items.map(item => {
      const dTag = getTag(item, 'd');
      const routeId = item.kind === 39999
        ? `${item.kind}:${item.pubkey}:${dTag}`
        : item.id;

      const counts = voteCounts[item.id] || { up: 0, down: 0 };
      const ts = trustScores[item.id] || { score: 0, breakdown: [] };

      return {
        id: item.id,
        routeId,
        name: getTag(item, 'name') || '(unnamed)',
        kind: item.kind,
        author: item.pubkey,
        authorShort: shortPubkey(item.pubkey),
        pTagPubkey: item.tags?.find(t => t[0] === 'p')?.[1] || null,
        created_at: item.created_at,
        age: formatAge(item.created_at),
        upTotal: counts.up,
        downTotal: counts.down,
        trustScore: ts.score,
        breakdown: ts.breakdown,
      };
    });
  }, [items, voteCounts, trustScores]);

  if (loading) return <p>Loading items…</p>;
  if (error) return <p className="error">Error: {error}</p>;

  const povProfile = profiles[povPubkey];
  const povName = povProfile?.name || povProfile?.display_name || (povPubkey ? shortPubkey(povPubkey) : '—');

  return (
    <div className="dlist-items">
      <div className="page-header-row">
        <h2>Items ({items.length})</h2>
        <button className="btn-primary" onClick={() => navigate('new')}>
          + Add Item
        </button>
      </div>

      {/* Ratings source selector */}
      <div style={{
        display: 'flex', gap: '0.75rem', alignItems: 'flex-end',
        marginBottom: '1rem',
        padding: '0.75rem 1rem',
        border: '1px solid var(--border, #444)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            📡 Ratings Source
          </label>
          <select
            value={pendingSource}
            onChange={e => setPendingSource(e.target.value)}
            style={{
              width: '100%', padding: '0.35rem 0.6rem', fontSize: '0.85rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
              border: '1px solid var(--border, #444)', borderRadius: '4px', cursor: 'pointer',
            }}
          >
            <option value={SOURCE_LOCAL}>Local strfry</option>
            {relaySets.map(s => (
              <option key={s.uuid} value={s.uuid}>{s.label}</option>
            ))}
          </select>
        </div>
        {sourceChanged && (
          <button
            className="btn btn-primary"
            onClick={fetchRatings}
            disabled={ratingsLoading}
            style={{ whiteSpace: 'nowrap' }}
          >
            {ratingsLoading ? '⏳ Fetching…' : '🔄 Fetch Ratings'}
          </button>
        )}
        {ratingsLoading && !sourceChanged && (
          <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>⏳ Loading ratings…</span>
        )}
      </div>

      {/* Items table — custom rendering for expandable rows */}
      <ItemsTable
        rows={rows}
        profiles={profiles}
        trustWeights={trustWeights}
        trustLoading={trustLoading}
        trustMethod={trustMethod}
        ratingsFetched={ratingsFetched}
        expandedItemId={expandedItemId}
        pTagRequired={pTagRequired}
        onToggleExpand={(id) => setExpandedItemId(prev => prev === id ? null : id)}
        onRowClick={(row) => navigate(`/kg/lists/items/${encodeURIComponent(row.routeId)}`)}
      />

      {/* Trust method footnote */}
      <div style={{
        marginTop: '0.75rem',
        fontSize: '0.75rem',
        opacity: 0.65,
        lineHeight: 1.7,
      }}>
        <div>
          <span>* Trust Score determined by </span>
          <Link
            to="/kg/grapevine/trust-determination"
            style={{ color: '#58a6ff', textDecoration: 'none' }}
          >
            {trustMethodLabel}
          </Link>
          <span> · PoV: </span>
          <Link
            to={`/kg/users/${povPubkey}`}
            style={{ color: '#58a6ff', textDecoration: 'none' }}
          >
            {povName}
          </Link>
        </div>
        {trustError && (
          <div style={{ color: '#d29922', marginTop: '0.25rem' }}>
            ⚠ {trustError}
          </div>
        )}
      </div>

      {/* Trusted List Generation */}
      {ratingsFetched && !trustLoading && (
        <TrustedListPanel
          items={items}
          trustScores={trustScores}
          trustMethod={trustMethod}
          povPubkey={povPubkey}
          listNamePlural={getTag(event, 'names', 2) || getTag(event, 'names', 1) || 'list'}
          profiles={profiles}
        />
      )}
    </div>
  );
}


// ── Items Table with expandable trust breakdown ──────────────

function ItemsTable({
  rows, profiles, trustWeights, trustLoading, trustMethod,
  ratingsFetched, expandedItemId, pTagRequired, onToggleExpand, onRowClick,
}) {
  const [sortKey, setSortKey] = useState('trustScore');
  const [sortDir, setSortDir] = useState('desc');
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter) return rows;
    const lower = filter.toLowerCase();
    return rows.filter(row =>
      row.name.toLowerCase().includes(lower) ||
      row.author.toLowerCase().includes(lower) ||
      (profiles[row.author]?.name || '').toLowerCase().includes(lower) ||
      (row.pTagPubkey && (profiles[row.pTagPubkey]?.name || '').toLowerCase().includes(lower))
    );
  }, [rows, filter, profiles]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const columns = [
    ...(pTagRequired ? [{
      key: 'pTagPubkey',
      label: 'Profile',
      render: (val) => val
        ? <AuthorCell pubkey={val} profiles={profiles} />
        : <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>no p tag</span>,
    }] : []),
    { key: 'name', label: 'Name' },
    { key: 'kind', label: 'Kind' },
    { key: 'authorShort', label: 'Author' },
    { key: 'created_at', label: 'Age' },
    { key: 'upTotal', label: '👍' },
    { key: 'downTotal', label: '👎' },
    { key: 'trustScore', label: 'Trust Score*' },
  ];

  return (
    <div className="data-table-wrapper">
      <div className="table-controls">
        <input
          type="text"
          placeholder="Filter..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="table-filter"
        />
        <span className="table-count">{sorted.length} items</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} onClick={() => handleSort(col.key)} className="sortable">
                {col.label}
                {sortKey === col.key && (sortDir === 'asc' ? ' ▲' : ' ▼')}
              </th>
            ))}
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={columns.length + 1} className="empty-row">No items found</td></tr>
          ) : (
            sorted.map((row) => (
              <ItemRow
                key={row.id}
                row={row}
                profiles={profiles}
                trustWeights={trustWeights}
                trustLoading={trustLoading}
                trustMethod={trustMethod}
                ratingsFetched={ratingsFetched}
                isExpanded={expandedItemId === row.id}
                pTagRequired={pTagRequired}
                onToggleExpand={() => onToggleExpand(row.id)}
                onRowClick={() => onRowClick(row)}
                colCount={columns.length + 1}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}


// ── Single item row + expandable breakdown ───────────────────

function ItemRow({
  row, profiles, trustLoading, trustMethod,
  ratingsFetched, isExpanded, pTagRequired, onToggleExpand, onRowClick, colCount,
}) {
  function renderTrustScore() {
    if (!ratingsFetched || trustLoading) {
      return <span style={{ opacity: 0.3, fontSize: '0.85rem' }}>…</span>;
    }
    const s = row.trustScore;
    if (s == null) return <span style={{ opacity: 0.3 }}>—</span>;
    const color = s > 0 ? '#3fb950' : s < 0 ? '#f85149' : 'var(--text-muted, #888)';
    const display = trustMethod === 'follow-list' ? String(s) : s.toFixed(3);
    return <span style={{ color, fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: 600 }}>{display}</span>;
  }

  return (
    <>
      <tr className="clickable" onClick={onRowClick}>
        {pTagRequired && (
          <td>
            {row.pTagPubkey
              ? <AuthorCell pubkey={row.pTagPubkey} profiles={profiles} />
              : <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>no p tag</span>
            }
          </td>
        )}
        <td>{row.name}</td>
        <td>{row.kind}</td>
        <td><AuthorCell pubkey={row.author} profiles={profiles} /></td>
        <td>{row.age}</td>
        <td>
          {!ratingsFetched
            ? <span style={{ opacity: 0.3 }}>—</span>
            : row.upTotal > 0
              ? <span style={{ color: '#3fb950', fontWeight: 600 }}>{row.upTotal}</span>
              : <span style={{ opacity: 0.3 }}>0</span>
          }
        </td>
        <td>
          {!ratingsFetched
            ? <span style={{ opacity: 0.3 }}>—</span>
            : row.downTotal > 0
              ? <span style={{ color: '#f85149', fontWeight: 600 }}>{row.downTotal}</span>
              : <span style={{ opacity: 0.3 }}>0</span>
          }
        </td>
        <td>{renderTrustScore()}</td>
        <td style={{ textAlign: 'center' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-primary, #e0e0e0)', fontSize: '0.85rem',
              padding: '0.2rem 0.4rem', borderRadius: '4px',
              opacity: isExpanded ? 1 : 0.4,
            }}
            title="Show trust score breakdown"
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={colCount} style={{ padding: 0, border: 'none' }}>
            <TrustBreakdown
              breakdown={row.breakdown}
              totalScore={row.trustScore}
              profiles={profiles}
              trustMethod={trustMethod}
            />
          </td>
        </tr>
      )}
    </>
  );
}


// ── Trust Score Breakdown Panel ──────────────────────────────

function TrustBreakdown({ breakdown, totalScore, profiles, trustMethod }) {
  if (!breakdown || breakdown.length === 0) {
    return (
      <div style={{ padding: '0.75rem 1.5rem', fontSize: '0.8rem', opacity: 0.5 }}>
        No trust data available for this item.
      </div>
    );
  }

  function formatWeight(w) {
    if (w == null) return '—';
    if (trustMethod === 'follow-list') return w === 1 ? '1' : '0';
    return w.toFixed(3);
  }

  function formatContribution(c) {
    if (c == null) return '—';
    if (trustMethod === 'follow-list') return c > 0 ? `+${c}` : String(c);
    return c > 0 ? `+${c.toFixed(3)}` : c.toFixed(3);
  }

  function profileName(pk) {
    const p = profiles[pk];
    return p?.name || p?.display_name || shortPubkey(pk);
  }

  return (
    <div style={{
      margin: '0 1rem 0.5rem 1rem',
      padding: '0.75rem 1rem',
      backgroundColor: 'var(--bg-secondary, #1a1a2e)',
      border: '1px solid var(--border, #444)',
      borderRadius: '6px',
      fontSize: '0.8rem',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
        Trust Score Breakdown
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border, #444)', opacity: 0.6 }}>
            <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Source</th>
            <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Type</th>
            <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Trust Weight</th>
            <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Contribution</th>
            <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Note</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.map((entry, i) => {
            const isAuthor = entry.role === 'author';
            const typeLabel = entry.type === 'implicit-upvote' ? '👤 implicit +'
              : entry.type === 'implicit-upvote-cancelled' ? '👤 implicit + (cancelled)'
              : entry.type === 'explicit-downvote' ? '👎 author −'
              : entry.type === 'upvote' ? '👍 +'
              : entry.type === 'downvote' ? '👎 −'
              : '🔹 other';

            const contribColor = entry.contribution == null ? 'inherit'
              : entry.contribution > 0 ? '#3fb950'
              : entry.contribution < 0 ? '#f85149'
              : 'var(--text-muted, #888)';

            return (
              <tr key={i} style={{
                borderBottom: '1px solid var(--border, #333)',
                opacity: entry.contribution === 0 && entry.type !== 'implicit-upvote-cancelled' ? 0.5 : 1,
              }}>
                <td style={{ padding: '0.3rem 0.5rem' }}>
                  <Link
                    to={`/kg/users/${entry.pubkey}`}
                    style={{ color: '#58a6ff', textDecoration: 'none' }}
                    onClick={e => e.stopPropagation()}
                  >
                    {isAuthor ? `${profileName(entry.pubkey)} (author)` : profileName(entry.pubkey)}
                  </Link>
                </td>
                <td style={{ padding: '0.3rem 0.5rem' }}>{typeLabel}</td>
                <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>
                  {formatWeight(entry.weight)}
                </td>
                <td style={{
                  padding: '0.3rem 0.5rem', textAlign: 'right',
                  fontFamily: 'monospace', color: contribColor, fontWeight: 600,
                }}>
                  {formatContribution(entry.contribution)}
                </td>
                <td style={{ padding: '0.3rem 0.5rem', opacity: 0.6, fontSize: '0.75rem' }}>
                  {entry.note || ''}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid var(--border, #555)' }}>
            <td colSpan={3} style={{ padding: '0.4rem 0.5rem', fontWeight: 700 }}>
              Total Trust Score
            </td>
            <td style={{
              padding: '0.4rem 0.5rem', textAlign: 'right',
              fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9rem',
              color: totalScore > 0 ? '#3fb950' : totalScore < 0 ? '#f85149' : 'inherit',
            }}>
              {totalScore != null
                ? (trustMethod === 'follow-list' ? String(totalScore) : totalScore.toFixed(3))
                : '—'
              }
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}


// ── Trusted List Generation Panel ────────────────────────────

function TrustedListPanel({ items, trustScores, trustMethod, povPubkey, listNamePlural, profiles }) {
  const { user } = useAuth();
  const [tagType, setTagType] = useState('p');  // 'p' or 'e'
  const [includeScores, setIncludeScores] = useState(false);
  const [cutoff, setCutoff] = useState(2);
  const [showPreview, setShowPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(null);
  const [publishError, setPublishError] = useState(null);

  const methodSuffix = trustMethod === 'follow-list' ? 'follows' : `TA-rank`;
  const dTag = `curated-${slug(listNamePlural)}-by-${povPubkey}-${methodSuffix}`;
  const title = `Curated ${listNamePlural} (${trustMethod === 'follow-list' ? 'Follows' : 'TA rank'})`;
  const kind = tagType === 'p' ? 30392 : 30393;

  // Filter and sort items by trust score
  const qualifiedItems = useMemo(() => {
    return items
      .map(item => {
        const ts = trustScores[item.id];
        const pTag = item.tags?.find(t => t[0] === 'p')?.[1];
        const name = getTag(item, 'name') || '(unnamed)';
        return {
          id: item.id,
          pubkey: pTag,
          name,
          score: ts?.score ?? null,
          itemAuthor: item.pubkey,
        };
      })
      .filter(item => item.score != null && item.score >= cutoff)
      .sort((a, b) => b.score - a.score);
  }, [items, trustScores, cutoff]);

  // Build the preview event
  const previewEvent = useMemo(() => {
    const tags = [
      ['d', dTag],
      ['title', title],
    ];

    for (const item of qualifiedItems) {
      if (tagType === 'p' && item.pubkey) {
        const pTag = ['p', item.pubkey];
        if (includeScores) {
          pTag.push('');  // relay placeholder
          pTag.push(String(Math.round(item.score)));
        }
        tags.push(pTag);
      } else {
        const eTag = ['e', item.id];
        if (includeScores) {
          eTag.push('');  // relay placeholder
          eTag.push('');  // author placeholder
          eTag.push(String(Math.round(item.score)));
        }
        tags.push(eTag);
      }
    }

    return { kind, tags, content: '' };
  }, [qualifiedItems, tagType, includeScores, kind, dTag, title]);

  // Build items payload for API
  const apiItems = useMemo(() => {
    return qualifiedItems.map(item => {
      if (tagType === 'p' && item.pubkey) {
        return {
          tag: 'p',
          value: item.pubkey,
          score: includeScores ? String(Math.round(item.score)) : undefined,
        };
      }
      return {
        tag: 'e',
        value: item.id,
        score: includeScores ? String(Math.round(item.score)) : undefined,
      };
    });
  }, [qualifiedItems, tagType, includeScores]);

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    setPublished(null);

    try {
      const res = await fetch('/api/trusted-list/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          dTag,
          title,
          items: apiItems,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPublished(data);
      } else {
        setPublishError(data.error || 'Failed to publish');
      }
    } catch (err) {
      setPublishError(err.message);
    } finally {
      setPublishing(false);
    }
  }

  const povName = profiles[povPubkey]?.name || profiles[povPubkey]?.display_name || shortPubkey(povPubkey);

  return (
    <div style={{
      marginTop: '2rem',
      padding: '1.25rem',
      border: '1px solid var(--border, #444)',
      borderRadius: '8px',
      backgroundColor: 'var(--bg-secondary, #1a1a2e)',
    }}>
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem' }}>
        📜 Generate Trusted List
      </h3>
      <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '1rem' }}>
        Publish a kind {kind} Trusted List event summarizing the curated results.
        Signed by the Tapestry Assistant.
      </p>

      {/* Options */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {/* Tag type */}
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            Tag Type
          </label>
          <select
            value={tagType}
            onChange={e => setTagType(e.target.value)}
            style={{
              padding: '0.35rem 0.6rem', fontSize: '0.85rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
              border: '1px solid var(--border, #444)', borderRadius: '4px',
            }}
          >
            <option value="p">p-tags (kind 30392) — pubkeys</option>
            <option value="e">e-tags (kind 30393) — event IDs</option>
          </select>
        </div>

        {/* Cutoff threshold */}
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            Cutoff Threshold (≥)
          </label>
          <input
            type="number"
            value={cutoff}
            onChange={e => setCutoff(parseFloat(e.target.value) || 0)}
            step="0.1"
            style={{
              width: '80px', padding: '0.35rem 0.6rem', fontSize: '0.85rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
              border: '1px solid var(--border, #444)', borderRadius: '4px',
            }}
          />
        </div>

        {/* Include scores */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.4rem', paddingBottom: '0.15rem' }}>
          <input
            type="checkbox"
            id="include-scores"
            checked={includeScores}
            onChange={e => setIncludeScores(e.target.checked)}
          />
          <label htmlFor="include-scores" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
            Include trust scores in tags
          </label>
        </div>
      </div>

      {/* Summary */}
      <div style={{
        padding: '0.6rem 0.75rem',
        marginBottom: '1rem',
        fontSize: '0.85rem',
        border: '1px solid var(--border, #333)',
        borderRadius: '6px',
      }}>
        <div><strong>d-tag:</strong> <code style={{ fontSize: '0.8rem', color: '#58a6ff' }}>{dTag}</code></div>
        <div><strong>Kind:</strong> {kind} · <strong>Items qualifying:</strong> {qualifiedItems.length} of {items.length} (score ≥ {cutoff})</div>
        <div><strong>PoV:</strong> {povName} · <strong>Method:</strong> {trustMethod === 'follow-list' ? 'Follows' : 'TA rank'}</div>
      </div>

      {/* Qualified items preview list */}
      {qualifiedItems.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.4rem' }}>
            Items to include ({qualifiedItems.length}):
          </div>
          <div style={{
            maxHeight: '200px', overflowY: 'auto',
            border: '1px solid var(--border, #333)', borderRadius: '4px',
            fontSize: '0.8rem',
          }}>
            {qualifiedItems.map((item, i) => (
              <div key={item.id} style={{
                padding: '0.3rem 0.6rem',
                borderBottom: i < qualifiedItems.length - 1 ? '1px solid var(--border, #333)' : 'none',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{item.name}</span>
                <span style={{
                  fontFamily: 'monospace',
                  color: item.score > 0 ? '#3fb950' : item.score < 0 ? '#f85149' : 'inherit',
                }}>
                  {trustMethod === 'follow-list' ? item.score : item.score.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {qualifiedItems.length === 0 && (
        <p style={{ fontSize: '0.85rem', opacity: 0.5, marginBottom: '1rem' }}>
          No items meet the cutoff threshold of ≥ {cutoff}.
        </p>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button
          className="btn"
          onClick={() => setShowPreview(prev => !prev)}
          disabled={qualifiedItems.length === 0}
        >
          {showPreview ? '🔽 Hide Preview' : '👁️ Preview Event'}
        </button>
        {user ? (
          <button
            className="btn btn-primary"
            onClick={handlePublish}
            disabled={publishing || qualifiedItems.length === 0}
          >
            {publishing ? '⏳ Publishing…' : '📤 Publish Trusted List'}
          </button>
        ) : (
          <span style={{ fontSize: '0.8rem', opacity: 0.5, padding: '0.35rem 0' }}>
            🔒 Sign in to publish
          </span>
        )}
      </div>

      {/* Raw event preview */}
      {showPreview && (
        <pre style={{
          marginTop: '0.75rem',
          padding: '0.75rem',
          fontSize: '0.75rem',
          backgroundColor: 'var(--bg-primary, #0f0f23)',
          border: '1px solid var(--border, #444)',
          borderRadius: '6px',
          maxHeight: '300px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}>
          {JSON.stringify(previewEvent, null, 2)}
        </pre>
      )}

      {/* Publish result */}
      {published && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.6rem 0.75rem',
          border: '1px solid #3fb950',
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: '#3fb950',
        }}>
          ✅ Published! Event ID: <code>{published.event?.id?.slice(0, 16)}…</code>
          {' · '}UUID: <code>{published.uuid}</code>
        </div>
      )}

      {publishError && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.6rem 0.75rem',
          border: '1px solid #f85149',
          borderRadius: '6px',
          fontSize: '0.85rem',
          color: '#f85149',
        }}>
          ❌ {publishError}
        </div>
      )}
    </div>
  );
}

function slug(name) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
