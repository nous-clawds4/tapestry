import { useState, useEffect, useMemo, useCallback } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { queryRelay } from '../../api/relay';
import { useCypher } from '../../hooks/useCypher';
import DataTable from '../../components/DataTable';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';
import useTrustWeights from '../../hooks/useTrustWeights';
import { useTrust, SCORING_METHODS } from '../../context/TrustContext';

function formatAge(ts) {
  if (!ts) return '—';
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const SOURCE_LOCAL = '__local__';

export default function DListItemRatings() {
  const { event } = useOutletContext();
  const [reactions, setReactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSource, setActiveSource] = useState(SOURCE_LOCAL);
  const [pendingSource, setPendingSource] = useState(SOURCE_LOCAL);
  const [fetched, setFetched] = useState(false);
  const [localIds, setLocalIds] = useState(new Set());
  const [neo4jIds, setNeo4jIds] = useState(new Set());
  const [importingStrfry, setImportingStrfry] = useState(new Set());
  const [importingNeo4j, setImportingNeo4j] = useState(new Set());

  // Fetch all relay sets from the nostr relay concept
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

  // Check which reaction event IDs exist in Neo4j
  const checkNeo4j = useCallback(async (eventIds) => {
    if (eventIds.length === 0) return;
    try {
      const idList = eventIds.map(id => `'${id}'`).join(',');
      const res = await fetch(`/api/neo4j/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cypher: `MATCH (e:NostrEvent) WHERE e.id IN [${idList}] RETURN e.id AS id`,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setNeo4jIds(new Set(data.data.map(r => r.id)));
      }
    } catch {}
  }, []);

  // Fetch reactions from the selected source
  const fetchReactions = useCallback(async () => {
    if (!event?.id) return;

    setLoading(true);
    setError(null);
    setReactions([]);
    setActiveSource(pendingSource);

    try {
      let fetchedEvents;
      if (pendingSource === SOURCE_LOCAL) {
        fetchedEvents = await queryRelay({ kinds: [7], '#e': [event.id] });
        setLocalIds(new Set(fetchedEvents.map(e => e.id)));
      } else {
        const set = relaySets.find(s => s.uuid === pendingSource);
        if (!set || set.relays.length === 0) {
          setError('No relays found in the selected set');
          return;
        }
        const urls = set.relays.map(r => r.url);
        const res = await fetch(
          `/api/reactions/external?eventId=${event.id}&relays=${encodeURIComponent(urls.join(','))}`
        );
        const data = await res.json();
        if (!data.success) {
          setError(data.error || 'Failed to fetch from external relays');
          return;
        }
        fetchedEvents = data.events;

        // Check which exist locally
        const localEvents = await queryRelay({ kinds: [7], '#e': [event.id] });
        setLocalIds(new Set(localEvents.map(e => e.id)));
      }

      setReactions(fetchedEvents);
      // Check Neo4j for all fetched events
      await checkNeo4j(fetchedEvents.map(e => e.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [event?.id, pendingSource, relaySets, checkNeo4j]);

  // Auto-fetch on initial load
  useEffect(() => {
    if (event?.id && !fetched) {
      fetchReactions();
    }
  }, [event?.id]);

  // Import to strfry
  const importToStrfry = useCallback(async (row) => {
    const evId = row.id;
    setImportingStrfry(prev => new Set([...prev, evId]));
    try {
      const fullEvent = reactions.find(e => e.id === evId);
      if (!fullEvent) return;
      const res = await fetch('/api/strfry/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: fullEvent, signAs: 'client' }),
      });
      const data = await res.json();
      if (data.success) {
        setLocalIds(prev => new Set([...prev, evId]));
      }
    } catch (err) {
      console.error('Strfry import error:', err);
    } finally {
      setImportingStrfry(prev => { const n = new Set(prev); n.delete(evId); return n; });
    }
  }, [reactions]);

  // Import to Neo4j (event must be in strfry first)
  const importToNeo4j = useCallback(async (row) => {
    const evId = row.id;
    setImportingNeo4j(prev => new Set([...prev, evId]));
    try {
      // Ensure it's in strfry first
      if (!localIds.has(evId)) {
        const fullEvent = reactions.find(e => e.id === evId);
        if (!fullEvent) return;
        const pubRes = await fetch('/api/strfry/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: fullEvent, signAs: 'client' }),
        });
        const pubData = await pubRes.json();
        if (pubData.success) {
          setLocalIds(prev => new Set([...prev, evId]));
        } else {
          console.error('Strfry import failed:', pubData.error);
          return;
        }
      }

      // Now import to Neo4j
      const res = await fetch('/api/neo4j/event-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: evId }),
      });
      const data = await res.json();
      if (data.success) {
        setNeo4jIds(prev => new Set([...prev, evId]));
      } else {
        console.error('Neo4j import failed:', data.error);
      }
    } catch (err) {
      console.error('Neo4j import error:', err);
    } finally {
      setImportingNeo4j(prev => { const n = new Set(prev); n.delete(evId); return n; });
    }
  }, [reactions, localIds]);

  const sourceChanged = pendingSource !== activeSource;

  // Derive author pubkeys directly from reactions (not rows) to avoid circular dep
  const authorPubkeys = useMemo(
    () => [...new Set(reactions.map(e => e.pubkey).filter(Boolean))],
    [reactions]
  );
  const { povPubkey: trustPovEarly } = useTrust();
  const allProfilePubkeys = useMemo(
    () => [...new Set([...authorPubkeys, trustPovEarly].filter(Boolean))],
    [authorPubkeys, trustPovEarly]
  );
  const profiles = useProfiles(allProfilePubkeys);

  // Trust weights
  const {
    weights: trustWeights,
    loading: trustLoading,
    error: trustError,
    povPubkey: trustPov,
    scoringMethod: trustMethod,
  } = useTrustWeights(authorPubkeys);

  const trustMethodLabel = useMemo(
    () => SCORING_METHODS.find(m => m.id === trustMethod)?.label || trustMethod,
    [trustMethod]
  );

  const rows = useMemo(() => {
    return reactions.map(ev => {
      const content = (ev.content || '').trim();
      let type;
      if (content === '+' || content === '👍' || content === '🤙') {
        type = 'upvote';
      } else if (content === '-' || content === '👎') {
        type = 'downvote';
      } else {
        type = 'other';
      }
      return {
        id: ev.id,
        author: ev.pubkey,
        content,
        type,
        created_at: ev.created_at,
        age: formatAge(ev.created_at),
        inLocal: localIds.has(ev.id),
        inNeo4j: neo4jIds.has(ev.id),
        trustWeight: trustWeights[ev.pubkey],
      };
    }).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  }, [reactions, localIds, neo4jIds, trustWeights]);

  const upvotes = rows.filter(r => r.type === 'upvote').length;
  const downvotes = rows.filter(r => r.type === 'downvote').length;
  const other = rows.filter(r => r.type === 'other').length;

  const sourceLabel = activeSource === SOURCE_LOCAL
    ? 'local strfry'
    : (relaySets.find(s => s.uuid === activeSource)?.name || 'external relays');

  const columns = [
    {
      key: 'type',
      label: 'Vote',
      render: (val) => {
        if (val === 'upvote') return <span style={{ color: '#3fb950', fontSize: '1.1rem' }} title="Upvote (+)">👍</span>;
        if (val === 'downvote') return <span style={{ color: '#f85149', fontSize: '1.1rem' }} title="Downvote (-)">👎</span>;
        return <span style={{ opacity: 0.6 }} title="Other reaction">🔹</span>;
      },
    },
    {
      key: 'content',
      label: 'Content',
      render: (val) => <code style={{ fontSize: '0.85rem' }}>{val || '(empty)'}</code>,
    },
    {
      key: 'author',
      label: 'Author',
      render: (val) => <AuthorCell pubkey={val} profiles={profiles} />,
    },
    {
      key: 'trustWeight',
      label: 'Trust Weight*',
      render: (val) => {
        if (trustLoading) return <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>…</span>;
        if (val == null) return <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>—</span>;
        const color = val >= 1 ? '#3fb950' : val > 0 ? '#d29922' : 'var(--text-muted, #888)';
        const display = trustMethod === 'follow-list'
          ? (val === 1 ? '1' : '0')
          : val.toFixed(3);
        return <span style={{ color, fontFamily: 'monospace', fontSize: '0.85rem' }}>{display}</span>;
      },
    },
    {
      key: 'created_at',
      label: 'Age',
      render: (_val, row) => row.age,
    },
    {
      key: 'inLocal',
      label: 'Strfry',
      render: (val, row) => {
        if (val) return <span style={{ color: '#3fb950' }} title="In local strfry">●</span>;
        const isImporting = importingStrfry.has(row.id);
        return (
          <button
            className="btn btn-sm"
            disabled={isImporting}
            onClick={(e) => { e.stopPropagation(); importToStrfry(row); }}
            style={{ fontSize: '0.72rem', whiteSpace: 'nowrap', padding: '0.15rem 0.4rem' }}
            title="Import this event to local strfry"
          >
            {isImporting ? '⏳' : '📥 Import'}
          </button>
        );
      },
    },
    {
      key: 'inNeo4j',
      label: 'Neo4j',
      render: (val, row) => {
        if (val) return <span style={{ color: '#3fb950' }} title="In Neo4j">●</span>;
        const isImporting = importingNeo4j.has(row.id);
        return (
          <button
            className="btn btn-sm"
            disabled={isImporting}
            onClick={(e) => { e.stopPropagation(); importToNeo4j(row); }}
            style={{ fontSize: '0.72rem', whiteSpace: 'nowrap', padding: '0.15rem 0.4rem' }}
            title={row.inLocal ? 'Import to Neo4j' : 'Import to strfry + Neo4j'}
          >
            {isImporting ? '⏳' : '📥 Import'}
          </button>
        );
      },
    },
    {
      key: 'id',
      label: 'Event ID',
      render: (val) => (
        <code style={{ fontSize: '0.72rem', opacity: 0.6 }}>
          {val?.slice(0, 12)}…
        </code>
      ),
    },
  ];

  return (
    <div>
      <h2>⭐ Ratings</h2>
      <p className="subtitle">
        Kind 7 (NIP-25) reactions referencing this list item.
      </p>

      {/* Source selector */}
      <div style={{
        display: 'flex', gap: '0.75rem', alignItems: 'flex-end',
        marginBottom: '1rem',
        padding: '1rem',
        border: '1px solid var(--border, #444)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            📡 Source
          </label>
          <select
            value={pendingSource}
            onChange={e => setPendingSource(e.target.value)}
            style={{
              width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
              border: '1px solid var(--border, #444)', borderRadius: '4px', cursor: 'pointer',
            }}
          >
            <option value={SOURCE_LOCAL}>Local strfry</option>
            {relaySets.map(s => (
              <option key={s.uuid} value={s.uuid}>{s.label}</option>
            ))}
          </select>
          {pendingSource !== SOURCE_LOCAL && (() => {
            const set = relaySets.find(s => s.uuid === pendingSource);
            return set && set.relays.length > 0 ? (
              <div style={{ fontSize: '0.72rem', opacity: 0.5, marginTop: '0.25rem' }}>
                {set.relays.map(r => r.url).join(', ')}
              </div>
            ) : null;
          })()}
        </div>
        {sourceChanged && (
          <button
            className="btn btn-primary"
            onClick={fetchReactions}
            disabled={loading}
            style={{ whiteSpace: 'nowrap' }}
          >
            {loading ? '⏳ Fetching…' : '🔄 Fetch Ratings'}
          </button>
        )}
      </div>

      {loading && <p style={{ opacity: 0.6 }}>Fetching reactions…</p>}
      {error && <p className="error">Error: {error}</p>}

      {!loading && fetched && (
        <>
          <div style={{
            display: 'flex', gap: '1.5rem', marginBottom: '1rem',
            padding: '0.75rem 1rem',
            border: '1px solid var(--border, #444)',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-secondary, #1a1a2e)',
            fontSize: '0.9rem',
          }}>
            <span>👍 <strong>{upvotes}</strong> upvote{upvotes !== 1 ? 's' : ''}</span>
            <span>👎 <strong>{downvotes}</strong> downvote{downvotes !== 1 ? 's' : ''}</span>
            {other > 0 && <span>🔹 <strong>{other}</strong> other</span>}
            <span style={{ opacity: 0.5 }}>({rows.length} total from {sourceLabel})</span>
          </div>

          <DataTable
            columns={columns}
            data={rows}
            emptyMessage="No reactions found for this list item"
          />

          {/* Trust method footnote */}
          {(() => {
            const povProfile = profiles[trustPov];
            const povName = povProfile?.name || povProfile?.display_name || (trustPov ? trustPov.slice(0, 12) + '…' : '—');
            return (
              <div style={{
                marginTop: '0.75rem',
                fontSize: '0.75rem',
                opacity: 0.65,
                lineHeight: 1.7,
              }}>
                <div>
                  <span>* Trust Weight determined by </span>
                  <Link
                    to="/kg/grapevine/trust-determination"
                    style={{ color: '#58a6ff', textDecoration: 'none' }}
                  >
                    {trustMethodLabel}
                  </Link>
                  <span> · PoV: </span>
                  <Link
                    to={`/kg/users/${trustPov}`}
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
            );
          })()}
        </>
      )}
    </div>
  );
}
