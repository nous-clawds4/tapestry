import React, { useState, useEffect, useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import { useAuth } from '../../context/AuthContext';
import { useTrust, SCORING_METHODS } from '../../context/TrustContext';
import useTrustWeights from '../../hooks/useTrustWeights';
import { fetchFromRelays, publishEverywhere, PUBLISH_RELAYS } from '../../utils/nostrPublish';

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

/* ── Demo setup panel (WoT seed data helper) ──────────── */

function DemoPanel() {
  const { user } = useAuth();
  const [info, setInfo] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/relay-discovery/demo-actors');
        const body = await resp.json();
        if (cancelled) return;
        setInfo(body);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  if (!info || !info.available) return null;

  const goodActorPubkeys = Object.values(info.goodActors || {});
  const badActorPubkeys = Object.values(info.badActors || {});

  async function followAllGoodActors() {
    if (!user) {
      setError('Log in with NIP-07 first.');
      return;
    }
    if (!window.nostr) {
      setError('No NIP-07 extension detected.');
      return;
    }
    setError(null);
    setResult(null);
    setPublishing(true);
    try {
      // Pull the current kind-3 (if any) so we append rather than overwrite.
      const existing = await fetchFromRelays(
        { kinds: [3], authors: [user.pubkey], limit: 1 },
        PUBLISH_RELAYS,
      );
      const latest = existing.length > 0
        ? existing.reduce((a, b) => (a.created_at > b.created_at ? a : b))
        : null;
      const existingTags = latest?.tags || [];
      const alreadyFollowed = new Set(
        existingTags.filter((t) => t[0] === 'p' && t[1]).map((t) => t[1]),
      );
      const toAdd = goodActorPubkeys.filter((pk) => !alreadyFollowed.has(pk));
      if (toAdd.length === 0) {
        setResult({ added: 0, total: goodActorPubkeys.length, alreadyFollowed: true });
        setPublishing(false);
        return;
      }
      const newTags = [...existingTags, ...toAdd.map((pk) => ['p', pk])];
      const signed = await window.nostr.signEvent({
        kind: 3,
        pubkey: user.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: newTags,
        content: latest?.content || '',
      });
      const pubResult = await publishEverywhere(signed);
      const localOk = pubResult?.local?.success;
      const externalOk = (pubResult?.external?.successes?.length || 0) > 0;
      if (!localOk && !externalOk) {
        throw new Error(pubResult?.local?.error || 'Publish failed on every relay.');
      }
      setResult({ added: toAdd.length, total: goodActorPubkeys.length });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="rdisc-demo-panel">
      <div className="rdisc-demo-title">🧪 WoT Demo Setup</div>
      <div className="rdisc-demo-body">
        <p>
          Demo data is seeded: <strong>{goodActorPubkeys.length}</strong> reputable actors endorse
          good relays, <strong>{badActorPubkeys.length}</strong> bad actors endorse spammy/shady
          ones. The WoT view ranks relays by endorser pubkeys — so to see the demo pay off,
          a POV pubkey needs to follow the good actors (and not the bad ones).
        </p>
        <div className="rdisc-demo-actions">
          <button
            className="rdisc-demo-btn"
            onClick={followAllGoodActors}
            disabled={publishing || !user}
            title={!user ? 'Log in with NIP-07 first' : ''}
          >
            {publishing
              ? 'Signing & publishing…'
              : `Follow all ${goodActorPubkeys.length} demo good actors as ${user?.pubkey ? user.pubkey.slice(0,8) + '…' : 'me'}`}
          </button>
          {info.ownerPubkey && (
            <span className="rdisc-demo-hint">
              Then set POV in Trust Determination to <code>{info.ownerPubkey.slice(0, 12)}…{info.ownerPubkey.slice(-8)}</code>
              {' '}and switch scoring to <em>Follow List</em>.
            </span>
          )}
        </div>
        {result && (
          <div className="rdisc-demo-result">
            ✅ {result.alreadyFollowed
              ? 'You already follow all demo good actors.'
              : `Added ${result.added} of ${result.total} good actors to your follow list.`}
          </div>
        )}
        {error && <div className="rtp-error" style={{ marginTop: '0.5rem' }}>⚠️ {error}</div>}
      </div>
    </div>
  );
}

/* ── Aggregated tab ────────────────────────────────────── */

function formatWeight(w) {
  if (w == null) return '—';
  if (w === 0) return '0';
  if (w === 1) return '1';
  return w.toFixed(2);
}

function EndorserList({ pubkeys, weights }) {
  if (!pubkeys || pubkeys.length === 0) return <span className="rtp-empty">No endorsers.</span>;
  return (
    <div className="rdisc-endorser-list">
      {pubkeys.map((pk) => {
        const w = weights?.[pk];
        const cls =
          w == null ? 'rdisc-endorser-unknown'
          : w === 0 ? 'rdisc-endorser-zero'
          : 'rdisc-endorser-weighted';
        return (
          <a
            key={pk}
            href={`/kg/brainstorm-search/user/${pk}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`rdisc-endorser ${cls}`}
            title={`${pk}\nweight: ${formatWeight(w)}`}
          >
            <code>{pk.slice(0, 12)}…</code>
            <span className="rdisc-endorser-weight">{formatWeight(w)}</span>
          </a>
        );
      })}
    </div>
  );
}

function AggregatedTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tagFilter, setTagFilter] = useState('');
  const [expandedUrl, setExpandedUrl] = useState(null);

  const { povPubkey, scoringMethod } = useTrust();
  const scoringLabel = SCORING_METHODS.find((m) => m.id === scoringMethod)?.label || scoringMethod;

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

  // Flat, deduped list of every pubkey that endorsed any relay in the
  // currently-loaded aggregate. Feeds useTrustWeights below.
  const allEndorserPubkeys = useMemo(() => {
    const set = new Set();
    for (const r of data?.relays || []) for (const pk of r.endorsers || []) set.add(pk);
    return Array.from(set);
  }, [data]);

  const { weights, loading: trustLoading, error: trustError } = useTrustWeights(allEndorserPubkeys);

  // Re-rank relays by trust-weighted endorser score when weights are ready.
  // Score for a relay = sum over its endorsers of (weight ?? 0). Unknown
  // weights don't count; a zero weight explicitly excludes an endorser.
  const rankedRelays = useMemo(() => {
    const relays = data?.relays || [];
    const haveWeights = weights && Object.keys(weights).length > 0;
    const withScore = relays.map((r) => {
      let weighted = 0;
      let hasAnyWeight = false;
      for (const pk of r.endorsers || []) {
        const w = weights?.[pk];
        if (w != null) { weighted += w; hasAnyWeight = true; }
      }
      return { ...r, weighted: haveWeights ? weighted : null, hasAnyWeight };
    });
    return withScore.sort((a, b) => {
      // Prefer weighted ranking when any weights present.
      if (a.weighted != null && b.weighted != null && a.weighted !== b.weighted) {
        return b.weighted - a.weighted;
      }
      if (b.endorserCount !== a.endorserCount) return b.endorserCount - a.endorserCount;
      const at = Object.values(a.tagApplications || {}).reduce((s, d) => s + (d?.count || 0), 0);
      const bt = Object.values(b.tagApplications || {}).reduce((s, d) => s + (d?.count || 0), 0);
      return bt - at;
    });
  }, [data, weights]);

  const weightsAvailable = weights && Object.keys(weights).length > 0;

  return (
    <div className="rdisc-tab">
      <DemoPanel />

      <div className="rdisc-trust-bar">
        <span className="rtp-label" style={{ marginRight: '0.5rem' }}>Trust mode</span>
        <span className="rdisc-trust-pill">{scoringLabel}</span>
        <span className="rdisc-trust-pov">
          POV:{' '}
          {povPubkey
            ? <code>{povPubkey.slice(0, 12)}…{povPubkey.slice(-8)}</code>
            : <em>(none — defaulting to owner)</em>}
        </span>
        <a href="/kg/grapevine/trust-determination" className="rdisc-trust-link">change →</a>
        {trustLoading && <span className="rdisc-trust-status">resolving weights…</span>}
        {trustError && <span className="rdisc-trust-status rdisc-trust-error" title={trustError}>⚠ weights unavailable</span>}
      </div>

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
            {' — ranked by '}
            {weightsAvailable ? <strong>trust-weighted endorser score</strong> : 'raw endorser count'}
          </div>

          {rankedRelays.length === 0 ? (
            <div className="rtp-empty" style={{ marginTop: '0.8rem' }}>
              No relays match. User-published relays only appear here after they land in Neo4j
              (happens automatically on publish via BrainstormProfile → Relays → Publish).
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '1.5rem' }}></th>
                  <th>Relay URL</th>
                  <th>Endorsers</th>
                  <th>Weighted score</th>
                  <th>Tag applications</th>
                </tr>
              </thead>
              <tbody>
                {rankedRelays.map((r) => {
                  const isOpen = expandedUrl === r.websocketUrl;
                  return (
                    <React.Fragment key={r.websocketUrl}>
                      <tr
                        className="clickable"
                        onClick={() => setExpandedUrl(isOpen ? null : r.websocketUrl)}
                      >
                        <td style={{ textAlign: 'center', opacity: 0.6 }}>{isOpen ? '▾' : '▸'}</td>
                        <td>
                          <code>{r.websocketUrl}</code>
                          {r.httpUrl && (
                            <>
                              {' '}
                              <a
                                href={r.httpUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bsp-id-link"
                                onClick={(e) => e.stopPropagation()}
                              >↗</a>
                            </>
                          )}
                        </td>
                        <td>{r.endorserCount}</td>
                        <td>
                          {r.weighted != null
                            ? <span className={r.weighted > 0 ? 'rdisc-score-positive' : 'rdisc-score-zero'}>
                                {r.weighted.toFixed(2)}
                              </span>
                            : <span className="rtp-empty">—</span>}
                        </td>
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
                      {isOpen && (
                        <tr className="rtp-row">
                          <td colSpan={5}>
                            <div className="rdisc-endorsers-block">
                              <div className="rtp-label">Endorsers ({r.endorserCount})</div>
                              <EndorserList pubkeys={r.endorsers} weights={weights} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="rdisc-footer-note">
            Weight per endorser depends on your Trust Determination (POV + scoring method).
            Click a relay row to see each endorser and their individual weight. An unknown
            weight (<code>—</code>) means the hook couldn't resolve a number for that pubkey
            under the current method.
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
