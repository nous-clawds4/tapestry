import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import DataTable from '../../components/DataTable';
import { queryRelay } from '../../api/relay';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';

function formatAge(ts) {
  if (!ts) return '—';
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function TrustedLists() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const evts = await queryRelay({ kinds: [30392, 30393, 30394, 30395], limit: 200 });
        if (!cancelled) setEvents(evts);
      } catch (err) {
        console.error('Failed to fetch trusted lists:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, []);

  // Dedupe by kind:pubkey:d-tag (keep most recent)
  const rows = useMemo(() => {
    const byUuid = {};
    for (const ev of events) {
      const dTag = ev.tags?.find(t => t[0] === 'd')?.[1];
      if (!dTag) continue;
      const uuid = `${ev.kind}:${ev.pubkey}:${dTag}`;
      if (!byUuid[uuid] || ev.created_at > byUuid[uuid].created_at) {
        const titleTag = ev.tags?.find(t => t[0] === 'title')?.[1];
        const metricTag = ev.tags?.find(t => t[0] === 'metric')?.[1];
        const pCount = ev.tags?.filter(t => t[0] === 'p').length;
        const eCount = ev.tags?.filter(t => t[0] === 'e').length;
        const itemCount = pCount + eCount;
        const tagType = pCount > 0 ? 'p' : eCount > 0 ? 'e' : '—';

        byUuid[uuid] = {
          id: ev.id,
          uuid,
          kind: ev.kind,
          dTag,
          title: titleTag || dTag,
          metric: metricTag || '—',
          author: ev.pubkey,
          created_at: ev.created_at,
          age: formatAge(ev.created_at),
          itemCount,
          tagType,
        };
      }
    }
    return Object.values(byUuid).sort((a, b) => b.created_at - a.created_at);
  }, [events]);

  const authorPubkeys = useMemo(
    () => [...new Set(rows.map(r => r.author).filter(Boolean))],
    [rows]
  );
  const profiles = useProfiles(authorPubkeys);

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (val, row) => (
        <Link
          to={`/kg/grapevine/trusted-lists/${encodeURIComponent(row.dTag)}`}
          style={{ fontWeight: 500, color: '#58a6ff', textDecoration: 'none' }}
        >
          {val}
        </Link>
      ),
    },
    { key: 'kind', label: 'Kind' },
    {
      key: 'tagType',
      label: 'Tags',
      render: (val) => val === 'p' ? '👤 p-tags' : val === 'e' ? '📄 e-tags' : '—',
    },
    {
      key: 'itemCount',
      label: 'Items',
      render: (val) => <span style={{ fontWeight: 600 }}>{val}</span>,
    },
    {
      key: 'metric',
      label: 'Metric',
      render: (val) => val !== '—' ? <code style={{ fontSize: '0.8rem' }}>{val}</code> : <span style={{ opacity: 0.3 }}>—</span>,
    },
    {
      key: 'author',
      label: 'Author',
      render: (val) => <AuthorCell pubkey={val} profiles={profiles} />,
    },
    {
      key: 'created_at',
      label: 'Age',
      render: (_val, row) => row.age,
    },
    {
      key: 'dTag',
      label: 'd-tag',
      render: (val) => (
        <code style={{ fontSize: '0.72rem', opacity: 0.6 }}>
          {val.length > 30 ? val.slice(0, 30) + '…' : val}
        </code>
      ),
    },
  ];

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>📜 Trusted Lists</h1>
      <p className="subtitle">
        Kind 30392–30395 Trusted List events in local strfry. These are curated, trust-scored summaries
        of list results that can be used as a scoring method on the{' '}
        <Link to="/kg/grapevine/trust-determination" style={{ color: '#58a6ff' }}>
          Trust Determination
        </Link>{' '}
        page.
      </p>

      {loading && <p style={{ opacity: 0.6 }}>Loading trusted lists…</p>}

      {!loading && (
        <DataTable
          columns={columns}
          data={rows}
          emptyMessage="No Trusted Lists found in local strfry"
        />
      )}
    </div>
  );
}
