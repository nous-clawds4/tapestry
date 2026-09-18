import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import DataTable from '../../components/DataTable';
import AuthorCell from '../../components/AuthorCell';
import JsonView from '../../components/JsonView';
import useProfiles from '../../hooks/useProfiles';
import { queryRelay } from '../../api/relay';
import {
  splitTLTags, memberDetail, describeMembership, zHeaderFilter, indexHeaders,
} from '../../utils/trustedListView';

function shortHex(hex) {
  if (!hex) return '—';
  return hex.slice(0, 12) + '…' + hex.slice(-6);
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

/** JsonView with a Viewer / Raw toggle (mirrors the Firmware Explorer's node JSON view). */
function JsonPanel({ data }) {
  const [mode, setMode] = useState('viewer');
  return (
    <div className="firmware-json-view">
      <div className="firmware-json-header">
        {[{ key: 'viewer', label: 'Viewer' }, { key: 'raw', label: 'Raw JSON' }].map((opt) => (
          <button
            key={opt.key}
            className={`firmware-view-btn ${mode === opt.key ? 'active' : ''}`}
            onClick={() => setMode(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {mode === 'viewer'
        ? <JsonView data={data} />
        : <pre className="firmware-json-pre">{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}

export default function TrustedListDetail() {
  const { dTag } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zHeaders, setZHeaders] = useState({});
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const events = await queryRelay({ kinds: [30392, 30393, 30394, 30395], '#d': [dTag], limit: 10 });
        if (cancelled) return;
        if (events.length === 0) {
          setError('Trusted List not found');
        } else {
          // Use most recent
          events.sort((a, b) => b.created_at - a.created_at);
          setEvent(events[0]);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [dTag]);

  // Member / membership / metadata split — the member letter is a function of the kind
  // (30392 p, 30393 e, 30394 a, 30395 i), so a 30393's `p` observer and `a` back-ref are
  // discovery pointers, not members.
  const { members, memberships, otherRefs, metadata } = useMemo(() => splitTLTags(event), [event]);

  const items = useMemo(
    () => members.map((m) => ({ ...m, ...memberDetail(m) })),
    [members]
  );

  // Name each `z` target. One bounded query for the whole set of distinct coordinates,
  // fired after the list itself is on screen — the names are an enrichment, never a gate.
  useEffect(() => {
    let cancelled = false;
    const filter = zHeaderFilter(memberships);
    if (!filter) { setZHeaders({}); return undefined; }
    queryRelay({ ...filter, limit: 100 })
      .then((evts) => { if (!cancelled) setZHeaders(indexHeaders(evts)); })
      .catch(() => { if (!cancelled) setZHeaders({}); });
    return () => { cancelled = true; };
  }, [memberships]);

  const membershipRows = useMemo(
    () => memberships.map((z) => describeMembership(z, zHeaders)),
    [memberships, zHeaders]
  );

  // Collect all pubkeys for profile lookup
  const allPubkeys = useMemo(() => {
    const pks = new Set();
    if (event) pks.add(event.pubkey);
    for (const item of items) {
      if (item.type === 'p') pks.add(item.value);
    }
    return [...pks];
  }, [event, items]);

  const profiles = useProfiles(allPubkeys);

  // Metadata tags
  const title = event?.tags?.find(t => t[0] === 'title')?.[1];
  const metric = event?.tags?.find(t => t[0] === 'metric')?.[1];
  const hasScores = items.some(i => i.score != null);

  // Table columns — one member column, labelled for the kind's member type.
  const columns = useMemo(() => {
    const cols = [
      { key: 'idx', label: '#', render: (val) => <span style={{ opacity: 0.4 }}>{val}</span> },
    ];

    const letter = items[0]?.type;
    const label = letter === 'p' ? 'Pubkey'
      : letter === 'e' ? 'Event ID'
        : letter === 'a' ? 'Coordinate'
          : letter === 'i' ? 'Identity'
            : 'Member';

    cols.push({
      key: 'value',
      label,
      render: (val, row) => (row.type === 'p'
        ? <AuthorCell pubkey={val} profiles={profiles} />
        : row.type === 'e'
          ? <code style={{ fontSize: '0.75rem' }}>{shortHex(val)}</code>
          : <code style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{val}</code>),
    });

    cols.push({
      key: 'type',
      label: 'Tag',
      render: (val) => <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{val}</span>,
    });

    if (hasScores) {
      cols.push({
        key: 'score',
        label: 'Score',
        render: (val) => val != null
          ? <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#3fb950' }}>{val}</span>
          : <span style={{ opacity: 0.3 }}>—</span>,
      });
    }

    return cols;
  }, [items, profiles, hasScores]);

  if (loading) {
    return (
      <div className="page">
        <Breadcrumbs />
        <p style={{ opacity: 0.6 }}>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>📜 Trusted List</h1>
        <p style={{ color: '#f85149' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>📜 {title || dTag}</h1>

      {/* Metadata card */}
      <div style={{
        marginBottom: '1.5rem',
        padding: '1rem',
        border: '1px solid var(--border, #444)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        fontSize: '0.85rem',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '0.3rem 1rem',
      }}>
        <span style={{ opacity: 0.5 }}>Kind:</span>
        <span>{event.kind}</span>

        <span style={{ opacity: 0.5 }}>d-tag:</span>
        <code style={{ fontSize: '0.8rem', color: '#58a6ff' }}>{dTag}</code>

        <span style={{ opacity: 0.5 }}>Author:</span>
        <AuthorCell pubkey={event.pubkey} profiles={profiles} />

        <span style={{ opacity: 0.5 }}>Published:</span>
        <span>{formatDate(event.created_at)}</span>

        <span style={{ opacity: 0.5 }}>Items:</span>
        <span>{items.length}</span>

        {metric && (
          <>
            <span style={{ opacity: 0.5 }}>Metric:</span>
            <code style={{ fontSize: '0.8rem' }}>{metric}</code>
          </>
        )}

        <span style={{ opacity: 0.5 }}>Event ID:</span>
        <code style={{ fontSize: '0.75rem', opacity: 0.6 }}>{event.id}</code>
      </div>

      {/* Memberships — the `z` tags. A `z` means "this event is an element of that
          list/concept", so each row reads as a membership of this list itself. */}
      <h3 style={{ marginBottom: '0.5rem' }}>Memberships ({membershipRows.length})</h3>
      {membershipRows.length === 0 ? (
        <p style={{ opacity: 0.5, fontSize: '0.85rem', marginTop: 0 }}>
          No <code>z</code> tags — this list carries no discovery axis. Lists published before
          ADR dlist-item-tagging/0002 look like this until their next refresh.
        </p>
      ) : (
        <ul className="bs-tl-memberships">
          {membershipRows.map((m) => (
            <li key={m.coord}>
              {m.malformed ? (
                <>
                  <span style={{ color: '#d29922' }}>malformed z tag</span>{' '}
                  <code>{m.coord}</code>
                </>
              ) : (
                <>
                  is a member of{' '}
                  <strong>{m.name || <span style={{ opacity: 0.55 }}>(header not found locally)</span>}</strong>
                  <br />
                  <code>{m.coord}</code>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Items table */}
      <h3 style={{ marginBottom: '0.75rem', marginTop: '1.5rem' }}>Items ({items.length})</h3>
      <DataTable
        columns={columns}
        data={items}
        emptyMessage="No items in this Trusted List"
      />

      {/* Raw event — the ground truth for validating the wire shape. */}
      <h3 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
        Raw event{' '}
        <button
          type="button"
          className="firmware-view-btn"
          onClick={() => setShowRaw((v) => !v)}
          aria-expanded={showRaw}
        >
          {showRaw ? 'Hide' : 'Show'}
        </button>
      </h3>
      {showRaw && (
        <>
          <p style={{ opacity: 0.55, fontSize: '0.8rem', marginTop: 0 }}>
            {members.length} member {members.length === 1 ? 'tag' : 'tags'} ·{' '}
            {memberships.length} <code>z</code> · {otherRefs.length} other single-letter ·{' '}
            {metadata.length} metadata
          </p>
          <JsonPanel data={event} />
        </>
      )}
    </div>
  );
}
