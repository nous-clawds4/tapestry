import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import AuthorCell from '../../components/AuthorCell';
import useProfiles from '../../hooks/useProfiles';
import { declareAndBroadcast, defer as deferHeader, wireAndBroadcast } from '../../utils/dispositionActions';

/**
 * Adoption Queue (ADRs shared-concepts-adoption/0002 + 0003) — one page for
 * the whole adoption loop. The SERVER assembles everything
 * (/api/adoption-queue); this page never re-derives the arithmetic.
 *
 *   Theirs to adopt (F1): foreign shared concepts in cross-author use that
 *     this instance hasn't adopted — Adopt (wire a twin) / Recognize /
 *     Decline (dated ledger; reversible from the Declined view).
 *   Mine to publish (F2): my headers others demonstrably use (z filings and
 *     b affiliations, distinguishably) that carry no b — Submit as a Shared
 *     Concept / Keep private (the sentinel). Kept-private headers with active
 *     usage sit behind a collapsed reveal.
 *
 * Nothing ever auto-acts.
 */
export default function AdoptionQueue() {
  const navigate = useNavigate();
  // Row click (story #9): any queue row opens the raw event behind it.
  const openHeaderEvent = (coord) => {
    if (coord) navigate(`/tapestry/shared-concepts/header/${encodeURIComponent(coord)}`);
  };
  const [data, setData] = useState(null); // { nominations, declined, publishCandidates, deferredInUse } | null
  const [error, setError] = useState(null);
  const [view, setView] = useState('theirs'); // 'theirs' | 'mine' | 'declined'
  const [revealDeferred, setRevealDeferred] = useState(false);
  const [openCoord, setOpenCoord] = useState(null);
  const [twins, setTwins] = useState(null);
  const [twinChoice, setTwinChoice] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async () => {
    try {
      const resp = await fetch('/api/adoption-queue');
      const json = await resp.json();
      if (!resp.ok || json.success === false) throw new Error(json.error || `status ${resp.status}`);
      setData({
        nominations: json.nominations || [],
        declined: json.declined || [],
        publishCandidates: json.publishCandidates || [],
        deferredInUse: json.deferredInUse || [],
      });
      setError(null);
    } catch (err) {
      setError(err.message);
      setData({ nominations: [], declined: [], publishCandidates: [], deferredInUse: [] });
    }
  };
  useEffect(() => { load(); }, []);

  // Twin picker source (F1's adopt action; story #7): my WIREABLE concepts —
  // graph concept headers ∩ has a kind-39998 event, server-assembled. The
  // graph is the identity source (BIBLE §30); raw wire enumeration offered
  // dead orphan addresses.
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch('/api/adoption-twins');
        const json = await resp.json();
        if (!resp.ok || json.success === false) throw new Error(json.error || `status ${resp.status}`);
        setTwins(json.twins || []);
      } catch { setTwins([]); }
    })();
  }, []);

  const authors = useMemo(
    () => [...new Set([...(data?.nominations || []), ...(data?.declined || [])].map((r) => r.author).filter(Boolean))],
    [data]
  );
  const profiles = useProfiles(authors);

  const act = async (fn, fallbackDone) => {
    setBusy(true); setMessage(null);
    try {
      const msg = await fn();
      setMessage(typeof msg === 'string' ? msg : fallbackDone);
      setOpenCoord(null);
      setTwinChoice('');
      await load(); // acted-on rows leave their sets on the server's say-so
    } catch (err) {
      setMessage(err.message);
    } finally { setBusy(false); }
  };

  // ── F1 actions (theirs to adopt) ────────────────────────────────────────
  const adopt = (nom) => act(async () => {
    if (!twinChoice) throw new Error('Pick one of your headers as the local twin first.');
    const msg = await wireAndBroadcast(twinChoice, nom.coord);
    return `Adopted — ${msg}`;
  });
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
    return 'Recognized — the registry now identifies this shared concept.';
  });
  const disposition = (target, word, doneText) => act(async () => {
    const resp = await fetch('/api/normalize/adoption-disposition', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, disposition: word }),
    });
    const json = await resp.json();
    if (!resp.ok || !json.success) throw new Error(json.error || `${word} failed.`);
    return doneText;
  });

  // ── F2 actions (mine to publish) ────────────────────────────────────────
  const submitMine = (coord) => act(() => declareAndBroadcast(coord));
  const keepPrivate = (coord) => act(() => deferHeader(coord));

  const nominationColumns = [
    { key: 'name', label: 'Name', render: (v, r) => v || <span className="text-muted">{r.coord.slice(0, 24)}…</span> },
    { key: 'author', label: 'Author', render: (v) => <AuthorCell pubkey={v} profiles={profiles} /> },
    {
      key: 'eventCount',
      label: <span title="How many events use this concept — each carries a z-tag pointing at this concept header. The concept author's own filings don't count.">Events</span>,
    },
    {
      key: 'authorCount',
      label: <span title="How many distinct people signed those z-tagged events.">Authors</span>,
    },
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

  const evidenceCell = (r) => (
    <span style={{ whiteSpace: 'nowrap' }} title="cross-author filings (events / authors) · affiliations (events / authors)">
      📄 {r.filingEvents}/{r.filingAuthors} · 🔗 {r.affiliationEvents}/{r.affiliationAuthors}
    </span>
  );
  const mineActions = (coord) => (
    <span style={{ display: 'inline-flex', gap: '0.4rem' }}>
      <button className="btn btn-primary" style={{ fontSize: '0.75rem' }} disabled={busy}
        onClick={(e) => { e.stopPropagation(); submitMine(coord); }}>
        🤝 Submit as a Shared Concept
      </button>
      <button className="btn" style={{ fontSize: '0.75rem' }} disabled={busy}
        title="Mark as deliberately unaffiliated (never broadcast)."
        onClick={(e) => { e.stopPropagation(); keepPrivate(coord); }}>
        🔒 Keep private
      </button>
    </span>
  );
  const mineColumns = [
    { key: 'name', label: 'Name', render: (v, r) => v || <span className="text-muted">{r.coord.slice(0, 24)}…</span> },
    { key: 'filingEvents', label: 'Used by others', render: (v, r) => evidenceCell(r) },
    { key: 'coord', label: '', render: (coord) => mineActions(coord) },
  ];
  const deferredColumns = [
    { key: 'name', label: 'Name', render: (v, r) => v || <span className="text-muted">{r.coord.slice(0, 24)}…</span> },
    { key: 'filingEvents', label: 'Used by others', render: (v, r) => evidenceCell(r) },
    {
      key: 'coord', label: '', render: (coord) => (
        <button className="btn btn-primary" style={{ fontSize: '0.75rem' }} disabled={busy}
          title="Publishing replaces the keep-private marker (the un-defer path)."
          onClick={(e) => { e.stopPropagation(); submitMine(coord); }}>
          🤝 Submit as a Shared Concept
        </button>
      ),
    },
  ];

  // Per-view explainers (story #8): each table says what it is and what the
  // buttons do, in the page's plain proposal-loop voice.
  const VIEW_EXPLAINERS = {
    theirs: "Shared concepts published by others that people are actively using by way of the z-tag, included in an element's nostr event to point to the concept header. These elements may be published by you (the 'Used by me' check) and/or by others. Adopt one to wire it (via the b-tag) to your own matching concept, Recognize it in your registry (add it as an element of the concept for Shared Concepts), or Decline to keep it out of this queue.",
    mine: 'Your own concepts that other people already use — 📄 counts filings made under your concept, 🔗 counts affiliations pointing at it. Submit one to offer it as a Shared Concept, or Keep private to stop this page from suggesting it.',
    declined: 'Nominations you turned down. Nothing is deleted — they simply stay out of the queue until you Un-decline them.',
  };

  const openNom = (data?.nominations || []).find((n) => n.coord === openCoord) || null;
  const viewBtn = (key, label) => (
    <button
      className={view === key ? 'btn btn-primary' : 'btn'}
      style={{ fontSize: '0.85rem' }}
      onClick={() => { setView(key); setOpenCoord(null); setMessage(null); }}
    >
      {label}
    </button>
  );

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>📥 Adoption Queue</h1>
      <p className="subtitle">
        The adoption loop, both directions. The system nominates; you ratify. Nothing happens on its own.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        {viewBtn('theirs', 'Theirs to adopt')}
        {viewBtn('mine', 'Mine to publish')}
        {viewBtn('declined', 'Declined')}
      </div>

      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem', maxWidth: '52rem' }}>
        {VIEW_EXPLAINERS[view]}
      </p>

      {message && <p style={{ fontSize: '0.85rem' }}>{message}</p>}

      {view === 'theirs' && openNom && (
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
            <button className="btn btn-primary" disabled={busy || !twinChoice}
              title="Writes a pointer b-tag on your chosen concept header and rebroadcasts it — your concept declares correspondence to this one, and items you publish under it will carry both addresses."
              onClick={() => adopt(openNom)}>
              🔗 Adopt (wire my twin)
            </button>
            <button className="btn" disabled={busy}
              title="Adds this concept as an element of your Shared Concepts registry — catalogued and tracked, with no b-tag written and no affiliation claimed."
              onClick={() => recognize(openNom)}>
              📒 Recognize in registry
            </button>
            <button className="btn" disabled={busy}
              title="Records a dated keep-it-out stance. Nothing is deleted — reverse it any time from the Declined view."
              onClick={() => disposition(openNom.coord, 'declined', 'Declined — it will stay out of the queue until you reverse it.')}>
              🚫 Decline
            </button>
          </div>
        </div>
      )}

      {error && <div className="error">Error: {error}</div>}
      {data === null ? (
        <p>Assembling the queue…</p>
      ) : view === 'declined' ? (
        <DataTable
          columns={declinedColumns}
          data={data.declined}
          onRowClick={(row) => openHeaderEvent(row.target)}
          emptyMessage="Nothing declined — every nomination is still open or adopted."
        />
      ) : view === 'mine' ? (
        <>
          <DataTable
            columns={mineColumns}
            data={data.publishCandidates}
            onRowClick={(row) => openHeaderEvent(row.coord)}
            emptyMessage="Nothing to publish — every header others use is offered or deliberately private."
          />
          {data.deferredInUse.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <button className="btn" style={{ fontSize: '0.8rem' }} onClick={() => setRevealDeferred(!revealDeferred)}>
                {revealDeferred ? '▾' : '▸'} {data.deferredInUse.length} kept-private headers have active usage {revealDeferred ? '' : '— show'}
              </button>
              {revealDeferred && (
                <div style={{ marginTop: '0.5rem' }}>
                  <DataTable columns={deferredColumns} data={data.deferredInUse} onRowClick={(row) => openHeaderEvent(row.coord)} emptyMessage="" />
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <DataTable
          columns={nominationColumns}
          data={data.nominations}
          onRowClick={(row) => openHeaderEvent(row.coord)}
          emptyMessage="The queue is empty — everything in use is adopted, recognized, or declined."
        />
      )}
    </div>
  );
}
