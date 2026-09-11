import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import useCommunitySharedConcepts from '../../hooks/useCommunitySharedConcepts';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';
import { queryRelay } from '../../api/relay';
import { findDListEntries, upsertDListEntry, removeDListEntry, describeDListCuration } from '../../utils/treasureMap';
import { getActiveSignerOrThrow } from '../../utils/signerGuard';
import { publishOrThrow } from '../../utils/publishProfileTag';

const ENDPOINT = '/api/dlist-curation/header';
// Operator-approved copy (story 5 gate, 2026-09-10).
const COPY = "Empower your Tapestry Assistant to curate a community DList on your behalf. Your assistant authors its own header for the list — inheriting the community's items, never duplicating them — and your Treasure Map records that you empowered it.";

const short = (pk) => `${pk.slice(0, 8)}…${pk.slice(-4)}`;
/** The d-tag of an a-tag coordinate — split at the first two colons only (d-tags may contain colons). */
function dTagOf(coord) {
  const i = coord.indexOf(':');
  const j = coord.indexOf(':', i + 1);
  return j > 0 ? coord.slice(j + 1) : coord;
}

/**
 * The DList Curation panel (dlist-curation #5, ADR 0005): folded by default; opens to a keyword
 * search over the community's self-declared shared concepts, an add flow (the assistant's header
 * first — story 4's endpoint — then the user signs the per-DList Map entry), the list of empowered
 * DLists, and revoke per entry (the Map republished without the entry; the header stays).
 *
 * The delegate is the SIGNED-IN USER'S assistant, never the instance owner's (OPEN.md row 188).
 * The body — and with it the community-relay fetch — mounts only when the panel is opened.
 */
export default function DListCurationPanel({ event, onPublished }) {
  const { user } = useAuth();
  const assistantPubkey = user?.assistantPubkey || null;
  const userPubkey = user?.pubkey || null;
  const { aRelays } = useConfig();
  const relayHint = aRelays?.aDListRelays?.[0] || '';
  const [open, setOpen] = useState(false); // folded on every load

  const entries = useMemo(() => findDListEntries(event?.tags), [event]);
  const desc = describeDListCuration(entries);

  // No panel without a provisioned assistant — there is nothing valid to compose.
  if (!event || !assistantPubkey) return null;

  const toggle = () => setOpen((v) => !v);

  return (
    <div style={{
      padding: '1rem', marginBottom: '1rem',
      border: '1px solid var(--border, #444)', borderRadius: '6px',
      backgroundColor: 'var(--bg-primary, #0f0f23)',
    }}>
      {/* Header = the disclosure control AND the status line (the page's settled idiom). */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`DList Curation — ${desc.label}`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault(); // Space would otherwise scroll the page
            toggle();
          }
        }}
        style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem',
          cursor: 'pointer', marginBottom: open ? '0.75rem' : 0,
        }}
      >
        <h4 style={{ margin: 0, fontSize: '0.85rem', opacity: 0.7 }}>{open ? '▾' : '▸'} DList Curation</h4>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: desc.count > 0 ? '#3fb950' : '#8b949e', whiteSpace: 'nowrap' }}>
          {desc.label}
        </span>
      </div>

      {open && (
        <DListCurationBody
          event={event}
          entries={entries}
          userPubkey={userPubkey}
          assistantPubkey={assistantPubkey}
          relayHint={relayHint}
          onPublished={onPublished}
        />
      )}
    </div>
  );
}

