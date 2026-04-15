import React, { useState, useEffect, useMemo } from 'react';
import { nip19 } from 'nostr-tools';
import { useAuth } from '../../context/AuthContext';
import { useTrust, SCORING_METHODS } from '../../context/TrustContext';
import useTrustWeights from '../../hooks/useTrustWeights';
import { fetchFromRelays, publishEverywhere, PUBLISH_RELAYS, importAddressableToNeo4j } from '../../utils/nostrPublish';

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
  // Everything the script touches that is NOT a seed-good actor. Used by
  // the "reset demo follows" button to strip stale non-seed demo follows
  // from the owner's kind 3 without disturbing any non-demo follows.
  const nonSeedDemoPubkeys = [
    ...Object.values(info.tier2GoodActors || {}),
    ...Object.values(info.tier3GoodActors || {}),
    ...badActorPubkeys,
    ...Object.values(info.neutralActors || {}),
  ];

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
      // Strip any non-seed demo actors the owner may still follow from an
      // earlier demo revision, so the graph reduces to exactly the intended
      // seed set (plus any non-demo follows the user had).
      const nonSeedSet = new Set(nonSeedDemoPubkeys);
      const filteredTags = existingTags.filter(
        (t) => t[0] !== 'p' || !t[1] || !nonSeedSet.has(t[1]),
      );
      const filteredFollowed = new Set(
        filteredTags.filter((t) => t[0] === 'p' && t[1]).map((t) => t[1]),
      );
      const toAdd = goodActorPubkeys.filter((pk) => !filteredFollowed.has(pk));
      const toRemove = existingTags.length - filteredTags.length;
      if (toAdd.length === 0 && toRemove === 0) {
        setResult({ added: 0, total: goodActorPubkeys.length, alreadyFollowed: true });
        setPublishing(false);
        return;
      }
      const newTags = [...filteredTags, ...toAdd.map((pk) => ['p', pk])];
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
      setResult({ added: toAdd.length, removed: toRemove, total: goodActorPubkeys.length });
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
          Demo data is seeded. <strong>{goodActorPubkeys.length}</strong> seed good actors
          (1 hop from the owner) are the click-to-follow set; another tier of good actors is
          reachable via <em>their</em> follow graph (2 and 3 hops). <strong>{badActorPubkeys.length}</strong> bad actors
          form an isolated cluster that GR can't reach. Ranking relays by raw follow-list vs
          trusted-assertions-rank should land on different orderings once you run the pipeline.
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
              : `Follow ${goodActorPubkeys.length} seed good actors as ${user?.pubkey ? user.pubkey.slice(0,8) + '…' : 'me'}`}
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
              ? `You already follow all ${result.total} seed good actors and no stale demo follows.`
              : `Set follow list to the ${result.total} seed good actors (added ${result.added}, removed ${result.removed || 0} stale demo follows).`}
          </div>
        )}
        {error && <div className="rtp-error" style={{ marginTop: '0.5rem' }}>⚠️ {error}</div>}
      </div>
    </div>
  );
}

/* ── GrapeRank pipeline panel ──────────────────────────── */

