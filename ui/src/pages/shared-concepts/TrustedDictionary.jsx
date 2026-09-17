import { useEffect, useMemo, useState } from 'react';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import AuthorCell from '../../components/AuthorCell';
import useProfiles from '../../hooks/useProfiles';
import { usePov } from '../../context/PovContext';

/**
 * Trusted Dictionary (ADR shared-concepts-adoption/0005) — the concepts the
 * active POV's trust network demonstrably uses (S3b, ≥ N distinct trusted
 * users). The SERVER assembles everything (/api/trusted-dictionary); this
 * page never re-derives the arithmetic. A read artifact, not a worklist —
 * kept-private headers appear marked (they never ride into a snapshot).
 *
 * Publish snapshot mints the dated, TA-signed offering (owner-gated
 * server-side; recomputed there — nothing client-posted is trusted).
 */
export default function TrustedDictionary() {
  const { povParams } = usePov();
  const [data, setData] = useState(null); // { entries, snapshots, pov } | null
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const query = useMemo(() => {
    const p = new URLSearchParams(povParams);
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [povParams.wotPov, povParams.userPubkey]);

  const load = async () => {
    try {
      const resp = await fetch(`/api/trusted-dictionary${query}`);
      const json = await resp.json();
      if (!resp.ok || json.success === false) throw new Error(json.error || `status ${resp.status}`);
      setData({ entries: json.entries || [], snapshots: json.snapshots || [], pov: json.pov || {} });
      setError(null);
    } catch (err) {
      setError(err.message);
      setData({ entries: [], snapshots: [], pov: {} });
    }
  };
  useEffect(() => { load(); }, [query]);

  const authors = useMemo(
    () => [...new Set((data?.entries || []).map((r) => r.author).filter(Boolean))],
    [data]
  );
  const profiles = useProfiles(authors);

  const publishSnapshot = async () => {
    setBusy(true); setMessage(null);
    try {
      const resp = await fetch('/api/normalize/trusted-dictionary-snapshot', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(povParams),
      });
      const json = await resp.json();
      if (!resp.ok || !json.success) throw new Error(json.error || 'Snapshot failed.');
      setMessage(`Published — ${json.snapshot.name}.`);
      await load(); // the strip reflects the mint on the server's say-so
    } catch (err) {
      setMessage(err.message);
    } finally { setBusy(false); }
  };

  const columns = [
    {
      key: 'name', label: 'Name', render: (v, r) => (
        <span>
          {v || <span className="text-muted">{r.coord.slice(0, 24)}…</span>}
          {r.sentinelDeferred && (
            <span className="text-muted" style={{ marginLeft: '0.4rem' }}
              title="Kept private (the deliberate non-affiliation marker) — shown here, never published in a snapshot.">
              🔒 kept private
            </span>
          )}
        </span>
      ),
    },
    { key: 'author', label: 'Author', render: (v, r) => (r.isMine ? <span title="this instance's own header">me</span> : <AuthorCell pubkey={v} profiles={profiles} />) },
    { key: 'qualifyingAuthorCount', label: 'Trusted users' },
    {
      key: 'totalAuthorCount', label: 'All usage', render: (v, r) => (
        <span className="text-muted" title="all cross-author usage (authors / events), trusted or not">
          {v} / {r.totalEventCount}
        </span>
      ),
    },
  ];

  const pov = data?.pov || {};
  const povLine = pov.branch === 'personalized'
    ? 'Scored from your point of view.'
    : pov.fellBackToHouse
      ? 'Your personalized scores are not computed on this instance — showing the house point of view.'
      : 'Scored from the house point of view.';

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>📖 Trusted Dictionary</h1>
      <p className="subtitle">
        The concepts your trust network actually uses — at least {pov.threshold ?? 2} trusted
        {' '}people filing under each. Computed live from the active point of view; published only
        {' '}when you say so.
      </p>

      <p className="text-muted" style={{ fontSize: '0.85rem' }}>{povLine}</p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-primary" style={{ fontSize: '0.85rem' }} disabled={busy || !data}
          title="Mint a dated, signed snapshot of the current view (owner only). Kept-private headers never ride."
          onClick={publishSnapshot}>
          📸 Publish snapshot
        </button>
        <button className="btn" style={{ fontSize: '0.85rem' }} disabled={busy} onClick={() => load()}>
          ↻ Refresh
        </button>
      </div>

      {message && <p style={{ fontSize: '0.85rem' }}>{message}</p>}
      {error && <div className="error">Error: {error}</div>}

      {data === null ? (
        <p>Assembling the dictionary…</p>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data.entries}
            emptyMessage="Nothing here yet — no concept has enough trusted users filing under it."
          />

          {data.snapshots.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem' }}>Published snapshots</h2>
              <ul style={{ fontSize: '0.85rem', paddingLeft: '1.25rem' }}>
                {data.snapshots.map((s) => (
                  <li key={s.id}>
                    {(s.computedAt || '').slice(0, 10) || '—'} — {s.memberCount ?? '?'} concepts
                    {s.pov ? <span className="text-muted"> ({s.pov} POV)</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
