import { useState, useEffect, useMemo } from 'react';
import { nip19 } from 'nostr-tools';

const TAB_BY_ACCOUNT = 'by-account';
const TAB_AGGREGATED = 'aggregated';

function decodeToHex(input) {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  try {
    const decoded = nip19.decode(trimmed);
    if (decoded.type === 'npub') return decoded.data;
    if (decoded.type === 'nprofile') return decoded.data.pubkey;
  } catch {}
  return null;
}

/* ── By-Account tab ────────────────────────────────────── */

function ByAccountTab() {
  const [input, setInput] = useState('');
  const [pubkey, setPubkey] = useState(null);
  const [relays, setRelays] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function search(e) {
    e?.preventDefault();
    const hex = decodeToHex(input);
    if (!hex) {
      setError('Enter a 64-char hex pubkey, npub, or nprofile.');
      setRelays(null);
      return;
    }
    setError(null);
    setPubkey(hex);
    setLoading(true);
    try {
      const resp = await fetch(`/api/relay-discovery/by-pubkey?pubkey=${hex}`);
      const data = await resp.json();
      if (!data.success) {
        setError(data.error || 'Failed to fetch');
        setRelays([]);
      } else {
        setRelays(data.relays || []);
      }
    } catch (err) {
      setError(err.message);
      setRelays([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rdisc-tab">
      <form onSubmit={search} className="rdisc-search-form">
        <input
          type="text"
          placeholder="npub1… or hex pubkey"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="rdisc-search-input"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <div className="rtp-error" style={{ marginTop: '0.8rem' }}>⚠️ {error}</div>}

      {pubkey && !loading && relays && (
        <div className="rdisc-results">
          <div className="rdisc-results-header">
            {relays.length} relay{relays.length === 1 ? '' : 's'} for{' '}
            <code>{pubkey.slice(0, 12)}…{pubkey.slice(-8)}</code>
            {' '}
            <a
              href={`/kg/brainstorm-search/user/${pubkey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bsp-id-link"
            >
              view full profile ↗
            </a>
          </div>
          {relays.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Relay URL</th>
                  <th>Source</th>
                  <th>Read</th>
                  <th>Write</th>
                </tr>
              </thead>
              <tbody>
                {relays.map((r) => (
                  <tr key={r.websocketUrl}>
                    <td>
                      <code>{r.websocketUrl}</code>
                      {r.httpUrl && (
                        <>
                          {' '}
                          <a href={r.httpUrl} target="_blank" rel="noopener noreferrer" className="bsp-id-link">↗</a>
                        </>
                      )}
                    </td>
                    <td>
                      {r.source === 'both'
                        ? 'NIP-65 + DCoSL'
                        : r.source === 'nip65'
                        ? 'NIP-65'
                        : 'DCoSL'}
                    </td>
                    <td>{r.read ? '✓' : ''}</td>
                    <td>{r.write ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Aggregated tab ────────────────────────────────────── */

function AggregatedTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tagFilter, setTagFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const qs = tagFilter ? `?tagSlug=${encodeURIComponent(tagFilter)}` : '';
        const resp = await fetch(`/api/relay-discovery/aggregated${qs}`);
        const body = await resp.json();
        if (cancelled) return;
        if (!body.success) throw new Error(body.error || 'Failed to fetch');
        setData(body);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tagFilter]);

  const tagMeta = data?.tagMeta || {};
  const tagSlugs = useMemo(() => Object.keys(tagMeta).sort(), [tagMeta]);

  return (
    <div className="rdisc-tab">
      <div className="rdisc-filter-bar">
        <span className="rtp-label">Filter by tag</span>
        <div className="rtp-picker">
          <button
            className={`rtp-tag-btn ${tagFilter === '' ? 'rtp-tag-btn-applied' : ''}`}
            onClick={() => setTagFilter('')}
          >
            {tagFilter === '' ? '✓ ' : ''}all
          </button>
          {tagSlugs.map((slug) => (
            <button
              key={slug}
              className={`rtp-tag-btn ${tagFilter === slug ? 'rtp-tag-btn-applied' : ''}`}
              onClick={() => setTagFilter(slug)}
              title={tagMeta[slug]?.description || ''}
            >
              {tagFilter === slug ? '✓ ' : ''}{tagMeta[slug]?.name || slug}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="rtp-loading" style={{ marginTop: '0.8rem' }}>Loading relays…</div>}
      {error && <div className="rtp-error" style={{ marginTop: '0.8rem' }}>⚠️ {error}</div>}

      {!loading && data && (
        <>
          <div className="rdisc-results-header">
            {data.count} relay{data.count === 1 ? '' : 's'} imported into Neo4j
            {tagFilter && ` — filtered to "${tagMeta[tagFilter]?.name || tagFilter}"`}
          </div>

          {data.relays.length === 0 ? (
            <div className="rtp-empty" style={{ marginTop: '0.8rem' }}>
              No relays match. User-published relays only appear here after they land in Neo4j
              (happens automatically on publish via BrainstormProfile → Relays → Publish).
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Relay URL</th>
                  <th>Endorsers</th>
                  <th>Tag applications</th>
                </tr>
              </thead>
              <tbody>
                {data.relays.map((r) => (
                  <tr key={r.websocketUrl}>
                    <td>
                      <code>{r.websocketUrl}</code>
                      {r.httpUrl && (
                        <>
                          {' '}
                          <a href={r.httpUrl} target="_blank" rel="noopener noreferrer" className="bsp-id-link">↗</a>
                        </>
                      )}
                    </td>
                    <td>{r.endorserCount}</td>
                    <td>
                      <div className="rtp-badges" style={{ margin: 0 }}>
                        {Object.entries(r.tagApplications).length === 0 ? (
                          <span className="rtp-empty" style={{ fontSize: '0.78rem' }}>—</span>
                        ) : (
                          Object.entries(r.tagApplications)
                            .sort((a, b) => b[1].count - a[1].count)
                            .map(([slug, info]) => (
                              <span key={slug} className="rtp-badge">
                                {tagMeta[slug]?.name || slug}
                                <span className="rtp-badge-count">{info.count}</span>
                              </span>
                            ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="rdisc-footer-note">
            Note: rankings currently reflect raw endorser and tag-application counts.
            Trust-weighted (WoT) aggregation per the GrapeRank plan is deferred.
          </div>
        </>
      )}
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────── */

export default function RelayDiscovery() {
  const [tab, setTab] = useState(TAB_BY_ACCOUNT);

  return (
    <div className="rdisc-page">
      <div className="page-header">
        <h1>Relay Discovery</h1>
        <p className="page-description">
          Find nostr relays via NIP-65 lists, DCoSL elements, and trust-weighted aggregation.
        </p>
      </div>

      <div className="rdisc-tabs">
        <button
          className={`rdisc-tab-btn ${tab === TAB_BY_ACCOUNT ? 'active' : ''}`}
          onClick={() => setTab(TAB_BY_ACCOUNT)}
        >
          By Account
        </button>
        <button
          className={`rdisc-tab-btn ${tab === TAB_AGGREGATED ? 'active' : ''}`}
          onClick={() => setTab(TAB_AGGREGATED)}
        >
          WoT Aggregated
        </button>
      </div>

      <div className="rdisc-panel">
        {tab === TAB_BY_ACCOUNT && <ByAccountTab />}
        {tab === TAB_AGGREGATED && <AggregatedTab />}
      </div>
    </div>
  );
}