const PIPELINE_STEPS = [
  {
    id: 'reconcile',
    title: 'Reconcile follow graph',
    description: 'Derives FOLLOWS / MUTES / REPORTS edges in Neo4j from kind 3/10000/1984 events in strfry.',
    endpoint: '/api/reconciliation',
    method: 'POST',
    readyWhen: (s) => s && s.kind3InStrfry > 0,
    completeWhen: (s) => s && s.follows > 0,
    statusText: (s) => s ? `${s.kind3InStrfry} kind-3 in strfry → ${s.follows} FOLLOWS edges in Neo4j` : '…',
  },
  {
    id: 'hops',
    title: 'Compute hop distances',
    description: 'Shortest-path distance from the owner root through the follow graph. Required by GrapeRank.',
    endpoint: '/api/calculate-hops',
    method: 'POST',
    readyWhen: (s) => s && s.follows > 0,
    completeWhen: (s) => s && s.hopsNodes > 0,
    statusText: (s) => s ? `${s.hopsNodes} users with hops` : '…',
  },
  {
    id: 'graperank',
    title: 'Compute GrapeRank',
    description: 'Runs the personalized GrapeRank algorithm. Writes influence / average / confidence onto NostrUser nodes. Can take several minutes on a real graph.',
    endpoint: '/api/generate-graperank',
    method: 'POST',
    readyWhen: (s) => s && s.hopsNodes > 0,
    completeWhen: (s) => s && s.grScored > 0,
    statusText: (s) => s ? `${s.grScored} users with GR scores` : '…',
  },
  {
    id: 'publish30382',
    title: 'Publish NIP-85 rank events (kind 30382)',
    description: 'Publishes one kind 30382 per scored user, authored by the relay pubkey. Signed server-side with the TA/relay key. Fires and forgets — may continue in background.',
    endpoint: '/api/publish-kind30382',
    method: 'POST',
    readyWhen: (s) => s && s.grScored > 0,
    completeWhen: (s) => s && (s.kind30382InNeo4j > 0 || s.kind30382InStrfry > 0),
    statusText: (s) => s ? `${s.kind30382InStrfry} kind-30382 in strfry, ${s.kind30382InNeo4j} in Neo4j` : '…',
  },
];

