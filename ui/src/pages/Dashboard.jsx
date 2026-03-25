import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCypher } from '../hooks/useCypher';
import useProfiles from '../hooks/useProfiles';
import AuthorCell from '../components/AuthorCell';
import { TA_PUBKEY } from '../config/pubkeys';

function formatAge(createdAt) {
  if (!createdAt) return '—';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - createdAt;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

/* ─── Onboarding ──────────────────────────────────────────── */

function WelcomeCard({ taProfile, onSetupProfile, onSurpriseMe }) {
  const hasProfile = taProfile && (taProfile.name || taProfile.picture);

  if (hasProfile) return null;

  return (
    <div className="dashboard-card welcome-card">
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '3rem', lineHeight: 1 }}>🤖</div>
        <div>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem' }}>
            Hey! I'm your Tapestry Assistant.
          </h2>
          <p style={{ margin: '0 0 0.75rem', opacity: 0.8, lineHeight: 1.5 }}>
            I live on this instance and help manage your knowledge graph.
            I have my own nostr identity, and I can sign events, create concepts,
            and keep things organized.
          </p>
          <p style={{ margin: '0 0 1rem', opacity: 0.8 }}>
            But I don't have a face yet. Want to fix that?
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={onSetupProfile}>
              🎨 Set up my profile
            </button>
            <button className="btn" onClick={onSurpriseMe}>
              🎲 Surprise me
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OnboardingChecklist({ user, taProfile, conceptCount, constraintsOk, onAction }) {
  const isOwner = user?.classification === 'owner';
  const hasTA = taProfile && (taProfile.name || taProfile.picture);
  const hasBios = conceptCount > 0;

  const items = [
    { key: 'running', label: 'Tapestry is running', done: true },
    { key: 'signed-in', label: 'Signed in as Owner', done: isOwner },
    { key: 'constraints', label: 'Install Neo4j constraints & indexes', done: constraintsOk },
    { key: 'ta-profile', label: 'Give your Assistant a profile', done: hasTA, action: () => onAction('ta-profile'), actionLabel: 'Set up profile →' },
    { key: 'bios', label: 'Install Tapestry firmware', done: hasBios, action: () => onAction('bios'), actionLabel: 'Install firmware →' },
  ];

  const allDone = items.every(i => i.done);

  if (allDone) {
    return (
      <div className="dashboard-card" style={{ padding: '0.75rem 1rem', opacity: 0.6 }}>
        ✅ Setup complete
      </div>
    );
  }

  return (
    <div className="dashboard-card">
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Getting Started</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map(item => (
          <li
            key={item.key}
            style={{
              padding: '0.4rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '1.1rem' }}>{item.done ? '✅' : '⬜'}</span>
            <span>{item.label}</span>
            {!item.done && item.action && (
              <button
                className="btn btn-sm"
                onClick={item.action}
                style={{ marginLeft: 'auto', fontSize: '0.75rem' }}
              >
                {item.actionLabel || 'Do this →'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Stats Cards ─────────────────────────────────────────── */

function StatsRow() {
  const { data: conceptData } = useCypher(`
    MATCH (n:NostrEvent:ListHeader)-[:IS_THE_CONCEPT_FOR]->()
    RETURN count(DISTINCT n) AS cnt
  `);
  const { data: nodeData } = useCypher(`
    MATCH (n:NostrEvent)
    WITH n, labels(n) AS lbls
    WHERE NONE(l IN lbls WHERE l = 'NostrEventTag')
    RETURN count(n) AS cnt
  `);
  const { data: userData } = useCypher(`
    MATCH (n:NostrUser) RETURN count(n) AS cnt
  `);
  const { data: relData } = useCypher(`
    MATCH ()-[r]->()
    WHERE type(r) <> 'HAS_TAG'
    RETURN count(r) AS cnt
  `);

  const stats = [
    { label: 'Concepts', value: conceptData?.[0]?.cnt ?? '—', emoji: '🧩', to: '/kg/concepts' },
    { label: 'Nodes', value: nodeData?.[0]?.cnt ?? '—', emoji: '🔵', to: '/kg/databases/neo4j/nodes' },
    { label: 'Users', value: userData?.[0]?.cnt ?? '—', emoji: '👤', to: '/kg/users' },
    { label: 'Relationships', value: relData?.[0]?.cnt ?? '—', emoji: '🔗', to: '/kg/relationships' },
  ];

  const navigate = useNavigate();

  return (
    <div className="stats-row">
      {stats.map(s => (
        <div
          key={s.label}
          className="stat-card dashboard-card"
          onClick={() => navigate(s.to)}
          style={{ cursor: 'pointer' }}
        >
          <div className="stat-emoji">{s.emoji}</div>
          <div className="stat-value">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</div>
          <div className="stat-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Health ──────────────────────────────────────────────── */

function HealthRow() {
  // Check normalization issues (simplified — counts nodes missing key relationships)
  const { data: rule1 } = useCypher(`
    MATCH (h:ListHeader)
    WHERE NOT (h)-[:IS_THE_CONCEPT_FOR]->()
    RETURN count(h) AS cnt
  `);
  const { data: rule2 } = useCypher(`
    MATCH (h:ListHeader)-[:IS_THE_CONCEPT_FOR]->(s)
    WHERE NOT s:Superset
    RETURN count(h) AS cnt
  `);
  const { data: orphanItems } = useCypher(`
    MATCH (i:ListItem)
    WHERE NOT ()-[:HAS_ELEMENT]->(i)
    RETURN count(i) AS cnt
  `);

  const r1 = rule1?.[0]?.cnt ?? 0;
  const r2 = rule2?.[0]?.cnt ?? 0;
  const orphans = orphanItems?.[0]?.cnt ?? 0;
  const totalIssues = r1 + r2 + orphans;

  let severity, message, color;
  if (totalIssues === 0) {
    severity = '🟢';
    message = 'Knowledge graph is healthy';
    color = '#22c55e';
  } else if (totalIssues <= 5) {
    severity = '🟡';
    message = `${totalIssues} normalization issue${totalIssues !== 1 ? 's' : ''} found`;
    color = '#f59e0b';
  } else {
    severity = '🔴';
    message = `${totalIssues} normalization issues found`;
    color = '#ef4444';
  }

  return (
    <div className="dashboard-card health-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.5rem' }}>{severity}</span>
        <div>
          <div style={{ fontWeight: 600, color }}>{message}</div>
          {totalIssues > 0 && (
            <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.25rem' }}>
              {r1 > 0 && <span>Headers without concept: {r1} · </span>}
              {r2 > 0 && <span>Invalid concept targets: {r2} · </span>}
              {orphans > 0 && <span>Orphan items: {orphans}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Constraints Check ───────────────────────────────────── */

const EXPECTED_CONSTRAINTS = [
  { name: 'nostrEvent_id', label: 'NostrEvent.id', property: 'id', entity: 'NostrEvent' },
  { name: 'nostrEvent_uuid', label: 'NostrEvent.uuid', property: 'uuid', entity: 'NostrEvent' },
  { name: 'nostrEventTag_uuid', label: 'NostrEventTag.uuid', property: 'uuid', entity: 'NostrEventTag' },
  { name: 'nostrUser_pubkey', label: 'NostrUser.pubkey', property: 'pubkey', entity: 'NostrUser' },
];

const EXPECTED_INDEXES = [
  { name: 'nostrEvent_kind', label: 'NostrEvent.kind', property: 'kind', entity: 'NostrEvent' },
];

function ConstraintsCheck({ onStatusChange }) {
  const [status, setStatus] = useState(null); // null = loading, { constraints, indexes }
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const isOwner = user?.classification === 'owner';

  const checkConstraints = useCallback(async () => {
    try {
      // Query existing constraints and indexes via Cypher
      const constraintRes = await fetch('/api/neo4j/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cypher: `SHOW CONSTRAINTS YIELD name, type, labelsOrTypes, properties RETURN name, type, labelsOrTypes, properties`,
        }),
      });
      const constraintData = await constraintRes.json();

      const indexRes = await fetch('/api/neo4j/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cypher: `SHOW INDEXES YIELD name, state, type, labelsOrTypes, properties WHERE type <> 'LOOKUP' RETURN name, state, type, labelsOrTypes, properties`,
        }),
      });
      const indexData = await indexRes.json();

      const existingConstraints = new Set((constraintData.data || []).map(r => r.name));
      const existingIndexes = new Set((indexData.data || []).map(r => r.name));

      const missingConstraints = EXPECTED_CONSTRAINTS.filter(c => !existingConstraints.has(c.name));
      const missingIndexes = EXPECTED_INDEXES.filter(i => !existingIndexes.has(i.name));

      const ok = missingConstraints.length === 0 && missingIndexes.length === 0;
      setStatus({ missingConstraints, missingIndexes, total: EXPECTED_CONSTRAINTS.length + EXPECTED_INDEXES.length });
      if (onStatusChange) onStatusChange(ok);
    } catch (err) {
      setStatus({ missingConstraints: EXPECTED_CONSTRAINTS, missingIndexes: EXPECTED_INDEXES, total: EXPECTED_CONSTRAINTS.length + EXPECTED_INDEXES.length });
      if (onStatusChange) onStatusChange(false);
    }
  }, []);

  useEffect(() => { checkConstraints(); }, [checkConstraints]);

  const handleInstall = useCallback(async () => {
    setInstalling(true);
    setError(null);
    try {
      const res = await fetch('/api/neo4j-setup-constraints-and-indexes', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        // Re-check after install
        await new Promise(r => setTimeout(r, 2000));
        await checkConstraints();
      } else {
        setError(data.error || 'Setup failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setInstalling(false);
    }
  }, [checkConstraints]);

  if (!status) return null;

  const totalMissing = status.missingConstraints.length + status.missingIndexes.length;
  if (totalMissing === 0) return null; // All good, don't show anything

  return (
    <div className="dashboard-card" style={{
      border: '1px solid #f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.08)',
      marginBottom: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '1.5rem' }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 600, color: '#f59e0b' }}>
            Neo4j Constraints &amp; Indexes Missing
          </div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.25rem' }}>
            {totalMissing} of {status.total} required constraints/indexes are not installed.
            {status.missingConstraints.length > 0 && (
              <span> Missing constraints: {status.missingConstraints.map(c => c.label).join(', ')}.</span>
            )}
            {status.missingIndexes.length > 0 && (
              <span> Missing indexes: {status.missingIndexes.map(i => i.label).join(', ')}.</span>
            )}
          </div>
        </div>
      </div>
      {isOwner && (
        <div style={{ marginTop: '0.5rem' }}>
          <button
            className="btn btn-primary"
            onClick={handleInstall}
            disabled={installing}
          >
            {installing ? '⏳ Installing…' : '🔧 Install Constraints & Indexes'}
          </button>
          {error && <span className="error" style={{ marginLeft: '0.75rem', fontSize: '0.8rem' }}>{error}</span>}
        </div>
      )}
      {!isOwner && (
        <p style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.5rem' }}>
          Ask the system owner to install constraints and indexes.
        </p>
      )}
    </div>
  );
}

/* ─── Recent Activity ─────────────────────────────────────── */

function RecentActivity() {
  const { data, loading } = useCypher(`
    MATCH (n:NostrEvent)
    WITH n, labels(n) AS lbls
    WHERE NONE(l IN lbls WHERE l = 'NostrEventTag')
    RETURN n.uuid AS uuid, n.name AS name, n.pubkey AS author,
           n.created_at AS createdAt, n.kind AS kind, lbls
    ORDER BY n.created_at DESC
    LIMIT 10
  `);

  const navigate = useNavigate();

  const authorPubkeys = useMemo(() => {
    if (!data) return [];
    const set = new Set();
    for (const row of data) {
      if (row.author) set.add(row.author);
    }
    return [...set];
  }, [data]);
  const profiles = useProfiles(authorPubkeys);

  function formatLabels(lbls) {
    if (!lbls) return '';
    return (Array.isArray(lbls) ? lbls : [])
      .filter(l => l !== 'NostrEvent')
      .sort()
      .join(', ');
  }

  if (loading) return <div className="dashboard-card"><span className="loading">Loading activity…</span></div>;

  if (!data || data.length === 0) {
    return (
      <div className="dashboard-card">
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Recent Activity</h3>
        <p style={{ opacity: 0.5 }}>No events in the graph yet. Sync some data or create your first concept!</p>
      </div>
    );
  }

  return (
    <div className="dashboard-card">
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Recent Activity</h3>
      <table className="data-table" style={{ width: '100%' }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Author</th>
            <th>Age</th>
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr
              key={row.uuid}
              onClick={() => navigate(`/kg/databases/neo4j/nodes/${encodeURIComponent(row.uuid)}`)}
              style={{ cursor: 'pointer' }}
              className="clickable-row"
            >
              <td style={{ fontWeight: 500 }}>
                {row.name || <em style={{ opacity: 0.5 }}>unnamed</em>}
              </td>
              <td>
                {formatLabels(row.lbls).split(', ').filter(Boolean).map(label => (
                  <span
                    key={label}
                    style={{
                      display: 'inline-block',
                      fontSize: '0.72rem',
                      padding: '0.1rem 0.4rem',
                      marginRight: '0.25rem',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      color: '#818cf8',
                      fontWeight: 500,
                    }}
                  >
                    {label}
                  </span>
                ))}
              </td>
              <td>
                <AuthorCell pubkey={row.author} profiles={profiles} />
              </td>
              <td style={{ fontSize: '0.8rem', opacity: 0.8, whiteSpace: 'nowrap' }}>
                {formatAge(row.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Tapestry Key Status ─────────────────────────────────── */

function TapestryKeyStatus() {
  const [status, setStatus] = useState(null);
  const [offloadStatus, setOffloadStatus] = useState(null);
  const [initializing, setInitializing] = useState(false);
  const [offloading, setOffloading] = useState(false);
  const [derivingAll, setDerivingAll] = useState(false);
  const [deriveResult, setDeriveResult] = useState(null);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const isOwner = user?.classification === 'owner';

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, offloadRes] = await Promise.all([
        fetch('/api/tapestry-key/status'),
        fetch('/api/tapestry-key/offload-status'),
      ]);
      const statusData = await statusRes.json();
      const offloadData = await offloadRes.json();
      if (statusData.success) setStatus(statusData.data);
      else setError(statusData.error);
      if (offloadData.success) setOffloadStatus(offloadData.data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  async function handleInitialize() {
    if (!confirm(`Initialize tapestryKey on ${status.uninitialized} node(s)? This assigns a permanent UUID to each.`)) return;
    setInitializing(true);
    setError(null);
    try {
      const res = await fetch('/api/tapestry-key/initialize', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setInitializing(false);
    }
  }

  async function handleOffloadAll() {
    if (!confirm(`Offload ${offloadStatus.inline} inline JSON tag(s) to LMDB?`)) return;
    setOffloading(true);
    setError(null);
    try {
      const res = await fetch('/api/tapestry-key/offload-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setOffloading(false);
    }
  }

  async function handleDeriveAll() {
    if (!confirm(`Derive tapestryJSON for all nodes? This may take a moment.`)) return;
    setDerivingAll(true);
    setDeriveResult(null);
    setError(null);
    try {
      // Derive in order: ListItem first (so Set/Superset can resolve slugs from LMDB),
      // then specific types
      const labels = ['ListItem', 'ListHeader', 'ConceptHeader', 'JSONSchema', 'Property', 'Set', 'Superset'];
      let totalDerived = 0;
      for (const label of labels) {
        const res = await fetch(`/api/tapestry-key/derive-all/${label}`, { method: 'POST' });
        const data = await res.json();
        if (!data.success) {
          setError(`Failed on ${label}: ${data.error}`);
          break;
        }
      }
      // Fetch derive status for counts
      const statusRes = await fetch('/api/tapestry-key/derive-status');
      const statusData = await statusRes.json();
      if (statusData.success) {
        totalDerived = statusData.data.reduce((sum, l) => sum + l.derived, 0);
      }
      setDeriveResult({ success: true, count: totalDerived });
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setDerivingAll(false);
    }
  }

  if (!status) return null;

  const { initialized, uninitialized, total, lmdb } = status;
  const keysAllGood = uninitialized === 0;
  const hasInlineTags = offloadStatus && offloadStatus.inline > 0;

  return (
    <div className="dashboard-card">
      {/* TapestryKey row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.5rem' }}>{keysAllGood ? '🟢' : '🟡'}</span>
          <div>
            <div style={{ fontWeight: 600, color: keysAllGood ? '#22c55e' : '#f59e0b' }}>
              {keysAllGood
                ? `All ${total} nodes have a tapestryKey`
                : `${uninitialized} of ${total} nodes need a tapestryKey`
              }
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.25rem' }}>
              LMDB: <span style={{ color: '#22c55e' }}>{lmdb.derived} derived</span>
              {lmdb.empty > 0 && <>, <span style={{ color: '#f59e0b' }}>{lmdb.empty} empty</span></>}
              {lmdb.missing > 0 && <>, <span style={{ opacity: 0.6 }}>{lmdb.missing} not in LMDB</span></>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          {!keysAllGood && isOwner && (
            <button
              className="btn btn-primary"
              onClick={handleInitialize}
              disabled={initializing}
              style={{ whiteSpace: 'nowrap' }}
            >
              {initializing ? 'Initializing…' : `Initialize ${uninitialized}`}
            </button>
          )}
          {isOwner && lmdb.missing > 0 && (
            <button
              className="btn"
              onClick={handleDeriveAll}
              disabled={derivingAll}
              style={{ whiteSpace: 'nowrap' }}
            >
              {derivingAll ? '⏳ Deriving…' : `🔄 Derive All`}
            </button>
          )}
        </div>
      </div>

      {/* Derive result banner */}
      {deriveResult && (
        <div style={{
          marginTop: '0.5rem', padding: '0.4rem 0.75rem', borderRadius: '4px',
          backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e',
          fontSize: '0.8rem', color: '#22c55e',
        }}>
          ✅ Derived {deriveResult.count} nodes
        </div>
      )}

      {/* Offload row */}
      {offloadStatus && offloadStatus.total > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: '0.75rem', paddingTop: '0.75rem',
          borderTop: '1px solid var(--border, #333)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>{hasInlineTags ? '🟡' : '🟢'}</span>
            <div>
              <div style={{ fontWeight: 600, color: hasInlineTags ? '#f59e0b' : '#22c55e' }}>
                {hasInlineTags
                  ? `${offloadStatus.inline} of ${offloadStatus.total} JSON tags still inline in Neo4j`
                  : `All ${offloadStatus.total} JSON tags offloaded to LMDB`
                }
              </div>
              {offloadStatus.offloaded > 0 && (
                <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.25rem' }}>
                  {offloadStatus.offloaded} already offloaded
                </div>
              )}
            </div>
          </div>
          {hasInlineTags && isOwner && keysAllGood && (
            <button
              className="btn btn-primary"
              onClick={handleOffloadAll}
              disabled={offloading}
              style={{ whiteSpace: 'nowrap' }}
            >
              {offloading ? 'Offloading…' : `Offload ${offloadStatus.inline} tags`}
            </button>
          )}
        </div>
      )}

      {error && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>Error: {error}</div>}
    </div>
  );
}

/* ─── Dashboard ───────────────────────────────────────────── */

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Check TA profile
  const [taProfile, setTaProfile] = useState(undefined); // undefined = loading
  useEffect(() => {
    fetch(`/api/profiles?pubkeys=${TA_PUBKEY}`)
      .then(r => r.json())
      .then(d => setTaProfile(d.profiles?.[TA_PUBKEY] || null))
      .catch(() => setTaProfile(null));
  }, []);

  // Check constraints status
  const [constraintsOk, setConstraintsOk] = useState(null); // null=loading, true/false

  // Count concepts for onboarding check
  const { data: conceptCountData } = useCypher(`
    MATCH (n:NostrEvent:ListHeader)-[:IS_THE_CONCEPT_FOR]->()
    RETURN count(DISTINCT n) AS cnt
  `);
  const conceptCount = conceptCountData?.[0]?.cnt ?? 0;

  function handleOnboardingAction(key) {
    switch (key) {
      case 'ta-profile':
        navigate(`/kg/users/${TA_PUBKEY}`);
        break;
      case 'bios':
        navigate('/kg/settings/firmware');
        break;
    }
  }

  async function handleSurpriseMe() {
    // Publish a fun default profile for the TA
    try {
      const profile = {
        name: 'Tapestry Assistant',
        about: 'Your friendly knowledge graph assistant. I sign events, manage concepts, and keep things tidy. 🧠',
        picture: `https://robohash.org/${TA_PUBKEY}.png?set=set3&size=200x200`,
      };
      const event = {
        kind: 0,
        content: JSON.stringify(profile),
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
      };
      const res = await fetch('/api/strfry/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, signAs: 'assistant' }),
      });
      const data = await res.json();
      if (data.success) {
        setTaProfile(profile);
      } else {
        alert('Failed to publish profile: ' + (data.error || 'unknown error'));
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  const isLoading = taProfile === undefined;

  return (
    <div className="page dashboard">
      {!isLoading && (
        <>
          <WelcomeCard
            taProfile={taProfile}
            onSetupProfile={() => navigate(`/kg/users/${TA_PUBKEY}`)}
            onSurpriseMe={handleSurpriseMe}
          />
          <OnboardingChecklist
            user={user}
            taProfile={taProfile}
            conceptCount={conceptCount}
            constraintsOk={constraintsOk === true}
            onAction={handleOnboardingAction}
          />
        </>
      )}

      <ConstraintsCheck onStatusChange={setConstraintsOk} />
      <StatsRow />
      <HealthRow />
      <TapestryKeyStatus />
      <RecentActivity />
    </div>
  );
}