function DListCurationBody({ event, entries, userPubkey, assistantPubkey, relayHint, onPublished }) {
  // The same source and dedupe as the Shared Concepts pages; fetched now, on first open.
  const { rows } = useCommunitySharedConcepts();
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState(null); // { mode: 'add' | 'revoke', kind, d, name, outcome }
  const [busy, setBusy] = useState(null);       // a row coordinate, or 'sign'
  const [error, setError] = useState(null);     // { kind: 'conflict' | 'endpoint' | 'publish', message, b? }
  const [showPreview, setShowPreview] = useState(false);
  const [headers, setHeaders] = useState({});   // coordinate → the assistant's header, found locally

  // Own- and assistant-authored headers never appear (AC-3).
  const candidates = useMemo(
    () => (rows || []).filter((r) => r.author !== userPubkey && r.author !== assistantPubkey),
    [rows, userPubkey, assistantPubkey]
  );
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((r) => [r.name, r.description, dTagOf(r.uuid)].some((s) => (s || '').toLowerCase().includes(q)));
  }, [candidates, query]);
  const authors = useMemo(() => visible.map((r) => r.author), [visible]);
  const profiles = useProfiles(authors);

  // Already empowered? Matched by d-tag (ADR 0005 sub-decision 1) — the entry names the assistant.
  const byD = useMemo(() => {
    const m = new Map();
    for (const e of entries) if (e.kind === 39998) m.set(e.d, e);
    return m;
  }, [entries]);

  // The empowered list's header lookup — local strfry only, one query per assistant pubkey
  // (ADR 0005 sub-decision 3); a miss reads "header not found locally", never a guess.
  useEffect(() => {
    let cancelled = false;
    const groups = new Map();
    for (const e of entries) {
      if (!groups.has(e.pubkey)) groups.set(e.pubkey, []);
      groups.get(e.pubkey).push(e);
    }
    (async () => {
      const found = {};
      for (const [pubkey, es] of groups) {
        try {
          const evs = await queryRelay({ kinds: [...new Set(es.map((e) => e.kind))], authors: [pubkey], '#d': es.map((e) => e.d) });
          for (const ev of evs || []) {
            const d = ev.tags?.find((t) => t[0] === 'd')?.[1];
            if (d != null) found[`${ev.kind}:${ev.pubkey}:${d}`] = ev;
          }
        } catch { /* a failed lookup is a miss, reported as such */ }
      }
      if (!cancelled) setHeaders(found);
    })();
    return () => { cancelled = true; };
  }, [entries]);

  // The Map update is composed fresh from the event on screen (never from a stale copy).
  const unsigned = useMemo(() => {
    if (!pending) return null;
    return pending.mode === 'add'
      ? upsertDListEntry(event, 39998, pending.d, assistantPubkey, relayHint)
      : removeDListEntry(event, pending.kind, pending.d);
  }, [pending, event, assistantPubkey, relayHint]);

  async function handleAdd(row) {
    const d = dTagOf(row.uuid);
    setBusy(row.uuid); setError(null); setPending(null); setShowPreview(false);
    try {
      // Header first (story 4): the Map must never point at a header that does not exist.
      const res = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: row.uuid }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setError({ kind: 'conflict', message: data.error || 'The existing header was not re-pointed.', b: data.existing?.b || [] });
        return;
      }
      if (!res.ok || !data.success) {
        setError({ kind: 'endpoint', message: data.error || `Request failed (${res.status}).` });
        return;
      }
      setPending({ mode: 'add', kind: 39998, d, name: row.name || d, outcome: data });
    } catch (err) {
      setError({ kind: 'endpoint', message: err?.message || 'Request failed.' });
    } finally {
      setBusy(null);
    }
  }

  function handleRevoke(entry) {
    setError(null); setShowPreview(false);
    setPending({ mode: 'revoke', kind: entry.kind, d: entry.d, name: entry.d, outcome: null });
  }

  async function handleSignAndPublish() {
    if (!unsigned) return;
    setBusy('sign'); setError(null);
    try {
      // Refuse to sign as an extension account drifted from the session.
      const authorPk = await getActiveSignerOrThrow();
      const signed = await window.nostr.signEvent({ ...unsigned, pubkey: authorPk });
      await publishOrThrow(signed);
      setPending(null);
      if (onPublished) onPublished();
    } catch (err) {
      setError({ kind: 'publish', message: err?.message || 'Publish failed.' });
    } finally {
      setBusy(null);
    }
  }

  const muted = { fontSize: '0.8rem', opacity: 0.6 };
  const mono = { fontFamily: 'monospace', fontSize: '0.75rem' };
  const sectionTitle = { margin: '1rem 0 0.5rem', fontSize: '0.8rem', fontWeight: 600, opacity: 0.8 };

  return (
    <div style={{ fontSize: '0.9rem' }}>
      <p style={{ fontSize: '0.95rem', margin: '0 0 0.75rem' }}>{COPY}</p>

      {/* ── Search the community's shared DLists ── */}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search community DLists by name, description, or d-tag…"
        aria-label="Search community DLists"
        style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.9rem', boxSizing: 'border-box' }}
      />
      {rows === null && <div style={{ ...muted, marginTop: '0.5rem' }}>⏳ Loading community DLists…</div>}
      {rows !== null && candidates.length === 0 && <div style={{ ...muted, marginTop: '0.5rem' }}>No community DLists to curate (yours are excluded).</div>}
      {rows !== null && candidates.length > 0 && visible.length === 0 && <div style={{ ...muted, marginTop: '0.5rem' }}>No matches.</div>}
      {visible.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem', maxHeight: '320px', overflow: 'auto' }}>
          {visible.map((r) => {
            const d = dTagOf(r.uuid);
            const existing = byD.get(d);
            const mine = existing && existing.pubkey === assistantPubkey;
            return (
              <div key={r.uuid} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.6rem', border: '1px solid var(--border, #444)', borderRadius: '6px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '12rem' }}>
                  <div style={{ fontWeight: 600 }}>{r.name || d} <span style={mono}>· {d}</span></div>
                  {r.description && <div style={muted}>{r.description}</div>}
                </div>
                <AuthorCell pubkey={r.author} profiles={profiles} size={20} />
                {mine ? (
                  <button className="btn btn-sm" disabled title="Already on your Treasure Map, naming your assistant">In your Map</button>
                ) : existing ? (
                  <button className="btn btn-sm" onClick={() => handleAdd(r)} disabled={busy !== null} title={`On your Map via another assistant · ${short(existing.pubkey)} — replaces that entry; its header is untouched`}>
                    {busy === r.uuid ? '⏳' : 'Replace'}
                  </button>
                ) : (
                  <button className="btn btn-sm btn-primary" onClick={() => handleAdd(r)} disabled={busy !== null}>
                    {busy === r.uuid ? '⏳ Authoring…' : 'Add'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Errors: endpoint / conflict / publish — the Map on screen is untouched ── */}
      {error && (
        <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', border: '1px solid #f85149', borderRadius: '6px', backgroundColor: 'rgba(248, 81, 73, 0.08)', color: '#f85149', fontSize: '0.85rem' }}>
          {error.kind === 'conflict' ? (
            <>
              <div>Your assistant already has a header for this list pointing elsewhere; it was not re-pointed. Revoke or hand-edit before adding this one.</div>
              {(error.b || []).map((t, i) => <div key={i} style={{ ...mono, marginTop: '0.25rem' }}>{JSON.stringify(t)}</div>)}
            </>
          ) : (
            <>Error: {error.message}</>
          )}
        </div>
      )}

      {/* ── Step 2: the outcome, the composed Map update, preview, Sign & publish ── */}
      {pending && unsigned && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', border: '1px solid #f59e0b', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.06)' }}>
          {pending.mode === 'add' ? (
            <>
              <div style={{ fontWeight: 600 }}>Header {pending.outcome?.existing ? 'already existed' : 'authored'} for <span style={mono}>{pending.d}</span> by your assistant.</div>
              {pending.outcome?.published && (
                <div style={{ ...muted, marginTop: '0.25rem' }}>
                  <div>local strfry: {pending.outcome.published.local}</div>
                  {(pending.outcome.published.relays || []).map((row) => (
                    <div key={row.url}>{row.url}: {row.status}{row.reason ? ` — ${row.reason}` : ''}{row.error ? ` — ${row.error}` : ''}</div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: '0.5rem' }}>Map update: adds <span style={mono}>39998:{pending.d}</span> → your assistant{relayHint ? <> @ <span style={mono}>{relayHint}</span></> : ' (no relay hint configured)'}.</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 600 }}>Revoke <span style={mono}>{pending.kind}:{pending.d}</span>?</div>
              <div style={{ marginTop: '0.25rem' }}>Map update: removes the entry. The assistant's header stays on relays.</div>
            </>
          )}
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-sm" onClick={() => setShowPreview((v) => !v)} style={{ fontSize: '0.8rem' }}>
              {showPreview ? '▾ Hide preview' : '▸ Preview updated event'}
            </button>
            {showPreview && (
              <pre style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary, #1a1a2e)', border: '1px solid var(--border, #444)', borderRadius: '6px', fontSize: '0.75rem', overflow: 'auto', maxHeight: '320px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(unsigned, null, 2)}
              </pre>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-sm btn-primary" onClick={handleSignAndPublish} disabled={busy !== null}>
              {busy === 'sign' ? '⏳ Publishing…' : '📤 Sign & publish'}
            </button>
            <button className="btn btn-sm" onClick={() => { setPending(null); setShowPreview(false); }} disabled={busy !== null}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── The DLists this Map empowers ── */}
      <div style={sectionTitle}>Empowered DLists on your Map</div>
      {entries.length === 0 && <div style={muted}>No DLists empowered on this Map.</div>}
      {entries.map((e) => {
        const coord = `${e.kind}:${e.pubkey}:${e.d}`;
        const header = headers[coord];
        const name = header?.tags?.find((t) => t[0] === 'names')?.[1];
        return (
          <div key={coord} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.6rem', marginBottom: '0.4rem', border: '1px solid var(--border, #444)', borderRadius: '6px', flexWrap: 'wrap' }}>
            <code style={{ fontSize: '0.8rem', fontWeight: 600 }}>{e.kind}:{e.d}</code>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px', backgroundColor: e.pubkey === assistantPubkey ? 'rgba(63, 185, 80, 0.15)' : 'rgba(139, 148, 158, 0.15)', color: e.pubkey === assistantPubkey ? '#3fb950' : '#8b949e', whiteSpace: 'nowrap' }}>
              {e.pubkey === assistantPubkey ? 'your assistant' : `another assistant · ${short(e.pubkey)}`}
            </span>
            {header ? (
              <Link to={`/tapestry/lists/${encodeURIComponent(coord)}`} style={{ color: '#58a6ff' }}>{name || e.d}</Link>
            ) : (
              <span style={muted}>header not found locally</span>
            )}
            {e.relay && <span style={{ ...mono, opacity: 0.55, marginLeft: 'auto' }}>{e.relay}</span>}
            <button className="btn btn-sm" onClick={() => handleRevoke(e)} disabled={busy !== null} title="Republish your Map without this entry; the header stays on relays">Revoke</button>
          </div>
        );
      })}
    </div>
  );
}