function PipelinePanel() {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [stepStatus, setStepStatus] = useState({}); // { [id]: 'idle' | 'running' | 'done' | 'error' }
  const [stepMessage, setStepMessage] = useState({});
  const [tmPublishing, setTmPublishing] = useState(false);
  const [tmMessage, setTmMessage] = useState(null);

  const loadState = async () => {
    try {
      const resp = await fetch('/api/relay-discovery/pipeline-state');
      const body = await resp.json();
      if (body.success) setState(body);
    } catch {}
  };

  useEffect(() => {
    loadState();
    const t = setInterval(loadState, 5000);
    return () => clearInterval(t);
  }, []);

  async function runStep(step) {
    if (!user) {
      setStepMessage((m) => ({ ...m, [step.id]: 'Log in via NIP-07 first.' }));
      return;
    }
    setStepStatus((s) => ({ ...s, [step.id]: 'running' }));
    setStepMessage((m) => ({ ...m, [step.id]: 'Running…' }));
    try {
      const resp = await fetch(step.endpoint, {
        method: step.method,
        headers: { 'Content-Type': 'application/json' },
        body: step.method === 'POST' ? JSON.stringify({}) : undefined,
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || body.success === false) {
        const msg = body.error || body.message || `HTTP ${resp.status}`;
        setStepStatus((s) => ({ ...s, [step.id]: 'error' }));
        setStepMessage((m) => ({ ...m, [step.id]: msg }));
        return;
      }
      setStepStatus((s) => ({ ...s, [step.id]: 'done' }));
      setStepMessage((m) => ({ ...m, [step.id]: body.message || 'Kicked off — may run in background; refresh status below.' }));
    } catch (err) {
      setStepStatus((s) => ({ ...s, [step.id]: 'error' }));
      setStepMessage((m) => ({ ...m, [step.id]: err.message || String(err) }));
    } finally {
      loadState();
    }
  }

  // Treasure map — needs NIP-07 signing.
  async function publishTreasureMap() {
    if (!user) { setTmMessage('Log in via NIP-07 first.'); return; }
    if (!window.nostr) { setTmMessage('No NIP-07 extension detected.'); return; }
    setTmPublishing(true);
    setTmMessage(null);
    try {
      // Fetch the unsigned template from our own endpoint — doesn't require
      // per-customer relay keys like /api/create-unsigned-kind10040 does.
      const tmplResp = await fetch(`/api/relay-discovery/unsigned-10040?pubkey=${user.pubkey}`);
      const tmplBody = await tmplResp.json();
      if (!tmplResp.ok || !tmplBody.success || !tmplBody.event) {
        throw new Error(tmplBody.error || `Could not fetch unsigned 10040 (${tmplResp.status})`);
      }
      const unsigned = tmplBody.event;

      const signed = await window.nostr.signEvent(unsigned);

      // Publish via the existing helper — fans out to local strfry + public
      // relays and doesn't require the owner-session gate on
      // /api/publish-kind10040-event.
      const pubResult = await publishEverywhere(signed);
      const localOk = pubResult?.local?.success;
      const externalOk = (pubResult?.external?.successes?.length || 0) > 0;
      if (!localOk && !externalOk) {
        throw new Error(pubResult?.local?.error || 'Publish failed on every relay.');
      }
      // Best-effort: also import into Neo4j so pipeline-state shows it.
      await importAddressableToNeo4j(signed).catch(() => {});
      setTmMessage('✅ Treasure map signed and published.');
      loadState();
    } catch (err) {
      setTmMessage('⚠️ ' + (err.message || String(err)));
    } finally {
      setTmPublishing(false);
    }
  }

  const tmComplete = state && (state.kind10040InStrfry > 0 || state.kind10040InNeo4j > 0);

  return (
    <div className="rdisc-pipeline-panel">
      <div className="rdisc-pipeline-title">🍇 GrapeRank Pipeline</div>
      <div className="rdisc-pipeline-body">
        <p>
          The <em>Trusted Assertions (rank)</em> scoring method only works after this
          pipeline runs. Each step writes to Neo4j or publishes nostr events; run them
          in order. Computations can take minutes — the panel auto-refreshes state
          every 5 seconds.
        </p>

        <table className="rdisc-pipeline-table">
          <tbody>
            {PIPELINE_STEPS.map((step, i) => {
              const status = stepStatus[step.id] || 'idle';
              const isComplete = step.completeWhen?.(state);
              const isReady = step.readyWhen?.(state);
              const msg = stepMessage[step.id];
              return (
                <tr key={step.id}>
                  <td className="rdisc-pipeline-num">{i + 1}</td>
                  <td className="rdisc-pipeline-info">
                    <div className="rdisc-pipeline-step-title">
                      {isComplete ? '✅ ' : status === 'running' ? '⏳ ' : status === 'error' ? '⚠️ ' : ''}
                      {step.title}
                    </div>
                    <div className="rdisc-pipeline-step-desc">{step.description}</div>
                    <div className="rdisc-pipeline-step-status">
                      <span>{step.statusText(state)}</span>
                      {msg && <span className="rdisc-pipeline-step-msg"> — {msg}</span>}
                    </div>
                  </td>
                  <td className="rdisc-pipeline-action">
                    <button
                      onClick={() => runStep(step)}
                      disabled={status === 'running' || !user || !isReady}
                      title={!user ? 'Log in first' : !isReady ? 'Previous step not complete yet' : ''}
                    >
                      {status === 'running' ? 'Running…' : isComplete ? 'Re-run' : 'Run'}
                    </button>
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="rdisc-pipeline-num">5</td>
              <td className="rdisc-pipeline-info">
                <div className="rdisc-pipeline-step-title">
                  {tmComplete ? '✅ ' : ''}Create + publish Treasure Map (kind 10040)
                </div>
                <div className="rdisc-pipeline-step-desc">
                  The owner signs a kind 10040 (via NIP-07) that tells clients which
                  pubkey + relay to fetch rank events from. Without this, the hook
                  can't find the 30382 events even if they exist.
                </div>
                <div className="rdisc-pipeline-step-status">
                  <span>{state ? `${state.kind10040InStrfry} kind-10040 in strfry, ${state.kind10040InNeo4j} in Neo4j` : '…'}</span>
                  {tmMessage && <span className="rdisc-pipeline-step-msg"> — {tmMessage}</span>}
                </div>
              </td>
              <td className="rdisc-pipeline-action">
                <button
                  onClick={publishTreasureMap}
                  disabled={tmPublishing || !user || !(state && (state.kind30382InStrfry > 0 || state.kind30382InNeo4j > 0))}
                  title={!user ? 'Log in first' : !(state && (state.kind30382InStrfry > 0 || state.kind30382InNeo4j > 0)) ? 'Publish 30382 events first' : ''}
                >
                  {tmPublishing ? 'Signing…' : tmComplete ? 'Re-publish' : 'Sign & publish'}
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="rdisc-pipeline-footer">
          After all five steps complete, go to{' '}
          <a href="/kg/grapevine/trust-determination" className="rdisc-trust-link" style={{ marginLeft: 0 }}>
            Trust Determination
          </a>
          {' '}and switch scoring to <em>Trusted Assertions (rank)</em>. The aggregated
          table above will re-rank using real GrapeRank weights.
        </div>
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

// Stacked avatars for the collapsed row — visual at-a-glance summary of who
// endorsed a relay. Click-through on the row still expands to the full chip
// list below.
function EndorserStack({ pubkeys, profiles, weights, limit = 6 }) {
  if (!pubkeys || pubkeys.length === 0) {
    return <span className="rtp-empty" style={{ fontSize: '0.78rem' }}>—</span>;
  }
  const visible = pubkeys.slice(0, limit);
  const overflow = pubkeys.length - visible.length;
  return (
    <div className="rdisc-endorser-stack" aria-label={`${pubkeys.length} endorsers`}>
      {visible.map((pk, i) => {
        const prof = profiles?.[pk];
        const label = prof?.display_name || prof?.name || pk.slice(0, 12);
        const pic = prof?.picture;
        const initials = (label[0] || '?').toUpperCase();
        const w = weights?.[pk];
        const weightCls =
          w == null ? 'rdisc-stack-avatar-unknown'
          : w === 0 ? 'rdisc-stack-avatar-zero'
          : 'rdisc-stack-avatar-weighted';
        return (
          <span
            key={pk}
            className={`rdisc-stack-avatar ${weightCls}`}
            title={`${label} — weight: ${formatWeight(w)}`}
            style={{ zIndex: limit - i }}
          >
            {pic ? (
              <img src={pic} alt="" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <span className="rdisc-stack-avatar-fallback">{initials}</span>
            )}
          </span>
        );
      })}
      {overflow > 0 && (
        <span
          className="rdisc-stack-avatar rdisc-stack-overflow"
          title={`${overflow} more`}
          style={{ zIndex: 0 }}
        >
          +{overflow}
        </span>
      )}
      <span className="rdisc-stack-count">{pubkeys.length}</span>
    </div>
  );
}

function EndorserList({ pubkeys, weights, profiles }) {
  if (!pubkeys || pubkeys.length === 0) return <span className="rtp-empty">No endorsers.</span>;
  return (
    <div className="rdisc-endorser-list">
      {pubkeys.map((pk) => {
        const w = weights?.[pk];
        const cls =
          w == null ? 'rdisc-endorser-unknown'
          : w === 0 ? 'rdisc-endorser-zero'
          : 'rdisc-endorser-weighted';
        const prof = profiles?.[pk];
        const label = prof?.display_name || prof?.name || `${pk.slice(0, 12)}…`;
        const pic = prof?.picture;
        const initials = (label[0] || '?').toUpperCase();
        return (
          <a
            key={pk}
            href={`/kg/brainstorm-search/user/${pk}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`rdisc-endorser ${cls}`}
            title={`${label}\n${pk}\nweight: ${formatWeight(w)}`}
          >
            {pic ? (
              <img
                src={pic}
                alt=""
                className="rdisc-endorser-avatar"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling?.style && (e.target.nextSibling.style.display = 'inline-flex'); }}
              />
            ) : null}
            <span
              className="rdisc-endorser-avatar rdisc-endorser-avatar-fallback"
              style={pic ? { display: 'none' } : undefined}
            >
              {initials}
            </span>
            <span className="rdisc-endorser-name">{label}</span>
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

  // Fetch kind-0 profiles for all endorsers so the expanded rows show
  // avatars and display names instead of truncated hex.
  const [profiles, setProfiles] = useState({});
  useEffect(() => {
    if (!allEndorserPubkeys || allEndorserPubkeys.length === 0) {
      setProfiles({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const qs = allEndorserPubkeys.join(',');
        const resp = await fetch(`/api/profiles?pubkeys=${qs}`);
        const body = await resp.json();
        if (cancelled) return;
        setProfiles(body?.profiles || {});
      } catch {
        if (!cancelled) setProfiles({});
      }
    })();
    return () => { cancelled = true; };
  }, [allEndorserPubkeys.join(',')]);

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
      <PipelinePanel />

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
                        <td>
                          <EndorserStack pubkeys={r.endorsers} profiles={profiles} weights={weights} />
                        </td>
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
                              <EndorserList pubkeys={r.endorsers} weights={weights} profiles={profiles} />
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
