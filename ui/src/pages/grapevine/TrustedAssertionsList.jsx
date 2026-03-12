import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { queryRelay } from '../../api/relay';
import Breadcrumbs from '../../components/Breadcrumbs';

const KIND_TRUSTED_ASSERTIONS = 10040;
const KIND_ASSERTION = 30382;
const QUERY_LIMIT = 10;

function formatAge(ts) {
  if (!ts) return '—';
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortId(id) {
  if (!id) return '—';
  return id.slice(0, 12) + '…';
}

export default function TrustedAssertionsList() {
  const { user } = useAuth();

  // Step 1: Find the owner's Treasure Map in local strfry
  const [treasureMap, setTreasureMap] = useState(null);
  const [tmLoading, setTmLoading] = useState(false);
  const [tmSearched, setTmSearched] = useState(false);

  // Step 2: Fetch 30382:rank assertions
  const [assertions, setAssertions] = useState([]);
  const [aLoading, setALoading] = useState(false);
  const [aSearched, setASearched] = useState(false);
  const [aError, setAError] = useState(null);

  // Expanded raw view per event
  const [expanded, setExpanded] = useState(new Set());

  // Parse the Treasure Map tags to find 30382:rank entry
  const rankTag = useMemo(() => {
    if (!treasureMap) return null;
    return treasureMap.tags?.find(t => t[0] === '30382:rank');
  }, [treasureMap]);

  // All assertion type tags from the Treasure Map
  const assertionTypes = useMemo(() => {
    if (!treasureMap) return [];
    return treasureMap.tags
      ?.filter(t => t[0]?.startsWith('30382:'))
      .map(t => ({
        type: t[0],
        label: t[0].replace('30382:', ''),
        author: t[1],
        relay: t[2],
      })) || [];
  }, [treasureMap]);

  // Step 1: Search local strfry for the Treasure Map
  useEffect(() => {
    if (!user?.pubkey || tmSearched) return;

    async function findTreasureMap() {
      setTmLoading(true);
      try {
        const events = await queryRelay({
          kinds: [KIND_TRUSTED_ASSERTIONS],
          authors: [user.pubkey],
          limit: 1,
        });
        if (events.length > 0) {
          setTreasureMap(events[0]);
        }
      } catch (err) {
        console.error('Error finding Treasure Map:', err);
      } finally {
        setTmLoading(false);
        setTmSearched(true);
      }
    }

    findTreasureMap();
  }, [user?.pubkey, tmSearched]);

  // Step 2: When Treasure Map is found and has a rank tag, fetch assertions
  const fetchAssertions = useCallback(async () => {
    if (!rankTag) return;

    const author = rankTag[1];
    const relay = rankTag[2];

    if (!author || !relay) return;

    setALoading(true);
    setAError(null);
    setAssertions([]);

    try {
      const filter = JSON.stringify({
        kinds: [KIND_ASSERTION],
        authors: [author],
        limit: QUERY_LIMIT,
      });
      const res = await fetch(
        `/api/relay/external?filter=${encodeURIComponent(filter)}&relays=${encodeURIComponent(relay)}`
      );
      const data = await res.json();
      if (data.success) {
        // Sort by created_at descending
        const sorted = (data.events || []).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        setAssertions(sorted);
      } else {
        setAError(data.error || 'Failed to fetch assertions');
      }
    } catch (err) {
      setAError(err.message);
    } finally {
      setALoading(false);
      setASearched(true);
    }
  }, [rankTag]);

  useEffect(() => {
    if (rankTag && !aSearched && !aLoading) {
      fetchAssertions();
    }
  }, [rankTag]);

  const toggleExpand = useCallback((id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (!user) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>📜 Trusted Assertions</h1>
        <p className="subtitle">Sign in with a nostr extension (NIP-07) to view Trusted Assertions.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>📜 Trusted Assertions</h1>
      <p className="subtitle">
        Kind {KIND_ASSERTION} Trusted Assertion events referenced by your Treasure Map.
      </p>

      {/* Step 1: Treasure Map status */}
      {tmLoading && (
        <StatusBox icon="⏳" color="inherit" title="Searching for TA Treasure Map in local strfry…" />
      )}

      {tmSearched && !treasureMap && (
        <div style={{
          padding: '1.25rem',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          marginBottom: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, color: '#f59e0b' }}>
                TA Treasure Map not found in local strfry
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.25rem' }}>
                The Trusted Assertions page requires your kind {KIND_TRUSTED_ASSERTIONS} Treasure Map to be present locally.
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <Link
                  to="/kg/grapevine/trusted-assertions"
                  style={{ color: '#58a6ff', fontWeight: 600, fontSize: '0.9rem' }}
                >
                  Go to TA Treasure Map page →
                </Link>
                <span style={{ fontSize: '0.8rem', opacity: 0.5, marginLeft: '0.5rem' }}>
                  (search external relays and import)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Treasure Map found — show assertion types and results */}
      {treasureMap && (
        <>
          <StatusBox
            icon="✅"
            color="#3fb950"
            title="TA Treasure Map found locally"
            subtitle={`${assertionTypes.length} assertion type${assertionTypes.length !== 1 ? 's' : ''} listed`}
          />

          {/* Assertion type summary */}
          <div style={{
            padding: '1rem',
            border: '1px solid var(--border, #444)',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-secondary, #1a1a2e)',
            marginBottom: '1rem',
          }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Assertion Types in Treasure Map</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {assertionTypes.map(at => (
                <span
                  key={at.type}
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.75rem',
                    backgroundColor: at.label === 'rank' ? 'rgba(88, 166, 255, 0.15)' : 'var(--bg-primary, #0f0f23)',
                    border: `1px solid ${at.label === 'rank' ? '#58a6ff' : 'var(--border, #444)'}`,
                    borderRadius: '4px',
                    fontWeight: at.label === 'rank' ? 600 : 400,
                  }}
                >
                  {at.label}
                </span>
              ))}
            </div>
            {rankTag && (
              <div style={{ fontSize: '0.75rem', opacity: 0.5, marginTop: '0.5rem' }}>
                Querying <strong>30382:rank</strong> from{' '}
                <code>{rankTag[2]}</code> by{' '}
                <code>{rankTag[1]?.slice(0, 12)}…</code>
              </div>
            )}
          </div>

          {/* Loading assertions */}
          {aLoading && (
            <StatusBox icon="⏳" color="inherit" title={`Fetching up to ${QUERY_LIMIT} rank assertions…`} />
          )}

          {aError && (
            <div style={{
              padding: '0.75rem 1rem',
              border: '1px solid #f85149',
              borderRadius: '8px',
              backgroundColor: 'rgba(248, 81, 73, 0.08)',
              color: '#f85149',
              fontSize: '0.9rem',
              marginBottom: '1rem',
            }}>
              Error: {aError}
            </div>
          )}

          {/* Assertions results */}
          {aSearched && !aLoading && !aError && assertions.length === 0 && (
            <StatusBox
              icon="🔍"
              color="#f59e0b"
              title="No kind 30382:rank assertions found"
              subtitle={`Queried ${rankTag?.[2]} with limit ${QUERY_LIMIT}`}
            />
          )}

          {assertions.length > 0 && (
            <div style={{
              border: '1px solid var(--border, #444)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--bg-secondary, #1a1a2e)',
                borderBottom: '1px solid var(--border, #444)',
                fontSize: '0.85rem',
                fontWeight: 600,
              }}>
                Showing {assertions.length} of {QUERY_LIMIT} (limit) rank assertions
              </div>

              {assertions.map((ev, idx) => {
                const isExpanded = expanded.has(ev.id);
                const dTag = ev.tags?.find(t => t[0] === 'd')?.[1] || '—';
                // Try to extract the target pubkey from the d-tag or p tag
                const pTag = ev.tags?.find(t => t[0] === 'p')?.[1];
                let content = {};
                try { content = JSON.parse(ev.content || '{}'); } catch {}

                return (
                  <div
                    key={ev.id}
                    style={{
                      borderBottom: idx < assertions.length - 1 ? '1px solid var(--border, #333)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.6rem 1rem',
                        cursor: 'pointer',
                        backgroundColor: isExpanded ? 'rgba(88, 166, 255, 0.05)' : 'transparent',
                      }}
                      onClick={() => toggleExpand(ev.id)}
                    >
                      <span style={{ fontSize: '0.8rem', opacity: 0.5, width: '1.5rem' }}>
                        {isExpanded ? '▾' : '▸'}
                      </span>
                      <code style={{ fontSize: '0.75rem', opacity: 0.6, minWidth: '90px' }}>
                        {shortId(ev.id)}
                      </code>
                      <span style={{ fontSize: '0.8rem', flex: 1 }}>
                        <strong>d:</strong>{' '}
                        <code style={{ fontSize: '0.75rem' }}>{dTag.length > 40 ? dTag.slice(0, 40) + '…' : dTag}</code>
                      </span>
                      {pTag && (
                        <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                          p: {pTag.slice(0, 8)}…
                        </span>
                      )}
                      {content.score !== undefined && (
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          padding: '0.1rem 0.4rem',
                          backgroundColor: 'rgba(63, 185, 80, 0.15)',
                          borderRadius: '3px',
                          color: '#3fb950',
                        }}>
                          {typeof content.score === 'number' ? content.score.toFixed(4) : content.score}
                        </span>
                      )}
                      <span style={{ fontSize: '0.72rem', opacity: 0.4 }}>
                        {formatAge(ev.created_at)}
                      </span>
                    </div>

                    {isExpanded && (
                      <pre style={{
                        margin: 0,
                        padding: '0.75rem 1rem 0.75rem 3.25rem',
                        backgroundColor: 'var(--bg-primary, #0f0f23)',
                        fontSize: '0.72rem',
                        overflow: 'auto',
                        maxHeight: '300px',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        borderTop: '1px solid var(--border, #333)',
                      }}>
                        {JSON.stringify(ev, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────── */

function StatusBox({ icon, color, title, subtitle }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 1rem',
      border: '1px solid var(--border, #444)',
      borderRadius: '8px',
      backgroundColor: 'var(--bg-secondary, #1a1a2e)',
      marginBottom: '1rem',
    }}>
      <span style={{ fontSize: '1.3rem' }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 600, color }}>{title}</div>
        {subtitle && <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.15rem' }}>{subtitle}</div>}
      </div>
    </div>
  );
}
