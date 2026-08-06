import { useEffect, useMemo, useState } from 'react';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import AuthorCell from '../../components/AuthorCell';
import useProfiles from '../../hooks/useProfiles';
import { useConfig } from '../../context/ConfigContext';
import { publishToRelays } from '../../utils/nostrPublish';

// Same community target as the disposition panel and the self-declare button.
const CONCEPT_PUBLISH_RELAYS = ['wss://dcosl.brainstorm.world'];

/**
 * Adoption Queue (ADR shared-concepts-adoption/0002) — the S3 ∖ S2a
 * nomination surface. The SERVER assembles the queue (/api/adoption-queue);
 * this page never re-derives the arithmetic. Proposal-loop shape: the system
 * nominates, the owner ratifies — Adopt (wire one of my headers as the local
 * twin, via the F5 b-append primitive), Recognize (registry record via
 * create-element, identifiers prefilled), or Decline (dated ledger record;
 * reversible from the Declined view). Nothing ever auto-acts.
 */
export default function AdoptionQueue() {
  const { taPubkey } = useConfig();
  const [data, setData] = useState(null); // { nominations, declined } | null
  const [error, setError] = useState(null);
  const [showDeclined, setShowDeclined] = useState(false);
  const [openCoord, setOpenCoord] = useState(null);
  const [twins, setTwins] = useState(null); // my headers for the picker
  const [twinChoice, setTwinChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    try {
      const resp = await fetch('/api/adoption-queue');
      const json = await resp.json();
      if (!resp.ok || json.success === false) throw new Error(json.error || `status ${resp.status}`);
      setData({ nominations: json.nominations || [], declined: json.declined || [] });
      setError(null);
    } catch (err) {
      setError(err.message);
      setData({ nominations: [], declined: [] });
    }
  };
  useEffect(() => { load(); }, []);

  // Twin picker source: this instance's own concept headers.
  useEffect(() => {
    if (!taPubkey) return;
    (async () => {
      try {
        const filter = encodeURIComponent(JSON.stringify({ kinds: [39998], authors: [taPubkey] }));
        const resp = await fetch(`/api/strfry/scan?filter=${filter}`);
        const json = await resp.json();
        const events = json.events || json.data || [];
        const byD = new Map();
        for (const ev of events) {
          const d = ev.tags?.find((t) => t[0] === 'd')?.[1];
          if (d == null) continue;
          const prev = byD.get(d);
          if (!prev || ev.created_at > prev.created_at) byD.set(d, ev);
        }
        const rows = [...byD.entries()].map(([d, ev]) => ({
          handle: `39998:${taPubkey}:${d}`,
          name: ev.tags?.find((t) => t[0] === 'names')?.[1] || d,
        })).sort((a, b) => a.name.localeCompare(b.name));
        setTwins(rows);
      } catch { setTwins([]); }
    })();
  }, [taPubkey]);

  const authors = useMemo(
    () => [...new Set([...(data?.nominations || []), ...(data?.declined || [])].map((r) => r.author).filter(Boolean))],
    [data]
  );
  const profiles = useProfiles(authors);

  const act = async (fn, doneText) => {
    setBusy(true); setMessage(null);
    try {
      await fn();
      setMessage(doneText);
      setOpenCoord(null);
      setTwinChoice('');
      await load(); // the acted-on row leaves its set on the server's say-so
    } catch (err) {
      setMessage(err.message);
    } finally { setBusy(false); }
  };

  const adopt = (nom) => act(async () => {
    if (!twinChoice) throw new Error('Pick one of your headers as the local twin first.');
    const resp = await fetch(`/api/concept/${encodeURIComponent(twinChoice)}/b-append`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: nom.coord }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) throw new Error(json.error || 'Wiring failed.');
    try { await publishToRelays(json.event, CONCEPT_PUBLISH_RELAYS); } catch { /* local success stands */ }
  }, 'Adopted — your twin header now points at the shared concept.');

  const recognize = (nom) => act(async () => {
    const name = (nom.name || nom.coord).trim();
    const resp = await fetch('/api/normalize/create-element', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        concept: 'shared concept',
        name,
        json: {
          sharedConcept: {
            name,
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            description: `Recognized from the adoption queue on ${new Date().toISOString().slice(0, 10)}.`,
            identifiers: { 'a-tag': nom.coord, 'event-id': '' },
          },
        },
      }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) throw new Error(json.error || 'Recognition failed.');
  }, 'Recognized — the registry now identifies this shared concept.');

  const disposition = (target, word, doneText) => act(async () => {
    const resp = await fetch('/api/normalize/adoption-disposition', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, disposition: word }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) throw new Error(json.error || `${word} failed.`);
  }, doneText);

  const nominationColumns = [
    { key: 'name', label: 'Name', render: (v, r) => v || <span className="text-muted">{r.coord.slice(0, 24)}…</span> },
    { key: 'author', label: 'Author', render: (v) => <AuthorCell pubkey={v} profiles={profiles} /> },
    { key: 'eventCount', label: 'Events' },
    { key: 'authorCount', label: 'Authors' },
    { key: 'usedByMe', label: 'Used by me', render: (v) => (v ? <span title="my own filings use this concept (S3a)">✓</span> : <span className="text-muted">—</span>) },
    {
      key: 'coord', label: '', render: (coord) => (
        <button className="btn" style={{ fontSize: '0.75rem' }} onClick={(e) => { e.stopPropagation(); setOpenCoord(openCoord === coord ? null : coord); setMessage(null); }}>
          {openCoord === coord ? 'Close' : 'Review…'}
        </button>
      ),
    },
  ];

  const declinedColumns = [
    { key: 'name', label: 'Name', render: (v, r) => v || <span className="text-muted">{r.target.slice(0, 24)}…</span> },
    { key: 'author', label: 'Author', render: (v) => <AuthorCell pubkey={v} profiles={profiles} /> },
    { key: 'decidedOn', label: 'Declined on', render: (v) => v || <span className="text-muted">—</span> },
    {
      key: 'target', label: '', render: (target) => (
        <button className="btn" style={{ fontSize: '0.75rem' }} disabled={busy}
          onClick={(e) => { e.stopPropagation(); disposition(target, 'requeued', 'Returned to the queue.'); }}>
          Un-decline
        </button>
      ),
    },
  ];

  const openNom = (data?.nominations || []).find((n) => n.coord === openCoord) || null;

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>📥 Adoption Queue</h1>
      <p className="subtitle">
        Shared concepts in demonstrable use that this instance hasn't adopted. The system nominates;
        you ratify — wire a twin, recognize it in the registry, or decline. Nothing happens on its own.
      </p>

      <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', marginBottom: '1rem' }}>
        <input type="checkbox" checked={showDeclined} onChange={(e) => setShowDeclined(e.target.checked)} />
        Show declined
      </label>

      {message && <p style={{ fontSize: '0.85rem' }}>{message}</p>}

      {openNom && (
        <div style={{
          border: '1px solid var(--border, #444)', borderRadius: '8px', padding: '1rem',
          marginBottom: '1rem', backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        }}>
          <strong>Review: {openNom.name || openNom.coord}</strong>
          <div style={{ display: 'flex', gap: '0.5rem', margin: '0.75rem 0', flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={twinChoice} onChange={(e) => setTwinChoice(e.target.value)}
              style={{
                padding: '0.4rem 0.6rem', fontSize: '0.85rem',
                backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
                border: '1px solid var(--border, #444)', borderRadius: '4px',
              }}>
              <option value="">Choose my twin header…</option>
              {(twins || []).map((t) => <option key={t.handle} value={t.handle}>{t.name}</option>)}
            </select>
            <button className="btn btn-primary" disabled={busy || !twinChoice} onClick={() => adopt(openNom)}>
              🔗 Adopt (wire my twin)
            </button>
            <button className="btn" disabled={busy} onClick={() => recognize(openNom)}>
              📒 Recognize in registry
            </button>
            <button className="btn" disabled={busy} onClick={() => disposition(openNom.coord, 'declined', 'Declined — it will stay out of the queue until you reverse it.')}>
              🚫 Decline
            </button>
          </div>
        </div>
      )}

      {error && <div className="error">Error: {error}</div>}
      {data === null ? (
        <p>Assembling the queue…</p>
      ) : showDeclined ? (
        <DataTable
          columns={declinedColumns}
          data={data.declined}
          emptyMessage="Nothing declined — every nomination is still open or adopted."
        />
      ) : (
        <DataTable
          columns={nominationColumns}
          data={data.nominations}
          emptyMessage="The queue is empty — everything in use is adopted, recognized, or declined."
        />
      )}
    </div>
  );
}
