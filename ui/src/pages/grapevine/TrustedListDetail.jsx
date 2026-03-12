import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import DataTable from '../../components/DataTable';
import AuthorCell from '../../components/AuthorCell';
import useProfiles from '../../hooks/useProfiles';
import { queryRelay } from '../../api/relay';

function shortHex(hex) {
  if (!hex) return '—';
  return hex.slice(0, 12) + '…' + hex.slice(-6);
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

export default function TrustedListDetail() {
  const { dTag } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Extract items from tags
  const items = useMemo(() => {
    if (!event) return [];
    const result = [];
    let idx = 0;
    for (const tag of event.tags || []) {
      if (tag[0] === 'p') {
        idx++;
        result.push({
          idx,
          type: 'p',
          value: tag[1],
          relay: tag[2] || '',
          score: tag[3] || null,
        });
      } else if (tag[0] === 'e') {
        idx++;
        result.push({
          idx,
          type: 'e',
          value: tag[1],
          relay: tag[2] || '',
          author: tag[3] || '',
          score: tag[4] || null,
        });
      }
    }
    return result;
  }, [event]);

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

  // Table columns
  const columns = useMemo(() => {
    const cols = [
      { key: 'idx', label: '#', render: (val) => <span style={{ opacity: 0.4 }}>{val}</span> },
    ];

    // For p-tags, show profile; for e-tags show event ID
    const hasPTags = items.some(i => i.type === 'p');
    const hasETags = items.some(i => i.type === 'e');

    if (hasPTags) {
      cols.push({
        key: 'value',
        label: 'Pubkey',
        render: (val, row) => row.type === 'p'
          ? <AuthorCell pubkey={val} profiles={profiles} />
          : <code style={{ fontSize: '0.75rem' }}>{shortHex(val)}</code>,
      });
    }

    if (hasETags) {
      cols.push({
        key: 'value',
        label: 'Event ID',
        render: (val, row) => row.type === 'e'
          ? <code style={{ fontSize: '0.75rem' }}>{shortHex(val)}</code>
          : null,
      });
    }

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
  }, [items, profiles]);

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

      {/* Items table */}
      <h3 style={{ marginBottom: '0.75rem' }}>Items ({items.length})</h3>
      <DataTable
        columns={columns}
        data={items}
        emptyMessage="No items in this Trusted List"
      />
    </div>
  );
}
