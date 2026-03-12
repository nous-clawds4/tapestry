import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { queryRelay } from '../../api/relay';
import { useCypher } from '../../hooks/useCypher';
import Breadcrumbs from '../../components/Breadcrumbs';

const KIND_TRUSTED_ASSERTIONS = 10040;

export default function TrustedAssertions() {
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [inLocal, setInLocal] = useState(false);
  const [importingLocal, setImportingLocal] = useState(false);

  // Fetch general-purpose relay URLs from the concept graph
  const { data: relayData } = useCypher(`
    MATCH (s {name: 'general purpose relays'})-[:IS_A_SUPERSET_OF*0..3]->(ss)-[:HAS_ELEMENT]->(e)
    OPTIONAL MATCH (e)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    RETURN e.name AS name, jt.value AS json
  `);

  const relayUrls = useMemo(() => {
    if (!relayData) return [];
    const urls = [];
    for (const r of relayData) {
      if (!r.json) continue;
      try {
        const parsed = JSON.parse(r.json);
        const url = parsed?.nostrRelay?.websocketUrl;
        if (url) urls.push(url);
      } catch {}
    }
    return urls;
  }, [relayData]);

  const search = useCallback(async () => {
    if (!user?.pubkey) return;
    setLoading(true);
    setError(null);
    setEvent(null);

    try {
      // Search local strfry first
      const localEvents = await queryRelay({
        kinds: [KIND_TRUSTED_ASSERTIONS],
        authors: [user.pubkey],
        limit: 1,
      });

      if (localEvents.length > 0) {
        setEvent(localEvents[0]);
        setInLocal(true);
        setSearched(true);
        setLoading(false);
        return;
      }

      // Search external relays
      if (relayUrls.length > 0) {
        const filter = JSON.stringify({
          kinds: [KIND_TRUSTED_ASSERTIONS],
          authors: [user.pubkey],
          limit: 1,
        });
        const res = await fetch(
          `/api/relay/external?filter=${encodeURIComponent(filter)}&relays=${encodeURIComponent(relayUrls.join(','))}`
        );
        const data = await res.json();
        if (data.success && data.events?.length > 0) {
          // Use the most recent one
          const sorted = data.events.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
          setEvent(sorted[0]);
          setInLocal(false);
          setSearched(true);
          setLoading(false);
          return;
        }
      }

      // Not found
      setSearched(true);
    } catch (err) {
      setError(err.message);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [user?.pubkey, relayUrls]);

  // Import event to local strfry
  const importToLocal = useCallback(async () => {
    if (!event) return;
    setImportingLocal(true);
    try {
      const res = await fetch('/api/strfry/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, signAs: 'client' }),
      });
      const data = await res.json();
      if (data.success) {
        setInLocal(true);
      } else {
        console.error('Import failed:', data.error);
      }
    } catch (err) {
      console.error('Import error:', err);
    } finally {
      setImportingLocal(false);
    }
  }, [event]);

  // Auto-search when user is available
  useEffect(() => {
    if (user?.pubkey && !searched && !loading) {
      search();
    }
  }, [user?.pubkey]);

  if (!user) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>🍇 TA Treasure Map</h1>
        <p className="subtitle">Sign in with a nostr extension (NIP-07) to view your Trusted Assertions Treasure Map.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🍇 TA Treasure Map</h1>
      <p className="subtitle">
        Your kind {KIND_TRUSTED_ASSERTIONS} Trusted Assertions Treasure Map — the entry point to your Grapevine.
      </p>

      {loading && (
        <div style={{
          padding: '1rem',
          border: '1px solid var(--border, #444)',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        }}>
          <p style={{ opacity: 0.6 }}>⏳ Searching local strfry and general-purpose relays…</p>
        </div>
      )}

      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          border: '1px solid #f85149',
          borderRadius: '8px',
          backgroundColor: 'rgba(248, 81, 73, 0.08)',
          color: '#f85149',
          fontSize: '0.9rem',
          marginBottom: '1rem',
        }}>
          Error: {error}
        </div>
      )}

      {/* Event found */}
      {!loading && searched && event && (
        <div style={{
          padding: '1.25rem',
          border: '1px solid var(--border, #444)',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>✅</span>
              <div>
                <div style={{ fontWeight: 600, color: '#3fb950' }}>Trusted Assertions Treasure Map found</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.25rem' }}>
                  Kind {event.kind} · Created {new Date(event.created_at * 1000).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Local strfry status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--bg-primary, #0f0f23)',
            border: '1px solid var(--border, #444)',
            borderRadius: '6px',
            marginBottom: '1rem',
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Local Strfry:</span>
            {inLocal ? (
              <span style={{ color: '#3fb950' }}>● Present</span>
            ) : (
              <>
                <span style={{ opacity: 0.6 }}>○ Not present</span>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={importToLocal}
                  disabled={importingLocal}
                  style={{ fontSize: '0.75rem', marginLeft: '0.5rem' }}
                >
                  {importingLocal ? '⏳ Importing…' : '📥 Import to local strfry'}
                </button>
              </>
            )}
          </div>

          {/* Summary info */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}>
            <InfoCard label="Event ID" value={event.id?.slice(0, 16) + '…'} mono />
            <InfoCard label="Tags" value={`${event.tags?.length || 0} tags`} />
            <InfoCard
              label="Content"
              value={event.content ? `${event.content.length} chars` : '(empty)'}
            />
          </div>

          {/* Tag summary */}
          {event.tags?.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', opacity: 0.7 }}>Tag Summary</h4>
              <TagSummary tags={event.tags} />
            </div>
          )}

          {/* Raw event toggle */}
          <button
            className="btn btn-sm"
            onClick={() => setShowRaw(v => !v)}
            style={{ fontSize: '0.8rem' }}
          >
            {showRaw ? '▾ Hide raw event' : '▸ Show raw event'}
          </button>
          {showRaw && (
            <pre style={{
              marginTop: '0.75rem',
              padding: '1rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)',
              border: '1px solid var(--border, #444)',
              borderRadius: '6px',
              fontSize: '0.75rem',
              overflow: 'auto',
              maxHeight: '400px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}>
              {JSON.stringify(event, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Not found */}
      {!loading && searched && !event && (
        <div style={{
          padding: '1.25rem',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔍</span>
            <div>
              <div style={{ fontWeight: 600, color: '#f59e0b' }}>No Trusted Assertions event found</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.25rem' }}>
                Searched local strfry{relayUrls.length > 0 ? ` and ${relayUrls.length} general-purpose relays` : ''}.
              </div>
            </div>
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <p style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>
              <strong>Do you want to have your Grapevine calculated?</strong><br />
              You can do so at one of these Web of Trust Service Providers:
            </p>
            <div style={{
              padding: '0.75rem 1rem',
              border: '1px solid var(--border, #444)',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-primary, #0f0f23)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <span style={{ fontSize: '1.5rem' }}>🧠</span>
              <div>
                <a
                  href="https://brainstorm.nosfabrica.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontWeight: 600, fontSize: '1rem', color: '#58a6ff' }}
                >
                  NosFabrica's Brainstorm →
                </a>
                <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.15rem' }}>
                  brainstorm.nosfabrica.com
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helper Components ─────────────────────────────────── */

function InfoCard({ label, value, mono }) {
  return (
    <div style={{
      padding: '0.5rem 0.75rem',
      backgroundColor: 'var(--bg-primary, #0f0f23)',
      border: '1px solid var(--border, #444)',
      borderRadius: '6px',
    }}>
      <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{
        fontSize: '0.9rem',
        fontWeight: 600,
        marginTop: '0.15rem',
        fontFamily: mono ? 'monospace' : 'inherit',
      }}>
        {value}
      </div>
    </div>
  );
}

function TagSummary({ tags }) {
  // Group tags by type and count
  const groups = {};
  for (const tag of tags) {
    const type = tag[0] || '(empty)';
    groups[type] = (groups[type] || 0) + 1;
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      {Object.entries(groups)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => (
          <span
            key={type}
            style={{
              padding: '0.2rem 0.5rem',
              fontSize: '0.75rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)',
              border: '1px solid var(--border, #444)',
              borderRadius: '4px',
            }}
          >
            <strong>{type}</strong>: {count}
          </span>
        ))}
    </div>
  );
}
