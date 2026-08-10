import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';

/**
 * My Offerings — everything this instance has offered to the community
 * (story shared-concepts-legibility #2, ADR 0002).
 *
 * Distinct from Community Offerings beside it: that page answers "what
 * has the community offered?" from the relay, while this answers "what have I
 * offered?" from two stores — and carries a state the community view cannot
 * have, a declaration that never left this machine.
 *
 * `published` is tri-state. `null` means the relay could not be asked and must
 * never render as not-sent.
 */

const STATE = {
  shared: { icon: '🤝', label: 'Shared', title: 'This declaration is live on the community relay.' },
  unsent: { icon: '⚠️', label: 'Declared here — not yet sent', title: 'Declared on this instance, but the community relay does not have it. Open the concept to send it.' },
  unknown: { icon: '⏳', label: 'Unconfirmed', title: 'The community relay could not be reached, so publication could not be confirmed.' },
};

const stateOf = (published) => (published === null ? STATE.unknown : published ? STATE.shared : STATE.unsent);

export default function MyOfferings() {
  const navigate = useNavigate();
  const [data, setData] = useState(null); // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/my-offerings');
        const json = await resp.json().catch(() => null);
        if (cancelled) return;
        // A failed local read is a non-200 by design — surface it as an error,
        // never as an empty list, which would read as "you have offered nothing".
        if (!resp.ok || !json?.success) {
          setError(json?.error || `HTTP ${resp.status}`);
          return;
        }
        setData(json);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (val, row) => val || <code style={{ fontSize: '0.8rem' }}>{row.coord.split(':').slice(2).join(':')}</code>,
    },
    {
      key: 'description',
      label: 'Description',
      render: (val) => val || <span className="text-muted">—</span>,
    },
    {
      key: 'published',
      label: 'State',
      render: (val) => {
        const s = stateOf(val);
        return <span title={s.title} style={{ whiteSpace: 'nowrap', cursor: 'help' }}>{s.icon} {s.label}</span>;
      },
    },
  ];

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🤝 My Offerings</h1>
      <p className="subtitle" style={{ maxWidth: '52rem' }}>
        Every concept this instance has offered to the community — <strong>including any that never
        made it out</strong>. Declaring a concept and sending it are two steps, and the second can
        fail, so a concept can be offered here without the community ever seeing it. Open a row to
        send one.
      </p>

      {error && <p className="error">Could not read your offerings: {error}</p>}
      {!error && data === null && <p>Loading your offerings…</p>}

      {data && (
        <>
          {/* One page-level statement, not a per-row quirk: when the relay is
              unreachable every row is ⏳ for the same single reason. */}
          {!data.relayOk && (
            <p className="subtitle" style={{ maxWidth: '52rem' }}>
              ⏳ <strong>Publication could not be confirmed.</strong> The community relay
              (<code>{data.relay}</code>) could not be reached{data.relayError ? ` — ${data.relayError}` : ''}, so
              these are your declarations as this instance recorded them. None is known to be unsent.
            </p>
          )}
          <p className="subtitle">{data.offerings.length} offered</p>
          <DataTable
            columns={columns}
            data={data.offerings}
            onRowClick={(row) => navigate(`/tapestry/concepts/${encodeURIComponent(row.coord)}`)}
            emptyMessage="You haven't offered any concepts yet. Submit one from its concept page."
          />
        </>
      )}
    </div>
  );
}
